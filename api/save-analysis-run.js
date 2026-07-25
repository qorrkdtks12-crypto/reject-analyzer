// api/save-analysis-run.js
// Multi-action Vercel function.
//
// Without ?action= this endpoint behaves exactly like the original
// save-analysis-run endpoint — same Bearer auth, same Supabase tables, same
// response shape. Existing callers (src/lib/persistence/saveAnalysisRun.js)
// do NOT pass an action and therefore are unaffected by this change.
//
// MCP pairing actions are folded in here because Vercel's Hobby plan caps
// the project at 12 Serverless Functions, and adding a standalone /api/mcp.js
// would tip the deployment over that limit. The handlers themselves are
// unchanged — they share the same secret-handling and identity guarantees
// documented in docs/mcp-pairing.md.
//
// Actions
//   (none) | save_analysis_run     → original handler (POST + Bearer)
//   mcp_health                     → MCP service heartbeat (GET, no auth)
//   mcp_pairing_create             → mint a one-time pairing code (POST,
//                                    Supabase access token required)
//   mcp_pairing_exchange           → trade a pairing code for an MCP token
//                                    (POST, no auth)
//   mcp_save_experience            → persist an experience candidate via the
//                                    MCP wrapper (POST, MCP token required)
//   mcp_search_experiences         → search a user's saved experience cards
//                                    via the MCP wrapper (POST, MCP token
//                                    required)
//   mcp_pairing_list               → list the caller's MCP pairings — never
//                                    returns code_hash / token_hash or
//                                    plaintext secrets (POST, Supabase
//                                    access token required)
//   mcp_pairing_revoke             → soft-revoke a single pairing the caller
//                                    owns and clear its hashes (POST,
//                                    Supabase access token required)
//   github_pr_preview              - persist a GitHub PR career candidate
//                                    preview without adding another function
//                                    (POST, Supabase access token required)
//   github_recent_pull_requests_import
//                                  - import recent merged PRs from selected
//                                    GitHub App repositories without adding
//                                    another function
//                                    (POST, Supabase access token required)
//   github_daily_review_request    - build a daily review payload from recent
//                                    merged GitHub PR candidates without
//                                    sending notifications
//                                    (POST, Supabase access token required)

import { createClient } from "@supabase/supabase-js";

import {
  hashSecret,
  createMcpToken,
  createPairingCode,
  pairingCodeExpiry,
  mcpTokenExpiry,
  readBearerToken,
  getServiceRoleClient,
  verifySupabaseAccessToken,
  verifyMcpToken,
  basicRateLimit,
  clientIpKey,
  jsonError,
} from "../server/api-helpers/_mcp_auth.js";
import { verifyChatgptOAuthAccessToken } from "../server/api-helpers/_chatgpt_oauth.js";
import {
  BROWSER_EXTENSION_ANALYSIS_VERSION,
  extractBrowserExtensionExperienceCandidate,
} from "../src/lib/experience/browserExtensionExtraction.js";
import {
  GITHUB_PR_SOURCE_TYPE,
  buildGithubPrCareerCandidateContract,
} from "../src/lib/githubCareerCandidateContract.js";
import {
  GITHUB_RAW_PAYLOAD_FORBIDDEN_KEYS,
  GITHUB_TOKEN_FORBIDDEN_KEYS,
  normalizeGithubRepository,
  validateGithubRepositoryAccessSnapshot,
} from "../server/api-helpers/github-app-connection.js";
import { readGithubAppPublicConfig } from "../server/api-helpers/github-app-config.js";
import {
  buildGithubConnectionStateValidationResult,
  createGithubConnectionState,
  normalizeGithubInstallationIdForCallback,
} from "../server/api-helpers/github-connection-state.js";
import {
  buildVerifiedGithubConnectionRecord,
  exchangeGithubOAuthCodeForUserToken,
  persistVerifiedGithubConnection,
  readGithubOAuthConfig,
  readGithubUserInstallations,
  normalizeGithubOAuthCodeForCallback,
  verifyAndPersistGithubInstallationConnection,
} from "../server/api-helpers/github-installation-verify.js";
import { createGithubInstallationAccessToken } from "../server/api-helpers/github-app-installation-token.js";
import {
  buildGithubRepositoryAccessListResponse,
  buildGithubRepositorySelectionResponse,
  fetchGithubInstallationRepositories,
  normalizeGithubRepositorySelectionPayload,
  persistGithubRepositoryAccessSnapshots,
  readConnectedGithubConnectionForUser,
  readGithubRepositoryAccessRows,
  updateGithubRepositorySelection,
} from "../server/api-helpers/github-repository-access.js";
import {
  buildGithubPullRequestCandidatePayload,
  buildGithubDailyReviewRequestResponse,
  buildGithubRecentPullRequestsImportResponse,
  fetchClosedGithubPullRequestsForRepo,
  fetchGithubPullRequestDetail,
  fetchGithubPullRequestFiles,
  isPreferredGithubAuthor,
  isPullRequestInsideLookback,
  normalizeGithubRecentPullRequestsImportRequest,
  selectedGithubRepositoryRows,
} from "../server/api-helpers/github-recent-pull-requests.js";

// ─── shared helpers (unchanged from the original save-analysis-run.js) ─────

function __s(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function __jsonObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function __jsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function __numOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function __getBearerToken(req) {
  const raw =
    req?.headers?.authorization ??
    req?.headers?.Authorization ??
    "";
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parts = __s(value).split(/\s+/);
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== "bearer") return null;
  return __s(parts[1]) || null;
}

function __authRequired(res, message = "Authorization Bearer token required") {
  return res.status(401).json({
    ok: false,
    error: {
      code: "AUTH_REQUIRED",
      message,
    },
  });
}

function __setCorsHeaders(res) {
  // GET added so that mcp_health (a GET) is covered too; existing POST clients
  // are unaffected since the value is union of methods.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

// ─── original handler — preserved verbatim (POST + Bearer + service_role) ──

async function handleSaveAnalysisRun(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const accessToken = __getBearerToken(req);
    if (!accessToken) {
      return __authRequired(res);
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const verifiedUser = authData?.user ?? null;
    const verifiedUserId = __s(verifiedUser?.id);
    if (authError || !verifiedUserId) {
      return __authRequired(res, "Invalid or expired Authorization token");
    }

    const { input, run } = req.body || {};
    const inputSafe = __jsonObject(input);
    const runSafe = __jsonObject(run);

    const inputRowData = {
      user_id: verifiedUserId,
      jd_text: __s(inputSafe?.jdText) || "",
      resume_text: __s(inputSafe?.resumeText) || "",
      company_name: __s(inputSafe?.companyName) || null,
      target_role: __s(inputSafe?.targetRole) || null,
      industry: __s(inputSafe?.industry) || null,
      stage: __s(inputSafe?.stage) || null,
      meta_json: __jsonObject(inputSafe?.metaJson),
    };

    const { data: inputRow, error: inputError } = await supabase
      .from("analysis_inputs")
      .insert(inputRowData)
      .select()
      .single();

    if (inputError) throw inputError;

    const { data: runRow, error: runError } = await supabase
      .from("analysis_runs")
      .insert({
        input_id: inputRow.id,
        user_id: verifiedUserId,
        engine_version: __s(runSafe?.engineVersion),
        status: __s(runSafe?.status) || "success",
        score: __numOrNull(runSafe?.score),
        candidate_type: __s(runSafe?.candidateType) || null,
        top_risks_json: __jsonArray(runSafe?.topRisks),
        result_json: __jsonObject(runSafe?.resultJson),
      })
      .select()
      .single();

    if (runError) throw runError;

    return res.status(200).json({
      ok: true,
      inputId: inputRow.id,
      runId: runRow.id,
    });
  } catch (err) {
    console.error("save-analysis-run error", err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err || "save failed"),
    });
  }
}

// ─── MCP action handlers (moved from the now-removed api/mcp.js) ───────────
//
// Security invariants (unchanged from the original api/mcp.js):
//   - user_id is NEVER read from request bodies.
//   - Plaintext code / token leave the server EXACTLY once.
//   - SUPABASE_SERVICE_ROLE_KEY is read from process.env only.

const MCP_SERVICE_VERSION = "pairing-v1";
const MCP_PAIRING_CREATE_DAILY_LIMIT = 10;     // per user
const MCP_PAIRING_EXCHANGE_DAILY_LIMIT = 30;   // per IP

function _mcpSafeString(value, max = 200) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function _mcpNormalizeClientName(value) {
  const s = _mcpSafeString(value, 80);
  return s || "unknown-client";
}

function _mcpNormalizePairingCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().slice(0, 32);
}

async function _mcpReadJsonBody(req) {
  if (req?.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body;
  }
  if (typeof req?.body === "string") {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

async function handleMcpHealth(req, res) {
  if (req.method !== "GET") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "GET required");
  }
  return res.status(200).json({
    ok: true,
    service: "passmap-mcp",
    version: MCP_SERVICE_VERSION,
  });
}

async function handleMcpPairingCreate(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
  }

  // 1. Verify the PASSMAP web caller's identity from the Supabase access token.
  const accessToken = readBearerToken(req);
  const identity = await verifySupabaseAccessToken({ accessToken, supabase });
  if (!identity.ok) {
    return jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message);
  }
  const verifiedUserId = identity.userId;

  // 2. Per-user daily rate limit.
  const rl = await basicRateLimit({
    key: `pairing_create:user:${verifiedUserId}`,
    limit: MCP_PAIRING_CREATE_DAILY_LIMIT,
  });
  if (!rl.allow) {
    return jsonError(res, rl.status || 429, "RATE_LIMITED", rl.message);
  }

  const body = await _mcpReadJsonBody(req);
  const clientName = _mcpNormalizeClientName(body?.clientName);

  // 3. Revoke prior active pairing entries for the same (user, client_name)
  //    that are still waiting for code exchange.
  try {
    await supabase
      .from("user_mcp_pairings")
      .update({ revoked_at: new Date().toISOString() })
      .match({ user_id: verifiedUserId, client_name: clientName })
      .is("consumed_at", null)
      .is("revoked_at", null);
  } catch (_) {
    // Non-fatal — the follow-up insert still produces a usable code.
  }

  // 4. Mint a fresh code, persist its hash, return the plaintext exactly once.
  const code = createPairingCode();
  const codeHash = hashSecret(code);
  const codeExpiresAt = pairingCodeExpiry();

  try {
    const { error } = await supabase.from("user_mcp_pairings").insert({
      user_id: verifiedUserId,
      code_hash: codeHash,
      code_expires_at: codeExpiresAt,
      client_name: clientName,
    });
    if (error) {
      console.error("[mcp] pairing_create insert failed:", error.message);
      return jsonError(res, 500, "PAIRING_CREATE_FAILED", "Could not issue a pairing code");
    }
  } catch (err) {
    console.error("[mcp] pairing_create unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "PAIRING_CREATE_FAILED", "Could not issue a pairing code");
  }

  return res.status(200).json({
    ok: true,
    code, // plaintext returned ONCE, immediately to the authenticated caller
    expiresAt: codeExpiresAt,
    clientName,
  });
}

