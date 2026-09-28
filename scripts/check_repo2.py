# -*- coding: utf-8 -*-
"""musicfree-plugins 仓库检查脚本 v2：精确提取元数据做三方核对"""
import json, os, re, sys

ROOT = r"C:\Users\ajun\Desktop\tvbox\music"
PLUGINS = os.path.join(ROOT, "plugins")

def extract_meta(fn):
    """兼容 module.exports = {...} 和 module.exports = plugin; (var plugin = {...})"""
    p = os.path.join(PLUGINS, fn)
    with open(p, encoding="utf-8", errors="replace") as f:
        c = f.read()
    m = re.search(r"module\.exports\s*=\s*(plugin|\{)", c)
    if not m:
        return None, "NO_EXPORTS_PATTERN"
    if m.group(1) == "{":
        start = m.end() - 1  # 指向 {
    else:
        pm = re.search(r"\b(?:var|let|const|window\.|globalThis\.)\s*plugin\s*=\s*\{", c)
        if not pm:
            return None, "NO_PLUGIN_VAR"
        start = c.index("{", pm.start())
    block = c[start:start+20000]  # 对象字面量开头 20000 字符
    # 取最外层前几行内的元数据字段（name/platform/version/description 短串）
    head = block[:6000]
    def field(key):
        m2 = re.search(r"(?:^|\n)\s*%s\s*:\s*['\"]([^'\"]+)['\"]" % key, head)
        return m2.group(1) if m2 else None
    return {
        "name": field("name"),
        "platform": field("platform"),
        "version": field("version"),
    }, "OK"

# 载入基准清单 plugins.json
with open(os.path.join(ROOT, "plugins.json"), encoding="utf-8-sig") as f:
    base = json.load(f)
base_by_file = {}
for it in base["plugins"]:
    fn = os.path.basename(it["url"].split("?")[0])
    base_by_file[fn] = it

# 文件名版本提取（兼容 apple-music-v1.0.0.js 与 xxx.plugin.v1.0.0.js）
FNVER = re.compile(r"(?:[-.]v?|\.v?)(\d+\.\d+(?:\.\d+)?(?:-r\d+)?)\.js$")

print("=== 插件元数据 vs 清单(plugins.json) 核对 ===")
print(f"{'文件':<52}{'文件版本':<12}{'内部version':<12}{'内部name':<14}{'清单name':<14}状态")
rows = []
for fn in sorted(os.listdir(PLUGINS)):
    if not fn.endswith(".js"):
        continue
    m = FNVER.search(fn)
    fn_ver = m.group(1) if m else ("?" if "v" in fn else "N/A")
    meta, status = extract_meta(fn)
    bi = base_by_file.get(fn)
    issues = []
    if meta is None:
        issues.append(f"元数据提取失败({status})")
        rows.append((fn, fn_ver, "?", "?", bi["name"] if bi else "?", "; ".join(issues)))
        continue
    iv = meta.get("version") or "?"
    inm = meta.get("name") or "(缺name)"
    lname = bi["name"] if bi else "未收录"
    if fn_ver != "?" and iv != "?" and fn_ver != iv:
        issues.append(f"文件名版本≠内部版本")
    if bi and lname != "(缺name)" and inm != lname:
        issues.append(f"内部name≠清单name")
    if bi and meta.get("version") and bi["version"] != meta["version"]:
        issues.append(f"清单version≠内部version")
    rows.append((fn, fn_ver, iv, inm, lname, "; ".join(issues) or "OK"))

for r in rows:
    print(f"{r[0]:<52}{r[1]:<12}{r[2]:<12}{r[3]:<14}{r[4]:<14}{r[5]}")

# 汇总有问题的
print("\n=== 问题汇总 ===")
bad = [r for r in rows if r[5] != "OK"]
for r in bad:
    print(f"  {r[0]}: {r[5]}")
print(f"\n共 {len(rows)} 个 js 文件, {len(bad)} 个有问题")
