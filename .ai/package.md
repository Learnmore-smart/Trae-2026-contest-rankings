# package.json

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Defines the Next.js app dependencies and TRAE worker/admin scripts.

## What It Does

- Provides dev/start/build/lint/typecheck/test scripts.
- Provides local scripts for scraping, matching, judging, and full runs.
- Declares dependencies for Next.js, React, Firestore Admin SDK, Zod, Cheerio, Tailwind, and lucide icons.
- Includes TRAE LLM fallback and scraper serialization regression tests in the default test script.
- Includes TRAE duplicate-title dedupe regression tests in the default test script.
- Includes explicit source-level UI regression tests in the default test script, including the admin console busy-badge guard.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `npm run trae:*` | scripts | Local worker entry points for TRAE operations. |
| `npm run test` | script | Runs Node test suites for TRAE worker behavior. |

## Dependencies

- External: `next`, `react`, `firebase-admin`, `zod`, `cheerio`, `lucide-react`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use one `scripts/trae.ts` CLI to avoid duplicating worker wiring across many scripts.
- 2026-06-29 Codex: Use Node 22 type stripping for worker scripts instead of `tsx`, avoiding esbuild binary install issues on this Windows workspace path.
- 2026-06-29 Codex: Implemented the test script update so `npm run test` includes the scraper rawJson serialization regression.
- 2026-06-29 Codex: Add the landing hero layout guard to the explicit Node test list so the annotated hero class hooks stay covered by the default test script.
- 2026-06-29 Codex: Plan to include the contest route-page regression test in `npm run test` so refreshable home/ranking URL behavior stays covered.
- 2026-06-30 Codex: Keep the Node test list explicit and add an admin-console regression file so the compact busy badge contract runs in the default suite.
- 2026-07-02 Codex: Add duplicate-title dedupe coverage to the explicit Node test list so public ranking regressions are covered by `npm run test`.

## Important Notes / NEVER Change

- Never put API keys or service-account JSON in `package.json`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned package metadata and scripts. | Codex |
| 2026-06-29 | Synced final dependency and script decisions. | Codex |
| 2026-06-29 | Added LLM fallback test file to `npm run test`. | Codex |
| 2026-06-29 | Planned adding scraper rawJson test to `npm run test`. | Codex |
| 2026-06-29 | Added scraper rawJson regression test file to `npm run test`. | Codex |
| 2026-06-29 | Planned adding landing hero layout guard to `npm run test`. | Codex |
| 2026-06-29 | Planned adding contest route-page regression test to `npm run test`. | Codex |
| 2026-06-30 | Planned adding admin console busy-badge regression test to `npm run test`. | Codex |
| 2026-06-30 | Added admin console busy-badge regression test to `npm run test`. | Codex |
| 2026-07-02 | Planned adding duplicate-title dedupe regression test to `npm run test`. | Codex |
| 2026-07-02 | Added duplicate-title dedupe regression test to `npm run test`. | Codex |
