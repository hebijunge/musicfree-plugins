// 生成 mf-cats.json（供 index.html MusicFree 生态区按分类展示）。
// 分类逻辑与澜音 gen-ceru-list.js 完全一致：
//   common = 常用音乐（QQ/酷我/酷狗/咪咕/网易云/汽水/哔哩哔哩）
//   music  = 其它音乐平台
//   radio  = 听书 / 电台 / 播客
//   djhq   = DJ / 电音 / 舞曲（中高品质，128k/320k/flac）
//   dj64   = DJ / 电音 / 舞曲（低品质，仅 64k/96k 在线流）
//
// 音质档位只在未混淆的源码仓 musicfree-plugins-src/plugins/*.js 里（supportedQualities 明文），
// 混淆后的公开仓产物读不到，所以：
//   1. 有源码仓（本地开发机）→ 直接从源码解析，音质权威
//   2. 无源码仓（GitHub Actions / 公开仓克隆）→ 沿用已提交的 mf-cats.json 音质档位，
//      重算分类，保证新增/删除插件后分类不失效
// 用法: node scripts/gen-mf-cats.js
const fs = require('fs');
const path = require('path');

const SRC_DIR = process.env.MF_SRC_DIR || path.resolve(__dirname, '..', '..', 'musicfree-plugins-src', 'plugins');
const OUT = path.join(__dirname, '..', 'mf-cats.json');

// 分类规则（按文件名前缀识别，最可靠；与澜音 id 规则一致）
const CAT_EDM = /^(172mix|36dj|dianyinge|hy57|mixdj|spacedj|xxedm|y2002|82dj|dj14|ddddj)/i;
const CAT_DJ = /^(54dj|73dj|dj6|dj766|djcsj|djkk|djmei|djshow|djyule|djyyy|huolongdj|pgdjz|qqdjs|bibdj|bobidj|djduoduo|djuu|xsdj123)/i;
const CAT_COMMON = /^(qq|kuwo|kugou|migu|netease|qishui|bilibili)$/;
const CAT_RADIO = /^(fanqie|lrts|bokantingshu|missevan|qingting|ximalaya|lizhi|neteaseradio|cctv|xiangsheng-pingshu)$/;

const QUAL_RANK = { '64k': 1, '96k': 2, '128k': 3, '192k': 4, '320k': 5, flac: 6, flac24bit: 7, hires: 8, master: 9 };
function topQuality(qualities) {
  if (!Array.isArray(qualities) || !qualities.length) return '';
  let best = '', bestR = 0;
  for (const q of qualities) {
    const r = QUAL_RANK[q] || 0;
    if (r > bestR) { bestR = r; best = q; }
  }
  return best;
}
function qualitiesOf(text) {
  const m = text.match(/supportedQualities\s*:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
function nameOf(text, file) {
  const m = text.match(/name\s*:\s*'([^']+)'/);
  return m ? m[1] : file.replace(/-source\.plugin.*|\.plugin.*/, '');
}

// 音质档位来源：有源码仓用源码，否则沿用已提交产物
let byFile = {};
if (fs.existsSync(SRC_DIR)) {
  for (const f of fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
    byFile[f] = { name: nameOf(text, f), topQuality: topQuality(qualitiesOf(text)) };
  }
  console.log('音质来源: 源码仓 ' + SRC_DIR);
} else {
  try {
    const old = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    for (const p of old.plugins || []) byFile[p.file] = { name: p.name, topQuality: p.topQuality || '' };
    console.log('⚠ 未找到源码仓，沿用已提交的 mf-cats.json 音质档位');
  } catch (e) {
    console.log('⚠ 未找到源码仓，也无已提交的 mf-cats.json，DJ 音质维度将归 dj64');
  }
}

// 公开仓 plugins.json 的 name/version 权威（页面显示用）
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugins.json'), 'utf8')).plugins;

const list = [];
for (const p of manifest) {
  const file = p.url.split('/').pop();
  const src = byFile[file] || {};
  const key = file.replace(/-source\.plugin.*|\.plugin.*/, '').replace(/-v\d+(\.\d+)*$/, '');
  let category;
  if (CAT_EDM.test(key) || CAT_DJ.test(key)) {
    const top = src.topQuality || '';
    // DJ 与电音舞曲同属 DJ 大类，按最高音质拆：≥128k 归 djhq，否则 dj64
    category = (top === '320k' || top === 'flac' || top === '192k' || top === '128k' || top === 'flac24bit' || top === 'hires' || top === 'master') ? 'djhq' : 'dj64';
  }
  else if (CAT_COMMON.test(key)) category = 'common';
  else if (CAT_RADIO.test(key)) category = 'radio';
  else category = 'music';
  list.push({ name: p.name || src.name, version: p.version, file, category, topQuality: src.topQuality || '' });
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: list.length, plugins: list }, null, 2) + '\n');
console.log('mf-cats.json written: ' + list.length + ' plugins');
const byCat = {};
for (const p of list) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log('分类:', JSON.stringify(byCat));