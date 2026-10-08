import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseResultFile } from "./promptfooResult.ts";
import { formatSummary, formatTranscripts } from "./report.ts";
import { summarize } from "./summary.ts";

// mainが外界とやり取りする手段．テストでは偽物を渡す．
export type CliIo = {
  readFile(file: string): Promise<string>;
  stdout(text: string): void;
  stderr(text: string): void;
};

const usage = `usage:
  evalstats summary <result.json> [--k <k>] [--confidence <level>] [--target <rate>]
  evalstats show <result.json> <task>
`;

const options = {
  k: { type: "string", default: "3" },
  confidence: { type: "string", default: "0.95" },
  target: { type: "string" },
} as const;

type Values = ReturnType<typeof parseArgs<{ options: typeof options }>>["values"];

// 引数の誤り．使い方を表示して終了コード2を返す．
class UsageError extends Error {}

// evalstatsの入口．終了コードを返す．
export async function main(argv: string[], io: CliIo): Promise<number> {
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options });
    const [command, ...rest] = positionals;
    switch (command) {
      case "summary":
        io.stdout(await summaryCommand(rest, values, io));
        return 0;
      case "show":
        io.stdout(await showCommand(rest, io));
        return 0;
      case undefined:
        throw new UsageError("");
      default:
        throw new UsageError(`unknown command: ${command}\n`);
    }
  } catch (error) {
    if (error instanceof UsageError || isParseArgsError(error)) {
      io.stderr(`${error instanceof UsageError ? error.message : `${String(error)}\n`}${usage}`);
      return 2;
    }
    io.stderr(`evalstats: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function summaryCommand(args: string[], values: Values, io: CliIo): Promise<string> {
  const [file] = args;
  const k = Number(values.k);
  const confidence = Number(values.confidence);
  const target = values.target === undefined ? undefined : Number(values.target);
  if (
    file === undefined ||
    !Number.isInteger(k) ||
    k < 1 ||
    !isProbability(confidence) ||
    (target !== undefined && !isProbability(target))
  ) {
    throw new UsageError("");
  }
  const result = parseResultFile(await io.readFile(file));
  return formatSummary(
    summarize(result, { k, confidence, ...(target === undefined ? {} : { target }) }),
  );
}

async function showCommand(args: string[], io: CliIo): Promise<string> {
  const [file, taskId] = args;
  if (file === undefined || taskId === undefined) {
    throw new UsageError("");
  }
  return formatTranscripts(parseResultFile(await io.readFile(file)).trials, taskId);
}

// 信頼水準と目標の合格率は，0より大きく1より小さい数である．
const isProbability = (value: number): boolean => value > 0 && value < 1;

// parseArgsは，未定義のオプションや値のないオプションでcodeの付いた例外を投げる．
const isParseArgsError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS");

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2), {
    readFile: (file) => readFile(file, "utf8"),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
