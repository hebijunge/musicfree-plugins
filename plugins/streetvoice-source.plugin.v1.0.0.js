/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「街声」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 街声(StreetVoice)独立源插件（MusicFree）
 * ================================
 * v1.0.0（2026-09-24 首版）
 *
 * 接口依据：《街声(StreetVoice)接口完整文档 - 综合实测版》（2026-08-28 实测，v1.0）
 *           + 本沙箱 2026-09-24 全链路复测（搜索/详情/HLS 取链/分片魔数/分页/异常路径逐项实测通过）。
 *
 * 能力范围（文档与实测支持的才实现，未覆盖的一律不做、不虚标）：
 *  - 搜索：GET /api/v5/search/?q=&type=song&limit=&offset=（仅歌曲搜索；album/user 搜索端点
 *    存在但响应字段结构文档未覆盖，不接入、supportedSearchType 只声明 music）。
 *  - 歌曲详情：GET /api/v5/song/{id}/（getMusicInfo 补齐封面/歌手/专辑/时长）。
 *  - 歌词：详情接口 lyrics 字段透传（rawLrc）。lyrics_is_lrc=false 为纯文本、true 为带时间轴
 *    LRC（2026-09-24 实测两种都存在：id=630401 纯文本 / id=880931 LRC），均原样透传不加工。
 *  - 取链：POST /api/v5/song/{id}/hls/file/ → 96k HLS（.m3u8）。免登录唯一音质，单档如实声明
 *    supportedQualities: ['96k']；请求更高档位（192k/320k/flac/hires 等）返回 null 交宿主降级
 *    （对齐 bilibili-source.plugin v1.0.1「高档不可用返 null」口径），请求 96k 及以下档位
 *    一律服务 96k 并以 actualQuality: '96k' 如实回传，不虚构更高音质。
 *  - 榜单/浏览：getTopLists 两组三榜——每日推荐（GET /api/v4/sod/today/，单曲）、
 *    编辑推荐（GET /api/v4/editor_choice_random/?limit=，随机无翻页，仅第 1 页）、
 *    最新发布（GET /api/v4/song/?limit=&offset=，17万+曲库按发布时间倒序真分页）。
 *
 * 不支持项（文档未覆盖或实测不可用，如实标注）：
 *  - 歌单（getMusicSheetInfo / importMusicSheet）：街声无公开歌单接口，不实现。
 *  - 专辑详情 / 歌手作品 / MV / 评论 / 逐字歌词 / 单曲分享链接导入：文档未覆盖，不实现。
 *  - 高音质：128k/192k/320k/无损实测 404 不存在；/song/{id}/file/ 系列免登录 403，不接入。
 *  - v4 HLS 端点 405，仅 v5 hls 可用（文档实测，实现按 v5）。
 *
 * 取链验证口径（沿用音流方法论的 HLS 适配，如实记录）：
 *  - 音流标准口径为「Content-Length 与音质大小接口返回比对 + 魔数校验」。街声无音质大小接口、
 *    且交付形态为 HLS 分片流（无单文件 Content-Length），两者均不适用，做如下等价替代：
 *      ① m3u8 校验：#EXTM3U 头 + 分片列表非空（拒 HTML/错误页顶替）；
 *      ② 时长一致性：分片 EXTINF 总时长与歌曲详情 length 比对（容差 ±15s），不匹配判失败
 *         （等价于「大小匹配才判定为可用真链」的时长维度）；
 *      ③ 分片魔数：Range 0-2047 拉取首个分片，校验 MPEG-TS 同步字节 0x47（偏移 0 与 188）
 *         或 ID3 头，2026-09-24 实测分片 content-type video/mp2t、0x47@0/@188 命中。
 *  - size 字段：HLS 流无单文件大小，不回填（不虚构估算值）。
 *
 * 宿主播放能力评估（2026-09-24，如实标注）：
 *  - MusicFree 官方宿主（react-native-track-player / ExoPlayer）原生支持 HLS，m3u8 可直接播放。
 *  - 音流(yinliu-app) 宿主为 WebView 媒体元素 + 自研流式引擎（src/core/streaming），全仓无
 *    hls.js 依赖、无 m3u8 处理路径（grep src/ 零命中）；Android WebView <audio> 不支持原生
 *    HLS。在音流宿主内本源 96k HLS 播放不可行，需宿主侧引入 hls.js 或走转码代理方可解锁，
 *    插件侧已按「返回源真实形态」交付，未做任何伪转直链。
 *
 * 兼容性：
 *  - 请求头按文档：Chrome UA + Referer https://www.streetvoice.cn/ + x-requested-with
 *    XMLHttpRequest；HLS POST 额外带 Origin 与 Content-Type: application/json（Body {}）。
 *  - hls.streetvoice.cn 分片/播放列表实测无需鉴权头，直连可取（Range 206 支持）。
 *  - 搜索结果 count 服务端封顶 100（实测 offset=100 后 results 为空），分页按 limit=20 逐页。
 */

