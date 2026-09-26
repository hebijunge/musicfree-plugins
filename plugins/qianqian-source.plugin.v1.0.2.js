/**
 * [v1.0.2 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「千千音乐」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 千千音乐独立源插件 v1.0.1（MusicFree 插件规范 · 音流 fork 宿主对齐）
 *
 * ==================== v1.0.1 changelog（交叉质检修复，2026-09-24） ====================
 * 依据质检1号《千千音乐插件v1.0.0-交叉质检报告》：
 * ①【P1/Q1】搜索翻页提前截断：isEnd 原按 VIP 过滤后条数判定，VIP 密集关键词下第 1 页即
 *    标 isEnd=true、后续页免费歌曲不可达 → 改按服务端原始条数（list.length<30）判定。
 * ②【P2/Q2】兜底 verifyMediaSizeStrict 试听守卫固定 16KB/s 对 320k/flac 档估时偏高 3~15
 *    倍导致守卫漏检 → 改按档位感知字节率，对齐 qqVerifyRate 修复口径。
 * ③【P2/Q4】isVip 字段缺失的保守丢弃口径在代码注释显式注明。
 * 复验：自测 28/28 PASS（新增 S3 VIP 密集关键词翻页场景）。
 *
 * ==================== v1.0.2 changelog（复验遗留观察采纳，2026-09-24） ====================
 * 【复验遗留观察】专辑搜索 isEnd 同步改按服务端原始条数判定（与 Q1 同类的理论截断，
 * albumAssetCode 缺失项被滤后判定）——一行改动，复跑自测 28/28 PASS。质检定点复验结论：
 * Q1/Q2 修复有效、要点 3/5 补核转通过，v1.0.1 可发布；本版仅含本条采纳改动。
 *
 * ==================== v1.0.0 changelog（首发版） ====================
 * 依据：《千千音乐_全App接口调用文档》（2026-09-24 用户提供附件，签名算法/端点/音质回退表
 *       均以该文档为权威依据）+ 沙箱探针实测复核（搜索/取链/歌词/歌单/专辑全链路 errno=22000）。
 *
 * ① MD5 签名严格按文档 2 章：参数键 ASCII 升序 → k=v 以 & 连接（值不 URL 编码）→
 *    Secret（0b50b02fd0d73a9c4c8c3a781c30845f）直接追加末尾无分隔符 → MD5 小写 hex；
 *    sign 本身不参与排序；timestamp 为秒级字符串。签名函数为纯 JS MD5（RFC 1321，
 *    移植自 kugou-v1912.js，无 Buffer 依赖，安卓 Hermes 兼容）。
 * ② 接口接入（全部实测存活，errno 22000 成功 / 23001 关键词净化 / 23010 不存在）：
 *    - 搜索歌曲 /v1/search type=1（isVip!=0 过滤；歌手 artistType=38 优先拼接、去重、「、」连接）
 *    - 搜索专辑 /v1/search type=3（errno=23001 或空结果时关键词净化重试，净化字符表按文档 3.2）
 *    - 播放取链 /v1/song/tracklink（TSID+rate；path 空回退 trail_audio_info.path）
 *    - 歌曲信息 /v1/song/info（data[0]，歌词 URL 两步流程第一步）
 *    - 专辑信息 /v1/album/info + /v1/album/albumid2psid（P 前缀归一化，数字 id 先转换）
 *    - 歌单详情 /v1/tracklist/info type=0（ID 兼容 float64/string；链接/纯 ID 解析按文档 8.2）
 *    - 歌单分类 /v1/tracklist/category；分类歌单列表 /v1/tracklist/list（pageSize≤100）
 * ③ 音质映射：rate 3000=flac 无损 / 320=mp3 极高 / 128=mp3 标准 / 64=aac 低品（文档实测修正：
 *    64 实际为 AAC ADTS，文件头 fff14c80）。请求档回退链 super→[3000,320,128,64]、
 *    high→[320,128,64]、standard→[128,64]、low→[64]；回退后 actualQuality 如实降档标注。
 * ④ ★播放酷我兜底（用户明确要求）★：千千 tracklink 全部音质取链失败（含 path 空/校验不过）
 *    时，自动按 title+artist 走酷我通道兜底——
 *    - oiapi 通道（移植自 kuwo-v1912.js kwOiapiResolve，三重校验：搜索命中归一互含/档位真实/
 *      声明大小）与官方通道（移植自 kugou-v1912.js resolveKuwoFallback：酷我搜索 → 严格同曲
 *      校验【核心歌名+版本标签+歌手+时长四项】→ rid 缓存 10min → mobi.s 竞速）racePriority 竞速；
 *    - 兜底取链同样走音流口径验证（Range 0-15 探测 Content-Length 与声明大小比对、魔数校验、
 *      试听片段守卫、码率下限守卫）；
 *    - 兜底结果 r.fromFallback='kuwo' 如实标记，actualQuality 按实际档位标注，宁低勿虚。
 * ⑤ 取链验证沿用音流口径：请求哪个音质就获取哪个音质；千千链接 Range 0-15 探测，取
 *    「Content-Range total / Content-Length」与 tracklink 返回 size 比对（实际<声明 90% 判
 *    虚标拒收）、魔数校验（3000→fLaC 硬校验；320/128→ID3/帧同步；64→帧同步/ftyp；未知魔数
 *    fail-closed 拒收）、试听守卫与码率下限守卫（320k→240kbps / 128k→96kbps / 64k→48kbps）。
 * ⑥ 歌词两步流程：/v1/song/info 取 lyric URL → GET 下载原文如实返回（千千歌词不一定是标准
 *    LRC，可能纯文本/BPM 信息——原文返回不伪造时间戳）。
 * ⑦ 搜索歌单 type=6 已失效（文档 3.3 实测 errno=23001）：不实现该入口，supportedSearchType
 *    仅 ['music','album']；歌单走分类列表 + 歌单详情。千千无官方榜单 API，榜单入口以
 *    分类歌单列表顶位并在 hints 说明。
 *
 * 验证方法（研发自测口径，见交付自测清单）：
 *   沙箱 NODE_PATH=仓库 node_modules 拷 .cjs 运行真实 HTTP：搜索/isVip 过滤/四档取链
 *   Range 探测与魔数/虚标拦截/强制兜底触发/歌词/专辑/歌单/导入逐项实测。
 *
 * 历史版本：无（v1.0.0 首发）。
 */

var axios = require('axios');

// ==================== 常量 ====================
var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
var RELAY_TIMEOUT = 2500;     // 兜底段单请求超时

var QQ_APPID = '16073360';
var QQ_SECRET = '0b50b02fd0d73a9c4c8c3a781c30845f';
var QQ_BASE = 'https://music.91q.com';
// 文档 10.1 全局常量：UA 必须 Chrome/143，Referer 播放器页
var QQ_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
var QQ_REFERER = 'https://music.91q.com/player';

function str(v) { return v === undefined || v === null ? '' : String(v); }

function withTimeout(promise, ms, msg) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; reject(new Error(msg)); }
    }, ms);
    promise.then(function (v) {
      if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
    }, function (e) {
      if (!settled) { settled = true; clearTimeout(timer); reject(e || new Error(msg)); }
    });
  });
}

// ==================== 归一化与同曲判定（移植自 kugou-v1912.js，宿主 songMatch 口径） ====================

function normalizeTitle(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[·・~～_]/g, '')
    .trim();
}

function normalizeArtist(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .split(/\s*(?:[、，,/&]|\bfeaturing\b|\bfeat\.?|\bft\.?)\s*/i)[0]
    .replace(/\s+/g, '')
    .trim();
}

function makeKey(title, artist) {
  return normalizeTitle(title) + '|' + normalizeArtist(artist);
}

var FEAT_TAIL_RE = /\s*(?:\bfeaturing\b|\bfeat\.?|\bft\.?).*$/i;

// ==================== 纯 JS MD5（RFC 1321，移植自 kugou-v1912.js，无 Buffer/Hermes 兼容） ====================

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

// ==================== 千千签名与 HTTP（文档 2 章，严格照抄算法） ====================
// Step: 参数键 ASCII 升序 → k=v 以 & 连接（值不 URL 编码）→ Secret 追加末尾无分隔符
// → MD5 小写 hex；sign 不参与排序；appid/timestamp 由本层统一注入（timestamp 秒级字符串）。
function qqSign(params) {
  var keys = Object.keys(params).sort(); // JS 默认排序 = UTF-16 码元序，ASCII 键即 ASCII 升序
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(keys[i] + '=' + str(params[keys[i]]));
  }
  return md5Hex(parts.join('&') + QQ_SECRET);
}

// 统一签名 GET：errno 22000（或 tracklist 系的 0）→ data；其余抛错（errno 挂 err.errno 供净化重试判定）
function qqGet(path, params, timeoutMs) {
  var p = {};
  for (var k in (params || {})) {
    if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined && params[k] !== null && params[k] !== '') {
      p[k] = params[k];
    }
  }
  p.appid = QQ_APPID;
  p.timestamp = String(Math.floor(Date.now() / 1000)); // 秒级字符串
  p.sign = qqSign(p);
  return axios.get(QQ_BASE + path, {
    params: p,
    timeout: timeoutMs || SOURCE_TIMEOUT,
    headers: { 'User-Agent': QQ_UA, Referer: QQ_REFERER }
  }).then(function (res) {
    var body = res.data || {};
    var errno = body.errno;
    if (errno === 22000 || errno === 0) return body.data;
    var err = new Error('[qianqian] ' + path + ' errno=' + errno + ' ' + str(body.errmsg));
    err.errno = errno;
    throw err;
  });
}

