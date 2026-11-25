# mystery-games
ポートピアのように簡易な謎解きゲームをたくさん作る

## ゲーム一覧

| タイトル | フォルダ | 内容 |
|---|---|---|
| 汐見港殺人事件 | [games/shiomi-port](games/shiomi-port/) | 港町の水産会社社長が密室の書斎で死んでいた。コマンド選択式の推理アドベンチャー |

それぞれのゲームは `index.html` 1枚で動きます（ブラウザで開くだけで遊べます）。
攻略は各フォルダの `WALKTHROUGH.md` にあります（ネタバレ注意）。

## 遊び方

リポジトリ直下の `index.html`（作品選択ページ）を開き、遊びたい作品を選びます。クリアした作品には ⭐️ が付きます。三部作をすべてクリアすると、隠しエピローグが開きます。

## 開発

エンジンとシナリオの書き方は [engine/README.md](engine/README.md) にあります。

```sh
python3 tools/build.py shiomi-port   # games/shiomi-port/src から index.html を組み立てる
python3 tools/build_hub.py          # hub/hub.json から作品選択ページ（index.html）を組み立てる
python3 tools/build.py tests/fixtures/mini && python3 tests/run.py   # 動作テスト（Playwright）
```

章を作ったときの検証（詰み・バグ・矛盾）は [docs/verification.md](docs/verification.md) の手順で行います。

```sh
python3 tools/verify.py kamomejima   # 詰み・エラー・行き止まりの文
```

`games/<id>/index.html` は組み立てた結果なので、直接編集せず `src/` を直してください。

## 遊ぶ

https://amane-pipippi0630.github.io/mystery-games/
