-- Phone verification dry-run challenge surface only.
-- This does not send messages and does not create real contact verification rows.

create table if not exists public.phone_verification_dry_run_challenges (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  contact_point_id uuid not null references public.contact_points(id) on delete cascade,
  status text not null default 'pending',
  delivery_mode text not null default 'dry_run',
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  confirmed_at timestamptz null,
  failed_at timestamptz null,
  expired_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phone_verification_dry_run_challenges_status_check
    check (status in ('pending', 'confirmed', 'failed', 'expired')),
  constraint phone_verification_dry_run_challenges_delivery_mode_check
    check (delivery_mode = 'dry_run'),
  constraint phone_verification_dry_run_challenges_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.phone_verification_dry_run_challenges
is 'Dry-run phone verification challenge records only. These rows do not create real contact verification, consent, capability, or delivery state.';

comment on column public.phone_verification_dry_run_challenges.metadata
is 'Non-secret dry-run metadata only. Do not store raw destinations, challenge answers, tokens, or provider credentials.';

create index if not exists phone_verification_dry_run_challenges_person_idx
  on public.phone_verification_dry_run_challenges (person_id, created_at desc);

create index if not exists phone_verification_dry_run_challenges_contact_status_idx
  on public.phone_verification_dry_run_challenges (contact_point_id, status, expires_at);

alter table public.phone_verification_dry_run_challenges enable row level security;

drop policy if exists service_role_manage_phone_verification_dry_run_challenges
  on public.phone_verification_dry_run_challenges;

create policy service_role_manage_phone_verification_dry_run_challenges
  on public.phone_verification_dry_run_challenges
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.start_current_person_phone_verification_dry_run(
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_person_ids uuid[];
  v_person_id uuid;
  v_contact_point_id uuid;
  v_masked_destination text;
  v_challenge_id uuid;
  v_expires_at timestamptz;
  v_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  select coalesce(array_agg(c.person_id order by c.person_id), '{}') into v_person_ids
  from public.current_person_ids() c(person_id);

  if array_length(v_person_ids, 1) is null then
    raise exception 'PERSON_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if array_length(v_person_ids, 1) <> 1 then
    raise exception 'AMBIGUOUS_PERSON'
      using errcode = 'P0001';
  end if;

  v_person_id := v_person_ids[1];

  select cp.id, cp.masked_destination
    into v_contact_point_id, v_masked_destination
  from public.contact_points cp
  where cp.person_id = v_person_id
    and cp.type = 'phone'
    and cp.status = 'active'
  order by cp.is_primary desc, cp.updated_at desc, cp.created_at desc, cp.id
  limit 1;

  if v_contact_point_id is null then
    raise exception 'ACTIVE_PHONE_CONTACT_REQUIRED'
      using errcode = 'P0001';
  end if;

  update public.phone_verification_dry_run_challenges challenge
  set status = 'expired',
      expired_at = coalesce(challenge.expired_at, now()),
      updated_at = now()
  where challenge.person_id = v_person_id
    and challenge.contact_point_id = v_contact_point_id
    and challenge.status = 'pending'
    and challenge.expires_at <= now();

  v_expires_at := now() + interval '15 minutes';
  v_metadata := coalesce(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'write_path', 'start_current_person_phone_verification_dry_run',
      'dry_run', true,
      'delivery_created', false,
      'real_verification_created', false,
      'contact_verified', false,
      'send_eligibility', 'not_ready'
    );

  insert into public.phone_verification_dry_run_challenges (
    person_id,
    contact_point_id,
    status,
    delivery_mode,
    expires_at,
    metadata
  )
  values (
    v_person_id,
    v_contact_point_id,
    'pending',
    'dry_run',
    v_expires_at,
    v_metadata
  )
  returning id into v_challenge_id;

  return jsonb_build_object(
    'challenge_id', v_challenge_id,
    'status', 'pending',
    'delivery_mode', 'dry_run',
    'delivery_created', false,
    'masked_destination', v_masked_destination,
    'expires_at', v_expires_at,
    'contact_verified', false,
    'send_eligibility', 'not_ready'
  );
end;
$$;

comment on function public.start_current_person_phone_verification_dry_run(jsonb)
is 'Creates a dry-run phone verification challenge for the current person active phone contact. No message is sent and no real contact verification, consent, or capability state is written.';

revoke all on function public.start_current_person_phone_verification_dry_run(jsonb) from public;
revoke all on function public.start_current_person_phone_verification_dry_run(jsonb) from anon;
grant execute on function public.start_current_person_phone_verification_dry_run(jsonb) to authenticated;

create or replace function public.confirm_current_person_phone_verification_dry_run(
  p_challenge_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_person_ids uuid[];
  v_person_id uuid;
  v_challenge public.phone_verification_dry_run_challenges%rowtype;
  v_status text;
  v_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  if p_challenge_id is null then
    raise exception 'CHALLENGE_REQUIRED'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(c.person_id order by c.person_id), '{}') into v_person_ids
  from public.current_person_ids() c(person_id);

  if array_length(v_person_ids, 1) is null then
    raise exception 'PERSON_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  if array_length(v_person_ids, 1) <> 1 then
    raise exception 'AMBIGUOUS_PERSON'
      using errcode = 'P0001';
  end if;

  v_person_id := v_person_ids[1];

  select challenge.* into v_challenge
  from public.phone_verification_dry_run_challenges challenge
  where challenge.id = p_challenge_id
    and challenge.person_id = v_person_id
  limit 1;

  if v_challenge.id is null then
    raise exception 'CHALLENGE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  v_status := case
    when v_challenge.status = 'pending' and v_challenge.expires_at <= now() then 'expired'
    when v_challenge.status = 'pending' then 'confirmed'
    else v_challenge.status
  end;

  v_metadata := coalesce(v_challenge.metadata, '{}'::jsonb)
    || coalesce(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'write_path', 'confirm_current_person_phone_verification_dry_run',
      'dry_run', true,
      'delivery_created', false,
      'real_verification_created', false,
      'contact_verified', false,
      'send_eligibility', 'not_ready'
    );

  update public.phone_verification_dry_run_challenges challenge
  set status = v_status,
      confirmed_at = case
        when v_status = 'confirmed' then coalesce(challenge.confirmed_at, now())
        else challenge.confirmed_at
      end,
      expired_at = case
        when v_status = 'expired' then coalesce(challenge.expired_at, now())
        else challenge.expired_at
      end,
      metadata = v_metadata,
      updated_at = now()
  where challenge.id = v_challenge.id;

  return jsonb_build_object(
    'challenge_id', v_challenge.id,
    'status', v_status,
    'delivery_mode', 'dry_run',
    'delivery_created', false,
    'contact_verified', false,
    'send_eligibility', 'not_ready'
  );
end;
$$;

comment on function public.confirm_current_person_phone_verification_dry_run(uuid, jsonb)
is 'Confirms only a dry-run phone verification challenge. It does not create real contact verification rows or mark any contact as verified.';

revoke all on function public.confirm_current_person_phone_verification_dry_run(uuid, jsonb) from public;
revoke all on function public.confirm_current_person_phone_verification_dry_run(uuid, jsonb) from anon;
grant execute on function public.confirm_current_person_phone_verification_dry_run(uuid, jsonb) to authenticated;
