# Iteration 4 解答：モデル型の採点器を検証して補正する

人手ラベルのスイート`labels.yaml`，人手ラベルで採点器を検証する`evalstats calibrate`，検証結果で合格率を補正する`evalstats summary --calibration`の完成形である．
演習の手順ごとの解説は[docs/iteration-4.md](docs/iteration-4.md)にある．

## 動かし方

```console
pnpm test
pnpm eval -c labels.yaml --repeat 5 -o results/labels.json
pnpm evalstats calibrate results/labels.json --split dev --out results/calibration.json
pnpm eval --repeat 10 -o results/fake.json
pnpm evalstats summary results/fake.json --calibration results/calibration.json
```

Ollamaで検証するときは，`labels.yaml`のJudgeの`judge.llm`と意思決定モデルの`model.llm`を`ollama`に変える．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリストの模範解答
docs/iteration-4.md     演習の各手順の解説
design/                 設計文書の模範解答
promptfooconfig.yaml    評価のスイート(分類の11タスク，返信の4タスク)
labels.yaml             人手ラベルのスイート(返信20件，dev/test各10件)
src/                    製品，プロバイダ，採点器，evalstats
test/unit/              単体テスト
test/integration/       統合テスト(promptfooを実際に動かす)
results/                promptfooの結果JSONと検証結果の置き場所
```
