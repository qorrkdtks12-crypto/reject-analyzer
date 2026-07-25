import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationFileName = "20260617183000_phone_verification_dry_run_rpcs.sql";
const migrationPath = path.join(repoRoot, "supabase", "migrations", migrationFileName);

function loadMigrationSql() {
  assert.ok(fs.existsSync(migrationPath), "phone verification dry-run migration is required");
  return fs.readFileSync(migrationPath, "utf8");
}

function getCreateTableBody(sql, tableName) {
  const marker = `create table if not exists public.${tableName} (`;
  const start = sql.toLowerCase().indexOf(marker.toLowerCase());
  assert.notEqual(start, -1, `${tableName} table definition is required`);

  const bodyStart = start + marker.length;
  const bodyEnd = sql.indexOf("\n);", bodyStart);
  assert.notEqual(bodyEnd, -1, `${tableName} table definition end is required`);

  return sql.slice(bodyStart, bodyEnd);
}

function getFunctionBody(sql, functionName) {
  const marker = `create or replace function public.${functionName}`;
  const start = sql.toLowerCase().indexOf(marker.toLowerCase());
  assert.notEqual(start, -1, `${functionName} definition is required`);

  const asStart = sql.toLowerCase().indexOf("as $$", start);
  assert.notEqual(asStart, -1, `${functionName} body start is required`);

  const bodyStart = asStart + "as $$".length;
  const bodyEnd = sql.indexOf("$$;", bodyStart);
  assert.notEqual(bodyEnd, -1, `${functionName} body end is required`);

  return sql.slice(bodyStart, bodyEnd);
}

