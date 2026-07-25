# Scheduler v2 Disposable Reset/Reapply Verification Plan

## 1. Status

PLAN_DRAFT

## 2. Why this plan exists

PR #814 changed the source migration after the disposable project had already applied an older version of `20260604000000`.

PR #817 recommended a disposable-only reset/recreate and current-source reapply path before RLS apply verification.

This plan defines the safe approval, execution, and verification criteria. It does not execute them.

## 3. Scope

In scope:

- disposable project only
- current scheduler v2 source migration reapply planning
- object-level verification criteria
- approval phrase and stop conditions

Out of scope:

- production/staging
- SQL Editor
- live provider calls
- RLS helper creation
- client policy creation
- account merge/backfill
- env/secret changes

## 4. Preconditions before any future execution

- Confirm target project is the disposable project only
- Confirm target project ref is not production/staging
- Confirm current `origin/main` includes PR #814 and PR #817
- Confirm source migration contains `account_identities.auth_user_id`
- Confirm no production/staging apply command is planned
- Confirm user has explicitly approved the exact disposable reset/reapply operation
- Confirm no DB password/service role/anon key/access token will be printed or documented

## 5. Required explicit user approval phrase

Future execution must not begin unless the user provides this exact approval phrase:

`Disposable project ref가 production/staging과 다름을 확인했습니다. 이 disposable project를 reset/recreate하고 current scheduler v2 schema migration apply verification을 진행해도 됩니다.`

If the phrase is missing or altered, do not execute reset/reapply.

## 6. Recommended future execution path

Preferred path: recreate/reset disposable project, then apply current source migration from scratch.

The future execution PR/task should decide between:

### Path A - Recreate disposable project

Use if clean project creation is available and project visibility can be confirmed.

Required verification:

- old disposable is not production/staging
- new disposable project is visible in CLI/dashboard
- new project ref is documented only as masked ref
- current migration applies from scratch

### Path B - Reset existing disposable project

Use only if recreate is impractical and reset is clearly disposable-only.

Required verification:

- reset target is confirmed disposable-only
- project ref is masked
- reset does not affect production/staging
- current migration applies from scratch after reset

## 7. Planned verification checks after future apply

Catalog/object-level checks should verify:

- expected scheduler v2 enum/type count
- expected scheduler v2 table count
- `account_identities.auth_user_id` exists
- `account_identities.auth_user_id` references `auth.users(id)`
- `account_identities.provider_user_id` still exists and is provider-specific
- active `account_identities_active_auth_user_id_key` index exists
- active `account_identities_active_provider_user_id_key` index exists
- `web_push_subscription_owners` still stores endpoint_hash, not raw endpoint/p256dh/auth
- `notification_delivery_claims` idempotency indexes still exist
- RLS enabled state is recorded
- policy count is recorded
- user trigger count is recorded
- scheduler public function count is recorded
- no backfill object/procedure observed

## 8. Stop conditions

Future execution must stop if:

- target project is not clearly disposable
- target project ref matches or may match production/staging
- CLI shows only the production/staging project
- DB password or secret would need to be printed/stored
- apply command points to linked production/staging
- migration list is ambiguous
- object verification cannot distinguish old schema from current schema
- unexpected user triggers/functions/backfill objects appear
- any command would modify Edge Functions/frontend/env/cron/provider config

## 9. Required future result document

Future execution must produce a result document with:

- target project name
- masked project ref
- whether recreate or reset was used
- exact confirmation that production/staging were not touched
- migration apply result
- object-level verification result
- `auth_user_id` column verification
- active auth/provider unique index verification
- RLS/policy state
- secrets handling statement
- remaining gaps

## 10. Non-goals for this PR

- No DB apply
- No disposable reset/recreate
- No DB query
- No Supabase CLI apply/reset/start
- No SQL migration changes
- No RLS helper creation
- No client policy creation
- No production/staging access
