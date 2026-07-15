# lib/trae/config.ts

> Last updated: 2026-07-12 | Protection: STANDARD

## Purpose

Reads and normalizes TRAE, zero-budget AI provider, and worker environment configuration.

## What It Does

- Supplies defaults for the Friend gateway (new-api, OpenAI-compatible), NVIDIA endpoint model names, limits, rate limits, and forum URLs.
- Supplies the Friend endpoint (`TRAE_FRIEND_API` key, `TRAE_FRIEND_BASE_URL`, `FRIEND_PRIMARY_MODEL`, `FRIEND_FALLBACK_MODELS`, `FRIEND_IMAGE_MODEL`, `FRIEND_IMAGE_FALLBACK_MODEL`). It proxies the same NVIDIA-family model IDs at higher rate limits and is the default primary provider (`AI_PROVIDER_ORDER=friend,nvidia`). Persisted as `NVIDIA` in Data Connect (no enum migration); the true endpoint stays visible in per-call `llmCallLogs`.
- Supplies all NVIDIA keys from `NVIDIA_API_KEY`, `NVIDIA_API_KEY_2`..`NVIDIA_API_KEY_20`, and comma-separated values in those env vars.
- Supplies `aiRpmLimit` (`AI_RPM_LIMIT`, default 40) as a per-key LLM request-start ceiling, not a global ceiling.
- Supplies `aiMaxRateLimitRetries` (`AI_MAX_RATE_LIMIT_RETRIES`, default 0) where 0 means unlimited rate-limit retries.
- Supplies `aiMaxRateLimitWaitMs` (`AI_MAX_RATE_LIMIT_WAIT_MS`, default 90_000) as a per-call wall-clock ceiling that bounds the unlimited retry count so one throttled call can't hang the cron; 0 disables it.
- Supplies `judgeConcurrency` (`TRAE_JUDGE_CONCURRENCY`, default from `DEFAULT_JUDGE_CONCURRENCY`, currently 8) for bounded topic-level judge parallelism.
- Supplies `judgeBatchDeadlineMs` (`TRAE_JUDGE_BATCH_DEADLINE_MS`, default 690_000) as the soft per-batch wall-clock budget after which `judgeChangedTraeTopics` stops taking new topics so the run finalizes within the Cloud Run timeout; 0 disables it.
- Supplies `judgeBatchHardDrainMs` (`TRAE_JUDGE_BATCH_HARD_DRAIN_MS`, default 90_000) as the max wait after the soft deadline before abandoning the concurrency await and calling `finishRun` (hard guarantee against zombie RUNNING rows).
- Does not expose a judge strategy switch. Scoring quality requires the four-evaluator plus consensus referee path only.
- Tunes the matcher's forum signup lookups: `maxForumLookupsPerRun` (env `TRAE_MAX_FORUM_LOOKUPS_PER_RUN`, default `0` = unlimited), `forumLookupConcurrency` (`TRAE_FORUM_LOOKUP_CONCURRENCY`, default 16), `forumMinRequestMs` per-host start spacing (`TRAE_FORUM_MIN_REQUEST_MS`, default 150), and `forumMaxRetries` (`TRAE_FORUM_MAX_RETRIES`, default 5). Defaults favor fastest convergence; the forum host is the only real limiter (Retry-After + host-wide cooldown + backoff cover throttling).
- Keeps NVIDIA text judging order explicit and separate from the preferred NVIDIA image/multimodal model, plus a distinct `nvidiaImageFallbackModel` (env `NVIDIA_IMAGE_FALLBACK_MODEL`, default `google/gemma-4-31b-it`) used when the primary image model soft-throttles.
- Keeps secret access server-side.
- Parses numeric env vars defensively.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getTraeConfig` | function | Returns normalized configuration, including `nvidiaApiKeys` and `aiMaxRateLimitRetries`. |

## Dependencies

- Internal: none.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Store defaults in code for non-secret values only; secrets remain required at execution time.
- 2026-06-29 Codex: Planned zero-budget AI provider config with NVIDIA first, REMOVED_PROVIDER second, no paid direct model-provider API, and no billing-dependent fallback.
- 2026-06-30 Codex: Live NVIDIA checks showed `moonshotai/kimi-k2.6`, `z-ai/glm-5.1`, and `deepseek-ai/deepseek-v4-flash` work on the text JSON path; MiniMax M3 exists but returns NVIDIA's HTTP-200 empty-choices soft throttle in current tests.
- 2026-06-30 Codex: Text judging should prefer Kimi K2.6 > GLM 5.1 > DeepSeek V4 Flash. DeepSeek should only be the last fallback and should request reasoning effort `max`, not `high`.
- 2026-07-01 Codex: Throughput defaults now come from `lib/trae/judge-policy.ts`; owner requested `100 / 20`, with env vars remaining optional overrides for local and job runs.
- 2026-07-02 Codex: Owner rejected making `fast` the default because score quality still requires the four evaluators plus consensus referee. Keep consensus as the default and raise topic-level concurrency so many evaluator teams run at once.
- 2026-07-02 Codex: Owner rejected keeping the single-LLM strategy at all. Remove `JudgeStrategy`, `judgeStrategy`, and `TRAE_JUDGE_STRATEGY` from config.
- 2026-07-02 Codex: Owner confirmed the provider quota is 40 rpm. Since each consensus team starts 5 LLM calls, default judging should use 8 topic teams and rely on the shared LLM limiter to pace starts at 40/minute.
- 2026-07-02 Claude: Added the Friend gateway as primary provider (`AI_PROVIDER_ORDER=friend,nvidia`). Live checks on 2026-07-02: `deepseek-ai/deepseek-v4-pro` (primary, ~49s reasoning latency), `minimaxai/minimax-m3`, and `moonshotai/kimi-k2.6` all return valid JSON on both endpoints. Removed `z-ai/glm-5.1` (HTTP 410 EOL 2026-07-02T00:00:00Z on the shared backend) and `deepseek-ai/deepseek-v4-flash` (hangs past the request timeout) from every fallback chain — both only burned wall-clock. Keep `AI_REQUEST_TIMEOUT_MS=120000`: deepseek-v4-pro legitimately needs ~49s, so a shorter timeout would kill real calls.
- 2026-07-04 Claude/Codex: User added a second NVIDIA key and wants 429s to retry instead of failing scored posts. Config now collects multiple NVIDIA keys, keeps `nvidiaApiKey` as first-key compatibility, treats `AI_RPM_LIMIT` as per-key capacity, and adds `AI_MAX_RATE_LIMIT_RETRIES=0` as unlimited retry budget.

## Important Notes / NEVER Change

- Never add hard-coded API keys, admin tokens, or service account JSON.
- Never add paid direct model-provider env vars or any paid provider configuration.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned config reader. | Codex |
| 2026-06-29 | Planned zero-budget NVIDIA/REMOVED_PROVIDER provider config update. | Codex |
| 2026-06-29 | Implemented NVIDIA/REMOVED_PROVIDER free endpoint config, provider order, RPM/retry/timeout controls, and removed REMOVED_PROVIDER-specific daily cap/RPM config. | Codex |
| 2026-06-29 | Default NVIDIA fallback models now kimi-k2.6, deepseek-v4-flash, minimax-m3 (primary stays deepseek-v4-pro). | Claude |
| 2026-06-30 | Planned NVIDIA text order update to DeepSeek V4 Pro, GLM 5.1, DeepSeek V4 Flash, with Kimi K2.6 kept as image/multimodal config. | Codex |
| 2026-06-30 | Implemented `nvidiaImageModel` config and updated default NVIDIA text fallbacks to GLM 5.1 then DeepSeek V4 Flash. | Codex |
| 2026-06-30 | Added `maxForumLookupsPerRun` (`TRAE_MAX_FORUM_LOOKUPS_PER_RUN`, default 40) bounding matcher forum lookups. | Claude |
| 2026-06-30 | Default lookups unlimited; added `forumLookupConcurrency` (16) and `forumMinRequestMs` (150) for fastest convergence (SQL fixed-cost, AI free). | Claude |
| 2026-06-30 | Added `forumMaxRetries` (`TRAE_FORUM_MAX_RETRIES`, default 5) for the 429/Retry-After backoff. | Claude |
| 2026-06-30 | Planned NVIDIA text order change to Kimi K2.6 primary, GLM 5.1 fallback, DeepSeek V4 Flash final fallback. | Codex |
| 2026-06-30 | Added `nvidiaImageFallbackModel` (`NVIDIA_IMAGE_FALLBACK_MODEL`, default `minimaxai/minimax-m3`) so `lib/trae/vision.ts` has a second vision-capable model when the primary soft-throttles. | Claude |
| 2026-07-01 | Added `judgeConcurrency` (`TRAE_JUDGE_CONCURRENCY`, default `1`) for bounded topic-level judging parallelism. | Codex |
| 2026-07-02 | Removed `judgeStrategy` config and the `TRAE_JUDGE_STRATEGY` env knob. | Codex |
| 2026-07-02 | Implemented config defaults for 40 rpm judging: `AI_RPM_LIMIT=40`, `TRAE_JUDGE_CONCURRENCY=8`, and overnight-sized judge batches. | Codex |
| 2026-07-02 | Added Friend gateway provider (primary); model chains now DeepSeek V4 Pro → MiniMax M3 → Kimi K2.6 on friend then nvidia. Dropped GLM 5.1 (410 EOL) and DeepSeek V4 Flash (hangs). | Claude |
| 2026-07-03 | Promoted GLM 5.2 (`z-ai/glm-5.2`) to primary text model on both friend and nvidia chains; DeepSeek V4 Pro demoted to first fallback → MiniMax M3 → Kimi K2.6. Image models unchanged. | Claude |
| 2026-07-04 | Added multi-key NVIDIA config and unlimited rate-limit retry budget. | Claude/Codex |
| 2026-07-09 | Added `aiMaxRateLimitWaitMs` (`AI_MAX_RATE_LIMIT_WAIT_MS`, default 90s) per-call rate-limit wall-clock ceiling and `judgeBatchDeadlineMs` (`TRAE_JUDGE_BATCH_DEADLINE_MS`, default 690s) per-batch deadline, so a throttled endpoint can no longer hang one call or run the batch past the cron timeout. | Claude |
| 2026-07-08 | Switched main text + image primary to `minimaxai/minimax-m3` on both friend and nvidia. Removed `moonshotai/kimi-k2.6` from every chain (upstream removed it). Added `google/gemma-4-31b-it` as first text fallback and image fallback; `deepseek-ai/deepseek-v4-pro` and `z-ai/glm-5.2` retained as deeper text fallbacks. | Claude |
| 2026-07-10 | Removed `minimaxai/minimax-m3` entirely (empty_content_billed). Primary text+image is now `google/gemma-4-31b-it`; fallbacks `deepseek-ai/deepseek-v4-pro`, `z-ai/glm-5.2`; image fallback deepseek-v4-pro. | Grok |
| 2026-07-11 | Added `judgeBatchHardDrainMs` (`TRAE_JUDGE_BATCH_HARD_DRAIN_MS`, default 90s) so soft deadline + drain always finishes under Cloud Run 900s. | Grok |
| 2026-07-12 | Changed `FRIEND_PRIMARY_MODEL` default to `grok-4.5` (friend gateway only; tested HTTP 200 + valid content + JSON mode). Demoted `google/gemma-4-31b-it` to first fallback. NVIDIA chain unchanged. Vision chain unchanged (grok-4.5 vision unverified). | GLM |
| 2026-07-12 | Reverted `FRIEND_PRIMARY_MODEL` default to `google/gemma-4-31b-it`. grok-4.5 is a reasoning model: 30-120s per judge call and `reasoning_content` accumulated in-memory until Cloud Run OOM'd (2GiB heap crash, process killed before any deadline could fire finishRun). grok-4.5 demoted to first fallback. Vision chain unchanged. | GLM |
| 2026-07-14 | Switched `FRIEND_PRIMARY_MODEL` default/local override to `nvidia/nemotron-3-ultra-550b-a55b` so friend-gateway judging uses Nemotron before the DeepSeek fallback chain. This is a model-selection change only; live deployment still needs a redeploy to pick it up. | Codex |

## Planned Change: Judge Concurrency Config

- 2026-07-01 Codex: Add `judgeConcurrency` from `TRAE_JUDGE_CONCURRENCY` so CLI/job/admin callers can opt into bounded parallel topic judging without changing model/provider settings.
- The default now comes from `DEFAULT_JUDGE_CONCURRENCY`, currently `100`, because throughput should come from many consensus evaluator teams running in parallel.
- Implemented in `getTraeConfig()` and documented in `.env.example`.

## Change Plan: Code Defaults For Judge Throughput

- 2026-07-01 Codex: Owner wants faster grading without repeatedly editing Cloud Run public env vars.
- Use shared code constants as fallbacks for `TRAE_JUDGE_CONCURRENCY` and `TRAE_MAX_JUDGE_PER_RUN`: `6` workers and `24` topics per batch.
- Env vars remain optional overrides for local scripts/jobs, not required Cloud Run setup.
- Implemented by importing `DEFAULT_JUDGE_CONCURRENCY` and `DEFAULT_JUDGE_BATCH_MAX` as config fallbacks.
- 2026-07-01 Codex: Update the documented target to `20` workers and `100` topics per batch after the owner asked for max concurrency.
- 2026-07-02 Codex: Update the target to `100` workers and `100` topics per batch after the owner clarified that evaluator teams should run in parallel.

## Change Plan: Consensus-Only Judging

- 2026-07-02 Codex: Deleted the strategy env parsing entirely.
- `getTraeConfig()` should keep throughput knobs only: `TRAE_JUDGE_CONCURRENCY` and `TRAE_MAX_JUDGE_PER_RUN`.
- Scoring behavior belongs in `judgeOneTopic()` and is always consensus-only.

## Implemented Change: 40 RPM Overnight Judging

- 2026-07-02 Codex: Changed the hard-coded `AI_RPM_LIMIT` fallback from 30 to 40 to match the owner's current quota.
- `TRAE_MAX_JUDGE_PER_RUN` remains a cap because `judgeChangedTraeTopics()` intentionally slices the queue for finite CLI/job/admin runs. The code default is now an overnight-sized batch so scheduled judging can drain thousands of newly scraped 初赛 topics.
- Clarify that scraping discovers/upserts all configured 初赛 posts, but judging only processes topics selected by mode (`unjudged`, `changed`, or `low-confidence`) and then capped by `max`.
## Change Plan: Remove REMOVED_PROVIDER

- 2026-07-03 Codex: Owner requested REMOVED_PROVIDER be deleted entirely because its models are no longer acceptable.
- Remove REMOVED_PROVIDER fields from `TraeConfig`, env parsing, defaults, and `AIProvider`.
- Restrict `AI_PROVIDER_ORDER` to `friend,nvidia`; invalid or empty values still fall back to `friend,nvidia`.
- Keep Friend and NVIDIA text model chains mirrored with `z-ai/glm-5.2` as primary and DeepSeek V4 Pro as first fallback.

