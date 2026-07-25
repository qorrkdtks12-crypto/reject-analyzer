import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import handler, {
  handleGithubConnectionCallbackStub,
  handleGithubConnectionPrepare,
  handleGithubConnectionStatus,
  handleGithubDailyReviewRequest,
  handleGithubRecentPullRequestsImport,
  handleGithubRepositoryAccessList,
  handleGithubRepositoryAccessPreview,
  handleGithubRepositoryAccessSelect,
  readGithubConnectionStatus,
} from "../api/save-analysis-run.js";
import {
  GITHUB_RAW_PAYLOAD_FORBIDDEN_KEYS,
  GITHUB_TOKEN_FORBIDDEN_KEYS,
} from "../server/api-helpers/github-app-connection.js";
import {
  buildGithubAppInstallUrl,
  normalizeGithubAppSlug,
  readGithubAppPublicConfig,
} from "../server/api-helpers/github-app-config.js";
import { hashGithubConnectionState } from "../server/api-helpers/github-connection-state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const verifiedUserId = "00000000-0000-4000-8000-000000000904";

const forbiddenResponseKeys = new Set([
  ...GITHUB_TOKEN_FORBIDDEN_KEYS,
  ...GITHUB_RAW_PAYLOAD_FORBIDDEN_KEYS,
]);

const authDeps = {
  supabase: { auth: {} },
  verifyAccessToken: async ({ accessToken }) => {
    if (accessToken !== "test-token") {
      return { ok: false, status: 401, message: "Invalid or expired Supabase token" };
    }
    return { ok: true, userId: verifiedUserId };
  },
  readStatus: async () => ({ connection: null, repositoriesSelected: 0 }),
  readConfig: () => readGithubAppPublicConfig({}),
  createState: async () => {
    throw new Error("state must not be created when GitHub App config is missing or invalid");
  },
};

function mockReq({ action, method = "POST", body = {}, token = "test-token" } = {}) {
  return {
    method,
    query: action ? { action } : {},
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.push(key.toLowerCase());
    collectKeys(child, keys);
  }
  return keys;
}

function assertNoForbiddenResponseKeys(value) {
  const keys = collectKeys(value);
  for (const key of keys) {
    assert.equal(forbiddenResponseKeys.has(key), false, `response must not include forbidden key: ${key}`);
  }
}

async function callRoute(action, body = {}, token = "test-token") {
  const res = mockRes();
  await handler(mockReq({ action, body, token }), res);
  return res;
}

async function callHandler(fn, body = {}, token = "test-token", deps = authDeps) {
  const res = mockRes();
  await fn(mockReq({ body, token }), res, deps);
  return res;
}

function createGithubStatusSupabaseMock({ connection = null, connectionError = null, repoCount = 0, repoError = null } = {}) {
  const calls = [];
  const terminalForTable = (table) => {
    if (table === "github_connections") {
      return { data: connection, error: connectionError };
    }
    if (table === "github_repository_access") {
      return { count: repoCount, error: repoError };
    }
    return { data: null, error: { code: "UNKNOWN_TABLE", message: "Unknown table" } };
  };

  function builder(table) {
    return {
      select(columns, options) {
        calls.push({ method: "select", table, columns, options });
        return this;
      },
      eq(column, value) {
        calls.push({ method: "eq", table, column, value });
        return this;
      },
      order(column, options) {
        calls.push({ method: "order", table, column, options });
        return this;
      },
      limit(value) {
        calls.push({ method: "limit", table, value });
        return this;
      },
      maybeSingle() {
        calls.push({ method: "maybeSingle", table });
        return Promise.resolve(terminalForTable(table));
      },
      then(resolve, reject) {
        return Promise.resolve(terminalForTable(table)).then(resolve, reject);
      },
      insert(value) {
        calls.push({ method: "insert", table, value });
        throw new Error("insert must not be called");
      },
      update(value) {
        calls.push({ method: "update", table, value });
        throw new Error("update must not be called");
      },
      upsert(value) {
        calls.push({ method: "upsert", table, value });
        throw new Error("upsert must not be called");
      },
      delete() {
        calls.push({ method: "delete", table });
        throw new Error("delete must not be called");
      },
    };
  }

  return {
    calls,
    from(table) {
      calls.push({ method: "from", table });
      return builder(table);
    },
  };
}

function assertReadOnly(calls) {
  const writeCalls = calls.filter((call) => ["insert", "update", "upsert", "delete"].includes(call.method));
  assert.deepEqual(writeCalls, [], "github_connection_status must not call write methods");
}

function createGithubPrepareSupabaseMock({ insertError = null } = {}) {
  const calls = [];
  const rows = [];
  return {
    calls,
    rows,
    from(table) {
      calls.push({ method: "from", table });
      return {
        insert(row) {
          calls.push({ method: "insert", table, row });
          if (table !== "github_connection_states") {
            throw new Error(`prepare must not write to ${table}`);
          }
          rows.push(row);
          return Promise.resolve({ data: null, error: insertError });
        },
        update(row) {
          calls.push({ method: "update", table, row });
          throw new Error("prepare must not call update");
        },
        upsert(row) {
          calls.push({ method: "upsert", table, row });
          throw new Error("prepare must not call upsert");
        },
        delete() {
          calls.push({ method: "delete", table });
          throw new Error("prepare must not call delete");
        },
      };
    },
  };
}

