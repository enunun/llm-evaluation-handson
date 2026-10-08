import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";

const packageDir = path.resolve(import.meta.dirname, "../..");

// promptfooで，偽LLMを使うスイートを実際に評価し，結果JSONのパスを返す．
async function runPromptfoo(config = "promptfooconfig.yaml", repeat = "10"): Promise<string> {
  const workDir = await mkdtemp(path.join(tmpdir(), "evalstats-"));
  const output = path.join(workDir, "result.json");
  await promisify(execFile)(
    "pnpm",
    [
      "exec",
      "promptfoo",
      "eval",
      "-c",
      config,
      "--repeat",
      repeat,
      "--no-cache",
      "--no-table",
      "--no-progress-bar",
      "-o",
      output,
    ],
    {
      cwd: packageDir,
      env: {
        ...process.env,
        PROMPTFOO_CONFIG_DIR: path.join(workDir, "promptfoo"),
        PROMPTFOO_FAILED_TEST_EXIT_CODE: "0",
        PROMPTFOO_DISABLE_TELEMETRY: "1",
        PROMPTFOO_DISABLE_UPDATE: "1",
      },
    },
  );
  return output;
}

async function run(argv: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    readFile: (file) => readFile(file, "utf8"),
    writeFile: (file, text) => writeFile(file, text, "utf8"),
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

describe("evalstats summary", () => {
  let resultFile = "";
  beforeAll(async () => {
    resultFile = await runPromptfoo();
  });

  it("偽LLM，偽のJudge，偽の意思決定モデルで10回ずつ評価したスイートの，タスクと採点器ごとの集計を表示する", async () => {
    const { code, stdout } = await run(["summary", resultFile]);
    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        "suite: support (provider: support-fake, model: keyword, template, prompt: classify-v1, reply-v1, trials: 10, seed: 1)",
        "task         grader                     pass   rate  95% CI        status",
        "refund-01    category (QC01-1)          8/10   0.80  [0.44, 0.97]  flaky",
        "refund-02    category (QC01-1)          0/10   0.00  [0.00, 0.31]  broken",
        "refund-03    category (QC01-1)          0/10   0.00  [0.00, 0.31]  broken",
        "shipping-01  category (QC01-1)          10/10  1.00  [0.69, 1.00]  stable",
        "shipping-02  category (QC01-1)          8/10   0.80  [0.44, 0.97]  flaky",
        "account-01   category (QC01-1)          10/10  1.00  [0.69, 1.00]  stable",
        "account-02   category (QC01-1)          9/10   0.90  [0.55, 1.00]  flaky",
        "other-01     category (QC01-1)          8/10   0.80  [0.44, 0.97]  flaky",
        "other-02     category (QC01-1)          10/10  1.00  [0.69, 1.00]  stable",
        "other-03     category (QC01-1)          9/10   0.90  [0.55, 1.00]  flaky",
        "mixed-01     category (QC01-1)          0/10   0.00  [0.00, 0.31]  broken",
        "reply-01     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable",
        "reply-01     judge:polite (QC01-4)      9/9    1.00  [0.66, 1.00]  stable",
        "reply-01     decision:answers (QC01-1)  10/10  1.00  [0.69, 1.00]  stable",
        "reply-02     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable",
        "reply-02     judge:polite (QC01-4)      8/10   0.80  [0.44, 0.97]  flaky",
        "reply-02     decision:answers (QC01-1)  9/10   0.90  [0.55, 1.00]  flaky",
        "reply-03     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable",
        "reply-03     judge:polite (QC01-4)      10/10  1.00  [0.69, 1.00]  stable",
        "reply-03     decision:answers (QC01-1)  10/10  1.00  [0.69, 1.00]  stable",
        "reply-04     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable",
        "reply-04     judge:polite (QC01-4)      7/9    0.78  [0.40, 0.97]  flaky",
        "reply-04     decision:answers (QC01-1)  9/10   0.90  [0.55, 1.00]  flaky",
        "",
        "grader                     pass@1  SE    95% CI        pass^3  stable  flaky  broken  unknown  error",
        "category (QC01-1)          0.65    0.13  [0.40, 0.91]  0.53    3       5      3       0        0",
        "no-promise (QC02-2)        1.00    0.00  [1.00, 1.00]  1.00    4       0      0       0        0",
        "judge:polite (QC01-4)      0.89    0.06  [0.77, 1.00]  0.72    2       2      0       2        0",
        "decision:answers (QC01-1)  0.95    0.03  [0.89, 1.00]  0.85    2       2      0       0        0",
        "",
      ].join("\n"),
    );
  });

  it("showで，タスクの試行ごとの出力と，採点器ごとの結果と理由を表示する", async () => {
    const { code, stdout } = await run(["show", resultFile, "reply-02"]);
    expect(code).toBe(0);
    expect(stdout.split("\n").slice(0, 10)).toEqual([
      "task: reply-02",
      "trial 1",
      "  output: お問い合わせいただきありがとうございます．返金のご希望を承りました．商品の到着から30日以内で未使用の場合，担当部署が確認のうえご連絡いたします．",
      "  no-promise (QC02-2): pass (Assertion passed)",
      "  judge:polite (QC01-4): pass (丁寧語がある)",
      "  decision:answers (QC01-1): pass (probability 0.99 >= threshold 0.50)",
      "trial 2",
      "  output: ただいま新商品のセールを実施中です．ぜひご覧ください．",
      "  no-promise (QC02-2): pass (Assertion passed)",
      "  judge:polite (QC01-4): fail (丁寧語がない)",
    ]);
  });

  it("showで未知のタスクを指定したら，理由を表示して終了コード1を返す", async () => {
    const { code, stderr } = await run(["show", resultFile, "reply-09"]);
    expect(code).toBe(1);
    expect(stderr).toBe("evalstats: unknown task: reply-09\n");
  });

  it("--kで，pass^kのkを変える", async () => {
    const { stdout } = await run(["summary", resultFile, "--k", "10"]);
    expect(stdout).toContain("pass^10");
  });

  it("--confidenceで，信頼区間の水準を変える", async () => {
    const { stdout } = await run(["summary", resultFile, "--confidence", "0.8"]);
    expect(stdout).toContain(
      "refund-01    category (QC01-1)          8/10   0.80  [0.55, 0.95]  flaky\n",
    );
    expect(stdout).toContain(
      "category (QC01-1)          0.65    0.13  [0.49, 0.82]  0.53    3       5      3       0        0\n",
    );
  });

  it("--targetで，採点器ごとに信頼区間と目標を比べる", async () => {
    const { stdout } = await run(["summary", resultFile, "--target", "0.9"]);
    expect(stdout).toContain("error  target 0.90\n");
    expect(stdout).toContain("3       5      3       0        0      inconclusive\n");
  });
});

