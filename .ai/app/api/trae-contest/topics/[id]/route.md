# app/api/trae-contest/topics/[id]/route.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Public API route for one TRAE contest topic detail payload.

## What It Does

- Reads the dynamic topic id from the App Router route params.
- Normalizes route-level artifacts before calling the data layer.
- Returns a sanitized detail payload or a 404 JSON error for unknown/non-preliminary topics.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `GET` | route handler | Returns one topic detail as JSON. |

## Dependencies

- Internal: `lib/trae/api.ts` for `getTopicDetail`.
- Internal: `lib/trae/topic-route-id.ts` for dynamic id normalization.
- External: `next/server`.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Normalize the id at the API boundary as defense in depth. Even if the page route is fixed, a client or future route can still request `/topics/preliminary_x.rsc`; this route should resolve the intended topic rather than returning a false 404.

## Important Notes / NEVER Change

- Keep raw forum HTML and raw AI prompt/model output out of this public response.
- Do not silently turn genuinely unknown ids into success responses.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-03 | Detail API returns 404 for every card after client navigation. | The requested id can include Next's internal `.rsc` suffix. | Strip only the trailing `.rsc` route artifact before lookup. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Created route documentation and planned API id normalization. | Codex |
| 2026-07-03 | Implemented API boundary normalization before calling `getTopicDetail()`. | Codex |
