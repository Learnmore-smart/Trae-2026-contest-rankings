# Project Context

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

This repository hosts a public third-party AI ranking site for the TRAE AI Creativity Contest 2026.

## Current State

- The workspace was empty when work started.
- Git metadata became available during setup; the repository now contains a scaffolded Next.js app.
- No existing TRAE judge/compliance skill files were found under the workspace or local skill roots.
- The implementation scaffolded a standalone Next.js App Router project.

## Architecture Decisions

- Use Next.js App Router with TypeScript for the public site, API routes, and admin UI.
- Use Firebase Data Connect generated operations for the SQL-backed contest data path; old Firestore wording should not appear in active UI.
- Keep all scraper, matcher, and judge logic in `lib/trae/*` so scripts and API routes share one implementation.
- Use pure helper modules for extraction, matching, and JSON validation so they can be tested without network or Firestore.
- Public pages must render empty/error states when SQL/Data Connect credentials are missing.
- Use Node 22 `--experimental-strip-types` and `node:test` for local pure-logic tests to avoid extra esbuild-based test dependencies on this Windows path.

## Important Notes

- Do not expose REMOVED_PROVIDER or admin secrets to client code.
- Do not scrape private content or bypass forum access controls.
- Registration topics are stored and matched, but never shown as a public ranking.
- Preliminary Demo topics are the only ranking entries.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created project context for TRAE contest module scaffold. | Codex |
| 2026-06-29 | Synced final architecture and verification notes. | Codex |
| 2026-07-01 | Clarified active storage architecture as SQL-backed Firebase Data Connect instead of Firestore. | Codex |

