# lib/trae/matcher.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Matches preliminary Demo topics to signup topics and estimates direction consistency.

## What It Does

- Prefers exact author matches.
- Falls back to near-author, title similarity, and keyword overlap.
- Writes `trae_matches` documents with confidence and mismatch risk.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scoreTopicMatch` | function | Pure scoring helper for one preliminary/signup pair. |
| `runTraeMatching` | function | Firestore-backed matching run. |

## Dependencies

- Internal: `firestore`, `types`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep first version rules-based to avoid O(N*M) LLM calls; only future candidate-pair LLM checks should be added if needed.

## Important Notes / NEVER Change

- A missing match should not directly punish score; it is surfaced as uncertainty.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned matching module. | Codex |
