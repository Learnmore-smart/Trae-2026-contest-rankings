# app/contest.css

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Defines contest-specific layout and visual rules for the public landing and ranking UI.

## What It Does

- Styles the ranking shell, filters, list/grid modes, row cards, score rings, landing hero, officer cards, and responsive fallbacks.
- Keeps the root-level public contest UI aligned with `app/contest-client.tsx` markup hooks.
- Provides desktop and mobile layout constraints for score rings, row actions, and page sections.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `.rank-row` | CSS hook | Ranking item layout container. |
| `.rank-row__score-panel` | CSS hook | Score rings and evaluation summary area. |
| `.rank-row__content` | CSS hook | Ranking metadata, title, and chips. |
| `.score-ring` | CSS hook | Circular score visualization. |

## Dependencies

- **Internal:** `app/contest-client.tsx` - supplies the markup hooks styled here.
- **Internal:** `app/globals.css` - imports this stylesheet and shared theme tokens.
- **Internal:** `app/theme.css` - defines light theme color variables used here.

## Agent Decisions / Thoughts

- **2026-07-01 Codex:** Source-level layout tests are already used for visual regressions in this repo. Keep the regression guard in `tests/landing-hero-layout.test.ts` and verify with a browser screenshot after the CSS fix.

## Bug Fix Plan: Ranking Row Text Collapses Vertically

- **Bug:** The ranking screenshot shows title and metadata text wrapping one character per line while the score panel occupies most of the row.
- **Cause:** The desktop `.rank-row` grid uses an `auto` score-panel column. A long Chinese `.rank-row__summary` inside that grid item can make the auto column size to its max-content width, starving the `content` column.
- **Fix strategy:** Replace the desktop `auto` score-panel grid column with a bounded `minmax(24rem, 34rem)` track, give the text column a practical minimum width, and add `min-width: 0` plus wrapping to the score panel/summary so summary text cannot expand the grid. Keep the existing desktop row layout and mobile stacking.
- **Regression risk:** Too narrow a score panel could crowd the score rings. Preserve a minimum practical width and let the existing `1120px` breakpoint stack rows before the layout becomes cramped.
- **Test plan:** Add a source-level assertion that the desktop row grid and score panel have explicit width constraints, then run the targeted layout test and browser-load `/ranking`.
- **Implemented:** Updated `.rank-row` desktop columns to `3.7rem minmax(18rem, 1fr) minmax(24rem, 34rem) minmax(9.5rem, auto)`, added `min-width: 0` to `.rank-row__score-panel`, and added `overflow-wrap: anywhere` to `.rank-row__summary`.

## Important Notes / NEVER Change

- Do not reintroduce heavy card shadows or dashboard-style framed containers for ranking rows.
- Keep mobile row stacking at the existing breakpoint unless browser verification shows a specific problem.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-01 | Ranking row title collapsed into vertical text. | Auto score-panel grid column expanded from long summary text. | Bounded the score-panel grid track and added wrapping/min-width guards. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created stylesheet mirror doc and planned ranking row collapse fix. | Codex |
| 2026-07-01 | Implemented bounded ranking row score-panel columns and summary wrapping. | Codex |
