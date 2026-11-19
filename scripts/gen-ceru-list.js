// 从 ceru-plugins/*.ceru.js 提取 manifest，生成 ceru-list.json（供 index.html 澜音生态区渲染）
// 用法: node scripts/gen-ceru-list.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'ceru-plugins');
const OUT = path.join(__dirname, '..', 'ceru-list.json');

// 分类规则：
//   common = 常用音乐（QQ/酷我/酷狗/咪咕/网易云/汽水；澜音暂无哔哩哔哩）
//   music  = 其它音乐平台
//   radio  = 听书 / 电台 / 播客
//   dj     = DJ 站（64k 在线试听流为主）
//   djhq   = DJ 站（128k/320k/flac 高质量）
//   edm    = 电音 / 电子 / 舞曲 / Mix
const CAT_EDM = /电音|舞曲|Mix|黑色音频|172|36dj|dianyinge|hy57|mixdj|spacedj|xxedm|y2002|82dj/i;
const CAT_DJ = /DJ|54dj|73dj|dj6|dj766|djcsj|djkk|djmei|djdjuu|djyule|djyyy|huole|huolongdj|pgdjz|qqdj|bibdj|bobidj|ddddj|djduoduo/i;
const CAT_COMMON = /^ceru\.(qq|kuwo|kugou|migu|netease|qishui)$/;
const CAT_RADIO = /^ceru\.(fanqie|lrts|bokantingshu|missevan|qingting|ximalaya|lizhi|neteaseradio|cctv|xiangsheng)$/;

const QUAL_RANK = { '64k': 1, '96k': 2, '128k': 3, '192k': 4, '320k': 5, flac: 6 };
function topQuality(qualities) {
  if (!Array.isArray(qualities) || !qualities.length) return '';
  let best = '', bestR = 0;
  for (const q of qualities) {
    const r = QUAL_RANK[q] || 0;
    if (r > bestR) { bestR = r; best = q; }
  }
  return best;
}

function field(block, key) {
  const m = block.match(new RegExp(key + "\\s*:\\s*'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'"));
  return m ? m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : '';
}
function qualitiesOf(block) {
  // 取第一个 qualities: [...]（manifest 内明文数组，混淆产物可能二次出现但首个在 manifest）
  const m = block.match(/qualities\s*:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.ceru.js')).sort();
const list = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const start = text.indexOf('exports.manifest');
  if (start < 0) { console.warn('!! no manifest: ' + f); continue; }
  let block = text.slice(start, text.indexOf('\n};', start) + 3);
  const id = field(block, 'id');
  const name = field(block, 'name');
  const version = field(block, 'version');
  const description = field(block, 'description');
  const author = field(block, 'author');
  if (!id || !name) { console.warn('!! bad manifest: ' + f); continue; }
  const qualities = qualitiesOf(block);
  const top = topQuality(qualities);
  let category;
  if (CAT_EDM.test(id) || CAT_EDM.test(name)) category = 'edm';
  else if (CAT_DJ.test(id) || CAT_DJ.test(name)) {
    // DJ 按最高音质拆：≥128k（或 96k+320k 组合）归 djhq，否则 dj64
    category = (top === '320k' || top === 'flac' || top === '192k' || top === '128k') ? 'djhq' : 'dj64';
  }
  else if (CAT_COMMON.test(id)) category = 'common';
  else if (CAT_RADIO.test(id)) category = 'radio';
  else category = 'music';
  list.push({ name, version: version || '1.0.0', file: f, description, author, id, category, qualities, topQuality: top });
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: list.length, plugins: list }, null, 2) + '\n');
console.log('ceru-list.json written: ' + list.length + ' plugins');
const byCat = {};
for (const p of list) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log('分类:', JSON.stringify(byCat));