// ==================== 条目构造 ====================

// 歌手拼接（文档 3.1 规则）：artistType==38 优先；无 38 则全取；去重后「、」连接
function joinArtistNames(artistList) {
  if (!Array.isArray(artistList) || !artistList.length) return '';
  var major = [], all = [];
  for (var i = 0; i < artistList.length; i++) {
    var it = artistList[i] || {};
    var name = str(it.name);
    if (!name) continue;
    if (all.indexOf(name) < 0) all.push(name);
    if (parseInt(it.artistType, 10) === 38 && major.indexOf(name) < 0) major.push(name);
  }
  var picked = major.length ? major : all;
  return picked.join('、');
}

// rateFileInfo → 宿主 qualities 键（{size} 口径，对齐仓库既有插件）
var RATE_TO_HOST = { '3000': 'flac', '320': '320k', '128': '128k', '64': '64k' };
function buildQualities(rateFileInfo) {
  var out = {};
  if (!rateFileInfo || typeof rateFileInfo !== 'object') return out;
  for (var rate in RATE_TO_HOST) {
    if (!Object.prototype.hasOwnProperty.call(rateFileInfo, rate)) continue;
    var info = rateFileInfo[rate] || {};
    var size = parseInt(info.size, 10) || 0;
    if (size > 0) out[RATE_TO_HOST[rate]] = { size: size };
  }
  return out;
}

// 搜索/歌单/专辑条目统一构造（id=TSID 稳定身份，primaryKey=['id']）
function buildMusicItem(track, fallbackArtwork) {
  var pic = str(track && (track.pic || track.cover));
  return {
    id: str(track && (track.TSID || track.assetId)),
    title: str(track && track.title),
    artist: joinArtistNames(track && track.artist),
    album: str(track && track.albumTitle),
    artwork: httpsUrl(pic) || fallbackArtwork || '',
    duration: parseInt(track && track.duration, 10) || 0,
    qualities: buildQualities(track && track.rateFileInfo),
    platform: 'qianqian'
  };
}

// 封面/歌词域 http→https 升级（dmhmusic/taihe/tokenqiu 为千千实测 CDN 域，https 可用；
// 对齐 kugou v1.9.8 封面 https 升级做法，安卓 cleartext 兼容）
function httpsUrl(u) {
  var s = str(u);
  if (!/^http:\/\//i.test(s)) return s;
  if (/(^|\.)dmhmusic\.com$/i.test(hostOf(s)) || /taihe\.com$/i.test(hostOf(s)) || /tokenqiu\.com$/i.test(hostOf(s))) {
    return s.replace(/^http:\/\//i, 'https://');
  }
  return s;
}

function hostOf(url) {
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase().split(':')[0].split('@').pop() : '';
}

// ==================== 搜索（歌曲 type=1 / 专辑 type=3） ====================

// 搜索歌曲：isVip!=0 过滤（文档 3.1 VIP 过滤逻辑），仅保留免费歌曲
async function searchMusicImpl(kw, page) {
  var d = await qqGet('/v1/search', { word: kw, type: 1, pageNo: page || 1, pageSize: 30 });
  var list = (d && d.typeTrack) || [];
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    // isVip!=0 过滤（文档 3.1）；字段缺失按保守口径丢弃（文档搜索响应恒含 isVip）。
    // isEnd 必须按服务端原始条数判定（Q1 修复）：若按过滤后条数判定，VIP 密集关键词下
    // 第 1 页即标 isEnd=true，后续页免费歌曲全部不可达（质检报告 P1）。
    if (it.isVip === undefined || parseInt(it.isVip, 10) !== 0) continue;
    var item = buildMusicItem(it);
    if (item.id && item.title) items.push(item);
  }
  return { isEnd: list.length < 30, data: items };
}

// 搜索专辑：errno=23001 或空结果时关键词净化重试（文档 3.2 净化字符表）
var QQ_PURIFY_RE = /[:："'“”‘’()（）\[\]【】,，\/\\.\-]/g;
function purifyKeyword(kw) {
  return String(kw || '').replace(QQ_PURIFY_RE, ' ').replace(/\s+/g, ' ').trim();
}

async function searchAlbumImpl(kw, page) {
  var attempts = [kw];
  var purified = purifyKeyword(kw);
  if (purified && purified !== kw) attempts.push(purified);
  var lastErr = null;
  for (var a = 0; a < attempts.length; a++) {
    try {
      var d = await qqGet('/v1/search', { word: attempts[a], type: 3, pageNo: page || 1, pageSize: 30 });
      var list = (d && d.typeAlbum) || [];
      if (list.length || a === attempts.length - 1) {
        var items = [];
        for (var i = 0; i < list.length; i++) {
          var it = list[i] || {};
          var code = str(it.albumAssetCode);
          if (!code) continue;
          items.push({
            id: code, // albumAssetCode 即专辑 id（P 前缀）；getAlbumInfo 内做归一化兼容
            title: str(it.title),
            artist: joinArtistNames(it.artist),
            artwork: httpsUrl(str(it.pic)),
            date: str(it.releaseDate),
            description: str(it.introduce),
            platform: 'qianqian'
          });
        }
        // isEnd 按服务端原始条数判定（v1.0.2 复验采纳）：albumAssetCode 缺失项被滤后
        // 若按 items.length 判定，码缺失页会提前标 isEnd（质检复验遗留观察，与 Q1 同类）
        return { isEnd: list.length < 30, data: items };
      }
    } catch (e) {
      lastErr = e;
      if (e && e.errno !== 23001) throw e; // 仅净化类错误重试
    }
  }
  if (lastErr) throw lastErr;
  return { isEnd: true, data: [] };
}

// ==================== 歌曲信息 / 歌词（两步流程） ====================

async function getMusicInfoImpl(musicItem) {
  var tsid = str(musicItem && musicItem.id);
  if (!tsid) throw new Error('[qianqian] getMusicInfo: missing TSID');
  var d = await qqGet('/v1/song/info', { TSID: tsid });
  var info = (Array.isArray(d) && d[0]) || {};
  var out = {};
  if (info.title) out.title = str(info.title);
  if (info.albumTitle) out.album = str(info.albumTitle);
  if (info.pic) out.artwork = httpsUrl(str(info.pic));
  if (info.duration) out.duration = parseInt(info.duration, 10) || 0;
  var artist = joinArtistNames(info.artist);
  if (artist) out.artist = artist;
  return out;
}

// 歌词两步流程：/v1/song/info 取 lyric URL → GET 下载原文。
// 千千歌词不一定是标准 LRC（可能纯文本/BPM 信息）——原文如实返回 rawLrc，不伪造时间戳。
async function getLyricImpl(musicItem) {
  var tsid = str(musicItem && musicItem.id);
  if (!tsid) throw new Error('[qianqian] getLyric: missing TSID');
  var d = await qqGet('/v1/song/info', { TSID: tsid });
  var info = (Array.isArray(d) && d[0]) || {};
  var url = httpsUrl(str(info.lyric));
  if (!url) return { rawLrc: '' };
  var res = await axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    responseType: 'text',
    transformResponse: [function (x) { return x; }], // 保留原文，防 axios JSON 解析破坏 LRC
    headers: { 'User-Agent': QQ_UA, Referer: QQ_REFERER }
  });
  var text = typeof res.data === 'string' ? res.data : String(res.data || '');
  text = text.replace(/^\uFEFF/, '');
  return { rawLrc: text };
}

// ==================== 专辑 ====================

// albumAssetCode 归一化（文档 7.3）：p/P 开头 → P+剩余；否则空串（需 albumid2psid 转换）
function normalizeAlbumCode(s) {
  var t = str(s).trim();
  if (t.length < 2) return '';
  if (t.charAt(0) === 'p' || t.charAt(0) === 'P') return 'P' + t.slice(1);
  return '';
}

// 数字专辑 id → P 前缀资产码（文档 7.2，data[0].psid）
async function albumid2psid(albumid) {
  var d = await qqGet('/v1/album/albumid2psid', { albumid: str(albumid).trim() });
  return (Array.isArray(d) && d[0] && str(d[0].psid)) || '';
}

async function getAlbumInfoImpl(albumItem, page) {
  var aid = albumItem && typeof albumItem === 'object' ? str(albumItem.id) : str(albumItem);
  if (aid.indexOf('qqyy~album~') === 0) aid = aid.slice(11);
  var code = normalizeAlbumCode(aid);
  if (!code) {
    var m = aid.match(/music\.91q\.com\/(?:album|albums?)\/([A-Za-z0-9]+)/i) || aid.match(/(?:albumid|albumAssetCode)=([A-Za-z0-9]+)/i);
    var raw = m ? m[1] : str(aid).trim();
    code = normalizeAlbumCode(raw);
    if (!code) code = await albumid2psid(raw);
  }
  if (!code) throw new Error('[qianqian] getAlbumInfo: 无法解析专辑 id: ' + aid.slice(0, 80));
  var d = await qqGet('/v1/album/info', { albumAssetCode: code });
  var trackList = (d && d.trackList) || [];
  return {
    title: str(d && d.title),
    artist: joinArtistNames(d && d.artist),
    artwork: httpsUrl(str(d && d.pic)),
    description: str(d && d.introduce),
    date: str(d && d.releaseDate),
    musicList: trackList.map(function (t) { return buildMusicItem(t, httpsUrl(str(d && d.pic))); }),
    platform: 'qianqian'
  };
}