function assertFunctionGrantShape(sql, functionName, signaturePattern) {
  const escapedFunction = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const signature = signaturePattern || "[^)]*";
  assert.match(
    sql,
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${escapedFunction}\\(${signature}\\)\\s+from\\s+public`, "i")
  );
  assert.match(
    sql,
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${escapedFunction}\\(${signature}\\)\\s+from\\s+anon`, "i")
  );
  assert.match(
    sql,
    new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${escapedFunction}\\(${signature}\\)\\s+to\\s+authenticated`, "i")
  );
}

function testDryRunTableShape() {
  const sql = loadMigrationSql();
  const body = getCreateTableBody(sql, "phone_verification_dry_run_challenges");

  assert.match(body, /\bstatus\s+text\s+not\s+null\s+default\s+'pending'/i);
  assert.match(body, /check\s*\(\s*status\s+in\s+\('pending',\s*'confirmed',\s*'failed',\s*'expired'\)\s*\)/i);
  assert.match(body, /\bdelivery_mode\s+text\s+not\s+null\s+default\s+'dry_run'/i);
  assert.match(body, /\bperson_id\s+uuid\s+not\s+null\s+references\s+public\.persons\(id\)/i);
  assert.match(body, /\bcontact_point_id\s+uuid\s+not\s+null\s+references\s+public\.contact_points\(id\)/i);
  assert.match(body, /\bmetadata\s+jsonb\s+not\s+null\s+default\s+'\{\}'::jsonb/i);
  assert.doesNotMatch(
    body,
    /^\s*(raw_phone|phone|p_phone|code|raw_code|secret|token|destination|destination_hash|value_normalized|masked_destination)\s+/im
  );
  assert.match(sql, /alter\s+table\s+public\.phone_verification_dry_run_challenges\s+enable\s+row\s+level\s+security/i);
}

function testDryRunRpcsExistAndReturnJson() {
  const sql = loadMigrationSql();

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.start_current_person_phone_verification_dry_run\(\s*p_metadata\s+jsonb\s+default\s+'\{\}'::jsonb\s*\)/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.confirm_current_person_phone_verification_dry_run\(\s*p_challenge_id\s+uuid,\s*p_metadata\s+jsonb\s+default\s+'\{\}'::jsonb\s*\)/i);
  assert.match(sql, /returns\s+jsonb/i);
  assert.match(getFunctionBody(sql, "start_current_person_phone_verification_dry_run"), /jsonb_build_object/i);
  assert.match(getFunctionBody(sql, "confirm_current_person_phone_verification_dry_run"), /jsonb_build_object/i);
}

function testStartRpcWritesOnlyDryRunChallenge() {
  const sql = loadMigrationSql();
  const body = getFunctionBody(sql, "start_current_person_phone_verification_dry_run");

  assert.match(body, /\binsert\s+into\s+public\.phone_verification_dry_run_challenges\b/i);
  assert.match(body, /\bupdate\s+public\.phone_verification_dry_run_challenges\b/i);
  assert.match(body, /'delivery_created',\s*false/i);
  assert.match(body, /'real_verification_created',\s*false/i);
  assert.match(body, /'contact_verified',\s*false/i);
  assert.match(body, /'send_eligibility',\s*'not_ready'/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.contact_verifications\b/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.contact_points\b/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.notification_consents\b/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.notification_channel_capabilities\b/i);
}

function testConfirmRpcNeverCreatesRealVerification() {
  const sql = loadMigrationSql();
  const body = getFunctionBody(sql, "confirm_current_person_phone_verification_dry_run");

  assert.match(body, /\bupdate\s+public\.phone_verification_dry_run_challenges\b/i);
  assert.match(body, /'confirmed'/i);
  assert.match(body, /'expired'/i);
  assert.doesNotMatch(body, /'verified'/i);
  assert.match(body, /'contact_verified',\s*false/i);
  assert.match(body, /'send_eligibility',\s*'not_ready'/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.contact_verifications\b/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.contact_points\b/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.notification_consents\b/i);
  assert.doesNotMatch(body, /\b(insert\s+into|update|delete\s+from)\s+public\.notification_channel_capabilities\b/i);
}

function testExistingVerificationStructuresAreNotChanged() {
  const sql = loadMigrationSql();

  assert.doesNotMatch(sql, /alter\s+type\s+scheduler_verification_status/i);
  assert.doesNotMatch(sql, /create\s+type\s+scheduler_verification_status/i);
  assert.doesNotMatch(sql, /alter\s+table\s+public\.contact_verifications\b/i);
  assert.doesNotMatch(sql, /drop\s+table\s+(if\s+exists\s+)?public\.contact_verifications\b/i);
  assert.doesNotMatch(sql, /\b(insert\s+into|update|delete\s+from)\s+public\.contact_verifications\b/i);
}

function testFunctionPermissionsAndNoBaseTableGrants() {
  const sql = loadMigrationSql();
  const policyStatements = sql.match(/create\s+policy[\s\S]*?;/gi) || [];
  const tableGrantStatements = sql.match(/grant\s+\w+[\s\S]*?on\s+table[\s\S]*?;/gi) || [];

  assertFunctionGrantShape(sql, "start_current_person_phone_verification_dry_run", "\\s*jsonb\\s*");
  assertFunctionGrantShape(sql, "confirm_current_person_phone_verification_dry_run", "\\s*uuid,\\s*jsonb\\s*");
  assert.equal(tableGrantStatements.length, 0);
  assert.ok(
    policyStatements.every((statement) => !/\bto\s+(authenticated|anon|public)\b/i.test(statement))
  );
}

function testNoLiveProviderOrDeliveryCalls() {
  const sql = loadMigrationSql();

  assert.doesNotMatch(sql, /\b(http|https|fetch|net\.http|http_post|http_get)\b/i);
  assert.doesNotMatch(sql, /\b(kakao|solapi|aligo|twilio|nhn|web_push)\b/i);
  assert.doesNotMatch(sql, /\b(edge\s+function|supabase\.functions|invoke)\b/i);
}

testDryRunTableShape();
testDryRunRpcsExistAndReturnJson();
testStartRpcWritesOnlyDryRunChallenge();
testConfirmRpcNeverCreatesRealVerification();
testExistingVerificationStructuresAreNotChanged();
testFunctionPermissionsAndNoBaseTableGrants();
testNoLiveProviderOrDeliveryCalls();

console.log("phoneVerificationDryRunMigration tests passed");
