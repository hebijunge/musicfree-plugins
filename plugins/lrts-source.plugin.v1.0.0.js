/**
 * 懒人听书独立源插件 v1.0.0（MusicFree 插件规范 · 音流宿主对齐）
 *
 * ==================== v1.0.0 changelog（首发版） ====================
 * 依据：《懒人听书接口完整文档_综合实测版.md》v1.5（2026-09-24 用户提供飞书附件，接口端点/参数/
 *       字段/付费行为均以该文档为权威依据）+ 沙箱探针 2026-09-24 实测复核（搜索/详情/章节/取链/
 *       付费拦截/分类/专辑全链路，探针结论见交付自测清单）。
 *
 * ① 有声书形态适配（懒人听书为腾讯音乐系听书平台，非音乐源）：
 *    - 可播放单元 = 章节/专辑音频，搜索与榜单语义中的「书/专辑」映射为 MusicFree 专辑与歌单条目；
 *    - supportedSearchType 仅 ['album']（/ajax/search 的 bookResult+albumResult 均映射为专辑，
 *      music/artist/sheet 类型如实返回空——搜索结果无直接可播单曲，不伪造形态）；
 *    - getAlbumInfo / getMusicSheetInfo 返回章节列表（每页 50 章分页拉取，大部头上限
 *      MAX_ALBUM_CHAPTERS=500 章防超时，超出部分在 description 如实标注）。
 * ② 接口接入（全部实测存活）：
 *    - 搜索 /ajax/search（keyWord 驼峰参数，文档 3.1 实测要点）；
 *    - 书籍详情 /ajax/getBookInfo；章节列表 /ajax/getBookMenu（pageSize=50，sortType=0 正序）；
 *    - 播放取链 /ajax/getPlayPath（entityType 3=书籍/2=专辑；sections=[章节号或audioId]）；
 *    - 备用取链 /ajax/getListenPath（getPlayPath 返回空 list 且 status=0 时启用，仅书籍，文档 2.3.1）；
 *    - 专辑 /ajax/getAlbumInfo + /ajax/getAlbumAudios（20 条/页）；
 *    - 分类 /ajax/getCategory（bookTypeList 11 类 + labelTypeList 38 标签）。
 * ③ 音质档位（文档实测：免费内容免登录仅 ~46-98kbps 一档，M4A/MP3）：
 *    - supportedQualities 仅 ['standard']，不虚构更高音质；请求任意档位统一按 standard 取链，
 *      actualQuality 如实标注 standard（宁低勿虚，对齐音流口径）；
 *    - 章节列表 size 字段为完整档声明大小；免登录实取约为声明的 50%（文档 2.3 注 + 本次探针
 *      复核：声明 9336739B / 实取 4665605B）。大小比对因此按双口径分类：
 *      实际≥声明 90% → 完整档匹配通过；实际∈[声明 25%, 90%) → 免登录低音质档（文档实测正常
 *      现象，非虚标），须再过魔数 + 码率窗口复核后放行；实际<声明 25% → 判截断/试听异常拒收。
 * ④ 取链验证沿用音流口径：请求哪个音质就获取哪个音质；Range 0-15 探测链接响应头
 *    Content-Range total / Content-Length 与章节列表声明 size 比对 + 魔数校验
 *    （ftyp=M4A / ID3·帧同步=MP3，实测书籍为 ftyp、专辑音频为 mp3；未知魔数 fail-closed 拒收）
 *    + 码率窗口守卫（16~320kbps，覆盖免费 46-98k 档，低于下限判截断拒收）。
 * ⑤ 付费内容（文档 2.3.0 实测无法绕过，如实标注不绕过付费）：
 *    - 付费章节（payType!=0 / cantListen!=0 / listenPrice>0）在标题追加「｜付费」如实标注；
 *    - 取链遇 status=2「收费章节未购买」直接抛出原语义错误，不做任何参数组合绕过尝试；
 *    - 登录接口 /ajax/logon 已被服务端限制（文档 2.4 实测），本插件不实现登录。
 * ⑥ 分类与榜单：
 *    - /ajax/getRank 排行榜上游未突破（文档实测所有参数组合返回空）→ 不实现 getTopLists/
 *      getTopListDetail，如实不提供该入口；
 *    - /ajax/getBookList 的 categoryId 实测不生效（文档 3.5 + 本次探针复核：不同 categoryId
 *      返回同一列表）→ 分类浏览走 getCategory 拿分类名 + 搜索 API 替代（文档 3.5 建议口径），
 *      分类下书籍以歌单形态呈现（getRecommendSheetTags/getRecommendSheetsByTag）。
 * ⑦ 歌词：有声书内容无歌词（文档缺点 7），getLyric 如实返回空 rawLrc，不伪造。
 *
 * 验证方法（研发自测口径，见交付自测清单）：
 *   node --check 零错误；沙箱 NODE_PATH=仓库 node_modules 拷 .cjs 运行真实 HTTP：
 *   搜索/专辑详情（书籍 500 章上限 + 专辑 75 章）/免费章节取链（Range+魔数+大小分类）/
 *   付费章节拦截/getListenPath 兜底/歌词空返回/歌单导入/分类标签与分类书籍/条目付费标注逐项实测。
 *
 * 历史版本：无（v1.0.0 首发）。
 */

