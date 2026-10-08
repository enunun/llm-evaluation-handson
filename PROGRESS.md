# 教材作成の進捗

教材を作る人向けに，作成の進み具合とこれからの作業を記録する．
コースの計画は[COURSE.md](COURSE.md)に，各Iterationの内容は[docs/ROADMAP.md](docs/ROADMAP.md)にある．

## 状況

| 項目 | 状態 |
| --- | --- |
| コース計画(`COURSE.md`，`docs/ROADMAP.md`) | 完了 |
| リポジトリの土台(Dev Container，mise，検査スクリプト，ガイド) | 完了(Dev Containerのビルドは未確認) |
| Iteration 0 | 完了 |
| Iteration 1 | 完了 |
| Iteration 2 | 完了 |
| Iteration 3 | 完了 |
| Iteration 4 | 作成中 |
| Iteration 5 | 未着手 |

## 作業中：Iteration 4

- [ ] Iteration 3の解答を演習と解答にコピーし，パッケージ名を変える
- [ ] 人手ラベルのスイート`labels.yaml`(返信20件，採点器ごとの人の判定，dev/testの分割)と，返信をそのまま出力するプロバイダ`labelProvider`
- [ ] `promptfooResult`で人の判定と確率を読む．`agreement`(混同行列，TPR，TNR，自己一貫性，しきい値ごとの率)
- [ ] `calibration`(検証と合格基準，Rogan-Gladen補正)と`stats`のブートストラップ区間
- [ ] `cli`の`calibrate`サブコマンド(`--split`，`--out`)と，`summary`の`--calibration`
- [ ] 設計文書(ADR 0005)，教材の文章，ノート
- [ ] Ollama(qwen2.5:0.5b，tev1:0.8b)でJudgeと意思決定モデルを検証した結果を取る
- [ ] `mise run check`，演習と前の解答の差分の確認，コミット

## これからの作業

1. Iteration 5：対応のある差，最小検出差，非劣性マージンによるゲート，`eval:gate`．
2. Dev Containerを実際にビルドし，コンテナの中で`mise run check`を通す．

## 作成の環境についての覚え書き

- Ollamaでの動作確認は，軽量なモデル(`qwen2.5:0.5b`，`tev1:0.8b`)で行う．教材に載せるOllamaの出力には，使ったモデルを書く．
