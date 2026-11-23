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
  try {
    const c = JSON.parse(localStorage.getItem('mg:cleared') || '[]');
    if (!c.includes(D.id)) { c.push(D.id); localStorage.setItem('mg:cleared', JSON.stringify(c)); }
  } catch (e) {}
}

// ---------- 状態 ----------
let S = null;
let pending = {};
const fresh = () => ({ chapter: D.start, loc: null, f: {}, v: { turns: 0, miss: 0 }, items: [], seq: {}, done: false, log: [] });
const ch = () => D.chapters[S.chapter];
const loc = () => ch().locations[S.loc];
const person = p => D.people[p] || { name: p };
const short = p => person(p).short || person(p).name;
const fmt = (t, o) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in o ? o[k] : m));
function snapshot(label) {
  return { state: JSON.parse(JSON.stringify(S)), at: Date.now(), label: label || ((ch().label ? ch().label + ' ' : '') + (loc() ? loc().name : '')) };
}
function autosave() { if (S) store.set('auto', snapshot()); }

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
    const x = k === 'var' ? (S.v[n] || 0) : (S.seq['talk:' + n] || 0);
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
      case 'toast': toast(a); break;
      case 'goto': pending.goto = a; break;
      case 'puzzle': pending.puzzle = a; break;
      case 'ending': pending.ending = a; break;
      case 'chapter': pending.chapter = a; break;
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
  if (entry.seq) { const i = S.seq[key] || 0; S.seq[key] = i + 1; return entry.seq[Math.min(i, entry.seq.length - 1)]; }
  return cond(entry.if) ? entry : null;
}

// ---------- 表示 ----------
let typer = null, full = '', toastT;
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2200); }
function say(t) {
  if (t == null) return;
  if (S) S.log.push([S.chapter, S.loc, t]);
  const sp = t.match(/^([^「\n]{1,10})「([\s\S]*)」$/);
  const w = $('who');
  if (sp) { w.textContent = sp[1]; w.classList.add('on'); t = '「' + sp[2] + '」'; } else w.classList.remove('on');
  full = t; const m = $('msg'); m.textContent = '';
  clearInterval(typer); let i = 0;
  typer = setInterval(() => { i++; m.textContent = full.slice(0, i); if (i >= full.length) { clearInterval(typer); typer = null; } }, 28);
}
$('msgbox').onclick = () => { if (typer) { clearInterval(typer); typer = null; $('msg').textContent = full; } };

function setScene(bgKey, place, small) {
  const src = bgKey && D.assets && D.assets.bg && D.assets.bg[bgKey];
  $('bg').innerHTML = src ? `<img src="${src}" alt="">` : '';
  $('locname').innerHTML = `<small>${small || ''}</small>${place || ''}`;
}
function renderScene() {
  const L = loc();
  setScene(L.bg, L.name, ch().label || '現在地');
  $('here').innerHTML = (L.people || []).map(p => `<span>${person(p).name}</span>`).join('');
  $('bagn').textContent = S.items.length;
}

