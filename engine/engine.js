// mystery-games 共通エンジン
// シナリオは <script id="game-data"> の JSON から読む（tools/build.py が埋め込む）。
// 書き方は engine/README.md を参照。
'use strict';
(() => {
const D = JSON.parse(document.getElementById('game-data').textContent);
const KEY = 'mg:' + D.id;
const $ = id => document.getElementById(id);
const SLOTS = 3;

// ---------- 保存 ----------
const store = {
  get(k) { try { const v = localStorage.getItem(KEY + ':' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(KEY + ':' + k, JSON.stringify(v)); } catch (e) {} },
};
function markCleared() {
  if (SIM) return;
  try {
    const c = JSON.parse(localStorage.getItem('mg:cleared') || '[]');
    if (!c.includes(D.id)) { c.push(D.id); localStorage.setItem('mg:cleared', JSON.stringify(c)); }
  } catch (e) {}
}

// ---------- 状態 ----------
let S = null;
let pending = {};
// 検証モード（tools/verify.py）：画面に何も出さず、場面は一気に進め、章の終わりや謎解きで止まる
let SIM = false;
const simSeen = new Set();
const fresh = () => ({ chapter: D.start, loc: null, f: {}, v: { turns: 0, miss: 0 }, items: [], seq: {}, done: false, log: [], cards: [], memo: '', seenCards: 0 });
const ch = () => D.chapters[S.chapter];
const loc = () => ch().locations[S.loc];
// 場所にいる人。{"id": "...", "if": "条件"} で、場面によって出入りさせられる
const here = (L = loc()) => (L.people || []).filter(p => typeof p === 'string' || cond(p.if)).map(p => typeof p === 'string' ? p : p.id);
const person = p => D.people[p] || { name: p };
const short = p => person(p).short || person(p).name;
// 助手（ヒント役）は章ごとに変えられる：章の assistant / assistantHint / hintTopic が game.json より優先
const AS = () => ('assistant' in ch()) ? ch().assistant : D.assistant;
const HT = () => ch().hintTopic || D.hintTopic;
const fmt = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
function snapshot(label) {
  return { state: JSON.parse(JSON.stringify(S)), at: Date.now(), label: label || ((ch().label ? ch().label + ' ' : '') + (loc() ? loc().name : '')) };
}
function autosave() { if (S && !SIM) store.set('auto', snapshot()); }

// ---------- 条件 ----------
// 例: "has:capsule && !flag:sent"  "var:wait>=1"  "count:talk:haru>=2" は不可（キーは英数字と _ -）
const TOK = /\s*(\|\||&&|!|\(|\)|true|false|[a-z]+:[A-Za-z0-9_\-]+(?:\s*(?:>=|<=|==|!=|>|<)\s*-?\d+)?)/y;
function cond(src) {
  if (src == null || src === '') return true;
  const toks = []; TOK.lastIndex = 0;
  while (TOK.lastIndex < src.length) {
    const at = TOK.lastIndex, m = TOK.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(at))) break; throw new Error('条件の書き方が正しくありません: ' + src); }
    toks.push(m[1]);
  }
  let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  const or = () => { let v = and(); while (peek() === '||') { next(); const r = and(); v = v || r; } return v; };
  const and = () => { let v = not(); while (peek() === '&&') { next(); const r = not(); v = v && r; } return v; };
  const not = () => { if (peek() === '!') { next(); return !not(); } return atom(); };
  const atom = () => {
    const t = next();
    if (t === '(') { const v = or(); if (next() !== ')') throw new Error('かっこが閉じていません: ' + src); return v; }
    return term(t, src);
  };
  const v = or();
  if (p < toks.length) throw new Error('条件の書き方が正しくありません: ' + src);
  return v;
}
function term(t, src) {
  if (t === 'true') return true;
  if (t === 'false') return false;
  const m = t && t.match(/^([a-z]+):([A-Za-z0-9_\-]+)(?:\s*(>=|<=|==|!=|>|<)\s*(-?\d+))?$/);
  if (!m) throw new Error('条件の書き方が正しくありません: ' + src);
  const [, k, n, op, num] = m;
  if (k === 'has') return S.items.includes(n);
  if (k === 'flag') return !!S.f[n];
  if (k === 'here') return S.loc === n;
  if (k === 'var' || k === 'talked') {
    const x = k === 'var' ? (S.v[n] || 0) : (S.seq['talkc:' + S.chapter + ':' + n] || 0);
    if (!op) return x > 0;
    const y = +num;
    return { '>=': x >= y, '<=': x <= y, '==': x === y, '!=': x !== y, '>': x > y, '<': x < y }[op];
  }
  throw new Error('不明な条件: ' + t);
}

// ---------- 効果 ----------
function run(list) {
  for (const e of list || []) {
    const i = e.indexOf(':'), k = i < 0 ? e : e.slice(0, i), a = i < 0 ? '' : e.slice(i + 1);
    switch (k) {
      case 'give': if (!S.items.includes(a)) { S.items.push(a); toast('入手：' + D.items[a]); snd.se('note'); } break;
      case 'take': S.items = S.items.filter(x => x !== a); break;
      case 'flag': S.f[a] = 1; break;
      case 'unflag': delete S.f[a]; break;
      case 'set': { const [n, v] = a.split('='); S.v[n] = +v; break; }
      case 'inc': S.v[a] = (S.v[a] || 0) + 1; break;
      case 'miss': S.v.miss = (S.v.miss || 0) + 1; break;
      case 'toast': if (!S.toasted) S.toasted = []; if (!S.toasted.includes(a)) { S.toasted.push(a); toast(a); } break;
      case 'goto': pending.goto = a; break;
      case 'puzzle': pending.puzzle = a; break;
      case 'ending': pending.ending = a; break;
      case 'chapter': pending.chapter = a; break;
      case 'event': pending.event = a; break;
      case 'board': pending.board = a; break;
      case 'choice': pending.choice = a; break;
      case 'search': pending.search = a; break;
      case 'doc': if (!S.docs) S.docs = []; if (!S.docs.includes(a)) { S.docs.push(a); toast('資料に追加：' + D.docs[a].title); snd.se('note'); } break;
      case 'card': { const k = a.indexOf(':'); addCard({ card: a.slice(k + 1) }, { p: a.slice(0, k) || null }); break; }
      default: throw new Error('不明な効果: ' + e);
    }
  }
}
const runAll = rules => (rules || []).forEach(r => { if (cond(r.if)) run(r.do); });

// 文字列 / ルール / ルールの配列（最初に条件が合うもの）/ {seq:[...]}（話すたびに次へ。最後はくり返し）
function resolve(entry, key) {
  if (entry == null) return null;
  if (typeof entry === 'string') return { text: entry };
  if (Array.isArray(entry)) return entry.find(r => cond(r.if)) || null;
  if (entry.seq) { const k = S.chapter + '|' + key, i = S.seq[k] || 0; S.seq[k] = i + 1; return entry.seq[Math.min(i, entry.seq.length - 1)]; }
  return cond(entry.if) ? entry : null;
}

// ---------- 表示 ----------
let typer = null, full = '', toastT;
const toastLog = [];
function toast(t) { toastLog.push(t); if (SIM) return; const e = $('toast'); e.textContent = t; e.classList.remove('multi'); e.classList.add('on'); if (e.offsetHeight > 48) e.classList.add('multi'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2200); }
function say(t, meta) {
  if (t == null) return;
  if (S && !(meta && meta.nolog)) S.log.push({ c: S.chapter, l: S.loc, p: (meta && meta.p) || null, t });
  if (SIM) { simSeen.add(t); return; }
  const sp = t.match(/^([^「\n]{1,10})「([\s\S]*)」$/);
  const w = $('who');
  if (sp) { w.textContent = sp[1]; w.classList.add('on'); t = '「' + sp[2] + '」'; } else w.classList.remove('on');
  full = t; const m = $('msg'); m.textContent = '';
  clearInterval(typer); let i = 0;
  typer = setInterval(() => { i++; m.textContent = full.slice(0, i); if (i >= full.length) { clearInterval(typer); typer = null; } }, 28);
}
$('msgbox').onclick = () => { if (typer) { clearInterval(typer); typer = null; $('msg').textContent = full; } };

function setScene(bgKey, place, small) {
  if (SIM) return;
  const src = bgKey && D.assets && D.assets.bg && D.assets.bg[bgKey];
  $('bg').innerHTML = src ? `<img src="${src}" alt="">` : '';
  $('locname').innerHTML = `<small>${small || ''}</small>${place || ''}`;
}
function renderScene() {
  if (SIM) return;
  const L = loc();
  updateNbBadge();
  snd.amb(locAmb());
  setScene(L.bg, L.name, ch().label || '現在地');
  $('here').innerHTML = here(L).map(p => `<span>${person(p).name}</span>`).join('');
}

const IC = {
  '移動': '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  '聞く': '<path d="M4 5h16v11H9l-5 4z"/>',
  '調べる': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  '見せる': '<rect x="3" y="8" width="11" height="13" rx="2"/><path d="M13 3h8v8M21 3l-9 9"/>',
  '推理': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  '考える': '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  '手帳': '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M10 8h5M10 12h5"/>',
};
// ボタンは2種類：中身が変わるもの（人・物・話題・場所・選択肢）と、いつも同じもの（記録・もどる）。
// 一覧では、いつも同じもの（cls が nb / back）を線の下にまとめて、別の形で出す
const SYS = cls => /\b(nb|back)\b/.test(cls || '');
function btn(t, fn, cls, icon) {
  const b = document.createElement('button');
  const nb = /\bnb\b/.test(cls || '');
  const ic = icon ? IC[t] : nb ? IC['手帳'] : null;
  b.innerHTML = (ic ? `<svg viewBox="0 0 24 24">${ic}</svg>` : '') + `<span>${t}</span>` + (nb ? '<b id="nbn" class="badge"></b>' : '');
  if (cls) b.className = cls;
  b.onclick = t === 'つぎへ' ? fn : e => { snd.se('select'); fn(e); };
  return b;
}
function btns(list, label, mode) {
  if (SIM) return;
  const c = $('cmd'); c.innerHTML = ''; c.className = mode || (label ? 'list' : '');
  if (label) { const d = document.createElement('div'); d.className = 'label'; d.textContent = label; c.appendChild(d); }
  const foot = label || mode === 'pad' ? list.filter(x => SYS(x[2])) : [];
  list.filter(x => !foot.includes(x)).forEach(([t, fn, cls]) => c.appendChild(btn(t, fn, cls, !label && IC[t])));
  if (foot.length) { const f = document.createElement('div'); f.className = 'foot'; foot.forEach(([t, fn, cls]) => f.appendChild(btn(t, fn, cls))); c.appendChild(f); }
}
// 記録（証言カード・もちもの・会話ログ）を開くボタン。名前は章ごと（nbLabel）。物語の「手帳」と混ざらないように、ことばに「手帳」は使わない
const nbLabel = () => (S && ch().nbLabel) || D.nbLabel || 'メモ';
const nbB = () => [nbLabel(), () => openNotebook(), 'nb'];
const back = ['もどる', () => main(), 'back'];
const nextBtn = fn => btns([['つぎへ', fn, 'primary']], null, 'one');

