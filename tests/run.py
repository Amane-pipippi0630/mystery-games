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
    pg.click("#nb"); pg.click("#nbook .nb-tabs >> text=証言カード")
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
    click(pg, "しらべる", "薬瓶"); click(pg, "しらべる", "机")
    click(pg, "いどう", "居間"); click(pg, "きく", "沙織"); click(pg, "きく", "沙織"); click(pg, "しらべる", "写真立て")
    click(pg, "みせる", "カプセル", "ハル")
    click(pg, "いどう", "汐見警察署"); click(pg, "みせる", "カプセル", "大場")
    click(pg, "いどう", "書斎"); click(pg, "しらべる", "金庫")
    for d in "0714":
        click(pg, d)
    assert "帳簿" in msg(pg)
    click(pg, "いどう", "汐見水産"); click(pg, "みせる", "帳簿", "野村")
    click(pg, "いどう", "汐見病院"); click(pg, "みせる", "カプセル", "薬剤師")
    click(pg, "いどう", "汐見警察署"); click(pg, "きく", "大場")
    assert "report" in state(pg)["items"]
    click(pg, "いどう", "片桐法律事務所")
    for _ in range(3):
        click(pg, "きく", "片桐")
    contra(pg, "何も関わっていない", "病院からもらってきた")
    assert state(pg)["f"].get("contra_lie") == 1
    click(pg, "すいり", "片桐")
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
        click(pg, "いどう", place)
        pg.wait_for_function("document.querySelector('#bg img') && document.querySelector('#bg img').complete")
    after = [u for u in pg.reqs[before:] if not u.startswith("data:")]
    assert after == [], after
    return pg.errs


def move_options(pg):
    click(pg, "いどう")
    opts = pg.locator("#cmd button").all_inner_texts()
    click(pg, "もどる")
    return opts


@test
def unlock_once(b):
    """片桐法律事務所は汐見水産で知るまで行けず、「行けるようになった」は1回だけ出る"""
    pg = new_shiomi(b)
    click(pg, "しらべる", "薬瓶"); click(pg, "いどう", "居間"); click(pg, "みせる", "カプセル", "ハル")
    opts = move_options(pg)
    assert "汐見病院・薬局" in opts and "片桐法律事務所" not in opts, opts
    click(pg, "しらべる", "写真立て")  # 何も開かない行動
    click(pg, "いどう", "汐見水産")
    for _ in range(5):
        click(pg, "きく", "秘書の野村")
    click(pg, "しらべる", "社長室")
    assert "片桐法律事務所" in move_options(pg)
    log = pg.evaluate("window.__mg.toastLog")
    assert log.count("片桐法律事務所に行けるようになった") == 1, log
    assert log.count("汐見病院・薬局に行けるようになった") == 1, log
    return pg.errs


@test
def contradiction(b):
    """矛盾をつく：まちがえるとミス、相手がいない場所では使えず、片桐の前でつきつけると崩せる"""
    pg = new_shiomi(b)
    click(pg, "しらべる", "薬瓶"); click(pg, "しらべる", "遺体の跡")
    click(pg, "いどう", "居間"); click(pg, "みせる", "カプセル", "ハル")
    click(pg, "いどう", "汐見水産"); click(pg, "しらべる", "社長室")
    click(pg, "いどう", "片桐法律事務所")
    for _ in range(3):
        click(pg, "きく", "片桐")
    contra(pg, "胸をおさえて", "金曜の欄")
    assert state(pg)["v"]["miss"] == 1
    click(pg, "いどう", "書斎")
    contra(pg, "何も関わっていない", "病院からもらってきた")
    assert "法律事務所へ" in msg(pg) and state(pg)["v"]["miss"] == 1
    assert not state(pg)["f"].get("contra_lie")
    click(pg, "いどう", "片桐法律事務所")
    contra(pg, "病院からもらってきた", "何も関わっていない")
    assert state(pg)["f"].get("contra_lie") == 1
    contra(pg, "病院からもらってきた", "何も関わっていない")
    assert "もう崩しました" in msg(pg) and state(pg)["v"]["miss"] == 1
    return pg.errs


@test
def assistant_points_to_unheard(b):
    """マコトに聞くと、この場所でまだ大事な話を聞いていない人を教えてくれる"""
    pg = new_shiomi(b)
    click(pg, "いどう", "居間")
    click(pg, "きく", "マコト")
    m = msg(pg)
    assert "沙織さんはまだ何か知っていそう" in m, m
    for _ in range(2):
        click(pg, "きく", "沙織")
    click(pg, "きく", "マコト")
    assert "ハルさんはまだ何か知っていそう" in msg(pg)
    for _ in range(4):
        click(pg, "きく", "ハル")
    click(pg, "きく", "マコト")
    m = msg(pg)
    assert "知っていそう" not in m, m  # 残っていなければ、ふだんのヒントに戻る
    assert pg.locator("#cmd button.new, #here span.new").count() == 0
    return pg.errs


@test
def shiomi_wrong_and_missing(b):
    """証拠が足りないときは逮捕できず、まちがえるとミスが数えられる"""
    pg = new_shiomi(b)
    click(pg, "すいり", "片桐")
    assert "足りないもの" in msg(pg)
    click(pg, "すいり", "沙織")
    assert state(pg)["v"]["miss"] == 1
    return pg.errs


@test
def save_and_load(b):
    """スロットにセーブしてロードすると、その時点に戻る"""
    pg = new_shiomi(b)
    click(pg, "しらべる", "机")
    pg.click("#menu"); pg.click("#modal .row:has-text('セーブ')"); pg.click("#modal .row:has-text('スロット1')")
    click(pg, "しらべる", "薬瓶")
    assert len(state(pg)["items"]) == 2
    pg.click("#menu"); pg.click("#modal .row:has-text('ロード')"); pg.click("#modal .row:has-text('スロット1')")
    assert state(pg)["items"] == ["memo"]
    return pg.errs


@test
def autosave_resume(b):
    """ページを開き直すと「つづきから」で再開できる"""
    pg = new_shiomi(b)
    click(pg, "いどう", "居間")
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
    click(pg, "きく", "助手A"); click(pg, "きく", "助手A"); click(pg, "きく", "助手A")
    assert "二回目以降" in msg(pg)
    click(pg, "しらべる", "箱"); click(pg, "つぎへ")
    assert "第二章" in pg.locator("#card").inner_text()
    pg.click("#card")
    assert "箱から鍵" in pg.locator("#modal .recap").inner_text()  # これまでの話
    pg.click("#modal >> text=つづける")
    assert state(pg)["chapter"] == "ch2"
    assert pg.evaluate("!!localStorage.getItem('mg:test-mini:chap:ch2')")
    click(pg, "すいり", "A")
    assert state(pg)["v"]["miss"] == 1
    click(pg, "すいり", "X"); click(pg, "つぎへ")
    assert "完 OK" in msg(pg)
    return pg.errs


@test
def notebook(b):
    """捜査手帳：証言カード、ピン留め、会話ログの絞り込みと検索、メモ"""
    pg = new_shiomi(b)
    click(pg, "きく", "マコト")
    click(pg, "いどう", "居間"); click(pg, "きく", "ハル"); click(pg, "きく", "ハル"); click(pg, "きく", "沙織")
    st = state(pg)
    assert len(st["cards"]) == 3, st["cards"]
    assert pg.locator("#nbn").inner_text() == "3"
    pg.click("#nb")
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


if __name__ == "__main__":
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
