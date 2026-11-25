# BGMの叩き台：Suno で作る曲の一覧と指示文

全5作のBGM 21曲の配置と、Suno に渡す指示文です。曲を作ったらチャットに添付してください。ループの切り出し・音量そろえ・組み込みはこちらで行います。

## 先に確認すること（ライセンスとダウンロード数）

- Suno の無料プランで作った曲は**非商用のみ**で、所有権は Suno に残る。有料プラン（Pro・Premier）で作った曲には商用利用の権利がつく。あとから有料にしても、無料で作った曲にはさかのぼらない。
- 2026年9月3日から、ダウンロードに月の上限がある（Pro 20曲、Premier 60曲。無料プランはダウンロードなしと報じられている）。**21曲なので、Pro だと1か月に収まらない**。下の「優先」の順にダウンロードし、残りは翌月か、使い回しで埋める。
- 生成は何回してもよい。Suno の画面で聞いて、使うものだけダウンロードする。
- 出典：[Suno ヘルプ：Rights & Ownership](https://help.suno.com/en/categories/550145)、[Suno：ダウンロードと利用規約の更新](https://about.suno.com/blog/suno-updates-tos)

## 共通のルール

- **Instrumental（歌なし）**にする
- 長さは**1分半〜3分**。前奏と後奏はこちらで切るので、そのままでよい
- 形式は mp3 でよい。ファイル名は下の「名前」（例：`kamomejima_daily.mp3`）
- 音量の差はこちらでそろえる
- **捜査中の曲がいちばん長く流れる**。耳につくメロディ、急な盛り上がり、ドラムの強い曲は避ける

**共通部分（すべての指示文の頭につける）**
> instrumental, background music for a japanese mystery adventure game, no vocals, seamless loop, steady dynamics

## 曲の種類（どこで流れるか）

| 種類 | 流れる場所 | 曲の性格 |
|---|---|---|
| daily（捜査） | タイトル画面と、ふだんの調べる・聞く・移動のあいだ | 静か、落ち着いた、何時間聞いても疲れない |
| incident（事件発生） | 遺体が見つかる場面など、章の頭の事件イベント | 不穏、張りつめた。短くてもよい |
| deduce（推理） | 矛盾をつく・謎解き・推理ボード・犯人の指名 | 考える、集中、ゆっくり緊張が上がる |
| confront（対峙） | 解決編、犯人の告白、犯人と向き合う場面 | 重い、劇的、悲しみをふくむ |
| ending（エンディング） | エンディングと結果画面 | 余韻、やさしい、少し苦い |

## 一覧

優先は、ダウンロードする順番の目安（1がいちばん先）。

### 鴎島館の論理（嵐の洋館・本格もの）

作品の色：ピアノと弦楽四重奏、ときどきチェンバロ。古い館、嵐、品のよさ。

| 優先 | 名前 | 流れる場所 | 指示文（共通部分のあとにつける） |
|---|---|---|---|
| 1 | `kamomejima_daily` | タイトル、第1〜6章の捜査 | chamber music, piano and string quartet, light harpsichord, elegant old western mansion on a stormy island, mysterious and calm, minor key, slow tempo |
| 6 | `kamomejima_incident` | 第2章 書庫の遺体、第5章 崖下の康彦 | tense strings tremolo, low piano clusters, thunderstorm mood, suspense, dark minor key, sparse |
| 5 | `kamomejima_deduce` | 矛盾をつく、小箱の謎、第7章 推理ボード | thoughtful piano ostinato, pizzicato strings, harpsichord, logical puzzle solving, gradually building tension, minor key |
| 11 | `kamomejima_confront` | 第8章 解決編と圭の告白 | dramatic string quartet, cello lead, tragic and solemn, slow build, minor key |
| 16 | `kamomejima_ending` | 第8章の終わり、結果画面 | gentle solo piano with soft strings, morning after the storm, bittersweet, calm resolution |

### 振り子の止まる夜（時計店・倒叙）

作品の色：ピアノ中心で音数が少ない。時計のチクタクのような規則正しい刻み。冬の東京の夜。

| 優先 | 名前 | 流れる場所 | 指示文 |
|---|---|---|---|
| 2 | `furiko_daily` | タイトル、第3〜6章の捜査 | minimal piano, ticking clock rhythm, soft clarinet, quiet winter night in old tokyo, melancholic, minor key, slow tempo |
| 7 | `furiko_incident` | 第1章 もみ合い（17:45）、第2章 蒼が遺体を運ぶ夜 | anxious ticking rhythm, low strings drone, heartbeat pulse, secret and guilt, dark, minimal |
| 8 | `furiko_deduce` | 矛盾をつく、レシートの謎、第7章 検証 | precise piano arpeggios like clockwork, light percussion ticks, analytical, scientific investigation, building tension |
| 12 | `furiko_confront` | 第8章 千鶴の告白と蒼の指名 | solo piano and cello, emotional confession, grief and tenderness, slow, minor key |
| 17 | `furiko_ending` | 第8章の終わり、結果画面 | music box style melody with piano, old pendulum clock, warm and sad, gentle |

### 冬の汐見（昭和34年・冬の海）

作品の色：チェロなど低い弦、アコーディオンかハーモニカ。昭和の古い映画、冬の港町、波音。

| 優先 | 名前 | 流れる場所 | 指示文 |
|---|---|---|---|
| 3 | `fuyu_daily` | タイトル、第1〜7章の捜査 | cello and piano, soft accordion, 1950s japanese film noir, winter harbor town, cold sea, nostalgic, minor key, slow tempo |
| 9 | `fuyu_incident` | 第1章 千鳥屋の現場 | low cello drone, muted trumpet, cold winter night, crime scene, suspense, 1950s noir |
| 10 | `fuyu_deduce` | 矛盾をつく、縮刷版の検索、第5章 時刻表の謎 | steady train rhythm, double bass and piano, timetable investigation, 1950s detective film, building tension |
| 13 | `fuyu_confront` | 第8章 浜で佐伯と向き合う | dramatic low strings and timpani, solo harmonica, winter sea at dusk, tragic, solemn, minor key |
| 18 | `fuyu_ending` | 第8章 冬の海へ歩いていく場面、結果画面 | solo harmonica with soft strings, sound of waves, lonely and quiet, showa era, bittersweet |

### 汐見港殺人事件（現代の刑事もの・番外編）

作品の色：軽めのジャズ。ピアノとウッドベース、ブラシのドラム。

| 優先 | 名前 | 流れる場所 | 指示文 |
|---|---|---|---|
| 14 | `shiomi_daily` | タイトル、捜査 | cool jazz, piano trio, upright bass, brushed drums, detective investigation in a seaside town, relaxed but curious |
| 19 | `shiomi_deduce` | 矛盾をつく、金庫、犯人の指名 | tense jazz, walking bass, staccato piano, detective closing in, building suspense |
| 21 | `shiomi_ending` | エンディング、結果画面 | slow jazz ballad, piano and bass, case closed, calm night at the harbor |

### 最後のページ（隠しエピローグ）

作品の色：三部作の空気をまとめるピアノ独奏。作品選択の画面にも使う。

| 優先 | 名前 | 流れる場所 | 指示文 |
|---|---|---|---|
| 4 | `epilogue_daily` | 作品選択の画面、タイトル、第1〜4章の訪ね歩き | solo piano, gentle and reflective, autumn, visiting old memories, warm and quiet, slow tempo |
| 15 | `epilogue_memory` | 手紙・日記・軍事郵便を読む場面 | solo piano with soft cello, reading old letters, nostalgic, tender, slow |
| 20 | `epilogue_ending` | 第5章 浜で志乃の手紙を読む場面と、最後の3行 | piano and strings, emotional finale, sea at sunset, hope after long sorrow, gentle crescendo then calm |

## 使い回しの案（ダウンロード数が足りないとき）

- `shiomi_ending` → `shiomi_daily` を流す
- `epilogue_memory` → `epilogue_daily` を流す
- `kamomejima_ending` などの各作品の ending → その作品の daily をゆっくり終わらせる

## 効果音

Suno は短い効果音には向かない。足音・選択音・手帳の更新音は、こちらで作った試作（冬の汐見の足音、ピアノの選択音と更新音）を叩き台にする。足りなければ魔王魂などのフリー素材で差し替える。
