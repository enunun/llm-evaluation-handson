import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";

const packageDir = path.resolve(import.meta.dirname, "../..");

// promptfooで，偽LLMを使うスイートを各タスク10回ずつ実際に評価し，結果JSONのパスを返す．
async function runPromptfoo(): Promise<string> {
  const workDir = await mkdtemp(path.join(tmpdir(), "evalstats-"));
  const output = path.join(workDir, "result.json");
  await promisify(execFile)(
    "pnpm",
    [
      "exec",
      "promptfoo",
      "eval",
      "-c",
      "promptfooconfig.yaml",
      "--repeat",
      "10",
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

  it("偽LLMで10回ずつ評価したスイートの，タスクごとの合格率と状態，採点器ごとの集計を表示する", async () => {
    const { code, stdout } = await run(["summary", resultFile]);
    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        "suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)",
        "task         grader             pass   rate  status",
        "refund-01    category (QC01-1)  8/10   0.80  flaky",
        "refund-02    category (QC01-1)  0/10   0.00  broken",
        "refund-03    category (QC01-1)  0/10   0.00  broken",
        "shipping-01  category (QC01-1)  10/10  1.00  stable",
        "shipping-02  category (QC01-1)  8/10   0.80  flaky",
        "account-01   category (QC01-1)  10/10  1.00  stable",
        "account-02   category (QC01-1)  9/10   0.90  flaky",
        "other-01     category (QC01-1)  8/10   0.80  flaky",
        "other-02     category (QC01-1)  10/10  1.00  stable",
        "other-03     category (QC01-1)  9/10   0.90  flaky",
        "mixed-01     category (QC01-1)  0/10   0.00  broken",
        "",
        "grader             pass@1  pass^3  stable  flaky  broken",
        "category (QC01-1)  0.65    0.53    3       5      3",
        "",
      ].join("\n"),
    );
  });

  it("--kで，pass^kのkを変える", async () => {
    const { stdout } = await run(["summary", resultFile, "--k", "10"]);
    expect(stdout).toContain("grader             pass@1  pass^10  stable  flaky  broken\n");
  });
});

describe("evalstats の引数の誤り", () => {
  it("サブコマンドがなければ使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run([]);
    expect(code).toBe(2);
    expect(stderr).toContain("usage: evalstats summary <result.json> [--k <k>]");
  });

  it("未知のサブコマンドには使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run(["compare"]);
    expect(code).toBe(2);
    expect(stderr).toContain("unknown command: compare");
  });

  it("--kが1以上の整数でなければ使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run(["summary", "result.json", "--k", "0"]);
    expect(code).toBe(2);
    expect(stderr).toContain("usage:");
  });

  it("結果JSONを読めなければ理由を表示し，終了コード1を返す", async () => {
    const { code, stderr } = await run(["summary", "no-such-file.json"]);
    expect(code).toBe(1);
    expect(stderr).toContain("no-such-file.json");
  });
});
