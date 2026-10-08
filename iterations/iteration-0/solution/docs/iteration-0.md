# Iteration 0 解説：1回だけ評価する

演習の各手順について，模範解答とその考え方を説明する．
見出しの番号は，演習の`docs/iteration-0.md`と対応する．

## 0-1 準備

`pnpm install`をリポジトリのルートで実行すると，`pnpm-workspace.yaml`の`iterations/*/*`に当たるすべてのパッケージが登録される．
演習のパッケージでは，スタブのモジュールが`Error("TODO")`を投げるため，promptfooはプロバイダを作る段階で止まり，`evalstats`は`main`で止まる．
promptfooがプロバイダを`new`で作ってからテストを実行することが，このエラーの位置から分かる．

## 0-2 構文と概念

```text
> " Refund\n".trim().toLowerCase()
'refund'
> ["refund", "shipping", "account", "other"].includes("返金")
false
> "カテゴリを答えよ\n<inquiry>\n本が届かない\n</inquiry>".match(/<inquiry>([\s\S]*?)<\/inquiry>/)?.[1]
'\n本が届かない\n'
> await import("zod").then(({ z }) => z.object({ pass: z.boolean() }).safeParse({ pass: "yes" }).error.issues[0].message)
'Invalid input: expected boolean, received string'
```

1つ目と2つ目は`classifyInquiry`の正規化に，3つ目は`keywordLlm`に，4つ目は結果JSONの検証にそのまま使う．

## 0-3 テストリスト

模範解答は[TESTLIST.md](../TESTLIST.md)である．考え方を補足する．

- 単体テストと統合テストの分け方：偽LLM，製品，プロバイダ，結果JSONの読み取り，集計，表示は，それぞれ単独で確かめられるので単体テストにした．promptfooが実際にプロバイダを読み込み，その結果JSONを`evalstats`が読めることは，組み合わせて初めて確かめられるので統合テストにした．引数の誤りは`main`の振る舞いなので，統合テストに置いた．
- `keywordLlm`がタグの間だけを見る理由：プロンプトの指示文には「refund：返金，返品，請求の誤り」のようにキーワードそのものが書かれる．プロンプト全体を見ると，どの問い合わせも`refund`になる．
- 結果JSONの用意のしかた：単体テストでは，zodで検証する部分だけを持つオブジェクトを作る．本物の結果JSONは統合テストで確かめるため，単体テストを本物の細部に合わせる必要はない．
- エラーの扱い：プロバイダのエラーを`evalstats`がどう数えるかは，評価の数字を左右する．「採点できなかったものを合格に数えない」ことをテストリストに明示した．

## 0-4 設計文書

設計文書は[design/](../design)にある．最初の版なので，すべてが新しい．

- modules.md：製品側と`evalstats`側を`subgraph`で分けた．`evalstats`は製品のモジュールをimportせず，結果JSONだけを通してつながる．非決定的なのは外部の「Ollamaのモデル」だけであり，`support`は`llm`のインタフェースにしか依存しないことが図から読める．
- types.md：製品側は`Llm`，`LlmRequest`，`Category`，`evalstats`側は`EvalResult`，`TaskOutcome`，`Summary`である．`TaskOutcome`を「1つのタスクを1つの採点器で採点した結果」としたのは，Iteration 3で1つのタスクに複数の採点器を付けるときにも同じ形で表せるからである．
- adr/0001：実行と採点をpromptfooに任せて集計を自作する判断と，採点器の`metric`に品質特性を書く判断を記録した．分類の採点を二値にした理由も書いた．

## 0-5 テスト駆動の実装

テストリストの順に，テストとその時点のコードを示す．

### fakeLlm

**`scriptedLlm`は，決めた応答を順に返す**．最初のテストは，配列を取り出して返すだけで通る．

```ts
export function scriptedLlm(responses: string[]): Llm & { requests: LlmRequest[] } {
  const remaining = [...responses];
  return {
    requests: [],
    async complete() {
      return remaining.shift() ?? "";
    },
  };
}
```

**受け取ったリクエストを記録する**．`requests`の配列を閉包に持ち，`complete`の中で`push`する．

