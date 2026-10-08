import type { Summary } from "./summary.ts";

export function formatSummary(summary: Summary): string {
  const taskRows = [
    ["task", "grader", "pass", "rate", "status"],
    ...summary.tasks.map((t) => [
      t.taskId,
      t.grader,
      `${t.passes}/${t.trials}`,
      t.rate.toFixed(2),
      t.status,
    ]),
  ];
  const graderRows = [
    ["grader", "pass@1", `pass^${summary.k}`, "stable", "flaky", "broken"],
    ...summary.graders.map((g) => [
      g.grader,
      g.passAt1.toFixed(2),
      g.passHatK === undefined ? "-" : g.passHatK.toFixed(2),
      String(g.stable),
      String(g.flaky),
      String(g.broken),
    ]),
  ];
  return [formatHeader(summary), ...formatTable(taskRows), "", ...formatTable(graderRows), ""].join(
    "\n",
  );
}

// スイート名と，結果を再現するための記録．記録のない項目は表示しない．
function formatHeader(summary: Summary): string {
  const { model, promptVersion, seed } = summary.metadata;
  const items = [
    `provider: ${summary.provider}`,
    model === undefined ? undefined : `model: ${model}`,
    promptVersion === undefined ? undefined : `prompt: ${promptVersion}`,
    `trials: ${summary.trialsPerTask}`,
    seed === undefined ? undefined : `seed: ${seed}`,
  ];
  return `suite: ${summary.suite} (${items.filter((item) => item !== undefined).join(", ")})`;
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
