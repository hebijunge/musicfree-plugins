# -*- coding: utf-8 -*-
"""修复 srcUrl：把 17 个重命名插件内部 srcUrl 中的旧文件名 v1.0.0 改为新版本号"""
import os, re

PLUGINS = r"C:\Users\ajun\Desktop\tvbox\music\plugins"
NEW_VER = {
    "172mix-source.plugin.v1.1.0.js": "1.1.0", "36dj-source.plugin.v1.1.0.js": "1.1.0",
    "54dj-source.plugin.v1.1.0.js": "1.1.0", "82dj-source.plugin.v1.1.0.js": "1.1.0",
    "bibdj-source.plugin.v1.1.0.js": "1.1.0", "ddddj-source.plugin.v1.2.0.js": "1.2.0",
    "dianyinge-source.plugin.v1.1.0.js": "1.1.0", "dj14-source.plugin.v1.2.0.js": "1.2.0",
    "dj766-source.plugin.v1.1.0.js": "1.1.0", "djkk-source.plugin.v1.1.0.js": "1.1.0",
    "djyyy-source.plugin.v1.1.0.js": "1.1.0", "htqyy-source.plugin.v1.2.0.js": "1.2.0",
    "hy57-source.plugin.v1.1.0.js": "1.1.0", "pgdjz-source.plugin.v1.1.0.js": "1.1.0",
    "qichedj-source.plugin.v1.1.0.js": "1.1.0", "qqdjs-source.plugin.v1.2.0.js": "1.2.0",
    "spacedj-source.plugin.v1.1.0.js": "1.1.0",
}
for fn, ver in NEW_VER.items():
    p = os.path.join(PLUGINS, fn)
    c = open(p, encoding="utf-8", errors="replace").read()
    lines = c.split("\n")
    changed = False
    for i, ln in enumerate(lines):
        if "srcUrl" in ln:
            new_ln = re.sub(r"v1\.0\.0\.js", "v%s.js" % ver, ln)
            if new_ln != ln:
                lines[i] = new_ln
                changed = True
    if changed:
        open(p, "w", encoding="utf-8", newline="").write("\n".join(lines))
        print(f"  {fn}: srcUrl 更新完成")
    else:
        print(f"  {fn}: 无 srcUrl 变化")