// ---------- 音 ----------
// game.json の audio: {base, title, bgm, deduce, ending, step, amb: {場所id: 環境音}}。章は audio: {bgm, amb, hush, deduce}（deduce はその章の推理の曲）
// イベントは "bgm"（そのイベントのあいだ流す。"bgmKeep": true でそのまま）と "hush"（いったん無音にする）
// ブラウザは最初のタップまで音を出せないので、タップされるまでは「何を流すか」だけ覚えておく
const snd = (() => {
  const A = D.audio || null;
  let ctx = null, want = { bgm: null, amb: null }, cur = { bgm: null, amb: null }, deduce = false, hushT = null, noteT = 0;
  // 音量（0〜100）。はじめは、音は出るが小さめ
  const DEF = { bgm: 30, amb: 30, se: 30 };
  let vol = Object.assign({}, DEF);
  const tracks = {}, ses = {};
  try {
    const v = localStorage.getItem('mg:sound');
    if (v === 'off') vol = { bgm: 0, amb: 0, se: 0 };
    else if (v && v[0] === '{') { const o = JSON.parse(v); for (const k in DEF) if (typeof o[k] === 'number') vol[k] = Math.max(0, Math.min(100, o[k])); }
  } catch (e) {}
  const save = () => { try { localStorage.setItem('mg:sound', JSON.stringify(vol)); } catch (e) {} };
  const anyOn = () => vol.bgm + vol.amb + vol.se > 0;
  const VOL = { bgm: 0.5, bgmUnder: 0.38, amb: 0.85, se: 0.7 };
  const url = n => A.base + n + '.m4a' + (A.v ? '?v=' + A.v : '');
  function track(n, loop) {
    if (tracks[n]) return tracks[n];
    const el = new Audio(url(n)); el.loop = loop; el.preload = 'auto';
    const t = { el, g: null, v: 0 };
    if (ctx && !ctx.none) { try { const s = ctx.createMediaElementSource(el); t.g = ctx.createGain(); t.g.gain.value = 0; s.connect(t.g).connect(ctx.destination); } catch (e) { t.g = null; } }
    if (!t.g) el.volume = 0;
    return (tracks[n] = t);
  }
  function setVol(t, v, sec) {
    t.v = v;
    if (t.g) { const g = t.g.gain, now = ctx.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(v, now + sec); }
    else { const from = t.el.volume, t0 = performance.now(); const step = () => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000 || 1)); try { t.el.volume = Math.max(0, Math.min(1, from + (v - from) * k)); } catch (e) {} if (k < 1) requestAnimationFrame(step); }; step(); }
    if (v > 0 && t.el.paused) t.el.play().catch(() => {});
    if (v === 0) setTimeout(() => { if (t.v === 0 && !t.hold) t.el.pause(); }, sec * 1000 + 50);
  }
  const dd = () => { const C = S && D.chapters[S.chapter]; return (C && C.audio && C.audio.deduce) || A.deduce; };
  const level = kind => kind === 'amb' ? (deduce ? 0 : VOL.amb * vol.amb / 100) : (cur.amb && !deduce ? VOL.bgmUnder : VOL.bgm) * vol.bgm / 100;
  function apply(kind, sec = 1.2) {
    if (!A || !ctx) return;
    const n = kind === 'bgm' && deduce && dd() ? dd() : want[kind];
    if (cur[kind] && cur[kind] !== n) setVol(track(cur[kind], true), 0, sec);
    cur[kind] = n;
    if (n) { const t = track(n, !/_ending$/.test(n)); if (t.el.ended) t.el.currentTime = 0; setVol(t, level(kind), sec); }
  }
  const refresh = (sec) => { apply('amb', sec); apply('bgm', sec); };
  function unlock() {
    if (ctx || !A) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
    if (!ctx) ctx = { currentTime: 0, none: true };  // Web Audio が無い環境では、要素の音量で鳴らす
    refresh(0.6);
  }
  if (A && !SIM) ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { capture: true }));
  return {
    get state() { return { on: anyOn(), vol: Object.assign({}, vol), bgm: cur.bgm || (deduce && dd() ? dd() : want.bgm), amb: cur.amb || want.amb, deduce, playing: Object.entries(tracks).filter(([, t]) => !t.el.paused && t.v > 0).map(([n, t]) => n + '@' + t.el.currentTime.toFixed(1)) }; },
    bgm(n) { if (SIM || !A || want.bgm === (n || null)) return; want.bgm = n || null; if (!hushT) apply('bgm'); },
    amb(n) { if (SIM || !A || want.amb === (n || null)) return; want.amb = n || null; if (!hushT) { apply('amb'); apply('bgm', 1.5); } },
    // 推理の場面：環境音を止め、推理の曲にする
    deduce(v) { if (SIM || !A || deduce === !!v) return; deduce = !!v; if (!hushT) refresh(0.8); },
    // 対峙の前など：すべての音を止め、間をおいてから次の曲
    hush(ms = 1800) {
      if (SIM || !A) return;
      clearTimeout(hushT);
      if (!ctx) return;
      Object.values(tracks).forEach(t => setVol(t, 0, 0.6));
      cur = { bgm: null, amb: null };
      // 次の曲はタップの最中に鳴らしはじめておく（iPhone はタップの外では新しく鳴らせない）
      const nb = deduce && dd() ? dd() : want.bgm, pre = [nb, want.amb].filter(Boolean).map(n => track(n, !/_ending$/.test(n)));
      pre.forEach(t => { t.hold = true; t.el.play().catch(() => {}); });
      hushT = setTimeout(() => { hushT = null; pre.forEach(t => { t.hold = false; }); refresh(1.5); }, ms);
    },
    se(n) {
      if (SIM || !A || !vol.se || !ctx) return;
      if (n === 'note') { const now = Date.now(); if (now - noteT < 400) return; noteT = now; }
      const key = 'se_' + (n === 'step' ? 'step_' + (A.step || 'asphalt') : n);
      const el = ses[key] || (ses[key] = new Audio(url(key)));
      el.volume = VOL.se * vol.se / 100; el.currentTime = 0; el.play().catch(() => {});
    },
    // 音量バー：kind は bgm / amb / se、v は 0〜100
    setVol(kind, v) { vol[kind] = Math.max(0, Math.min(100, Math.round(v))); save(); unlock(); refresh(0.2); },
    get vol() { return Object.assign({}, vol); },
    mute() { vol = { bgm: 0, amb: 0, se: 0 }; save(); refresh(0.3); },
    unlock() { unlock(); },
    get on() { return anyOn(); },
    get enabled() { return !!A; },
  };
})();
const chapterBgm = () => (ch().audio && ch().audio.bgm) || (D.audio && D.audio.bgm) || null;
const locAmb = () => { const C = ch().audio && ch().audio.amb, G = D.audio && D.audio.amb; return (C && S.loc in C ? C[S.loc] : G && G[S.loc]) || null; };
function soundBtn(el) {
  if (!snd.enabled) { el.remove(); return; }
  const draw = () => { el.textContent = snd.on ? '♪ 音' : '♪ 音なし'; el.classList.toggle('off', !snd.on); };
  el.onclick = e => { e.stopPropagation(); soundPanel(draw); };
  el._draw = draw;
  draw();
}
// 音の設定：BGM・環境音・効果音のバー。タイトルを開いたときにも出す（このタップで音が鳴りはじめる）
function soundPanel(onClose, first) {
  if (!snd.enabled || $('sndpop')) return;
  const m = document.createElement('div'); m.id = 'sndpop';
  const rows = [['bgm', 'BGM'], ['amb', '環境音'], ['se', '効果音']];
  m.innerHTML = `<div class="sheet" role="dialog" aria-label="音の設定"><h3>音の設定</h3>
    <p class="lead">${first ? 'このゲームは音が出ます。はじめは小さめの音量です。' : ''}あとから画面の上の「♪ 音」で変えられます。</p>
    ${rows.map(([k, n]) => `<label class="row"><span class="n">${n}</span><input type="range" min="0" max="100" step="5" data-k="${k}" value="${snd.vol[k]}" aria-label="${n}の音量"><span class="v" data-v="${k}">${snd.vol[k]}</span></label>`).join('')}
    <div class="btns"><button class="big back" data-a="mute">音を出さない</button><button class="big primary" data-a="ok">${first ? 'この音量にする' : 'とじる'}</button></div></div>`;
  const close = () => { m.remove(); document.querySelectorAll('#snd,.sndt').forEach(b => b._draw && b._draw()); if (onClose) onClose(); };
  m.querySelectorAll('input[type=range]').forEach(r => {
    r.oninput = () => { snd.setVol(r.dataset.k, +r.value); m.querySelector(`[data-v="${r.dataset.k}"]`).textContent = r.value; };
    if (r.dataset.k === 'se') r.onchange = () => snd.se('select');
  });
  m.querySelector('[data-a=mute]').onclick = () => { snd.mute(); close(); };
  m.querySelector('[data-a=ok]').onclick = () => { snd.unlock(); close(); };
  m.onclick = e => { if (e.target === m) close(); };
  document.body.appendChild(m);
}

