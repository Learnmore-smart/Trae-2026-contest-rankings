# app/trae-contest-2026/project/project-detail-client.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Renders full AI scoring details for one preliminary Demo topic.

## What It Does

- Shows title, author, track, source links, total and dimension scores, explanations, strengths, weaknesses, suggestions, compliance/material risks, match information, model, time, and confidence.
- Handles missing evaluation or missing match without crashing.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ProjectDetailClient` | component | Client-side project detail UI. |

## Dependencies

- Public API: `/api/trae-contest/topics/[id]`.

## Important Notes / NEVER Change

- Do not render raw forum HTML.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned detail client. | Codex |
