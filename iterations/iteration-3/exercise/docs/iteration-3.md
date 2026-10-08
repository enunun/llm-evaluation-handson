# Iteration 3 演習：自由記述を3種類の採点器で評価する

製品に，問い合わせへの返信の下書きを書く機能`draftReply`を加える．
返信は自由記述であり，文字列の一致では採点できない．
このIterationでは，方針にない約束をコードの採点器で，丁寧さをLLM Judgeで，問い合わせに答えているかを意思決定モデルで採点する．
採点器が判断できなかった場合と採点できなかった場合を，不合格と区別して数える．
作業は，すべてこのパッケージ(`iterations/iteration-3/exercise`)のディレクトリで行う．

## 3-1 準備

リポジトリのルートで`pnpm install`を実行する．
このパッケージのコード，テスト，設計文書は，Iteration 2の解答と同じである．テストがすべて通ることを確かめる．

```console
$ cd iterations/iteration-3/exercise
$ pnpm test
...
      Tests  93 passed (93)
```

Ollamaで意思決定モデルを使うため，リポジトリのルートでモデルを取得し直す．
`mise run ollama:pull`は，製品とJudge用のモデルと，意思決定モデル`tev1`を取得する．

## 3-2 構文と概念

[Iteration 3のノート](../../../../docs/notes/iteration-3.md)を読む．
読み終えたら，次を試す．

1. `node`で，`JSON.parse("はい，丁寧です．")`が投げる例外を見る．
2. `node`で，zodの`z.enum(["pass", "fail", "unknown"])`に`"maybe"`を`safeParse`させる．
3. Ollamaを使える場合は，ノートの`curl`の例で`/v1/systemone`を呼び，返信を替えて確率がどう変わるかを見る．

## 3-3 テストリスト

次の要求と使用例から，`TESTLIST.md`を書く．期待値が変わる既存のテストも探す．

### 要求

#### 製品とプロバイダ

- `draftReply(llm, inquiry, policy)`は，方針を`<policy>`タグ，問い合わせ文を`<inquiry>`タグで囲んだプロンプトをLLMに渡して返信を書かせ，前後の空白を除いて返す．方針は`support.ts`の`supportPolicy`，プロンプトの版は`replyPromptVersion`(`"reply-v1"`)とする．
- `LlmRequest`に`format?: "json"`を加える．`ollamaLlm`は，`format`があればOllamaに渡す．
- プロバイダは，テストの変数`task`が`"reply"`なら`draftReply`を，それ以外(既定`"classify"`)なら`classifyInquiry`を呼ぶ．未知の`task`は`{ error: "unknown task: <task>" }`を返す．
  - 偽LLMは，分類では`keywordLlm`を，返信では`templateReplyLlm`を使う．メタデータのモデル名は`keyword`と`template`である．
  - メタデータに試行の番号`trial`を加える．
- 偽LLMを2つ加える．
  - `templateReplyLlm({ random, noise })`は，問い合わせのカテゴリに合わせた丁寧な返信の型を返す．確率`noise`で，方針にない約束(「全額返金します」)，ぞんざいな言葉遣い，問い合わせに答えない宣伝のどれかを入れる．
  - `fakeJudgeLlm({ random, noise })`は，プロンプトの`<reply>`タグの間に丁寧語(「いたします」など)があれば`pass`，なければ`fail`のJSONを返す．確率`noise`で，逆の判定，`unknown`，JSONでない文のどれかを返す．

#### 採点器

- `judge(llm, rubric, output)`は，ルーブリックと`<reply>`タグで囲んだ出力をJudgeに渡し，JSONの形式を求める．応答の`verdict`(`pass`，`fail`，`unknown`)と`reason`を返す．JSONとして読めない応答や，決めた値でない`verdict`は`error`にする．
- `judgeAssertion`は，promptfooのカスタムアサーションである．`config`の`rubric`と`judge`(`llm`，`model`，`host`，`seed`，`noise`)を読み，Judgeの判定を`{ pass, score, reason, metadata: { outcome } }`にする．`unknown`と`error`は不合格とし，Judgeの呼び出しの失敗も`error`にする．
- 意思決定モデルのポート`DecisionModel`は`noul(state, instructions)`で「はい」の確率を返す．
  - `ollamaDecisionModel({ host, model, fetch })`は，`/v1/systemone`に状態と`noul`型の質問を送り，確率を返す．応答が失敗なら，状態コードを含むエラーにする．
  - `fakeDecisionModel({ random, noise })`は，宣伝(「セール」)だけの返信に低い確率，それ以外に高い確率を返し，`noise`の幅で揺らす．確率は0以上1以下に収める．
