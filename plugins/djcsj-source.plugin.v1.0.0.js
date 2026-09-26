/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「DJ串烧集」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * DJ串烧集独立源插件（MusicFree）v1.0.0
 * ================================
 * 首发版（2026-09-24）。依据《DJ串烧集接口完整文档_综合实测版》（平台
 * com.blueocean.extensionfour v3.1.1，Y2002 / 成都蓝海之星 blueocean 系，与火龙DJ
 * 同源同签名体系、独立 host 与独立密钥）实现，全部接口免登录。
 *
 *  - 业务 API：https://app-a-csj.y2002.com，双层 MD5 请求签名（文档 §2.1）：
 *      canonical = "GET <PATH>?<QUERY>\nHost: app-a-csj.y2002.com\ntimestamp: <13位毫秒>\nnonce: <10位随机字母数字>"
 *      inner = md5(canonical)（小写hex）；sign = md5(UTOKEN + ":" + inner)（小写hex）
 *      query 必须业务参数 + 公共参数混合后按键名字典序编码（文档 §7.3 坑；沙箱探针实测
 *      字典序签名 retcode=1 全通，见研发自测清单）。
 *      UTOKEN = cYxq1CnqH%AcP#W9cgy4ozSITQ^bJTje（文档 §2 内存 dump 提取）
 *  - CDN 防盗链（文档 §2.2）：t = (当前毫秒 + 86400000) // 1000 的小写 hex；
 *      sign = md5(FDKEY + path + t)，FDKEY = de8a88aba6bb499883a839b8c0aad3abefab41ab。
 *      CDN 不校验登录态，签名正确即可播放/下载。
 *  - 音质两档、纯 URL 派生（文档 §4，沙箱探针 2026-09-24 实测复核）：
 *      · 标准档（键 '64k'）：fd-djcsj-a-p 域 + songurl 原样（_mp3.m4a），m4a 封装
 *        （实测 audio/mp4、ftyp 魔数、Content-Length/duration ≈ 65.4kbps，与 PlayInfo
 *        playbitrate=64 一致——按宁低勿高口径如实标 64k，不虚标 128k）；
 *      · 高品档（键 '320k'）：fd-djcsj-a-o 域 + pure_path（re.sub(r'_([a-z0-9]+)\.m4a$', r'.\1')）
 *        → 纯 mp3（实测 audio/mpeg、ID3 魔数、320.2kbps，Content-Length 与 PlayInfo
 *        filesize 完全一致）；下载同路径（fd-djcsj-a-d 域文件与 o 域逐字节同源，探针实测一致）；
 *      · 平台仅 mp3、无 flac 无损（文档 §7.5）：flac/flac24bit/hires/atmos/master/dolby
 *        请求入口即拒（不发网络请求、不降级、不虚标）；128k/192k 请求按音流「请求哪档给哪
 *        档、宁高如实标」口径升档交付真实 320k mp3 并如实标 '320k'。
 *  - 关键坑全处理（文档 §7）：
 *      · PlayInfo 的 musicId 用歌曲 id 非 mediaid（实测 mediaid → retcode 0「歌曲不存在」）；
 *      · 搜索/列表 bitrate/filesize 可能为 0（实测搜索与 ListByFilter 均回 0），getMediaSource
 *        与 getMusicInfo 调 PlayInfo（用 id）补全 bitrate/filesize；duration 优先用列表
 *        字段（实测搜索结果现在带 duration 毫秒；PlayInfo 无 duration 字段，不伪造）；
 *      · 歌曲对象无封面字段（文档 §6.7），UI 封面用上传者 avatar 拼 djcsj-img.y2002.com
 *        （图片 CDN 无需签名）；
 *      · ListOfListen 固定 5 首不支持翻页（文档 §7.4），首页/列表一律用 ListByFilter；
 *      · 平台无歌词接口（文档 §8：源码 getLrc 返回 null），getLyric 如实返回 null，不伪造。
 *  - 页面接入：搜索（SearchWithWord keyWords/SortWay=1002/Pi/Pz/filter=1）；榜单两组合一
 *    （曲库分类 TabList tabType=4 共 12 分类 + 音乐人榜 User/Rank）；榜单详情按类路由
 *    （分类 → ListByFilter；音乐人 → Music/List）；推荐歌单（Sheet/RankList）+ 歌单详情
 *    （Sheet/MusicList，复合键 sheetId|userId，文档 §7.10）；getMusicInfo 补 PlayInfo 实档。
 *  - importMusicSheet：平台无网页版/分享链接（文档全接口清单无对应入口），如实实现为
 *    明确拒绝（code=SHEET_URL_UNRECOGNIZED），不伪造解析。
 *  - 兼容性：ES8 语法（async/await，无 ?. / ?? / BigInt），纯 JS MD5（复用网易云插件
 *    沙箱对拍验证的实现，20/20 向量与 Node crypto 一致）；接口对齐仓库 standalone 插件
 *    既有实现口径（cacheControl: no-store、primaryKey、platform 反查字段、_internal 测试钩子）。
 * ================================
 */

