# tests/trae.vision.test.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Verifies the visual-evidence gathering module used by the judge pipeline.

## What It Does

- Tests `buildDemoScreenshotUrl` builds the thum.io screenshot URL and rejects non-http(s) schemes.
- Tests `describeTopicImages` sends selected image URLs across bounded batches of up to 4 `image_url` parts each, returns `null` without calling the model when there are no images, falls back to the secondary vision model on a soft-throttle, and returns `null` (never throws) when every vision model fails.
- Tests `describeDemoScreenshot` sends the thum.io-wrapped demo URL as `image_url` content and returns `null` without calling the model when there is no demo URL.
- Tests `gatherVisualEvidence` runs both calls concurrently and that a demo-screenshot failure doesn't drop already-successful image evidence.

## Implemented Change: All Uploaded Images

- Added a red regression where a topic has nine images; the old implementation sent only the first four.
- Expected behavior is now that all post images are sent across bounded four-image batches.
- QR/miniprogram priority tests expect the prioritized image first while still including every generic screenshot.
- Tests inject `fetchFn` and `sleepFn` so they remain network-free and do not wait on the shared LLM rate limiter.

## Dependencies

- Internal: `lib/trae/vision`, `lib/trae/config`.
- Built-in: `node:test`, `node:assert/strict`.

## Important Notes / NEVER Change

- Tests must not require network access or real API keys (fetchFn is always injected).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Implemented deterministic tests for vision.ts. | Claude |
| 2026-07-03 | Planned regression for representative first-and-last post image sampling. | Codex |
| 2026-07-03 | Implemented all-image batching regressions and updated QR priority expectations. | Codex |
## Change Plan: Remove REMOVED_PROVIDER Fixtures

- 2026-07-03 Codex: Remove REMOVED_PROVIDER env vars from the isolated test environment and fixtures.
- Keep the friend-first, NVIDIA-second vision plan assertions.

## Change Plan: Bounded Image Batch Assertions

- 2026-07-03 Codex: Update tests to expect combined per-batch summaries when more than 4 images are sent.
- Keep assertions that every selected image URL is sent, with QR/demo images first.

