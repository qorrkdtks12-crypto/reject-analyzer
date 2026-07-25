export const SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC =
  "upsert_current_person_contact_consent";
export const SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC =
  "upsert_current_person_phone_contact";
export const SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC =
  "upsert_current_person_notification_consent";
export const PHONE_VERIFICATION_DRY_RUN_START_RPC =
  "start_current_person_phone_verification_dry_run";
export const PHONE_VERIFICATION_DRY_RUN_CONFIRM_RPC =
  "confirm_current_person_phone_verification_dry_run";

const RAW_DESTINATION_KEYS = new Set([
  "code",
  "destination",
  "destination_hash",
  "p_phone",
  "p_destination",
  "raw_code",
  "phone",
  "raw_phone",
  "secret",
  "token",
  "value_normalized",
  "raw_destination",
]);
const PHONE_VERIFICATION_DRY_RUN_PARAM = "phone_verification_dry_run";
const SUPPORTED_FRONTEND_WRITE_CHANNELS = new Set(["sms", "email"]);
const SUPPORTED_NOTIFICATION_CONSENT_CHANNELS = new Set(["kakao_alimtalk", "sms"]);
const SUPPORTED_NOTIFICATION_CONSENT_STATUSES = new Set(["granted", "revoked"]);

function sanitizeRpcResult(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeRpcResult);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !RAW_DESTINATION_KEYS.has(key))
      .map(([key, item]) => [key, sanitizeRpcResult(item)])
  );
}

function normalizePhoneInput(phoneLikeInput) {
  const normalized = String(phoneLikeInput || "").replace(/[^\d+]/g, "");
  if (normalized.length < 8) {
    throw new Error("A valid phone number is required.");
  }
  return normalized;
}

function requireRpcClient(supabaseClient) {
  if (!supabaseClient || typeof supabaseClient.rpc !== "function") {
    throw new Error("Supabase client with rpc() is required.");
  }
}

function buildDryRunMetadata(metadata = {}) {
  return {
    ...(metadata || {}),
    ui_surface: "reminder_settings_panel_hidden_dry_run",
  };
}

function sanitizeDryRunResult(value) {
  const sanitized = sanitizeRpcResult(value) || {};
  return {
    challengeId: sanitized.challenge_id || null,
    status: sanitized.status || "",
    deliveryMode: sanitized.delivery_mode || "",
    deliveryCreated: sanitized.delivery_created === true,
    expiresAt: sanitized.expires_at || "",
    contactVerified: sanitized.contact_verified === true,
    sendEligibility: sanitized.send_eligibility || "",
  };
}

export function isPhoneVerificationDryRunUiEnabled(search) {
  if (typeof search !== "string") {
    if (typeof window === "undefined") return false;
    search = window.location?.search || "";
  }
  return new URLSearchParams(search).get(PHONE_VERIFICATION_DRY_RUN_PARAM) === "1";
}

export function buildSmsContactConsentPayload(phoneLikeInput, options = {}) {
  return {
    p_channel: "sms",
    p_destination: normalizePhoneInput(phoneLikeInput),
    p_consent_type: options.consentType || "reminder",
    p_consent_status: options.consentStatus || "granted",
    p_is_primary: options.isPrimary !== false,
    p_metadata: {
      ...(options.metadata || {}),
      contact_source: "reminder_settings_panel",
      copy_version: options.copyVersion || "scheduler-v2-contact-consent-20260612",
    },
  };
}

export function buildPhoneContactPayload(phoneLikeInput, options = {}) {
  return {
    p_phone: normalizePhoneInput(phoneLikeInput),
    p_is_primary: options.isPrimary !== false,
    p_metadata: {
      ...(options.metadata || {}),
      contact_source: "reminder_settings_panel",
      contact_purpose: "notification_contact",
    },
  };
}

export function buildNotificationConsentPayload(channel, consentStatus, options = {}) {
  if (!SUPPORTED_NOTIFICATION_CONSENT_CHANNELS.has(channel)) {
    throw new Error("Unsupported notification consent write channel.");
  }
  if (!SUPPORTED_NOTIFICATION_CONSENT_STATUSES.has(consentStatus)) {
    throw new Error("Unsupported notification consent status.");
  }

  return {
    p_channel: channel,
    p_consent_type: options.consentType || "reminder",
    p_consent_status: consentStatus,
    p_copy_version: options.copyVersion || "notification-consent-20260616",
    p_source: options.source || "reminder_settings_panel",
    p_metadata: {
      ...(options.metadata || {}),
      consent_source: "reminder_settings_panel",
      consent_surface: "notification_consent_split",
    },
  };
}

export function buildEmailContactConsentPayload(emailLikeInput, options = {}) {
  const destination = String(emailLikeInput || "").trim().toLowerCase();
  if (!destination.includes("@")) {
    throw new Error("A valid email address is required.");
  }

  return {
    p_channel: "email",
    p_destination: destination,
    p_consent_type: options.consentType || "reminder",
    p_consent_status: options.consentStatus || "granted",
    p_is_primary: options.isPrimary === true,
    p_metadata: {
      ...(options.metadata || {}),
      contact_source: "reminder_settings_panel",
      copy_version: options.copyVersion || "scheduler-v2-contact-consent-20260612",
    },
  };
}

export async function saveSchedulerV2ContactConsent(supabaseClient, payload) {
  requireRpcClient(supabaseClient);
  if (!SUPPORTED_FRONTEND_WRITE_CHANNELS.has(payload?.p_channel)) {
    throw new Error("Unsupported contact consent write channel.");
  }

  const { data, error } = await supabaseClient.rpc(
    SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC,
    payload
  );

  if (error) {
    throw error;
  }

  return sanitizeRpcResult(data);
}

export async function upsertCurrentPersonPhoneContact(supabaseClient, phoneLikeInput, options = {}) {
  requireRpcClient(supabaseClient);

  const payload = buildPhoneContactPayload(phoneLikeInput, options);
  const { data, error } = await supabaseClient.rpc(
    SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC,
    payload
  );

  if (error) {
    throw error;
  }

  return sanitizeRpcResult(data);
}

export async function upsertCurrentPersonNotificationConsent(
  supabaseClient,
  channel,
  consentStatus,
  options = {}
) {
  requireRpcClient(supabaseClient);

  const payload = buildNotificationConsentPayload(channel, consentStatus, options);
  const { data, error } = await supabaseClient.rpc(
    SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC,
    payload
  );

  if (error) {
    throw error;
  }

  return sanitizeRpcResult(data);
}

export async function startCurrentPersonPhoneVerificationDryRun(supabaseClient, options = {}) {
  requireRpcClient(supabaseClient);

  const { data, error } = await supabaseClient.rpc(
    PHONE_VERIFICATION_DRY_RUN_START_RPC,
    {
      p_metadata: buildDryRunMetadata(options.metadata),
    }
  );

  if (error) {
    throw error;
  }

  return sanitizeDryRunResult(data);
}

export async function confirmCurrentPersonPhoneVerificationDryRun(
  supabaseClient,
  challengeId,
  options = {}
) {
  requireRpcClient(supabaseClient);
  if (!challengeId) {
    throw new Error("Dry-run challenge is required.");
  }

  const { data, error } = await supabaseClient.rpc(
    PHONE_VERIFICATION_DRY_RUN_CONFIRM_RPC,
    {
      p_challenge_id: challengeId,
      p_metadata: buildDryRunMetadata(options.metadata),
    }
  );

  if (error) {
    throw error;
  }

  return sanitizeDryRunResult(data);
}
