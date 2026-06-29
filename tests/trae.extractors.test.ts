import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTopicSignals, getContentHash } from "../lib/trae/extractors.ts";

describe("extractTopicSignals", () => {
  it("extracts demo urls, images, session ids, track hints, and evidence", () => {
    const html = `
      <p>赛道：硬件交互。TRAE 实践过程：我用 Trae 完成需求拆解。</p>
      <p>Demo 地址 <a href="https://demo.example.com/app">体验 Demo</a></p>
      <p>Session ID: trae-session-abc1234567890</p>
      <img src="/uploads/default/original/1X/a.png" />
      <img src="https://forum.trae.cn/uploads/default/original/1X/b.png" />
      <img src="https://forum.trae.cn/uploads/default/original/1X/c.png" />
      <a href="https://forum.trae.cn/uploads/short-url/file.zip">附件</a>
    `;

    const signals = extractTopicSignals({
      title: "硬件交互智能手环 Demo",
      html,
      baseUrl: "https://forum.trae.cn"
    });

    assert.equal(signals.demoUrl, "https://demo.example.com/app");
    assert.equal(signals.imageUrls.length, 3);
    assert.ok(signals.attachmentUrls.includes("https://forum.trae.cn/uploads/short-url/file.zip"));
    assert.ok(signals.sessionIds.includes("trae-session-abc1234567890"));
    assert.equal(signals.track, "硬件交互");
    assert.equal(signals.traeEvidence?.hasTraeProcess, true);
    assert.equal(signals.traeEvidence?.screenshotCount, 3);
  });

  it("generates stable content hashes", () => {
    assert.equal(getContentHash("A", "B"), getContentHash("A", "B"));
    assert.notEqual(getContentHash("A", "B"), getContentHash("A", "C"));
  });
});
