import type { AssertionValueFunctionContext } from "promptfoo";
import { describe, expect, it } from "vitest";
import { scriptedLlm } from "../../src/fakeLlm.ts";
import judgeAssertion, { gradeWithJudge } from "../../src/judgeAssertion.ts";

const rubric = "返信が丁寧な言葉遣いで書かれているか．";

// promptfooがアサーションに渡す文脈のうち，アサーションが使う設定と試行の番号だけを持つもの．
const context = (config: Record<string, unknown>, trial = 0): AssertionValueFunctionContext => ({
  prompt: undefined,
  vars: {},
  test: {},
  logProbs: undefined,
  config,
  provider: undefined,
  providerResponse: { metadata: { trial } },
  metadata: { trial },
});

describe("gradeWithJudge", () => {
  it("Judgeの判定passを，合格の採点結果にする", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "敬語である", verdict: "pass" })]);
    expect(await gradeWithJudge(llm, rubric, "ご連絡いたします．")).toEqual({
      pass: true,
      score: 1,
      reason: "敬語である",
      metadata: { outcome: "pass" },
    });
  });

  it("Judgeの判定failを，不合格の採点結果にする", async () => {
    const llm = scriptedLlm([JSON.stringify({ reason: "命令口調", verdict: "fail" })]);
    expect(await gradeWithJudge(llm, rubric, "早くしろ．")).toMatchObject({
      pass: false,
      score: 0,
      metadata: { outcome: "fail" },
    });
  });

  it("unknownとerrorは不合格として返し，メタデータに判定を残す", async () => {
    const unknown = scriptedLlm([JSON.stringify({ reason: "空", verdict: "unknown" })]);
    expect(await gradeWithJudge(unknown, rubric, "")).toMatchObject({
      pass: false,
      metadata: { outcome: "unknown" },
    });
    const error = scriptedLlm(["はい"]);
    expect(await gradeWithJudge(error, rubric, "")).toMatchObject({
      pass: false,
      metadata: { outcome: "error" },
    });
  });

  it("Judgeの呼び出しが失敗したら，errorの採点結果にする", async () => {
    const llm = scriptedLlm([]);
    expect(await gradeWithJudge(llm, rubric, "")).toMatchObject({
      pass: false,
      metadata: { outcome: "error" },
    });
  });
});

describe("judgeAssertion", () => {
  it("設定judge.llm: fakeでは，偽のJudgeで判定する", async () => {
    const config = { rubric, judge: { llm: "fake" } };
    expect(await judgeAssertion("ご連絡いたします．", context(config))).toMatchObject({
      pass: true,
      metadata: { outcome: "pass" },
    });
    expect(await judgeAssertion("無理．", context(config))).toMatchObject({
      pass: false,
      metadata: { outcome: "fail" },
    });
  });

  it("同じ出力と試行の番号なら，同じ判定を返す", async () => {
    const config = { rubric, judge: { llm: "fake", seed: 3, noise: 0.5 } };
    for (let trial = 0; trial < 10; trial++) {
      expect(await judgeAssertion("ご連絡いたします．", context(config, trial))).toEqual(
        await judgeAssertion("ご連絡いたします．", context(config, trial)),
      );
    }
  });

  it("noiseがあれば，試行によって判定が変わる", async () => {
    const config = { rubric, judge: { llm: "fake", seed: 3, noise: 0.5 } };
    const outcomes = new Set<unknown>();
    for (let trial = 0; trial < 20; trial++) {
      const result = await judgeAssertion("ご連絡いたします．", context(config, trial));
      outcomes.add(result.metadata?.outcome);
    }
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("Ollamaに接続できなければ，errorの採点結果にする", async () => {
    const config = { rubric, judge: { llm: "ollama", host: "http://127.0.0.1:9" } };
    expect(await judgeAssertion("ご連絡いたします．", context(config))).toMatchObject({
      pass: false,
      metadata: { outcome: "error" },
    });
  });

  it("ルーブリックがなければエラーにする", async () => {
    await expect(judgeAssertion("x", context({ judge: { llm: "fake" } }))).rejects.toThrow(
      /rubric/,
    );
  });
});
