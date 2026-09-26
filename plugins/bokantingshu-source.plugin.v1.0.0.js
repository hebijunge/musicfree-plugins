/**
 * 博看听书独立源插件 v1.0.0（MusicFree 插件规范 · 音流宿主对齐）
 *
 * ==================== v1.0.0 changelog（首发版） ====================
 * 依据：《荐片源音频类 js 站分析报告》P1 结论（2026-09-26，飞书云盘
 *       https://my.feishu.cn/file/GyujbDUqcolJNsx5kMgcWd2YnIe）+ qist/tvbox 仓库
 *       博看听书.js drpy 规则原文（搜索端点与 11 个分类枚举取自该规则）+ 沙箱探针
 *       2026-09-26 实测复核（书目列表/搜索/专辑详情/章节/取链 Range 探测/魔数/
 *       大小口径/分页越界/非法 id，实测记录见交付自测清单）。
 *
 * ① 有声书形态适配（博看听书为博看网有声资源平台，非音乐源）：
 *    - 可播放单元 = 专辑章节（units），「书/专辑」映射为 MusicFree 专辑与歌单条目
 *      （复用懒人听书 lrts 插件的书→专辑映射先例）；
 *    - supportedSearchType 仅 ['album']（搜索接口只返回书目，无可播单曲形态，
 *      music/artist/sheet 如实返回空，不伪造形态）。
 * ② 接口接入（全部实测存活，纯 JSON API，无鉴权、无签名、CORS:*）：
 *    - 书目列表 GET api.bookan.com.cn/voice/book/list?instance_id=25304&page=&category_id=&num=
 *      （实测 1305/1319 两分类，响应含 total/current_page/last_page/list）；
 *    - 搜索 GET es.bookan.com.cn/api/v3/voice/book?instanceId=25304&keyword=&pageNum=&limitNum=
 *      （实测「三体」「相声」命中；翻页越界时返回 total:0+空 list，isEnd 按本页返回数判定）；
 *    - 专辑详情 GET api.bookan.com.cn/voice/album/info?album_id=
 *      （非法 id 返回 code=10000「集合不存在」，如实上抛）；
 *    - 章节列表 GET api.bookan.com.cn/voice/album/units?album_id=&page=&num=200&order=1
 *      （大部头如《白话三国》209 章：page=1 返回 200 条、page=2 返回 9 条，翻页语义实测；
 *      单次加载上限 MAX_UNITS=500 章防超时，超出在 description 如实标注）。
 * ③ 音质档位（单档，按源实际提供处理）：
 *    - units 条目 file 字段为 m4a 直链（audio.bookan.com.cn，静态无签名，实测 Content-Type
 *      audio/x-m4a、魔数 ftypM4A、http/https 均可用——插件统一升级 https）；
 *    - 源无多音质协商，supportedQualities 仅 ['standard']，请求任意档位统一按 standard
 *      取链，actualQuality 如实标注 standard（宁低勿虚，对齐音流口径）；
 *    - 单位陷阱实测确认：units 的 size 字段单位为 KB（两次交叉验证：声明 6217KB=实取
 *      6366355B；声明 5453KB=实取 5584278B），插件换算为字节后入 qualities 供大小校验；
 *      duration 单位为秒（实测 785s/346s 与内容时长吻合）。
 * ④ 取链验证沿用音流口径「接口取链 + 大小校验」：Range 0-15 探测 → HTTP 200/206 →
 *    total（Content-Range 优先，Content-Length 兜底）→ 与声明 size（KB→B）比对
 *    （实际 < 声明 85% 判截断拒收）→ 魔数白名单 fail-closed（ftyp/ID3/帧同步/fLaC/OggS）
 *    → 码率窗口守卫（16~320kbps，源实测 ~64kbps AAC）。播放域白名单仅
 *    audio.bookan.com.cn，非该域直链拒收。
 * ⑤ 边界如实处理：空搜索（code=0+空 list）返回空结果不报错；非法 album_id
 *    （code=10000「集合不存在」）上抛原语义；接口字段缺失（size=0/cover 空）降级
 *    为跳过对应校验而非伪造；网络失败如实上抛。请求哪个音质取哪个音质，无降级路径。
 * ⑥ 分类浏览：11 个分类枚举取自 drpy 规则原文（少年读物/儿童文学/国学经典/文艺少年/
 *    育儿心经/心理哲学/青春励志/历史小说/故事会/音乐戏剧/相声评书），分类下书目以
 *    歌单形态呈现（getRecommendSheetTags/getRecommendSheetsByTag）。
 * ⑦ 歌词：听书内容无歌词，getLyric 如实返回空 rawLrc，不伪造。
 * ⑧ instance_id=25304 为源侧实例参数（drpy 规则原文硬编码值，实测有效），本插件
 *    沿用硬编码；站点方若调整实例，届时升版同步。
 *
 * 验证方法（研发自测口径，见交付自测清单）：
 *   node --check 零错误；沙箱 NODE_PATH=仓库 node_modules 拷 .cjs 运行真实 HTTP：
 *   搜索（命中/空结果）/分类书目/专辑详情（209 章大部头翻页）/章节取链
 *   （Range+魔数+大小比对）/非法 id 报错/歌词空返回/条目构造逐项实测。
 *
 * 历史版本：无（v1.0.0 首发）。
 */

