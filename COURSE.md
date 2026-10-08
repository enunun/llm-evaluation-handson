# コース計画

このファイルは，教材を作る人とエージェントのための計画である．
受講者向けの説明は`README.md`と`docs/`にある．
各Iterationで何を作るかは`docs/ROADMAP.md`だけが決め，レイアウト，コマンド，ツールの約束はこのファイルだけが決める．

## 受講者と目標

- 受講者：プログラミングと単体テストの経験があり，LLMのAPIを呼ぶアプリを作ったことがある．評価の体系的な方法は知らない．TypeScriptを読み書きできる．
- 目標：受講後に，次のことができる．
  - 非決定的な出力を複数回試行し，合格率，標準誤差，信頼区間，pass^kで品質を語る．
  - 評価のスイートと採点器(コード，LLM Judge，意思決定モデル)を設計し，モデル型の採点器を人手ラベルで検証する．
  - 2つの版を対応のある差で比べ，回帰をCIのゲートで止める．
- 教材の言語：日本語．文体は常体で，読点は「，」，句点は「．」を使う(`.textlintrc.yml`で検査する)．
- 規模：Iteration 0〜5の6つ．1つあたり60〜90分．

## 拠り所にする指針

`docs/ROADMAP.md`の「拠り所にする指針」の表に従う．
品質特性の名前はQA4AIガイドライン2025.04版の10章(QC01〜QC05)に，評価の用語はAnthropicの"Demystifying evals for AI agents"にそろえる．
採点器の`metric`名は`<採点器名> (<QC番号>)`の形にする(例：`category (QC01-1)`)．

## 題材

カスタマーサポート向けのLLM機能(問い合わせの分類と返信の下書き)と，その評価．

- 製品：`classifyInquiry`(Iteration 0)と`draftReply`(Iteration 3)．
- 評価の実行と採点：promptfoo．受講者は，製品を呼ぶカスタムプロバイダと，モデル型の採点器のカスタムアサーションを書く．
- 分析：受講者が作るCLI`evalstats`．promptfooの結果JSONを読み，集計，区間推定，採点器の検証，比較を受け持つ．

完成形の使用例は`docs/ROADMAP.md`の冒頭にある．

## 設計文書

各パッケージの`design/`に置く．記法はMarkdownの中のMermaidである．

| ファイル | 内容 | 増え方 |
| --- | --- | --- |
| `design/modules.md` | モジュール依存図(`flowchart LR`)．製品側と分析側，外部(promptfoo，Ollama)の境界を示す | モジュールと依存の矢印が増える |
| `design/types.md` | 主な型とその関係(`classDiagram`) | 型，フィールド，関係が増える |
| `design/adr/NNNN-<題>.md` | 評価方法の判断の記録．見出しは「状況」「決定」「理由」「影響」 | 各Iterationで1つ増える |

モジュール依存図には，次の約束がある．

- ノードのIDは，`src/`の下のファイル名から`.ts`を除いたもの(例：`supportProvider`)である．
- 外部のノードは`:::external`を付ける(例：`promptfoo[promptfoo]:::external`)．外部への矢印は照合しない．
- 実線の矢印`A --> B`は，`A`が`B`をimportすることを表す．型だけのimportも含む．
- `scripts/check-design.mjs`が，図の矢印と`src/`のimportを照合する．

## 開発環境

### Dev Container

- `.devcontainer/compose.yml`の2つのサービス：
  - `app`：`jdxcode/mise`のDebianイメージに，`mise.toml`のツールを入れたもの．受講者が作業する．
  - `ollama`：`ollama/ollama:0.35.1`．モデルは名前付きボリューム`ollama-models`に保存する．`app`からは`http://ollama:11434`で呼ぶ．
- 環境変数(`devcontainer.json`の`containerEnv`)：
  - `OLLAMA_HOST=http://ollama:11434`
  - `PROMPTFOO_DISABLE_TELEMETRY=1`，`PROMPTFOO_DISABLE_UPDATE=1`