// ---------- デバッグ：進み具合のフローチャート ----------
// URL に ?debug をつけたときだけ。章のデータから「何をすると → 何が手に入り → 何が開くか」を段階に分けて描く
const DEBUG = /[?&]debug\b/.test(location.search);
function flowGraph(cid) {
  const C = D.chapters[cid], cur = !!S && cid === S.chapter;
  const nodes = [], res = {};   // res: 資源（フラグ・もちもの・証言カード・場所）→ それを生む行動
  const locOf = o => Object.entries(C.locations).find(([, L]) => L.objs && o in L.objs);
  const pick = (r, v) => (r && r[v]) || [];
  // 条件のうち「そろうと進む」もの（! のついていないもの）
  const needs = src => {
    const out = [];
    if (!src) return out;
    const re = /(!?)\s*([a-z]+):([A-Za-z0-9_\-]+)(?:\s*(>=|<=|==|!=|>|<)\s*(-?\d+))?/g; let m;
    while ((m = re.exec(src))) {
      const [, neg, k, n, op, num] = m;
      if (neg || !['flag', 'has', 'var'].includes(k)) continue;
      if (k !== 'var') { out.push((k === 'has' ? 'item' : k) + ':' + n); continue; }
      // 数（何日目など）は「その値まで進んだか」で見る。小さいほう・ちがう値の条件は進みではないので数えない
      if (!op) out.push('var:' + n);
      else if (op === '==' || op === '>=') { if (+num > 0) out.push('var:' + n + '=' + num); }
      else if (op === '>') out.push('var:' + n + '=' + (+num + 1));
    }
    return out;
  };
  const gives = r => {
    const g = [];
    for (const e of (r && r.do) || []) {
      const i = e.indexOf(':'), k = e.slice(0, i), a = e.slice(i + 1);
      if (k === 'flag') g.push('flag:' + a);
      else if (k === 'give') g.push('item:' + a);
      else if (k === 'set') { const [n, v] = a.split('='); if (+v > 0) g.push('var:' + n + '=' + v); }
      else if (k === 'inc') g.push('var:' + a);
      else if (k === 'doc') g.push('doc:' + a);
      else if (['event', 'puzzle', 'choice', 'search', 'board'].includes(k)) g.push('go:' + k + ':' + a);
      else if (k === 'chapter' || k === 'ending') g.push(k + ':' + a);
    }
    if (r && r.cardId) g.push('card:' + r.cardId);
    return g;
  };
  const add = (kind, label, r, extra = {}) => {
    const g = (extra.gives || []).concat(gives(r));
    if (!g.length && !extra.keep) return;
    const n = { id: nodes.length, kind, label, text: (r && (r.text || r.card)) || '', need: needs(r && r.if).concat(extra.need || []), gives: g, rule: r, loc: extra.loc, p: extra.p, target: extra.target };
    nodes.push(n);
    g.forEach(x => { (res[x] = res[x] || []).push(n.id); });
  };
  // ルールの配列は、前のルールに当てはまらなかったときだけ次へ進む。
  // 前に「var:day==1」「var:day==2」だけのルールがあれば、後ろのルールは「3日目から」と読む
  const implied = (arr, i) => {
    const ex = {}, out = [];
    arr.slice(0, i).forEach(r => {
      const m = r && r.if && r.if.trim().match(/^var:([A-Za-z0-9_\-]+)\s*(==|<=|<)\s*(\d+)$/);
      if (!m) return;
      const [, n, op, v] = m; (ex[n] = ex[n] || new Set());
      if (op === '==') ex[n].add(+v); else for (let k = 0; k <= (op === '<=' ? +v : +v - 1); k++) ex[n].add(k);
    });
    for (const n in ex) { let L = 1; while (ex[n].has(L)) L++; if (L > 1) out.push('var:' + n + '=' + L); }
    return out;
  };
  const each = (e, fn) => { if (e == null || typeof e === 'string') return; if (Array.isArray(e)) e.forEach((r, i) => fn(r, implied(e, i))); else if (e.seq) e.seq.forEach(r => fn(r, [])); else fn(e, []); };
  const locNeed = l => (C.locations[l] && C.locations[l].unlock ? needs(C.locations[l].unlock) : []);
  const whereP = p => Object.keys(C.locations).filter(l => (C.locations[l].people || []).some(x => (typeof x === 'string' ? x : x.id) === p));
  // 章のはじめ・きっかけ・移動したとき
  if (C.start && C.start.do) add('start', '章のはじめ', C.start);
  (C.triggers || []).forEach(r => add('trigger', '条件がそろうと', r));
  (C.onMove || []).forEach(r => add('trigger', '移動したとき', r));
  // 聞く
  // その場所にその人がいる条件（"people": [{"id": ..., "if": ...}]）
  // （どこかに条件なしでいる人は、条件なしとみなす）
  const presentIf = p => {
    let c = null;
    for (const L of Object.values(C.locations)) for (const x of L.people || []) {
      if (x === p || (typeof x !== 'string' && x.id === p && !x.if)) return null;
      if (typeof x !== 'string' && x.id === p && !c) c = x.if;
    }
    return c;
  };
  // 今できるか：「ここにいる（here:）」は、行けば満たせるので満たしているとみなす
  const condAny = src => { try { return cond(String(src).replace(/here:[A-Za-z0-9_\-]+/g, 'true')); } catch (e) { return false; } };
  Object.entries(C.talk || {}).forEach(([p, e]) => {
    const ls = whereP(p), pi = presentIf(p), ln = (ls.length === 1 ? locNeed(ls[0]) : []).concat(needs(pi));
    if (e && e.topics) Object.entries(e.topics).forEach(([t, te]) => each(te, (r, im) => add('talk', `聞く：${short(p)}（${(D.topics && D.topics[t]) || t}）`, r, { need: ln.concat(im), loc: ls[0], p })));
    else each(e, (r, im) => add('talk', `聞く：${short(p)}`, r, { need: ln.concat(im), loc: ls[0], p }));
  });
  // 調べる
  Object.entries(C.look || {}).forEach(([o, e]) => {
    const L = locOf(o), name = L ? objName(L[1].objs[o]) : o;
    each(e, (r, im) => add('look', `調べる：${name}${L ? '（' + L[1].name + '）' : ''}`, r, { need: (L ? locNeed(L[0]) : []).concat(im), loc: L && L[0] }));
  });
  // 見せる
  Object.entries(C.show || {}).forEach(([it, byP]) => Object.entries(byP || {}).forEach(([p, e]) => each(e, (r, im) => add('show', `見せる：${(D.items && D.items[it]) || it} → ${short(p)}`, r, { need: ['item:' + it].concat(im), p }))));
  // 矛盾
  (C.contradictions || []).forEach(x => add('contra', `矛盾をつく：${x.p ? short(x.p) : ''}`, x, { need: (x.pairs || [])[0] ? x.pairs[0].map(c => 'card:' + c) : [], gives: ['flag:contra_' + x.id], keep: true }));
  // 謎・問い・検索・推理ボード・イベント（ほかの行動から開く）
  Object.entries(C.puzzles || {}).forEach(([id, P]) => add('puzzle', `謎：${P.label || id}`, P.success, { target: 'go:puzzle:' + id, keep: true }));
  Object.entries(C.choices || {}).forEach(([id, Q]) => (Q.options || []).filter(o => !(o.do || []).some(d => d === 'miss' || d.startsWith('choice:'))).forEach(o => add('choice', `選ぶ：${Q.label || id}「${o.label}」`, o, { target: 'go:choice:' + id, keep: true })));
  Object.entries(C.searches || {}).forEach(([id, Q]) => (Q.entries || []).forEach(en => add('search', `検索：${Q.label || id}「${(en.keys || [])[0] || ''}」`, en, { target: 'go:search:' + id, keep: true })));
  Object.entries(C.boards || {}).forEach(([id, B]) => add('board', `推理ボード：${B.title || id}`, B.success, { target: 'go:board:' + id, keep: true }));
  Object.entries(C.events || {}).forEach(([id, E]) => add('event', `イベント：${(E.pages[0] || '').replace(/\s+/g, ' ').slice(0, 18)}…`, E, { target: 'go:event:' + id, keep: true }));
  // 開くもの（go:）は、それを開く行動を「必要」にする
  nodes.forEach(n => { if (n.target) n.need.push(n.target); });
  // 段階：必要なものを生む行動の、いちばん深い段階 + 1
  const lv = {};
  const level = (n, stack = new Set()) => {
    if (n.id in lv) return lv[n.id];
    if (stack.has(n.id)) return 0;
    stack.add(n.id);
    let L = 0;
    n.need.forEach(x => (res[x] || []).forEach(j => { if (j !== n.id) L = Math.max(L, level(nodes[j], stack) + 1); }));
    stack.delete(n.id);
    return (lv[n.id] = L);
  };
  nodes.forEach(n => level(n));
  // いまの章なら、済んだ・今できる・まだ を決める
  const have = x => {
    const [k, a] = [x.slice(0, x.indexOf(':')), x.slice(x.indexOf(':') + 1)];
    if (k === 'flag') return !!S.f[a];
    if (k === 'item') return S.items.includes(a);
    if (k === 'var') { const [n, v] = a.split('='); return (S.v[n] || 0) >= (v === undefined ? 1 : +v); }
    if (k === 'card') return S.cards.some(c => c.id === a);
    if (k === 'doc') return (S.docs || []).includes(a);
    if (k === 'go') return (res[x] || []).some(j => done(nodes[j]));
    return false;
  };
  const doneMemo = {};
  const done = n => {
    if (n.id in doneMemo) return doneMemo[n.id];
    doneMemo[n.id] = false;
    const real = n.gives.filter(g => !g.startsWith('chapter:') && !g.startsWith('ending:'));
    return (doneMemo[n.id] = real.length > 0 && real.every(have));
  };
  nodes.forEach(n => {
    n.level = lv[n.id];
    if (!cur) { n.st = ''; return; }
    if (done(n)) n.st = 'done';
    else {
      let ok = n.need.every(have);
      if (ok && n.rule && n.rule.if) ok = condAny(n.rule.if);
      if (ok && n.kind === 'talk' && n.p) ok = Object.entries(C.locations).some(([l, L]) => (L.people || []).some(x => x === n.p || (typeof x !== 'string' && x.id === n.p && (!x.if || condAny(x.if)))) && condAny(L.unlock));
      else if (ok && n.loc && C.locations[n.loc].unlock) ok = condAny(C.locations[n.loc].unlock);
      n.st = ok ? 'now' : 'wait';
    }
  });
  return { nodes, res };
}
const flowWord = x => {
  const i = x.indexOf(':'), k = x.slice(0, i), a = x.slice(i + 1);
  if (k === 'flag') return a.startsWith('contra_') ? '矛盾' : 'フラグ ' + a;
  if (k === 'item') return 'もちもの「' + ((D.items && D.items[a]) || a) + '」';
  if (k === 'card') return '証言カード ' + a;
  if (k === 'doc') return '資料「' + ((D.docs && D.docs[a] && D.docs[a].title) || a) + '」';
  if (k === 'var') { const [n, v] = a.split('='); return v === undefined ? '数 ' + n : n + ' が ' + v + ' に'; }
  if (k === 'chapter') return '次の章へ';
  if (k === 'ending') return 'エンディング';
  if (k === 'go') return ({ event: 'イベント', puzzle: '謎', choice: '問い', search: '検索', board: '推理ボード' })[a.split(':')[0]] + 'が開く';
  return x;
};
function openFlow(cid = S.chapter) {
  const old = $('flow'); if (old) old.remove();
  const { nodes, res } = flowGraph(cid);
  const m = document.createElement('div'); m.id = 'flow';
  const lvls = [...new Set(nodes.map(n => n.level))].sort((a, b) => a - b);
  const count = st => nodes.filter(n => n.st === st).length;
  const cur = cid === S.chapter;
  m.innerHTML = `<div class="fl-head"><b>進み具合</b><select aria-label="章">${Object.entries(D.chapters).map(([k, C]) => `<option value="${k}"${k === cid ? ' selected' : ''}>${esc(C.label || k)} ${esc(C.title || '')}${k === S.chapter ? '（いま）' : ''}</option>`).join('')}</select><button class="fl-x" aria-label="とじる">×</button></div>
    <div class="fl-legend">${cur ? `<span class="done">済 ${count('done')}</span><span class="now">今できる ${count('now')}</span><span class="wait">まだ ${count('wait')}</span><label><input type="checkbox" class="fl-hide"> 済を隠す</label>` : '<span>いまの章ではないので、進み具合の色分けはありません</span>'}</div>
    <p class="fl-tip">上の段階から下へ進みます。押すと、その行動に必要なもの（上流）と、それで開くもの（下流）が光ります。</p>
    <div class="fl-cols">${lvls.map(L => `<div class="fl-col"><div class="fl-lv">段階 ${L + 1}</div>${nodes.filter(n => n.level === L).map(n => `<button class="fl-n ${n.st}" data-id="${n.id}"><span class="k">${esc(n.label)}</span>${n.text ? `<span class="t">${esc(n.text.replace(/\s+/g, ' ').slice(0, 40))}${n.text.length > 40 ? '…' : ''}</span>` : ''}<span class="g">→ ${esc([...new Set(n.gives.map(flowWord))].join('、'))}</span></button>`).join('')}</div>`).join('')}</div>`;
  document.body.appendChild(m);
  m.querySelector('.fl-x').onclick = () => m.remove();
  m.querySelector('select').onchange = e => openFlow(e.target.value);
  const hide = m.querySelector('.fl-hide');
  if (hide) hide.onchange = () => m.classList.toggle('hide-done', hide.checked);
  // 押した行動の上流・下流を光らせる
  const up = id => { const s = new Set(), go = i => nodes[i].need.forEach(x => (res[x] || []).forEach(j => { if (!s.has(j)) { s.add(j); go(j); } })); go(id); return s; };
  const down = id => { const s = new Set(), go = i => nodes[i].gives.forEach(x => nodes.forEach(n => { if (n.need.includes(x) && !s.has(n.id)) { s.add(n.id); go(n.id); } })); go(id); return s; };
  m.querySelectorAll('.fl-n').forEach(b => b.onclick = () => {
    const id = +b.dataset.id, u = up(id), d = down(id), on = b.classList.contains('sel');
    m.querySelectorAll('.fl-n').forEach(x => x.classList.remove('sel', 'up', 'down', 'dim'));
    if (on) return;
    m.querySelectorAll('.fl-n').forEach(x => { const i = +x.dataset.id; x.classList.add(i === id ? 'sel' : u.has(i) ? 'up' : d.has(i) ? 'down' : 'dim'); });
  });
}

