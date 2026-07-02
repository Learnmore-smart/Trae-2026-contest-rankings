# tests/trae.scraper.test.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Regression coverage for TRAE scraper normalization behavior.

## What It Does

- Verifies raw Discourse JSON is converted to a Data Connect-safe snapshot before storage.
- Protects against nested raw JSON structures breaking topic writes.
- Verifies oversized snapshots are bounded and circular payloads become `null`.
- Verifies pinned/global-pinned/non-visible Discourse category topics are excluded before detail fetches.
- Verifies scrape updates preserve already-judged preliminary status instead of dropping public scored progress.

## Public API

| Name | Type | Description |
|------|------|-------------|
| scraper tests | node:test suite | Exercises exported scraper helpers. |

## Dependencies

- Internal: `lib/trae/scraper.ts`.
- External: Node `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Add test first for the rawJson persistence failure. The production fix should expose a small helper that turns raw JSON into a bounded string or null so storage never sees unstable nested entities under `rawJson`.
- 2026-06-30 Codex: Rename the helper/test from Firestore-specific wording to Data Connect wording without changing serializer behavior.
- 2026-06-29 Codex: Implemented tests for nested payload serialization, size bounding, circular-payload fallback to null, and pinned guide filtering.
- 2026-07-02 Codex: Add a regression test for the net-negative scored-count bug: a changed scrape of an already judged preliminary row must keep `judged`; unjudged/error rows can still go back through `needs_judging`.

## Important Notes / NEVER Change

- Tests should not hit the network or Data Connect.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned scraper rawJson serialization regression test. | Codex |
| 2026-06-29 | Implemented scraper rawJson serialization regression tests. | Codex |
| 2026-06-29 | Implemented pinned/global-pinned category topic filtering regression test. | Codex |
| 2026-06-30 | Planned Data Connect sanitizer naming update. | Codex |
| 2026-07-02 | Planned scrape-status preservation regression coverage. | Codex |
| 2026-07-02 | Implemented scrape-status preservation regression coverage. | Codex |
