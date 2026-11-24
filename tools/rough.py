"""背景の構図ラフ（640x360）を描く。使い方: python3 tools/rough.py <spec.json> <出力フォルダ>
spec: {名前: [[形, 座標..., ラベル], ...]}  形: rect(x1,y1,x2,y2) / fill(x1,y1,x2,y2) / oval(...) / poly([x,y,...]) / line(x1,y1,x2,y2) / text(x,y)
座標は 0〜100 の割合（横・縦）。"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
W, H = 640, 360
F = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 13, index=0)
T = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 15, index=0)
def P(v, i): return v * (W if i % 2 == 0 else H) / 100
def draw(name, shapes, out):
    im = Image.new("RGB", (W, H), (152, 152, 152)); d = ImageDraw.Draw(im)
    d.rectangle([0, H * .75, W, H], fill=(124, 124, 124))
    labels = []
    for s in shapes:
        k, *a = s
        lab = a.pop() if a and isinstance(a[-1], str) else None
        if k == "poly":
            pts = [P(v, i) for i, v in enumerate(a[0])]; d.polygon(pts, fill=(100, 100, 100)); cx, cy = sum(pts[0::2]) / len(pts[0::2]), sum(pts[1::2]) / len(pts[1::2])
        else:
            c = [P(v, i) for i, v in enumerate(a)]
            if k == "rect": d.rectangle(c, outline=(225, 225, 225), width=4)
            elif k == "fill": d.rectangle(c, fill=(92, 92, 92))
            elif k == "oval": d.ellipse(c, outline=(235, 235, 235), width=4)
            elif k == "line": d.line(c, fill=(70, 70, 70), width=5)
            cx, cy = (c[0] + c[2]) / 2 if len(c) > 2 else c[0], (c[1] + c[3]) / 2 if len(c) > 3 else c[1]
        if lab: labels.append((cx, cy, lab))
    for cx, cy, lab in labels:
        w = d.textlength(lab, font=F); x = max(4, min(W - w - 4, cx - w / 2)); d.rectangle([x - 3, cy - 10, x + w + 3, cy + 9], fill=(245, 245, 245)); d.text((x, cy - 9), lab, font=F, fill=(200, 30, 30))
    d.text((8, 6), name, font=T, fill=(40, 40, 40))
    im.save(out / f"{name}.png")
    return im
spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")); out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
ims = [draw(n, s, out) for n, s in spec.items()]
cols = 4; rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W // 2 + (cols + 1) * 8, rows * H // 2 + (rows + 1) * 8), (255, 255, 255))
for i, im in enumerate(ims):
    sheet.paste(im.resize((W // 2, H // 2)), (8 + (i % cols) * (W // 2 + 8), 8 + (i // cols) * (H // 2 + 8)))
sheet.save(out / "sheet.png"); print(len(ims), "枚 →", out)
