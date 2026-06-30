# app/trae-contest-2026/contest-client.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Implements the public ranking UI for `/trae-contest-2026`.

## What It Does

- Provides exactly two top-level navbar tabs: `Landing` and `Ranking`.
- Keeps compact navbar telemetry on the top right for total tokens and online users.
- Provides a navbar language toggle backed by route-local zh/en copy dictionaries so visible labels and explanatory copy render consistently in the selected language.
- Landing tab explains the purpose of the third-party TRAE contest scoring page, shows consolidated scoring progress as `已评分 x/y` / `Scored x/y`, and displays the four 领造官 portraits as large rectangular cards.
- Ranking tab provides three phase buttons (`初赛 / 复赛 / 总决赛`), a localized run button, and the active preliminary ranking list.
- Preliminary ranking supports search, track filtering, sort controls, clickable detail links, top-3 treatment, and per-dimension score bars.
- `RunButton` `POST`s `/api/trae-contest/run` then polls `GET` every 2s, maps backend phases to localized status text, and reloads page data when scoring is done.
- Sends presence heartbeats. Never shows signup topics as ranking items.
- No admin token, `/dev` link, source diagnostics panel, big stat-card grid, or duplicate demo/current-result counters are shown on the public page.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ContestClient` | component | Client-side ranking interface. |

## Dependencies

- Public APIs under `/api/trae-contest/*`.
- Local language provider from `./i18n`.
- Lead officer images under `public/super-star`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use client fetches so the page can show a polished empty state even without Firestore env vars at build time.
- 2026-06-29 Codex: Preserve route-local zh/en language handling instead of adding app-wide i18n, because this route owns nearly all visible contest copy.
- 2026-06-29 Codex: Owner requested a simpler bilingual structure: exactly two top-level tabs, navbar-right telemetry for tokens/online, consolidated progress (`已评分 x/y`), Landing for purpose plus four 领造官, and Ranking for phase buttons plus ranking/detail cards.
- 2026-06-29 Codex: Implemented the two-tab navbar, compact telemetry, localized copy dictionaries, consolidated scoring progress, landing/ranking split, and rectangular 领造官 landing band.

## Planned Change: Route-Backed Landing And Ranking

- 2026-06-29 Codex: Make the top-level landing/ranking split route-backed. `ContestClient` should accept an active tab from the server route, render nav as `Link`s, and avoid storing the main tab only in client state so refresh on `/trae-contest-2026/ranking` keeps the ranking page selected.
- 2026-06-30 Codex: Regression tests now fail because route nav keys lost literal `as const` markers and the component no longer renders the expected `hero-signal-strip` hook. Restore those static hooks without changing API calls, run-button behavior, or ranking data flow.
- Implemented: restored literal nav keys, the expected `Link` static shape, and the landing `hero-signal-strip`; `next dev` returned 200 for landing and ranking routes.

## Planned Change: Light Ranking Rows And Score Rings

- 2026-06-30 Codex: Owner approved replacing the clunky two-column card ranking with full-width ranking rows and circular score rings. Keep the existing fetch, filtering, sorting, phase, run-button, and route-backed navigation behavior; change only the presentation and stable layout hooks.
- 2026-06-30 Codex: Convert `RankCard` into a row-style ranking item with rank, project metadata, title/summary, total score ring, four aspect score rings, chips, and actions in one horizontal layout with responsive stacking.
- 2026-06-30 Codex: Add a reusable score-ring component that colors the completed arc with CSS custom properties and leaves the remaining arc gray. Aspect rings use their own maxima (`30` or `20`) while the total score ring uses `100`.
- 2026-06-30 Codex: Remove the framed ranking-result strip container and render result/progress counts as lightweight inline metadata.
- 2026-06-30 Codex: Preserve existing public labels and API calls; do not reintroduce old dashboard tabs or admin/dev controls.
- Implemented: `RankCard` now renders `rank-row` rows, total and aspect scores now use `ScoreRing`, the ranking result counts use `ranking-inline-meta`, and the ranking list uses a single-column `ranking-list`.

## Planned Change: Nav Dropdowns, Theme, View Mode, And Direct Card Open

- 2026-06-30 Codex: Continue partial implementation by preserving dropdown language and theme controls, adding the row/grid view control to the ranking meta row, and keeping the existing detail button.
- 2026-06-30 Codex: Make each ranking card open the detail page directly on card click while stopping propagation for the original-post and explicit detail controls.
- 2026-06-30 Codex: Use the existing `NavMenu`, `Dropdown`, `ViewToggle`, and `RankCard` helpers; only refine markup where needed for compact layout and accessibility.
- 2026-06-30 Codex: Keep API fetches, ranking filters, sort query construction, route-backed landing/ranking tabs, and run polling unchanged.

## Planned Change: Annotated Landing Hero

- 2026-06-29 Codex: Owner annotated the landing hero screenshot: move the red/purpose block upward and move the blue CTA/run control group to the right. Plan is to keep the copy in the left column, move the purpose/progress block and action controls into a right-side rail, and add stable class hooks for layout/style tests.
- 2026-06-29 Codex: Owner requested a full visual revamp with a stronger tech vibe. Plan is to keep API calls, ranking behavior, two-tab structure, i18n provider, and run button behavior unchanged, but restructure visible surfaces into a command-center shell: decorated nav status rail, technical hero command deck, telemetry strip, stronger right-side action rail, denser ranking toolbar, and more engineered ranking/officer cards.
- 2026-06-29 Codex: While verifying the revamp, the existing route-page regression test showed the shared client must use the `activeTab` prop from `/trae-contest-2026` and `/trae-contest-2026/ranking` instead of client-only `MainTab` state. Plan is to make nav and hero CTA use `Link` so refresh/bookmark behavior matches the route-backed pages.
- 2026-06-30 Codex: Owner requested removing the circled progress container in the landing hero side panel. Remove the `purpose-progress` block and any now-unused progress-bar calculation/styling while preserving the scored count in the hero signal strip, telemetry grid, ranking toolbar, and ranking inline metadata.
- Implemented: deleted the landing `purpose-progress` JSX block, removed the unused `progressPercent` calculation, and left the other scored-progress displays intact.

## Mobile Layout Repair Note

- 2026-06-29 Codex: Mobile screenshot shows navbar chips overflowing and the landing hero retaining desktop headline scale/spacing. Add a stable `landing-hero-title` hook to the hero heading, keep data/loading/routing behavior unchanged, and let CSS own responsive sizing and wrapping.
- Bug cause: mobile breakpoint only changed grid columns; it did not constrain nav chip widths, hide secondary desktop-only labels, or override desktop-scale heading utilities.
- Fix plan: add the hero title hook and mobile CSS constraints for nav wrapping, chip widths, hero padding, text wrapping, and action buttons.
- Implemented: added `landing-hero-title` and `nav-metrics__detail` hooks without changing fetch, route, ranking, or run-button behavior.

## Bug Fix Plan: Navbar Online And Telemetry

- 2026-06-29 Codex: Screenshot shows the user is online but the navbar still reads `在线: 0`. Cause: the client posts presence heartbeats but never applies the returned `onlineCount`, while the `/stats` response can be cached before the heartbeat. Fix by parsing successful heartbeat responses and merging `onlineCount` into existing stats state without changing the public stats API.
- 2026-06-29 Codex: Owner requested the language toggle at the left-most navbar position and a single token container. Plan is to render the language button before the brand, keep landing/ranking tabs centered, and render token telemetry as one chip with inline input/output detail instead of nested styled containers.
- Implemented: presence heartbeat responses now update `stats.onlineCount`; the navbar renders one language toggle as the first nav item; metrics render only token and online chips.

## Bug Fix Plan: Ranking Refresh Returns Home

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Refreshing while viewing `榜单` returned to `首页`. | The top-level section lived only in client state, and the nav used buttons that did not change the URL. | Add `/trae-contest-2026/ranking`, pass the active tab from each route, and render route links for `首页` and `榜单`. |

## Bug Fix Plan: Preserve Ranking During Pipeline Reload

- 2026-06-30 Codex: Owner observed that already-scored ranking rows appeared to disappear temporarily after clicking scoring/retry. Root cause in this component: `loading` renders `<LoadingGrid>` for every reload, even when `items` already contains the previous successful list, so a pipeline completion refresh hides the old rows while `/stats` and `/topics` are reloading.
- Fix strategy: keep existing rows visible during background reloads by only rendering the initial skeleton when `loading && items.length === 0`. Do not change fetch URLs, filters, sorting, run polling, or the successful payload replacement semantics.
- Regression risk: an empty result after search/filter must still show the empty state once loading finishes; the condition must not pin stale rows after a successful empty filtered response.
- Implemented: ranking skeleton now only renders for the first empty load, so existing rows remain visible during pipeline completion refreshes.
- 2026-06-30 Codex: Also render backend pipeline status messages for done/error states so the new bounded judge batch count is visible beside the button.
- 2026-06-30 Codex: Deadline fix plan: load `/stats` independently from `/topics` so a topic-list failure does not force the progress header to `0/0`.

## Important Notes / NEVER Change

- The disclaimer must remain visible and unambiguous.
- Keep `/trae-contest-2026` useful when Firestore is configured but no judged records exist yet; the empty state should explain which stage has zero data.
- Do not reintroduce the old `总览 / 榜单 / 数据 / 领造官` content tabs or the large metric-card grid.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Public UI showed too many pseudo-dashboard containers and mixed-language labels. | Earlier revamp split status across many cards and hard-coded mixed zh/en strings. | Consolidated to two tabs, moved telemetry into navbar, and localized copy through zh/en dictionaries. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public ranking client. | Codex |
| 2026-06-29 | Implemented route-local language switching and superstar creator image section. | Codex |
| 2026-06-29 | Implemented aggregate token total display. | Codex |
| 2026-06-29 | Full UI revamp: phase tabs, 领造官 band, single run button, removed pipeline panel and operator links. | Claude |
| 2026-06-29 | Implemented high-tech dashboard, route-local content tabs, rectangular 领造官 cards, and browser-verified responsive layout. | Codex |
| 2026-06-29 | Planned two-tab bilingual navbar simplification and ranking-progress consolidation. | Codex |
| 2026-06-29 | Planned annotated landing hero adjustment: purpose block upward, controls to right rail, and fancier control-deck styling. | Codex |
| 2026-06-29 | Implemented two-tab bilingual navbar, compact telemetry, landing/ranking split, and simplified ranking controls. | Codex |
| 2026-06-29 | Planned route-backed landing/ranking pages so refresh preserves the active top-level page. | Codex |
| 2026-06-30 | Implemented light row ranking layout with circular score rings. | Codex |
| 2026-06-30 | Removed the landing side-panel progress container requested in the screenshot. | Codex |
| 2026-06-30 | Planned compact nav dropdowns, row/grid view mode, and direct card-click detail behavior. | Codex |
