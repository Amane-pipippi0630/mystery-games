# BGMと環境音の叩き台

場面の空気は**環境音**で出し、BGMはその上に薄く流す。BGMは Suno で**15曲**作り、環境音はこちらでプログラムから作る。曲を作ったらチャットに添付してください。ループの切り出し・音量そろえ・組み込みはこちらで行います。

## 音の重ね方

| 場面 | BGM | 環境音 |
|---|---|---|
| 捜査（調べる・聞く・移動） | 小さめ（環境音が主役） | その場所の音 |
| 事件発生 | 共通の「事件」 | その場所の音を残す |
| 推理（矛盾をつく・謎解き・推理ボード・指名） | 共通の「推理」 | 止める |
| 対峙（解決編・告白） | 直前に**すべての音を一度止め**、間をおいて作品の「対峙」 | 止める |
| エンディング | 作品の「エンディング」 | 浜の波など、最後の場所の音を薄く |

## 先に確認すること（Suno のライセンスとダウンロード数）

- 無料プランで作った曲は**非商用のみ**で、所有権は Suno に残る。有料プラン（Pro・Premier）で作った曲には商用利用の権利がつく。あとから有料にしても、無料で作った曲にはさかのぼらない。
- 2026年9月3日から、ダウンロードに月の上限がある（Pro 20曲、Premier 60曲。無料プランはダウンロードなしと報じられている）。**15曲なので Pro の1か月に収まる**。
- 生成は何回してもよい。Suno の画面で聞いて、使うものだけダウンロードする。
- 出典：[Suno ヘルプ：Rights & Ownership](https://help.suno.com/en/categories/550145)、[Suno：ダウンロードと利用規約の更新](https://about.suno.com/blog/suno-updates-tos)

## BGM（Suno で作る15曲）

### 共通のルール

- **Instrumental（歌なし）**にする
- 長さは**1分半〜3分**。前奏と後奏はこちらで切るので、そのままでよい
- 形式は mp3 でよい。ファイル名は下の「名前」（例：`kamomejima_daily.mp3`）
- 音量の差はこちらでそろえる
- 捜査の曲は環境音の下で長く流れる。耳につくメロディ、急な盛り上がり、ドラムの強い曲は避ける

**共通部分（すべての指示文の頭につける）**
> instrumental, background music for a japanese mystery adventure game, no vocals, seamless loop, steady dynamics

### 一覧

優先は、作る順番の目安（1がいちばん先）。

| 優先 | 名前 | 流れる場所 | 指示文（共通部分のあとにつける） |
|---|---|---|---|
| 1 | `common_deduce` | 全作品：矛盾をつく、謎解き、推理ボード、犯人の指名 | thoughtful piano ostinato, pizzicato strings, logical puzzle solving, focused, gradually building tension, minor key, timeless acoustic sound |
| 2 | `common_incident` | 全作品：遺体の発見など、事件が起きる場面 | tense strings tremolo, low piano clusters, suspense, discovery of a crime, dark minor key, sparse, timeless acoustic sound |
| 3 | `kamomejima_daily` | 鴎島：タイトル、捜査 | chamber music, piano and string quartet, light harpsichord, elegant old western mansion on a stormy island, mysterious and calm, minor key, slow tempo |
| 4 | `furiko_daily` | 振り子：タイトル、捜査 | minimal piano, soft clarinet, quiet winter night in old tokyo, melancholic, minor key, slow tempo |
| 5 | `fuyu_daily` | 冬の汐見：タイトル、捜査 | cello and piano, soft accordion, 1950s japanese film noir, winter harbor town, nostalgic, minor key, slow tempo |
| 6 | `epilogue_daily` | 作品選択の画面、エピローグのタイトルと訪ね歩き、手紙を読む場面 | solo piano, gentle and reflective, autumn, visiting old memories, warm and quiet, slow tempo |
| 7 | `kamomejima_confront` | 鴎島：第8章 解決編と圭の告白 | dramatic string quartet, cello lead, tragic and solemn, slow build, minor key |
| 8 | `furiko_confront` | 振り子：第8章 千鶴の告白と蒼の指名 | solo piano and cello, emotional confession, grief and tenderness, slow, minor key |
| 9 | `fuyu_confront` | 冬の汐見：第8章 浜で佐伯と向き合う | dramatic low strings and timpani, solo harmonica, winter sea at dusk, tragic, solemn, minor key |
| 10 | `kamomejima_ending` | 鴎島：第8章の終わり、結果画面 | gentle solo piano with soft strings, morning after the storm, bittersweet, calm resolution |
| 11 | `furiko_ending` | 振り子：第8章の終わり、結果画面 | music box style melody with piano, old pendulum clock, warm and sad, gentle |
| 12 | `fuyu_ending` | 冬の汐見：第8章 冬の海へ歩いていく場面、結果画面 | solo harmonica with soft strings, lonely and quiet, showa era, bittersweet |
| 13 | `epilogue_ending` | エピローグ：第5章 浜で志乃の手紙を読む場面と、最後の3行 | piano and strings, emotional finale, sea at sunset, hope after long sorrow, gentle crescendo then calm |
| 14 | `shiomi_daily` | 番外編：タイトル、捜査 | cool jazz, piano trio, upright bass, brushed drums, detective investigation in a seaside town, relaxed but curious |
| 15 | `shiomi_ending` | 番外編：エンディング、結果画面 | slow jazz ballad, piano and bass, case closed, calm night at the harbor |

- 共通の2曲は、昭和の場面にも現代の場面にも合うよう、電子楽器を入れない（指示文の `timeless acoustic sound`）。
- 共通にした代わりに、作品ごとの違いは環境音で出す。

## 環境音（こちらで作る12種）

雑音と短い音の組み合わせから、プログラムで作る。BGMより下の音量で、場所ごとに切り替える。

| 名前 | 音 | 使う場所 |
|---|---|---|
| `amb_storm_in` | こもった雨と風、ときどき遠雷 | 鴎島：玄関ホール、談話室、客室、大食堂、西棟の廊下、書庫、執事室、浅見の客室、乾燥室 |
| `amb_storm_out` | 強い雨風と荒れた波 | 鴎島：連絡船、久我館・正面、灯台の崖 |
| `amb_calm_sea` | 静かな波と弱い風 | 鴎島：汐見港・連絡船乗り場、テラス（第8章） |
| `amb_clocks` | いくつもの振り子時計のチクタク、ときどき時報 | 振り子：時計店の店・作業場・居間。エピローグ：時雨町・宮下時計店 |
| `amb_winter_night` | 冬の夜の風、遠くを走る車 | 振り子：隅田川・堤防下の道、裏の路地、車両保管所、長尾のマンション |
| `amb_room` | 低い空調の音（ほぼ無音） | 振り子：捜査本部、研究室、町会会館、コンビニ、喫茶。番外編の屋内すべて。エピローグ：陽の部屋、黒田邸、野々村家 |
| `amb_harbor_winter` | 冬の波と強い風、遠い汽笛 | 冬の汐見：汐見の浜、磯辺町、戸川家、かもめ、浜屋、佐伯家の墓。エピローグ：磯辺町、佐伯家の墓、汐見の浜 |
| `amb_showa_town` | すきま風、遠くの電車の音 | 冬の汐見：千鳥屋、屋台、源次の下宿、町工場、権藤の金融 |
| `amb_showa_office` | 石油ストーブの小さな音、柱時計 | 冬の汐見：汐見署、汐見日報、市役所、警視庁、久我海運の各部屋、久我邸、大阪支店、ホテル浪速。エピローグ：汐見署、磯村の下宿 |
| `amb_train` | 列車の走行音のリズム | 冬の汐見：東京駅・車掌区。第5章の時刻表の謎 |
| `amb_temple` | 山の風、遠い鐘 | 冬の汐見：信州・寺。エピローグ：寺の本堂、墓地 |
| `amb_harbor_now` | おだやかな波と風 | 番外編：汐見水産。エピローグ：汐見の浜（第5章） |

**プログラムでは作りにくい音**：カモメの声、人のざわめき、話し声。必要なら OpenTracks（旧DOVA-SYNDROME）などの効果音素材で足す。この作品はWebページなので、プレイヤーが音のファイルを取り出せてしまう。OpenTracks を使うときは、作品側に「音源の抜き出し・転用禁止」の一文を入れる。

## 効果音（こちらで作る）

試作の3つ（足音、ピアノの選択音、手帳の更新音）を叩き台にする。足音は場所で変える（館の床、雪まじりの砂利、アスファルト）。
