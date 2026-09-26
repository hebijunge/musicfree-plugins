/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「DJ多多」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * ============================================================================
 * DJ多多 音源插件 for MusicFree（音流宿主 standalone 版）
 * ----------------------------------------------------------------------------
 * @version   1.0.0
 * @author    研发1号
 * @date      2026-09-24
 * ----------------------------------------------------------------------------
 * v1.0.0 changelog（首发版）：
 *  - 接口依据：《DJ多多接口完整文档_综合实测版.md》（2026-09-24 云盘版）+ 20 项在线
 *    探针实证（probe-djdd.cjs / probe-result.json，2026-09-24），所有响应字段名、
 *    封面/音频 URL 派生规则均以实测为准，非文档转述。
 *  - AES-128-CBC 双密钥纯 JS 实现（RN Hermes 运行时无 node crypto/btoa，S-box 由
 *    GF(2^8) 乘法逆元 + 仿射变换程序化生成，与 node crypto 对拍验证）：
 *      REQ（请求加密）e82a4a775c295bbbe33f66828a368b90 / IV 8477d5a085c1d50d8a74811ec3e811e4
 *      RESP（响应/Path 解密）e4fd094dfcae98f352ddf81ee760d891 / IV 932ea49cfff68382f0516ccc63a52123
 *  - 免登录接口全部接入：搜索(act=sch) / 榜单(8 个 Id 硬编码 rank_detail) / 频道
 *    (chnlist+homechn) / 分类(catlist+cat) / 歌单(hot_songlist+new_songlist+
 *    songlistdetail) / 单曲详情(detail) / 配置(config.php，外层加密响应解密)。
 *  - 音质体系：Q0=aac 71~78k 标准（免登录，detail 取链，/dj/ 目录）；Q1=mp3 128k
 *    (/dj_nq/)；Q2=mp3 320k (/dj_hq/)；Q3=flac 无损 (/dj_sq/)。Q1~Q3 走 formats
 *    接口（需登录态，默认使用文档内置 Uid=12626571 / OpenId，可用 userVariables
 *    ddUid/ddOpenId 覆盖），每档独立 Path（不同文件名，不可 URL 派生），formats
 *    结果 30 分钟内存缓存。
 *  - 音频 URL 派生：http://bdcdn.djduoduo.com/{目录前缀}/{Id后3位}/{解密后Path}
 *  - 取链校验（音流口径）：请求哪个音质获取哪个音质；请求档不可用沿降级链回落并
 *    以 actualQuality 如实标注；Range 0-15 探测，HTTP 200/201/206，Content-Range
 *    total / Content-Length 与 formats 返回 Size 严格相等；魔数白名单按档位——
 *    Q3 必须 fLaC；Q1/Q2 允许 ID3/mp3/ftyp/ADTS；Q0 实测为 ftyp(MP4 容器头，
 *    .aac 文件)，白名单放宽到已知音频头（ftyp/ID3/mp3/ADTS/fLaC）。
 *  - 封面规则（探针实证）：歌曲 {imgcdn}/dj/cover/{Id后3位}/500/{Cover}；
 *    榜单 {imgcdn}/dj/rank/{榜单Id}.jpg；歌单 {imgcdn}/img/songlist/cover/
 *    {Id后3位}/150/{Cover}；频道 {imgcdn}/dj/chn/{Id}.jpg。
 *  - 明确不支持的能力（宁缺勿假，不得伪造）：
 *      ① 歌词：act=lyric 返回密钥在 App 原生层的独立加密（RESP 双密钥解出 bad
 *        decrypt，文档 4.12 标注待解），本插件不实现 getLyric；
 *      ② 视频（hot_svideo，仅 480p）：视频与歌曲无 Id 映射（独立内容池），宿主
 *        getMvSource 契约要求 musicItem → MV 映射，不实现；
 *      ③ importMusicSheet / importMusicItem：无文档化分享链接 scheme，不实现。
 *  - 分页：上游 PageNo 0 基、每页 30 条、HasMore=1 有下一页；宿主页码 1 基，插件
 *    内统一 page-1 换算。
 *  - extra 设备令牌：VerCode=5568（5.5.68）实测通过，VerCode=7000 被拒（文档 4.11）。
 * ============================================================================
 */
var axios = require('axios');

// ==================== 常量 ====================
var PLATFORM = 'djduoduo';
var VERSION = '1.0.0';

var API_BASE = 'https://new.dianyinduoduo.com/v4/';
var UA = 'okhttp/4.9.2';
var TIMEOUT = 15000;

// 文档 4.11 内置可用登录态（2026-09-02 实测有效，2026-09-24 探针复测四档全出）
var DEFAULT_UID = '12626571';
var DEFAULT_OPENID = 'otyjsjuPbCAqRnBfnHN3wI_Sxhw4';

// CDN（文档五章 + 探针实测：音频三家互通 bdcdn/hscdn/txcdn，取 bdcdn 主；图片走 txcdn）
var AUDIO_CDN = 'http://bdcdn.djduoduo.com';
var IMG_CDN = 'http://txcdn.dianyinduoduo.com';
var AUDIO_DIRS = ['dj', 'dj_nq', 'dj_hq', 'dj_sq'];

// 音质映射：宿主档位名 → 上游 Quality 下标
var QUALITY_TO_Q = { low: 0, '128k': 1, standard: 1, '320k': 2, high: 2, flac: 3, super: 3 };
var Q_TO_KEY = ['low', '128k', '320k', 'flac'];

