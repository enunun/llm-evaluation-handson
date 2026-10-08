import { describe, expect, it } from "vitest";
import { formatSummary } from "../../src/report.ts";
import type { Summary } from "../../src/summary.ts";

const summary: Summary = {
  suite: "support",
  provider: "support-fake",
  outcomes: [
    { taskId: "refund-01", grader: "category (QC01-1)", output: "refund", pass: true },
    { taskId: "mixed-01", grader: "category (QC01-1)", output: "shipping", pass: false },
  ],
  passedTasks: 1,
  totalTasks: 2,
  passRate: 0.5,
};

describe("formatSummary", () => {
  it("1行目にスイート名とプロバイダ名を表示する", () => {
    expect(formatSummary(summary).split("\n")[0]).toBe("suite: support (provider: support-fake)");
  });

  it("タスク，採点器，合否の列をそろえた表を表示する", () => {
    expect(formatSummary(summary).split("\n").slice(1, 4)).toEqual([
      "task       grader             result",
      "refund-01  category (QC01-1)  pass",
      "mixed-01   category (QC01-1)  fail",
    ]);
  });

  it("最後の行に合格したタスクの数と割合を表示する", () => {
    expect(formatSummary(summary).trimEnd().split("\n").at(-1)).toBe("passed: 1/2 (0.50)");
  });
});
