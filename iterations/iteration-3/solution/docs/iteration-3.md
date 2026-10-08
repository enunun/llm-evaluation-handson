# Iteration 3 解説：自由記述を3種類の採点器で評価する

演習の各手順について，模範解答とその考え方を説明する．
見出しの番号は，演習の`docs/iteration-3.md`と対応する．

## 3-1 準備

Iteration 2の解答のテストがすべて通ることを確かめた．
意思決定モデルは，Ollama 0.35以降の`/v1/systemone`で動く．

## 3-2 構文と概念

```text
> JSON.parse("はい，丁寧です．")
Uncaught SyntaxError: Unexpected token 'は', "はい，丁寧です．" is not valid JSON
> await import("zod").then(({ z }) => z.enum(["pass", "fail", "unknown"]).safeParse("maybe").success)
false
```

Judgeの応答は，JSONとして読めない場合と，読めても値が決めたものでない場合の2つの段階で失敗しうる．
`tev1:0.8b`では，問い合わせに答える返信の確率が0.65，宣伝だけの返信が0.50で，差は小さかった．

## 3-3 テストリスト

模範解答は[TESTLIST.md](../TESTLIST.md)である．考え方を補足する．

- アサーションは，設定からLLMを組み立てる既定のエクスポートと，組み立てたもので採点する`gradeWithJudge`，`gradeWithDecisionModel`に分けた．採点のほうは`scriptedLlm`や決めた確率を返すモデルで，`unknown`や`error`を含むすべての場合を確かめられる．既定のエクスポートは，偽のJudgeでの合否，試行ごとの揺れ，接続の失敗だけを確かめた．
- `unknown`と`error`を不合格に数えると，Judgeが判断に迷ったり，形式を守らなかったりしたことが，製品の品質の低下に見える．採点の失敗は製品の失敗と分けて報告する．
- promptfooはアサーションに試行の番号を渡さないが，プロバイダの応答の`metadata`はアサーションの`context.metadata`に届く．プロバイダが`trial`を記録し，アサーションがそれを読む．「試行の番号をメタデータに記録する」はそのための項目である．
- 既存のテストの変更は，`TESTLIST.md`の最後にまとめた．`Trial`の形が変わったため，`promptfooResult`と`summary`のテストの多くを書き換えた．

## 3-4 設計文書

- modules.md：採点器の4つのモジュールを`subgraph`にまとめた．promptfooはプロバイダと2つのアサーションを呼ぶ．`judgeAssertion`は製品と同じ`llm`のポートと偽LLMを使う．`decisionModel`は`fetch`でOllamaを直接呼ぶ．`report`は`show`の表示のため`promptfooResult`の`Trial`を使う．
- types.md：`GradeOutcome`，`JudgeVerdict`，`DecisionModel`を加え，`Trial`を`outcome`，`trial`，`reason`を持つ形にした．`TaskSummary`の合格率と区間は，判定できた試行がなければ`undefined`になる．
- adr/0004：観点ごとに採点器を選ぶ判断，ルーブリックの形，4つの採点の結果，しきい値を書いた．全タスクが合格した採点器で区間が潰れることも，影響に書いた．

## 3-5 テスト駆動の実装

### 製品とプロバイダ

**`draftReply`**は，`classifyInquiry`と同じ形で，プロンプトを組み立ててLLMを呼ぶ．方針は`supportPolicy`として`support.ts`に置いた．
**`templateReplyLlm`**と**`fakeJudgeLlm`**のため，`keywordLlm`の`extractInquiry`を，任意のタグの間を取り出す`extractTag`に一般化した(Refactor)．
**プロバイダ**は，分類と返信の違いを`products`という表にまとめた．`callApi`は`task`で表を引き，呼ぶ関数，プロンプトの版，偽LLMを決める．

### 採点器

**`judge`**の最初の2つのテストは，`JSON.parse`と`responseSchema.parse`で通る．
JSONでない応答のテストは，次のように失敗する．

```text
 FAIL  |unit| test/unit/judge.test.ts > judge > JSONとして読めない応答はerrorにする
SyntaxError: Unexpected token 'は', "はい，丁寧です．" is not valid JSON
```

`JSON.parse`を`try`で包んで`error`を返し，スキーマには`safeParse`を使って，決めた値でない`verdict`も`error`にした．

**`gradeWithJudge`**は，`judge`の結果を`{ pass, score, reason, metadata: { outcome } }`に変える．
Judgeの呼び出しそのものの失敗(応答が尽きた`scriptedLlm`や，接続できないOllama)も`error`にするため，`try`で包んだ．

**`ollamaDecisionModel`**は，`fetch`を引数で受け取る．テストの偽物は，URLと本文を記録して`Response.json(...)`を返す．
**`fakeDecisionModel`**は，「セール」を含むかで基準の確率を決め，`noise`の幅で揺らして0から1に収めた．

**アサーションの既定のエクスポート**は，zodで`config`を検証し，偽物なら`trialSeed(seed, 入力, trial)`から乱数を作る．
Ollamaのときは，Judgeは`ollamaLlm`を，意思決定モデルは`ollamaDecisionModel`を使う．

### evalstats

**`promptfooResult`**では，同じタスクの結果に現れた順の番号を付ける`withTrialNumbers`を加えた．
採点の結果は，メタデータの`outcome`が4つの値のどれかならそれを，そうでなければ合否から決める．型の述語`isOutcome`で，外から来た文字列を`GradeOutcome`に絞り込んだ．
**記録をつなぐ**テストは，返信のタスクを加えて評価したときに，1行目にプロンプトの版が`classify-v1`しか出ないことから加えた項目である．`mergeMetadata`で，結果ごとの記録をまとめた．

