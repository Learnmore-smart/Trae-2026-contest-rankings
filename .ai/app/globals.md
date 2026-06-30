# app/globals.css

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Defines Tailwind layers and global visual primitives.

## What It Does

- Sets dark app background and typography smoothing.
- Defines high-tech global primitives: sticky two-tab navbar, compact telemetry chips, flat panels, cyan primary controls, phase tabs, rectangular 领造官 media cards, ranking cards, chips, progress bars, and empty/locked states.
- Provides responsive layouts for landing, ranking, filters, phase controls, and lead-officer cards.
- Provides reusable scrollbar, selection, focus, and reduced-motion styling.

## Dependencies

- External: Tailwind CSS.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a contest-stage visual direction with dark glass surfaces, ranking medals, and restrained gradients.
- 2026-06-29 Codex: Replace the warm award/stage primitives with a cooler high-tech command-center style: dark neutral background, cyan/green/amber accents, flatter panels, restrained hover motion, and rectangular media treatments.
- 2026-06-29 Codex: Removed the page-wide grid overlay after implementation so the result avoids the visible-line complaint while still reading as technical through panel structure, typography, and data controls.
- 2026-06-29 Codex: Reduced dashboard container density by moving tokens and online users into compact navbar telemetry, removing the large metric grid from the active UI, and styling a smoother two-tab landing/ranking flow.

## Planned Change: Annotated Landing Hero

- 2026-06-29 Codex: Adjust only route-level hero primitives: top-align the right rail, move the CTA/run controls beside the purpose block, add a subtle instrument-panel texture, and keep mobile as a single-column stack.
- 2026-06-29 Codex: Full tech-vibe revamp will replace the softer glass look with a graphite command-center system: black base, cyan/acid-green/amber signal accents, monospaced telemetry, hard-edged panel borders, scanline/circuit texture, stronger hover/focus states, and responsive dense layouts that avoid text overlap.
- 2026-06-30 Codex: Owner requested removing the circled landing side-panel progress container. Delete the now-unused `purpose-progress` and `bar-fill` style hooks after the JSX block is removed; keep the remaining hero, telemetry, and ranking count styles intact.

## Planned Change: Light Theme CSS Split

- 2026-06-30 Codex: Owner requested a less clunky light-mode redesign and a dedicated `theme.css`. Keep global CSS focused on layout/components and move theme tokens/background primitives into `app/theme.css`.
- 2026-06-30 Codex: Import `./theme.css` from `app/globals.css` and define the off-white canvas, ink text, subtle borders, and accent tokens there.
- 2026-06-30 Codex: Remove the heavy dark command-center overlays from the active visual system. Use restrained light panels, quiet borders, compact controls, and row-oriented ranking surfaces.
- 2026-06-30 Codex: Keep responsive overflow protections and the existing stable hooks used by route/layout tests.
- 2026-06-30 Codex: Add CSS for `ranking-list`, `rank-row`, `score-ring`, and inline ranking metadata so the new row layout does not depend on card grids or framed count strips.
- Implemented: `app/globals.css` imports `app/theme.css`, uses a light visual system, keeps existing landing/mobile hooks, and defines row/ring ranking styles.

## Planned Change: Compact Controls And Shadow-Free Hover

- 2026-06-30 Codex: Continue the screenshot requests by making the navbar more compact, moving language/theme dropdown controls to the right side, making the left-most tab edge square, and keeping dropdown menus readable in both themes.
- 2026-06-30 Codex: Tighten ranking toolbar/filter height so phase buttons, run control, search, filters, and view toggle consume less vertical space.
- 2026-06-30 Codex: Remove unused `purpose-progress`/`bar-fill` styles, remove ranking-row card shadows, and make hover only change border/background.
- 2026-06-30 Codex: Keep row/grid card layouts stable, compact, and responsive without translate effects.

## Mobile Layout Repair Note

- 2026-06-29 Codex: Mobile breakpoint needs explicit overflow controls, not just single-column grids.
- Bug cause: mobile CSS stacked major regions but left desktop nav metrics, desktop heading scale, and unconstrained chips/buttons active below 640px.
- Fix plan: clamp page width, make navbar chips wrap within the viewport, hide nonessential desktop-only brand/metric details on narrow screens, size the hero heading with a fixed mobile clamp, and make action buttons full-width where needed.
- Implemented: added document-level horizontal overflow protection, expanded compact nav/hero breakpoint to 768px, hid secondary nav metric detail and brand code on narrow screens, clamped hero title sizing, and made hero action controls full-width on mobile.

## Planned Change: Navbar Telemetry Layout

- 2026-06-29 Codex: Move the language toggle to the first navbar column, before the brand. Update the nav grid to four columns on desktop and keep mobile stacking controlled.
- 2026-06-29 Codex: Stop applying chip styles to every nested metric span. Style only direct `.nav-metrics > span` children so the token detail remains inside a single visible container.
- Implemented: desktop navbar uses a left language-toggle column and metric chip styles target direct children only, preventing the nested token detail from becoming a separate visible container.

## Important Notes / NEVER Change

- Do not reintroduce decorative page-wide grid lines, theatrical spotlights, circular creator portraits, or shimmer hovers.
- Text must fit within buttons/cards on mobile and desktop.
- 2026-06-30 Codex: Removed unused `purpose-progress` and `bar-fill` styles after deleting the landing side-panel progress container.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned global styles. | Codex |
| 2026-06-29 | Implemented refreshed surface, button, focus, scrollbar, and background primitives. | Codex |
| 2026-06-29 | Implemented high-tech global styles and removed stage/circle/foil-specific primitives from the active UI. | Codex |
| 2026-06-29 | Planned simplified navbar/landing/ranking styling and reduced dashboard container density. | Codex |
| 2026-06-29 | Planned landing hero right-rail realignment and fancier control-deck styling from screenshot annotations. | Codex |
| 2026-06-29 | Implemented two-tab navbar, compact telemetry, landing/ranking shells, phase pills, and simplified 领造官 band styling. | Codex |
