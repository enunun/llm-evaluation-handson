import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseResultFile } from "./promptfooResult.ts";
import { formatSummary } from "./report.ts";
import { summarize } from "./summary.ts";

// mainが外界とやり取りする手段．テストでは偽物を渡す．
export type CliIo = {
  readFile(file: string): Promise<string>;
  stdout(text: string): void;
  stderr(text: string): void;
};

const usage =
  "usage: evalstats summary <result.json> [--k <k>] [--confidence <level>] [--target <rate>]\n";

// 信頼水準と目標の合格率は，0より大きく1より小さい数である．
const isProbability = (value: number): boolean => value > 0 && value < 1;

// evalstatsの入口．終了コードを返す．
export async function main(argv: string[], io: CliIo): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        k: { type: "string", default: "3" },
        confidence: { type: "string", default: "0.95" },
        target: { type: "string" },
      },
    });
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n${usage}`);
    return 2;
  }
  const [command, file] = args.positionals;
  if (command !== "summary") {
    io.stderr(command === undefined ? usage : `unknown command: ${command}\n${usage}`);
    return 2;
  }
  const k = Number(args.values.k);
  const confidence = Number(args.values.confidence);
  const target = args.values.target === undefined ? undefined : Number(args.values.target);
  if (
    file === undefined ||
    !Number.isInteger(k) ||
    k < 1 ||
    !isProbability(confidence) ||
    (target !== undefined && !isProbability(target))
  ) {
    io.stderr(usage);
    return 2;
  }
  try {
    const result = parseResultFile(await io.readFile(file));
    io.stdout(
      formatSummary(
        summarize(result, { k, confidence, ...(target === undefined ? {} : { target }) }),
      ),
    );
    return 0;
  } catch (error) {
    io.stderr(`evalstats: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2), {
    readFile: (file) => readFile(file, "utf8"),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
