# -*- coding: utf-8 -*-
"""修复脚本2：1) 18 个插件补 name 字段 2) 17 个重命名插件 srcUrl 同步 3) jamendo name 修正"""
import os, re

PLUGINS = r"C:\Users\ajun\Desktop\tvbox\music\plugins"

# 重命名映射（新文件名 -> 新版本号）
NEW_VER = {
    "172mix-source.plugin.v1.1.0.js": "1.1.0",
    "36dj-source.plugin.v1.1.0.js":  "1.1.0",
    "54dj-source.plugin.v1.1.0.js":  "1.1.0",
    "82dj-source.plugin.v1.1.0.js":  "1.1.0",
    "bibdj-source.plugin.v1.1.0.js": "1.1.0",
    "ddddj-source.plugin.v1.2.0.js": "1.2.0",
    "dianyinge-source.plugin.v1.1.0.js": "1.1.0",
    "dj14-source.plugin.v1.2.0.js":  "1.2.0",
    "dj766-source.plugin.v1.1.0.js": "1.1.0",
    "djkk-source.plugin.v1.1.0.js":  "1.1.0",
    "djyyy-source.plugin.v1.1.0.js": "1.1.0",
    "htqyy-source.plugin.v1.2.0.js": "1.2.0",
    "hy57-source.plugin.v1.1.0.js":  "1.1.0",
    "pgdjz-source.plugin.v1.1.0.js": "1.1.0",
    "qichedj-source.plugin.v1.1.0.js": "1.1.0",
    "qqdjs-source.plugin.v1.2.0.js": "1.2.0",
    "spacedj-source.plugin.v1.1.0.js": "1.1.0",
}

# 需要补 name 的文件 -> name 值
ADD_NAME = {
    "172mix-source.plugin.v1.1.0.js": "172Mix",
    "36dj-source.plugin.v1.1.0.js": "36DJ",
    "54dj-source.plugin.v1.1.0.js": "我是DJ",
    "82dj-source.plugin.v1.1.0.js": "82DJ",
    "bibdj-source.plugin.v1.1.0.js": "宝贝DJ",
    "ddddj-source.plugin.v1.2.0.js": "清风DJ",
    "dianyinge-source.plugin.v1.1.0.js": "电音阁",
    "dj14-source.plugin.v1.2.0.js": "水晶舞曲",
    "dj766-source.plugin.v1.1.0.js": "DJ766",
    "djyyy-source.plugin.v1.1.0.js": "DJ耶耶耶",
    "htqyy-source.plugin.v1.2.0.js": "好听轻音乐",
    "hy57-source.plugin.v1.1.0.js": "黑色音频",
    "qichedj-source.plugin.v1.1.0.js": "汽车DJ",
    "qqdjs-source.plugin.v1.2.0.js": "QQDJ",
    "spacedj-source.plugin.v1.1.0.js": "SpaceDJ",
    "cctv-source.plugin.v1.0.0.js": "CCTV听音",
    "dj6-source.plugin.v1.0.0.js": "DJ6",
    "xiangsheng-pingshu-source.plugin.v1.0.0.js": "相声评书",
}

def locate_export_obj(c):
    """返回导出对象起点 '{' 的位置；找不到返回 None"""
    m = re.search(r"module\.exports\s*=\s*\{", c)
    if m:
        return m.end() - 1
    m = re.search(r"module\.exports\s*=\s*(\w+)", c)
    if m:
        var = m.group(1)
        pm = re.search(r"\b(?:var|let|const|window\.|globalThis\.)\s*%s\s*=\s*\{" % re.escape(var), c)
        if pm:
            return c.index("{", pm.start())
    return None

print("== 1. 补 name 字段 ==")
for fn, nv in ADD_NAME.items():
    p = os.path.join(PLUGINS, fn)
    if not os.path.exists(p):
        print(f"  [跳过] {fn} 不存在"); continue
    c = open(p, encoding="utf-8", errors="replace").read()
    if re.search(r"\bname\s*:\s*['\"]", c[:c.find("module.exports") if "module.exports" in c else len(c)]):
        # 已有 name（如常量形式），跳过
        brace = locate_export_obj(c)
        if brace and re.search(r"(?:^|\n)\s*name\s*:", c[brace:brace+8000]):
            print(f"  [已有name] {fn}"); continue
    brace = locate_export_obj(c)
    if brace is None:
        print(f"  [失败] {fn} 无法定位导出对象"); continue
    after = c[brace+1:brace+1+60]
    if after.startswith("\n"):
        indent = re.match(r"\n(\s*)", after).group(1) or "    "
        insert = "\n%sname: '%s'," % (indent, nv)
    else:
        insert = " name: '%s'," % nv
    c = c[:brace+1] + insert + c[brace+1:]
    open(p, "w", encoding="utf-8", newline="").write(c)
    print(f"  {fn}: +name '{nv}'")

print("== 2. srcUrl 同步 ==")
for fn, ver in NEW_VER.items():
    p = os.path.join(PLUGINS, fn)
    if not os.path.exists(p):
        print(f"  [跳过] {fn} 不存在"); continue
    c = open(p, encoding="utf-8", errors="replace").read()
    # srcUrl 中旧文件名（v1.0.0）-> 新文件名
    stem = fn.rsplit(".v", 1)[0]  # e.g. 172mix-source.plugin
    new_c = re.sub(r"(srcUrl\s*:\s*['\"][^'\"]*?/)%s\.plugin\.v1\.0\.0\.js(['\"])" % re.escape(stem),
                   lambda m: m.group(1) + fn + m.group(2), c)
    if new_c != c:
        open(p, "w", encoding="utf-8", newline="").write(new_c)
        print(f"  {fn}: srcUrl 已更新")
    else:
        print(f"  {fn}: srcUrl 未匹配（检查）")

print("== 3. jamendo name 修正 ==")
p = os.path.join(PLUGINS, "jamendo-source.plugin.v1.0.1.js")
c = open(p, encoding="utf-8", errors="replace").read()
if "name: 'Jamendo Client ID'" in c:
    c = c.replace("name: 'Jamendo Client ID'", "name: 'Jamendo'")
    open(p, "w", encoding="utf-8", newline="").write(c)
    print("  jamendo v1.0.1: name 'Jamendo Client ID' -> 'Jamendo'")
else:
    print("  jamendo v1.0.1: 未找到待替换内容")
print("完成")
