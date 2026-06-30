# tests/trae.judge.test.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Verifies model JSON parsing, repair, and Zod validation behavior.

## What It Does

- Tests fenced JSON extraction.
- Tests invalid score rejection.
- Leaves provider fallback behavior to `tests/trae.llm.test.ts`.

## Dependencies

- Internal: `lib/trae/judge`.
- Built-in: `node:test`, `node:assert/strict`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned judge parser tests before implementation. | Codex |
| 2026-06-29 | Synced final Node test runner. | Codex |
| 2026-06-29 | Planned judge tests to remain focused on parser behavior after LLM client extraction. | Codex |
