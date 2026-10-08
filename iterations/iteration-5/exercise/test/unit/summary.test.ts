import { describe, expect, it } from "vitest";
import type { EvalResult, GradeOutcome, Trial } from "../../src/promptfooResult.ts";
import { seededRandom } from "../../src/random.ts";
import { groupTrials, passHatK, summarize } from "../../src/summary.ts";

// 合否(または採点の結果)の並びから，1つのタスクと採点器の試行を作る．
const trials = (taskId: string, results: (boolean | GradeOutcome)[], grader = "g"): Trial[] =>
  results.map((r, index) => ({
    taskId,
    trial: index + 1,
    grader,
    output: "",
    outcome: r === true ? "pass" : r === false ? "fail" : r,
    reason: "",
  }));

const result = (all: Trial[]): EvalResult => ({
  suite: "support",
  provider: "support-fake",
  metadata: { seed: 1 },
  trials: all,
  labels: [],
});

describe("groupTrials", () => {
  it("同じタスクと採点器の試行をまとめる", () => {
    const groups = groupTrials(
      result([...trials("a", [true]), ...trials("b", [false]), ...trials("a", [false])]),
    );
    expect(groups.map((g) => [g.taskId, g.trials.length])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("同じタスクでも，採点器が違えば別にまとめる", () => {
    const groups = groupTrials(
      result([...trials("a", [true], "g1"), ...trials("a", [true], "g2")]),
    );
    expect(groups.map((g) => g.grader)).toEqual(["g1", "g2"]);
  });
});

describe("passHatK", () => {
  it("kが1なら合格率である", () => {
    expect(passHatK(7, 10, 1)).toBeCloseTo(0.7);
  });

  it("全試行で合格なら1である", () => {
    expect(passHatK(10, 10, 3)).toBe(1);
  });

  it("合格数がkより少なければ0である", () => {
    expect(passHatK(2, 10, 3)).toBe(0);
  });

  it("C(合格数, k) / C(試行数, k)で推定する", () => {
    expect(passHatK(8, 10, 3)).toBeCloseTo(56 / 120);
  });

  it("kが試行数より大きければエラーにする", () => {
    expect(() => passHatK(2, 2, 3)).toThrow(RangeError);
  });
});

describe("summarize", () => {
  it("タスクと採点器ごとに，合格数，試行数，合格率を求める", () => {
    const summary = summarize(result(trials("a", [true, false, true, true])), { k: 3 });
    expect(summary.tasks[0]).toMatchObject({ taskId: "a", passes: 3, trials: 4, rate: 0.75 });
  });

  it("全試行で合格ならstable，全試行で不合格ならbroken，それ以外はflakyにする", () => {
    const summary = summarize(
      result([
        ...trials("a", [true, true, true]),
        ...trials("b", [false, false, false]),
        ...trials("c", [true, false, true]),
      ]),
      { k: 3 },
    );
    expect(summary.tasks.map((t) => t.status)).toEqual(["stable", "broken", "flaky"]);
  });

  it("採点器ごとのpass@1は，タスクごとの合格率の平均である", () => {
    const summary = summarize(
      result([...trials("a", [true, false, false, false]), ...trials("b", [true, true])]),
      { k: 1 },
    );
    expect(summary.graders[0]?.passAt1).toBeCloseTo((0.25 + 1) / 2);
  });

  it("採点器ごとのpass^kは，タスクごとのpass^kの平均である", () => {
    const summary = summarize(
      result([...trials("a", [true, true, true]), ...trials("b", [true, true, false])]),
      { k: 2 },
    );
    expect(summary.graders[0]?.passHatK).toBeCloseTo((1 + 1 / 3) / 2);
  });

  it("試行数がkより少ないタスクがあれば，pass^kを求めない", () => {
    const summary = summarize(result(trials("a", [true, true])), { k: 3 });
    expect(summary.graders[0]?.passHatK).toBeUndefined();
  });

  it("採点器ごとに，stable，flaky，brokenのタスクの数を数える", () => {
    const summary = summarize(
      result([
        ...trials("a", [true, true]),
        ...trials("b", [true, false]),
        ...trials("c", [false, false]),
      ]),
      { k: 2 },
    );
    expect(summary.graders[0]).toMatchObject({ stable: 1, flaky: 1, broken: 1 });
  });

  it("採点器が複数あれば，採点器ごとに分けて集計する", () => {
    const summary = summarize(
      result([...trials("a", [true], "g1"), ...trials("a", [false], "g2")]),
      { k: 1 },
    );
    expect(summary.graders.map((g) => [g.grader, g.passAt1])).toEqual([
      ["g1", 1],
      ["g2", 0],
    ]);
  });

  it("タスクの合格率に，二項分布に基づく信頼区間を付ける", () => {
    const summary = summarize(
      result(trials("a", [true, true, true, true, true, true, true, false, false, false])),
      {
        k: 1,
        confidence: 0.95,
      },
    );
    expect(summary.tasks[0]?.interval?.lower).toBeCloseTo(0.3475, 4);
  });

  it("採点器ごとに，タスクごとの合格率の平均，標準誤差，信頼区間を求める", () => {
    const summary = summarize(
      result([
        ...trials("a", [true, true]),
        ...trials("b", [true, false]),
        ...trials("c", [false, false]),
      ]),
      { k: 1 },
    );
    expect(summary.graders[0]?.estimate?.mean).toBeCloseTo(0.5);
    expect(summary.graders[0]?.estimate?.standardError).toBeCloseTo(0.5 / Math.sqrt(3));
  });

  it("タスクが1つしかなければ，標準誤差を求めない", () => {
    const summary = summarize(result(trials("a", [true, false])), { k: 1 });
    expect(summary.graders[0]?.estimate).toBeUndefined();
  });

  it("目標を与えると，採点器ごとに区間と目標を比べる", () => {
    const summary = summarize(
      result([
        ...trials("a", [true, true]),
        ...trials("b", [true, true]),
        ...trials("c", [false, false]),
      ]),
      { k: 1, target: 0.9 },
    );
    expect(summary.target).toBe(0.9);
    expect(summary.graders[0]?.targetVerdict).toBe("inconclusive");
  });

  it("目標を与えなければ，目標と比べない", () => {
    const summary = summarize(result([...trials("a", [true]), ...trials("b", [true])]), { k: 1 });
    expect(summary.graders[0]?.targetVerdict).toBeUndefined();
  });

  it("unknownとerrorは合格率の計算から除き，件数を数える", () => {
    const summary = summarize(result(trials("a", [true, false, "unknown", "error"])), { k: 1 });
    expect(summary.tasks[0]).toMatchObject({
      passes: 1,
      trials: 2,
      rate: 0.5,
      unknown: 1,
      errors: 1,
    });
  });

  it("判定できた試行がないタスクは，合格率と区間を求めず，状態をunjudgedにする", () => {
    const summary = summarize(result(trials("a", ["unknown", "error"])), { k: 1 });
    expect(summary.tasks[0]).toMatchObject({
      rate: undefined,
      interval: undefined,
      status: "unjudged",
    });
  });

  it("採点器ごとに，unknownとerrorの件数を合計する", () => {
    const summary = summarize(
      result([...trials("a", [true, "unknown"]), ...trials("b", ["error", "unknown"])]),
      { k: 1 },
    );
    expect(summary.graders[0]).toMatchObject({ unknown: 2, errors: 1 });
  });

  it("採点器ごとの合格率は，判定できた試行のあるタスクだけで求める", () => {
    const summary = summarize(
      result([
        ...trials("a", [true, true]),
        ...trials("b", [false, false]),
        ...trials("c", ["error"]),
      ]),
      { k: 1 },
    );
    expect(summary.graders[0]?.passAt1).toBeCloseTo(0.5);
    expect(summary.graders[0]?.estimate?.mean).toBeCloseTo(0.5);
  });

  it("検証結果を与えると，検証した採点器の合格率を補正する", () => {
    const calibration = {
      split: "test",
      graders: { g: { tpr: 0.9, tnr: 0.8, positives: 40, negatives: 30 } },
    };
    const summary = summarize(
      result([
        ...trials("a", [true, true]),
        ...trials("b", [true, false]),
        ...trials("c", [false, false]),
      ]),
      { k: 1, calibration: { file: calibration, random: seededRandom(1) } },
    );
    expect(summary.corrections).toHaveLength(1);
    expect(summary.corrections?.[0]).toMatchObject({
      grader: "g",
      observed: 0.5,
      tpr: 0.9,
      tnr: 0.8,
    });
    expect(summary.corrections?.[0]?.corrected).toBeCloseTo((0.5 + 0.8 - 1) / (0.9 + 0.8 - 1));
  });

  it("検証結果にない採点器は補正しない", () => {
    const calibration = {
      split: "test",
      graders: { other: { tpr: 0.9, tnr: 0.8, positives: 4, negatives: 3 } },
    };
    const summary = summarize(result([...trials("a", [true]), ...trials("b", [false])]), {
      k: 1,
      calibration: { file: calibration, random: seededRandom(1) },
    });
    expect(summary.corrections).toEqual([]);
  });

  it("タスクあたりの試行数を求める", () => {
    const summary = summarize(
      result([...trials("a", [true, true]), ...trials("b", [true, true])]),
      {
        k: 1,
      },
    );
    expect(summary.trialsPerTask).toBe(2);
  });
});