const axios = require('axios');

// ==================== 常量 ====================

var BASE = 'https://app-a-csj.y2002.com';
var HOST = 'app-a-csj.y2002.com';
var UTOKEN = 'cYxq1CnqH%AcP#W9cgy4ozSITQ^bJTje';
var FDKEY = 'de8a88aba6bb499883a839b8c0aad3abefab41ab';
var IMG_BASE = 'https://djcsj-img.y2002.com';
var UA = 'okhttp/3.12.1';

// 公共 query（文档 §2.1，每个请求都带、参与字典序签名）
var BASE_QUERY = {
  os_type: 'android',
  os_version: '13',
  app_version: '3.1.1',
  app_code: '311',
  device_brand: 'Redmi',
  device_name: 'M2103K19C',
  deviceid: '53e249f143cef8abb04cc51e64e14147'
};

var CDN_STD = 'fd-djcsj-a-p'; // 标准档 m4a
var CDN_HIGH = 'fd-djcsj-a-o'; // 高品档 mp3（下载域 fd-djcsj-a-d 与之同文件）
var CDN_DOWN = 'fd-djcsj-a-d';

var SOURCE_TIMEOUT = 4500; // 单请求超时（宿主单方法 10s 硬上限内）
var PROBE_TIMEOUT = 3000;
var SEARCH_PAGE_SIZE = 30;
var LIST_PAGE_SIZE = 30;
var SHEET_PAGE_SIZE = 20;

var QUALITY_STD = '64k'; // 标准档（p 域 m4a，实测 ~65kbps，与 playbitrate=64 一致）
var QUALITY_HIGH = '320k'; // 高品档（o 域纯 mp3，实测 320kbps）

var NONCE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ==================== 纯 JS MD5（复用网易云插件已对拍实现） ====================
// 宿主 require 白名单无 crypto 模块，故纯 JS 实现；沙箱已对拍验证与 Node 内置 crypto
// 一致（20/20 向量通过，见 netease-v1912.js 同段注释）。语法 ES8 兼容、无 Buffer 依赖。
function utf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
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

// ==================== 签名与请求 ====================

function randomNonce(len) {
  var out = '';
  for (var i = 0; i < len; i++) {
    out += NONCE_CHARS.charAt(Math.floor(Math.random() * NONCE_CHARS.length));
  }
  return out;
}

// RFC1738 urlencode（与文档 §2.3 Python urlencode 对齐：空格 → '+'，!'()* 转义）
function encodeQueryComponent(s) {
  return encodeURIComponent(String(s))
    .replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    })
    .replace(/%20/g, '+');
}

// query 必须按键名字典序编码（业务参数 + 公共参数混合排序，文档 §7.3）
function sortedQueryString(params) {
  var keys = Object.keys(params).sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    parts.push(encodeQueryComponent(k) + '=' + encodeQueryComponent(params[k]));
  }
  return parts.join('&');
}

