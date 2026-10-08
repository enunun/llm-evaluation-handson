// mainが外界とやり取りする手段．テストでは偽物を渡す．
export type CliIo = {
  readFile(file: string): Promise<string>;
  stdout(text: string): void;
  stderr(text: string): void;
};

// evalstatsの入口．終了コードを返す．
export async function main(argv: string[], io: CliIo): Promise<number> {
  throw new Error("TODO: main");
}

if (import.meta.main) {
  const { readFile } = await import("node:fs/promises");
  process.exitCode = await main(process.argv.slice(2), {
    readFile: (file) => readFile(file, "utf8"),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
