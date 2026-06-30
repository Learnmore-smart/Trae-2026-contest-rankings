# lib/trae/firestore.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Legacy documentation for the old Firestore helper path.

## What It Does

- The active runtime should use `lib/trae/dataconnect.ts`.
- This file is being retired from active imports as the project moves to Firebase Data Connect backed by Cloud SQL.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getFirestoreDb` | legacy function | Should not be used by active code. |
| `isFirestoreConfigured` | legacy function | Replaced by `isDataConnectConfigured`. |

## Dependencies

- Internal: `dataconnect`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Public read APIs should catch Firestore config errors and return empty payloads instead of crashing pages.
- 2026-06-30 Codex: Active website, AI, scraper, matcher, run tracking, and diagnostics should import `dataconnect.ts` directly. Remove Firestore Admin reads/writes from runtime code.

## Planned Change: SQL Connect Runtime

- 2026-06-30 Codex: Replace active imports of `./firestore.ts` with `./dataconnect.ts`, remove Firestore Admin initialization from the runtime path, and keep only non-active compatibility documentation if needed during migration.
- Implemented: active modules now import `dataconnect.ts`; `firestore.ts` no longer imports `firebase-admin/firestore` and only re-exports compatibility names.

## Important Notes / NEVER Change

- This module must not be imported by client components.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned Firestore admin helper. | Codex |
| 2026-06-29 | Added token usage collection constant. | Codex |
| 2026-06-30 | Planned retirement from active runtime in favor of Data Connect. | Codex |
| 2026-06-30 | Removed active Firestore Admin dependency. | Codex |