// 双层 MD5 请求签名（文档 §2.1）+ GET 业务 API 调用，retcode==1 才算成功
async function apiGetOnce(path, params) {
  var ts = String(Date.now());
  var nonce = randomNonce(10);
  var q = {};
  for (var bk in BASE_QUERY) q[bk] = BASE_QUERY[bk];
  if (params) {
    for (var pk in params) {
      if (params[pk] !== undefined && params[pk] !== null) q[pk] = params[pk];
    }
  }
  var qs = sortedQueryString(q);
  var canonical = 'GET ' + path + '?' + qs +
    '\nHost: ' + HOST +
    '\ntimestamp: ' + ts +
    '\nnonce: ' + nonce;
  var sign = md5Hex(UTOKEN + ':' + md5Hex(canonical));
  var res = await axios.get(BASE + path + '?' + qs, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      timestamp: ts,
      nonce: nonce,
      sign: sign,
      'User-Agent': UA
    }
  });
  var body = res.data;
  if (!body || typeof body !== 'object' || body.retcode !== 1) {
    var msg = body && body.retmsg ? body.retmsg : 'HTTP ' + res.status;
    var err = new Error('[djcsj] 接口返回异常（' + path + '）：' + msg);
    err.retcode = body ? body.retcode : undefined;
    throw err;
  }
  return body.result;
}

// 业务 API GET（双层 MD5 签名）；瞬时失败（网络错误/限频 retcode=-1）重试一次，
// 重试时重新生成 timestamp/nonce/sign——实测连发请求偶发「非法调用」限频
async function apiGet(path, params) {
  try {
    return await apiGetOnce(path, params);
  } catch (e) {
    var transient = e.retcode === -1 || /timeout|network|ECONN|EAI|socket/i.test(String(e.message));
    if (!transient) throw e;
    return await apiGetOnce(path, params);
  }
}

// CDN 防盗链签名 URL（文档 §2.2）：t = (now + 1天) 秒的小写 hex；sign = md5(FDKEY + path + t)
function cdnUrl(domain, path) {
  var t = Math.floor((Date.now() + 86400000) / 1000);
  var tHex = t.toString(16); // Number#toString(16) 输出小写
  var sign = md5Hex(FDKEY + path + tHex);
  return 'https://' + domain + '.y2002.com' + path + '?sign=' + sign + '&t=' + tHex;
}

// 高品路径变换：_mp3.m4a → .mp3（文档 §4.1 正则）
function purePath(songurl) {
  return String(songurl || '').replace(/_([a-z0-9]+)\.m4a$/, '.$1');
}

function imgUrl(path) {
  return IMG_BASE + String(path || '');
}

// Range 0-0 探测文件总大小（GET Range 请求，p 域 HEAD 响应慢/不稳定；
// Content-Range 优先，Content-Length 兜底；失败返回 0——fail-soft 不阻断取链）
async function probeHeadSize(url) {
  try {
    var res = await axios.get(url, {
      timeout: PROBE_TIMEOUT,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': UA, Range: 'bytes=0-0' }
    });
    var cr = res.headers['content-range'];
    if (cr) {
      var m = /\/(\d+)$/.exec(String(cr));
      if (m) return parseInt(m[1], 10);
    }
    var cl = parseInt(res.headers['content-length'], 10);
    return isNaN(cl) ? 0 : cl;
  } catch (e) {
    return 0;
  }
}

// ==================== 音质映射 ====================

// 档位键按 PlayInfo 实测码率分桶（宁低勿高；PlayInfo 失败按平台标称 320 处理）
function bucketKey(brKbps) {
  if (brKbps >= 256) return '320k';
  if (brKbps >= 160) return '192k';
  if (brKbps >= 112) return '128k';
  return '64k';
}

// normalizeQuality：请求哪个音质就获取哪个音质；平台仅 mp3，无损档入口即拒不降级
// （'128k'/'192k' 请求升档交付真实 320k mp3 并如实标 '320k'，64k 拒付——不降级口径）
function normalizeQuality(quality) {
  var q = String(quality || '320k').toLowerCase();
  if (q === '64k' || q === 'low' || q === 'standard') return QUALITY_STD;
  if (q === '128k' || q === '192k' || q === '320k' || q === 'high' || q === 'super') return QUALITY_HIGH;
  throw new Error('[djcsj] 平台仅提供 mp3 两档（64k 标准 / 320k 高品），不支持音质档：' + quality);
}