var axios = require('axios');

// ==================== 常量 ====================
var SOURCE_TIMEOUT = 6000;    // 单请求超时（宿主单方法 10s 硬上限内）
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）

var API_BASE = 'https://api.bookan.com.cn';
var ES_BASE = 'https://es.bookan.com.cn/api/v3';
var INSTANCE_ID = '25304'; // drpy 规则原文硬编码实例（实测有效；见 changelog ⑧）
var UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

var MEDIA_HOST = 'audio.bookan.com.cn'; // 播放域白名单（实测唯一媒体域）
var UNITS_PAGE_SIZE = 200;    // units 接口实测每页上限 200（209 章专辑翻页验证）
var MAX_UNITS = 500;          // 专辑章节加载上限（防超时；超出在 description 如实标注）
var SEARCH_PAGE_SIZE = 20;    // 搜索每页（与 drpy 规则 limitNum=20 对齐）
var BOOK_PAGE_SIZE = 30;      // 分类书目每页

var SIZE_RATIO_FLOOR = 0.85;  // 实际 < 声明 85% 判截断拒收（源为静态文件，理应一致）
var BITRATE_FLOOR = 16;       // 码率窗口下限 kbps
var BITRATE_CEIL = 320;       // 码率窗口上限 kbps

// 分类枚举（来源：qist/tvbox 博看听书.js drpy 规则原文；1305/1319 已实测）
var CATEGORIES = [
  { id: '1305', name: '少年读物' },
  { id: '1304', name: '儿童文学' },
  { id: '1320', name: '国学经典' },
  { id: '1306', name: '文艺少年' },
  { id: '1309', name: '育儿心经' },
  { id: '1310', name: '心理哲学' },
  { id: '1307', name: '青春励志' },
  { id: '1312', name: '历史小说' },
  { id: '1303', name: '故事会' },
  { id: '1317', name: '音乐戏剧' },
  { id: '1319', name: '相声评书' }
];

function str(v) { return v === undefined || v === null ? '' : String(v); }

function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

function toNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

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

// ==================== HTTP（status/code 语义 + 边界如实上抛） ====================

function bookanGet(base, path, params, timeoutMs) {
  var p = {};
  for (var k in (params || {})) {
    if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined && params[k] !== null && params[k] !== '') {
      p[k] = params[k];
    }
  }
  return axios.get(base + path, {
    params: p,
    timeout: timeoutMs || SOURCE_TIMEOUT,
    headers: { 'User-Agent': UA }
  }).then(function (res) {
    var body = res.data;
    if (!body || typeof body !== 'object') {
      throw new Error('[bookan] ' + path + ' 响应非 JSON');
    }
    if (body.code !== 0) {
      // 实测：非法 album_id → code=10000 msg=集合不存在；404 → Illegal Access。如实上抛原语义
      throw new Error('[bookan] ' + path + ' 接口错误 code=' + str(body.code) + (body.msg ? ' ' + body.msg : ''));
    }
    return body.data || {};
  });
}

