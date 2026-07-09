# app/api/trae-contest/admin/llm-health/route.ts

> Last updated: 2026-07-08 | Protection: STANDARD

## Purpose

Admin-only API route for pinging each configured LLM model once, to verify API availability before starting a large judge run. Created to diagnose the 2026-07-08 "empty content with billed input tokens" production failure.

## What It Does

- Verifies `TRAE_ADMIN_TOKEN` bearer auth.
- Calls `buildLLMFallbackPlan()` to get every configured model (friend + nvidia, 4-model chain).
- Pings each model **serially** (no concurrency, no retry, no fallback) with a minimal `"Return {} only."` JSON prompt.
- Classifies each model's response: `ok` (content non-empty), `rate_limited` (empty choices array, NVIDIA soft-429), `empty_content_billed` (choices non-empty + content null + input tokens > 0, the production failure pattern), `invalid_response`, `http_<status>`, `timeout`, `network_error`, `missing_api_key`.
- Returns per-model `{ provider, model, status, latencyMs, inputTokens, outputTokens, errorReason?, rawResponseSummary? }`. `rawResponseSummary` is sanitized via `truncateDiagnostic(rawText, 800)` and only included on error.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `POST` | route handler | Pings every configured model once; returns per-model status. |

## Dependencies

- Internal: `lib/trae/auth`, `lib/trae/llm` (`buildLLMFallbackPlan`, `truncateDiagnostic`, `LLMFallbackPlanEntry`).

## Agent Decisions / Thoughts

- 2026-07-08 Claude: Serial pings (not concurrent) to avoid tripping rate limits during the health check itself. No retry/no fallback so each model's raw response is visible for diagnosis.

## Important Notes / NEVER Change

- Keep this route `nodejs`; it makes server-side LLM calls with admin credentials.
- Do not expose admin functionality without bearer token validation.
- Never log API keys; `rawResponseSummary` must go through `truncateDiagnostic`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-08 | Created health-check endpoint to diagnose empty-content-with-billed-input production failure. | Claude |
