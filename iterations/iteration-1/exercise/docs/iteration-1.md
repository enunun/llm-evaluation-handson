# Iteration 1 演習：複数回試行する

Iteration 0の振り返りでは，Ollamaのモデルで同じスイートを評価し直すと，一部のタスクの合否が変わった．
このIterationでは，各タスクを何度も試行し，タスクごとの合格率，揺れの状態，pass^kを集計する．
偽LLMにもシード付きの揺れを加え，Ollamaを使わずに揺れを再現できるようにする．
作業は，すべてこのパッケージ(`iterations/iteration-1/exercise`)のディレクトリで行う．

## 1-1 準備

リポジトリのルートで`pnpm install`を実行し，このパッケージを登録する．
このパッケージのコード，テスト，設計文書は，Iteration 0の解答と同じである．テストがすべて通ることを確かめる．

```console
$ cd iterations/iteration-1/exercise
$ pnpm test
...
 Test Files  8 passed (8)
      Tests  35 passed (35)
```

各タスクを3回ずつ評価し，今の`evalstats`で表示する．

```console
$ pnpm eval --repeat 3 -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake)
task         grader             result
refund-01    category (QC01-1)  pass
refund-01    category (QC01-1)  pass
refund-01    category (QC01-1)  pass
refund-02    category (QC01-1)  fail
...
passed: 8/11 (0.73)
```

試行ごとに1行が出る．偽LLMは揺れないため，同じタスクの行はすべて同じ結果である．

## 1-2 構文と概念

[Iteration 1のノート](../../../../docs/notes/iteration-1.md)を読む．
読み終えたら，このディレクトリで`node`を起動し，次を試す．

1. 合格率0.8のタスクについて，pass@3とpass^3を計算する．
2. 10回中8回合格したタスクのpass^3を，`C(8, 3) / C(10, 3)`を掛け算の形にして計算する．
3. 依存を加えたあと(1-5の最初の作業)，`@stdlib/random-base-mt19937`でシード1の生成器を2回作り，同じ列が返ることを確かめる．
4. `node:util`の`parseArgs`で，`["summary", "r.json", "--k", "5"]`を解析する．

## 1-3 テストリスト

次の要求と使用例から，`TESTLIST.md`を書く．
既存のテストのうち，期待値が変わるものを探し，「〜を〜に変える」の項目として書く．

### 要求

- `pnpm eval --repeat <n>`で，各タスクを`n`回試行する(promptfooの機能で，コードの変更は要らない)．
- 擬似乱数のモジュール`random`を作る．
  - `seededRandom(seed)`は，0以上1未満の数を返す`next()`を持つ．同じシードからは同じ列を作る．
  - `trialSeed(seed, key, index)`は，シード，文字列，番号から，`seededRandom`に渡せる1以上2^32未満の整数を作る．同じ入力からは同じ値を作り，番号や文字列が違えば違う値を作る．
- 偽LLM`keywordLlm({ random, noise })`は，確率`noise`でキーワードによる分類とは違う答えを返す．違う答えは，ほかの3つのカテゴリと「わかりません」から選ぶ．
- プロバイダの設定に`seed`(既定1)と`noise`(既定0)を加える．
  - 偽LLMは，試行ごとに`trialSeed(seed, 問い合わせ文, 試行の番号)`で作った乱数を使う．呼び出しの順序が違っても，試行ごとの出力は変わらない．
  - 応答の`metadata`に，LLMの種類(`llm`)，モデル名(`model`，偽LLMでは`keyword`)，プロンプトの版(`promptVersion`)を記録する．偽LLMのときだけ`seed`も記録する．
- `evalstats summary`は，同じタスクと採点器の試行をまとめて集計する．
  - 1行目に，スイート名，プロバイダ，モデル，プロンプトの版，タスクあたりの試行数，シードを表示する．記録のない項目は表示しない．
  - タスクと採点器ごとに，合格数/試行数，合格率，状態(`stable`/`flaky`/`broken`)を表示する．
  - 空行のあとに，採点器ごとのpass@1(タスクごとの合格率の平均)，pass^k(タスクごとの推定値の平均)，状態ごとのタスクの数を表示する．
  - `--k <k>`で`k`を指定する．既定は3である．1以上の整数でなければ，使い方を表示して終了コード2を返す．試行数が`k`より少ないタスクがあれば，pass^kは`-`と表示する．

### 使用例

`promptfooconfig.yaml`のプロバイダの設定に`seed: 1`と`noise: 0.1`を加えて評価する．

```console
$ pnpm eval --repeat 10 -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)
task         grader             pass   rate  status
refund-01    category (QC01-1)  8/10   0.80  flaky
refund-02    category (QC01-1)  0/10   0.00  broken
...
shipping-01  category (QC01-1)  10/10  1.00  stable
...

grader             pass@1  pass^3  stable  flaky  broken
category (QC01-1)  0.65    0.53    3       5      3
```

### 作るもの

