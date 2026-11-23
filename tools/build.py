#!/usr/bin/env python3
"""ゲームを1枚のHTMLに組み立てる。

使い方:
  python3 tools/build.py shiomi-port          # games/shiomi-port/index.html を作る
  python3 tools/build.py shiomi-port --check  # シナリオの点検だけする
  python3 tools/build.py tests/fixtures/mini  # フォルダを直接指定してもよい
  python3 tools/build.py shiomi-port --inline # 背景もHTMLに埋め込み、1ファイルにする

games/<id>/src/ に game.json・章ごとの <章id>.json・bg/<名前>.jpg を置く。
エンジン（engine/）とシナリオはHTMLに埋め込み、背景は幅1280pxのWebPにして
games/<id>/bg/ に書き出す。背景は起動時にまとめて読み込むので、遊んでいる間は通信しない。
"""
import base64, io, json, re, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BG_WIDTH = 1280      # 背景の最大幅（px）
BG_QUALITY = 80      # WebPの画質
NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
TOK = re.compile(r"\s*(\|\||&&|!|\(|\)|true|false|[a-z]+:[A-Za-z0-9_\-]+(?:\s*(?:>=|<=|==|!=|>|<)\s*-?\d+)?)")
TERM = re.compile(r"^([a-z]+):([A-Za-z0-9_\-]+)(?:\s*(>=|<=|==|!=|>|<)\s*(-?\d+))?$")
EFFECTS = {"give", "take", "flag", "unflag", "set", "inc", "miss", "toast", "goto", "puzzle", "ending", "chapter", "event", "card"}


class Checker:
    def __init__(self, game):
        self.g = game
        self.errors = []
        self.warnings = []

    def err(self, where, msg): self.errors.append(f"{where}: {msg}")
    def warn(self, where, msg): self.warnings.append(f"{where}: {msg}")

    def cond(self, where, src, ch):
        if not src:
            return
        pos, depth = 0, 0
        while pos < len(src):
            m = TOK.match(src, pos)
            if not m:
                if src[pos:].strip():
                    self.err(where, f"条件の書き方が正しくありません: {src}")
                return
            t = m.group(1); pos = m.end()
            if t == "(": depth += 1
            elif t == ")": depth -= 1
            elif t not in ("||", "&&", "!", "true", "false"):
                k, n = TERM.match(t).group(1, 2)
                if k == "has" and n not in self.g["items"]:
                    self.err(where, f"アイテム {n} は items にありません")
                elif k == "here" and n not in ch["locations"]:
                    self.err(where, f"場所 {n} はありません")
                elif k == "talked" and n not in self.g["people"]:
                    self.err(where, f"人物 {n} は people にありません")
                elif k not in ("has", "flag", "here", "var", "talked"):
                    self.err(where, f"不明な条件 {k}:")
        if depth:
            self.err(where, f"かっこの数が合いません: {src}")

    def effects(self, where, lst, ch):
        for e in lst or []:
            k, _, a = e.partition(":")
            if k not in EFFECTS:
                self.err(where, f"不明な効果: {e}")
            elif k in ("give", "take") and a not in self.g["items"]:
                self.err(where, f"アイテム {a} は items にありません")
            elif k == "goto" and a not in ch["locations"]:
                self.err(where, f"場所 {a} はありません")
            elif k == "puzzle" and a not in ch.get("puzzles", {}):
                self.err(where, f"謎解き {a} はありません")
            elif k == "ending" and a not in self.g.get("endings", {}):
                self.err(where, f"エンディング {a} はありません")
            elif k == "chapter" and a not in self.g["chapters"]:
                self.err(where, f"章 {a} はありません")
            elif k == "event" and a not in ch.get("events", {}):
                self.err(where, f"イベント {a} はありません")
            elif k == "card" and ":" not in a:
                self.err(where, f"card は card:人物id:文 の形で書きます（人物なしは card::文）: {e}")
            elif k == "set" and not re.match(r"^[A-Za-z0-9_\-]+=-?\d+$", a):
                self.err(where, f"set は set:名前=数 の形で書きます: {e}")

    def entry(self, where, e, ch):
        if e is None:
            return
        if isinstance(e, str):
            return
        if isinstance(e, list):
            for i, r in enumerate(e):
                self.rule(f"{where}[{i}]", r, ch)
            if e and e[-1].get("if"):
                self.warn(where, "最後のルールに条件があります（どれにも当てはまらないと既定の文になります）")
        elif "seq" in e:
            for i, r in enumerate(e["seq"]):
                self.rule(f"{where}.seq[{i}]", r, ch)
        else:
            self.rule(where, e, ch)

    def rule(self, where, r, ch):
        if isinstance(r, str):
            return
        self.cond(where, r.get("if"), ch)
        self.effects(where, r.get("do"), ch)
        if not r.get("text") and not r.get("do") and not r.get("hints"):
            self.err(where, "text も do もありません")
        if r.get("card") is True and not r.get("text"):
            self.err(where, "card: true には text が必要です（または card に要約を書く）")