var axios = require('axios');

// ==================== 常量 ====================
var SOURCE_TIMEOUT = 6000;    // 单请求超时（宿主单方法 10s 硬上限内）
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）

var LRTS_BASE = 'https://m.lrts.me/ajax/';
// 文档 2.1/3.1 请求头：旧版安卓 UA + m 站 Referer（实测两套 UA 均可用，取文档权威值）
var LRTS_UA = 'Mozilla/5.0 (Linux; U; Android 4.1.1; zh-cn; MI2 Build/JRO03L) AppleWebKit/534.30';
var LRTS_REFERER = 'https://m.lrts.me/';

var CHAPTER_PAGE_SIZE = 50;   // getBookMenu 每页上限 50（文档 2.2）
var ALBUM_AUDIO_PAGE_SIZE = 20; // getAlbumAudios 20 条/页（文档 3.6）
var MAX_ALBUM_CHAPTERS = 500; // 专辑/书籍章节加载上限（大部头如 4477 章，防超时；如实标注截断）

// 大小比对口径（本文件头 changelog ③）：完整档匹配下限 / 免登录低音质档下限
var FULL_SIZE_RATIO = 0.9;
var FREE_LOW_SIZE_RATIO = 0.25;
// 码率窗口（kbps）：免费档 46-98k，专辑 mp3 实测口径放宽到 [16, 320]
var BITRATE_FLOOR = 16;
var BITRATE_CEIL = 320;

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

// ==================== HTTP（文档请求头 + status 语义） ====================

function lrtsGet(path, params, timeoutMs) {
  var p = {};
  for (var k in (params || {})) {
    if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined && params[k] !== null && params[k] !== '') {
      p[k] = params[k];
    }
  }
  return axios.get(LRTS_BASE + path, {
    params: p,
    timeout: timeoutMs || SOURCE_TIMEOUT,
    headers: { 'User-Agent': LRTS_UA, Referer: LRTS_REFERER }
  }).then(function (res) {
    var body = res.data;
    if (!body || typeof body !== 'object') {
      throw new Error('[lrts] ' + path + ' 响应非 JSON');
    }
    return body;
  });
}

// 付费/不可听语义错误识别（文档 2.3：status=2「收费章节未购买」；status=3「付费内容请先购买」）
function paidErrorMessage(body) {
  var msg = str(body && body.msg);
  if (toNum(body && body.status) === 2 || /收费|未购买|购买|付费/.test(msg)) {
    return '付费内容需购买后才能播放（懒人听书官方限制，本插件不绕过付费）：' + (msg || 'status=' + str(body && body.status));
  }
  return '';
}

// ==================== ID 方案与解析 ====================
// 章节：lrts~b~<bookId>~<section>~<sectionId?>；专辑音频：lrts~a~<albumId>~<audioId>
// 书籍专辑条目：lrts~book~<id>；专辑条目：lrts~album~<id>

