# lib/trae/judge.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Scores preliminary TRAE Demo topics with OpenRouter chat completions.

## What It Does

- Builds strict JSON prompts from contest criteria.
- Uses primary and fallback models.
- Handles 429, timeout, invalid JSON, validation errors, and model fallbacks.
- Writes `trae_evaluations` and updates topic status.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `judgeChangedTraeTopics` | function | Scores topics needing judging. |
| `parseEvaluationJson` | function | Parses and repairs model JSON output. |
| `buildJudgePrompt` | function | Creates the model prompt for one topic. |

## Dependencies

- Internal: `config`, `firestore`, `types`.
- External: `zod`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Treat compliance as risk context inside scoring details, not as a separate public audit page.

## Important Notes / NEVER Change

- OpenRouter API key must never leave the server.
- Signup topics must never be judged.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned OpenRouter judge module. | Codex |
