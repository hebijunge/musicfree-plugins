/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「Apple Music」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * Apple Music 独立源插件（MusicFree）
 * ================================
 * v1.0.0（2026-09-24，独立版起步，研发1号）
 *
 * 【产品定位】Apple Music 目录元数据源（搜索/歌单/专辑/分类歌单）+ 酷我兜底播放取链。
 *
 * 【为什么播放取链走酷我兜底（用户明确要求）】
 * Apple Music 公开 API（amp-api.music.apple.com）对未订阅请求只返回 30~90 秒预览片段
 * （attributes.previews[0].url，M4A/AAC 96~128kbps）；完整曲目需要订阅 + FairPlay DRM 解密，
 * 插件形态不可行（AppleMusic接口完整文档_综合实测版.md 第 3/5 章）。因此本插件：
 *   - 播放主路径 = 酷我通道兜底（移植自 kugou-v1913.js v1.9.14 的 resolveKuwoFallback，
 *     kuwo-source v1.4.3 同源实现）：按歌曲 name+artistName 搜索酷我 → 严格同曲校验
 *     （核心歌名+版本标签+歌手+时长四项）→ 官方 mobi.s 竞速取链；
 *   - 酷我兜底取链走音流口径验证：请求哪个音质就取哪个音质（super 拒非 flac、high 拒
 *     <320kbps）、Range 探测 Content-Length 码率比对（<64kbps 判试听拒收）+ 魔数校验
 *     （fLaC/ID3/ftyp/帧同步）；
 *   - 预览片段仅作酷我兜底失败时的次选（返回体 channel='apple-music:preview-clip'，
 *     previewClip:true 如实标注），绝不把 30~90 秒预览当完整曲目交付。
 *
 * 【Token 两步提取（文档 2.5，实测 ~70 天有效）】
 *   1) GET https://music.apple.com 首页 HTML → 正则 /assets\/index-legacy[~\-][^\/"]+\.js/
 *      提取 JS 路径（文件名哈希动态提取，不硬编码）；
 *   2) GET JS 文件 → 正则 (?:=["'])(eyJ[A-Za-z0-9_.\-]+) 提取全部 JWT（踩坑#1：前缀用
 *      eyJ 通用匹配而非 eyJh）→ 逐个解码 payload → 筛选 iss==='AMPWebPlay'（踩坑#2：
 *      JS 内有 2 个 JWT，另一个 iss 为 10 位 Team ID）→ 缓存并在 exp 过期前刷新（余量 1 天）。
 *
 * 【接口接入（文档 4.1~4.8）】
 *   - 搜索  /v1/catalog/{sf}/search        term + types=songs,albums,playlists + limit/offset
 *   - 歌曲  /v1/catalog/{sf}/songs/{id}    extend=extendedAssetUrls&include=lyrics,albums
 *   - 专辑  /v1/catalog/{sf}/albums/{id}   tracks 全量返回无分页（文档 4.5）
 *   - 歌单  /v1/catalog/{sf}/playlists/{id} limit[tracks]=300 + next 游标翻页
 *           （踩坑#8：首次响应在 relationships.tracks.data、翻页响应在顶层 data，两种结构都处理）
 *   - 分类歌单 /v1/catalog/cn/apple-curators/{categoryID}/playlists
 *           （踩坑#10：storefront 固定 cn，29 个分类硬编码文档 4.7 清单）
 *   - 封面  artwork.url {w}/{h} 占位符替换：歌曲 600、专辑/歌单 300（踩坑#7）
 *
 * 【歌词（getLyric，文档 4.4）】
 *   歌词接口需要登录态（media-user-token）；插件默认无登录态 → relationships 不含 lyrics
 *   字段 → 如实抛错说明需在插件设置中配置 media-user-token，不伪造歌词。配置后拉取
 *   TTML 并转 LRC（begin="HH:MM:SS.mmm" → [MM:SS.mm]，踩坑#14）。
 *
 * 【storefront】默认 us，userVariables.appleStorefront 可切 cn/hk/jp/tw 等；分类歌单固定 cn。
 *
 * 【踩坑清单对照（文档 10 章 14 条）】
 *   #1  Token 正则 eyJ 通用匹配            → token 提取正则（本文件 getToken）
 *   #2  多 Token 筛选 iss=AMPWebPlay       → getToken payload 筛选
 *   #3  Token ~70 天有效期                 → 缓存 + exp 余量 1 天自动刷新
 *   #4  歌词需登录态 media-user-token      → getLyric 如实抛错/配置后启用
 *   #5  公开 API 仅 30~90s 预览            → 酷我兜底为主路径，预览仅次选并标注
 *   #6  预览 Content-Type audio/x-m4p 非标准 → 校验忽略 Content-Type，用魔数 ftyp 判定
 *   #7  封面 {w}/{h} 占位符                → artworkOf() 统一替换（歌曲600/专辑歌单300）
 *   #8  歌单翻页结构差异                   → fetchPlaylistTracks 双结构处理
 *   #9  trackCount=None                   → 按实际分页长度计数，不读 trackCount
 *   #10 分类歌单固定 cn                    → CURATORS 基础路径硬编码 /v1/catalog/cn/
 *   #11 storefront 不匹配 404              → ampGet 对 404 抛带 storefront 的可读错误
 *   #12 预览防盗链                         → 预览请求/返回体带 Referer: https://music.apple.com
 *   #13 JS 文件名哈希动态提取              → 不硬编码 index-legacy~xxx.js
 *   #14 TTML begin="HH:MM:SS.mmm"          → ttmlToLrc 支持时/分/秒三段与两段格式
 *
 * 【平台兼容】axios only，无 Buffer/BigInt 依赖（Hermes/RN 宿主安全）；DES 为纯 JS 实现。
 */

const axios = require('axios');

var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
var HOME_URL = 'https://music.apple.com';
var AMP_API = 'https://amp-api.music.apple.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
var PLATFORM = 'apple-music';

// 歌单/榜单拉取上限：单页 300（limit[tracks]=300），最多翻 3 页 = 900 首。
// Apple 编辑歌单极少超过 600 首；诚实封顶并在返回 isEnd:true，不静默截断为空。
var SHEET_PAGE_SIZE = 300;
var SHEET_MAX_PAGES = 3;

function str(v) { return v === undefined || v === null ? '' : String(v); }

// userVariables 读取（沙箱无 env 时安全返回空对象，与 kugou/kuwo 插件同构）
function userVariablesSafe() {
  var env = typeof global !== 'undefined' && global.env ? global.env : null;
  if (env && env.getUserVariables) {
    try { return env.getUserVariables() || {}; } catch (e) { /* 沙箱无 env */ }
  }
  return {};
}

// storefront：默认 us，userVariables.appleStorefront 可切（us/cn/hk/jp/tw/...）
function storefrontOf() {
  var sf = String(userVariablesSafe().appleStorefront || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(sf) ? sf : 'us';
}

// 歌词用登录态（可选）：媒体用户 token，仅 getLyric 消费
function mediaUserTokenOf() {
  var t = String(userVariablesSafe().appleMediaUserToken || '').trim();
  return t || '';
}

// ==================== 纯 JS 编解码（无 Buffer 依赖，Hermes 安全） ====================

function utf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | (cp & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}

function utf8Decode(bytes) {
  var out = '', i = 0;
  while (i < bytes.length) {
    var b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if (b < 0xE0) { out += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
    else if (b < 0xF0) {
      out += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3;
    } else {
      var cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
      cp -= 0x10000;
      out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); i += 4;
    }
  }
  return out;
}

// base64 / base64url → bytes（宽容策略：剥离非 alphabet 字符，兼容 JWT 的 -_ 变体）
var B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(input) {
  var s = String(input || '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+\/=]/g, '');
  var out = [];
  var i = 0;
  while (i < s.length) {
    var b0 = B64_ALPHABET.indexOf(s.charAt(i));
    var b1 = B64_ALPHABET.indexOf(s.charAt(i + 1));
    var b2 = i + 2 < s.length ? B64_ALPHABET.indexOf(s.charAt(i + 2)) : -1;
    var b3 = i + 3 < s.length ? B64_ALPHABET.indexOf(s.charAt(i + 3)) : -1;
    if (b0 < 0 || b1 < 0) break;
    out.push((b0 << 2) | (b1 >> 4));
    if (b2 >= 0 && s.charAt(i + 2) !== '=') out.push(((b1 & 15) << 4) | (b2 >> 2));
    if (b3 >= 0 && s.charAt(i + 3) !== '=') out.push(((b2 & 3) << 6) | (b3 & 63));
    i += 4;
  }
  return out;
}

// ==================== Web 内部 Token（两步提取 + 缓存刷新，文档 2.5） ====================

var TOKEN_STATE = { token: '', exp: 0, iat: 0, fetchedAt: 0 };
var TOKEN_EXPIRY_MARGIN_MS = 24 * 3600 * 1000; // exp 过期前 1 天刷新（~70 天有效期足够宽裕）

// 解码 JWT payload 并筛选 iss==='AMPWebPlay'（踩坑#1/#2：eyJ 通用前缀 + 多 Token 筛选）
function pickWebPlayToken(jsText) {
  var re = /(?:=["'])(eyJ[A-Za-z0-9_.\-]+)/g;
  var m;
  var found = 0;
  while ((m = re.exec(jsText)) !== null) {
    found++;
    var parts = m[1].split('.');
    if (parts.length !== 3) continue;
    try {
      var payload = JSON.parse(utf8Decode(b64ToBytes(parts[1])));
      if (payload && payload.iss === 'AMPWebPlay') {
        return { token: m[1], iat: payload.iat || 0, exp: payload.exp || 0 };
      }
    } catch (e) { /* 非法 JWT，继续下一个 */ }
  }
  throw new Error('apple token extract failed: ' + found + ' jwt(s) found, none iss=AMPWebPlay');
}

// 从首页 HTML 提取 index-legacy JS 路径（踩坑#13：文件名哈希动态提取）
function extractJsPath(html) {
  var m = /assets\/index-legacy[~\-][^\/"]+\.js/.exec(String(html || ''));
  if (!m) throw new Error('apple token step1 failed: index-legacy js not found in homepage');
  return HOME_URL + '/' + m[0];
}

// 完整两步提取（不并发调用：getToken 内部有互斥 promise）
function fetchToken() {
  return axios.get(HOME_URL, {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': UA },
    // 首页 HTML ~1.7MB，只需要正文做正则
    responseType: 'text'
  }).then(function (res) {
    var jsUrl = extractJsPath(res.data);
    return axios.get(jsUrl, {
      timeout: SOURCE_TIMEOUT,
      headers: { 'User-Agent': UA, Referer: HOME_URL },
      responseType: 'text'
    }).then(function (res2) {
      var picked = pickWebPlayToken(res2.data);
      TOKEN_STATE.token = picked.token;
      TOKEN_STATE.iat = picked.iat;
      TOKEN_STATE.exp = picked.exp;
      TOKEN_STATE.fetchedAt = Date.now();
      return TOKEN_STATE.token;
    });
  });
}

var TOKEN_PENDING = null;

// 缓存优先；缺失或 exp 过期前余量不足 1 天时重新提取
function getToken() {
  var fresh = TOKEN_STATE.token &&
    (!TOKEN_STATE.exp || TOKEN_STATE.exp * 1000 - Date.now() > TOKEN_EXPIRY_MARGIN_MS);
  if (fresh) return Promise.resolve(TOKEN_STATE.token);
  if (!TOKEN_PENDING) {
    TOKEN_PENDING = fetchToken().then(function (t) {
      TOKEN_PENDING = null;
      return t;
    }, function (e) {
      TOKEN_PENDING = null;
      throw e;
    });
  }
  return TOKEN_PENDING;
}

// ==================== amp-api 基础层 ====================

// 统一 GET：Bearer Token + Origin（文档 3.x 请求头要求）+ 可选 media-user-token
function ampGet(path, params, opts) {
  opts = opts || {};
  return getToken().then(function (token) {
    var headers = {
      Authorization: 'Bearer ' + token,
      Origin: HOME_URL,
      Referer: HOME_URL + '/',
      'User-Agent': UA
    };
    var mut = opts.mediaUserToken || mediaUserTokenOf();
    if (mut) headers['media-user-token'] = mut;
    var p = Object.assign({}, params || {});
    if (!opts.noLocale && storefrontOf() === 'cn') p.l = p.l || 'zh-Hans-CN';
    return axios.get(AMP_API + path, {
      params: p,
      timeout: SOURCE_TIMEOUT,
      headers: headers
    });
  }).then(function (res) {
    return res.data || {};
  }, function (err) {
    // 踩坑#11：storefront 不匹配等 404 场景给出可读错误
    var status = err && err.response && err.response.status;
    if (status === 404) {
      var mSf404 = /\/catalog\/([a-z]{2})\//i.exec(path);
      throw new Error('apple api 404: ' + path + ' (storefront=' + (mSf404 ? mSf404[1] : storefrontOf()) + '，可尝试在插件设置切换 storefront)');
    }
    if (status === 401 || status === 403) {
      throw new Error('apple api ' + status + ': token 失效或无权限，将自动重取 token 重试');
    }
    throw err;
  });
}

// 401/403 时强制刷新 token 重试一次（token 被风控下线场景）
function ampGetWithRetry(path, params, opts) {
  return ampGet(path, params, opts).catch(function (e) {
    if (/^apple api (401|403)/.test(String(e && e.message))) {
      TOKEN_STATE.token = '';
      TOKEN_STATE.exp = 0;
      return ampGet(path, params, opts);
    }
    throw e;
  });
}

// ==================== 封面与条目构造（踩坑#7/#9） ====================

// artwork.url {w}/{h} 占位符替换：歌曲 600、专辑/歌单 300
function artworkOf(artwork, size) {
  var u = artwork && artwork.url;
  if (!u) return '';
  return String(u).replace(/\{w\}/g, String(size)).replace(/\{h\}/g, String(size));
}

// 歌曲 attributes → 宿主 MusicItem（酷我兜底取链所需 title/artist/duration 全齐）
function buildMusicItem(id, attr, extra) {
  attr = attr || {};
  var item = {
    id: str(id),
    title: str(attr.name),
    artist: str(attr.artistName),
    album: str(attr.albumName),
    artwork: artworkOf(attr.artwork, 600),
    duration: Math.round((attr.durationInMillis || 0) / 1000),
    platform: PLATFORM
  };
  var pv = attr.previews && attr.previews[0] && attr.previews[0].url;
  if (pv) item._preview = str(pv);
  if (attr.url) item._webUrl = str(attr.url);
  if (extra) {
    for (var k in extra) { if (extra[k] !== undefined) item[k] = extra[k]; }
  }
  return item;
}

function buildAlbumItem(id, attr) {
  attr = attr || {};
  return {
    id: str(id),
    title: str(attr.name),
    artist: str(attr.artistName),
    artwork: artworkOf(attr.artwork, 300),
    date: str(attr.releaseDate || ''),
    description: (attr.editorialNotes && str(attr.editorialNotes.short)) || '',
    worksNum: typeof attr.trackCount === 'number' ? attr.trackCount : undefined, // 踩坑#9：可为 null
    platform: PLATFORM
  };
}

function buildSheetItem(id, attr, extra) {
  attr = attr || {};
  var item = {
    id: str(id),
    title: str(attr.name),
    artist: str(attr.curatorName || attr.artistName || 'Apple Music'),
    artwork: artworkOf(attr.artwork, 300),
    description: (attr.editorialNotes && str(attr.editorialNotes.short)) || '',
    platform: PLATFORM
  };
  if (extra) {
    for (var k in extra) { if (extra[k] !== undefined) item[k] = extra[k]; }
  }
  return item;
}

// 歌单/专辑 tracks relationships.data[] → 歌曲条目（过滤非 songs 条目如 music-videos）
function tracksToMusicList(dataArr) {
  var out = [];
  var arr = Array.isArray(dataArr) ? dataArr : [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i] || {};
    if (it.type && it.type !== 'songs') continue;
    out.push(buildMusicItem(it.id, it.attributes, { order: out.length + 1 }));
  }
  return out;
}

// ==================== 搜索 / 详情（文档 4.1~4.5） ====================

async function searchMusicImpl(keyword, page) {
  var limit = 25;
  var offset = (Math.max(1, page) - 1) * limit;
  var r = await ampGet('/v1/catalog/' + storefrontOf() + '/search', {
    term: keyword, types: 'songs', limit: limit, offset: offset
  });
  var songs = r.results && r.results.songs;
  var dataArr = (songs && songs.data) || [];
  var data = [];
  for (var i = 0; i < dataArr.length; i++) {
    data.push(buildMusicItem(dataArr[i].id, dataArr[i].attributes));
  }
  // 返回数 < limit 视为末页；等于 limit 时 Apple 侧通常还有下一页
  return { isEnd: dataArr.length < limit, data: data };
}

async function searchAlbumImpl(keyword, page) {
  var limit = 20;
  var offset = (Math.max(1, page) - 1) * limit;
  var r = await ampGet('/v1/catalog/' + storefrontOf() + '/search', {
    term: keyword, types: 'albums', limit: limit, offset: offset
  });
  var albums = r.results && r.results.albums;
  var dataArr = (albums && albums.data) || [];
  var data = [];
  for (var i = 0; i < dataArr.length; i++) {
    data.push(buildAlbumItem(dataArr[i].id, dataArr[i].attributes));
  }
  return { isEnd: dataArr.length < limit, data: data };
}

async function searchSheetImpl(keyword, page) {
  var limit = 20;
  var offset = (Math.max(1, page) - 1) * limit;
  var r = await ampGet('/v1/catalog/' + storefrontOf() + '/search', {
    term: keyword, types: 'playlists', limit: limit, offset: offset
  });
  var pls = r.results && r.results.playlists;
  var dataArr = (pls && pls.data) || [];
  var data = [];
  for (var i = 0; i < dataArr.length; i++) {
    data.push(buildSheetItem(dataArr[i].id, dataArr[i].attributes));
  }
  return { isEnd: dataArr.length < limit, data: data };
}

// 歌曲详情：extend=extendedAssetUrls&include=lyrics,albums（文档 4.2）
async function getMusicInfoImpl(musicItem) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var r = await ampGetWithRetry('/v1/catalog/' + storefrontOf() + '/songs/' + musicItem.id, {
    extend: 'extendedAssetUrls',
    include: 'lyrics,albums'
  });
  var song = r.data && r.data[0];
  if (!song) throw new Error('apple song not found: ' + musicItem.id);
  var item = buildMusicItem(song.id, song.attributes);
  // 保留传入条目已有的字段（如播放队列中的 _preview），详情值优先
  var merged = {};
  for (var k in musicItem) { if (k !== '_preview' && k !== '_webUrl') merged[k] = musicItem[k]; }
  for (var k2 in item) { merged[k2] = item[k2]; }
  return merged;
}

// 专辑详情：tracks 全量返回无分页（文档 4.5）
async function getAlbumInfoImpl(albumItem) {
  if (!albumItem || !albumItem.id) throw new Error('missing albumItem.id');
  var r = await ampGetWithRetry('/v1/catalog/' + storefrontOf() + '/albums/' + albumItem.id, {
    extend: 'extendedAssetUrls'
  });
  var album = r.data && r.data[0];
  if (!album) throw new Error('apple album not found: ' + albumItem.id);
  var rel = album.relationships || {};
  var item = buildAlbumItem(album.id, album.attributes);
  var merged = {};
  for (var k in albumItem) { merged[k] = albumItem[k]; }
  for (var k2 in item) { merged[k2] = item[k2]; }
  return {
    isEnd: true,
    albumItem: merged,
    musicList: tracksToMusicList(rel.tracks && rel.tracks.data)
  };
}

// 歌单详情 + next 游标翻页（踩坑#8：首次在 relationships.tracks.data，翻页在顶层 data）
async function fetchPlaylistTracks(playlistId, maxPages, sfOverride) {
  var sf = sfOverride || storefrontOf(); // 踩坑#11：歌单链接自带 storefront 时优先用之
  var r = await ampGetWithRetry('/v1/catalog/' + sf + '/playlists/' + playlistId, {
    'limit[tracks]': SHEET_PAGE_SIZE,
    extend: 'extendedAssetUrls'
  });
  var pl = r.data && r.data[0];
  if (!pl) throw new Error('apple playlist not found: ' + playlistId);
  var rel = pl.relationships || {};
  var tr = rel.tracks || {};
  var musicList = tracksToMusicList(tr.data);
  var next = tr.next || '';
  var pages = 1;
  var cap = Math.max(1, maxPages || SHEET_MAX_PAGES);
  while (next && pages < cap) {
    var page = await ampGet(next, {}, { noLocale: true }); // next 为完整路径（含 query），仅带 token
    var pageData = page.data || (page.relationships && page.relationships.tracks && page.relationships.tracks.data) || [];
    musicList = musicList.concat(tracksToMusicList(pageData));
    next = page.next || (page.relationships && page.relationships.tracks && page.relationships.tracks.next) || '';
    pages++;
  }
  return {
    playlist: buildSheetItem(pl.id, pl.attributes),
    musicList: musicList,
    // 踩坑#9：trackCount 可为 null，按实际分页长度计数
    total: musicList.length,
    hasMore: !!next && pages >= cap
  };
}

async function getMusicSheetInfoImpl(sheetItem, page) {
  if (page && page > 1) return { isEnd: true, musicList: [] };
  var pid = sheetIdOf(sheetItem);
  var out = await fetchPlaylistTracks(pid, SHEET_MAX_PAGES);
  var merged = {};
  for (var k in sheetItem) { merged[k] = sheetItem[k]; }
  if (out.playlist.title && !merged.title) merged.title = out.playlist.title;
  if (out.playlist.artwork && !merged.artwork) merged.artwork = out.playlist.artwork;
  if (out.playlist.description && !merged.description) merged.description = out.playlist.description;
  return { isEnd: true, sheetItem: merged, musicList: out.musicList };
}

// 歌单条目 id 归一：支持 'apl_pl.xxx' / 'pl.xxx' / 纯 id
function sheetIdOf(sheetItem) {
  var id = str(sheetItem && sheetItem.id);
  var m = /^(?:apl_)?(pl\.[0-9a-z\-]+)$/i.exec(id);
  if (m) return m[1];
  if (/^pl\./i.test(id)) return id;
  if (/^\d+$/.test(id)) return id;
  throw new Error('无法识别的 Apple Music 歌单 id: ' + id);
}


// ==================== 分类歌单（文档 4.7，29 分类硬编码，固定 cn） ====================

// 踩坑#10：分类接口 storefront 固定 cn，不随实例配置 → 基础路径硬编码 /v1/catalog/cn/
var CURATORS_BASE = '/v1/catalog/cn/apple-curators';

// 29 个分类完整清单（AppleMusic接口完整文档_综合实测版.md 4.7，2026-08-28 实测）
var CATEGORIES = [
  { id: '1526756058', title: '热门' },
  { id: '1479949880', title: 'C-Pop' },
  { id: '1019400042', title: '国语流行' },
  { id: '1019398918', title: '粤语流行' },
  { id: '1019399540', title: '国际流行' },
  { id: '1019399551', title: 'K-Pop' },
  { id: '1019399547', title: 'J-Pop' },
  { id: '989061415', title: '嘻哈 / 说唱' },
  { id: '1019400044', title: 'R&B' },
  { id: '1019400046', title: '摇滚' },
  { id: '1019397973', title: '另类音乐' },
  { id: '976439535', title: '舞曲' },
  { id: '976439536', title: '电子' },
  { id: '976439541', title: '独立音乐' },
  { id: '1019399549', title: '爵士乐' },
  { id: '1019398924', title: '古典音乐' },
  { id: '976439528', title: '蓝调' },
  { id: '976439534', title: '乡村音乐' },
  { id: '1531542847', title: '拉丁音乐' },
  { id: '988656348', title: '非洲音乐' },
  { id: '976439543', title: '金属乐' },
  { id: '976439550', title: '朋克乐' },
  { id: '1019400049', title: '不插电' },
  { id: '1231181168', title: '影视原声' },
  { id: '1441811365', title: 'DJ 混音精选' },
  { id: '1532467784', title: '瞩目之星' },
  { id: '1554938339', title: '年代之声' },
  { id: '1564180390', title: '空间音频' },
  { id: '989010186', title: '亲子' }
];

function categoryOf(cid) {
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].id === String(cid)) return CATEGORIES[i];
  }
  return null;
}

// 分类下的歌单列表（真分页：limit + offset）
async function fetchCategorySheets(cid, page) {
  var limit = 20;
  var offset = (Math.max(1, page) - 1) * limit;
  var r = await ampGet(CURATORS_BASE + '/' + cid + '/playlists', {
    limit: limit,
    offset: offset,
    l: 'zh-Hans-CN'
  }, { noLocale: true });
  var dataArr = r.data || [];
  var sheetList = [];
  for (var i = 0; i < dataArr.length; i++) {
    sheetList.push(buildSheetItem(dataArr[i].id, dataArr[i].attributes, { tag: String(cid) }));
  }
  return { isEnd: dataArr.length < limit, data: sheetList };
}

// ==================== 榜单（getTopLists / getTopListDetail） ====================
// 形态对齐 kuwo 插件：getTopLists 返回 [{title, data:[{id,title,coverImg,artwork}]}]，
// getTopListDetail 返回 {isEnd, musicList, topListItem}。
// 条目 id 前缀：apl_<playlistId>（榜单卡=分类下的真实歌单，点击直达歌曲列表）；
// 降级路径 acat_<categoryId>（网络失败时静态分类条目，detail 取该分类第一个歌单的歌曲）。

async function getTopListsImpl() {
  try {
    var hot = await fetchCategorySheets('1526756058', 1);
    if (!hot.data.length) throw new Error('empty curators');
    return [{
      title: 'Apple Music 精选歌单',
      data: hot.data.map(function (s) {
        return { id: 'apl_' + s.id, title: s.title, coverImg: s.artwork, artwork: s.artwork };
      })
    }];
  } catch (e) {
    // 降级：静态分类条目（入口不白屏）
    return [{
      title: 'Apple Music 分类',
      data: CATEGORIES.map(function (c) {
        return { id: 'acat_' + c.id, title: c.title, coverImg: '', artwork: '' };
      })
    }];
  }
}

// 从歌单 id 拉歌曲列表并包成 topListDetail 返回
async function topListDetailFromPlaylist(pid, topListItem) {
  var out = await fetchPlaylistTracks(pid, SHEET_MAX_PAGES);
  return {
    isEnd: true,
    musicList: out.musicList,
    topListItem: {
      id: topListItem.id,
      title: topListItem.title || out.playlist.title,
      coverImg: topListItem.coverImg || out.playlist.artwork,
      artwork: topListItem.artwork || out.playlist.artwork,
      platform: PLATFORM
    }
  };
}

async function getTopListDetailImpl(topListItem, page) {
  if (page && page > 1) return { isEnd: true, musicList: [] };
  var tid = str(topListItem && topListItem.id);
  var mPl = /^apl_(.+)$/.exec(tid);
  if (mPl) return topListDetailFromPlaylist(mPl[1], topListItem);
  var mCat = /^acat_(\d+)$/.exec(tid);
  if (mCat) {
    // 降级条目：取该分类第一个歌单的歌曲（分类 → 歌单 → 歌曲的契约内压缩）
    var sheets = await fetchCategorySheets(mCat[1], 1);
    if (!sheets.data.length) throw new Error('该分类暂无歌单: ' + mCat[1]);
    return topListDetailFromPlaylist(sheets.data[0].id, {
      id: topListItem.id,
      title: topListItem.title + ' · ' + sheets.data[0].title,
      coverImg: sheets.data[0].artwork,
      artwork: sheets.data[0].artwork
    });
  }
  // 兜底：直接当歌单 id 处理
  return topListDetailFromPlaylist(tid, topListItem);
}

// ==================== 歌单广场（分类标签 → 歌单列表） ====================

async function getRecommendSheetTagsImpl() {
  // pinned = 横向快捷标签栏（宿主 sheetBody 渲染）；data = 分组数组
  return {
    pinned: [
      { id: 'acat_1526756058', title: '热门' },
      { id: 'acat_1019400042', title: '国语流行' },
      { id: 'acat_1479949880', title: 'C-Pop' }
    ],
    data: [
      { title: 'Apple Music 分类歌单', data: CATEGORIES.map(function (c) { return { id: 'acat_' + c.id, title: c.title }; }) }
    ]
  };
}

async function getRecommendSheetsByTagImpl(tag, page) {
  var tid = str(tag && tag.id);
  var mCat = /^acat_(\d+)$/.exec(tid);
  if (mCat) return fetchCategorySheets(mCat[1], page);
  // 无 tag（默认 tab）→ 热门分类
  return fetchCategorySheets('1526756058', page);
}

// ==================== 分享链接导入（单曲 / 歌单） ====================

// Apple Music 分享链形态（文档 4.9/附录）：
//   歌曲 https://music.apple.com/cn/song/<slug>/<id>?i=<songId>
//   专辑 https://music.apple.com/cn/album/<slug>/<id>?i=<songId>
//   歌单 https://music.apple.com/cn/playlist/<slug>/pl.<token>
function parseAppleUrl(urlLike) {
  var s = str(urlLike).trim();
  // URL 自带 storefront（music.apple.com/cn/...）→ 一并提取
  var mSf = /music\.apple\.com\/([a-z]{2})\//i.exec(s);
  var sf = mSf ? mSf[1].toLowerCase() : undefined;
  // 歌单
  var mPl = /playlist\/[^\/]+\/(pl\.[0-9a-z\-]+)/i.exec(s) || /(pl\.[0-9a-z]{20,})/i.exec(s);
  if (mPl) return { type: 'playlist', id: mPl[1], storefront: sf };
  // 歌曲：?i= 参数优先（单曲上下文），否则 song/album 路径段 id
  var mI = /[?&]i=(\d+)/.exec(s);
  var mSong = /\/song\/[^\/]+\/(\d+)/i.exec(s);
  var mAlbum = /\/album\/[^\/]+\/(\d+)/i.exec(s);
  if (mI) return { type: 'music', id: mI[1], storefront: sf };
  if (mSong) return { type: 'music', id: mSong[1], storefront: sf };
  if (mAlbum && !mI) return { type: 'album', id: mAlbum[1], storefront: sf };
  // 纯数字 id
  if (/^\d+$/.test(s)) return { type: 'music', id: s };
  return null;
}

async function importMusicItemImpl(urlLike) {
  var parsed = parseAppleUrl(urlLike);
  if (!parsed) throw new Error('无法识别的 Apple Music 链接（支持歌曲/歌单分享链）');
  if (parsed.type === 'album') throw new Error('专辑链接请用歌单导入或直接搜索');
  if (parsed.type === 'playlist') {
    var out = await fetchPlaylistTracks(parsed.id, SHEET_MAX_PAGES, parsed.storefront);
    return { type: 'playlist', sheet: out.playlist, musicList: out.musicList };
  }
  var r = await ampGetWithRetry('/v1/catalog/' + (parsed.storefront || storefrontOf()) + '/songs/' + parsed.id, {
    extend: 'extendedAssetUrls', include: 'albums'
  });
  var song = r.data && r.data[0];
  if (!song) throw new Error('Apple Music 单曲不存在: ' + parsed.id);
  return buildMusicItem(song.id, song.attributes);
}

async function importMusicSheetImpl(urlLike) {
  var parsed = parseAppleUrl(urlLike);
  if (!parsed || parsed.type !== 'playlist') {
    throw new Error('SHEET_URL_UNRECOGNIZED: 仅支持 Apple Music 歌单分享链（music.apple.com/.../playlist/.../pl.xxx）');
  }
  var out = await fetchPlaylistTracks(parsed.id, SHEET_MAX_PAGES, parsed.storefront);
  if (!out.musicList.length) {
    var err = new Error('SHEET_EMPTY: 歌单为空或拉取失败（' + parsed.id + '）');
    throw err;
  }
  var sheet = {
    id: 'apple_' + parsed.id,
    platform: PLATFORM,
    isImported: true,
    title: out.playlist.title || ('Apple Music 歌单 ' + parsed.id),
    artwork: out.playlist.artwork || (out.musicList[0] && out.musicList[0].artwork) || undefined,
    worksNum: out.total, // 踩坑#9：按实际拉取条数
    musicList: out.musicList
  };
  if (out.playlist.description) sheet.description = out.playlist.description;
  return sheet;
}

// ==================== 歌词（文档 4.4，需登录态 media-user-token） ====================

// TTML begin="HH:MM:SS.mmm"（或 MM:SS.mmm / SS.mmm）→ LRC [MM:SS.xx]（踩坑#14）
function parseTtmlTime(s) {
  var parts = String(s || '').split(':');
  var sec = 0;
  for (var i = 0; i < parts.length; i++) {
    sec = sec * 60 + (parseFloat(parts[i]) || 0);
  }
  return sec;
}

function lrcTimestamp(sec) {
  // 整数毫秒运算，规避浮点误差（12.34 → 0.3399999… 会错显 .33）
  var totalMs = Math.round((Number(sec) || 0) * 1000);
  var mm = Math.floor(totalMs / 60000);
  var ss = Math.floor((totalMs % 60000) / 1000);
  var xx = Math.floor((totalMs % 1000) / 10);
  if (xx >= 100) { ss += 1; xx = 0; }
  if (ss >= 60) { mm += 1; ss = 0; }
  return (mm < 10 ? '0' + mm : mm) + ':' + (ss < 10 ? '0' + ss : ss) + '.' + (xx < 10 ? '0' + xx : xx);
}

// TTML → LRC：逐 <p begin="..">行文本</p>（可选 end 拼双时间戳）
function ttmlToLrc(ttml) {
  var lines = [];
  var re = /<p\b[^>]*\bbegin="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  var m;
  while ((m = re.exec(String(ttml || ''))) !== null) {
    var txt = m[2]
      .replace(/<[^>]+>/g, ' ')     // 内层 span 等
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    var end = /\bend="([^"]+)"/.exec(m[0]);
    var stamp = lrcTimestamp(parseTtmlTime(m[1]));
    lines.push('[' + stamp + ']' + txt);
    if (end) {
      // 纯 LRC 单时间戳足够；end 仅用于未来 Instrumental 空行判定，这里不产出第二时间戳
    }
  }
  return lines.join('\n');
}