**応答が尽きたらエラーにする**．`?? ""`をやめ，`undefined`なら`Error("scriptedLlm: no more responses")`を投げる．応答の数を間違えたテストを，空文字列のまま静かに進ませないためである．

**`keywordLlm`の分類**．返金の1件目のテストは`return "refund"`で通る(仮実装)．配送のテストを加えると，キーワードの表を持つ形に進む．

```ts
const keywords: { category: string; words: string[] }[] = [
  { category: "refund", words: ["返金", "返品", "払い戻"] },
  { category: "shipping", words: ["届", "配送", "発送", "配達"] },
  { category: "account", words: ["ログイン", "パスワード", "アカウント", "メールアドレス"] },
];
```

アカウントとその他のテストは，表と`other`の既定値で通る．
「最初に現れたキーワード」のテストは，「届いた商品が壊れていたので返金してほしい」を`shipping`とするもので，表の順に探す実装では`refund`になり失敗する．
`indexOf`で位置を比べ，最も前のものを選ぶように直した．
最後に，タグの間を取り出す`extractInquiry`を加え，タグがなければ例外にした．

### support

**LLMが答えたカテゴリを返す**．最初はLLMの出力をそのまま返して通した．

```ts
export async function classifyInquiry(llm: Llm, inquiry: string): Promise<Category | "invalid"> {
  return (await llm.complete({ prompt: inquiry })) as Category;
}
```

続く3つのテストは，この仮実装では次のように失敗する．

```text
 FAIL  |unit| test/unit/support.test.ts > classifyInquiry > 前後の空白を取り除く
AssertionError: expected ' shipping\n' to be 'shipping' // Object.is equality
...
 FAIL  |unit| test/unit/support.test.ts > classifyInquiry > 大文字と小文字を区別しない
AssertionError: expected 'Account' to be 'account' // Object.is equality
...
 FAIL  |unit| test/unit/support.test.ts > classifyInquiry > 4つのカテゴリのどれでもない出力はinvalidにする
AssertionError: expected '返金' to be 'invalid' // Object.is equality
```

`trim().toLowerCase()`で正規化し，型の述語`isCategory`で当たらないものを`"invalid"`にした．
型の述語を使うと，`as`による型の上書きがなくなる．

**プロンプトに問い合わせ文をタグで囲んで含める**．`classificationPrompt`に指示文を書き，`<inquiry>`タグで問い合わせを囲んだ．
`scriptedLlm`の`requests`で，LLMに渡ったプロンプトを確かめられる．

### ollamaLlm

`client`を差し替えられるため，Ollamaを動かさずにテストできる．
テストの偽物の`generate`が受け取った引数を記録し，`{ model, prompt, stream: false }`を渡していることを確かめた．

### supportProvider

**`llm: fake`で分類したカテゴリを出力にする**．`callApi`が`{ output: await classifyInquiry(this.llm, prompt) }`を返す．
**IDは`support-<llm>`**，**未知の`llm`はエラー**の2つは，コンストラクタで設定を読み，`switch`でLLMを組み立てる形にして通した．
`config`は`any`なので，zodで`llm`，`model`，`host`の形と既定値を決めた．
**呼び出しの失敗を`error`で返す**．存在しないホストを指定すると`fetch failed`になる．`try`と`catch`で包み，`{ error: "llm error: fetch failed" }`の形で返す．
例外を投げるとpromptfooの評価全体が止まるが，`error`を返すとそのタスクだけがエラーとして記録される．

### promptfooResult

**スイート名とプロバイダ名を取り出す**から始め，zodのスキーマを1項目ずつ広げた．

- タスクと採点器ごとの合否：`testCase.assert`を基準に，同じ採点器名の`componentResults`を探す．`componentResults`を基準にしないのは，次の項目のためである．
- `metric`のない採点器：名前を`assertion.metric ?? assertion.type`で決める関数`graderName`を作り，両方の側で使った．
- プロバイダのエラー：`gradingResult`が`null`になるため，`componentResults`は空になる．`testCase.assert`を基準にしていれば，見つからない採点器を`pass: false`にするだけで済む．
- ラベル：`provider.label || provider.id`とした．promptfooは，ラベルがないとき空文字列を書くため，`??`ではなく`||`を使う．
- 形が違えばエラー：`safeParse`の失敗を`not a promptfoo result file`のメッセージで投げ直す．

