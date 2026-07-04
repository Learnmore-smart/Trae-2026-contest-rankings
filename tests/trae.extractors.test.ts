import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractTopicSignals, getContentHash, isDeletedOrEmptyTopic } from "../lib/trae/extractors.ts";

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

  it("extracts all Trae Work CN session IDs from topic 48365 text", () => {
    const ids = [
      "696411359297017:46c12d442fb045ed6e8a479a11ee4fe2_6a326fb35617cfc45020219e.6a326fc4c65a8d012854b1a7.6a326fb35617cfc45020219f",
      "696411359297017:6c88b8258720fc755fb7e2e9908b3ab4_6a326fb35617cfc45020219e.6a32b951c55e06f95e2bdf47.6a32b951d9038949edf9748e",
      "696411359297017:e62da6940258ac25f717757a41a3ae06_6a326fb35617cfc45020219e.6a3a92065be2f62e4122627e.6a3a92063d3038c1df12b491",
      "696411359297017:a14a0470f12a73e62495e6548b83f1e5_6a326fb35617cfc45020219e.6a3ea15da1a8da4d9d65f473.6a3ea15d482fd83b909ec551"
    ];
    const text = `
      建立创意方案 Session ID: ${ids[0]}:TRAE Work CN.0.1.23.no_sid.no_ppe.T(2026/6/17 18:15:01)
      生成初步Demo Session ID: ${ids[1]}:TRAE Work CN.0.1.23.no_sid.no_ppe.T(2026/6/17 23:17:51)
      调整任务排序方式与信息一致性 Session ID: ${ids[2]}:TRAE Work CN.0.1.23.no_sid.no_ppe.T(2026/6/23 22:07:05)
      添加“组织”页面 Session ID: ${ids[3]}:TRAE Work CN.0.1.23.no_sid.no_ppe.T(2026/6/27 00:00:13)
    `;

    const signals = extractTopicSignals({ title: "任大师", text });

    assert.deepEqual(signals.sessionIds, ids);
    assert.equal(signals.traeEvidence.sessionIdCount, 4);
    assert.equal(signals.traeEvidence.hasThreeSessionIds, true);
  });

  it("extracts multiple plain session ids after a single label", () => {
    const ids = [
      "sess_alpha_00000001",
      "sess_beta_00000002",
      "sess_gamma_00000003",
      "sess_delta_00000004",
      "sess_epsilon_00000005",
      "sess_zeta_00000006",
      "sess_eta_00000007",
      "sess_theta_00000008",
      "sess_iota_00000009",
      "sess_kappa_00000010"
    ];
    const text = `
      TRAE Session IDs:
      ${ids.slice(0, 4).join(" ")}

      ${ids.slice(4, 7).join(", ")}

      ${ids.slice(7).join("\n")}
    `;

    const signals = extractTopicSignals({ title: "Many plain sessions", text });

    assert.deepEqual(signals.sessionIds, ids);
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

describe("isDeletedOrEmptyTopic", () => {
  it("treats topics with no material signals as deleted or empty", () => {
    assert.equal(
      isDeletedOrEmptyTopic({
        contentText: "   ",
        demoUrl: null,
        imageUrls: [],
        sessionIds: []
      }),
      true
    );
  });

  it("keeps sparse topics when any material signal remains", () => {
    assert.equal(isDeletedOrEmptyTopic({ contentText: "Project summary", demoUrl: null, imageUrls: [], sessionIds: [] }), false);
    assert.equal(isDeletedOrEmptyTopic({ contentText: "", demoUrl: "https://demo.example.test", imageUrls: [], sessionIds: [] }), false);
    assert.equal(isDeletedOrEmptyTopic({ contentText: "", demoUrl: null, imageUrls: ["https://forum.example.test/a.png"], sessionIds: [] }), false);
    assert.equal(isDeletedOrEmptyTopic({ contentText: "", demoUrl: null, imageUrls: [], sessionIds: ["s1"] }), false);
  });
});
