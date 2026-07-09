import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildConsensusJudgePrompt,
  buildJudgePrompt,
  getJudgeEvaluatorProfiles,
  PROMPT_VERSION,
  parseEvaluationJson,
  shouldJudgeTopicForMode
} from "../lib/trae/judge.ts";
import { runWithConcurrency } from "../lib/trae/concurrency.ts";
import { getTraeConfig } from "../lib/trae/config.ts";
import { DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY } from "../lib/trae/judge-policy.ts";
import type { EvaluationOutput, TraeEvaluation, TraeTopic } from "../lib/trae/types.ts";

const validPayload: EvaluationOutput = {
  totalScore: 82,
  innovationScore: 25,
  practicalityScore: 24,
  completionScore: 17,
  designScore: 16,
  complianceRiskScore: 2,
  directionConsistencyScore: 8,
  confidenceScore: 76,
  competitionLevel: "有竞争力",
  summary: "Demo 完整，方向清晰，但材料仍可补强。",
  strengths: ["有明确用户场景"],
  weaknesses: ["Demo 链接说明不足"],
  suggestions: ["补充更多开发过程截图"],
  complianceRisks: ["缺少 3 个 Session ID"],
  dimensionComments: {
    innovation: "有一定创新",
    practicality: "场景明确",
    completion: "可体验",
    design: "体验完整"
  },
  matchComment: "与报名方向基本一致"
};

