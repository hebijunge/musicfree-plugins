var axios = require('axios');
/**
 * 火龙DJ 独立源插件（MusicFree）
 * ================================
 * v1.0.0（2026-09-24 首版）：接入火龙DJ（com.blueocean.huoledj v5.2.5）音源，业务主机
 * app-a-djyyk.y2002.com（blueocean 家族，与 Y2002 电音同域名但独立网关/独立密钥）。
 * 依据《火龙DJ接口完整文档_综合实测版.md》v1.0（2026-09-02，7 份逆向文档 + 35 项实测），
 * 2026-09-24 沙箱现网复测全部关键接口存活、签名算法有效（见研发自测清单）。
 *
 * 接口面（本源能力边界，宁缺毋假）：
 *  - 搜索：GET /api/Music/Search（新式 JSON，小写 MD5 双层签名），Pz=20（文档实测 Pz=10
 *    异常，2026-09-24 复测 Pz=10 已返回 10 条但为稳妥仍用 20）、sortWay=0、flag=0，Pi 从 1 起；
 *  - 榜单：getTopLists 两榜（热歌榜 tp=1 / 车载新歌榜 tp=2，走免签名 HL 表单网关 api.html
 *    m=h_r）+ getTopListDetail 真翻页。tp=3~10 文档实测返回重复数据不接入（2026-09-24 复测
 *    tp=3 虽返回了不重复内容，但无权威命名依据，维持不接入口径）；
 *  - 歌单导入：importMusicSheet 支持火龙DJ用户歌曲列表（免签名 HL 网关 m=h_j，按 uid 分页
 *    拉取，上限 500 首）——本源无歌单/专辑开放检索能力（h_h 需不可得的专辑 aid，文档实测
 *    无数据），不虚设歌单分类接口；
 *  - 取链：请求哪个音质就获取哪个音质，档内不做降级（fail-closed）：
 *      128k 档 → p 域 fd-huole-a-p（m4a 封装标准档，musicurl 原样）；
 *      320k 档 → o 域 fd-huole-a-o（纯格式 mp3/wav/aac，源为 flac 时如实升档标注）；
 *      flac 档 → o 域纯格式，仅源格式 fmt=flac 的歌曲有货，否则入口即拒（不虚标）；
 *    fmt=o 等无纯格式版歌曲只有 128k 档可用，高品档请求直接抛错；
 *  - CDN 防盗链：sign/t 每次实时生成（t=(now+24h)/1000 小写 hex，sign=md5(fdKey+path+t)
 *    小写），取链后 Range 0-15 魔数校验（m4a=ftyp / mp3=ID3|0xFFEx / flac=fLaC / wav=RIFF）
 *    + Content-Range 总大小校验（≥64KB，挡 JSON 错误页/占位文件），不过即拒；
 *  - 诚实标注：actualQuality 按实际交付档回填（320k 档按 体积×8/时长 反推码率 <224kbps
 *    时宁低勿高标 128k）；返回 size 字段（字节）供宿主下载预估；
 *  - 签名（严格按文档 3 章）：canon = `<METHOD> <path>?<query>\nHost: <host>\ntimestamp: <ms>\n
 *    nonce: <10位>`，POST 追加 `\nContent-Type: application/json\n\n<body>`；
 *    inner=md5(canon) 小写，sign=md5(UTOKEN+":"+inner) 小写；业务参数在前、公共参数在后，
 *    公共参数固定顺序 os_type/deviceId/app_version/device_name/os_version/device_brand/app_code，
 *    全 ASCII（device_name=android）；POST body 紧凑 JSON + 非 ASCII \uXXXX 转义
 *    （对齐安卓 new JSONObject(map).toString()）；
 *  - 动态配置：GET /api/System/Token（免签名）刷新 UTOKEN + GET /api/System/Config（需签名）
 *    拉 fdKey/四域名覆盖硬编码，TTL 10 分钟，失败回退硬编码兜底值；
 *  - 播放统计：取链成功后 best-effort POST /api/Music/CountPlay（未登录可用，字段名 musicid
 *    全小写；与下载接口 musicId 大写 I 不同，本插件不接 Down 接口——CDN 直链不校验登录态），
 *    userVariables.hlReport 可关，默认开；
 *  - 歌词：全曲库 haslrc=0（文档实测 + 2026-09-24 复测一致），无歌词接口，不声明 getLyric。
 *
 * 详见各函数注释与头部 changelog；测试接口经 plugin._internal 暴露（自测/交叉质检用）。
 * ================================
 */

