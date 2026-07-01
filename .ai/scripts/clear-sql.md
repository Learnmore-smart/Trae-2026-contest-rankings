# scripts/clear-sql.ts

> Last updated: 2026-07-01 | Protection: CRITICAL

## Purpose

One-time maintenance script to clear Firebase Data Connect / Cloud SQL data while preserving schema.

## What It Does

- Loads local environment credentials.
- Connects to Firebase Data Connect with admin credentials.
- Deletes business rows from the Data Connect tables in foreign-key-safe order.
- Verifies remaining public counts after the clear.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scripts/clear-sql.ts` | script | Clears deployed SQL data rows while keeping schema intact. |

## Dependencies

- Internal: `lib/trae/dataconnect.ts`.
- External: `@next/env`, Firebase Admin Data Connect.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Owner explicitly confirmed clearing SQL while preserving schema. Because this is destructive, the script must be explicit about table order and verify counts after execution.
- 2026-07-01 Codex: Prefer Data Connect Admin SDK over direct `psql` because local machine has Firebase service-account credentials but no `gcloud`, `firebase`, or `psql` CLI.
- 2026-07-01 Codex: Local `.env` has a typo in the PEM footer (`PRVATE Key`); repair only that exact footer typo in-memory so the script can authenticate without editing or printing the secret.

## Important Notes / NEVER Change

- Do not drop tables, indexes, schema, connector definitions, or enum types.
- Do not print service-account credentials or environment variable values.
- Keep deletion order foreign-key-safe: child/reference tables before `topics`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Planned one-time Data Connect SQL clear script. | Codex |
| 2026-07-01 | Implemented script with dry-run counts and in-memory service-account footer typo repair. | Codex |
