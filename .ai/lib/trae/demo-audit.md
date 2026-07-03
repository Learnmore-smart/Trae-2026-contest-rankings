# lib/trae/demo-audit.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

Runs optional real Demo audits for judge visual evidence: browser-click web demos and extract/render downloadable zip HTML demos.

## What It Does

- `auditDemoArtifact()` prefers a web Demo URL when present, otherwise tries downloadable zip evidence.
- Web audit uses an optional Playwright-compatible adapter to open the page, click a likely primary control, screenshot the resulting viewport, and send that screenshot to the vision model.
- Zip audit downloads a bounded zip package, extracts safe relative entries into a temp directory, opens the best `index.html` candidate through the same browser adapter, screenshots it, and sends the screenshot to the vision model.
- If Playwright is unavailable, URL is unsafe, download/extract fails, or vision fails, returns `null` so `vision.ts` can fall back to the screenshot proxy or honest no-verification wording.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `auditDemoArtifact` | function | Best-effort browser/package Demo audit returning `VisualEvidence | null`. |

## Dependencies

- Internal: `config`, `llm`, `types`, `vision`.
- Built-in: `node:fs/promises`, `node:os`, `node:path`, `node:url`, `node:zlib`.
- Optional external at runtime: `playwright` or `playwright-core`, loaded dynamically.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Keep Playwright optional to avoid breaking Vercel/serverless or current installs. The judge can pass this auditor; if the module cannot import Playwright, auditing returns `null` and existing thum.io fallback remains available.
- 2026-07-03 Codex: Use tests with fake Playwright and in-memory zip bytes so no real browser, network, or package download is needed for regression coverage.
- 2026-07-03 Codex: Direct browser/download auditing is inherently more sensitive than screenshot-proxy evidence. Block obvious localhost/private host strings and keep failures non-throwing.

## Important Notes / NEVER Change

- Never throw out of `auditDemoArtifact()` for ordinary audit failures; judging must degrade gracefully.
- Do not add a hard Playwright import unless package and deployment support are updated together.
- Keep zip extraction path-safe: no absolute paths, drive letters, or `..` segments.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Planned optional browser/package Demo auditor. | Codex |