describe("evalstats calibrate", () => {
  let labelsFile = "";
  let resultFile = "";
  beforeAll(async () => {
    labelsFile = await runPromptfoo("labels.yaml", "5");
    resultFile = await runPromptfoo();
  });

  it("人手ラベルのスイートの評価結果から，分割ごとに採点器を検証して表示する", async () => {
    const { code, stdout } = await run(["calibrate", labelsFile, "--split", "dev"]);
    expect(stdout).toBe(
      [
        "calibration (split: dev, items: 10)",
        "grader                     items  TPR   TNR   self-consistency  verdict",
        "judge:polite (QC01-4)      10     0.88  1.00  0.50              usable",
        "decision:answers (QC01-1)  10     1.00  0.33  1.00              not usable (TNR < 0.80)",
        "",
        "judge:polite (QC01-4)",
        "            pass  fail  unknown  error",
        "human:pass  28    4     2        1",
        "human:fail  0     13    1        1",
        "",
        "decision:answers (QC01-1)",
        "            pass  fail  unknown  error",
        "human:pass  35    0     0        0",
        "human:fail  10    5     0        0",
        "",
        "decision:answers (QC01-1) thresholds",
        "threshold  TPR   TNR",
        "0.10       1.00  0.20",
        "0.20       1.00  0.20",
        "0.30       1.00  0.27",
        "0.40       1.00  0.33",
        "0.50       1.00  0.33",
        "0.60       1.00  0.33",
        "0.70       0.89  0.53",
        "0.80       0.77  0.53",
        "0.90       0.60  0.67",
        "",
      ].join("\n"),
    );
    expect(code).toBe(1);
  });

  it("--outで保存した検証結果を，summaryの--calibrationで使い，合格率を補正する", async () => {
    const calibrationFile = path.join(path.dirname(labelsFile), "calibration.json");
    await run(["calibrate", labelsFile, "--split", "dev", "--out", calibrationFile]);
    const { code, stdout } = await run(["summary", resultFile, "--calibration", calibrationFile]);
    expect(code).toBe(0);
    expect(stdout.trimEnd().split("\n").slice(-4)).toEqual([
      "corrected with calibration (split: dev)",
      "grader                     observed  TPR   TNR   corrected  95% CI",
      "judge:polite (QC01-4)      0.89      0.88  1.00  1.00       [0.87, 1.00]",
      "decision:answers (QC01-1)  0.95      1.00  0.33  0.85       [0.44, 1.00]",
    ]);
  });

  it("人の判定のない評価結果なら，理由を表示して終了コード1を返す", async () => {
    const { code, stderr } = await run(["calibrate", resultFile]);
    expect(code).toBe(1);
    expect(stderr).toBe("evalstats: no human labels in the result file\n");
  });
});