### summary

タスクごとの合否を`Map`にため，すべての採点器が合格したかを`&&`で畳み込んだ．
タスクが0件のときに0で割らないよう，合格率を0にした．

### report

1行目，表，最後の行の3つのテストを順に通した．
表は，列ごとに最も長い値の幅を求め，2文字を足して`padEnd`でそろえる関数`formatTable`に切り出した(Refactor)．
最後の列は詰めないため，行末に余分な空白が残らない．

### 統合テスト

`beforeAll`でpromptfooを実際に動かし，一時ディレクトリに結果JSONを書かせる．
`PROMPTFOO_CONFIG_DIR`を一時ディレクトリにして，手元の評価の履歴と混ざらないようにした．
`PROMPTFOO_FAILED_TEST_EXIT_CODE=0`は，不合格のタスクがあってもpromptfooが終了コード0で終わるようにする．合否の判断は`evalstats`が受け持つからである．

```console
$ pnpm evalstats summary results/fake.json
$ node src/cli.ts summary results/fake.json
suite: support (provider: support-fake)
task         grader             result
refund-01    category (QC01-1)  pass
refund-02    category (QC01-1)  fail
refund-03    category (QC01-1)  fail
shipping-01  category (QC01-1)  pass
shipping-02  category (QC01-1)  pass
account-01   category (QC01-1)  pass
account-02   category (QC01-1)  pass
other-01     category (QC01-1)  pass
other-02     category (QC01-1)  pass
other-03     category (QC01-1)  pass
mixed-01     category (QC01-1)  fail
passed: 8/11 (0.73)
```

`keywordLlm`は「戻してください」(refund-02)を知らず，「届いた服」(refund-03)と「届いたのですが」(mixed-01)の「届」を先に見つける．

## 0-6 振り返り

1. 解答の`TESTLIST.md`には，プロバイダのエラーの扱いと，ラベルの扱いが入っている．どちらも評価の数字や表示を変えるため，テストで固定した．
2. 単体テストで偽LLMを使うのは，製品のコードがLLMの出力をどう扱うかを，LLMの揺れと切り離して確かめるためである．統合テストでも偽LLMを使うのは，確かめたいのが「promptfooとevalstatsの組み合わせ」であり，LLMの品質ではないからである．LLMの品質は，テストではなく評価で測る．
3. 作成時の環境(Ollama 0.35.1，qwen2.5:3b，CPU)で3回評価した結果は，1回目と2回目が`passed: 10/11 (0.91)`，3回目が`passed: 9/11 (0.82)`だった．3回目だけ，`other-03`(ポイントが付与されていません)が不合格になった．同じプロンプトでも合格率は0.91にも0.82にもなるため，1回の評価では「何%」と答えられない．Iteration 1で，同じタスクを何度も試行して合格率を推定する．
4. 偽LLMでは`refund-02`，`refund-03`，`mixed-01`が不合格だった．Ollamaでは`refund-03`(服の色が違うので交換してほしい)が3回とも`shipping`になった．交換を返品と見るか配送の問題と見るかは，人によっても分かれうる．期待するカテゴリの定義をスイートと一緒に見直すことも，評価の仕事である．
5. 実装しながら`formatTable`と`graderName`を加えた．どちらもモジュールの中の関数であり，依存の矢印は変わらない．`design/types.md`の下の説明に，`grader`の決め方を書いた．

## 0-7 発展

`--failed`は表示だけを変えるので，`report`の`formatSummary`に`{ failedOnly: boolean }`を渡し，表の行を絞る．
`passed:`の行は`Summary`から作るため，絞り込みの影響を受けない．
テストリストには，`report`の単体テスト(不合格の行だけを出す，`passed:`は変わらない)と，`main`の統合テスト(`--failed`を受け付ける)を加える．