// ---------- 行動 ----------
function main() {
  if (S.done || SIM) return;
  snd.deduce(false);
  const cmds = [['移動', moveMenu], ['聞く', askMenu], ['調べる', lookMenu], ['見せる', showMenu]];
  if (ch().think) cmds.push(['考える', think]);
  if (ch().accuse) cmds.push(['推理', accuseMenu]);
  cmds.push([nbLabel(), () => openNotebook(), 'nb main']);
  btns(cmds);
  updateNbBadge();
}
// 行けるようになった場所は、エンジンが自動で知らせる（シナリオに toast を書かなくてよい）
const openLocs = () => Object.keys(ch().locations).filter(k => avail(k));
let openBefore = null;
function act(rule, meta) {
  S.v.turns = (S.v.turns || 0) + 1;
  pending = {};
  openBefore = openLocs();
  actSaid = !!(rule && rule.text);
  if (rule) { run(rule.do); if (rule.text) say(rule.text, meta); if (rule.card) addCard(rule, meta); if (rule.note) addNote(rule, meta); }
  after();
}
// 取材ノート：ルールに "note": "要約" を付けると、伝記の取材メモとして残る
function addNote(rule, meta) {
  if (!S.notes) S.notes = [];
  if (S.notes.some(n => n.t === rule.note)) return;
  S.notes.push({ c: S.chapter, p: (meta && meta.p) || null, t: rule.note });
  S.v.notes = S.notes.length;
  toast('取材ノートに書き留めた'); snd.se('note');
}
// 証言カード：ルールに "card": true（その文をそのまま）か "card": "要約" を付けると記録される
function addCard(rule, meta) {
  const t = typeof rule.card === 'string' ? rule.card : rule.text;
  if (S.cards.some(c => c.t === t)) return;
  S.cards.push({ id: rule.cardId || null, c: S.chapter, l: S.loc, p: (meta && meta.p) || null, t, pin: false });
  toast('証言カードに記録した'); snd.se('note');
  updateNbBadge();
}
// 文を出した直後に場面・問い・謎へ移るときは、「つぎへ」をはさんで文を読めるようにする
// （まちがえて選び直すときは、返事と選択肢を一緒に出したいので、はさまない）
let actSaid = false;
// 聞いたあとは同じ人の話題（話題のない人なら「だれに聞く？」）に、調べたあとは「何を調べる？」に戻る。毎回押し直さなくてよい
let backTo = null;
function resumeMenu(rs) {
  if (!rs || SIM || S.done) return main();
  snd.deduce(false);
  if (rs === 'look') return objsHere().length ? lookMenu() : main();
  const ps = here();
  if (rs.startsWith('topic:')) {
    const who = rs.slice(6);
    if (ps.includes(who) && (topicsOf(who) || []).length) return talk(who);
  }
  if (ps.length) return askMenu();
  main();
}
function after() {
  const p = pending; pending = {};
  const rs = backTo; backTo = null;
  const said = actSaid && !SIM; actSaid = false;
  const gate = (id, fn) => (said && (id === null || reask !== id)) ? nextBtn(fn) : fn();
  if (openBefore) {
    const now = openLocs().filter(k => !openBefore.includes(k));
    if (now.length) toast(now.map(k => ch().locations[k].name).join('・') + 'に行けるようになった');
    openBefore = null;
  }
  if (p.goto) { S.loc = p.goto; renderScene(); }
  // 自動の進行：条件がそろったトリガーを1つだけ動かす（トリガーには once 用のフラグを do に入れておく）
  if (!p.event && !p.ending && !p.chapter && !p.puzzle && !p.choice && !p.search) {
    const t = (ch().triggers || []).find(r => cond(r.if));
    if (t) { pending = {}; run(t.do); Object.assign(p, pending); pending = {}; }
  }
  autosave();
  if (p.event) return gate(null, () => playEvent(p.event));
  if (SIM && p.puzzle) { S.simPuzzle = p.puzzle; return; }
  if (SIM && p.board) { S.simBoard = p.board; return; }
  if (!p.choice && !p.search) reask = null;
  if (SIM && p.search) { S.simSearch = p.search; return; }
  if (p.search) return gate(p.search, () => openSearch(p.search));
  if (SIM && p.choice) { S.simChoice = p.choice; return; }
  if (p.choice) return gate(p.choice, () => openChoice(p.choice));
  if (p.board) return gate(null, () => openBoard(p.board));
  if (SIM && (p.ending || p.chapter)) { S.simEnd = p.ending ? 'ending:' + p.ending : 'chapter:' + p.chapter; return; }
  if (p.puzzle) return gate(null, () => openPuzzle(p.puzzle));
  if (p.ending) return nextBtn(() => ending(p.ending));
  if (p.chapter) return nextBtn(() => startChapter(p.chapter));
  resumeMenu(rs);
}
const avail = id => cond(ch().locations[id].unlock);
function moveMenu() {
  const ids = Object.keys(ch().locations).filter(k => k !== S.loc && avail(k));
  btns([...ids.map(k => [ch().locations[k].name, () => moveTo(k)]), back], 'どこへ行く？');
}
function moveTo(id) {
  snd.se('step');
  S.loc = id; S.v.turns = (S.v.turns || 0) + 1; pending = {}; openBefore = openLocs();
  runAll(ch().onMove);
  renderScene();
  const r = resolve(loc().arrive, 'arrive:' + id);
  if (r) { run(r.do); say(r.text); }
  after();
}
// 話した回数：talk:人物 は全章の合計（推理で選べる人に使う）、talkc:章:人物 はその章の回数（talked: 条件に使う）
function bumpTalk(p) {
  S.seq['talk:' + p] = (S.seq['talk:' + p] || 0) + 1;
  const k = 'talkc:' + S.chapter + ':' + p; S.seq[k] = (S.seq[k] || 0) + 1;
}
// まだ聞いていない大事な話があるか（次に返ってくる文が証言カードになるもので、まだ一度も表示されていなければ「ある」）
function peekEntry(e, key) {
  if (e == null) return null;
  if (typeof e === 'string') return { text: e };
  if (Array.isArray(e)) return e.find(r => cond(r.if)) || null;
  if (e.seq) return e.seq[Math.min(S.seq[S.chapter + '|' + key] || 0, e.seq.length - 1)];
  return cond(e.if) ? e : null;
}
const peekTalk = p => peekEntry((ch().talk || {})[p], 'talk:' + p);
// 話題ごとの会話：talk の値を {"topics": {話題id: 返事}} にすると、聞くときに話題を選べる
const topicsOf = p => { const e = (ch().talk || {})[p]; return e && e.topics ? Object.keys(e.topics).filter(t => peekEntry(e.topics[t], 'talk:' + p + ':' + t)) : null; };
function hasNewTalk(p, heard) {
  const e = (ch().talk || {})[p];
  const rs = e && e.topics ? Object.keys(e.topics).map(t => peekEntry(e.topics[t], 'talk:' + p + ':' + t)) : [peekTalk(p)];
  return rs.some(r => r && r.text && r.card && !heard.has(r.text));
}
const heardSet = () => new Set(S.log.map(e => e.t));
// 聞いている途中でも手帳を開けるようにする（増えた証言カードの数も見える）
function askMenu() { btns([...here().map(p => [person(p).name, () => talk(p)]), nbB(), back], 'だれに聞く？'); updateNbBadge(); }
// 助手（game.json の assistant）に聞くと、この場所でまだ大事な話を聞いていない人を教えてくれる
function assistantHint(tmpl) {
  const heard = heardSet();
  // 同じ人の聞き残しを教えるのは、その章で1回だけ（2回目からはふだんのヒントに進む）
  const q = here().find(p => p !== AS() && hasNewTalk(p, heard) && !S.seq['ahint:' + S.chapter + ':' + p]);
  if (!q) return null;
  S.seq['ahint:' + S.chapter + ':' + q] = 1;
  return { text: fmt(tmpl || ch().assistantHint || D.assistantHint || '{name}さん、まだ何か知っていそうですよ。', { name: short(q) }) };
}
function talk(p) {
  const e = (ch().talk || {})[p], key = 'talk:' + p;
  const hint = p === AS() && !(e && e.topics) ? assistantHint() : null;
  if (hint) { bumpTalk(p); S.v.hints = (S.v.hints || 0) + 1; backTo = 'ask'; return act(hint, { p }); }
  if (e && e.topics) {
    const ts = topicsOf(p);
    btns([...ts.map(t => [(D.topics && D.topics[t]) || t, () => talkTopic(p, t)]), nbB(), ['もどる', askMenu, 'back']], person(p).name + 'に、何を聞く？');
    return updateNbBadge();
  }
  backTo = 'ask';
  if (tieredHint(e, p, key)) return;
  const r = resolve(e, key);
  bumpTalk(p);
  act(r || { text: fmt(ch().talkDefault || D.talkDefault || '{name}は、何も話してくれない。', { name: short(p) }) }, { p });
}
// 段階式のヒント：ルールに "hints": [ぼかした文, …, はっきりした文] を書くと、同じ段階で聞くたびに次の文になる
function tieredHint(e, p, key) {
  if (!Array.isArray(e)) return false;
  const i = e.findIndex(r => cond(r.if)), r = e[i];
  if (!r || !r.hints) return false;
  const hk = 'hint:' + S.chapter + ':' + key + ':' + i, lv = S.seq[hk] || 0;
  S.seq[hk] = lv + 1; bumpTalk(p);
  S.v.hints = (S.v.hints || 0) + 1;
  act({ text: r.hints[Math.min(lv, r.hints.length - 1)], do: r.do }, { p });
  return true;
}
function talkTopic(p, t) {
  const e = ch().talk[p].topics[t], key = 'talk:' + p + ':' + t;
  backTo = 'topic:' + p;
  if (p === AS() && t === HT()) {
    const h = assistantHint();
    if (h) { bumpTalk(p); S.v.hints = (S.v.hints || 0) + 1; return act(h, { p }); }
  }
  if (tieredHint(e, p, key)) return;
  const r = resolve(e, key);
  bumpTalk(p);
  act(r || { text: fmt(ch().talkDefault || D.talkDefault || '{name}は、何も話してくれない。', { name: short(p) }) }, { p });
}
// 調べられる物。"objs" の値は名前か {"name": ..., "if": 条件}（条件が合わないあいだは一覧に出さない。運び出した遺体など）
const objName = v => (typeof v === 'string' ? v : v.name);
const objsHere = () => Object.entries(loc().objs || {}).filter(([, v]) => typeof v === 'string' || !v.if || cond(v.if));
function lookMenu() { btns([...objsHere().map(([o, v]) => [objName(v), () => look(o)]), nbB(), back], '何を調べる？'); updateNbBadge(); }
// 調べたあとも「何を調べる？」に残る
function look(o) {
  backTo = 'look';
  const r = resolve((ch().look || {})[o], 'look:' + S.loc + ':' + o);
  act(r || { text: '特に変わったところはない。' });
}
function showMenu() {
  if (!S.items.length) { say('見せるものを何も持っていない。'); return; }
  btns([...S.items.map(i => [D.items[i], () => {
    btns([...here().map(p => [person(p).name, () => showTo(i, p)]), ['もどる', showMenu, 'back']], D.items[i] + 'をだれに見せる？');
  }]), back], '何を見せる？');
}
function showTo(i, p) {
  const r = resolve(((ch().show || {})[p] || {})[i], 'show:' + p + ':' + i);
  act(r || { text: fmt(ch().showDefault || D.showDefault || '{name}は、特に心当たりがないようだ。', { name: short(p) }) }, { p });
}
const accusable = () => ch().accuse.suspects.filter(p => (S.seq['talk:' + p] || 0) > 0);
function accuseMenu() {
  snd.deduce(true);
  const A = ch().accuse;
  // 一度でも話を聞いた人だけが選べる
  const list = accusable();
  if (!list.length) { say(A.noneText || 'まだ、だれにも話を聞いていない。'); return; }
  btns([...list.map(p => [short(p), () => accuse(p)]), back], A.prompt || '犯人はだれだ？');
}
function accuse(p) {
  const A = ch().accuse;
  if (p === A.culprit) {
    const miss = (A.required || []).filter(x => !cond(x.if)).map(x => '・' + x.label);
    if (miss.length) return act({ text: fmt(A.missingText, { missing: miss.join('\n'), name: short(p) }) });
    autosave();
    if (A.do) return act({ text: A.successText, do: A.do });   // 例：第8章の解決編へ（chapter:ch8）
    if (SIM) { S.simEnd = 'ending:' + A.ending; return; }
    return ending(A.ending);
  }
  act(resolve((A.wrong || {})[p], 'accuse:' + p) || { text: A.wrongDefault || 'ちがうようだ。', do: ['miss'] });
}