- VSCodeの拡張：
  - Vitest(`vitest.explorer`)，TypeScript 7(`typescriptteam.native-preview`)，oxlintとoxfmt(`oxc.oxc-vscode`)
  - Mermaidのプレビュー(`bierner.markdown-mermaid`)，YAML(`redhat.vscode-yaml`)
  - markdownlint，textlint，Claude Code
- ポート15500を転送し，`promptfoo view`をホストのブラウザで開けるようにする．
- `mise.toml`で固定するツール：node 26.10.0，pnpm 12.6.0，rtk，lefthook．

### パッケージと版

ルートの`package.json`の`devDependencies`に，すべてのパッケージで共通に使うものを置く．

| 用途 | パッケージ | 版 |
| --- | --- | --- |
| 型検査 | `typescript` | 7.0.2 |
| テスト | `vitest` | 5.0.1 |
| リント | `oxlint`，`oxlint-tsgolint`(型情報を使う規則) | 1.85.0，7.0.2002 |
| 整形 | `oxfmt` | 0.70.0 |
| 評価の実行 | `promptfoo` | 0.123.1 |
| 図の構文検査 | `mermaid`，`jsdom` | 12.0.0，30.1.1 |
| 文書の検査 | `textlint`，`markdownlint-cli2` | `package.json`の範囲指定 |

`pnpm-workspace.yaml`の`minimumReleaseAge`で，公開から2週間未満の版を入れないようにしている．
インストール時のスクリプトは，`allowBuilds`で許した依存(`esbuild`，`@swc/core`)だけが実行する．

各Iterationのパッケージは，次のものを`dependencies`に持つ．

- Iteration 0から：`ollama`(Ollamaのクライアント)，`zod`．
- 受講者が加えるもの：Iteration 1で`@stdlib/random-base-mt19937`，Iteration 2で`simple-statistics`，`@stdlib/stats-binomial-test`，`@stdlib/stats-base-dists-normal-quantile`．

### 実行のしかた

TypeScriptはビルドせず，Node.jsの型の除去でそのまま実行する．

- importは拡張子`.ts`付きで書く．`tsconfig`は`allowImportingTsExtensions`，`noEmit`，`erasableSyntaxOnly`，`verbatimModuleSyntax`を有効にする．
- `enum`，名前空間，パラメータプロパティなど，型の除去で消せない構文は使わない．

### リポジトリの構成

```text
COURSE.md                        コース計画(作る人向け)
README.md                        コースの概要とIterationの一覧(受講者向け)
docs/ROADMAP.md                  Iterationごとの要求，学ぶこと，設計文書の更新
docs/tdd.md                      テスト駆動開発とテストリストの書き方
docs/design.md                   設計文書の書き方
docs/notes/README.md             ノートの目次
docs/notes/iteration-N.md        Iteration Nで初めて使う構文，概念，ツールのノート
iterations/iteration-N/
  exercise/                      受講者の作業場所
  solution/                      完成形と模範解答
scripts/check-mermaid.mjs        設計文書のMermaidの構文検査
scripts/check-design.mjs         モジュール依存図とimportの照合
package.json                     ワークスペース共通の開発用依存とスクリプト
pnpm-workspace.yaml              iterations/*/*をパッケージとして登録する
tsconfig.base.json               各パッケージが継承するTypeScriptの設定
.oxlintrc.json                   oxlintの設定
.oxfmtrc.json                    oxfmtの設定
```

各パッケージは，次のものを持つ．

```text
README.md                 このIterationで作るもの，進め方，ディレクトリ構成
TESTLIST.md               テストリスト(演習はひな形，解答は模範解答)
design/                   設計文書
docs/iteration-N.md       演習：手順 / 解答：各手順の解説
package.json              名前は@handson/iteration-N-exercise，@handson/iteration-N-solution
tsconfig.json             ../../../tsconfig.base.jsonを継承する
vitest.config.ts          unitとintegrationの2つのprojectを定義する
promptfooconfig.yaml      評価のスイート
src/                      製品，プロバイダ，アサーション，evalstats
test/unit/                単体テスト
test/integration/         統合テスト
results/                  promptfooの結果JSON(.gitignoreで除外)
```

### コマンド

