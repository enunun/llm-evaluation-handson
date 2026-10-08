// 設計文書と教材のMarkdownに含まれるMermaidのブロックを，すべて構文解析する．
// mermaid.parseはDOMを求めるため，jsdomでwindowとdocumentを用意してから読み込む．
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false });

const patterns = ["docs/**/*.md", "iterations/*/*/design/**/*.md", "iterations/*/*/docs/**/*.md"];
const blockPattern = /^```mermaid\n([\s\S]*?)^```/gm;

let blocks = 0;
const errors = [];
for (const pattern of patterns) {
  for await (const file of glob(pattern, { exclude: (name) => name.includes("node_modules") })) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(blockPattern)) {
      blocks += 1;
      const line = text.slice(0, match.index).split("\n").length;
      try {
        await mermaid.parse(match[1]);
      } catch (error) {
        errors.push(`${file}:${line}: ${String(error.message).split("\n").slice(0, 3).join(" ")}`);
      }
    }
  }
}

for (const error of errors) console.error(error);
console.log(`mermaid: ${blocks} blocks, ${errors.length} errors`);
process.exitCode = errors.length > 0 ? 1 : 0;