function parseSourceId(id) {
  var s = str(id).trim();
  var m;
  if ((m = s.match(/^lrts~b~(\d+)~(\d+)(?:~(\d+))?$/))) {
    return { kind: 'chapter', entityType: 3, entityId: m[1], section: m[2], sectionId: m[3] || '' };
  }
  if ((m = s.match(/^lrts~a~(\d+)~(\d+)$/))) {
    return { kind: 'albumAudio', entityType: 2, entityId: m[1], audioId: m[2] };
  }
  if ((m = s.match(/^lrts~book~(\d+)$/))) {
    return { kind: 'book', bookId: m[1] };
  }
  if ((m = s.match(/^lrts~album~(\d+)$/))) {
    return { kind: 'album', albumId: m[1] };
  }
  if (/^\d+$/.test(s)) {
    return { kind: 'book', bookId: s }; // 纯数字默认按书籍处理
  }
  return null;
}

// ==================== 条目构造 ====================

// 书籍详情 → 元信息（announcer 为主播/演播，映射到 artist；author 为原作者）
function bookMetaOf(bookInfo) {
  var b = bookInfo || {};
  return {
    name: str(b.name),
    announcer: str(b.announcer) || str(b.author),
    author: str(b.author),
    cover: str(b.cover),
    desc: str(b.desc),
    sections: toInt(b.sections)
  };
}

// 章节付费判定（文档 2.2 字段：payType 0=免费 / cantListen 0=可听 / listenPrice 0=免费）
function isPaidChapter(ch) {
  return toInt(ch && ch.payType) !== 0 || toInt(ch && ch.cantListen) !== 0 || toNum(ch && ch.listenPrice) > 0;
}

function buildChapterItem(bookId, ch, meta, idx) {
  var section = toInt(ch && (ch.section !== undefined ? ch.section : (idx !== undefined ? idx + 1 : 0)));
  var sectionId = str(ch && (ch.id !== undefined ? ch.id : ch.sectionId));
  var id = 'lrts~b~' + bookId + '~' + section + (sectionId ? '~' + sectionId : '');
  var declared = toInt(ch && ch.size);
  var item = {
    id: id,
    title: str(ch && ch.name) + (isPaidChapter(ch) ? '｜付费' : ''),
    artist: meta.announcer,
    album: meta.name,
    artwork: meta.cover,
    duration: toInt(ch && ch.length),
    qualities: declared > 0 ? { standard: { size: declared } } : {},
    platform: 'lrts'
  };
  return item;
}

// 专辑音频条目（getAlbumAudios：audioId/name/length）
function buildAlbumAudioItem(albumId, a, meta) {
  var declared = toInt(a && a.size);
  return {
    id: 'lrts~a~' + albumId + '~' + str(a && a.audioId),
    title: str(a && a.name),
    artist: meta.announcer,
    album: meta.name,
    artwork: meta.cover,
    duration: toInt(a && a.length),
    qualities: declared > 0 ? { standard: { size: declared } } : {},
    platform: 'lrts'
  };
}

// 书籍搜索结果 → 专辑条目（ albumItem 形态，对齐 qianqian buildMusicItem 专辑口径）
function buildBookAlbumItem(b) {
  return {
    id: 'lrts~book~' + str(b && b.id),
    title: str(b && b.name),
    artist: str(b && (b.announcer || b.author)),
    artwork: str(b && b.cover),
    description: str(b && b.desc),
    worksNum: toInt(b && b.sections),
    date: '',
    platform: 'lrts'
  };
}

function buildAlbumAlbumItem(a) {
  return {
    id: 'lrts~album~' + str(a && a.id),
    title: str(a && a.name),
    artist: str(a && (a.nickName || '')),
    artwork: str(a && a.cover),
    description: str(a && a.description),
    worksNum: toInt(a && a.sections),
    date: '',
    platform: 'lrts'
  };
}

// ==================== 书籍详情缓存（getMusicInfo 复用，10 分钟 TTL） ====================

var BOOK_CACHE_TTL = 10 * 60 * 1000;
var bookCache = {}; // bookId -> { at, meta }

function getBookMeta(bookId) {
  var hit = bookCache[bookId];
  if (hit && Date.now() - hit.at < BOOK_CACHE_TTL) return Promise.resolve(hit.meta);
  return lrtsGet('getBookInfo', { id: bookId }).then(function (b) {
    var meta = bookMetaOf(b);
    if (!meta.name) throw new Error('[lrts] getBookInfo 无 name（bookId=' + bookId + '）');
    bookCache[bookId] = { at: Date.now(), meta: meta };
    return meta;
  });
}

