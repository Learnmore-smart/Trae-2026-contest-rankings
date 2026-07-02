# lib/dataconnect-generated/index.d.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Type declarations for the local Firebase Data Connect generated Admin SDK package.

## What It Does

- Declares operation payloads, variables, and overloads consumed by server-side TypeScript.
- Mirrors `dataconnect/connector/*.gql` operations so app code can call generated helpers with typed variables.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getBoardData` | function | Legacy bounded board query. |
| `getBoardPage` | function | Planned paged board query using `limit` and `offset`. |

## Dependencies

- External: `firebase-admin/data-connect`.
- Internal: generated JavaScript entrypoints in this package.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: This package is checked into the repo and used via a local `file:` dependency, so query additions require matching declaration and JavaScript wrapper updates unless the Firebase generator is run separately.
- 2026-07-01 Codex: Implemented `GetBoardPageData`, `GetBoardPageVariables`, and `getBoardPage` overloads.

## Important Notes / NEVER Change

- Keep operation names in sync with `dataconnect/connector/queries.gql`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created doc for paged board generated declarations. | Codex |
| 2026-07-01 | Added paged board declaration surface. | Codex |