const axios = require('axios');

// ==================== 常量与工具 ====================

var SOURCE_TIMEOUT = 3000;   // 单请求超时（整体取链受 RESOLVE_BUDGET_MS 预算约束）
var M3U8_TIMEOUT = 3000;     // m3u8 拉取超时（偶发慢，超时在预算内重试 1 次）
var SEGMENT_TIMEOUT = 3000;  // 分片探针超时
var RESOLVE_BUDGET_MS = 9000; // getMediaSource 整体 deadline（宿主单方法 10s 硬上限内留余量）
var SEARCH_LIMIT = 20;       // 搜索每页条数（与官方分页语义一致）
var LATEST_PAGE_SIZE = 30;   // 最新发布每页条数
var EDITOR_LIMIT = 60;       // 编辑推荐单次拉取上限（随机接口无翻页，一次取足）
var DURATION_TOLERANCE_SEC = 15; // 分片总时长 vs 详情时长 容差

var API_BASE = 'https://www.streetvoice.cn';

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0';

var BASE_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.streetvoice.cn/',
  'x-requested-with': 'XMLHttpRequest'
};

var HLS_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.streetvoice.cn/',
  'Origin': 'https://www.streetvoice.cn',
  'x-requested-with': 'XMLHttpRequest',
  'Content-Type': 'application/json'
};

function str(v) { return v === undefined || v === null ? '' : String(v); }
function toInt(v, dflt) { var n = parseInt(v, 10); return isNaN(n) ? (dflt || 0) : n; }

// axios 错误 → 可读错误（HTTP 状态码优先），前缀标明环节
function wrapErr(prefix) {
  return function (e) {
    var msg;
    if (e && e.response) {
      var status = e.response.status;
      var detail = e.response.data && e.response.data.error && e.response.data.error.message ? str(e.response.data.error.message) : '';
      if (status === 403) msg = prefix + '：无播放权限(HTTP 403，作者或平台限制' + (detail ? '，' + detail : '') + ')';
      else msg = prefix + '：HTTP ' + status + (detail ? '，' + detail : '');
    } else {
      msg = prefix + '：' + String((e && e.message) || e);
    }
    throw new Error(msg);
  };
}

// 街声 song 对象（搜索/列表/详情通用字段）→ MusicFree IMusicItem
function buildMusicItem(raw) {
  if (!raw || str(raw.type) !== 'song') return null;
  var user = raw.user || {};
  var profile = user.profile || {};
  var album = raw.album || null;
  var item = {
    id: toInt(raw.id),
    title: str(raw.name),
    artist: str(profile.nickname) || str(user.username) || '未知音乐人',
    duration: toInt(raw.length),
    platform: 'streetvoice'
  };
  if (raw.image) item.artwork = str(raw.image);
  if (album && album.name) item.album = str(album.name);
  if (!item.id || !item.title) return null;
  return item;
}

// ==================== 基础接口 ====================

