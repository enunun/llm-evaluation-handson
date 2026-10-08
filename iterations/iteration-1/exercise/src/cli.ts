import { readFile } from "node:fs/promises";
import { parseResultFile } from "./promptfooResult.ts";
import { formatSummary } from "./report.ts";
import { summarize } from "./summary.ts";

// mainが外界とやり取りする手段．テストでは偽物を渡す．
export type CliIo = {
  readFile(file: string): Promise<string>;
  stdout(text: string): void;
  stderr(text: string): void;
};

const usage = "usage: evalstats summary <result.json>\n";

// evalstatsの入口．終了コードを返す．
export async function main(argv: string[], io: CliIo): Promise<number> {
  const [command, file] = argv;
  if (command !== "summary") {
    io.stderr(command === undefined ? usage : `unknown command: ${command}\n${usage}`);
    return 2;
  }
  if (file === undefined) {
    io.stderr(usage);
    return 2;
  }
  try {
    const result = parseResultFile(await io.readFile(file));
    io.stdout(formatSummary(summarize(result)));
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
