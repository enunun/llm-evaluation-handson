# Iteration 1 解説：複数回試行する

演習の各手順について，模範解答とその考え方を説明する．
見出しの番号は，演習の`docs/iteration-1.md`と対応する．

## 1-1 準備

Iteration 0の`evalstats`は，試行ごとに1行を出す．
`--repeat 3`で評価すると11タスクで33行になり，合格したタスクの数は試行をまたいで数えられない．
この表示から，同じタスクの行をまとめる必要が分かる．

## 1-2 構文と概念

```text
> 0.8 ** 3
0.5120000000000001
> 1 - (1 - 0.8) ** 3
0.992
> (8 / 10) * (7 / 9) * (6 / 8)
0.4666666666666667
> await import("@stdlib/random-base-mt19937").then(({ default: mt19937 }) => { const g = mt19937.factory({ seed: 1 }); return [g(), g(), g.MAX]; })
[ 1791095845, 4282876139, 4294967295 ]
> await import("node:util").then(({ parseArgs }) => parseArgs({ args: ["summary", "r.json", "--k", "5"], allowPositionals: true, options: { k: { type: "string", default: "3" } } }))
{
  values: [Object: null prototype] { k: '5' },
  positionals: [ 'summary', 'r.json' ]
}
```

合格率0.8のタスクでも，pass^3は0.51にとどまる．
10回中8回の合格から推定したpass^3(0.47)は，`0.8 ** 3`(0.51)より小さい．

## 1-3 テストリスト

模範解答は[TESTLIST.md](../TESTLIST.md)である．考え方を補足する．

- `TaskOutcome`を`Trial`に改めたのは，1つの値が「1回の試行を1つの採点器で採点した結果」を表すようになったからである．Iteration 0でも同じ値だったが，試行が1回だったため「タスクの結果」と読めた．
- Iteration 0の`summarize`の「合格したタスクの数と割合」と，それを表示する`report`のテストは，採点器ごとの集計に置き換わるため消える．タスクの合否は試行ごとに変わるため，「合格したタスク」はもう定まらない．
- `noise`の割合のテストは，固定したシードで1000回分類し，違う答えの割合が0.2に近いことを`toBeCloseTo(0.2, 1)`で確かめた．シードを固定しているため，このテストは毎回同じ結果になる．
- プロバイダの「呼び出しの順序が違っても出力が変わらない」は，promptfooが試行を並行に実行することから導いた項目である．
- 「Ollamaを使うときはシードを記録しない」を入れたのは，Ollamaの評価は偽LLMのシードを使わず，記録すると1行目が誤解を招くからである．

## 1-4 設計文書

- modules.md：`random`と外部の`@stdlib/random-base-mt19937`を加えた．`fakeLlm`は乱数の型だけを，`supportProvider`は`seededRandom`と`trialSeed`を使う．図の下に，試行ごとに偽LLMを組み立てることを書いた．
- types.md：`Trial`，`RunMetadata`，`TaskTrials`，`TaskSummary`，`GraderSummary`，`Status`，`Random`を加えた．`TaskTrials`は`Trial`を集めるだけなので集約(`o--`)，`Summary`は集計を所有するので合成(`*--`)で描いた．
- adr/0002：複数回の試行，報告する指標，温度を0にする案を採らない理由，再現のための記録を書いた．

## 1-5 テスト駆動の実装

### random

**同じシードからは同じ列**の最初のテストは，`mt19937.factory({ seed })`の生成器を包むだけで通る．
**0以上1未満**のテストで，生成器の値を`MAX + 1`で割る形にした．
`@stdlib/random-base-mt19937`の型定義では，`factory`の戻り値に`normalized`がない．そのため，`MAX`で割る形にした．