// ==================== 歌单（分类 + 详情 + 导入） ====================
// 搜索歌单 type=6 已失效（文档 3.3 实测 errno=23001）：不实现搜索入口，歌单走分类列表 + 详情。

// 歌单链接/ID 解析（文档 8.2 正则）
function parseSheetId(urlLike) {
  var s = str(urlLike).trim();
  if (!s) return '';
  var m = s.match(/music\.91q\.com\/(?:songlist|tracklist|playlist)\/([A-Za-z0-9]+)/i);
  if (m) return m[1];
  m = s.match(/(?:songlistid|tracklistid|playlistid|id)=([A-Za-z0-9]+)/i);
  if (m) return m[1];
  if (s.indexOf('/') < 0 && /^[A-Za-z0-9]+$/.test(s)) return s; // 纯 ID 字符串
  return '';
}

// 创建者优先级（文档 8.1）：creator > author > userName > nickName > ownerName
function pickSheetCreator(d) {
  return str(d && d.creator) || str(d && d.author) || str(d && d.userName) ||
    str(d && d.nickName) || str(d && d.ownerName) || '';
}

// 描述选择（文档 8.1）：desc > description；都空且 tagList 非空 → 「、」拼接
function pickSheetDesc(d) {
  var desc = str(d && d.desc) || str(d && d.description);
  if (!desc && Array.isArray(d && d.tagList) && d.tagList.length) desc = d.tagList.map(str).filter(Boolean).join('、');
  return desc;
}

async function fetchSheetInfo(sheetId) {
  var d = await qqGet('/v1/tracklist/info', { id: sheetId, type: 0 }, 8000);
  var trackList = (d && d.trackList) || [];
  var sheetArt = httpsUrl(str(d && d.pic));
  return {
    id: str(d && (d.id !== undefined ? d.id : sheetId)), // ID 兼容 float64/string
    title: str(d && d.title),
    artist: pickSheetCreator(d),
    artwork: sheetArt,
    description: pickSheetDesc(d),
    worksNum: parseInt(d && d.trackCount, 10) || trackList.length,
    // 歌单内条目：搜索口径外的歌单曲池允许 VIP 条目展示（酷我兜底可播），isVip 原样保留不静默丢条
    musicList: trackList.map(function (t) { return buildMusicItem(t, sheetArt); }),
    platform: 'qianqian'
  };
}

async function getMusicSheetInfoImpl(urlLike) {
  var id = parseSheetId(urlLike);
  if (!id) throw new Error('[qianqian] 无法识别歌单链接/ID: ' + str(urlLike).slice(0, 80));
  return fetchSheetInfo(id);
}

async function importMusicSheetImpl(urlLike) {
  var sheet = await getMusicSheetInfoImpl(urlLike);
  return sheet.musicList;
}

// ==================== 歌单广场（分类 + 分类歌单列表） ====================
// 千千无官方榜单 API：榜单入口以「分类歌单列表」顶位，getTopListDetail 落到歌单详情。

var QQ_SHEET_PAGE_SIZE = 30; // 文档 9.2：pageSize 默认 30、上限 100

async function getTopListsImpl() {
  var d = await qqGet('/v1/tracklist/list', { pageNo: 1, pageSize: QQ_SHEET_PAGE_SIZE }, 8000);
  var arr = (d && d.result) || [];
  return [{
    title: '千千·精选歌单',
    data: arr.map(function (s) {
      return { id: 'qqyy~sheet~' + str(s.id), title: str(s.title), artwork: httpsUrl(str(s.pic)), platform: 'qianqian' };
    })
  }];
}

async function getTopListDetailImpl(topListItem, page) {
  var tid = topListItem && topListItem.id ? str(topListItem.id) : '';
  if (page && page > 1) return { isEnd: true, musicList: [] };
  if (tid.indexOf('qqyy~sheet~') !== 0) throw new Error('[qianqian] 未知榜单/歌单 id: ' + tid.slice(0, 60));
  var sheet = await fetchSheetInfo(tid.slice('qqyy~sheet~'.length));
  return {
    isEnd: true,
    musicList: sheet.musicList,
    topListItem: { id: tid, title: sheet.title, coverImg: sheet.artwork, artwork: sheet.artwork, platform: 'qianqian' }
  };
}

async function getRecommendSheetTagsImpl() {
  var d = await qqGet('/v1/tracklist/category');
  var groups = [];
  var arr = Array.isArray(d) ? d : [];
  for (var i = 0; i < arr.length; i++) {
    var g = arr[i] || {};
    var children = [];
    var subs = Array.isArray(g.subCate) ? g.subCate : [];
    for (var j = 0; j < subs.length; j++) {
      var s = subs[j] || {};
      if (s.id === undefined || s.id === null || !s.categoryName) continue;
      children.push({ id: 'qqyy~cate~' + str(s.id), title: str(s.categoryName), platform: 'qianqian' });
    }
    if (children.length) groups.push({ title: str(g.categoryName), data: children });
  }
  return { pinned: [], data: groups };
}

// 歌单广场条目映射（对齐 kugou mapKugouRecommendSheet 字段兜底链）
function mapQQSheet(it) {
  var tags = Array.isArray(it.tagList) ? it.tagList.map(str).filter(Boolean).join('、') : '';
  return {
    source: 'qianqian',
    sid: str(it.id),
    title: str(it.title),
    artist: str(it.author || it.userName || it.creator || it.nickName || ''),
    artwork: httpsUrl(str(it.pic)),
    worksNum: parseInt(it.trackCount, 10) || 0,
    playCount: 0,
    description: str(it.desc) || tags,
    raw: { listId: str(it.id) }
  };
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var tid = tagItem && tagItem.id !== undefined && tagItem.id !== null ? str(tagItem.id) : '';
  var subCateId = '';
  if (tid.indexOf('qqyy~cate~') === 0) subCateId = tid.slice('qqyy~cate~'.length);
  var d = await qqGet('/v1/tracklist/list', { subCateId: subCateId, pageNo: page || 1, pageSize: QQ_SHEET_PAGE_SIZE });
  var arr = (d && d.result) || [];
  return { isEnd: arr.length < QQ_SHEET_PAGE_SIZE, data: arr.map(mapQQSheet) };
}

// ==================== 播放取链 · 千千通道（tracklink 四档回退 + 音流口径校验） ====================

// 宿主音质键 → 内部档；请求档 → rate 回退链（硬性要求：3000→320→128→64）
var QUALITY_KEY_MAP = {
  '64k': 'low', '128k': 'standard', '192k': 'high', '320k': 'high',
  'flac': 'super', 'flac24bit': 'super', 'hires': 'super', 'master': 'super', 'atmos': 'super', 'dolby': 'super', 'vinyl': 'super'
};
var RATE_CHAIN = {
  super: ['3000', '320', '128', '64'],
  high: ['320', '128', '64'],
  standard: ['128', '64'],
  low: ['64']
};
function normalizeQuality(q) {
  var s = str(q);
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'low' || s === 'standard' || s === 'high' || s === 'super') return s;
  return 'standard';
}

// tracklink 单档取链：path 空回退 trail_audio_info.path（文档 4.1 下载 URL 选择逻辑）
function qqResolveRate(tsid, rate) {
  return qqGet('/v1/song/tracklink', { TSID: tsid, rate: rate }).then(function (d) {
    var trail = d && d.trail_audio_info ? str(d.trail_audio_info.path) : '';
    var url = str(d && d.path) || trail;
    if (!url || !/^https?:\/\//i.test(url)) throw new Error('[qianqian] tracklink rate=' + rate + ' 无有效 path');
    return {
      url: url,
      size: parseInt(d && d.size, 10) || 0,
      format: str(d && d.format),
      duration: parseInt(d && d.duration, 10) || 0
    };
  });
}

// 魔数识别（音流口径）：fLaC / ID3 / OggS / 帧同步(0xFF+111xxxxx，mp3 与 AAC ADTS 共用) / ftyp
function detectAudioMagic(u8) {
  if (!u8 || u8.length < 4) return '';
  if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) return 'fLaC';
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'ID3';
  if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) return 'OggS';
  if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return 'frame-sync'; // mp3 / AAC ADTS
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return 'ftyp';
  return '';
}

// 各 rate 允许魔数（文档 4.1 音质回退表 + 实测修正：64=AAC ADTS fff14c80，帧同步族覆盖）。
// 未知魔数 fail-closed 拒收（不猜格式）。
var RATE_MAGIC_OK = {
  '3000': { 'fLaC': 1 },
  '320': { 'ID3': 1, 'frame-sync': 1 },
  '128': { 'ID3': 1, 'frame-sync': 1 },
  '64': { 'frame-sync': 1, 'ID3': 1, 'ftyp': 1 }
};

