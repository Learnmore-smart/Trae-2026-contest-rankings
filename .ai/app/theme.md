# app/theme.css

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Defines the public contest site's theme tokens and light-mode visual primitives.

## What It Does

- Provides CSS custom properties for the light canvas, text colors, borders, panels, and accent colors.
- Sets `color-scheme: light` and page background primitives.
- Keeps theme decisions separate from component/layout rules in `app/globals.css`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `:root` variables | CSS custom properties | Shared visual tokens consumed by `app/globals.css`. |

## Props / Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| N/A | N/A | N/A | CSS theme file. |

## Dependencies

- **Internal:** `app/globals.css` - imports this file and consumes the variables.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Owner requested `theme.css` for this codebase and light mode. The file should be imported before component rules so all global styles can reference the same tokens.
- 2026-06-30 Codex: Use an off-white editorial/data-product theme with ink text, neutral borders, cyan/green/amber/violet accents, and no page-wide dark grid or heavy neon overlays.
- 2026-06-30 Codex: Continue by fixing both light and dark token sets so dropdowns and ranking rows use readable foreground/background pairs. Card hover shadows should be removed globally by setting card shadows to none and relying on border/background changes.

## Important Notes / NEVER Change

- Keep this file focused on theme tokens and global background/text primitives.
- Do not place component-specific ranking row layout here; keep that in `app/globals.css`.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned light-mode theme token file. | Codex |
| 2026-06-30 | Added light-mode CSS custom properties for page, panel, text, line, accent, ring, and shadow tokens. | Codex |
| 2026-06-30 | Planned dark-mode token cleanup and shadow-free card hover support. | Codex |
