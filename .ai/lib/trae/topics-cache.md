# topics-cache.json

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Provides a compact, versioned fallback snapshot for public ranking and topic detail reads when Firebase Data Connect is unavailable or unconfigured.

## What It Does

- Supplies preliminary ranking rows for local/offline operation.
- Supplies signup and preliminary rows needed by fallback stats and detail guards.
- Preserves public-facing fields and evaluation/match records used by `lib/trae/api.ts`.
- Excludes heavyweight raw scrape payloads that are never returned to the frontend.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `lib/trae/topics-cache.json` | JSON array | Compact snapshot consumed by `readTopicsCache()` in `lib/trae/api.ts`. |

## Props / Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| topic records | JSON objects | Yes | Data Connect-shaped topic rows with public fields, latest evaluation array, and match object. |

## Dependencies

- **Internal:** `lib/trae/api.ts` - reads this file for board, stats, and detail fallback behavior.
- **Internal:** `tests/contest-route-pages.test.ts` - asserts Data Connect-unavailable behavior and cache-derived stats/details.

## Agent Decisions / Thoughts

- **2026-07-03 Codex:** The previous committed snapshot was about 75MB because it included raw Discourse JSON and HTML. Keep the fallback behavior but regenerate the file without `rawJson`, `contentHtml`, and `rawHtml`; those fields are stripped by `sanitizeTopic()` and are not required for public ranking/detail fallback tests.

## Important Notes / NEVER Change

- Do not delete this file without replacing the fallback mechanism and updating the existing Data Connect-unavailable tests.
- Do not commit raw scrape payloads (`rawJson`, `contentHtml`, `rawHtml`) in this snapshot.
- Keep enough fields for `isDeletedOrEmptyTopic()`, `normalizeOfficialTrack()`, stats derivation, ranking cards, and topic detail cards.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-03 | Ranking fallback tests failed after cleanup. | `topics-cache.json` was mistaken for disposable cache, but runtime uses it as the offline fallback snapshot. | Reintroduce it as a compact versioned snapshot without raw scrape payloads. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Documented compact fallback snapshot role and regeneration constraints. | Codex |