def gamedir(arg):
    p = Path(arg)
    return p.resolve() if (p / "src").exists() else ROOT / "games" / arg


def load(gid):
    src = gamedir(gid) / "src"
    g = json.loads((src / "game.json").read_text(encoding="utf-8"))
    order = g["chapters"]
    g["chapters"] = {}
    for cid in order:
        c = json.loads((src / f"{cid}.json").read_text(encoding="utf-8"))
        if c.get("id") != cid:
            raise SystemExit(f"{cid}.json の id が {c.get('id')} になっています")
        g["chapters"][cid] = c
    g["assets"] = {"bg": {}}
    g["_bgsrc"] = {}
    bgdir = src / "bg"
    if bgdir.exists():
        for f in sorted(bgdir.iterdir()):
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                g["_bgsrc"][f.stem] = f
                g["assets"]["bg"][f.stem] = f"bg/{f.stem}.webp"
    return g


def check(g):
    c = Checker(g)
    for k, f in g["_bgsrc"].items():
        if not NAME.match(k):
            c.err(f"src/bg/{f.name}", "ファイル名は英小文字・数字・ハイフンにしてください")
        else:
            w, h = Image.open(f).size
            if w < 1024:
                c.warn(f"src/bg/{f.name}", f"幅が {w}px です（1280px以上がおすすめ）")
            if abs(w / h - 16 / 9) > 0.03:
                c.warn(f"src/bg/{f.name}", f"縦横比が16:9ではありません（{w}x{h}）。はみ出た部分は切れます")
    if g["start"] not in g["chapters"]:
        c.err("game", f"start の章 {g['start']} がありません")
    bgs = g["assets"]["bg"]
    for eid, e in g.get("endings", {}).items():
        for k in ("bg", "finalBg"):
            if e.get(k) and e[k] not in bgs:
                c.err(f"endings.{eid}", f"背景 {e[k]} が src/bg にありません")
        for i, r in enumerate(e.get("ranks", [])):
            c.cond(f"endings.{eid}.ranks[{i}]", r.get("if"), {"locations": {}})
    for cid, ch in g["chapters"].items():
        w = cid
        if ch["start"]["loc"] not in ch["locations"]:
            c.err(w, f"開始場所 {ch['start']['loc']} がありません")
        looks = ch.get("look", {})
        for lid, L in ch["locations"].items():
            if L.get("bg") and L["bg"] not in bgs:
                c.err(f"{w}.{lid}", f"背景 {L['bg']} が src/bg にありません")
            c.cond(f"{w}.{lid}.unlock", L.get("unlock"), ch)
            for p in L.get("people", []):
                if isinstance(p, dict):
                    c.cond(f"{w}.{lid}.people", p.get("if"), ch)
                    p = p["id"]
                if p not in g["people"]:
                    c.err(f"{w}.{lid}", f"人物 {p} は people にありません")
                elif p not in ch.get("talk", {}):
                    c.warn(f"{w}.{lid}", f"{p} の会話（talk）がありません")
            for o in L.get("objs", {}):
                if o not in looks:
                    c.warn(f"{w}.{lid}", f"{o} を調べたときの文（look）がありません")
            c.entry(f"{w}.{lid}.arrive", L.get("arrive"), ch)
        for eid, E in ch.get("events", {}).items():
            if E.get("bg") and E["bg"] not in bgs:
                c.err(f"{w}.events.{eid}", f"背景 {E['bg']} が src/bg にありません")
            c.effects(f"{w}.events.{eid}", E.get("do"), ch)
        for i, r in enumerate(ch.get("triggers", [])):
            c.rule(f"{w}.triggers[{i}]", r, ch)
            if not any(e.startswith("flag:") for e in r.get("do", [])):
                c.warn(f"{w}.triggers[{i}]", "do に flag がないと、同じトリガーが何度も動きます")
        for i, r in enumerate(ch.get("onMove", [])):
            c.rule(f"{w}.onMove[{i}]", r, ch)
        for p, e in ch.get("talk", {}).items():
            if p not in g["people"]:
                c.err(f"{w}.talk", f"人物 {p} は people にありません")
            if isinstance(e, dict) and "topics" in e:
                for t, te in e["topics"].items():
                    if t not in g.get("topics", {}):
                        c.err(f"{w}.talk.{p}", f"話題 {t} は game.json の topics にありません")
                    c.entry(f"{w}.talk.{p}.{t}", te, ch)
            else:
                c.entry(f"{w}.talk.{p}", e, ch)
        for p, m in ch.get("show", {}).items():
            for it, e in m.items():
                if it not in g["items"]:
                    c.err(f"{w}.show.{p}", f"アイテム {it} は items にありません")
                c.entry(f"{w}.show.{p}.{it}", e, ch)
        for o, e in looks.items():
            c.entry(f"{w}.look.{o}", e, ch)
        for pid, P in ch.get("puzzles", {}).items():
            if len(P["answer"]) != P["length"]:
                c.err(f"{w}.puzzles.{pid}", "answer の長さが length と合いません")
            c.rule(f"{w}.puzzles.{pid}.success", P["success"], ch)
        card_ids = set(re.findall(r'"cardId":\s*"([^"]+)"', json.dumps(ch, ensure_ascii=False)))
        for i, x in enumerate(ch.get("contradictions", [])):
            wx = f"{w}.contradictions[{i}]"
            if not re.match(r"^[A-Za-z0-9_\-]+$", x.get("id", "")):
                c.err(wx, "id は英数字で書きます")
            for pair in x.get("pairs", []):
                for cid_ in pair:
                    if cid_ not in card_ids:
                        c.err(wx, f"証言カード {cid_} がありません（cardId を付けたルールが必要）")
            c.cond(wx, x.get("if"), ch)
            c.effects(wx, x.get("do"), ch)
        A = ch.get("accuse")
        if A:
            for p in A["suspects"]:
                if p not in g["people"]:
                    c.err(f"{w}.accuse", f"人物 {p} は people にありません")
            if A["culprit"] not in A["suspects"]:
                c.err(f"{w}.accuse", "culprit が suspects に入っていません")
            if A["ending"] not in g.get("endings", {}):
                c.err(f"{w}.accuse", f"エンディング {A['ending']} はありません")
            for i, r in enumerate(A.get("required", [])):
                c.cond(f"{w}.accuse.required[{i}]", r["if"], ch)
            for p, e in A.get("wrong", {}).items():
                c.entry(f"{w}.accuse.wrong.{p}", e, ch)
    return c


