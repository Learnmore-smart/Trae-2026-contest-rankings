# tests/trae.extractors.test.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Verifies deterministic extraction of Demo URLs, images, Session IDs, and material evidence.

## What It Does

- Tests real HTML/text examples.
- Guards scraper and judge prompt input quality.
- Tests the conservative deleted/empty topic predicate used by ranking and judging.

## Dependencies

- Internal: `lib/trae/extractors`.
- Built-in: `node:test`, `node:assert/strict`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned extractor tests before implementation. | Codex |
| 2026-06-29 | Synced final Node test runner. | Codex |
| 2026-07-02 | Planned deleted/empty topic predicate coverage. | Codex |
| 2026-07-02 | Implemented deleted/empty predicate unit tests. | Codex |
