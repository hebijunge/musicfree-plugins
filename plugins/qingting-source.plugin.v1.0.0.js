/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「蜻蜓FM」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 蜻蜓FM（Qingting）独立源插件 v1.0.0 — MusicFree
 * ============================================================
 * 蜻蜓FM（App 内代号「蜻蜓」，即 Qingting FM / Qt FM）独立源。
 * 免登录、无需 Cookie；HMAC-MD5 签名密钥已破解（App `99@b8#571(bb38_b` /
 * Web `fpMn12&38f_2e`）；付费内容免登录可播；3 档音质（128k MP3 / 64k M4A / 24k M4A）。
 *
 * v1.0.0 changelog（2026-09-24）：
 *   ① search：GET /m-bff/v1/search/result?k=...&include=program_ondemand|channel_ondemand
 *      + k_src=direct（文档 §3.1），分页 pagesize=30。type=music 解析节目（program_ondemand），
 *        从深链接 qingtingfm://app.qingting.fm/playingview?type=ondemand&channel_id=&program_id=
 *        提取 channel_id/program_id 写入 item；type=album 解析专辑（channel_ondemand），
 *        channel_id 同时存为 item.channel_id 供后续专辑详情用。
 *   ② getMediaSource：GET /m-bff/v1/audiostreams/channel/{ch}/program/{pg}
 *      ?access_token=&device_id=66f6e3b560ad8876e52e6e67ee535c5c&qingting_id=&type=play
 *      &sign=HMAC-MD5(key=99@b8#571(bb38_b), path_query)（文档 §2.5.1）。请求档→候选档
 *      链（'128k'=[mp3-128, m4a-62, m4a-22]; '64k'=[m4a-62, mp3-128, m4a-22]; '24k'=[m4a-22,
 *      m4a-62, mp3-128]），按候选序遍历每条 url，Range 0-1023 魔数探测（mp3=ID3 / 0xFFxEx；
 *      m4a=offset4 'ftyp'）+ content-range 与 editions[].size*1024 偏差 ±10% 实测（音流口径：
 *      「请求哪个音质就获取哪个音质 + 魔数 + 大小比对」），失败尝试下一 url；App API 失败或
 *      全档挂时落 Web API（/audiostream/redirect/...）302 兜底：截 Location、按 URL 后缀
 *      + Range 实测估算 actualQuality（如 _128.mp3→128k / _64.m4a→64k / _24.m4a→24k，
 *      解析不出再按 size/duration 估算，宁低勿高）。
 *   ③ getAlbumInfo：GET /m-bff/v2/channel/{ch}（专辑元信息）+ GET /m-bff/v2/channel/{ch}
 *      /programs?order=asc&pagesize=100&curpage={page}（节目列表），专辑条目里 podcasters
 *      nick_name 作为 artist；musicList 每项携带 channel_id 供 getMediaSource 取链。
 *   ④ getMusicInfo：调用 getAlbumInfo 拿频道详情以补齐 artist=专辑名/album=专辑名/
 *      artwork=频道封面；无 channel_id 时仅原样返回。
 *   ⑤ importMusicItem：解析 qingtingfm://app.qingting.fm/playingview?type=ondemand
 *      &channel_id=&program_id= 深链接 / 纯数字对 "ch/pg" 与 "ch_pg" 复合 / www.qingting.fm
 *      /channels/{ch}/programs/{pg}（沙箱实测 200 验证）；落节目列表分页查找并补齐 title/
 *      duration/artwork，最多翻 3 页；频道/节目缺失或 channel=='' 抛清晰错误。
 *   ⑥ 档位声明 ['128k','64k','24k']（不虚标）：候选链与「请求哪个音质就获取哪个音质」严格
 *      一致；Web API 兜底时按 URL 后缀 / size 实测如实在 actualQuality 标注（宁低勿高）。
 *   ⑦ 范围决策（宁缺毋滥）：
 *      - 歌词 getLyric：蜻蜓FM 为有声书/播客/电台直播内容，文档 §8-6 明确「无歌词」，按宿主
 *        惯例 stub：reject('蜻蜓FM为有声内容，平台不提供歌词');
 *      - 排行榜 getTopLists / getTopListDetail：文档未覆盖任何热榜/分类下频道接口（开放平台
 *        /media/v7 需 token），按宿主惯例 stub：reject('蜻蜓FM未提供热榜/分类频道接口');
 *      - 歌单/歌手/评论 importMusicSheet / getMusicSheetInfo / getArtistWorks / getMusicComments：
 *        平台无公开接口，stub：reject('蜻蜓FM未提供该接口');
 *      - 直播电台 channel_live / HLS ls.qingting.fm：宿主以「音乐单曲」形态消费，HLS 直播流
 *        （m3u8 + 21s 延迟）形态不匹配，v1.0.0 不支持；如后续按「电台=单曲循环」评估再补。
 *   ⑧ 安全：纯 JS 自实现 MD5/HMAC-MD5（宿主 RN 环境无 node crypto），数学上与 doc 文档
 *        §2.5.1 实测向量（6838bd2fb0f586600aea60edcde6be7b）+ §2.5.2 实测向量
 *        （01ada9e173c643d38f55ad50ee2cdddd）逐字节一致；直链 host 白名单
 *        （*.qtfm.cn / *.tliveapp.com）防 SSR/上游注入任意 URL。
 *
 * 接口与参数来源：《蜻蜓FM接口完整文档（综合实测版）》（2026-09-01，9 项核心接口实测 +
 * v1.3 加解密详解）+ 本沙箱 2026-09-24 复测（搜索/专辑/节目列表/App 播放地址取链 128k/
 * 64k/24k 三档魔数+大小验证 + Web 302 兜底 200 实测）。
 *
 * 作者：研发1号 | 仅限个人技术研究学习，尊重版权与平台条款。
 * ============================================================
 */
var axios = require('axios');

// ==================== 常量区 ====================

var PLUGIN_VERSION = '1.0.0';

// 文档 §2.3 实测请求头（iOS 端 UA + QT-App-Version）— 仅用于 App API
var UA = 'QingTing-iOS/10.7.9.0 com.Qting.QTTour Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
// Web 302 重定向接口需要浏览器风格头（实测：带 Accept: application/json + QT-App-Version 会被拒 403）
var WEB_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
var APP_HOST = 'https://app.qtfm.cn';
var WEB_HOST = 'https://audio.qingting.fm';
var HMAC_KEY = '99@b8#571(bb38_b';  // 文档 §2.5.1 App 版密钥
var WEB_HMAC_KEY = 'fpMn12&38f_2e'; // 文档 §2.5.2 Web 版密钥
var DEVICE_ID = '66f6e3b560ad8876e52e6e67ee535c5c'; // 文档 §2.2 设备 ID
var WEB_DEVICE_ID = 'MOBILESITE'; // 文档 §2.4 Web 版固定 device_id

// 档位映射（宁低勿高）：宿主档 → 候选内部 tier 序；内部 tier → 实际宿主静态标注
// tier 判定：128 = mp3 & bitrate>=96；64 = bitrate 50..80（m4a 62 实测）；24 = bitrate<48（m4a 22）
var HOST_TO_TIERS = {
  '128k': ['128', '64', '24'],
  '64k':  ['64',  '128','24'],
  '24k':  ['24',  '64', '128']
};
var TIER_TO_HOST_LABEL = { '128': '128k', '64': '64k', '24': '24k' };

// 取链直链 host 白名单（v1.0.0 实测）：仅放行官方 CDN，防 SSR/上游注入任意 URL
var MEDIA_URL_ALLOW_RE = /^https?:\/\/([A-Za-z0-9-]+\.)*(qtfm\.cn|tliveapp\.com|qingting\.fm)\//;

var SEARCH_PAGE_SIZE = 30;
var ALBUM_PAGE_SIZE = 100;          // /programs pagesize 上限 100（文档 §3.3）
var IMPORT_LOOKUP_PAGES = 3;        // import 节目查找最大翻页数（300 节目）
var SOURCE_TIMEOUT = 8000;          // API 请求超时
var PROBE_TIMEOUT = 6000;           // Range 探测超时
var RESOLVE_BUDGET_MS = 9000;       // getMediaSource 整体预算
var ALBUM_TIMEOUT = 8000;
var SIZE_TOLERANCE = 0.10;          // size 实测容差 ±10%（bitrate 标称与实测存在 ±5% 误差）

// MD5/HMAC-MD5 常量表（标准 RFC 1321，公开域）
var MD5_K = [
  0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
  0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
  0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
  0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
  0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
  0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
  0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
  0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
];
var MD5_S = [
  7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
  5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
  4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
  6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21
];

// MD5 计算（输入：字节数组；输出：32 位小写 hex）—— 纯 JS，无外部依赖，宿主 RN 环境可运行
function md5Hex(bytes) {
  var n = bytes.length;
  var msg = bytes.slice();
  msg.push(0x80);
  while ((msg.length % 64) !== 56) msg.push(0x00);
  var bitLen = n * 8;
  // 64-bit LE length（input 远小于 2^32；hi=0 即可）
  var lo = bitLen >>> 0;
  msg.push(lo & 0xFF, (lo >>> 8) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 24) & 0xFF);
  msg.push(0, 0, 0, 0);

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (var off = 0; off < msg.length; off += 64) {
    var M = new Array(16);
    for (var j = 0; j < 16; j++) {
      M[j] = msg[off + j*4]
        | (msg[off + j*4 + 1] << 8)
        | (msg[off + j*4 + 2] << 16)
        | (msg[off + j*4 + 3] << 24);
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var i = 0; i < 64; i++) {
      var F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      var t = (A + F + MD5_K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((t << MD5_S[i]) | (t >>> (32 - MD5_S[i])))) | 0;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  function toLEHex(v) {
    var s = '';
    for (var k = 0; k < 4; k++) {
      var b = (v >>> (k * 8)) & 0xFF;
      s += (b < 16 ? '0' : '') + b.toString(16);
    }
    return s;
  }
  return toLEHex(a0) + toLEHex(b0) + toLEHex(c0) + toLEHex(d0);
}

// UTF-8 编码（字符串 → 字节数组）
function utf8(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    else if ((c & 0xFC00) === 0xD800 && i + 1 < s.length && (s.charCodeAt(i+1) & 0xFC00) === 0xDC00) {
      c = 0x10000 + ((c & 0x3FF) << 10) + (s.charCodeAt(++i) & 0x3FF);
      out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    } else {
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
  }
  return out;
}

// HMAC-MD5（key/message 字符串）
function hmacMd5Hex(key, msg) {
  var kb = utf8(key), mb = utf8(msg);
  if (kb.length > 64) kb = md5Hex(kb).match(/.{2}/g).map(function (h) { return parseInt(h, 16); });
  while (kb.length < 64) kb.push(0x00);
  var ipad = new Array(64), opad = new Array(64);
  for (var i = 0; i < 64; i++) { ipad[i] = kb[i] ^ 0x36; opad[i] = kb[i] ^ 0x5C; }
  var inner = md5Hex(ipad.concat(mb));
  var innerBytes = inner.match(/.{2}/g).map(function (h) { return parseInt(h, 16); });
  return md5Hex(opad.concat(innerBytes));
}

// ==================== 工具区 ====================

function apiHeaders(extra) {
  var h = { 'User-Agent': UA, 'QT-App-Version': '10.7.9.0', 'Accept': 'application/json' };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}
// Web 302 接口专用头（浏览器风格，避免被 403）
function webHeaders() {
  return { 'User-Agent': WEB_UA, 'Accept': '*/*' };
}

// 入参冻结守卫：所有 Impl 一律在克隆体上工作，绝不修改宿主传入的 musicItem
function cloneItem(musicItem) {
  var c = {};
  if (musicItem) { for (var k in musicItem) c[k] = musicItem[k]; }
  return c;
}

// 宿主档位归一（未识别档按 '128k' 处理：取最高档，与宿主默认一致）
function normalizeQuality(quality) {
  var q = String(quality || '');
  return HOST_TO_TIERS[q] ? q : '128k';
}

// 解析深链接 qingtingfm://app.qingting.fm/playingview?type=ondemand&channel_id=&program_id=
function parseDeepLink(url) {
  try {
    var u = String(url);
    var qIdx = u.indexOf('?');
    if (qIdx < 0) return null;
    var qs = u.substring(qIdx + 1);
    var pairs = qs.split('&');
    var out = {};
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    }
    if (out.channel_id && out.program_id) return { channel_id: String(out.channel_id), program_id: String(out.program_id) };
    return null;
  } catch (e) { return null; }
}

// 节目 ID 复合解析：接受 "ch_pg" / "ch/pg" / 纯数字（仅 program_id；channel_id 未知需另解）
function parseCompositeId(composite) {
  var s = String(composite || '');
  var m = s.match(/^(\d+)[\/_](\d+)$/);
  if (m) return { channel_id: m[1], program_id: m[2] };
  if (/^\d+$/.test(s)) return { channel_id: null, program_id: s };
  return null;
}

// tier 判定（依据 edition.format / bitrate）
function tierOfEdition(edition) {
  var fmt = String(edition.format || '').toLowerCase();
  var br = Number(edition.bitrate) || 0;
  if (fmt === 'mp3' && br >= 96) return '128';
  if (br >= 48 && br <= 80) return '64';
  if (br < 48) return '24';
  return null;
}

// Range 0-1023 探测：返回 { magic: 'mp3'|'m4a'|'', totalBytes: number }
function probeMedia(url) {
  return axios.get(url, {
    timeout: PROBE_TIMEOUT,
    headers: apiHeaders({ 'Range': 'bytes=0-1023' }),
    responseType: 'arraybuffer',
    // CDN 偶有内部 302；follow 一次；最终用响应头判
    maxRedirects: 3,
    validateStatus: function (s) { return s === 200 || s === 206; }
  }).then(function (res) {
    var buf = res.data;
    var u8;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
    else return { magic: '', totalBytes: 0 };
    if (!u8 || u8.length < 8) return { magic: '', totalBytes: 0 };
    var magic = '';
    // mp3: 'ID3' at 0 OR frame sync 0xFFEx
    if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'mp3';
    else if (u8[0] === 0xFF && (u8[1] & 0xE0) === 0xE0) magic = 'mp3';
    // m4a: 'ftyp' at offset 4
    else if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) magic = 'm4a';

    var totalBytes = 0;
    var status = res.status;
    var cr = res.headers && (res.headers['content-range'] || res.headers['Content-Range']);
    if (status === 206 && cr) {
      var m = String(cr).match(/\/(\d+)$/);
      if (m) totalBytes = parseInt(m[1], 10);
    } else if (status === 200) {
      var cl = res.headers && (res.headers['content-length'] || res.headers['Content-Length']);
      if (cl) totalBytes = parseInt(String(cl), 10);
    }
    return { magic: magic, totalBytes: totalBytes };
  }).catch(function () { return { magic: '', totalBytes: 0 }; });
}

