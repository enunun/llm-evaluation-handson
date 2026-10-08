# テストリスト

## 単体テスト

### random

- [x] `seededRandom`は，同じシードからは同じ乱数の列を作る
- [x] `seededRandom`は，違うシードからは違う乱数の列を作る
- [x] `seededRandom`は，0以上1未満の数を返す
- [x] `trialSeed`は，同じシード，キー，番号からは同じシードを作る
- [x] `trialSeed`は，試行の番号が違えば違うシードを作る
- [x] `trialSeed`は，キーが違えば違うシードを作る
- [x] `trialSeed`は，`seededRandom`に渡せる，1以上2^32未満の整数を返す

### fakeLlm

- [x] `scriptedLlm`は，決めた応答を順に返す
- [x] `scriptedLlm`は，受け取ったリクエストを記録する
- [x] `scriptedLlm`は，応答が尽きたらエラーにする
- [x] `keywordLlm`は，返金のキーワードを含む問い合わせを`refund`に分類する
- [x] `keywordLlm`は，配送のキーワードを含む問い合わせを`shipping`に分類する
- [x] `keywordLlm`は，アカウントのキーワードを含む問い合わせを`account`に分類する
- [x] `keywordLlm`は，どのキーワードも含まない問い合わせを`other`に分類する
- [x] `keywordLlm`は，複数のキーワードがあれば，最初に現れたものの分類にする
- [x] `keywordLlm`は，`inquiry`タグがなければエラーにする
- [x] `keywordLlm`は，`noise`が1なら，キーワードによる分類とは違う答えを返す
- [x] `keywordLlm`は，`noise`が1なら，カテゴリでない答えを返すこともある
- [x] `keywordLlm`は，`noise`の割合だけ，キーワードによる分類と違う答えを返す
- [x] `keywordLlm`は，同じシードなら同じ答えの列を返す
- [x] `templateReplyLlm`は，問い合わせのカテゴリに合わせた，丁寧な返信の型を返す
- [x] `templateReplyLlm`は，`noise`が1なら，方針にない約束，ぞんざいな言葉遣い，問い合わせに答えない内容のどれかを含む
- [x] `fakeJudgeLlm`は，丁寧語を含む返信を`pass`と判定するJSONを返す
- [x] `fakeJudgeLlm`は，丁寧語を含まない返信を`fail`と判定するJSONを返す
- [x] `fakeJudgeLlm`は，`noise`が1なら，逆の判定，`unknown`，JSONでない文のどれかを返す

### support

- [x] `classifyInquiry`は，LLMが答えたカテゴリを返す
- [x] `classifyInquiry`は，前後の空白を取り除く
- [x] `classifyInquiry`は，大文字と小文字を区別しない
- [x] `classifyInquiry`は，4つのカテゴリのどれでもない出力は`invalid`にする
- [x] `classifyInquiry`は，プロンプトに問い合わせ文を`inquiry`タグで囲んで含める
- [x] `draftReply`は，LLMが書いた返信を，前後の空白を除いて返す
- [x] `draftReply`は，プロンプトに，方針を`policy`タグで，問い合わせ文を`inquiry`タグで囲んで含める

### ollamaLlm

- [x] モデル名とプロンプトをOllamaに渡し，生成された文字列を返す
- [x] JSONの形式を求められたら，Ollamaに`format: json`を渡す

### supportProvider

- [x] 設定`llm: fake`では，偽LLMで分類したカテゴリを出力にする
- [x] 出力のメタデータに，LLMの種類，モデル名，プロンプトの版，シードを記録する
- [x] Ollamaを使うときは，使わないシードを記録しない
- [x] 変数`task: reply`では，返信の下書きを出力にする
- [x] 試行の番号をメタデータに記録する
- [x] 未知の`task`はエラーとして返す
- [x] 同じシード，問い合わせ，試行の番号なら，同じ出力を返す
- [x] 呼び出しの順序が違っても，試行の番号ごとの出力は変わらない
- [x] `noise`があれば，試行によって出力が変わる
- [x] IDは`support-<llm>`である
- [x] 未知の`llm`の設定はエラーにする
- [x] LLMの呼び出しが失敗したら，`promptfoo`にエラーとして返す

### judge

- [x] Judgeが`pass`と答えたら，理由とともに`pass`を返す
- [x] Judgeが`fail`と答えたら`fail`を返す
- [x] Judgeが判断できないと答えたら`unknown`を返す
- [x] JSONとして読めない応答は`error`にする
- [x] `verdict`が決めた値でなければ`error`にする
- [x] プロンプトにルーブリックと，`reply`タグで囲んだ返信を含め，JSONの形式を求める

