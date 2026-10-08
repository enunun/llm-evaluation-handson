# Iteration 0 演習：1回だけ評価する

このIterationでは，問い合わせを分類する製品の関数`classifyInquiry`を作り，promptfooで評価し，その結果をCLI`evalstats`で表示する．
作業は，すべてこのパッケージ(`iterations/iteration-0/exercise`)のディレクトリで行う．

## 0-1 準備

リポジトリのルートで依存パッケージを入れる．
`pnpm-workspace.yaml`が`iterations/*/*`をパッケージとして登録しているため，このパッケージも登録される．

```console
pnpm install
```

このパッケージのディレクトリに移り，テストを動かして型を検査する．
テストはまだ1つもないため，Vitestは「テストファイルがない」と表示して成功する．

```console
$ cd iterations/iteration-0/exercise
$ pnpm test
...
No test files found, exiting with code 0
$ pnpm typecheck
$ tsc -p tsconfig.json
```

今のプログラムを動かしてみる．
`src/`の多くのモジュールは，呼ぶと`Error("TODO")`を投げるスタブである．

```console
$ pnpm eval -o results/fake.json
...
Error: TODO: SupportProvider
    at new SupportProvider (.../iterations/iteration-0/exercise/src/supportProvider.ts:7:11)
...
$ pnpm evalstats summary results/fake.json
$ node src/cli.ts summary results/fake.json
...
Error: TODO: main
```

最後に，`promptfooconfig.yaml`を開き，11個のタスク(問い合わせ文と期待するカテゴリ)を読んでおく．

## 0-2 構文と概念

[Iteration 0のノート](../../../../docs/notes/iteration-0.md)を読む．
読み終えたら，このディレクトリで`node`を起動し，次を試す．

1. `" Refund\n"`を，前後の空白を除いた小文字の文字列にする．
2. 配列`["refund", "shipping", "account", "other"]`が`"返金"`を含むかを確かめる．
3. 文字列`"カテゴリを答えよ\n<inquiry>\n本が届かない\n</inquiry>"`から，タグの間の部分を正規表現で取り出す．
4. zodで`{ pass: boolean }`のスキーマを作り，`{ pass: "yes" }`を`safeParse`したときのエラーメッセージを見る．REPLでは`await import("zod").then(({ z }) => ...)`の形で1行に書く．

## 0-3 テストリスト

次の要求と使用例から，確かめるべき振る舞いを`TESTLIST.md`に書き出す．
単体テストと統合テストに分けて書く．

### 要求

- `classifyInquiry(llm, inquiry)`は，問い合わせ文をLLMで`refund`，`shipping`，`account`，`other`のどれかに分類する．
  - LLMの出力は，前後の空白と大文字小文字の違いを吸収してカテゴリに直す．
  - どのカテゴリにも当たらない出力は`"invalid"`にする．
  - プロンプトでは，問い合わせ文を`<inquiry>`と`</inquiry>`で囲む．
- 偽LLMを2つ作る．
  - `scriptedLlm(responses)`は，決めた応答を順に返し，受け取ったリクエストを`requests`に記録する．
  - `keywordLlm()`は，プロンプトの`<inquiry>`タグの間だけを見て，最初に現れたキーワードで分類する．どのキーワードもなければ`other`である．
- promptfooのカスタムプロバイダ`SupportProvider`は，promptfooから受け取った問い合わせ文を`classifyInquiry`で分類し，カテゴリを出力にする．
  - 設定`llm: fake`は`keywordLlm`を，`llm: ollama`は`ollamaLlm`を使う．`id()`は`support-<llm>`を返す．
  - LLMの呼び出しが失敗したら，例外を投げずに`{ error: "llm error: <理由>" }`を返す．
- `evalstats summary <結果JSON>`は，promptfooの結果JSONを読み，タスクと採点器ごとの合否と，合格したタスクの数と割合を表示する．
  - 採点器の名前は，アサーションの`metric`(なければアサーションの種類)である．
  - プロバイダがエラーを返したタスクは，すべての採点器で不合格とする．
  - すべての採点器に合格したタスクを，合格したタスクとして数える．
  - サブコマンドや引数が足りなければ，使い方を表示して終了コード2を返す．結果JSONを読めなければ，理由を表示して終了コード1を返す．

### 使用例

```console
$ pnpm eval -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake)
task         grader             result
refund-01    category (QC01-1)  pass
refund-02    category (QC01-1)  fail
...
mixed-01     category (QC01-1)  fail
passed: 8/11 (0.73)
```

### 作るもの

| モジュール | 公開するもの |
| --- | --- |
| `fakeLlm.ts` | `scriptedLlm(responses: string[]): Llm & { requests: LlmRequest[] }`，`keywordLlm(): Llm` |
| `support.ts` | `categories`，`Category`，`classifyInquiry(llm: Llm, inquiry: string): Promise<Category \| "invalid">` |
| `supportProvider.ts` | `export default class SupportProvider implements ApiProvider` |
| `promptfooResult.ts` | `TaskOutcome`，`EvalResult`，`parseResultFile(text: string): EvalResult` |
| `summary.ts` | `Summary`，`summarize(result: EvalResult): Summary` |
| `report.ts` | `formatSummary(summary: Summary): string` |
| `cli.ts` | `CliIo`，`main(argv: string[], io: CliIo): Promise<number>` |