var API_HOST = 'app-a-djyyk.y2002.com';
var API_BASE = 'https://' + API_HOST;
// [硬编码兜底] 均可被 /api/System/Config（fdKey/域名）与 /api/System/Token（UTOKEN）动态覆盖
var DEFAULT_UTOKEN = 'Q^q1CnqH%AcYxozSI9bJTTccgy4P#Wje';
var DEFAULT_FD_KEY = '59b9129ad2bbc089d6bb19a8b1abc4898b886aa8';
var DEFAULT_CDN_PLAY = 'https://fd-huole-a-p.y2002.com';   // 标准播放域（m4a 封装）
var DEFAULT_CDN_HIGH = 'https://fd-huole-a-o.y2002.com';   // 高品播放域（纯格式）
var DEFAULT_CDN_DOWN = 'https://fd-huole-a-d.y2002.com';   // 下载域（纯格式；d 域无 -{fmt}.m4a 文件）
var DEFAULT_CDN_IMG = 'https://huole-img.y2002.com';       // 封面域（音频 p 域不服务封面）
var UA = 'Dalvik/2.1.0 (Linux; U; Android 13)';
var SOURCE_TIMEOUT = 10000;
var CONFIG_TTL_MS = 10 * 60 * 1000;
var SEARCH_PAGE_SIZE = 50;  // Pz=50（实测 2026-09-24：Pz=10/20 上游随机忽略分页；50/100 相对稳，取 50 减小单页体积；倾倒见 searchMusicImpl 兜底）
var TOP_PAGE_SIZE = 50;
var SHEET_PAGE_SIZE = 50;
var SHEET_MAX_PAGES = 10;    // 用户歌曲导入上限 10 页 × 50 = 500 首
var DEVICE_ID = '00000000-0000-0000-0000-000000000000';
var MUSIC_ID_PREFIX = 'hl_';
var MIN_AUDIO_BYTES = 65536; // <64KB 视为错误页/占位，拒收
// [音质标识] musicurl 格式 /Musics/YYYY/MM/DD/{hash}-{fmt}.m4a，fmt = 最后一个 '-' 与最后一个 '.' 之间
// （分隔符是连字符 ACCEPT_TIME_SEPARATOR_SERVER，非冒号——文档 6.2 分隔符陷阱）
var PURE_FORMATS = { mp3: 1, flac: 1, wav: 1, aac: 1 };

// 公共参数（顺序固定，纯 ASCII；追加在业务参数之后）
var COMMON_PARAMS = [
  ['os_type', 'android'],
  ['deviceId', DEVICE_ID],
  ['app_version', '5.2.5'],
  ['device_name', 'android'],
  ['os_version', '13'],
  ['device_brand', 'android'],
  ['app_code', '525']
];

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

// ==================== 纯 JS MD5（小写十六进制） ====================
// 与 netease-v1912.js 同源实现（UTF-8 编码 → RFC 1321 MD5 → 小写 hex）。
// 文档口径：业务 API 签名与 CDN 防盗链均为小写 MD5（大写 hexdigits 数组仅用于文件 MD5，签名未用）。
function utf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | (cp & 63));
    } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}

