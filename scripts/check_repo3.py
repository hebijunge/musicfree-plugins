# -*- coding: utf-8 -*-
"""v3: 展开常量，精确获取所有插件真实 name/platform/version"""
import json, os, re

ROOT = r"C:\Users\ajun\Desktop\tvbox\music"
PLUGINS = os.path.join(ROOT, "plugins")

with open(os.path.join(ROOT, "plugins.json"), encoding="utf-8-sig") as f:
    base = json.load(f)
base_by_file = {os.path.basename(it["url"].split("?")[0]): it for it in base["plugins"]}

FNVER = re.compile(r"(?:[-.]v?)(\d+\.\d+(?:\.\d+)?(?:-r\d+)?)\.js$")

def expand_constants(c, obj_seg):
    """把 obj_seg 中出现的常量名替换为定义值"""
    consts = {}
    for m in re.finditer(r"\b(?:var|let|const)\s+([A-Z_][A-Z0-9_]*)\s*=\s*['\"]([^'\"]+)['\"]", c):
        consts[m.group(1)] = m.group(2)
    def repl(m):
        name = m.group(1)
        return "'" + consts.get(name, "?") + "'" if name in consts else m.group(0)
    return re.sub(r"\b([A-Z_][A-Z0-9_]*)\b", repl, obj_seg)

def extract(fn):
    c = open(os.path.join(PLUGINS, fn), encoding="utf-8", errors="replace").read()
    m = re.search(r"module\.exports\s*=\s*(plugin|\{)", c)
    if not m:
        return None, "NO_EXPORT"
    if m.group(1) == "{":
        start = m.end() - 1
    else:
        pm = re.search(r"\b(?:var|let|const|window\.|globalThis\.)\s*plugin\s*=\s*\{", c)
        if not pm:
            return None, "NO_PLUGIN_VAR"
        start = c.index("{", pm.start())
    seg = c[start:start+30000]
    seg = expand_constants(c, seg)
    head = seg[:8000]
    def field(key):
        mm = re.search(r"(?:^|\n)\s*%s\s*:\s*['\"]([^'\"]+)['\"]" % key, head)
        return mm.group(1) if mm else None
    return {"name": field("name"), "platform": field("platform"), "version": field("version")}, "OK"

print("=== 全部插件真实元数据（常量已展开）===")
rows = []
for fn in sorted(os.listdir(PLUGINS)):
    if not fn.endswith(".js"):
        continue
    m = FNVER.search(fn)
    fn_ver = m.group(1) if m else "?"
    meta, st = extract(fn)
    if meta is None:
        print(f"{fn}: 提取失败({st})")
        continue
    bi = base_by_file.get(fn)
    issues = []
    iv = meta["version"] or "?"
    inm = meta["name"]
    if fn_ver != "?" and iv != "?" and fn_ver != iv and not (fn_ver == "1.0.0-r2" and iv == "1.0.0"):
        issues.append(f"文件名v{fn_ver}≠内部v{iv}")
    if bi:
        if bi["version"] != iv and iv != "?":
            issues.append(f"清单v{bi['version']}≠内部v{iv}")
        if inm and inm != bi["name"]:
            issues.append(f"内部name[{inm}]≠清单name[{bi['name']}]")
    else:
        issues.append("未收录于清单")
    status = "; ".join(issues) if issues else "OK"
    rows.append((fn, fn_ver, iv, inm or "(缺)", bi["name"] if bi else "未收录", status))

w = max(len(r[0]) for r in rows)
for fn, fv, iv, inm, lname, st in rows:
    print(f"{fn:<{w}} 文件v{fv:<10}内部v{iv:<10}name={inm:<16}清单={lname:<10}{st}")
print("\n=== 非OK ===")
for r in rows:
    if r[5] != "OK":
        print("  " + " | ".join(r))
