# lib/trae/llm.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides a provider-agnostic, zero-budget LLM client for OpenAI-compatible chat completions.

## What It Does

- Builds the model fallback plan from `AI_PROVIDER_ORDER`.
- Calls NVIDIA free endpoint first, then OpenRouter free models.
- Retries retryable failures with bounded exponential backoff (longer base delay for rate limits).
- Treats NVIDIA's HTTP 200 + empty `choices` reply (a soft 429) as a retryable `rate_limited` error.
- Adds NVIDIA DeepSeek reasoning effort `max` for DeepSeek V4 fallback calls, leaving Kimi and GLM request bodies unchanged.
- Records provider, model, latency, retry count, error reason, and raw response for every attempt.
- Rejects paid provider fallbacks by construction.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `callLLMWithFallback` | function | Calls configured free models in provider order until one returns valid content. |
| `buildLLMFallbackPlan` | function | Produces the ordered provider/model plan used by the client. |

## Dependencies

- Internal: `config`.
- Built-in: `node:timers/promises`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep provider fallback independent from judge parsing so future scoring workflows can share the same free-only client.
- 2026-06-29 Codex: Treat invalid judge JSON as a model-call failure through a validator callback so fallback behavior stays centralized.
- 2026-06-29 Codex: Parse OpenAI-compatible response `usage` into per-attempt input/output token fields so downstream code can persist token totals without exposing provider details publicly.
- 2026-06-30 Codex: Apply `reasoning_effort: "max"` only for NVIDIA DeepSeek models so the final fallback uses max thinking while Kimi K2.6 and GLM 5.1 stay fast/default.

## Important Notes / NEVER Change

- Do not add paid direct model-provider API support.
- Do not auto-fallback to paid OpenRouter or any billing-dependent provider.
- Do not log API keys, request authorization headers, or private secrets.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned provider-agnostic zero-budget LLM client. | Codex |
| 2026-06-29 | Implemented OpenAI-compatible NVIDIA/OpenRouter fallback client with per-attempt logs, timeout handling, validation fallback, and exponential backoff. | Codex |
| 2026-06-29 | Implemented per-attempt token usage capture from response usage payloads. | Codex |
| 2026-06-29 | Classify NVIDIA soft-throttle (HTTP 200, empty choices) as retryable `rate_limited`; raise rate-limit backoff base to 2s. | Claude |
| 2026-06-30 | Planned NVIDIA DeepSeek request option to use max reasoning effort on the final fallback. | Codex |
