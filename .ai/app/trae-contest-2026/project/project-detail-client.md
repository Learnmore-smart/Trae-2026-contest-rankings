# app/trae-contest-2026/project/project-detail-client.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Renders full AI scoring details for one preliminary Demo topic.

## What It Does

- Shows title, author, track, source links, total and dimension scores, explanations, strengths, weaknesses, suggestions, compliance/material risks, match information, model, time, and confidence.
- Handles missing evaluation or missing match without crashing.
- Uses the shared contest language setting so detail pages follow the ranking page's Chinese/English preference.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ProjectDetailClient` | component | Client-side project detail UI. |

## Dependencies

- Public API: `/api/trae-contest/topics/[id]`.
- Internal: `app/trae-contest-2026/i18n.tsx`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Plan to translate page chrome, labels, and fallback text while leaving AI-generated evaluation content in its source language.
- 2026-06-29 Codex: Implemented shared language settings on detail pages so navigation from the ranking page keeps the same locale.
- 2026-06-29 Codex: Bring the detail page into the same redesigned visual language as the ranking page, and keep the existing styled language dropdown.

## Important Notes / NEVER Change

- Do not render raw forum HTML.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned detail client. | Codex |
| 2026-06-29 | Planned shared zh/en language support. | Codex |
| 2026-06-29 | Implemented translated detail page chrome using shared contest language state. | Codex |
| 2026-06-29 | Planned visual refresh for full-site consistency. | Codex |
| 2026-06-29 | Implemented visual refresh using shared surface and button primitives. | Codex |