function createGithubCallbackSupabaseMock({ row = null, readError = null, updateError = null } = {}) {
  const calls = [];
  const updates = [];
  const readResult = () => ({ data: row, error: readError });
  const updateResult = () => ({ data: updateError ? null : { id: row?.id || "updated-row" }, error: updateError });

  function builder(table) {
    const state = { mode: "read" };
    return {
      select(columns) {
        calls.push({ method: "select", table, columns });
        if (state.mode !== "update") state.mode = "read";
        return this;
      },
      update(patch) {
        calls.push({ method: "update", table, patch });
        if (table !== "github_connection_states") {
          throw new Error(`callback must not write to ${table}`);
        }
        state.mode = "update";
        updates.push({ table, patch, filters: [] });
        return this;
      },
      eq(column, value) {
        calls.push({ method: "eq", table, column, value });
        const lastUpdate = updates.at(-1);
        if (state.mode === "update" && lastUpdate) {
          lastUpdate.filters.push({ column, value });
        }
        return this;
      },
      limit(value) {
        calls.push({ method: "limit", table, value });
        return this;
      },
      maybeSingle() {
        calls.push({ method: "maybeSingle", table });
        return Promise.resolve(readResult());
      },
      then(resolve, reject) {
        return Promise.resolve(state.mode === "update" ? updateResult() : readResult()).then(resolve, reject);
      },
      insert(value) {
        calls.push({ method: "insert", table, value });
        throw new Error("callback must not call insert");
      },
      upsert(value) {
        calls.push({ method: "upsert", table, value });
        throw new Error("callback must not call upsert");
      },
      delete() {
        calls.push({ method: "delete", table });
        throw new Error("callback must not call delete");
      },
    };
  }

  return {
    calls,
    updates,
    from(table) {
      calls.push({ method: "from", table });
      return builder(table);
    },
  };
}

const source = readFileSync(path.join(root, "api/save-analysis-run.js"), "utf8");
for (const action of [
  "github_connection_status",
  "github_connection_prepare",
  "github_connection_callback_stub",
  "github_repository_access_list",
  "github_repository_access_select",
  "github_repository_access_preview",
  "github_pr_preview",
  "github_recent_pull_requests_import",
  "github_daily_review_request",
]) {
  assert.match(source, new RegExp(`case "${action}"`), `${action} must be registered in save-analysis-run`);
}

for (const action of [
  "github_connection_status",
  "github_connection_prepare",
  "github_connection_callback_stub",
  "github_repository_access_list",
  "github_repository_access_select",
  "github_repository_access_preview",
  "github_recent_pull_requests_import",
  "github_daily_review_request",
]) {
  const res = await callRoute(action, {}, null);
  assert.equal(res.statusCode, 401, `${action} must reject unauthenticated requests`);
  assert.equal(res.body?.error?.code, "AUTH_REQUIRED");
  assertNoForbiddenResponseKeys(res.body);
}

const statusRes = await callHandler(handleGithubConnectionStatus);
assert.equal(statusRes.statusCode, 200);
assert.deepEqual(statusRes.body, {
  ok: true,
  connection: {
    connected: false,
    status: "not_connected",
    provider: "github",
    connection_type: "github_app",
    github_login: null,
    installation_id: null,
    repositories_selected: 0,
    last_checked_at: null,
  },
});
assertNoForbiddenResponseKeys(statusRes.body);

const noConnectionSupabase = createGithubStatusSupabaseMock();
const noConnectionRead = await readGithubConnectionStatus({
  supabase: noConnectionSupabase,
  userId: verifiedUserId,
});
assert.deepEqual(noConnectionRead, { connection: null, repositoriesSelected: 0 });
assert.ok(
  noConnectionSupabase.calls.some((call) => call.method === "eq" && call.column === "user_id" && call.value === verifiedUserId),
  "github_connections query must filter by verified user id"
);
assertReadOnly(noConnectionSupabase.calls);

const connectedSupabase = createGithubStatusSupabaseMock({
  connection: {
    id: "connection-904",
    user_id: "must-not-return",
    github_login: "octocat",
    installation_id: "123",
    connection_type: "github_app",
    status: "connected",
    granted_permissions: { contents: "read" },
    last_checked_at: "2026-06-15T00:00:00.000Z",
    connected_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
  },
  repoCount: 2,
});
const connectedRes = await callHandler(
  handleGithubConnectionStatus,
  {},
  "test-token",
  {
    supabase: connectedSupabase,
    verifyAccessToken: authDeps.verifyAccessToken,
  }
);
assert.equal(connectedRes.statusCode, 200);
assert.deepEqual(connectedRes.body, {
  ok: true,
  connection: {
    connected: true,
    status: "connected",
    provider: "github",
    connection_type: "github_app",
    github_login: "octocat",
    installation_id: 123,
    repositories_selected: 2,
    last_checked_at: "2026-06-15T00:00:00.000Z",
  },
});
assertNoForbiddenResponseKeys(connectedRes.body);
assert.equal(JSON.stringify(connectedRes.body).includes("connection-904"), false, "connection id must not be returned");
assert.equal(JSON.stringify(connectedRes.body).includes("must-not-return"), false, "user_id must not be returned");
assert.equal(JSON.stringify(connectedRes.body).includes("granted_permissions"), false, "granted_permissions must not be returned");
assert.ok(
  connectedSupabase.calls.some((call) => call.table === "github_repository_access" && call.method === "select" && call.options?.count === "exact" && call.options?.head === true),
  "selected repository count must use an exact head count"
);
assert.ok(
  connectedSupabase.calls.some((call) => call.table === "github_repository_access" && call.method === "eq" && call.column === "selected" && call.value === true),
  "repository count must include selected=true"
);
assertReadOnly(connectedSupabase.calls);

