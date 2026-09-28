// 审计 v4：过滤"纯转发"方法（方法体仅 return call），剩余输出真实可疑项
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = process.argv[2] || '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_'));

function createSandbox() {
  const sandbox = {
    require: (name) => {
      if (name === 'axios') return { get: () => Promise.resolve({ data: {}, headers: {}, status: 200 }), post: () => Promise.resolve({ data: {}, headers: {}, status: 200 }), default: undefined };
      if (name === 'crypto-js') return { MD5: () => ({ toString: () => '' }), HmacSHA256: () => ({ toString: () => '' }), enc: { Hex: { parse: v => v } }, AES: { encrypt: () => ({ toString: () => '' }), decrypt: () => ({ toString: e => '' }) }, mode: {}, pad: {}, lib: { WordArray: function () {} } };
      if (name === 'he') return { decode: v => v, encode: v => v };
      if (name === 'cheerio') return { load: () => { const $ = () => null; $.find = () => []; $.text = () => ''; $.attr = () => undefined; $.each = () => {}; $.length = 0; return $; } };
      if (name === 'qs') return { stringify: () => '', parse: () => ({}) };
      if (name === 'dayjs') return () => ({ format: () => '' });
      if (name === 'big-integer') return v => ({ toString: () => String(v) });
      if (name === 'webdav') return {};
      return {};
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, setInterval, clearTimeout, clearInterval,
    Promise, JSON, Math, Date, String, Number, Array, Object, Boolean, RegExp, parseInt, parseFloat, isNaN, isFinite,
    Buffer, encodeURIComponent, decodeURIComponent, atob, btoa,
    URL, URLSearchParams, AbortController, TextEncoder, TextDecoder,
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve(''), ok: true, status: 200 }),
    env: { getUserVariables: () => ({}), os: 'win32', appVersion: '1.0.0', lang: 'zh-CN' },
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  sandbox.module = { exports: {} };
  sandbox.exports = sandbox.module.exports;
  return sandbox;
}

function stripComments(s) {
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return s.trim();
}

// 判断是否为纯转发：方法体只 return 一个调用/变量
function isPureForward(body) {
  const m = body.match(/^(?:async\s+)?(?:function\s*)?\(?[\w\s,]*\)?\s*\{\s*return\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (m) return true;
  if (/^\{\s*return\s+[A-Za-z_$][\w$]*\s*;\s*\}$/.test(body)) return true;
  return false;
}
// 判断是否为装饰器包装（调用 _worig/then 等包裹原始方法）
function isDecoratorWrap(body) {
  return /_worig|\.apply\(this|httpsify|wrap/.test(body) && /return/.test(body);
}

const hasField = (body, field) => new RegExp('\\b' + field + '\\b').test(body);
let totalIssue = 0;

for (const f of files) {
  const fp = path.join(dir, f);
  let src;
  try { src = fs.readFileSync(fp, 'utf8'); } catch (e) { continue; }
  const sandbox = createSandbox();
  let ex = null;
  try {
    vm.createContext(sandbox);
    vm.runInContext(src + '\n;module.exports;', sandbox, { filename: f, timeout: 10000 });
    ex = sandbox.module ? sandbox.module.exports : null;
  } catch (e) { continue; }
  if (!ex || typeof ex !== 'object') continue;

  const issues = [];
  const methods = Object.keys(ex).filter(k => typeof ex[k] === 'function' && !k.startsWith('_'));
  const bodies = {};
  for (const k of methods) bodies[k] = stripComments(ex[k].toString());

  const needsReview = [];
  for (const k of methods) {
    const b = bodies[k];
    if (isPureForward(b)) continue;       // 纯转发：helper 含真实结构，放行
    const decor = isDecoratorWrap(b);
    const checks = [];
    if (k === 'search') { if (!hasField(b, 'isEnd') || !hasField(b, 'data')) checks.push('缺 isEnd/data'); }
    else if (k === 'getMediaSource') { if (!hasField(b, 'url')) checks.push('缺 url'); }
    else if (k === 'getLyric') { if (!hasField(b, 'rawLrc') && !hasField(b, 'translation')) checks.push('缺 rawLrc/translation'); }
    else if (k === 'getTopLists') { if (!hasField(b, 'data')) checks.push('缺 data(榜单容器)'); }
    else if (k === 'getRecommendSheetTags') { if (!hasField(b, 'data') && !hasField(b, 'pinned')) checks.push('缺 data/pinned'); }
    else if (k === 'getMusicSheetInfo' || k === 'getAlbumInfo') { if (!hasField(b, 'musicList') && !hasField(b, 'isEnd')) checks.push('缺 musicList/isEnd'); }
    if (checks.length) {
      needsReview.push(`${k}(${checks.join(';')})${decor ? '[装饰器包装]' : ''}`);
    }
  }
  if (needsReview.length) {
    totalIssue += needsReview.length;
    console.log(`== ${f}`);
    for (const it of needsReview) {
      const name = it.split('(')[0];
      const bodyLen = bodies[name].length;
      console.log(`   - ${it} (体长${bodyLen}字符)`);
      if (bodyLen <= 400) console.log('     ' + bodies[name].slice(0, 380).replace(/\n/g, '\n     '));
    }
  }
}
console.log(`\n可疑总数: ${totalIssue}`);
