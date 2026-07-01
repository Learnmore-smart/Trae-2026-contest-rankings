# app/api/trae-contest/admin/judge/route.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Admin-only API route for manually triggering preliminary topic judging.

## What It Does

- Verifies `TRAE_ADMIN_TOKEN` bearer auth.
- Parses judge mode and batching options from the request body.
- Runs `judgeChangedTraeTopics()`.
- Writes a board snapshot after successful judge execution.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `POST` | route handler | Starts a bounded judge run. |

## Dependencies

- Internal: `lib/trae/auth`, `lib/trae/api`, `lib/trae/judge`.
- External: Next.js route runtime.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Pass through the approved `concurrency` option after normalizing mode. Backend clamping remains in `judgeChangedTraeTopics()` so callers cannot request nonsensical values.

## Important Notes / NEVER Change

- Keep this route `nodejs`; judge work uses server-only credentials and generated Data Connect admin operations.
- Do not expose admin functionality without bearer token validation.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created doc before passing judge concurrency through the route. | Codex |
| 2026-07-01 | Passed `body.concurrency` into `judgeChangedTraeTopics()`. | Codex |