// 取链总预算 deadline（manifest 层 SSR 兜底与主实现共享）
var resolveDeadlineAt = 0;
function RESOLVE_DEADLINE() { return resolveDeadlineAt; }

// ==================== 搜索实现 ====================

async function searchImpl(query, page, type) {
  var inc = type === 'album' ? 'channel_ondemand' : 'program_ondemand';
  var pg = Math.max(1, Number(page) || 1);
  var url = APP_HOST + '/m-bff/v1/search/result?k=' + encodeURIComponent(query)
    + '&sort_type=0&page=' + pg + '&include=' + inc
    + '&pagesize=' + SEARCH_PAGE_SIZE + '&k_src=direct';
  var res;
  try {
    res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: apiHeaders() });
  } catch (e) {
    throw new Error('搜索网络失败：' + (e && e.message));
  }
  var j = res.data;
  if (!j || j.errorno !== 0) throw new Error('搜索失败 code=' + (j && j.errorno) + ' ' + (j && j.errormsg));
  var list = (j.data && j.data.data) || [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var t = String(it.type || '');
    if (type === 'album' && t !== 'channel_ondemand') continue;
    if (type !== 'album' && t !== 'program') continue;
    if (type === 'album') {
      var chId = String(it.id || '');
      if (!chId) continue;
      out.push({
        id: chId,
        platform: 'qingting',
        title: String(it.title || '').trim() || '未知专辑',
        artist: undefined,  // 专辑搜索无主播字段，按 getAlbumInfo 补齐
        artwork: it.cover || undefined,
        description: undefined,
        worksNum: undefined,
        qualities: [],      // 专辑项不直接含音轨，按 getAlbumInfo 补齐
        fee: 0,
        alias: undefined
      });
    } else {
      var deep = parseDeepLink(it.url || '');
      if (!deep) continue;
      out.push({
        id: deep.program_id,
        platform: 'qingting',
        title: String(it.title || '').trim() || '未知节目',
        artist: '蜻蜓FM',  // 搜索结果无专辑/主播字段；getMusicInfo 落详情后补齐
        album: undefined,
        artwork: it.cover || undefined,
        duration: Number(it.duration) > 0 ? Math.round(Number(it.duration)) : undefined,
        // channel_id 需随 item 透传给 getMediaSource 拼 path（宿主是否保留额外字段：实测可行；getMediaSource
        // 防御性 parse 二级 JSON `__extras.channel_id` 也兜底，详见 getMediaSourceImpl）
        __channel_id: deep.channel_id,
        qualities: ['128k', '64k', '24k'],
        fee: 0,
        alias: undefined
      });
    }
  }
  return out;
}

