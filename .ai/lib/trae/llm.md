# lib/trae/llm.ts

> Last updated: 2026-07-04 | Protection: STANDARD

## Purpose

Provides a provider-agnostic, zero-budget LLM client for OpenAI-compatible chat completions, including vision (image_url) calls.

## What It Does

- Builds the model fallback plan from `AI_PROVIDER_ORDER` (default `friend,nvidia`).
- Calls the Friend gateway (new-api, OpenAI-compatible) first, then NVIDIA direct; paid or removed providers are intentionally not part of the plan.
- Retries non-rate-limit transient failures with bounded exponential backoff.
- Handles rate limits (`http_429` and NVIDIA soft-429) by trying every configured free provider/key lane before waiting and retrying the full plan unless `AI_MAX_RATE_LIMIT_RETRIES` caps it.
- Treats NVIDIA's HTTP 200 + empty `choices` reply (a soft 429) as a retryable `rate_limited` error.
- Adds NVIDIA DeepSeek reasoning effort `max` for DeepSeek V4 fallback calls, leaving Kimi and GLM request bodies unchanged.
- Records provider, model, latency, retry count, error reason, and raw response for every attempt.
- Records sanitized thrown-error details for network/timeout attempts.
- Exports `formatLLMCallFailureSummary()` so CLI callers can print compact provider/model diagnostics without exposing secrets.
- Rejects paid provider fallbacks by construction.
- `LLMMessage.content` accepts either a plain string or an array of `{type: "text"}` / `{type: "image_url"}` parts, so callers can send multimodal vision requests through the same request builder.
- `responseFormat` option (default `"json_object"`) controls whether `response_format: {type: "json_object"}` is sent; vision calls use `"text"` since descriptions are prose, not schema-bound JSON.
- `callVisionLLMWithFallback()` reuses the same retry/fallback loop but scopes the plan to `buildVisionLLMFallbackPlan()` (Friend vision models first, then NVIDIA; deduped by `provider:model`) and opts out of unlimited rate-limit waiting because vision is best-effort.
- Enforces per-API-key request-start rate limiters from `AI_RPM_LIMIT` before each real model attempt; two NVIDIA keys at 40 rpm each produce 80 rpm total direct NVIDIA capacity.
- Classifies empty-content HTTP 200 responses into three modes: `rate_limited` (empty choices array, NVIDIA soft-429), `empty_content_billed` (choices non-empty + content null + input tokens > 0, model/gateway-level failure), and `invalid_response` (other).
- Does NOT retry `empty_content_billed` on the same model — advances to the next model immediately, since this failure mode is model/gateway-level and retrying only wastes billed input tokens.
- Emits a `[trae-llm] empty_content_billed:` console warning with provider/model/token counts and a sanitized rawResponse summary when this mode is detected, for fast grep-based diagnosis.
- Exports `isSystemicLLMFallbackError(error)` — true when an `LLMFallbackError`'s callLogs contain ≥2 `empty_content_billed` entries, used by the judge pipeline to abort early on systemic model/gateway outages.
- Exports `truncateDiagnostic(value, maxLength)` for reuse by the admin health-check endpoint.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `callLLMWithFallback` | function | Calls configured free models in provider order until one returns valid content. Accepts a `plan` override, `responseFormat`, and `retryRateLimitsUntilCleared` option. |
| `buildLLMFallbackPlan` | function | Produces the ordered text-model provider/model plan used by the client. |
| `callVisionLLMWithFallback` | function | Same retry/fallback semantics, scoped to vision-capable models, text response format. |
| `buildVisionLLMFallbackPlan` | function | Produces the ordered vision-model plan: Friend image + fallback models, then NVIDIA image + fallback models, deduped by `provider:model`. |
| `isSystemicLLMFallbackError` | function | True when a fallback chain failed with ≥2 `empty_content_billed` model attempts — a systemic model/gateway outage, not a transient blip. |
| `truncateDiagnostic` | function | Sanitizes API keys/tokens and truncates a string to a max length for safe diagnostic logging. |

## Dependencies

