# -*- coding: utf-8 -*-
"""musicfree-plugins 仓库全面检查脚本 v1"""
import json, os, re, sys, hashlib, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # scripts/ 上一级 = 仓库根
PLUGINS = os.path.join(ROOT, "plugins")
issues = []

def log(kind, msg):
    issues.append((kind, msg))
    print(f"[{kind}] {msg}")

# ---------- 1. 清单 JSON 有效性 & 条目统计 ----------
manifests = sorted([f for f in os.listdir(ROOT) if f.endswith(".json") and os.path.isfile(os.path.join(ROOT, f))])
manifest_data = {}
print("== 1. 清单解析 ==")
for mf in manifests:
    p = os.path.join(ROOT, mf)
    try:
        with open(p, encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as e:
        log("JSON-INVALID", f"{mf}: {e}")
        continue
    if not isinstance(data, dict) or "plugins" not in data:
        log("JSON-SCHEMA", f"{mf}: 缺少 plugins 字段")
        continue
    pl = data["plugins"]
    if not isinstance(pl, list):
        log("JSON-SCHEMA", f"{mf}: plugins 不是数组")
        continue
    manifest_data[mf] = data
    print(f"  {mf}: {len(pl)} 条, desc={data.get('desc')!r}")

# ---------- 2. 清单条目字段完整性 & 版本与文件名一致性 ----------
print("== 2. 清单条目字段检查 ==")
for mf, data in manifest_data.items():
    seen = {}
    for i, it in enumerate(data["plugins"]):
        if not isinstance(it, dict):
            log("ITEM-SCHEMA", f"{mf}#{i}: 条目不是对象")
            continue
        for k in ("name", "url", "version"):
            if k not in it or not it[k]:
                log("ITEM-FIELD", f"{mf}#{i}({it.get('name','?')}): 缺少 {k}")
        url = it.get("url", "")
        fn = os.path.basename(url.split("?")[0])
        if fn in seen:
            log("ITEM-DUP", f"{mf}: 重复条目 {it.get('name')} -> {fn} (与 #{seen[fn]} 相同)")
        seen[fn] = i
        # 从文件名提取版本
        m = re.search(r"\.v?(\d+\.\d+(?:\.\d+)?(?:-r\d+)?)\.js$", fn)
        if m:
            fn_ver = m.group(1)
            if it.get("version") != fn_ver:
                log("VER-MISMATCH", f"{mf}: {it.get('name')} 清单version={it.get('version')} 但文件名版本={fn_ver} ({fn})")

# ---------- 3. 清单间一致性（忽略域名，按 name+version+文件名 对比） ----------
print("== 3. 清单间一致性 ==")
def norm(data):
    items = []
    for it in data["plugins"]:
        fn = os.path.basename(it.get("url", "").split("?")[0])
        items.append((it.get("name"), it.get("version"), fn))
    return sorted(items)
base = None
base_mf = None
for mf, data in manifest_data.items():
    n = norm(data)
    if base is None:
        base, base_mf = n, mf
        continue
    if n != base:
        sb, sn = set(base), set(n)
        only_base = sorted(sb - sn)
        only_this = sorted(sn - sb)
        if only_base or only_this:
            log("LIST-DIFF", f"{mf} 与基准 {base_mf} 不一致: 仅基准有={only_base}, 仅{mf}有={only_this}")
        else:
            print(f"  {mf}: 与 {base_mf} 一致（顺序不同）")
    else:
        print(f"  {mf}: 与 {base_mf} 一致")

# ---------- 4. 清单引用的本地文件存在性 ----------
print("== 4. 引用文件存在性 ==")
refs = {}
for mf, data in manifest_data.items():
    for it in data["plugins"]:
        fn = os.path.basename(it.get("url", "").split("?")[0])
        refs.setdefault(fn, set()).add(mf)
all_files = set(os.listdir(PLUGINS))
for fn, mfs in refs.items():
    if fn not in all_files:
        log("FILE-MISSING", f"{fn} 被 {sorted(mfs)} 引用但 plugins/ 中不存在")
print(f"  共引用 {len(refs)} 个文件; plugins/ 实际 {len(all_files)} 个文件")

# 未被任何清单引用的插件文件（遗留文件）
unref = sorted(all_files - set(refs.keys()))
if unref:
    print(f"  [INFO] 未被任何清单引用的文件: {unref}")

# ---------- 5. 插件 JS 语法检查 ----------
print("== 5. node --check 语法 ==")
for fn in sorted(all_files):
    if not fn.endswith(".js"):
        continue
    p = os.path.join(PLUGINS, fn)
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        log("JS-SYNTAX", f"{fn}: {r.stderr.strip()[:300]}")

# ---------- 6. 插件内部元数据（name/platform/version）与清单核对 ----------
print("== 6. 插件内部元数据 ==")
meta_cache = {}
for fn in sorted(all_files):
    if not fn.endswith(".js"):
        continue
    p = os.path.join(PLUGINS, fn)
    with open(p, encoding="utf-8", errors="replace") as f:
        content = f.read()
    # 定位 module.exports 块
    me = re.search(r"module\.exports\s*=\s*\{", content)
    if not me:
        log("NO-EXPORTS", f"{fn}: 未找到 module.exports")
        continue
    # 粗略截取导出块（到下一个顶层 } 前的对象字面量，取前 2000 字符足够覆盖元数据字段）
    block = content[me.end():me.end()+4000]
    def field(key):
        m = re.search(r"\b%s\s*:\s*['\"]([^'\"]+)['\"]" % key, block)
        return m.group(1) if m else None
    meta_cache[fn] = {
        "name": field("name"),
        "platform": field("platform"),
        "version": field("version"),
        "description": (re.search(r"\bdescription\s*:\s*['\"]([^'\"]{0,80})", block).group(1) if re.search(r"\bdescription\s*:\s*['\"]([^'\"]{0,80})", block) else None),
    }
    print(f"  {fn}: name={meta_cache[fn]['name']} platform={meta_cache[fn]['platform']} version={meta_cache[fn]['version']}")

# ---------- 7. 清单 name/version 与插件内部元数据交叉核对 ----------
print("== 7. 交叉核对 ==")
for mf, data in manifest_data.items():
    for it in data["plugins"]:
        fn = os.path.basename(it.get("url", "").split("?")[0])
        meta = meta_cache.get(fn)
        if not meta:
            continue
        if meta.get("version") and it.get("version") and meta["version"] != it["version"]:
            log("CROSS-VER", f"{mf}: {it.get('name')} 清单version={it['version']} 插件内部version={meta['version']} ({fn})")

print("\n===== 检查完成，共 %d 个问题 =====" % len(issues))