// ==================== 搜索（keyWord 驼峰参数，文档 3.1 实测要点） ====================

async function searchAlbumImpl(kw, page) {
  var pageNum = page || 1;
  var d = await lrtsGet('search', { keyWord: kw, pageSize: 30, pageNum: pageNum, searchOption: 1 });
  var data = (d && d.data) || {};
  var books = (data.bookResult && data.bookResult.list) || [];
  var albums = (data.albumResult && data.albumResult.list) || [];
  var items = [];
  for (var i = 0; i < books.length; i++) {
    var it = buildBookAlbumItem(books[i]);
    if (it.id && it.title) items.push(it);
  }
  for (var j = 0; j < albums.length; j++) {
    var it2 = buildAlbumAlbumItem(albums[j]);
    if (it2.id && it2.title) items.push(it2);
  }
  // isEnd：书籍结果不足 pageSize 即末页（albumResult 固定 20 条上限，以 bookResult 口径为准）
  var bookCount = toInt(data.bookResult && data.bookResult.count);
  var fetched = pageNum * 30;
  var isEnd = items.length === 0 || fetched >= Math.max(bookCount, 1);
  return { isEnd: isEnd, data: items };
}

// ==================== 专辑详情（书籍 → 章节；专辑 → 音频列表） ====================

// 章节分页拉取：getBookMenu pageSize=50，并发分批，isEnd 或达 MAX_ALBUM_CHAPTERS 停止
async function fetchBookChapters(bookId, meta) {
  var total = meta.sections || 0;
  var maxPages = Math.min(Math.ceil(total / CHAPTER_PAGE_SIZE) || 1, Math.ceil(MAX_ALBUM_CHAPTERS / CHAPTER_PAGE_SIZE));
  var chapters = [];
  var page = 1;
  while (page <= maxPages) {
    var batch = [];
    for (var p = page; p < page + 5 && p <= maxPages; p++) batch.push(p); // 5 页一批
    var results = await Promise.all(batch.map(function (pn) {
      return lrtsGet('getBookMenu', { bookId: bookId, pageNum: pn, pageSize: CHAPTER_PAGE_SIZE, sortType: 0 })
        .then(function (d) { return (d && d.list) || []; })
        .catch(function () { return []; });
    }));
    var got = 0;
    for (var i = 0; i < results.length; i++) {
      var list = results[i];
      got += list.length;
      for (var k = 0; k < list.length; k++) {
        chapters.push(buildChapterItem(bookId, list[k], meta, (batch[i] - 1) * CHAPTER_PAGE_SIZE + k));
      }
    }
    page += batch.length;
    if (got < batch.length * CHAPTER_PAGE_SIZE) break; // 末页
  }
  return chapters.slice(0, MAX_ALBUM_CHAPTERS);
}

// 专辑音频拉取：getAlbumAudios 实测忽略 pageNum/pageSize、单次返回全量（2026-09-24 探针：
// pageNum=1/2 均返回 75 条同列表），故单次请求 + audioId 去重兜底；仍按 total 截断到上限
async function fetchAlbumAudios(albumId, meta) {
  var total = meta.sections || 0;
  var d = await lrtsGet('getAlbumAudios', { ablumnId: albumId, sortType: 0 }).catch(function () { return null; });
  var list = (d && d.list) || [];
  var audios = [];
  var seen = {};
  for (var k = 0; k < list.length && audios.length < MAX_ALBUM_CHAPTERS; k++) {
    var a = list[k];
    if (!a || !a.audioId || seen[a.audioId]) continue;
    seen[a.audioId] = 1;
    audios.push(buildAlbumAudioItem(albumId, a, meta));
  }
  return audios;
}

