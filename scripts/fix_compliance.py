# -*- coding: utf-8 -*-
"""补齐 skill 规范缺失字段：cacheControl / name(遗留旧文件) / srcUrl(清单插件)"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # scripts/ 上一级 = 仓库根
PLUGINS = os.path.join(ROOT, "plugins")

with open(os.path.join(ROOT, "plugins.json"), encoding="utf-8-sig") as f:
    base = json.load(f)
listed = {os.path.basename(it["url"].split("?")[0]) for it in base["plugins"]}

# 1) 需要补 cacheControl 的插件（19 个 DJ 类，统一 no-store 与同族一致）
ADD_CACHE = {
    "172mix-source.plugin.v1.1.0.js", "36dj-source.plugin.v1.1.0.js", "54dj-source.plugin.v1.1.0.js",
    "82dj-source.plugin.v1.1.0.js", "bibdj-source.plugin.v1.1.0.js", "ddddj-source.plugin.v1.2.0.js",
    "dianyinge-source.plugin.v1.1.0.js", "dj14-source.plugin.v1.2.0.js", "dj6-source.plugin.v1.0.0.js",
    "dj766-source.plugin.v1.1.0.js", "djyyy-source.plugin.v1.1.0.js", "htqyy-source.plugin.v1.2.0.js",
    "hy57-source.plugin.v1.1.0.js", "qqdjs-source.plugin.v1.2.0.js", "spacedj-source.plugin.v1.1.0.js",
    "73dj-source.plugin.v1.0.0.js", "djf5-source.plugin.v1.0.0.js", "djhhw-source.plugin.v1.0.0.js",
    "xxedm-source.plugin.v1.0.0.js",
}

# 2) 需要补 name 的遗留旧文件（中文名对齐同源最新版 / platform）
ADD_NAME = {
    "73dj-source.plugin.v1.0.0.js": "73DJ",
    "djf5-source.plugin.v1.0.0.js": "DJF5",
    "djhhw-source.plugin.v1.0.0.js": "DJ嗨嗨",
    "xxedm-source.plugin.v1.0.0.js": "小熊电音",
    "kugou-source.plugin.v1.9.14.js": "酷狗音乐",
    "kuwo-source.plugin.v1.9.14.js": "酷我音乐",
    "lrts-source.plugin.v1.0.0.js": "懒人听书",
    "netease-source.plugin.v1.9.14.js": "网易云音乐",
    "neteaseradio-source.plugin.v1.0.0.js": "网易云电台",
    "qianqian-source.plugin.v1.0.0.js": "千千音乐",
    "qishui-source.plugin.v1.9.14.js": "汽水音乐",
    "qq-source.plugin.v1.9.14.js": "QQ音乐",
}

# 3) 需要补 srcUrl 的插件：清单收录且缺 srcUrl（排除 agg——注释明确渠道未定暂空）
SKIP_SRCURL = {"agg-source.plugin.v1.9.15.js", "neteaseradio-source.plugin.v1.1.0.js",
               "xiangsheng-pingshu-source.plugin.v1.0.0.js"}

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

def field_present(c, brace, key, deep=40000):
    seg = c[brace:brace+deep]
    return bool(re.search(r"(?:^|\n)\s*%s\s*:" % key, seg))

def insert_fields(fn, to_add):
    """to_add: [(key, value_str), ...] 按序插入导出对象开头"""
    p = os.path.join(PLUGINS, fn)
    c = open(p, encoding="utf-8", errors="replace").read()
    brace = locate_export_obj(c)
    if brace is None:
        print(f"  [失败] {fn} 无法定位导出对象"); return
    for key, val in to_add:
        if field_present(c, brace, key):
            continue
        after = c[brace+1:brace+1+60]
        if after.startswith("\n"):
            indent = re.match(r"\n(\s*)", after).group(1) or "    "
            ins = "\n%s%s: %s," % (indent, key, val)
        else:
            ins = " %s: %s," % (key, val)
        c = c[:brace+1] + ins + c[brace+1:]
        print(f"  {fn}: +{key}: {val}")
    open(p, "w", encoding="utf-8", newline="").write(c)

# 执行 1：DJ 类补 cacheControl
print("== 1. cacheControl 补充 ==")
for fn in sorted(ADD_CACHE):
    insert_fields(fn, [("cacheControl", "'no-store'")])

# 执行 2：遗留旧文件补 name
print("== 2. name 补充（遗留旧文件）==")
for fn, nv in sorted(ADD_NAME.items()):
    insert_fields(fn, [("name", "'%s'" % nv)])

# 执行 3：清单收录插件补 srcUrl
print("== 3. srcUrl 补充 ==")
for fn in sorted(os.listdir(PLUGINS)):
    if not fn.endswith(".js") or fn not in listed or fn in SKIP_SRCURL:
        continue
    p = os.path.join(PLUGINS, fn)
    c = open(p, encoding="utf-8", errors="replace").read()
    brace = locate_export_obj(c)
    if brace is None:
        print(f"  [失败] {fn} 无法定位"); continue
    if field_present(c, brace, "srcUrl"):
        continue
    url = "https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/%s" % fn
    insert_fields(fn, [("srcUrl", "'%s'" % url)])
print("完成")
