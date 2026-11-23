# 背景画像の叩き台：② 有栖川リスペクト作『鴎島館の論理』（仮）

背景14枚分の構図ラフと、AIに渡す指示文です。ラフ（`kamomejima/<名前>.png`）は配置の目安なので、下絵や参考画像として使ってください。一覧は `kamomejima/sheet.png`。

## 共通のルール

- **1枚に1場面**、16:9、幅1280px以上（できれば1920×1080）
- **人物は入れない**（人物は画面上の名前タグで表すため）
- **文字は入れない**（看板などは誤字が出やすい。必要ならあとで入れる）
- 時代は**現代**（2026年の夏）。館は1960年代に建った古い洋館
- 絵柄は汐見港殺人事件の背景にそろえる：アニメ調の背景美術、やわらかい映画的な光、細かく描き込む
- 取り込む前に `engine/README.md` の「AIで作った画像の点検」を確かめる
- ファイル名は下の表の「名前」（例：`library.jpg`）。`games/kamomejima/src/bg/` に置く

**すべての指示文の頭につける共通部分**
> anime style background art for a mystery visual novel, no people, no text, soft cinematic lighting, highly detailed, 16:9

**ネガティブ（避けたいもの）**
> people, characters, faces, text, letters, signage, watermark, modern smartphone, collage, multiple panels

---

## 一覧

| # | 名前 | 場面 | 時間・天気 | 使う章（予定） |
|---|---|---|---|---|
| 1 | `pier` | 汐見港の連絡船乗り場 | 夏の夕方、雲が出はじめ | 1 |
| 2 | `island` | 海から見た鴎島と館 | 嵐の前、灰色 | 1 |
| 3 | `exterior` | 久我館の外観 | 嵐の夜 | 1・5 |
| 4 | `hall` | 玄関ホール | 夜、室内灯 | 1〜8 |
| 5 | `dining` | 大食堂 | 夜、宴の飾り | 1・3 |
| 6 | `salon` | 談話室 | 夜、暖炉 | 2〜8 |
| 7 | `guestroom` | 客室（葛西と鷹宮の部屋） | 夜、窓に嵐 | 1〜7 |
| 8 | `library` | 書庫 | 朝、薄暗い | 2〜4 |
| 9 | `library-safe` | 書庫（隠し金庫が開いた差分） | 同上 | 4〜 |
| 10 | `corridor` | 西棟の廊下 | 停電、非常灯だけ | 2・6 |
| 11 | `drying` | 乾燥室 | 夜、湿気 | 5・6 |
| 12 | `butler` | 執事室 | 夜 | 3・6 |
| 13 | `cliff` | 灯台の崖 | 嵐の夜 | 5 |
| 14 | `terrace` | テラスから見る海 | 嵐のあとの朝 | 8 |

---

## 1枚ずつ

### 1. `pier` 汐見港の連絡船乗り場
- 左に木の桟橋、右に小さな白い連絡船。夏の夕方で、遠くの空に雲が湧きはじめている
- 汐見港殺人事件の「汐見水産」と同じ港町の雰囲気
> a small harbor pier in a japanese seaside town, a small white passenger ferry docked on the right, wooden pier on the left, summer evening, clouds gathering on the horizon, calm sea with warm light

### 2. `island` 海から見た鴎島と館
- 灰色の海に浮かぶ小さな岩の島。頂上に洋館、右の端に灯台
- 嵐の前の、重く垂れこめた空
> a small rocky island in a grey sea, an old western-style mansion on the top, a lighthouse on the right edge, heavy overcast sky before a storm, viewed from a boat

### 3. `exterior` 久我館の外観（嵐の夜）
- 正面から見た2階建ての古い洋館。窓に明かり、斜めに降る雨
> front view of a two-story old western-style mansion at night in a heavy storm, warm light in the windows, slanting rain, wind-bent trees, dramatic dark sky

### 4. `hall` 玄関ホール
- 吹き抜けと大階段、2階の回廊、シャンデリア
- 階段の踊り場の上に創業者の肖像画。**顔ははっきり描かない**（影になっている、または遠い）
> grand entrance hall of an old western-style mansion, a wide central staircase, second floor gallery, chandelier, a large portrait painting above the landing with the face in shadow, warm interior lights at night

### 5. `dining` 大食堂
- 奥に向かって長いテーブル。米寿の祝いの花とキャンドル。奥の窓の外は荒れた海、右に振り子時計
> long dining room of an old mansion, a long table set for a celebration banquet with flowers and candles, tall window at the back showing a stormy sea, a grandfather clock on the right, night

### 6. `salon` 談話室
- 正面に火の入った暖炉、左右にソファ、手前にローテーブル。全員が集まって推理を聞く場所
> cozy drawing room of an old mansion, a lit fireplace in the center, sofas on both sides, a low table in front, warm firelight, rain on the windows, night

### 7. `guestroom` 客室
- ベッドが2つ、右に大きな窓。窓に嵐の雨が打ちつけている
> guest bedroom in an old western-style mansion with two single beds, a bedside lamp, a large window on the right with rain hitting the glass, stormy night outside

### 8. `library` 書庫
- 左右に天井までの本棚、正面に重い木の扉（内側に閂）、手前に読書机。朝だが薄暗い
- **9と同じ構図にしたいので、先にこちらを作る**
> old private library in a mansion, floor-to-ceiling bookshelves on both sides, a heavy wooden door in the center with a wooden bar lock on the inside, a reading desk in front, dim morning light through a small window

### 9. `library-safe` 書庫（隠し金庫が開いた差分）
- 8の画像をもとに、**右の本棚の一部だけ**を変える：本が数冊抜かれ、奥の小さな金庫の扉が開いている。中に古い手帳
- 8を参考画像にして、変える部分だけ指示する（画像の一部を描き直す機能があれば、それを使う）
> same library, but a section of the right bookshelf is open revealing a small hidden safe with its door open, an old worn notebook inside

### 10. `corridor` 西棟の廊下（停電）
- 奥へまっすぐ続く廊下。照明は消え、奥の非常口の緑のランプだけが光る。左右に扉
> a long corridor in an old mansion during a power outage, completely dark except for a green emergency exit light at the far end, doors on both sides, eerie, one-point perspective

### 11. `drying` 乾燥室
- 横に渡した竿に雨具（レインコート）が並んでかかる。右にボイラー、床に水たまり
> a small drying room in the basement of a mansion, raincoats hanging in a row on a pole, a boiler on the right, puddles on the concrete floor, single bulb light, humid

### 12. `butler` 執事室
- 左の壁に鍵がずらりと掛かった鍵棚。机に帳面と古い写真立て。右に小窓
> a butler's office in an old mansion, a wall-mounted key cabinet with many hanging keys on the left, a desk with ledgers and an old photo frame, a small window on the right, lamp light, night

### 13. `cliff` 灯台の崖（嵐の夜）
- 左に崖の縁と灯台、灯台から右へ伸びる光の帯。下は荒れた夜の海、斜めの雨
> a lighthouse on the edge of a sea cliff on a stormy night, the beam of light sweeping to the right, rough waves crashing below, heavy slanting rain, dramatic and dangerous

### 14. `terrace` 嵐のあとの朝
- テラスの手すり越しに、朝日の昇る静かな海。エンディング用なので明るく澄んだ空気に
> view from a mansion terrace over a calm sea at sunrise after a storm, stone balustrade in the foreground, clear fresh morning light, peaceful