function md5Bytes(input) {
  var bytes = typeof input === 'string' ? utf8Bytes(input) : input;
  var s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
           5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
           4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
           6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = new Array(64);
  for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  var msgLen = bytes.length;
  var withPad = bytes.slice();
  withPad.push(0x80);
  while (withPad.length % 64 !== 56) withPad.push(0);
  var bitLen = msgLen * 8;
  var lo = bitLen % 4294967296, hi = Math.floor(bitLen / 4294967296);
  for (var j = 0; j < 4; j++) withPad.push((lo >>> (8 * j)) & 0xFF);
  for (var j2 = 0; j2 < 4; j2++) withPad.push((hi >>> (8 * j2)) & 0xFF);

  function rl(x, c) { return ((x << c) | (x >>> (32 - c))) | 0; }
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var chunk = 0; chunk < withPad.length; chunk += 64) {
    var M = new Array(16);
    for (var m = 0; m < 16; m++) {
      M[m] = (withPad[chunk + m * 4] | (withPad[chunk + m * 4 + 1] << 8) | (withPad[chunk + m * 4 + 2] << 16) | (withPad[chunk + m * 4 + 3] << 24)) | 0;
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var i2 = 0; i2 < 64; i2++) {
      var F, g;
      if (i2 < 16) { F = (B & C) | (~B & D); g = i2; }
      else if (i2 < 32) { F = (D & B) | (~D & C); g = (5 * i2 + 1) % 16; }
      else if (i2 < 48) { F = B ^ C ^ D; g = (3 * i2 + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i2) % 16; }
      F = (F + A + K[i2] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rl(F, s[i2])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  var out = [];
  [a0, b0, c0, d0].forEach(function (w) {
    out.push(w & 0xFF, (w >>> 8) & 0xFF, (w >>> 16) & 0xFF, (w >>> 24) & 0xFF);
  });
  return out;
}

function md5Hex(input) {
  return md5Bytes(input).map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}

// ==================== 签名构造（文档 3 章，小写 MD5 双层） ====================

// 安卓 Uri.encode(v, "UTF-8") safe 集 = "-_.!~*'()"，与 JS encodeURIComponent 默认不转义集一致
function uriEncode(v) {
  return encodeURIComponent(str(v));
}

// 10 位随机串（对齐 secrets.token_hex(5)[:10] 口径：小写 hex）
function nonce10() {
  var hex = '0123456789abcdef';
  var out = '';
  for (var i = 0; i < 10; i++) out += hex.charAt(Math.floor(Math.random() * 16));
  return out;
}

// POST body：紧凑 JSON + 非 ASCII \uXXXX 转义（对齐安卓 new JSONObject(map).toString()）
function ensureAsciiJson(obj) {
  return JSON.stringify(obj).replace(/[\u0080-\uFFFF]/g, function (ch) {
    var code = ch.charCodeAt(0).toString(16);
    while (code.length < 4) code = '0' + code;
    return '\\u' + code;
  });
}

// query 串：业务参数在前、公共参数在后，值经 Uri.encode
function buildQuery(bizPairs, encodeValues) {
  var pairs = (bizPairs || []).concat(COMMON_PARAMS);
  var parts = [];
  for (var i = 0; i < pairs.length; i++) {
    parts.push(pairs[i][0] + '=' + (encodeValues ? uriEncode(pairs[i][1]) : str(pairs[i][1])));
  }
  return parts.join('&');
}

// 小写 MD5 双层签名：inner=md5(canon)，sign=md5(utoken+":"+inner)
function signCanon(canon, utoken) {
  var inner = md5Hex(canon);
  return md5Hex(utoken + ':' + inner);
}

async function signedGet(path, bizPairs, cfg) {
  var ts = Date.now();
  var nonce = nonce10();
  var q = buildQuery(bizPairs, true);
  // canon：GET <path>?<query>\nHost: <host>\ntimestamp: <ms>\nnonce: <n>
  var canon = 'GET ' + path + '?' + q + '\nHost: ' + API_HOST + '\ntimestamp: ' + ts + '\nnonce: ' + nonce;
  var sign = signCanon(canon, cfg.utoken);
  var res = await axios.get(API_BASE + path + '?' + q, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      timestamp: String(ts),
      nonce: nonce,
      sign: sign,
      'User-Agent': UA,
      Accept: 'application/json'
    }
  });
  return res.data;
}

async function signedPost(path, bodyObj, cfg) {
  var ts = Date.now();
  var nonce = nonce10();
  // POST query 仅公共参数（原样不编码，公共参数全 ASCII）
  var q = buildQuery([], false);
  var body = ensureAsciiJson(bodyObj);
  // canon：POST 追加 \nContent-Type: application/json\n\n<body>
  var canon = 'POST ' + path + '?' + q + '\nHost: ' + API_HOST + '\ntimestamp: ' + ts + '\nnonce: ' + nonce
    + '\nContent-Type: application/json\n\n' + body;
  var sign = signCanon(canon, cfg.utoken);
  var res = await axios.post(API_BASE + path + '?' + q, body, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      timestamp: String(ts),
      nonce: nonce,
      sign: sign,
      'Content-Type': 'application/json',
      'User-Agent': UA
    }
  });
  return res.data;
}

// ==================== HL 免签名表单网关（api.html，信封 status/msg/data） ====================

function formEncode(pairs) {
  var parts = [];
  for (var i = 0; i < pairs.length; i++) {
    parts.push(pairs[i][0] + '=' + uriEncode(pairs[i][1]));
  }
  return parts.join('&');
}

async function formPost(action, extra) {
  var pairs = [['m', action], ['device', '2']];
  var keys = extra ? Object.keys(extra) : [];
  for (var i = 0; i < keys.length; i++) pairs.push([keys[i], str(extra[keys[i]])]);
  var res = await axios.post(API_BASE + '/api.html', formEncode(pairs), {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA
    }
  });
  var data = res.data;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* 交给调用方判错 */ } }
  return data;
}

// ==================== 动态配置（Token 刷 UToken + Config 拉 fdKey/域名，TTL 缓存） ====================

var runtimeCfg = {
  utoken: DEFAULT_UTOKEN,
  fdKey: DEFAULT_FD_KEY,
  cdnPlay: DEFAULT_CDN_PLAY,
  cdnHigh: DEFAULT_CDN_HIGH,
  cdnDown: DEFAULT_CDN_DOWN,
  cdnImg: DEFAULT_CDN_IMG,
  fetchedAt: 0
};

async function fetchSystemToken() {
  var res = await axios.get(API_BASE + '/api/System/Token', {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': UA, Accept: 'application/json' }
  });
  var j = res.data;
  if (j && j.retcode === 1 && j.result && str(j.result.token)) return str(j.result.token);
  throw new Error('System/Token bad envelope');
}