// ---------- イベント（何ページか続けて見せる場面） ----------
// 章の events: {id: {bg, place, pages: [文...], do: [最後に行う効果]}}
function playEvent(id) {
  const E = ch().events[id];
  if (SIM) { E.pages.forEach(t => say(t)); pending = {}; openBefore = openLocs(); run(E.do); return after(); }
  if (E.bg || E.place) setScene(E.bg || loc().bg, E.place || loc().name, ch().label || '現在地');
  if (E.hush) snd.hush(typeof E.hush === 'number' ? E.hush : undefined);
  if (E.bgm) snd.bgm(E.bgm);
  if ('amb' in E) snd.amb(E.amb);
  let k = 0;
  const next = () => {
    if (k < E.pages.length) { say(E.pages[k++]); nextBtn(next); return; }
    if (E.bgm && !E.bgmKeep) snd.bgm(chapterBgm());
    pending = {}; openBefore = openLocs(); run(E.do);
    renderScene(); after();
  };
  next();
}

// ---------- 考える（助手のいない章のヒント） ----------
// 章の think：ルール（hints も使える）。まず「まだ話を聞いていない人」を thinkHint の文で教え、なければ think の文
function think() {
  const h = assistantHint(ch().thinkHint);
  if (h) { S.v.hints = (S.v.hints || 0) + 1; return act(h); }
  const e = ch().think;
  if (Array.isArray(e)) {
    const i = e.findIndex(r => cond(r.if)), r = e[i];
    if (r && r.hints) {
      const hk = 'hint:' + S.chapter + ':think:' + i, lv = S.seq[hk] || 0;
      S.seq[hk] = lv + 1; S.v.hints = (S.v.hints || 0) + 1;
      return act({ text: r.hints[Math.min(lv, r.hints.length - 1)], do: r.do });
    }
  }
  act(resolve(e, 'think') || { text: '…いまは、考えがまとまらない。' });
}

// ---------- 選択式の問い ----------
// 章の choices: {id: {prompt, label, options: [{label, text, do, ...ルール}]}}。選んだ選択肢のルールを行う
// まちがいの選択肢は do に "miss" と "choice:同じid" を入れると、もう一度選び直しになる
function openChoice(id) {
  snd.deduce(true);
  const Q = ch().choices[id];
  // 選び直しのときは、まちがいの返事を残したまま選択肢だけ出す
  if (Q.prompt && reask !== id) say(Q.prompt, { nolog: true });
  reask = null;
  // 選ぶ前に手帳（資料・証言カード）を見返せる
  btns([...Q.options.map((o, i) => [o.label, () => choose(id, i)]), nbB()], Q.label || '選ぶ');
}
let reask = null;
function choose(id, i) {
  S.simChoice = null; reask = id;
  const o = ch().choices[id].options[i];
  act(o);
}

// ---------- 記事の検索 ----------
// 章の searches: {id: {label, prompt, placeholder, entries: [{keys: [ことば...], ...ルール}], none}}。効果 search:id で出す
// 入力した言葉に keys のどれかが含まれていれば、そのルールを行う（最初に当たったもの。if も使える）
// 空白を無視し、全角を半角にそろえ、数字の頭の0を取る（「10月08日」→「10月8日」）
const norm = t => String(t).normalize('NFKC').replace(/\s/g, '').replace(/(^|\D)0+(?=\d)/g, '$1');
function searchAnswer(id, q) {
  const Q = ch().searches[id]; S.simSearch = null;
  // 見つからないときは、その返事を残したまま入力欄を出し直す
  if (!norm(q)) { reask = id; return act({ text: Q.empty || '何も入力していない。', do: ['search:' + id] }); }
  S.v.searches = (S.v.searches || 0) + 1;
  const hit = Q.entries.find(e => cond(e.if) && e.keys.some(k => norm(q).includes(norm(k))));
  if (hit) return act(hit);
  reask = id; act({ text: fmt(Q.none || '「{q}」の記事は見つからなかった。', { q }), do: ['search:' + id] });
}
function openSearch(id) {
  snd.deduce(true);
  const Q = ch().searches[id];
  if (Q.prompt && reask !== id) say(Q.prompt, { nolog: true });
  reask = null;
  const c = $('cmd'); c.innerHTML = ''; c.className = 'list';
  c.insertAdjacentHTML('beforeend', `<div class="label">${esc(Q.label || 'ことばで探す')}</div><input id="sq" type="search" enterkeyhint="search" placeholder="${esc(Q.placeholder || '例：会社の名前')}" autocomplete="off">`);
  const go = () => searchAnswer(id, $('sq').value);
  $('sq').onkeydown = e => { if (e.key === 'Enter') go(); };
  const sb = btn('探す', go, 'primary'); sb.onclick = go; c.appendChild(sb);
  const f = document.createElement('div'); f.className = 'foot';
  f.appendChild(btn(...nbB())); f.appendChild(btn('やめる', () => main(), 'back')); c.appendChild(f);
}

// ---------- 謎解き（番号入力） ----------
function openPuzzle(id) {
  snd.deduce(true);
  const P = ch().puzzles[id]; let code = '';
  const disp = () => fmt(P.display, { code: code.padEnd(P.length, '＊') });
  say(P.prompt + '\n' + disp());
  const draw = () => btns([...'1234567890'.split('').map(d => [d, () => {
    code += d;
    if (code.length < P.length) { say(disp()); draw(); }
    else puzzleAnswer(id, code);
  }]), nbB(), ['やめる', () => { say(P.cancel || 'やめた。'); main(); }, 'back']], P.label, 'pad');
  draw();
}

function puzzleAnswer(id, code) {
  const P = ch().puzzles[id];
  S.simPuzzle = null;
  // answers：計算の答えで、少しの丸めの違いも正解にしたいとき（例：["1740", "1745", "1750"]）
  if (code === P.answer || (P.answers || []).includes(code)) act(P.success); else act({ text: fmt(P.fail, { code }) });
}

// ---------- 推理ボード（消去法） ----------
// 章の boards: {id: {suspects: [人物id], conditions: [{id, label, keeps: [条件に合う人物id], correct}], culprit,
//   success: ルール, wrong: {none, many, decoy}}}
// 条件を選ぶたびに、合わない人が外れる。正しい条件をすべて選んで犯人ひとりが残れば成功
const boardLeft = (B, sel) => B.suspects.filter(p => sel.every(cid => B.conditions.find(c => c.id === cid).keeps.includes(p)));
function boardSubmit(id, sel) {
  const B = ch().boards[id];
  S.simBoard = null;
  const left = boardLeft(B, sel);
  // 正しい条件だけで犯人ひとりが残れば成功（犯人に合わない「まちがった条件」を選ぶと、犯人は必ず外れる）
  const ok = left.length === 1 && left[0] === B.culprit && sel.every(cid => B.conditions.find(c => c.id === cid).correct);
  if (ok) return act(B.success);
  const why = !left.length ? B.wrong.none : left.length > 1 ? B.wrong.many : B.wrong.decoy;
  act({ text: why, do: ['miss'] });
}
function openBoard(id) {
  snd.deduce(true);
  const B = ch().boards[id];
  let sel = [];
  const draw = () => {
    closeModal();
    const left = boardLeft(B, sel);
    const m = document.createElement('div'); m.id = 'modal';
    m.innerHTML = `<div class="sheet board"><div class="eyebrow">推理ボード</div><h3>${esc(B.title || '犯人の条件')}</h3><p class="nb-note">${esc(B.lead || '')}</p>
      <div class="b-sus">${B.suspects.map(p => `<span class="${left.includes(p) ? '' : 'out'}">${esc(short(p))}</span>`).join('')}</div>
      <div class="b-con"></div><div class="row2"></div></div>`;
    const box = m.querySelector('.b-con');
    B.conditions.forEach(c => {
      const b = document.createElement('button'); b.className = 'row' + (sel.includes(c.id) ? ' on' : '');
      b.innerHTML = `<span class="t">${sel.includes(c.id) ? '☑' : '☐'} ${esc(c.label)}</span>`;
      b.onclick = () => { sel = sel.includes(c.id) ? sel.filter(x => x !== c.id) : [...sel, c.id]; draw(); };
      box.appendChild(b);
    });
    const r2 = m.querySelector('.row2');
    const go = document.createElement('button'); go.className = 'big primary'; go.textContent = `この条件で推理する（${sel.length}つ）`;
    go.disabled = !sel.length; go.onclick = () => { closeModal(); boardSubmit(id, sel); };
    const no = document.createElement('button'); no.className = 'big'; no.textContent = 'あとで';
    no.onclick = () => { closeModal(); main(); };
    // 推理ボードのまま記録を見返せる（とじるとボードに戻る）
    const nb = document.createElement('button'); nb.className = 'big nbk'; nb.textContent = nbLabel() + 'を見る';
    nb.onclick = () => { nbAfter = () => draw(); openNotebook(); };
    r2.append(no, nb, go);
    document.body.appendChild(m);
  };
  draw();
}