async function getAlbumInfoImpl(albumItem, page) {
  var aid = albumItem && typeof albumItem === 'object' ? str(albumItem.id) : str(albumItem);
  var parsed = parseSourceId(aid);
  if (!parsed || (parsed.kind !== 'book' && parsed.kind !== 'album')) {
    throw new Error('[lrts] 无法识别专辑 id: ' + aid.slice(0, 80));
  }
  if (parsed.kind === 'book') {
    var meta = await getBookMeta(parsed.bookId);
    var chapters = await fetchBookChapters(parsed.bookId, meta);
    var note = meta.sections > chapters.length
      ? '（全书 ' + meta.sections + ' 章，插件单次加载前 ' + chapters.length + ' 章）'
      : '';
    return {
      title: meta.name,
      artist: meta.announcer,
      artwork: meta.cover,
      description: (meta.desc || '') + note,
      date: '',
      musicList: chapters,
      platform: 'lrts'
    };
  }
  // 专辑形态
  var info = await lrtsGet('getAlbumInfo', { id: parsed.albumId });
  var ab = (info && info.ablumn) || {};
  var meta2 = { name: str(ab.name), announcer: str(ab.nickName) || str(ab.author), cover: str(ab.cover), desc: str(ab.description || ab.desc), sections: toInt(ab.sections) };
  if (!meta2.name) throw new Error('[lrts] getAlbumInfo 无 name（专辑 ' + parsed.albumId + '，可能已下线）');
  var list = await fetchAlbumAudios(parsed.albumId, meta2);
  var note2 = meta2.sections > list.length
    ? '（全辑 ' + meta2.sections + ' 集，插件单次加载前 ' + list.length + ' 集）'
    : '';
  return {
    title: meta2.name,
    artist: meta2.announcer,
    artwork: meta2.cover,
    description: (meta2.desc || '') + note2,
    date: '',
    musicList: list,
    platform: 'lrts'
  };
}

// ==================== 歌单（书籍/专辑详情 + 链接导入） ====================

function parseSheetId(urlLike) {
  var s = str(urlLike).trim();
  if (!s) return '';
  if (/^lrts~(?:book|album)~\d+$/.test(s)) return s; // 本插件自有 id 形态直通
  var m = s.match(/lrts\.me\/book\/(\d+)/i);
  if (m) return 'lrts~book~' + m[1];
  m = s.match(/lrts\.me\/album\/(\d+)/i);
  if (m) return 'lrts~album~' + m[1];
  m = s.match(/(?:bookId|albumId|id)=(\d+)/i);
  if (m) return 'lrts~book~' + m[1];
  if (/^\d+$/.test(s)) return 'lrts~book~' + s;
  return '';
}

async function getMusicSheetInfoImpl(urlLike) {
  var id = parseSheetId(urlLike);
  if (!id) throw new Error('[lrts] 无法识别书籍/专辑链接或 ID: ' + str(urlLike).slice(0, 80));
  var album = await getAlbumInfoImpl({ id: id });
  return {
    id: id,
    title: album.title,
    artist: album.artist,
    artwork: album.artwork,
    description: album.description,
    worksNum: album.musicList.length,
    musicList: album.musicList,
    platform: 'lrts'
  };
}

async function importMusicSheetImpl(urlLike) {
  var sheet = await getMusicSheetInfoImpl(urlLike);
  return sheet.musicList;
}

// ==================== 分类浏览（getCategory 分类名 + 搜索替代，文档 3.5 建议口径） ====================

