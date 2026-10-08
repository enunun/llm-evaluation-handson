// 解答パッケージのモジュール依存図(design/modules.md)と，src/のimportを照合する．
// 約束はCOURSE.mdの「設計文書」にある．
//   - ノードのIDは，src/の下のファイル名から.tsを除いたもの．
//   - 外部のノードは:::externalを付け，照合から除く．
//   - 実線の矢印A --> Bは，AがBをimportすることを表す(1行に1本)．
import { readFile, readdir } from "node:fs/promises";
import { glob } from "node:fs/promises";
import path from "node:path";

const nodePattern = /^\s*([A-Za-z_][\w]*)(?:\[[^\]]*\]|\([^)]*\))?(:::external)?\s*$/;
const edgePattern =
  /^\s*([A-Za-z_]\w*)(?:\[[^\]]*\])?(:::external)?\s*-->\s*([A-Za-z_]\w*)(?:\[[^\]]*\])?(:::external)?\s*$/;
const importPattern = /(?:from|import)\s*\(?\s*["']\.\/([\w/]+)\.ts["']/g;

function parseDiagram(text) {
  const block = text.match(/```mermaid\n([\s\S]*?)```/);
  if (!block) throw new Error("no mermaid block");
  const nodes = new Set();
  const external = new Set();
  const edges = new Set();
  for (const line of block[1].split("\n")) {
    if (
      /^\s*(flowchart|graph|subgraph|end\b|classDef|%%|style|class )/.test(line) ||
      !line.trim()
    ) {
      continue;
    }
    const edge = line.match(edgePattern);
    if (edge) {
      const [, from, fromExt, to, toExt] = edge;
      if (fromExt) external.add(from);
      if (toExt) external.add(to);
      nodes.add(from);
      nodes.add(to);
      edges.add(`${from} --> ${to}`);
      continue;
    }
    const node = line.match(nodePattern);
    if (node) {
      nodes.add(node[1]);
      if (node[2]) external.add(node[1]);
      continue;
    }
    throw new Error(`unsupported line: ${line.trim()}`);
  }
  const internalEdges = [...edges].filter((edge) => {
    const [from, to] = edge.split(" --> ");
    return !external.has(from) && !external.has(to);
  });
  return {
    nodes: new Set([...nodes].filter((node) => !external.has(node))),
    edges: new Set(internalEdges),
  };
}

async function readSources(sourceDir) {
  const nodes = new Set();
  const edges = new Set();
  for (const entry of await readdir(sourceDir, { recursive: true })) {
    if (!entry.endsWith(".ts")) continue;
    const name = entry.slice(0, -".ts".length);
    nodes.add(name);
    const text = await readFile(path.join(sourceDir, entry), "utf8");
    for (const match of text.matchAll(importPattern)) {
      edges.add(`${name} --> ${match[1]}`);
    }
  }
  return { nodes, edges };
}

const difference = (a, b) =>
  [...a].filter((item) => !b.has(item)).toSorted((x, y) => x.localeCompare(y));

let failed = false;
let checked = 0;
for await (const file of glob("iterations/*/solution/design/modules.md")) {
  checked += 1;
  const packageDir = path.dirname(path.dirname(file));
  let diagram;
  try {
    diagram = parseDiagram(await readFile(file, "utf8"));
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    failed = true;
    continue;
  }
  const code = await readSources(path.join(packageDir, "src"));
  const problems = [
    ...difference(diagram.nodes, code.nodes).map((n) => `module only in diagram: ${n}`),
    ...difference(code.nodes, diagram.nodes).map((n) => `module only in code: ${n}`),
    ...difference(diagram.edges, code.edges).map((e) => `arrow only in diagram: ${e}`),
    ...difference(code.edges, diagram.edges).map((e) => `import only in code: ${e}`),
  ];
  for (const problem of problems) console.error(`${file}: ${problem}`);
  if (problems.length > 0) failed = true;
}

console.log(`design: ${checked} packages checked`);
process.exitCode = failed ? 1 : 0;