async function getLyricImpl(musicItem) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var mut = mediaUserTokenOf();
  if (!mut) {
    // 踩坑#4：未登录态 relationships 不含 lyrics → 如实说明，不伪造
    throw new Error('歌词需要 Apple Music 登录态：请在插件设置填写 appleMediaUserToken（网页版 Cookie 中的 media-user-token），当前仅提供播放不支持歌词');
  }
  var r = await ampGetWithRetry('/v1/catalog/' + storefrontOf() + '/songs/' + musicItem.id, {
    include: 'lyrics',
    extend: 'extendedAssetUrls'
  }, { mediaUserToken: mut });
  var song = r.data && r.data[0];
  var lyr = song && song.relationships && song.relationships.lyrics;
  if (!lyr || !lyr.data || !lyr.data.length) {
    throw new Error('该歌曲暂无歌词（或当前 media-user-token 无权限）');
  }
  // TTML 在 data[0].attributes.ttml
  var ttml = (lyr.data[0].attributes && lyr.data[0].attributes.ttml) || '';
  if (!ttml) throw new Error('歌词 TTML 内容为空');
  var rawLrc = ttmlToLrc(ttml);
  if (!rawLrc) throw new Error('TTML 解析结果为空');
  return { rawLrc: rawLrc, lyric: rawLrc, ttml: ttml };
}