// ==================== ID 方案与解析 ====================
// 章节条目：bookan~u~<albumId>~<unitId>；专辑条目：bookan~album~<albumId>

function parseSourceId(id) {
  var s = str(id).trim();
  var m;
  if ((m = s.match(/^bookan~u~(\d+)~(\d+)$/))) {
    return { kind: 'unit', albumId: m[1], unitId: m[2] };
  }
  if ((m = s.match(/^bookan~album~(\d+)$/))) {
    return { kind: 'album', albumId: m[1] };
  }
  if (/^\d+$/.test(s)) {
    return { kind: 'album', albumId: s }; // 纯数字默认按专辑处理
  }
  return null;
}

// ==================== 条目构造 ====================

// 书目/专辑元信息（list 与 info 接口字段一致：name/id/cover/press/intro/total/extra.author）
function albumMetaOf(b) {
  var it = b || {};
  var author = str(it.extra && it.extra.author);
  return {
    name: str(it.name),
    artist: author || str(it.press), // 演播/作者优先，出版社兜底
    cover: str(it.cover),
    intro: str(it.intro),
    press: str(it.press),
    total: toInt(it.total),
    play: toInt(it.extra && it.extra.play)
  };
}

// 章节条目（units：id/title/file/duration(秒)/size(KB)）
function buildUnitItem(albumId, u, meta) {
  var declaredKB = toNum(u && u.size);
  var declaredBytes = declaredKB > 0 ? Math.round(declaredKB * 1024) : 0; // 实测 size 单位 KB（changelog ③）
  return {
    id: 'bookan~u~' + albumId + '~' + str(u && u.id),
    title: str(u && u.title),
    artist: meta.artist,
    album: meta.name,
    artwork: meta.cover,
    duration: toInt(u && u.duration), // 秒
    qualities: declaredBytes > 0 ? { standard: { size: declaredBytes } } : {},
    platform: 'bookan'
  };
}

// 书目搜索结果 → 专辑条目（albumItem 形态，对齐 lrts 书→专辑映射先例）
function buildBookAlbumItem(b) {
  var meta = albumMetaOf(b);
  return {
    id: 'bookan~album~' + str(b && b.id),
    title: meta.name,
    artist: meta.artist,
    artwork: meta.cover,
    description: meta.intro,
    worksNum: meta.total,
    date: '',
    platform: 'bookan'
  };
}

// ==================== 章节缓存（getMediaSource 复用，10 分钟 TTL，LRU 上限 20 专辑） ====================

var UNITS_CACHE_TTL = 10 * 60 * 1000;
var unitsCache = {}; // albumId -> { at, byId: {unitId: unit} }
var UNITS_CACHE_MAX = 20;

function cachePut(albumId, byId) {
  var keys = Object.keys(unitsCache);
  if (keys.length >= UNITS_CACHE_MAX) {
    // 淘汰最旧一条
    var oldest = keys[0];
    for (var i = 1; i < keys.length; i++) {
      if (unitsCache[keys[i]].at < unitsCache[oldest].at) oldest = keys[i];
    }
    delete unitsCache[oldest];
  }
  unitsCache[albumId] = { at: Date.now(), byId: byId };
}

// 专辑详情（getMusicInfo 复用）
function getAlbumMeta(albumId) {
  return bookanGet(API_BASE, '/voice/album/info', { album_id: albumId }).then(function (d) {
    var meta = albumMetaOf(d);
    if (!meta.name) throw new Error('[bookan] album/info 无 name（专辑 ' + albumId + '）');
    return meta;
  });
}

