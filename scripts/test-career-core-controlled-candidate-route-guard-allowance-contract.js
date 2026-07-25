import assert from "node:assert/strict";
import {
  controlledCandidateRouteGuardAllowanceContract,
  controlledCandidateRouteGuardAllowanceContractCases,
} from "../src/lib/career-core/__fixtures__/controlledCandidateRouteGuardAllowanceContractCases.js";

const EXACT_ROUTE_PATH = "api/career-core/controlled-candidates/preview.js";
const OPTIONAL_GUARD_FILE = "src/lib/career-core/__testUtils__/careerCoreChangedFileGuard.js";

const FORBIDDEN_FIXTURE_FIELDS = new Set([
  "caseId",
  "expectedRegex",
  "fixtureRegex",
]);

const REQUIRED_CASE_IDS = new Set([
  "route_guard_recommends_exact_api_path",
  "route_guard_rejects_broad_api_allow",
  "route_guard_rejects_allow_runtime_for_route",
  "route_guard_rejects_src_api_surface",
  "route_guard_rejects_supabase_function_for_preview",
  "route_guard_allows_guard_update_only_for_exact_path",
  "route_implementation_next_batch_allowed_files",
  "route_guard_blocks_route_plus_ui_or_db",
]);

function walk(value, visitor, path = []) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...path, index]));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, path);
    walk(child, visitor, [...path, key]);
  }
}

function findCase(id) {
  const item = controlledCandidateRouteGuardAllowanceContractCases.find((candidate) => candidate.id === id);
  assert.ok(item, `fixture includes ${id}`);
  return item;
}

function assertNoForbiddenFixtureFields(item) {
  walk(item, (key) => {
    assert.ok(!FORBIDDEN_FIXTURE_FIELDS.has(key), `${item.id} must not use forbidden fixture field ${key}`);
  });
}

function assertRejected(item) {
  assert.equal(item.expected.allowed, false, `${item.id} must not be allowed`);
  assert.equal(item.expected.rejected, true, `${item.id} must be rejected`);
}

assert.equal(controlledCandidateRouteGuardAllowanceContract.exactRoutePath, EXACT_ROUTE_PATH, "contract exact route path");
assert.equal(controlledCandidateRouteGuardAllowanceContract.optionalGuardFile, OPTIONAL_GUARD_FILE, "contract optional guard file");
assert.equal(
  controlledCandidateRouteGuardAllowanceContract.publicEndpoint,
  "POST /api/career-core/controlled-candidates/preview",
  "contract public endpoint"
);

assert.ok(Array.isArray(controlledCandidateRouteGuardAllowanceContractCases), "fixture exports cases array");
assert.ok(controlledCandidateRouteGuardAllowanceContractCases.length >= 8, "fixture includes at least 8 cases");

const seenIds = new Set();
for (const item of controlledCandidateRouteGuardAllowanceContractCases) {
  assert.ok(item.id, "case has id");
  assert.equal(seenIds.has(item.id), false, `duplicate case id ${item.id}`);
  seenIds.add(item.id);
  assert.ok(item.input && typeof item.input === "object", `${item.id} has input`);
  assert.ok(item.expected && typeof item.expected === "object", `${item.id} has expected`);
  assertNoForbiddenFixtureFields(item);
}

for (const id of REQUIRED_CASE_IDS) {
  assert.ok(seenIds.has(id), `fixture includes required case ${id}`);
}

const exactPathCase = findCase("route_guard_recommends_exact_api_path");
assert.equal(exactPathCase.input.futureRoutePath, EXACT_ROUTE_PATH, "recommended route path is exact");
assert.equal(exactPathCase.expected.exactRoutePath, EXACT_ROUTE_PATH, "expected exact route path fixed");
assert.equal(exactPathCase.expected.allowanceType, "exact_path", "recommended allowance is exact_path");
assert.equal(exactPathCase.expected.allowed, true, "exact route path allowance is allowed");
assert.equal(exactPathCase.expected.broadApiAllow, false, "exact route path is not broad api allow");

const broadApiCase = findCase("route_guard_rejects_broad_api_allow");
assert.equal(broadApiCase.input.requestedAllowance, "api/**", "broad api case requests api glob");
assert.equal(broadApiCase.expected.broadApiAllow, true, "broad api case marks broad allow");
assertRejected(broadApiCase);

