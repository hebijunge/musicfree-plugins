// dump 指定插件指定方法的源码，判断 return null 是否违反 skill 契约
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = 'plugins';
const targets = process.argv.slice(2); // 格式: file.js:method 或 file.js（dump 全部顶层方法）

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

function loadExports(f) {
  const fp = path.join(dir, f);
  const src = fs.readFileSync(fp, 'utf8');
  const sandbox = createSandbox();
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;module.exports;', sandbox, { filename: f, timeout: 10000 });
  return sandbox.module.exports;
}

for (const t of targets) {
  const [f, ...mParts] = t.split(':');
  const onlyMethod = mParts.join(':') || null;
  console.log(`\n########## ${f}${onlyMethod ? ' :: ' + onlyMethod : ''} ##########`);
  try {
    const ex = loadExports(f);
    const keys = Object.keys(ex).filter(k => typeof ex[k] === 'function' && !k.startsWith('_'));
    for (const k of keys) {
      if (onlyMethod && k !== onlyMethod) continue;
      const src = ex[k].toString();
      const nullHits = (src.match(/return null/g) || []).length;
      if (onlyMethod || nullHits) {
        console.log(`\n--- ${k} (return null x${nullHits}, ${src.length} chars) ---`);
        console.log(src.slice(0, 1200) + (src.length > 1200 ? '\n...[截断]' : ''));
      }
    }
  } catch (e) {
    console.log('加载失败: ' + e.message);
  }
}