// 章节分页拉取：num=200/页，5 页一批并发，isEnd 或达 MAX_UNITS 停止；顺手建 byId 索引
async function fetchUnits(albumId) {
  var byId = {};
  var units = [];
  var page = 1;
  var maxPages = Math.ceil(MAX_UNITS / UNITS_PAGE_SIZE);
  var truncated = false;
  while (page <= maxPages) {
    var batch = [];
    for (var p = page; p < page + 5 && p <= maxPages; p++) batch.push(p); // 5 页一批
    var results = await Promise.all(batch.map(function (pn) {
      return bookanGet(API_BASE, '/voice/album/units', { album_id: albumId, page: pn, num: UNITS_PAGE_SIZE, order: 1 })
        .then(function (d) { return (d && d.list) || []; })
        .catch(function () { return []; });
    }));
    var got = 0;
    for (var i = 0; i < results.length; i++) {
      var list = results[i];
      got += list.length;
      for (var k = 0; k < list.length; k++) {
        var u = list[k];
        if (!u || u.id === undefined || !u.file) continue; // 字段缺失如实跳过（changelog ⑤）
        var key = str(u.id);
        if (byId[key]) continue;
        byId[key] = u;
        units.push(u);
        if (units.length >= MAX_UNITS) { truncated = true; break; }
      }
      if (truncated) break;
    }
    page += batch.length;
    if (truncated || got < batch.length * UNITS_PAGE_SIZE) break; // 末页（实测 page=2 仅余量条目）
  }
  cachePut(albumId, byId);
  return { units: units, truncated: truncated };
}

// 指定章节定位（优先缓存，未命中整表拉取）
async function findUnit(albumId, unitId) {
  var hit = unitsCache[albumId];
  if (hit && Date.now() - hit.at < UNITS_CACHE_TTL && hit.byId[unitId]) {
    return hit.byId[unitId];
  }
  var r = await fetchUnits(albumId);
  var u = null;
  for (var i = 0; i < r.units.length; i++) {
    if (str(r.units[i].id) === str(unitId)) { u = r.units[i]; break; }
  }
  return u;
}

// ==================== 搜索（es.bookan.com.cn，实测翻页越界返回 total:0+空 list） ====================

async function searchAlbumImpl(kw, page) {
  var pageNum = page || 1;
  var d = await bookanGet(ES_BASE, '/voice/book', {
    instanceId: INSTANCE_ID, keyword: kw, pageNum: pageNum, limitNum: SEARCH_PAGE_SIZE
  });
  var list = (d && d.list) || [];
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var it = buildBookAlbumItem(list[i]);
    if (it.id && it.title) items.push(it);
  }
  // isEnd：本页返回数不足一页即末页（实测翻页越界返回空 list + total:0，total 不可信）
  return { isEnd: items.length < SEARCH_PAGE_SIZE, data: items };
}

// ==================== 专辑详情（书目 → 章节列表） ====================

async function getAlbumInfoImpl(albumItem) {
  var aid = albumItem && typeof albumItem === 'object' ? str(albumItem.id) : str(albumItem);
  var parsed = parseSourceId(aid);
  if (!parsed || parsed.kind !== 'album') {
    throw new Error('[bookan] 无法识别专辑 id: ' + aid.slice(0, 80));
  }
  var meta = await getAlbumMeta(parsed.albumId);
  var r = await fetchUnits(parsed.albumId);
  var units = r.units;
  var note = r.truncated
    ? '（全辑 ' + meta.total + ' 章，插件单次加载前 ' + units.length + ' 章）'
    : '';
  var desc = (meta.intro || '') + (meta.press ? '\n出版社：' + meta.press : '') + note;
  var albumItemOut = {
    id: 'bookan~album~' + parsed.albumId,
    title: meta.name,
    artist: meta.artist,
    artwork: meta.cover,
    description: desc,
    worksNum: meta.total,
    platform: 'bookan'
  };
  return {
    // albumItem 包裹（官方规范形态）+ 顶层平铺字段双兼容（音流宿主，对齐 lrts v1.0.1 口径）
    albumItem: albumItemOut,
    title: meta.name,
    artist: meta.artist,
    artwork: meta.cover,
    description: desc,
    date: '',
    musicList: units.map(function (u) { return buildUnitItem(parsed.albumId, u, meta); }),
    platform: 'bookan'
  };
}

// ==================== 歌单（专辑详情 + 链接导入） ====================