// 列表条目 qualities：64k 档恒可用（URL 派生）；bitrate/filesize 为 0 时（搜索/曲库实测均 0）
// 320k 档不带 size，取链/getMusicInfo 时由 PlayInfo 补全（文档 §7.2 坑）
function qualitiesOf(song) {
  var br = Number(song.bitrate) || 0;
  var fs = Number(song.filesize) || 0;
  var out = {};
  out[QUALITY_STD] = { bitrate: 64000 };
  if (br > 0) {
    var e = { bitrate: br * 1000 };
    if (fs > 0) e.size = fs;
    out[bucketKey(br)] = e;
  } else {
    out[QUALITY_HIGH] = {};
  }
  return out;
}

// ==================== 条目映射 ====================

// 歌曲对象无封面字段（文档 §6.7 坑）：artwork 用上传者 avatar 代替；duration 列表接口
// 为毫秒（实测搜索结果现带 duration），转秒；bitrate/filesize 为 0 不伪造。
function buildMusicItem(song) {
  if (!song || song.id === undefined || song.id === null) return null;
  if (!song.songurl) return null;
  var durMs = Number(song.duration) || 0;
  var item = {
    id: String(song.id),
    platform: 'djcsj',
    title: String(song.songname || '').trim() || ('DJ串烧 #' + song.id),
    artist: String(song.nickname || '').trim() || '未知音乐人',
    artwork: song.avatar ? imgUrl(song.avatar) : undefined,
    duration: durMs > 0 ? Math.round(durMs / 1000) : undefined,
    // 汽水同款口径：无 MV 通道，显式置 is_video=false 走宿主「无 MV」守卫
    is_video: false,
    // 播放取链依赖字段（可序列化，随条目存储）：songurl=CDN 相对路径、ownerid=上传者
    songurl: String(song.songurl),
    ownerid: Number(song.ownerid) || 0
  };
  item.qualities = qualitiesOf(song);
  return item;
}

// 歌单条目：复合键 sheetId|userId（Sheet/Detail 与 Sheet/MusicList 都需双参，文档 §7.10）
function buildSheetItem(sheet) {
  if (!sheet || sheet.id === undefined || sheet.userid === undefined) return null;
  var item = {
    id: sheet.id + '|' + sheet.userid,
    platform: 'djcsj',
    title: String(sheet.sheetname || '').trim() || ('歌单 #' + sheet.id),
    artist: String(sheet.nickname || '').trim() || '未知创建者',
    artwork: sheet.cover ? imgUrl(sheet.cover) : undefined,
    worksNum: Number(sheet.musiccounts) || 0
  };
  return item;
}

function datalistOf(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.datalist)) return result.datalist;
  return [];
}

// ==================== 搜索 ====================

async function searchImpl(keyword, page) {
  var p = Math.max(1, parseInt(page, 10) || 1);
  var result = await apiGet('/api/Music/SearchWithWord', {
    keyWords: keyword,
    SortWay: 1002,
    Pi: p,
    Pz: SEARCH_PAGE_SIZE,
    filter: 1
  });
  var raw = datalistOf(result);
  var data = [];
  for (var i = 0; i < raw.length; i++) {
    var it = buildMusicItem(raw[i]);
    if (it) data.push(it);
  }
  return { isEnd: raw.length < SEARCH_PAGE_SIZE, data: data };
}

// ==================== 播放详情 / 取链 ====================

// PlayInfo 补全 bitrate/filesize（musicId 用歌曲 id 非 mediaid，文档 §7.1 坑）。
// fail-soft：详情补齐失败不阻断播放（CDN URL 本身可构造）。
async function fetchPlayInfo(musicItem) {
  try {
    return await apiGet('/api/Music/PlayInfo', {
      musicId: Number(musicItem.id),
      ownerId: Number(musicItem.ownerid) || 0
    });
  } catch (e) {
    return null;
  }
}