async function getRecommendSheetTagsImpl() {
  var d = await lrtsGet('getCategory', {});
  var data = (d && d.data) || {};
  var groups = [];
  var bookTypes = data.bookTypeList || [];
  var labels = data.labelTypeList || [];
  function toTag(x) {
    if (!x || x.id === undefined || x.id === null || !x.name) return null;
    return { id: 'lrts~cate~' + str(x.id) + '~' + encodeURIComponent(str(x.name)), title: str(x.name), platform: 'lrts' };
  }
  var g1 = [];
  for (var i = 0; i < bookTypes.length; i++) { var t = toTag(bookTypes[i]); if (t) g1.push(t); }
  if (g1.length) groups.push({ title: '书籍分类', data: g1 });
  var g2 = [];
  for (var j = 0; j < labels.length; j++) { var t2 = toTag(labels[j]); if (t2) g2.push(t2); }
  if (g2.length) groups.push({ title: '热门标签', data: g2 });
  return { pinned: [], data: groups };
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var tid = tagItem && tagItem.id !== undefined && tagItem.id !== null ? str(tagItem.id) : '';
  var m = tid.match(/^lrts~cate~\d+~(.+)$/);
  if (!m) throw new Error('[lrts] 未知分类标签: ' + tid.slice(0, 60));
  var kw = '';
  try { kw = decodeURIComponent(m[1]); } catch (e) { kw = m[1]; }
  var pageNum = page || 1;
  var d = await lrtsGet('search', { keyWord: kw, pageSize: 30, pageNum: pageNum, searchOption: 1 });
  var books = ((d && d.data && d.data.bookResult) || {}).list || [];
  var items = [];
  for (var i = 0; i < books.length; i++) {
    var b = books[i] || {};
    if (!b.id || !b.name) continue;
    items.push({
      source: 'lrts',
      sid: 'lrts~book~' + str(b.id),
      title: str(b.name),
      artist: str(b.announcer || b.author || ''),
      artwork: str(b.cover || ''),
      worksNum: toInt(b.sections),
      playCount: toInt(b.play),
      description: str(b.desc || ''),
      raw: { bookId: str(b.id) }
    });
  }
  return { isEnd: items.length < 30, data: items };
}

// ==================== 播放取链（getPlayPath + getListenPath 兜底 + 音流口径校验） ====================

// 音质归一：平台免登录仅 standard 一档（文档实测 46-98kbps），请求更高档位如实降档
function normalizeQuality(q) {
  return 'standard';
}

// 魔数识别（音流口径）：ftyp=M4A（书籍实测）/ ID3、帧同步=MP3（专辑实测）/ fLaC、OggS 兼容收录
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

// 取链校验（音流口径）：Range 0-15 → HTTP 200/206 → total（Content-Range 优先，Content-Length 兜底）
// → 大小比对（双口径分类，见 changelog ③④）→ 魔数白名单 fail-closed → 码率窗口守卫。
function verifySource(url, opts) {
  opts = opts || {};
  var declared = toInt(opts.declaredSize);
  var dur = toInt(opts.duration);
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': LRTS_UA, Referer: LRTS_REFERER },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 201 && st !== 206) throw new Error('lrts verify: HTTP ' + st);
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else if (st !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total === 0) throw new Error('lrts verify: Content-Length=0 或响应无 total');
    // 大小比对双口径：>=90% 完整档；[25%,90%) 免登录低音质档（文档实测正常现象）；
    // <25% 判截断/试听异常拒收。无声明大小时仅要求 total>0 + 码率窗口。
    if (declared > 0) {
      var ratio = total / declared;
      if (ratio < FREE_LOW_SIZE_RATIO) {
        throw new Error('lrts verify: 疑似截断/试听 实际 ' + total + 'B < 声明 ' + declared + 'B 的 ' +
          Math.round(FREE_LOW_SIZE_RATIO * 100) + '%');
      }
    }
    var buf = res.data, u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = detectAudioMagic(u8);
    if (!magic || !MAGIC_OK[magic]) {
      throw new Error('lrts verify: 魔数不符 ' + (magic || 'unknown') + '（预期 ftyp/ID3/帧同步）');
    }
    if (dur >= 60 && total > 0) {
      var kbps = Math.round(total * 8 / dur / 1000);
      if (kbps < BITRATE_FLOOR) throw new Error('lrts verify: 码率 ' + kbps + 'kbps < 下限 ' + BITRATE_FLOOR + '（疑似截断）');
      if (kbps > BITRATE_CEIL) throw new Error('lrts verify: 码率 ' + kbps + 'kbps > 上限 ' + BITRATE_CEIL + '（与声明档不符）');
    }
    return { total: total, magic: magic, tier: declared > 0 && total >= declared * FULL_SIZE_RATIO ? 'full' : 'free-low' };
  });
}

// 单次取链：getPlayPath（entityType 3=书籍 sections=[章节号] / 2=专辑 sections=[audioId]）
function getPlayPath(entityId, entityType, sectionRef) {
  return lrtsGet('getPlayPath', {
    entityId: entityId, entityType: entityType, opType: 1,
    sections: '[' + sectionRef + ']', type: 0
  }).then(function (d) {
    var paidMsg = paidErrorMessage(d);
    if (paidMsg) { var e = new Error(paidMsg); e.paid = true; throw e; }
    var list = (d && d.list) || [];
    var path = (list[0] && list[0].path) || '';
    if (!path || !/^https?:\/\//i.test(path)) {
      var err = new Error('[lrts] getPlayPath 无有效 path');
      err.empty = true;
      throw err;
    }
    return path;
  });
}