// ---------- 章 ----------
// 視点が変わる章："freshNotebook": true で、証言カード・もちもの・資料を空にする（会話ログとメモは残す）
function resetFor(C) { if (C.freshNotebook) { S.cards = []; S.items = []; S.docs = []; S.seenCards = 0; } }
function startChapter(id) {
  S.chapter = id;
  const C = ch();
  S.loc = C.start.loc;
  resetFor(C);
  store.set('chap:' + id, snapshot((C.label ? C.label + ' ' : '') + (C.title || '') + 'のはじめ'));
  // start.do：章のはじめにすぐ行う効果（解決編の場面を始める など）
  const go = () => { if (C.audio && C.audio.hush) snd.hush(); snd.bgm(chapterBgm()); renderScene(); say(C.start.text); autosave(); main(); if (C.recap) showRecap(); if (C.start.do) { pending = {}; openBefore = openLocs(); run(C.start.do); actSaid = true; after(); } };
  if (C.card === false) return go();
  const card = document.createElement('div'); card.id = 'card';
  card.innerHTML = `<div class="n">${C.label || ''}</div><div class="t">${C.title || ''}</div><div class="tap">タップしてすすむ</div>`;
  card.onclick = () => { card.remove(); go(); };
  document.body.appendChild(card);
}

// ---------- エンディング ----------
function ending(id) {
  const E = D.endings[id];
  S.done = true; if (E.clear !== false) markCleared(); autosave();
  snd.deduce(false); snd.amb(E.amb || null); snd.bgm(E.bgm || (D.audio && D.audio.ending) || null);
  setScene(E.bg, E.place, E.small);
  $('here').innerHTML = '';
  let k = 0;
  const next = () => {
    if (k < E.pages.length) { say(E.pages[k++]); nextBtn(next); return; }
    setScene(E.finalBg || E.bg, E.finalPlace || '', E.finalSmall || '');
    const rank = ((E.ranks || []).find(r => cond(r.if)) || {}).label || '';
    say(fmt(E.result, { ...S.v, turns: S.v.turns, miss: S.v.miss || 0, rank, time: hm(S.v.playSec), hints: S.v.hints || 0, notes: (S.notes || []).length }));
    // クリアしたら作品選択へ（新しく開いた作品は、作品選択で知らせる）
    btns([D.hub ? ['作品選択へ', e => leave(D.hub, e.currentTarget), 'primary'] : ['タイトルへ', toTitle, 'primary']], null, 'one');
  };
  next();
}

// ---------- メニュー（セーブ・ロード） ----------
function modal(title, rows) {
  closeModal();
  const m = document.createElement('div'); m.id = 'modal';
  m.innerHTML = `<div class="sheet"><h3>${title}</h3></div>`;
  const sh = m.firstChild;
  rows.forEach(r => {
    const b = document.createElement('button'); b.className = 'row';
    b.innerHTML = `<span class="t">${r.t}<small>${r.s || ''}</small></span>`;
    if (r.off) b.setAttribute('disabled', ''); else b.onclick = r.fn;
    sh.appendChild(b);
  });
  const c = document.createElement('button'); c.className = 'close'; c.textContent = 'とじる'; c.onclick = closeModal; sh.appendChild(c);
  m.onclick = e => { if (e.target === m) closeModal(); };
  document.body.appendChild(m);
}
const closeModal = () => { const m = $('modal'); if (m) m.remove(); };
const when = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const desc = s => s ? `${s.label}・${when(s.at)}` : 'からっぽ';
function saveMenu() {
  modal('セーブ', [...Array(SLOTS)].map((_, i) => {
    const s = store.get('slot' + i);
    return { t: 'スロット' + (i + 1), s: desc(s), fn: () => { store.set('slot' + i, snapshot()); closeModal(); toast('スロット' + (i + 1) + 'にセーブした'); } };
  }));
}
function loadList() {
  const rows = [];
  const a = store.get('auto');
  rows.push({ t: 'オートセーブ', s: desc(a), off: !a || a.state.done, fn: () => resume(a) });
  for (const id of Object.keys(D.chapters)) {
    const c = store.get('chap:' + id);
    if (c) rows.push({ t: c.label, s: when(c.at), fn: () => resume(c) });
  }
  for (let i = 0; i < SLOTS; i++) { const s = store.get('slot' + i); rows.push({ t: 'スロット' + (i + 1), s: desc(s), off: !s, fn: () => resume(s) }); }
  return rows;
}
function hasAnySave() { return loadList().some(r => !r.off); }
soundBtn($('snd'));
if (DEBUG) { const fb = document.createElement('button'); fb.className = 'pill dbg'; fb.textContent = '進み具合'; fb.onclick = () => openFlow(); $('hdr-r').prepend(fb); }
$('menu').onclick = () => {
  if (!S) return;
  modal('メニュー', [
    { t: 'セーブ', s: '今の状態をスロットに保存', off: S.done, fn: saveMenu },
    { t: 'ロード', s: 'オートセーブ・章のはじめ・スロットから', fn: () => modal('ロード', loadList()) },
    { t: 'プレイ時間', s: hm(S.v.playSec) + '（操作のない時間は数えません）', off: true },
    { t: 'タイトルへ', s: '進み具合はオートセーブされています', fn: () => { closeModal(); toTitle(); } },
  ]);
};

function resume(snap) {
  closeModal();
  S = JSON.parse(JSON.stringify(snap.state));
  $('title').classList.add('hide'); $('prologue').classList.add('hide'); $('wrap').classList.remove('hide');
  if (S.done) { toTitle(); return; }
  for (const k of ['log', 'cards']) if (!S[k]) S[k] = [];
  S.log = S.log.map(e => Array.isArray(e) ? { c: e[0], l: e[1], p: null, t: e[2] } : e);
  if (S.memo == null) S.memo = '';
  snd.bgm(chapterBgm()); renderScene(); say(D.resumeText || '捜査を再開した。', { nolog: true }); autosave(); main(); updateNbBadge();
  if (ch().recap) showRecap();
}

// ---------- ほかのページへ移る ----------
// 押したことが分かるように、ボタンと画面に「開いています…」を出してから移る
function leave(url, btn) {
  if (btn) { btn.classList.add('going'); btn.textContent = '開いています…'; }
  document.body.classList.add('leaving');
  setTimeout(() => { location.href = url + (DEBUG && !/[?&]debug/.test(url) ? (url.includes('?') ? '&' : '?') + 'debug' : ''); }, 150);
}

// ---------- タイトル ----------
function toTitle() {
  closeModal();
  const T = D.titleScreen, t = $('title');
  $('wrap').classList.add('hide'); $('prologue').classList.add('hide');
  const a = store.get('auto');
  t.innerHTML = `<div class="eyebrow">${T.eyebrow || ''}</div><h1>${T.title}</h1><p>${T.lead || ''}</p>`;
  snd.deduce(false); snd.amb(null); snd.bgm(D.audio && D.audio.title);
  const add = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'big' + (cls ? ' ' + cls : ''); b.textContent = label; b.onclick = fn; t.appendChild(b); };
  // 前の作品をクリアしていないと遊べない（game.json の requires: [{id, title}]）。URL を直接開いたとき用
  let cl = []; try { cl = JSON.parse(localStorage.getItem('mg:cleared') || '[]'); } catch (e) {}
  const need = (D.requires || []).filter(r => !cl.includes(r.id));
  if (need.length && !DEBUG) {   // デバッグ（?debug）では鍵をかけない
    t.insertAdjacentHTML('beforeend', `<p class="lock">${need.map(r => '『' + r.title + '』').join('・')}をクリアすると遊べます。</p>`);
    if (D.hub) add('作品選択へ', e => leave(D.hub, e.currentTarget), 'primary');
    t.classList.remove('hide');
    return;
  }
  add('はじめから', newGame, 'primary');
  if (snd.enabled) { const sb = document.createElement('button'); sb.className = 'pill sndt'; t.appendChild(sb); soundBtn(sb); }
  if (a && !a.state.done) add('つづきから', () => resume(a));
  if (hasAnySave()) add('ロード', () => modal('ロード', loadList()));
  if (D.hub) add('作品選択へ', e => leave(D.hub, e.currentTarget));
  if (DEBUG) debugJumpUI(t);
  if (D.audio && D.audio.credit) t.insertAdjacentHTML('beforeend', `<p class="credit">${esc(D.audio.credit)}</p>`);
  t.classList.remove('hide');
}
function newGame() {
  S = fresh();
  const P = D.prologue;
  $('title').classList.add('hide');
  if (!P) return begin();
  const pr = $('prologue');
  pr.innerHTML = `<div class="card"><div class="eyebrow" style="text-align:center">${P.eyebrow || 'PROLOGUE'}</div><h2>${P.title || 'あらすじ'}</h2>`
    + P.paragraphs.map((x, i) => `<p${i ? ' style="margin-top:10px"' : ''}>${x}</p>`).join('')
    + (P.cast ? `<div class="cast">${P.cast.map(([n, d]) => `<div><span>${n}</span>${d}</div>`).join('')}</div>` : '')
    + `<div style="text-align:center;margin-top:22px"><button class="big primary" id="bGo">${P.button || 'はじめる'}</button></div></div>`;
  pr.classList.remove('hide');
  $('bGo').onclick = () => { pr.classList.add('hide'); begin(); };
}
function begin() { $('wrap').classList.remove('hide'); startChapter(D.start); }

