# tests/landing-hero-layout.test.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Provides source-level regression coverage for the public contest page layout and global CSS hooks.

## What It Does

- Reads `app/trae-contest-2026/contest-client.tsx`, `app/globals.css`, and `app/theme.css` as text.
- Asserts stable class hooks exist for the landing hero, route-backed ranking shell, mobile overflow rules, theme split, row ranking layout, and score rings.
- Guards against reintroducing removed ranking containers and progress-strip markup.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `node:test` tests | regression tests | Static checks run through `npm test`. |

## Dependencies

- **External:** Node `assert`, `fs`, `path`, and `node:test`.
- **Internal:** `app/trae-contest-2026/contest-client.tsx`, `app/globals.css`, `app/theme.css`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Static source/CSS tests are appropriate here because the repository already uses them to protect layout hooks without browser setup.
- 2026-06-30 Codex: Add coverage for the new dropdown theme/language controls, row/grid view toggle, direct card click, compact filter layout, and shadow-free card hover behavior.

## Important Notes / NEVER Change

- Keep assertions focused on stable hooks and critical behavior, not brittle full-file snapshots.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created test mirror doc and planned compact UI regression coverage. | Codex |
