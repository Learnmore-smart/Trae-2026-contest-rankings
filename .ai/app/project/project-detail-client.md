# app/project/project-detail-client.tsx

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Renders full AI scoring details for one preliminary Demo topic.

## What It Does

- Fetches one topic detail from the public contest API.
- Shows title, author, track, source links, total and dimension scores, explanations, strengths, weaknesses, suggestions, compliance/material risks, match information, model, time, and confidence.
- Handles missing evaluation or missing match without crashing.
- Uses the shared contest language and theme settings so detail pages follow the ranking page preferences.
- Keeps public detail pages focused on user-facing scoring results and does not render saved raw AI scoring input/output records.
- Lets users start a public re-score without a blocking browser confirmation and shows toast-style status feedback.

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
- 2026-07-01 Codex: The previously public AI I/O audit section is being removed from the detail page because raw prompts and model output should not be exposed in the public project detail experience.
- 2026-07-04 Codex: Public re-score should be an immediate action with non-blocking toast feedback; remove `window.confirm` and show "评分已经开始，请耐心等待" as soon as the request starts.

## Important Notes / NEVER Change

- Do not render raw forum HTML.
- Do not expose provider API keys or authorization headers.

## Bug Fix: Re-score Must Complete On POST (2026-07-10)

- Server no longer fire-and-forgets rejudge (Cloud Run CPU throttle). POST awaits the full re-score.
- Client: keep `rejudgeStarted` toast at click; on `ok && done` refresh detail and show success; only poll GET when the server returns `started` without `done` (legacy/fallback). Do not treat empty `error: null` on another instance as success without a detail refresh that shows a new evaluation.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Added root-level detail client documentation before fixing deployed detail API path and readable error state. | Codex |
| 2026-07-01 | Implemented base-path API fetch, readable error state, and AI input/output rendering. | Codex |
| 2026-07-01 | Planned removal of the public AI scoring audit input/output section. | Codex |
| 2026-07-04 | Planned non-blocking toast feedback for public re-score starts. | Codex |
| 2026-07-04 | Implemented re-score start toast and removed browser confirmation. | Codex |
| 2026-07-10 | Align client re-score completion with awaited POST (no false success from multi-instance GET). | Grok |

## Change Plan: AI I/O Implementation Alignment

- 2026-07-01 Codex: Static tests already require rendering persisted `systemPrompt`, `promptText`, and `rawModelResponse`; reconcile the component implementation with that existing auditability contract.
- Implemented `CodeBlock` rendering for system prompt, user prompt, and raw model output when present.

## Change Plan: Remove Public AI Scoring Audit Section

- 2026-07-01 Codex: Remove the entire conditional section headed by `t.aiIoTitle`, including the `CodeBlock` helper and saved `systemPrompt`, `promptText`, and `rawModelResponse` display.
- Keep all user-facing scoring summary, dimensions, strengths, weaknesses, suggestions, compliance risks, match information, model, and prompt version metadata intact.
- Also remove now-unused copy labels for the audit section so the detail client no longer carries dead UI strings.
- Implemented removal of the public raw AI I/O audit section.

## Change Plan: Re-score Start Toast

- 2026-07-04 Codex: Remove the blocking browser confirmation from `handleRejudge()` so clicking the public re-score button immediately starts the POST.
- Show an info toast/status message with Chinese copy `评分已经开始，请耐心等待` and English equivalent before awaiting the API response.
- Keep existing success/failure/cooldown messages so the start toast is replaced by the final request outcome.
- Add a source-level regression guard that rejects `window.confirm`/`rejudgeConfirm` and requires the new start toast copy.
- Implemented with a fixed top-right toast using the existing `rejudgeNotice` state.
