# eslint.config.mjs

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Defines project-wide ESLint configuration for Next.js and TypeScript.

## What It Does

- Extends `next/core-web-vitals` and `next/typescript`.
- Ignores build artifacts, dependency folders, and generated Data Connect SDK output.
- Allows explicit `any` only in the SQL/Data Connect adapter layer where generated `Any` JSON fields and overloaded admin SDK calls require boundary casts.
- Keeps `scripts/**/*.ts` linted while disabling legacy script-only `any`, unused-variable, and `prefer-const` enforcement that is not part of the app TypeScript build.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `eslintConfig` | config array | Flat ESLint config exported to the CLI and Next build. |

## Dependencies

- External: `@eslint/eslintrc`, Next's ESLint presets.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Generated Data Connect CommonJS output should not be linted. It intentionally uses `require()`.
- 2026-06-30 Codex: Scope `no-explicit-any` relaxation to Data Connect boundary files rather than disabling it globally.
- 2026-06-30 Codex: Implemented generated SDK ignore plus scoped boundary override; `npm run lint` is clean.
- 2026-07-03 Codex: `scripts/` is excluded from `tsconfig.json` and contains legacy one-off maintenance utilities, so full lint should stay clean instead of reporting script-only `any`, unused variables, or mutable binding cleanup.

## Important Notes / NEVER Change

- Keep application/client code under the normal strict TypeScript lint rules.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned Data Connect lint boundary configuration. | Codex |
| 2026-06-30 | Implemented Data Connect lint boundary configuration. | Codex |
| 2026-07-03 | Planned scripts lint override to unblock full lint while still parsing scripts. | Codex |
