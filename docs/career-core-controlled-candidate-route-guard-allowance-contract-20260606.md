# Career Core Controlled Candidate Route Guard Allowance Contract

Date: 2026-06-06

Batch: QA/Contract Batch / Controlled Candidate Route Guard Allowance

## 1. Purpose

This contract fixes the changed-file guard allowance policy before implementing the Controlled Candidate preview public route.

This batch is documentation, fixture, and deterministic test only. It does not implement the route, update the changed-file guard, add auth helpers, add DB/Supabase reads or writes, change UI, or modify runtime integration.

## 2. Route Path Recommendation

Based on route/auth discovery, the future route path is fixed to the existing Vercel-style root `api/**` surface:

```text
api/career-core/controlled-candidates/preview.js
```

Logical endpoint:

```text
POST /api/career-core/controlled-candidates/preview
```

Actual route implementation is deferred to a later batch.

## 3. Guard Allowance Principle

```text
Route files are not runtime utilities, so do not allow them with --allow-runtime.
The controlled candidate preview route must be allowed by exact path.
Broad api/** allowance is forbidden.
supabase/functions/** allowance is unrelated to this preview route.
src/api/** is not the current tracked route surface and must not be used.
```

The allowed route path must remain exact:

```text
api/career-core/controlled-candidates/preview.js
```

## 4. Future Guard Update Policy

If the next implementation batch must update the guard, the allowance must be limited to this single exact path:

```text
api/career-core/controlled-candidates/preview.js
```

The only guard file allowed for that future update is:

```text
src/lib/career-core/__testUtils__/careerCoreChangedFileGuard.js
```

This batch must not modify that guard file.

## 5. Route Implementation Allowed Files For Next Batch

Future implementation batch allowed file candidates:

```text
api/career-core/controlled-candidates/preview.js
scripts/test-career-core-controlled-candidate-public-preview-route.js
docs/career-core-controlled-candidate-public-preview-route-20260606.md
```

Only if required:

```text
src/lib/career-core/__testUtils__/careerCoreChangedFileGuard.js
```

Any guard change must be an exact route path allow only.

## 6. Next Route Implementation Still Forbidden

The next route implementation batch must still forbid:

```text
DB insert/update/delete
Supabase write
CareerProfile update
RoleFit/scoring update
UI implementation
package changes
broad api/** allow
supabase/functions/** implementation
src/api/** implementation
```

## 7. Guard Test Command Policy

Route implementation batch guard verification must use one of the following.

Option A: guard update included:

```bash
node scripts/test-career-core-changed-file-guard.js
```

Option B: exact route allow CLI is introduced separately:

```bash
node scripts/test-career-core-changed-file-guard.js --allow-route api/career-core/controlled-candidates/preview.js
```

If `--allow-route` does not exist yet, do not invent it in the route implementation batch unless that CLI change is explicitly scoped and tested. This contract recommends adding exact path allowance to the guard as the primary approach.

## 8. Blocker Conditions

The following are blockers:

```text
api/** broad allowance
creating the route under src/api/**
creating the route under supabase/functions/**
allowing an API route with --allow-runtime
adding a route file without guard allowance
including route implementation and UI implementation in one PR
including route implementation and DB write in one PR
```
