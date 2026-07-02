# lib/trae/judge.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Scores preliminary TRAE Demo topics through the zero-budget LLM fallback client.

## What It Does

- Builds strict JSON prompts from contest criteria.
- Gathers real visual evidence once per topic via `gatherVisualEvidence()` (post-image vision + an automatic demo-URL screenshot vision pass) before building any prompt, and folds the resulting summaries into the shared base prompt.
- Processes selected topic slices with bounded in-process concurrency via `runWithConcurrency()`.
- Uses `callLLMWithFallback()` so all model calls share provider order, retries, timeout, and logging behavior.
- Uses only the four-evaluator plus consensus referee path. No single-evaluator judge strategy is allowed.
- Handles 429, timeout, invalid JSON, validation errors, and model fallbacks.
- Writes SQL `evaluations`, updates denormalized topic scoring fields, and records token usage through Data Connect.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `judgeChangedTraeTopics` | function | Scores topics needing judging. |
| `runWithConcurrency` | function | Runs local async work with a fixed maximum number of workers. |
| `parseEvaluationJson` | function | Parses and repairs model JSON output. |
| `buildJudgePrompt` | function | Creates the model prompt for one topic. |

## Dependencies

- Internal: `config`, `dataconnect`, `llm`, `runs`, `types`, `vision`.
- Generated SDK: `getBoardPage`, `upsertEvaluation`, `updateTopicEvaluationState`, `upsertModelTokenUsage`.
- External: `zod`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Treat compliance as risk context inside scoring details, not as a separate public audit page.
- 2026-06-29 Codex: Planned migration from OpenRouter-only judge calls to NVIDIA-first free endpoint fallback with OpenRouter free models only after NVIDIA fails.
- 2026-06-29 Codex: Persist cumulative token usage in a model/provider keyed Firestore collection by incrementing input/output totals after each judged or failed model call.
- 2026-06-30 Codex: AI scoring must stay on the zero-budget LLM fallback path while all persistence goes through Data Connect mutations.
- 2026-06-30 Codex: Data Connect `UpsertEvaluation` owns `createdAt` through `createdAt_expr: "request.time"`; judge code must send only declared mutation variables and must not spread `TraeEvaluation` directly into the mutation payload.
- 2026-07-01 Codex: Reported bug shows the judge can overstate "material risk" when automatic demo screenshot or image vision fails even though the post provides Demo/image evidence. Prompt wording should separate contestant-provided material absence from our automation verification limits. Automation failure may reduce confidence, but it must not be phrased as missing Demo/images by itself.
- 2026-07-01 Codex: Implemented the guardrail in both evaluator and consensus prompts, because the final stored text comes from the consensus referee. The prompt now lists detected Demo-like URL count and tells the model not to describe automation failure as missing contestant materials when public URLs exist.
- 2026-07-01 Codex: Update compliance hints to key off generalized Demo evidence (`web_url`, `download`, `qr_or_image`) rather than `topic.demoUrl` alone. Missing web screenshot is not a material defect for non-web apps.
- 2026-07-01 Codex: Judge should infer non-web Demo evidence from legacy topic fields (`attachmentUrls`, QR/miniprogram text cues, `imageUrls`) so rejudging older scraped rows does not require a full re-scrape before avoiding false "missing Demo" risks.
- 2026-07-01 Codex: Final scoring prompt should explicitly treat uploaded ordinary screenshots as official material evidence. The model must evaluate whether image vision shows Trae usage/development process screenshots and finished Demo/product interface screenshots, not only whether a web Demo URL was opened.
- 2026-07-01 Codex: Verified existing final scoring prompt already contains the uploaded screenshot evidence rule; added regression coverage without changing judge runtime code.
- 2026-07-01 Codex: The automatic judge queue must include stale evaluations whose `promptVersion` differs from the current `PROMPT_VERSION`, otherwise fixes to extraction/vision/prompt wording will not repair old public scores. Keep already-current judged topics out of the queue to avoid infinite rejudging.
- 2026-07-01 Codex: Bump `PROMPT_VERSION` after the screenshot-evidence fixes so already-judged v3 rows become stale and are automatically re-scored.
- 2026-07-01 Codex: Owner reported the public count is stuck at `149/3,702`. Root cause: default `unjudged` mode was spending capacity on stale prompt-version rejudges, and the judge source still read only `GetBoardData`'s first 1000 topics. Change default `unjudged` to true unscored rows, reserve stale prompt rejudge for `changed`, and page judge candidates through `GetBoardPage`.
- 2026-07-02 Codex: Owner wants score quality preserved: default must remain four evaluators plus consensus referee. Throughput should come from running many evaluator teams in parallel, not switching to a one-call judge.
- 2026-07-02 Codex: Owner rejected keeping any single-LLM/fast path at all. Remove the fast strategy, its env switch, and its stored prompt/raw-response helpers.

