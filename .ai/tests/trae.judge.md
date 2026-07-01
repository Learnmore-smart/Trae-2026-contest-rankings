# tests/trae.judge.test.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Regression tests for prompt construction, JSON parsing, evaluator orchestration, and judge helpers.

## What It Does

- Verifies model JSON parsing and validation behavior.
- Verifies multi-evaluator prompt assembly and visual-evidence disclosure wording.
- Verifies local bounded-concurrency helper behavior.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `buildJudgePrompt` tests | node:test suite | Confirms prompt evidence wording. |
| `buildConsensusJudgePrompt` tests | node:test suite | Confirms consensus prompt evidence wording. |
| `runWithConcurrency` tests | node:test suite | Confirms concurrency bounds. |

## Dependencies

- Internal: `lib/trae/judge.ts`, `lib/trae/types.ts`.
- Built-in: `node:test`, `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Add prompt wording coverage so failed image/demo automation is framed as an automation limitation, not as missing contestant-provided Demo or image materials when public URLs exist.
- 2026-07-01 Codex: Implemented the regression against `buildConsensusJudgePrompt()` because that prompt produces the final persisted evaluation.
- 2026-07-01 Codex: Add regression that an app/mini-program topic with download or QR evidence does not get a "missing Demo URL" compliance hint, and that the prompt lists non-web Demo evidence.
- 2026-07-01 Codex: Add legacy-row regression so rejudge can infer non-web Demo evidence from `attachmentUrls`, QR/miniprogram text, and `imageUrls` even when the newer evidence fields are absent.
- 2026-07-01 Codex: Add prompt regression that final scoring treats uploaded screenshots as official material evidence and asks the judge to evaluate Trae usage/development screenshots plus finished Demo/product screenshots.
- 2026-07-01 Codex: Implemented the uploaded screenshot evidence prompt regression in `buildJudgePrompt()` tests.

## Important Notes / NEVER Change

- Keep prompt tests focused on stable guardrail text and behavior; avoid brittle assertions over the whole prompt.
- Do not call live LLM providers from judge unit tests.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-01 | Model could echo visual-automation failures as compliance/material risks even when Demo/image URLs exist. | Evidence-limit prompt did not explicitly separate automation failure from contestant material absence. | Add regression for the new guardrail wording before changing prompt construction. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created test documentation for judge prompt evidence-limit regression. | Codex |
| 2026-07-01 | Added consensus prompt regression for automation-limit wording. | Codex |
| 2026-07-01 | Planned regression for non-web Demo evidence in judge prompts. | Codex |
| 2026-07-01 | Added regression that download/QR evidence prevents a false missing-Demo-URL risk and is listed in prompt context. | Codex |
| 2026-07-01 | Added legacy-field fallback regression for non-web Demo evidence during rejudge. | Codex |
| 2026-07-01 | Planned regression for ordinary uploaded screenshot evidence guidance in judge prompts. | Codex |
| 2026-07-01 | Added ordinary uploaded screenshot evidence guidance regression in judge prompt tests. | Codex |
| 2026-07-01 | Added regression for ordinary uploaded screenshot evidence guidance in judge prompts. | Codex |