// デバッグ：好きな章から始める。前の章は、いちばん近い道筋で自動で遊んで終わりまで進め、
// 手に入れたもの（もちもの・カード・フラグ）を持ったまま、その章のはじめに立つ
async function debugReach(target, onStep) {
  let cur = D.start, prev = null;
  try {
    while (cur !== target) {
      onStep && onStep(cur);
      await new Promise(r => setTimeout(r, 0));
      // 手当たり次第に遊ぶ（tools/verify.py のランダムプレイと同じ）。章の終わりに着くまで何度かやり直す
      let end = null;
      for (let run = 0; run < 40 && !end; run++) {
        sim.begin(cur, prev);
        for (let n = 0; n < 6000 && !S.simEnd; n++) {
          const acts = sim.actions(); if (!acts.length) break;
          const keep = sim.get();
          try { sim.apply(acts[Math.floor(Math.random() * acts.length)]); } catch (e) { sim.set(keep); continue; }
          S.log = [];
          if (n % 400 === 399) await new Promise(r => setTimeout(r, 0));
        }
        if (String(S.simEnd).startsWith('chapter:')) end = sim.get();
      }
      if (!end) throw new Error(cur + ' の終わりまで進めませんでした');
      prev = end; cur = end.simEnd.slice(8);
    }
  } finally { SIM = false; }
  return prev;
}
function debugJumpUI(t) {
  const box = document.createElement('div'); box.className = 'dbg-jump';
  box.innerHTML = `<div class="lb">デバッグ：章を選んで始める</div><select>${Object.entries(D.chapters).map(([k, C]) => `<option value="${k}">${esc(C.label || k)} ${esc(C.title || '')}</option>`).join('')}</select><button class="big">この章から始める</button><p class="st">前の章は自動で遊んで進めます（つづきのデータは上書きされます）</p>`;
  const sel = box.querySelector('select'), btn = box.querySelector('button'), st = box.querySelector('.st');
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const id = sel.value;
      const prev = id === D.start ? null : await debugReach(id, c => { st.textContent = `${D.chapters[c].label || c} を自動で進めています…`; });
      S = prev ? JSON.parse(JSON.stringify(prev)) : fresh();
      delete S.simEnd; delete S.simPuzzle; delete S.simBoard; delete S.simChoice; delete S.simSearch;
      $('title').classList.add('hide'); $('wrap').classList.remove('hide');
      startChapter(id);
    } catch (e) { st.textContent = String(e.message || e); btn.disabled = false; }
  };
  t.appendChild(box);
}



// ---------- 矛盾をつく ----------
// 章の contradictions: [{id, pairs: [[カードid, カードid], ...], if, text, do}]
function contradict(ids) {
  const same = (p) => (p[0] === ids[0] && p[1] === ids[1]) || (p[0] === ids[1] && p[1] === ids[0]);
  const list = ch().contradictions || [];
  const hit = list.find(x => x.pairs.some(same));
  if (hit && S.f['contra_' + hit.id]) return act({ text: hit.doneText || 'その食い違いは、もう明らかにした。' });
  if (hit && cond(hit.if)) {
    // 崩した証言カードに印を付け、認めた内容を新しいカードにする
    S.cards.forEach(c => { if (c.id && ids.includes(c.id) && hit.broken !== false && (hit.breaks || [ids[0], ids[1]]).includes(c.id)) c.broken = true; });
    return act({ text: hit.text, do: [...(hit.do || []), 'flag:contra_' + hit.id], card: hit.card, cardId: hit.cardId }, { p: hit.p || null });
  }
  if (hit) return act({ text: hit.notYet || 'いまは、それをつきつける相手がいない。' });
  act({ text: ch().contradictWrong || D.contradictWrong || 'その2つは、食い違っていないようだ…。', do: ['miss'] });
}