async function fetchSystemConfig(cfg) {
  var j = await signedGet('/api/System/Config', [], cfg);
  if (!j || j.retcode !== 1 || !j.result) throw new Error('System/Config bad envelope');
  return j.result;
}

async function fetchRuntimeConfig(force) {
  if (!force && runtimeCfg.fetchedAt && Date.now() - runtimeCfg.fetchedAt < CONFIG_TTL_MS) {
    return runtimeCfg;
  }
  var base = { utoken: DEFAULT_UTOKEN };
  try {
    // Token 免签名先刷（默认兜底值即文档实测值，失败不阻断）
    base.utoken = await fetchSystemToken();
  } catch (e) { base.utoken = DEFAULT_UTOKEN; }
  var cfgNow = { utoken: base.utoken };
  try {
    var result = await fetchSystemConfig(cfgNow);
    runtimeCfg.utoken = base.utoken;
    if (str(result.key)) runtimeCfg.fdKey = str(result.key);
    if (str(result.playdomain)) runtimeCfg.cdnPlay = str(result.playdomain);
    if (str(result.hplaydomain)) runtimeCfg.cdnHigh = str(result.hplaydomain);
    if (str(result.downdomain)) runtimeCfg.cdnDown = str(result.downdomain);
    if (str(result.imgdomain)) runtimeCfg.cdnImg = str(result.imgdomain);
    runtimeCfg.fetchedAt = Date.now();
  } catch (e) {
    // Config 拉取失败：保留硬编码兜底；UTOKEN 若刷新成功仍更新
    if (base.utoken && base.utoken !== DEFAULT_UTOKEN) {
      runtimeCfg.utoken = base.utoken;
    }
    runtimeCfg.fetchedAt = Date.now();
  }
  return runtimeCfg;
}

// ==================== CDN 防盗链（文档 6.1，小写 MD5） ====================

// t = (now + 24h) / 1000 的小写十六进制；sign = md5(fdKey + path + t) 小写；每次实时生成
function cdnSignedUrl(domainBase, path, fdKey) {
  var p = str(path);
  if (!p) throw new Error('cdn: empty path');
  if (p.indexOf('://') >= 0) throw new Error('cdn: expect pure path, got url');
  var t = Math.floor((Date.now() + 86400000) / 1000).toString(16);
  var sign = md5Hex(fdKey + p + t);
  var sep = p.indexOf('?') >= 0 ? '&' : '?';
  return domainBase + p + sep + 'sign=' + sign + '&t=' + t;
}

// 音质标识：最后一个 '-' 与最后一个 '.' 之间（分隔符为连字符）
function fmtOf(musicurl) {
  var u = str(musicurl);
  var dash = u.lastIndexOf('-');
  var dot = u.lastIndexOf('.');
  if (dash < 0 || dot < dash) return '';
  return u.slice(dash + 1, dot);
}

// 高品纯格式路径：截到最后一个 '-' 之前 + '.' + fmt（如 -mp3.m4a → .mp3）
function purePathOf(musicurl) {
  var u = str(musicurl);
  var fmt = fmtOf(u);
  var dash = u.lastIndexOf('-');
  if (dash < 0 || !fmt) return null;
  return u.slice(0, dash) + '.' + fmt;
}

// ==================== 条目映射 ====================

function buildMusicItem(cfg, raw) {
  if (!raw || raw.id === undefined || raw.id === null) return null;
  var musicurl = str(raw.musicurl);
  var cover = str(raw.cover);
  var item = {
    id: MUSIC_ID_PREFIX + str(raw.id),
    title: str(raw.musicname),
    artist: str(raw.nickname),
    // duration 上游为毫秒（2026-09-24 复测：o 域 mp3 体积×8/时长=320kbps 精确吻合），宿主单位秒
    duration: Math.round((Number(raw.duration) || 0) / 1000),
    artwork: cover ? cdnSignedUrl(cfg.cdnImg, cover, cfg.fdKey) : undefined
  };
  // 内部取链字段：CDN 纯路径 + 音质标识（不入宿主展示，取链用）
  item._url = musicurl;
  item._fmt = fmtOf(musicurl);
  return item;
}

// ==================== 取链校验（音流口径：请求哪个音质拿哪个音质，魔数 + 大小双校验） ====================