- `decisionAssertion`は，問い合わせ文と出力を状態にして意思決定モデルに渡し，確率がしきい値(`config.threshold`，既定0.5)以上なら合格にする．確率をスコアとメタデータに残す．
- 偽のJudgeと偽の意思決定モデルは，シード，入力，試行の番号(プロバイダが記録したメタデータの`trial`)から決まる乱数で揺らす．

#### evalstats

- `Trial`の`pass`を`outcome`(`pass`，`fail`，`unknown`，`error`)に改め，試行の番号`trial`と採点の理由`reason`を加える．
  - アサーションのメタデータに`outcome`があればそれを使い，なければ合否から決める．
  - プロバイダがエラーを返した試行は，すべての採点器を`error`にする．
- `unknown`と`error`は合格率の計算から除き，タスクごと，採点器ごとに件数を数える．判定できた試行がないタスクは，合格率と区間を求めず，状態を`unjudged`にする．
- 再現のための記録は，結果ごとに違う値を，現れた順に重複を除いてカンマでつなぐ．
- 採点器の表の最後に，`unknown`と`error`の件数の列を加える．
- `evalstats show <結果JSON> <タスク>`は，そのタスクの試行ごとに，出力と，採点器ごとの結果と理由を表示する．出力の改行は空白にする．未知のタスクなら，理由を表示して終了コード1を返す．
- 使い方の表示に`show`を加える．

#### スイート

- 分類のタスクの採点器`category (QC01-1)`を，`defaultTest`から各タスクの`assert`に移す(YAMLのアンカーを使う)．
- 返信のタスクを4つ加え，`no-promise (QC02-2)`，`judge:polite (QC01-4)`，`decision:answers (QC01-1)`の3つの採点器を付ける．

### 使用例

```console
$ pnpm eval --repeat 10 -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake, model: keyword, template, prompt: classify-v1, reply-v1, trials: 10, seed: 1)
task         grader                     pass   rate  95% CI        status
refund-01    category (QC01-1)          8/10   0.80  [0.44, 0.97]  flaky
...
reply-01     no-promise (QC02-2)        10/10  1.00  [0.69, 1.00]  stable
reply-01     judge:polite (QC01-4)      9/9    1.00  [0.66, 1.00]  stable
reply-01     decision:answers (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
...

grader                     pass@1  SE    95% CI        pass^3  stable  flaky  broken  unknown  error
category (QC01-1)          0.65    0.13  [0.40, 0.91]  0.53    3       5      3       0        0
no-promise (QC02-2)        1.00    0.00  [1.00, 1.00]  1.00    4       0      0       0        0
judge:polite (QC01-4)      0.89    0.06  [0.77, 1.00]  0.72    2       2      0       2        0
decision:answers (QC01-1)  0.95    0.03  [0.89, 1.00]  0.85    2       2      0       0        0

$ pnpm evalstats show results/fake.json reply-02
task: reply-02
trial 1
  output: お問い合わせいただきありがとうございます．返金のご希望を承りました．…
  no-promise (QC02-2): pass (Assertion passed)
  judge:polite (QC01-4): pass (丁寧語がある)
  decision:answers (QC01-1): pass (probability 0.99 >= threshold 0.50)
trial 2
  output: ただいま新商品のセールを実施中です．ぜひご覧ください．
...
```

### 作るもの

