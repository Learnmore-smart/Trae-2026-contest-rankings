# scripts/migrate-firestore-to-dataconnect.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Migrates legacy Firestore TRAE collections into Firebase Data Connect tables.

## What It Does

- Reads Firestore topics, evaluations, matches, and runs.
- Maps app-level string values into Data Connect enums.
- Writes Data Connect rows in dependency order.

## Dependencies

- Internal: `lib/trae/dataconnect.ts`.
- Generated SDK: migration mutations from `@trae-contest/dataconnect-generated`.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Planned REMOVED_PROVIDER removal from provider maps. Legacy `REMOVED_PROVIDER` evaluations should no longer map to a supported provider enum after schema cleanup.

## Important Notes / NEVER Change

- Do not log or expose Firebase credentials.
- Keep enum maps synchronized with `dataconnect/schema/schema.gql`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Created doc before removing REMOVED_PROVIDER provider mapping. | Codex |


