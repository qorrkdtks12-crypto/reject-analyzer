import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildEmailContactConsentPayload,
  buildNotificationConsentPayload,
  buildPhoneContactPayload,
  buildSmsContactConsentPayload,
  confirmCurrentPersonPhoneVerificationDryRun,
  isPhoneVerificationDryRunUiEnabled,
  saveSchedulerV2ContactConsent,
  startCurrentPersonPhoneVerificationDryRun,
  upsertCurrentPersonNotificationConsent,
  upsertCurrentPersonPhoneContact,
  PHONE_VERIFICATION_DRY_RUN_CONFIRM_RPC,
  PHONE_VERIFICATION_DRY_RUN_START_RPC,
  SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC,
  SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC,
  SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC,
} from "../schedulerV2ContactConsentRepository.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function createSupabaseMock(result) {
  const calls = [];
  return {
    calls,
    client: {
      from(tableName) {
        calls.push({ method: "from", tableName });
        throw new Error("raw base table query is not allowed");
      },
      async rpc(functionName, payload) {
        calls.push({ method: "rpc", functionName, payload });
        return result;
      },
    },
  };
}

async function testRpcCallAndDataReturn() {
  const payload = buildSmsContactConsentPayload("010-1234-5678");
  const data = [
    {
      contact_point_id: "contact-1",
      channel: "sms",
      masked_destination: "*******5678",
      value_normalized: "raw-or-hash-should-not-leak",
    },
  ];
  const { client, calls } = createSupabaseMock({ data, error: null });

  const result = await saveSchedulerV2ContactConsent(client, payload);

  assert.deepEqual(result, [
    {
      contact_point_id: "contact-1",
      channel: "sms",
      masked_destination: "*******5678",
    },
  ]);
  assert.deepEqual(calls, [
    { method: "rpc", functionName: SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC, payload },
  ]);
}

async function testPhoneOnlyRpcCallAndMaskedDataReturn() {
  const data = [
    {
      contact_point_id: "contact-1",
      contact_type: "phone",
      contact_status: "active",
      masked_destination: "*******5678",
      destination_hash: "hash-should-not-leak",
      p_phone: "raw-phone-should-not-leak",
      phone: "raw-phone-should-not-leak",
      value_normalized: "normalized-should-not-leak",
    },
  ];
  const { client, calls } = createSupabaseMock({ data, error: null });

  const result = await upsertCurrentPersonPhoneContact(client, "010-1234-5678");

  assert.deepEqual(result, [
    {
      contact_point_id: "contact-1",
      contact_type: "phone",
      contact_status: "active",
      masked_destination: "*******5678",
    },
  ]);
  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC,
      payload: buildPhoneContactPayload("010-1234-5678"),
    },
  ]);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, "upsert_current_person_notification_consent");
}

async function testErrorIsThrown() {
  const expectedError = new Error("rpc failed");
  const { client, calls } = createSupabaseMock({ data: null, error: expectedError });
  const payload = buildSmsContactConsentPayload("010-1234-5678");

  await assert.rejects(
    () => saveSchedulerV2ContactConsent(client, payload),
    expectedError
  );
  assert.deepEqual(calls, [
    { method: "rpc", functionName: SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC, payload },
  ]);
}

async function testPhoneOnlyRpcErrorIsThrownWithoutExtraCalls() {
  const expectedError = new Error("rpc failed");
  const { client, calls } = createSupabaseMock({ data: null, error: expectedError });

  await assert.rejects(
    () => upsertCurrentPersonPhoneContact(client, "010-1234-5678"),
    expectedError
  );
  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC,
      payload: buildPhoneContactPayload("010-1234-5678"),
    },
  ]);
}

async function testNotificationConsentOnlyRpcCallAndSanitizedDataReturn() {
  const data = [
    {
      consent_id: "consent-1",
      channel: "kakao_alimtalk",
      consent_type: "reminder",
      consent_status: "granted",
      source: "reminder_settings_panel",
      destination_hash: "hash-should-not-leak",
      value_normalized: "normalized-should-not-leak",
      raw_phone: "raw-phone-should-not-leak",
    },
  ];
  const { client, calls } = createSupabaseMock({ data, error: null });

  const result = await upsertCurrentPersonNotificationConsent(
    client,
    "kakao_alimtalk",
    "granted"
  );

  assert.deepEqual(result, [
    {
      consent_id: "consent-1",
      channel: "kakao_alimtalk",
      consent_type: "reminder",
      consent_status: "granted",
      source: "reminder_settings_panel",
    },
  ]);
  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC,
      payload: buildNotificationConsentPayload("kakao_alimtalk", "granted"),
    },
  ]);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, "upsert_current_person_kakao_alimtalk_consent");
}