async function handleMcpPairingExchange(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
  }

  // Per-IP rate limit BEFORE touching the DB — defends against code brute force.
  const rl = await basicRateLimit({
    key: `pairing_exchange:${clientIpKey(req)}`,
    limit: MCP_PAIRING_EXCHANGE_DAILY_LIMIT,
  });
  if (!rl.allow) {
    return jsonError(res, rl.status || 429, "RATE_LIMITED", rl.message);
  }

  const body = await _mcpReadJsonBody(req);
  const code = _mcpNormalizePairingCode(body?.code);
  const clientName = _mcpNormalizeClientName(body?.clientName);

  if (!code || code.length < 4) {
    return jsonError(res, 400, "INVALID_CODE", "Pairing code is missing or malformed");
  }

  const codeHash = hashSecret(code);

  // 1. Find an active row matching this code_hash.
  let pairing = null;
  try {
    const { data, error } = await supabase
      .from("user_mcp_pairings")
      .select("id, user_id, code_expires_at, consumed_at, revoked_at")
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[mcp] pairing_exchange lookup failed:", error.message);
      return jsonError(res, 500, "EXCHANGE_FAILED", "Could not verify pairing code");
    }
    pairing = data;
  } catch (err) {
    console.error("[mcp] pairing_exchange unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "EXCHANGE_FAILED", "Could not verify pairing code");
  }

  // 2. Generic 401 for "not found / expired" — do NOT distinguish the cases.
  if (!pairing) {
    return jsonError(res, 401, "INVALID_CODE", "Pairing code is invalid or expired");
  }
  if (pairing.code_expires_at && new Date(pairing.code_expires_at).getTime() < Date.now()) {
    return jsonError(res, 401, "INVALID_CODE", "Pairing code is invalid or expired");
  }

  // 3. Mint a long-lived MCP token, persist its hash, clear the code_hash.
  const token = createMcpToken();
  const tokenHash = hashSecret(token);
  const tokenExpiresAt = mcpTokenExpiry();
  const nowIso = new Date().toISOString();

  try {
    const { error } = await supabase
      .from("user_mcp_pairings")
      .update({
        token_hash: tokenHash,
        token_expires_at: tokenExpiresAt,
        consumed_at: nowIso,
        code_hash: null, // ensure the code cannot be replayed even by hash
        code_expires_at: null,
        client_name: clientName,
      })
      .eq("id", pairing.id)
      .is("consumed_at", null) // optimistic lock — refuses to overwrite a race
      .is("revoked_at", null);
    if (error) {
      console.error("[mcp] pairing_exchange update failed:", error.message);
      return jsonError(res, 500, "EXCHANGE_FAILED", "Could not exchange pairing code");
    }
  } catch (err) {
    console.error("[mcp] pairing_exchange update unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "EXCHANGE_FAILED", "Could not exchange pairing code");
  }

  return res.status(200).json({
    ok: true,
    token, // plaintext returned ONCE — the wrapper must persist this securely
    tokenExpiresAt,
    clientName,
  });
}

// ─── MCP experience save / search (12-B2) ─────────────────────────────────
//
// Identity contract:
//   - Both endpoints REQUIRE a long-lived MCP bearer token issued by
//     mcp_pairing_exchange. verifyMcpToken() returns the verified user_id
//     and pairing_id; user_id is never read from the request body.
//   - The token is hashed once for lookup; no plaintext token ever reaches
//     a log line or the response body of these handlers.
//
// Storage contract for save:
//   - raw_sources.raw_text is ALWAYS stored as null. Only short, user-
//     visible evidenceTexts (passed in via the MCP wrapper) are persisted
//     into experience_evidence.evidence_text — the full conversation is
//     never copied to PASSMAP.
//   - metadata.rawTextStored = false marks rows so future audits can
//     verify the invariant in-place.

const MCP_SUMMARY_MAX = 280;
const MCP_SEARCH_FETCH_CAP = 50; // pre-filter window before JS narrowing

const _MCP_ALLOWED_SOURCE_PLATFORMS = new Set([
  "chatgpt",
  "gemini",
  "claude",
  "manual",
  "unknown",
]);

const _MCP_SEARCH_LIMIT_DEFAULT = 5;
const _MCP_SEARCH_LIMIT_MAX = 10;

function _mcpStr(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function _mcpStrArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter((v) => v.length > 0);
}

// Mirrors tools/passmap-mcp-local/lib/validate.mjs::validateSavePayload but is
// re-declared here on purpose — Vercel serverless functions should not import
// from tools/** (different dependency graph, packaging surface, lifecycle).
function _validateMcpSavePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errorCode: "INVALID_INPUT", message: "Input must be an object." };
  }

  const title = _mcpStr(input.title);
  if (title.length < 2) {
    return {
      ok: false,
      errorCode: "TITLE_TOO_SHORT",
      message: "title은 필수이며 최소 2자 이상이어야 합니다.",
    };
  }

  const situation = _mcpStr(input.situation);
  const task = _mcpStr(input.task);
  const actions = _mcpStrArray(input.actions);
  if (!situation && !task && actions.length === 0) {
    return {
      ok: false,
      errorCode: "MISSING_CORE_FIELD",
      message: "situation, task, actions 중 최소 한 개는 채워야 합니다.",
    };
  }

  const evidenceTexts = _mcpStrArray(input.evidenceTexts);
  const skills = _mcpStrArray(input.skills);
  const jobTags = _mcpStrArray(input.jobTags);
  const industryTags = _mcpStrArray(input.industryTags);
  const riskNotes = _mcpStrArray(input.riskNotes);
  const resultCandidate = _mcpStr(input.resultCandidate);

  const rawPlatform = _mcpStr(input.sourcePlatform).toLowerCase();
  const sourcePlatform = _MCP_ALLOWED_SOURCE_PLATFORMS.has(rawPlatform) ? rawPlatform : "unknown";
  const sourceConversationTitle = _mcpStr(input.sourceConversationTitle);

  // rawText / raw_text are deliberately ignored even if the caller sends them.

  return {
    ok: true,
    normalized: {
      title,
      situation,
      task,
      actions,
      resultCandidate,
      skills,
      jobTags,
      industryTags,
      evidenceTexts,
      riskNotes,
      sourcePlatform,
      sourceConversationTitle,
    },
  };
}

function _validateMcpSearchPayload(input) {
  if (input != null && (typeof input !== "object" || Array.isArray(input))) {
    return { ok: false, errorCode: "INVALID_INPUT", message: "Input must be an object." };
  }
  const safe = input || {};
  const query = _mcpStr(safe.query);
  const skills = _mcpStrArray(safe.skills);
  const jobTags = _mcpStrArray(safe.jobTags);
  const industryTags = _mcpStrArray(safe.industryTags);
  let limit = Number(safe.limit);
  if (!Number.isFinite(limit) || limit <= 0) limit = _MCP_SEARCH_LIMIT_DEFAULT;
  if (limit > _MCP_SEARCH_LIMIT_MAX) limit = _MCP_SEARCH_LIMIT_MAX;
  return { ok: true, normalized: { query, skills, jobTags, industryTags, limit } };
}

function _mcpBuildSummary({ situation, task, actions, resultCandidate }) {
  const parts = [];
  if (situation) parts.push(situation);
  if (task) parts.push(task);
  if (parts.length === 0 && Array.isArray(actions) && actions.length > 0) {
    parts.push(actions.slice(0, 2).join(" · "));
  }
  if (resultCandidate) parts.push(resultCandidate);
  const text = parts.join(" / ");
  if (text.length <= MCP_SUMMARY_MAX) return text;
  return text.slice(0, MCP_SUMMARY_MAX - 1) + "…";
}

function _externalAiRecordDate(value) {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }
  return new Date().toISOString().split("T")[0];
}

function _externalAiJoinedAction(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  return actions
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean)
    .slice(0, 10)
    .join("\n");
}

async function createCompanionWorkRecordForAiExperience({
  supabase,
  userId,
  recordDate,
  title,
  summary,
  situation,
  task,
  actions,
  result,
  skills,
  jobTags,
  industryTags,
  evidenceTexts,
  suggestedResumeBullet = null,
  sourcePlatform,
  importMethod,
  extraMetadata = {},
}) {
  const safeTitle = _mcpStr(title) || "AI saved experience";
  const safeSourcePlatform = _mcpStr(sourcePlatform) || "unknown";
  const safeImportMethod = _mcpStr(importMethod) || "external_ai_save";
  const safeSummary = _mcpStr(summary, 2000);
  const safeEvidenceTexts = Array.isArray(evidenceTexts) ? evidenceTexts.slice(0, 8) : [];

  const { data, error } = await supabase
    .from("work_records")
    .insert({
      user_id: userId,
      record_date: _externalAiRecordDate(recordDate),
      title: safeTitle,
      description: safeSummary || null,
      situation: situation || null,
      task: task || null,
      action: _externalAiJoinedAction(actions),
      result: result || null,
      job_category: Array.isArray(jobTags) && jobTags.length > 0 ? jobTags[0] : null,
      industry_category: Array.isArray(industryTags) && industryTags.length > 0 ? industryTags[0] : null,
      strength_tags: Array.isArray(skills) ? skills.slice(0, 10) : [],
      skill_tags: Array.isArray(jobTags) ? jobTags.slice(0, 10) : [],
      source: "ai_external_import",
      raw_payload: {
        sourceMode: "ai_conversation",
        sourcePlatform: safeSourcePlatform,
        importMethod: safeImportMethod,
        title: safeTitle,
        summary: safeSummary || null,
        suggestedResumeBullet,
        evidenceTexts: safeEvidenceTexts,
        skills: Array.isArray(skills) ? skills : [],
        jobTags: Array.isArray(jobTags) ? jobTags : [],
        industryTags: Array.isArray(industryTags) ? industryTags : [],
        createdVia: "external_ai_save",
        createdAt: new Date().toISOString(),
        ...extraMetadata,
      },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "work_records insert failed");
  }
  return data.id;
}

function _mcpJsonArrayLike(value) {
  // experience_cards stores array-like fields as jsonb; older rows may surface
  // as null or as an object. Normalize to a plain array for the response.
  if (Array.isArray(value)) return value;
  return [];
}

function _mcpSuggestedUse(card) {
  const tags = [
    ..._mcpJsonArrayLike(card.job_tags),
    ..._mcpJsonArrayLike(card.industry_tags),
    ..._mcpJsonArrayLike(card.skills),
  ].filter((t) => typeof t === "string" && t.length > 0);
  if (tags.length === 0) {
    return "이 경험의 활용 방향은 아직 명확하지 않습니다. 직무·산업 태그를 보강해 보세요.";
  }
  const preview = tags.slice(0, 3).join(", ");
  return `이 경험은 ${preview} 관련 이력서·면접 문항에 활용할 수 있습니다.`;
}

function _mcpMatchesAllTags(itemTags, queryTags) {
  if (!Array.isArray(queryTags) || queryTags.length === 0) return true;
  const haystack = new Set(
    _mcpJsonArrayLike(itemTags)
      .map((t) => (typeof t === "string" ? t.toLowerCase() : ""))
      .filter((t) => t.length > 0)
  );
  return queryTags.every((t) => haystack.has(String(t).toLowerCase()));
}

function _mcpMatchesFreeText(card, queryLower) {
  if (!queryLower) return true;
  const evidenceTexts = Array.isArray(card.__evidenceTexts) ? card.__evidenceTexts : [];
  const buckets = [
    card.title,
    card.situation,
    card.task,
    card.suggested_resume_bullet,
    ..._mcpJsonArrayLike(card.actions),
    ..._mcpJsonArrayLike(card.skills),
    ..._mcpJsonArrayLike(card.job_tags),
    ..._mcpJsonArrayLike(card.industry_tags),
    ..._mcpJsonArrayLike(card.risk_notes),
    ...evidenceTexts,
  ];
  for (const v of buckets) {
    if (typeof v === "string" && v.toLowerCase().includes(queryLower)) return true;
  }
  return false;
}

