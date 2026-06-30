# scripts/check-dataconnect.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Checks whether local credentials can query the TRAE Firebase Data Connect SQL backend.

## What It Does

- Loads local Next env files.
- Connects through `getDataConnectDb()`.
- Prints aggregate stats and recent run records.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scripts/check-dataconnect.ts` | CLI | Read-only SQL connectivity diagnostic. |

## Dependencies

- Internal: `lib/trae/dataconnect`.
- Generated SDK: `getStats`, `listRuns`.
- External: `@next/env`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Keep this script read-only and use it as the lowest-risk live SQL smoke test.
- 2026-06-30 Codex: Implemented direct generated SDK calls without `any` casts; live read smoke test confirmed Data Connect access.

## Important Notes / NEVER Change

- Do not print credentials or service account payloads.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned Data Connect smoke-test script documentation. | Codex |
| 2026-06-30 | Verified live Data Connect read smoke test. | Codex |