async function getMusicInfoImpl(musicItem) {
  if (!musicItem || musicItem.id === undefined) throw new Error('[djcsj] missing musicItem');
  var out = Object.assign({}, musicItem);
  var info = await fetchPlayInfo(musicItem);
  if (info && typeof info === 'object') {
    var br = Number(info.bitrate) || 0;
    var fs = Number(info.filesize) || 0;
    if (br > 0 || fs > 0) {
      var quals = {};
      for (var k in (musicItem.qualities || {})) quals[k] = musicItem.qualities[k];
      var hi = {};
      if (br > 0) hi.bitrate = br * 1000;
      if (fs > 0) hi.size = fs;
      quals[bucketKey(br > 0 ? br : 320)] = hi;
      out.qualities = quals;
    }
    // PlayInfo 无 duration/songname 字段（文档 §3.5 实测响应），不伪造补齐
  }
  return out;
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem || musicItem.id === undefined) throw new Error('[djcsj] missing musicItem');
  var songurl = String(musicItem.songurl || '');
  if (!songurl) throw new Error('[djcsj] 条目缺少播放路径（songurl），请重新搜索或刷新列表');
  var q = normalizeQuality(quality);

  // 标准档：p 域 + songurl 原样（m4a 封装）；size 用 Range 探测补齐（fail-soft）
  if (q === QUALITY_STD) {
    var url = cdnUrl(CDN_STD, songurl);
    var r = { url: url, quality: QUALITY_STD, actualQuality: QUALITY_STD, bitrate: 64000 };
    var sz = await probeHeadSize(url);
    if (sz > 0) r.size = sz;
    return r;
  }

  // 高品档：o 域 + pure_path（纯 mp3）；PlayInfo 补全 bitrate/filesize（实测 Content-Length
  // 与 PlayInfo filesize 逐字节一致，见研发自测清单），PlayInfo 失败探测兜底
  var info = await fetchPlayInfo(musicItem);
  var br = info ? (Number(info.bitrate) || 0) : 0;
  var actual = bucketKey(br > 0 ? br : 320);
  var r2 = {
    url: cdnUrl(CDN_HIGH, purePath(songurl)),
    quality: actual,
    actualQuality: actual
  };
  if (br > 0) r2.bitrate = br * 1000;
  var fs = info ? (Number(info.filesize) || 0) : 0;
  if (fs > 0) {
    r2.size = fs;
  } else {
    var sz2 = await probeHeadSize(r2.url);
    if (sz2 > 0) r2.size = sz2;
  }
  return r2;
}

// 平台无歌词接口（文档 §8：源码 getLrc 返回 null），如实返回 null，不伪造
async function getLyricImpl() {
  return null;
}

// ==================== 榜单（曲库分类 + 音乐人榜） ====================

async function getTopListsImpl() {
  var tabs = await apiGet('/api/Music/TabList', { tabType: 4 });
  var tabData = [];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    if (!t) continue;
    var tid = t.tabId !== undefined ? t.tabId : t.id; // 实测返回字段为 id/title（文档 §3.2 写 tabId/tabname，按实测兼容两种）
    if (tid === undefined) continue;
    tabData.push({
      id: 'tab_' + tid,
      title: String(t.tabname || t.title || '').trim() || ('分类 #' + tid),
      _kind: 'tab'
    });
  }
  var rank = await apiGet('/api/User/Rank', { Pi: 1, Pz: 20, flag: 1 });
  var rankList = datalistOf(rank); // 兼容数组 / {datalist} 两种返回形状
  var userData = [];
  for (var j = 0; j < rankList.length; j++) {
    var u = rankList[j];
    if (!u || u.id === undefined) continue;
    var av = u.avatar ? imgUrl(u.avatar) : '';
    userData.push({
      id: 'user_' + u.id,
      title: String(u.nickname || '').trim() || ('音乐人 #' + u.id),
      // 宿主 topListItem.tsx 渲染榜单封面只读 coverImg，artwork 双写兼容（qishui 口径）
      coverImg: av,
      artwork: av,
      description: Number(u.rq) > 0 ? ('热度 ' + u.rq) : undefined,
      _kind: 'user'
    });
  }
  var groups = [];
  if (tabData.length) groups.push({ title: '曲库分类', data: tabData });
  if (userData.length) groups.push({ title: '音乐人榜', data: userData });
  return groups;
}