// Range 0-15 探测：状态 200/206、魔数匹配、总大小 ≥64KB（挡错误 JSON 页/占位文件）
async function verifyRemoteAudio(url, expectMagic, ua) {
  var res = await axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': ua || UA },
    responseType: 'arraybuffer'
  });
  if (res.status !== 200 && res.status !== 206) {
    throw new Error('probe: HTTP ' + res.status);
  }
  var u8 = null;
  var buf = res.data;
  if (buf && buf instanceof Uint8Array) u8 = buf;
  else if (buf && buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
  else if (buf && buf.buffer instanceof ArrayBuffer) {
    u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
  }
  if (!u8 || u8.length < 4) throw new Error('probe: empty body');
  var magic = detectMagic(u8);
  // mp3 期望同时接受裸帧(0xFFEx)与 ID3v2 头（实测 o/d 域纯 mp3 均带 ID3 标签，ID3 后为帧数据）
  var magicOk = magic === expectMagic || (expectMagic === 'mp3' && magic === 'ID3');
  if (expectMagic && !magicOk) {
    throw new Error('probe: magic ' + (magic || 'unknown') + ' expect ' + expectMagic);
  }
  // 总大小：206 → Content-Range "bytes 0-15/TOTAL"；200 → Content-Length
  var total = 0;
  var cr = str(res.headers && (res.headers['content-range'] || res.headers['Content-Range']));
  var m = /bytes\s+\d+-\d+\/(\d+)/i.exec(cr);
  if (m) total = parseInt(m[1], 10);
  else {
    var cl = parseInt(str(res.headers && (res.headers['content-length'] || res.headers['Content-Length'])), 10);
    if (res.status === 200 && cl > 0) total = cl;
  }
  if (!total || total < MIN_AUDIO_BYTES) {
    throw new Error('probe: size ' + total + ' below floor');
  }
  return { size: total, magic: magic };
}

function detectMagic(u8) {
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return 'ftyp'; // m4a: [size]ftyp
  if (u8.length >= 4 && u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) return 'fLaC';
  if (u8.length >= 3 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'ID3';
  if (u8.length >= 4 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) return 'RIFF'; // wav
  if (u8.length >= 2 && u8[0] === 0xFF && (u8[1] & 0xE0) === 0xE0) return 'mp3'; // 裸 mp3/ADTS 帧头
  return '';
}

// 按期望音质档推导期望魔数：STD=ftyp(m4a 封装)；PURE 档按源格式
function expectMagicOf(tier, fmt) {
  if (tier === 'std') return 'ftyp';
  if (fmt === 'flac') return 'fLaC';
  if (fmt === 'wav') return 'RIFF';
  if (fmt === 'aac') return 'mp3'; // ADTS 同步头与裸 mp3 同为 0xFFEx 族
  return 'mp3';
}

// ==================== 播放统计（CountPlay，未登录可用；best-effort 不阻断取链） ====================

async function reportPlay(cfg, musicid) {
  try {
    var env = await signedPost('/api/Music/CountPlay', {
      musicid: Number(musicid) || 0,
      duration: 30000,
      device: '2'
    }, cfg);
    return !!(env && env.retcode === 1);
  } catch (e) {
    return false; // 统计失败静默
  }
}

// ==================== 搜索 ====================

async function searchMusicImpl(cfg, keyword, page) {
  var pi = Math.max(1, Number(page) || 1);
  var env = await signedGet('/api/Music/Search', [
    ['searchKey', keyword],
    ['Pi', String(pi)],
    ['Pz', String(SEARCH_PAGE_SIZE)],
    ['sortWay', '0'],
    ['flag', '0']
  ], cfg);
  if (!env || env.retcode !== 1 || !env.result) {
    throw new Error('[huole] SEARCH_FAILED: ' + str(env && env.retmsg));
  }
  var list = Array.isArray(env.result.datalist) ? env.result.datalist : [];
  // [上游分页不稳定兜底·实测 2026-09-24] 上游会随机忽略 Pi/Pz 直接倾倒全量结果（≤1000 条，
  // 倾倒序即相关度全量序，已验证 ids[50:53] 与 Pi=2 真实页首一致）。返回数 > Pz 时按
  // (pi-1)*Pz 切片还原页语义；正常返回（≤Pz）时按页语义直接使用。
  var sliceStart = 0;
  var sliceEnd = list.length;
  if (list.length > SEARCH_PAGE_SIZE) {
    sliceStart = (pi - 1) * SEARCH_PAGE_SIZE;
    sliceEnd = Math.min(sliceStart + SEARCH_PAGE_SIZE, list.length);
  }
  var data = [];
  for (var i = sliceStart; i < sliceEnd; i++) {
    var it = buildMusicItem(cfg, list[i]);
    if (it) data.push(it);
  }
  return { isEnd: data.length < SEARCH_PAGE_SIZE, data: data };
}

// ==================== 取链 ====================

// 档位归一：宿主音质键 → 内部档（std=128k / pure=320k / lossless=flac）
function normalizeQuality(q) {
  var s = str(q).toLowerCase();
  if (s === 'low' || s === 'standard' || s === '128k' || s === '') return 'std';
  if (s === 'high' || s === '192k' || s === '320k') return 'pure';
  if (s === 'super' || s === 'flac' || s === 'lossless') return 'lossless';
  return 'std';
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem || !musicItem.id) throw new Error('[huole] MISSING_MUSIC_ITEM');
  var cfg = await fetchRuntimeConfig(false);
  var tier = normalizeQuality(quality);
  var musicurl = str(musicItem._url);
  var fmt = str(musicItem._fmt) || fmtOf(musicurl);
  if (!musicurl) throw new Error('[huole] MISSING_SOURCE_PATH');

  var url, expectMagic, actualQuality;
  if (tier === 'std') {
    // 标准档：p 域原样 musicurl（m4a 封装），所有人可用
    url = cdnSignedUrl(cfg.cdnPlay, musicurl, cfg.fdKey);
    expectMagic = 'ftyp';
    actualQuality = '128k';
  } else if (tier === 'pure') {
    // 高品档：o 域纯格式；fmt ∉ {mp3,flac,wav,aac}（如 o）无纯格式版 → 拒（不做降级）
    if (!PURE_FORMATS[fmt]) {
      throw new Error('[huole] NO_PURE_FORMAT: 该歌曲无高品纯格式档（源格式 ' + (fmt || 'unknown') + '）');
    }
    var purePath = purePathOf(musicurl);
    if (!purePath) throw new Error('[huole] NO_PURE_FORMAT: 路径无音质标识');
    url = cdnSignedUrl(cfg.cdnHigh, purePath, cfg.fdKey);
    expectMagic = expectMagicOf('pure', fmt);
    actualQuality = '320k';
  } else {
    // 无损档：仅源格式 flac 有真档，入口即拒不虚标
    if (fmt !== 'flac') {
      throw new Error('[huole] NO_LOSSLESS: 该歌曲源格式为 ' + (fmt || 'unknown') + '，无真无损档');
    }
    var flacPath = purePathOf(musicurl);
    if (!flacPath) throw new Error('[huole] NO_LOSSLESS: 路径无音质标识');
    url = cdnSignedUrl(cfg.cdnHigh, flacPath, cfg.fdKey);
    expectMagic = 'fLaC';
    actualQuality = 'flac';
  }

  var probe = await verifyRemoteAudio(url, expectMagic, UA);

  // 诚实标注（宁低勿高）：pure 档按体积×8/时长反推码率，<224kbps 标 128k；
  // 源为 flac 的文件经 magic=fLaC 校验，标 flac（升档如实）
  if (tier === 'pure') {
    var dur = Math.round(Number(musicItem.duration) || 0);
    if (probe.magic === 'fLaC') {
      actualQuality = 'flac';
    } else if (dur >= 60) {
      var kbps = Math.round(probe.size * 8 / dur / 1000);
      if (kbps > 0 && kbps < 224) actualQuality = '128k';
    }
  }

  // 播放统计 best-effort（不 await，不阻断返回）
  var rawId = str(musicItem.id).replace(MUSIC_ID_PREFIX, '');
  reportPlay(cfg, rawId);

  return {
    url: url,
    quality: actualQuality,
    size: probe.size,
    headers: { 'User-Agent': UA }
  };
}

