# scripts/trae-diag.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Provides a local read-only diagnostic summary for the TRAE ranking database.

## What It Does

- Loads local Next env files.
- Connects through Firebase Data Connect.
- Prints SQL-backed stats, latest run rows, and sample preliminary topics/evaluations.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scripts/trae-diag.ts` | CLI | Local diagnostic command. |

## Dependencies

- Internal: `lib/trae/dataconnect`.
- Generated SDK: `getStats`, `getBoardData`, `listRuns`.
- External: `@next/env`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Replace direct Firestore collection reads with Data Connect queries so the diagnostic works in SQL-only environments.
- 2026-06-30 Codex: Implemented read-only Data Connect stats, board, and recent-run diagnostics. Board query intentionally omits raw model response bodies.

## Important Notes / NEVER Change

- Diagnostic output must not print secrets or raw service account values.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned SQL/Data Connect diagnostic migration. | Codex |
| 2026-06-30 | Implemented SQL/Data Connect diagnostic migration. | Codex |
