import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROUTE_PATH = "api/career-core/controlled-candidates/preview.js";
const ROUTE_FILE = path.resolve(ROUTE_PATH);
const TEST_FILE = path.resolve("scripts/test-career-core-controlled-candidate-public-preview-route.js");
const GUARD_FILE = path.resolve("src/lib/career-core/__testUtils__/careerCoreChangedFileGuard.js");
const DISALLOWED_RUNTIME_FLAG = ["--allow", "runtime"].join("-");
const FORBIDDEN_ROUTE_ROOTS = [
  "src/api",
  "pages/api",
  "app/api",
  "supabase/functions",
];

function normalize(file) {
  return file.replaceAll("\\", "/");
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current)) {
        stack.push(path.join(current, name));
      }
    } else {
      out.push(normalize(path.relative(process.cwd(), current)));
    }
  }
  return out.sort();
}

function makeMockSupabase(userId = "user-1") {
  return {
    auth: {
      getUser: async (token) => {
        if (token !== "valid-token") {
          return { data: null, error: new Error("invalid token") };
        }
        return { data: { user: { id: userId } }, error: null };
      },
    },
  };
}

function makeReq({ method = "POST", body = {}, token = "valid-token" } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  return { method, headers, body };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function callRoute(route, req) {
  const res = makeRes();
  await route.handleControlledCandidatePublicPreviewRoute(req, res, {
    supabase: makeMockSupabase(),
  });
  return { status: res.statusCode, body: res.body };
}

function assertError(response, code, label) {
  assert.equal(response.body.ok, false, `${label} ok false`);
  assert.equal(response.body.error.code, code, `${label} returns ${code}`);
}

function assertNoDbWriteCalls(routeSource) {
  const forbiddenWritePatterns = [
    /\.from\s*\(/,
    /\.insert\s*\(/,
    /\.upsert\s*\(/,
    /\.update\s*\(/,
    /\.delete\s*\(/,
    /writeToDatabase/,
    /writeToSupabase/,
    /SUPABASE_SERVICE_ROLE_KEY/,
  ];
  for (const pattern of forbiddenWritePatterns) {
    assert.equal(pattern.test(routeSource), false, `route must not introduce DB/Supabase write pattern ${pattern}`);
  }
}

assert.equal(existsSync(ROUTE_FILE), true, "route file exists at exact root api path");

for (const root of FORBIDDEN_ROUTE_ROOTS) {
  const files = listFiles(root).filter((file) => file.endsWith("/career-core/controlled-candidates/preview.js"));
  assert.deepEqual(files, [], `route is not created under ${root}/**`);
}

const routeSource = readFileSync(ROUTE_FILE, "utf8");
assert.match(routeSource, /handleControlledCandidatePreviewApiRequest/, "route imports and calls local preview handler");
assert.match(routeSource, /readBearerToken/, "route reuses existing bearer parser");
assert.match(routeSource, /verifySupabaseAccessToken/, "route reuses existing Supabase token verifier");
assert.doesNotMatch(routeSource, /function\s+verify[A-Za-z]*Auth|const\s+verify[A-Za-z]*Auth/, "route does not create a new auth helper");
assertNoDbWriteCalls(routeSource);

const route = await import(pathToFileURL(ROUTE_FILE).href);
assert.equal(typeof route.default, "function", "default route handler is exported");
assert.equal(typeof route.handleControlledCandidatePublicPreviewRoute, "function", "testable route handler is exported");

const missingAuth = await callRoute(route, makeReq({ token: null }));
assert.equal(missingAuth.status, 401, "missing bearer auth returns 401");
assertError(missingAuth, "UNAUTHENTICATED", "missing bearer auth");

const invalidAuth = await callRoute(route, makeReq({ token: "invalid-token" }));
assert.equal(invalidAuth.status, 401, "invalid bearer auth returns 401");
assertError(invalidAuth, "UNAUTHENTICATED", "invalid bearer auth");

const getResponse = await callRoute(route, makeReq({ method: "GET" }));
assert.equal(getResponse.status, 405, "non-POST is rejected");
assertError(getResponse, "METHOD_NOT_ALLOWED", "non-POST");

for (const field of ["applyToCareerProfile", "updateCareerProfile", "exposeAsFinal", "publishToCompany"]) {
  const response = await callRoute(route, makeReq({ body: { options: { [field]: true } } }));
  assert.equal(response.status, 400, `${field} returns 400`);
  assertError(response, "FORBIDDEN_FINAL_APPLY", field);
}

for (const field of ["writeToDatabase", "writeToSupabase"]) {
  const response = await callRoute(route, makeReq({ body: { options: { [field]: true } } }));
  assert.equal(response.status, 400, `${field} returns 400`);
  assertError(response, "FORBIDDEN_STORAGE_WRITE", field);
}

for (const field of ["finalStrengths", "confirmedSkills", "verifiedStrengths"]) {
  const response = await callRoute(route, makeReq({ body: { [field]: [] } }));
  assert.equal(response.status, 400, `${field} returns 400`);
  assertError(response, "INVALID_INPUT", field);
}

const persistedIdResponse = await callRoute(route, makeReq({ body: { resumeProfileId: "rp-1" } }));
assert.equal(persistedIdResponse.status, 403, "persisted ids are blocked");
assertError(persistedIdResponse, "FORBIDDEN_RESOURCE", "persisted ids");

const foreignOwnerResponse = await callRoute(route, makeReq({
  body: {
    resumeProfile: { userId: "user-2", signals: { strengthSignals: [] } },
  },
}));
assert.equal(foreignOwnerResponse.status, 403, "foreign-owned raw input is blocked");
assertError(foreignOwnerResponse, "FORBIDDEN_RESOURCE", "foreign owner");

const sourceCareerProfile = {
  signals: {
    strengthSignals: [{ signal: "existing_profile_signal" }],
    riskSignals: [],
  },
};
const success = await callRoute(route, makeReq({
  body: {
    resumeProfile: sourceCareerProfile,
    workRecords: [{ id: "wr-1", userId: "user-1", content: "Built a VOC response standard." }],
    manualConfirmedCandidates: { userId: "user-1", strengthSignals: [] },
    options: {
      includeResumeProfileCandidates: true,
      includeWorkRecordCandidates: true,
      includeManualConfirmedCandidates: true,
    },
  },
}));

assert.equal(success.status, 200, "POST is supported");
assert.equal(success.body.ok, true, "success ok true");
assert.equal(success.body.mode, "preview_only", "success mode is preview_only");
assert.equal(success.body.controlledCandidateResult.status, "candidate_only", "success status is candidate_only");
assert.equal(success.body.controlledCandidateResult.appliedToCareerProfile, false, "success does not apply to CareerProfile");
assert.equal(success.body.controlledCandidateResult.exposureMeta.finalDisplayAllowed, false, "final display remains blocked");
assert.equal(success.body.controlledCandidateResult.exposureMeta.manualConfirmationRequired, true, "manual confirmation remains required");
assert.deepEqual(success.body.careerProfile.signals.strengthSignals, [], "response CareerProfile is not mutated with candidates");
assert.deepEqual(sourceCareerProfile.signals.strengthSignals, [{ signal: "existing_profile_signal" }], "input CareerProfile is not mutated");

const guardSource = readFileSync(GUARD_FILE, "utf8");
assert.match(guardSource, /api\\\/career-core\\\/controlled-candidates\\\/preview\\\.js/, "guard allows exact route path");
assert.doesNotMatch(guardSource, /\^api\\\/\.\*|\^api\\\/\(\?:\.\*\)|api\/\*\*/, "guard does not introduce broad api allow");

const testSource = readFileSync(TEST_FILE, "utf8");
assert.equal(testSource.includes(DISALLOWED_RUNTIME_FLAG), false, "route allowance test does not use runtime allowance flag");
assert.equal(routeSource.includes(DISALLOWED_RUNTIME_FLAG), false, "route implementation does not use runtime allowance flag");

console.log("PASS career-core controlled candidate public preview route deterministic checks");
