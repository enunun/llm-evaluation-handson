import type { Summary } from "./summary.ts";

export function formatSummary(summary: Summary): string {
  const rows = [
    ["task", "grader", "result"],
    ...summary.outcomes.map((o) => [o.taskId, o.grader, o.pass ? "pass" : "fail"]),
  ];
  return [
    `suite: ${summary.suite} (provider: ${summary.provider})`,
    ...formatTable(rows),
    `passed: ${summary.passedTasks}/${summary.totalTasks} (${summary.passRate.toFixed(2)})`,
    "",
  ].join("\n");
}

// 各列を，その列で最も長い値の幅に2文字の間を足した幅にそろえる．最後の列は詰めない．
function formatTable(rows: string[][]): string[] {
  const widths =
    rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === row.length - 1 ? cell : cell.padEnd((widths[column] ?? 0) + 2),
      )
      .join(""),
  );
}