## Planned Change: SQL Connect Runtime

- 2026-06-30 Codex: Update imports from the legacy Firestore helper to `dataconnect.ts`; keep LLM fallback tests as the primary offline AI verification and use SQL smoke checks for persistence.
- Implemented: judge persistence imports `dataconnect.ts`; the unused token usage helper was removed.

## Important Notes / NEVER Change

- Provider API keys must never leave the server.
- Signup topics must never be judged.
- All LLM scoring calls must go through `callLLMWithFallback()`.
- If all free models fail, keep the topic in `judge_error` for a later scheduled retry; never switch to a paid API.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned OpenRouter judge module. | Codex |
| 2026-06-29 | Planned zero-budget provider fallback migration. | Codex |
| 2026-06-29 | Replaced direct OpenRouter calls with `callLLMWithFallback()` and stored provider/call-log metadata on success and failure evaluations. | Codex |
| 2026-06-29 | Implemented Firestore token usage aggregation for judge model calls. | Codex |
| 2026-06-30 | Planned Data Connect judge persistence verification. | Codex |
| 2026-06-30 | Verified offline LLM fallback tests; live judge run was blocked by escalation usage limits. | Codex |
| 2026-06-30 | Planned fix for Data Connect judge failure caused by sending client-side `createdAt` to `UpsertEvaluation`. | Codex |
| 2026-07-01 | Planned multi-evaluator consensus judging so each topic is scored by four independent requests plus one consensus request. | Codex |
| 2026-07-01 | Implemented four-evaluator plus consensus judging and explicit evidence-limit prompts. | Codex |
| 2026-06-30 | Planned real visual evidence (post-image vision + automatic demo screenshot vision) to replace the "not performed" disclaimers. | Claude |
| 2026-06-30 | Implemented `gatherVisualEvidence()` wiring in `judgeOneTopic()`; bumped `PROMPT_VERSION` to `v3-visual-evidence`; added explicit static-page-must-not-score-high grading guidance to the completion/design dimensions. | Claude |
| 2026-07-01 | Added bounded judge topic concurrency and logs the applied concurrency per judge run. | Codex |
| 2026-07-01 | Planned wording guardrail so visual automation failures are not misreported as contestant material absence. | Codex |
| 2026-07-01 | Implemented Demo-like URL listing and automation-limit wording in base/evaluator/consensus prompts. | Codex |
| 2026-07-01 | Planned non-web Demo evidence handling in judge prompts and risk hints. | Codex |
| 2026-07-01 | Implemented generalized Demo evidence handling in prompt context, evidence limits, and compliance risk hints. | Codex |
| 2026-07-01 | Implemented legacy-field fallback for non-web Demo evidence during rejudge. | Codex |
| 2026-07-01 | Planned explicit judge guidance for ordinary uploaded screenshot evidence categories. | Codex |
| 2026-07-01 | Verified explicit judge guidance and added regression coverage for ordinary uploaded screenshot evidence categories. | Codex |
| 2026-07-01 | Implemented explicit judge guidance that uploaded screenshots can satisfy official ordinary screenshot material requirements. | Codex |
| 2026-07-01 | Planned stale prompt-version rejudge selection for automatic judging. | Codex |
| 2026-07-01 | Planned prompt-version bump for automatic old-score rejudge. | Codex |
| 2026-07-01 | Implemented stale prompt-version queue selection and bumped `PROMPT_VERSION` to `v4-official-screenshot-evidence`. | Codex |
| 2026-07-01 | Planned true-unjudged default queue and paged judge candidate reads to unblock score-count progress beyond 149. | Codex |
| 2026-07-02 | Planned consensus default with more parallel evaluator teams. | Codex |
| 2026-07-02 | Deleted the single-evaluator fast judge path. | Codex |

## Change Plan: Consensus Only With Parallel Evaluator Teams

- 2026-07-02 Codex: Removed `JudgeStrategy`, `TRAE_JUDGE_STRATEGY`, `judgeOneTopicFast()`, and all `FAST SINGLE-EVALUATOR RUN` storage helpers.
- `judgeOneTopic()` should always gather visual evidence and then call the consensus evaluator team path.
- Throughput remains controlled by `DEFAULT_JUDGE_CONCURRENCY = 100`, so many consensus evaluator teams can run in parallel without lowering score quality.
- Added regression coverage that the fast/single-evaluator symbols and env knob do not reappear.