// ==================== [酷我兜底取链通道]（移植自 kugou-v1913.js v1.9.14 resolveKuwoFallback，
// kuwo-source v1.4.3 同源实现，2026-09-06/09-11 实测验真） ====================
// 职责：Apple 公开 API 只有 30~90s 预览 → 播放主路径按 name+artistName 搜索酷我 →
// 严格同曲校验 → 官方 mobi.s 竞速取链。DES 纯 JS（无 Buffer/BigInt，安卓宿主安全）。

var FEAT_TAIL_RE = /\s*(?:\bfeaturing\b|\bfeat\.?|\bft\.?).*$/i;

function u32(x) { return x | 0; }

// 64 位整数用 [lo, hi] 两个 32 位字表示（位序与 Python 参考实现一致：bit i = i<32 ? lo>>>i : hi>>>(i-32)）
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

// ---------- 酷我自定义 DES（非标准 E 扩展表，密钥 ylzsxkwm） ----------
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
  var t = L; L = R; R = t; // reverse
  return bt64(KW_ARRAYIP1, L, R);
}

// 密钥 8 字节 → 16 个子密钥（各为 [lo,hi] 64 位稀疏值）；加密模式
var KW_SUBKEY_CACHE = {};
function kwSubkeys(keyStr) {
  if (KW_SUBKEY_CACHE[keyStr]) return KW_SUBKEY_CACHE[keyStr];
  var klo = 0, khi = 0;
  for (var i = 0; i < 8; i++) {
    var b = keyStr.charCodeAt(i) & 0xFF;
    if (i < 4) klo |= b << (8 * i); else khi |= b << (8 * (i - 4));
  }
  var x = bt64(KW_ARRAYPC1, klo, khi); // 56 位稀疏值 [lo,hi]
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

// 加密任意长度（NoPadding：8 字节对齐也补一个加密零块，与参考实现一致）
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
  if (rem !== 0 || true) blocks.push(kwDesBlock(sub, rlo | 0, rhi | 0)); // mode==0 恒补块
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

// 首个成功 resolve 胜出、全部失败才 reject；每个 racer 都挂 handler 防 unhandled rejection
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

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };
// 档位映射（宁缺毋降）：standard→128kmp3 / high→320kmp3 / super→2000kflac；
// hires 及以上酷我官方无对应档 → 不同步竞速（resolveKuwoFallback 直接 reject 跳过）。
var KUWO_QUALITY_MAP = { standard: 'standard', high: 'high', super: 'super' };

