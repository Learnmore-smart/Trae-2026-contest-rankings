# lib/trae/config.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Reads and normalizes TRAE, zero-budget AI provider, and worker environment configuration.

## What It Does

- Supplies defaults for NVIDIA and OpenRouter free endpoint model names, limits, rate limits, and forum URLs.
- Supplies `judgeConcurrency` (`TRAE_JUDGE_CONCURRENCY`, default 1) for bounded topic-level judge parallelism.
- Tunes the matcher's forum signup lookups: `maxForumLookupsPerRun` (env `TRAE_MAX_FORUM_LOOKUPS_PER_RUN`, default `0` = unlimited), `forumLookupConcurrency` (`TRAE_FORUM_LOOKUP_CONCURRENCY`, default 16), `forumMinRequestMs` per-host start spacing (`TRAE_FORUM_MIN_REQUEST_MS`, default 150), and `forumMaxRetries` (`TRAE_FORUM_MAX_RETRIES`, default 5). Defaults favor fastest convergence; the forum host is the only real limiter (Retry-After + host-wide cooldown + backoff cover throttling).
- Keeps NVIDIA text judging order explicit and separate from the preferred NVIDIA image/multimodal model, plus a distinct `nvidiaImageFallbackModel` (env `NVIDIA_IMAGE_FALLBACK_MODEL`, default `minimaxai/minimax-m3`) used when the primary image model soft-throttles.
- Keeps secret access server-side.
- Parses numeric env vars defensively.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getTraeConfig` | function | Returns normalized configuration. |

## Dependencies

- Internal: none.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Store defaults in code for non-secret values only; secrets remain required at execution time.
- 2026-06-29 Codex: Planned zero-budget AI provider config with NVIDIA first, OpenRouter second, no paid direct model-provider API, and no billing-dependent fallback.
- 2026-06-30 Codex: Live NVIDIA checks showed `moonshotai/kimi-k2.6`, `z-ai/glm-5.1`, and `deepseek-ai/deepseek-v4-flash` work on the text JSON path; MiniMax M3 exists but returns NVIDIA's HTTP-200 empty-choices soft throttle in current tests.
- 2026-06-30 Codex: Text judging should prefer Kimi K2.6 > GLM 5.1 > DeepSeek V4 Flash. DeepSeek should only be the last fallback and should request reasoning effort `max`, not `high`.

## Important Notes / NEVER Change

- Never add hard-coded API keys, admin tokens, or service account JSON.
- Never add paid direct model-provider env vars or any paid provider configuration.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned config reader. | Codex |
| 2026-06-29 | Planned zero-budget NVIDIA/OpenRouter provider config update. | Codex |
| 2026-06-29 | Implemented NVIDIA/OpenRouter free endpoint config, provider order, RPM/retry/timeout controls, and removed OpenRouter-specific daily cap/RPM config. | Codex |
| 2026-06-29 | Default NVIDIA fallback models now kimi-k2.6, deepseek-v4-flash, minimax-m3 (primary stays deepseek-v4-pro). | Claude |
| 2026-06-30 | Planned NVIDIA text order update to DeepSeek V4 Pro, GLM 5.1, DeepSeek V4 Flash, with Kimi K2.6 kept as image/multimodal config. | Codex |
| 2026-06-30 | Implemented `nvidiaImageModel` config and updated default NVIDIA text fallbacks to GLM 5.1 then DeepSeek V4 Flash. | Codex |
| 2026-06-30 | Added `maxForumLookupsPerRun` (`TRAE_MAX_FORUM_LOOKUPS_PER_RUN`, default 40) bounding matcher forum lookups. | Claude |
| 2026-06-30 | Default lookups unlimited; added `forumLookupConcurrency` (16) and `forumMinRequestMs` (150) for fastest convergence (SQL fixed-cost, AI free). | Claude |
| 2026-06-30 | Added `forumMaxRetries` (`TRAE_FORUM_MAX_RETRIES`, default 5) for the 429/Retry-After backoff. | Claude |
| 2026-06-30 | Planned NVIDIA text order change to Kimi K2.6 primary, GLM 5.1 fallback, DeepSeek V4 Flash final fallback. | Codex |
| 2026-06-30 | Added `nvidiaImageFallbackModel` (`NVIDIA_IMAGE_FALLBACK_MODEL`, default `minimaxai/minimax-m3`) so `lib/trae/vision.ts` has a second vision-capable model when the primary soft-throttles. | Claude |
| 2026-07-01 | Added `judgeConcurrency` (`TRAE_JUDGE_CONCURRENCY`, default `1`) for bounded topic-level judging parallelism. | Codex |

## Planned Change: Judge Concurrency Config

- 2026-07-01 Codex: Add `judgeConcurrency` from `TRAE_JUDGE_CONCURRENCY`, default `1`, so CLI/job/admin callers can opt into bounded parallel topic judging without changing model/provider settings.
- Keep the default conservative for cron/serverless paths; the admin client will explicitly request concurrency `3` for the approved manual run.
- Implemented in `getTraeConfig()` and documented in `.env.example`.

## Change Plan: Code Defaults For Judge Throughput

- 2026-07-01 Codex: Owner wants faster grading without repeatedly editing Cloud Run public env vars.
- Use shared code constants as fallbacks for `TRAE_JUDGE_CONCURRENCY` and `TRAE_MAX_JUDGE_PER_RUN`: `6` workers and `24` topics per batch.
- Env vars remain optional overrides for local scripts/jobs, not required Cloud Run setup.
- Implemented by importing `DEFAULT_JUDGE_CONCURRENCY` and `DEFAULT_JUDGE_BATCH_MAX` as config fallbacks.