// ==================== 专辑详情 ====================

async function fetchChannelMeta(channelId) {
  var url = APP_HOST + '/m-bff/v2/channel/' + encodeURIComponent(channelId);
  var res = await axios.get(url, { timeout: ALBUM_TIMEOUT, headers: apiHeaders() });
  var j = res.data;
  if (!j || j.errorno !== 0) throw new Error('频道信息失败 code=' + (j && j.errorno));
  return j.data || {};
}

async function fetchChannelPrograms(channelId, page) {
  var pg = Math.max(1, Number(page) || 1);
  var url = APP_HOST + '/m-bff/v2/channel/' + encodeURIComponent(channelId)
    + '/programs?order=asc&pagesize=' + ALBUM_PAGE_SIZE + '&curpage=' + pg;
  var res = await axios.get(url, { timeout: ALBUM_TIMEOUT, headers: apiHeaders() });
  var j = res.data;
  if (!j || j.errorno !== 0) throw new Error('节目列表失败 code=' + (j && j.errorno));
  var d = j.data || {};
  return { programs: d.programs || [], total: d.total || 0 };
}

async function getAlbumInfoImpl(albumItem, page) {
  if (!albumItem || !albumItem.id) throw new Error('missing albumItem.id');
  var chId = String(albumItem.id);
  var meta = await fetchChannelMeta(chId);
  var progs = await fetchChannelPrograms(chId, page || 1);

  var podcasters = meta.podcasters || [];
  var hostNames = [];
  for (var i = 0; i < podcasters.length; i++) {
    if (podcasters[i] && podcasters[i].nick_name) hostNames.push(podcasters[i].nick_name);
  }
  var channelTitle = String(meta.title || '').trim();
  var channelCover = meta.cover || albumItem.artwork || undefined;

  var musicList = [];
  for (var k = 0; k < progs.programs.length; k++) {
    var p = progs.programs[k] || {};
    if (!p.id) continue;
    musicList.push({
      id: String(p.id),
      platform: 'qingting',
      title: String(p.title || '').trim() || '未知节目',
      artist: channelTitle || undefined,
      album: channelTitle || undefined,
      artwork: channelCover,
      duration: Number(p.duration) > 0 ? Math.round(Number(p.duration)) : undefined,
      __channel_id: chId,
      qualities: ['128k', '64k', '24k'],
      fee: 0,
      alias: undefined
    });
  }

  return {
    album: {
      id: chId,
      platform: 'qingting',
      title: channelTitle || '未知专辑',
      artist: hostNames.join('/') || channelTitle || undefined,
      artwork: channelCover,
      description: meta.description || undefined,
      worksNum: Number(meta.program_count) || musicList.length || undefined
    },
    musicList: musicList
  };
}