// rid 缓存：同一首歌重复取链免二次搜索（10min TTL，FIFO 淘汰，上限 256 条）
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

// 曲名+歌手 关键词搜索酷我 → 候选列表（按酷我相关度排序，最多 rn 条）
function searchKuwoCandidates(query) {
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      all: query, pn: 0, rn: 20, ft: 'music', client: 'kt',
      encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, cluster: 0,
      strategy: 2012, issubtitle: 1, show_copyright_off: 1, correct: 1,
      spPrivilege: 0, newver: 2, p2p: 1, notrace: 0, searchapi: 2, vermerge: 1
    },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': UA }
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

// ==================== 严格同曲校验（酷我通道专用，任务规范口径） ====================
// 第一步：拆分「核心歌名」与「版本标签」；「原版」等价于无标签。

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

// 严格同曲校验：ref=Apple 侧（musicItem），cand=酷我搜索候选；四项全过才放行
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

var KW_STATS = { resolveTotal: 0, kuwoOk: 0, kuwoVerifyRejected: 0, previewFallback: 0 };

// 候选列表 → 首个通过同曲校验的 rid；全部被拒 → 抛错
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
  KW_STATS.kuwoVerifyRejected++;
  throw new Error('kuwo same-song check rejected all ' + cands.length + ' candidates: ' + rejected.join('; '));
}

