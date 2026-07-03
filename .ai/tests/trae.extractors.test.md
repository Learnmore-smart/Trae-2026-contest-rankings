# tests/trae.extractors.test.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Verifies deterministic extraction of Demo URLs, images, Session IDs, and material evidence.

## What It Does

- Tests real HTML/text examples.
- Guards scraper and judge prompt input quality.
- Tests the conservative deleted/empty topic predicate used by ranking and judging.

## Planned Change: Topic 48365 Session IDs

- Add a red regression using the exact four Session ID strings from forum topic 48365.
- Expected behavior: all four full IDs are extracted, `traeEvidence.sessionIdCount` is `4`, and `hasThreeSessionIds` is true.
- This specifically prevents the labeled fallback from returning only the common numeric prefix `696411359297017` and deduping four sessions into one.

## Implemented Change: Topic 48365 Session IDs

- Added the exact four Trae Work CN Session ID strings from topic 48365.
- Red verified: the test initially returned only `696411359297017`.
- Green verified: `node --experimental-strip-types --test tests/trae.extractors.test.ts` extracts all four full IDs and passes.

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
| 2026-07-03 | Planned topic 48365 full Trae Work CN Session ID regression. | Codex |
| 2026-07-03 | Implemented topic 48365 Session ID regression and verified red-to-green. | Codex |
