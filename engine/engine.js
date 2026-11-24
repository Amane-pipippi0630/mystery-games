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
      case 'give': if (!S.items.includes(a)) { S.items.push(a); toast('入手：' + D.items[a]); } break;
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
function toast(t) { toastLog.push(t); if (SIM) return; const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2200); }
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
  setScene(L.bg, L.name, ch().label || '現在地');
  $('here').innerHTML = here(L).map(p => `<span>${person(p).name}</span>`).join('');
}

const IC = {
  '移動': '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  '聞く': '<path d="M4 5h16v11H9l-5 4z"/>',
  '調べる': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  '見せる': '<rect x="3" y="8" width="11" height="13" rx="2"/><path d="M13 3h8v8M21 3l-9 9"/>',
  '推理': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  '手帳': '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M10 8h5M10 12h5"/>',
};
function btns(list, label, mode) {
  if (SIM) return;
  const c = $('cmd'); c.innerHTML = ''; c.className = mode || (label ? 'list' : '');
  if (label) { const d = document.createElement('div'); d.className = 'label'; d.textContent = label; c.appendChild(d); }
  list.forEach(([t, fn, cls]) => {
    const b = document.createElement('button');
    b.innerHTML = (IC[t] && !label ? `<svg viewBox="0 0 24 24">${IC[t]}</svg>` : '') + `<span>${t}</span>` + (t === '手帳' && !label ? '<b id="nbn" class="badge"></b>' : '');
    if (cls) b.className = cls;
    b.onclick = fn; c.appendChild(b);
  });
}
const back = ['もどる', () => main(), 'back'];
const nextBtn = fn => btns([['つぎへ', fn, 'primary']], null, 'one');