// GET /api/v5/search/（type=song）
function fetchSearchSongs(q, page) {
  var offset = (Math.max(1, page || 1) - 1) * SEARCH_LIMIT;
  return axios.get(API_BASE + '/api/v5/search/', {
    params: { q: q, type: 'song', limit: SEARCH_LIMIT, offset: offset },
    timeout: SOURCE_TIMEOUT,
    headers: BASE_HEADERS
  }).then(function (res) {
    var d = res.data || {};
    var results = d.results || [];
    return {
      isEnd: results.length < SEARCH_LIMIT || !d.next,
      data: results.map(buildMusicItem).filter(function (it) { return it; })
    };
  }).catch(wrapErr('街声搜索失败'));
}

// GET /api/v5/song/{id}/（详情，含歌词）
function fetchSongDetail(songId) {
  return axios.get(API_BASE + '/api/v5/song/' + toInt(songId) + '/', {
    timeout: SOURCE_TIMEOUT,
    headers: BASE_HEADERS
  }).then(function (res) {
    var d = res.data || {};
    if (str(d.type) !== 'song' || !d.id) throw new Error('街声歌曲详情失败：响应异常(id=' + songId + ')');
    return d;
  }).catch(wrapErr('街声歌曲详情失败'));
}

// GET /api/v4/sod/today/（每日推荐）
function fetchSodToday() {
  return axios.get(API_BASE + '/api/v4/sod/today/', {
    timeout: SOURCE_TIMEOUT,
    headers: BASE_HEADERS
  }).then(function (res) {
    var d = res.data || {};
    return d.song && str(d.song.type) === 'song' ? d.song : null;
  }).catch(function () { return null; });
}

// GET /api/v4/editor_choice_random/?limit={n}（编辑推荐；repost 包 content_object）
function fetchEditorChoice(limit) {
  return axios.get(API_BASE + '/api/v4/editor_choice_random/', {
    params: { limit: limit || EDITOR_LIMIT },
    timeout: SOURCE_TIMEOUT,
    headers: BASE_HEADERS
  }).then(function (res) {
    var arr = Array.isArray(res.data) ? res.data : ((res.data && res.data.results) || []);
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i] || {};
      var song = str(it.type) === 'song' ? it : (it.content_object && str(it.content_object.type) === 'song' ? it.content_object : null);
      if (!song) continue;
      var item = buildMusicItem(song);
      if (item && !seen[item.id]) { seen[item.id] = 1; out.push(item); }
    }
    return out;
  }).catch(function () { return []; });
}

// GET /api/v4/song/（最新发布，真分页）
function fetchLatestSongs(page) {
  var offset = (Math.max(1, page || 1) - 1) * LATEST_PAGE_SIZE;
  return axios.get(API_BASE + '/api/v4/song/', {
    params: { limit: LATEST_PAGE_SIZE, offset: offset },
    timeout: SOURCE_TIMEOUT,
    headers: BASE_HEADERS
  }).then(function (res) {
    var d = res.data || {};
    var results = d.results || [];
    return {
      isEnd: results.length < LATEST_PAGE_SIZE || !d.next,
      data: results.map(buildMusicItem).filter(function (it) { return it; })
    };
  }).catch(wrapErr('街声最新发布失败'));
}

// ==================== HLS 取链与验证 ====================

// 解析 m3u8 文本：校验 #EXTM3U 头、提取分片 URL 与 EXTINF 总时长
// 返回 { segments: string[], duration: number }；非法（HTML 错误页/空分片）抛错
function parseM3u8(text) {
  if (!text || text.indexOf('#EXTM3U') === -1) {
    throw new Error('m3u8 响应异常（非 HLS 播放列表）');
  }
  var lines = text.split(/\r?\n/);
  var segments = [];
  var duration = 0;
  var pendingExtinf = -1;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    if (line.indexOf('#EXTINF:') === 0) {
      var v = parseFloat(line.slice(8));
      pendingExtinf = isNaN(v) ? -1 : v;
      continue;
    }
    if (line.charAt(0) === '#') continue; // 其它 tag 跳过
    segments.push(line);
    if (pendingExtinf >= 0) { duration += pendingExtinf; pendingExtinf = -1; }
  }
  if (segments.length === 0) throw new Error('m3u8 无分片');
  return { segments: segments, duration: duration };
}

