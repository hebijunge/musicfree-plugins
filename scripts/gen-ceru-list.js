// 从 ceru-plugins/*.ceru.js 提取 manifest，生成 ceru-list.json（供 index.html 澜音生态区渲染）
// 用法: node scripts/gen-ceru-list.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'ceru-plugins');
const OUT = path.join(__dirname, '..', 'ceru-list.json');

function field(block, key) {
  const m = block.match(new RegExp(key + "\\s*:\\s*'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'"));
  return m ? m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : '';
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
  list.push({ name, version: version || '1.0.0', file: f, description, author, id });
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: list.length, plugins: list }, null, 2) + '\n');
console.log('ceru-list.json written: ' + list.length + ' plugins');
