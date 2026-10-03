# -*- coding: utf-8 -*-
"""修正补 name：只检查导出对象开头 3000 字符（元数据区）"""
import os, re

PLUGINS = os.path.join(ROOT, "plugins")
ADD_NAME = {
    "kugou-source.plugin.v1.9.14.js": "酷狗音乐",
    "kuwo-source.plugin.v1.9.14.js": "酷我音乐",
    "netease-source.plugin.v1.9.14.js": "网易云音乐",
    "qishui-source.plugin.v1.9.14.js": "汽水音乐",
    "qq-source.plugin.v1.9.14.js": "QQ音乐",
}

def locate_export_obj(c):
    m = re.search(r"module\.exports\s*=\s*\{", c)
    if m:
        return m.end() - 1
    m = re.search(r"module\.exports\s*=\s*(\w+)", c)
    if m:
        pm = re.search(r"\b(?:var|let|const|window\.|globalThis\.)\s*%s\s*=\s*\{" % re.escape(m.group(1)), c)
        if pm:
            return c.index("{", pm.start())
    return None

for fn, nv in ADD_NAME.items():
    p = os.path.join(PLUGINS, fn)
    c = open(p, encoding="utf-8", errors="replace").read()
    brace = locate_export_obj(c)
    if brace is None:
        print(f"[失败] {fn} 无法定位"); continue
    head = c[brace:brace+3000]
    if re.search(r"(?:^|\n)\s*name\s*:\s*['\"]", head):
        print(f"[已有顶层name] {fn}"); continue
    after = c[brace+1:brace+1+60]
    if after.startswith("\n"):
        indent = re.match(r"\n(\s*)", after).group(1) or "    "
        ins = "\n%sname: '%s'," % (indent, nv)
    else:
        ins = " name: '%s'," % nv
    c = c[:brace+1] + ins + c[brace+1:]
    open(p, "w", encoding="utf-8", newline="").write(c)
    print(f"[补name] {fn}: name='{nv}'")
print("完成")
