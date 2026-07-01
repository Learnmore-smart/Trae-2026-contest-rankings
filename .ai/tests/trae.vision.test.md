# tests/trae.vision.test.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Verifies the visual-evidence gathering module used by the judge pipeline.

## What It Does

- Tests `buildDemoScreenshotUrl` builds the thum.io screenshot URL and rejects non-http(s) schemes.
- Tests `describeTopicImages` sends up to 4 `image_url` parts to the primary vision model, caps at 4 images, returns `null` without calling the model when there are no images, falls back to the secondary vision model on a soft-throttle, and returns `null` (never throws) when every vision model fails.
- Tests `describeDemoScreenshot` sends the thum.io-wrapped demo URL as `image_url` content and returns `null` without calling the model when there is no demo URL.
- Tests `gatherVisualEvidence` runs both calls concurrently and that a demo-screenshot failure doesn't drop already-successful image evidence.

## Dependencies

- Internal: `lib/trae/vision`, `lib/trae/config`.
- Built-in: `node:test`, `node:assert/strict`.

## Important Notes / NEVER Change

- Tests must not require network access or real API keys (fetchFn is always injected).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Implemented deterministic tests for vision.ts. | Claude |
