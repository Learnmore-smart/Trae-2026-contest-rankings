# lib/trae/dataconnect.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Initializes Firebase Admin for Firebase Data Connect and exposes the SQL connector used by server code.

## What It Does

- Reads Firebase/Admin credentials from local env or Google Cloud application default credentials.
- Initializes exactly one Firebase Admin app.
- Returns the generated `trae-contest` Data Connect admin connector.
- Provides `nowIso()` for pipeline timestamps.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getDataConnectDb` | function | Returns the Data Connect admin connector. |
| `isDataConnectConfigured` | function | Reports whether server credentials are available. |
| `nowIso` | function | Returns an ISO timestamp string. |

## Dependencies

- External: `firebase-admin/app`, `firebase-admin/data-connect`.
- Internal generated SDK: `@trae-contest/dataconnect-generated`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Move active runtime code off the old Firestore helper path. Keep Firebase Admin initialization because Data Connect Admin still needs a Firebase app, but do not import or instantiate Firestore.
- 2026-06-30 Codex: Implemented `getDataConnectDb()` with Firebase app initialization and no Firestore Admin dependency.

## Important Notes / NEVER Change

- This module must stay server-only.
- Do not log service account contents or provider secrets.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned Data Connect admin helper. | Codex |
| 2026-06-30 | Implemented Data Connect admin helper. | Codex |