パッケージのディレクトリ(`iterations/iteration-N/exercise`など)で実行する．

| 操作 | コマンド |
| --- | --- |
| 依存の導入とパッケージの登録 | `pnpm install`(リポジトリのルートで) |
| すべてのテスト | `pnpm test` |
| 単体テストだけ | `pnpm test:unit`(`vitest run --project unit`) |
| 統合テストだけ | `pnpm test:integration`(`vitest run --project integration`) |
| 1つのテストファイル | `pnpm vitest run test/unit/<名前>.test.ts` |
| ウォッチモード | `pnpm vitest --project unit` |
| 型検査 | `pnpm typecheck` |
| 評価の実行 | `pnpm eval -o results/<名前>.json`(`promptfoo eval`) |
| 結果のブラウザ表示 | `pnpm promptfoo view` |
| 分析 | `pnpm evalstats <サブコマンド> ...`(`node src/cli.ts`) |
| 依存の追加 | `pnpm add <パッケージ>` |

ルートには，次の`mise`タスクがある(`mise tasks`で一覧できる)．

| タスク | 内容 |
| --- | --- |
| `setup` | 依存の導入とGitのフックの設定 |
| `install` | `pnpm install` |
| `fmt` | oxfmtで整形する |
| `lint` | oxlint，oxfmtの検査，textlint，markdownlint，Mermaidの構文検査，設計とコードの照合 |
| `typecheck` | 全パッケージの型検査 |
| `test` | 全パッケージのテスト |
| `check` | `lint`，`typecheck`，`test`をまとめて実行する(リポジトリ全体の検証) |
| `ollama:pull` | 製品とJudge用のモデル(`qwen2.5:3b`)と意思決定モデル(`tev1`)を取得する |
| `ollama:status` | Ollamaに接続できるかと，取得済みのモデルを表示する |
| `promptfoo:view` | promptfooの結果をブラウザで表示する |

### 受講者に任せるツール操作

| 操作 | 完全な形を初めて示すIteration |
| --- | --- |
| `pnpm install`でパッケージを登録する | 0 |
| 単体テストだけ，統合テストだけを実行する | 0 |
| `pnpm eval`と`promptfoo view` | 0 |
| `mise run ollama:pull` | 0 |
| `pnpm add <依存>` | 1 |
| 1つのテストファイルだけを実行する | 2 |
| ウォッチモード | 3 |
| 別のスイートファイルで評価する(`pnpm eval -c <ファイル>`) | 4 |
| `package.json`にスクリプトを加える | 5 |

### 教材の検査

`mise run check`がリポジトリ全体を検査する．

- 設計文書のすべてのMermaidのブロックを`mermaid.parse`で解析する(`scripts/check-mermaid.mjs`)．
- 解答パッケージの`design/modules.md`の矢印と，`src/`のimportを照合する(`scripts/check-design.mjs`)．演習パッケージは受講者が書き換える途中の状態なので照合しない．
- 解答パッケージのテストはすべて通る．演習パッケージは，前のIterationから引き継いだテストが通る．

## Iteration 0の演習の形

- `src/`：`llm.ts`(ポートの型)と`ollamaLlm.ts`(Ollamaのアダプタ)は完成したものを渡す．`fakeLlm.ts`，`support.ts`，`supportProvider.ts`，`promptfooResult.ts`，`summary.ts`，`report.ts`，`cli.ts`は，シグネチャだけを持ち，呼ぶと`Error("TODO")`を投げるスタブである．
- `promptfooconfig.yaml`：分類の11のタスクを並べた完成したスイートを渡す．偽LLMでは8つ，作成時のOllama(qwen2.5:3b)では9〜10が合格する．`refund-03`はOllamaで常に不合格に，`other-03`は合否が揺れる．
- `test/unit/`と`test/integration/`：`.gitkeep`だけを置く．演習の`vitest.config.ts`は`passWithNoTests`を有効にする．
- `.oxlintrc.json`の`overrides`で，Iteration 0の演習の`src/`だけ未使用の引数を許す(スタブの引数は使われないため)．
- `design/`：3つの文書のファイルに見出しと，何を描くかを説明するコメントだけを置く．

