import { describe, expect, it } from "vitest";
import { formatSummary, formatTranscripts } from "../../src/report.ts";
import type { Trial } from "../../src/promptfooResult.ts";
import type { Summary } from "../../src/summary.ts";

const summary: Summary = {
  suite: "support",
  provider: "support-fake",
  metadata: { llm: "fake", model: "keyword", promptVersion: "classify-v1", seed: 1 },
  trialsPerTask: 10,
  k: 3,
  confidence: 0.95,
  tasks: [
    {
      taskId: "refund-01",
      grader: "category (QC01-1)",
      passes: 10,
      trials: 10,
      rate: 1,
      unknown: 0,
      errors: 0,
      interval: { lower: 0.6915, upper: 1 },
      status: "stable",
    },
    {
      taskId: "mixed-01",
      grader: "category (QC01-1)",
      passes: 3,
      trials: 10,
      rate: 0.3,
      unknown: 0,
      errors: 0,
      interval: { lower: 0.0667, upper: 0.6525 },
      status: "flaky",
    },
  ],
  graders: [
    {
      grader: "category (QC01-1)",
      passAt1: 0.65,
      estimate: { mean: 0.65, standardError: 0.35, interval: { lower: 0, upper: 1 } },
      passHatK: 0.5041666,
      stable: 1,
      flaky: 1,
      broken: 0,
      unknown: 2,
      errors: 1,
    },
  ],
};

const lines = (s: Summary) => formatSummary(s).split("\n");

describe("formatSummary", () => {
  it("1行目に，スイート名と再現のための記録を表示する", () => {
    expect(lines(summary)[0]).toBe(
      "suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)",
    );
  });

  it("記録のない項目は1行目に表示しない", () => {
    expect(lines({ ...summary, metadata: {} })[0]).toBe(
      "suite: support (provider: support-fake, trials: 10)",
    );
  });

  it("タスクと採点器ごとに，合格数，合格率，信頼区間，状態の表を表示する", () => {
    expect(lines(summary).slice(1, 4)).toEqual([
      "task       grader             pass   rate  95% CI        status",
      "refund-01  category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable",
      "mixed-01   category (QC01-1)  3/10   0.30  [0.07, 0.65]  flaky",
    ]);
  });

  it("空行のあとに，採点器ごとのpass@1，標準誤差，信頼区間，pass^k，状態ごとのタスクの数，unknownとerrorの件数の表を表示する", () => {
    expect(lines(summary).slice(4, 7)).toEqual([
      "",
      "grader             pass@1  SE    95% CI        pass^3  stable  flaky  broken  unknown  error",
      "category (QC01-1)  0.65    0.35  [0.00, 1.00]  0.50    1       1      0       2        1",
    ]);
  });

  it("信頼水準を列の名前に表示する", () => {
    expect(lines({ ...summary, confidence: 0.9 })[1]).toContain("90% CI");
  });

  it("標準誤差とpass^kを求めていなければ-を表示する", () => {
    const graders = [{ ...summary.graders[0]!, estimate: undefined, passHatK: undefined }];
    expect(lines({ ...summary, graders })[6]).toBe(
      "category (QC01-1)  0.65    -   -       -       1       1      0       2        1",
    );
  });

  it("目標を与えたときは，目標との比較の列を加える", () => {
    const graders = [{ ...summary.graders[0]!, targetVerdict: "inconclusive" as const }];
    const output = lines({ ...summary, target: 0.9, graders });
    expect(output[5]).toMatch(/error {2}target 0\.90$/);
    expect(output[6]).toMatch(/1 {6}inconclusive$/);
  });

  it("判定できた試行がないタスクは，合格率と区間を-と表示する", () => {
    const tasks = [
      {
        ...summary.tasks[0]!,
        passes: 0,
        trials: 0,
        unknown: 1,
        errors: 1,
        rate: undefined,
        interval: undefined,
        status: "unjudged" as const,
      },
    ];
    expect(lines({ ...summary, tasks })[2]).toBe(
      "refund-01  category (QC01-1)  0/0   -     -       unjudged",
    );
  });
});

const trial = (n: number, grader: string, outcome: Trial["outcome"], reason: string): Trial => ({
  taskId: "reply-01",
  trial: n,
  grader,
  output: n === 1 ? "ご連絡いたします．" : "無理．",
  outcome,
  reason,
});

describe("formatTranscripts", () => {
  it("タスクの試行ごとに，出力と，採点器ごとの結果と理由を表示する", () => {
    const trials = [
      trial(1, "no-promise (QC02-2)", "pass", "Assertion passed"),
      trial(1, "judge:polite (QC01-4)", "pass", "丁寧語がある"),
      trial(2, "no-promise (QC02-2)", "pass", "Assertion passed"),
      trial(2, "judge:polite (QC01-4)", "unknown", "判断できない"),
    ];
    expect(formatTranscripts(trials, "reply-01")).toBe(
      [
        "task: reply-01",
        "trial 1",
        "  output: ご連絡いたします．",
        "  no-promise (QC02-2): pass (Assertion passed)",
        "  judge:polite (QC01-4): pass (丁寧語がある)",
        "trial 2",
        "  output: 無理．",
        "  no-promise (QC02-2): pass (Assertion passed)",
        "  judge:polite (QC01-4): unknown (判断できない)",
        "",
      ].join("\n"),
    );
  });

  it("出力の改行は空白に置き換えて1行で表示する", () => {
    const multiline = { ...trial(1, "g", "pass", "ok"), output: "1行目\n2行目" };
    expect(formatTranscripts([multiline], "reply-01")).toContain("  output: 1行目 2行目\n");
  });

  it("タスクの試行がなければエラーにする", () => {
    expect(() => formatTranscripts([], "reply-09")).toThrow("unknown task: reply-09");
  });
});
