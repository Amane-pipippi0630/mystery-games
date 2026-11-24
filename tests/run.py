#!/usr/bin/env python3
"""エンジンとゲームの動作テスト（Playwright）。

  python3 tools/build.py shiomi-port && python3 tools/build.py tests/fixtures/mini
  python3 tests/run.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHIOMI = (ROOT / "games/shiomi-port/index.html").as_uri()
MINI = (ROOT / "tests/fixtures/mini/index.html").as_uri()
EXTRAS = (ROOT / "tests/fixtures/extras/index.html").as_uri()
HUB = (ROOT / "index.html").as_uri()
KAMO = (ROOT / "games/kamomejima/index.html").as_uri()
FURI = (ROOT / "games/furiko/index.html").as_uri()
FUYU = (ROOT / "games/fuyu-shiomi/index.html").as_uri()
EPI = (ROOT / "games/epilogue/index.html").as_uri()
results = []


def test(fn):
    results.append(fn)
    return fn


def page(b, url):
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page()
    errs, reqs = [], []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("request", lambda r: reqs.append(r.url))
    pg.goto(url)
    pg.wait_for_selector("#title:not(.hide)")
    pg.errs, pg.reqs = errs, reqs
    return pg


def click(pg, *names):
    for n in names:
        pg.locator("#cmd button", has_text=n).first.click()


def msg(pg):
    pg.locator("#msgbox").click()  # 文字送りを終わらせる
    return pg.locator("#msg").inner_text()


def contra(pg, a, b):
    """手帳を開き、文に a・b を含むカードを選んでつきつける"""
    click(pg, "手帳"); pg.click("#nbook .nb-tabs >> text=証言カード")
    pg.click("#nbook .nb-contra >> text=矛盾をつく")
    for t in (a, b):
        pg.locator("#nbook .nb-entry", has_text=t).first.click()
    pg.click("#nbook .nb-contra >> text=つきつける")


def state(pg):
    return pg.evaluate("window.__mg.state")


def new_shiomi(b):
    pg = page(b, SHIOMI)
    pg.click("text=はじめから")
    pg.click("#bGo")
    return pg


@test
def shiomi_clear(b):
    """汐見港殺人事件を最短手順でクリアできる"""
    pg = new_shiomi(b)
    click(pg, "調べる", "薬瓶"); click(pg, "調べる", "机")
    click(pg, "移動", "居間"); click(pg, "聞く", "沙織"); click(pg, "聞く", "沙織"); click(pg, "調べる", "写真立て")
    click(pg, "見せる", "カプセル", "ハル")
    click(pg, "移動", "汐見警察署"); click(pg, "見せる", "カプセル", "大場")
    click(pg, "移動", "書斎"); click(pg, "調べる", "金庫")
    for d in "0714":
        click(pg, d)
    assert "帳簿" in msg(pg)
    click(pg, "移動", "汐見水産"); click(pg, "見せる", "帳簿", "野村")
    click(pg, "移動", "汐見病院"); click(pg, "見せる", "カプセル", "薬剤師")
    click(pg, "移動", "汐見警察署"); click(pg, "聞く", "大場")
    assert "report" in state(pg)["items"]
    click(pg, "移動", "片桐法律事務所")
    for _ in range(3):
        click(pg, "聞く", "片桐")
    contra(pg, "何も関わっていない", "病院からもらってきた")
    assert state(pg)["f"].get("contra_lie") == 1
    st = state(pg)
    assert any("認めた" in c["t"] for c in st["cards"]), st["cards"]          # 新しい証言カード
    assert [c for c in st["cards"] if c.get("id") == "katagiri_lie"][0].get("broken")  # 崩したカード
    click(pg, "推理", "片桐")
    for _ in range(7):
        click(pg, "つぎへ")
    m = msg(pg)
    assert "評価：名警部" in m, m
    assert "shiomi-port" in pg.evaluate("JSON.parse(localStorage.getItem('mg:cleared'))")
    return pg.errs


@test
def no_network_while_playing(b):
    """背景は起動時に読み込み済みで、遊んでいる間は通信しない"""
    pg = page(b, SHIOMI)
    assert sum(".webp" in u for u in pg.reqs) == 8, pg.reqs
    assert pg.evaluate("[...document.querySelectorAll('#loading')].every(e => e.classList.contains('hide'))")
    before = len(pg.reqs)
    pg.click("text=はじめから"); pg.click("#bGo")
    for place in ["居間", "汐見警察署", "汐見水産", "書斎"]:
        click(pg, "移動", place)
        pg.wait_for_function("document.querySelector('#bg img') && document.querySelector('#bg img').complete")
    after = [u for u in pg.reqs[before:] if not u.startswith("data:")]
    assert after == [], after
    return pg.errs


def move_options(pg):
    click(pg, "移動")
    opts = pg.locator("#cmd button").all_inner_texts()
    click(pg, "もどる")
    return opts


@test
def unlock_once(b):
    """片桐法律事務所は汐見水産で知るまで行けず、「行けるようになった」は1回だけ出る"""
    pg = new_shiomi(b)
    click(pg, "調べる", "薬瓶"); click(pg, "移動", "居間"); click(pg, "見せる", "カプセル", "ハル")
    opts = move_options(pg)
    assert "汐見病院・薬局" in opts and "片桐法律事務所" not in opts, opts
    click(pg, "調べる", "写真立て")  # 何も開かない行動
    click(pg, "移動", "汐見水産")
    for _ in range(5):
        click(pg, "聞く", "秘書の野村")
    click(pg, "調べる", "社長室")
    assert "片桐法律事務所" in move_options(pg)
    log = pg.evaluate("window.__mg.toastLog")
    assert log.count("片桐法律事務所に行けるようになった") == 1, log
    assert log.count("汐見病院・薬局に行けるようになった") == 1, log
    return pg.errs


@test
def contradiction(b):
    """矛盾をつく：まちがえるとミス、相手がいない場所では使えず、片桐の前でつきつけると崩せる"""
    pg = new_shiomi(b)
    click(pg, "調べる", "薬瓶"); click(pg, "調べる", "遺体の跡")
    click(pg, "移動", "居間"); click(pg, "見せる", "カプセル", "ハル")
    click(pg, "移動", "汐見水産"); click(pg, "調べる", "社長室")
    click(pg, "移動", "片桐法律事務所")
    for _ in range(3):
        click(pg, "聞く", "片桐")
    contra(pg, "胸をおさえて", "金曜の欄")
    assert state(pg)["v"]["miss"] == 1
    click(pg, "移動", "書斎")
    contra(pg, "何も関わっていない", "病院からもらってきた")
    assert "法律事務所へ" in msg(pg) and state(pg)["v"]["miss"] == 1
    assert not state(pg)["f"].get("contra_lie")
    click(pg, "移動", "片桐法律事務所")
    contra(pg, "病院からもらってきた", "何も関わっていない")
    assert state(pg)["f"].get("contra_lie") == 1
    contra(pg, "病院からもらってきた", "何も関わっていない")
    assert "もう崩しました" in msg(pg) and state(pg)["v"]["miss"] == 1
    return pg.errs


@test
def assistant_points_to_unheard(b):
    """マコトに聞くと、この場所でまだ大事な話を聞いていない人を教えてくれる"""
    pg = new_shiomi(b)
    click(pg, "移動", "居間")
    click(pg, "聞く", "マコト")
    m = msg(pg)
    assert "沙織さんはまだ何か知っていそう" in m, m
    for _ in range(2):
        click(pg, "聞く", "沙織")
    click(pg, "聞く", "マコト")
    assert "ハルさんはまだ何か知っていそう" in msg(pg)
    for _ in range(4):
        click(pg, "聞く", "ハル")
    click(pg, "聞く", "マコト")
    m = msg(pg)
    assert "知っていそう" not in m, m  # 残っていなければ、ふだんのヒントに戻る
    assert pg.locator("#cmd button.new, #here span.new").count() == 0
    return pg.errs


@test
def hint_hospital(b):
    """先に汐見水産で片桐の名前を知っても、マコトは病院より先に「ハルに薬を見せる」よう言う"""
    pg = new_shiomi(b)
    click(pg, "調べる", "薬瓶"); click(pg, "移動", "汐見警察署"); click(pg, "見せる", "カプセル", "大場")
    click(pg, "移動", "居間")
    for _ in range(4):
        click(pg, "聞く", "ハル")
    for _ in range(3):
        click(pg, "聞く", "沙織")
    click(pg, "移動", "書斎"); click(pg, "調べる", "金庫")
    for d in "0714":
        click(pg, d)
    click(pg, "移動", "汐見水産"); click(pg, "調べる", "社長室")
    for _ in range(3):
        click(pg, "聞く", "秘書の野村")
    assert state(pg)["f"].get("know_katagiri") and not state(pg)["f"].get("katagiri_med")
    click(pg, "聞く", "マコト")
    m = msg(pg)
    assert "ハルさんに見せて" in m, m
    assert "汐見病院・薬局" not in move_options(pg)
    return pg.errs


@test
def shiomi_wrong_and_missing(b):
    """推理には話を聞いた人だけが出る。証拠が足りないときは足りないものを明かさない。疑いの晴れた人を選ぶとミス"""
    pg = new_shiomi(b)
    click(pg, "推理")
    assert "だれにも話を聞いていない" in msg(pg)
    click(pg, "移動", "居間"); click(pg, "聞く", "沙織"); click(pg, "聞く", "沙織")
    click(pg, "推理")
    opts = pg.locator("#cmd button").all_inner_texts()
    assert "沙織" in opts and "片桐" not in opts and "ハル" not in opts, opts
    click(pg, "もどる")
    click(pg, "移動", "汐見水産")
    for _ in range(3):
        click(pg, "聞く", "秘書の野村")
    click(pg, "移動", "片桐法律事務所"); click(pg, "聞く", "片桐")
    click(pg, "移動", "雀荘"); click(pg, "聞く", "隆")
    click(pg, "推理", "片桐")
    m1 = msg(pg)
    assert "まだそろっていません" in m1 and "動機" not in m1 and "鑑定" not in m1, m1
    click(pg, "推理", "隆")
    m2 = msg(pg)
    assert m2.replace("隆", "片桐") == m1, (m1, m2)  # 片桐だけ反応が違うと犯人が分かってしまう
    assert state(pg)["v"]["miss"] == 0
    click(pg, "推理", "沙織")
    assert state(pg)["v"]["miss"] == 1
    return pg.errs


@test
def save_and_load(b):
    """スロットにセーブしてロードすると、その時点に戻る"""
    pg = new_shiomi(b)
    click(pg, "調べる", "机")
    pg.click("#menu"); pg.click("#modal .row:has-text('セーブ')"); pg.click("#modal .row:has-text('スロット1')")
    click(pg, "調べる", "薬瓶")
    assert len(state(pg)["items"]) == 2
    pg.click("#menu"); pg.click("#modal .row:has-text('ロード')"); pg.click("#modal .row:has-text('スロット1')")
    assert state(pg)["items"] == ["memo"]
    return pg.errs


@test
def autosave_resume(b):
    """ページを開き直すと「つづきから」で再開できる"""
    pg = new_shiomi(b)
    click(pg, "移動", "居間")
    pg.reload()
    pg.click("text=つづきから")
    assert state(pg)["loc"] == "living"
    return pg.errs


@test
def chapters(b):
    """章が切り替わり、章のはじめが保存される"""
    pg = page(b, MINI)
    pg.click("text=はじめから")
    assert pg.locator("#card").inner_text().startswith("第一章")
    pg.click("#card")
    click(pg, "聞く", "助手A"); click(pg, "聞く", "助手A"); click(pg, "聞く", "助手A")
    assert "二回目以降" in msg(pg)
    click(pg, "調べる", "箱"); click(pg, "つぎへ")
    assert "第二章" in pg.locator("#card").inner_text()
    pg.click("#card")
    assert "箱から鍵" in pg.locator("#modal .recap").inner_text()  # これまでの話
    pg.click("#modal >> text=つづける")
    assert state(pg)["chapter"] == "ch2"
    assert pg.evaluate("!!localStorage.getItem('mg:test-mini:chap:ch2')")
    click(pg, "聞く", "犯人X")
    click(pg, "推理", "A")
    assert state(pg)["v"]["miss"] == 1
    click(pg, "推理", "X"); click(pg, "つぎへ")
    assert "完 OK" in msg(pg)
    return pg.errs


@test
def notebook(b):
    """捜査手帳：証言カード、ピン留め、会話ログの絞り込みと検索、メモ"""
    pg = new_shiomi(b)
    click(pg, "聞く", "マコト")
    click(pg, "移動", "居間"); click(pg, "聞く", "ハル"); click(pg, "聞く", "ハル"); click(pg, "聞く", "沙織")
    st = state(pg)
    assert len(st["cards"]) == 3, st["cards"]
    assert pg.locator("#nbn").inner_text() == "3"
    click(pg, "手帳")
    assert pg.locator("#nbook .nb-entry").count() == 3
    assert pg.locator("#nbn").inner_text() == ""  # 見たらバッジが消える
    pg.locator("#nbook .nb-entry .pin").first.click()
    assert state(pg)["cards"][0]["pin"] is True
    pg.click("#nbook .nb-tabs >> text=会話ログ")
    pg.select_option("#nbook select[data-k=who]", "ハル")
    assert pg.locator("#nbook .nb-entry").count() == 2
    pg.select_option("#nbook select[data-k=who]", "")
    pg.fill("#nbook input[type=search]", "書斎")
    n = pg.locator("#nbook .nb-entry").count()
    assert n >= 1 and all("書斎" in t for t in pg.locator("#nbook .nb-entry .txt").all_inner_texts())
    pg.click("#nbook .nb-tabs >> text=メモ")
    pg.fill("#memo", "Kは誰？")
    pg.wait_for_timeout(600)
    pg.click("#nbook .nb-x")
    pg.reload(); pg.click("text=つづきから")
    assert state(pg)["memo"] == "Kは誰？"
    assert state(pg)["cards"][0]["pin"] is True
    return pg.errs


def hub_page(b):
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page(); pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    pg.goto(HUB)
    return pg


@test
def hub(b):
    """作品選択：遊べる作品へ移動して戻れる。クリアで⭐️、続きがあれば「つづきあり」"""
    pg = hub_page(b)
    assert pg.locator(".game").count() == 4
    assert pg.locator(".game[data-id=epilogue]").count() == 0
    assert pg.locator(".game.soon").count() == 0  # 三部作はすべて遊べる
    pg.click(".game[data-id=shiomi-port]")
    pg.wait_for_selector("#title:not(.hide)")
    pg.click("text=はじめから"); pg.click("#bGo"); click(pg, "移動", "居間")
    pg.click("#menu"); pg.click("#modal .row:has-text('タイトルへ')")
    pg.click("text=作品選択へ")
    pg.wait_for_selector(".game")
    assert "つづきあり" in pg.locator(".game[data-id=shiomi-port]").inner_text()
    assert pg.locator(".game[data-id=shiomi-port] .clear").count() == 0
    pg.evaluate("localStorage.setItem('mg:cleared', JSON.stringify(['shiomi-port']))"); pg.reload()
    assert pg.locator(".game[data-id=shiomi-port] .clear").count() == 1
    assert "1 / 4" in pg.locator(".stat").inner_text()
    return pg.errs


@test
def hub_epilogue(b):
    """三部作を1つクリアすると隠しエピローグが「？？？」で見え、全部クリアで開く"""
    pg = hub_page(b)
    pg.evaluate("localStorage.setItem('mg:cleared', JSON.stringify(['kamomejima']))"); pg.reload()
    e = pg.locator(".game[data-id=epilogue]")
    assert e.count() == 1 and "locked" in e.get_attribute("class") and "1/3" in e.inner_text()
    pg.evaluate("localStorage.setItem('mg:cleared', JSON.stringify(['kamomejima','furiko','fuyu-shiomi']))"); pg.reload()
    e = pg.locator(".game[data-id=epilogue]")
    assert "locked" not in e.get_attribute("class") and "最後のページ" in e.inner_text()
    return pg.errs


def ask(pg, who, topic="いまのこと", n=1):
    for _ in range(n):
        click(pg, "聞く", who, topic)


@test
def kamomejima_ch1(b):
    """鴎島館 第1章：話題を選んで聞き、取材ノートが5件たまると宴、港から停電まで通して遊べる"""
    pg = page(b, KAMO)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    ask(pg, "鷹宮", "相談する")
    assert "三島さん、まだ何か話してくれそう" in msg(pg)  # 聞き残しがあれば先に教える
    ask(pg, "三島", n=3); ask(pg, "三島", "創業者のこと", 3)
    assert len(state(pg)["notes"]) == 3
    click(pg, "移動", "連絡船の上"); click(pg, "調べる", "鴎島")
    click(pg, "移動", "久我館・正面"); ask(pg, "磯村")
    ask(pg, "鷹宮", "相談する")
    assert "磯村さん、まだ何か話してくれそう" in msg(pg)  # 聞き残しの案内は1人1回
    ask(pg, "鷹宮", "相談する")
    m0 = msg(pg); assert "雨が降ってきた" in m0, m0  # その次はぼかしたヒント
    ask(pg, "鷹宮", "相談する", 2)
    assert "『移動』で玄関ホールへ" in msg(pg)       # 3回目ではっきり
    click(pg, "移動", "玄関ホール")
    ask(pg, "磯村", n=3); ask(pg, "磯村", "創業者のこと", 2); ask(pg, "沙耶", n=3)
    click(pg, "調べる", "肖像画の銘板")
    click(pg, "移動", "客室"); click(pg, "調べる", "旅行かばん")
    click(pg, "移動", "談話室")
    for p in ["康彦", "圭", "玲子"]:
        ask(pg, p)
    assert state(pg)["f"].get("dinner_called"), (state(pg)["f"], state(pg)["notes"])
    click(pg, "つぎへ"); click(pg, "つぎへ")
    click(pg, "移動", "大食堂")
    for _ in range(11):
        click(pg, "つぎへ")
    assert state(pg)["f"].get("dinner_done")
    ask(pg, "タキ"); ask(pg, "浅見", n=2); ask(pg, "磯村", n=2)
    click(pg, "移動", "玄関ホール"); ask(pg, "沙耶")
    click(pg, "移動", "談話室"); ask(pg, "康彦"); ask(pg, "玲子"); ask(pg, "三島", n=2)
    assert state(pg)["f"].get("blackout_ready"), state(pg)["f"]
    ask(pg, "鷹宮", "ミステリー談義")
    for _ in range(11):
        click(pg, "つぎへ")
    assert "第二章" in pg.locator("#card").inner_text()   # 第2章へ続く
    st = state(pg)
    assert len(st["notes"]) == 5 and st["v"]["hints"] == 5, (st["notes"], st["v"])
    return pg.errs


@test
def kamomejima_ch2(b):
    """鴎島館 第2章：書庫を破り、島が孤立し、7人の停電中の居場所と現場を調べると章が終わる"""
    pg = page(b, KAMO)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    pg.evaluate("window.__mg.startChapter('ch2')"); pg.click("#card")
    assert "これまでの話" in pg.locator("#modal").inner_text()
    pg.click("#modal >> text=つづける")
    click(pg, "移動", "西棟の廊下"); ask(pg, "磯村")
    for _ in range(7):
        click(pg, "つぎへ")
    assert state(pg)["f"].get("found")
    click(pg, "調べる", "床のしみ")
    click(pg, "移動", "書庫"); click(pg, "調べる", "閂"); click(pg, "調べる", "革のファイル")
    click(pg, "移動", "玄関ホール"); click(pg, "調べる", "電話")
    click(pg, "移動", "執事室"); ask(pg, "磯村", "停電のあいだ")
    click(pg, "移動", "談話室")
    for p in ["タキ", "康彦", "玲子", "圭", "沙耶", "三島"]:
        ask(pg, p, "停電のあいだ")
    for _ in range(7):
        click(pg, "つぎへ")
    assert "第三章" in pg.locator("#card").inner_text()   # 第3章へ続く
    ids = [c.get("id") for c in state(pg)["cards"]]
    assert "kei_sleep" in ids and "mishima_stay" in ids   # 第3章・第6章の矛盾で使うカード
    assert not pg.evaluate("JSON.parse(localStorage.getItem('mg:cleared') || '[]')").count("kamomejima")
    return pg.errs


@test
def verify_finds_deadend(b):
    """検証ツールは、わざと詰むシナリオの詰みを見つけ、汐見港では問題なしと言う"""
    import subprocess
    v = lambda g: subprocess.run(["python3", str(ROOT / "tools/verify.py"), g], capture_output=True, text=True, timeout=600)
    r = v(str(ROOT / "tests/fixtures/deadend"))
    assert r.returncode == 1 and "✗ 詰み" in r.stdout and "vase" in r.stdout, r.stdout
    r = v("shiomi-port")
    assert r.returncode == 0 and "結果：問題なし" in r.stdout, r.stdout
    return []


@test
def kamomejima_ch3(b):
    """鴎島館 第3章：講義、浅見の客室、書庫が無人だったこと、三島のうそ（矛盾）、本棚の血で章が終わる"""
    pg = page(b, KAMO)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    # 第2章で手に入る三島のカードを持っている状態で、第3章を始める
    pg.evaluate("""() => { const S = window.__mg.state; S.cards.push({ id: 'mishima_stay', c: 'ch2', l: 'salon', p: 'mishima', t: '停電中は談話室から一歩も出ていない', pin: false });
      window.__mg.startChapter('ch3'); }""")
    pg.click("#card"); pg.click("#modal >> text=つづける")
    ask(pg, "鷹宮")
    for _ in range(9):
        click(pg, "つぎへ")
    assert state(pg)["f"].get("lecture")
    click(pg, "移動", "浅見の客室"); click(pg, "調べる", "浅見のかばん")
    click(pg, "移動", "談話室"); ask(pg, "玲子"); ask(pg, "玲子", "停電のあいだ")
    contra(pg, "談話室から一歩も出ていない", "手洗いに")
    st = state(pg)
    assert st["f"].get("contra_m2") and any(c.get("id") == "mishima_confess" for c in st["cards"])
    click(pg, "移動", "書庫"); click(pg, "調べる", "右の本棚")
    for _ in range(7):
        click(pg, "つぎへ")
    assert "第四章" in pg.locator("#card").inner_text()   # 第4章へ続く
    return pg.errs


@test
def kamomejima_ch4(b):
    """鴎島館 第4章：図面・磯村のうそ（矛盾）・隠し金庫・小箱の番号（1946）・手帳・三島のメモ"""
    pg = page(b, KAMO)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    pg.evaluate("window.__mg.startChapter('ch4')"); pg.click("#card"); pg.click("#modal >> text=つづける")
    click(pg, "調べる", "右の本棚")
    click(pg, "移動", "玄関ホール"); ask(pg, "沙耶", "館と島のこと")
    click(pg, "移動", "執事室"); ask(pg, "磯村", "館と島のこと")
    contra(pg, "書庫には何もない", "空洞")
    assert state(pg)["f"].get("contra_m3")
    click(pg, "移動", "書庫"); click(pg, "調べる", "右の本棚")
    click(pg, "移動", "隠し金庫"); click(pg, "調べる", "隠し金庫")
    assert "will" in state(pg)["items"]
    click(pg, "調べる", "小箱")
    for d in "1950":
        click(pg, d)
    assert "開かない" in msg(pg)
    click(pg, "調べる", "小箱")
    for d in "1946":
        click(pg, d)
    assert "techou" in state(pg)["items"]
    click(pg, "調べる", "小箱")
    for _ in range(9):
        click(pg, "つぎへ")
    assert state(pg)["f"].get("techou_read")
    click(pg, "移動", "談話室"); ask(pg, "三島")
    for _ in range(9):
        click(pg, "つぎへ")
    assert "第五章" in pg.locator("#card").inner_text()   # 第5章へ続く
    return pg.errs


@test
def kamomejima_ch5(b):
    """鴎島館 第5章：崖で康彦を見つけ、メモ・濡れた雨具・通用口の鍵・6人の昨夜の居場所で章が終わる"""
    pg = page(b, KAMO)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    pg.evaluate("window.__mg.startChapter('ch5')"); pg.click("#card"); pg.click("#modal >> text=つづける")
    click(pg, "移動", "灯台の崖"); ask(pg, "磯村")
    for _ in range(6):
        click(pg, "つぎへ")
    assert state(pg)["f"].get("carried")
    click(pg, "調べる", "康彦の雨具")
    assert "memo2" in state(pg)["items"]
    click(pg, "移動", "乾燥室"); click(pg, "調べる", "雨具")
    click(pg, "移動", "執事室"); ask(pg, "磯村", "昨夜のこと")
    click(pg, "移動", "談話室")
    for p in ["タキ", "玲子", "圭", "沙耶", "三島"]:
        ask(pg, p, "昨夜のこと")
    for _ in range(7):
        click(pg, "つぎへ")
    assert "第六章" in pg.locator("#card").inner_text()   # 第6章へ続く
    return pg.errs


@test
def kamomejima_ch6_to_end(b):
    """鴎島館 第6〜8章：手帳の謎を切り分け、圭のうそ（矛盾）、内線の記録、推理ボード、指名、解決編、クリアで⭐️"""
    pg = page(b, KAMO)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    # 第2章で手に入る圭のカードを持って第6章を始める
    pg.evaluate("""() => { const S = window.__mg.state; S.cards.push({ id: 'kei_sleep', c: 'ch2', l: 'salon', p: 'kei', t: '停電中は本館2階の自室で寝ていた。停電にも気づかなかった', pin: false });
      ['taki','reiko','kei','saya','isomura','mishima'].forEach(p => S.seq['talk:' + p] = 1);
      window.__mg.startChapter('ch6'); }""")
    pg.click("#card"); pg.click("#modal >> text=つづける")
    ask(pg, "鷹宮")
    for _ in range(4):
        click(pg, "つぎへ")
    ask(pg, "三島")
    click(pg, "移動", "執事室"); ask(pg, "磯村"); click(pg, "調べる", "内線の交換台")
    click(pg, "移動", "玄関ホール"); ask(pg, "沙耶"); ask(pg, "沙耶", "停電のあいだ")
    click(pg, "移動", "大食堂")
    contra(pg, "自室で寝ていた", "誰もいなかった")
    assert state(pg)["f"].get("contra_m1")
    click(pg, "移動", "談話室")
    for _ in range(5):
        click(pg, "つぎへ")
    # 第7章：読者への挑戦 → 推理ボード
    pg.click("#card"); pg.click("#modal >> text=つづける")
    for _ in range(5):
        click(pg, "つぎへ")
    pg.wait_for_selector("#modal .board")
    for label in ["手帳を探していた", "書庫の資料"]:              # まちがった条件 → 三島ひとり
        pg.click(f"#modal .board .row:has-text('{label}')")
    assert pg.locator("#modal .b-sus span:not(.out)").all_inner_texts() == ["三島"]
    pg.click("#modal >> text=この条件で推理する")
    assert "ほんまに犯人の条件か" in msg(pg) and state(pg)["v"]["miss"] == 1
    ask(pg, "鷹宮")
    for label in ["西棟にいることができた", "遺言書を持っていると知っていた", "存在を知らなかった", "アリバイがない"]:
        pg.click(f"#modal .board .row:has-text('{label}')")
    assert pg.locator("#modal .b-sus span:not(.out)").all_inner_texts() == ["圭"]
    pg.click("#modal >> text=この条件で推理する")
    assert state(pg)["f"].get("board_done")
    click(pg, "推理", "三島")
    assert state(pg)["v"]["miss"] == 2
    click(pg, "推理", "圭"); click(pg, "つぎへ")
    # 終章：解決編
    pg.click("#card"); pg.click("#modal >> text=つづける")
    for _ in range(15):
        click(pg, "つぎへ")
    assert state(pg)["f"].get("solved")
    click(pg, "移動", "客室"); click(pg, "調べる", "鞄")
    click(pg, "移動", "テラス")
    for _ in range(12):
        click(pg, "つぎへ")
    m = msg(pg)
    assert "鴎島館の論理 完" in m and "評価：鋭い推理作家" in m, m
    assert "kamomejima" in pg.evaluate("JSON.parse(localStorage.getItem('mg:cleared') || '[]')")
    return pg.errs


@test
def conditions(b):
    """条件式の評価"""
    pg = page(b, MINI)
    pg.click("text=はじめから"); pg.click("#card")
    r = pg.evaluate("""() => { const c = window.__mg.cond, S = window.__mg.state;
      S.f.a = 1; S.v.n = 3; S.items.push('key');
      return [c('flag:a'), c('!flag:b'), c('flag:a && has:key'), c('flag:b || var:n>=3'),
              c('!(flag:a && flag:b)'), c('var:n==2'), c('here:room'), c('')]; }""")
    assert r == [True, True, True, True, True, False, True, True], r
    bad = pg.evaluate("() => { try { window.__mg.cond('flag:a &&& x'); return false } catch (e) { return true } }")
    assert bad
    return pg.errs


@test
def extras_think_choice_doc(b):
    """考える・選択式の問い・資料タブ・章ごとの助手・記事の検索が動く"""
    pg = page(b, EXTRAS)
    pg.click("text=はじめから"); pg.click("#card")
    assert pg.locator("#cmd button", has_text="推理").count() == 0
    click(pg, "考える"); assert "Xさん" in msg(pg)          # 聞き残しを教える
    click(pg, "考える"); assert "何か足りない" in msg(pg)    # 段階式ヒント
    click(pg, "考える"); assert "Xに聞こう" in msg(pg)
    click(pg, "聞く", "人物X")
    assert "なぜだろう" in msg(pg)
    click(pg, "手帳を見る"); assert "千鶴の手帳" in pg.inner_text("#nbook h3")
    pg.click("#nbook .nb-tabs >> text=資料"); assert "0.4℃" in pg.inner_text("#nbook .nb-body")
    pg.click("#nbook .nb-x")
    click(pg, "まちがい"); assert "ちがう" in msg(pg)
    assert pg.locator("#cmd button", has_text="正解").count() == 1   # もう一度選び直せる
    click(pg, "正解"); click(pg, "つぎへ"); pg.click("#card")
    click(pg, "聞く", "助手A"); assert "Xに聞いてみて" in msg(pg)   # 章ごとの助手
    click(pg, "調べる", "縮刷版")
    pg.fill("#sq", "汐見"); click(pg, "探す"); assert "「汐見」の記事はない" in msg(pg)
    pg.fill("#sq", "久我 海運"); click(pg, "探す"); assert "新社屋" in msg(pg)   # 空白は無視
    assert state(pg)["f"].get("found")
    click(pg, "聞く", "人物X"); click(pg, "推理", "X")
    st = state(pg); assert st["v"]["miss"] == 1 and st["v"]["hints"] == 4, st["v"]
    return pg.errs


@test
def extras_verify(b):
    """検証ツールが考える・選択式の問いを扱える"""
    import subprocess
    r = subprocess.run(["python3", str(ROOT / "tools/verify.py"), str(ROOT / "tests/fixtures/extras")], capture_output=True, text=True)
    assert r.returncode == 0 and "詰みなし" in r.stdout, r.stdout[-800:]
    return []


@test
def furiko_ch1_open(b):
    """振り子 第1章：磯村が手帳を返し、千鶴の視点（考える・推理なし）で始まる"""
    pg = page(b, FURI)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    for _ in range(8):
        click(pg, "つぎへ")
    assert "techou" in state(pg)["items"]
    assert pg.locator("#cmd button", has_text="推理").count() == 0
    click(pg, "考える"); assert "手帳" in msg(pg)
    click(pg, "移動", "2階の居間"); click(pg, "調べる", "ちゃぶ台")
    assert "久我の名前で生きる" in msg(pg)
    return pg.errs


@test
def furiko_ch8_end(b):
    """振り子 第8章：指名→「なぜ」の選び直し→正解でクリア、⭐️が付く"""
    pg = page(b, FURI)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    pg.evaluate("""() => { const m = window.__mg; m.startChapter('ch8');
      const S = m.state; ['chizuru','ao','okuma','tachibana','komatsu'].forEach(p => S.seq['talk:' + p] = 1); }""")
    pg.click("#card"); pg.click("#modal >> text=つづける")
    click(pg, "聞く", "宮下千鶴", "事件のこと"); click(pg, "聞く", "宮下蒼", "事件のこと")
    click(pg, "推理", "蒼"); assert "確かめておくこと" in msg(pg)   # 手帳を見ていない
    click(pg, "移動", "2階の居間"); click(pg, "調べる", "仏壇")
    click(pg, "推理", "千鶴"); assert "18時15分" in msg(pg)
    click(pg, "推理", "蒼")
    for _ in range(8):
        click(pg, "つぎへ")
    click(pg, "祖母を警察に"); assert "自首" in msg(pg)
    click(pg, "長尾を憎んで")
    click(pg, "手帳を最後まで読む")
    for _ in range(30):
        if pg.locator("#cmd button", has_text="タイトルへ").count():
            break
        click(pg, "つぎへ")
    assert "完" in msg(pg)
    assert state(pg)["v"]["miss"] == 2
    assert "furiko" in pg.evaluate("JSON.parse(localStorage.getItem('mg:cleared'))")
    return pg.errs


@test
def fuyu_ch2_search(b):
    """冬の汐見 第2章：切り抜きを三島に見せ、縮刷版を言葉で探すと記事が見つかる"""
    pg = page(b, FUYU)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    pg.evaluate("() => { const m = window.__mg; m.state.items.push('kirinuki', 'photo'); m.startChapter('ch2'); }")
    pg.click("#card"); pg.click("#modal >> text=つづける")
    click(pg, "見せる", "新聞の切り抜き", "三島透"); assert "10月8日" in msg(pg)
    click(pg, "移動", "汐見日報"); click(pg, "調べる", "縮刷版")
    pg.fill("#sq", "東京"); click(pg, "探す"); assert "見つからなかった" in msg(pg)
    pg.fill("#sq", "10月8日"); click(pg, "探す"); assert "新社屋落成" in msg(pg)
    st = state(pg); assert st["f"].get("article") and st["v"]["searches"] == 2
    return pg.errs


@test
def fuyu_ch8_end(b):
    """冬の汐見 第8章：浜で佐伯と話し、指名→「名前」の問い→クリアで⭐️"""
    pg = page(b, FUYU)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    pg.evaluate("""() => { const m = window.__mg; m.startChapter('ch8');
      ['kuga','kuroda','nonomura','gondo','shujin'].forEach(p => m.state.seq['talk:' + p] = 1); }""")
    pg.click("#card"); pg.click("#modal >> text=つづける")
    for _ in range(5):
        click(pg, "つぎへ")
    click(pg, "推理", "久我"); assert "伝えなければ" in msg(pg)
    click(pg, "聞く", "佐伯修", "昭和16年の火事"); click(pg, "聞く", "佐伯修", "引き揚げ船のこと"); click(pg, "聞く", "佐伯修", "2月10日の夜")
    click(pg, "推理", "黒田"); click(pg, "推理", "久我")
    for _ in range(8):
        click(pg, "つぎへ")
    click(pg, "盗んだ"); click(pg, "託された")
    for _ in range(30):
        if pg.locator("#cmd button", has_text="タイトルへ").count():
            break
        click(pg, "つぎへ")
    assert "完" in msg(pg) and state(pg)["v"]["miss"] == 2
    assert "fuyu-shiomi" in pg.evaluate("JSON.parse(localStorage.getItem('mg:cleared'))")
    return pg.errs


@test
def epilogue_clear(b):
    """隠しエピローグ：封筒を届け、汐見の浜で開けると、志乃の手紙で終わる"""
    pg = page(b, EPI)
    pg.click("text=はじめから"); pg.click("#bGo"); pg.click("#card")
    click(pg, "調べる", "祖父の箱"); click(pg, "調べる", "新聞")
    click(pg, "移動", "宮下時計店")
    click(pg, "見せる", "佐伯修の封筒", "宮下千鶴"); assert "もう少し" in msg(pg)
    click(pg, "聞く", "宮下千鶴", "いまのこと"); click(pg, "聞く", "宮下千鶴", "手帳のこと")
    click(pg, "見せる", "佐伯修の封筒", "宮下千鶴")
    for _ in range(6):
        click(pg, "つぎへ")
    pg.click("#card"); pg.click("#modal >> text=つづける")
    click(pg, "聞く", "汐見署の警部", "沖田のこと"); click(pg, "聞く", "マコト", "沖田のこと")
    click(pg, "移動", "佐伯家の墓"); click(pg, "調べる", "墓石")
    click(pg, "移動", "汐見の浜"); click(pg, "調べる", "波打ちぎわ")
    texts = []
    for _ in range(25):
        if pg.locator("#cmd button", has_text="タイトルへ").count():
            break
        texts.append(msg(pg)); click(pg, "つぎへ")
    assert any("毎月来てくれてありがとう" in t for t in texts)
    assert "汐見ミステリー 完" in msg(pg)
    return pg.errs


if __name__ == "__main__":
    import subprocess
    for f in ["tests/fixtures/mini", "tests/fixtures/deadend", "tests/fixtures/extras"]:
        subprocess.run(["python3", str(ROOT / "tools/build.py"), str(ROOT / f)], check=True, capture_output=True)
    ok = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for fn in results:
            try:
                errs = fn(b)
                assert not errs, errs
                print("OK  ", fn.__doc__)
                ok += 1
            except Exception as e:
                print("NG  ", fn.__doc__, "→", repr(e)[:300])
        b.close()
    print(f"{ok}/{len(results)} 件 OK")
    raise SystemExit(0 if ok == len(results) else 1)