async function testSmsFallbackNotificationConsentRevokedPayload() {
  const { client, calls } = createSupabaseMock({ data: [], error: null });
  const options = {
    consentType: "sms_fallback",
    copyVersion: "notification-consent-test",
    source: "reminder_settings_panel_test",
    metadata: { ui_surface: "test" },
  };

  await upsertCurrentPersonNotificationConsent(client, "sms", "revoked", options);

  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC,
      payload: {
        p_channel: "sms",
        p_consent_type: "sms_fallback",
        p_consent_status: "revoked",
        p_copy_version: "notification-consent-test",
        p_source: "reminder_settings_panel_test",
        p_metadata: {
          ui_surface: "test",
          consent_source: "reminder_settings_panel",
          consent_surface: "notification_consent_split",
        },
      },
    },
  ]);
}

async function testNotificationConsentRejectsUnsupportedInputsBeforeRpc() {
  const { client, calls } = createSupabaseMock({ data: [], error: null });

  await assert.rejects(
    () => upsertCurrentPersonNotificationConsent(client, "email", "granted"),
    /Unsupported notification consent write channel/
  );
  await assert.rejects(
    () => upsertCurrentPersonNotificationConsent(client, "sms", "active"),
    /Unsupported notification consent status/
  );
  assert.deepEqual(calls, []);
}

async function testNotificationConsentErrorIsThrownWithoutExtraCalls() {
  const expectedError = new Error("rpc failed");
  const { client, calls } = createSupabaseMock({ data: null, error: expectedError });

  await assert.rejects(
    () => upsertCurrentPersonNotificationConsent(client, "sms", "granted"),
    expectedError
  );
  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC,
      payload: buildNotificationConsentPayload("sms", "granted"),
    },
  ]);
}

async function testPhoneVerificationDryRunStartUsesOnlyDryRunRpc() {
  const data = {
    challenge_id: "challenge-1",
    status: "pending",
    delivery_mode: "dry_run",
    delivery_created: false,
    masked_destination: "raw-mask-should-not-leak",
    expires_at: "2026-07-25T10:00:00Z",
    contact_verified: false,
    send_eligibility: "not_ready",
    raw_phone: "raw-phone-should-not-leak",
    code: "code-should-not-leak",
  };
  const { client, calls } = createSupabaseMock({ data, error: null });

  const result = await startCurrentPersonPhoneVerificationDryRun(client);

  assert.deepEqual(result, {
    challengeId: "challenge-1",
    status: "pending",
    deliveryMode: "dry_run",
    deliveryCreated: false,
    expiresAt: "2026-07-25T10:00:00Z",
    contactVerified: false,
    sendEligibility: "not_ready",
  });
  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: PHONE_VERIFICATION_DRY_RUN_START_RPC,
      payload: {
        p_metadata: {
          ui_surface: "reminder_settings_panel_hidden_dry_run",
        },
      },
    },
  ]);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC);
}

async function testPhoneVerificationDryRunConfirmUsesOnlyDryRunRpc() {
  const data = {
    challenge_id: "challenge-1",
    status: "confirmed",
    delivery_mode: "dry_run",
    delivery_created: false,
    contact_verified: false,
    send_eligibility: "not_ready",
    raw_code: "raw-code-should-not-leak",
    token: "token-should-not-leak",
  };
  const { client, calls } = createSupabaseMock({ data, error: null });

  const result = await confirmCurrentPersonPhoneVerificationDryRun(client, "challenge-1", {
    metadata: { code_entered: true },
  });

  assert.deepEqual(result, {
    challengeId: "challenge-1",
    status: "confirmed",
    deliveryMode: "dry_run",
    deliveryCreated: false,
    expiresAt: "",
    contactVerified: false,
    sendEligibility: "not_ready",
  });
  assert.deepEqual(calls, [
    {
      method: "rpc",
      functionName: PHONE_VERIFICATION_DRY_RUN_CONFIRM_RPC,
      payload: {
        p_challenge_id: "challenge-1",
        p_metadata: {
          code_entered: true,
          ui_surface: "reminder_settings_panel_hidden_dry_run",
        },
      },
    },
  ]);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_PHONE_CONTACT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC);
  assert.notEqual(calls[0].functionName, SCHEDULER_V2_NOTIFICATION_CONSENT_WRITE_RPC);
}

async function testPhoneVerificationDryRunConfirmRequiresChallenge() {
  const { client, calls } = createSupabaseMock({ data: null, error: null });

  await assert.rejects(
    () => confirmCurrentPersonPhoneVerificationDryRun(client, ""),
    /Dry-run challenge is required/
  );
  assert.deepEqual(calls, []);
}

function testPhoneVerificationDryRunHiddenGate() {
  assert.equal(isPhoneVerificationDryRunUiEnabled("?phone_verification_dry_run=1"), true);
  assert.equal(isPhoneVerificationDryRunUiEnabled("?phone_verification_dry_run=0"), false);
  assert.equal(isPhoneVerificationDryRunUiEnabled("?x=1"), false);
  assert.equal(isPhoneVerificationDryRunUiEnabled(""), false);
}

