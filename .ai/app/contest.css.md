# app/contest.css

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Styles the public contest landing, navigation, ranking toolbar, page controls, and ranking row/grid layouts.

## What It Does

- Defines the shared technical shell, light/dark theme surfaces, navigation controls, landing hero, ranking filters, ranking metadata, ranking rows, score rings, and mobile fallbacks.
- Keeps fixed-format controls stable so buttons, toggles, ranking rows, and score panels do not shift while data reloads.
- Provides responsive rules that prevent mobile horizontal overflow.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `.ranking-inline-meta` | CSS hook | Ranking result metadata and page switch row. |
| `.ranking-page-switch` | CSS hook | Explicit page navigation control for multi-page ranking results. |
| `.user-crawl-panel` | CSS hook | Compact form for user-submitted TRAE topic URLs. |

## Dependencies

- Internal: class hooks emitted by `app/contest-client.tsx`.
- Internal: CSS variables from `app/theme.css`.
- External: Tailwind utility classes may appear beside these custom hooks in JSX.

## Agent Decisions / Thoughts

- 2026-07-02 Codex: The previous pagination UI used small icon-only buttons in the inline metadata row. A user screenshot showed the page switch was effectively invisible. Add a named, text-visible `ranking-page-switch` control with stable dimensions and a mobile full-width fallback.
- 2026-07-02 Codex: Add `user-crawl-panel` styles that fit both the landing side rail and ranking surface without introducing a large marketing-style block. Keep the input/button responsive and readable in light/dark themes.
- 2026-07-02 Codex: Implemented `ranking-page-switch` styling with text buttons, a stronger surface, disabled states, and a mobile full-width layout.
- 2026-07-02 Codex: Implemented `user-crawl-panel` styling with stable input/button sizing, success/error message colors, and a mobile stacked layout.

## Important Notes / NEVER Change

- Keep the ranking toolbar and metadata dense; this is an operational leaderboard, not a marketing section.
- Keep text controls readable in both light and dark themes.
- Do not let the pagination control resize ranking rows or hide behind the result count.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-02 | Page switch was not visible enough in the ranking UI. | Pagination buttons were icon-only and tucked into a low-emphasis metadata row. | Planned a dedicated text-visible `ranking-page-switch` group. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-02 | Created CSS mirror and planned visible ranking page switch styling. | Codex |
| 2026-07-02 | Planned compact user-submitted topic crawl form styles. | Codex |
| 2026-07-02 | Implemented visible page-switch styles and mobile fallback. | Codex |
| 2026-07-02 | Implemented user-submitted topic crawl form styles. | Codex |