// 千千链接严格校验（音流口径 verifyMediaSizeStrict 移植，按 rate 定制）：
// Range 0-15 探测 → HTTP 200/201/206 → total>0 → 虚标检测（total<声明*0.9 拒收）→
// 魔数白名单 → 试听守卫（est<dur*0.6 拒收）→ 码率下限（320k→240 / 128k→96 / 64k→48）。
function qqVerifyRate(url, rate, musicItem, declaredSize, declaredDur) {
  var dur = (musicItem && parseInt(musicItem.duration, 10)) || declaredDur || 0;
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': QQ_UA, Referer: QQ_REFERER },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 201 && st !== 206) throw new Error('qianqian verify: HTTP ' + st);
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else if (st !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total === 0) throw new Error('qianqian verify: Content-Length=0 或响应无 total');
    // 虚标检测：链接真实 total 与 tracklink 声明 size 比对，实际 < 声明 90% 判虚标拒收
    if (declaredSize > 0 && total > 0 && total < declaredSize * 0.9) {
      throw new Error('qianqian verify: 虚标 实际 ' + total + 'B < 声明 ' + declaredSize + 'B (rate ' + rate + ')');
    }
    var buf = res.data, u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = detectAudioMagic(u8);
    var ok = RATE_MAGIC_OK[rate] || {};
    if (!magic || !ok[magic]) {
      throw new Error('qianqian verify: 魔数不符 ' + (magic || 'unknown') + ' (rate ' + rate + ')');
    }
    // 试听片段守卫（按 rate 感知字节率估算时长：3000→100KB/s、320→40KB/s、128→16KB/s、64→8KB/s；
    // 64k AAC 真实码率 ~64kbps，若用固定 16KB/s 会把合法整曲误判为试听片段）
    if (total > 0 && dur >= 60) {
      var bps = (rate === '3000') ? 100000 : (rate === '320') ? 40000 : (rate === '128') ? 16000 : (rate === '64') ? 8000 : 16000;
      var est = total / bps;
      if (est < dur * 0.6) throw new Error('qianqian verify: 试听片段 ~' + Math.round(est) + 's/' + dur + 's');
    }
    // 有损档码率下限（75% 容差口径，对齐 verifyMediaSizeStrict；64k 档 aac 实测有效位率低，下限 48k）
    if (total > 0 && dur >= 60 && rate) {
      var kbps = Math.round(total * 8 / dur / 1000);
      var floor = (rate === '320') ? 240 : (rate === '128') ? 96 : (rate === '64') ? 48 : 0;
      if (floor > 0 && kbps > 0 && kbps < floor) {
        throw new Error('qianqian verify: 码率降级 ~' + kbps + 'kbps < rate ' + rate);
      }
    }
    return { total: total, magic: magic };
  });
}

// 千千回退链解析：按请求档的 rate 链顺序逐档尝试（先到高优先档，不并发轰接口），
// 任一档取链 + 校验通过即返回；全败抛错交酷我兜底。
function resolveQianqianChain(musicItem, q, deadline) {
  var tsid = str(musicItem && musicItem.id);
  if (!tsid) return Promise.reject(new Error('[qianqian] 取链缺少 TSID'));
  var chain = RATE_CHAIN[q] || RATE_CHAIN.standard;
  var idx = 0;
  function attempt() {
    if (idx >= chain.length) {
      return Promise.reject(new Error('[qianqian] tracklink 全档无可用链接'));
    }
    var rate = chain[idx++];
    var remain = deadline - Date.now();
    if (remain <= 500) return Promise.reject(new Error('[qianqian] 超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms'));
    return withTimeout(qqResolveRate(tsid, rate), Math.min(remain, SOURCE_TIMEOUT), '[qianqian] tracklink ' + rate + ' 超时')
      .then(function (lk) {
        if (!isAllowedMediaUrl(lk.url)) throw new Error('[qianqian] tracklink ' + rate + ' URL 未通过协议/域名校验');
        return qqVerifyRate(lk.url, rate, musicItem, lk.size, lk.duration).then(function (v) {
          RESOLVE_STATS['qq' + rate] = (RESOLVE_STATS['qq' + rate] || 0) + 1;
          return { url: lk.url, actualQuality: RATE_TO_HOST[rate], size: v.total || lk.size, channel: 'qianqian' };
        });
      })
      .catch(attempt); // 校验失败/无 path → 回退下一档
  }
  return attempt();
}

// ==================== 播放取链 · 酷我兜底（★用户明确要求★） ====================
// 机械移植自 kuwo-v1912.js（oiapi 通道 + verifyMediaSizeStrict + racePriority）
// 与 kugou-v1912.js（酷我官方竞速赛道：搜索 → 严格同曲校验 → rid 缓存 → mobi.s 竞速）。

// ---------- URL 白名单（对齐 kuwo-v1912.js 口径：https 一律放行，http 仅白名单域） ----------
// 理由：千千回源域 audio*.dmhmusic.com、酷我官方/DES 回源域、oiapi 三方 CDN 域名不固定；
// https 链接的最终可用性由 Range 探测 + 魔数 + 大小比对守卫兜底（先校验后返回）。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /(^|\.)dmhmusic\.com$/i,  // 千千音频/图片 CDN
  /(^|\.)91q\.com$/i,       // 千千主域
  /(^|\.)kuwo\.cn$/i        // 酷我官方/DES 直链（http 升级 https 失败时保底）
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (/^https:\/\//i.test(s)) return true; // https 一律放行（内容守卫兜底，口径同 kuwo-v1912.js）
  var host = hostOf(s);
  for (var i = 0; i < MEDIA_URL_HTTP_HOST_ALLOWLIST.length; i++) {
    if (MEDIA_URL_HTTP_HOST_ALLOWLIST[i].test(host)) return true;
  }
  return false;
}

// ---------- 优先级错峰竞速（移植自 kuwo-v1912.js racePriority，v1.7.1 fix#3/#4 口径） ----------
function racePriority(builds) {
  return new Promise(function (resolve, reject) {
    var pending = builds.length, failed = 0;
    if (!pending) { reject(new Error('racePriority: 无候选')); return; }
    var settled = false;
    var timers = [];
    var controllers = [];
    function settle(fn, val) {
      if (settled) return;
      settled = true;
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      for (var j = 0; j < controllers.length; j++) {
        try { if (controllers[j] && typeof controllers[j].abort === 'function') controllers[j].abort(); } catch (e) { /* 忽略 */ }
      }
      fn(val);
    }
    builds.forEach(function (b) {
      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      if (ctrl) controllers.push(ctrl);
      var buildFn = b.build;
      if (ctrl && typeof buildFn === 'function' && buildFn.length >= 1) {
        var orig = buildFn;
        buildFn = function () { return orig(ctrl.signal); };
      }
      timers.push(setTimeout(function () {
        Promise.resolve().then(buildFn).then(function (v) {
          settle(resolve, v);
        }, function () {
          failed++;
          if (failed === pending) settle(reject, new Error('racePriority: 全部候选失败'));
        });
      }, b.delay));
    });
  });
}

// ---------- 严格音质大小校验（移植自 kuwo-v1912.js verifyMediaSizeStrict，酷我兜底闸门） ----------
function verifyMediaSizeStrict(url, musicItem, declared, signal) {
  var dec = declared || {};
  var aq = dec.actualQuality;
  var dur = (musicItem && parseInt(musicItem.duration, 10)) || 0;
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    signal: signal || undefined,
    headers: { Range: 'bytes=0-15', 'User-Agent': 'okhttp/3.10.0' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 201 && st !== 206) throw new Error('size verify: HTTP ' + st);
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else if (st !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total === 0) throw new Error('size verify: Content-Length=0 或响应无 total');
    if (dec.declaredSize > 0 && total > 0 && total < dec.declaredSize * 0.9) {
      throw new Error('size verify: 虚标 实际 ' + total + 'B < 声明 ' + dec.declaredSize + 'B (declared ' + aq + ')');
    }
    var u8 = null, buf = res.data;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = '';
    if (u8 && u8.length >= 4) {
      if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) magic = 'fLaC';
      else if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'ID3';
      else if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) magic = 'OggS';
      else if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) magic = 'mp3';
    }
    var LOSSLESS = { flac: 1, hires: 1, master: 1, atmos: 1 };
    if (LOSSLESS[aq] && !dec.ekey && magic && magic !== 'fLaC') {
      throw new Error('size verify: 无损档魔数不符 ' + magic + ' (declared ' + aq + ')');
    }
    if (total > 0 && dur >= 60) {
      // 试听守卫按档位感知字节率（质检 Q2，对齐 qqVerifyRate 修复口径）：固定 16KB/s
      // 对 320k/flac 档估时偏高 3~15 倍导致守卫漏检。兜底候选为 128k/320k/无损。
      var fbps = (aq === '320k') ? 40000 : (aq === '192k') ? 24000 : LOSSLESS[aq] ? 100000 : 16000;
      var est = total / fbps;
      if (est < dur * 0.6) throw new Error('size verify: 试听片段 ~' + Math.round(est) + 's/' + dur + 's');
    }
    if (total > 0 && dur >= 60 && aq) {
      var kbps = Math.round(total * 8 / dur / 1000);
      var floor = (aq === '320k') ? 240 : (aq === '192k') ? 144 : (aq === '128k') ? 96 : 0;
      if (floor > 0 && kbps > 0 && kbps < floor) {
        throw new Error('size verify: 码率降级 ~' + kbps + 'kbps < ' + aq);
      }
    }
    return { total: total };
  });
}