function searchKuwoVerifiedRid(musicItem, query) {
  return searchKuwoCandidates(query).then(function (cands) {
    if (!cands.length) throw new Error('kuwo search no candidate');
    return pickKuwoVerifiedRid(cands, musicItem);
  });
}

// 校验通过后才写 rid 缓存（query 由曲名+歌手派生，同 query 侧同曲，缓存安全）
function searchKuwoVerifiedRidCached(musicItem, query) {
  var hit = kwRidCacheGet(query);
  if (hit) return Promise.resolve(hit);
  return searchKuwoVerifiedRid(musicItem, query).then(function (rid) {
    kwRidCachePut(query, rid);
    return rid;
  });
}

// 官方 convert_url_with_sign 通道（nmobi/nmsublist 全参数同构 + mobi 车载免签变体）
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
    headers: { 'User-Agent': UA }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo official no url');
    if (quality === 'super' && d.format && d.format !== 'flac') {
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
    // 酷我 CDN 直链实测为 http，同签名路径 https 可用 → 统一升级 https
    var u = String(d.url).replace(/^http:\/\//i, 'https://');
    return { url: u, actualQuality: aq };
  });
}

// mobi.s DES-ECB 通道（std=手机渠道 / car=车载渠道，同端点同密钥互为风控冗余 racer）
function kuwoDesResolve(rid, quality, variant) {
  var fmt = quality === 'super' ? 'flac' : 'mp3';
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
    if (quality === 'super' && fmtGot !== 'flac') {
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

// 酷我竞速赛道：搜索映射候选 → 严格同曲校验 → 首个通过校验的 rid（10min 缓存）→
// 按档位竞速官方通道。super：DES flac（std+car）+ convert_url_with_sign 2000kflac×3；
// standard/high：3 racer。未映射档直接 reject（宁缺毋降）。
function resolveKuwoFallback(musicItem, quality) {
  var kwq = KUWO_QUALITY_MAP[quality];
  if (!kwq) return Promise.reject(new Error('kuwo unmapped quality: ' + quality));
  var title = musicItem && (musicItem.title || musicItem.name) ? String(musicItem.title || musicItem.name) : '';
  var artist = musicItem && musicItem.artist ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('kuwo fallback no keyword'));
  KW_STATS.resolveTotal++;
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
    return raceSuccess(jobs);
  }).then(function (r) {
    KW_STATS.kuwoOk++;
    return { url: r.url, actualQuality: r.actualQuality, channel: 'kuwo:official' };
  });
}