// 相对分片路径 → 绝对 URL
function resolveSegmentUrl(seg, m3u8Url) {
  if (/^https?:\/\//i.test(seg)) return seg;
  // 兼容 Node 与宿主环境：优先 URL API，退化手工拼接
  try {
    return new URL(seg, m3u8Url).toString();
  } catch (e) {
    var idx = m3u8Url.lastIndexOf('/');
    return m3u8Url.slice(0, idx + 1) + seg;
  }
}

// 首分片魔数校验：Range 0-2047 拉取，MPEG-TS 0x47（@0 且 @188）或 ID3 头
// 返回 { ok: boolean, magic: string }
function checkSegmentMagic(buf) {
  if (!buf || buf.length < 4) return { ok: false, magic: 'empty' };
  var isTs = buf[0] === 0x47 && (buf.length <= 188 || buf[188] === 0x47);
  if (isTs) return { ok: true, magic: 'TS(0x47)' };
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return { ok: true, magic: 'ID3' };
  return { ok: false, magic: buf.slice(0, 4).toString('hex') };
}

function fetchSegmentProbe(segUrl) {
  return axios.get(segUrl, {
    timeout: SEGMENT_TIMEOUT,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': UA,
      'Referer': 'https://www.streetvoice.cn/',
      'Range': 'bytes=0-2047'
    }
  }).then(function (res) {
    return checkSegmentMagic(Buffer.from(res.data));
  });
}

// m3u8 拉取（带预算内重试 1 次：2026-09-24 自测偶发 >2.5s 慢响应）
function fetchM3u8WithRetry(m3u8Url, startTs) {
  var attempt = function (timeoutMs) {
    return axios.get(m3u8Url, { timeout: timeoutMs, headers: BASE_HEADERS });
  };
  var firstTimeout = Math.min(M3U8_TIMEOUT, Math.max(800, RESOLVE_BUDGET_MS - (Date.now() - startTs)));
  return attempt(firstTimeout).catch(function (e) {
    var left = RESOLVE_BUDGET_MS - (Date.now() - startTs);
    if (left < 1200) throw e; // 预算不足不重试
    return attempt(Math.min(M3U8_TIMEOUT, left));
  });
}

// 取链主流程（96k HLS）。验证通过返回 { url, quality, actualQuality }，失败抛可读错误。
// 整体受 RESOLVE_BUDGET_MS（9s）deadline 约束，宿主单方法 10s 硬上限内。
async function resolveHlsSource(musicItem) {
  var startTs = Date.now();
  var songId = musicItem && toInt(musicItem.id);
  if (!songId) throw new Error('街声取链失败：缺少歌曲 id');

  // ① 换取 m3u8 地址
  var fileRes = await axios.post(API_BASE + '/api/v5/song/' + songId + '/hls/file/', {},
    { timeout: SOURCE_TIMEOUT, headers: HLS_HEADERS }).catch(wrapErr('街声取链失败'));
  var m3u8Url = fileRes.data && fileRes.data.file ? str(fileRes.data.file) : '';
  if (!m3u8Url) throw new Error('街声取链失败：HLS 接口未返回播放列表地址');

  // ② 拉取并校验 m3u8（预算内重试 1 次）
  var m3u8Res = await fetchM3u8WithRetry(m3u8Url, startTs).catch(wrapErr('街声取链失败'));
  var parsed;
  try {
    parsed = parseM3u8(typeof m3u8Res.data === 'string' ? m3u8Res.data : String(m3u8Res.data));
  } catch (e) {
    throw new Error('街声取链失败：' + e.message);
  }

  // ③ 时长一致性（详情时长可得时）：EXTINF 总时长 vs 歌曲时长，容差 ±15s
  var expect = toInt(musicItem && musicItem.duration);
  if (expect > 0 && Math.abs(parsed.duration - expect) > DURATION_TOLERANCE_SEC) {
    throw new Error('街声取链失败：分片总时长(' + Math.round(parsed.duration) + 's)与歌曲时长(' + expect + 's)不符');
  }

  // ④ 首分片魔数校验
  var segUrl = resolveSegmentUrl(parsed.segments[0], m3u8Url);
  var magic = await fetchSegmentProbe(segUrl).catch(wrapErr('街声取链失败'));
  if (!magic.ok) {
    throw new Error('街声取链失败：首分片魔数校验未通过(' + magic.magic + ')');
  }

  return {
    url: m3u8Url,
    quality: '96k',
    actualQuality: '96k',
    _internal: { segments: parsed.segments.length, hlsDuration: Math.round(parsed.duration), elapsedMs: Date.now() - startTs }
  };
}

