import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const DEFAULT_ALLOWED_FILE_PATTERNS = [
  /^api\/career-core\/controlled-candidates\/preview\.js$/,
  /^docs\/career-core-[^/]+\.md$/,
  /^scripts\/test-career-core-[^/]+\.js$/,
  /^src\/lib\/career-core\/__fixtures__\/[^/]+\.js$/,
  /^src\/lib\/career-core\/__testUtils__\/[^/]+\.js$/,
];

const HARD_BLOCKED_FILE_PATTERNS = [
  /^src\/api\//,
  /^supabase\//,
  /(^|\/)vercel\.json$/,
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)[^/]*(?:deploy|deployment)[^/]*$/i,
  /^package(?:-lock)?\.json$/,
  /^src\/App\.jsx$/,
  /^src\/components\//,
  /^src\/pages\//,
  /^src\/lib\/career-core\/careerProfileModel\.js$/,
  /^src\/lib\/career-core\/scoreCareerRoleFit\.js$/,
  /^src\/lib\/career-core\/scoreCareerIndustryFit\.js$/,
  /^src\/lib\/career-core\/buildControlledCareerProfileSignals\.js$/,
  /^src\/lib\/career-core\/buildEvidenceTraceMap\.js$/,
  /^src\/lib\/career-core\/calibrateEvidenceConfidence\.js$/,
];

const RUNTIME_FILE_PATTERNS = [
  /^src\/lib\/career-core\/buildCareerProfileFromResumeProfile\.js$/,
  /^src\/lib\/career-core\/buildCareerProfileFromWorkRecords\.js$/,
];

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function listGitPaths(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
    .split(/\r?\n/)
    .map(normalizePath)
    .filter(Boolean);
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file));
}

export function listChangedFilesAgainstMain() {
  return [
    ...new Set([
      ...listGitPaths(["diff", "--name-only", "origin/main...HEAD"]),
      ...listGitPaths(["diff", "--name-only"]),
      ...listGitPaths(["diff", "--cached", "--name-only"]),
      ...listGitPaths(["ls-files", "--others", "--exclude-standard"]),
    ]),
  ].sort();
}

export function assertCareerCoreChangedFilesAllowed(options = {}) {
  const {
    allowedRuntimeFiles = [],
    allowedExtraFiles = [],
    context = "career core changed-file guard",
  } = options;
  const allowedRuntimeFileSet = new Set(allowedRuntimeFiles.map(normalizePath));
  const allowedExtraFileSet = new Set(allowedExtraFiles.map(normalizePath));

  for (const file of listChangedFilesAgainstMain()) {
    assert.ok(!matchesAny(file, HARD_BLOCKED_FILE_PATTERNS), `${context}: protected file unchanged: ${file}`);

    if (allowedRuntimeFileSet.has(file)) {
      continue;
    }

    if (matchesAny(file, RUNTIME_FILE_PATTERNS)) {
      assert.fail(`${context}: runtime file must be explicitly allowed: ${file}`);
    }

    assert.ok(
      matchesAny(file, DEFAULT_ALLOWED_FILE_PATTERNS) || allowedExtraFileSet.has(file),
      `${context}: changed file is allowed Career Core QA scope: ${file}`
    );
  }
}
