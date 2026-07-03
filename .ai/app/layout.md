# app/layout.tsx

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Defines global HTML shell and metadata for the Next.js app.

## What It Does

- Sets Chinese language metadata for the public TRAE ranking site.
- Declares the TRAE favicon from `public/icons/favicon.ico`.
- Declares the social share OG image from `public/trae-contest-ranking-og.png`.
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
- 2026-07-01 Codex: User explicitly requested the favicon source be `public/icons/favicon.ico`; keep the existing `/trae-contest-2026` base path in metadata URLs.
- 2026-07-03 Codex: Add root Open Graph and Twitter metadata so the supplied contest ranking image is used as the site preview card.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned root layout. | Codex |
| 2026-06-29 | Planned TRAE favicon metadata update. | Codex |
| 2026-06-30 | Added pre-hydration theme bootstrap plan. | Codex |
| 2026-07-01 | Planned favicon metadata switch to `public/icons/favicon.ico`. | Codex |
| 2026-07-03 | Planned OG image metadata update using `public/trae-contest-ranking-og.png`. | Codex |