// 8 个榜单（文档 4.4：无榜单列表接口，Id 硬编码）
var RANK_DEFS = [
  { Id: 100, Name: '多多飙升榜' },
  { Id: 101, Name: '多多TOP500' },
  { Id: 104, Name: '多多分享榜' },
  { Id: 105, Name: '电音排行榜' },
  { Id: 107, Name: '中文舞曲榜' },
  { Id: 108, Name: '英文舞曲榜' },
  { Id: 109, Name: '串烧舞曲榜' },
  { Id: 110, Name: '车载音乐榜' }
];
// 频道 13 个（chnlist 失败时的硬编码兜底，与文档 4.5 一致）
var CHN_FALLBACK = [
  { Id: 100, Name: '3D环绕闭眼听' }, { Id: 101, Name: '做一名优秀的DJ' },
  { Id: 103, Name: '有一种痛叫撕心裂肺（伤感）' }, { Id: 104, Name: '所谓的豪车音乐（车载）' },
  { Id: 105, Name: '一曲电音赛神仙（电音）' }, { Id: 106, Name: '大家都来社会摇' },
  { Id: 107, Name: '中文嗨曲' }, { Id: 108, Name: '经典老歌' },
  { Id: 109, Name: '铃声' }, { Id: 110, Name: '欧美日韩' },
  { Id: 111, Name: '今晚去蹦迪' }, { Id: 114, Name: '粤语' },
  { Id: 117, Name: '电动车音效' }
];
// 分类 25 个（catlist 失败时的硬编码兜底，与文档 4.6 一致）
var CAT_FALLBACK = [
  { Id: 1, Name: '中文' }, { Id: 2, Name: '慢摇' }, { Id: 3, Name: 'MC喊麦' },
  { Id: 4, Name: '串烧' }, { Id: 5, Name: '英文' }, { Id: 6, Name: '电锯' },
  { Id: 8, Name: '舞曲' }, { Id: 9, Name: '日韩' }, { Id: 10, Name: '铃声' },
  { Id: 11, Name: '电音' }, { Id: 13, Name: '车载' }, { Id: 14, Name: '夜店' },
  { Id: 16, Name: '现场' }, { Id: 18, Name: '苏荷' }, { Id: 21, Name: '节奏' },
  { Id: 22, Name: 'House' }, { Id: 23, Name: '越南鼓' }, { Id: 24, Name: '加快' },
  { Id: 25, Name: 'Remix' }, { Id: 26, Name: '氛围' }, { Id: 27, Name: '社会摇' },
  { Id: 28, Name: 'RNB' }, { Id: 29, Name: '长DJ' }, { Id: 30, Name: '网友上传' },
  { Id: 31, Name: '3D环绕' }
];

function str(v) { return v === undefined || v === null ? '' : String(v); }
function last3(id) { var s = str(id); return s.length <= 3 ? s : s.slice(-3); }
function pageBase(page) { var p = parseInt(page, 10); if (!p || p < 1) p = 1; return p - 1; } // 宿主 1 基 → 上游 0 基
function toNumId(id) { var n = parseInt(id, 10); return isNaN(n) ? id : n; }

// ==================== 纯 JS AES-128-CBC（Hermes 无 node crypto） ====================
function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff; }
function gmul(a, b) {
  var p = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    a = xtime(a); b >>= 1;
  }
  return p & 0xff;
}
function rotl8(x, s) { return ((x << s) | (x >>> (8 - s))) & 0xff; }

// S-box 程序化生成：GF(2^8) 乘法逆元（暴力求逆，65536 次运算量级，加载瞬间完成）
// + 仿射变换，避免手抄 256 项表引入 typo；同法生成逆 S-box。
var SBOX = [], INV_SBOX = [];
(function buildSbox() {
  var inv = new Array(256);
  for (var a = 1; a < 256; a++) {
    for (var b = 1; b < 256; b++) {
      if (gmul(a, b) === 1) { inv[a] = b; break; }
    }
  }
  inv[0] = 0;
  for (var x = 0; x < 256; x++) {
    var v = inv[x];
    var s = (v ^ rotl8(v, 1) ^ rotl8(v, 2) ^ rotl8(v, 3) ^ rotl8(v, 4) ^ 0x63) & 0xff;
    SBOX[x] = s;
    INV_SBOX[s] = x;
  }
})();