const unavailableSupabase = createGithubStatusSupabaseMock({
  connectionError: { code: "PGRST205", message: "table unavailable" },
});
const unavailableRes = await callHandler(
  handleGithubConnectionStatus,
  {},
  "test-token",
  {
    supabase: unavailableSupabase,
    verifyAccessToken: authDeps.verifyAccessToken,
  }
);
assert.equal(unavailableRes.statusCode, 200);
assert.deepEqual(unavailableRes.body, {
  ok: true,
  connection: {
    connected: false,
    status: "unavailable",
    provider: "github",
    connection_type: "github_app",
    github_login: null,
    installation_id: null,
    repositories_selected: 0,
    last_checked_at: null,
  },
  warning: {
    code: "github_connection_tables_unavailable",
    message: "GitHub connection tables are not available in this environment.",
  },
});
assertNoForbiddenResponseKeys(unavailableRes.body);
assertReadOnly(unavailableSupabase.calls);

const prepareRes = await callHandler(handleGithubConnectionPrepare);
assert.equal(prepareRes.statusCode, 200);
assert.deepEqual(prepareRes.body, {
  ok: true,
  connect: {
    provider: "github",
    connection_type: "github_app",
    configured: false,
    ready: false,
    reason: "github_app_not_configured",
    next_action: "configure_github_app",
    installation_url: null,
    authorization_url: null,
    state_required: true,
  },
});
assertNoForbiddenResponseKeys(prepareRes.body);

assert.equal(readGithubAppPublicConfig({}).reason, "github_app_not_configured");
assert.equal(readGithubAppPublicConfig({ GITHUB_APP_SLUG: "   " }).reason, "github_app_not_configured");

for (const maliciousSlug of ["https://evil.com/app", "foo/bar", "foo?x=1", "foo#bar", "foo bar"]) {
  assert.equal(normalizeGithubAppSlug(maliciousSlug), null, `${maliciousSlug} must be rejected`);
  assert.deepEqual(readGithubAppPublicConfig({ GITHUB_APP_SLUG: maliciousSlug }), {
    configured: false,
    reason: "github_app_invalid_config",
    installation_url: null,
  });
}

const invalidPrepareRes = await callHandler(
  handleGithubConnectionPrepare,
  {},
  "test-token",
  {
    ...authDeps,
    readConfig: () => readGithubAppPublicConfig({ GITHUB_APP_SLUG: "foo/bar" }),
  }
);
assert.equal(invalidPrepareRes.statusCode, 200);
assert.deepEqual(invalidPrepareRes.body, {
  ok: true,
  connect: {
    provider: "github",
    connection_type: "github_app",
    configured: false,
    ready: false,
    reason: "github_app_invalid_config",
    next_action: "fix_github_app_config",
    installation_url: null,
    authorization_url: null,
    state_required: true,
  },
});
assertNoForbiddenResponseKeys(invalidPrepareRes.body);

assert.equal(normalizeGithubAppSlug(" Passmap-GitHub-App-1 "), "Passmap-GitHub-App-1");
assert.equal(
  buildGithubAppInstallUrl({ appSlug: "Passmap-GitHub-App-1" }),
  "https://github.com/apps/Passmap-GitHub-App-1/installations/new"
);

const validPrepareRes = await callHandler(
  handleGithubConnectionPrepare,
  { user_id: "client-user-id-must-be-ignored", return_to: "/settings/integrations" },
  "test-token",
  {
    supabase: createGithubPrepareSupabaseMock(),
    readConfig: () => readGithubAppPublicConfig({ GITHUB_APP_SLUG: "passmap-github-app" }),
    verifyAccessToken: authDeps.verifyAccessToken,
  }
);
assert.equal(validPrepareRes.statusCode, 200);
assert.equal(validPrepareRes.body.ok, true);
assert.equal(validPrepareRes.body.connect.provider, "github");
assert.equal(validPrepareRes.body.connect.connection_type, "github_app");
assert.equal(validPrepareRes.body.connect.configured, true);
assert.equal(validPrepareRes.body.connect.ready, true);
assert.equal(validPrepareRes.body.connect.reason, "github_connection_state_created");
assert.equal(validPrepareRes.body.connect.next_action, "open_github_installation_url");
assert.equal(validPrepareRes.body.connect.installation_url, "https://github.com/apps/passmap-github-app/installations/new");
assert.match(validPrepareRes.body.connect.state, /^[A-Za-z0-9_-]+$/);
assert.ok(validPrepareRes.body.connect.state.length >= 40, "raw state must have enough encoded entropy");
assert.ok(Date.parse(validPrepareRes.body.connect.state_expires_at) > Date.now());
assert.equal(validPrepareRes.body.connect.state_required, true);
assert.equal(validPrepareRes.body.connect.callback_ready, false);
assert.equal(validPrepareRes.body.connect.callback_action, "github_connection_callback_stub");
assertNoForbiddenResponseKeys(validPrepareRes.body);
assert.equal(JSON.stringify(validPrepareRes.body).includes("state_hash"), false, "response must not return state_hash");
assert.equal(JSON.stringify(validPrepareRes.body).includes("client-user-id-must-be-ignored"), false, "response must not return client user_id");

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error("GitHub API must not be called");
};
try {
  const prepareSupabase = createGithubPrepareSupabaseMock();
  const prepareNoDbRes = await callHandler(
    handleGithubConnectionPrepare,
    { user_id: "client-user-id-must-be-ignored", return_to: "/settings/integrations" },
    "test-token",
    {
      supabase: prepareSupabase,
      verifyAccessToken: authDeps.verifyAccessToken,
      readConfig: () => readGithubAppPublicConfig({
        GITHUB_APP_SLUG: "safe-app",
        GITHUB_CLIENT_SECRET: "never-return",
      }),
    }
  );
  assert.equal(prepareNoDbRes.statusCode, 200);
  assert.equal(prepareNoDbRes.body.connect.installation_url, "https://github.com/apps/safe-app/installations/new");
  assert.equal(JSON.stringify(prepareNoDbRes.body).includes("never-return"), false);
  assert.equal(fetchCalls, 0, "prepare action must not call GitHub API");
  assertNoForbiddenResponseKeys(prepareNoDbRes.body);
  assert.equal(prepareSupabase.rows.length, 1, "valid prepare must create one state row");
  const insertedStateRow = prepareSupabase.rows[0];
  assert.equal(insertedStateRow.user_id, verifiedUserId, "state row must use verified Supabase user id");
  assert.equal(insertedStateRow.user_id === "client-user-id-must-be-ignored", false);
  assert.equal(insertedStateRow.purpose, "github_app_install");
  assert.equal(insertedStateRow.status, "pending");
  assert.equal(insertedStateRow.return_to, "/settings/integrations");
  assert.equal(insertedStateRow.state_hash, hashGithubConnectionState(prepareNoDbRes.body.connect.state));
  assert.equal(Object.hasOwn(insertedStateRow, "state"), false, "state row must not store raw state");
  assert.equal(prepareNoDbRes.body.connect.state_hash, undefined, "response must not include state_hash");
  assert.equal(prepareNoDbRes.body.connect.user_id, undefined, "response must not include user_id");
  assert.equal(prepareNoDbRes.body.connect.id, undefined, "response must not include row id");
  assert.equal(
    prepareSupabase.calls.some((call) => ["github_connections", "github_repository_access"].includes(call.table) && call.method === "insert"),
    false,
    "prepare must not write GitHub connection or repository access tables"
  );
} finally {
  globalThis.fetch = originalFetch;
}