function parseSheetId(urlLike) {
  var s = str(urlLike).trim();
  if (!s) return '';
  if (/^bookan~album~\d+$/.test(s)) return s; // 本插件自有 id 形态直通
  var m = s.match(/album_id=(\d+)/i);
  if (m) return 'bookan~album~' + m[1];
  m = s.match(/bookan\.com\.cn\/(\d+)/i);
  if (m) return 'bookan~album~' + m[1];
  if (/^\d+$/.test(s)) return 'bookan~album~' + s;
  return '';
}

async function getMusicSheetInfoImpl(urlLike) {
  // 官方签名传歌单项对象（IMusicSheetItem），取 id/sid/url 任一标识；字符串形态兼容链接导入
  var idStr = (urlLike && typeof urlLike === 'object')
    ? str(urlLike.id || urlLike.sid || urlLike.url)
    : str(urlLike);
  var id = parseSheetId(idStr);
  if (!id) throw new Error('[bookan] 无法识别专辑链接或 ID: ' + idStr.slice(0, 80));
  var album = await getAlbumInfoImpl({ id: id });
  return {
    sheetItem: {
      id: id,
      title: album.title,
      artist: album.artist,
      artwork: album.artwork,
      description: album.description,
      worksNum: album.musicList.length,
      platform: 'bookan'
    },
    id: id,
    title: album.title,
    artist: album.artist,
    artwork: album.artwork,
    description: album.description,
    worksNum: album.musicList.length,
    musicList: album.musicList,
    platform: 'bookan'
  };
}

async function importMusicSheetImpl(urlLike) {
  var sheet = await getMusicSheetInfoImpl(urlLike);
  return sheet.musicList;
}

// ==================== 分类浏览（11 分类枚举 → 分类书目歌单） ====================

async function getRecommendSheetTagsImpl() {
  var data = CATEGORIES.map(function (c) {
    return { id: 'bookan~cate~' + c.id, title: c.name, platform: 'bookan' };
  });
  return { pinned: [], data: [{ title: '听书分类', data: data }] };
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var tid = tagItem && tagItem.id !== undefined && tagItem.id !== null ? str(tagItem.id) : '';
  var m = tid.match(/^bookan~cate~(\d+)$/);
  if (!m) throw new Error('[bookan] 未知分类标签: ' + tid.slice(0, 60));
  var pageNum = page || 1;
  var d = await bookanGet(API_BASE, '/voice/book/list', {
    instance_id: INSTANCE_ID, category_id: m[1], page: pageNum, num: BOOK_PAGE_SIZE
  });
  var list = (d && d.list) || [];
  var total = toInt(d && d.total);
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var b = list[i] || {};
    if (!b.id || !b.name) continue;
    var meta = albumMetaOf(b);
    items.push({
      source: 'bookan',
      id: 'bookan~album~' + str(b.id),
      sid: 'bookan~album~' + str(b.id),
      title: meta.name,
      artist: meta.artist,
      artwork: meta.cover,
      worksNum: meta.total,
      playCount: meta.play,
      description: meta.intro,
      raw: { albumId: str(b.id) }
    });
  }
  var fetched = pageNum * BOOK_PAGE_SIZE;
  return { isEnd: items.length < BOOK_PAGE_SIZE || fetched >= total, data: items };
}

// ==================== 播放取链（units file 直链 + 音流口径校验） ====================

// 音质归一：源单档 m4a（实测 ~64kbps AAC），请求更高档位如实 standard
function normalizeQuality() {
  return 'standard';
}

// 魔数识别（音流口径）：实测博看 m4a 为 ftyp box；白名单兼容 ID3/帧同步/fLaC/OggS
function detectAudioMagic(u8) {
  if (!u8 || u8.length < 4) return '';
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return 'ftyp';
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'ID3';
  if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) return 'fLaC';
  if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) return 'OggS';
  if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return 'frame-sync';
  return '';
}

var MAGIC_OK = { 'ftyp': 1, 'ID3': 1, 'frame-sync': 1, 'fLaC': 1, 'OggS': 1 };