const IC = {
  'いどう': '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  'きく': '<path d="M4 5h16v11H9l-5 4z"/>',
  'しらべる': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  'みせる': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  'すいり': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  'もちもの': '<path d="M4 8h16l-1.5 12h-13z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};
function btns(list, label, mode) {
  const c = $('cmd'); c.innerHTML = ''; c.className = mode || (label ? 'list' : '');
  if (label) { const d = document.createElement('div'); d.className = 'label'; d.textContent = label; c.appendChild(d); }
  list.forEach(([t, fn, cls]) => {
    const b = document.createElement('button');
    b.innerHTML = (IC[t] && !label ? `<svg viewBox="0 0 24 24">${IC[t]}</svg>` : '') + `<span>${t}</span>`;
    if (cls) b.className = cls;
    b.onclick = fn; c.appendChild(b);
  });
}
const back = ['もどる', () => main(), 'back'];
const nextBtn = fn => btns([['つぎへ', fn, 'primary']], null, 'one');
function showItems() { say(S.items.length ? 'もちもの：\n' + S.items.map(i => '・' + D.items[i]).join('\n') : 'まだ何も持っていない。'); }

// ---------- 行動 ----------
function main() {
  if (S.done) return;
  const cmds = [['いどう', moveMenu], ['きく', askMenu], ['しらべる', lookMenu], ['みせる', showMenu]];
  if (ch().accuse) cmds.push(['すいり', accuseMenu]);
  cmds.push(['もちもの', showItems]);
  btns(cmds);
}
function act(rule) {
  S.v.turns = (S.v.turns || 0) + 1;
  pending = {};
  if (rule) { run(rule.do); if (rule.text) say(rule.text); }
  after();
}
function after() {
  const p = pending; pending = {};
  $('bagn').textContent = S.items.length;
  if (p.goto) { S.loc = p.goto; renderScene(); }
  autosave();
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
  S.loc = id; S.v.turns = (S.v.turns || 0) + 1; pending = {};
  runAll(ch().onMove);
  renderScene();
  const r = resolve(loc().arrive, 'arrive:' + id);
  if (r) { run(r.do); say(r.text); }
  after();
}
function askMenu() { btns([...(loc().people || []).map(p => [person(p).name, () => talk(p)]), back], 'だれに聞く？'); }
function talk(p) {
  const e = (ch().talk || {})[p], key = 'talk:' + p;
  const r = resolve(e, key);
  if (!(e && e.seq)) S.seq[key] = (S.seq[key] || 0) + 1;
  act(r || { text: fmt(ch().talkDefault || D.talkDefault || '{name}は、何も話してくれない。', { name: short(p) }) });
}
function lookMenu() { btns([...Object.entries(loc().objs || {}).map(([o, name]) => [name, () => look(o)]), back], '何を調べる？'); }
function look(o) {
  const r = resolve((ch().look || {})[o], 'look:' + S.loc + ':' + o);
  act(r || { text: '特に変わったところはない。' });
}
function showMenu() {
  if (!S.items.length) { say('見せるものを何も持っていない。'); return; }
  btns([...S.items.map(i => [D.items[i], () => {
    btns([...(loc().people || []).map(p => [person(p).name, () => {
      const r = resolve(((ch().show || {})[p] || {})[i], 'show:' + p + ':' + i);
      act(r || { text: fmt(ch().showDefault || D.showDefault || '{name}は、特に心当たりがないようだ。', { name: short(p) }) });
    }]), ['もどる', showMenu, 'back']], D.items[i] + 'をだれに見せる？');
  }]), back], '何を見せる？');
}
function accuseMenu() {
  const A = ch().accuse;
  btns([...A.suspects.map(p => [short(p), () => accuse(p)]), back], A.prompt || '犯人はだれだ？');
}
function accuse(p) {
  const A = ch().accuse;
  if (p === A.culprit) {
    const miss = (A.required || []).filter(x => !cond(x.if)).map(x => '・' + x.label);
    if (miss.length) return act({ text: fmt(A.missingText, { missing: miss.join('\n') }) });
    autosave();
    return ending(A.ending);
  }
  act(resolve((A.wrong || {})[p], 'accuse:' + p) || { text: A.wrongDefault || 'ちがうようだ。', do: ['miss'] });
}

// ---------- 謎解き（番号入力） ----------
function openPuzzle(id) {
  const P = ch().puzzles[id]; let code = '';
  const disp = () => fmt(P.display, { code: code.padEnd(P.length, '＊') });
  say(P.prompt + '\n' + disp());
  const draw = () => btns([...'1234567890'.split('').map(d => [d, () => {
    code += d;
    if (code.length < P.length) { say(disp()); draw(); }
    else if (code === P.answer) act(P.success);
    else act({ text: fmt(P.fail, { code }) });
  }]), ['やめる', () => { say(P.cancel || 'やめた。'); main(); }, 'back']], P.label, 'pad');
  draw();
}

// ---------- 章 ----------
function startChapter(id) {
  S.chapter = id;
  const C = ch();
  S.loc = C.start.loc;
  store.set('chap:' + id, snapshot((C.label ? C.label + ' ' : '') + (C.title || '') + 'のはじめ'));
  const go = () => { renderScene(); say(C.start.text); autosave(); main(); };
  if (C.card === false) return go();
  const card = document.createElement('div'); card.id = 'card';
  card.innerHTML = `<div class="n">${C.label || ''}</div><div class="t">${C.title || ''}</div><div class="tap">タップしてすすむ</div>`;
  card.onclick = () => { card.remove(); go(); };
  document.body.appendChild(card);
}

// ---------- エンディング ----------
function ending(id) {
  const E = D.endings[id];
  S.done = true; markCleared(); autosave();
  setScene(E.bg, E.place, E.small);
  $('here').innerHTML = '';
  let k = 0;
  const next = () => {
    if (k < E.pages.length) { say(E.pages[k++]); nextBtn(next); return; }
    setScene(E.finalBg || E.bg, E.finalPlace || '', E.finalSmall || '');
    const rank = ((E.ranks || []).find(r => cond(r.if)) || {}).label || '';
    say(fmt(E.result, { turns: S.v.turns, miss: S.v.miss || 0, rank }));
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
    { t: 'タイトルへ', s: '進み具合はオートセーブされています', fn: () => { closeModal(); toTitle(); } },
  ]);
};
$('bag').onclick = () => { if (S && !S.done) showItems(); };

function resume(snap) {
  closeModal();
  S = JSON.parse(JSON.stringify(snap.state));
  $('title').classList.add('hide'); $('prologue').classList.add('hide'); $('wrap').classList.remove('hide');
  if (S.done) { toTitle(); return; }
  renderScene(); say(D.resumeText || '捜査を再開した。'); autosave(); main();
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

document.title = D.title;
window.__mg = { get state() { return S; }, cond, D };
preload().then(failed => {
  $('loading').classList.add('hide');
  toTitle();
  if (failed) toast(`背景 ${failed} 枚を読み込めませんでした`);
});
})();