// ---------- size 探测辅助（移植自 kuwo-v1912.js probeHeadSize，getMediaSource 边界 size 兜底） ----------
function probeHeadSize(url, timeoutMs) {
  if (!url || typeof url !== 'string') return Promise.resolve(0);
  var ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 2000;
  return axios.get(url, {
    timeout: ms,
    headers: { Range: 'bytes=0-0', 'User-Agent': QQ_UA },
    responseType: 'arraybuffer',
    validateStatus: function (s) { return s >= 200 && s < 400; }
  }).then(function (res) {
    var headers = res.headers || {};
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) return parseInt(mm[1], 10) || 0;
    if (res.status !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      return parseInt(cl, 10) || 0;
    }
    return 0;
  }).catch(function () { return 0; });
}

// ---------- 酷我自定义 DES（移植自 kuwo-v1912.js，密钥 ylzsxkwm，非标准 E 扩展表） ----------
function u32(x) { return x | 0; }

function bt64(sel, lo, hi) {
  var rlo = 0, rhi = 0;
  for (var i = 0; i < sel.length; i++) {
    var idx = sel[i];
    if (idx >= 0) {
      var bit = idx < 32 ? ((lo >>> idx) & 1) : ((hi >>> (idx - 32)) & 1);
      if (bit) { if (i < 32) rlo |= (1 << i); else rhi |= (1 << (i - 32)); }
    }
  }
  return [rlo | 0, rhi | 0];
}

var KW_ARRAYLS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
var KW_ARRAYLSMASK = [0, 0x100001, 0x300003];
var KW_ARRAYE = [31,0,1,2,3,4,-1,-1,3,4,5,6,7,8,-1,-1,7,8,9,10,11,12,-1,-1,11,12,13,14,15,16,-1,-1,15,16,17,18,19,20,-1,-1,19,20,21,22,23,24,-1,-1,23,24,25,26,27,28,-1,-1,27,28,29,30,31,30,-1,-1];
var KW_ARRAYIP1 = [39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25,32,0,40,8,48,16,56,24];
var KW_ARRAYIP2 = [57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7,56,48,40,32,24,16,8,0,58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6];
var KW_ARRAYP = [15,6,19,20,28,11,27,16,0,14,22,25,4,17,30,9,1,7,23,13,31,26,2,8,18,12,29,5,21,10,3,24];
var KW_ARRAYPC1 = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3];
var KW_ARRAYPC2 = [13,16,10,23,0,4,-1,-1,2,27,14,5,20,9,-1,-1,22,18,11,3,25,7,-1,-1,15,6,26,19,12,1,-1,-1,40,51,30,36,46,54,-1,-1,29,39,50,44,32,47,-1,-1,43,48,38,55,33,52,-1,-1,45,41,49,35,28,31,-1,-1];
var KW_SBOX = [
[14,4,3,15,2,13,5,3,13,14,6,9,11,2,0,5,4,1,10,12,15,6,9,10,1,8,12,7,8,11,7,0,0,15,10,5,14,4,9,10,7,8,12,3,13,1,3,6,15,12,6,11,2,9,5,0,4,2,11,14,1,7,8,13],
[15,0,9,5,6,10,12,9,8,7,2,12,3,13,5,2,1,14,7,8,11,4,0,3,14,11,13,6,4,1,10,15,3,13,12,11,15,3,6,0,4,10,1,7,8,4,11,14,13,8,0,6,2,15,9,5,7,1,10,12,14,2,5,9],
[10,13,1,11,6,8,11,5,9,4,12,2,15,3,2,14,0,6,13,1,3,15,4,10,14,9,7,12,5,0,8,7,13,1,2,4,3,6,12,11,0,13,5,14,6,8,15,2,7,10,8,15,4,9,11,5,9,0,14,3,10,7,1,12],
[7,10,1,15,0,12,11,5,14,9,8,3,9,7,4,8,13,6,2,1,6,11,12,2,3,0,5,14,10,13,15,4,13,3,4,9,6,10,1,12,11,0,2,5,0,13,14,2,8,15,7,4,15,1,10,7,5,6,12,11,3,8,9,14],
[2,4,8,15,7,10,13,6,4,1,3,12,11,7,14,0,12,2,5,9,10,13,0,3,1,11,15,5,6,8,9,14,14,11,5,6,4,1,3,10,2,12,15,0,13,2,8,5,11,8,0,15,7,14,9,4,12,7,10,9,1,13,6,3],
[12,9,0,7,9,2,14,1,10,15,3,4,6,12,5,11,1,14,13,0,2,8,7,13,15,5,4,10,8,3,11,6,10,4,6,11,7,9,0,6,4,2,13,1,9,15,3,8,15,3,1,14,12,5,11,0,2,12,14,7,5,10,8,13],
[4,1,3,10,15,12,5,0,2,11,9,6,8,7,6,9,11,4,12,15,0,3,10,5,14,13,7,8,13,14,1,2,13,6,14,9,4,1,2,14,11,13,5,0,1,10,8,3,0,11,3,5,9,4,15,2,7,8,12,15,10,7,6,12],
[13,7,10,0,6,9,5,15,8,4,3,10,11,14,12,5,2,11,9,6,15,12,0,3,4,1,14,13,1,2,7,8,1,2,12,15,10,4,0,3,13,14,6,9,7,8,9,6,15,1,5,12,3,10,14,5,8,7,11,0,4,13,2,11]
];

function kwDesBlock(subkeys, lo, hi) {
  var ip = bt64(KW_ARRAYIP2, lo, hi);
  var L = ip[0], R = ip[1];
  for (var i = 0; i < 16; i++) {
    var e = bt64(KW_ARRAYE, R, 0);
    var xlo = e[0] ^ subkeys[i][0], xhi = e[1] ^ subkeys[i][1];
    var sOut = 0;
    for (var sbi = 7; sbi >= 0; sbi--) {
      var b;
      if (sbi < 4) b = (xlo >>> (8 * sbi)) & 0xFF;
      else b = (xhi >>> (8 * (sbi - 4))) & 0xFF;
      sOut = ((sOut << 4) | KW_SBOX[sbi][b]) >>> 0;
    }
    var p = bt64(KW_ARRAYP, sOut, 0)[0];
    var newR = u32(L ^ p);
    L = R; R = newR;
  }
  var t = L; L = R; R = t;
  return bt64(KW_ARRAYIP1, L, R);
}

var KW_SUBKEY_CACHE = {};
function kwSubkeys(keyStr) {
  if (KW_SUBKEY_CACHE[keyStr]) return KW_SUBKEY_CACHE[keyStr];
  var klo = 0, khi = 0;
  for (var i = 0; i < 8; i++) {
    var b = keyStr.charCodeAt(i) & 0xFF;
    if (i < 4) klo |= b << (8 * i); else khi |= b << (8 * (i - 4));
  }
  var x = bt64(KW_ARRAYPC1, klo, khi);
  var keys = [];
  for (var r = 0; r < 16; r++) {
    var shift = KW_ARRAYLS[r];
    var mask = KW_ARRAYLSMASK[shift];
    var maskedLo = x[0] & mask;
    var restLo = (x[0] & ~mask) | 0, restHi = x[1];
    var shrLo = (restLo >>> shift) | (restHi << (32 - shift));
    var shrHi = restHi >>> shift;
    var sl = 28 - shift;
    var shlLo = maskedLo << sl;
    var shlHi = maskedLo >>> (32 - sl);
    var nxlo = (shlLo | shrLo) | 0, nxhi = (shlHi | shrHi) | 0;
    keys.push(bt64(KW_ARRAYPC2, nxlo, nxhi));
    x = [nxlo, nxhi];
  }
  KW_SUBKEY_CACHE[keyStr] = keys;
  return keys;
}

function kwDesEncryptBytes(bytes, keyStr) {
  var sub = kwSubkeys(keyStr);
  var j = Math.floor(bytes.length / 8);
  var out = [];
  var blocks = [];
  for (var m = 0; m < j; m++) {
    var lo = 0, hi = 0;
    for (var n = 0; n < 8; n++) {
      var b = bytes[m * 8 + n] & 0xFF;
      if (n < 4) lo |= b << (8 * n); else hi |= b << (8 * (n - 4));
    }
    blocks.push(kwDesBlock(sub, lo | 0, hi | 0));
  }
  var rem = bytes.length % 8;
  var rlo = 0, rhi = 0;
  for (var n2 = 0; n2 < rem; n2++) {
    var b2 = bytes[j * 8 + n2] & 0xFF;
    if (n2 < 4) rlo |= b2 << (8 * n2); else rhi |= b2 << (8 * (n2 - 4));
  }
  if (rem !== 0 || true) blocks.push(kwDesBlock(sub, rlo | 0, rhi | 0));
  for (var k = 0; k < blocks.length; k++) {
    out.push(blocks[k][0] & 0xFF, (blocks[k][0] >>> 8) & 0xFF, (blocks[k][0] >>> 16) & 0xFF, (blocks[k][0] >>> 24) & 0xFF);
    out.push(blocks[k][1] & 0xFF, (blocks[k][1] >>> 8) & 0xFF, (blocks[k][1] >>> 16) & 0xFF, (blocks[k][1] >>> 24) & 0xFF);
  }
  return out;
}