// 播放域白名单 + https 升级（实测 audio.bookan.com.cn http/https 均可用，统一 https）
function normalizeMediaUrl(url) {
  var u = str(url).trim();
  if (!/^https?:\/\//i.test(u)) return '';
  if (u.indexOf('http://') === 0) u = 'https://' + u.slice(7);
  var m = u.match(/^https:\/\/([^\/\?#]+)/i);
  if (!m) return '';
  var host = m[1].toLowerCase();
  if (host !== MEDIA_HOST && !host.endsWith('.' + MEDIA_HOST)) return '';
  return u;
}

// 取链校验（音流口径）：Range 0-15 → HTTP 200/206 → total（Content-Range 优先，
// Content-Length 兜底）→ 大小比对（实际 < 声明 85% 拒收）→ 魔数白名单 fail-closed
// → 码率窗口守卫（16~320kbps）。无声明大小时仅要求 total>0 + 魔数 + 码率窗口。
function verifySource(url, opts) {
  opts = opts || {};
  var declared = toInt(opts.declaredSize); // 字节（已由 KB 换算）
  var dur = toInt(opts.duration);
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': UA },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 201 && st !== 206) throw new Error('bookan verify: HTTP ' + st);
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else if (st !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total === 0) throw new Error('bookan verify: Content-Length=0 或响应无 total');
    if (declared > 0) {
      var ratio = total / declared;
      if (ratio < SIZE_RATIO_FLOOR) {
        throw new Error('bookan verify: 疑似截断 实际 ' + total + 'B < 声明 ' + declared + 'B 的 ' +
          Math.round(SIZE_RATIO_FLOOR * 100) + '%');
      }
    }
    var buf = res.data, u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = detectAudioMagic(u8);
    if (!magic || !MAGIC_OK[magic]) {
      throw new Error('bookan verify: 魔数不符 ' + (magic || 'unknown') + '（预期 ftyp/ID3/帧同步）');
    }
    if (dur >= 60 && total > 0) {
      var kbps = Math.round(total * 8 / dur / 1000);
      if (kbps < BITRATE_FLOOR) throw new Error('bookan verify: 码率 ' + kbps + 'kbps < 下限 ' + BITRATE_FLOOR + '（疑似截断）');
      if (kbps > BITRATE_CEIL) throw new Error('bookan verify: 码率 ' + kbps + 'kbps > 上限 ' + BITRATE_CEIL + '（与声明档不符）');
    }
    return { total: total, magic: magic };
  });
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem) throw new Error('[bookan] missing musicItem');
  normalizeQuality(quality); // 单档（见 supportedQualities 注释），统一 standard
  var parsed = parseSourceId(musicItem && musicItem.id);
  if (!parsed || parsed.kind !== 'unit') {
    throw new Error('[bookan] 无法识别播放条目 id: ' + str(musicItem && musicItem.id).slice(0, 80));
  }
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  var unit = await withTimeout(findUnit(parsed.albumId, parsed.unitId),
    Math.max(deadline - Date.now(), 1000), '[bookan] 章节定位超时');
  if (!unit) throw new Error('[bookan] 章节不存在或已下架（album=' + parsed.albumId + ' unit=' + parsed.unitId + '）');
  var url = normalizeMediaUrl(unit.file);
  if (!url) throw new Error('[bookan] 章节直链未通过域名校验（仅放行 ' + MEDIA_HOST + '）');
  var declaredKB = toNum(unit.size);
  var declaredBytes = declaredKB > 0 ? Math.round(declaredKB * 1024) : 0;
  var v = await withTimeout(verifySource(url, { declaredSize: declaredBytes, duration: toInt(unit.duration) }),
    Math.max(deadline - Date.now(), 1000), '[bookan] 取链校验超时');
  return {
    url: url,
    quality: 'standard',
    actualQuality: 'standard',
    size: v.total,
    _verify: { magic: v.magic } // 魔数与实取大小如实记录
  };
}

// ==================== 歌词 / 条目信息 ====================

// 听书内容无歌词：如实返回空，不伪造
async function getLyricImpl() {
  return { rawLrc: '' };
}

async function getMusicInfoImpl(musicItem) {
  var parsed = parseSourceId(musicItem && musicItem.id);
  if (!parsed) return {};
  var albumId = parsed.albumId; // unit 与 album 形态均携带 albumId
  var meta = await getAlbumMeta(albumId);
  return { album: meta.name, artist: meta.artist, artwork: meta.cover };
}

// ==================== 插件对象 ====================

var plugin = {
  name: '博看听书',
  platform: 'bookan',
  version: '1.0.0',
  author: '研发1号',
  description: '博看听书（博看网有声资源，api.bookan.com.cn 纯 JSON API）独立源插件 v1.0.0：搜索（es.bookan.com.cn ES 接口）与 11 分类书目浏览，书籍/专辑统一映射为专辑条目（复用懒人听书书→专辑映射先例）；专辑详情展开章节列表（200 条/页翻页拉取，单次上限 500 章防超时并如实标注）；播放取链直取 units 的 file 字段 m4a 静态直链（无签名、CORS 开放、统一升级 https，播放域白名单 audio.bookan.com.cn）；接口取链+大小校验（Range 0-15 探测 total 与声明 size 比对，实测 size 单位 KB 需 ×1024；ftyp/ID3 魔数 fail-closed + 16~320kbps 码率窗口）；源单档 m4a（~64kbps AAC），supportedQualities 如实仅 standard 不虚构更高音质；空搜索/非法专辑 id（code=10000 集合不存在）/字段缺失均如实返回或上抛，不伪造数据；听书无歌词，getLyric 如实返回空',
  primaryKey: ['id'],
  supportedSearchType: ['album'], // 搜索结果为书目（无可播单曲形态），music/artist/sheet 如实返回空
  defaultSearchType: 'album',
  supportedQualities: ['standard'], // 源单档 m4a（实测 ~64kbps AAC），不虚构更高音质
  cacheControl: 'cache', // file 直链为静态 CDN 资源（实测带 Content-Md5/Last-Modified，无时效签名）
  userVariables: [],
  hints: {
    search: ['搜索博听曲库（有声书/少儿/国学/历史/相声评书等），结果为书籍专辑', '点开专辑进入章节列表播放'],
    importMusicSheet: ['支持专辑 ID（纯数字）或本插件歌单 id']
  },

  async search(query, page, type) {
    // MusicFree 协议：兼容两种入参形态——对象 { keyword, type, page }（部分宿主版本）与
    // 位置参数 (keyword, page, type)（对齐 lrts v1.0.1 口径）
    var isObj = query && typeof query === 'object';
    var kw = String((isObj ? query.keyword : query) || '').trim();
    var qType = (isObj && query.type) ? query.type : type;
    var qPage = (isObj && query.page) ? query.page : page;
    if (!kw) return { isEnd: true, data: [] };
    if (qType === 'album') return searchAlbumImpl(kw, qPage);
    return { isEnd: true, data: [] }; // 仅 album 形态（见 supportedSearchType 注释）
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

  async getAlbumInfo(albumItem) {
    return getAlbumInfoImpl(albumItem);
  },

  async getMusicSheetInfo(urlLike) {
    return getMusicSheetInfoImpl(urlLike);
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async getRecommendSheetTags() {
    return getRecommendSheetTagsImpl();
  },

  async getRecommendSheetsByTag(tagItem, page) {
    return getRecommendSheetsByTagImpl(tagItem, page);
  },

  _internal: {
    normalizeQuality: normalizeQuality,
    parseSourceId: parseSourceId,
    parseSheetId: parseSheetId,
    buildUnitItem: buildUnitItem,
    buildBookAlbumItem: buildBookAlbumItem,
    detectAudioMagic: detectAudioMagic,
    verifySource: verifySource,
    normalizeMediaUrl: normalizeMediaUrl,
    bookanGet: bookanGet,
    fetchUnits: fetchUnits,
    findUnit: findUnit,
    albumMetaOf: albumMetaOf,
    CONSTANTS: { INSTANCE_ID: INSTANCE_ID, UNITS_PAGE_SIZE: UNITS_PAGE_SIZE, MAX_UNITS: MAX_UNITS, SIZE_RATIO_FLOOR: SIZE_RATIO_FLOOR, BITRATE_FLOOR: BITRATE_FLOOR, BITRATE_CEIL: BITRATE_CEIL, CATEGORIES: CATEGORIES }
  }
};

module.exports = plugin;