function keyExpansion(keyBytes) { // AES-128：4 词初始 + 40 词扩展
  var w = [];
  for (var i = 0; i < 4; i++) {
    w[i] = [keyBytes[4 * i], keyBytes[4 * i + 1], keyBytes[4 * i + 2], keyBytes[4 * i + 3]];
  }
  var rcon = 1;
  for (var k = 4; k < 44; k++) {
    var t = [w[k - 1][0], w[k - 1][1], w[k - 1][2], w[k - 1][3]];
    if (k % 4 === 0) {
      t = [SBOX[t[1]] ^ rcon, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
      rcon = xtime(rcon);
    }
    w[k] = [w[k - 4][0] ^ t[0], w[k - 4][1] ^ t[1], w[k - 4][2] ^ t[2], w[k - 4][3] ^ t[3]];
  }
  return w;
}

function subBytes(s, useInv) {
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) s[r][c] = useInv ? INV_SBOX[s[r][c]] : SBOX[s[r][c]];
}
function shiftRows(s) { // 行 r 循环左移 r
  var t;
  t = s[1][0]; s[1][0] = s[1][1]; s[1][1] = s[1][2]; s[1][2] = s[1][3]; s[1][3] = t;
  t = s[2][0]; s[2][0] = s[2][2]; s[2][2] = t; t = s[2][1]; s[2][1] = s[2][3]; s[2][3] = t;
  t = s[3][3]; s[3][3] = s[3][2]; s[3][2] = s[3][1]; s[3][1] = s[3][0]; s[3][0] = t;
}
function invShiftRows(s) {
  var t;
  t = s[1][3]; s[1][3] = s[1][2]; s[1][2] = s[1][1]; s[1][1] = s[1][0]; s[1][0] = t;
  t = s[2][0]; s[2][0] = s[2][2]; s[2][2] = t; t = s[2][1]; s[2][1] = s[2][3]; s[2][3] = t;
  t = s[3][0]; s[3][0] = s[3][1]; s[3][1] = s[3][2]; s[3][2] = s[3][3]; s[3][3] = t;
}
function mixColumns(s) {
  for (var c = 0; c < 4; c++) {
    var a0 = s[0][c], a1 = s[1][c], a2 = s[2][c], a3 = s[3][c];
    s[0][c] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
    s[1][c] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
    s[2][c] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
    s[3][c] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
  }
}
function invMixColumns(s) {
  for (var c = 0; c < 4; c++) {
    var a0 = s[0][c], a1 = s[1][c], a2 = s[2][c], a3 = s[3][c];
    s[0][c] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
    s[1][c] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
    s[2][c] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
    s[3][c] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
  }
}
function addRoundKey(s, w, round) {
  for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) s[r][c] ^= w[round * 4 + c][r];
}
function stateFromBytes(input) {
  var s = [[], [], [], []];
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) s[r][c] = input[r + 4 * c];
  return s;
}
function bytesFromState(s) {
  var out = new Array(16);
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) out[r + 4 * c] = s[r][c];
  return out;
}
function aesRawEncryptBlock(input, w) { // FIPS-197 加密块（供 KAT 与 CBC 复用）
  var s = stateFromBytes(input);
  addRoundKey(s, w, 0);
  for (var round = 1; round <= 9; round++) {
    subBytes(s); shiftRows(s); mixColumns(s); addRoundKey(s, w, round);
  }
  subBytes(s); shiftRows(s); addRoundKey(s, w, 10);
  return bytesFromState(s);
}
function aesRawDecryptBlock(input, w) { // FIPS-197 InvCipher
  var s = stateFromBytes(input);
  addRoundKey(s, w, 10);
  for (var round = 9; round >= 1; round--) {
    invShiftRows(s); subBytes(s, true); addRoundKey(s, w, round); invMixColumns(s);
  }
  invShiftRows(s); subBytes(s, true); addRoundKey(s, w, 0);
  return bytesFromState(s);
}

function pkcs7Pad(bytes) {
  var pad = 16 - (bytes.length % 16);
  var out = bytes.slice(0);
  for (var i = 0; i < pad; i++) out.push(pad);
  return out;
}
function pkcs7Unpad(bytes) {
  if (bytes.length === 0 || bytes.length % 16 !== 0) throw new Error('djduoduo: AES 解密长度非法 ' + bytes.length);
  var pad = bytes[bytes.length - 1];
  if (pad < 1 || pad > 16) throw new Error('djduoduo: AES 填充非法');
  for (var i = bytes.length - pad; i < bytes.length; i++) if (bytes[i] !== pad) throw new Error('djduoduo: AES 填充校验失败');
  return bytes.slice(0, bytes.length - pad);
}
function aesCbcEncryptBytes(plainBytes, keyBytes, ivBytes) {
  var w = keyExpansion(keyBytes);
  var data = pkcs7Pad(plainBytes);
  var prev = ivBytes.slice(0, 16);
  var out = [];
  for (var off = 0; off < data.length; off += 16) {
    var blk = [];
    for (var i = 0; i < 16; i++) blk.push(data[off + i] ^ prev[i]);
    var enc = aesRawEncryptBlock(blk, w);
    out = out.concat(enc);
    prev = enc;
  }
  return out;
}
function aesCbcDecryptBytes(cipherBytes, keyBytes, ivBytes) {
  if (cipherBytes.length % 16 !== 0) throw new Error('djduoduo: 密文长度非 16 倍数');
  var w = keyExpansion(keyBytes);
  var prev = ivBytes.slice(0, 16);
  var out = [];
  for (var off = 0; off < cipherBytes.length; off += 16) {
    var blk = cipherBytes.slice(off, off + 16);
    var dec = aesRawDecryptBlock(blk, w);
    for (var i = 0; i < 16; i++) out.push(dec[i] ^ prev[i]);
    prev = blk;
  }
  return pkcs7Unpad(out);
}