async function getTopListDetailImpl(topListItem, page) {
  var tid = String((topListItem && topListItem.id) || '');
  var p = Math.max(1, parseInt(page, 10) || 1);
  var raw;
  if (tid.indexOf('tab_') === 0) {
    raw = await apiGet('/api/Music/ListByFilter', {
      tabId: Number(tid.slice(4)),
      year: 0,
      month: 0,
      quality: 0,
      sortway: 1002,
      Pi: p,
      Pz: LIST_PAGE_SIZE
    });
  } else if (tid.indexOf('user_') === 0) {
    raw = await apiGet('/api/Music/List', {
      userId: Number(tid.slice(5)),
      Pi: p,
      Pz: LIST_PAGE_SIZE
    });
  } else {
    throw new Error('[djcsj] 未知榜单：' + tid);
  }
  var list = datalistOf(raw);
  var musicList = [];
  for (var i = 0; i < list.length; i++) {
    var it = buildMusicItem(list[i]);
    if (it) musicList.push(it);
  }
  return Object.assign({}, topListItem, {
    isEnd: list.length < LIST_PAGE_SIZE,
    musicList: musicList
  });
}

// ==================== 歌单 ====================

// 推荐歌单分类：平台无歌单标签接口，固定一个「热门歌单」入口（RankList 全量）
async function getRecommendSheetTagsImpl() {
  return {
    data: [],
    pinned: [{ id: 'hot', title: '热门歌单' }]
  };
}

async function getRecommendSheetsByTagImpl(tag, page) {
  var p = Math.max(1, parseInt(page, 10) || 1);
  var result = await apiGet('/api/Sheet/RankList', { Pi: p, Pz: SHEET_PAGE_SIZE });
  var raw = Array.isArray(result) ? result : [];
  var data = [];
  for (var i = 0; i < raw.length; i++) {
    var it = buildSheetItem(raw[i]);
    if (it) data.push(it);
  }
  return { isEnd: raw.length < SHEET_PAGE_SIZE, data: data };
}

async function getMusicSheetInfoImpl(sheetItem, page) {
  var rawId = String((sheetItem && sheetItem.id) || '');
  var sep = rawId.indexOf('|');
  if (sep < 0) throw new Error('[djcsj] 歌单条目缺少复合键（sheetId|userId）');
  var sheetId = Number(rawId.slice(0, sep));
  var userId = Number(rawId.slice(sep + 1));
  if (!sheetId || !userId) throw new Error('[djcsj] 歌单复合键解析失败：' + rawId);
  var p = Math.max(1, parseInt(page, 10) || 1);
  var result = await apiGet('/api/Sheet/MusicList', {
    sheetId: sheetId,
    userId: userId,
    Pi: p,
    Pz: LIST_PAGE_SIZE
  });
  var list = datalistOf(result);
  var musicList = [];
  for (var i = 0; i < list.length; i++) {
    var it = buildMusicItem(list[i]);
    if (it) musicList.push(it);
  }
  return Object.assign({}, sheetItem, {
    isEnd: list.length < LIST_PAGE_SIZE,
    musicList: musicList
  });
}

// 平台无网页版/分享链接入口（文档 §8 全接口清单无对应能力），如实拒绝、不伪造解析
async function importMusicSheetImpl() {
  var err = new Error('[djcsj] DJ串烧集暂不支持歌单链接导入（平台无网页版/分享链接接口）');
  err.code = 'SHEET_URL_UNRECOGNIZED';
  throw err;
}

// ==================== 插件定义 ====================