async function handleMcpSaveExperience(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
  }

  const accessToken = readBearerToken(req);
  const identity = await verifyMcpToken({ accessToken, supabase });
  if (!identity.ok) {
    return jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message);
  }
  const verifiedUserId = identity.userId;
  const pairingId = identity.pairingId;

  const body = await _mcpReadJsonBody(req);
  const validated = _validateMcpSavePayload(body);
  if (!validated.ok) {
    return jsonError(res, 400, validated.errorCode, validated.message);
  }

  const n = validated.normalized;
  const summary = _mcpBuildSummary({
    situation: n.situation,
    task: n.task,
    actions: n.actions,
    resultCandidate: n.resultCandidate,
  });

  let workRecordId;
  try {
    workRecordId = await createCompanionWorkRecordForAiExperience({
      supabase,
      userId: verifiedUserId,
      recordDate: null,
      title: n.title,
      summary,
      situation: n.situation,
      task: n.task,
      actions: n.actions,
      result: n.resultCandidate,
      skills: n.skills,
      jobTags: n.jobTags,
      industryTags: n.industryTags,
      evidenceTexts: n.evidenceTexts,
      sourcePlatform: n.sourcePlatform || "claude",
      importMethod: "mcp_save_experience",
      extraMetadata: {
        sourceConversationTitle: n.sourceConversationTitle || null,
        pairingId,
      },
    });
  } catch (err) {
    console.error("[mcp] save_experience work_records insert failed:", err?.message || "unknown");
    return jsonError(res, 500, "SAVE_FAILED", "Could not save experience work record");
  }

  let rawSource;
  try {
    const { data, error } = await supabase
      .from("raw_sources")
      .insert({
        user_id: verifiedUserId,
        work_record_id: workRecordId,
        source_type: "ai_conversation",
        source_label: `${n.sourcePlatform || "unknown"}:${n.sourceConversationTitle || "MCP"}`,
        detected_period: null,
        raw_text: null,
        file_url: null,
        file_name: null,
        mime_type: null,
        summary: summary || null,
        processing_status: "completed",
        metadata: {
          importMethod: "mcp_save_experience",
          sourcePlatform: n.sourcePlatform,
          sourceConversationTitle: n.sourceConversationTitle || null,
          pairingId,
          rawTextStored: false,
        },
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error("[mcp] save_experience raw_sources insert failed:", error?.message || "unknown");
      return jsonError(res, 500, "SAVE_FAILED", "Could not save experience candidate");
    }
    rawSource = data;
  } catch (err) {
    console.error("[mcp] save_experience raw_sources unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "SAVE_FAILED", "Could not save experience candidate");
  }

  let card;
  try {
    const { data, error } = await supabase
      .from("experience_cards")
      .insert({
        user_id: verifiedUserId,
        source_id: rawSource.id,
        work_record_id: workRecordId,
        title: n.title,
        situation: n.situation || null,
        task: n.task || null,
        actions: n.actions,
        result: n.resultCandidate ? { candidate: n.resultCandidate } : {},
        collaboration: {},
        skills: n.skills,
        job_tags: n.jobTags,
        industry_tags: n.industryTags,
        resume_potential: "medium",
        confidence_level: n.evidenceTexts.length > 0 ? "medium" : "low",
        suggested_resume_bullet: null,
        missing_info_questions: [],
        risk_notes: n.riskNotes,
        differ_reason: null,
        status: "accepted",
        metadata: {
          importMethod: "mcp_save_experience",
          sourcePlatform: n.sourcePlatform,
          sourceConversationTitle: n.sourceConversationTitle || null,
          pairingId,
        },
      })
      .select("id, created_at, title")
      .single();
    if (error || !data?.id) {
      console.error("[mcp] save_experience experience_cards insert failed:", error?.message || "unknown");
      return jsonError(res, 500, "SAVE_FAILED", "Could not save experience candidate");
    }
    card = data;
  } catch (err) {
    console.error("[mcp] save_experience experience_cards unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "SAVE_FAILED", "Could not save experience candidate");
  }

  let evidenceCount = 0;
  if (n.evidenceTexts.length > 0) {
    try {
      const rows = n.evidenceTexts.map((evidence_text) => ({
        user_id: verifiedUserId,
        experience_card_id: card.id,
        source_id: rawSource.id,
        evidence_text,
        evidence_type: "quote",
        source_offset_start: null,
        source_offset_end: null,
        metadata: { importMethod: "mcp_save_experience" },
      }));
      const { error } = await supabase.from("experience_evidence").insert(rows);
      if (error) {
        // Card + source already exist; surface a soft warning but keep the
        // success response so the user does not lose their save. The card
        // itself can still be browsed without evidence rows.
        console.error("[mcp] save_experience evidence insert failed:", error.message);
      } else {
        evidenceCount = rows.length;
      }
    } catch (err) {
      console.error("[mcp] save_experience evidence unexpected:", err?.message || "unknown");
    }
  }

  return res.status(200).json({
    ok: true,
    experienceId: card.id,
    sourceId: rawSource.id,
    workRecordId,
    evidenceCount,
    message: "경험 후보를 PASSMAP에 저장했습니다.",
    saved: {
      id: card.id,
      workRecordId,
      title: card.title,
      summary,
      skills: n.skills,
      jobTags: n.jobTags,
      industryTags: n.industryTags,
      evidenceTexts: n.evidenceTexts,
      createdAt: card.created_at,
    },
  });
}

async function handleMcpSearchExperiences(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
  }

  const accessToken = readBearerToken(req);
  const identity = await verifyMcpToken({ accessToken, supabase });
  if (!identity.ok) {
    return jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message);
  }
  const verifiedUserId = identity.userId;

  const body = await _mcpReadJsonBody(req);
  const validated = _validateMcpSearchPayload(body);
  if (!validated.ok) {
    return jsonError(res, 400, validated.errorCode, validated.message);
  }
  const { query, skills, jobTags, industryTags, limit } = validated.normalized;

  // 1. Load a recency-bounded window for this user. raw_text is never read.
  let cards;
  try {
    const { data, error } = await supabase
      .from("experience_cards")
      .select(
        "id, title, situation, task, actions, skills, job_tags, industry_tags, " +
          "suggested_resume_bullet, risk_notes, status, created_at"
      )
      .eq("user_id", verifiedUserId)
      .order("created_at", { ascending: false })
      .limit(MCP_SEARCH_FETCH_CAP);
    if (error) {
      console.error("[mcp] search_experiences cards failed:", error.message);
      return jsonError(res, 500, "SEARCH_FAILED", "Could not search experiences");
    }
    cards = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[mcp] search_experiences cards unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "SEARCH_FAILED", "Could not search experiences");
  }

  // 2. Pull evidence for the fetched cards in one shot (filtered by user_id
  //    as a belt-and-suspenders check on top of the experience_card_id FK).
  const cardIds = cards.map((c) => c.id);
  const evidenceByCard = new Map();
  if (cardIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from("experience_evidence")
        .select("experience_card_id, evidence_text")
        .eq("user_id", verifiedUserId)
        .in("experience_card_id", cardIds);
      if (error) {
        console.error("[mcp] search_experiences evidence failed:", error.message);
      } else if (Array.isArray(data)) {
        for (const row of data) {
          const cid = row?.experience_card_id;
          const text = typeof row?.evidence_text === "string" ? row.evidence_text : "";
          if (!cid || !text) continue;
          const list = evidenceByCard.get(cid) || [];
          list.push(text);
          evidenceByCard.set(cid, list);
        }
      }
    } catch (err) {
      console.error("[mcp] search_experiences evidence unexpected:", err?.message || "unknown");
    }
  }

  // 3. Filter in JS to keep the SQL simple and safe (no pg_trgm dependency).
  const queryLower = query ? query.toLowerCase() : "";
  const matched = [];
  for (const card of cards) {
    card.__evidenceTexts = evidenceByCard.get(card.id) || [];
    if (!_mcpMatchesFreeText(card, queryLower)) continue;
    if (!_mcpMatchesAllTags(card.skills, skills)) continue;
    if (!_mcpMatchesAllTags(card.job_tags, jobTags)) continue;
    if (!_mcpMatchesAllTags(card.industry_tags, industryTags)) continue;
    matched.push(card);
    if (matched.length >= limit) break;
  }

  const items = matched.map((card) => ({
    id: card.id,
    title: card.title,
    summary: _mcpBuildSummary({
      situation: card.situation,
      task: card.task,
      actions: _mcpJsonArrayLike(card.actions),
      resultCandidate: "",
    }),
    skills: _mcpJsonArrayLike(card.skills),
    jobTags: _mcpJsonArrayLike(card.job_tags),
    industryTags: _mcpJsonArrayLike(card.industry_tags),
    suggestedUse: _mcpSuggestedUse(card),
    evidenceTexts: card.__evidenceTexts,
    createdAt: card.created_at,
  }));

  return res.status(200).json({
    ok: true,
    count: items.length,
    items,
  });
}

// --- ChatGPT Actions save wrapper -------------------------------------------
//
// First-pass endpoint wrapper only. OAuth/env/secrets/deploy setup stays out
// of this patch. Until OAuth exists, this branch requires an existing
// PASSMAP/Supabase access token so it never creates a public write path.

const CHATGPT_ACTION_IMPORT_METHOD = "chatgpt_action_save_experience";
const CHATGPT_ACTION_SOURCE_PLATFORM = "chatgpt";
const CHATGPT_ACTION_SCHEMA_VERSION = "chatgpt-actions-v0.1";
const CHATGPT_ACTION_MAX_PAYLOAD_CHARS = 100000;
const CHATGPT_ACTION_SUMMARY_MAX = 280;
const CHATGPT_ACTION_FALLBACK_APP_BASE_URL = "https://passmap-app.vercel.app";
const CHATGPT_ACTION_INBOX_DEEPLINK = "/?utm_source=chatgpt&view=ai-inbox#ai-inbox";
const CHATGPT_ACTION_RAW_TEXT_FIELDS = new Set([
  "rawconversationtext",
  "fulltranscript",
  "conversationraw",
  "rawtext",
  "raw_text",
  "fullconversation",
  "messages",
]);

function _chatgptActionError(res, status, code, message, retryable = false) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    retryable,
  });
}

function _chatgptStr(value, max = 1200) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function _chatgptActionInboxUrl() {
  const base =
    _chatgptStr(process.env.PASSMAP_APP_BASE_URL, 2048) ||
    _chatgptStr(process.env.VITE_API_BASE, 2048) ||
    CHATGPT_ACTION_FALLBACK_APP_BASE_URL;
  return base.replace(/\/+$/, "") + CHATGPT_ACTION_INBOX_DEEPLINK;
}

function _chatgptKstDateParts(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function _chatgptKstTodayDateString(now = new Date()) {
  const parts = _chatgptKstDateParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function _chatgptKstNoonIsoFromDateString(recordDate) {
  const [year, month, day] = String(recordDate || "").split("-").map((v) => Number(v));
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)).toISOString();
}