// ---------- 捜査手帳 ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const placeName = (c, l) => { const C = D.chapters[c]; return (C && C.locations[l] && C.locations[l].name) || ''; };
const speaker = e => e.p ? person(e.p).name : ((e.t.match(/^([^「\n]{1,10})「/) || [])[1] || '');
function updateNbBadge() {
  if (SIM) return;
  const e = $('nbn'); if (!e) return;
  const n = S ? S.cards.length - (S.seenCards || 0) : 0;
  e.textContent = n > 0 ? n : '';
  e.style.display = n > 0 ? '' : 'none';
}
let nbTab = 'cards', nbQ = { who: '', place: '', ch: '', pin: false, q: '' };
// 記録をとじたあとに戻す画面（推理ボードから開いたとき）
let nbAfter = null;
function openNotebook(tab) {
  if (tab) nbTab = tab;
  closeModal();
  const old = $('nbook');
  // 同じタブを描き直すとき（カードを選んだ、ピン留めした）は、読んでいた位置を保つ
  const keep = old && old.dataset.tab === nbTab ? old.querySelector('.nb-body').scrollTop : 0;
  if (old) old.remove();
  const m = document.createElement('div'); m.id = 'nbook'; m.dataset.tab = nbTab;
  const tabs = [['cards', '証言カード'], ...(D.notes ? [['notes', D.notes.tab || '取材ノート']] : []), ['log', '会話ログ'], ...(D.docs ? [['docs', '資料']] : []), ['items', 'もちもの'], ['memo', 'メモ'], ['story', 'これまで']];
  m.innerHTML = `<div class="nb-head"><h3>${esc(ch().nbTitle || D.nbTitle || '捜査メモ')}</h3><button class="nb-x" aria-label="とじる">とじる</button></div>
    <div class="nb-tabs">${tabs.map(([k, n]) => `<button data-k="${k}" class="${k === nbTab ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="nb-body"></div>`;
  m.querySelector('.nb-x').onclick = () => { if (nbSel) snd.deduce(false); nbSel = null; m.remove(); const f = nbAfter; nbAfter = null; if (f) f(); };
  m.querySelectorAll('.nb-tabs button').forEach(b => b.onclick = () => { nbTab = b.dataset.k; nbSel = null; openNotebook(); });
  document.body.appendChild(m);
  const body = m.querySelector('.nb-body');
  if (nbTab === 'docs' && !D.docs) nbTab = 'cards';
  ({ cards: nbCards, notes: nbNotes, log: nbLog, docs: nbDocs, items: nbItems, memo: nbMemo, story: nbStory })[nbTab](body);
  if (keep) body.scrollTop = keep;
}
const pinBtn = (on, fn) => { const b = document.createElement('button'); b.className = 'pin' + (on ? ' on' : ''); b.textContent = on ? '★' : '☆'; b.title = 'ピン留め'; b.onclick = e => { e.stopPropagation(); fn(); }; return b; };
function entryEl(e, onPin, isCard) {
  const d = document.createElement('div'); d.className = 'nb-entry' + (e.pin ? ' pinned' : '') + (e.broken ? ' is-broken' : '');
  const who = speaker(e), where = placeName(e.c, e.l);
  d.innerHTML = `<div class="meta">${e.broken ? '<span class="broken">崩した</span>' : ''}${esc(who || (isCard ? '調べたこと' : '（地の文）'))}${where ? '・' + esc(where) : ''}${D.chapters[e.c] && D.chapters[e.c].label ? '・' + esc(D.chapters[e.c].label) : ''}</div><div class="txt">${esc(e.t)}</div>`;
  d.prepend(pinBtn(e.pin, onPin));
  return d;
}
let nbSel = null; // 矛盾をつくときに選んだカードの番号
function nbCards(body) {
  S.seenCards = S.cards.length; updateNbBadge(); autosave();
  const only = nbQ.pinCards && !nbSel;
  if ((ch().contradictions || []).length && S.cards.length >= 2 && !S.done) {
    const box = document.createElement('div'); box.className = 'nb-contra';
    if (!nbSel) {
      box.innerHTML = '<button class="big primary">矛盾をつく</button><small>食い違っている証言カードを2枚選んで、つきつける</small>';
      box.querySelector('button').onclick = () => { nbSel = []; snd.deduce(true); openNotebook(); };
    } else {
      box.innerHTML = `<div class="sel">食い違うカードを2枚選ぶ（${nbSel.length}/2）</div><div class="row2"><button class="big back">やめる</button><button class="big primary" ${nbSel.length === 2 ? '' : 'disabled'}>つきつける</button></div>`;
      const [cancel, go] = box.querySelectorAll('button');
      cancel.onclick = () => { nbSel = null; snd.deduce(false); openNotebook(); };
      go.onclick = () => {
        const ids = nbSel.map(i => S.cards[i].id || ('#' + i)); nbSel = null;
        $('nbook').remove(); contradict(ids);
        $('msgbox').scrollIntoView({ block: 'nearest' }); // つきつけた結果の文を、すぐ読める位置に
      };
    }
    body.appendChild(box);
  }
  const bar = document.createElement('div'); bar.className = 'nb-bar';
  bar.innerHTML = `<label><input type="checkbox" ${only ? 'checked' : ''}> ピン留めだけ</label><span class="cnt">${S.cards.length}枚</span>`;
  bar.querySelector('input').onchange = e => { nbQ.pinCards = e.target.checked; openNotebook(); };
  body.appendChild(bar);
  const list = S.cards.filter(c => !only || c.pin);
  if (!list.length) body.insertAdjacentHTML('beforeend', '<p class="nb-empty">まだ証言カードはありません。大事な証言を聞くと、ここに記録されます。</p>');
  list.forEach(c => {
    const el = entryEl(c, () => { c.pin = !c.pin; autosave(); openNotebook(); }, true);
    if (nbSel) {
      const i = S.cards.indexOf(c);
      el.classList.add('selectable'); if (nbSel.includes(i)) el.classList.add('chosen');
      el.onclick = () => {
        const k = nbSel.indexOf(i);
        if (k >= 0) nbSel.splice(k, 1); else if (nbSel.length < 2) nbSel.push(i);
        openNotebook();
      };
    }
    body.appendChild(el);
  });
}
function nbLog(body) {
  const whoSet = [...new Set(S.log.map(speaker).filter(Boolean))];
  const placeSet = [...new Set(S.log.map(e => e.c + '|' + e.l).filter(k => !k.endsWith('|null')))];
  const chSet = [...new Set(S.log.map(e => e.c))];
  const sel = (key, opts, label) => `<select data-k="${key}"><option value="">${label}</option>${opts.map(([v, n]) => `<option value="${esc(v)}" ${nbQ[key] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const bar = document.createElement('div'); bar.className = 'nb-filter';
  bar.innerHTML = `<input type="search" placeholder="ことばで探す" value="${esc(nbQ.q)}">`
    + sel('who', whoSet.map(w => [w, w]), '話した人：すべて')
    + sel('place', placeSet.map(k => { const [c, l] = k.split('|'); return [k, placeName(c, l)]; }), '場所：すべて')
    + (chSet.length > 1 ? sel('ch', chSet.map(c => [c, D.chapters[c].label || D.chapters[c].title || c]), '章：すべて') : '')
    + `<label><input type="checkbox" class="pinonly" ${nbQ.pin ? 'checked' : ''}> ピン留めだけ</label>`;
  body.appendChild(bar);
  const list = document.createElement('div'); body.appendChild(list);
  const draw = () => {
    const q = nbQ.q.trim();
    const hits = [];
    for (let i = S.log.length - 1; i >= 0 && hits.length < 300; i--) {
      const e = S.log[i];
      if (nbQ.who && speaker(e) !== nbQ.who) continue;
      if (nbQ.place && e.c + '|' + e.l !== nbQ.place) continue;
      if (nbQ.ch && e.c !== nbQ.ch) continue;
      if (nbQ.pin && !e.pin) continue;
      if (q && !e.t.includes(q)) continue;
      hits.push(e);
    }
    list.innerHTML = hits.length ? `<div class="cnt">${hits.length}件（新しい順）</div>` : '<p class="nb-empty">見つかりませんでした。</p>';
    hits.forEach(e => list.appendChild(entryEl(e, () => { e.pin = !e.pin; autosave(); draw(); })));
  };
  const s = bar.querySelector('input[type=search]');
  s.oninput = () => { nbQ.q = s.value; draw(); };
  bar.querySelectorAll('select').forEach(x => x.onchange = () => { nbQ[x.dataset.k] = x.value; draw(); });
  bar.querySelector('.pinonly').onchange = e => { nbQ.pin = e.target.checked; draw(); };
  draw();
}
function nbNotes(body) {
  const ns = S.notes || [];
  body.innerHTML = `<p class="nb-note">${esc(D.notes.lead || '')}（${ns.length}件）</p>` + (ns.length ? '' : '<p class="nb-empty">まだ何も書き留めていない。</p>');
  ns.forEach(n => body.appendChild(entryEl({ ...n, l: null }, () => { n.pin = !n.pin; autosave(); openNotebook(); }, true)));
}
// 資料：doc:id で増える。表や数字を見ながら推理するためのもの（game.json の docs: {id: {title, text}}）
function nbDocs(body) {
  const ds = S.docs || [];
  body.innerHTML = ds.length ? ds.map(k => `<div class="nb-entry doc"><div class="meta">${esc(D.docs[k].title)}</div><div class="txt">${esc(D.docs[k].text)}</div></div>`).join('') : '<p class="nb-empty">まだ資料はありません。</p>';
}
// もちものの説明：game.json の itemInfo: {id: "説明" | [{"if": "条件", "text": "説明"}, …]}（上から最初に合うもの。調べが進むと説明を変えられる）
function itemInfo(i) {
  const v = D.itemInfo && D.itemInfo[i];
  if (!v) return '';
  if (typeof v === 'string') return v;
  const r = v.find(r => cond(r.if)); return r ? r.text : '';
}
function nbItems(body) {
  // 押すと説明が開く（開いたものは、タブを切り替えても開いたまま）
  body.innerHTML = S.items.length ? S.items.map(i => { const t = itemInfo(i);
    return t ? `<details class="nb-entry item" data-i="${esc(i)}"${nbOpenItems.has(i) ? ' open' : ''}><summary class="txt">${esc(D.items[i])}</summary><div class="desc">${esc(t)}</div></details>`
             : `<div class="nb-entry"><div class="txt">${esc(D.items[i])}</div></div>`; }).join('') : '<p class="nb-empty">まだ何も持っていない。</p>';
  body.querySelectorAll('details.item').forEach(d => d.addEventListener('toggle', () => { d.open ? nbOpenItems.add(d.dataset.i) : nbOpenItems.delete(d.dataset.i); }));
}
const nbOpenItems = new Set();
function nbMemo(body) {
  body.innerHTML = '<p class="nb-note">自分用のメモです。ゲームの進み方には関係しません。</p><textarea id="memo" placeholder="気づいたことを書いておこう"></textarea>';
  const t = body.querySelector('textarea'); t.value = S.memo || '';
  let timer; t.oninput = () => { S.memo = t.value; clearTimeout(timer); timer = setTimeout(autosave, 400); };
}
function nbStory(body) {
  const ids = Object.keys(D.chapters), upto = ids.indexOf(S.chapter);
  const parts = ids.slice(0, upto + 1).map(id => D.chapters[id]).filter(C => C.recap);
  body.innerHTML = parts.length ? parts.map(C => `<div class="nb-entry"><div class="meta">${esc((C.label || '') + ' ' + (C.title || ''))}</div><div class="txt">${esc(C.recap)}</div></div>`).join('') : '<p class="nb-empty">まだ記録はありません。</p>';
}
// 章のはじめと「つづきから」で、その章の「これまでの話」を出す
function showRecap() {
  const C = ch();
  closeModal();
  const m = document.createElement('div'); m.id = 'modal';
  m.innerHTML = `<div class="sheet"><div class="eyebrow">これまでの話</div><h3>${esc((C.label || '') + ' ' + (C.title || ''))}</h3><p class="recap">${esc(C.recap)}</p></div>`;
  const b = document.createElement('button'); b.className = 'big primary'; b.textContent = 'つづける'; b.style.width = '100%';
  b.onclick = closeModal; m.firstChild.appendChild(b);
  document.body.appendChild(m);
}

// ---------- プレイ時間 ----------
// 画面が見えていて、最後の操作から2分以内のあいだだけ数える（放置した時間は入れない）
let lastInput = Date.now();
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, true));
setInterval(() => {
  if (!S || S.done || document.visibilityState !== 'visible' || Date.now() - lastInput > 120000) return;
  S.v.playSec = (S.v.playSec || 0) + 5;
}, 5000);
const hm = s => { s = s || 0; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}時間${m}分` : `${m}分`; };

// ---------- 起動時の一括読み込み ----------
// 背景をすべて先に読み込んでおき、遊んでいる間は通信しないようにする。
function preload() {
  const urls = Object.values((D.assets && D.assets.bg) || {});
  let done = 0, failed = 0;
  const bar = $('loadbar'), txt = $('loadtxt');
  const tick = () => { bar.style.width = (urls.length ? done / urls.length * 100 : 100) + '%'; txt.textContent = `読み込み中… ${done}/${urls.length}`; };
  tick();
  // 日本語フォントは文字ごとに分割配信されるので、ゲームで使う文字をすべて一度描いて先に取り寄せる
  const fonts = new Promise(res => {
    const chars = [...new Set(JSON.stringify(Object.assign({}, D, { assets: null })))].join('');
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;overflow:hidden;opacity:0;pointer-events:none';
    box.innerHTML = [["'Noto Sans JP'", 400], ["'Noto Sans JP'", 500], ["'Noto Sans JP'", 700], ["'Shippori Mincho'", 700], ["'Shippori Mincho'", 800]]
      .map(([f, w]) => `<span style="font-family:${f};font-weight:${w}">${chars.replace(/[<&]/g, '')}</span>`).join('');
    document.body.appendChild(box);
    const finish = () => { box.remove(); res(); };
    if (!document.fonts) return finish();
    setTimeout(finish, 8000);
    requestAnimationFrame(() => document.fonts.ready.then(finish, finish));
  });
  return Promise.all([fonts, ...urls.map(u => new Promise(res => {
    const im = new Image();
    im.onload = () => { done++; tick(); res(); };
    im.onerror = () => { done++; failed++; tick(); res(); };
    im.src = u;
    preloaded.push(im);
  }))]).then(() => failed);
}
const preloaded = [];

window.addEventListener('pageshow', e => { if (e.persisted) { document.body.classList.remove('leaving'); toTitle(); } });
// ---------- 検証用（tools/verify.py が使う） ----------
const sim = {
  // 章のはじめの状態を作る（prev に前の章の終わりの状態を渡せる）
  begin(ch_, prev) {
    SIM = true; S = prev ? JSON.parse(JSON.stringify(prev)) : fresh();
    delete S.simEnd; delete S.simPuzzle; delete S.simBoard; delete S.simChoice; delete S.simSearch;
    S.chapter = ch_; S.loc = D.chapters[ch_].start.loc; resetFor(D.chapters[ch_]); say(D.chapters[ch_].start.text);
    const sd = D.chapters[ch_].start.do; if (sd) { pending = {}; openBefore = openLocs(); run(sd); after(); }
    return JSON.parse(JSON.stringify(S));
  },
  set(st) { SIM = true; S = JSON.parse(JSON.stringify(st)); },
  get() { return JSON.parse(JSON.stringify(S)); },
  actions() {
    if (S.simEnd) return [];
    if (S.simBoard) {
      // 条件の組み合わせをすべて試す
      const B = ch().boards[S.simBoard], ids = B.conditions.map(c => c.id), out = [];
      for (let m = 1; m < (1 << ids.length); m++) out.push({ t: 'board', id: S.simBoard, sel: ids.filter((_, i) => m & (1 << i)) });
      return out;
    }
    if (S.simSearch) { const Q = ch().searches[S.simSearch]; return [...Q.entries.map(e => ({ t: 'search', id: S.simSearch, q: e.keys[0] })), { t: 'search', id: S.simSearch, q: 'ああああ' }]; }
    if (S.simChoice) return ch().choices[S.simChoice].options.map((_, i) => ({ t: 'choice', id: S.simChoice, i }));
    if (S.simPuzzle) { const P = ch().puzzles[S.simPuzzle]; return [{ t: 'code', id: S.simPuzzle, code: P.answer }, { t: 'code', id: S.simPuzzle, code: P.answer === '0000' ? '1111' : '0000' }]; }
    const a = [];
    Object.keys(ch().locations).forEach(k => { if (k !== S.loc && avail(k)) a.push({ t: 'move', k }); });
    if (ch().think) a.push({ t: 'think' });
    here().forEach(p => { const ts = topicsOf(p); if (ts) ts.forEach(tp => a.push({ t: 'topic', p, tp })); else a.push({ t: 'talk', p }); });
    objsHere().forEach(([o]) => a.push({ t: 'look', o }));
    S.items.forEach(i => here().forEach(p => a.push({ t: 'show', i, p })));
    if (ch().accuse) accusable().forEach(p => a.push({ t: 'accuse', p }));
    const cs = ch().contradictions || [];
    if (cs.length && S.cards.length >= 2) {
      const ids = S.cards.map((c, i) => c.id || '#' + i);
      cs.forEach(x => x.pairs.forEach(([u, v]) => { if (ids.includes(u) && ids.includes(v)) a.push({ t: 'contra', ids: [u, v] }); }));
      a.push({ t: 'contra', ids: [ids[0], ids[1]] });
    }
    return a;
  },
  apply(x) {
    switch (x.t) {
      case 'move': return moveTo(x.k);
      case 'talk': return talk(x.p);
      case 'topic': return talkTopic(x.p, x.tp);
      case 'look': return look(x.o);
      case 'show': return showTo(x.i, x.p);
      case 'accuse': return accuse(x.p);
      case 'contra': return contradict(x.ids);
      case 'code': return puzzleAnswer(x.id, x.code);
      case 'board': return boardSubmit(x.id, x.sel);
      case 'choice': return choose(x.id, x.i);
      case 'search': return searchAnswer(x.id, x.q);
      case 'think': return think();
    }
  },
  seen: () => [...simSeen],
};

document.title = D.title;
window.__mg = { get state() { return S; }, get sound() { return snd.state; }, flow: cid => flowGraph(cid), openFlow, openBoard, openPuzzle, cond, D, openNotebook, toastLog, sim, startChapter: id => { $('wrap').classList.remove('hide'); startChapter(id); } };
preload().then(failed => {
  $('loading').classList.add('hide');
  toTitle();
  soundPanel(null, true);
  if (failed) toast(`背景 ${failed} 枚を読み込めませんでした`);
});
})();
