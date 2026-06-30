# app/trae-contest-2026/theme.tsx

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Provides client-side light/dark/system theme state for the public contest route.

## What It Does

- Reads `trae-contest-theme` from `localStorage`.
- Applies the resolved light or dark theme to `document.documentElement.dataset.theme`.
- Keeps `color-scheme` in sync with the resolved theme.
- Lets the system option follow operating-system color-scheme changes.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ContestTheme` | type | Theme preference: `light`, `dark`, or `system`. |
| `useContestTheme` | hook | Returns the current preference and setter. |

## Dependencies

- **External:** React hooks.
- **Internal:** `app/theme.css` consumes the `data-theme` attribute.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Theme state is route-local like language state. The root layout sets the initial DOM attribute to avoid a first-paint flash, then this hook owns runtime changes.
- 2026-06-30 Codex: The navbar theme control should be a dropdown, not a direct toggle, so users can choose light, dark, or system explicitly.

## Important Notes / NEVER Change

- Keep this hook browser-only.
- Do not put component styling here; component styles belong in `app/globals.css`.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Added theme preference hook. | Codex |