// ---------- 行動 ----------
function main() {
  if (S.done || SIM) return;
  const cmds = [['移動', moveMenu], ['聞く', askMenu], ['調べる', lookMenu], ['見せる', showMenu]];
  if (ch().accuse) cmds.push(['推理', accuseMenu]);
  cmds.push(['手帳', () => openNotebook()]);
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
  if (rule) { run(rule.do); if (rule.text) say(rule.text, meta); if (rule.card) addCard(rule, meta); if (rule.note) addNote(rule, meta); }
  after();
}
// 取材ノート：ルールに "note": "要約" を付けると、伝記の取材メモとして残る
function addNote(rule, meta) {
  if (!S.notes) S.notes = [];
  if (S.notes.some(n => n.t === rule.note)) return;
  S.notes.push({ c: S.chapter, p: (meta && meta.p) || null, t: rule.note });
  S.v.notes = S.notes.length;
  toast('取材ノートに書き留めた');
}
// 証言カード：ルールに "card": true（その文をそのまま）か "card": "要約" を付けると記録される
function addCard(rule, meta) {
  const t = typeof rule.card === 'string' ? rule.card : rule.text;
  if (S.cards.some(c => c.t === t)) return;
  S.cards.push({ id: rule.cardId || null, c: S.chapter, l: S.loc, p: (meta && meta.p) || null, t, pin: false });
  toast('証言カードに記録した');
  updateNbBadge();
}
function after() {
  const p = pending; pending = {};
  if (openBefore) {
    const now = openLocs().filter(k => !openBefore.includes(k));
    if (now.length) toast(now.map(k => ch().locations[k].name).join('・') + 'に行けるようになった');
    openBefore = null;
  }
  if (p.goto) { S.loc = p.goto; renderScene(); }
  // 自動の進行：条件がそろったトリガーを1つだけ動かす（トリガーには once 用のフラグを do に入れておく）
  if (!p.event && !p.ending && !p.chapter && !p.puzzle) {
    const t = (ch().triggers || []).find(r => cond(r.if));
    if (t) { pending = {}; run(t.do); Object.assign(p, pending); pending = {}; }
  }
  autosave();
  if (p.event) return playEvent(p.event);
  if (SIM && p.puzzle) { S.simPuzzle = p.puzzle; return; }
  if (SIM && (p.ending || p.chapter)) { S.simEnd = p.ending ? 'ending:' + p.ending : 'chapter:' + p.chapter; return; }
  if (p.puzzle) return openPuzzle(p.puzzle);
  if (p.ending) return nextBtn(() => ending(p.ending));
  if (p.chapter) return nextBtn(() => startChapter(p.chapter));
  main();
}
const avail = id => cond(ch().locations[id].unlock);
function moveMenu() {
  const ids = Object.keys(ch().locations).filter(k => k !== S.loc && avail(k));
  btns([...ids.map(k => [ch().locations[k].name, () => moveTo(k)]), back], 'どこへ行く？');
}
function moveTo(id) {
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
function askMenu() { btns([...here().map(p => [person(p).name, () => talk(p)]), back], 'だれに聞く？'); }
// 助手（game.json の assistant）に聞くと、この場所でまだ大事な話を聞いていない人を教えてくれる
function assistantHint() {
  const heard = heardSet();
  // 同じ人の聞き残しを教えるのは、その章で1回だけ（2回目からはふだんのヒントに進む）
  const q = here().find(p => p !== D.assistant && hasNewTalk(p, heard) && !S.seq['ahint:' + S.chapter + ':' + p]);
  if (!q) return null;
  S.seq['ahint:' + S.chapter + ':' + q] = 1;
  return { text: fmt(D.assistantHint || '{name}さん、まだ何か知っていそうですよ。', { name: short(q) }) };
}
function talk(p) {
  const e = (ch().talk || {})[p], key = 'talk:' + p;
  const hint = p === D.assistant && !(e && e.topics) ? assistantHint() : null;
  if (hint) { bumpTalk(p); S.v.hints = (S.v.hints || 0) + 1; return act(hint, { p }); }
  if (e && e.topics) {
    const ts = topicsOf(p);
    return btns([...ts.map(t => [(D.topics && D.topics[t]) || t, () => talkTopic(p, t)]), ['もどる', askMenu, 'back']], person(p).name + 'に、何を聞く？');
  }
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
  if (p === D.assistant && t === D.hintTopic) {
    const h = assistantHint();
    if (h) { bumpTalk(p); S.v.hints = (S.v.hints || 0) + 1; return act(h, { p }); }
  }
  if (tieredHint(e, p, key)) return;
  const r = resolve(e, key);
  bumpTalk(p);
  act(r || { text: fmt(ch().talkDefault || D.talkDefault || '{name}は、何も話してくれない。', { name: short(p) }) }, { p });
}
function lookMenu() { btns([...Object.entries(loc().objs || {}).map(([o, name]) => [name, () => look(o)]), back], '何を調べる？'); }
function look(o) {
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
  let k = 0;
  const next = () => {
    if (k < E.pages.length) { say(E.pages[k++]); nextBtn(next); return; }
    pending = {}; openBefore = openLocs(); run(E.do);
    renderScene(); after();
  };
  next();
}

// ---------- 謎解き（番号入力） ----------
function openPuzzle(id) {
  const P = ch().puzzles[id]; let code = '';
  const disp = () => fmt(P.display, { code: code.padEnd(P.length, '＊') });
  say(P.prompt + '\n' + disp());
  const draw = () => btns([...'1234567890'.split('').map(d => [d, () => {
    code += d;
    if (code.length < P.length) { say(disp()); draw(); }
    else puzzleAnswer(id, code);
  }]), ['やめる', () => { say(P.cancel || 'やめた。'); main(); }, 'back']], P.label, 'pad');
  draw();
}

function puzzleAnswer(id, code) {
  const P = ch().puzzles[id];
  S.simPuzzle = null;
  if (code === P.answer) act(P.success); else act({ text: fmt(P.fail, { code }) });
}

// ---------- 章 ----------
function startChapter(id) {
  S.chapter = id;
  const C = ch();
  S.loc = C.start.loc;
  store.set('chap:' + id, snapshot((C.label ? C.label + ' ' : '') + (C.title || '') + 'のはじめ'));
  const go = () => { renderScene(); say(C.start.text); autosave(); main(); if (C.recap) showRecap(); };
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
  setScene(E.bg, E.place, E.small);
  $('here').innerHTML = '';
  let k = 0;
  const next = () => {
    if (k < E.pages.length) { say(E.pages[k++]); nextBtn(next); return; }
    setScene(E.finalBg || E.bg, E.finalPlace || '', E.finalSmall || '');
    const rank = ((E.ranks || []).find(r => cond(r.if)) || {}).label || '';
    say(fmt(E.result, { turns: S.v.turns, miss: S.v.miss || 0, rank, time: hm(S.v.playSec), hints: S.v.hints || 0, notes: (S.notes || []).length }));
    btns([['タイトルへ', toTitle, 'primary']], null, 'one');
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
  renderScene(); say(D.resumeText || '捜査を再開した。', { nolog: true }); autosave(); main(); updateNbBadge();
  if (ch().recap) showRecap();
}

// ---------- ほかのページへ移る ----------
// 押したことが分かるように、ボタンと画面に「開いています…」を出してから移る
function leave(url, btn) {
  if (btn) { btn.classList.add('going'); btn.textContent = '開いています…'; }
  document.body.classList.add('leaving');
  setTimeout(() => { location.href = url; }, 150);
}

// ---------- タイトル ----------
function toTitle() {
  closeModal();
  const T = D.titleScreen, t = $('title');
  $('wrap').classList.add('hide'); $('prologue').classList.add('hide');
  const a = store.get('auto');
  t.innerHTML = `<div class="eyebrow">${T.eyebrow || ''}</div><h1>${T.title}</h1><p>${T.lead || ''}</p>`;
  const add = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'big' + (cls ? ' ' + cls : ''); b.textContent = label; b.onclick = fn; t.appendChild(b); };
  add('はじめから', newGame, 'primary');
  if (a && !a.state.done) add('つづきから', () => resume(a));
  if (hasAnySave()) add('ロード', () => modal('ロード', loadList()));
  if (D.hub) add('作品選択へ', e => leave(D.hub, e.currentTarget));
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
function openNotebook(tab) {
  if (tab) nbTab = tab;
  closeModal();
  const old = $('nbook'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'nbook';
  const tabs = [['cards', '証言カード'], ...(D.notes ? [['notes', D.notes.tab || '取材ノート']] : []), ['log', '会話ログ'], ['items', 'もちもの'], ['memo', 'メモ'], ['story', 'これまで']];
  m.innerHTML = `<div class="nb-head"><h3>捜査手帳</h3><button class="nb-x" aria-label="とじる">とじる</button></div>
    <div class="nb-tabs">${tabs.map(([k, n]) => `<button data-k="${k}" class="${k === nbTab ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="nb-body"></div>`;
  m.querySelector('.nb-x').onclick = () => { nbSel = null; m.remove(); };
  m.querySelectorAll('.nb-tabs button').forEach(b => b.onclick = () => { nbTab = b.dataset.k; nbSel = null; openNotebook(); });
  document.body.appendChild(m);
  const body = m.querySelector('.nb-body');
  ({ cards: nbCards, notes: nbNotes, log: nbLog, items: nbItems, memo: nbMemo, story: nbStory })[nbTab](body);
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
      box.querySelector('button').onclick = () => { nbSel = []; openNotebook(); };
    } else {
      box.innerHTML = `<div class="sel">食い違うカードを2枚選ぶ（${nbSel.length}/2）</div><div class="row2"><button class="big back">やめる</button><button class="big primary" ${nbSel.length === 2 ? '' : 'disabled'}>つきつける</button></div>`;
      const [cancel, go] = box.querySelectorAll('button');
      cancel.onclick = () => { nbSel = null; openNotebook(); };
      go.onclick = () => {
        const ids = nbSel.map(i => S.cards[i].id || ('#' + i)); nbSel = null;
        $('nbook').remove(); contradict(ids);
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
function nbItems(body) {
  body.innerHTML = S.items.length ? S.items.map(i => `<div class="nb-entry"><div class="txt">${esc(D.items[i])}</div></div>`).join('') : '<p class="nb-empty">まだ何も持っていない。</p>';
}
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
    delete S.simEnd; delete S.simPuzzle;
    S.chapter = ch_; S.loc = D.chapters[ch_].start.loc; say(D.chapters[ch_].start.text);
    return JSON.parse(JSON.stringify(S));
  },
  set(st) { SIM = true; S = JSON.parse(JSON.stringify(st)); },
  get() { return JSON.parse(JSON.stringify(S)); },
  actions() {
    if (S.simEnd) return [];
    if (S.simPuzzle) { const P = ch().puzzles[S.simPuzzle]; return [{ t: 'code', id: S.simPuzzle, code: P.answer }, { t: 'code', id: S.simPuzzle, code: P.answer === '0000' ? '1111' : '0000' }]; }
    const a = [];
    Object.keys(ch().locations).forEach(k => { if (k !== S.loc && avail(k)) a.push({ t: 'move', k }); });
    here().forEach(p => { const ts = topicsOf(p); if (ts) ts.forEach(tp => a.push({ t: 'topic', p, tp })); else a.push({ t: 'talk', p }); });
    Object.keys(loc().objs || {}).forEach(o => a.push({ t: 'look', o }));
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
    }
  },
  seen: () => [...simSeen],
};

document.title = D.title;
window.__mg = { get state() { return S; }, cond, D, openNotebook, toastLog, sim, startChapter: id => { $('wrap').classList.remove('hide'); startChapter(id); } };
preload().then(failed => {
  $('loading').classList.add('hide');
  toTitle();
  if (failed) toast(`背景 ${failed} 枚を読み込めませんでした`);
});
})();
