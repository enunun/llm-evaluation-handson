# Iteration 4 演習：モデル型の採点器を検証して補正する

人が合否を付けた返信の集まり(人手ラベル)で，LLM Judgeと意思決定モデルを検証し，使えるかを判定する．検証で分かった採点器の誤りの率で，観測した合格率を補正する．

## 進め方

[docs/iteration-4.md](docs/iteration-4.md)の手順に沿って進める．
このパッケージのコード，テスト，設計文書は，[Iteration 3の解答](../../iteration-3/solution)と同じ状態から始まる．
完成形と模範解答は[../solution](../solution)にある．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリスト(見出しだけのひな形)
docs/iteration-4.md     演習の手順
design/                 設計文書(Iteration 3の解答)
promptfooconfig.yaml    評価のスイート(分類の11タスク，返信の4タスク)
src/                    製品，プロバイダ，採点器，evalstats(Iteration 3の解答)
test/unit/              単体テスト
test/integration/       統合テスト
results/                promptfooの結果JSONの置き場所
```
