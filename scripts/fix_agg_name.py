# -*- coding: utf-8 -*-
"""agg name 修正：内部 name '聚合源' -> '聚合'，20 个清单同步"""
import json, os

ROOT = r"C:\Users\ajun\Desktop\tvbox\music"
PLUGINS = os.path.join(ROOT, "plugins")

# 1. 插件内部 name
p = os.path.join(PLUGINS, "agg-source.plugin.v1.9.15.js")
c = open(p, encoding="utf-8", errors="replace").read()
old = "  name: '聚合源',"
if old in c:
    c = c.replace(old, "  name: '聚合',", 1)
    open(p, "w", encoding="utf-8", newline="").write(c)
    print("agg-source.plugin.v1.9.15.js: name '聚合源' -> '聚合'")
else:
    print("agg 内部 name 未找到（检查）")

# 2. 20 个清单同步
for mf in sorted(f for f in os.listdir(ROOT) if f.endswith(".json") and os.path.isfile(os.path.join(ROOT, f))):
    fp = os.path.join(ROOT, mf)
    with open(fp, encoding="utf-8-sig") as f:
        data = json.load(f)
    changed = False
    for it in data.get("plugins", []):
        if os.path.basename(it.get("url", "")).startswith("agg-source") and it.get("name") == "聚合源":
            it["name"] = "聚合"
            changed = True
    if changed:
        with open(fp, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{mf}: agg name -> 聚合")
print("完成")
