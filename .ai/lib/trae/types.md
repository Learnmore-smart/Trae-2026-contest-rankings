# lib/trae/types.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Defines shared TypeScript types and Zod schemas for TRAE topics, matches, evaluations, runs, API responses, and model outputs.

## What It Does

- Centralizes collection field names and enum values.
- Validates model JSON output before writing evaluations.
- Keeps API route and UI data contracts aligned.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `TraeTopic` | type | Firestore topic document shape. |
| `TraeEvaluation` | type | Firestore evaluation document shape. |
| `evaluationOutputSchema` | Zod schema | Strict model response validator. |

## Dependencies

- External: `zod` for runtime validation.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep all score ranges validated in Zod to prevent malformed model output from reaching Firestore.

## Important Notes / NEVER Change

- `sourceType` must distinguish signup and preliminary behavior.
- Evaluation documents must only represent preliminary topics.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned shared TRAE domain types. | Codex |
