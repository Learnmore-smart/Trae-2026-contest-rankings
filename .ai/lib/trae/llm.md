# lib/trae/llm.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Provides a provider-agnostic, zero-budget LLM client for OpenAI-compatible chat completions, including vision (image_url) calls.

## What It Does

- Builds the model fallback plan from `AI_PROVIDER_ORDER` (default `friend,nvidia`).
- Calls the Friend gateway (new-api, OpenAI-compatible) first, then NVIDIA direct; OpenRouter remains configured but is no longer in the default order (its free tier is quota-capped at ~50/day).
- Retries retryable failures with bounded exponential backoff (longer base delay for rate limits).
- Treats NVIDIA's HTTP 200 + empty `choices` reply (a soft 429) as a retryable `rate_limited` error.
- Adds NVIDIA DeepSeek reasoning effort `max` for DeepSeek V4 fallback calls, leaving Kimi and GLM request bodies unchanged.
- Records provider, model, latency, retry count, error reason, and raw response for every attempt.
- Rejects paid provider fallbacks by construction.
- `LLMMessage.content` accepts either a plain string or an array of `{type: "text"}` / `{type: "image_url"}` parts, so callers can send multimodal vision requests through the same request builder.
- `responseFormat` option (default `"json_object"`) controls whether `response_format: {type: "json_object"}` is sent; vision calls use `"text"` since descriptions are prose, not schema-bound JSON.
- `callVisionLLMWithFallback()` reuses the same retry/fallback loop but scopes the plan to `buildVisionLLMFallbackPlan()` (Friend vision models first, then NVIDIA; deduped by `provider:model`) via the `plan` override option on `callLLMWithFallback`.
- Enforces a shared request-start rate limiter from `AI_RPM_LIMIT` before each real model attempt, so concurrent evaluator teams are paced instead of bursting above the provider quota.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `callLLMWithFallback` | function | Calls configured free models in provider order until one returns valid content. Accepts a `plan` override and `responseFormat`. |
| `buildLLMFallbackPlan` | function | Produces the ordered text-model provider/model plan used by the client. |
| `callVisionLLMWithFallback` | function | Same retry/fallback semantics, scoped to vision-capable models, text response format. |
| `buildVisionLLMFallbackPlan` | function | Produces the ordered vision-model plan: Friend image + fallback models, then NVIDIA image + fallback models, deduped by `provider:model`. |

## Dependencies

- Internal: `config`.
- Built-in: `node:timers/promises`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep provider fallback independent from judge parsing so future scoring workflows can share the same free-only client.
- 2026-06-29 Codex: Treat invalid judge JSON as a model-call failure through a validator callback so fallback behavior stays centralized.
- 2026-06-29 Codex: Parse OpenAI-compatible response `usage` into per-attempt input/output token fields so downstream code can persist token totals without exposing provider details publicly.
- 2026-06-30 Codex: Apply `reasoning_effort: "max"` only for NVIDIA DeepSeek models so the final fallback uses max thinking while Kimi K2.6 and GLM 5.1 stay fast/default.
- 2026-06-30 Claude: Verified live against the real NVIDIA endpoint that `moonshotai/kimi-k2.6` and `minimaxai/minimax-m3` both accept `image_url` content pointing at a remote HTTPS URL (no base64 upload needed) and return accurate descriptions — this is what makes `lib/trae/vision.ts` possible without adding a screenshot-hosting step.
- 2026-06-30 Claude: Kept the vision plan NVIDIA-only (no OpenRouter fallback) since only two NVIDIA models are verified vision-capable; guessing at OpenRouter free-tier vision support risked a confusing silent failure instead of the clean "not performed" degradation.
- 2026-07-02 Claude: Root-caused the judge stall — since ~2026-07-02T00:00Z every evaluator call failed (NVIDIA 429 on kimi/deepseek, GLM 5.1 410 EOL, OpenRouter free daily cap exhausted). Added the Friend gateway as the primary provider and routed vision friend-first too, so all LLM traffic shares one fast endpoint. `friend` is a distinct runtime provider but persists as `NVIDIA` (proxies the same models) to avoid a Data Connect enum migration; the real endpoint stays in per-call logs. Verified live: a `json_object` evaluator call now succeeds on attempt #1 via `friend:deepseek-ai/deepseek-v4-pro`.

## Important Notes / NEVER Change

- Do not add paid direct model-provider API support.
- Do not auto-fallback to paid OpenRouter or any billing-dependent provider.
- Do not log API keys, request authorization headers, or private secrets.

## Implemented Change: 40 RPM LLM Pacing

- 2026-07-02 Codex: Owner has a 40 rpm API quota and each consensus evaluator team uses 5 LLM calls. The quota is now enforced in the shared LLM client, not in judge-specific code, so text and vision calls share one process-wide pacing queue.
- Added a small process-wide async gate in `callLLMWithFallback()` that waits before `callOneModel()` when a real API attempt is about to start.
- Uses `config.aiRpmLimit` as starts-per-minute; with 40 rpm this means one model attempt may start every 1500ms in this process.
- Keep retry backoff separate: after a retryable failure, the retry still waits for both the backoff and the shared start gate.
- Tests inject the same `sleepFn` used for retry backoff so the limiter can be verified without waiting in real time.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned provider-agnostic zero-budget LLM client. | Codex |
| 2026-06-29 | Implemented OpenAI-compatible NVIDIA/OpenRouter fallback client with per-attempt logs, timeout handling, validation fallback, and exponential backoff. | Codex |
| 2026-06-29 | Implemented per-attempt token usage capture from response usage payloads. | Codex |
| 2026-06-29 | Classify NVIDIA soft-throttle (HTTP 200, empty choices) as retryable `rate_limited`; raise rate-limit backoff base to 2s. | Claude |
| 2026-06-30 | Planned NVIDIA DeepSeek request option to use max reasoning effort on the final fallback. | Codex |
| 2026-06-30 | Implemented multimodal `LLMContentPart` message content, `responseFormat` option, plan override, `buildVisionLLMFallbackPlan`, and `callVisionLLMWithFallback`. | Claude |
| 2026-07-02 | Implemented shared `AI_RPM_LIMIT` request-start pacing for all LLM attempts. | Codex |
| 2026-07-02 | Added Friend gateway as default primary provider (text + vision); dropped GLM 5.1 (410 EOL) and DeepSeek V4 Flash (hangs) from all chains. | Claude |
