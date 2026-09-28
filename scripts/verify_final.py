# -*- coding: utf-8 -*-
"""最终验证：清单 JSON 有效性、一致性、引用完整性、版本一致性"""
import json, os, re

ROOT = r"C:\Users\ajun\Desktop\tvbox\music"
PLUGINS = os.path.join(ROOT, "plugins")

manifests = sorted(f for f in os.listdir(ROOT) if f.endswith(".json") and os.path.isfile(os.path.join(ROOT, f)))
ok = True

datas = {}
for mf in manifests:
    try:
        with open(os.path.join(ROOT, mf), encoding="utf-8-sig") as f:
            datas[mf] = json.load(f)
        print(f"  {mf}: {len(datas[mf]['plugins'])} 条 JSON OK")
    except Exception as e:
        print(f"  INVALID JSON {mf}: {e}"); ok = False

def norm(d):
    return sorted((it.get("name"), it.get("version"), os.path.basename(it["url"].split("?")[0])) for it in d["plugins"])

base = norm(datas[manifests[0]])
diffs = [mf for mf in manifests[1:] if norm(datas[mf]) != base]
print("清单间一致性:", "一致（%d 个清单）" % len(manifests) if not diffs else f"不一致: {diffs}")
if diffs: ok = False

refs = set()
for d in datas.values():
    for it in d["plugins"]:
        refs.add(os.path.basename(it["url"].split("?")[0]))
allf = set(os.listdir(PLUGINS))
missing = sorted(refs - allf)
print("引用文件缺失:", missing if missing else "无")
if missing: ok = False

unref = sorted(allf - refs)
print(f"未被任何清单引用 {len(unref)} 个:", unref)

bad = []
for mf, d in datas.items():
    for it in d["plugins"]:
        fn = os.path.basename(it["url"].split("?")[0])
        m = re.search(r"(?:[-.]v?)(\d+\.\d+(?:\.\d+)?(?:-r\d+)?)\.js$", fn)
        fv = m.group(1) if m else "?"
        if it["version"] != fv and not (fv == "1.0.0-r2" and it["version"] == "1.0.0"):
            bad.append((mf, it["name"], it["version"], fn))
print("清单version≠文件名版本:", bad if bad else "无")
if bad: ok = False

print("最终结论:", "PASS" if ok else "FAIL")
