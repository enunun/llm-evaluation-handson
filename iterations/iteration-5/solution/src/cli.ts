import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseResultFile } from "./promptfooResult.ts";
import { calibrate, parseCalibrationFile, serializeCalibration } from "./calibration.ts";
import { compareRuns, gate } from "./compare.ts";
import { seededRandom } from "./random.ts";
import { formatCalibration, formatComparison, formatSummary, formatTranscripts } from "./report.ts";
import { summarize } from "./summary.ts";

// mainが外界とやり取りする手段．テストでは偽物を渡す．
export type CliIo = {
  readFile(file: string): Promise<string>;
  writeFile(file: string, text: string): Promise<void>;
  stdout(text: string): void;
  stderr(text: string): void;
};

const usage = `usage:
  evalstats summary <result.json> [--k <k>] [--confidence <level>] [--target <rate>]
                    [--calibration <calibration.json>] [--seed <seed>]
  evalstats show <result.json> <task>
  evalstats calibrate <labels-result.json> [--split <split>] [--out <calibration.json>]
  evalstats compare <base.json> <head.json> [--margin <margin>] [--confidence <level>]
`;

const options = {
  k: { type: "string", default: "3" },
  confidence: { type: "string", default: "0.95" },
  target: { type: "string" },
  calibration: { type: "string" },
  seed: { type: "string", default: "1" },
  split: { type: "string" },
  out: { type: "string" },
  margin: { type: "string" },
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
      case "calibrate":
        return await calibrateCommand(rest, values, io);
      case "compare":
        return await compareCommand(rest, values, io);
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
  const seed = Number(values.seed);
  if (!Number.isInteger(seed) || seed < 1) {
    throw new UsageError("");
  }
  const result = parseResultFile(await io.readFile(file));
  const calibration =
    values.calibration === undefined
      ? undefined
      : {
          file: parseCalibrationFile(await io.readFile(values.calibration)),
          random: seededRandom(seed),
        };
  return formatSummary(
    summarize(result, {
      k,
      confidence,
      ...(target === undefined ? {} : { target }),
      ...(calibration === undefined ? {} : { calibration }),
    }),
  );
}

// 人手ラベルのスイートの評価結果で採点器を検証する．使えない採点器があれば終了コード1を返す．
async function calibrateCommand(args: string[], values: Values, io: CliIo): Promise<number> {
  const [file] = args;
  if (file === undefined) {
    throw new UsageError("");
  }
  const split = values.split === undefined ? {} : { split: values.split };
  const result = calibrate(parseResultFile(await io.readFile(file)), split);
  if (result.graders.length === 0) {
    throw new Error("no human labels in the result file");
  }
  io.stdout(formatCalibration(result));
  if (values.out !== undefined) {
    await io.writeFile(values.out, serializeCalibration(result));
  }
  return result.graders.every((g) => g.usable) ? 0 : 1;
}

async function showCommand(args: string[], io: CliIo): Promise<string> {
  const [file, taskId] = args;
  if (file === undefined || taskId === undefined) {
    throw new UsageError("");
  }
  return formatTranscripts(parseResultFile(await io.readFile(file)).trials, taskId);
}

// 2つの評価結果を比べる．--marginを与えると非劣性のゲートを判定し，不合格なら終了コード1を返す．
async function compareCommand(args: string[], values: Values, io: CliIo): Promise<number> {
  const [baseFile, headFile] = args;
  const confidence = Number(values.confidence);
  const margin = values.margin === undefined ? undefined : Number(values.margin);
  if (
    baseFile === undefined ||
    headFile === undefined ||
    !isProbability(confidence) ||
    (margin !== undefined && !(margin >= 0 && margin < 1))
  ) {
    throw new UsageError("");
  }
  const base = parseResultFile(await io.readFile(baseFile));
  const head = parseResultFile(await io.readFile(headFile));
  const comparison = compareRuns(base, head, { confidence });
  if (margin === undefined) {
    io.stdout(formatComparison(comparison, confidence));
    return 0;
  }
  const result = gate(comparison, margin);
  io.stdout(formatComparison(comparison, confidence, { margin, result }));
  return result.pass ? 0 : 1;
}

// 信頼水準と目標の合格率は，0より大きく1より小さい数である．
const isProbability = (value: number): boolean => value > 0 && value < 1;

// parseArgsは，未定義のオプションや値のないオプションでcodeの付いた例外を投げる．
const isParseArgsError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS");

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2), {
    readFile: (file) => readFile(file, "utf8"),
    writeFile: (file, text) => writeFile(file, text, "utf8"),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