// 音质档位归类：96k 及以下可服务；更高档返 null 交宿主降级
// （对齐 bilibili 插件口径：高档不可用不静默降级交付，交宿主音质序列降级，避免虚标）
function canServeQuality(quality) {
  var q = str(quality || '').toLowerCase();
  if (q === '' || q === '96k' || q === '64k' || q === 'low' || q === 'standard') return true;
  return false; // 192k/320k/flac/lossless/hires/high/higher/super 等 → null
}

// ==================== 协议实现 ====================

async function searchImpl(query, page, type) {
  var kw = query && typeof query === 'object' ? String(query.keyword || '').trim() : String(query || '').trim();
  if (!kw) return { isEnd: true, data: [] };
  if (type && type !== 'music') return { isEnd: true, data: [] }; // 仅声明 music，其余如实空
  return fetchSearchSongs(kw, page);
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem) throw new Error('missing musicItem');
  if (!canServeQuality(quality)) return null; // 更高档位：宿主降级链处理
  return resolveHlsSource(musicItem);
}

async function getLyricImpl(musicItem) {
  var songId = musicItem && toInt(musicItem.id);
  if (!songId) throw new Error('街声歌词：缺少歌曲 id');
  var detail = await fetchSongDetail(songId);
  // lyrics_is_lrc=false 纯文本 / true 带时间轴 LRC，均原样透传（rawLrc），不加工不伪造时间轴
  return { rawLrc: str(detail.lyrics) };
}

async function getMusicInfoImpl(musicItem) {
  var songId = musicItem && toInt(musicItem.id);
  if (!songId) throw new Error('街声歌曲详情：缺少歌曲 id');
  var d = await fetchSongDetail(songId);
  var user = d.user || {};
  var profile = user.profile || {};
  var info = {
    id: toInt(d.id, songId),
    title: str(d.name) || str(musicItem.title),
    artist: str(profile.nickname) || str(user.username) || str(musicItem.artist) || '未知音乐人',
    duration: toInt(d.length, toInt(musicItem.duration)),
    platform: 'streetvoice'
  };
  if (d.image) info.artwork = str(d.image);
  if (d.album && d.album.name) info.album = str(d.album.name);
  else if (musicItem.album) info.album = str(musicItem.album);
  return info;
}

// ==================== 榜单 ====================

var TOP_LIST_COVER_FALLBACK = '';

async function getTopListsImpl() {
  // 榜单封面从两个推荐接口现取（失败留空，不阻断榜单列表）
  var sodSong = await fetchSodToday();
  var editorItems = await fetchEditorChoice(1);
  var sodCover = (sodSong && sodSong.image) || TOP_LIST_COVER_FALLBACK;
  var editorCover = (editorItems[0] && editorItems[0].artwork) || TOP_LIST_COVER_FALLBACK;
  return [
    {
      title: '编辑精选',
      data: [
        { id: 'sv~sod', title: '每日推荐 · Song of the Day', coverImg: sodCover, artwork: sodCover },
        { id: 'sv~editor', title: '编辑推荐', coverImg: editorCover, artwork: editorCover }
      ]
    },
    {
      title: '曲库浏览',
      data: [
        { id: 'sv~latest', title: '最新发布', coverImg: TOP_LIST_COVER_FALLBACK, artwork: TOP_LIST_COVER_FALLBACK }
      ]
    }
  ];
}