function testPhoneVerificationDryRunPanelIsHiddenAndNonVerifying() {
  const panelPath = path.join(repoRoot, "src", "components", "reminder", "ReminderSettingsPanel.jsx");
  const source = fs.readFileSync(panelPath, "utf8");
  const panelStart = source.indexOf("function PhoneVerificationDryRunPanel");
  const panelEnd = source.indexOf("function NotificationConsentSplitForm", panelStart);
  assert.notEqual(panelStart, -1);
  assert.notEqual(panelEnd, -1);

  const panelSource = source.slice(panelStart, panelEnd);
  assert.match(source, /isPhoneVerificationDryRunUiEnabled\(\)\s*\?\s*\(/);
  assert.match(source, /dry-run 확인 완료 · 실제 인증 아님/);
  assert.match(panelSource, /인증 흐름 테스트/);
  assert.match(panelSource, /개발용 dry-run입니다\. 실제 문자 발송이나 번호 인증은 이루어지지 않아요\./);
  assert.doesNotMatch(panelSource, /인증 완료|연락처 확인 완료|알림톡 사용 가능|발송 준비 완료/);
}

async function testInvalidClientThrows() {
  await assert.rejects(
    () => saveSchedulerV2ContactConsent({}, {}),
    /Supabase client with rpc\(\) is required/
  );
}

function testPhoneContactPayloadBuilder() {
  const payload = buildPhoneContactPayload("010 1234 5678", {
    isPrimary: false,
    metadata: { ui_surface: "test" },
  });

  assert.deepEqual(payload, {
    p_phone: "01012345678",
    p_is_primary: false,
    p_metadata: {
      ui_surface: "test",
      contact_source: "reminder_settings_panel",
      contact_purpose: "notification_contact",
    },
  });
}

function testSmsPayloadBuilder() {
  const payload = buildSmsContactConsentPayload("010 1234 5678", {
    isPrimary: false,
    metadata: { ui_surface: "test" },
  });

  assert.deepEqual(payload, {
    p_channel: "sms",
    p_destination: "01012345678",
    p_consent_type: "reminder",
    p_consent_status: "granted",
    p_is_primary: false,
    p_metadata: {
      ui_surface: "test",
      contact_source: "reminder_settings_panel",
      copy_version: "scheduler-v2-contact-consent-20260612",
    },
  });
}

function testEmailPayloadBuilder() {
  const payload = buildEmailContactConsentPayload("USER@example.com");

  assert.equal(payload.p_channel, "email");
  assert.equal(payload.p_destination, "user@example.com");
  assert.equal(payload.p_is_primary, false);
}

async function testEmailWriteUsesRpc() {
  const payload = buildEmailContactConsentPayload("USER@example.com");
  const { client, calls } = createSupabaseMock({ data: [], error: null });

  await saveSchedulerV2ContactConsent(client, payload);

  assert.deepEqual(calls, [
    { method: "rpc", functionName: SCHEDULER_V2_CONTACT_CONSENT_WRITE_RPC, payload },
  ]);
}

async function testKakaoChannelWriteIsBlockedBeforeRpc() {
  const { client, calls } = createSupabaseMock({ data: [], error: null });
  const blockedChannel = ["kakao", "alimtalk"].join("_");
  const payload = {
    p_channel: blockedChannel,
    p_destination: ["kakao", "alimtalk:pending"].join("_"),
    p_consent_type: "reminder",
    p_consent_status: "granted",
    p_is_primary: true,
    p_metadata: {},
  };

  await assert.rejects(
    () => saveSchedulerV2ContactConsent(client, payload),
    /Unsupported contact consent write channel/
  );
  assert.deepEqual(calls, []);
}

function testInvalidPayloadsThrow() {
  assert.throws(() => buildPhoneContactPayload("123"), /valid phone number/);
  assert.throws(() => buildSmsContactConsentPayload("123"), /valid phone number/);
  assert.throws(() => buildEmailContactConsentPayload("not-email"), /valid email address/);
}

await testRpcCallAndDataReturn();
await testPhoneOnlyRpcCallAndMaskedDataReturn();
await testErrorIsThrown();
await testPhoneOnlyRpcErrorIsThrownWithoutExtraCalls();
await testNotificationConsentOnlyRpcCallAndSanitizedDataReturn();
await testSmsFallbackNotificationConsentRevokedPayload();
await testNotificationConsentRejectsUnsupportedInputsBeforeRpc();
await testNotificationConsentErrorIsThrownWithoutExtraCalls();
await testPhoneVerificationDryRunStartUsesOnlyDryRunRpc();
await testPhoneVerificationDryRunConfirmUsesOnlyDryRunRpc();
await testPhoneVerificationDryRunConfirmRequiresChallenge();
testPhoneVerificationDryRunHiddenGate();
testPhoneVerificationDryRunPanelIsHiddenAndNonVerifying();
await testInvalidClientThrows();
testPhoneContactPayloadBuilder();
testSmsPayloadBuilder();
testEmailPayloadBuilder();
await testEmailWriteUsesRpc();
await testKakaoChannelWriteIsBlockedBeforeRpc();
testInvalidPayloadsThrow();

console.log("schedulerV2ContactConsentRepository tests passed");
