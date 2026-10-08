import { describe, expect, it } from "vitest";
import type { EvalResult } from "../../src/promptfooResult.ts";
import { summarize } from "../../src/summary.ts";

const result = (outcomes: EvalResult["outcomes"]): EvalResult => ({
  suite: "support",
  provider: "support-fake",
  outcomes,
});

describe("summarize", () => {
  it("すべての採点器に合格したタスクを，合格したタスクとして数える", () => {
    const summary = summarize(
      result([
        { taskId: "a", grader: "g1", output: "", pass: true },
        { taskId: "a", grader: "g2", output: "", pass: false },
        { taskId: "b", grader: "g1", output: "", pass: true },
      ]),
    );
    expect(summary.passedTasks).toBe(1);
    expect(summary.totalTasks).toBe(2);
  });

  it("合格率は，合格したタスクの数をタスクの数で割ったものである", () => {
    const summary = summarize(
      result([
        { taskId: "a", grader: "g", output: "", pass: true },
        { taskId: "b", grader: "g", output: "", pass: false },
        { taskId: "c", grader: "g", output: "", pass: true },
        { taskId: "d", grader: "g", output: "", pass: true },
      ]),
    );
    expect(summary.passRate).toBe(0.75);
  });

  it("タスクがなければ合格率を0にする", () => {
    expect(summarize(result([])).passRate).toBe(0);
  });
});