**`trialSeed`**は，最初のテスト(同じ入力なら同じ値)は`return seed;`で通る(仮実装)．
番号やキーが違えば違う値になるテストで，FNV-1aハッシュを書いた．
シード，キー，番号は`\u0000`で区切ってつなぐ．区切らずにつなぐと，`("1", "23")`と`("12", "3")`のような組み合わせが同じ文字列になるからである．

### keywordLlm

先に引数を`{ random, noise }`に変え，既存のテストを`noise: 0`で書き換えて通した．
続く揺れのテストのため，分類を`classifyByKeyword`に切り出し，`random.next()`が`noise`未満のときだけ，ほかのカテゴリと「わかりません」から1つを選ぶ形にした．
違う答えの候補にカテゴリでない文字列を入れたのは，LLMが形式を守らない揺れ(`invalid`)も再現するためである．

### supportProvider

**メタデータ**のテストで，`callApi`が`metadata`を返すようにした．
**同じシード，問い合わせ，試行の番号なら同じ出力**と**呼び出しの順序**のテストは，1つの乱数の列をプロバイダが持つ実装では通らない．
試行ごとに`trialSeed(seed, prompt, repeatIndex)`から乱数を作り，`keywordLlm`を組み立てる`fakeLlm`メソッドを加えた．
**Ollamaではシードを記録しない**テストで，メタデータを偽LLMとOllamaで分けた．
自分の設定を`private config`にすると`ApiProvider`の`config`と衝突するため，`settings`という名前にした．

### promptfooResult

型と配列の名前を改め，`metadata`を読むようにした．
promptfooは結果の`metadata`に自分の項目(`_promptfooFileMetadata`など)も入れる．zodの`z.object`は知らない項目を取り除くため，記録の項目だけが残る．
形の違う記録(数でない`seed`など)で評価全体を止めないよう，`safeParse`に失敗したら空の記録にした．

### summary

**`groupTrials`**は，`Map`のキーに`[taskId, grader]`のJSON文字列を使い，最初に現れた順を保った．

**`passHatK`**は，最初に`(passes / trials) ** k`と書くと，次のように失敗する．

```text
 FAIL  |unit| test/unit/summary.test.ts > passHatK > 合格数がkより少なければ0である
AssertionError: expected 0.008000000000000002 to be +0 // Object.is equality
 FAIL  |unit| test/unit/summary.test.ts > passHatK > C(合格数, k) / C(試行数, k)で推定する
AssertionError: expected 0.5120000000000001 to be close to 0.4666666666666667, received difference is 0.04533333333333345, but expected 0.005
 FAIL  |unit| test/unit/summary.test.ts > passHatK > kが試行数より大きければエラーにする
AssertionError: expected function to throw an error, but it didn't
```

10回中2回しか合格していないタスクは，3回続けて合格する試行の組を持たないので，推定値は0でなければならない．
掛け算の形`∏ (passes - i) / (trials - i)`にし，`passes - i`が負にならないよう`Math.max(…, 0)`で止めた．

**`summarize`**は，タスクごとの集計`summarizeTask`と，採点器ごとの集計`summarizeGrader`に分けた．
pass@1は試行を全部まとめた割合ではなく，タスクごとの合格率の平均にした．試行数がタスクごとに違っても，各タスクを同じ重みで数えるためである．

### report

1行目は，記録のある項目だけをカンマと空白でつなぐ`formatHeader`に切り出した．
表は2つになり，`formatTable`をそのまま使い回した．

### cli

`parseArgs`は未定義のオプションで例外を投げるため，`try`で包んで使い方を表示する．
`--k`は文字列で返るので，`Number`に変えて1以上の整数かを確かめた．

### 統合テスト

