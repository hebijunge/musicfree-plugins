# -*- coding: utf-8 -*-
"""检查 17 个 DJ 插件 + cctv/dj6/xiangsheng 的 platform 字段"""
import os, re

PLUGINS = os.path.join(ROOT, "plugins")
files = [
 '172mix-source.plugin.v1.0.0.js','36dj-source.plugin.v1.0.0.js','54dj-source.plugin.v1.0.0.js',
 '82dj-source.plugin.v1.0.0.js','bibdj-source.plugin.v1.0.0.js','ddddj-source.plugin.v1.0.0.js',
 'dianyinge-source.plugin.v1.0.0.js','dj14-source.plugin.v1.0.0.js','dj766-source.plugin.v1.0.0.js',
 'djkk-source.plugin.v1.0.0.js','djyyy-source.plugin.v1.0.0.js','htqyy-source.plugin.v1.0.0.js',
 'hy57-source.plugin.v1.0.0.js','pgdjz-source.plugin.v1.0.0.js','qichedj-source.plugin.v1.0.0.js',
 'qqdjs-source.plugin.v1.0.0.js','spacedj-source.plugin.v1.0.0.js',
 'cctv-source.plugin.v1.0.0.js','dj6-source.plugin.v1.0.0.js','xiangsheng-pingshu-source.plugin.v1.0.0.js',
 'agg-source.plugin.v1.9.15.js','jamendo-source.plugin.v1.0.1.js',
]
for fn in files:
    c = open(os.path.join(PLUGINS, fn), encoding='utf-8', errors='replace').read()
    m = re.search(r"module\.exports\s*=\s*(plugin|\{)", c)
    if not m:
        print(f"{fn}: NO EXPORT"); continue
    if m.group(1) == '{':
        start = m.end()-1
    else:
        pm = re.search(r"\b(?:var|let|const|window\.|globalThis\.)\s*plugin\s*=\s*\{", c)
        if not pm:
            print(f"{fn}: NO PLUGIN VAR"); continue
        start = c.index('{', pm.start())
    seg = c[start:start+20000]
    consts = {mm.group(1): mm.group(2) for mm in re.finditer(r"\b(?:var|let|const)\s+([A-Z_][A-Z0-9_]*)\s*=\s*['\"]([^'\"]+)['\"]", c)}
    def field(key):
        mm = re.search(r"(?:^|\n)\s*%s\s*:\s*([^,\n]+)" % key, seg[:6000])
        if not mm: return None
        v = mm.group(1).strip()
        if v.startswith("'"): return v[1:-1]
        if re.match(r"^[A-Z_][A-Z0-9_]*$", v): return consts.get(v, '?' + v + '?')
        return v[:40]
    print(f"{fn:<52} name={field('name')!r:<18} platform={field('platform')!r:<18} version={field('version')!r}")
