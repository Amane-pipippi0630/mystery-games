#!/usr/bin/env python3
"""シナリオの自動検証（詰み・バグ・行き止まりの文）。

  python3 tools/verify.py kamomejima            # 全章を検証
  python3 tools/verify.py kamomejima --chapter ch2

組み立て済みの games/<id>/index.html を、画面を出さない検証モードで動かす。

1. 総当たり探索：章のはじめから、取れる行動（移動・聞く・調べる・見せる・推理・矛盾をつく・番号入力）を
   すべて試し、たどり着ける状態を集める。進行に関係する部分（場所・フラグ・アイテム・数・話した回数・
   証言カード）が同じ状態は1つにまとめる。
2. 詰みの検出：たどり着ける状態のうち、そこから章の終わりへ行けないものを「詰み」として報告する。
3. ランダムプレイ：会話の順番など、まとめた部分も含めて試すため、ランダムに行動させて章の終わりまで遊ばせる。
4. エラーと、一度も表示されなかった文（行き止まりの文）を報告する。
5. 時刻・場所の出てくる文を一覧にする（設計書の時刻表と突き合わせる用。--times）。

詰み・エラーが1つでもあれば終了コード1。
"""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

JS_EXPLORE = r"""
([chapter, prev, limit, walks, walkLen]) => {
  const M = window.__mg, sim = M.sim, D = M.D, C = D.chapters[chapter];
  const src = JSON.stringify(C);
  // 条件に出てくる数の上限（それより大きい値は同じとみなす）
  const caps = {};
  for (const m of src.matchAll(/(var|talked):([A-Za-z0-9_\-]+)\s*(>=|<=|==|!=|>|<)?\s*(-?\d+)?/g)) {
    const k = m[1] + ':' + m[2]; const n = m[4] ? +m[4] + 1 : 1;
    caps[k] = Math.max(caps[k] || 0, n);
  }
  // 進行に関わる効果（フラグ・アイテム・数・場面・章・謎解き・移動、取材ノート、id 付きカード）
  const progress = r => r && typeof r === 'object' && (((r.do || []).some(d => /^(flag|give|take|inc|set|event|chapter|ending|puzzle|goto):/.test(d))) || !!r.note || !!r.cardId);
  // 「一度だけ言うセリフ」用のフラグ（!flag:X を条件に持ち、同じルールで flag:X を立てる）のうち、
  // 同じ並びの後ろに進行に関わるルールがないものは、区別しない
  const refs = {}, ignorable = {};
  const countRefs = o => {
    if (Array.isArray(o)) return o.forEach(countRefs);
    if (o && typeof o === 'object') {
      for (const f of ['if', 'unlock']) if (typeof o[f] === 'string') for (const m of o[f].matchAll(/flag:([A-Za-z0-9_\-]+)/g)) refs[m[1]] = (refs[m[1]] || 0) + 1;
      for (const k in o) countRefs(o[k]);
    }
  };
  countRefs(C);
  const selfRefs = {};
  const scanLists = o => {
    if (Array.isArray(o)) {
      o.forEach((r, i) => {
        if (!r || typeof r !== 'object' || typeof r.if !== 'string') return;
        for (const m of r.if.matchAll(/!flag:([A-Za-z0-9_\-]+)/g)) {
          const f = m[1];
          if (!(r.do || []).includes('flag:' + f)) continue;
          selfRefs[f] = (selfRefs[f] || 0) + 1;
          const laterProgress = o.slice(i + 1).some(progress);
          if (!laterProgress) ignorable[f] = (ignorable[f] || 0) + 1;
        }
      });
    }
    if (o && typeof o === 'object') for (const k in o) scanLists(o[k]);
  };
  scanLists(C);
  const ignoreFlag = f => ignorable[f] && ignorable[f] === refs[f];
  // 順番に進む会話（seq）は、進行に関わる段まで区別する
  const seqCaps = {};
  const addSeq = (key, e) => { if (e && e.seq) { let last = -1; e.seq.forEach((r, i) => { if (progress(r)) last = i; }); if (last >= 0) seqCaps[key] = last + 1; } };
  for (const [p, e] of Object.entries(C.talk || {})) {
    if (e && e.topics) for (const [t, te] of Object.entries(e.topics)) addSeq('talk:' + p + ':' + t, te); else addSeq('talk:' + p, e);
  }
  for (const [p, m] of Object.entries(C.show || {})) for (const [i, e] of Object.entries(m)) addSeq('show:' + p + ':' + i, e);
  const key = s => {
    const v = {}, t = {};
    for (const k in caps) {
      const [kind, n] = k.split(':');
      const x = kind === 'var' ? (s.v[n] || 0) : (s.seq['talkc:' + s.chapter + ':' + n] || 0);
      (kind === 'var' ? v : t)[n] = Math.min(x, caps[k]);
    }
    const sq = {}; for (const k in seqCaps) sq[k] = Math.min(s.seq[s.chapter + '|' + k] || 0, seqCaps[k]);
    return JSON.stringify([s.chapter, s.loc, Object.keys(s.f).filter(k => s.f[k] && !ignoreFlag(k)).sort(), [...s.items].sort(), v, t, sq,
      s.cards.map(c => c.id).filter(Boolean).sort(), s.simPuzzle || null, s.simEnd || null]);
  };
  const errors = [];
  const step = (st, a) => {
    sim.set(st);
    try { sim.apply(a); } catch (e) { errors.push({ action: a, error: String(e && e.stack || e) }); return null; }
    const g = sim.get(); g.log = []; return g;   // 会話ログは進行に関係しない（助手の案内の文が変わるだけ）
  };
  const start = sim.begin(chapter, prev); start.log = [];
  const k0 = key(start);
  const states = new Map([[k0, { st: start, path: [] }]]);
  const edges = new Map();
  const queue = [k0]; const goals = new Set(); let truncated = false;
  while (queue.length) {
    if (states.size >= limit) { truncated = true; break; }
    const k = queue.shift(), { st, path } = states.get(k);
    if (st.simEnd) { goals.add(k); continue; }
    sim.set(st);
    const acts = sim.actions();
    const outs = [];
    for (const a of acts) {
      const ns = step(st, a); if (!ns) continue;
      const nk = key(ns); outs.push(nk);
      if (!states.has(nk)) { states.set(nk, { st: ns, path: path.concat([a]) }); queue.push(nk); }
    }
    edges.set(k, outs);
  }
  // 章の終わりへ行ける状態を、終わりから逆にたどって集める
  const rev = new Map();
  for (const [k, outs] of edges) for (const o of outs) { if (!rev.has(o)) rev.set(o, []); rev.get(o).push(k); }
  const ok = new Set(goals); const q2 = [...goals];
  while (q2.length) { const k = q2.pop(); for (const p of rev.get(k) || []) if (!ok.has(p)) { ok.add(p); q2.push(p); } }
  const dead = [];
  if (!truncated) for (const [k, { st, path }] of states) if (!ok.has(k)) dead.push({ path, f: Object.keys(st.f).filter(x => st.f[x]), loc: st.loc, items: st.items });
  dead.sort((a, b) => a.path.length - b.path.length);
  const ends = {};
  for (const k of goals) { const e = states.get(k).st.simEnd; ends[e] = ends[e] || states.get(k).path.length; }
  const goalState = goals.size ? states.get([...goals][0]).st : null;
  // ヒントの文の確認：たどり着いた状態ごとに、助手に4回まで相談してみる
  const A = D.assistant, HT = D.hintTopic;
  if (A) {
    let n = 0;
    for (const [k, { st }] of states) {
      if (st.simEnd || n++ > 20000) continue;
      sim.set(st);
      if (!M.sim.actions().some(a => (a.t === 'topic' && a.p === A && a.tp === HT) || (a.t === 'talk' && a.p === A))) continue;
      for (let i = 0; i < 4; i++) { try { sim.apply(HT && C.talk[A] && C.talk[A].topics ? { t: 'topic', p: A, tp: HT } : { t: 'talk', p: A }); } catch (e) { errors.push({ action: 'hint', error: String(e) }); break; } }
    }
  }
  // 総当たりが打ち切られたときの詰み検出（確率的）：ランダムプレイの途中の状態から、さらにランダムに遊ばせて章の終わりへ行けるかを試す
  const walkTo = (st0, maxSteps) => {
    let st = st0, n = 0;
    while (n < maxSteps && !st.simEnd) {
      sim.set(st); const acts = sim.actions(); if (!acts.length) return false;
      const ns = step(st, acts[Math.floor(Math.random() * acts.length)]); if (!ns) return false; st = ns; n++;
    }
    return !!st.simEnd;
  };
  const probe = { done: false, probes: 0, suspects: [] };
  if (truncated) {
    probe.done = true;
    for (let w = 0; w < 40; w++) {
      let st = sim.begin(chapter, prev); st.log = []; const path = [];
      while (!st.simEnd && path.length < 3000) {
        if (path.length % 15 === 0) {
          probe.probes++;
          let ok = false;
          for (let t = 0; t < 12 && !ok; t++) ok = walkTo(st, 4000);
          if (!ok) { probe.suspects.push({ path: path.slice(), f: Object.keys(st.f).filter(x => st.f[x]), loc: st.loc, items: st.items }); break; }
        }
        sim.set(st); const acts = sim.actions(); if (!acts.length) break;
        const a = acts[Math.floor(Math.random() * acts.length)];
        const ns = step(st, a); if (!ns) break; st = ns; path.push(a);
      }
    }
  }
  // ランダムプレイ（会話の順番などもいろいろ試す）
  let reached = 0, longest = 0, total = 0;
  for (let w = 0; w < walks; w++) {
    let st = sim.begin(chapter, prev), n = 0;
    while (n < walkLen && !st.simEnd) {
      sim.set(st); const acts = sim.actions(); if (!acts.length) break;
      const a = acts[Math.floor(Math.random() * acts.length)];
      const ns = step(st, a); if (!ns) break; st = ns; n++;
    }
    if (st.simEnd) { reached++; total += n; longest = Math.max(longest, n); }
  }
  return { probe, states: states.size, truncated, goals: goals.size, ends, dead: dead.slice(0, 5), deadCount: dead.length, errors: errors.slice(0, 10), errorCount: errors.length,
           walks: { runs: walks, reached, avg: reached ? Math.round(total / reached) : 0, longest }, seen: sim.seen(), goalState };
}
"""


