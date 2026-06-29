# lib/trae/firestore.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Creates and exposes server-only Firebase Admin Firestore helpers.

## What It Does

- Initializes Firebase Admin from default credentials or explicit env values.
- Detects unavailable Firestore configuration for local empty-state rendering.
- Provides collection name constants and timestamp helpers.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getFirestoreDb` | function | Returns Firestore or throws a configuration error. |
| `isFirestoreConfigured` | function | Allows public APIs to degrade gracefully. |

## Dependencies

- External: `firebase-admin`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Public read APIs should catch Firestore config errors and return empty payloads instead of crashing pages.

## Important Notes / NEVER Change

- This module must not be imported by client components.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned Firestore admin helper. | Codex |
