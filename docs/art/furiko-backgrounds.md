# 背景画像の叩き台：① 東野リスペクト作『振り子の止まる夜』（仮）

背景14枚分の構図ラフと、AIに渡す指示文です。ラフ（`furiko/<名前>.png`）は配置の目安です。一覧は `furiko/sheet.png`。

## 共通のルール

- **1回に1場面**（一覧で頼むと横長の帯になり、16:9で使えない）。16:9、幅1280px以上（できれば1920×1080）
- **人物は入れない**、**文字は入れない**（看板・時計の文字盤の数字はぼかしてよい）
- 時代は**現代**（2027年1月、真冬）。舞台は東京・墨田区の下町（架空の時雨町）
- 絵柄は汐見港殺人事件・鴎島館の背景にそろえる：アニメ調の背景美術、やわらかい映画的な光
- ファイル名は下の「名前」（例：`shop.jpg`）。`games/furiko/src/bg/` に置く（いまは同じ名前の仮の絵がある）
- 取り込む前に `engine/README.md` の「AIで作った画像の点検」を確かめる

**共通部分（すべての指示文の頭につける）**
> anime style background art for a mystery visual novel, no people, no text, soft cinematic lighting, highly detailed, 16:9

**ネガティブ**
> people, characters, faces, text, letters, signage, watermark, collage, multiple panels

## 生成状況（2026-11-24）

Canva の画像生成で作成。作業環境からは本体をダウンロードできないため、Canva で開いてダウンロードし、取り込む。

| 名前 | Canva | 状況 |
|---|---|---|
| `shop` | [MAHbzmE47lk](https://www.canva.com/M/MAHbzmE47lk) | 生成済み・未取り込み |
| `workshop` | [MAHbzigvOpA](https://www.canva.com/M/MAHbzigvOpA) | 生成済み・未取り込み |
| ほか32枚 | | Canva のクレジット上限で止まっている |

## 一覧

| # | 名前 | 場面 | 時間 | 章 |
|---|---|---|---|---|
| 1 | `shop` | 宮下時計店の店内 | 昼・夕 | 1〜3・5・8、エピローグ |
| 2 | `workshop` | 時計店の奥の作業場 | 夕方〜夜 | 1・2・5・8 |
| 3 | `living` | 2階の居間 | 夜 | 1・2・8 |
| 4 | `alley` | 時計店の裏の路地 | 冬の夜 | 2・5 |
| 5 | `kaikan` | 町会会館（新年会） | 夜 | 2・3・6 |
| 6 | `riverside` | 隅田川の堤防下の道 | 冬の朝 | 3 |
| 7 | `riverside-night` | 同じ道 | 冬の夜 | 2 |
| 8 | `police` | 墨田署の会議室 | 昼 | 3・4・6 |
| 9 | `lab` | 大学の物理学の研究室 | 昼 | 4・7 |
| 10 | `apartment` | 長尾のマンションの部屋 | 昼 | 3 |
| 11 | `cafe` | 喫茶「振子」 | 昼 | 6 |
| 12 | `conbini` | 角のコンビニ | 夜 | 5 |
| 13 | `tofu` | 隣の豆腐店 | 昼 | 1・3 |
| 14 | `garage` | 署の車両保管所 | 昼 | 4 |

## 1枚ずつ

### 1. `shop` 宮下時計店
- 壁いっぱいに大小30台の掛け時計。手前にガラスのショーケース、右に帳場と黒電話。奥に背の高い箱型の振り子時計（大時計）
> interior of a small old clock repair shop in a tokyo downtown alley, a wall completely covered with about thirty wall clocks of different sizes, a glass showcase with wristwatches in front, a small counter with an old black rotary phone, a tall wooden grandfather clock at the back, warm afternoon light through a glass sliding door

### 2. `workshop` 作業場
- 三畳ほどの板の間。作業台に拡大鏡とピンセット。右に大時計（ケースの扉）、手前に石油ストーブ
> a tiny wooden-floored workshop behind a clock shop, a workbench with a loupe, tweezers and small tools, shelves with clocks waiting for repair, a tall grandfather clock with its case door, a kerosene heater with a kettle, a bare light bulb, evening

### 3. `living` 2階の居間
- 古い畳の部屋。ちゃぶ台に教科書。左に小さな仏壇、右に窓（路地の街灯が見える）
> a small old japanese tatami living room on the second floor, a low round table with textbooks, a small buddhist altar on the left, a window on the right showing a streetlight in an alley, warm lamp light at night

### 4. `alley` 裏の路地（冬の夜）
- 車1台がやっと通れる細い路地。左に時計店の裏口、右の奥に灰色のセダン、街灯ひとつ
> a narrow back alley in tokyo's old downtown at night in winter, just wide enough for one car, a back door of a small shop on the left, a grey sedan parked against a wall, a single streetlight, cold blue tones

### 5. `kaikan` 町会会館
- 畳の座敷に長机。新年会の料理と瓶。紅白の幕、壁の時計
> a neighborhood community hall with tatami floor, long low tables with new year party food and beer bottles, a red and white curtain on the wall, a wall clock, warm lights at night

### 6. `riverside` 隅田川の堤防下の道（朝）
- 堤防の下の細い道に、窓が白く曇ったセダン。川に朝霧、冷たい朝の光
> a narrow road below a river embankment along the sumida river in early winter morning, a grey sedan with fogged and frosted windows parked alone, morning mist over the water, cold pale light

### 7. `riverside-night` 同じ道（夜）
- 6と同じ構図で夜。川は黒く、対岸に高速道路の灯
> the same narrow road below a river embankment at night, a grey sedan parked alone, black river water, lights of an elevated highway on the far bank, cold and quiet

### 8. `police` 墨田署の会議室
> a police station meeting room in tokyo, long tables, a whiteboard with photos pinned on it, fluorescent lights, daytime

### 9. `lab` 物理学の研究室
> a cluttered university physics laboratory, a blackboard full of equations, lab benches with instruments, bookshelves, a wall thermometer, afternoon light

### 10. `apartment` 長尾の部屋
> a messy room in an old apartment building, a desk with a black notebook, bookshelves with company history books full of sticky notes, stale daylight through curtains

### 11. `cafe` 喫茶「振子」
> an old showa-era japanese coffee shop, an old pendulum wall clock, a table in the back corner, warm amber lighting, quiet daytime

### 12. `conbini` 角のコンビニ
> inside a small japanese convenience store at night, bright lights, shelves, a cash register counter, a window looking out onto a dark street corner

### 13. `tofu` 豆腐店
> a small traditional tofu shop in a tokyo downtown street, water tanks with white tofu, rising steam, a noren curtain at the entrance, daytime

### 14. `garage` 車両保管所
> a police vehicle storage garage, a grey sedan on a blue tarp, a half-open shutter letting in daylight, concrete floor
