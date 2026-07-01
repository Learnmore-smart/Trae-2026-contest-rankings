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

  it("extracts full Trae conversation session IDs embedded in forum text", () => {
    const ids = [
      ".4153315959247984:0a23871189280e7925d4515c64045c12_6a327ad35bf41375acdb9c9a.6a327d5b5bf41375acdb9cd1.6a327d5bb6dc162a9ff172f9",
      ".4153315959247984:67743f4cd23f6ea9251fc09097ec6cd0_6a329c9aa7e5c559d2f081f8.6a329da0a7e5c559d2f0824e.6a329da05e5ebf063331b2c7",
      ".4153315959247984:e12024c573a4e0d60a98f7e38cf9acac_6a34d579e4a986155de298bb.6a35353de4a986155de2a206.6a35353bd3f7083fe09e23bb",
      ".4153315959247984:e0b580653d4454663328db341d37561c_6a34d579e4a986155de298bb.6a362067e4a986155de2b1d1.6a362066d3f7083fe09e23ec",
      ".4153315959247984:69ec6a76e6e9b1d7c929bd71053ac0fe_6a34d579e4a986155de298bb.6a362e3fe4a986155de2b5a8.6a362e3dd3f7083fe09e23fa"
    ];

    const text = `
      Key Session ID
      Read old code
      [${ids[0]}:Trae CN.T(2026/6/17 18:56:27)] | build mobile MVP |

      Remove redundant modules
      [${ids[1]}:Trae CN.T(2026/6/17 21:14:08)] | clean mobile dependencies |

      Mobile adaptation
      ${ids[2]}:Trae CN.T(2026/6/19 20:25:33)
      ${ids[3]}:Trae CN.T(2026/6/20 13:08:55)
      ${ids[4]}:Trae CN.T(2026/6/20 14:07:59)
    `;

    const signals = extractTopicSignals({ title: "Long Trae sessions", text });

    assert.equal(signals.sessionIds.length, ids.length);
    for (const id of ids) assert.ok(signals.sessionIds.includes(id));
    assert.equal(signals.traeEvidence.sessionIdCount, ids.length);
    assert.equal(signals.traeEvidence.hasThreeSessionIds, true);
  });

  it("tracks all demo-like links while keeping the canonical demo URL", () => {
    const html = `
      <a href="https://forum.trae.cn/t/internal/123">internal forum link</a>
      <a href="https://project-a.vercel.app/">Demo A</a>
      <a href="https://project-b.netlify.app/">Online preview</a>
    `;

    const signals = extractTopicSignals({
      title: "Multiple demos",
      html,
      baseUrl: "https://forum.trae.cn"
    });

    assert.equal(signals.demoUrl, "https://project-a.vercel.app/");
    assert.deepEqual(signals.demoUrls, ["https://project-a.vercel.app/", "https://project-b.netlify.app/"]);
    assert.equal(signals.traeEvidence.demoUrlCount, 2);
    assert.deepEqual(signals.traeEvidence.detectedDemoUrls, signals.demoUrls);
  });

  it("extracts visible Discourse lightbox and lazy-loaded images", () => {
    const html = `
      <a class="lightbox" href="/uploads/default/original/1X/original.png">
        <img
          src="/images/transparent.png"
          data-src="/uploads/default/optimized/1X/optimized_2_690x388.jpeg"
          data-orig-src="/uploads/default/original/1X/orig-from-data.webp"
          srcset="/uploads/default/optimized/1X/srcset-small.jpg 1x, /uploads/default/optimized/1X/srcset-large.jpg 2x"
        />
      </a>
      <img data-original-src="/uploads/default/original/1X/lazy-original.avif" />
    `;

    const signals = extractTopicSignals({
      title: "Image extraction",
      html,
      baseUrl: "https://forum.trae.cn"
    });

    assert.ok(signals.imageUrls.includes("https://forum.trae.cn/uploads/default/original/1X/original.png"));
    assert.ok(signals.imageUrls.includes("https://forum.trae.cn/uploads/default/optimized/1X/optimized_2_690x388.jpeg"));
    assert.ok(signals.imageUrls.includes("https://forum.trae.cn/uploads/default/original/1X/orig-from-data.webp"));
    assert.ok(signals.imageUrls.includes("https://forum.trae.cn/uploads/default/optimized/1X/srcset-small.jpg"));
    assert.ok(signals.imageUrls.includes("https://forum.trae.cn/uploads/default/optimized/1X/srcset-large.jpg"));
    assert.ok(signals.imageUrls.includes("https://forum.trae.cn/uploads/default/original/1X/lazy-original.avif"));
    assert.equal(signals.traeEvidence.screenshotCount, signals.imageUrls.length);
  });

  it("treats app downloads as non-web demo evidence", () => {
    const html = `
      <p>Mobile app demo package:</p>
      <a href="https://forum.trae.cn/uploads/short-url/app-release.apk">Android APK</a>
      <a href="https://forum.trae.cn/uploads/short-url/source.zip">Source zip</a>
    `;

    const signals = extractTopicSignals({
      title: "Android app demo",
      html,
      baseUrl: "https://forum.trae.cn"
    });

    assert.equal(signals.demoUrl, null);
    assert.deepEqual(signals.traeEvidence.downloadDemoUrls, [
      "https://forum.trae.cn/uploads/short-url/app-release.apk",
      "https://forum.trae.cn/uploads/short-url/source.zip"
    ]);
    assert.equal(signals.traeEvidence.hasDemoEvidence, true);
    assert.ok(signals.traeEvidence.demoEvidenceTypes?.includes("download"));
  });

  it("treats mini-program QR screenshots as visual demo evidence", () => {
    const html = `
      <p>微信小程序扫码体验，二维码见下图。</p>
      <img src="/uploads/default/original/1X/miniprogram-qr.png" />
    `;

    const signals = extractTopicSignals({
      title: "微信小程序 Demo",
      html,
      baseUrl: "https://forum.trae.cn"
    });

    assert.deepEqual(signals.traeEvidence.visualDemoImageUrls, [
      "https://forum.trae.cn/uploads/default/original/1X/miniprogram-qr.png"
    ]);
    assert.equal(signals.traeEvidence.hasDemoEvidence, true);
    assert.ok(signals.traeEvidence.demoEvidenceTypes?.includes("qr_or_image"));
  });

  it("generates stable content hashes", () => {
    assert.equal(getContentHash("A", "B"), getContentHash("A", "B"));
    assert.notEqual(getContentHash("A", "B"), getContentHash("A", "C"));
  });
});