// ---------- 编码工具（Hermes 无 btoa/atob/TextEncoder 保证） ----------
var B64A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var B64INV = (function () {
  var m = {};
  for (var i = 0; i < B64A.length; i++) m[B64A.charAt(i)] = i;
  m['-'] = 62; m['_'] = 63; // URL-safe 变体兼容
  return m;
})();
function bytesToB64(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64A.charAt(b0 >> 2);
    out += B64A.charAt(((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4));
    out += b1 === undefined ? '=' : B64A.charAt(((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6));
    out += b2 === undefined ? '=' : B64A.charAt(b2 & 63);
  }
  return out;
}
function b64ToBytes(sIn) {
  var s = str(sIn).replace(/[^A-Za-z0-9+/\-_=]/g, '');
  var out = [], acc = 0, n = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '=') break;
    var v = B64INV[ch];
    if (v === undefined) continue;
    acc = (acc << 6) | v; n += 6;
    if (n >= 8) { n -= 8; out.push((acc >> n) & 0xff); }
  }
  return out;
}
function utf8Encode(strIn) {
  var out = [], s = str(strIn);
  for (var i = 0; i < s.length; i++) {
    var code = s.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
      var lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) { code = 0x10000 + ((code - 0xd800) << 10) + (lo - 0xdc00); i++; }
    }
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return out;
}
function utf8Decode(bytes) {
  var out = '', i = 0;
  while (i < bytes.length) {
    var b = bytes[i], code;
    if (b < 0x80) { code = b; i += 1; }
    else if ((b & 0xe0) === 0xc0) { code = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
    else if ((b & 0xf0) === 0xe0) { code = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
    else { code = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4; }
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else out += String.fromCharCode(code);
  }
  return out;
}
function hexToBytes(hex) {
  var out = [];
  for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

// ---------- 双密钥（文档二章） ----------
var REQ_KEY = hexToBytes('e82a4a775c295bbbe33f66828a368b90');
var REQ_IV = hexToBytes('8477d5a085c1d50d8a74811ec3e811e4');
var RESP_KEY = hexToBytes('e4fd094dfcae98f352ddf81ee760d891');
var RESP_IV = hexToBytes('932ea49cfff68382f0516ccc63a52123');

function encryptRequest(objStr) { // 请求 data：AES-CBC(REQ) → Base64 → URL encode
  return encodeURIComponent(bytesToB64(aesCbcEncryptBytes(utf8Encode(objStr), REQ_KEY, REQ_IV)));
}
function decryptResponse(b64) { // 响应：Base64 → AES-CBC(RESP) 解密
  return utf8Decode(aesCbcDecryptBytes(b64ToBytes(b64), RESP_KEY, RESP_IV));
}
function decryptPath(p) { // Path 等字段均为 RESP 密文
  return utf8Decode(aesCbcDecryptBytes(b64ToBytes(p), RESP_KEY, RESP_IV));
}

// ==================== 请求层 ====================
// extra 设备令牌（文档 4.11：VerCode=5568 通过、7000 被拒；探针 2026-09-24 复测通过）
var EXTRA = (function () {
  var dev = { VerCode: 5568, Ver: '5.5.68', Channel: 'Honor', Platform: 'Android', OSVer: 31, Did: 'db1c1c9725b74d4b', AppId: 120, Ts: 0, VTs: 0 };
  return encryptRequest(JSON.stringify(dev));
})();

function apiGet(entry, act, data) {
  var url = API_BASE + entry + '?act=' + act + '&data=' + encryptRequest(JSON.stringify(data || {})) + '&extra=' + EXTRA;
  return axios.get(url, { timeout: TIMEOUT, headers: { 'User-Agent': UA }, responseType: 'text' }).then(function (res) {
    var t = str(res.data).trim();
    var obj;
    if (t.charAt(0) === '{') {
      try { obj = JSON.parse(t); } catch (e) { throw new Error('djduoduo: ' + act + ' 响应 JSON 解析失败'); }
    } else {
      try { obj = JSON.parse(decryptResponse(t)); } catch (e) { throw new Error('djduoduo: ' + act + ' 响应解密失败'); }
    }
    if (!obj || obj.RetCode !== 200) {
      throw new Error('djduoduo: ' + act + ' RetCode=' + (obj && obj.RetCode) + (obj && obj.Message ? (' ' + obj.Message) : ''));
    }
    return obj;
  });
}

// ==================== URL 派生 ====================
function audioUrlOf(id, qIdx, pathPlain) {
  return AUDIO_CDN + '/' + AUDIO_DIRS[qIdx] + '/' + last3(id) + '/' + pathPlain;
}
function songCoverUrl(id, cover) {
  var c = str(cover);
  if (!c) return '';
  if (c.slice(0, 2) === '//') return 'http:' + c;
  if (c.indexOf('http') === 0) return c;
  if (c.indexOf('/dj/') === 0) return IMG_CDN + c;
  return IMG_CDN + '/dj/cover/' + last3(id) + '/500/' + c;
}
function sheetCoverUrl(id, cover) {
  var c = str(cover);
  if (!c) return '';
  if (c.slice(0, 2) === '//') return 'http:' + c;
  if (c.indexOf('http') === 0) return c;
  if (c.indexOf('/dj/') === 0) return IMG_CDN + c;
  return IMG_CDN + '/img/songlist/cover/' + last3(id) + '/150/' + c; // 文档 4.8 + 探针实测
}
function rankCoverUrl(rankId) { return IMG_CDN + '/dj/rank/' + rankId + '.jpg'; } // 探针实测 206
function chnCoverUrl(chn) {
  var c = str(chn.Cover);
  if (c.indexOf('/dj/') === 0) return IMG_CDN + c;
  return IMG_CDN + '/dj/chn/' + chn.Id + '.jpg';
}

// ==================== 取链校验（音流口径） ====================
function magicOf(u8) {
  if (!u8 || u8.length < 4) return '';
  if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) return 'fLaC';
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'ID3';
  if (u8[0] === 0x00 && u8[1] === 0x00 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return 'ftyp';
  if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return 'mp3';
  if (u8[0] === 0xff && (u8[1] & 0xf6) === 0xf0) return 'ADTS';
  if (u8[0] === 0x41 && u8[1] === 0x44 && u8[2] === 0x49 && u8[3] === 0x46) return 'ADIF';
  return '';
}
// 魔数白名单按档位：Q3 必须 fLaC；Q1/Q2 mp3 系（ID3 为主，探针实测）；Q0 探针实测
// 为 ftyp（.aac 文件实为 MP4 容器头），放宽到已知音频头集合。
function magicAllowed(qIdx, magic) {
  if (!magic) return false;
  if (qIdx === 3) return magic === 'fLaC';
  if (qIdx === 1 || qIdx === 2) return magic === 'ID3' || magic === 'mp3' || magic === 'ftyp' || magic === 'ADTS';
  return magic === 'ftyp' || magic === 'ID3' || magic === 'mp3' || magic === 'ADTS' || magic === 'fLaC';
}
// Range 0-15 探测：HTTP 200/201/206、Content-Range total/Content-Length、
// 与期望 Size 严格相等、魔数白名单。任一不符抛错（校验失败的候选链向下回落）。
function probeAudioHead(url, expectSize, qIdx) {
  return axios.get(url, {
    timeout: TIMEOUT,
    headers: { 'User-Agent': UA, Range: 'bytes=0-15' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 201 && st !== 206) throw new Error('djduoduo: 音频 HTTP ' + st);
    var h = res.headers || {};
    var total = 0;
    var cr = h['content-range'] || h['Content-Range'];
    var m = cr && /\/(\d+)\s*$/.exec(str(cr));
    if (m) total = parseInt(m[1], 10) || 0;
    else if (st !== 206) total = parseInt(h['content-length'] || h['Content-Length'], 10) || 0;
    if (!total) throw new Error('djduoduo: 音频响应无有效大小');
    if (expectSize && total !== expectSize) throw new Error('djduoduo: 大小不符 total=' + total + ' expected=' + expectSize);
    var buf = res.data, u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = magicOf(u8);
    if (!magicAllowed(qIdx, magic)) throw new Error('djduoduo: 魔数不符 ' + (magic || 'unknown') + ' (Q' + qIdx + ')');
    return { url: url, size: total, magic: magic };
  });
}

// ==================== formats（Q1~Q3 高音质，需登录态） ====================
var FORMATS_TTL = 30 * 60 * 1000;
var formatsCache = {};
function getUserVar(key) {
  try {
    if (global.env && global.env.getUserVariables) {
      var uv = global.env.getUserVariables();
      return uv ? uv[key] : undefined;
    }
  } catch (e) { /* fail-soft */ }
  return undefined;
}
function loginState() {
  var uid = str(getUserVar('ddUid') || DEFAULT_UID);
  var oid = str(getUserVar('ddOpenId') || DEFAULT_OPENID);
  return { Uid: parseInt(uid, 10) || 0, OpenId: oid };
}
function fetchFormats(id) {
  var key = str(id);
  var hit = formatsCache[key];
  if (hit && Date.now() - hit.ts < FORMATS_TTL) return Promise.resolve(hit.formats);
  var ls = loginState();
  return apiGet('getlist.php', 'formats', {
    Id: toNumId(id), Uid: ls.Uid, OpenId: ls.OpenId, UserAction: 'FreeSVIP', Status: 0
  }).then(function (b) {
    var fs = (b.Item && b.Item.Formats) || [];
    var mapped = [];
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      var q = f.Quality;
      if (q === undefined || q < 0 || q > 3) continue;
      var p;
      try { p = decryptPath(f.Path); } catch (e) { continue; } // 解不开的档跳过，不伪造
      if (!p) continue;
      mapped.push({ Quality: q, Bitrate: f.Bitrate || 0, Size: f.Size || 0, path: p, url: audioUrlOf(id, q, p) });
    }
    mapped.sort(function (a, b2) { return a.Quality - b2.Quality; });
    formatsCache[key] = { ts: Date.now(), formats: mapped };
    return mapped;
  });
}

// ==================== 取链主链路 ====================
// 请求哪个音质就获取哪个音质；请求档不可用时沿降级链（请求档→…→Q0）回落，
// actualQuality 如实标注实际命中档（宁低勿高）。
function resolveAudio(id, qIdx) {
  return fetchFormats(id).then(function (formats) {
    var chain = [];
    for (var q = qIdx; q >= 0; q--) {
      for (var i = 0; i < formats.length; i++) {
        if (formats[i].Quality === q) { chain.push(formats[i]); break; }
      }
    }
    if (chain.length === 0) throw new Error('djduoduo: 该歌曲无可用音质档');
    var tryOne = function (idx) {
      var f = chain[idx];
      return probeAudioHead(f.url, f.Size, f.Quality).then(function () {
        return {
          url: f.url,
          quality: Q_TO_KEY[f.Quality],
          actualQuality: Q_TO_KEY[f.Quality],
          size: f.Size,
          bitrate: f.Bitrate
        };
      }).catch(function (e) {
        if (idx + 1 < chain.length) return tryOne(idx + 1);
        throw e;
      });
    };
    return tryOne(0);
  });
}
function getMediaSourceImpl(musicItem, quality) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djduoduo: 缺少歌曲 id'));
  var qIdx = QUALITY_TO_Q[str(quality)];
  if (qIdx === undefined) qIdx = 1; // 未知档位按 128k 处理
  if (qIdx === 0) {
    // 免登录 Q0：优先用列表/搜索条目自带的加密 Path（零额外请求），失败回落 detail 接口
    var tryListPath = function () {
      var enc = musicItem && musicItem._path;
      if (!enc) return Promise.reject(new Error('no _path'));
      var p = decryptPath(enc);
      var url = audioUrlOf(id, 0, p);
      var expect = musicItem && musicItem._size ? musicItem._size : 0;
      return probeAudioHead(url, expect, 0).then(function (v) {
        return { url: url, quality: 'low', actualQuality: 'low', size: v.size, bitrate: (musicItem && musicItem._bitrate) || 0 };
      });
    };
    var tryDetail = function () {
      return apiGet('getlist.php', 'detail', { Id: toNumId(id) }).then(function (b) {
        var s = (b.List && b.List[0]) || null;
        if (!s || !s.Path) throw new Error('djduoduo: detail 无 Path');
        var p = decryptPath(s.Path);
        var url = audioUrlOf(id, 0, p);
        return probeAudioHead(url, s.Size || 0, 0).then(function (v) {
          return { url: url, quality: 'low', actualQuality: 'low', size: v.size, bitrate: s.Bitrate || 0 };
        });
      });
    };
    return tryListPath().catch(tryDetail);
  }
  return resolveAudio(id, qIdx);
}

// ==================== 条目构建 ====================
function qualitiesOfMaxQ(maxQ) {
  var n = parseInt(maxQ, 10);
  if (isNaN(n) || n < 0) return undefined;
  if (n > 3) n = 3;
  return Q_TO_KEY.slice(0, n + 1); // MaxQ=最高档下标，实际档数以 formats 为准（文档 4.3）
}
function buildMusicItem(raw) {
  return {
    id: str(raw.Id),
    title: str(raw.Name),
    artist: str(raw.User),
    album: '',
    artwork: songCoverUrl(raw.Id, raw.Cover),
    duration: parseInt(raw.Duration, 10) || 0,
    qualities: qualitiesOfMaxQ(raw.MaxQ),
    // _path/_size/_bitrate：Q0 免登录取链的零请求加速（加密 Path 原样透传，播放时解密）
    _path: raw.Path || '',
    _size: parseInt(raw.Size, 10) || 0,
    _bitrate: parseInt(raw.Bitrate, 10) || 0,
    platform: PLATFORM
  };
}
function buildSheetItem(raw) {
  return {
    id: str(raw.Id),
    title: str(raw.Name),
    artist: str(raw.User),
    author: str(raw.User), // 宿主协议读 artist，author 别名同值双写（对齐仓库惯例）
    artwork: sheetCoverUrl(raw.Id, raw.Cover),
    description: raw.Count ? ('共' + raw.Count + '首 · ' + str(raw.User)) : '',
    worksNum: parseInt(raw.Count, 10) || 0,
    platform: PLATFORM
  };
}

// ==================== 搜索 ====================
function searchImpl(query, page, type) {
  var kw = query && typeof query === 'object' ? str(query.keyword).trim() : str(query).trim();
  if (!kw) return Promise.resolve({ isEnd: true, data: [] });
  if (type && type !== 'music') return Promise.resolve({ isEnd: true, data: [] }); // 仅歌曲搜索（文档仅提供 sch 歌曲维度）
  return apiGet('search.php', 'sch', { Query: kw, From: 'Search', Uid: 0, PageNo: pageBase(page) }).then(function (b) {
    var list = b.List || [];
    var data = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].Id) data.push(buildMusicItem(list[i]));
    var isEnd = b.HasMore === undefined ? list.length < 30 : b.HasMore !== 1;
    return { isEnd: isEnd, data: data };
  });
}

