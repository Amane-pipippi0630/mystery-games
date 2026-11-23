# 共通エンジン

推理アドベンチャーを、JSONのシナリオから動かすエンジン。

## フォルダ構成

```
engine/            エンジン本体（engine.js・engine.css・template.html）
games/<id>/src/    シナリオ（game.json・章ごとの <章id>.json・bg/ の背景画像）
games/<id>/index.html   組み立てたゲーム（tools/build.py が作る。直接編集しない）
tools/build.py     組み立てと点検
tests/run.py       動作テスト
```

## 組み立てとテスト

```sh
python3 tools/build.py shiomi-port          # 組み立て（点検も行う）
python3 tools/build.py shiomi-port --check  # 点検だけ
python3 tools/build.py tests/fixtures/mini && python3 tests/run.py
```

組み立てると `games/<id>/index.html`（エンジンとシナリオ入り）と `games/<id>/bg/*.webp`（背景）ができる。開くだけで遊べる。

起動時の読み込み画面で、背景をすべてと、ゲームで使う文字のフォント（Google Fonts）を先に読み込む。そのため、遊んでいる間は通信しない。`--inline` を付けると背景もHTMLに埋め込み、1ファイルにできる。

## 背景画像のルール

| 項目 | ルール |
|---|---|
| 置き場所 | `games/<id>/src/bg/<名前>.jpg`（png・webpも可）。場所の `bg` に `<名前>` を書く |
| 名前 | 英小文字・数字・ハイフン（例：`library-night`） |
| 大きさ | 16:9で、幅1280px以上。組み立て時に幅1280pxのWebP（画質80）に変換される |
| 1枚に1場面 | 何場面も並べた一覧画像は使わない（切り出すと画質が落ちる） |

**AIで作った画像の点検**（取り込む前に確かめる）
- 看板や張り紙の文字が正しいか（例：「汐見警察署」が「汐見事業署」になっていないか）
- 場面の意味が変わっていないか（例：雀荘が、花で飾られた葬儀場に見えないか）
- 時代が合っているか（昭和の場面にスマホや高層ビルが写っていないか）
- 人物の顔がはっきり写っていないか（背景には人を入れず、人物は名前タグで表す）
- 同じ作品の背景どうしで、絵柄と色味がそろっているか

## game.json

| キー | 内容 |
|---|---|
| `id` | ゲームのid。セーブの保存先とクリア記録に使う |
| `title` | ページのタイトル |
| `start` | 最初の章のid |
| `chapters` | 章のidを順番に並べた配列。`src/<id>.json` を読む |
| `titleScreen` | `eyebrow`・`title`（`<br>` 可）・`lead` |
| `prologue` | あらすじ画面。`paragraphs`（HTML可）・`cast`（`[名前, 説明]` の配列）・`button`。なければ省略 |
| `items` | `{id: 表示名}` |
| `people` | `{id: {name, short}}`。`short` は「みせる」「すいり」で使う短い名前 |
| `endings` | `{id: {bg, place, small, pages, finalBg, finalPlace, finalSmall, ranks, result}}` |

`result` では `{turns}`（行動回数）・`{miss}`（まちがい回数）・`{rank}` が使える。`ranks` は上から順に条件を見て、最初に合ったものの `label` になる。

## 章（<章id>.json）

| キー | 内容 |
|---|---|
| `id`・`label`・`title` | 章のid、「第一章」のような番号、章の題 |
| `card` | `false` にすると章のはじめの題字画面を出さない |
| `start` | `{loc, text}`。章のはじめの場所と文 |
| `locations` | `{id: {name, bg, unlock, people, objs, arrive}}`。`unlock` は行けるようになる条件、`objs` は `{id: 表示名}` |
| `onMove` | 移動するたびに確かめるルールの配列（当てはまるものすべてを実行） |
| `talk` | `{人物id: 返事}` |
| `show` | `{人物id: {アイテムid: 返事}}` |
| `look` | `{調べるものid: 返事}` |
| `puzzles` | 番号入力の謎解き。`{id: {length, answer, label, prompt, display, success, fail, cancel}}` |
| `accuse` | 犯人の指名。`{suspects, culprit, required, missingText, ending, wrong}` |
| `talkDefault`・`showDefault` | 返事がないときの文。`{name}` が使える |

### 返事の書き方

返事は4通りで書ける。

```jsonc
"文だけ"
{"text": "文", "do": ["効果", ...]}               // ルール1つ。"if" を付けると条件つき
[{"if": "条件", "text": "..."}, {"text": "..."}]  // 上から見て最初に条件が合うもの
{"seq": [{"text": "1回目"}, {"text": "2回目以降"}]} // 話すたびに次へ。最後はくり返す
```

`text` が `名前「…」` の形なら、名前が話し手のタグとして表示される。

### 条件

| 書き方 | 意味 |
|---|---|
| `has:capsule` | アイテムを持っている |
| `flag:sent` | フラグが立っている |
| `var:wait>=1` | 数の比較（`>=` `<=` `==` `!=` `>` `<`）。比較なしなら0より大きい |
| `talked:haru>=2` | その人に話した回数 |
| `here:study` | 今その場所にいる |
| `!`・`&&`・`||`・`( )` | 否定・かつ・または・かっこ |

### 効果

| 書き方 | 意味 |
|---|---|
| `give:x`・`take:x` | アイテムを渡す（入手の通知が出る）・取り上げる |
| `flag:x`・`unflag:x` | フラグを立てる・下ろす |
| `set:x=0`・`inc:x` | 数を入れる・1増やす |
| `miss` | まちがいを1回数える |
| `toast:文` | 画面の上に通知を出す |
| `goto:場所id` | 場所を移る |
| `puzzle:id` | 番号入力の謎解きを開く |
| `chapter:章id` | 「つぎへ」のあと、その章を始める |
| `ending:id` | 「つぎへ」のあと、エンディングへ |

## セーブ

- **オートセーブ**：行動するたびに自動で保存。タイトルの「つづきから」はこれを読む
- **章のはじめ**：章が始まるたびに保存。ロード画面から戻れる
- **スロット1〜3**：メニューから手動で保存

保存先はブラウザの localStorage（`mg:<ゲームid>:...`）。クリアしたゲームは `mg:cleared` に記録される（タイトル画面の⭐️に使う）。
