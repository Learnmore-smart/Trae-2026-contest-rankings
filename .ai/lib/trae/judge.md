# lib/trae/judge.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Scores preliminary TRAE Demo topics through the zero-budget LLM fallback client.

## What It Does

- Builds strict JSON prompts from contest criteria.
- Uses `callLLMWithFallback()` so all model calls share provider order, retries, timeout, and logging behavior.
- Handles 429, timeout, invalid JSON, validation errors, and model fallbacks.
- Writes SQL `evaluations`, updates denormalized topic scoring fields, and records token usage through Data Connect.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `judgeChangedTraeTopics` | function | Scores topics needing judging. |
| `parseEvaluationJson` | function | Parses and repairs model JSON output. |
| `buildJudgePrompt` | function | Creates the model prompt for one topic. |

## Dependencies

- Internal: `config`, `dataconnect`, `llm`, `runs`, `types`.
- Generated SDK: `getBoardData`, `upsertEvaluation`, `updateTopicEvaluationState`, `upsertModelTokenUsage`.
- External: `zod`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Treat compliance as risk context inside scoring details, not as a separate public audit page.
- 2026-06-29 Codex: Planned migration from OpenRouter-only judge calls to NVIDIA-first free endpoint fallback with OpenRouter free models only after NVIDIA fails.
- 2026-06-29 Codex: Persist cumulative token usage in a model/provider keyed Firestore collection by incrementing input/output totals after each judged or failed model call.
- 2026-06-30 Codex: AI scoring must stay on the zero-budget LLM fallback path while all persistence goes through Data Connect mutations.
- 2026-06-30 Codex: Data Connect `UpsertEvaluation` owns `createdAt` through `createdAt_expr: "request.time"`; judge code must send only declared mutation variables and must not spread `TraeEvaluation` directly into the mutation payload.

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