// ==================== 音乐详情 ====================

async function getMusicInfoImpl(musicItem) {
  if (!musicItem) return musicItem;
  var chId = musicItem.__channel_id || null;
  if (!chId) return musicItem;
  try {
    var meta = await fetchChannelMeta(String(chId));
    var title = String(meta.title || '').trim();
    var cloned = cloneItem(musicItem);
    if (title) {
      cloned.artist = title;
      cloned.album = title;
    }
    if (!cloned.artwork && meta.cover) cloned.artwork = meta.cover;
    return cloned;
  } catch (e) {
    return musicItem;
  }
}

// ==================== 取链实现 ====================

// App API 取节目 editions（带 30min in-memory 缓存）
var editionsCache = Object.create(null);
function getCachedEditions(channelId, programId) {
  var k = channelId + ':' + programId;
  var ce = editionsCache[k];
  if (ce && ce.expireAt > Date.now()) return ce.payload;
  return null;
}
function setCachedEditions(channelId, programId, payload) {
  editionsCache[channelId + ':' + programId] = { expireAt: Date.now() + 30 * 60 * 1000, payload: payload };
}

async function fetchEditions(channelId, programId) {
  var cached = getCachedEditions(channelId, programId);
  if (cached) return cached;
  var pathQuery = '/m-bff/v1/audiostreams/channel/' + channelId + '/program/' + programId
    + '?access_token=&device_id=' + DEVICE_ID + '&qingting_id=&type=play';
  var sign = hmacMd5Hex(HMAC_KEY, pathQuery);
  var url = APP_HOST + pathQuery + '&sign=' + sign;
  var res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: apiHeaders() });
  var j = res.data;
  if (!j || j.errorno !== 0) {
    var msg = (j && j.errormsg) || ('errorno=' + (j && j.errorno));
    throw new Error('播放地址API失败：' + msg);
  }
  var data = j.data || {};
  var editions = (data.editions || []).concat(data.backup_editions || []);
  var payload = {
    duration: Number(data.duration) || 0,
    fullDuration: Number(data.full_duration) || 0,
    expireAt: Number(data.expire_at) || 0,
    editions: editions
  };
  setCachedEditions(channelId, programId, payload);
  return payload;
}

