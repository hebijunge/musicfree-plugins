# -*- coding: utf-8 -*-
"""修复脚本：1) 重命名 17 个 DJ 插件（文件名版本对齐内部版本） 2) 更新全部 20 个清单 JSON 的 URL"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # scripts/ 上一级 = 仓库根
PLUGINS = os.path.join(ROOT, "plugins")

# 重命名映射: 旧文件名 -> 新文件名（按插件内部 version 对齐）
RENAMES = {
    "172mix-source.plugin.v1.0.0.js": "172mix-source.plugin.v1.1.0.js",
    "36dj-source.plugin.v1.0.0.js":  "36dj-source.plugin.v1.1.0.js",
    "54dj-source.plugin.v1.0.0.js":  "54dj-source.plugin.v1.1.0.js",
    "82dj-source.plugin.v1.0.0.js":  "82dj-source.plugin.v1.1.0.js",
    "bibdj-source.plugin.v1.0.0.js": "bibdj-source.plugin.v1.1.0.js",
    "ddddj-source.plugin.v1.0.0.js": "ddddj-source.plugin.v1.2.0.js",
    "dianyinge-source.plugin.v1.0.0.js": "dianyinge-source.plugin.v1.1.0.js",
    "dj14-source.plugin.v1.0.0.js":  "dj14-source.plugin.v1.2.0.js",
    "dj766-source.plugin.v1.0.0.js": "dj766-source.plugin.v1.1.0.js",
    "djkk-source.plugin.v1.0.0.js":  "djkk-source.plugin.v1.1.0.js",
    "djyyy-source.plugin.v1.0.0.js": "djyyy-source.plugin.v1.1.0.js",
    "htqyy-source.plugin.v1.0.0.js": "htqyy-source.plugin.v1.2.0.js",
    "hy57-source.plugin.v1.0.0.js":  "hy57-source.plugin.v1.1.0.js",
    "pgdjz-source.plugin.v1.0.0.js": "pgdjz-source.plugin.v1.1.0.js",
    "qichedj-source.plugin.v1.0.0.js": "qichedj-source.plugin.v1.1.0.js",
    "qqdjs-source.plugin.v1.0.0.js": "qqdjs-source.plugin.v1.2.0.js",
    "spacedj-source.plugin.v1.0.0.js": "spacedj-source.plugin.v1.1.0.js",
}

# 1) 重命名文件
print("== 1. 重命名 ==")
for old, new in RENAMES.items():
    op, np_ = os.path.join(PLUGINS, old), os.path.join(PLUGINS, new)
    if not os.path.exists(op):
        print(f"  [跳过] {old} 不存在")
        continue
    if os.path.exists(np_):
        print(f"  [冲突] {new} 已存在，跳过")
        continue
    shutil.move(op, np_)
    print(f"  {old} -> {new}")

# 2) 更新所有清单 JSON
print("== 2. 清单 URL 更新 ==")
for mf in sorted(f for f in os.listdir(ROOT) if f.endswith(".json") and os.path.isfile(os.path.join(ROOT, f))):
    p = os.path.join(ROOT, mf)
    with open(p, encoding="utf-8-sig") as f:
        data = json.load(f)
    changed = []
    for it in data.get("plugins", []):
        fn = os.path.basename(it.get("url", "").split("?")[0])
        if fn in RENAMES:
            it["url"] = it["url"].replace(fn, RENAMES[fn])
            changed.append(f"{fn}->{RENAMES[fn]}")
    if changed:
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  {mf}: 更新 {len(changed)} 条 -> {changed}")
    else:
        print(f"  {mf}: 无变更")
print("完成")