function _chatgptResolveWorkDate(value) {
  const raw = _chatgptStr(value, 80);
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const recordDate = `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
    return {
      occurredAt: _chatgptKstNoonIsoFromDateString(recordDate),
      recordDate,
    };
  }

  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        occurredAt: parsed.toISOString(),
        recordDate: _chatgptKstTodayDateString(parsed),
      };
    }
  }

  const recordDate = _chatgptKstTodayDateString();
  return {
    occurredAt: _chatgptKstNoonIsoFromDateString(recordDate),
    recordDate,
  };
}

function _chatgptNullableStr(value, max = 1200) {
  const normalized = _chatgptStr(value, max);
  return normalized || null;
}

function _chatgptStrArray(value, { maxItems = 12, maxLength = 300 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => _chatgptStr(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function _chatgptHasRawTextField(value, seen = new Set()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => _chatgptHasRawTextField(item, seen));
  }
  for (const key of Object.keys(value)) {
    if (CHATGPT_ACTION_RAW_TEXT_FIELDS.has(String(key).toLowerCase())) {
      return true;
    }
    if (_chatgptHasRawTextField(value[key], seen)) {
      return true;
    }
  }
  return false;
}

function _chatgptBuildSummary({ situation, task, actions, result }) {
  const parts = [];
  if (situation) parts.push(situation);
  if (task) parts.push(task);
  if (parts.length === 0 && Array.isArray(actions) && actions.length > 0) {
    parts.push(actions.slice(0, 2).join(" / "));
  }
  if (result) parts.push(result);
  const summary = parts.join(" / ");
  if (summary.length <= CHATGPT_ACTION_SUMMARY_MAX) return summary;
  return summary.slice(0, CHATGPT_ACTION_SUMMARY_MAX - 1) + "...";
}

function _validateChatgptActionSavePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Request body must be an object." };
  }

  let payloadChars = 0;
  try {
    payloadChars = JSON.stringify(input).length;
  } catch (_) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Request body must be JSON serializable." };
  }
  if (payloadChars > CHATGPT_ACTION_MAX_PAYLOAD_CHARS) {
    return { ok: false, status: 413, code: "PAYLOAD_TOO_LARGE", message: "Request payload must be under 100,000 characters." };
  }

  if (_chatgptHasRawTextField(input)) {
    return {
      ok: false,
      status: 400,
      code: "RAW_TEXT_NOT_ALLOWED",
      message: "Full raw conversation text must not be sent to PASSMAP.",
    };
  }

  if (input.userConfirmed !== true) {
    return {
      ok: false,
      status: 400,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "userConfirmed must be true before saving.",
    };
  }

  const sourcePlatform = _chatgptStr(input.sourcePlatform, 40) || CHATGPT_ACTION_SOURCE_PLATFORM;
  if (sourcePlatform !== CHATGPT_ACTION_SOURCE_PLATFORM) {
    return { ok: false, status: 400, code: "INVALID_SOURCE_PLATFORM", message: "sourcePlatform must be chatgpt." };
  }

  const importMethod = _chatgptStr(input.importMethod, 80) || CHATGPT_ACTION_IMPORT_METHOD;
  if (importMethod !== CHATGPT_ACTION_IMPORT_METHOD) {
    return { ok: false, status: 400, code: "INVALID_IMPORT_METHOD", message: "importMethod must be chatgpt_action_save_experience." };
  }

  const title = _chatgptStr(input.title, 160);
  if (title.length < 2) {
    return { ok: false, status: 400, code: "TITLE_TOO_SHORT", message: "title must be at least 2 characters." };
  }

  const situation = _chatgptStr(input.situation, 1200);
  const task = _chatgptStr(input.task, 1200);
  const actions = _chatgptStrArray(input.actions, { maxItems: 10, maxLength: 500 });
  const evidenceTexts = _chatgptStrArray(input.evidenceTexts, { maxItems: 8, maxLength: 600 });

  if (!situation && !task && actions.length === 0 && evidenceTexts.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_CORE_FIELD",
      message: "At least one of situation, task, actions, or evidenceTexts is required.",
    };
  }

  const workDate = _chatgptResolveWorkDate(input.occurredAt);

  return {
    ok: true,
    normalized: {
      sourcePlatform,
      importMethod,
      sourceConversationTitle: _chatgptNullableStr(input.sourceConversationTitle, 120),
      occurredAt: workDate.occurredAt,
      recordDate: workDate.recordDate,
      title,
      situation,
      task,
      actions,
      result: _chatgptNullableStr(input.result, 1200),
      skills: _chatgptStrArray(input.skills, { maxItems: 12, maxLength: 80 }),
      jobTags: _chatgptStrArray(input.jobTags, { maxItems: 12, maxLength: 80 }),
      industryTags: _chatgptStrArray(input.industryTags, { maxItems: 12, maxLength: 80 }),
      evidenceTexts,
      riskNotes: _chatgptStrArray(input.riskNotes, { maxItems: 8, maxLength: 300 }),
      privacyFlags: _chatgptStrArray(input.privacyFlags, { maxItems: 12, maxLength: 80 }),
      clientTraceId: _chatgptNullableStr(input.clientTraceId, 120),
    },
  };
}

async function handleChatgptActionSaveExperience(req, res) {
  if (req.method !== "POST") {
    return _chatgptActionError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return _chatgptActionError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured", true);
  }

  const accessToken = readBearerToken(req);
  let identity = await verifyChatgptOAuthAccessToken({ accessToken, supabase });
  if (!identity.ok) {
    // Internal smoke fallback only. Production ChatGPT Actions should use the
    // PASSMAP-issued ChatGPT OAuth token, not a Supabase user access token.
    identity = await verifySupabaseAccessToken({ accessToken, supabase });
  }
  if (!identity.ok) {
    return _chatgptActionError(
      res,
      identity.status || 401,
      "AUTH_REQUIRED",
      identity.message || "Authorization Bearer token required"
    );
  }
  const verifiedUserId = identity.userId;

  const body = await _mcpReadJsonBody(req);
  const validated = _validateChatgptActionSavePayload(body);
  if (!validated.ok) {
    return _chatgptActionError(res, validated.status || 400, validated.code, validated.message);
  }

  const n = validated.normalized;
  const summary = _chatgptBuildSummary({
    situation: n.situation,
    task: n.task,
    actions: n.actions,
    result: n.result,
  });
  const sourceLabel = n.sourceConversationTitle || "ChatGPT Action";
  const baseMetadata = {
    importMethod: CHATGPT_ACTION_IMPORT_METHOD,
    sourcePlatform: CHATGPT_ACTION_SOURCE_PLATFORM,
    sourceConversationTitle: n.sourceConversationTitle,
    occurredAt: n.occurredAt,
    recordDate: n.recordDate,
    clientTraceId: n.clientTraceId,
    privacyFlags: n.privacyFlags,
    actionSchemaVersion: CHATGPT_ACTION_SCHEMA_VERSION,
    rawTextStored: false,
  };

  let workRecordId;
  try {
    workRecordId = await createCompanionWorkRecordForAiExperience({
      supabase,
      userId: verifiedUserId,
      recordDate: n.recordDate,
      title: n.title,
      summary,
      situation: n.situation,
      task: n.task,
      actions: n.actions,
      result: n.result,
      skills: n.skills,
      jobTags: n.jobTags,
      industryTags: n.industryTags,
      evidenceTexts: n.evidenceTexts,
      sourcePlatform: CHATGPT_ACTION_SOURCE_PLATFORM,
      importMethod: CHATGPT_ACTION_IMPORT_METHOD,
      extraMetadata: {
        sourceConversationTitle: n.sourceConversationTitle,
        occurredAt: n.occurredAt,
        recordDate: n.recordDate,
        clientTraceId: n.clientTraceId,
        actionSchemaVersion: CHATGPT_ACTION_SCHEMA_VERSION,
      },
    });
  } catch (err) {
    console.error("[chatgpt-action] work_records insert failed:", err?.message || "unknown");
    return _chatgptActionError(res, 500, "SAVE_FAILED", "Could not save experience work record", true);
  }

  let rawSource;
  try {
    const { data, error } = await supabase
      .from("raw_sources")
      .insert({
        user_id: verifiedUserId,
        work_record_id: workRecordId,
        source_type: "chatgpt_action",
        source_label: sourceLabel,
        detected_period: n.recordDate,
        raw_text: null,
        file_url: null,
        file_name: null,
        mime_type: null,
        summary: summary || null,
        processing_status: "completed",
        metadata: baseMetadata,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error("[chatgpt-action] raw_sources insert failed:", error?.message || "unknown");
      return _chatgptActionError(res, 500, "SAVE_FAILED", "Could not save experience source", true);
    }
    rawSource = data;
  } catch (err) {
    console.error("[chatgpt-action] raw_sources unexpected:", err?.message || "unknown");
    return _chatgptActionError(res, 500, "SAVE_FAILED", "Could not save experience source", true);
  }

  let card;
  try {
    const { data, error } = await supabase
      .from("experience_cards")
      .insert({
        user_id: verifiedUserId,
        source_id: rawSource.id,
        work_record_id: workRecordId,
        title: n.title,
        situation: n.situation || null,
        task: n.task || null,
        actions: n.actions,
        result: n.result ? { candidate: n.result } : {},
        collaboration: {},
        skills: n.skills,
        job_tags: n.jobTags,
        industry_tags: n.industryTags,
        resume_potential: "medium",
        confidence_level: n.evidenceTexts.length > 0 ? "medium" : "low",
        suggested_resume_bullet: null,
        missing_info_questions: [],
        risk_notes: n.riskNotes,
        differ_reason: null,
        status: "accepted",
        metadata: {
          importMethod: CHATGPT_ACTION_IMPORT_METHOD,
          sourcePlatform: CHATGPT_ACTION_SOURCE_PLATFORM,
          sourceConversationTitle: n.sourceConversationTitle,
          occurredAt: n.occurredAt,
          recordDate: n.recordDate,
          clientTraceId: n.clientTraceId,
          actionSchemaVersion: CHATGPT_ACTION_SCHEMA_VERSION,
        },
      })
      .select("id, status")
      .single();
    if (error || !data?.id) {
      console.error("[chatgpt-action] experience_cards insert failed:", error?.message || "unknown");
      return _chatgptActionError(res, 500, "SAVE_FAILED", "Could not save experience card", true);
    }
    card = data;
  } catch (err) {
    console.error("[chatgpt-action] experience_cards unexpected:", err?.message || "unknown");
    return _chatgptActionError(res, 500, "SAVE_FAILED", "Could not save experience card", true);
  }

  if (n.evidenceTexts.length > 0) {
    try {
      const rows = n.evidenceTexts.map((evidenceText) => ({
        user_id: verifiedUserId,
        experience_card_id: card.id,
        source_id: rawSource.id,
        evidence_text: evidenceText,
        evidence_type: "chatgpt_action_snippet",
        source_offset_start: null,
        source_offset_end: null,
        metadata: {
          importMethod: CHATGPT_ACTION_IMPORT_METHOD,
          sourcePlatform: CHATGPT_ACTION_SOURCE_PLATFORM,
          clientTraceId: n.clientTraceId,
        },
      }));
      const { error } = await supabase.from("experience_evidence").insert(rows);
      if (error) {
        console.error("[chatgpt-action] evidence insert failed:", error.message);
      }
    } catch (err) {
      console.error("[chatgpt-action] evidence unexpected:", err?.message || "unknown");
    }
  }

  return res.status(200).json({
    ok: true,
    experienceCardId: card.id,
    workRecordId,
    status: card.status || "accepted",
    inboxUrl: _chatgptActionInboxUrl(),
    message: "PASSMAP AI Inbox에 저장되었습니다.",
  });
}

// ─── MCP pairing list / revoke (12-B5-A) ──────────────────────────────────
//
// Identity contract (both actions):
//   - Authorization: Bearer <Supabase access token> for the PASSMAP web
//     user who owns the pairing rows. MCP tokens are NOT accepted — a user
//     who has lost their token must still be able to revoke it.
//   - body.user_id / body.userId are ignored on purpose; the only trusted
//     user identifier is identity.userId from verifySupabaseAccessToken.
//   - Hashes (code_hash, token_hash) and plaintext secrets are never read
//     back to the client.

// Browser extension direct AI Inbox save.
//
// Accepts bounded ChatGPT message objects for transient server-side analysis.
// Full raw transcript fields are still rejected, and raw_sources.raw_text stays
// null. Only the extracted candidate, short evidence, and metadata persist.

const BROWSER_EXTENSION_IMPORT_METHODS = new Set([
  "browser_extension_current_conversation",
  "browser_extension_selection",
]);
const BROWSER_EXTENSION_SOURCE_PLATFORMS = new Set([
  "chatgpt",
  "claude",
  "gemini",
  "unknown",
]);
const BROWSER_EXTENSION_MAX_PAYLOAD_CHARS = CHATGPT_ACTION_MAX_PAYLOAD_CHARS;
const BROWSER_EXTENSION_INBOX_DEEPLINK = "/?utm_source=browser_extension&view=ai-inbox#ai-inbox";
const BROWSER_EXTENSION_MAX_MESSAGES = 12;
const BROWSER_EXTENSION_MAX_MESSAGE_CHARS = 6000;
const BROWSER_EXTENSION_MAX_TOTAL_MESSAGE_CHARS = 50000;
const BROWSER_EXTENSION_MESSAGE_ROLES = new Set(["user", "assistant", "system"]);

function _browserExtensionError(res, status, code, message, retryable = false) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    retryable,
  });
}

function _browserExtensionInboxUrl() {
  const base =
    _chatgptStr(process.env.PASSMAP_APP_BASE_URL, 2048) ||
    _chatgptStr(process.env.VITE_API_BASE, 2048) ||
    CHATGPT_ACTION_FALLBACK_APP_BASE_URL;
  return base.replace(/\/+$/, "") + BROWSER_EXTENSION_INBOX_DEEPLINK;
}

function _browserExtensionCaptureMode(value, importMethod) {
  const mode = _chatgptStr(value, 80).toLowerCase();
  if (mode === "current_conversation" || mode === "selection") return mode;
  return importMethod === "browser_extension_current_conversation"
    ? "current_conversation"
    : "selection";
}

function _browserExtensionMessageCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 1000);
}

function _browserExtensionHasForbiddenRawTextField(value, seen = new Set()) {
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => _browserExtensionHasForbiddenRawTextField(item, seen));
  }
  for (const key of Object.keys(value)) {
    const normalizedKey = String(key).toLowerCase();
    if (normalizedKey !== "messages" && CHATGPT_ACTION_RAW_TEXT_FIELDS.has(normalizedKey)) {
      return true;
    }
    if (_browserExtensionHasForbiddenRawTextField(value[key], seen)) {
      return true;
    }
  }
  return false;
}

function _browserExtensionMessages(value) {
  if (!Array.isArray(value)) return null;
  if (value.length === 0 || value.length > BROWSER_EXTENSION_MAX_MESSAGES) return null;
  let totalChars = 0;
  const messages = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const role = _chatgptStr(item.role, 20).toLowerCase();
    if (!BROWSER_EXTENSION_MESSAGE_ROLES.has(role)) return null;
    const text = _chatgptStr(item.text, BROWSER_EXTENSION_MAX_MESSAGE_CHARS);
    if (!text) return null;
    totalChars += text.length;
    if (totalChars > BROWSER_EXTENSION_MAX_TOTAL_MESSAGE_CHARS) return null;
    if (role === "user" || role === "assistant") {
      messages.push({ role, text });
    }
  }
  return messages.length > 0 ? messages : null;
}

function _validateBrowserExtensionSavePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Request body must be an object." };
  }

  let payloadChars = 0;
  try {
    payloadChars = JSON.stringify(input).length;
  } catch (_) {
    return { ok: false, status: 400, code: "INVALID_INPUT", message: "Request body must be JSON serializable." };
  }
  if (payloadChars > BROWSER_EXTENSION_MAX_PAYLOAD_CHARS) {
    return { ok: false, status: 413, code: "PAYLOAD_TOO_LARGE", message: "Request payload must be under 100,000 characters." };
  }

  if (_browserExtensionHasForbiddenRawTextField(input)) {
    return {
      ok: false,
      status: 400,
      code: "RAW_TEXT_NOT_ALLOWED",
      message: "Full raw conversation text must not be sent to PASSMAP.",
    };
  }

  if (input.userConfirmed !== true) {
    return {
      ok: false,
      status: 400,
      code: "USER_CONFIRMATION_REQUIRED",
      message: "userConfirmed must be true before saving.",
    };
  }

  const importMethod = _chatgptStr(input.importMethod, 80);
  if (!BROWSER_EXTENSION_IMPORT_METHODS.has(importMethod)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_IMPORT_METHOD",
      message: "importMethod must be browser_extension_current_conversation or browser_extension_selection.",
    };
  }

  const rawPlatform = _chatgptStr(input.sourcePlatform, 40).toLowerCase() || "unknown";
  const sourcePlatform = BROWSER_EXTENSION_SOURCE_PLATFORMS.has(rawPlatform)
    ? rawPlatform
    : "unknown";

  const messages = _browserExtensionMessages(input.messages);
  if (!messages) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_MESSAGES",
      message: "messages must include 1-12 bounded user/assistant messages.",
    };
  }

  const captureMode = _browserExtensionCaptureMode(input.captureMode, importMethod);

  return {
    ok: true,
    normalized: {
      importMethod,
      sourcePlatform,
      sourceConversationTitle: _chatgptNullableStr(input.sourceConversationTitle, 160),
      sourceUrl: _chatgptNullableStr(input.sourceUrl, 2048),
      sourceTitle: _chatgptNullableStr(input.sourceTitle, 240),
      captureMode,
      captureQuality: _chatgptNullableStr(input.captureQuality, 120),
      messageCount: _browserExtensionMessageCount(input.messageCount),
      clientTraceId: _chatgptNullableStr(input.clientTraceId, 120),
      messages,
    },
  };
}

async function handleBrowserExtensionSaveExperience(req, res) {
  if (req.method !== "POST") {
    return _browserExtensionError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return _browserExtensionError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured", true);
  }

  const accessToken = readBearerToken(req);
  let identity = await verifyMcpToken({ accessToken, supabase });
  if (!identity.ok) {
    identity = await verifySupabaseAccessToken({ accessToken, supabase });
  }
  if (!identity.ok) {
    return _browserExtensionError(
      res,
      identity.status || 401,
      "AUTH_REQUIRED",
      identity.message || "Authorization Bearer token required"
    );
  }
  const verifiedUserId = identity.userId;

  const body = await _mcpReadJsonBody(req);
  const validated = _validateBrowserExtensionSavePayload(body);
  if (!validated.ok) {
    return _browserExtensionError(res, validated.status || 400, validated.code, validated.message);
  }

  const n = validated.normalized;
  const extraction = await extractBrowserExtensionExperienceCandidate({
    messages: n.messages,
    source: {
      sourceTitle: n.sourceTitle,
      sourceUrl: n.sourceUrl,
      sourcePlatform: n.sourcePlatform,
    },
    openAIApiKey: process.env.OPENAI_API_KEY || "",
    openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  });
  const candidate = extraction.candidate;
  const summary = _chatgptBuildSummary({
    situation: candidate.situation,
    task: candidate.task,
    actions: candidate.actions,
    result: candidate.resultCandidate,
  });
  const sharedMetadata = {
    importMethod: n.importMethod,
    sourcePlatform: n.sourcePlatform,
    sourceConversationTitle: n.sourceConversationTitle,
    sourceUrl: n.sourceUrl,
    sourceTitle: n.sourceTitle,
    captureMode: n.captureMode,
    captureQuality: n.captureQuality,
    messageCount: n.messageCount,
    clientTraceId: n.clientTraceId,
    rawTextStored: false,
    analysisVersion: extraction.analysisVersion || BROWSER_EXTENSION_ANALYSIS_VERSION,
    analysisMethod: candidate.analysisMethod || null,
    analysisUsedAi: extraction.usedAi === true,
  };

  let workRecordId;
  try {
    workRecordId = await createCompanionWorkRecordForAiExperience({
      supabase,
      userId: verifiedUserId,
      recordDate: null,
      title: candidate.title,
      summary,
      situation: candidate.situation,
      task: candidate.task,
      actions: candidate.actions,
      result: candidate.resultCandidate,
      skills: candidate.skills,
      jobTags: candidate.jobTags,
      industryTags: candidate.industryTags,
      evidenceTexts: candidate.evidenceTexts,
      suggestedResumeBullet: candidate.suggestedResumeBullet,
      sourcePlatform: n.sourcePlatform,
      importMethod: n.importMethod,
      extraMetadata: sharedMetadata,
    });
  } catch (err) {
    console.error("[browser-extension] work_records insert failed:", err?.message || "unknown");
    return _browserExtensionError(res, 500, "SAVE_FAILED", "Could not save experience work record", true);
  }

  let rawSource;
  try {
    const { data, error } = await supabase
      .from("raw_sources")
      .insert({
        user_id: verifiedUserId,
        work_record_id: workRecordId,
        source_type: "browser_extension_ai_capture",
        source_label: n.sourceTitle || n.sourceConversationTitle || "Browser extension AI capture",
        detected_period: null,
        raw_text: null,
        file_url: null,
        file_name: null,
        mime_type: null,
        summary: summary || null,
        processing_status: "completed",
        metadata: sharedMetadata,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error("[browser-extension] raw_sources insert failed:", error?.message || "unknown");
      return _browserExtensionError(res, 500, "SAVE_FAILED", "Could not save experience source", true);
    }
    rawSource = data;
  } catch (err) {
    console.error("[browser-extension] raw_sources unexpected:", err?.message || "unknown");
    return _browserExtensionError(res, 500, "SAVE_FAILED", "Could not save experience source", true);
  }

  let card;
  try {
    const { data, error } = await supabase
      .from("experience_cards")
      .insert({
        user_id: verifiedUserId,
        source_id: rawSource.id,
        work_record_id: workRecordId,
        title: candidate.title,
        situation: candidate.situation || null,
        task: candidate.task || null,
        actions: candidate.actions,
        result: candidate.resultCandidate ? { candidate: candidate.resultCandidate } : {},
        collaboration: {},
        skills: candidate.skills,
        job_tags: candidate.jobTags,
        industry_tags: candidate.industryTags,
        resume_potential: candidate.resumePotential || "medium",
        confidence_level: candidate.confidenceLevel || "low",
        suggested_resume_bullet: candidate.suggestedResumeBullet || null,
        missing_info_questions: candidate.missingInfoQuestions,
        risk_notes: candidate.riskNotes,
        differ_reason: null,
        status: "accepted",
        metadata: sharedMetadata,
      })
      .select("id, status")
      .single();
    if (error || !data?.id) {
      console.error("[browser-extension] experience_cards insert failed:", error?.message || "unknown");
      return _browserExtensionError(res, 500, "SAVE_FAILED", "Could not save experience card", true);
    }
    card = data;
  } catch (err) {
    console.error("[browser-extension] experience_cards unexpected:", err?.message || "unknown");
    return _browserExtensionError(res, 500, "SAVE_FAILED", "Could not save experience card", true);
  }

  if (candidate.evidenceTexts.length > 0) {
    try {
      const rows = candidate.evidenceTexts.map((evidenceText) => ({
        user_id: verifiedUserId,
        experience_card_id: card.id,
        source_id: rawSource.id,
        evidence_text: evidenceText,
        evidence_type: "browser_extension_snippet",
        source_offset_start: null,
        source_offset_end: null,
        metadata: {
          importMethod: n.importMethod,
          sourcePlatform: n.sourcePlatform,
          clientTraceId: n.clientTraceId,
        },
      }));
      const { error } = await supabase.from("experience_evidence").insert(rows);
      if (error) {
        console.error("[browser-extension] evidence insert failed:", error.message);
      }
    } catch (err) {
      console.error("[browser-extension] evidence unexpected:", err?.message || "unknown");
    }
  }

  return res.status(200).json({
    ok: true,
    experienceCardId: card.id,
    workRecordId,
    status: card.status || "accepted",
    inboxUrl: _browserExtensionInboxUrl(),
    message: "PASSMAP AI Inbox에 저장되었습니다.",
  });
}

const _MCP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function _mcpPairingStatus(row, nowMs) {
  if (row?.revoked_at) return "revoked";
  const tokenExpMs = row?.token_expires_at ? new Date(row.token_expires_at).getTime() : null;
  if (tokenExpMs !== null && Number.isFinite(tokenExpMs) && tokenExpMs < nowMs) return "expired";
  if (row?.consumed_at) return "active";
  const codeExpMs = row?.code_expires_at ? new Date(row.code_expires_at).getTime() : null;
  if (codeExpMs !== null && Number.isFinite(codeExpMs) && codeExpMs > nowMs) return "pending";
  return "inactive";
}

async function handleMcpPairingList(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
  }

  const accessToken = readBearerToken(req);
  const identity = await verifySupabaseAccessToken({ accessToken, supabase });
  if (!identity.ok) {
    return jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message);
  }
  const verifiedUserId = identity.userId;

  let rows;
  try {
    // NOTE: code_hash / token_hash are deliberately NOT selected — they
    // must never appear in the response, even by accident.
    const { data, error } = await supabase
      .from("user_mcp_pairings")
      .select(
        "id, client_name, created_at, consumed_at, last_used_at, " +
          "revoked_at, token_expires_at, code_expires_at"
      )
      .eq("user_id", verifiedUserId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[mcp] pairing_list select failed:", error.message);
      return jsonError(res, 500, "LIST_FAILED", "Could not list pairings");
    }
    rows = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[mcp] pairing_list unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "LIST_FAILED", "Could not list pairings");
  }

  const nowMs = Date.now();
  const items = rows.map((row) => ({
    id: row.id,
    clientName: row.client_name || null,
    status: _mcpPairingStatus(row, nowMs),
    createdAt: row.created_at || null,
    connectedAt: row.consumed_at || null,
    lastUsedAt: row.last_used_at || null,
    tokenExpiresAt: row.token_expires_at || null,
    revokedAt: row.revoked_at || null,
    codeExpiresAt: row.code_expires_at || null,
  }));

  return res.status(200).json({ ok: true, items });
}

async function handleMcpPairingRevoke(req, res) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = getServiceRoleClient();
  if (!supabase) {
    return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
  }

  const accessToken = readBearerToken(req);
  const identity = await verifySupabaseAccessToken({ accessToken, supabase });
  if (!identity.ok) {
    return jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message);
  }
  const verifiedUserId = identity.userId;

  const body = await _mcpReadJsonBody(req);
  // body.user_id / body.userId are intentionally NOT read — trusted user
  // id comes only from the verified Supabase token above.
  const pairingId = _mcpStr(body?.pairingId);
  if (!pairingId || !_MCP_UUID_RE.test(pairingId)) {
    return jsonError(res, 400, "INVALID_PAIRING_ID", "pairingId must be a UUID string");
  }

  // 1. Ownership check. Forces the row to belong to verifiedUserId before
  //    any mutation runs — protects against IDOR.
  let existing;
  try {
    const { data, error } = await supabase
      .from("user_mcp_pairings")
      .select("id, revoked_at")
      .eq("id", pairingId)
      .eq("user_id", verifiedUserId)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[mcp] pairing_revoke lookup failed:", error.message);
      return jsonError(res, 500, "REVOKE_FAILED", "Could not revoke pairing");
    }
    existing = data;
  } catch (err) {
    console.error("[mcp] pairing_revoke lookup unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "REVOKE_FAILED", "Could not revoke pairing");
  }

  if (!existing) {
    return jsonError(res, 404, "PAIRING_NOT_FOUND", "Pairing not found for the current user");
  }

  // 2. Idempotent: if already revoked, do not overwrite the original
  //    revoked_at — just confirm ok.
  if (existing.revoked_at) {
    return res.status(200).json({
      ok: true,
      revoked: true,
      pairingId,
      alreadyRevoked: true,
    });
  }

  // 3. Soft-revoke and clear ALL hashes / expiries so the token (and any
  //    still-pending code) can never authenticate again. Constrained by
  //    id + user_id so a stale request cannot affect another user's row.
  try {
    const { error } = await supabase
      .from("user_mcp_pairings")
      .update({
        revoked_at: new Date().toISOString(),
        code_hash: null,
        code_expires_at: null,
        token_hash: null,
        token_expires_at: null,
      })
      .eq("id", pairingId)
      .eq("user_id", verifiedUserId);
    if (error) {
      console.error("[mcp] pairing_revoke update failed:", error.message);
      return jsonError(res, 500, "REVOKE_FAILED", "Could not revoke pairing");
    }
  } catch (err) {
    console.error("[mcp] pairing_revoke update unexpected:", err?.message || "unknown");
    return jsonError(res, 500, "REVOKE_FAILED", "Could not revoke pairing");
  }

  return res.status(200).json({ ok: true, revoked: true, pairingId });
}

// GitHub App connection skeleton actions.

const GITHUB_CONNECTION_STATUS_SKELETON = Object.freeze({
  connected: false,
  status: "not_connected",
  provider: "github",
  connection_type: "github_app",
  github_login: null,
  installation_id: null,
  repositories_selected: 0,
  last_checked_at: null,
});

const GITHUB_CONNECTION_TABLES_UNAVAILABLE_WARNING = Object.freeze({
  code: "github_connection_tables_unavailable",
  message: "GitHub connection tables are not available in this environment.",
});

const GITHUB_CONNECTION_STATE_UNAVAILABLE_WARNING = Object.freeze({
  code: "github_connection_state_unavailable",
  message: "GitHub connection state storage is not available in this environment.",
});

const GITHUB_CONNECTION_FORBIDDEN_REQUEST_KEYS = Object.freeze([
  ...GITHUB_TOKEN_FORBIDDEN_KEYS,
  ...GITHUB_RAW_PAYLOAD_FORBIDDEN_KEYS,
]);
const GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

function getGithubRepositorySnapshotPayload(req) {
  return req.body?.repository || req.body?.payload?.repository || req.body?.payload || req.body || {};
}

function getGithubConnectionCallbackPayload(req) {
  return req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : req.body || {};
}

function readGithubOAuthPublicConfig(env = process.env) {
  const clientId = typeof env?.GITHUB_CLIENT_ID === "string" ? env.GITHUB_CLIENT_ID.trim() : "";
  const redirectUri = typeof env?.GITHUB_APP_CALLBACK_URL === "string" ? env.GITHUB_APP_CALLBACK_URL.trim() : "";
  if (!clientId) return { configured: false };
  return {
    configured: true,
    clientId,
    redirectUri: redirectUri || null,
  };
}

function buildGithubOAuthAuthorizationUrl({ state, env = process.env } = {}) {
  const rawState = typeof state === "string" ? state.trim() : "";
  const config = readGithubOAuthPublicConfig(env);
  if (!config.configured || !rawState) return null;
  const url = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", rawState);
  if (config.redirectUri) url.searchParams.set("redirect_uri", config.redirectUri);
  return url.toString();
}

async function verifyAndPersistGithubInstallationConnectionFromAccessibleInstallations({
  supabase,
  userId,
  code,
  env = process.env,
  fetchFn = globalThis.fetch,
  now = Date.now,
} = {}) {
  const config = readGithubOAuthConfig(env);
  if (!config.configured) return { ok: false, code: "github_oauth_config_missing" };

  const tokenResult = await exchangeGithubOAuthCodeForUserToken({ code, config, fetchFn });
  if (!tokenResult.ok) return { ok: false, code: tokenResult.code || "github_user_token_exchange_failed" };

  const installationResult = await readGithubUserInstallations({
    accessToken: tokenResult.accessToken,
    fetchFn,
  });
  if (!installationResult.ok) {
    return { ok: false, code: installationResult.code || "github_installation_verification_unavailable" };
  }

  const installations = Array.isArray(installationResult.installations) ? installationResult.installations : [];
  if (installations.length === 0) return { ok: false, code: "github_installation_not_accessible" };
  if (installations.length > 1) return { ok: false, code: "github_installation_id_required" };

  let record;
  try {
    record = buildVerifiedGithubConnectionRecord({ userId, installation: installations[0], now });
  } catch {
    return { ok: false, code: "github_installation_verification_unavailable" };
  }

  const persistResult = await persistVerifiedGithubConnection({ supabase, record });
  if (!persistResult.ok) return { ok: false, code: "github_connection_persistence_unavailable" };

  return {
    ok: true,
    github_login: record.github_login,
    installation_id: record.installation_id,
    persistence: persistResult.action,
    inferred_installation_id: true,
  };
}

function buildGithubConnectionCallbackUnavailableResponse() {
  return {
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
    warning: { ...GITHUB_CONNECTION_STATE_UNAVAILABLE_WARNING },
  };
}

function buildGithubConnectionVerificationWarningResponse({
  code,
  message,
  nextAction,
  returnTo = null,
  installationIdReceived = false,
} = {}) {
  return {
    ok: false,
    callback: {
      provider: "github",
      connection_type: "github_app",
      state_valid: true,
      state_consumed: true,
      connected: false,
      installation_verified: false,
      installation_id_received: installationIdReceived === true,
      callback_ready: false,
      next_action: nextAction,
      return_to: returnTo || null,
    },
    warning: { code, message },
  };
}

function buildGithubConnectionVerifiedResponse({
  returnTo = null,
  githubLogin = null,
  installationIdReceived = false,
} = {}) {
  return {
    ok: true,
    callback: {
      provider: "github",
      connection_type: "github_app",
      state_valid: true,
      state_consumed: true,
      connected: true,
      installation_verified: true,
      github_login: typeof githubLogin === "string" ? githubLogin : null,
      installation_id_received: installationIdReceived === true,
      repositories_selected: 0,
      next_action: "select_github_repositories",
      return_to: returnTo || null,
    },
  };
}

function findForbiddenGithubConnectionRequestKey(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenGithubConnectionRequestKey(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value)) {
    if (GITHUB_CONNECTION_FORBIDDEN_REQUEST_KEYS.includes(key.toLowerCase())) {
      return key;
    }
    const found = findForbiddenGithubConnectionRequestKey(child);
    if (found) return found;
  }
  return null;
}

async function verifyGithubConnectionUser(req, res, deps = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
    return null;
  }

  const accessToken = readBearerToken(req);
  if (!accessToken) {
    jsonError(res, 401, "AUTH_REQUIRED", "Authorization Bearer token required");
    return null;
  }

  const supabase = deps.supabase || getServiceRoleClient();
  if (!supabase) {
    jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");
    return null;
  }

  const verifyAccessToken = deps.verifyAccessToken || verifySupabaseAccessToken;
  const identity = await verifyAccessToken({ accessToken, supabase });
  if (!identity.ok) {
    jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message || "Invalid or expired Supabase token");
    return null;
  }

  return { userId: identity.userId, supabase };
}

function normalizeGithubConnectionStatusTimestamp(row = {}) {
  return row.last_checked_at || row.updated_at || row.connected_at || null;
}

function normalizeGithubInstallationId(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (Number.isSafeInteger(numeric) && String(numeric) === String(value)) return numeric;
  return String(value);
}

export function buildGithubConnectionStatusResponse({ connection = null, repositoriesSelected = 0, unavailable = false } = {}) {
  if (unavailable) {
    return {
      ok: true,
      connection: {
        ...GITHUB_CONNECTION_STATUS_SKELETON,
        status: "unavailable",
      },
      warning: { ...GITHUB_CONNECTION_TABLES_UNAVAILABLE_WARNING },
    };
  }

  if (connection) {
    return {
      ok: true,
      connection: {
        connected: true,
        status: "connected",
        provider: "github",
        connection_type: "github_app",
        github_login: typeof connection.github_login === "string" ? connection.github_login : null,
        installation_id: normalizeGithubInstallationId(connection.installation_id),
        repositories_selected: Number.isFinite(Number(repositoriesSelected)) ? Number(repositoriesSelected) : 0,
        last_checked_at: normalizeGithubConnectionStatusTimestamp(connection),
      },
    };
  }

  return {
    ok: true,
    connection: { ...GITHUB_CONNECTION_STATUS_SKELETON },
  };
}

export async function readGithubConnectionStatus({ supabase, userId }) {
  try {
    const { data: connection, error } = await supabase
      .from("github_connections")
      .select("id, github_login, installation_id, connection_type, status, connected_at, last_checked_at, updated_at")
      .eq("user_id", userId)
      .eq("connection_type", "github_app")
      .eq("status", "connected")
      .order("connected_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[github-connection-status] connection read unavailable:", error.code || error.message || "unknown");
      return { unavailable: true };
    }

    if (!connection?.id) return { connection: null, repositoriesSelected: 0 };

    const { count, error: countError } = await supabase
      .from("github_repository_access")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("connection_id", connection.id)
      .eq("selected", true);

    if (countError) {
      console.error("[github-connection-status] repository count unavailable:", countError.code || countError.message || "unknown");
      return { unavailable: true };
    }

    return {
      connection,
      repositoriesSelected: Number.isFinite(Number(count)) ? Number(count) : 0,
    };
  } catch (err) {
    console.error("[github-connection-status] read unexpected:", err?.message || "unknown");
    return { unavailable: true };
  }
}

export function buildGithubConnectionPrepareResponse(config = readGithubAppPublicConfig(), stateResult = null) {
  const configured = config?.configured === true;
  const invalid = config?.reason === "github_app_invalid_config";
  const stateUnavailable = configured && stateResult && stateResult.ok !== true;
  if (stateUnavailable) {
    return {
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
      warning: { ...GITHUB_CONNECTION_STATE_UNAVAILABLE_WARNING },
    };
  }

  if (configured && stateResult?.ok === true) {
    return {
      ok: true,
      connect: {
        provider: "github",
        connection_type: "github_app",
        configured: true,
        ready: true,
        reason: "github_connection_state_created",
        next_action: "open_github_installation_url",
        installation_url: config.installation_url || null,
        authorization_url: buildGithubOAuthAuthorizationUrl({ state: stateResult.state }),
        state: stateResult.state || null,
        state_expires_at: stateResult.expires_at || null,
        state_required: true,
        callback_ready: false,
        callback_action: "github_connection_callback_stub",
      },
    };
  }

  const reason = configured
    ? "github_connection_state_not_implemented"
    : invalid
      ? "github_app_invalid_config"
      : "github_app_not_configured";
  const nextAction = configured
    ? "implement_github_connection_state"
    : invalid
      ? "fix_github_app_config"
      : "configure_github_app";

  return {
    ok: true,
    connect: {
      provider: "github",
      connection_type: "github_app",
      configured,
      ready: false,
      reason,
      next_action: nextAction,
      installation_url: configured ? config.installation_url || null : null,
      authorization_url: null,
      state_required: true,
    },
  };
}

export function buildGithubConnectionCallbackStubResponse() {
  return {
    ok: false,
    error: {
      code: "github_callback_not_implemented",
      message: "GitHub App callback is not implemented yet.",
    },
  };
}

export function buildGithubRepositoryAccessPreviewResponse(snapshot) {
  const validation = validateGithubRepositoryAccessSnapshot(snapshot);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: {
        code: validation.error?.code || "INVALID_REPOSITORY_ACCESS_SNAPSHOT",
        message: "Repository access snapshot is invalid.",
      },
    };
  }

  return {
    ok: true,
    repository: normalizeGithubRepository(snapshot),
  };
}

function buildGithubRepositoryAccessWarningResponse({ code, message, nextAction } = {}) {
  return {
    ok: true,
    repositories: [],
    next_action: nextAction,
    warning: { code, message },
  };
}

export async function handleGithubConnectionStatus(req, res, deps = {}) {
  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  const readStatus = deps.readStatus || readGithubConnectionStatus;
  const status = await readStatus({
    supabase: identity.supabase,
    userId: identity.userId,
  });
  return res.status(200).json(buildGithubConnectionStatusResponse(status));
}

export async function handleGithubConnectionPrepare(req, res, deps = {}) {
  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  const readConfig = deps.readConfig || readGithubAppPublicConfig;
  const config = readConfig();
  let stateResult = null;
  if (config?.configured === true) {
    const createState = deps.createState || createGithubConnectionState;
    stateResult = await createState({
      supabase: identity.supabase,
      userId: identity.userId,
      returnTo: req.body?.return_to ?? req.body?.returnTo ?? null,
    });
    if (stateResult?.ok !== true) {
      console.error("[github-connection-prepare] state storage unavailable:", stateResult?.error?.code || stateResult?.error?.message || "unknown");
    }
  }

  return res.status(200).json(buildGithubConnectionPrepareResponse(config, stateResult));
}

export async function handleGithubConnectionCallbackStub(req, res, deps = {}) {
  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  if (findForbiddenGithubConnectionRequestKey(req.body)) {
    return jsonError(res, 400, "FORBIDDEN_STORAGE_KEY", "GitHub connection callback payload is invalid.");
  }

  const payload = getGithubConnectionCallbackPayload(req);
  const rawState = payload?.state;
  if (typeof rawState !== "string" || rawState.trim() === "") {
    return jsonError(res, 400, "github_connection_state_required", "GitHub connection state is required.");
  }

  const validateState = deps.validateState || buildGithubConnectionStateValidationResult;
  const validation = await validateState({
    supabase: identity.supabase,
    userId: identity.userId,
    state: rawState,
  });

  if (!validation.ok) {
    if (validation.code === "github_connection_state_unavailable") {
      return res.status(200).json(buildGithubConnectionCallbackUnavailableResponse());
    }
    if (validation.code === "github_connection_state_expired") {
      return jsonError(res, 400, "github_connection_state_expired", "GitHub connection state has expired. Please start again.");
    }
    if (validation.code === "github_connection_state_not_pending") {
      return jsonError(res, 400, "github_connection_state_not_pending", "GitHub connection state is no longer pending. Please start again.");
    }
    return jsonError(res, 400, "github_connection_state_invalid", "GitHub connection state is invalid.");
  }

  const rawCode = payload?.code;
  if (typeof rawCode !== "string" || rawCode.trim() === "") {
    return jsonError(res, 400, "github_oauth_code_required", "GitHub OAuth code is required.");
  }
  const code = normalizeGithubOAuthCodeForCallback(rawCode);
  if (!code) {
    return jsonError(res, 400, "github_oauth_code_invalid", "GitHub OAuth code is invalid.");
  }

  const rawInstallationId = payload?.installation_id;
  const hasInstallationId = typeof rawInstallationId === "string" && rawInstallationId.trim() !== "";
  const installationId = hasInstallationId ? normalizeGithubInstallationIdForCallback(rawInstallationId) : null;
  if (hasInstallationId && !installationId) {
    return jsonError(res, 400, "github_installation_id_invalid", "GitHub installation id is invalid.");
  }

  const verifyInstallation = deps.verifyInstallation || verifyAndPersistGithubInstallationConnection;
  const inferInstallation = deps.inferInstallation || verifyAndPersistGithubInstallationConnectionFromAccessibleInstallations;
  const verification = installationId
    ? await verifyInstallation({
      supabase: identity.supabase,
      userId: identity.userId,
      code,
      installationId,
    })
    : await inferInstallation({
      supabase: identity.supabase,
      userId: identity.userId,
      code,
    });

  if (!verification.ok) {
    if (verification.code === "github_oauth_config_missing") {
      return res.status(200).json(buildGithubConnectionVerificationWarningResponse({
        code: "github_oauth_config_missing",
        message: "GitHub OAuth configuration is missing.",
        nextAction: "configure_github_oauth_credentials",
        returnTo: validation.return_to,
        installationIdReceived: Boolean(installationId),
      }));
    }
    if (verification.code === "github_installation_verification_unavailable") {
      return res.status(200).json(buildGithubConnectionVerificationWarningResponse({
        code: "github_installation_verification_unavailable",
        message: "GitHub installation verification is unavailable.",
        nextAction: "retry_github_installation_verification",
        returnTo: validation.return_to,
        installationIdReceived: Boolean(installationId),
      }));
    }
    if (verification.code === "github_connection_persistence_unavailable") {
      return res.status(200).json(buildGithubConnectionVerificationWarningResponse({
        code: "github_connection_persistence_unavailable",
        message: "GitHub connection metadata could not be saved.",
        nextAction: "retry_github_connection_persistence",
        returnTo: validation.return_to,
        installationIdReceived: Boolean(installationId),
      }));
    }
    if (verification.code === "github_installation_id_required") {
      return res.status(200).json(buildGithubConnectionVerificationWarningResponse({
        code: "github_installation_id_required",
        message: "More than one GitHub App installation is available.",
        nextAction: "retry_github_connection_with_installation_id",
        returnTo: validation.return_to,
        installationIdReceived: false,
      }));
    }
    if (verification.code === "github_installation_not_accessible") {
      return jsonError(res, 400, "github_installation_not_accessible", "GitHub installation is not accessible to this user.");
    }
    return jsonError(res, 400, "github_user_token_exchange_failed", "GitHub user token exchange failed.");
  }

  return res.status(200).json(buildGithubConnectionVerifiedResponse({
    returnTo: validation.return_to,
    githubLogin: verification.github_login,
    installationIdReceived: Boolean(installationId),
  }));
}

export async function handleGithubRepositoryAccessPreview(req, res, deps = {}) {
  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  if (findForbiddenGithubConnectionRequestKey(req.body)) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "FORBIDDEN_STORAGE_KEY",
        message: "Repository access snapshot is invalid.",
      },
    });
  }

  const response = buildGithubRepositoryAccessPreviewResponse(getGithubRepositorySnapshotPayload(req));
  if (!response.ok) {
    return res.status(response.status || 400).json({ ok: false, error: response.error });
  }
  return res.status(200).json(response);
}

export async function handleGithubRepositoryAccessList(req, res, deps = {}) {
  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  const readConnection = deps.readConnection || readConnectedGithubConnectionForUser;
  const connectionResult = await readConnection({
    supabase: identity.supabase,
    userId: identity.userId,
  });

  if (!connectionResult.ok) {
    return res.status(200).json(buildGithubRepositoryAccessWarningResponse({
      code: "github_connection_unavailable",
      message: "GitHub connection metadata is unavailable.",
      nextAction: "retry_github_connection_status",
    }));
  }

  const connection = connectionResult.connection;
  if (!connection?.id || !connection?.installation_id) {
    return res.status(200).json(buildGithubRepositoryAccessWarningResponse({
      code: "github_connection_not_connected",
      message: "GitHub App connection is not connected.",
      nextAction: "connect_github_app",
    }));
  }

  const createInstallationToken = deps.createInstallationToken || createGithubInstallationAccessToken;
  const tokenResult = await createInstallationToken({ installationId: String(connection.installation_id) });
  if (!tokenResult.ok) {
    const missing = tokenResult.code === "github_app_private_config_missing";
    return res.status(200).json(buildGithubRepositoryAccessWarningResponse({
      code: missing ? "github_app_private_config_missing" : "github_installation_token_unavailable",
      message: missing
        ? "GitHub App private configuration is missing."
        : "GitHub installation access token is unavailable.",
      nextAction: missing ? "configure_github_app_private_credentials" : "retry_github_repository_access_list",
    }));
  }

  const fetchRepositories = deps.fetchRepositories || fetchGithubInstallationRepositories;
  const fetchResult = await fetchRepositories({ installationToken: tokenResult.token });
  if (!fetchResult.ok) {
    return res.status(200).json(buildGithubRepositoryAccessWarningResponse({
      code: "github_repository_list_unavailable",
      message: "GitHub repositories are unavailable.",
      nextAction: "retry_github_repository_access_list",
    }));
  }

  const readRows = deps.readRepositoryRows || readGithubRepositoryAccessRows;
  const existingResult = await readRows({
    supabase: identity.supabase,
    userId: identity.userId,
    connectionId: connection.id,
  });
  if (!existingResult.ok) {
    return res.status(200).json(buildGithubRepositoryAccessWarningResponse({
      code: "github_repository_access_unavailable",
      message: "GitHub repository access storage is unavailable.",
      nextAction: "retry_github_repository_access_list",
    }));
  }

  const persistSnapshots = deps.persistSnapshots || persistGithubRepositoryAccessSnapshots;
  const persistResult = await persistSnapshots({
    supabase: identity.supabase,
    userId: identity.userId,
    connectionId: connection.id,
    repositories: fetchResult.repositories,
    existingRows: existingResult.rows,
  });
  if (!persistResult.ok) {
    return res.status(200).json(buildGithubRepositoryAccessWarningResponse({
      code: "github_repository_access_unavailable",
      message: "GitHub repository access storage is unavailable.",
      nextAction: "retry_github_repository_access_list",
    }));
  }

  return res.status(200).json(buildGithubRepositoryAccessListResponse({ rows: persistResult.rows }));
}

export async function handleGithubRepositoryAccessSelect(req, res, deps = {}) {
  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  if (findForbiddenGithubConnectionRequestKey(req.body)) {
    return jsonError(res, 400, "FORBIDDEN_STORAGE_KEY", "GitHub repository selection payload is invalid.");
  }

  const selection = normalizeGithubRepositorySelectionPayload(req.body || {});
  if (!selection.ok) {
    return jsonError(res, 400, selection.code, "GitHub repository selection payload is invalid.");
  }

  const readConnection = deps.readConnection || readConnectedGithubConnectionForUser;
  const connectionResult = await readConnection({
    supabase: identity.supabase,
    userId: identity.userId,
  });
  if (!connectionResult.ok || !connectionResult.connection?.id) {
    return jsonError(res, 400, "github_connection_not_connected", "GitHub App connection is not connected.");
  }

  const readRows = deps.readRepositoryRows || readGithubRepositoryAccessRows;
  const rowsResult = await readRows({
    supabase: identity.supabase,
    userId: identity.userId,
    connectionId: connectionResult.connection.id,
  });
  if (!rowsResult.ok) {
    return jsonError(res, 400, "github_repository_access_unavailable", "GitHub repository access storage is unavailable.");
  }

  const updateSelection = deps.updateSelection || updateGithubRepositorySelection;
  const updateResult = await updateSelection({
    supabase: identity.supabase,
    userId: identity.userId,
    connectionId: connectionResult.connection.id,
    selectedRepoIds: selection.selectedRepoIds,
    existingRows: rowsResult.rows,
  });
  if (!updateResult.ok) {
    return jsonError(
      res,
      400,
      updateResult.code || "github_repository_access_unavailable",
      "GitHub repository selection could not be saved."
    );
  }

  return res.status(200).json(buildGithubRepositorySelectionResponse({
    selectedRows: updateResult.selectedRows,
  }));
}

// GitHub PR candidate preview action.

const GITHUB_PR_CANDIDATE_IMPORT_METHOD = "github_pr_career_candidate_preview";
const GITHUB_PR_CANDIDATE_DEFAULT_STATUS = "accepted";

function asString(value, max = 400) {
  if (typeof value !== "string") return "";
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max - 3) + "..." : trimmed;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mapResumePotential(contract) {
  const impact = contract?.career_asset_candidate?.impact_level;
  if (impact === "high") return "high";
  if (impact === "focused") return "medium";
  return "medium";
}

function mapConfidenceLevel(contract) {
  const fileCount = Number(contract?.work_signal?.stats?.changed_file_count || 0);
  const additions = Number(contract?.work_signal?.stats?.additions || 0);
  if (fileCount >= 3 || additions >= 120) return "medium";
  return "low";
}

export function buildGithubPrPersistenceRows({ userId, contract }) {
  const verifiedUserId = asString(userId, 80);
  if (!verifiedUserId) throw new Error("userId is required");
  if (!contract?.dedupe_key) throw new Error("contract.dedupe_key is required");

  const workSignal = contract.work_signal || {};
  const asset = contract.career_asset_candidate || {};
  const trace = contract.trace || {};
  const stats = workSignal.stats || {};
  const safeTitle = asString(asset.title || workSignal.title || "GitHub PR career candidate", 180);
  const safeSummary = asString(asset.evidence_summary || workSignal.summary, 500);
  const suggestedResumeBullet = asString(asArray(contract.resume_bullet_candidates)[0], 600) || null;
  const changedFiles = asArray(workSignal.changed_files).slice(0, 20);
  const evidenceTexts = [
    asString(workSignal.title ? `PR title: ${workSignal.title}` : "", 300),
    asString(
      changedFiles.length > 0
        ? `Changed files: ${changedFiles.map((file) => `${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`).join("; ")}`
        : "",
      900
    ),
    asString(`PR stats: ${Number(stats.changed_file_count || 0)} files, +${Number(stats.additions || 0)}/-${Number(stats.deletions || 0)}`, 160),
  ].filter(Boolean);

  const baseMetadata = {
    importMethod: GITHUB_PR_CANDIDATE_IMPORT_METHOD,
    sourceType: GITHUB_PR_SOURCE_TYPE,
    dedupe_key: contract.dedupe_key,
    recommended_action: contract.recommended_action,
    trace,
    rawTextStored: false,
    fullDiffStored: false,
  };

  return {
    rawSource: {
      user_id: verifiedUserId,
      work_record_id: null,
      source_type: GITHUB_PR_SOURCE_TYPE,
      source_label: `GitHub PR #${trace.pr_number || 0}: ${safeTitle}`,
      detected_period: trace.merged_at || null,
      raw_text: null,
      file_url: null,
      file_name: null,
      mime_type: null,
      summary: safeSummary || null,
      processing_status: "processed",
      metadata: { ...baseMetadata, pr_url: trace.pr_url || null, stats, changed_files: changedFiles },
    },
    card: {
      user_id: verifiedUserId,
      source_id: null,
      work_record_id: null,
      title: safeTitle,
      situation: safeSummary || null,
      task: asset.contribution_scope ? `Review ${asset.contribution_scope.replace(/_/g, " ")} contribution as a career asset candidate.` : null,
      actions: changedFiles.map((file) => `${file.status || "modified"} ${file.filename}`).slice(0, 10),
      result: { summary: safeSummary || null, stats },
      collaboration: [],
      skills: [workSignal.type].filter(Boolean),
      job_tags: ["software_engineering"],
      industry_tags: [],
      resume_potential: mapResumePotential(contract),
      confidence_level: mapConfidenceLevel(contract),
      suggested_resume_bullet: suggestedResumeBullet,
      missing_info_questions: [],
      risk_notes: [],
      differ_reason: null,
      status: GITHUB_PR_CANDIDATE_DEFAULT_STATUS,
      metadata: { ...baseMetadata, work_signal: workSignal, career_asset_candidate: asset },
    },
    evidence: evidenceTexts.map((evidenceText, evidenceIndex) => ({
      user_id: verifiedUserId,
      experience_card_id: null,
      source_id: null,
      evidence_text: evidenceText,
      evidence_type: "github_pr_metadata",
      source_offset_start: null,
      source_offset_end: null,
      metadata: { importMethod: GITHUB_PR_CANDIDATE_IMPORT_METHOD, dedupe_key: contract.dedupe_key, evidenceIndex },
    })),
  };
}