## Planned Change: Bounded Judge Concurrency

- 2026-07-01 Codex: Owner confirmed admin judging should run `max: 12` with `concurrency: 3`. The safe implementation is in-process bounded concurrency over one selected topic slice, not parallel admin requests, because separate requests can read the same unjudged backlog and duplicate work.
- Add a small tested concurrency helper exported for offline tests.
- Extend `JudgeOptions` with `concurrency`, defaulting to config, clamped to `1..max`, and keep each worker writing success/error state for its own topic.
- Preserve zero-budget fallback and per-topic visual/evaluator/consensus behavior; only change how many selected topics are processed at once.
- Implemented: `JudgeOptions.concurrency`, `runWithConcurrency()`, config fallback, and per-run completion log include the applied concurrency.

## Scoring Fix Plan: Multi-Evaluator Consensus

- 2026-07-01 Codex: Owner reported the current single-LLM score is too subjective and can over-rank weak/static demos. Current implementation confirms that concern: `judgeOneTopic()` makes one text-only LLM call, passes only image count and demo URL text, and does not browse the demo or inspect images.
- Fix strategy: keep the zero-budget provider fallback path, but run four independent evaluator prompts for one topic: product value, technical/completion, UX/design, and risk/material evidence. Then run one consensus/referee prompt that compares the four JSON evaluations and returns the canonical `EvaluationOutput`.
- Persistence strategy: store the final consensus score in the existing `evaluations` row, while preserving all evaluator/referee model attempts in `llmCallLogs` and saving a combined raw model response for audit.
- Evidence honesty: until a browser/vision evidence pipeline is added, prompts must explicitly state that image vision and interactive demo browsing were not performed, so the model cannot claim it saw screenshots or used the demo.

## Scoring Fix Plan: Real Visual Evidence (Image Vision + Demo Screenshot Vision)

- 2026-06-30 Claude: Owner reported (a) scoring is still too subjective for a single evaluator's taste and wanted the existing 4-evaluator-plus-referee design confirmed as the answer, (b) the #1-ranked entry was "just a poor static webpage" scoring too high, (c) it was unclear whether post images were ever actually inspected, and (d) it was unclear whether the judge ever opened/rendered the demo link like a human would. Investigation confirmed (b)-(d): the multi-evaluator consensus mechanism already existed uncommitted, but every prompt explicitly disclaimed "image vision was not performed" / "interactive demo browsing was not performed" — the pipeline never looked at any image or demo page.
- Verified live against the real NVIDIA endpoint before building anything: `moonshotai/kimi-k2.6` (config's `nvidiaImageModel`) and `minimaxai/minimax-m3` both correctly describe real remote `image_url` content (forum CDN screenshots and a thum.io-rendered page). This confirms the owner's instinct to use Kimi K2.6 for vision; MiniMax M3 works too but is kept as the fallback since `config.md`'s change history records it soft-throttling on the text path.
- Demo browsing strategy: rather than adding a headless-browser dependency (Playwright/Chromium), which would need Docker/Cloud-Run-only support and wouldn't run in the lighter Vercel cron path, use `https://image.thum.io/get/width/1200/noanimate/<url>` — a free, no-API-key screenshot proxy. thum.io fetches the target URL server-side (we never connect to attacker-controlled demo URLs ourselves), then the vision model fetches thum.io's image server-side. Verified live: it correctly rendered a real Netlify-hosted contest demo and the vision model gave an accurate, useful "is this a real product or a static landing page" assessment.
- No new Data Connect schema/persistence: visual evidence is recomputed on every `judgeOneTopic()` call (not cached on the topic row) to avoid a schema migration + generated-SDK regeneration in this pass. Acceptable at this scale; a future pass could cache it on `Topic.traeEvidence` (already a flexible `Any` column) keyed by `contentHash`/`demoUrl` if re-judge volume makes the repeated vision calls costly.
- Both vision calls (`describeTopicImages`, `describeDemoScreenshot`) swallow their own failures and resolve to `null` — a throttled/broken vision model degrades gracefully back to the old honest "not performed" disclaimer instead of failing the whole judge run.
- Known limitation, stated plainly rather than silently: this captures a single above-the-fold screenshot of the demo's homepage, not a multi-page click-through. It answers "is this obviously just a static/marketing page" but not "does every internal flow work." Real Playwright-based click-through automation remains a possible future upgrade, gated to the Cloud Run Job path only (see `Dockerfile`/README's Cloud Run Job section) since it cannot run in a Vercel serverless function.
