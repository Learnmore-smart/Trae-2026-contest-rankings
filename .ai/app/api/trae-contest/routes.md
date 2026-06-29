# app/api/trae-contest/*/route.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Documents the route handlers created for public, admin, and cron TRAE APIs.

## What It Does

- Public read routes expose stats, preliminary topic lists, topic details, and presence heartbeats.
- Admin routes validate `TRAE_ADMIN_TOKEN` before scrape/match/judge/run-history actions.
- Cron routes validate `TRAE_CRON_SECRET` before scheduled worker actions.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `GET /api/trae-contest/stats` | route | Public stats. |
| `GET /api/trae-contest/topics` | route | Public preliminary ranking list. |
| `GET /api/trae-contest/topics/[id]` | route | Public detail payload. |
| `POST /api/trae-contest/presence` | route | Public online heartbeat. |
| `POST /api/trae-contest/admin/*` | route | Token-protected manual jobs. |
| `GET /api/trae-contest/admin/runs` | route | Token-protected run history. |
| `POST /api/trae-contest/cron/[task]` | route | Secret-protected scheduler endpoint. |

## Dependencies

- Internal: `lib/trae/api`, `scraper`, `matcher`, `judge`, `config`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a single doc for related route handlers to keep the empty scaffold documentation manageable.

## Important Notes / NEVER Change

- Admin and cron APIs must reject missing or invalid tokens.
- Public APIs must not return raw HTML or secrets.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned TRAE API route handlers. | Codex |
