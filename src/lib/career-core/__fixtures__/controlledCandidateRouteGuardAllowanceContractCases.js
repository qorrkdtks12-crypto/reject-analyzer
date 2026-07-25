const EXACT_ROUTE_PATH = "api/career-core/controlled-candidates/preview.js";
const PUBLIC_ENDPOINT = "POST /api/career-core/controlled-candidates/preview";
const OPTIONAL_GUARD_FILE = "src/lib/career-core/__testUtils__/careerCoreChangedFileGuard.js";

export const controlledCandidateRouteGuardAllowanceContractCases = Object.freeze([
  {
    id: "route_guard_recommends_exact_api_path",
    input: {
      futureRoutePath: EXACT_ROUTE_PATH,
      logicalEndpoint: PUBLIC_ENDPOINT,
      routeSurface: "api/**",
    },
    expected: {
      allowed: true,
      allowanceType: "exact_path",
      exactRoutePath: EXACT_ROUTE_PATH,
      broadApiAllow: false,
    },
  },
  {
    id: "route_guard_rejects_broad_api_allow",
    input: {
      requestedAllowance: "api/**",
      allowanceType: "glob",
    },
    expected: {
      allowed: false,
      rejected: true,
      reason: "broad_api_allow_forbidden",
      broadApiAllow: true,
    },
  },
  {
    id: "route_guard_rejects_allow_runtime_for_route",
    input: {
      requestedFlag: "--allow-runtime",
      targetPath: EXACT_ROUTE_PATH,
      targetType: "route_file",
    },
    expected: {
      allowed: false,
      rejected: true,
      reason: "route_is_not_runtime_utility",
      allowRuntimeForRoute: false,
    },
  },
  {
    id: "route_guard_rejects_src_api_surface",
    input: {
      futureRoutePath: "src/api/career-core/controlled-candidates/preview.js",
      routeSurface: "src/api/**",
    },
    expected: {
      allowed: false,
      rejected: true,
      reason: "src_api_not_tracked_route_surface",
      useSrcApi: false,
    },
  },
  {
    id: "route_guard_rejects_supabase_function_for_preview",
    input: {
      futureRoutePath: "supabase/functions/controlled-candidate-preview/index.ts",
      routeSurface: "supabase/functions/**",
    },
    expected: {
      allowed: false,
      rejected: true,
      reason: "supabase_functions_unrelated_to_preview_route",
      useSupabaseFunction: false,
    },
  },
  {
    id: "route_guard_allows_guard_update_only_for_exact_path",
    input: {
      guardFile: OPTIONAL_GUARD_FILE,
      proposedAllowedPaths: [EXACT_ROUTE_PATH],
      proposedBroadAllows: [],
    },
    expected: {
      guardUpdateAllowedInFutureBatch: true,
      guardUpdateAllowedInThisBatch: false,
      allowedGuardFile: OPTIONAL_GUARD_FILE,
      allowanceType: "exact_path",
      exactRoutePath: EXACT_ROUTE_PATH,
      broadApiAllow: false,
    },
  },
  {
    id: "route_implementation_next_batch_allowed_files",
    input: {
      nextBatchFiles: [
        EXACT_ROUTE_PATH,
        "scripts/test-career-core-controlled-candidate-public-preview-route.js",
        "docs/career-core-controlled-candidate-public-preview-route-20260606.md",
      ],
      optionalFiles: [OPTIONAL_GUARD_FILE],
    },
    expected: {
      allowed: true,
      containsRouteTestDocOnly: true,
      optionalGuardUpdateOnly: true,
      exactRoutePath: EXACT_ROUTE_PATH,
      forbiddenCategories: ["ui", "db_write", "supabase_write", "package_change", "scoring_change"],
    },
  },
  {
    id: "route_guard_blocks_route_plus_ui_or_db",
    input: {
      futureRoutePath: EXACT_ROUTE_PATH,
      includedChanges: ["route", "ui", "db_write"],
    },
    expected: {
      allowed: false,
      rejected: true,
      reason: "route_plus_ui_or_db_forbidden",
      blocksUiImplementation: true,
      blocksDbWrite: true,
    },
  },
]);

export const controlledCandidateRouteGuardAllowanceContract = Object.freeze({
  exactRoutePath: EXACT_ROUTE_PATH,
  publicEndpoint: PUBLIC_ENDPOINT,
  optionalGuardFile: OPTIONAL_GUARD_FILE,
});
