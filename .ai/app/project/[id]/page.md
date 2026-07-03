# app/project/[id]/page.tsx

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Server route entry for a single preliminary project detail page.

## What It Does

- Receives the App Router dynamic topic id.
- Passes a normalized topic id to `ProjectDetailClient`.
- Imports the detail page stylesheet.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ProjectPage` | component | Project detail route. |

## Dependencies

- Internal: `app/project/project-detail-client.tsx`.
- Internal: `lib/trae/topic-route-id.ts`.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Client-side navigation through Vercel external rewrites can deliver an RSC request where the dynamic route param is contaminated with a trailing `.rsc`. Normalize at this route boundary before the id reaches the client component.

## Important Notes / NEVER Change

- Keep this route thin; data loading stays in the client detail component and public API route.
- Do not remove id normalization unless the Vercel/Next RSC suffix behavior is proven gone and covered by tests.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-07-03 | Clicking a ranking card shows "project does not exist" until manual refresh. | RSC client navigation can pass `preliminary_x.rsc` as the dynamic id. | Normalize the route id before rendering `ProjectDetailClient`. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Created current root-level project detail route documentation and planned RSC suffix normalization. | Codex |
| 2026-07-03 | Implemented `normalizeTopicRouteId(id)` before passing the route param to `ProjectDetailClient`. | Codex |
