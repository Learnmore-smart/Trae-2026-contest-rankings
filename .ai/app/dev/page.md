# app/dev/page.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides a localhost-only development control page for running the TRAE scraper, matcher, judge, and full pipeline without exposing these controls publicly.

## What It Does

- Renders only after the server confirms the request host is local.
- Calls the local-only `/api/trae-contest/dev/run` endpoint.
- Shows recent job output and explains that production automation uses cron/admin endpoints instead.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `DevPage` | page | Local development operations page mounted at `/dev`. |

## Dependencies

- Internal: `/api/trae-contest/dev/run`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep `/dev` outside the contest route for quick local access, but enforce locality server-side because client-side hiding is not security.

## Important Notes / NEVER Change

- Do not allow this route or its API to work for non-localhost requests.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned localhost-only dev page. | Codex |
| 2026-06-29 | Implemented localhost-gated `/dev` page. | Codex |