const stateUnavailableRes = await callHandler(
  handleGithubConnectionPrepare,
  {},
  "test-token",
  {
    supabase: createGithubPrepareSupabaseMock({
      insertError: { code: "PGRST205", message: "github_connection_states unavailable" },
    }),
    verifyAccessToken: authDeps.verifyAccessToken,
    readConfig: () => readGithubAppPublicConfig({ GITHUB_APP_SLUG: "safe-app" }),
  }
);
assert.equal(stateUnavailableRes.statusCode, 200);
assert.deepEqual(stateUnavailableRes.body, {
  ok: true,
  connect: {
    provider: "github",
    connection_type: "github_app",
    configured: true,
    ready: false,
    reason: "github_connection_state_unavailable",
    next_action: "apply_github_connection_state_migration",
    installation_url: null,
    authorization_url: null,
    state: null,
    state_expires_at: null,
    state_required: true,
    callback_ready: false,
    callback_action: "github_connection_callback_stub",
  },
  warning: {
    code: "github_connection_state_unavailable",
    message: "GitHub connection state storage is not available in this environment.",
  },
});
assertNoForbiddenResponseKeys(stateUnavailableRes.body);

const missingStateRes = await callHandler(handleGithubConnectionCallbackStub, {});
assert.equal(missingStateRes.statusCode, 400);
assert.equal(missingStateRes.body?.error?.code, "github_connection_state_required");
assertNoForbiddenResponseKeys(missingStateRes.body);

const invalidStateRes = await callHandler(handleGithubConnectionCallbackStub, { state: "short" });
assert.equal(invalidStateRes.statusCode, 400);
assert.equal(invalidStateRes.body?.error?.code, "github_connection_state_invalid");
assertNoForbiddenResponseKeys(invalidStateRes.body);

const forbiddenCallbackRes = await callHandler(handleGithubConnectionCallbackStub, {
  state: "A".repeat(43),
  access_token: "never-return",
});
assert.equal(forbiddenCallbackRes.statusCode, 400);
assert.equal(forbiddenCallbackRes.body?.error?.code, "FORBIDDEN_STORAGE_KEY");
assert.equal(JSON.stringify(forbiddenCallbackRes.body).includes("never-return"), false);
assertNoForbiddenResponseKeys(forbiddenCallbackRes.body);

const callbackState = "A".repeat(43);
const callbackStateHash = hashGithubConnectionState(callbackState);
const callbackNow = Date.parse("2026-06-16T04:00:00.000Z");

const unavailableCallbackRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock({
      readError: { code: "PGRST205", message: "github_connection_states unavailable" },
    }),
    verifyAccessToken: authDeps.verifyAccessToken,
  }
);
assert.equal(unavailableCallbackRes.statusCode, 200);
assert.deepEqual(unavailableCallbackRes.body, {
  ok: false,
  callback: {
    provider: "github",
    connection_type: "github_app",
    state_valid: false,
    state_consumed: false,
    connected: false,
    installation_verified: false,
    callback_ready: false,
    next_action: "apply_github_connection_state_migration",
    return_to: null,
  },
  warning: {
    code: "github_connection_state_unavailable",
    message: "GitHub connection state storage is not available in this environment.",
  },
});
assertNoForbiddenResponseKeys(unavailableCallbackRes.body);

const notFoundCallbackRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock({ row: null }),
    verifyAccessToken: authDeps.verifyAccessToken,
  }
);
assert.equal(notFoundCallbackRes.statusCode, 400);
assert.equal(notFoundCallbackRes.body?.error?.code, "github_connection_state_invalid");
assertNoForbiddenResponseKeys(notFoundCallbackRes.body);

const wrongUserCallbackRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock({
      row: {
        id: "state-row-1",
        user_id: "00000000-0000-4000-8000-000000000000",
        state_hash: callbackStateHash,
        purpose: "github_app_install",
        status: "pending",
        return_to: "/settings/integrations",
        expires_at: "2026-06-16T04:10:00.000Z",
      },
    }),
    verifyAccessToken: authDeps.verifyAccessToken,
  }
);
assert.equal(wrongUserCallbackRes.statusCode, 400);
assert.equal(wrongUserCallbackRes.body?.error?.code, "github_connection_state_invalid");
assert.equal(JSON.stringify(wrongUserCallbackRes.body).includes("state-row-1"), false);
assertNoForbiddenResponseKeys(wrongUserCallbackRes.body);

for (const status of ["consumed", "expired"]) {
  const notPendingCallbackRes = await callHandler(
    handleGithubConnectionCallbackStub,
    { state: callbackState },
    "test-token",
    {
      supabase: createGithubCallbackSupabaseMock({
        row: {
          id: `state-row-${status}`,
          user_id: verifiedUserId,
          state_hash: callbackStateHash,
          purpose: "github_app_install",
          status,
          return_to: "/settings/integrations",
          expires_at: "2026-06-16T04:10:00.000Z",
        },
      }),
      verifyAccessToken: authDeps.verifyAccessToken,
    }
  );
  assert.equal(notPendingCallbackRes.statusCode, 400);
  assert.equal(notPendingCallbackRes.body?.error?.code, "github_connection_state_not_pending");
  assertNoForbiddenResponseKeys(notPendingCallbackRes.body);
}

const expiredSupabase = createGithubCallbackSupabaseMock({
  row: {
    id: "expired-state-row",
    user_id: verifiedUserId,
    state_hash: callbackStateHash,
    purpose: "github_app_install",
    status: "pending",
    return_to: "/settings/integrations",
    expires_at: "2026-06-16T03:59:59.000Z",
  },
});
const expiredCallbackRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState },
  "test-token",
  {
    supabase: expiredSupabase,
    verifyAccessToken: authDeps.verifyAccessToken,
    validateState: (args) => import("../server/api-helpers/github-connection-state.js").then((mod) =>
      mod.buildGithubConnectionStateValidationResult({ ...args, now: () => callbackNow })
    ),
  }
);
assert.equal(expiredCallbackRes.statusCode, 400);
assert.equal(expiredCallbackRes.body?.error?.code, "github_connection_state_expired");
assert.equal(expiredSupabase.updates.length, 1);
assert.deepEqual(expiredSupabase.updates[0].patch, {
  status: "expired",
  updated_at: "2026-06-16T04:00:00.000Z",
});
assertNoForbiddenResponseKeys(expiredCallbackRes.body);

for (const [body, expectedCode] of [
  [{ state: callbackState, installation_id: "123456" }, "github_oauth_code_required"],
  [{ state: callbackState, code: "bad code", installation_id: "123456" }, "github_oauth_code_invalid"],
  [{ state: callbackState, code: "abcDEF_123456", installation_id: "12abc" }, "github_installation_id_invalid"],
]) {
  const validationOnlyRes = await callHandler(
    handleGithubConnectionCallbackStub,
    body,
    "test-token",
    {
      supabase: createGithubCallbackSupabaseMock({
        row: {
          id: `state-row-${expectedCode}`,
          user_id: verifiedUserId,
          state_hash: callbackStateHash,
          purpose: "github_app_install",
          status: "pending",
          return_to: "/settings/integrations",
          expires_at: "2026-06-16T04:10:00.000Z",
        },
      }),
      verifyAccessToken: authDeps.verifyAccessToken,
      validateState: async () => ({ ok: true, return_to: "/settings/integrations" }),
      verifyInstallation: async () => {
        throw new Error("installation verification must not run for invalid callback input");
      },
    }
  );
  assert.equal(validationOnlyRes.statusCode, 400);
  assert.equal(validationOnlyRes.body?.error?.code, expectedCode);
  assertNoForbiddenResponseKeys(validationOnlyRes.body);
}

const inferredInstallationCallbackRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState, code: "abcDEF_123456" },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock(),
    verifyAccessToken: authDeps.verifyAccessToken,
    validateState: async () => ({ ok: true, return_to: "/settings/integrations" }),
    verifyInstallation: async () => {
      throw new Error("installation-specific verification must not run without installation_id");
    },
    inferInstallation: async ({ supabase, userId, code }) => {
      assert.equal(userId, verifiedUserId);
      assert.equal(code, "abcDEF_123456");
      return { ok: true, github_login: "octocat", installation_id: "123456", inferred_installation_id: true };
    },
  }
);
assert.equal(inferredInstallationCallbackRes.statusCode, 200);
assert.equal(inferredInstallationCallbackRes.body?.callback?.connected, true);
assert.equal(inferredInstallationCallbackRes.body?.callback?.installation_id_received, false);
assertNoForbiddenResponseKeys(inferredInstallationCallbackRes.body);

const missingConfigCallbackRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState, code: "abcDEF_123456", installation_id: "123456" },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock({
      row: {
        id: "state-row-missing-config",
        user_id: verifiedUserId,
        state_hash: callbackStateHash,
        purpose: "github_app_install",
        status: "pending",
        return_to: "/settings/integrations",
        expires_at: "2026-06-16T04:10:00.000Z",
      },
    }),
    verifyAccessToken: authDeps.verifyAccessToken,
    validateState: async () => ({ ok: true, return_to: "/settings/integrations" }),
    verifyInstallation: async () => ({ ok: false, code: "github_oauth_config_missing" }),
  }
);
assert.equal(missingConfigCallbackRes.statusCode, 200);
assert.deepEqual(missingConfigCallbackRes.body, {
  ok: false,
  callback: {
    provider: "github",
    connection_type: "github_app",
    state_valid: true,
    state_consumed: true,
    connected: false,
    installation_verified: false,
    installation_id_received: true,
    callback_ready: false,
    next_action: "configure_github_oauth_credentials",
    return_to: "/settings/integrations",
  },
  warning: {
    code: "github_oauth_config_missing",
    message: "GitHub OAuth configuration is missing.",
  },
});
assertNoForbiddenResponseKeys(missingConfigCallbackRes.body);

const tokenExchangeFailedRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState, code: "abcDEF_123456", installation_id: "123456" },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock(),
    verifyAccessToken: authDeps.verifyAccessToken,
    validateState: async () => ({ ok: true, return_to: "/settings/integrations" }),
    verifyInstallation: async () => ({ ok: false, code: "github_user_token_exchange_failed" }),
  }
);
assert.equal(tokenExchangeFailedRes.statusCode, 400);
assert.equal(tokenExchangeFailedRes.body?.error?.code, "github_user_token_exchange_failed");
assertNoForbiddenResponseKeys(tokenExchangeFailedRes.body);

const installationNotFoundRes = await callHandler(
  handleGithubConnectionCallbackStub,
  { state: callbackState, code: "abcDEF_123456", installation_id: "123456" },
  "test-token",
  {
    supabase: createGithubCallbackSupabaseMock(),
    verifyAccessToken: authDeps.verifyAccessToken,
    validateState: async () => ({ ok: true, return_to: "/settings/integrations" }),
    verifyInstallation: async () => ({ ok: false, code: "github_installation_not_accessible" }),
  }
);
assert.equal(installationNotFoundRes.statusCode, 400);
assert.equal(installationNotFoundRes.body?.error?.code, "github_installation_not_accessible");
assertNoForbiddenResponseKeys(installationNotFoundRes.body);

for (const [code, nextAction] of [
  ["github_installation_verification_unavailable", "retry_github_installation_verification"],
  ["github_connection_persistence_unavailable", "retry_github_connection_persistence"],
]) {
  const warningRes = await callHandler(
    handleGithubConnectionCallbackStub,
    { state: callbackState, code: "abcDEF_123456", installation_id: "123456" },
    "test-token",
    {
      supabase: createGithubCallbackSupabaseMock(),
      verifyAccessToken: authDeps.verifyAccessToken,
      validateState: async () => ({ ok: true, return_to: "/settings/integrations" }),
      verifyInstallation: async () => ({ ok: false, code }),
    }
  );
  assert.equal(warningRes.statusCode, 200);
  assert.equal(warningRes.body?.warning?.code, code);
  assert.equal(warningRes.body?.callback?.next_action, nextAction);
  assert.equal(warningRes.body?.callback?.connected, false);
  assert.equal(warningRes.body?.callback?.installation_verified, false);
  assertNoForbiddenResponseKeys(warningRes.body);
}

const validCallbackSupabase = createGithubCallbackSupabaseMock({
  row: {
    id: "valid-state-row",
    user_id: verifiedUserId,
    state_hash: callbackStateHash,
    purpose: "github_app_install",
    status: "pending",
    return_to: "/settings/integrations",
    expires_at: "2026-06-16T04:10:00.000Z",
  },
});
const originalCallbackFetch = globalThis.fetch;
let callbackFetchCalls = 0;
globalThis.fetch = async () => {
  callbackFetchCalls += 1;
  throw new Error("GitHub API must not be called");
};
try {
  const validCallbackRes = await callHandler(
    handleGithubConnectionCallbackStub,
    {
      payload: {
        state: callbackState,
        code: "abcDEF_123456",
        installation_id: "123456",
        setup_action: "install",
      },
    },
    "test-token",
    {
      supabase: validCallbackSupabase,
      verifyAccessToken: authDeps.verifyAccessToken,
      validateState: (args) => import("../server/api-helpers/github-connection-state.js").then((mod) =>
        mod.buildGithubConnectionStateValidationResult({ ...args, now: () => callbackNow })
      ),
      verifyInstallation: async ({ supabase, userId, code, installationId }) => {
        assert.equal(supabase, validCallbackSupabase);
        assert.equal(userId, verifiedUserId);
        assert.equal(code, "abcDEF_123456");
        assert.equal(installationId, "123456");
        return { ok: true, github_login: "octocat" };
      },
    }
  );
  assert.equal(validCallbackRes.statusCode, 200);
  assert.deepEqual(validCallbackRes.body, {
    ok: true,
    callback: {
      provider: "github",
      connection_type: "github_app",
      state_valid: true,
      state_consumed: true,
      connected: true,
      installation_verified: true,
      github_login: "octocat",
      installation_id_received: true,
      repositories_selected: 0,
      next_action: "select_github_repositories",
      return_to: "/settings/integrations",
    },
  });
  assert.equal(callbackFetchCalls, 0, "action contract test must not call GitHub API directly");
  assert.equal(validCallbackSupabase.updates.length, 1);
  assert.deepEqual(validCallbackSupabase.updates[0].patch, {
    status: "consumed",
    consumed_at: "2026-06-16T04:00:00.000Z",
    updated_at: "2026-06-16T04:00:00.000Z",
  });
  assert.equal(
    validCallbackSupabase.calls.some((call) => ["github_connections", "github_repository_access"].includes(call.table) && ["insert", "update", "upsert", "delete"].includes(call.method)),
    false,
    "mocked action callback must not write connection or repository access tables directly"
  );
  const validCallbackText = JSON.stringify(validCallbackRes.body);
  assert.equal(validCallbackText.includes(callbackState), false, "callback response must not include raw state");
  assert.equal(validCallbackText.includes(callbackStateHash), false, "callback response must not include state_hash");
  assert.equal(validCallbackText.includes("valid-state-row"), false, "callback response must not include row id");
  assert.equal(validCallbackText.includes(verifiedUserId), false, "callback response must not include user_id");
  assertNoForbiddenResponseKeys(validCallbackRes.body);
} finally {
  globalThis.fetch = originalCallbackFetch;
}