def build(gid, only_check=False):
    g = load(gid)
    c = check(g)
    for x in c.warnings:
        print("注意:", x)
    for x in c.errors:
        print("エラー:", x)
    if c.errors:
        raise SystemExit(f"{len(c.errors)}件のエラーがあります")
    if only_check:
        print("点検OK")
        return
    out_dir = gamedir(gid)
    inline = "--inline" in sys.argv
    bg_out = out_dir / "bg"
    if bg_out.exists():
        shutil.rmtree(bg_out)
    total = 0
    for k, f in g.pop("_bgsrc").items():
        im = Image.open(f).convert("RGB")
        if im.width > BG_WIDTH:
            im = im.resize((BG_WIDTH, round(BG_WIDTH * im.height / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=BG_QUALITY, method=6)
        total += buf.tell()
        if inline:
            g["assets"]["bg"][k] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
        else:
            bg_out.mkdir(exist_ok=True)
            (bg_out / f"{k}.webp").write_bytes(buf.getvalue())
    eng = ROOT / "engine"
    data = json.dumps(g, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = (eng / "template.html").read_text(encoding="utf-8")
    html = (html.replace("{{TITLE}}", g["title"])
                .replace("{{CSS}}", (eng / "engine.css").read_text(encoding="utf-8"))
                .replace("{{JS}}", (eng / "engine.js").read_text(encoding="utf-8"))
                .replace("{{DATA}}", data))
    out = out_dir / "index.html"
    out.write_text(html, encoding="utf-8")
    n = len(g["assets"]["bg"])
    print(f"できあがり: {out}（{out.stat().st_size // 1024} KB）、背景 {n} 枚 {total // 1024} KB" + ("（HTMLに埋め込み）" if inline else f"（{bg_out.name}/）"))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        raise SystemExit(__doc__)
    build(args[0], "--check" in sys.argv)