| モジュール | 公開するもの |
| --- | --- |
| `support.ts` | `replyPromptVersion`，`supportPolicy`，`draftReply` |
| `llm.ts`，`ollamaLlm.ts` | `LlmRequest.format` |
| `fakeLlm.ts` | `templateReplyLlm`，`fakeJudgeLlm` |
| `supportProvider.ts` | 変数`task`による呼び分け |
| `judge.ts`(新規) | `JudgeVerdict`，`judge(llm, rubric, output)` |
| `judgeAssertion.ts`(新規) | 既定のエクスポート(アサーション)，`gradeWithJudge(llm, rubric, output)` |
| `decisionModel.ts`(新規) | `DecisionModel`，`Fetch`，`ollamaDecisionModel`，`fakeDecisionModel` |
| `decisionAssertion.ts`(新規) | 既定のエクスポート(アサーション)，`gradeWithDecisionModel(model, instructions, state, threshold)` |
| `promptfooResult.ts` | `GradeOutcome`，`Trial`の`trial`，`outcome`，`reason` |
| `summary.ts` | `Status`の`unjudged`，`TaskSummary`と`GraderSummary`の`unknown`と`errors` |
| `report.ts` | `formatTranscripts(trials, taskId)` |
| `cli.ts` | `show`サブコマンド |

### 考えること

- アサーションの既定のエクスポートは，設定からLLMを組み立てる．テストしやすくするには，組み立てと採点をどう分けるとよいか．
- `unknown`と`error`を不合格に数えると，何が起きるか．
- promptfooは，アサーションに試行の番号を渡さない．偽のJudgeを試行ごとに揺らすには，番号をどこから受け取るか．

## 3-4 設計文書

- `design/modules.md`：採点器のモジュールを新しい`subgraph`にまとめる．promptfooからの矢印が増える．意思決定モデルがOllamaをどう呼ぶかも描く．
- `design/types.md`：`GradeOutcome`，`JudgeVerdict`，`DecisionModel`を加え，`Trial`と集計の型を改める．
- `design/adr/0004-model-based-graders.md`：観点ごとに採点器を選ぶ判断，ルーブリックの形，4つの採点の結果と合格率での扱い，しきい値を書く．

## 3-5 テスト駆動の実装

製品とプロバイダ，採点器，`evalstats`の順に進めるとよい．

### 製品とプロバイダ

- `templateReplyLlm`と`fakeJudgeLlm`は，プロンプトからタグの間を取り出す関数を`keywordLlm`と共有できる．
- プロバイダは，分類と返信で違う項目(呼ぶ関数，プロンプトの版，偽LLMとそのモデル名)を表にして持つと，`callApi`の分岐が減る．
- `context.vars.task`は文字列とは限らない型である．`typeof`で確かめてから使う．

### 採点器

- アサーションは，設定から組み立てる部分と，組み立てたLLMやモデルで採点する部分(`gradeWithJudge`，`gradeWithDecisionModel`)に分け，後者を`scriptedLlm`などでテストする．
- アサーションのテストでは，`context`に`{ config, vars, metadata: { trial } }`などを持つオブジェクトを渡す．
- `ollamaDecisionModel`のテストでは，`fetch`の偽物が受け取ったURLと本文を記録する．

### evalstats

- `promptfooResult`のスキーマに，`componentResults[].reason`と`metadata.outcome`，結果の`error`を加える．
- `summary`の合格率は，判定できた試行だけで求める．

### スイート

`promptfooconfig.yaml`を書き換え，評価して表示を確かめる．

### Ollamaで評価する

プロバイダの`llm`，Judgeの`judge.llm`，意思決定モデルの`model.llm`を`ollama`にして評価する．
時間がかかるときは，製品とJudgeのモデルを`qwen2.5:0.5b`に，意思決定モデルを`tev1:0.8b`にする．

## 3-6 振り返り

1. 自分の`TESTLIST.md`と，解答の`TESTLIST.md`を見比べる．
2. 偽LLMの評価で，`no-promise`の区間が`[1.00, 1.00]`になった．この区間は何を意味し，何を意味しないか．タスクごとの区間と見比べる．
3. Ollamaで評価し，`judge:polite`と`decision:answers`の合格率を比べる．合格率が低いタスクを`show`で読み，製品の誤りか採点器の誤りかを考える．
4. `unknown`や`error`が出たら，`show`で理由を読む．Judgeのプロンプトの何を変えると減りそうか．
5. 設計文書と実装を見比べ，食い違うところがあれば設計文書を直す．

## 3-7 発展

返信の長さ(文字数)が上限を超えないかを測るコードの採点器を，`javascript`アサーションで加える．
品質特性を決め，`metric`に書く．上限は`config`で渡す．
これまでと同じく，テストリスト，設計文書，実装の順に進める．
