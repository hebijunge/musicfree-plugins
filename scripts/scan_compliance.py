# -*- coding: utf-8 -*-
"""skill 合规扫描：检查所有插件元数据字段与方法完整性"""
import json, os, re

ROOT = r"C:\Users\ajun\Desktop\tvbox\music"
PLUGINS = os.path.join(ROOT, "plugins")

with open(os.path.join(ROOT, "plugins.json"), encoding="utf-8-sig") as f:
    base = json.load(f)
listed = {os.path.basename(it["url"].split("?")[0]) for it in base["plugins"]}

METHODS = ["search", "getMediaSource", "getLyric", "getAlbumInfo", "getMusicSheetInfo",
           "getArtistWorks", "getMusicInfo", "importMusicItem", "importMusicSheet",
           "getTopLists", "getTopListDetail", "getRecommendSheetTags", "getRecommendSheetsByTag",
           "getMusicComments"]
OPTIONAL = ["author", "description", "srcUrl", "cacheControl", "supportedSearchType", "userVariables", "hints"]

def expand(c, seg):
    consts = {m.group(1): m.group(2) for m in re.finditer(r"\b(?:var|let|const)\s+([A-Z_][A-Z0-9_]*)\s*=\s*['\"]([^'\"]+)['\"]", c)}
    return re.sub(r"\b([A-Z_][A-Z0-9_]*)\b", lambda m: "'" + consts[m.group(1)] + "'" if m.group(1) in consts else m.group(0), seg)

def inspect(fn):
    c = open(os.path.join(PLUGINS, fn), encoding="utf-8", errors="replace").read()
    # 顶层 plugin 对象：优先最后一个 var plugin = {（聚合插件结构特殊），否则 exports = {
    candidates = list(re.finditer(r"\b(?:var|let|const|window\.|globalThis\.)\s*plugin\s*=\s*\{", c))
    m = re.search(r"module\.exports\s*=\s*\{", c)
    if m:
        start = m.end() - 1
    elif candidates:
        start = c.index("{", candidates[-1].start())
    else:
        return None
    seg = expand(c, c[start:start+40000])
    head = seg[:12000]
    def field(key):
        mm = re.search(r"(?:^|\n)\s*%s\s*:\s*['\"]([^'\"]*)['\"]" % key, head)
        return mm.group(1) if mm else None
    def has(key):
        return bool(re.search(r"(?:^|\n)\s*%s\s*:" % key, head))
    methods = [mth for mth in METHODS if re.search(r"(?:^|\n)\s*(?:async\s+)?%s\s*\(" % mth, head)]
    return {
        "name": field("name"), "platform": field("platform"), "version": field("version"),
        "author": field("author"), "description": field("description"), "srcUrl": field("srcUrl"),
        "cacheControl": field("cacheControl"), "hasSST": has("supportedSearchType"),
        "methods": methods,
    }

print(f"{'文件':<50}{'清单':<4}{'platform':<10}{'ver':<8}{'name':<12}{'author':<10}{'desc':<6}{'srcUrl':<8}{'cache':<10}方法数")
missing = {}
for fn in sorted(os.listdir(PLUGINS)):
    if not fn.endswith(".js"):
        continue
    info = inspect(fn)
    if info is None:
        print(f"{fn:<50} 无法解析"); continue
    in_list = fn in listed
    problems = []
    if not info["platform"]: problems.append("platform")
    if not info["version"]: problems.append("version")
    if not info["name"]: problems.append("name")
    if not info["author"]: problems.append("author")
    if not info["description"]: problems.append("description")
    if not info["srcUrl"]: problems.append("srcUrl")
    if not info["cacheControl"]: problems.append("cacheControl")
    if not info["hasSST"]: problems.append("supportedSearchType")
    if "search" not in info["methods"]: problems.append("search方法")
    if "getMediaSource" not in info["methods"]: problems.append("getMediaSource方法")
    tag = "清单" if in_list else "遗留"
    print(f"{fn:<50}{tag:<4}{str(info['platform']):<10}{str(info['version']):<8}{str(info['name']):<12}{str(info['author']):<10}{'Y' if info['description'] else '-':<6}{'Y' if info['srcUrl'] else '-':<8}{str(info['cacheControl']):<10}{len(info['methods'])}")
    if problems:
        missing[fn] = (tag, problems)

print("\n=== 缺失字段汇总 ===")
for fn, (tag, probs) in sorted(missing.items()):
    print(f"  [{tag}] {fn}: 缺 {', '.join(probs)}")
