import {
  getServiceRoleClient,
  readBearerToken,
  verifySupabaseAccessToken,
} from "../../_mcp_auth.js";
import { handleControlledCandidatePreviewApiRequest } from "../../../src/lib/career-core/mapControlledCandidateExposureResponse.js";

const FORBIDDEN_PERSISTED_ID_FIELDS = new Set([
  "resumeProfileId",
  "workRecordId",
  "workRecordIds",
  "manualConfirmedCandidateId",
  "manualConfirmedCandidateIds",
]);

function makeError(status, code, message, details = []) {
  return {
    status,
    body: {
      ok: false,
      error: { code, message, details },
    },
  };
}

function parseRequestBody(body) {
  if (body === undefined || body === null || body === "") return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_) {
      return body;
    }
  }
  return body;
}

function findForbiddenPersistedId(value) {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenPersistedId(item);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PERSISTED_ID_FIELDS.has(key)) return key;
    const found = findForbiddenPersistedId(child);
    if (found) return found;
  }

  return null;
}

function ownerValueOf(value) {
  if (!value || typeof value !== "object") return null;
  const owner = value.userId ?? value.user_id ?? value.ownerId ?? value.owner_id;
  if (owner === undefined || owner === null || owner === "") return null;
  return String(owner);
}

function findForeignOwnedInput(value, userId, path = []) {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForeignOwnedInput(value[index], userId, [...path, index]);
      if (found) return found;
    }
    return null;
  }

  const owner = ownerValueOf(value);
  if (owner && owner !== userId) {
    return path.join(".") || "body";
  }

  for (const [key, child] of Object.entries(value)) {
    const found = findForeignOwnedInput(child, userId, [...path, key]);
    if (found) return found;
  }

  return null;
}

function preflightOwnership(body, userId) {
  const persistedField = findForbiddenPersistedId(body);
  if (persistedField) {
    return makeError(403, "FORBIDDEN_RESOURCE", "Persisted resource ids are not available for read-only preview.", [{
      field: persistedField,
    }]);
  }

  const foreignPath = findForeignOwnedInput(body, userId);
  if (foreignPath) {
    return makeError(403, "FORBIDDEN_RESOURCE", "Requested resume or work records are outside the session owner scope.", [{
      field: foreignPath,
    }]);
  }

  return null;
}

function sendJson(res, result) {
  return res.status(result.status).json(result.body);
}

export async function handleControlledCandidatePublicPreviewRoute(req, res, options = {}) {
  const supabase = options.supabase ?? getServiceRoleClient();
  const accessToken = readBearerToken(req);
  const auth = await verifySupabaseAccessToken({ accessToken, supabase });

  if (!auth.ok) {
    return sendJson(res, makeError(401, "UNAUTHENTICATED", "Authentication is required.", []));
  }

  const body = parseRequestBody(req.body);
  const ownershipError = preflightOwnership(body, auth.userId);
  if (ownershipError) {
    return sendJson(res, ownershipError);
  }

  const result = handleControlledCandidatePreviewApiRequest({
    method: req.method,
    session: { userId: auth.userId },
    body,
  });

  return sendJson(res, result);
}

export default async function handler(req, res) {
  return handleControlledCandidatePublicPreviewRoute(req, res);
}