- Internal: `config`.
- Built-in: `node:timers/promises`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep provider fallback independent from judge parsing so future scoring workflows can share the same free-only client.
- 2026-06-29 Codex: Treat invalid judge JSON as a model-call failure through a validator callback so fallback behavior stays centralized.
- 2026-06-29 Codex: Parse OpenAI-compatible response `usage` into per-attempt input/output token fields so downstream code can persist token totals without exposing provider details publicly.
- 2026-06-30 Codex: Apply `reasoning_effort: "max"` only for NVIDIA DeepSeek models so the final fallback uses max thinking while Kimi K2.6 and GLM 5.1 stay fast/default.
- 2026-06-30 Claude: Verified live against the real NVIDIA endpoint that `moonshotai/kimi-k2.6` and `minimaxai/minimax-m3` both accept `image_url` content pointing at a remote HTTPS URL (no base64 upload needed) and return accurate descriptions — this is what makes `lib/trae/vision.ts` possible without adding a screenshot-hosting step.
- 2026-06-30 Claude: Kept the vision plan NVIDIA-only (no REMOVED_PROVIDER fallback) since only two NVIDIA models are verified vision-capable; guessing at REMOVED_PROVIDER free-tier vision support risked a confusing silent failure instead of the clean "not performed" degradation.
- 2026-07-02 Claude: Root-caused the judge stall — since ~2026-07-02T00:00Z every evaluator call failed (NVIDIA 429 on kimi/deepseek, GLM 5.1 410 EOL, REMOVED_PROVIDER free daily cap exhausted). Added the Friend gateway as the primary provider and routed vision friend-first too, so all LLM traffic shares one fast endpoint. `friend` is a distinct runtime provider but persists as `NVIDIA` (proxies the same models) to avoid a Data Connect enum migration; the real endpoint stays in per-call logs. Verified live: a `json_object` evaluator call now succeeds on attempt #1 via `friend:deepseek-ai/deepseek-v4-pro`.
- 2026-07-04 Codex: Local `.local/trae-post-improver.ts` failure previously collapsed to "All zero-budget LLM models failed" without the per-model reasons. Kept fallback behavior unchanged, but now preserves sanitized fetch exception details and exports a compact call-log formatter for CLI error output.
- 2026-07-04 Claude/Codex: User wants NVIDIA 429s to retry instead of failing scored posts. Judge calls now treat rate limits as wait-and-rotate-key events, not model failures, so transient throttling no longer throws the topic into `JUDGE_ERROR`. Vision explicitly opts out because it is best-effort and should fall through to secondary vision models.

## Important Notes / NEVER Change

- Do not add paid direct model-provider API support.
- Do not auto-fallback to paid REMOVED_PROVIDER or any billing-dependent provider.
- Do not log API keys, request authorization headers, or private secrets.

## Implemented Change: Per-Key LLM Pacing