```console
$ pnpm eval --repeat 10 -o results/fake.json
$ pnpm evalstats summary results/fake.json
$ node src/cli.ts summary results/fake.json
suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)
task         grader             pass   rate  status
refund-01    category (QC01-1)  8/10   0.80  flaky
refund-02    category (QC01-1)  0/10   0.00  broken
refund-03    category (QC01-1)  0/10   0.00  broken
shipping-01  category (QC01-1)  10/10  1.00  stable
shipping-02  category (QC01-1)  8/10   0.80  flaky
account-01   category (QC01-1)  10/10  1.00  stable
account-02   category (QC01-1)  9/10   0.90  flaky
other-01     category (QC01-1)  8/10   0.80  flaky
other-02     category (QC01-1)  10/10  1.00  stable
other-03     category (QC01-1)  9/10   0.90  flaky
mixed-01     category (QC01-1)  0/10   0.00  broken

grader             pass@1  pass^3  stable  flaky  broken
category (QC01-1)  0.65    0.53    3       5      3
```

`noise: 0.1`の偽LLMでは，キーワードで正しく分類できるタスクが`stable`か`flaky`に，できないタスクが`broken`になる．

## 1-6 振り返り

1. 解答の`TESTLIST.md`には，既存のテストの書き換えと，置き換えで消えるテストを明示した．テストリストは，新しい振る舞いだけでなく，変わる振る舞いの一覧でもある．
2. 単体テストでは，テストの中で`seededRandom(1)`のように乱数を直接作って注入する．統合テストでは，promptfooの設定の`seed`で固定する．どちらもシードを固定するが，固定する場所が違う．
3. 作成時の環境(Ollama 0.35.1，qwen2.5:0.5b，CPU)で`--repeat 10`の評価を2回行った結果を示す．

   ```text
   suite: support (provider: support-ollama, model: qwen2.5:0.5b, prompt: classify-v1, trials: 10)
   task         grader             pass   rate  status
   refund-01    category (QC01-1)  10/10  1.00  stable
   refund-02    category (QC01-1)  10/10  1.00  stable
   refund-03    category (QC01-1)  5/10   0.50  flaky
   shipping-01  category (QC01-1)  0/10   0.00  broken
   shipping-02  category (QC01-1)  5/10   0.50  flaky
   account-01   category (QC01-1)  10/10  1.00  stable
   account-02   category (QC01-1)  10/10  1.00  stable
   other-01     category (QC01-1)  1/10   0.10  flaky
   other-02     category (QC01-1)  0/10   0.00  broken
   other-03     category (QC01-1)  0/10   0.00  broken
   mixed-01     category (QC01-1)  10/10  1.00  stable

   grader             pass@1  pass^3  stable  flaky  broken
   category (QC01-1)  0.55    0.47    5       3      3
   ```

   2回目は，`refund-03`が7/10，`shipping-01`が1/10，`shipping-02`が6/10，`other-01`が4/10になり，pass@1は0.62，pass^3は0.50だった．
   110回の試行でも，pass@1は0.55から0.62まで動いた．
   合格率は0.55から0.62くらいだとは言えても，どこまで動きうるかはまだ言えない．Iteration 2で，この動きの幅を標準誤差と信頼区間として求める．
4. 偽LLMでは`refund-02`，`refund-03`，`mixed-01`が，qwen2.5:0.5bでは`shipping-01`(2回目は1/10)，`other-02`，`other-03`が`broken`だった．偽LLMの`broken`はキーワードの不足による．qwen2.5:0.5bは「まだ届きません」(shipping-01)を配送と分類できなかった．小さなモデルの誤りであり，プロンプトに例を加えると変わりうる．`broken`のタスクは，揺れではなく，系統的な誤りの手がかりである．
5. 実装しながら，`classifyByKeyword`，`fakeLlm`メソッド，`formatHeader`，`summarizeTask`，`summarizeGrader`を加えた．どれもモジュールの中の関数であり，依存の矢印は変わらない．

## 1-7 発展

`--status`は表示の絞り込みなので，`formatSummary`に`{ status?: Status }`を渡し，タスクの表の行だけを絞る．
`parseArgs`の`options`に`status`を加え，`stable`，`flaky`，`broken`以外の値は使い方の誤りとして終了コード2を返す．
