// 插件实现层精确审计 v2：沙箱加载拿到 exports 顶层方法，用 toString 检查方法体
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

const VALID_METHODS = new Set([
  'search', 'getMediaSource', 'getLyric', 'getAlbumInfo', 'getMusicSheetInfo',
  'getArtistWorks', 'getMusicInfo', 'importMusicItem', 'importMusicSheet',
  'getTopLists', 'getTopListDetail', 'getRecommendSheetTags',
  'getRecommendSheetsByTag', 'getMusicComments', 'getWordByWordLyric',
  'getMvSource', 'getArtistDetail', 'getMusicDetailPageUrl',
  'getRecommendSheets', 'getRecommendSheetById', 'getSheetInfo',
  'getDownloadMatrix', 'getDownloadUrl', 'suggestDownloadFilename',
  'getUserConfig', 'setUserConfig', 'getCurrentLyricLine', 'agg_doctor',
  'getMvDetail', 'getMvList',
]);

function stripComments(s) {
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return s;
}

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

  // 1) 顶层方法名合法性
  for (const k of methods) {
    if (!VALID_METHODS.has(k)) {
      issues.push(`顶层方法名不在规范表: ${k}`);
    }
  }

  // 2) 每个顶层方法体检查
  for (const k of methods) {
    const body = stripComments(ex[k].toString());
    if (/return null/.test(body)) {
      issues.push(`${k}: 存在 return null（skill 要求错误直接 throw）`);
    }
    if (k === 'search') {
      if (!/isEnd/.test(body) || !/return\s*\{[\s\S]*data\s*:/.test(body)) {
        issues.push('search: 未找到 { isEnd, data } 返回结构');
      }
    }
    if (k === 'getMediaSource') {
      if (!/return\s*\{[\s\S]*url\s*:/.test(body)) {
        issues.push('getMediaSource: 未找到 { url } 返回结构');
      }
    }
    if (k === 'getLyric') {
      if (!/rawLrc/.test(body)) {
        issues.push('getLyric: 未找到 rawLrc 字段（若无歌词应显式返回 { rawLrc: \'\' }）');
      }
    }
    if (k === 'getTopLists' || k === 'getRecommendSheetTags') {
      if (!/return\s*\{[\s\S]*data\s*:/.test(body)) {
        issues.push(`${k}: 未找到 { data } 返回结构`);
      }
    }
  }

  // 3) 声明了 supportedSearchType 但无 search
  const stMatch = src.match(/supportedSearchType\s*:\s*\[([^\]]*)\]/);
  if (stMatch && !methods.includes('search')) {
    issues.push(`声明了 supportedSearchType [${stMatch[1]}] 但缺少 search 方法`);
  }

  if (issues.length) {
    totalIssue += issues.length;
    console.log(`== ${f}`);
    for (const it of issues) console.log(`   - ${it}`);
  }
}
console.log(`\n问题总数: ${totalIssue}`);
