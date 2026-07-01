# tests/trae.judge.test.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Verifies model JSON parsing, repair, Zod validation behavior, and evidence-aware prompt building.

## What It Does

- Tests fenced JSON extraction.
- Tests invalid score rejection.
- Leaves provider fallback behavior to `tests/trae.llm.test.ts`; leaves vision-call behavior to `tests/trae.vision.test.ts`.
- Tests the four independent evaluator profiles used by consensus judging.
- Tests that judge prompts disclose the "not performed" disclaimer when no `TopicVisualEvidence` is passed, distinguishes "no demo URL" from "screenshot attempt failed", and surfaces real vision summaries (replacing the disclaimer) when evidence is passed.
- Tests that the consensus referee prompt's own evidence rules flip from "was not performed" to "WAS performed" when visual evidence is present.

## Dependencies

- Internal: `lib/trae/judge`.
- Built-in: `node:test`, `node:assert/strict`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned judge parser tests before implementation. | Codex |
| 2026-06-29 | Synced final Node test runner. | Codex |
| 2026-06-29 | Planned judge tests to remain focused on parser behavior after LLM client extraction. | Codex |
| 2026-07-01 | Added multi-evaluator consensus and evidence-limit prompt regression tests. | Codex |
| 2026-06-30 | Added tests for real-vs-not-performed visual evidence disclosure in evaluator and consensus prompts. | Claude |
| 2026-07-01 | Added a bounded concurrency helper regression test. | Codex |

## Planned Change: Judge Concurrency Test

- 2026-07-01 Codex: Add an offline unit test for the bounded concurrency helper so `max: 12` / `concurrency: 3` has a regression guard without hitting live Data Connect or AI providers.
- Implemented: the test tracks peak active workers and verifies all queued items complete.
