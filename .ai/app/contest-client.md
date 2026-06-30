# app/contest-client.tsx

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Implements the public contest landing and ranking client now mounted at `/` and `/ranking`.

## What It Does

- Fetches public stats, topic rows, run status, and presence data from `/api/trae-contest/*`.
- Renders the landing page, ranking filters, phase switch, run button, and ranking rows/grid.
- Keeps existing ranking rows visible during background reloads.
- Uses route-backed top-level navigation via `/` and `/ranking`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ContestClient` | component | Shared client UI for landing and ranking pages. |

## Dependencies

- Internal: `./i18n`, `./theme`, `@/lib/trae/types`.
- Public APIs: `/api/trae-contest/stats`, `/api/trae-contest/topics`, `/api/trae-contest/run`, `/api/trae-contest/presence`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: The app has been moved from `/trae-contest-2026` to root-level routes. Future source-level route tests must use `app/page.tsx`, `app/ranking/page.tsx`, and `app/contest-client.tsx`.

## Bug Fix Plan: Stats Request Must Survive Topic Deadline

- 2026-06-30 Codex: Owner reported `DEADLINE_EXCEEDED` plus the public page showing `0/0`. Root cause in the client: stats and topics are loaded with one `Promise.all`, so a deadline in the topic-list request prevents the already-light stats response from being applied.
- Fix strategy: start both fetches concurrently but await/apply the stats response independently before awaiting topics. Topic failure may show a list error, but it must not reset progress stats to null.
- Regression risk: stats and list can be briefly out of sync while the board cache rebuilds; this is acceptable and much better than displaying an empty contest.
- Implemented: `/stats` is started independently and applies `setStats` from its own promise; `/topics` failure no longer prevents the stats payload from being rendered.

## Important Notes / NEVER Change

- Keep the public disclaimer visible.
- Do not clear existing ranking rows during background reloads unless a successful payload replaces them.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created documentation for root-level contest client after route move. | Codex |
| 2026-06-30 | Implemented independent stats loading for Data Connect deadline recovery. | Codex |
