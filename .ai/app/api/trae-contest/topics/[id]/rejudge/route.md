# app/api/trae-contest/topics/[id]/rejudge/route.ts

> Last updated: 2026-07-10 | Protection: STANDARD

## Purpose

Public, token-free single-topic re-score endpoint for the project detail page.

## What It Does

- `POST` re-runs multi-evaluator judging for one preliminary topic and persists the result.
- `GET` reports in-flight status for the same instance (best-effort; primary UX awaits POST).
- Guards: per-topic in-flight lock, per-topic cooldown, global concurrency cap.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `POST` | route handler | Awaits `rejudgeTopicById` (request-bound CPU) and returns done/error. |
| `GET` | route handler | `{ running, error }` for same-instance progress. |

## Dependencies

- Internal: `lib/trae/judge.rejudgeTopicById`, `lib/trae/api.writeBoardSnapshot`, `lib/trae/topic-route-id`.

## Bug Fix: Re-score Button Did Nothing On Cloud Run (2026-07-10)

**Discovered**: 2026-07-10
**Description**: Detail page 重新评分 shows started/success UI but score often does not change.
**Root Cause**: Commit 99051b6 switched to fire-and-forget `void runRejudgeInBackground` with `maxDuration = 60` because a sync rejudge exceeded 60s. On Cloud Run, CPU is throttled after the response, so background work dies mid-flight. GET status is in-memory per instance, so polls on another instance see `running: false, error: null` and the client falsely treats that as success.
**Fix Strategy**:
1. Set `maxDuration = 900` to match Cloud Run long requests / judge cost (~60–400s).
2. **Await** `rejudgeTopicById` inside POST (no fire-and-forget). Request-bound CPU keeps the job alive.
3. Client treats a successful POST body as completion, refreshes topic detail, shows success. Keep start toast. Polling becomes a fallback only if `started: true` without `done`.
4. Keep cooldown / in-flight / concurrency guards.

**Impact**: `rejudge/route.ts`, `project-detail-client.tsx`, tests
**Regression risk**: Public POST may take several minutes; Cloud Run service timeout must be ≥ rejudge wall time (already expected 900s for cron). Do not reintroduce `void runRejudgeInBackground`.

## Important Notes / NEVER Change

- Do not require admin token on this public button unless the UI is changed to match.
- Do not put provider secrets in the response.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Documented Cloud Run fire-and-forget rejudge failure and await fix. | Grok |