var plugin = {
  name: 'DJ串烧集',
  platform: 'djcsj',
  version: '1.0.0',
  author: '研发3号',
  description: 'DJ串烧集独立源插件 v1.0.0（首发版）：Y2002 blueocean 系 DJ 串烧平台（com.blueocean.extensionfour v3.1.1）全接口免登录接入——搜索/曲库分类 12 类/音乐人榜/歌单/音乐人作品；业务 API 双层 MD5 请求签名（query 字典序）+ CDN 防盗链签名（t=+1天 hex、sign=md5(FDKEY+path+t)）；音质两档纯 URL 派生：64k 标准（p 域 m4a，实测 ~65kbps 如实标注）与 320k 高品（o 域纯 mp3，实测 320kbps、大小与 PlayInfo filesize 一致），平台仅 mp3 无无损、无损档入口即拒不降级；搜索/列表 bitrate/filesize 为 0 时经 PlayInfo（musicId 用歌曲 id）补全；歌曲无封面字段用上传者 avatar 代替；平台无歌词接口、getLyric 如实返回 null。',
  // 宿主 mediameta 存储约定（对齐六插件口径）
  primaryKey: ['id'],
  supportedSearchType: ['music'],
  supportedQualities: ['64k', '320k'],
  cacheControl: 'no-store', // CDN 链接带 +1 天时效防盗链签名，必须现取
  userVariables: [],
  hints: {
    search: ['检索 DJ串烧集曲库（车载/串烧/喊麦/空灵鼓等 12 大分类，DJ 音乐人上传）', '播放音质两档：64k 标准（m4a）与 320k 高品（mp3）；平台仅 mp3 无无损档', '歌曲封面为上传者头像（平台不提供歌曲封面）'],
    importMusicSheet: [
      'DJ串烧集暂不支持歌单链接导入（平台无网页版/分享链接接口）',
      '可在「首页-歌单」浏览并收藏热门歌单'
    ]
  },

  async search(query, page, type) {
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    if (type !== undefined && type !== null && type !== '' && type !== 'music') {
      return { isEnd: true, data: [] }; // 平台仅歌曲维度（无专辑/歌手/歌单搜索接口）
    }
    return searchImpl(kw, page);
  },

  async getMediaSource(musicItem, quality) {
    return getMediaSourceImpl(musicItem, quality);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  async getRecommendSheetTags() {
    return getRecommendSheetTagsImpl();
  },

  async getRecommendSheetsByTag(tagItem, page) {
    return getRecommendSheetsByTagImpl(tagItem, page);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  // ===== 以下为内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    md5Hex: md5Hex,
    utf8Bytes: utf8Bytes,
    sortedQueryString: sortedQueryString,
    encodeQueryComponent: encodeQueryComponent,
    cdnUrl: cdnUrl,
    purePath: purePath,
    imgUrl: imgUrl,
    apiGet: apiGet,
    normalizeQuality: normalizeQuality,
    bucketKey: bucketKey,
    qualitiesOf: qualitiesOf,
    buildMusicItem: buildMusicItem,
    buildSheetItem: buildSheetItem,
    searchImpl: searchImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getMediaSourceImpl: getMediaSourceImpl,
    getLyricImpl: getLyricImpl,
    getTopListsImpl: getTopListsImpl,
    getTopListDetailImpl: getTopListDetailImpl,
    getRecommendSheetTagsImpl: getRecommendSheetTagsImpl,
    getRecommendSheetsByTagImpl: getRecommendSheetsByTagImpl,
    getMusicSheetInfoImpl: getMusicSheetInfoImpl,
    importMusicSheetImpl: importMusicSheetImpl,
    probeHeadSize: probeHeadSize,
    CONSTANTS: {
      BASE: BASE,
      HOST: HOST,
      UTOKEN: UTOKEN,
      FDKEY: FDKEY,
      CDN_STD: CDN_STD,
      CDN_HIGH: CDN_HIGH,
      CDN_DOWN: CDN_DOWN,
      QUALITY_STD: QUALITY_STD,
      QUALITY_HIGH: QUALITY_HIGH
    }
  }
};

module.exports = plugin;
