# package.json

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Defines the Next.js app dependencies and TRAE worker/admin scripts.

## What It Does

- Provides dev/start/build/lint/typecheck/test scripts.
- Provides local scripts for scraping, matching, judging, and full runs.
- Declares dependencies for Next.js, React, Firestore Admin SDK, Zod, Cheerio, Tailwind, and lucide icons.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `npm run trae:*` | scripts | Local worker entry points for TRAE operations. |

## Dependencies

- External: `next`, `react`, `firebase-admin`, `zod`, `cheerio`, `lucide-react`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use one `scripts/trae.ts` CLI to avoid duplicating worker wiring across many scripts.
- 2026-06-29 Codex: Use Node 22 type stripping for worker scripts instead of `tsx`, avoiding esbuild binary install issues on this Windows workspace path.

## Important Notes / NEVER Change

- Never put API keys or service-account JSON in `package.json`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned package metadata and scripts. | Codex |
| 2026-06-29 | Synced final dependency and script decisions. | Codex |