def chapter_texts(ch):
    out = []
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "text" and isinstance(v, str): out.append(v)
                elif k in ("pages", "hints") and isinstance(v, list): out.extend(v)
                elif k in ("recap",): pass
                else: walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    for part in ("talk", "show", "look", "events", "locations", "puzzles", "accuse", "contradictions"):
        if part in ch:
            if part == "look":
                for v in ch[part].values():
                    if isinstance(v, str): out.append(v)
                    else: walk(v)
            elif part == "locations":
                for L in ch[part].values():
                    a = L.get("arrive")
                    if isinstance(a, str): out.append(a)
                    else: walk(a)
            else:
                walk(ch[part])
    out.append(ch["start"]["text"])
    return out


TIME = re.compile(r"(\d{1,2}時(\d{1,2}分)?|\d{1,2}:\d{2}|昭和[〇一二三四五六七八九十\d]+年|\d{1,2}月\d{1,2}日)")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        raise SystemExit(__doc__)
    gid = args[0]
    only = sys.argv[sys.argv.index("--chapter") + 1] if "--chapter" in sys.argv else None
    limit = 120000
    gdir = Path(gid).resolve() if (Path(gid) / "src").exists() else ROOT / "games" / gid
    g = json.loads((gdir / "src" / "game.json").read_text(encoding="utf-8"))
    chs = {c: json.loads((gdir / "src" / f"{c}.json").read_text(encoding="utf-8")) for c in g["chapters"]}
    url = (gdir / "index.html").as_uri()
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto(url)
        pg.wait_for_function("window.__mg && window.__mg.sim")
        prev = None
        for cid in g["chapters"]:
            r = pg.evaluate(JS_EXPLORE, [cid, prev, limit, 60, 3000])
            prev = r["goalState"]
            if only and cid != only:
                continue
            ch = chs[cid]
            print(f"\n■ {cid}（{ch.get('label', '')} {ch.get('title', '')}）")
            print(f"  状態の数：{r['states']}" + ("（上限で打ち切り）" if r["truncated"] else ""))
            if r["ends"]:
                for e, n in r["ends"].items():
                    print(f"  章の終わり：{e}（最短 {n} 手）")
            elif not r["truncated"]:
                print("  ✗ 章の終わりにたどり着けません"); bad += 1
            if not r["truncated"]:
                if r["deadCount"]:
                    bad += 1
                    print(f"  ✗ 詰み：{r['deadCount']} 状態。例（最短の手順）：")
                    for d in r["dead"][:3]:
                        steps = " → ".join(json.dumps(a, ensure_ascii=False) for a in d["path"])
                        print(f"    - 場所 {d['loc']} / フラグ {d['f']} / アイテム {d['items']}\n      手順：{steps}")
                else:
                    print("  ✓ 詰みなし（総当たり：どの状態からも章の終わりへ行ける）")
            else:
                pr = r["probe"]
                if pr["suspects"]:
                    bad += 1
                    print(f"  ✗ 詰みの疑い：{len(pr['suspects'])} 件（{pr['probes']} の状態から試した）。例：")
                    for d in pr["suspects"][:3]:
                        steps = " → ".join(json.dumps(a, ensure_ascii=False) for a in d["path"][-12:])
                        print(f"    - 場所 {d['loc']} / フラグ {d['f']} / アイテム {d['items']}\n      最後の手順：{steps}")
                else:
                    print(f"  ✓ 詰みなし（確率的：遊びの途中の {pr['probes']} の状態から、どれも章の終わりへ行けた）")
            if r["errorCount"]:
                bad += 1
                print(f"  ✗ エラー：{r['errorCount']} 件")
                for e in r["errors"][:3]:
                    print(f"    - {json.dumps(e['action'], ensure_ascii=False)}: {e['error'].splitlines()[0]}")
            else:
                print("  ✓ エラーなし")
            w = r["walks"]
            print(f"  ランダムプレイ：{w['runs']} 回中 {w['reached']} 回が章の終わりまで到達（平均 {w['avg']} 手、最長 {w['longest']} 手）")
            if w["reached"] < w["runs"]:
                print("    （3000手で終わらなかった回は、遠回りのしすぎ。詰みは上の総当たりで判定）")
            seen = set(r["seen"])
            texts = chapter_texts(ch)
            unseen = [t for t in texts if t not in seen]
            if unseen:
                print(f"  注意：一度も表示されなかった文 {len(unseen)} 件（行き止まりの文の可能性）")
                for t in unseen[:8]:
                    print("    - " + t.replace("\n", " ")[:70])
            else:
                print(f"  ✓ すべての文（{len(texts)} 件）が表示された")
            if "--times" in sys.argv:
                print("  時刻・日付が出てくる文：")
                for t in texts:
                    if TIME.search(t):
                        print("    - " + t.replace("\n", " ")[:90])
        b.close()
    print("\n結果：" + ("問題あり" if bad else "問題なし"))
    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
