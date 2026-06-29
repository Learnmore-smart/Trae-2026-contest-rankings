# app/trae-contest-2026/contest-client.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Implements the public ranking UI for `/trae-contest-2026`.

## What It Does

- Shows hero, disclaimer, stats cards, filters, sorting, loading/error/empty states, and ranked preliminary Demo cards.
- Sends presence heartbeats.
- Never shows signup topics as ranking items.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ContestClient` | component | Client-side ranking interface. |

## Dependencies

- Public APIs under `/api/trae-contest/*`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use client fetches so the page can show a polished empty state even without Firestore env vars at build time.

## Important Notes / NEVER Change

- The disclaimer must remain visible and unambiguous.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public ranking client. | Codex |
