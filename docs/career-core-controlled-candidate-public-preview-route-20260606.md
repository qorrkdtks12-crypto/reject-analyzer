# Controlled Candidate Public Preview Route

## Scope

- Route: `POST /api/career-core/controlled-candidates/preview`
- File: `api/career-core/controlled-candidates/preview.js`
- Mode: read-only `preview_only`
- Result status: `candidate_only`

## Auth

The route reuses the existing server auth pattern from `api/_mcp_auth.js`:

- `readBearerToken(req)`
- `getServiceRoleClient()`
- `verifySupabaseAccessToken({ accessToken, supabase })`

No new auth helper is introduced.

## Resource Rules

This first public route accepts raw request body input only:

- `resumeProfile`
- `workRecords`
- `manualConfirmedCandidates`
- `options`

Persisted id inputs such as `resumeProfileId` and `workRecordIds` are blocked with `FORBIDDEN_RESOURCE` because this batch does not add an ownership-scoped read helper.

Raw input that declares a different owner via `userId`, `user_id`, `ownerId`, or `owner_id` is also blocked with `FORBIDDEN_RESOURCE`.

## Read-only Guarantees

The route delegates preview behavior to `handleControlledCandidatePreviewApiRequest` and does not write to CareerProfile, DB, Supabase, storage, RoleFit, or scoring.

Forbidden final-apply inputs return `FORBIDDEN_FINAL_APPLY`.
Forbidden storage-write inputs return `FORBIDDEN_STORAGE_WRITE`.
Final display fields such as `finalStrengths`, `confirmedSkills`, and `verifiedStrengths` return `INVALID_INPUT`.