// ==================== 取链结果验证（音流口径） ====================

// 返回体媒体 URL 域名白名单：酷我官方直链 CDN + Apple 预览 CDN
var MEDIA_URL_ALLOWLIST = [
  /(^|\.)kuwo\.cn$/i,           // 酷我官方直取通道（nmobi/mobi 及其 CDN）
  /(^|\.)itunes\.apple\.com$/i, // Apple 预览 CDN（audio-ssl.itunes.apple.com）
  /(^|\.)apple\.com$/i,         // Apple 兜底域
  /(^|\.)mzstatic\.com$/i       // Apple 静态资源域
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https:\/\//i.test(s)) return false; // 全链路 https 语义（酷我 http 直链已升级）
  var m = /^https:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  for (var i = 0; i < MEDIA_URL_ALLOWLIST.length; i++) {
    if (MEDIA_URL_ALLOWLIST[i].test(host)) return true;
  }
  return false;
}

// 音质码率下限（kbps，仅时长≥60s 时生效；低于下限判试听/虚标拒收）
var QUALITY_KBPS_FLOOR = { standard: 96, high: 256, super: 500 };

// 魔数校验：fLaC / ID3 / ftyp(box at offset 4) / MP3 帧同步 / OggS / RIFF（踩坑#6：
// Apple 预览 Content-Type audio/x-m4p 非标准 → 不依赖 Content-Type，用文件头判定）
function looksLikeAudio(bytes) {
  if (!bytes || bytes.length < 8) return false; // 魔数判定最少需 8 字节（ftyp box at offset 4）
  var s = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (s === 'fLaC') return true;
  if (s === 'ID3\x03' || (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) return true;
  if (s === 'OggS') return true;
  if (s === 'RIFF') return true;
  if (String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'ftyp') return true; // M4A/M4P box
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true; // MPEG 帧同步（无 ID3 头 MP3）
  return false;
}

function looksLikeTextDoc(bytes) {
  if (!bytes || !bytes.length) return false;
  var b0 = bytes[0];
  if (b0 === 0x7B || b0 === 0x3C) return true; // '{' JSON / '<' HTML
  return false;
}

// Range 0-63 探测：魔数 + Content-Range 总长 + 码率下限三重验证（音流口径：请求哪个
// 音质就交付哪个音质；Content-Length 与音质期望比对，<64kbps 试听片段必拒）。
// 探测网络层失败（超时/断连）不拦截（放行交播放器，与 kugou guardFullAudio 同口径）；
// 内容层异常（HTML/JSON/魔数不符/码率虚标）必拒。
function validateKuwoAudio(url, musicItem, quality) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-63', 'User-Agent': UA },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var headers = res.headers || {};
    var ctype = String(headers['content-type'] || headers['Content-Type'] || '');
    if (/text\/html|application\/json/i.test(ctype)) {
      throw new Error('guard: not audio (' + ctype + ')');
    }
    var bytes = new Uint8Array(res.data || []);
    if (looksLikeTextDoc(bytes)) throw new Error('guard: json/html payload');
    if (!looksLikeAudio(bytes)) throw new Error('guard: unknown magic bytes');
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) {
      total = parseInt(mm[1], 10) || 0;
    } else if (res.status !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    var dur = musicItem && parseInt(musicItem.duration, 10) || 0;
    if (total > 0 && dur >= 60) {
      var kbps = Math.round(total * 8 / dur / 1000);
      if (kbps < 64) {
        throw new Error('guard: trial clip, est ' + kbps + 'kbps < 64kbps (' + Math.round(total / 16000) + 's/' + dur + 's)');
      }
      var floor = QUALITY_KBPS_FLOOR[quality] || 96;
      if (kbps < floor) {
        throw new Error('guard: quality degraded, est ' + kbps + 'kbps < ' + floor + 'kbps (' + quality + ')');
      }
      return { size: total };
    }
    return total > 0 ? { size: total } : {};
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // 探测请求本身失败：不拦，放行
    return {};
  });
}

