# Iteration 5 演習：比較して回帰を止める

プロンプトやモデルを変えた版(対象)を，前の版(基準)と比べる．同じタスクの合格率を対にした差の区間で改善と悪化を判定し，許せる悪化の幅(非劣性マージン)を超えた変更を，終了コードでCIから止める．

## 進め方

[docs/iteration-5.md](docs/iteration-5.md)の手順に沿って進める．
このパッケージのコード，テスト，設計文書は，[Iteration 4の解答](../../iteration-4/solution)と同じ状態から始まる．
完成形と模範解答は[../solution](../solution)にある．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリスト(見出しだけのひな形)
docs/iteration-5.md     演習の手順
design/                 設計文書(Iteration 4の解答)
promptfooconfig.yaml    評価のスイート(分類の11タスク，返信の4タスク)
labels.yaml             人手ラベルのスイート(返信20件，dev/test各10件)
src/                    製品，プロバイダ，採点器，evalstats(Iteration 4の解答)
test/unit/              単体テスト
test/integration/       統合テスト
results/                promptfooの結果JSONと検証結果の置き場所
```