// promptfooconfig.yamlの一部を書き換えた設定で評価する．設定はパッケージの中に一時的に書き，評価のあとで消す．
async function runWithChange(name: string, from: RegExp, to: string): Promise<string> {
  const original = await readFile(path.join(packageDir, "promptfooconfig.yaml"), "utf8");
  const config = `.${name}.tmp.yaml`;
  await writeFile(path.join(packageDir, config), original.replace(from, to));
  try {
    return await runPromptfoo(config);
  } finally {
    await rm(path.join(packageDir, config));
  }
}

describe("evalstats compare", () => {
  let baseline = "";
  let noisier = "";
  let reseeded = "";
  beforeAll(async () => {
    [baseline, noisier, reseeded] = await Promise.all([
      runPromptfoo(),
      runWithChange("noisier", /^ {6}noise: 0\.1$/m, "      noise: 0.3"),
      runWithChange("reseeded", /^ {6}seed: 1$/m, "      seed: 2"),
    ]);
  });

  it("偽LLMの揺れを増やした版と比べ，採点器ごとの差を表示し，ゲートに落ちたら終了コード1を返す", async () => {
    const { code, stdout } = await run(["compare", baseline, noisier, "--margin", "0.05"]);
    expect(stdout).toBe(
      [
        "grader                     tasks  base  head  diff   SE    95% CI          corr  MDE(80%)  verdict",
        "category (QC01-1)          11     0.65  0.54  -0.12  0.05  [-0.21, -0.02]  0.95  0.14      regressed",
        "no-promise (QC02-2)        4      1.00  0.95  -0.05  0.03  [-0.11, +0.01]  -     0.08      inconclusive",
        "judge:polite (QC01-4)      4      0.89  0.79  -0.10  0.04  [-0.18, -0.02]  0.75  0.11      regressed",
        "decision:answers (QC01-1)  4      0.95  0.88  -0.07  0.02  [-0.12, -0.03]  0.58  0.07      regressed",
        "gate: FAIL (margin 0.05; category (QC01-1): lower bound -0.21 < -0.05; no-promise (QC02-2): lower bound -0.11 < -0.05; judge:polite (QC01-4): lower bound -0.18 < -0.05; decision:answers (QC01-1): lower bound -0.12 < -0.05)",
        "",
      ].join("\n"),
    );
    expect(code).toBe(1);
  });

  it("シードだけを変えた同じ設定どうし(A/A)の比較では，差の区間が0をまたぐ", async () => {
    const { code, stdout } = await run(["compare", baseline, reseeded]);
    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        "grader                     tasks  base  head  diff   SE    95% CI          corr  MDE(80%)  verdict",
        "category (QC01-1)          11     0.65  0.63  -0.03  0.02  [-0.07, +0.02]  0.99  0.07      inconclusive",
        "no-promise (QC02-2)        4      1.00  0.97  -0.02  0.02  [-0.07, +0.02]  -     0.07      inconclusive",
        "judge:polite (QC01-4)      4      0.89  0.84  -0.05  0.05  [-0.15, +0.05]  0.62  0.14      inconclusive",
        "decision:answers (QC01-1)  4      0.95  0.88  -0.07  0.05  [-0.17, +0.02]  0.30  0.13      inconclusive",
        "",
      ].join("\n"),
    );
  });

  it("採点器の設定が違う結果どうしは比べず，理由を表示して終了コード1を返す", async () => {
    const changed = await runWithChange("judge", /^( {12})noise: 0\.1$/m, "$1noise: 0.5");
    const { code, stderr } = await run(["compare", baseline, changed]);
    expect(code).toBe(1);
    expect(stderr).toBe("evalstats: grader settings differ for judge:polite (QC01-4)\n");
  });
});

describe("evalstats の引数の誤り", () => {
  it("サブコマンドがなければ使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run([]);
    expect(code).toBe(2);
    expect(stderr).toContain(
      "evalstats summary <result.json> [--k <k>] [--confidence <level>] [--target <rate>]\n",
    );
    expect(stderr).toContain("evalstats show <result.json> <task>\n");
    expect(stderr).toContain(
      "evalstats calibrate <labels-result.json> [--split <split>] [--out <calibration.json>]\n",
    );
  });

  it("未知のサブコマンドには使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run(["plot"]);
    expect(code).toBe(2);
    expect(stderr).toContain("unknown command: plot");
  });

  it("--kが1以上の整数でなければ使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run(["summary", "result.json", "--k", "0"]);
    expect(code).toBe(2);
    expect(stderr).toContain("usage:");
  });

  it("--confidenceや--targetが0より大きく1より小さい数でなければ使い方を表示し，終了コード2を返す", async () => {
    expect((await run(["summary", "result.json", "--confidence", "95"])).code).toBe(2);
    expect((await run(["summary", "result.json", "--target", "1"])).code).toBe(2);
  });

  it("結果JSONを読めなければ理由を表示し，終了コード1を返す", async () => {
    const { code, stderr } = await run(["summary", "no-such-file.json"]);
    expect(code).toBe(1);
    expect(stderr).toContain("no-such-file.json");
  });
});