// ==================== 取链主流程（酷我兜底为主 → Apple 预览次选） ====================

// 宿主音质键 → 内部档位（酷我通道 standard/high/super）
var QUALITY_KEY_MAP = {
  low: 'standard',
  '128k': 'standard',
  standard: 'standard',
  '192k': 'high',
  '320k': 'high',
  high: 'high',
  flac: 'super',
  super: 'super',
  hires: 'super',   // 酷我最高 2000kflac，hires 请求降级 super 竞速（actualQuality 如实回 flac）
  master: 'super',
  atmos: 'super'
};

function normalizeQuality(q) {
  var s = String(q || '');
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'standard' || s === 'high' || s === 'super') return s;
  return 'standard';
}

// Apple 预览 URL：条目自带 _preview 优先，缺失时按 id 拉歌曲详情补
async function getPreviewUrl(musicItem) {
  if (musicItem && musicItem._preview) return str(musicItem._preview);
  if (!musicItem || !musicItem.id) throw new Error('no preview source');
  var r = await ampGetWithRetry('/v1/catalog/' + storefrontOf() + '/songs/' + musicItem.id, {
    extend: 'extendedAssetUrls'
  });
  var song = r.data && r.data[0];
  var pv = song && song.attributes && song.attributes.previews && song.attributes.previews[0] && song.attributes.previews[0].url;
  if (!pv) throw new Error('该歌曲无预览片段');
  return str(pv);
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem) throw new Error('missing musicItem');
  var q = normalizeQuality(quality);
  KW_STATS.lastQuality = q;

  // 主路径：酷我兜底（用户明确要求）。严格同曲校验 + 档位校验 + Range 魔数/码率三重验证
  try {
    var kuwo = await resolveKuwoFallback(musicItem, q);
    if (!kuwo || !kuwo.url || !isAllowedMediaUrl(kuwo.url)) {
      throw new Error('kuwo url rejected by allowlist');
    }
    var v = await validateKuwoAudio(kuwo.url, musicItem, q);
    var out = {
      url: kuwo.url,
      quality: kuwo.actualQuality,           // 宿主标准字段：实际档位如实上报
      actualQuality: kuwo.actualQuality,
      channel: kuwo.channel,                 // 'kuwo:official' 如实标记酷我兜底来源
      platform: PLATFORM
    };
    if (v && v.size) out.size = v.size;
    return out;
  } catch (kuwoErr) {
    KW_STATS.lastKuwoError = String((kuwoErr && kuwoErr.message) || kuwoErr).slice(0, 120);
    // 次选：Apple 预览片段（30~90s，如实标注 previewClip，绝不冒充完整曲目）
    try {
      var pv = await getPreviewUrl(musicItem);
      if (!isAllowedMediaUrl(pv)) throw new Error('preview url rejected by allowlist');
      KW_STATS.previewFallback++;
      return {
        url: pv,
        quality: q, // 请求档位原样返回；片段时长仅 30~90s 由 channel/previewClip 标注区分
        actualQuality: q,
        channel: 'apple-music:preview-clip',
        previewClip: true,
        headers: { Referer: HOME_URL },        // 踩坑#12：预览防盗链需要 Referer
        platform: PLATFORM
      };
    } catch (pvErr) {
      throw new Error('Apple Music 取链失败：酷我兜底(' + KW_STATS.lastKuwoError + ')；预览兜底(' +
        String((pvErr && pvErr.message) || pvErr).slice(0, 80) + ')');
    }
  }
}