function kwBase64(bytes) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return out;
}

function kuwoEncryptQuery(query, keyStr) {
  return kwBase64(kwDesEncryptBytes(utf8Bytes(query), keyStr));
}

// ---------- 酷我搜索 + 严格同曲校验（移植自 kugou-v1912.js v1.4.1 口径） ----------

function searchKuwoCandidates(query) {
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      all: query, pn: 0, rn: 20, ft: 'music', client: 'kt',
      encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, cluster: 0,
      strategy: 2012, issubtitle: 1, show_copyright_off: 1, correct: 1,
      spPrivilege: 0, newver: 2, p2p: 1, notrace: 0, searchapi: 2, vermerge: 1
    },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var list = (res.data && res.data.abslist) || [];
    var cands = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var rid = String(it.MUSICRID || '').replace(/^MUSIC_/, '');
      if (!rid) continue;
      cands.push({
        rid: rid,
        name: str(it.NAME || it.SONGNAME || it.name || ''),
        artist: str(it.ARTIST || it.artist || ''),
        duration: parseInt(it.DURATION || it.duration, 10) || 0
      });
    }
    return cands;
  });
}

var KW_VERSION_KEYWORDS = [
  { canon: 'live',          words: ['演唱会版', '演唱会', '现场版', '现场', 'live版', 'live'] },
  { canon: 'remix',         words: ['remix版', 'remix', '混音版', '混音'] },
  { canon: 'accompaniment', words: ['伴奏版', '伴奏', 'instrumental', '纯音乐'] },
  { canon: 'pure',          words: ['纯享版', '纯享'] },
  { canon: 'original',      words: ['原版', 'original version', 'original'] },
  { canon: 'cover',         words: ['翻唱版', '翻唱', 'cover版', 'cover'] },
  { canon: 'dj',            words: ['dj版', 'dj'] },
  { canon: 'movie',         words: ['电影版', '电影'] },
  { canon: 'tv',            words: ['电视剧版', '电视剧'] },
  { canon: 'clip',          words: ['片段', '节选'] },
  { canon: 'ringtone',      words: ['铃声版', '铃声'] },
  { canon: 'surround',      words: ['3d环绕版', '3d环绕', '环绕声版', '环绕声', '环绕版', '环绕', '3d'] },
  { canon: 'piano',         words: ['钢琴版', '钢琴'] },
  { canon: 'guitar',        words: ['吉他版', '吉他'] },
  { canon: 'female',        words: ['女声版', '女声'] },
  { canon: 'male',          words: ['男声版', '男声'] },
  { canon: 'child',         words: ['童声版', '童声'] },
  { canon: 'full',          words: ['完整版', '完整'] }
];

function kwMatchVersionWord(w) {
  var s = String(w || '').toLowerCase().replace(/[\s.\-—–_/]/g, '');
  if (!s) return null;
  for (var i = 0; i < KW_VERSION_KEYWORDS.length; i++) {
    var ws = KW_VERSION_KEYWORDS[i].words;
    for (var j = 0; j < ws.length; j++) {
      if (s === ws[j].replace(/[\s.\-—–_/]/g, '')) return KW_VERSION_KEYWORDS[i].canon;
    }
  }
  return null;
}

var KW_GLUED_EN_RE = /(?:[^a-z]|^)(live版|live|remix版|remix|dj版|dj|cover版|cover|instrumental|original)$/i;
var KW_GLUED_CJK_WORDS = ['演唱会版', '现场版', '伴奏版', '纯享版', '混音版', '翻唱版', '电视剧版', '电影版', '铃声版', '钢琴版', '吉他版', '女声版', '男声版', '童声版', '完整版', '纯音乐', '演唱会', '现场', '伴奏', '原版', '片段', '节选', '环绕', '环绕声', '钢琴', '吉他', '女声', '男声', '童声', '纯享', '混音', '翻唱', '铃声', '3d环绕', '3d'];

function kwSplitTitleVersion(rawTitle) {
  var t = String(rawTitle || '').replace(FEAT_TAIL_RE, '').trim();
  var tags = [];
  var guard = 0;
  while (t && guard++ < 24) {
    var m = t.match(/[\s\-—–·_~|｜]*[（(【\[]([^）)】\]]*)[）)】\]]\s*$/);
    if (m) {
      var inner = m[1];
      var canon = kwMatchVersionWord(inner);
      if (canon) {
        if (canon !== 'original') tags.push(canon);
        t = t.slice(0, m.index).trim();
        continue;
      }
      var toks = inner.split(/[\s\-—–·_~、，,/&]+/).filter(Boolean);
      var consumed = 0;
      for (var i = toks.length - 1; i >= 0; i--) {
        var c2 = kwMatchVersionWord(toks[i]);
        if (!c2) break;
        if (c2 !== 'original') tags.push(c2);
        consumed++;
      }
      if (consumed > 0) {
        var rest = toks.slice(0, toks.length - consumed).join(' ');
        t = (t.slice(0, m.index).trim() + (rest ? ' ' + rest : '')).trim();
        continue;
      }
      break;
    }
    var segs = t.split(/[\s\-—–·_~|｜、，,/]+/).filter(Boolean);
    var last = segs.length ? segs[segs.length - 1] : '';
    var c3 = kwMatchVersionWord(last);
    if (c3) {
      if (c3 !== 'original') tags.push(c3);
      segs.pop();
      t = segs.join(' ').trim();
      continue;
    }
    var ge = KW_GLUED_EN_RE.exec(t);
    var stripped = false;
    if (ge) {
      var cg = kwMatchVersionWord(ge[1]);
      if (cg) {
        if (cg !== 'original') tags.push(cg);
        t = t.slice(0, t.length - ge[1].length).trim();
        stripped = true;
      }
    }
    if (!stripped) {
      for (var k = 0; k < KW_GLUED_CJK_WORDS.length; k++) {
        var w = KW_GLUED_CJK_WORDS[k];
        if (t.length > w.length && t.slice(-w.length) === w) {
          var ck = kwMatchVersionWord(w);
          if (ck) {
            if (ck !== 'original') tags.push(ck);
            t = t.slice(0, t.length - w.length).trim();
            stripped = true;
            break;
          }
        }
      }
    }
    if (!stripped) break;
  }
  return { core: t, tags: tags.reverse() };
}

function kwCoreKey(core) {
  return String(core || '').toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[^0-9a-z\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, '');
}

function kwArtistTokens(raw) {
  return String(raw || '')
    .split(/\s*(?:[、，,/&]|\bfeaturing\b|\bfeat\b|\bft\b|和|与)\s*/i)
    .map(function (s) { return s.toLowerCase().replace(/[\s.\u3000]+/g, ''); })
    .filter(Boolean);
}

// 严格同曲校验：ref=千千侧 musicItem，cand=酷我搜索候选。四项全过才放行。
function kuwoSameSongCheck(ref, cand) {
  var a = kwSplitTitleVersion(ref && (ref.title || ref.name));
  var b = kwSplitTitleVersion(cand && (cand.name || cand.title));
  if (kwCoreKey(a.core) !== kwCoreKey(b.core)) {
    return { pass: false, reason: 'core', detail: '核心名不一致: [' + a.core + '] vs [' + b.core + ']' };
  }
  var ta = a.tags.slice().sort();
  var tb = b.tags.slice().sort();
  if (ta.length !== tb.length) {
    return { pass: false, reason: 'version', detail: '版本标签数量不一致: [' + a.tags.join(',') + '] vs [' + b.tags.join(',') + ']' };
  }
  for (var i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) {
      return { pass: false, reason: 'version', detail: '版本标签类型不一致: [' + a.tags.join(',') + '] vs [' + b.tags.join(',') + ']' };
    }
  }
  var aa = kwArtistTokens(ref && ref.artist);
  var ba = kwArtistTokens(cand && cand.artist);
  var hit = false;
  for (var x = 0; x < aa.length && !hit; x++) {
    for (var y = 0; y < ba.length; y++) {
      if (aa[x] && aa[x] === ba[y]) { hit = true; break; }
    }
  }
  if (!hit) {
    return { pass: false, reason: 'artist', detail: '无共同歌手: [' + (ref && ref.artist) + '] vs [' + (cand && cand.artist) + ']' };
  }
  var d1 = parseInt(ref && ref.duration, 10) || 0;
  var d2 = parseInt(cand && cand.duration, 10) || 0;
  if (d1 > 0 && d2 > 0 && Math.abs(d2 - d1) / d1 > 0.10) {
    return { pass: false, reason: 'duration', detail: '时长差超10%: ' + d1 + 's vs ' + d2 + 's' };
  }
  return { pass: true, reason: 'ok' };
}

function pickKuwoVerifiedRid(cands, musicItem) {
  var ref = {
    title: musicItem && (musicItem.title || musicItem.name) || '',
    artist: (musicItem && musicItem.artist) || '',
    duration: (musicItem && musicItem.duration) || 0
  };
  var rejected = [];
  for (var i = 0; i < cands.length; i++) {
    var chk = kuwoSameSongCheck(ref, cands[i]);
    if (chk.pass) return cands[i].rid;
    rejected.push('#' + i + '[' + cands[i].name + '|' + cands[i].artist + '] ' + chk.reason + '(' + chk.detail + ')');
  }
  RESOLVE_STATS.kuwoVerifyRejected = (RESOLVE_STATS.kuwoVerifyRejected || 0) + 1;
  throw new Error('kuwo same-song check rejected all ' + cands.length + ' candidates: ' + rejected.join('; '));
}

