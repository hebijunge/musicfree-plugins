# -*- coding: utf-8 -*-
import re, os
PLUGINS = os.path.join(ROOT, "plugins")
for fn in ['172mix-source.plugin.v1.0.0.js','djkk-source.plugin.v1.0.0.js',
           'ximalaya-source.plugin.v1.0.0-r2.js','joox-source.plugin.v1.1.0.js',
           'djduoduo-source.plugin.v1.0.0.js','missevan-source.plugin.v1.0.0.js',
           'djuu-source.plugin.v1.1.0.js','agg-source.plugin.v1.9.15.js',
           'cctv-source.plugin.v1.0.0.js','xiangsheng-pingshu-source.plugin.v1.0.0.js',
           'dj6-source.plugin.v1.0.0.js','jamendo-source.plugin.v1.0.1.js']:
    p = os.path.join(PLUGINS, fn)
    c = open(p, encoding='utf-8', errors='replace').read()
    print('='*30, fn, 'len', len(c))
    # 找 exports 语句
    m = re.search(r'module\.exports\s*=', c)
    if not m:
        print('  NO module.exports'); continue
    tail = c[m.end():m.end()+50]
    print('  after exports:', tail[:50].replace('\n',' '))
    # 找对象起点：exports = { 或 var plugin = {
    obj = None
    if tail.lstrip().startswith('{'):
        obj = m.end() + tail.index('{')
    else:
        pm = re.search(r'\b(?:var|let|const)\s+plugin\s*=\s*\{', c)
        if pm:
            obj = c.index('{', pm.start())
    if obj is None:
        print('  cannot locate object'); continue
    seg = c[obj:obj+2500]
    # 打印前 1200 字符中 name/platform/version 附近
    for key in ['name','platform','version']:
        for mm in re.finditer(r'(?:^|\n)\s*%s\s*:\s*([^\n,]{0,60})' % key, seg):
            print('  ', mm.group(0).strip()[:80])
            break
        else:
            print('   no', key, 'in first 2500 chars')