const runtimeCase = findCase("route_guard_rejects_allow_runtime_for_route");
assert.equal(runtimeCase.input.requestedFlag, "--allow-runtime", "runtime case uses --allow-runtime");
assert.equal(runtimeCase.input.targetPath, EXACT_ROUTE_PATH, "runtime case targets route path");
assert.equal(runtimeCase.expected.allowRuntimeForRoute, false, "--allow-runtime must not allow routes");
assertRejected(runtimeCase);

const srcApiCase = findCase("route_guard_rejects_src_api_surface");
assert.ok(srcApiCase.input.futureRoutePath.startsWith("src/api/"), "src/api case uses src/api path");
assert.equal(srcApiCase.expected.useSrcApi, false, "src/api route surface rejected");
assertRejected(srcApiCase);

const supabaseFunctionCase = findCase("route_guard_rejects_supabase_function_for_preview");
assert.ok(
  supabaseFunctionCase.input.futureRoutePath.startsWith("supabase/functions/"),
  "supabase function case uses supabase/functions path"
);
assert.equal(supabaseFunctionCase.expected.useSupabaseFunction, false, "supabase function route surface rejected");
assertRejected(supabaseFunctionCase);

const guardUpdateCase = findCase("route_guard_allows_guard_update_only_for_exact_path");
assert.equal(guardUpdateCase.input.guardFile, OPTIONAL_GUARD_FILE, "guard update file fixed");
assert.deepEqual(guardUpdateCase.input.proposedAllowedPaths, [EXACT_ROUTE_PATH], "guard update exact path only");
assert.deepEqual(guardUpdateCase.input.proposedBroadAllows, [], "guard update has no broad allows");
assert.equal(guardUpdateCase.expected.guardUpdateAllowedInFutureBatch, true, "future guard update possible");
assert.equal(guardUpdateCase.expected.guardUpdateAllowedInThisBatch, false, "this batch does not update guard");
assert.equal(guardUpdateCase.expected.allowanceType, "exact_path", "guard update limited to exact path");
assert.equal(guardUpdateCase.expected.broadApiAllow, false, "guard update cannot allow broad api");

const allowedFilesCase = findCase("route_implementation_next_batch_allowed_files");
assert.ok(allowedFilesCase.input.nextBatchFiles.includes(EXACT_ROUTE_PATH), "next batch includes exact route");
assert.ok(
  allowedFilesCase.input.nextBatchFiles.includes("scripts/test-career-core-controlled-candidate-public-preview-route.js"),
  "next batch includes route test"
);
assert.ok(
  allowedFilesCase.input.nextBatchFiles.includes("docs/career-core-controlled-candidate-public-preview-route-20260606.md"),
  "next batch includes route doc"
);
assert.deepEqual(allowedFilesCase.input.optionalFiles, [OPTIONAL_GUARD_FILE], "only optional guard file listed");
assert.equal(allowedFilesCase.expected.containsRouteTestDocOnly, true, "next batch allowed files route/test/doc centered");
assert.equal(allowedFilesCase.expected.optionalGuardUpdateOnly, true, "optional file is guard update only");
assert.ok(allowedFilesCase.expected.forbiddenCategories.includes("ui"), "UI remains forbidden");
assert.ok(allowedFilesCase.expected.forbiddenCategories.includes("db_write"), "DB write remains forbidden");

const routePlusUiOrDbCase = findCase("route_guard_blocks_route_plus_ui_or_db");
assert.ok(routePlusUiOrDbCase.input.includedChanges.includes("route"), "blocked combo includes route");
assert.ok(routePlusUiOrDbCase.input.includedChanges.includes("ui"), "blocked combo includes UI");
assert.ok(routePlusUiOrDbCase.input.includedChanges.includes("db_write"), "blocked combo includes DB write");
assert.equal(routePlusUiOrDbCase.expected.blocksUiImplementation, true, "route plus UI blocked");
assert.equal(routePlusUiOrDbCase.expected.blocksDbWrite, true, "route plus DB write blocked");
assertRejected(routePlusUiOrDbCase);

console.log("PASS career-core controlled candidate route guard allowance contract deterministic checks");