// 备用取链：getListenPath（文档 2.3.1，仅书籍；需 id=章节ID + section=章节号）
function getListenPathFallback(parsed) {
  return lrtsGet('getListenPath', {
    entityId: parsed.entityId, entityType: 3, opType: 1,
    sections: '[' + parsed.section + ']', type: 0,
    id: parsed.sectionId || '', section: parsed.section
  }).then(function (d) {
    var paidMsg = paidErrorMessage(d);
    if (paidMsg) { var e = new Error(paidMsg); e.paid = true; throw e; }
    var path = (d && d.data && d.data.path) || '';
    if (!path || !/^https?:\/\//i.test(path)) throw new Error('[lrts] getListenPath 无有效 path');
    return path;
  });
}

// URL 白名单：仅 https（CDN vb.stream.tencentmusic.com 为 https；http 一律拒收）
function isAllowedMediaUrl(url) {
  return /^https:\/\//i.test(str(url).trim());
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem) throw new Error('[lrts] missing musicItem');
  var q = normalizeQuality(quality); // 统一 standard（宁低勿虚）
  var parsed = parseSourceId(musicItem && musicItem.id);
  if (!parsed || (parsed.kind !== 'chapter' && parsed.kind !== 'albumAudio')) {
    throw new Error('[lrts] 无法识别播放条目 id: ' + str(musicItem && musicItem.id).slice(0, 80));
  }
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  var sectionRef = parsed.kind === 'chapter' ? parsed.section : parsed.audioId;
  var url = null;
  try {
    url = await withTimeout(getPlayPath(parsed.entityId, parsed.entityType, sectionRef),
      Math.max(deadline - Date.now(), 1000), '[lrts] getPlayPath 超时');
  } catch (e) {
    if (e && e.paid) throw e; // 付费错误如实上抛，不绕过
    if (parsed.kind !== 'chapter') throw e; // 备用接口仅书籍（文档 2.3.1）
    // 主接口返回空 list（status=0）→ getListenPath 兜底
    url = await withTimeout(getListenPathFallback(parsed),
      Math.max(deadline - Date.now(), 1000), '[lrts] getListenPath 兜底超时');
  }
  if (!isAllowedMediaUrl(url)) throw new Error('[lrts] 取链 URL 未通过协议校验（仅放行 https）');
  var declaredSize = musicItem && musicItem.qualities && musicItem.qualities.standard
    ? toInt(musicItem.qualities.standard.size) : 0;
  var v = await withTimeout(verifySource(url, { declaredSize: declaredSize, duration: toInt(musicItem && musicItem.duration) }),
    Math.max(deadline - Date.now(), 1000), '[lrts] 取链校验超时');
  return {
    url: url,
    quality: 'standard',
    actualQuality: 'standard',
    size: v.total,
    headers: { 'User-Agent': LRTS_UA, Referer: LRTS_REFERER },
    _verify: { magic: v.magic, tier: v.tier } // 完整档/免登录低音质档如实记录
  };
}

// ==================== 歌词 / 条目信息 / 详情页 ====================

// 有声书无歌词（文档缺点 7）：如实返回空，不伪造
async function getLyricImpl(musicItem) {
  return { rawLrc: '' };
}

async function getMusicInfoImpl(musicItem) {
  var parsed = parseSourceId(musicItem && musicItem.id);
  if (!parsed) return {};
  if (parsed.kind === 'chapter' || parsed.kind === 'book') {
    var meta = await getBookMeta(parsed.kind === 'chapter' ? parsed.entityId : parsed.bookId);
    return { album: meta.name, artist: meta.announcer, artwork: meta.cover };
  }
  if (parsed.kind === 'albumAudio' || parsed.kind === 'album') {
    var info = await lrtsGet('getAlbumInfo', { id: parsed.kind === 'albumAudio' ? parsed.entityId : parsed.albumId });
    var ab = (info && info.ablumn) || {};
    return { album: str(ab.name), artist: str(ab.nickName), artwork: str(ab.cover) };
  }
  return {};
}

