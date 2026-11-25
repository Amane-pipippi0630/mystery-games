# 背景画像の叩き台：③ 清張リスペクト作『冬の汐見』（仮）と隠しエピローグ

『冬の汐見』18枚とエピローグ2枚の構図ラフと、AIに渡す指示文です。ラフは `fuyu-shiomi/<名前>.png` と `epilogue/<名前>.png`、一覧はそれぞれの `sheet.png`。

## 共通のルール

- **1回に1場面**、16:9、幅1280px以上（できれば1920×1080）
- **人物は入れない**、**文字は入れない**
- 『冬の汐見』の時代は**昭和34〜35年（1959〜1960年）の冬**。テレビ・スマホ・現代の車は出さない
- 絵柄はほかの作品にそろえる：アニメ調の背景美術、やわらかい映画的な光。昭和の作品なので、色は少し落ち着かせる
- ファイル名は下の「名前」。`games/fuyu-shiomi/src/bg/`（エピローグは `games/epilogue/src/bg/`）に置く

**共通部分（すべての指示文の頭につける）**
> anime style background art for a mystery visual novel, no people, no text, soft cinematic lighting, highly detailed, 16:9

**『冬の汐見』だけ足す**
> set in late 1950s japan, showa era, muted colors

**ネガティブ**
> people, characters, faces, text, letters, signage, watermark, collage, multiple panels, smartphone, modern car, television

## 取り込み状況（2026-11-25）

Gemini で18枚とエピローグ2枚を生成し、すべて取り込み済み（1376×768 を 16:9 に切り出し、build で 1280px の WebP に変換）。汐見署の表彰写真に人影が小さく写る、豆腐店ののれんに「豆」の字がある、の2点は物語上そのままにした。

## 一覧（冬の汐見）

| # | 名前 | 場面 | 章 |
|---|---|---|---|
| 1 | `inn` | 品川の安宿「千鳥屋」の帳場（裏の物干し場にも使う） | 1 |
| 2 | `inn-room` | 千鳥屋2階の「梅の間」 | 1 |
| 3 | `keishicho` | 警視庁・捜査一課 | 1・3〜5 |
| 4 | `shiomi-police` | 汐見署 | 2・7 |
| 5 | `isobe` | 磯辺町の網元・戸川家と海 | 2・7 |
| 6 | `kamome` | 港の飲み屋「かもめ」 | 2・7 |
| 7 | `nippo` | 汐見日報の編集部 | 2・6 |
| 8 | `yakuba` | 汐見市役所の窓口 | 2 |
| 9 | `kuga` | 久我海運の社長室（受付・秘書室・専務室にも使う） | 3〜5 |
| 10 | `loan` | 金貸しの事務所 | 3 |
| 11 | `station` | 東京駅のホーム（夜行） | 5 |
| 12 | `hotel` | 大阪のホテル浪速のロビー | 5 |
| 13 | `osaka` | 久我海運大阪支店 | 5 |
| 14 | `temple` | 信州の山寺 | 6 |
| 15 | `beach` | 汐見の浜（夜明け前） | 8・結末 |
| 16 | `grave` | 海を見下ろす丘の墓地 | 7 |
| 17 | `study` | 目白の久我邸 | 4 |
| 18 | `geshuku` | 深川の下宿の四畳半（蒲田の町工場にも使う） | 3・6 |

## 1枚ずつ（冬の汐見）

### 1. `inn` 千鳥屋の帳場
> the entrance hall of a cheap old inn near shinagawa station in winter 1959, a small reception counter with a charcoal brazier and a guest register, frosted glass sliding front door, a steep wooden staircase to the second floor, dim morning light

### 2. `inn-room` 梅の間
> a six-tatami guest room in a cheap old japanese inn, a window slightly open by a few centimeters, a cold charcoal brazier, an unused futon laid out, cold pale winter morning light

### 3. `keishicho` 警視庁・捜査一課
> a crowded showa-era police detectives office, rows of old wooden desks, a blackboard, cigarette smoke hanging under the ceiling, winter daylight through tall windows

### 4. `shiomi-police` 汐見署
> a small wooden police station in a japanese seaside town in 1959, a pot-bellied stove with a kettle, an old framed group photo on the wall, a window showing a grey winter sea

### 5. `isobe` 磯辺町
> a winter fishing village on the japan sea coast, a large old house of a fishing family, stone walls with burn marks where a net storehouse once stood, grey rough sea, overcast sky

### 6. `kamome` 飲み屋「かもめ」
> a small harbor bar in a japanese fishing town in the late 1950s, a wooden counter, an old fishing net hung as decoration, bare light bulbs, warm and smoky

### 7. `nippo` 汐見日報
> a small local newspaper editorial room in the late 1950s, desks piled with manuscripts, shelves of bound newspaper archive volumes, a printing press feeling, afternoon light

### 8. `yakuba` 市役所
> a showa-era city hall family register counter, a long wooden counter, shelves of old ledgers, quiet daytime

### 9. `kuga` 久我海運の社長室
> a new president's office of a shipping company in nihonbashi tokyo, built in 1958, a large heavy desk, a big window overlooking old tokyo rooftops and the bay in the distance, polished and orderly

### 10. `loan` 金貸しの事務所
> a moneylender's small second-floor office on a back street in tokyo, an iron safe, a desk with ledgers, dim light

### 11. `station` 東京駅のホーム
> a platform of tokyo station at night in 1959, a blue overnight sleeper train waiting, an old departure board, steam and lights, winter

### 12. `hotel` ホテル浪速
> the lobby of an old grand hotel in osaka in the late 1950s, a front desk, a side service entrance door, warm lights

### 13. `osaka` 大阪支店
> a branch office of a shipping company in osaka in the late 1950s, office desks, a window overlooking a river, daytime

### 14. `temple` 信州の山寺
> a small mountain temple in nagano in autumn, the main hall, maple leaves covering the grounds, a path to a graveyard

### 15. `beach` 汐見の浜（夜明け前）
> a lonely beach on the japan sea coast before dawn in winter, rough grey waves, snow blown by the wind, a line of footprints in the snow leading to the water's edge

### 16. `grave` 丘の墓地
> a small graveyard on a hill overlooking the japan sea in winter, a small old gravestone at the edge, grey sky, the sea below

### 17. `study` 久我邸
> the entrance hall of a western-style residence in mejiro tokyo in the late 1950s, a closed study door, polished wood, quiet afternoon light

### 18. `geshuku` 下宿の四畳半
> a small four-and-a-half tatami room in an old boarding house in tokyo in the late 1950s, a low table, a calendar on the wall, a window, worn and cold

## エピローグ（現代・2027年秋）

| # | 名前 | 場面 |
|---|---|---|
| 1 | `room` | 三島陽の部屋（錦糸町） |
| 2 | `police` | 現代の汐見署（昭和の表彰写真がいまも飾られている） |

`shop` は『振り子』の `shop`、`grave` と `beach` は『冬の汐見』と同じ絵を使う（季節が冬なので、秋の版を作るなら同じ指示文の winter を autumn に替える）。

### `room` 三島陽の部屋
> a freelance journalist's small apartment room in tokyo today, a desk with an old box of a grandfather's belongings and an old sealed envelope, piles of books and documents, a window with clear autumn sky

### `police` 現代の汐見署
> a modern small police station office in a japanese seaside town, desks with computers, an old black and white framed photo of 1950s detectives on the wall, a window showing a calm autumn sea
