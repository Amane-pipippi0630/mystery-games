# 音の素材

## BGM（OpenTracks（旧DOVA-SYNDROME））

[OpenTracks の音源利用ライセンス](https://opentracks.com/help/articles/license/)に従って使っています。クレジット表記は不要ですが、感謝をこめて記します。

ライセンスの禁止事項（エンドユーザーが音源ファイルを簡単に取り出せる状態での利用）に合わせて、mp3 を m4a（AAC）に変換し、作品選択とタイトル画面に「音源の抜き出し・転用・再配布は禁止」と書いています。編集は、頭と終わりの無音を切る・ループ用に終わりと頭を重ねる・音量をそろえる、だけです。

| ファイル | 曲 | 作曲 | 使う場所 |
|---|---|---|---|
| `common_deduce` | [strange lullaby](https://opentracks.com/bgm/detail/20649) | shimtone | 全作品：推理の場面 |
| `common_incident` | [Falling](https://opentracks.com/bgm/detail/21530) | のる | 全作品：事件の場面 |
| `kamomejima_daily` | [消えた絵画](https://opentracks.com/bgm/detail/15476) | MATSU | 鴎島館の論理：捜査 |
| `kamomejima_confront` | [Labyrinth](https://opentracks.com/bgm/detail/21926) | のる | 鴎島館の論理：第8章 |
| `kamomejima_ending` | [想いが形づくるモノ](https://opentracks.com/bgm/detail/11184) | sakunoken | 鴎島館の論理：エンディング |
| `furiko_daily` | [ありふれた日の一頁](https://opentracks.com/bgm/detail/22666) | のる | 振り子の止まる夜：捜査 |
| `furiko_confront` | [Repentance](https://opentracks.com/bgm/detail/19957) | Heitaro Ashibe | 振り子の止まる夜：第8章 |
| `furiko_ending` | [優しくなれたら](https://opentracks.com/bgm/detail/23612) | 蒲鉾さちこ | 振り子の止まる夜：エンディング |
| `fuyu_daily` | [捜査会議](https://opentracks.com/bgm/detail/13973) | 田中芳典 | 冬の汐見：捜査 |
| `fuyu_confront` | [Casablanca](https://opentracks.com/bgm/detail/1771) | 稿屋 隆 | 冬の汐見：第8章 |
| `fuyu_final` | [深々と、降る。](https://opentracks.com/bgm/detail/21570) | のる | 冬の汐見：第8章の推理 |
| `fuyu_ending` | [lost memories](https://opentracks.com/bgm/detail/19610) | のる | 冬の汐見：エンディング |
| `epilogue_daily` | [或る雨の夜](https://opentracks.com/bgm/detail/23966) | のる | 最後のページ：訪ね歩き |
| `epilogue_ending` | [懐かしい物語](https://opentracks.com/bgm/detail/3954) | t.tam | 最後のページ：第5章とエンディング |
| `shiomi_daily` | [情報屋](https://opentracks.com/bgm/detail/22801) | Heitaro Ashibe | 汐見港殺人事件：捜査 |
| `shiomi_ending` | [いつか街で偶然出会っても](https://opentracks.com/bgm/detail/14348) | ハモおた | 汐見港殺人事件：エンディング |

蒲鉾さちこさん・ハモおたさんは独自の利用条件（AI学習・再配布・大幅な改変の禁止）があり、この使い方はその範囲内です。

## 環境音（冬の汐見・OpenTracks の効果音）

同じライセンスで使っています。m4a に変換し、ループ用に終わりと頭を重ねる・音量をそろえる・いくつかを重ねる、だけの編集です。

| ファイル | 素材 | 制作 | 使う場所 |
|---|---|---|---|
| `amb_train` | [電車輪](https://opentracks.com/se/detail/182) | 稿屋 隆 | 冬の汐見：東京駅・車掌区 |
| `amb_fuyu_wind` | [木枯らし・風に吹かれる落ち葉](https://opentracks.com/se/detail/965) | Causality Sound | 冬の汐見：物干し場・屋台・町工場 |
| `amb_harbor_winter` | [砂浜の波の音](https://opentracks.com/se/detail/1337)（Hupple）＋[霧笛](https://opentracks.com/se/detail/425)（稿屋 隆） | | 冬の汐見：磯辺町・戸川家・かもめ・浜屋・佐伯家の墓・汐見の浜 |
| `amb_fuyu_temple` | 木枯らし（上）＋[除夜の鐘の音](https://opentracks.com/se/detail/1136)（NaruIDEA） | | 冬の汐見：信州の寺 |

冬の汐見の屋内（署・新聞社・役所・会社・宿・下宿など）は、環境音なし。

## 環境音・効果音（そのほかの `amb_*`・`se_*`）

プログラムで合成したもの（雑音・正弦波の組み合わせ）。選択音と手帳の更新音のピアノは、[midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) の FluidR3_GM（MIT）の単音を使っています。