// ==================== 榜单 / 频道 / 分类 ====================
function getTopListsImpl() {
  var groups = [];
  groups.push({
    title: '榜单',
    data: RANK_DEFS.map(function (d) {
      var cv = rankCoverUrl(d.Id);
      return { id: 'djduoduo_rank_' + d.Id, title: d.Name, coverImg: cv, artwork: cv, platform: PLATFORM };
    })
  });
  var chnP = apiGet('getlist.php', 'chnlist', { Id: 2 }).then(function (b) {
    var l = b.List || [];
    return l.length ? l : CHN_FALLBACK;
  }).catch(function () { return CHN_FALLBACK; });
  var catP = apiGet('getlist.php', 'catlist', { Id: 1, PageNo: 0 }).then(function (b) {
    var l = b.List || [];
    return l.length ? l : CAT_FALLBACK;
  }).catch(function () { return CAT_FALLBACK; });
  return Promise.all([chnP, catP]).then(function (rs) {
    var chn = rs[0], cat = rs[1];
    groups.push({
      title: '频道',
      data: chn.map(function (c) {
        var cv = chnCoverUrl(c);
        return { id: 'djduoduo_chn_' + c.Id, title: str(c.Name), coverImg: cv, artwork: cv, platform: PLATFORM };
      })
    });
    groups.push({
      title: '乐库分类',
      data: cat.map(function (c) {
        return { id: 'djduoduo_cat_' + c.Id, title: str(c.Name), coverImg: '', artwork: '', platform: PLATFORM };
      })
    });
    return groups;
  });
}
function getTopListDetailImpl(topListItem, page) {
  var tid = str(topListItem && topListItem.id);
  var pno = pageBase(page);
  var entry, act, data;
  var mR = /^djduoduo_rank_(\d+)$/.exec(tid);
  var mC = /^djduoduo_chn_(\d+)$/.exec(tid);
  var mK = /^djduoduo_cat_(\d+)$/.exec(tid);
  if (mR) { entry = 'getlist.php'; act = 'rank_detail'; data = { Id: parseInt(mR[1], 10), PageNo: pno }; }
  else if (mC) { entry = 'getlist.php'; act = 'homechn'; data = { Id: parseInt(mC[1], 10), PageNo: pno }; }
  else if (mK) { entry = 'getlist.php'; act = 'cat'; data = { Id: parseInt(mK[1], 10), PageNo: pno, Type: 'Hot' }; }
  else return Promise.reject(new Error('djduoduo: 未知榜单/频道/分类 ' + tid));
  return apiGet(entry, act, data).then(function (b) {
    var list = b.List || [];
    var musicList = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].Id) musicList.push(buildMusicItem(list[i]));
    return {
      isEnd: list.length < 30,
      musicList: musicList,
      topListItem: {
        id: topListItem.id,
        title: topListItem.title,
        coverImg: topListItem.coverImg || topListItem.artwork || '',
        artwork: topListItem.artwork || topListItem.coverImg || '',
        platform: PLATFORM
      }
    };
  });
}

