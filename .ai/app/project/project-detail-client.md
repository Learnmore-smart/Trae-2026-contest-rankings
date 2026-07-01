# app/project/project-detail-client.tsx

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Renders full AI scoring details for one preliminary Demo topic.

## What It Does

- Fetches one topic detail from the public contest API.
- Shows title, author, track, source links, total and dimension scores, explanations, strengths, weaknesses, suggestions, compliance/material risks, match information, model, time, and confidence.
- Handles missing evaluation or missing match without crashing.
- Uses the shared contest language and theme settings so detail pages follow the ranking page preferences.
- Shows saved AI scoring input/output records when available for auditability.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ProjectDetailClient` | component | Client-side project detail UI. |

## Dependencies

- Public API: `/api/trae-contest/topics/[id]`.
- Internal: `app/i18n.tsx`.
- Internal: `app/theme.tsx`.
- Internal: `app/contest-client.tsx`.
- Internal types: `lib/trae/types`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Plan to translate page chrome, labels, and fallback text while leaving AI-generated evaluation content in its source language.
- 2026-06-29 Codex: Implemented shared language settings on detail pages so navigation from the ranking page keeps the same locale.
- 2026-06-29 Codex: Bring the detail page into the same redesigned visual language as the ranking page, and keep the existing styled language dropdown.
- 2026-07-01 Codex: The root-level route must use the configured Next.js base path when fetching API data, otherwise deployed detail pages under `/trae-contest-2026` request the wrong API URL and display a false not-found state.
- 2026-07-01 Codex: Error panels must be readable in both light and dark themes; avoid red translucent text-on-red combinations.
- 2026-07-01 Codex: The AI I/O section should display persisted `systemPrompt`, `promptText`, and `rawModelResponse` when present so scoring can be audited.

## Important Notes / NEVER Change

- Do not render raw forum HTML.
- Do not expose provider API keys or authorization headers.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Added root-level detail client documentation before fixing deployed detail API path and readable error state. | Codex |
| 2026-07-01 | Implemented base-path API fetch, readable error state, and AI input/output rendering. | Codex |

## Change Plan: AI I/O Implementation Alignment

- 2026-07-01 Codex: Static tests already require rendering persisted `systemPrompt`, `promptText`, and `rawModelResponse`; reconcile the component implementation with that existing auditability contract.
- Implemented `CodeBlock` rendering for system prompt, user prompt, and raw model output when present.