export function findExistingGithubPrCandidate(rows = []) {
  const normalized = asArray(rows).filter((row) => row?.id);
  return normalized.find((row) => row.status === "accepted") ||
    normalized.find((row) => row.status === "converted") ||
    normalized.find((row) => row.status === "archived") ||
    normalized[0] ||
    null;
}

export function buildGithubPrPersistenceResponse({ card, rawSourceId, contract, evidenceCount }) {
  const workSignal = contract?.work_signal || {};
  const asset = contract?.career_asset_candidate || {};
  const bullet = asString(asArray(contract?.resume_bullet_candidates)[0], 600);
  return {
    ok: true,
    candidate_id: card?.id || null,
    raw_source_id: rawSourceId || card?.source_id || null,
    dedupe_key: contract?.dedupe_key || null,
    status: card?.status || GITHUB_PR_CANDIDATE_DEFAULT_STATUS,
    preview: {
      work_title: asString(asset.title || workSignal.title, 180),
      summary: asString(asset.evidence_summary || workSignal.summary, 500),
      suggested_resume_bullet: bullet || null,
      evidence_count: Number(evidenceCount || 0),
    },
  };
}

export async function persistGithubPrCandidate({ supabase, userId, contract, logPrefix = "github-pr-preview" } = {}) {
  let existing = null;
  try {
    const { data, error } = await supabase
      .from("experience_cards")
      .select("id, source_id, status")
      .eq("user_id", userId)
      .eq("metadata->>dedupe_key", contract.dedupe_key)
      .limit(10);
    if (error) {
      console.error(`[${logPrefix}] dedupe lookup failed:`, error.message);
      return { ok: false, code: "SAVE_FAILED", message: "Could not save GitHub PR candidate" };
    }
    existing = findExistingGithubPrCandidate(data);
  } catch (err) {
    console.error(`[${logPrefix}] dedupe lookup unexpected:`, err?.message || "unknown");
    return { ok: false, code: "SAVE_FAILED", message: "Could not save GitHub PR candidate" };
  }

  if (existing) {
    return {
      ok: true,
      duplicate: true,
      response: buildGithubPrPersistenceResponse({
        card: existing,
        rawSourceId: existing.source_id,
        contract,
        evidenceCount: contract.evidence?.length || 0,
      }),
    };
  }

  const rows = buildGithubPrPersistenceRows({ userId, contract });
  let rawSource = null;
  try {
    const { data, error } = await supabase.from("raw_sources").insert(rows.rawSource).select("id").single();
    if (error || !data?.id) {
      console.error(`[${logPrefix}] raw_sources insert failed:`, error?.message || "unknown");
      return { ok: false, code: "SAVE_FAILED", message: "Could not save GitHub PR candidate" };
    }
    rawSource = data;
  } catch (err) {
    console.error(`[${logPrefix}] raw_sources unexpected:`, err?.message || "unknown");
    return { ok: false, code: "SAVE_FAILED", message: "Could not save GitHub PR candidate" };
  }

  let card = null;
  try {
    const { data, error } = await supabase
      .from("experience_cards")
      .insert({ ...rows.card, source_id: rawSource.id })
      .select("id, source_id, status")
      .single();
    if (error || !data?.id) {
      console.error(`[${logPrefix}] experience_cards insert failed:`, error?.message || "unknown");
      return { ok: false, code: "SAVE_FAILED", message: "Could not save GitHub PR candidate" };
    }
    card = data;
  } catch (err) {
    console.error(`[${logPrefix}] experience_cards unexpected:`, err?.message || "unknown");
    return { ok: false, code: "SAVE_FAILED", message: "Could not save GitHub PR candidate" };
  }

  let evidenceCount = 0;
  if (rows.evidence.length > 0) {
    try {
      const { error } = await supabase.from("experience_evidence").insert(rows.evidence.map((row) => ({
        ...row,
        experience_card_id: card.id,
        source_id: rawSource.id,
      })));
      if (error) {
        console.error(`[${logPrefix}] evidence insert failed:`, error.message);
      } else {
        evidenceCount = rows.evidence.length;
      }
    } catch (err) {
      console.error(`[${logPrefix}] evidence unexpected:`, err?.message || "unknown");
    }
  }

  return {
    ok: true,
    duplicate: false,
    response: buildGithubPrPersistenceResponse({
      card,
      rawSourceId: rawSource.id,
      contract,
      evidenceCount,
    }),
  };
}

