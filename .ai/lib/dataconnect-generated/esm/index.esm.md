# lib/dataconnect-generated/esm/index.esm.js

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

ES module wrapper entrypoint for the local Firebase Data Connect generated Admin SDK package.

## What It Does

- Exports generated query and mutation helper functions for ESM consumers.
- Validates Admin SDK call arguments and dispatches named Data Connect operations.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getBoardData` | function | Legacy bounded board query. |
| `getBoardPage` | function | Planned paged board query using `limit` and `offset`. |

## Dependencies

- External: `firebase-admin/data-connect`.
- Internal: `dataconnect/connector/queries.gql` operation names deployed in Data Connect.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Keep generated-style wrappers minimal; they only route operation names and variables, while the deployed Data Connect connector owns the query body.
- 2026-07-01 Codex: Implemented the ESM `getBoardPage` wrapper that dispatches the `GetBoardPage` query.

## Important Notes / NEVER Change

- Do not add business logic here; keep this file as a generated wrapper surface.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created doc for paged board ESM wrapper. | Codex |
| 2026-07-01 | Added paged board ESM wrapper. | Codex |
## Change Plan: Provider Enum Sync

- 2026-07-03 Codex: Remove `REMOVED_PROVIDER` from the generated `TraeAiProvider` constant after removing it from the Data Connect schema.

