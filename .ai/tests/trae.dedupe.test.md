# tests/trae.dedupe.test.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Regression tests for duplicate-title filtering in TRAE contest ranking helpers.

## What It Does

- Verifies title normalization collapses whitespace and case differences.
- Verifies duplicate rows keep the first caller-ordered item.
- Verifies blank titles are not collapsed into one unrelated row.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `trae.dedupe.test.ts` | node test | Exercises shared duplicate-title helpers. |

## Dependencies

- Internal: `lib/trae/dedupe.ts`.
- External: Node built-in `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-07-02 Codex: Use a focused runtime unit test instead of only a source-level guard so the normalization behavior is actually executed.

## Important Notes / NEVER Change

- Keep tests independent from live Firebase/Data Connect.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-02 | Duplicate posts appeared in the public ranking. | No server-side title dedupe existed. | Add failing coverage before implementing the helper. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-02 | Planned duplicate-title dedupe regression tests. | Codex |
| 2026-07-02 | Implemented title normalization, duplicate keep-first, and blank-title regression tests. | Codex |