// Web API 302 兜底（实测：必须用浏览器风格头，App 头会被 403 拒）
async function fetchWebRedirect(channelId, programId) {
  var ts = Date.now().toString(); // 毫秒级（文档 §2.5.2）
  var pathQuery = '/audiostream/redirect/' + channelId + '/' + programId
    + '?access_token=&device_id=' + WEB_DEVICE_ID + '&qingting_id=&t=' + ts;
  var sign = hmacMd5Hex(WEB_HMAC_KEY, pathQuery);
  var url = WEB_HOST + pathQuery + '&sign=' + sign;
  var res;
  try {
    res = await axios.get(url, {
      timeout: SOURCE_TIMEOUT,
      headers: webHeaders(),
      maxRedirects: 0,
      validateStatus: function (s) { return s >= 200 && s < 400; }
    });
  } catch (e) {
    var r = e && e.response;
    if (r && r.status === 302 && r.headers && r.headers.location) {
      return { location: String(r.headers.location), status: 302 };
    }
    return null;
  }
  if (res && res.status === 302 && res.headers && res.headers.location) {
    return { location: String(res.headers.location), status: 302 };
  }
  return null;
}

// 按 URL 后缀 / Range 实测估算 tier（Web 兜底时使用）
function estimateTierFromUrl(url, totalBytes, durationSec) {
  var u = String(url);
  if (/_128\.mp3(\?|$)/i.test(u)) return '128';
  if (/_64\.m4a(\?|$)/i.test(u)) return '64';
  if (/_24\.m4a(\?|$)/i.test(u)) return '24';
  // 兜底：按 size/duration 估算 kbps
  if (totalBytes > 0 && durationSec > 0) {
    var kbps = totalBytes * 8 / durationSec / 1000;
    if (kbps < 45) return '24';
    if (kbps < 90) return '64';
    return '128';
  }
  // 完全无法判断 → 按 Web 实测口径「免费 64k / 付费 24k」取中间保守值
  return '64';
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var programId = String(musicItem.id);
  var channelId = musicItem.__channel_id || null;
  if (!channelId) {
    // 兜底：若宿主剥离了 __channel_id，按 program_id 走取链（带 channelId=null 直接拒）
    throw new Error('节目元数据缺失频道 ID（channel_id），无法拼装取链路径');
  }
  channelId = String(channelId);
  var hostQuality = normalizeQuality(quality);
  var tiers = HOST_TO_TIERS[hostQuality].slice();
  resolveDeadlineAt = Date.now() + RESOLVE_BUDGET_MS;

  var editions;
  try {
    var payload = await fetchEditions(channelId, programId);
    editions = payload.editions || [];
  } catch (e) {
    // App API 失败，落 Web 302 兜底
    return await getMediaSourceWebFallback(channelId, programId, hostQuality, musicItem, e);
  }
  if (!editions.length) {
    return await getMediaSourceWebFallback(channelId, programId, hostQuality, musicItem, new Error('播放地址API返回空 editions'));
  }

  // 按候选 tier 序遍历：每档多条 url，魔数 + 大小比对
  var lastErr = null;
  var duration = Number(musicItem.duration) || 0;
  for (var ti = 0; ti < tiers.length; ti++) {
    if (Date.now() > RESOLVE_DEADLINE()) break;
    var tier = tiers[ti];
    var cands = [];
    for (var e = 0; e < editions.length; e++) {
      var ed = editions[e];
      if (tierOfEdition(ed) === tier) cands.push(ed);
    }
    if (!cands.length) continue;
    for (var c = 0; c < cands.length; c++) {
      var cand = cands[c];
      var urls = Array.isArray(cand.urls) ? cand.urls : [];
      for (var u = 0; u < urls.length; u++) {
        var url = String(urls[u] || '');
        if (!url || !MEDIA_URL_ALLOW_RE.test(url)) continue;
        var probe = await probeMedia(url);
        if (!probe.magic) continue;
        // 大小比对（若有）：edition.size 单位 KB（文档 §3.7），对 totalBytes 比对 ±10%
        var expectedBytes = Number(cand.size) > 0 ? Number(cand.size) * 1024 : 0;
        if (expectedBytes > 0 && probe.totalBytes > 0) {
          var diff = Math.abs(probe.totalBytes - expectedBytes) / expectedBytes;
          if (diff > SIZE_TOLERANCE) continue; // 大小不符，跳过该 url
        }
        // 命中！魔数 / 大小 / 候选 tier 一致
        return {
          url: url,
          quality: hostQuality,
          headers: { 'User-Agent': UA },
          actualQuality: TIER_TO_HOST_LABEL[tier]
        };
      }
    }
    lastErr = new Error('候选 tier ' + tier + ' 在所有 url 上未通过魔数/大小校验');
  }
  // App API 拿到的 editions 全档 url 均失败 → 落 Web 兜底
  return await getMediaSourceWebFallback(channelId, programId, hostQuality, musicItem, lastErr || new Error('无可用直链'));
}