export async function handleGithubPrPreview(req, res, deps = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const supabase = deps.supabase || getServiceRoleClient();
  if (!supabase) return jsonError(res, 503, "SUPABASE_NOT_CONFIGURED", "Service is not configured");

  const accessToken = readBearerToken(req);
  const verifyAccessToken = deps.verifyAccessToken || verifySupabaseAccessToken;
  const identity = await verifyAccessToken({ accessToken, supabase });
  if (!identity.ok) return jsonError(res, identity.status || 401, "AUTH_REQUIRED", identity.message);

  const verifiedUserId = identity.userId;
  const payload = req.body?.payload || req.body;
  const contract = buildGithubPrCareerCandidateContract(payload);
  const persisted = await persistGithubPrCandidate({
    supabase,
    userId: verifiedUserId,
    contract,
    logPrefix: "github-pr-preview",
  });
  if (!persisted.ok) return jsonError(res, 500, persisted.code || "SAVE_FAILED", persisted.message || "Could not save GitHub PR candidate");
  return res.status(200).json(persisted.response);
}

async function runGithubRecentPullRequestsImport({ identity, request, deps = {}, logPrefix = "github-recent-pr-import" } = {}) {
  const readConnection = deps.readConnection || readConnectedGithubConnectionForUser;
  const connectionResult = await readConnection({
    supabase: identity.supabase,
    userId: identity.userId,
  });
  if (!connectionResult.ok) {
    return {
      nextAction: "retry_github_connection_status",
      warning: {
        code: "github_connection_unavailable",
        message: "GitHub connection metadata is unavailable.",
      },
    };
  }

  const connection = connectionResult.connection;
  if (!connection?.id || !connection?.installation_id) {
    return {
      nextAction: "connect_github_app",
      warning: {
        code: "github_connection_not_connected",
        message: "GitHub App connection is not connected.",
      },
    };
  }

  const readRows = deps.readRepositoryRows || readGithubRepositoryAccessRows;
  const rowsResult = await readRows({
    supabase: identity.supabase,
    userId: identity.userId,
    connectionId: connection.id,
  });
  if (!rowsResult.ok) {
    return {
      nextAction: "retry_github_repository_access_list",
      warning: {
        code: "github_repository_access_unavailable",
        message: "GitHub repository access storage is unavailable.",
      },
    };
  }

  const selectedRepositories = selectedGithubRepositoryRows(rowsResult.rows);
  if (selectedRepositories.length === 0) {
    return {
      nextAction: "select_github_repositories",
      warning: {
        code: "github_repository_selection_required",
        message: "Select at least one GitHub repository first.",
      },
    };
  }

  const createInstallationToken = deps.createInstallationToken || createGithubInstallationAccessToken;
  const tokenResult = await createInstallationToken({ installationId: String(connection.installation_id) });
  if (!tokenResult.ok) {
    const missing = tokenResult.code === "github_app_private_config_missing";
    return {
      nextAction: missing ? "configure_github_app_private_credentials" : "retry_github_recent_pull_requests_import",
      warning: {
        code: missing ? "github_app_private_config_missing" : "github_installation_token_unavailable",
        message: missing
          ? "GitHub App private configuration is missing."
          : "GitHub installation access token is unavailable.",
      },
    };
  }

  const fetchClosedPullRequests = deps.fetchClosedPullRequests || fetchClosedGithubPullRequestsForRepo;
  const fetchPullRequestDetail = deps.fetchPullRequestDetail || fetchGithubPullRequestDetail;
  const fetchPullRequestFiles = deps.fetchPullRequestFiles || fetchGithubPullRequestFiles;
  const buildCandidateContract = deps.buildCandidateContract || buildGithubPrCareerCandidateContract;
  const persistCandidate = deps.persistCandidate || persistGithubPrCandidate;
  const now = deps.now || Date.now;

  let repositoriesScanned = 0;
  let pullRequestsFound = 0;
  let candidatesCreated = 0;
  let duplicatesSkipped = 0;
  const candidates = [];

  for (const repository of selectedRepositories) {
    repositoriesScanned += 1;
    const listResult = await fetchClosedPullRequests({
      repository,
      installationToken: tokenResult.token,
      perRepoLimit: request.perRepoLimit,
      fetchFn: deps.fetchFn,
    });
    if (!listResult.ok) continue;

    for (const listedPullRequest of listResult.pullRequests || []) {
      if (!listedPullRequest.merged_at) continue;
      if (!isPullRequestInsideLookback(listedPullRequest, { lookbackDays: request.lookbackDays, now })) continue;
      if (!isPreferredGithubAuthor(listedPullRequest, connection.github_login)) continue;

      const detailResult = await fetchPullRequestDetail({
        repository,
        pullRequestNumber: listedPullRequest.number,
        installationToken: tokenResult.token,
        fetchFn: deps.fetchFn,
      });
      const pullRequest = detailResult.ok && detailResult.pullRequest
        ? { ...listedPullRequest, ...detailResult.pullRequest }
        : listedPullRequest;

      const filesResult = await fetchPullRequestFiles({
        repository,
        pullRequestNumber: pullRequest.number,
        installationToken: tokenResult.token,
        fetchFn: deps.fetchFn,
      });
      const payload = buildGithubPullRequestCandidatePayload({
        repository,
        pullRequest,
        files: filesResult.ok ? filesResult.files : [],
      });
      const contract = buildCandidateContract(payload);
      pullRequestsFound += 1;

      const persisted = await persistCandidate({
        supabase: identity.supabase,
        userId: identity.userId,
        contract,
        logPrefix,
      });
      if (!persisted.ok) {
        return {
          ok: false,
          status: 500,
          code: persisted.code || "SAVE_FAILED",
          message: persisted.message || "Could not save GitHub PR candidate",
        };
      }
      if (persisted.duplicate) {
        duplicatesSkipped += 1;
        continue;
      }

      candidatesCreated += 1;
      candidates.push({
        repo_full_name: repository.full_name,
        pull_request_number: pullRequest.number,
        pull_request_title: pullRequest.title,
        merged_at: pullRequest.merged_at,
        candidate_title: persisted.response?.preview?.work_title || contract?.career_asset_candidate?.title || pullRequest.title,
      });
    }
  }

  return {
    ok: true,
    repositoriesScanned,
    pullRequestsFound,
    candidatesCreated,
    duplicatesSkipped,
    candidates,
  };
}

