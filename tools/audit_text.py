"""全テキストの機械チェック：括弧の対応、改行のあとの空白、{…}の置き換え漏れ、ヒントの『』が画面の名前と合うか。
使い方: python3 tools/audit_text.py <作品id>（『』がカードの文言の引用なら、カードにその文言があるかを目で確かめる）"""
import json,re,sys,glob
g=sys.argv[1]; G=json.load(open(f'games/{g}/src/game.json'))
topics=set(G['topics'].values()); items=set(G['items'].values()); people={p['name'] for p in G['people'].values()}|{p.get('short',p['name']) for p in G['people'].values()}
docs={d['title'] for d in G.get('docs',{}).values()}
TAB={'資料','証言カード','取材ノート','会話ログ','もちもの','メモ','これまで','推理','矛盾をつく','手帳','調べる','移動','聞く','見せる','考える','相談する'}
def texts(o,path=''):
    if isinstance(o,str): yield path,o
    elif isinstance(o,dict):
        for k,v in o.items(): yield from texts(v,path+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): yield from texts(v,f'{path}[{i}]')
out=[]
for f in sorted(glob.glob(f'games/{g}/src/ch*.json')):
    C=json.load(open(f)); ch=C['id']
    locs={l['name'] for l in C['locations'].values()}
    objs={n for l in C['locations'].values() for n in l.get('objs',{}).values()}
    names=topics|items|people|docs|TAB|locs|objs
    # also allow short location fragments
    for p,t in texts(C,ch):
        if p.endswith(('.if','.do','.cardId','.loc','.bg','.unlock','.culprit','.id','.p')) or re.search(r'\.(do|keys|suspects|pairs|breaks)\[',p): continue
        # brackets
        for a,b in ['「」','『』','（）']:
            if t.count(a)!=t.count(b): out.append(f'[括弧] {p}: {a}{b} {t.count(a)}/{t.count(b)} :: {t[:60]}')
        if re.search(r'\n ', t): out.append(f'[空白] {p}: 改行のあとに空白')
        if re.search(r'。。|、、|」」(?!」)|\?\?', t): out.append(f'[記号] {p}: {t[:50]}')
        for m in re.findall(r'\{(\w+)\}',t):
            if m not in ('name','code','q','time','hints','turns','miss','rank','day','searches','notes'): out.append(f'[置換] {p}: {{{m}}}')
        if '.hint' in p or '.think' in p or 'hints' in p:
            for m in re.findall(r'『([^』]+)』',t):
                if m not in names and not any(m in n or n in m for n in names):
                    out.append(f'[導線] {p}: 『{m}』が画面上の名前と一致しない')
print('\n'.join(out) if out else 'なし')
