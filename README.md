# 生成AIプロダクトの品質評価ハンズオン

生成AIの出力は，同じ入力でも毎回変わる．
このハンズオンでは，この非決定性に正面から向き合い，「たまたま通った」ではなく根拠のある数字で品質を語れるようになることを目指す．

カスタマーサポート向けの小さなLLM機能(問い合わせの分類と返信の下書き)を作り，[promptfoo](https://github.com/promptfoo/promptfoo)で評価し，その結果を分析するCLI`evalstats`を6つのIterationで育てる．
各Iterationは，テストリスト，設計文書，テスト駆動の実装，設計の見直しの順に進める．

## 学べること

- 同じタスクを複数回試行し，合格率，pass^k，標準誤差，信頼区間で品質を表す．
- 評価のスイートと採点器(コード，LLM Judge，意思決定モデル)を設計し，モデル型の採点器を人手ラベルで検証する．
- 2つの版を対応のある差で比べ，回帰をCIのゲートで止める．
- 何を測るかを，QA4AIのガイドラインとISO/IEC 25059の品質特性に沿って整理する．

## 前提

- プログラミングと単体テストの経験があり，TypeScriptを読み書きできる．
- LLMのAPIを呼ぶアプリを作ったことがある．
- Docker，VS Code，Dev Containers拡張が使える．

## 始め方

1. このリポジトリをクローンし，VS Codeで開く．
2. コマンドパレットで「Dev Containers: Reopen in Container」を実行する．初回は`mise run setup`が依存パッケージを入れる．
3. コンテナの中のターミナルで，リポジトリ全体を検証し，環境が動くことを確かめる．

   ```console
   mise run check
   ```

4. Ollamaにモデルを取得する(数GBあり，初回は時間がかかる)．Ollamaを使わなくても，偽のLLMでコースを最後まで進められる．

   ```console
   mise run ollama:pull
   mise run ollama:status
   ```

`mise tasks`で，使えるタスクを一覧できる．

## Iteration

| Iteration | 内容 | 演習 | 解答 |
| --- | --- | --- | --- |
| 0 | 問い合わせの分類をpromptfooで1回評価し，タスクごとの合否を表示する | [exercise](iterations/iteration-0/exercise) | [solution](iterations/iteration-0/solution) |
| 1 | 各タスクを複数回試行し，合格率，pass^k，揺れを集計する | [exercise](iterations/iteration-1/exercise) | [solution](iterations/iteration-1/solution) |
| 2 | 合格率に標準誤差と信頼区間を付け，目標と比べる | [exercise](iterations/iteration-2/exercise) | [solution](iterations/iteration-2/solution) |
| 3 | 返信の下書きを，コードの採点器，LLM Judge，意思決定モデルで採点する | [exercise](iterations/iteration-3/exercise) | [solution](iterations/iteration-3/solution) |
| 4 | モデル型の採点器を人手ラベルで検証し，合格率を補正する | [exercise](iterations/iteration-4/exercise) | [solution](iterations/iteration-4/solution) |
| 5 | 2つの実行結果を比較し，回帰をゲートで止める | 作成中 | 作成中 |

各Iterationの要求と学ぶことは[ロードマップ](docs/ROADMAP.md)にある．

## 案内

- [ロードマップ](docs/ROADMAP.md)：各Iterationで作るもの，学ぶこと，拠り所にする指針．
- [テスト駆動開発の進め方](docs/tdd.md)：Red → Green → Refactor，テストリストの書き方，単体テストと統合テスト．
- [設計文書の書き方](docs/design.md)：モジュール依存図，型，ADR．
- [ノート](docs/notes/README.md)：各Iterationで初めて使う概念，ツール，構文．