const repoConnection = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: verifiedUserId,
  installation_id: "98765",
  status: "connected",
};

const noConnectionListRes = await callHandler(
  handleGithubRepositoryAccessList,
  {},
  "test-token",
  {
    supabase: { auth: {} },
    verifyAccessToken: authDeps.verifyAccessToken,
    readConnection: async ({ userId }) => {
      assert.equal(userId, verifiedUserId);
      return { ok: true, connection: null };
    },
  }
);
assert.equal(noConnectionListRes.statusCode, 200);
assert.equal(noConnectionListRes.body?.warning?.code, "github_connection_not_connected");
assert.deepEqual(noConnectionListRes.body?.repositories, []);
assertNoForbiddenResponseKeys(noConnectionListRes.body);

let listFetchCalled = false;
const missingPrivateConfigListRes = await callHandler(
  handleGithubRepositoryAccessList,
  {},
  "test-token",
  {
    supabase: { auth: {} },
    verifyAccessToken: authDeps.verifyAccessToken,
    readConnection: async () => ({ ok: true, connection: repoConnection }),
    createInstallationToken: async ({ installationId }) => {
      assert.equal(installationId, "98765");
      return { ok: false, code: "github_app_private_config_missing" };
    },
    fetchRepositories: async () => {
      listFetchCalled = true;
      throw new Error("GitHub repositories must not be fetched without private config");
    },
  }
);
assert.equal(missingPrivateConfigListRes.statusCode, 200);
assert.equal(missingPrivateConfigListRes.body?.warning?.code, "github_app_private_config_missing");
assert.equal(listFetchCalled, false);
assertNoForbiddenResponseKeys(missingPrivateConfigListRes.body);

const repositoryRows = [
  {
    id: "repo-row-123",
    user_id: verifiedUserId,
    connection_id: repoConnection.id,
    github_repo_id: "123",
    owner: "true-hr",
    name: "reject-analyzer",
    full_name: "true-hr/reject-analyzer",
    private: false,
    selected: true,
    permission_snapshot: { admin: false, push: true, pull: true },
  },
  {
    id: "repo-row-456",
    user_id: verifiedUserId,
    connection_id: repoConnection.id,
    github_repo_id: "456",
    owner: "true-hr",
    name: "passmap-api",
    full_name: "true-hr/passmap-api",
    private: true,
    selected: false,
    permission_snapshot: { admin: false, push: false, pull: true },
  },
];

const listSuccessRes = await callHandler(
  handleGithubRepositoryAccessList,
  {},
  "test-token",
  {
    supabase: { auth: {} },
    verifyAccessToken: authDeps.verifyAccessToken,
    readConnection: async ({ userId }) => {
      assert.equal(userId, verifiedUserId);
      return { ok: true, connection: repoConnection };
    },
    createInstallationToken: async ({ installationId }) => {
      assert.equal(installationId, "98765");
      return { ok: true, token: "ghs_installation_token" };
    },
    fetchRepositories: async ({ installationToken }) => {
      assert.equal(installationToken, "ghs_installation_token");
      return {
        ok: true,
        repositories: repositoryRows.map(({ id, user_id, connection_id, selected, ...repo }) => repo),
      };
    },
    readRepositoryRows: async ({ userId, connectionId }) => {
      assert.equal(userId, verifiedUserId);
      assert.equal(connectionId, repoConnection.id);
      return { ok: true, rows: [repositoryRows[0]] };
    },
    persistSnapshots: async ({ userId, connectionId, repositories, existingRows }) => {
      assert.equal(userId, verifiedUserId);
      assert.equal(connectionId, repoConnection.id);
      assert.equal(repositories.length, 2);
      assert.equal(existingRows.length, 1);
      return { ok: true, rows: repositoryRows };
    },
  }
);
assert.equal(listSuccessRes.statusCode, 200);
assert.deepEqual(listSuccessRes.body, {
  ok: true,
  repositories: [
    {
      github_repo_id: "123",
      owner: "true-hr",
      name: "reject-analyzer",
      full_name: "true-hr/reject-analyzer",
      private: false,
      selected: true,
      permission_snapshot: { admin: false, push: true, pull: true },
    },
    {
      github_repo_id: "456",
      owner: "true-hr",
      name: "passmap-api",
      full_name: "true-hr/passmap-api",
      private: true,
      selected: false,
      permission_snapshot: { admin: false, push: false, pull: true },
    },
  ],
  next_action: "select_github_repositories",
});
assert.equal(JSON.stringify(listSuccessRes.body).includes("ghs_installation_token"), false);
assertNoForbiddenResponseKeys(listSuccessRes.body);