describe("parseEvaluationJson", () => {
  it("parses fenced strict JSON into a validated evaluation object", () => {
    const parsed = parseEvaluationJson(`\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``);
    assert.equal(parsed.totalScore, 82);
    assert.equal(parsed.competitionLevel, "有竞争力");
  });

  it("rejects invalid score ranges", () => {
    assert.throws(() =>
      parseEvaluationJson(
        JSON.stringify({
          ...validPayload,
          innovationScore: 31
        })
      )
    );
  });
});

describe("multi-evaluator judging", () => {
  const topic = {
    id: "topic-1",
    sourceType: "preliminary",
    externalTopicId: "123",
    slug: "demo-post",
    title: "Static demo that needs stricter review",
    url: "https://forum.example.test/t/demo-post/123",
    authorName: "Noah",
    authorAvatarUrl: null,
    track: "学习工作",
    tags: ["AI"],
    replyCount: 2,
    viewCount: 99,
    likeCount: 5,
    createdAtExternal: null,
    lastActivityAtExternal: null,
    scrapedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    contentText: "This post links a demo and screenshots, but the judge has not opened either.",
    contentHtml: null,
    excerpt: "Demo excerpt",
    demoUrl: "https://demo.example.test",
    attachmentUrls: [],
    imageUrls: ["https://forum.example.test/a.png", "https://forum.example.test/b.png"],
    sessionIds: ["s1", "s2", "s3"],
    traeEvidence: {
      hasDemoUrl: true,
      hasTraeProcess: true,
      screenshotCount: 2,
      sessionIdCount: 3,
      hasThreeScreenshots: false,
      hasThreeSessionIds: true,
      processKeywords: ["TRAE"]
    },
    contentHash: "hash",
    status: "needs_judging",
    rawJson: null,
    rawHtml: null
  } satisfies TraeTopic;

  it("uses four independent evaluator profiles before consensus", () => {
    assert.deepEqual(
      getJudgeEvaluatorProfiles().map((profile) => profile.id),
      ["product", "technical", "ux", "risk"]
    );
  });

  it("discloses image and demo evidence limits in the base prompt when no visual evidence was gathered", () => {
    const prompt = buildJudgePrompt(topic, null);

    assert.match(prompt, /https:\/\/forum\.example\.test\/a\.png/);
    assert.match(prompt, /本轮未进行视觉识别/);
    assert.match(prompt, /截图或视觉识别未成功/);
  });

  it("does not frame failed visual automation as missing contestant materials when URLs exist", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      }))
    );

    assert.match(prompt, /demo URL available: yes/i);
    assert.match(prompt, /image URLs available: 2/i);
    assert.match(prompt, /do not describe that as missing contestant-provided materials/i);
  });

  it("treats Session ID evidence as binary present or missing, not a 3-ID threshold", () => {
    const prompt = buildJudgePrompt(
      {
        ...topic,
        sessionIds: ["one-real-session-id"],
        traeEvidence: {
          ...topic.traeEvidence,
          sessionIdCount: 1,
          hasThreeSessionIds: false
        }
      },
      null
    );

    assert.match(prompt, /Session IDs detected: yes/i);
    assert.doesNotMatch(prompt, /Session ID\s*少于\s*3|Session ID less than 3/i);
  });

  it("reports no demo URL distinctly from a failed screenshot attempt", () => {
    const prompt = buildJudgePrompt({ ...topic, demoUrl: null }, null);
    assert.match(prompt, /未检测到 Demo 链接/);
  });

  it("accepts download and QR evidence as Demo material for non-web submissions", () => {
    const prompt = buildJudgePrompt(
      {
        ...topic,
        title: "Mini program and Android app demo",
        demoUrl: null,
        attachmentUrls: ["https://forum.example.test/uploads/app-release.apk"],
        imageUrls: ["https://forum.example.test/qr.png"],
        traeEvidence: {
          ...topic.traeEvidence,
          hasDemoUrl: false,
          hasDemoEvidence: true,
          demoEvidenceTypes: ["download", "qr_or_image"],
          downloadDemoUrls: ["https://forum.example.test/uploads/app-release.apk"],
          visualDemoImageUrls: ["https://forum.example.test/qr.png"]
        }
      },
      null
    );

    assert.doesNotMatch(prompt, /缺少 Demo 体验地址/);
    assert.match(prompt, /Demo evidence types: download, qr_or_image/);
    assert.match(prompt, /https:\/\/forum\.example\.test\/uploads\/app-release\.apk/);
    assert.match(prompt, /https:\/\/forum\.example\.test\/qr\.png/);
    assert.match(prompt, /non-web demo evidence is available/i);
  });

  it("infers non-web Demo evidence from legacy topic fields during rejudge", () => {
    const prompt = buildJudgePrompt(
      {
        ...topic,
        title: "Legacy WeChat mini-program",
        demoUrl: null,
        attachmentUrls: ["https://forum.example.test/uploads/app-release.apk"],
        imageUrls: ["https://forum.example.test/miniprogram-qr.png"],
        contentText: "微信小程序扫码体验，二维码见下图。",
        traeEvidence: {
          ...topic.traeEvidence,
          hasDemoUrl: false
        }
      },
      null
    );

    assert.doesNotMatch(prompt, /缺少 Demo 体验证据/);
    assert.match(prompt, /Demo evidence types: download, qr_or_image/);
    assert.match(prompt, /https:\/\/forum\.example\.test\/uploads\/app-release\.apk/);
    assert.match(prompt, /https:\/\/forum\.example\.test\/miniprogram-qr\.png/);
  });

  it("surfaces real image and demo vision summaries in the prompt instead of the not-performed disclaimer", () => {
    const prompt = buildJudgePrompt(topic, null, {
      imageEvidence: { summary: "截图显示一个可交互的待办事项列表界面。", provider: "nvidia", model: "minimaxai/minimax-m3" },
      demoEvidence: { summary: "页面是一个静态营销落地页，没有可操作的产品功能。", provider: "nvidia", model: "minimaxai/minimax-m3" }
    });

    assert.match(prompt, /截图显示一个可交互的待办事项列表界面/);
    assert.match(prompt, /页面是一个静态营销落地页，没有可操作的产品功能/);
    assert.doesNotMatch(prompt, /本轮未进行视觉识别/);
    assert.doesNotMatch(prompt, /截图或视觉识别未成功/);
  });

  it("labels screenshot-proxy demo evidence as first-screen only, not browser click-through", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      })),
      {
        imageEvidence: null,
        demoEvidence: {
          summary: "The first screen renders a landing page with one start button.",
          provider: "nvidia",
          model: "minimaxai/minimax-m3",
          source: "screenshot_proxy",
          auditStatus: "first_screen_only",
          artifactType: "web"
        }
      }
    );

    assert.match(prompt, /first-screen screenshot proxy/i);
    assert.doesNotMatch(prompt, /interactive demo browsing \(automatic screenshot \+ vision inspection\) WAS performed/i);
    assert.match(prompt, /Do not call found but unverified Demo evidence missing/i);
  });

  it("labels browser or package audit evidence as verified demo inspection", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      })),
      {
        imageEvidence: null,
        demoEvidence: {
          summary: "Browser agent clicked the CTA and captured the interactive workflow.",
          provider: "browser-agent",
          model: "playwright+minimax-m3",
          source: "browser_agent",
          auditStatus: "browser_verified",
          artifactType: "web"
        }
      }
    );

    assert.match(prompt, /browser\/package demo audit WAS performed/i);
    assert.match(prompt, /Browser agent clicked the CTA/);
  });

  it("treats uploaded screenshots as official material evidence categories", () => {
    const prompt = buildJudgePrompt(topic, null, {
      imageEvidence: {
        summary: "Trae usage/development process screenshot: yes. Finished Demo/product interface screenshot: yes.",
        provider: "nvidia",
        model: "minimaxai/minimax-m3"
      },
      demoEvidence: null
    });

    assert.match(prompt, /Uploaded screenshot evidence can satisfy official ordinary screenshot material requirements/i);
    assert.match(prompt, /Trae usage\/development process screenshot/i);
    assert.match(prompt, /finished Demo\/product interface screenshot/i);
  });

  it("keeps default judging focused on unscored rows before stale rejudges", () => {
    const judgedTopic = { ...topic, status: "judged" as const };
    const unscoredTopic = { ...topic, status: "judged" as const, id: "topic-unscored" };
    const currentEvaluation = {
      ...validPayload,
      id: "eval-current",
      topicId: judgedTopic.id,
      sourceType: "preliminary",
      provider: "nvidia",
      model: "minimaxai/minimax-m3",
      promptVersion: PROMPT_VERSION,
      rawModelResponse: "{}",
      error: null,
      createdAt: "2026-07-01T00:00:00.000Z"
    } satisfies TraeEvaluation;
    const staleEvaluation = {
      ...currentEvaluation,
      id: "eval-stale",
      promptVersion: "trae-contest-2026-v3-visual-evidence"
    } satisfies TraeEvaluation;

    assert.equal(shouldJudgeTopicForMode(unscoredTopic, undefined, "unjudged"), true);
    assert.equal(shouldJudgeTopicForMode(judgedTopic, staleEvaluation, "unjudged"), false);
    assert.equal(shouldJudgeTopicForMode(judgedTopic, staleEvaluation, "changed"), true);
    assert.equal(shouldJudgeTopicForMode(judgedTopic, currentEvaluation, "unjudged"), false);
  });

  it("rejudges edited posts only in changed mode", () => {
    const editedTopic = {
      ...topic,
      status: "judged" as const,
      updatedAt: "2026-07-02T12:00:00.000Z"
    };
    const olderEvaluation = {
      ...validPayload,
      id: "eval-before-edit",
      topicId: editedTopic.id,
      sourceType: "preliminary",
      provider: "nvidia",
      model: "minimaxai/minimax-m3",
      promptVersion: PROMPT_VERSION,
      rawModelResponse: "{}",
      error: null,
      createdAt: "2026-07-02T11:59:00.000Z"
    } satisfies TraeEvaluation;
    const newerEvaluation = {
      ...olderEvaluation,
      id: "eval-after-edit",
      createdAt: "2026-07-02T12:01:00.000Z"
    } satisfies TraeEvaluation;

    assert.equal(shouldJudgeTopicForMode(editedTopic, olderEvaluation, "unjudged"), false);
    assert.equal(shouldJudgeTopicForMode(editedTopic, olderEvaluation, "changed"), true);
    assert.equal(shouldJudgeTopicForMode(editedTopic, newerEvaluation, "changed"), false);
  });

  it("builds a consensus prompt from all evaluator outputs and evidence limits", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      }))
    );

    assert.match(prompt, /Static demo that needs stricter review/);
    assert.match(prompt, /image vision was not performed/i);
    assert.match(prompt, /interactive demo browsing was not performed/i);
    for (const profile of profiles) {
      assert.match(prompt, new RegExp(profile.id));
      assert.match(prompt, new RegExp(profile.label));
    }
  });

  it("tells the consensus referee when visual evidence WAS actually gathered", () => {
    const profiles = getJudgeEvaluatorProfiles();
    const prompt = buildConsensusJudgePrompt(
      topic,
      null,
      profiles.map((profile) => ({
        profile,
        output: validPayload,
        rawContent: JSON.stringify(validPayload)
      })),
      {
        imageEvidence: { summary: "图片显示营销图，非产品截图。", provider: "nvidia", model: "minimaxai/minimax-m3" },
        demoEvidence: { summary: "Demo 是一个静态落地页。", provider: "nvidia", model: "minimaxai/minimax-m3" }
      }
    );

    assert.match(prompt, /image vision WAS performed/);
    assert.match(prompt, /first-screen screenshot proxy evidence WAS inspected/);
    assert.doesNotMatch(prompt, /image vision was not performed/);
    assert.doesNotMatch(prompt, /no browser\/package demo audit evidence is available/);
  });

  it("bumps the prompt version for the corrected demo and session audit standard", () => {
    assert.notEqual(PROMPT_VERSION, "trae-contest-2026-v4-official-screenshot-evidence");
    assert.match(PROMPT_VERSION, /demo-audit-standards/);
  });
});

describe("judge topic concurrency", () => {
  it("defaults to 8 teams and an overnight-sized judge batch for a 40 rpm quota", () => {
    assert.equal(DEFAULT_JUDGE_CONCURRENCY, 8);
    assert.equal(DEFAULT_JUDGE_BATCH_MAX, 4000);
  });

  it("runs queued work with no more than the requested concurrency", async () => {
    let active = 0;
    let peak = 0;
    const completed: number[] = [];

    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      completed.push(item);
      active -= 1;
    });

    assert.equal(peak, 3);
    assert.deepEqual([...completed].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("judge strategy surface", () => {
  it("does not expose a single-evaluator fast judge path or env switch", () => {
    const judgeSource = readFileSync("lib/trae/judge.ts", "utf8");
    const configSource = readFileSync("lib/trae/config.ts", "utf8");
    const envExample = readFileSync(".env.example", "utf8");

    assert.doesNotMatch(judgeSource, /judgeOneTopicFast|FAST SINGLE-EVALUATOR RUN|strategy:\s*"fast"/);
    assert.doesNotMatch(judgeSource, /JudgeStrategy|judgeStrategy/);
    assert.doesNotMatch(configSource, /TRAE_JUDGE_STRATEGY|JudgeStrategy|judgeStrategy/);
    assert.doesNotMatch(envExample, /TRAE_JUDGE_STRATEGY/);
  });

  it("filters deleted or empty topics before judge mode selection", () => {
    const judgeSource = readFileSync("lib/trae/judge.ts", "utf8");

    assert.match(judgeSource, /import \{ isDeletedOrEmptyTopic \} from "\.\/extractors\.ts";/);
    assert.match(
      judgeSource,
      /dedupeByTopicTitle\(mapped\)[\s\S]*?\.filter\(\(\{ topic \}\) => !isDeletedOrEmptyTopic\(topic\)\)[\s\S]*?\.filter\(\(\{ topic, latestEvaluation \}\) => shouldJudgeTopicForMode/
    );
  });

  it("resets the systemic-failure counter on every successful grade so the abort is truly consecutive", () => {
    const judgeSource = readFileSync("lib/trae/judge.ts", "utf8");

    // A successful grade must reset consecutiveSystemicFailures; otherwise two systemic
    // failures anywhere in the batch (even far apart, on a merely flaky gateway) abort the
    // whole run and freeze the "已评分" count. Guards the success path in judgeChangedTraeTopics.
    assert.match(
      judgeSource,
      /evaluatedCount \+= 1;[\s\S]*?consecutiveSystemicFailures = 0;[\s\S]*?\} catch \(error\) \{/
    );
  });

  it("stops taking new topics once the batch wall-clock deadline passes so the run can finalize", () => {
    const judgeSource = readFileSync("lib/trae/judge.ts", "utf8");

    // The worker must short-circuit past batchDeadlineAt (leaving remaining topics for the next
    // run) so finishRun + the snapshot refresh happen inside the cron timeout instead of Cloud
    // Run killing a mid-flight batch — which would freeze the public "最后更新" timestamp.
    assert.match(
      judgeSource,
      /batchDeadlineAt !== null && Date\.now\(\) >= batchDeadlineAt[\s\S]*?skippedForDeadline \+= 1;[\s\S]*?return;/
    );
  });
});

describe("judge batch wall-clock budget", () => {
  it("defaults the judge batch deadline to 690s, under the 900s cron timeout", () => {
    const previous = process.env.TRAE_JUDGE_BATCH_DEADLINE_MS;
    delete process.env.TRAE_JUDGE_BATCH_DEADLINE_MS;
    try {
      assert.equal(getTraeConfig().judgeBatchDeadlineMs, 690_000);
    } finally {
      if (previous === undefined) delete process.env.TRAE_JUDGE_BATCH_DEADLINE_MS;
      else process.env.TRAE_JUDGE_BATCH_DEADLINE_MS = previous;
    }
  });
});
