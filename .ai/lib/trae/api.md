# lib/trae/api.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides read-model helpers used by public API routes and pages.

## What It Does

- Combines topic, latest evaluation, and match data.
- Computes stats cards and online presence counts.
- Applies public filters and sorting for preliminary-only listings.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getTraeStats` | function | Returns public stats payload. |
| `listRankedTopics` | function | Returns preliminary ranking rows. |
| `getTopicDetail` | function | Returns detail page data by topic ID. |

## Dependencies

- Internal: `firestore`, `types`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use server-side in-memory joins for the first version to avoid complex Firestore composite indexes during launch.

## Important Notes / NEVER Change

- Public APIs must not return `rawHtml` or unrestricted raw model internals.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public read-model helpers. | Codex |