export async function handleGithubRecentPullRequestsImport(req, res, deps = {}) {
  const request = normalizeGithubRecentPullRequestsImportRequest(req.body || {});
  if (!request.ok) {
    return jsonError(res, 400, request.code || "INVALID_REQUEST", request.message || "Recent GitHub PR import request is invalid.");
  }

  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  const scopedDeps = {
    ...deps,
    readConnection: deps.readConnection || readConnectedGithubConnectionForUser,
  };
  const importResult = await runGithubRecentPullRequestsImport({
    identity,
    request,
    deps: scopedDeps,
    logPrefix: "github-recent-pr-import",
  });
  if (importResult?.ok === false) {
    return jsonError(res, importResult.status || 500, importResult.code || "SAVE_FAILED", importResult.message || "Could not save GitHub PR candidate");
  }

  return res.status(200).json(buildGithubRecentPullRequestsImportResponse({
    repositoriesScanned: importResult.repositoriesScanned,
    pullRequestsFound: importResult.pullRequestsFound,
    candidatesCreated: importResult.candidatesCreated,
    duplicatesSkipped: importResult.duplicatesSkipped,
    candidates: importResult.candidates,
    nextAction: importResult.nextAction,
    warning: importResult.warning,
  }));
}

export async function handleGithubDailyReviewRequest(req, res, deps = {}) {
  const request = normalizeGithubRecentPullRequestsImportRequest(req.body || {}, {
    defaultLookbackDays: 1,
    maxLookbackDays: 7,
    defaultPerRepoLimit: 10,
    maxPerRepoLimit: 20,
    forbiddenCode: "github_daily_review_request_forbidden_scope",
    invalidMessage: "GitHub daily review request contains a forbidden field.",
  });
  if (!request.ok) {
    return jsonError(res, 400, request.code || "INVALID_REQUEST", request.message || "GitHub daily review request is invalid.");
  }

  const identity = await verifyGithubConnectionUser(req, res, deps);
  if (!identity) return undefined;

  const scopedDeps = {
    ...deps,
    readConnection: deps.readConnection || readConnectedGithubConnectionForUser,
  };
  const importResult = await runGithubRecentPullRequestsImport({
    identity,
    request,
    deps: scopedDeps,
    logPrefix: "github-daily-review-request",
  });
  if (importResult?.ok === false) {
    return jsonError(res, importResult.status || 500, importResult.code || "SAVE_FAILED", importResult.message || "Could not save GitHub PR candidate");
  }

  return res.status(200).json(buildGithubDailyReviewRequestResponse({
    repositoriesScanned: importResult.repositoriesScanned,
    pullRequestsFound: importResult.pullRequestsFound,
    candidatesCreated: importResult.candidatesCreated,
    duplicatesSkipped: importResult.duplicatesSkipped,
    candidates: importResult.candidates,
    nextAction: importResult.nextAction,
    warning: importResult.warning,
  }));
}