| モジュール | 公開するもの |
| --- | --- |
| `random.ts`(新規) | `Random`，`seededRandom(seed: number): Random`，`trialSeed(seed: number, key: string, index: number): number` |
| `fakeLlm.ts` | `keywordLlm(options: { random: Random; noise: number }): Llm`に変える |
| `support.ts` | `classificationPromptVersion`(`"classify-v1"`)を加える |
| `supportProvider.ts` | `callApi(prompt, context)`で`context.repeatIndex`を使う |
| `promptfooResult.ts` | `TaskOutcome`を`Trial`に，`EvalResult.outcomes`を`trials`に改める．`RunMetadata`と`EvalResult.metadata`を加える |
| `summary.ts` | `Status`，`TaskTrials`，`TaskSummary`，`GraderSummary`，`groupTrials(result)`，`passHatK(passes, trials, k)`，`summarize(result, { k })` |
| `report.ts` | `formatSummary(summary)`の表示を変える |
| `cli.ts` | `--k`を受け付ける |

### 考えること

- `TaskOutcome`の名前を`Trial`に改めるのはなぜか．1つの値が何を表すようになったかを考える．
- Iteration 0の`summarize`のテストと`report`のテストは，どれが書き換えになり，どれが消えるか．
- 乱数を使う`keywordLlm`のテストで，「約2割が違う答えになる」ことをどう確かめるか．

## 1-4 設計文書

- `design/modules.md`：`random`を加える．`random`が使う外部のパッケージも描く．偽LLMの揺れが，どこで作られ，どこで試行ごとに決まるかが分かるように書く．
- `design/types.md`：`Trial`，`RunMetadata`，`TaskTrials`，`TaskSummary`，`GraderSummary`，`Status`，`Random`を加え，`Summary`の形を改める．タスクと試行の多重度を描く．
- `design/adr/0002-repeated-trials.md`：1回の採点をやめて複数回試行する判断，報告する指標(pass@1，pass^k，状態)，温度を0にする案を採らない理由，再現のために記録する項目を書く．

書き終えたら，リポジトリのルートで`pnpm lint:mermaid`を実行する．

## 1-5 テスト駆動の実装

最初に，このパッケージに依存を加える．パッケージのディレクトリで，次の形で実行する．

```console
pnpm add @stdlib/random-base-mt19937
```

このリポジトリは，公開から2週間たっていない版を入れない設定である(`pnpm-workspace.yaml`の`minimumReleaseAge`)．

### random

- `mt19937.factory({ seed })`の生成器は，0以上`MAX`以下の整数を返す．`MAX + 1`で割ると0以上1未満になる．
- `trialSeed`はFNV-1aハッシュで書ける．初期値`0x811c9dc5`に，文字ごとに`^=`で文字コードを混ぜ，`Math.imul(hash, 0x01000193) >>> 0`を掛ける．シード，キー，番号は区切り文字を挟んで1つの文字列にする．
- 結果が0になったときは1にする(シードは1以上である)．

### keywordLlm

- 先に`keywordLlm`の引数を変え，既存のテストを`keywordLlm({ random: seededRandom(1), noise: 0 })`に書き換えて，すべて通ることを確かめる．
- `noise`の割合は，固定したシードで1000回分類し，`toBeCloseTo(0.2, 1)`で確かめられる．

### supportProvider

- テストでは，`callApi`の第2引数に`{ prompt: { raw: "", label: "" }, vars: {}, repeatIndex }`のような値を渡す．
- 試行ごとに`keywordLlm`を作り直す．Ollamaのクライアントは試行をまたいで使い回してよい．
- `ApiProvider`は`config`という名前のプロパティを持つため，自分の設定を`private config`にすると型が合わない．別の名前にする．

### promptfooResult，summary，report，cli

- `summary`の集計は，`groupTrials`でまとめてから，タスクごと，採点器ごとに進める．
- `passHatK`は`C(c, k) / C(n, k)`を掛け算の形で計算する．
- `--k`は`parseArgs`で受け取り，数に変えて検査する．

### 統合テスト

統合テストのpromptfooの引数に`--repeat 10`を加え，期待する表示を書き換える．
偽LLMの出力はシードで決まるため，表示は毎回同じになる．

### Ollamaで評価する

プロバイダの設定を`llm: ollama`にして，`--repeat 10`で評価する．
時間がかかるときは，`model`をより小さなモデル(例：`qwen2.5:0.5b`)にする．

## 1-6 振り返り

1. 自分の`TESTLIST.md`と，解答の`TESTLIST.md`を見比べる．
2. 単体テストで乱数を扱うときと，統合テストで乱数を扱うときで，シードの固定のしかたは同じか．
3. Ollamaで`--repeat 10`の評価を2回行い，表示を見比べる．`flaky`のタスクの合格率と，採点器ごとのpass@1は何%動いたか．「このプロンプトの合格率は何%か」と聞かれたら，今度は何と答えるか．
4. 偽LLM(`noise: 0.1`)で`broken`になったタスクと，Ollamaで`broken`になったタスクは同じか．`broken`のタスクは，モデルの誤り，プロンプトの誤り，期待値の誤りのどれだと考えるか．
5. 設計文書と実装を見比べ，食い違うところがあれば設計文書を直す．

## 1-7 発展

`evalstats summary`に`--status <状態>`オプションを加え，タスクの表をその状態の行だけに絞る．
採点器ごとの集計は，絞り込みの影響を受けない．
これまでと同じく，テストリスト，設計文書，実装の順に進める．
