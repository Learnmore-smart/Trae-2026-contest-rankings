# lib/trae/types.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Defines shared TypeScript types and Zod schemas for TRAE topics, matches, evaluations, runs, API responses, model outputs, and LLM call logs.

## What It Does

- Centralizes collection field names and enum values.
- Validates model JSON output before writing evaluations.
- Stores provider/model attempt metadata for LLM calls.
- Keeps API route and UI data contracts aligned.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `TraeTopic` | type | Firestore topic document shape. |
| `TraeEvaluation` | type | Firestore evaluation document shape. |
| `TraeLLMCallLog` | type | Per-attempt provider/model diagnostics. |
| `evaluationOutputSchema` | Zod schema | Strict model response validator. |

## Dependencies

- External: `zod` for runtime validation.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep all score ranges validated in Zod to prevent malformed model output from reaching Firestore.
- 2026-06-29 Codex: Planned durable call logs on evaluations so provider/model latency, retry count, error reason, and raw response are auditable.
- 2026-06-29 Codex: Added token usage fields to call logs, a Firestore token usage document type, and aggregate stats totals without exposing provider/model names in the public payload.

## Important Notes / NEVER Change

- `sourceType` must distinguish signup and preliminary behavior.
- Evaluation documents must only represent preliminary topics.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned shared TRAE domain types. | Codex |
| 2026-06-29 | Planned LLM call log fields for provider fallback auditing. | Codex |
| 2026-06-29 | Added provider and LLM call log fields to evaluation types. | Codex |
| 2026-06-29 | Added token usage types and public stats totals. | Codex |