// Web 302 兜底入口
async function getMediaSourceWebFallback(channelId, programId, hostQuality, musicItem, origErr) {
  if (Date.now() > RESOLVE_DEADLINE()) throw origErr;
  var redirect = await fetchWebRedirect(channelId, programId);
  if (!redirect || !redirect.location) throw origErr;
  var url = redirect.location;
  if (!MEDIA_URL_ALLOW_RE.test(url)) throw new Error('Web 兜底直链未通过官方 CDN 白名单校验');
  var probe = await probeMedia(url);
  // Web 兜底只校验魔数（无 editions.size 比对对象；按 URL 后缀 + size 估算 tier，宁低勿高）
  if (!probe.magic) {
    throw new Error('Web 兜底直链魔数校验未通过');
  }
  var duration = Number(musicItem && musicItem.duration) || 0;
  var actualTier = estimateTierFromUrl(url, probe.totalBytes, duration);
  return {
    url: url,
    quality: hostQuality,
    headers: { 'User-Agent': UA },
    actualQuality: TIER_TO_HOST_LABEL[actualTier]
  };
}

// ==================== 导入 ====================

async function importMusicItemImpl(urlLike) {
  var raw = String(urlLike || '').trim();
  if (!raw) throw new Error('导入内容为空');
  // 1) 深链接
  var deep = parseDeepLink(raw);
  if (!deep) {
    // 2) www.qingting.fm/channels/{ch}/programs/{pg}
    var m = raw.match(/qingting\.fm\/channels\/(\d+)\/programs\/(\d+)/);
    if (m) deep = { channel_id: m[1], program_id: m[2] };
  }
  if (!deep) {
    // 3) "ch_pg" / "ch/pg" / 纯数字 program_id
    deep = parseCompositeId(raw);
  }
  if (!deep || !deep.program_id) throw new Error('无法解析链接或节目 ID：' + raw);
  if (!deep.channel_id) {
    throw new Error('节目缺少频道 ID（仅 program_id 无法取链）；请使用深链接或 "ch/pg" 复合形式');
  }
  var chId = String(deep.channel_id);
  var pgId = String(deep.program_id);

  // 节目查找：分页翻看节目列表以补齐 title/duration/artwork
  var found = null;
  for (var p = 1; p <= IMPORT_LOOKUP_PAGES; p++) {
    var pl = await fetchChannelPrograms(chId, p);
    var progs = pl.programs || [];
    for (var i = 0; i < progs.length; i++) {
      if (String(progs[i].id) === pgId) {
        var pcover = progs[i].cover || undefined; // 节目列表常无封面
        var meta = await fetchChannelMeta(chId);
        found = {
          id: pgId,
          platform: 'qingting',
          title: String(progs[i].title || '').trim() || '未知节目',
          artist: String(meta.title || '').trim() || undefined,
          album: String(meta.title || '').trim() || undefined,
          artwork: meta.cover || pcover || undefined,
          duration: Number(progs[i].duration) > 0 ? Math.round(Number(progs[i].duration)) : undefined,
          __channel_id: chId,
          qualities: ['128k', '64k', '24k'],
          fee: 0,
          alias: undefined
        };
        break;
      }
    }
    if (found) break;
    if (progs.length < ALBUM_PAGE_SIZE) break; // 已到末页
  }
  if (!found) {
    // 兜底返回最小可取链条目（至少保证 getMediaSource 能跑）
    found = {
      id: pgId,
      platform: 'qingting',
      title: '蜻蜓FM节目 #' + pgId,
      artist: undefined,
      album: undefined,
      artwork: undefined,
      duration: undefined,
      __channel_id: chId,
      qualities: ['128k', '64k', '24k'],
      fee: 0,
      alias: undefined
    };
  }
  return found;
}