// ==================== 歌单 ====================
function getRecommendSheetTagsImpl() {
  return Promise.resolve({
    pinned: [{ id: 'hot', title: '热门' }],
    data: [{ title: '推荐歌单', data: [{ id: 'hot', title: '热门歌单' }, { id: 'new', title: '最新歌单' }] }]
  });
}
function getRecommendSheetsByTagImpl(tag, page) {
  var tid = tag && tag.id !== undefined && tag.id !== null && tag.id !== '' ? str(tag.id) : 'hot';
  var act = tid === 'new' ? 'new_songlist' : 'hot_songlist';
  return apiGet('getlist.php', act, { PageNo: pageBase(page) }).then(function (b) {
    var list = b.List || [];
    var data = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].Id) data.push(buildSheetItem(list[i]));
    var isEnd = b.HasMore === undefined ? list.length < 30 : b.HasMore !== 1;
    return { isEnd: isEnd, data: data };
  });
}
function getMusicSheetInfoImpl(sheetItem, page) {
  var id = sheetItem && sheetItem.id;
  if (!id) return Promise.reject(new Error('djduoduo: 缺少歌单 id'));
  return apiGet('getlist.php', 'songlistdetail', { Id: toNumId(id), PageNo: pageBase(page) }).then(function (b) {
    var list = b.List || [];
    var meta = b.Item || {};
    var musicList = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].Id) musicList.push(buildMusicItem(list[i]));
    var sheet = {
      id: str(id),
      title: str(meta.Name) || str(sheetItem.title),
      artist: str(meta.User) || str(sheetItem.artist),
      author: str(meta.User) || str(sheetItem.author),
      artwork: sheetCoverUrl(id, meta.Cover || sheetItem.artwork),
      description: str(meta.Desc),
      worksNum: parseInt(meta.Count, 10) || musicList.length,
      platform: PLATFORM
    };
    return { isEnd: list.length < 30, sheetItem: sheet, musicList: musicList };
  });
}