### judgeAssertion

- [x] `gradeWithJudge`は，Judgeの判定`pass`を，合格の採点結果にする
- [x] `gradeWithJudge`は，Judgeの判定`fail`を，不合格の採点結果にする
- [x] `gradeWithJudge`は，`unknown`と`error`は不合格として返し，メタデータに判定を残す
- [x] `gradeWithJudge`は，Judgeの呼び出しが失敗したら，`error`の採点結果にする
- [x] 設定`judge.llm: fake`では，偽のJudgeで判定する
- [x] 同じ出力と試行の番号なら，同じ判定を返す
- [x] `noise`があれば，試行によって判定が変わる
- [x] Ollamaに接続できなければ，`error`の採点結果にする
- [x] ルーブリックがなければエラーにする

### decisionModel

- [x] `ollamaDecisionModel`は，`/v1/systemone`に状態と`noul`型の質問を送り，答えの確率を返す
- [x] `ollamaDecisionModel`は，応答が失敗なら，状態コードを含むエラーにする
- [x] `fakeDecisionModel`は，`noise`が0なら，問い合わせに答えている返信には高い確率を返す
- [x] `fakeDecisionModel`は，`noise`が0なら，宣伝だけの返信に低い確率を返す
- [x] `fakeDecisionModel`は，`noise`があれば確率が揺れるが，0以上1以下に収まる

### decisionAssertion

- [x] `gradeWithDecisionModel`は，確率がしきい値以上なら合格にし，確率をスコアとメタデータに残す
- [x] `gradeWithDecisionModel`は，確率がしきい値より小さければ不合格にする
- [x] `gradeWithDecisionModel`は，意思決定モデルの呼び出しが失敗したら，`error`の採点結果にする
- [x] 設定`model.llm: fake`では，偽の意思決定モデルで判定する
- [x] しきい値を設定で変えられる
- [x] Ollamaに接続できなければ，`error`の採点結果にする

### promptfooResult

- [x] `parseResultFile`は，スイート名とプロバイダ名を取り出す
- [x] `parseResultFile`は，試行と採点器ごとに，出力，採点の結果，理由を取り出す
- [x] `parseResultFile`は，同じタスクの試行に，現れた順に1からの番号を付ける
- [x] `parseResultFile`は，アサーションのメタデータにある`unknown`と`error`を，採点の結果として取り出す
- [x] `metric`のない採点器は，アサーションの種類を名前にする
- [x] プロバイダがエラーを返した試行は，そのタスクのすべての採点器を`error`にする
- [x] `parseResultFile`は，プロバイダのラベルがあれば，IDの代わりにラベルを使う
- [x] `parseResultFile`は，最初の結果のメタデータから，再現のための記録を取り出す
- [x] 結果ごとに違う記録は，現れた順に重複を除いてカンマでつなぐ
- [x] `parseResultFile`は，メタデータがなければ，再現のための記録を空にする
- [x] `parseResultFile`は，`promptfoo`の結果JSONの形でなければエラーにする

### stats

- [x] `binomialInterval`は，10回中10回の合格でも，区間の下限は1より小さい
- [x] 10回中7回の合格では，Clopper-Pearson法の区間を返す
- [x] `binomialInterval`は，10回中0回の合格でも，区間の上限は0より大きい
- [x] `binomialInterval`は，信頼水準を下げると，区間は狭くなる
- [x] `binomialInterval`は，試行を増やすと，区間は狭くなる
- [x] `binomialInterval`は，試行が0回ならエラーにする
- [x] `meanWithError`は，平均を求める
- [x] 標準誤差は，標本標準偏差を値の数の平方根で割ったものである
- [x] 区間は，平均±`z`×標準誤差である
- [x] `meanWithError`は，区間を0から1の範囲に収める
- [x] `meanWithError`は，値が2つより少なければエラーにする
- [x] `judgeTarget`は，区間の下限が目標以上なら`met`である
- [x] `judgeTarget`は，区間の上限が目標より小さければ`not met`である
- [x] `judgeTarget`は，区間が目標をまたげば`inconclusive`である

### summary

