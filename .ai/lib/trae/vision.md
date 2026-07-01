# lib/trae/vision.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Gathers real visual evidence for judging: describes a topic's post images and captures/describes a live screenshot of its demo URL, using zero-budget vision models.

## What It Does

- `describeTopicImages()`: sends up to 4 of a topic's `imageUrls` (capped for token/cost control) as `image_url` parts to `callVisionLLMWithFallback()`, asking for an objective 2-4 sentence Chinese summary of what's actually shown (real product UI vs. marketing/concept art, completion quality). Returns `null` (never throws) when there are no images or every vision model call fails.
- `describeDemoScreenshot()`: if the topic has a `demoUrl`, builds a screenshot URL via `buildDemoScreenshotUrl()` and sends it as a single `image_url` part, asking whether the rendered page is a real interactive product, a static/marketing landing page, or broken/blank/error. Returns `null` on no demo URL or total failure.
- `buildDemoScreenshotUrl()`: wraps the demo URL with `https://image.thum.io/get/width/1200/noanimate/<url>` — a free, no-API-key screenshot proxy. thum.io fetches the target page server-side; we never connect to the (attacker-influenceable) demo URL ourselves. Rejects non-http(s) schemes.
- `gatherVisualEvidence()`: runs both calls concurrently and returns `{imageEvidence, demoEvidence}`, each independently nullable.
- All three async functions accept optional `fetchFn`/`sleepFn` (mirroring `lib/trae/llm.ts`'s injection pattern) for deterministic, network-free tests.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `gatherVisualEvidence` | function | Runs image + demo vision concurrently; the one function `judge.ts` calls. |
| `describeTopicImages` | function | Vision-describes up to 4 post images. |
| `describeDemoScreenshot` | function | Screenshots + vision-describes the demo URL. |
| `buildDemoScreenshotUrl` | function | Builds the thum.io screenshot URL for a demo link (or `null` if not http/https). |

## Dependencies

- Internal: `config`, `llm` (`callVisionLLMWithFallback`, `LLMContentPart`), `types`.
- External (at request time, not a package dependency): `image.thum.io` free screenshot proxy.

## Agent Decisions / Thoughts

- 2026-06-30 Claude: Chose a free third-party screenshot proxy (thum.io) over adding Playwright/Chromium. The app deploys both as a Vercel serverless function (30-min cron, tight `maxDuration`) and as a Cloud Run Job (`Dockerfile`, unbounded); a headless-browser dependency would only work in the latter and would need Docker/apt changes plus SSRF-safe URL handling on our own infra. A screenshot-URL proxy needs zero new dependencies, works identically in both deploy targets, and moves the "fetch an arbitrary user-submitted URL" risk to a third party that already exists for this purpose (same trust model as any link-preview widget).
- 2026-06-30 Claude: Verified live (real API key, real forum CDN image, real thum.io screenshot of a real contest demo) that both `moonshotai/kimi-k2.6` and `minimaxai/minimax-m3` correctly describe remote `image_url` content before writing any of this module — see `.ai/lib/trae/judge.md`'s visual-evidence fix-plan section for the transcript summary.
- 2026-06-30 Claude: Both public functions swallow every failure mode (missing images, missing demo URL, non-http scheme, all vision models throttled/erroring) and resolve to `null` rather than throwing, so a flaky vision model degrades the judge back to the pre-existing "not performed" disclaimer instead of failing the whole evaluation.
- 2026-06-30 Claude: Deliberately did not persist evidence on the `Topic` row — recomputes on every `judgeOneTopic()` call. Adding a cache column means a Data Connect schema migration and generated-SDK regeneration, out of scope for this fix; acceptable given current judge volume.
- 2026-07-01 Codex: Visual selection should also infer QR/miniprogram priority from legacy topic text and image filenames when `traeEvidence.visualDemoImageUrls` is absent, so old rows can be rejudged without losing the likely demo-access image under the 4-image cap.
- 2026-07-01 Codex: Official screenshot evidence should be evaluated as ordinary uploaded screenshots, not only web Demo browsing. The vision prompt should explicitly ask Kimi to distinguish whether images show Trae usage/development process and whether images show the finished Demo/product interface.
- 2026-07-01 Codex: Implemented explicit Kimi wording for official screenshot evidence categories in `describeTopicImages()`.

## Important Notes / NEVER Change

- Never fetch the topic's `demoUrl` directly from our own server — always go through the screenshot proxy so arbitrary forum-submitted URLs never touch our infra as an outbound request target.
- Never let a vision failure throw out of `gatherVisualEvidence()` — it must always resolve, so judging degrades gracefully instead of failing.
- Never claim in judge prompts that evidence was gathered when the corresponding field is `null`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Implemented `describeTopicImages`, `describeDemoScreenshot`, `buildDemoScreenshotUrl`, `gatherVisualEvidence`. | Claude |
| 2026-07-01 | Planned visual demo image prioritization for non-web submissions. | Codex |
| 2026-07-01 | Implemented visual demo image prioritization so QR/miniprogram images are sent to vision before generic screenshots. | Codex |
| 2026-07-01 | Implemented legacy text/filename fallback for QR/miniprogram image priority. | Codex |
| 2026-07-01 | Planned explicit Kimi image-review wording for official screenshot evidence categories. | Codex |
| 2026-07-01 | Implemented Kimi image-review wording for official screenshot evidence categories. | Codex |
| 2026-07-01 | Implemented explicit Kimi image-review wording for Trae usage screenshots and finished Demo/product screenshots. | Codex |

## Planned Change: Visual Demo Image Priority

- 2026-07-01 Codex: Owner reported posts visibly containing images can still show "no images" or fail to use the right evidence for mini-program/app demos. The extractor will mark likely QR/demo-access images in `traeEvidence.visualDemoImageUrls`; `describeTopicImages()` should prioritize those before generic screenshots while keeping the existing cap.
- Keep the existing no-throw behavior: if Kimi/vision fails, judging must still proceed with honest evidence-limit wording.
- Implemented: `describeTopicImages()` prepends `visualDemoImageUrls`, then likely QR/miniprogram filenames inferred from legacy text cues, then `imageUrls`; it dedupes before applying the existing 4-image cap.