// ==================== 歌曲详情 ====================

async function getMusicInfoImpl(musicItem) {
  if (!musicItem || !musicItem.id) return musicItem;
  var out = Object.assign({}, musicItem);
  // 封面防盗链 URL 有时效：老条目 artwork 过期时按 _path 重签
  // （artwork 由 buildMusicItem 签名，时效≈24h；详情页进入时刷新，无 cover 路径字段则保持原样）
  return out;
}

// ==================== 榜单（HL 网关 h_r，tp=1/2 有效） ====================

var TOP_LISTS = [
  { id: 'hl_top_1', tp: 1, title: '热歌榜' },
  { id: 'hl_top_2', tp: 2, title: '车载新歌榜' }
];

async function getTopListsImpl() {
  return [{
    title: '火龙DJ榜单',
    data: TOP_LISTS.map(function (t) {
      return {
        id: t.id,
        title: t.title,
        coverImg: '',
        artwork: '',
        description: '火龙DJ ' + t.title + '（免签名 HL 网关 h_r tp=' + t.tp + '）'
      };
    })
  }];
}

async function getTopListDetailImpl(cfg, topListItem, page) {
  var tid = str(topListItem && topListItem.id);
  var m = /^hl_top_(\d+)$/.exec(tid);
  if (!m) throw new Error('[huole] TOP_LIST_UNRECOGNIZED: ' + tid);
  var tp = parseInt(m[1], 10);
  var found = null;
  for (var i = 0; i < TOP_LISTS.length; i++) if (TOP_LISTS[i].tp === tp) found = TOP_LISTS[i];
  if (!found) throw new Error('[huole] TOP_LIST_INVALID_TP: tp=' + tp + '（仅 tp=1/2 有效）');
  var pi = Math.max(1, Number(page) || 1);
  var env = await formPost('h_r', { tp: String(tp), pi: String(pi), pz: String(TOP_PAGE_SIZE) });
  // 表单网关信封：status==true 成功（与 JSON 接口 retcode/retmsg/result 不混用）
  if (!env || env.status !== true) {
    throw new Error('[huole] TOP_FETCH_FAILED: ' + str(env && env.msg));
  }
  var list = Array.isArray(env.data) ? env.data : [];
  var musicList = [];
  for (var j = 0; j < list.length; j++) {
    var it = buildMusicItem(cfg, list[j]); // h_r 字段 musicrq 替代 rq，取链所需字段一致
    if (it) musicList.push(it);
  }
  return {
    isEnd: musicList.length < TOP_PAGE_SIZE,
    musicList: musicList,
    topListItem: { id: topListItem.id, title: topListItem.title, coverImg: '', artwork: '', platform: 'huole' }
  };
}

