# -*- coding: utf-8 -*-
"""补全剩余：missevan/srcUrl + 遗留旧文件 srcUrl + huolongdj v1.0.0 name"""
import os, re

PLUGINS = r"C:\Users\ajun\Desktop\tvbox\music\plugins"

# 需要补 srcUrl 的文件（清单收录 + 遗留旧文件；排除已有顶层 srcUrl 的）
ADD_SRC = [
    "missevan-source.plugin.v1.0.0.js",
    "bilibili-source.plugin.v1.1.0.js",
    "djuu-source.plugin.v1.0.0.js",
    "huolongdj-source.plugin.v1.0.0.js",
    "jamendo-source.plugin.v1.0.0.js",
    "joox-source.plugin.v1.0.0.js",
    "kugou-source.plugin.v1.9.14.js",
    "kuwo-source.plugin.v1.9.14.js",
    "lrts-source.plugin.v1.0.0.js",
    "migu-source.plugin.v1.9.14.js",
    "migu-source.plugin.v1.9.15.js",
    "netease-source.plugin.v1.9.14.js",
    "qianqian-source.plugin.v1.0.0.js",
    "qishui-source.plugin.v1.9.14.js",
    "qishui-source.plugin.v1.9.15.js",
    "qq-source.plugin.v1.9.14.js",
]
# 遗留旧文件补 name
ADD_NAME = {"huolongdj-source.plugin.v1.0.0.js": "火龙DJ"}

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

def has_top(c, brace, key, n=3000):
    return bool(re.search(r"(?:^|\n)\s*%s\s*:\s*['\"]" % key, c[brace:brace+n]))

def do_insert(fn, key, val):
    p = os.path.join(PLUGINS, fn)
    c = open(p, encoding="utf-8", errors="replace").read()
    brace = locate_export_obj(c)
    if brace is None:
        print(f"  [失败] {fn} 无法定位导出对象"); return
    if has_top(c, brace, key):
        print(f"  [已有] {fn} {key}"); return
    after = c[brace+1:brace+1+60]
    if after.startswith("\n"):
        indent = re.match(r"\n(\s*)", after).group(1) or "    "
        ins = "\n%s%s: %s," % (indent, key, val)
    else:
        ins = " %s: %s," % (key, val)
    c = c[:brace+1] + ins + c[brace+1:]
    open(p, "w", encoding="utf-8", newline="").write(c)
    print(f"  {fn}: +{key}: {val}")

print("== srcUrl 补全 ==")
for fn in ADD_SRC:
    url = "https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/%s" % fn
    do_insert(fn, "srcUrl", "'%s'" % url)

print("== name 补全 ==")
for fn, nv in ADD_NAME.items():
    do_insert(fn, "name", "'%s'" % nv)
print("完成")
