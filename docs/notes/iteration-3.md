# Iteration 3のノート

Iteration 3で初めて使う概念，ツール，構文をまとめる．

## 自由記述の評価と採点器の分類

分類のように正解が1つに決まるタスクは，文字列の一致で採点できる．
返信の下書きのような自由記述には，正解の文字列がない．
そこで，品質をいくつかの観点に分け，観点ごとに採点器を選ぶ．

Anthropicの"Demystifying evals for AI agents"は，採点器を3つに分ける．このコースは，判定専用のモデルを4つめとして加える．

| 採点器 | 長所 | 短所 |
| --- | --- | --- |
| コード(文字列の一致，正規表現，スキーマの検証など) | 速い，安い，揺れない，誤りを調べやすい | 言い換えに弱い．あいまいな観点を測れない |
| モデル(LLM Judge) | 柔軟．言い換えやあいまいな観点を扱える | 揺れる．費用がかかる．人の判断との照合が必要 |
| 判定専用のモデル(意思決定モデル) | 確率で答え，形式の誤りが起きにくい．速い | 測れる観点が質問の形に限られる．人の判断との照合が必要 |
| 人 | 最も信頼できる基準 | 遅く，費用がかかる |

コードで測れる観点はコードで測り，残りをモデルに任せる．
人の判定は，モデルの採点器が正しいかを確かめる基準として使う(Iteration 4)．

## ルーブリックの書き方

LLM Judgeに渡す採点の基準をルーブリックという．

- 1つのJudgeには1つの観点だけを判定させる．複数の観点を混ぜると，どの観点で落ちたのかが分からない．
- 判定は`pass`と`fail`の二値にする．点数の段階を増やすと，Judgeの判定も人の判定もぶれやすい．
- 判断に必要な情報がないときの逃げ道として`unknown`を許す．逃げ道がないと，Judgeは推測でどちらかに決めてしまう．
- 判定の前に理由を書かせる．理由は，トランスクリプトを読むときの手がかりになる．

## 構造化出力

Judgeの応答はプログラムで読むため，JSONで答えさせる．
Ollamaの`generate`に`format: "json"`を渡すと，モデルはJSONだけを出力しようとする．
それでもモデルが形式を守るとは限らないため，読む側で検証する．

```text
> JSON.parse("はい，丁寧です．")
Uncaught SyntaxError: Unexpected token 'は', "はい，丁寧です．" is not valid JSON
> await import("zod").then(({ z }) => z.enum(["pass", "fail", "unknown"]).safeParse("maybe").success)
false
```

JSONとして読めない応答と，決めた値でない`verdict`は，どちらも`error`とする．

## 採点の結果の4つの値

| 値 | 意味 | 合格率 |
| --- | --- | --- |
| `pass` | 合格 | 分子と分母に入る |
| `fail` | 不合格 | 分母に入る |
| `unknown` | 採点器が判断できないと答えた | 除いて件数を数える |
| `error` | 採点できなかった(応答が読めない，呼び出しの失敗) | 除いて件数を数える |

`error`を不合格に数えると，採点器の不調が製品の品質の低下に見えてしまう．

TypeScriptでは，文字列のリテラル型のユニオン`"pass" | "fail" | "unknown" | "error"`で表す．
外から来た文字列をこの型として扱う前に，型の述語で確かめる．

```ts
const isOutcome = (value: string | undefined): value is GradeOutcome =>
  value === "pass" || value === "fail" || value === "unknown" || value === "error";
```

## 意思決定モデル

意思決定モデルは，文章を生成せず，判定の材料(状態)と型付きの質問を受け取り，答えを確率で返す．
Ollama 0.35以降は，`/v1/systemone`でJev形式の意思決定モデル(Tev1など)を動かせる．
質問の型には，選択肢から選ぶ`choice`，はい/いいえの確率を返す`noul`，順序のある段階を選ぶ`score`がある．

作成時の環境で，軽量なモデル`tev1:0.8b`に2つの返信を判定させた結果を示す．

```console
$ curl -sS http://localhost:11434/v1/systemone -d '{"model": "tev1:0.8b", "state": "問い合わせ：本が届きません\n返信：通常3営業日以内に発送いたします．注文履歴から配送状況をご確認いただけます．", "questions": {"decision": {"type": "noul", "instructions": "Does the reply answer the customer'"'"'s inquiry?"}}}'
{"model":"tev1:0.8b","answers":{"decision":{"type":"noul","noul":0.6473751077266824}},"usage":{"input_tokens":134,"output_tokens":1}}
```

返信を「ただいま新商品のセールを実施中です．」に替えると，`noul`は0.5008506766694425だった．
問い合わせに答えている返信と答えていない返信の確率の差は0.15しかなく，しきい値0.5ではセールの返信も合格になる．
Tev1は英語以外で十分に試験されていない．日本語で使えるか，しきい値をどこに置くかは，Iteration 4で人の判定と照らし合わせて決める．

確率をしきい値で合否に変えると，しきい値を上げるほど合格は厳しくなる．
しきい値は，誤って合格にすることと誤って不合格にすることの，どちらを避けたいかで決める．

## promptfooのカスタムアサーション

`type: javascript`の`value`に`file://`でモジュールを指定すると，その既定のエクスポートの関数が採点器になる．

```yaml
- type: javascript
  value: file://src/judgeAssertion.ts
  metric: judge:polite (QC01-4)
  config:
    rubric: 返信が，お客様に対する丁寧な言葉遣い(敬語)で書かれているか．
```

- 関数は`(output, context)`を受け取り，`{ pass, score, reason, metadata }`を返す．
- `context.config`にアサーションの`config`が，`context.vars`にテストの変数が入る．
- `context.metadata`は，プロバイダが応答に付けた`metadata`である．
- 返した`metadata`は，結果JSONの`gradingResult.componentResults[].metadata`に入る．

## YAMLのアンカー

同じ採点器を複数のタスクに付けるときは，YAMLのアンカー(`&名前`)と参照(`*名前`)を使う．

```yaml
  - description: reply-01
    assert: &reply
      - type: not-icontains
        value: 全額返金します
  - description: reply-02
    assert: *reply
```

## 依存を差し替えられる`fetch`

`ollamaDecisionModel`は，`fetch`を引数で受け取れるようにしている．
テストでは，リクエストを記録して決めた`Response`を返す偽物を渡す．
`Response.json(値)`で，JSONの本文を持つ`Response`を作れる．

## トランスクリプトを読む

合格率が低いとき，それが製品の誤りか採点器の誤りかは，数字だけでは分からない．
`evalstats show <結果JSON> <タスク>`で，試行ごとの出力と，採点器ごとの判定と理由を読む．
Anthropicは，評価の数字を信じる前に，多くの試行のトランスクリプトを読むことを勧めている．