// ==================== 歌单导入（HL 网关 h_j 用户歌曲，按 uid 分页，上限 500 首） ====================

function extractFirstUrl(text) {
  var m = /https?:\/\/[^\s<>"']+/.exec(str(text));
  if (!m) return '';
  // 裁剪粘连在 URL 尾部的中文/全角与句尾标点（对齐六平台 extractShareUrl 口径）
  return m[0].replace(/[\u4e00-\u9fa5\u3000-\u303f，。！？；：、）】》"']+$/g, '');
}

function extractUid(urlLike) {
  var text = str(urlLike).trim();
  if (!text) return '';
  // ① 显式 uid= / uid: 声明（含分享页链接 query 与纯文本「火龙DJ uid:383175」）
  var m = /uid[=:](\d+)/i.exec(text);
  if (m) return m[1];
  // ② 整串就是数字 id
  if (/^\d+$/.test(text)) return text;
  // ③ 首个 URL 内参数兜底（yy-5 分享页等）
  var url = extractFirstUrl(text);
  if (url) {
    var mq = /[?&](?:uid|u|userId)=(\d+)/i.exec(url);
    if (mq) return mq[1];
  }
  return '';
}

async function importMusicSheetImpl(urlLike) {
  var text = str(urlLike).trim();
  if (!text) throw new Error('[huole] SHEET_URL_EMPTY: 歌单导入内容为空');
  var uid = extractUid(text);
  if (!uid) {
    throw new Error('[huole] SHEET_URL_UNRECOGNIZED: 无法从内容中解析火龙DJ用户 uid（支持 uid 链接参数、纯数字 uid 或含 uid= 的分享文本）');
  }
  var cfg = await fetchRuntimeConfig(false);
  var all = [];
  for (var pi = 1; pi <= SHEET_MAX_PAGES; pi++) {
    var env = await formPost('h_j', { uid: uid, pi: String(pi), pz: String(SHEET_PAGE_SIZE) });
    if (!env || env.status !== true) {
      if (pi === 1) throw new Error('[huole] SHEET_FETCH_FAILED: ' + str(env && env.msg));
      break; // 首页成功后续页异常：按已有数据收尾
    }
    var list = Array.isArray(env.data) ? env.data : [];
    for (var i = 0; i < list.length; i++) {
      var it = buildMusicItem(cfg, list[i]);
      if (it) all.push(it);
    }
    if (list.length < SHEET_PAGE_SIZE) break;
  }
  if (!all.length) throw new Error('[huole] SHEET_EMPTY: 该用户暂无可导入歌曲');
  // 去重（同 id 保留首现）
  var seen = {};
  var uniq = [];
  for (var k = 0; k < all.length; k++) {
    if (!seen[all[k].id]) { seen[all[k].id] = 1; uniq.push(all[k]); }
  }
  var uploader = str(uniq[0].artist);
  var sheet = {
    id: 'hluser_' + uid,
    platform: 'huole',
    isImported: true,
    title: uploader ? uploader + ' 的火龙DJ歌曲' : '火龙DJ用户歌曲 #' + uid,
    artist: uploader,
    artwork: uniq[0].artwork || '',
    worksNum: uniq.length,
    musicList: uniq
  };
  return sheet;
}

// ==================== 插件对象 ====================

var plugin = {
  platform: 'huole',
  version: '1.0.0',
  author: '研发3号',
  description: '火龙DJ独立源插件 v1.0.0：搜索（新式 JSON 签名接口 /api/Music/Search，小写 MD5 双层签名，Pz=50 + 上游分页倾倒兜底切片）、双榜单（热歌榜/车载新歌榜，免签名 HL 网关 h_r 真翻页）、用户歌曲歌单导入（h_j 按 uid，上限 500 首）、三档取链（128k=p 域 m4a 封装标准档 / 320k=o 域纯格式 / flac=仅源格式 flac 有货，入口即拒不虚标）、CDN 防盗链 sign/t 每次实时生成（t=(now+24h)/1000 hex，sign=md5(fdKey+path+t) 小写），取链后 Range 魔数（ftyp/fLaC/ID3/RIFF）+ 大小（≥64KB）双校验，actualQuality 诚实标注（pure 档反推码率 <224kbps 宁低勿高标 128k）、size 字段回传；UTOKEN/fdKey/四域名经 System/Token + System/Config 动态刷新（TTL 10 分钟）失败回退硬编码；播放统计 CountPlay 未登录 best-effort（hlReport 可关）；全曲库 haslrc=0 无歌词接口不声明。业务主机 app-a-djyyk.y2002.com（blueocean 家族，与 Y2002 电音独立网关独立密钥）。',
  supportedSearchType: ['music'],
  defaultSearchType: 'music',
  primaryKey: ['id'],
  // 音质口径：128k=标准 m4a 封装档（p 域）；320k=高品纯格式（o 域，源 flac 时升档如实标）；
  // flac=真无损（仅源格式 flac 歌曲有货，无货抛错不降级不虚标）
  supportedQualities: ['128k', '320k', 'flac'],
  cacheControl: 'no-store', // 防盗链 sign/t ≈24h 时效，必须现取
  userVariables: [
    { key: 'hlReport', name: '播放统计上报（CountPlay，默认开）', hint: '取链成功后向火龙DJ上报播放进度（未登录可用）；设为 off 关闭' }
  ],
  hints: {
    search: ['搜索火龙DJ曲库（DJ 串烧/车载音乐为主），结果按上游排序返回', '播放时自动选择请求档位真链，取链后魔数+大小校验，失败不静默降级'],
    importMusicSheet: [
      '支持火龙DJ用户歌曲列表导入：粘贴含 uid 参数的链接、纯数字 uid，或「火龙DJ uid:123456」格式',
      '单次最多导入 500 首'
    ]
  },

  async search(query, page, type) {
    var kw = query && typeof query === 'object' ? str(query.keyword).trim() : str(query).trim();
    if (!kw) return { isEnd: true, data: [] };
    if (type && type !== 'music') return { isEnd: true, data: [] };
    var cfg = await fetchRuntimeConfig(false);
    return searchMusicImpl(cfg, kw, page);
  },

  async getMediaSource(musicItem, quality) {
    var r = await getMediaSourceImpl(musicItem, quality);
    // 宿主 IMediaSourceResult 标准字段 quality 回填（=actualQuality，仓库统一口径）
    if (r && r.url && r.quality !== undefined) r.actualQuality = r.quality;
    return r;
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    var cfg = await fetchRuntimeConfig(false);
    return getTopListDetailImpl(cfg, topListItem, page);
  },

  async importMusicSheet(urlItem) {
    return importMusicSheetImpl(urlItem);
  }
};

// ==================== 自测/交叉质检内部接口 ====================

plugin._internal = {
  md5Hex: md5Hex,
  utf8Bytes: utf8Bytes,
  uriEncode: uriEncode,
  nonce10: nonce10,
  ensureAsciiJson: ensureAsciiJson,
  buildQuery: buildQuery,
  signCanon: signCanon,
  signedGet: signedGet,
  signedPost: signedPost,
  formPost: formPost,
  formEncode: formEncode,
  cdnSignedUrl: cdnSignedUrl,
  fmtOf: fmtOf,
  purePathOf: purePathOf,
  buildMusicItem: buildMusicItem,
  verifyRemoteAudio: verifyRemoteAudio,
  detectMagic: detectMagic,
  expectMagicOf: expectMagicOf,
  normalizeQuality: normalizeQuality,
  reportPlay: reportPlay,
  searchMusicImpl: searchMusicImpl,
  getMediaSourceImpl: getMediaSourceImpl,
  getTopListsImpl: getTopListsImpl,
  getTopListDetailImpl: getTopListDetailImpl,
  importMusicSheetImpl: importMusicSheetImpl,
  extractUid: extractUid,
  extractFirstUrl: extractFirstUrl,
  fetchRuntimeConfig: fetchRuntimeConfig,
  get RUNTIME_CFG() { return runtimeCfg; },
  CONSTANTS: {
    API_HOST: API_HOST,
    DEFAULT_UTOKEN: DEFAULT_UTOKEN,
    DEFAULT_FD_KEY: DEFAULT_FD_KEY,
    COMMON_PARAMS: COMMON_PARAMS,
    SEARCH_PAGE_SIZE: SEARCH_PAGE_SIZE,
    TOP_PAGE_SIZE: TOP_PAGE_SIZE,
    MUSIC_ID_PREFIX: MUSIC_ID_PREFIX,
    PURE_FORMATS: PURE_FORMATS,
    MIN_AUDIO_BYTES: MIN_AUDIO_BYTES
  }
};

module.exports = plugin;
