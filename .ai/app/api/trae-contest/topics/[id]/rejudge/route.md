# app/api/trae-contest/topics/[id]/rejudge/route.ts

> Last updated: 2026-07-13 | Protection: STANDARD

## Purpose

Public, token-free single-topic re-score endpoint for the project detail page.

## What It Does

- `POST` re-runs multi-evaluator judging for one preliminary topic and persists the result.
- `GET` reports in-flight status for the same instance (best-effort; primary UX awaits POST).
- Guards: per-topic in-flight lock, per-topic cooldown, global concurrency cap.
- Stale in-flight reclaim so abandoned locks after kill/timeout do not permanently return `busy`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `POST` | route handler | Awaits `rejudgeTopicById` (request-bound CPU) and returns done/error. |
| `GET` | route handler | `{ running, error }` for same-instance progress. |

## Dependencies

- Internal: `lib/trae/judge.rejudgeTopicById`, `lib/trae/api.writeBoardSnapshot`, `lib/trae/topic-route-id`.

## Open Threads / Resume Context

- Empty — busy-gate fix deployed (revision `trae-2026-contest-rankings-00042-dj9`). `preliminary_71088` rejudged to 72.

## Agent Decisions / Thoughts

- **2026-07-10 Grok:** Await rejudge on POST (no fire-and-forget) so Cloud Run keeps CPU.
- **2026-07-13 Grok:** `MAX_CONCURRENT_REJUDGE` slots as bare `Set` never expire. Killed requests leave slots occupied until instance recycle → permanent `评分服务繁忙`. Fix: `Map<id, startedAt>`, reclaim >14m, `finally` release, cap 2→4, busy returns `retryAfterMs`. Client soft-retries busy up to 3 times.

## Bug Fix: Re-score Button Did Nothing On Cloud Run (2026-07-10)

**Root Cause**: Fire-and-forget after response; Cloud Run throttles CPU.
**Fix**: `maxDuration = 900`, await `rejudgeTopicById` on POST.

## Bug Fix: Permanent / frequent busy (2026-07-13)

**Discovered**: 2026-07-13 — user 留声水墨 (`preliminary_71088`) sees `评分服务繁忙，请稍后再试。` (`code: "busy"`).
**Root Cause**: Global cap with no stale reclaim; hung/killed requests leave slots occupied. Cap of 2 saturates under multi-minute rejudges.
**Fix**:
1. `inFlight: Map<id, startedAt>` + reclaim older than `STALE_IN_FLIGHT_MS` (14m).
2. Always `markFinished` in `finally`.
3. Cap 2 → 4.
4. Busy includes `retryAfterMs`; client soft-retries.
5. Do not reintroduce fire-and-forget.

## Important Notes / NEVER Change

- Do not require admin token on this public button unless the UI is changed to match.
- Do not put provider secrets in the response.
- Do not void/fire-and-forget rejudge on Cloud Run.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-10 | Documented Cloud Run fire-and-forget rejudge failure and await fix. | Grok |
| 2026-07-13 | Stale in-flight reclaim + concurrency fix for busy gate; rejudged 71088. | Grok |