function searchKuwoVerifiedRid(musicItem, query) {
  return searchKuwoCandidates(query).then(function (cands) {
    if (!cands.length) throw new Error('kuwo search no candidate');
    return pickKuwoVerifiedRid(cands, musicItem);
  });
}

// rid 缓存（10min TTL / FIFO 256，校验通过才写缓存）
var KW_RID_CACHE = {};
var KW_RID_CACHE_TTL = 10 * 60 * 1000;
var KW_RID_CACHE_MAX = 256;
function kwRidCacheGet(key) {
  var e = KW_RID_CACHE[key];
  if (e && Date.now() - e.ts < KW_RID_CACHE_TTL) return e.rid;
  if (e) delete KW_RID_CACHE[key];
  return null;
}
function kwRidCachePut(key, rid) {
  if (!KW_RID_CACHE[key]) {
    var ks = Object.keys(KW_RID_CACHE);
    if (ks.length >= KW_RID_CACHE_MAX) delete KW_RID_CACHE[ks[0]];
  }
  KW_RID_CACHE[key] = { rid: rid, ts: Date.now() };
}

function searchKuwoVerifiedRidCached(musicItem, query) {
  var hit = kwRidCacheGet(query);
  if (hit) return Promise.resolve(hit);
  return searchKuwoVerifiedRid(musicItem, query).then(function (rid) {
    kwRidCachePut(query, rid);
    return rid;
  });
}

// ---------- 酷我官方通道（移植自 kugou-v1912.js kuwoOfficialResolve/kuwoDesResolve/resolveKuwoFallback） ----------

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };
var KUWO_QUALITY_MAP = { standard: 'standard', high: 'high', super: 'super', low: 'standard' };

function kuwoOfficialResolve(host, rid, quality, variant) {
  var br = KUWO_BR[quality] || KUWO_BR.standard;
  var params;
  if (variant === 'car') {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: rid,
      user: 'C_APK_guanwang_' + Date.now(),
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC'
    };
  } else {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: rid,
      user: 0, android_id: 0, prod: 'kwplayerhd_ar_4.3.0.8', corp: 'kuwo',
      vipver: '4.3.0.8', source: 'kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk',
      notrace: 0, sig: 0, priority: 'bitrate', loginUid: 0, network: 'WIFI',
      loginSid: 0, mode: 'down'
    };
  }
  return axios.get('https://' + host + '/mobi.s', {
    params: params,
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo official no url');
    if ((quality === 'super' || quality === 'hires') && d.format && d.format !== 'flac') {
      throw new Error('kuwo official format degraded: ' + d.format);
    }
    if (quality === 'high' && d.format && d.format !== 'mp3') {
      throw new Error('kuwo official high format degraded: ' + d.format);
    }
    if (quality === 'high' && d.bitrate > 0 && d.bitrate < 320) {
      throw new Error('kuwo official high bitrate degraded: ' + d.bitrate);
    }
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo official trial snippet');
    var aq = (d.format === 'flac') ? 'flac'
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    var u = String(d.url).replace(/^http:\/\//i, 'https://');
    return { url: u, actualQuality: aq };
  });
}

function kuwoDesResolve(rid, quality, variant) {
  var fmt = (quality === 'super' || quality === 'hires') ? 'flac' : 'mp3';
  var q;
  if (variant === 'car') {
    q = 'user=C_APK_guanwang_' + Date.now() + '&corp=kuwo&source=kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + rid;
  } else {
    q = 'user=0&corp=kuwo&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + rid;
  }
  return axios.get('https://mobi.kuwo.cn/mobi.s', {
    params: { f: 'kuwo', q: kuwoEncryptQuery(q, 'ylzsxkwm') },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    var txt = typeof res.data === 'string' ? res.data : String(res.data || '');
    var mUrl = txt.match(/(?:^|\n)url=([^\r\n]+)/);
    var mFmt = txt.match(/(?:^|\n)format=([^\r\n]+)/);
    var mBr = txt.match(/(?:^|\n)bitrate=([^\r\n]+)/);
    var url = mUrl ? String(mUrl[1]).trim() : '';
    if (!url || !/^http/i.test(url)) throw new Error('kuwo des no url');
    var fmtGot = mFmt ? String(mFmt[1]).trim() : '';
    if ((quality === 'super' || quality === 'hires') && fmtGot !== 'flac') {
      throw new Error('kuwo des format mismatch: ' + fmtGot);
    }
    var br = parseInt(mBr ? mBr[1] : '0', 10) || 0;
    if (quality === 'high' && br > 0 && br < 320) throw new Error('kuwo des bitrate degraded: ' + br);
    var aq;
    if (fmt === 'flac') aq = 'flac';
    else aq = br >= 320 ? '320k' : (br >= 192 ? '192k' : '128k');
    return { url: String(url).replace(/^http:\/\//i, 'https://'), actualQuality: aq };
  });
}

// 官方竞速赛道：standard/low→128kmp3×3 racer；high→320kmp3×3；super→DES flac(std+car)
// + convert_url_with_sign 2000kflac×3。校验不过的候选即使先返回也直接丢弃。
function resolveKuwoOfficialLane(musicItem, quality) {
  var kwq = KUWO_QUALITY_MAP[quality];
  if (!kwq) return Promise.reject(new Error('kuwo unmapped quality: ' + quality));
  var title = musicItem && (musicItem.title || musicItem.name) ? String(musicItem.title || musicItem.name) : '';
  var artist = musicItem && musicItem.artist ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('kuwo fallback no keyword'));
  var q = artist ? title + ' ' + artist : title;
  return searchKuwoVerifiedRidCached(musicItem, q).then(function (rid) {
    var jobs;
    if (kwq === 'super') {
      jobs = [
        kuwoDesResolve(rid, 'super', 'std'),
        kuwoDesResolve(rid, 'super', 'car'),
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, 'super', 'car')
      ];
    } else {
      jobs = [
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, kwq),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, kwq),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, kwq, 'car')
      ];
    }
    return raceSuccess(jobs).then(function (r) { return { url: r.url, actualQuality: r.actualQuality }; });
  });
}

// 简化版 raceSuccess（全失败才 reject）——官方赛道内部使用
function raceSuccess(promises) {
  return new Promise(function (resolve, reject) {
    if (!promises.length) { reject(new Error('race no racers')); return; }
    var failed = 0;
    promises.forEach(function (p) {
      Promise.resolve(p).then(resolve, function () {
        failed++;
        if (failed === promises.length) reject(new Error('all racers failed'));
      });
    });
  });
}

// ---------- oiapi 通道（移植自 kuwo-v1912.js v1.9.14，三重校验口径） ----------

var OIAPI_KW_BR = { standard: '7', high: '5', super: '1' }; // 实测映射：7→128k / 5→320k / 1→2000kflac
var OIAPI_KW_AQ = { standard: '128k', high: '320k', super: 'flac' };
var OIAPI_KW_DEFAULT_KEY = 'oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575';

function kuwoUserVar(key, defVal) {
  try {
    var env = (typeof global !== 'undefined' && global.env) ? global.env : null;
    var uv = (env && typeof env.getUserVariables === 'function') ? (env.getUserVariables() || {}) : {};
    var v = uv[key];
    if (v === undefined || v === null || String(v) === '') return defVal || '';
    return String(v);
  } catch (e) { return defVal || ''; }
}

function kwFallbackEnabled() {
  var v = kuwoUserVar('qqyyKuwoFallback', 'on').toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off');
}

function kwOfficialEnabled() {
  var v = kuwoUserVar('qqyyKwOfficial', 'on').toLowerCase();
  return !(v === 'false' || v === '0' || v === 'off');
}

function kwOiapiParseSizeBytes(s) {
  // "9.31Mb" → 字节（MiB 口径：48.0Mb ↔ 50328616B Content-Length 精确匹配实测）
  var m = String(s || '').match(/([\d.]+)\s*M/i);
  return m ? Math.round(parseFloat(m[1]) * 1048576) : 0;
}

