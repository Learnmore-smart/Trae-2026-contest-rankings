# tests/trae.llm.test.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Verifies the zero-budget provider-agnostic LLM fallback client, including the vision-call path.

## What It Does

- Tests NVIDIA primary model before NVIDIA fallback and OpenRouter.
- Tests default NVIDIA text fallback order, image/multimodal model config, and DeepSeek reasoning effort.
- Tests retryable 429 behavior with exponential backoff.
- Tests invalid JSON/content validation fallback.
- Tests missing provider keys are logged and never introduce paid providers.
- Tests extraction of input/output token usage from OpenAI-compatible responses.
- Tests `buildVisionLLMFallbackPlan` orders/dedupes the image model and its fallback, NVIDIA only.
- Tests `callVisionLLMWithFallback` sends multimodal `image_url` content parts and omits `response_format` from the request body.
- Tests the shared `AI_RPM_LIMIT` request-start limiter with injected sleeps so the suite does not wait in real time.

## Dependencies

- Internal: `lib/trae/llm`, `lib/trae/config`.
- Built-in: `node:test`, `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use injected fetch and sleep functions so retry/fallback behavior is deterministic and does not call real endpoints.
- 2026-06-29 Codex: Assert token usage is read from successful response usage and attached to call logs.
- 2026-06-30 Codex: Add regression coverage for the requested NVIDIA order: text `deepseek-v4-pro -> glm-5.1 -> deepseek-v4-flash`, image/multimodal `kimi-k2.6`.
- 2026-06-30 Codex: Update regression coverage for the revised NVIDIA text order `kimi-k2.6 -> glm-5.1 -> deepseek-v4-flash`; assert only DeepSeek fallback requests include `reasoning_effort: "max"`.
- 2026-07-02 Codex: Added a red/green test for pacing consecutive real model attempts at 1500ms when `AI_RPM_LIMIT=40`.

## Important Notes / NEVER Change

- Tests must not require network access or real API keys.
- Tests must not configure paid provider fallbacks.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned LLM fallback client tests before implementation. | Codex |
| 2026-06-29 | Added deterministic tests for provider plan order, 429 retry/backoff, and invalid JSON fallback. | Codex |
| 2026-06-29 | Added token usage extraction coverage. | Codex |
| 2026-06-30 | Planned default NVIDIA text/image model order coverage. | Codex |
| 2026-06-30 | Added regression coverage for default NVIDIA text order and image/multimodal model config. | Codex |
| 2026-06-30 | Planned Kimi-first NVIDIA order tests and DeepSeek max reasoning-effort request coverage. | Codex |
| 2026-06-30 | Added vision plan ordering/dedup tests and multimodal `callVisionLLMWithFallback` request-shape coverage. | Claude |
| 2026-07-02 | Added shared LLM rate-limiter regression coverage. | Codex |