// ==================== 歌曲详情 ====================
function getMusicInfoImpl(musicItem) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djduoduo: 缺少歌曲 id'));
  return apiGet('getlist.php', 'detail', { Id: toNumId(id) }).then(function (b) {
    var s = (b.List && b.List[0]) || {};
    var info = { id: str(id), platform: PLATFORM };
    if (s.Name) info.title = str(s.Name);
    if (s.User) info.artist = str(s.User);
    if (s.Cover) info.artwork = songCoverUrl(id, s.Cover);
    if (s.Duration) info.duration = parseInt(s.Duration, 10) || 0;
    if (s.MaxQ !== undefined) info.qualities = qualitiesOfMaxQ(s.MaxQ);
    return info;
  });
}

// ==================== 配置（免登录，外层加密响应） ====================
function fetchConfig() {
  return apiGet('config.php', 'config', { AppId: 120, Encrypt: 1 }).then(function (b) {
    var list = b.ConfigList || {};
    var keys = Object.keys(list);
    return {
      configKeys: keys,
      serviceHosts: (list.ServiceKeeper && list.ServiceKeeper.SERVICE_HOST) || null,
      count: keys.length
    };
  });
}

// ==================== 插件定义 ====================
var plugin = {
  name: 'DJ多多',
  platform: PLATFORM,
  version: VERSION,
  author: '研发1号',
  description: 'DJ多多独立音源插件 v1.0.0（首发版）：DJ 舞曲曲库。AES-128-CBC 双密钥（REQ 请求加密 / RESP 响应与 Path 解密）纯 JS 实现；免登录接口全接入——搜索/榜单(8 个硬编码 Id)/频道(chnlist+homechn)/分类(catlist+cat)/歌单(hot+new+详情)/单曲详情/配置(config 外层加密)；音质四档 Q0=aac 71~78k 标准（免登录）/Q1=mp3 128k/Q2=mp3 320k/Q3=flac 无损（Q1~Q3 走 formats 登录态接口，每档独立 Path），请求档不可用沿降级链回落并以 actualQuality 如实标注；取链校验：Content-Length 与 formats Size 严格相等 + 魔数白名单（Q3 必须 fLaC，Q0 实测为 ftyp 容器头）。不支持：歌词（lyric 密钥在原生层未解，文档 4.12 待解）、视频 MV（视频为独立内容池无歌曲映射）、歌单链接导入（无分享 scheme）。',
  supportedSearchType: ['music'],
  defaultSearchType: 'music',
  primaryKey: ['id'],
  supportedQualities: ['low', '128k', '320k', 'flac'],
  cacheControl: 'no-store', // 音频直链现取现用（派生规则虽稳定，formats 档位/大小仍动态）
  userVariables: [
    { key: 'ddUid', name: 'formats 高音质账号 Uid（可选）', hint: '默认使用文档内置可用登录态 Uid=12626571；若内置登录态失效（Q1~Q3 报 401/403），改填自己的 Uid' },
    { key: 'ddOpenId', name: 'formats 高音质账号 OpenId（可选）', hint: '与 ddUid 成对填写；为空或与 Uid 不匹配会被 formats 接口拒绝（401 参数错误 / 403 Access deny）' }
  ],
  hints: {
    search: ['搜索 DJ多多曲库（DJ 舞曲/串烧/慢摇/车载等）', '免登录可播标准音质；128k/320k/无损走 formats 高音质通道', '请求音质不可用时自动降级到最近可用档并如实标注'],
    importMusicSheet: []
  },

  async search(query, page, type) {
    return searchImpl(query, page, type);
  },

  async getMediaSource(musicItem, quality) {
    return getMediaSourceImpl(musicItem, quality);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  // 歌词：不实现 getLyric —— 上游 act=lyric 使用原生层独立密钥（RESP 双密钥解出
  // bad decrypt，文档 4.12 标注待解），无密钥无法诚实实现，宁缺勿假。

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  async getRecommendSheetTags() {
    return getRecommendSheetTagsImpl();
  },

  async getRecommendSheetsByTag(tag, page) {
    return getRecommendSheetsByTagImpl(tag, page);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
  },

  // 视频 MV：不实现 getMvSource —— 上游视频池（hot_svideo/new_svideo，仅 480p）与
  // 歌曲无 Id 映射，宿主 getMvSource 契约以 musicItem 为入参，无法诚实映射。
  // 歌单导入：不实现 importMusicSheet —— 上游无文档化分享链接解析接口。

  // ===== 以下为内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    // AES 与编码（自测对拍用）
    encryptRequest: encryptRequest,
    decryptResponse: decryptResponse,
    decryptPath: decryptPath,
    utf8Encode: utf8Encode,
    utf8Decode: utf8Decode,
    bytesToB64: bytesToB64,
    b64ToBytes: b64ToBytes,
    hexToBytes: hexToBytes,
    aesRawEncryptBlock: aesRawEncryptBlock,
    aesRawDecryptBlock: aesRawDecryptBlock,
    aesCbcEncryptBytes: aesCbcEncryptBytes,
    aesCbcDecryptBytes: aesCbcDecryptBytes,
    keyExpansion: keyExpansion,
    REQ_KEY: REQ_KEY, REQ_IV: REQ_IV, RESP_KEY: RESP_KEY, RESP_IV: RESP_IV,
    EXTRA: EXTRA,
    // 请求与取链（自测复用）
    apiGet: apiGet,
    fetchFormats: fetchFormats,
    probeAudioHead: probeAudioHead,
    fetchConfig: fetchConfig,
    loginState: loginState,
    resolveAudio: resolveAudio,
    getMediaSourceImpl: getMediaSourceImpl,
    // 构建与映射
    buildMusicItem: buildMusicItem,
    buildSheetItem: buildSheetItem,
    qualitiesOfMaxQ: qualitiesOfMaxQ,
    magicOf: magicOf,
    magicAllowed: magicAllowed,
    audioUrlOf: audioUrlOf,
    songCoverUrl: songCoverUrl,
    sheetCoverUrl: sheetCoverUrl,
    rankCoverUrl: rankCoverUrl,
    QUALITY_TO_Q: QUALITY_TO_Q,
    Q_TO_KEY: Q_TO_KEY,
    RANK_DEFS: RANK_DEFS,
    CHN_FALLBACK: CHN_FALLBACK,
    CAT_FALLBACK: CAT_FALLBACK,
    searchImpl: searchImpl,
    getTopListsImpl: getTopListsImpl,
    getTopListDetailImpl: getTopListDetailImpl,
    getRecommendSheetTagsImpl: getRecommendSheetTagsImpl,
    getRecommendSheetsByTagImpl: getRecommendSheetsByTagImpl,
    getMusicSheetInfoImpl: getMusicSheetInfoImpl,
    getMusicInfoImpl: getMusicInfoImpl
  }
};

module.exports = plugin;