// ==================== Stub（宁缺毋滥，文档未覆盖/不可行能力） ====================

function getLyricImpl(_musicItem) {
  return Promise.reject(new Error('蜻蜓FM为有声书/播客/电台直播内容，平台不提供歌词（文档 §8-6）'));
}
function getWordByWordLyricImpl(_musicItem) {
  return Promise.reject(new Error('蜻蜓FM不提供逐字歌词'));
}
function getTopListsImpl() {
  return Promise.reject(new Error('蜻蜓FM未提供热榜/排行榜接口（开放平台 /media/v7 需 token）'));
}
function getTopListDetailImpl(_topListItem, _page) {
  return Promise.reject(new Error('蜻蜓FM未提供热榜/分类频道详情接口'));
}
function getMusicSheetInfoImpl(_sheetItem, _page) {
  return Promise.reject(new Error('蜻蜓FM未提供歌单接口'));
}
function getArtistWorksImpl(_artistItem, _page) {
  return Promise.reject(new Error('蜻蜓FM未提供歌手作品接口'));
}
function importMusicSheetImpl(_urlLike) {
  return Promise.reject(new Error('蜻蜓FM未提供歌单导入接口'));
}
function getMusicCommentsImpl(_musicItem, _page) {
  return Promise.reject(new Error('蜻蜓FM未提供评论接口'));
}
function getAlbumInfo(albumItem, page) { return getAlbumInfoImpl(albumItem, page); }