function kwOiapiResolve(raw, quality, musicItem, signal) {
  var br = OIAPI_KW_BR[quality];
  if (!br) return Promise.reject(new Error('oiapi kw: 不支持档位 ' + quality));
  var title = (musicItem && musicItem.title) ? String(musicItem.title) : '';
  var artist = (musicItem && musicItem.artist) ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('oiapi kw: 缺少歌名（搜索型通道需 musicItem.title）'));
  var msg = artist ? (artist + ' ' + title) : title;
  return axios.get('https://oiapi.net/api/Kuwo', {
    params: { key: kuwoUserVar('kwOiapiKey', OIAPI_KW_DEFAULT_KEY), msg: msg, n: 1, br: br },
    timeout: RELAY_TIMEOUT, signal: signal || undefined,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data || {};
    var dd = (d.data && typeof d.data === 'object') ? d.data : {};
    var mm = typeof d.message === 'string' ? d.message.match(/音乐链接：\s*(\S+)/) : null;
    var url = mm ? mm[1] : '';
    if (d.code !== 1 || !url || !/^https?:\/\//i.test(url)) throw new Error('oiapi kw 无有效 url (code ' + d.code + ')');
    // ① 搜索命中校验：归一化互含，防模糊匹配串歌
    var wantT = normalizeTitle(title), gotT = normalizeTitle(dd.song);
    if (!wantT || !gotT || (wantT.indexOf(gotT) < 0 && gotT.indexOf(wantT) < 0)) {
      throw new Error('oiapi kw 搜索未命中: ' + dd.song);
    }
    if (artist && dd.singer) {
      var wantA = normalizeArtist(artist), gotA = normalizeArtist(dd.singer);
      if (wantA && gotA && wantA.indexOf(gotA) < 0 && gotA.indexOf(wantA) < 0) {
        throw new Error('oiapi kw 歌手不匹配: ' + dd.singer);
      }
    }
    // ② 档位真实校验：低于请求档拒收（不降级，交竞速对手）
    var bit = parseInt(dd.bitrate, 10) || 0;
    if (quality === 'super') {
      if (dd.format !== 'flac' || bit < 2000) throw new Error('oiapi kw super 降级: ' + dd.format + '/' + bit);
    } else if (quality === 'high') {
      if (bit < 320 || (dd.format && dd.format !== 'mp3')) throw new Error('oiapi kw high 降级: ' + dd.format + '/' + bit);
    } else if (bit < 128) {
      throw new Error('oiapi kw standard 降级: ' + dd.format + '/' + bit);
    }
    return { url: url, actualQuality: OIAPI_KW_AQ[quality], declaredSize: kwOiapiParseSizeBytes(dd.size) };
  });
}

// ---------- 酷我兜底编排：oiapi（0ms 起跑）‖ 官方赛道（250ms 错峰）竞速 ----------
function resolveKuwoFallbackChain(musicItem, q, deadline) {
  var kwq = KUWO_QUALITY_MAP[q] || 'standard';
  var lanes = [
    {
      delay: 0,
      build: function (signal) {
        return kwOiapiResolve(musicItem, kwq, musicItem, signal).then(function (r) {
          if (!isAllowedMediaUrl(r.url)) throw new Error('oiapi kw URL 未通过协议/域名校验');
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality, declaredSize: r.declaredSize }, signal)
            .then(function () {
              RESOLVE_STATS.kuwoOiapi = (RESOLVE_STATS.kuwoOiapi || 0) + 1;
              return { url: r.url, actualQuality: r.actualQuality, size: r.declaredSize || 0, channel: 'kuwo:oiapi' };
            });
        });
      }
    }
  ];
  if (kwOfficialEnabled()) {
    lanes.push({
      delay: 250,
      build: function (signal) {
        return resolveKuwoOfficialLane(musicItem, kwq).then(function (r) {
          if (!isAllowedMediaUrl(r.url)) throw new Error('kuwo official URL 未通过协议/域名校验');
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
            .then(function () {
              RESOLVE_STATS.kuwoOfficial = (RESOLVE_STATS.kuwoOfficial || 0) + 1;
              return { url: r.url, actualQuality: r.actualQuality, size: 0, channel: 'kuwo:official' };
            });
        });
      }
    });
  }
  var remain = deadline - Date.now();
  if (remain <= 500) return Promise.reject(new Error('[qianqian] 酷我兜底：超出全局超时预算'));
  return withTimeout(racePriority(lanes), remain, '[qianqian] 酷我兜底取链超时 ' + remain + 'ms');
}

// ==================== getMediaSource 编排 ====================
// 千千四档回退链先行 → 全败（含 path 空/虚标/魔数不符/超时）→ 酷我兜底竞速 → 如实标注来源。

var RESOLVE_STATS = {
  total: 0, qq3000: 0, qq320: 0, qq128: 0, qq64: 0,
  qqAllFail: 0, kuwoFallbackUsed: 0, kuwoOiapi: 0, kuwoOfficial: 0, kuwoVerifyRejected: 0
};

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem) throw new Error('[qianqian] missing musicItem');
  var q = normalizeQuality(quality);
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  RESOLVE_STATS.total++;
  var r = null, qqErr = null;
  try {
    r = await resolveQianqianChain(musicItem, q, deadline);
  } catch (e) {
    qqErr = e;
    RESOLVE_STATS.qqAllFail++;
  }
  if (!r) {
    if (!kwFallbackEnabled()) {
      throw qqErr || new Error('[qianqian] 取链失败（酷我兜底已关闭）');
    }
    RESOLVE_STATS.kuwoFallbackUsed++;
    r = await resolveKuwoFallbackChain(musicItem, q, deadline);
    r.fromFallback = 'kuwo'; // 如实标记来源为酷我兜底
  }
  // 边界回填（对齐 kugou/kuwo 模板）：quality=actualQuality + size 兜底探测
  r.quality = r.actualQuality || q;
  if (r.url && !r.size) {
    var sz = await probeHeadSize(r.url, 2000);
    if (sz > 0) r.size = sz;
  }
  if (r.url) r.headers = { 'User-Agent': QQ_UA };
  return r;
}

// ==================== 插件对象 ====================

var plugin = {
  name: '千千音乐',
  platform: 'qianqian',
  version: '1.0.2',
  author: '研发3号',
  description: '千千音乐（91Q/Taihe）独立源插件 v1.0.2：MD5 签名（ASCII 升序+Secret 末尾追加，纯 JS 实现无 Buffer 依赖）；搜索歌曲（VIP 过滤）/搜索专辑（关键词净化重试）；播放取链走 /v1/song/tracklink 四档回退（3000 无损/320 极高/128 标准/64 低品 aac，path 空回退试听链），链接经音流口径严格校验（Content-Length 与声明 size 比对虚标拦截 + 魔数白名单 fail-closed + 试听/码率守卫）；千千全档失败自动酷我兜底（oiapi+官方 mobi.s 双通道竞速，严格同曲校验防串歌，结果如实标记来源）；歌词两步流程原文返回；歌单走分类列表+详情（搜索歌单 type=6 上游已失效不实现）；专辑/歌单导入与分享链接解析；无官方榜单 API，榜单入口以精选歌单顶位',
  primaryKey: ['id'],
  supportedSearchType: ['music', 'album'], // 搜索歌单 type=6 已失效（文档 3.3 实测），不实现
  defaultSearchType: 'music',
  // 64k 档为 AAC 低品（文档实测修正），参与回退链；192k 无对应 rate 不虚标透出
  supportedQualities: ['64k', '128k', '320k', 'flac'],
  cacheControl: 'no-store', // 千千 tracklink 为时效直链，必须现取
  userVariables: [
    { key: 'qqyyKuwoFallback', name: '酷我兜底（可选）', hint: '千千取链全败时按歌名+歌手经酷我通道兜底取链；默认开启，填 false/0/off 关闭' },
    { key: 'qqyyKwOfficial', name: '酷我官方通道（可选）', hint: '兜底竞速中的酷我官方 mobi.s 通道开关；默认开启，填 false/0/off 关闭' },
    { key: 'kwOiapiKey', name: 'oiapi 酷我 Key（可选）', hint: '兜底 oiapi 通道 Key，留空使用内置默认值' }
  ],
  hints: {
    search: ['搜索千千音乐曲库（VIP 曲目已过滤）', '播放走千千官方直链，按音质自动回退；全档失败自动酷我兜底并如实标注来源'],
    importMusicSheet: ['支持千千歌单链接，如 music.91q.com/songlist/123456', '也支持 tracklist/playlist 链接与纯歌单 ID']
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim() : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    if (type === 'album') return searchAlbumImpl(kw, page);
    if (type !== 'music') return { isEnd: true, data: [] };
    return searchMusicImpl(kw, page);
  },

  async getMediaSource(musicItem, quality) {
    return getMediaSourceImpl(musicItem, quality);
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getMusicDetailPageUrl(musicItem) {
    var tsid = musicItem && musicItem.id ? str(musicItem.id) : '';
    return tsid ? 'https://music.91q.com/song/' + tsid : null;
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async getAlbumInfo(albumItem, page) {
    return getAlbumInfoImpl(albumItem, page);
  },

  async getMusicSheetInfo(urlLike) {
    return getMusicSheetInfoImpl(urlLike);
  },

  async getRecommendSheetTags() {
    return getRecommendSheetTagsImpl();
  },

  async getRecommendSheetsByTag(tagItem, page) {
    return getRecommendSheetsByTagImpl(tagItem, page);
  },

  _internal: {
    resolveStats: RESOLVE_STATS,
    signParams: qqSign,
    normalizeQuality: normalizeQuality,
    normalizeAlbumCode: normalizeAlbumCode,
    parseSheetId: parseSheetId,
    purifyKeyword: purifyKeyword,
    kuwoSameSongCheck: kuwoSameSongCheck,
    md5Hex: md5Hex,
    qqGet: qqGet,
    qqResolveRate: qqResolveRate,
    qqVerifyRate: qqVerifyRate,
    detectAudioMagic: detectAudioMagic,
    isAllowedMediaUrl: isAllowedMediaUrl,
    verifyMediaSizeStrict: verifyMediaSizeStrict
  }
};

module.exports = plugin;
