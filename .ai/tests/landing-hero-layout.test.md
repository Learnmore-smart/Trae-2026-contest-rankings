# tests/landing-hero-layout.test.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Guards the landing hero markup and CSS hooks used by the annotated container layout.

## What It Does

- Reads `app/contest-client.tsx`, `app/globals.css`, and `app/contest.css`.
- Verifies the hero has explicit copy, side rail, action rail, and telemetry hook classes.
- Verifies the removed side-panel progress container does not return.
- Verifies CSS keeps the side rail top-aligned and the action rail positioned in the right column on desktop, with a mobile single-column fallback.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `landing hero layout test` | node test | Source-level regression guard for the annotated hero composition. |

## Dependencies

- Internal: `app/contest-client.tsx` - markup hooks under test.
- Internal: `app/globals.css` - global visual rules under test.
- Internal: `app/contest.css` - contest-specific layout and visual rules under test.
- External: Node built-in `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: This is a visual layout change without an existing browser test harness, so use a focused source-level guard first, then verify in-browser with the running Next page.
- 2026-06-29 Codex: Extend the guard for the full tech revamp by asserting stable command-center hooks rather than brittle color declarations.
- 2026-06-30 Codex: The public contest source moved to root-level `app/*`; update visual guards to read the current client and detail client paths.
- 2026-06-30 Codex: Contest-specific layout CSS now lives in `app/contest.css`, while global tokens and imports remain in `app/globals.css`; tests should combine both sources for layout assertions.
- 2026-07-01 Codex: Add a focused source-level guard for the ranking row collapse. The browser symptom comes from CSS grid sizing, so the test should assert the score-panel has explicit bounded width constraints rather than snapshotting the full row.
- 2026-07-02 Codex: Add a focused source-level guard that the navbar exposes the rightmost RateMinistere home link with the shared `nav-control` styling and the requested external href.
- 2026-07-03 Codex: Add a source-level guard for the official contest banner path and stable `.contest-official-banner` hooks so future hero edits do not drop the provided asset.
- 2026-07-03 Codex: Implemented source-level assertions for the base-path-prefixed banner src, accessible alt text, 5:1 CSS ratio, and image object-fit behavior.

## Mobile Layout Repair Note

- 2026-06-29 Codex: Add guards for mobile overflow because the previous single-column assertions did not catch nav chip overflow or desktop heading classes remaining active on small screens.
- Bug cause: test only asserted that a mobile media query existed, not that mobile-specific width, wrapping, and heading constraints existed.
- Fix plan: add source-level assertions for `landing-hero-title`, mobile nav wrapping, mobile chip widths, and mobile hero text/button constraints.
- Implemented: mobile layout test now asserts the hero title/nav metric hooks plus 768px overflow, wrapping, and full-width action-button rules.

## Planned Change: Ranking Row And Theme Guards

- 2026-06-30 Codex: Extend the existing source-level visual guard for the approved ranking redesign rather than adding another test command. Guard the new `theme.css` import, light-mode token file, ranking row hooks, score-ring hooks, and removal of the framed result strip.
- 2026-06-30 Codex: Add assertions that `app/globals.css` imports `./theme.css` and that `app/theme.css` sets a light color scheme.
- 2026-06-30 Codex: Add assertions that the shared client exposes `ranking-list`, `rank-row`, and `score-ring` hooks for the new row layout.
- 2026-06-30 Codex: Add assertions that the old card grid/framed result strip is no longer used for the ranking list.
- Implemented: source-level layout tests now cover the theme split, light-mode token file, ranking row hooks, circular score ring CSS, and removal of `ranking-result-strip`.

## Planned Change: Removed Side-Panel Progress Hook

- 2026-06-30 Codex: Owner requested removing the circled landing side-panel progress container. Update this source-level guard so it asserts `purpose-progress` is absent while preserving the remaining hero command deck, signal strip, telemetry grid, and action rail assertions.

## Important Notes / NEVER Change

- Keep assertions targeted to stable layout hooks, not exact decorative color values.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-01 | Ranking row text collapsed vertically. | The score-panel auto grid column could grow to long summary max-content width. | Added CSS constraint assertions for `.rank-row` and `.rank-row__score-panel`. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned landing hero layout regression test. | Codex |
| 2026-06-30 | Added regression guards for light theme split and row/ring ranking layout. | Codex |
| 2026-06-30 | Updated hero layout guard for removal of the side-panel progress container. | Codex |
| 2026-06-30 | Updated source paths after root-level route move. | Codex |
| 2026-06-30 | Updated CSS fixture input to include contest-specific stylesheet. | Codex |
| 2026-07-01 | Planned ranking score-panel width regression guard. | Codex |
| 2026-07-01 | Added regression guard for bounded ranking row desktop columns and summary wrapping. | Codex |
| 2026-07-02 | Planned navbar home link source guard. | Codex |
| 2026-07-02 | Added navbar home link source guard. | Codex |
| 2026-07-03 | Planned official contest banner regression guard. | Codex |
| 2026-07-03 | Added official contest banner regression guard. | Codex |