- 2026-07-02 Codex: Owner had a 40 rpm API quota and each consensus evaluator team uses 5 LLM calls. The quota was first enforced in the shared LLM client.
- 2026-07-04 Claude/Codex: Owner added a second NVIDIA key. The limiter is now keyed per API key, so each key gets its own `config.aiRpmLimit` request-start budget.
- With `AI_RPM_LIMIT=40`, one key starts one attempt every 1500ms; two NVIDIA keys provide two independent 1500ms lanes (80 rpm total).
- Keep retry backoff separate: after a retryable failure, the retry still waits for both the backoff and that key's start gate.
- Tests inject the same `sleepFn` used for retry backoff so the limiter can be verified without waiting in real time.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned provider-agnostic zero-budget LLM client. | Codex |
| 2026-06-29 | Implemented OpenAI-compatible NVIDIA/REMOVED_PROVIDER fallback client with per-attempt logs, timeout handling, validation fallback, and exponential backoff. | Codex |
| 2026-06-29 | Implemented per-attempt token usage capture from response usage payloads. | Codex |
| 2026-06-29 | Classify NVIDIA soft-throttle (HTTP 200, empty choices) as retryable `rate_limited`; raise rate-limit backoff base to 2s. | Claude |
| 2026-06-30 | Planned NVIDIA DeepSeek request option to use max reasoning effort on the final fallback. | Codex |
| 2026-06-30 | Implemented multimodal `LLMContentPart` message content, `responseFormat` option, plan override, `buildVisionLLMFallbackPlan`, and `callVisionLLMWithFallback`. | Claude |
| 2026-07-02 | Implemented shared `AI_RPM_LIMIT` request-start pacing for all LLM attempts. | Codex |
| 2026-07-02 | Added Friend gateway as default primary provider (text + vision); dropped GLM 5.1 (410 EOL) and DeepSeek V4 Flash (hangs) from all chains. | Claude |
| 2026-07-03 | GLM 5.2 (`z-ai/glm-5.2`) is now the primary text model on friend + nvidia; DeepSeek V4 Pro is the first text fallback. | Claude |
| 2026-07-04 | Implemented sanitized LLM failure summaries for local CLI diagnostics. | Codex |
| 2026-07-04 | Implemented per-key LLM pacing, multi-key NVIDIA rotation, and unlimited judge rate-limit retries with a vision opt-out. | Claude/Codex |
| 2026-07-06 | Planned provider-aware rate-limit rotation so Friend throttles do not block NVIDIA key capacity before the client waits. | Codex |
| 2026-07-08 | Removed `moonshotai/kimi-k2.6` from all chains (upstream-deprecated). New text order is MiniMax M3 → Gemma 4 31B → DeepSeek V4 Pro → GLM 5.2 on both providers. Added `chat_template_kwargs: { enable_thinking: true }` for NVIDIA-side `google/gemma-*` models, mirroring the DeepSeek `reasoning_effort: "max"` provider gating. Vision chain is now MiniMax M3 → Gemma 4 31B on both providers. | Claude |
| 2026-07-08 | Added `empty_content_billed` error classification (HTTP 200 + input tokens billed + empty content); skip same-model retry for this mode; emit console diagnostic; export `isSystemicLLMFallbackError` and `truncateDiagnostic` for judge pipeline early-abort and admin health-check. | Claude |
## Change Plan: Friend And NVIDIA Only

- 2026-07-03 Codex: Remove REMOVED_PROVIDER from the provider config map, fallback plan, request option plumbing, and header builder.
- Keep both Friend and NVIDIA usable at the same time by preserving `AI_PROVIDER_ORDER=friend,nvidia`.
- Missing API keys should continue to log `missing_api_key` per provider/model instead of throwing early.

## Change Plan: Use All Free Keys Before Waiting

- 2026-07-06 Codex: Current text judge calls could wait forever on a Friend 429/soft-429 before reaching NVIDIA, which made the runtime look Friend-only even when two NVIDIA keys were configured.
- Keep Friend first for successful calls, but treat a rate-limited plan entry as temporarily saturated and continue through the rest of the free plan.
- If every configured free entry is saturated, wait with the existing rate-limit backoff and retry the full plan instead of failing the judge.
- Keep per-key pacing unchanged: Friend has its own lane; each NVIDIA key has its own `AI_RPM_LIMIT` lane, so two 40 rpm NVIDIA keys remain 80 rpm direct NVIDIA capacity.
- Friend balance/auth/quota-style errors that are not rate-limit/5xx should fall through to NVIDIA through the existing non-retryable error path.

## Implemented Change: Use All Free Keys Before Waiting

- 2026-07-06 Codex: `callLLMWithFallback()` now runs rate-limit handling as full-plan passes. A provider is marked saturated for the current pass once all of its configured keys return a rate-limit shape.
- Friend 429/soft-429 no longer blocks direct NVIDIA attempts; the client skips the rest of the Friend models for that pass and tries NVIDIA.
- NVIDIA still rotates across all configured NVIDIA keys before the provider is considered saturated.
- Only after every viable provider lane in a pass is saturated does the client wait using `rateLimitBackoffMs()` and retry the full free plan.
- `AI_MAX_RATE_LIMIT_RETRIES` now caps full-plan wait cycles; `0` remains unlimited for must-succeed judging.