**`summary`**は，`pass`と`fail`の数を判定できた試行の数とし，`unknown`と`error`は別に数えた．
判定できた試行がないタスクは`unjudged`にし，採点器の集計からは除いた．

**`report`**の`formatTranscripts`は，試行の番号ごとに出力と採点器の行を並べる．
**`cli`**は，`summary`と`show`の2つのサブコマンドを持つため，`switch`で振り分け，引数の誤りを`UsageError`として1か所で扱う形に整えた(Refactor)．

### スイート

分類のタスクの採点器は，最初のタスクで`&category`として定義し，ほかのタスクは`*category`で参照した．
返信のタスクも同じく`&reply`と`*reply`を使った．

```console
$ pnpm evalstats summary results/fake.json
$ node src/cli.ts summary results/fake.json
suite: support (provider: support-fake, model: keyword, template, prompt: classify-v1, reply-v1, trials: 10, seed: 1)
task         grader                     pass   rate  95% CI        status
...
reply-01     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable
reply-01     judge:polite (QC01-4)      9/9    1.00  [0.66, 1.00]  stable
reply-01     decision:answers (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
reply-02     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable
reply-02     judge:polite (QC01-4)      8/10   0.80  [0.44, 0.97]  flaky
reply-02     decision:answers (QC01-1)  9/10   0.90  [0.55, 1.00]  flaky
reply-03     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable
reply-03     judge:polite (QC01-4)      10/10  1.00  [0.69, 1.00]  stable
reply-03     decision:answers (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
reply-04     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable
reply-04     judge:polite (QC01-4)      7/9    0.78  [0.40, 0.97]  flaky
reply-04     decision:answers (QC01-1)  9/10   0.90  [0.55, 1.00]  flaky

grader                     pass@1  SE    95% CI        pass^3  stable  flaky  broken  unknown  error
category (QC01-1)          0.65    0.13  [0.40, 0.91]  0.53    3       5      3       0        0
no-promise (QC02-2)        1.00    0.00  [1.00, 1.00]  1.00    4       0      0       0        0
judge:polite (QC01-4)      0.89    0.06  [0.77, 1.00]  0.72    2       2      0       2        0
decision:answers (QC01-1)  0.95    0.03  [0.89, 1.00]  0.85    2       2      0       0        0
```

`reply-01`と`reply-04`の`judge:polite`は，1回ずつ`unknown`があるため，判定できた試行が9回になっている．

## 3-6 振り返り

1. 解答の`TESTLIST.md`には，「記録をつなぐ」のように，評価を実際に動かして見つけた振る舞いの項目もある．表示を読むことも，テストリストを育てる手がかりになる．
2. `no-promise`の区間`[1.00, 1.00]`は，4つのタスクの合格率がすべて1.0となり，標準誤差が0になったためである．「合格率が確実に1.0である」ことは意味しない．タスクごとの区間`[0.69, 1.00]`が示すように，各タスクの合格率は0.69程度でもありうる．タスクが少なく，結果がそろっているときは，採点器の区間よりタスクごとの区間を読む．
3. 作成時の環境(Ollama 0.35.1，製品とJudgeはqwen2.5:0.5b，意思決定モデルはtev1:0.8b，CPU)での返信のタスクの結果を示す．

   ```text
   reply-01     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable
   reply-01     judge:polite (QC01-4)      7/10   0.70  [0.35, 0.93]  flaky
   reply-01     decision:answers (QC01-1)  1/10   0.10  [0.00, 0.45]  flaky
   ...
   judge:polite (QC01-4)      0.88    0.06  [0.75, 1.00]  0.67    1       3      0       0        0
   decision:answers (QC01-1)  0.40    0.19  [0.02, 0.78]  0.20    0       4      0       0        0
   ```

   `reply-01`のトランスクリプトを`show`で読むと，qwen2.5:0.5bは問い合わせに答えず，方針をそのまま書き写していた．

   <!-- textlint-disable -->

   ```text
   trial 1
     output: 返金  商品の到着から30日以内に未使用の場合は受け付けます。返金の可否は担当部署に確認して連絡します。  配送  通常、注文から3営業日以内に発送されます。…
     no-promise (QC02-2): pass (Assertion passed)
     judge:polite (QC01-4): pass (返信が，お客様に対する丁寧な言葉遣い(敬語)で書かれているか)
     decision:answers (QC01-1): fail (probability 0.26 < threshold 0.50)
   ```

   <!-- textlint-enable -->

   意思決定モデルの不合格は，製品の誤り(答えていない)を正しく捉えている．
   一方，Judgeの合格の理由はルーブリックをそのまま書き写したもので，判定の根拠になっていない．Judgeの合格率0.88をそのまま信じてよいかは疑わしい．Iteration 4で，人の判定と照らし合わせて確かめる．
4. qwen2.5:0.5bのJudgeでは，この評価で`unknown`と`error`は出なかった．偽のJudgeでは`unknown`が出た．`unknown`が多いときは，ルーブリックの観点があいまいでないか，判断の材料(問い合わせ文など)が足りていないかを疑う．
5. 実装しながら`extractTag`，`products`，`withTrialNumbers`，`mergeMetadata`，`UsageError`を加えた．どれもモジュールの中の要素であり，依存の矢印は`modules.md`のとおりである．

## 3-7 発展

文字数の上限は文字列の長さで判定できるため，コードの採点器でよい．
`javascript`アサーションで`output.length <= config.max`を返し，`metric`は`length (QC01-4)`(指示に従っているか)とするのが一例である．
自作のアサーションにするなら，`outcome`を持つ`metadata`を返さなくても，`evalstats`は合否から`pass`か`fail`を決める．
