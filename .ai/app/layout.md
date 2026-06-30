# app/layout.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Defines global HTML shell and metadata for the Next.js app.

## What It Does

- Sets Chinese language metadata for the public TRAE ranking site.
- Declares the TRAE favicon from `public/icons/trae.ico`.
- Loads global CSS.
- Applies a small inline theme bootstrap script before paint so the saved theme does not flash.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `RootLayout` | component | Next.js root layout. |

## Dependencies

- Internal: `app/globals.css`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep root layout minimal; route pages own their visual design.
- 2026-06-29 Codex: Use Next.js `metadata.icons` so the browser favicon comes from the supplied TRAE `.ico` asset without adding manual `<head>` markup.
- 2026-06-30 Codex: Theme bootstrapping belongs in the root layout because CSS variables are read before the route client hook hydrates.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned root layout. | Codex |
| 2026-06-29 | Planned TRAE favicon metadata update. | Codex |
| 2026-06-30 | Added pre-hydration theme bootstrap plan. | Codex |
