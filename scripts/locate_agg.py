# -*- coding: utf-8 -*-
"""定位 agg 插件顶层 plugin 对象定义"""
import re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "plugins", "agg-source.plugin.v1.9.15.js")
c = open(p, encoding="utf-8", errors="replace").read()
print("file len:", len(c))
# 找 plugin 对象定义
for pat in [r"\bvar\s+plugin\s*=\s*\{", r"\blet\s+plugin\s*=\s*\{", r"\bconst\s+plugin\s*=\s*\{",
            r"\bwindow\.plugin\s*=\s*\{", r"\bmodule\.exports\s*=\s*\{"]:
    for m in re.finditer(pat, c):
        print(f"  found {pat!r} at {m.start()} (line {c.count(chr(10), 0, m.start())+1})")
# 打印最后一个 plugin = { 附近内容
ms = list(re.finditer(r"\b(?:var|let|const|window\.)\s*plugin\s*=\s*\{", c))
if ms:
    m = ms[-1]
    seg = c[m.start():m.start()+3000]
    print("\n--- 最后一个 plugin 对象开头 3000 字符 ---")
    print(seg)
