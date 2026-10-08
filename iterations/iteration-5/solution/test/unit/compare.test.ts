import { describe, expect, it } from "vitest";
import { compareRuns, gate } from "../../src/compare.ts";
import type { EvalResult, GradeOutcome, Trial } from "../../src/promptfooResult.ts";

// タスクごとの合否の並びから，評価結果を作る．
function run(tasks: Record<string, boolean[]>, grader = "g", settings = "{}"): EvalResult {
  const trials: Trial[] = Object.entries(tasks).flatMap(([taskId, passes]) =>
    passes.map((pass, index) => ({
      taskId,
      trial: index + 1,
      grader,
      output: "",
      outcome: (pass ? "pass" : "fail") as GradeOutcome,
      reason: "",
    })),
  );
  return {
    suite: "support",
    provider: "p",
    metadata: {},
    trials,
    labels: [],
    graderSettings: { [grader]: settings },
  };
}

const base = run({ a: [true, false], b: [true, true], c: [false, false], d: [true, false] });
const better = run({ a: [true, true], b: [true, true], c: [true, false], d: [true, true] });

describe("compareRuns", () => {
  it("採点器ごとに，基準と対象の合格率と，タスクを対にした差の推定を求める", () => {
    const comparison = compareRuns(base, better, { confidence: 0.95 });
    const g = comparison.graders[0];
    expect(g).toMatchObject({ grader: "g", base: 0.5, head: 0.875, tasks: 4 });
    expect(g?.difference.mean).toBeCloseTo(0.375);
  });

  it("検出力80%で検出できる最小の差を求める", () => {
    const g = compareRuns(base, better, { confidence: 0.95 }).graders[0];
    expect(g?.minimumDetectableEffect).toBeCloseTo(
      (1.959964 + 0.841621) * (g?.difference.standardError ?? 0),
      4,
    );
  });

  it("差の区間の下限が0より大きければimproved，上限が0より小さければregressed，それ以外はinconclusiveとする", () => {
    const steady = run({ a: [true], b: [false], c: [true] });
    const up = run({ a: [true, true], b: [true, true], c: [true, true], d: [true, true] });
    const down = run({ a: [false, false], b: [true, false], c: [false, false], d: [false, false] });
    const all = run({ a: [true, true], b: [true, true], c: [true, true], d: [true, true] });
    const verdict = (x: EvalResult, y: EvalResult) =>
      compareRuns(x, y, { confidence: 0.95 }).graders[0]?.verdict;
    expect(
      verdict(
        run({ a: [false, false], b: [false, true], c: [false, false], d: [false, false] }),
        up,
      ),
    ).toBe("improved");
    expect(verdict(all, down)).toBe("regressed");
    expect(verdict(steady, steady)).toBe("inconclusive");
  });

  it("判定できた試行のないタスクは，対から除く", () => {
    const withError = run({
      a: [true, false],
      b: [true, true],
      c: [false, false],
      d: [true, false],
    });
    withError.trials = withError.trials.map((t) =>
      t.taskId === "d" ? { ...t, outcome: "error" } : t,
    );
    expect(compareRuns(withError, better, { confidence: 0.95 }).graders[0]?.tasks).toBe(3);
  });

  it("両方の結果にある採点器だけを比べる", () => {
    const other = { ...better, graderSettings: { ...better.graderSettings, h: "{}" } };
    expect(compareRuns(base, other, { confidence: 0.95 }).graders.map((g) => g.grader)).toEqual([
      "g",
    ]);
  });

  it("タスクの集合が違えば，比較せずにエラーにする", () => {
    const fewer = run({ a: [true], b: [true], c: [true] });
    expect(() => compareRuns(base, fewer, { confidence: 0.95 })).toThrow("task sets differ for g");
  });

  it("採点器の設定が違えば，比較せずにエラーにする", () => {
    const changed = run({ a: [true], b: [true], c: [true], d: [true] }, "g", '{"threshold":0.6}');
    expect(() => compareRuns(base, changed, { confidence: 0.95 })).toThrow(
      "grader settings differ for g",
    );
  });
});

describe("gate", () => {
  const comparison = compareRuns(base, better, { confidence: 0.95 });
  const withLower = (lower: number) => ({
    graders: comparison.graders.map((g) => ({
      ...g,
      difference: { ...g.difference, interval: { lower, upper: 0.2 } },
    })),
  });

  it("どの採点器でも差の区間の下限が-margin以上なら合格にする", () => {
    expect(gate(withLower(-0.04), 0.05)).toEqual({ pass: true, failures: [] });
  });

  it("差の区間の下限が-marginより小さい採点器があれば不合格にし，その採点器を挙げる", () => {
    expect(gate(withLower(-0.12), 0.05)).toEqual({
      pass: false,
      failures: [{ grader: "g", lower: -0.12 }],
    });
  });
});