async function getMusicDetailPageUrlImpl(musicItem) {
  var parsed = parseSourceId(musicItem && musicItem.id);
  if (!parsed) return null;
  if (parsed.kind === 'chapter' || parsed.kind === 'book') return 'https://www.lrts.me/book/' + (parsed.kind === 'chapter' ? parsed.entityId : parsed.bookId);
  return 'https://www.lrts.me/album/' + (parsed.kind === 'albumAudio' ? parsed.entityId : parsed.albumId);
}

// ==================== 插件对象 ====================

var plugin = {
  platform: 'lrts',
  version: '1.0.0',
  author: '研发3号',
  description: '懒人听书（LRTS·腾讯音乐系听书平台）独立源插件 v1.0.0：搜索（keyWord 驼峰参数）返回书籍+专辑，统一映射为专辑条目；专辑/歌单详情展开章节列表（50 章/页分页拉取，单次上限 500 章防超时并如实标注）；播放取链走官方 getPlayPath（书籍 entityType=3 / 专辑 entityType=2），空返回时书籍走 getListenPath 兜底；链接经音流口径校验（Range 0-15 探测 Content-Length 与章节声明 size 双口径比对 + ftyp/ID3 魔数 fail-closed + 码率窗口守卫）；免登录免费内容仅 ~46-98kbps 一档，supportedQualities 如实仅 standard 不虚构更高音质；付费章节标题标注「｜付费」且取链如实报「收费章节未购买」，不做任何绕过（官方限制实测无法绕过）；排行榜接口上游未开放不提供，分类浏览走 getCategory+搜索替代（getBookList categoryId 实测不生效）；有声书无歌词，getLyric 如实返回空',
  primaryKey: ['id'],
  supportedSearchType: ['album'], // 搜索结果为书籍/专辑（无可播单曲形态），music/artist/sheet 如实返回空
  defaultSearchType: 'album',
  supportedQualities: ['standard'], // 免费免登录仅 46-98kbps 一档（文档实测），不虚构更高音质
  cacheControl: 'cache', // vkey 直链 24h 有效（文档 4.3）
  userVariables: [],
  hints: {
    search: ['搜索懒人听书曲库（有声书/小说/评书/相声/儿童），结果为书籍与专辑', '点开书籍/专辑进入章节列表播放；免费章节免登录可播，付费章节需购买（标题标注「｜付费」）'],
    importMusicSheet: ['支持懒人听书书籍/专辑链接，如 www.lrts.me/book/94326793、www.lrts.me/album/669285', '也支持纯数字书籍 ID']
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim() : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    if (type === 'album') return searchAlbumImpl(kw, page);
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

  async getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  async getAlbumInfo(albumItem, page) {
    return getAlbumInfoImpl(albumItem, page);
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

  // 排行榜：/ajax/getRank 上游未突破（文档实测返回空），不实现 getTopLists/getTopListDetail，
  // 如实不提供榜单入口；分类浏览走 getRecommendSheetTags（见 changelog ⑥）。

  _internal: {
    normalizeQuality: normalizeQuality,
    parseSourceId: parseSourceId,
    parseSheetId: parseSheetId,
    isPaidChapter: isPaidChapter,
    buildChapterItem: buildChapterItem,
    detectAudioMagic: detectAudioMagic,
    verifySource: verifySource,
    isAllowedMediaUrl: isAllowedMediaUrl,
    lrtsGet: lrtsGet,
    getPlayPath: getPlayPath,
    getListenPathFallback: getListenPathFallback,
    getBookMeta: getBookMeta,
    paidErrorMessage: paidErrorMessage,
    CONSTANTS: { FULL_SIZE_RATIO: FULL_SIZE_RATIO, FREE_LOW_SIZE_RATIO: FREE_LOW_SIZE_RATIO, BITRATE_FLOOR: BITRATE_FLOOR, BITRATE_CEIL: BITRATE_CEIL, MAX_ALBUM_CHAPTERS: MAX_ALBUM_CHAPTERS }
  }
};

module.exports = plugin;