async function getTopListDetailImpl(topListItem, page) {
  var tid = str(topListItem && topListItem.id);
  var pg = Math.max(1, page || 1);
  var echo = function () {
    return { id: tid, title: str(topListItem && topListItem.title), coverImg: str(topListItem && topListItem.coverImg), artwork: str(topListItem && topListItem.artwork), platform: 'streetvoice' };
  };

  if (tid === 'sv~sod') {
    if (pg > 1) return { isEnd: true, musicList: [], topListItem: echo() };
    var sodSong = await fetchSodToday();
    if (!sodSong) throw new Error('街声每日推荐：接口无今日歌曲');
    return { isEnd: true, musicList: [buildMusicItem(sodSong)].filter(function (it) { return it; }), topListItem: echo() };
  }

  if (tid === 'sv~editor') {
    if (pg > 1) return { isEnd: true, musicList: [], topListItem: echo() }; // 随机接口无翻页语义，如实仅第 1 页
    var items = await fetchEditorChoice(EDITOR_LIMIT);
    return { isEnd: true, musicList: items, topListItem: echo() };
  }

  if (tid === 'sv~latest') {
    var r = await fetchLatestSongs(pg);
    return { isEnd: r.isEnd, musicList: r.data, topListItem: echo() };
  }

  throw new Error('未知街声榜单: ' + tid);
}

// ==================== 插件对象 ====================

var plugin = {
  name: '街声',
  platform: 'streetvoice',
  version: '1.0.0',
  author: '研发1号',
  description: '街声(StreetVoice)独立源插件 v1.0.0：独立/原创音乐曲库（17万+首，免登录）。搜索（v5 song 搜索，20 条/页）、96k HLS 取链（免登录唯一音质，单档如实声明，取链经 m3u8 校验+分片时长一致性+首分片 TS 魔数三重验证）、歌词透传（纯文本/LRC 双形态按 lyrics_is_lrc 标记原样返回）、歌曲详情补齐、榜单三组（每日推荐/编辑推荐/最新发布真分页）。不支持（如实声明）：歌单、专辑详情、歌手作品、MV、评论、逐字歌词、高音质（128k+ 实测 404，file 接口 403 需登录）。依赖：axios。',
  primaryKey: ['id'],
  supportedSearchType: ['music'],
  supportedQualities: ['96k'], // 免登录唯一音质，单档如实声明，不虚标
  cacheControl: 'no-store',
  hints: {
    search: ['搜索街声(StreetVoice)独立音乐曲库（17万+首原创作品）', '免登录仅 96k HLS 音质，取链含 m3u8/时长/魔数三重校验', '仅支持歌曲搜索；歌单/专辑/歌手搜索不支持'],
    importMusicSheet: ['街声无公开歌单接口，歌单导入不支持']
  },

  async search(query, page, type) {
    return searchImpl(query, page, type);
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

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  // ===== 内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    buildMusicItem: buildMusicItem,
    fetchSearchSongs: fetchSearchSongs,
    fetchSongDetail: fetchSongDetail,
    fetchSodToday: fetchSodToday,
    fetchEditorChoice: fetchEditorChoice,
    fetchLatestSongs: fetchLatestSongs,
    parseM3u8: parseM3u8,
    resolveSegmentUrl: resolveSegmentUrl,
    checkSegmentMagic: checkSegmentMagic,
    fetchSegmentProbe: fetchSegmentProbe,
    resolveHlsSource: resolveHlsSource,
    canServeQuality: canServeQuality,
    searchImpl: searchImpl,
    getMediaSourceImpl: getMediaSourceImpl,
    getLyricImpl: getLyricImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getTopListsImpl: getTopListsImpl,
    getTopListDetailImpl: getTopListDetailImpl,
    API_BASE: API_BASE
  }
};

module.exports = plugin;
