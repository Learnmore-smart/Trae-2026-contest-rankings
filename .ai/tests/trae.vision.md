# tests/trae.vision.test.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Regression tests for zero-budget visual evidence gathering.

## What It Does

- Verifies image URLs are sent to the configured vision model.
- Verifies demo screenshot URLs are built for web demos.
- Verifies visual evidence degrades gracefully when one branch fails.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `describeTopicImages` tests | node:test suite | Confirms post images go through the vision model. |
| `describeDemoScreenshot` tests | node:test suite | Confirms web demo screenshot proxy behavior. |
| `gatherVisualEvidence` tests | node:test suite | Confirms concurrent evidence gathering behavior. |

## Dependencies

- Internal: `lib/trae/vision.ts`, `lib/trae/config.ts`, `lib/trae/types.ts`.
- Built-in: `node:test`, `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Add coverage that QR/miniprogram candidate images from `traeEvidence.visualDemoImageUrls` are prioritized before generic screenshots so Kimi sees at least one likely demo-access image when the post is not a web app.
- 2026-07-01 Codex: Add coverage for legacy rows where QR/miniprogram text cues and image filenames must be enough to prioritize the likely demo-access image even without `visualDemoImageUrls`.
- 2026-07-01 Codex: Add coverage that the Kimi image-review prompt asks for the official screenshot evidence categories: Trae usage/development process and finished Demo/product interface.
- 2026-07-01 Codex: Implemented the prompt regression in `describeTopicImages()` tests.

## Important Notes / NEVER Change

- Keep tests network-free by injecting `fetchFn`.
- Do not call real NVIDIA/REMOVED_PROVIDER endpoints from unit tests.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-01 | QR/miniprogram demo evidence could be buried after the first 4 generic images. | Vision image selection used only `topic.imageUrls.slice(0, 4)`. | Add a failing regression for prioritizing `visualDemoImageUrls`. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created vision test documentation for multi-shape Demo evidence. | Codex |
| 2026-07-01 | Added regression that `visualDemoImageUrls` are prioritized before generic screenshots under the 4-image cap. | Codex |
| 2026-07-01 | Added legacy text/filename fallback regression for QR/miniprogram image priority. | Codex |
| 2026-07-01 | Planned Kimi prompt regression for official screenshot evidence categories. | Codex |
| 2026-07-01 | Added Kimi prompt regression for official screenshot evidence categories. | Codex |
| 2026-07-01 | Added Kimi prompt regression for official screenshot evidence categories. | Codex |

