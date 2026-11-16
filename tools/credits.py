#!/usr/bin/env python3
"""data/credits.json -> data/credits.js (damit die App auch ohne Server/fetch läuft)."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "data" / "credits.json"
data = json.loads(src.read_text()) if src.exists() else {}
data = {k: v for k, v in data.items() if (root / v["file"]).exists()}
(root / "data" / "credits.js").write_text("window.CREDITS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
print(f"{len(data)} Fotos in credits.js")