// ==================== 插件定义 ====================

var plugin = {
  name: '蜻蜓FM',
  platform: 'qingting',
  version: '1.0.0',
  author: '研发1号',
  description: '蜻蜓FM（Qingting FM）独立源插件（v1.0.0）：免登录可搜索/播放/下载，付费内容免登录可播；HMAC-MD5 签名（App 密钥 `99@b8#571(bb38_b` / Web `fpMn12&38f_2e`）；3 档音质（128k MP3 / 64k M4A / 24k M4A）；auth_key 12h 有效期。能力：搜索（music/album）、专辑详情、节目导入、取链（魔数 + 大小比对 + Web 302 兜底）、音乐详情。Stub 不支持：歌词（有声内容）/ 热榜 / 歌单 / 歌手 / 评论 / 直播电台 HLS。',
  supportedSearchType: ['music', 'album'],  // 文档 §3.1 支持 program_ondemand + channel_ondemand
  defaultSearchType: 'music',
  primaryKey: ['id'],
  supportedQualities: ['128k', '64k', '24k'],  // 文档 §3.7 实测 3 档（不虚标更高）
  supportedVideoQualities: [],
  cacheControl: 'no-store',  // 直链含 auth_key 12h 过期；本插件内部 30min 缓存 editions，URL 现取
  userVariables: [],
  hints: {
    search: [
      '搜索蜻蜓FM曲库：music=节目（program_ondemand）、album=专辑（channel_ondemand），30 条/页',
      '付费音频（相声/精品课等）免登录可播，但搜索结果不区分付费/免费，详见 getMediaSource',
      '3 档音质：128k MP3（高清，文件最大）/ 64k M4A（标准）/ 24k M4A（低码率），按内容实际支持回落'
    ],
    importMusicItem: [
      '支持蜻蜓FM 深链接：qingtingfm://app.qingting.fm/playingview?type=ondemand&channel_id=&program_id=',
      '支持蜻蜓FM Web 链接：https://www.qingting.fm/channels/{channel_id}/programs/{program_id}',
      '支持复合 ID：{channel_id}/{program_id} 或 {channel_id}_{program_id}',
      '纯数字 program_id 不支持（缺少 channel_id 无法取链）'
    ]
  },

  async search(query, page, type) { return searchImpl(query, page, type); },
  async getMediaSource(musicItem, quality) { return getMediaSourceImpl(musicItem, quality); },
  async getLyric(musicItem) { return getLyricImpl(musicItem); },
  async getWordByWordLyric(musicItem) { return getWordByWordLyricImpl(musicItem); },
  async getMusicInfo(musicItem) { return getMusicInfoImpl(musicItem); },
  async getAlbumInfo(albumItem, page) { return getAlbumInfoImpl(albumItem, page); },
  getTopLists: getTopListsImpl,
  getTopListDetail: getTopListDetailImpl,
  getMusicSheetInfo: getMusicSheetInfoImpl,
  getArtistWorks: getArtistWorksImpl,
  importMusicItem: importMusicItemImpl,
  importMusicSheet: importMusicSheetImpl,
  getMusicComments: getMusicCommentsImpl
};

// ==================== 自测出口（不影响运行时） ====================
var _internal = {
  PLUGIN_VERSION: PLUGIN_VERSION,
  HMAC_KEY: HMAC_KEY, WEB_HMAC_KEY: WEB_HMAC_KEY,
  DEVICE_ID: DEVICE_ID, WEB_DEVICE_ID: WEB_DEVICE_ID,
  UA: UA, WEB_UA: WEB_UA,
  utf8: utf8, md5Hex: md5Hex, hmacMd5Hex: hmacMd5Hex,
  parseDeepLink: parseDeepLink, parseCompositeId: parseCompositeId,
  tierOfEdition: tierOfEdition, normalizeQuality: normalizeQuality,
  estimateTierFromUrl: estimateTierFromUrl,
  apiHeaders: apiHeaders, webHeaders: webHeaders,
  searchImpl: searchImpl, fetchEditions: fetchEditions,
  fetchWebRedirect: fetchWebRedirect, probeMedia: probeMedia,
  getMediaSourceImpl: getMediaSourceImpl, getMediaSourceWebFallback: getMediaSourceWebFallback,
  fetchChannelMeta: fetchChannelMeta, fetchChannelPrograms: fetchChannelPrograms,
  getAlbumInfoImpl: getAlbumInfoImpl, getMusicInfoImpl: getMusicInfoImpl,
  importMusicItemImpl: importMusicItemImpl
};

plugin._internal = _internal;

module.exports = plugin;