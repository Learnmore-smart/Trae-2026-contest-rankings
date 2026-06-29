# app/layout.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Defines global HTML shell and metadata for the Next.js app.

## What It Does

- Sets Chinese language metadata for the public TRAE ranking site.
- Loads global CSS.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `RootLayout` | component | Next.js root layout. |

## Dependencies

- Internal: `app/globals.css`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep root layout minimal; route pages own their visual design.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned root layout. | Codex |