`llm.ts`(ポート)と`ollamaLlm.ts`(Ollamaのアダプタ)は完成している．

### 考えること

- どの項目が単体テストで，どの項目が統合テストか．統合テストは，promptfooで実際にスイートを評価し，その結果JSONを`main`に渡すとよい．
- `keywordLlm`がプロンプト全体ではなくタグの間だけを見る必要があるのはなぜか．プロンプトの指示文に何が書かれるかを考える．
- promptfooの結果JSONを使うテストでは，JSONをどこまで細かく用意すればよいか．

## 0-4 設計文書

まず[設計文書の書き方](../../../../docs/design.md)を読む．
続いて，`design/`の3つのファイルに最初の版を書く．各ファイルのコメントが，何を描くかを説明している．

- `design/modules.md`：製品側と`evalstats`側のモジュールを分けて描く．promptfoo，Ollama，結果JSONは外部である．非決定的なものがどこにあるかが分かるように描く．
- `design/types.md`：`Llm`，`Category`と，結果JSONから作る型を描く．`EvalResult`と`TaskOutcome`の関係を考える．
- `design/adr/0001-harness-and-quality-model.md`：評価の実行を誰が受け持ち，集計を誰が受け持つかの判断と，採点器に品質特性を割り当てる判断を書く．

書き終えたら，リポジトリのルートで図の構文を検査する．

```console
pnpm lint:mermaid
```

## 0-5 テスト駆動の実装

`TESTLIST.md`の項目を1つずつ，テストを書いて失敗を確かめ(Red)，通る最小のコードを書き(Green)，整える(Refactor)．
単体テストは`test/unit/<モジュール名>.test.ts`に，統合テストは`test/integration/`に置く．

テストの実行は，単体テストだけなら`pnpm test:unit`，統合テストだけなら`pnpm test:integration`である．

### fakeLlm

- `scriptedLlm`は，配列のコピーから`shift`で取り出すと順に返せる．
- `keywordLlm`のキーワードは，たとえば返金なら「返金」「返品」「払い戻」，配送なら「届」「配送」「発送」「配達」，アカウントなら「ログイン」「パスワード」「アカウント」「メールアドレス」である．`indexOf`で最も前に現れた位置を比べる．

### support

- プロンプトには，4つのカテゴリの説明と，「カテゴリ名だけを1語で書く」指示を入れる．
- 文字列がカテゴリかどうかを確かめる関数を，型の述語`value is Category`として書くと，その後の型が絞り込まれる．

### supportProvider

- `ProviderOptions`の`config`は`any`である．zodで`llm`，`model`，`host`の形を検証すると扱いやすい．
- `ollama`パッケージの`new Ollama({ host })`が，`ollamaLlm`の`client`になる．ホストは設定の`host`，なければ環境変数`OLLAMA_HOST`を使う．
- テストでは，存在しないホスト(`http://127.0.0.1:9`)を指定すると，呼び出しの失敗を確かめられる．

### promptfooResult，summary，report

- 単体テストでは，結果JSONを全部用意しなくてよい．zodのスキーマで検証する部分だけを持つオブジェクトを作り，`JSON.stringify`して渡す．
- `--repeat`はまだ使わない．1つのタスクは1回だけ実行されている．
- 表は，列ごとに最も長い値の幅に2文字を足して`padEnd`でそろえる．

### cli

- `main`は`process`を直接使わず，`CliIo`を通して読み書きする．テストでは，出力を文字列にためる偽物を渡す．
- 統合テストでは，`node:child_process`の`execFile`でpromptfooを実行して結果JSONを作る．`PROMPTFOO_CONFIG_DIR`を一時ディレクトリにすると，手元の評価の履歴と混ざらない．

すべてのテストが通ったら，評価して表示を確かめる．

```console
pnpm eval -o results/fake.json
pnpm evalstats summary results/fake.json
pnpm promptfoo view
```

### Ollamaで評価する

リポジトリのルートで，Ollamaにモデルを取得する．初回は数分かかる．

```console
mise run ollama:pull
```

`promptfooconfig.yaml`のプロバイダの設定を`llm: ollama`に変え，評価して表示する．

## 0-6 振り返り

1. 自分の`TESTLIST.md`と，解答の`TESTLIST.md`を見比べる．抜けていた項目，余分だった項目はあるか．
2. 単体テストで偽LLMを使い，統合テストでpromptfooを実際に動かしたのはなぜか．統合テストで偽LLMを使い続けるのはなぜか．
3. プロバイダの設定を`llm: ollama`にして，評価と表示を3回繰り返す．タスクごとの合否は毎回同じか．違うなら，「このプロンプトの合格率は何%か」と聞かれたら何と答えるか．
4. 偽LLMで不合格になったタスクと，Ollamaで不合格になったタスクを比べる．スイートの期待するカテゴリは，誰が見ても同じになるか．
5. 設計文書と実装を見比べ，食い違うところがあれば設計文書を直す．

## 0-7 発展

`evalstats summary`に`--failed`オプションを加え，表には不合格の行だけを出すようにする．
最後の`passed:`の行は，オプションがなくても同じ値を表示する．
これまでと同じく，テストリスト，設計文書，実装の順に進める．