// ==================== 分享链接 / 详情页 URL ====================

function getMusicDetailPageUrlImpl(musicItem) {
  if (musicItem && musicItem._webUrl) return str(musicItem._webUrl);
  var id = musicItem && musicItem.id;
  if (!id) return '';
  return HOME_URL + '/' + storefrontOf() + '/song/' + id;
}

// ==================== 插件导出（宿主契约对齐 kuwo/kugou standalone 插件） ====================

var plugin = {
  name: 'Apple Music',
  platform: PLATFORM,
  version: '1.0.0',
  author: '研发1号',
  description: 'Apple Music 独立源插件 v1.0.0：Apple Music 曲库目录源（搜索/专辑/歌单/29 分类歌单广场/分享链导入）+ 酷我兜底播放取链。' +
    '公开 API 仅返回 30~90 秒预览（完整曲目需订阅+FairPlay DRM，插件不可行），故播放主路径按歌曲名+歌手经酷我通道兜底取链' +
    '（严格同曲校验：核心歌名+版本标签+歌手+时长四项全过；官方 mobi.s 多路竞速；音流口径验证：档位校验+Range 魔数/码率三重守卫，' +
    '试听片段与音质虚标必拒）；酷我兜底失败时回落 Apple 预览片段并如实标注 previewClip。' +
    'Token 两步提取（首页 → index-legacy JS → iss=AMPWebPlay JWT，~70 天有效期缓存自动刷新）；' +
    '歌词需登录态（插件设置填 appleMediaUserToken 后拉取 TTML 转 LRC，未配置时如实提示不支持）；' +
    'storefront 默认 us 可切 cn，分类歌单固定 cn。',
  primaryKey: ['id'],
  supportedSearchType: ['music', 'album', 'sheet'],
  supportedQualities: ['128k', '192k', '320k', 'flac'],
  cacheControl: 'no-store', // 播放链接为酷我签名短时效链接 + Apple 预览防盗链，必须现取
  userVariables: [
    { key: 'appleStorefront', name: 'Storefront（默认 us）', hint: 'Apple Music 区服：us / cn / hk / jp / tw 等；分类歌单固定 cn 不受此项影响' },
    { key: 'appleMediaUserToken', name: 'media-user-token（可选，歌词用）', hint: '选填；网页版登录后 Cookie 中的 media-user-token，填写后支持歌词（TTML 转 LRC），不填不支持歌词' }
  ],
  hints: {
    search: [
      '搜索 Apple Music 曲库（元数据来自 Apple，播放链接经酷我兜底解析）',
      '完整曲目以酷我同曲匹配为准；酷我曲库未收录的歌会回落 30~90 秒 Apple 官方预览片段'
    ],
    importMusicSheet: [
      '支持 Apple Music 歌单分享链接，如 music.apple.com/cn/playlist/xxx/pl.xxx',
      'Apple 编辑歌单最多导入 900 首（300×3 页分页上限）'
    ]
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }；page 兼容第二参/对象内两种传法
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var pg = Math.max(1, Math.floor(Number(page) || (query && Number(query.page)) || 1));
    var t = type || (query && query.type) || 'music';
    if (t === 'music') return searchMusicImpl(kw, pg);
    if (t === 'album') return searchAlbumImpl(kw, pg);
    if (t === 'sheet') return searchSheetImpl(kw, pg);
    return { isEnd: true, data: [] };
  },

  async getMediaSource(musicItem, quality) {
    return getMediaSourceImpl(musicItem, quality);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getAlbumInfo(albumItem) {
    return getAlbumInfoImpl(albumItem);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
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

  async getRecommendSheetsByTag(tag, page) {
    return getRecommendSheetsByTagImpl(tag, page);
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  // 调试/质检辅助接口（不参与宿主协议）
  _internal: {
    getToken: getToken,
    pickWebPlayToken: pickWebPlayToken,
    extractJsPath: extractJsPath,
    ampGet: ampGet,
    ampGetWithRetry: ampGetWithRetry,
    resolveKuwoFallback: resolveKuwoFallback,
    kuwoSameSongCheck: kuwoSameSongCheck,
    kuwoEncryptQuery: kuwoEncryptQuery,
    searchKuwoCandidates: searchKuwoCandidates,
    validateKuwoAudio: validateKuwoAudio,
    fetchPlaylistTracks: fetchPlaylistTracks,
    fetchCategorySheets: fetchCategorySheets,
    parseAppleUrl: parseAppleUrl,
    ttmlToLrc: ttmlToLrc,
    artworkOf: artworkOf,
    buildMusicItem: buildMusicItem,
    isAllowedMediaUrl: isAllowedMediaUrl,
    looksLikeAudio: looksLikeAudio,
    looksLikeTextDoc: looksLikeTextDoc,
    b64ToBytes: b64ToBytes,
    utf8Decode: utf8Decode,
    CATEGORIES: CATEGORIES,
    stats: KW_STATS,
    TOKEN_STATE: TOKEN_STATE
  }
};

module.exports = plugin;
