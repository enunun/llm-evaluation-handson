import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";
import { main } from "../../src/cli.ts";

const packageDir = path.resolve(import.meta.dirname, "../..");

// promptfooで，偽LLMを使うスイートを実際に評価し，結果JSONのパスを返す．
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

  it("偽LLMで評価したスイートの，タスクごとの合否と合格率を表示する", async () => {
    const { code, stdout } = await run(["summary", resultFile]);
    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        "suite: support (provider: support-fake)",
        "task         grader             result",
        "refund-01    category (QC01-1)  pass",
        "refund-02    category (QC01-1)  fail",
        "refund-03    category (QC01-1)  fail",
        "shipping-01  category (QC01-1)  pass",
        "shipping-02  category (QC01-1)  pass",
        "account-01   category (QC01-1)  pass",
        "account-02   category (QC01-1)  pass",
        "other-01     category (QC01-1)  pass",
        "other-02     category (QC01-1)  pass",
        "other-03     category (QC01-1)  pass",
        "mixed-01     category (QC01-1)  fail",
        "passed: 8/11 (0.73)",
        "",
      ].join("\n"),
    );
  });
});

describe("evalstats の引数の誤り", () => {
  it("サブコマンドがなければ使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run([]);
    expect(code).toBe(2);
    expect(stderr).toContain("usage: evalstats summary <result.json>");
  });

  it("未知のサブコマンドには使い方を表示し，終了コード2を返す", async () => {
    const { code, stderr } = await run(["compare"]);
    expect(code).toBe(2);
    expect(stderr).toContain("unknown command: compare");
  });

  it("結果JSONを読めなければ理由を表示し，終了コード1を返す", async () => {
    const { code, stderr } = await run(["summary", "no-such-file.json"]);
    expect(code).toBe(1);
    expect(stderr).toContain("no-such-file.json");
  });
});
