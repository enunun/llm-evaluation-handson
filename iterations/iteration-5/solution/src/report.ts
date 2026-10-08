import { criteria, type CalibrationResult } from "./calibration.ts";
import type { Comparison, GateResult } from "./compare.ts";
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
  return [
    formatHeader(summary),
    ...formatTable(taskRows),
    "",
    ...formatTable(graderRows),
    ...formatCorrections(summary),
    "",
  ].join("\n");
}

// 検証結果のTPRとTNRで補正した合格率の表．補正がなければ何も表示しない．
function formatCorrections(summary: Summary): string[] {
  if (summary.corrections === undefined || summary.corrections.length === 0) {
    return [];
  }
  const ci = `${Math.round(summary.confidence * 100)}% CI`;
  return [
    "",
    `corrected with calibration (split: ${summary.calibrationSplit ?? "all"})`,
    ...formatTable([
      ["grader", "observed", "TPR", "TNR", "corrected", ci],
      ...summary.corrections.map((c) => [
        c.grader,
        c.observed.toFixed(2),
        c.tpr.toFixed(2),
        c.tnr.toFixed(2),
        c.corrected.toFixed(2),
        formatInterval(c.interval),
      ]),
    ]),
  ];
}

// 2つの評価結果の比較．ゲートの結果を与えると，最後の行に合否を表示する．
export function formatComparison(
  comparison: Comparison,
  confidence: number,
  gateResult?: { margin: number; result: GateResult },
): string {
  const ci = `${Math.round(confidence * 100)}% CI`;
  const lines = formatTable([
    ["grader", "tasks", "base", "head", "diff", "SE", ci, "corr", "MDE(80%)", "verdict"],
    ...comparison.graders.map((g) => [
      g.grader,
      String(g.tasks),
      g.base.toFixed(2),
      g.head.toFixed(2),
      signed(g.difference.mean),
      g.difference.standardError.toFixed(2),
      `[${signed(g.difference.interval.lower)}, ${signed(g.difference.interval.upper)}]`,
      rate(g.difference.correlation),
      g.minimumDetectableEffect.toFixed(2),
      g.verdict,
    ]),
  ]);
  if (gateResult !== undefined) {
    const margin = gateResult.margin.toFixed(2);
    const failures = gateResult.result.failures.map(
      (f) => `${f.grader}: lower bound ${signed(f.lower)} < -${margin}`,
    );
    lines.push(
      gateResult.result.pass
        ? `gate: PASS (margin ${margin})`
        : `gate: FAIL (margin ${margin}; ${failures.join("; ")})`,
    );
  }
  return [...lines, ""].join("\n");
}

// 符号を付けた小数2桁．差を表示するときに使う．
const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

// 求まっていない率は-と表示する．
const rate = (value: number | undefined): string => (value === undefined ? "-" : value.toFixed(2));

// 人手ラベルによる採点器の検証結果．
export function formatCalibration(result: CalibrationResult): string {
  const items = Math.max(0, ...result.graders.map((g) => g.items));
  const lines = [
    `calibration (split: ${result.split ?? "all"}, items: ${items})`,
    ...formatTable([
      ["grader", "items", "TPR", "TNR", "self-consistency", "verdict"],
      ...result.graders.map((g) => [
        g.grader,
        String(g.items),
        rate(g.rates.tpr),
        rate(g.rates.tnr),
        g.selfConsistency.toFixed(2),
        verdict(g.rates.tpr, g.rates.tnr),
      ]),
    ]),
  ];
  for (const g of result.graders) {
    lines.push(
      "",
      g.grader,
      ...formatTable([
        ["", "pass", "fail", "unknown", "error"],
        ...(["pass", "fail"] as const).map((human) => [
          `human:${human}`,
          ...(["pass", "fail", "unknown", "error"] as const).map((o) => String(g.matrix[human][o])),
        ]),
      ]),
    );
  }
  for (const g of result.graders) {
    if (g.sweep !== undefined) {
      lines.push(
        "",
        `${g.grader} thresholds`,
        ...formatTable([
          ["threshold", "TPR", "TNR"],
          ...g.sweep.map((row) => [
            row.threshold.toFixed(2),
            row.tpr.toFixed(2),
            row.tnr.toFixed(2),
          ]),
        ]),
      );
    }
  }
  return [...lines, ""].join("\n");
}

// 合格基準を満たせばusable．満たさなければ，満たさない基準を添える．
function verdict(tpr: number | undefined, tnr: number | undefined): string {
  const failures = [
    ...((tpr ?? 0) >= criteria.tpr ? [] : [`TPR < ${criteria.tpr.toFixed(2)}`]),
    ...((tnr ?? 0) >= criteria.tnr ? [] : [`TNR < ${criteria.tnr.toFixed(2)}`]),
  ];
  return failures.length === 0 ? "usable" : `not usable (${failures.join(", ")})`;
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