- [x] `groupTrials`は，同じタスクと採点器の試行をまとめる
- [x] `groupTrials`は，同じタスクでも，採点器が違えば別にまとめる
- [x] `passHatK`は，`k`が1なら合格率である
- [x] `passHatK`は，全試行で合格なら1である
- [x] `passHatK`は，合格数が`k`より少なければ0である
- [x] `passHatK`は，`C(合格数, k) / C(試行数, k)`で推定する
- [x] `passHatK`は，`k`が試行数より大きければエラーにする
- [x] `summarize`は，タスクと採点器ごとに，合格数，試行数，合格率を求める
- [x] `summarize`は，全試行で合格なら`stable`，全試行で不合格なら`broken`，それ以外は`flaky`にする
- [x] 採点器ごとのpass@1は，タスクごとの合格率の平均である
- [x] 採点器ごとのpass^kは，タスクごとのpass^kの平均である
- [x] `summarize`は，試行数が`k`より少ないタスクがあれば，pass^kを求めない
- [x] `summarize`は，採点器ごとに，`stable`，`flaky`，`broken`のタスクの数を数える
- [x] `summarize`は，採点器が複数あれば，採点器ごとに分けて集計する
- [x] `summarize`は，タスクの合格率に，二項分布に基づく信頼区間を付ける
- [x] `summarize`は，採点器ごとに，タスクごとの合格率の平均，標準誤差，信頼区間を求める
- [x] `summarize`は，タスクが1つしかなければ，標準誤差を求めない
- [x] `summarize`は，目標を与えると，採点器ごとに区間と目標を比べる
- [x] `summarize`は，目標を与えなければ，目標と比べない
- [x] `summarize`は，`unknown`と`error`は合格率の計算から除き，件数を数える
- [x] 判定できた試行がないタスクは，合格率と区間を求めず，状態を`unjudged`にする
- [x] `summarize`は，採点器ごとに，`unknown`と`error`の件数を合計する
- [x] 採点器ごとの合格率は，判定できた試行のあるタスクだけで求める
- [x] `summarize`は，タスクあたりの試行数を求める

### report

- [x] `formatSummary`は，1行目に，スイート名と再現のための記録を表示する
- [x] `formatSummary`は，記録のない項目は1行目に表示しない
- [x] `formatSummary`は，タスクと採点器ごとに，合格数，合格率，信頼区間，状態の表を表示する
- [x] `formatSummary`は，空行のあとに，採点器ごとのpass@1，標準誤差，信頼区間，pass^k，状態ごとのタスクの数，`unknown`と`error`の件数の表を表示する
- [x] `formatSummary`は，信頼水準を列の名前に表示する
- [x] `formatSummary`は，標準誤差とpass^kを求めていなければ-を表示する
- [x] 目標を与えたときは，目標との比較の列を加える
- [x] 判定できた試行がないタスクは，合格率と区間を-と表示する
- [x] `formatTranscripts`は，タスクの試行ごとに，出力と，採点器ごとの結果と理由を表示する
- [x] `formatTranscripts`は，出力の改行は空白に置き換えて1行で表示する
- [x] `formatTranscripts`は，タスクの試行がなければエラーにする

## 統合テスト

- [x] 偽LLM，偽のJudge，偽の意思決定モデルで10回ずつ評価したスイートの，タスクと採点器ごとの集計を表示する
- [x] `show`で，タスクの試行ごとの出力と，採点器ごとの結果と理由を表示する
- [x] `show`で未知のタスクを指定したら，理由を表示して終了コード1を返す
- [x] `--k`で，pass^kの`k`を変える
- [x] `--confidence`で，信頼区間の水準を変える
- [x] `--target`で，採点器ごとに信頼区間と目標を比べる
- [x] サブコマンドがなければ使い方を表示し，終了コード2を返す
- [x] 未知のサブコマンドには使い方を表示し，終了コード2を返す
- [x] `--k`が1以上の整数でなければ使い方を表示し，終了コード2を返す
- [x] `--confidence`や`--target`が0と1の間(両端を含まない)の数でなければ使い方を表示し，終了コード2を返す
- [x] 結果JSONを読めなければ理由を表示し，終了コード1を返す

## 既存のテストの変更

- [x] `supportProvider`のメタデータのテストに，試行の番号`trial`を加える
- [x] `promptfooResult`の試行のテストを，`pass`から`outcome`，`trial`，`reason`を持つ形に変える
- [x] `promptfooResult`の「プロバイダがエラーを返した試行」を，不合格から`error`に変える
- [x] `summary`のテストで作る試行を，`outcome`を持つ形に変える
- [x] `report`の採点器の表のテストに，`unknown`と`error`の列を加える
- [x] 統合テストの期待する表示に，返信のタスクと採点器を加える
- [x] 統合テストの使い方の表示に，`show`を加える
