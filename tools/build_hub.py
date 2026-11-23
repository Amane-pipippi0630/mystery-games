#!/usr/bin/env python3
"""作品選択ページ（リポジトリ直下の index.html）を組み立てる。

  python3 tools/build_hub.py

hub/hub.json の作品一覧から index.html と hub/thumbs/<id>.webp を作る。
クリア済みの作品には ⭐️、続きがある作品には「つづきあり」を出す（どちらもブラウザの保存から読む）。
三部作（trilogy: true）をすべてクリアすると、隠しエピローグが選べるようになる。
"""
import json, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HUB = ROOT / "hub"


def main():
    h = json.loads((HUB / "hub.json").read_text(encoding="utf-8"))
    errs = []
    thumbs = HUB / "thumbs"
    thumbs.mkdir(exist_ok=True)
    for f in thumbs.glob("*.webp"):
        f.unlink()
    for g in h["games"] + [h["epilogue"]]:
        if not re.match(r"^[a-z0-9-]+$", g["id"]):
            errs.append(f"{g['id']}: id は英小文字・数字・ハイフン")
        if g.get("status") == "play" and not (ROOT / g["path"]).exists():
            errs.append(f"{g['id']}: {g['path']} がありません（tools/build.py で組み立ててください）")
        if g.get("thumb"):
            src = ROOT / g["thumb"]
            if not src.exists():
                errs.append(f"{g['id']}: サムネイル {g['thumb']} がありません")
                continue
            im = Image.open(src).convert("RGB")
            w = 640
            if im.width > w:
                im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
            im.save(thumbs / f"{g['id']}.webp", "WEBP", quality=78, method=6)
            g["thumbUrl"] = f"hub/thumbs/{g['id']}.webp"
    if errs:
        raise SystemExit("エラー:\n" + "\n".join(errs))
    data = json.dumps(h, ensure_ascii=False).replace("</", "<\\/")
    html = (HUB / "template.html").read_text(encoding="utf-8").replace("{{TITLE}}", h["title"]).replace("{{DATA}}", data)
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"できあがり: index.html（作品 {len(h['games'])} 本）")


if __name__ == "__main__":
    main()
