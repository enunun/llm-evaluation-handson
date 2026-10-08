import type { Trial } from "./promptfooResult.ts";
import type { Interval } from "./stats.ts";
import type { Summary } from "./summary.ts";

export function formatSummary(summary: Summary): string {
  const ci = `${Math.round(summary.confidence * 100)}% CI`;
  const taskRows = [
    ["task", "grader", "pass", "rate", ci, "status"],
    ...summary.tasks.map((t) => [
      t.taskId,
      t.grader,
      `${t.passes}/${t.trials}`,
      t.rate === undefined ? "-" : t.rate.toFixed(2),
      t.interval === undefined ? "-" : formatInterval(t.interval),
      t.status,
    ]),
  ];
  const targetColumn = summary.target === undefined ? [] : [`target ${summary.target.toFixed(2)}`];
  const graderRows = [
    [
      "grader",
      "pass@1",
      "SE",
      ci,
      `pass^${summary.k}`,
      "stable",
      "flaky",
      "broken",
      "unknown",
      "error",
      ...targetColumn,
    ],
    ...summary.graders.map((g) => [
      g.grader,
      g.passAt1.toFixed(2),
      g.estimate === undefined ? "-" : g.estimate.standardError.toFixed(2),
      g.estimate === undefined ? "-" : formatInterval(g.estimate.interval),
      g.passHatK === undefined ? "-" : g.passHatK.toFixed(2),
      String(g.stable),
      String(g.flaky),
      String(g.broken),
      String(g.unknown),
      String(g.errors),
      ...(summary.target === undefined ? [] : [g.targetVerdict ?? "-"]),
    ]),
  ];
  return [formatHeader(summary), ...formatTable(taskRows), "", ...formatTable(graderRows), ""].join(
    "\n",
  );
}

// タスクの試行ごとに，出力と，採点器ごとの結果と理由を表示する．
export function formatTranscripts(trials: Trial[], taskId: string): string {
  const ofTask = trials.filter((trial) => trial.taskId === taskId);
  if (ofTask.length === 0) {
    throw new Error(`unknown task: ${taskId}`);
  }
  const lines = [`task: ${taskId}`];
  for (const number of new Set(ofTask.map((trial) => trial.trial))) {
    const graded = ofTask.filter((trial) => trial.trial === number);
    lines.push(`trial ${number}`, `  output: ${graded[0]?.output.replaceAll("\n", " ") ?? ""}`);
    lines.push(...graded.map((trial) => `  ${trial.grader}: ${trial.outcome} (${trial.reason})`));
  }
  return [...lines, ""].join("\n");
}

const formatInterval = (interval: Interval): string =>
  `[${interval.lower.toFixed(2)}, ${interval.upper.toFixed(2)}]`;

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