// ─── dispatcher ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    __setCorsHeaders(res);
    return res.status(200).end();
  }
  __setCorsHeaders(res);

  const action = String(req?.query?.action || "").toLowerCase();

  switch (action) {
    case "":
    case "save_analysis_run":
      return handleSaveAnalysisRun(req, res);

    case "mcp_health":
      return handleMcpHealth(req, res);
    case "mcp_pairing_create":
      return handleMcpPairingCreate(req, res);
    case "mcp_pairing_exchange":
      return handleMcpPairingExchange(req, res);
    case "mcp_save_experience":
      return handleMcpSaveExperience(req, res);
    case "chatgpt_action_save_experience":
      return handleChatgptActionSaveExperience(req, res);
    case "browser_extension_save_experience":
      return handleBrowserExtensionSaveExperience(req, res);
    case "mcp_search_experiences":
      return handleMcpSearchExperiences(req, res);
    case "mcp_pairing_list":
      return handleMcpPairingList(req, res);
    case "mcp_pairing_revoke":
      return handleMcpPairingRevoke(req, res);
    case "github_connection_status":
      return handleGithubConnectionStatus(req, res);
    case "github_connection_prepare":
      return handleGithubConnectionPrepare(req, res);
    case "github_connection_callback_stub":
      return handleGithubConnectionCallbackStub(req, res);
    case "github_repository_access_list":
      return handleGithubRepositoryAccessList(req, res);
    case "github_repository_access_select":
      return handleGithubRepositoryAccessSelect(req, res);
    case "github_repository_access_preview":
      return handleGithubRepositoryAccessPreview(req, res);
    case "github_pr_preview":
      return handleGithubPrPreview(req, res);
    case "github_recent_pull_requests_import":
      return handleGithubRecentPullRequestsImport(req, res);
    case "github_daily_review_request":
      return handleGithubDailyReviewRequest(req, res);

    default:
      return jsonError(res, 404, "UNKNOWN_ACTION", "Unknown or missing action");
  }
}
