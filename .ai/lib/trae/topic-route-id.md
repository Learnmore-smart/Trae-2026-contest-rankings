# lib/trae/topic-route-id.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Normalizes topic ids received from public App Router route params.

## What It Does

- Removes a trailing `.rsc` suffix when it appears as a Next.js internal route artifact.
- Leaves normal topic ids unchanged.
- Keeps route/API normalization shared so page and API behavior cannot drift.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `normalizeTopicRouteId` | function | Returns a topic id suitable for lookup and client fetches. |

## Dependencies

- None.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Use a tiny helper instead of duplicating string cleanup in the page and API route. The suffix is route infrastructure, not data-domain state, so it belongs at the route boundary.

## Important Notes / NEVER Change

- Only strip a terminal `.rsc`; do not alter ids containing `.rsc` in the middle.
- Do not decode URI components here; callers differ in whether Next has already decoded the param.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-03 | Detail lookup receives `preliminary_x.rsc` on client navigation. | Next RSC navigation suffix leaks into a dynamic param behind external rewrites. | Shared helper strips the terminal `.rsc` artifact. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Planned shared topic route id normalizer. | Codex |
| 2026-07-03 | Implemented `normalizeTopicRouteId()` to strip only a terminal `.rsc` suffix. | Codex |
