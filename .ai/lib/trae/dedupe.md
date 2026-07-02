# lib/trae/dedupe.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Shared helpers for removing duplicate preliminary contest posts by normalized title.

## What It Does

- Normalizes titles by trimming, collapsing whitespace, and lowercasing.
- Removes duplicate ranking rows that have the same normalized title.
- Removes duplicate judge candidates that have the same normalized title.
- Keeps the first item from the already ordered input, so callers control which duplicate wins.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `normalizeTitleForDedupe` | function | Builds the comparison key for duplicate-title checks. |
| `dedupeByTopicTitle` | function | Keeps one row/candidate per normalized topic title. |

## Dependencies

- Internal: none.
- External: none.

## Agent Decisions / Thoughts

- 2026-07-02 Codex: Duplicate forum submissions can have different topic IDs but identical titles. Title-level dedupe should happen in server-side read models rather than only in the UI, so public ranking, pagination totals, and judge candidate selection share the same behavior.
- 2026-07-02 Codex: The helper keeps the first item from the caller-provided order. Public ranking will sort before deduping so the visible higher-ranked duplicate wins; judge selection will order candidates by existing evaluation score/status before deduping so an already-scored duplicate can suppress a redundant unjudged duplicate.

## Important Notes / NEVER Change

- Do not compare by topic ID for this behavior; duplicate posts have distinct IDs.
- Do not mutate input arrays.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-02 | Public ranking showed repeated posts with the same title. | Data Connect returned separate preliminary topic rows for duplicate forum posts, and ranking code did not fold them by title. | Add shared normalized-title dedupe and apply it in ranking and judge candidate selection. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-02 | Planned duplicate-title dedupe helper. | Codex |
| 2026-07-02 | Implemented normalized-title helper and first-row-wins dedupe. | Codex |
