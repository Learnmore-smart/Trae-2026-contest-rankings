# tests/trae.extractors.test.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Regression tests for deterministic forum topic signal extraction.

## What It Does

- Verifies Demo URL, image URL, attachment, track, TRAE-process, and Session ID extraction.
- Protects `extractTopicSignals()` from silently regressing material-evidence counts used by the judge.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `extractTopicSignals` tests | node:test suite | Exercises the public extractor API. |

## Dependencies

- Internal: `lib/trae/extractors.ts`.
- Built-in: `node:test`, `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Add a regression using the exact Trae long Session ID shape from the reported forum post. The expected behavior is to count every long ID as a Session ID and set `hasThreeSessionIds` once there are at least three.
- 2026-07-01 Codex: Add Demo candidate coverage if extractor starts tracking more than the single canonical `demoUrl`, because prompt context needs to distinguish "Demo links exist" from "automatic visual verification failed."
- 2026-07-01 Codex: Implemented both regressions. The long-ID case now expects five extracted IDs, and the multi-Demo case expects both Vercel and Netlify links in `demoUrls`.
- 2026-07-01 Codex: Add regressions for Discourse lightbox/lazy image extraction and non-web Demo evidence: app download artifacts and QR/miniprogram images.

## Important Notes / NEVER Change

- Keep tests network-free and deterministic.
- Do not assert on generated LLM text here; extractor tests should stay pure.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-01 | Long Trae Session IDs were missed, so topics with many sessions could be flagged as `< 3`. | Regex only accepted short labeled IDs, direct `session-*`, and standard UUIDs. | Add a failing regression for dotted/colon Trae conversation IDs before updating the extractor. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created test documentation for Session ID extraction regression. | Codex |
| 2026-07-01 | Added regressions for long Trae Session IDs and multi-Demo candidate metadata. | Codex |
| 2026-07-01 | Planned regressions for image source coverage and non-web Demo evidence. | Codex |
| 2026-07-01 | Added regressions for Discourse image sources, app download Demo evidence, and QR/miniprogram visual Demo evidence. | Codex |
