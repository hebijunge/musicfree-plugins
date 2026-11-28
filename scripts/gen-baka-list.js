// 从 baka-plugins/*.js 读取 V2 manifest，生成 baka-list.json
// 用法: node scripts/gen-baka-list.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'baka-plugins');
const CAT_EDM = /电音|舞曲|Mix|黑色音频|172|36dj|dianyinge|hy57|mixdj|spacedj|xxedm|y2002|82dj/i;
const CAT_DJ = /DJ|54dj|73dj|dj6|dj766|djcsj|djkk|djmei|djdjuu|djyule|djyyy|huole|huolongdj|pgdjz|qqdj|bibdj|bobidj|ddddj|djduoduo/i;
const CAT_COMMON = /^org\.hebijunge\.(qq|kuwo|kugou|migu|netease|qishui)$/;
const CAT_RADIO = /^org\.hebijunge\.(fanqie|lrts|bokantingshu|missevan|qingting|ximalaya|lizhi|neteaseradio|cctv|xiangsheng-pingshu)$/;
const QUAL_RANK = { '64k': 1, '96k': 2, '128k': 3, '192k': 4, '320k': 5, flac: 6, flac24bit: 7, hires: 8, master: 9 };
function topQuality(qualities) {
  let best = '', rank = 0;
  for (const quality of qualities) {
    const next = QUAL_RANK[quality] || 0;
    if (next > rank) { rank = next; best = quality; }
  }
  return best;
}
function categorize(id, name, top) {
  if (CAT_EDM.test(id) || CAT_EDM.test(name) || CAT_DJ.test(id) || CAT_DJ.test(name)) {
    return ['320k', 'flac', '192k', '128k', 'flac24bit', 'hires', 'master'].includes(top) ? 'djhq' : 'dj64';
  }
  if (CAT_COMMON.test(id)) return 'common';
  if (CAT_RADIO.test(id)) return 'radio';
  return 'music';
}
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();
const plugins = [];

for (const file of files) {
  const provider = require(path.join(DIR, file));
  const manifest = provider && provider.manifest;
  if (!manifest || !manifest.id || !manifest.name) throw new Error('invalid Baka manifest: ' + file);
  const supportedQualities = manifest.supportedQualities || [];
  const top = topQuality(supportedQualities);
  plugins.push({
    name: manifest.name,
    version: manifest.version || '1.0.0',
    file,
    id: manifest.id,
    sourceId: manifest.sourceId,
    capabilities: manifest.capabilities || [],
    supportedSearchType: manifest.supportedSearchType || [],
    supportedQualities,
    category: categorize(manifest.id, manifest.name, top),
    topQuality: top,
  });
}

const out = { generatedAt: new Date().toISOString(), count: plugins.length, plugins };
fs.writeFileSync(path.join(ROOT, 'baka-list.json'), JSON.stringify(out, null, 2) + '\n');
console.log('baka-list.json written: ' + plugins.length + ' plugins');