const scopedSelectionRes = await callHandler(
  handleGithubRepositoryAccessSelect,
  { user_id: "client-user", selected_repo_ids: ["123"] },
  "test-token"
);
assert.equal(scopedSelectionRes.statusCode, 400);
assert.equal(scopedSelectionRes.body?.error?.code, "github_repository_selection_scope_forbidden");
assertNoForbiddenResponseKeys(scopedSelectionRes.body);

const missingRepoSelectionRes = await callHandler(
  handleGithubRepositoryAccessSelect,
  { selected_repo_ids: ["999"] },
  "test-token",
  {
    supabase: { auth: {} },
    verifyAccessToken: authDeps.verifyAccessToken,
    readConnection: async () => ({ ok: true, connection: repoConnection }),
    readRepositoryRows: async () => ({ ok: true, rows: repositoryRows }),
    updateSelection: async ({ userId, connectionId, selectedRepoIds }) => {
      assert.equal(userId, verifiedUserId);
      assert.equal(connectionId, repoConnection.id);
      assert.deepEqual(selectedRepoIds, ["999"]);
      return { ok: false, code: "github_repository_not_found" };
    },
  }
);
assert.equal(missingRepoSelectionRes.statusCode, 400);
assert.equal(missingRepoSelectionRes.body?.error?.code, "github_repository_not_found");
assertNoForbiddenResponseKeys(missingRepoSelectionRes.body);

const selectionSuccessRes = await callHandler(
  handleGithubRepositoryAccessSelect,
  {
    repositories: [
      { github_repo_id: "123", selected: true, owner: "client-owner-must-be-ignored" },
      { github_repo_id: "456", selected: false, full_name: "client/full-name-must-be-ignored" },
    ],
  },
  "test-token",
  {
    supabase: { auth: {} },
    verifyAccessToken: authDeps.verifyAccessToken,
    readConnection: async ({ userId }) => {
      assert.equal(userId, verifiedUserId);
      return { ok: true, connection: repoConnection };
    },
    readRepositoryRows: async ({ userId, connectionId }) => {
      assert.equal(userId, verifiedUserId);
      assert.equal(connectionId, repoConnection.id);
      return { ok: true, rows: repositoryRows };
    },
    updateSelection: async ({ userId, connectionId, selectedRepoIds, existingRows }) => {
      assert.equal(userId, verifiedUserId);
      assert.equal(connectionId, repoConnection.id);
      assert.deepEqual(selectedRepoIds, ["123"]);
      assert.equal(existingRows.length, 2);
      return { ok: true, selectedRows: [{ ...repositoryRows[0], selected: true }] };
    },
  }
);
assert.equal(selectionSuccessRes.statusCode, 200);
assert.deepEqual(selectionSuccessRes.body, {
  ok: true,
  repositories_selected: 1,
  selected_repositories: [
    {
      github_repo_id: "123",
      full_name: "true-hr/reject-analyzer",
      selected: true,
    },
  ],
  next_action: "import_recent_github_pull_requests",
});
assert.equal(JSON.stringify(selectionSuccessRes.body).includes("client-owner-must-be-ignored"), false);
assertNoForbiddenResponseKeys(selectionSuccessRes.body);

const validRepoSnapshot = {
  repository: {
    id: 123,
    owner: { login: "true-hr" },
    name: "reject-analyzer",
    full_name: "true-hr/reject-analyzer",
    private: false,
    permissions: { pull: true, push: false, admin: false },
  },
};

const repoPreviewRes = await callHandler(handleGithubRepositoryAccessPreview, validRepoSnapshot);
assert.equal(repoPreviewRes.statusCode, 200);
assert.deepEqual(repoPreviewRes.body, {
  ok: true,
  repository: {
    github_repo_id: "123",
    owner: "true-hr",
    name: "reject-analyzer",
    full_name: "true-hr/reject-analyzer",
    private: false,
    permission_snapshot: { pull: true, push: false, admin: false },
  },
});
assertNoForbiddenResponseKeys(repoPreviewRes.body);

const tokenLikeRes = await callHandler(handleGithubRepositoryAccessPreview, {
  repository: {
    ...validRepoSnapshot.repository,
    access_token: "never-return",
  },
});
assert.equal(tokenLikeRes.statusCode, 400);
assert.equal(tokenLikeRes.body?.error?.code, "FORBIDDEN_STORAGE_KEY");
assert.equal(JSON.stringify(tokenLikeRes.body).includes("never-return"), false);
assertNoForbiddenResponseKeys(tokenLikeRes.body);

const topLevelTokenLikeRes = await callHandler(handleGithubRepositoryAccessPreview, {
  repository: validRepoSnapshot.repository,
  client_secret: "never-return",
});
assert.equal(topLevelTokenLikeRes.statusCode, 400);
assert.equal(topLevelTokenLikeRes.body?.error?.code, "FORBIDDEN_STORAGE_KEY");
assert.equal(JSON.stringify(topLevelTokenLikeRes.body).includes("never-return"), false);
assertNoForbiddenResponseKeys(topLevelTokenLikeRes.body);

for (const forbiddenKey of ["diff", "patch", "raw_text"]) {
  const res = await callHandler(handleGithubRepositoryAccessPreview, {
    repository: {
      ...validRepoSnapshot.repository,
      permission_snapshot: { [forbiddenKey]: "@@ private payload @@" },
    },
  });
  assert.equal(res.statusCode, 400, `${forbiddenKey} must be rejected`);
  assert.equal(res.body?.error?.code, "FORBIDDEN_STORAGE_KEY");
  assert.equal(JSON.stringify(res.body).includes("@@ private payload @@"), false);
  assertNoForbiddenResponseKeys(res.body);
}

console.log("PASS github-app-connection-action-contract");