## 偽のLLMと意思決定モデル

- `keywordLlm`は，プロンプトの`<inquiry>`と`</inquiry>`の間の問い合わせ文を取り出し，キーワードで分類する．
- Iteration 1から，シードと`noise`で揺れを加える．promptfooは試行を並行に実行するため，乱数の列をタスクと試行の順序に依存させない(タスクの入力とシードから乱数を作る)．
- Iteration 3から，返信を書く偽LLM，Judgeの偽LLM，偽の意思決定モデルを加える．

## 落とし穴

- `mermaid.parse`はDOMを求めるため，`jsdom`でグローバルの`window`と`document`を用意してから読み込む．
- promptfooの`--repeat`では，同じタスクの試行ごとに`testIdx`が変わる．タスクの識別には`testCase.description`を使う．
- promptfooは既定で利用状況を送信し，更新を確かめる．`PROMPTFOO_DISABLE_TELEMETRY=1`と`PROMPTFOO_DISABLE_UPDATE=1`を設定する．
- promptfooは，不合格のテストがあると終了コード100で終わる．合否の判断は`evalstats`が受け持つため，`eval`スクリプトで`PROMPTFOO_FAILED_TEST_EXIT_CODE=0`を設定する．
- promptfooの実行時に`ExperimentalWarning: DecompressInterceptor`が表示されるが，動作には影響しない．
- promptfooはTypeScriptのプロバイダ(`file://src/supportProvider.ts`)をそのまま読み込める．
- 統合テストでpromptfooを動かすときは，`PROMPTFOO_CONFIG_DIR`を一時ディレクトリにし，手元の評価の履歴と混ぜない．
- NodeのREPLに標準入力から流し込むと，トップレベルの`const x = await ...`が終わる前に次の行が評価される．ノートのREPLの例では，`await import("zod").then(...)`のように1行の式で書く．
- oxfmtはYAMLとJSONCの引用符をそろえる．テンプレート由来の設定ファイル(`.textlintrc.yml`など)は`.oxfmtrc.json`の`ignorePatterns`で外している．
- TypeScript 7には`typescript/lib`がないため，VS Codeでは`typescriptteam.native-preview`拡張を使う．
- Dockerを使えない環境で教材の出力を取るときは，Ollama 0.35.1のLinux版(`ollama-linux-amd64.tar.zst`)を展開し，`ollama serve`を直接起動する．
- `@stdlib/random-base-mt19937`の型定義では，`factory`の戻り値に`normalized`がない．`generator() / (generator.MAX + 1)`で0以上1未満にする．
- promptfooは試行の番号を`callApi`の第2引数の`repeatIndex`で渡す．偽LLMは，シード，問い合わせ文，試行の番号から試行ごとのシードを作る．
- カスタムプロバイダが`private config`を持つと，`ApiProvider`の`config`と型が衝突する．自分の設定は`settings`などの名前にする．
- Ollamaの動作確認は，軽量なモデル(`qwen2.5:0.5b`，`tev1:0.8b`)で行ってよい．教材に載せるOllamaの出力には，使ったモデルを書く．
- `simple-statistics`の`probit`は近似で，97.5%点が1.957になる．正規分布の分位点は`@stdlib/stats-base-dists-normal-quantile`で求める．
- `simple-statistics` 7.12.1は公開から2週間たっていないため，7.12.0を使う．
- promptfooのカスタムアサーション(`type: javascript`)は，`context.config`でアサーションの`config`を，`context.metadata`でプロバイダの応答の`metadata`を受け取る．試行の番号は渡されないため，プロバイダがメタデータの`trial`に記録する．返した`metadata`は，結果JSONの`componentResults[].metadata`に入る．
- 自由記述の評価に使う軽量なモデル(qwen2.5:0.5b)は，問い合わせに答えず方針を書き写すことが多い．教材の振り返りでは，この誤りをトランスクリプトで見せる．
- 意思決定モデルの`/v1/systemone`はOllama 0.35以降が必要である．Tev1は英語以外で十分に試験されておらず，入力は約2,000トークンまでである．
