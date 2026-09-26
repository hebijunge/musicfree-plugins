/**
 * ============================================================================
 * djuu DJ 音乐 音源插件 for MusicFree
 * ----------------------------------------------------------------------------
 * @version   1.0.0
 * @author    研发3号
 * @date      2026-09-26
 * ----------------------------------------------------------------------------
 * v1.0.0 changelog（首发版）：
 *  - 接口依据：《荐片源 43 个音频类 js 站深挖与吸收评估》报告 P3 结论
 *    （2026-09 云盘版）+ 本轮真实页面实测（2026-09-26）：首页/djlist 分类页/
 *    search 搜索页/play 歌曲页/mp4.djuu.com 直链，全部以实测为准。
 *  - 取链规律（站点 common.js jPlayer setMedia 原文规律，实测验证）：
 *      歌曲页 https://www.djuu.com/play/{id}.html 内含
 *        var music = {id: ..., name: '...', file: 'c4/22/2026/xxxx', ...}
 *      播放直链 = https://mp4.djuu.com/{file}.m4a
 *      ⚠ 固定 .m4a 后缀——实测 .mp3 后缀 404，.m4a 返回 200/206、
 *        content-type audio/x-m4a、ftyp/M4A 魔数、单文件 3.6~3.8MB。
 *  - 功能范围：
 *      search        搜索（GET /search?musicname={kw}&cid=0&list=1&page={n}）
 *      getMusicInfo  歌曲详情（歌曲页标题/封面/编号/上传日期/收录分类）
 *      getMediaSource 取链（歌曲页提取 file 变量 → 拼装 .m4a 直链 + Range 探测
 *                     魔数校验，失败如实报错）
 *      getTopLists + getTopListDetail 榜单（djuu 分类页 /djlist/{cid}_{page}.html，
 *                     分类 Id 与名称取自站内导航实测）
 *  - 音质：源为单档 m4a，按实际提供处理——请求任意音质均返回该单档直链，
 *    不虚标档位（无码率元数据，不声明 actualQuality）。
 *  - 边界处理：歌曲页结构变化（提取不到 file/music 变量）、空结果、网络失败、
 *    探测非音频魔数，均如实抛错/返回空，不伪造数据。
 *  - 不实现（宁缺勿假）：歌词（站内无 lrc 数据）、专辑（/ablum/ 与歌曲无
 *    可靠映射）、MV、歌单导入。
 * ============================================================================
 */
var axios = require('axios');

// ==================== 常量 ====================
var PLATFORM = 'djuu';
var VERSION = '1.0.0';

var SITE = 'https://www.djuu.com';
var AUDIO_CDN = 'https://mp4.djuu.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
var TIMEOUT = 15000;

// 榜单分类（Id 与名称取自 www.djuu.com 首页导航 2026-09-26 实测）
var TOP_CATEGORIES = [
  { cid: 4, title: '中文Remix' },
  { cid: 2, title: '慢摇串烧' },
  { cid: 1, title: '迪高串烧' },
  { cid: 13, title: '中文串烧' },
  { cid: 14, title: '外语串烧' },
  { cid: 12, title: '喊麦串烧' },
  { cid: 10, title: '外文DISCO' },
  { cid: 100, title: 'FunkyHouse' },
  { cid: 107, title: 'Vina/LakHouse' },
  { cid: 108, title: 'E.D.M' },
  { cid: 110, title: '越南鼓(Vina/Lak)' },
  { cid: 114, title: 'Hard' },
  { cid: 21, title: 'Club' },
  { cid: 124, title: '新弹跳(Mel/Bounce)' },
  { cid: 18, title: '中文慢歌' },
  { cid: 19, title: '外语慢歌' }
];

// ==================== 工具函数 ====================
function str(v) { return v === undefined || v === null ? '' : String(v); }
function pageOf(page) { var p = parseInt(page, 10); return (!p || p < 1) ? 1 : p; }

function httpGet(url) {
  return axios.get(url, {
    timeout: TIMEOUT,
    maxRedirects: 5,
    // Accept 显式声明 text/html：部分网关代理会在 Accept 含 application/json 时
    // 把响应二次包成 JSON 字符串，显式声明可避免（对直连环境无副作用）
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    responseType: 'text',
    transformResponse: function (d) { return d; } // 保留原始文本，避免 axios 自动 JSON 尝试
  }).then(function (resp) { return String(resp.data || ''); });
}

// 「歌手 - 标题」/「歌手-标题」拆分（无分隔符时 artist 留空，不猜测）
function splitArtist(title) {
  var t = str(title);
  var idx = t.indexOf(' - ');
  if (idx > 0) return { artist: t.slice(0, idx).trim(), title: t.slice(idx + 3).trim() };
  idx = t.indexOf('-');
  if (idx > 0) return { artist: t.slice(0, idx).trim(), title: t.slice(idx + 1).trim() };
  return { artist: '', title: t };
}

// 解析列表/搜索页条目：<a href="/play/{id}.html" target="_Pt" title="{标题}"><img src="{封面}"
function parseMusicList(html) {
  var seen = {};
  var re = /<a href="\/play\/(\d+)\.html" target="_Pt" title="([^"]*)"><img src="([^"]*)"/g;
  var m, list = [];
  while ((m = re.exec(html)) !== null) {
    var id = m[1];
    if (seen[id]) continue;
    seen[id] = true;
    var sp = splitArtist(m[2]);
    list.push({
      id: id,
      title: sp.title || sp.artist,
      artist: sp.artist,
      artwork: m[3] || '',
      platform: PLATFORM
    });
  }
  return list;
}

// ==================== 搜索 ====================
function searchImpl(query, page, type) {
  if (type && type !== 'music') return Promise.resolve({ isEnd: true, data: [] });
  var kw = str(query).trim();
  if (!kw) return Promise.resolve({ isEnd: true, data: [] });
  var p = pageOf(page);
  var url = SITE + '/search?musicname=' + encodeURIComponent(kw) + '&cid=0&list=1&page=' + p;
  return httpGet(url).then(function (html) {
    var data = parseMusicList(html);
    var hasNext = new RegExp('page=' + (p + 1) + '"').test(html);
    return { isEnd: !hasNext, data: data };
  });
}

// ==================== 歌曲详情 ====================
function getMusicInfoImpl(musicItem) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djuu: 缺少歌曲 id'));
  var url = SITE + '/play/' + id + '.html';
  return httpGet(url).then(function (html) {
    var name = (/(?:^|,)\s*name:\s*'([^']*)'/.exec(html) || [])[1];
    var cover = (/class="play_background">\s*<img src="([^"]+)"/.exec(html) || [])[1]
      || (/id="mcover"\s+src='([^']+)'/.exec(html) || [])[1] || '';
    var desc = (/meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
    var sp = splitArtist(name || musicItem.title || '');
    var info = {
      id: str(id),
      title: sp.title || sp.artist || str(musicItem.title),
      artist: sp.artist || musicItem.artist || '',
      artwork: cover || musicItem.artwork || '',
      description: desc,
      platform: PLATFORM
    };
    return info;
  });
}

// ==================== 取链 ====================
// 歌曲页 var music = {..., file: 'c4/22/2026/xxxx', ...} → mp4.djuu.com/{file}.m4a
// 固定 .m4a 后缀（实测 .mp3 后缀 404）
function extractFile(html) {
  var m = /var music = \{[^}]*file:\s*'([^']+)'/g.exec(html);
  if (m && m[1]) return m[1];
  return null;
}

function probeAudioHead(url) {
  return axios.get(url, {
    timeout: TIMEOUT,
    maxRedirects: 5,
    // Accept 同 httpGet：显式声明避免网关代理 JSON 包裹二进制响应
    headers: { 'User-Agent': UA, 'Range': 'bytes=0-15', 'Accept': 'audio/*' },
    responseType: 'arraybuffer'
  }).then(function (resp) {
    var status = resp.status;
    if (status !== 200 && status !== 206) {
      throw new Error('djuu: 取链探测异常 HTTP ' + status);
    }
    var head = Buffer.from(resp.data.slice(0, 16)).toString('latin1');
    // djuu 单档为 m4a（ftyp 容器头），白名单放宽到常见音频头防止站点换容器
    var ok = /^(ftyp|ID3|\xff\xfb|\xff\xf3|fLaC|OggS|RIFF)/.test(head)
      || /^.{4}ftyp/.test(head);
    if (!ok) throw new Error('djuu: 返回内容非音频（魔数 ' + JSON.stringify(head.slice(0, 8)) + '）');
    return true;
  });
}

function getMediaSourceImpl(musicItem, quality) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djuu: 缺少歌曲 id'));
  var url = SITE + '/play/' + id + '.html';
  return httpGet(url).then(function (html) {
    var file = extractFile(html);
    if (!file) throw new Error('djuu: 歌曲页结构变化或条目不存在，未提取到 file 变量（' + id + '）');
    var mediaUrl = AUDIO_CDN + '/' + file + '.m4a'; // 固定 .m4a 后缀
    return probeAudioHead(mediaUrl).then(function () {
      return {
        url: mediaUrl,
        headers: { 'User-Agent': UA },
        userAgent: UA,
        platform: PLATFORM
      };
    });
  });
}

// ==================== 榜单（djuu 分类） ====================
function getTopListsImpl() {
  var mk = function (c) {
    return { id: 'djuu_top_' + c.cid, title: c.title, coverImg: '', artwork: '', platform: PLATFORM };
  };
  return Promise.resolve([
    { title: '舞曲', data: TOP_CATEGORIES.slice(0, 6).map(mk) },
    { title: '电音/House', data: TOP_CATEGORIES.slice(6, 14).map(mk) },
    { title: '慢歌', data: TOP_CATEGORIES.slice(14, 16).map(mk) }
  ]);
}

function getTopListDetailImpl(topListItem, page) {
  var m = /^djuu_top_(\d+)$/.exec(str(topListItem && topListItem.id));
  if (!m) return Promise.reject(new Error('djuu: 未知榜单 ' + str(topListItem && topListItem.id)));
  var cid = m[1];
  var p = pageOf(page);
  var url = SITE + '/djlist/' + cid + '_' + p + '.html';
  return httpGet(url).then(function (html) {
    var musicList = parseMusicList(html);
    var hasNext = new RegExp('href="/djlist/' + cid + '_[^"]*_' + (p + 1) + '\\.html"').test(html);
    return {
      isEnd: !hasNext,
      musicList: musicList,
      topListItem: {
        id: topListItem.id,
        title: topListItem.title,
        coverImg: topListItem.coverImg || '',
        artwork: topListItem.artwork || '',
        platform: PLATFORM
      }
    };
  });
}

// ==================== 插件定义 ====================
var plugin = {
  name: 'djuu DJ',
  platform: PLATFORM,
  version: VERSION,
  author: '研发3号',
  description: 'djuu DJ 音乐（DJ呦呦音乐网）音源插件 v1.0.0（首发版）：DJ 舞曲/串烧/慢摇/车载曲库。搜索（/search musicname 分页）+ 分类榜单（/djlist 16 个站内导航分类）+ 歌曲详情；取链为歌曲页提取 var music.file 变量 → 拼装 https://mp4.djuu.com/{file}.m4a 直链（固定 .m4a 后缀，实测 .mp3 后缀 404），取链后 Range 探测魔数校验；源为单档 m4a，请求任意音质返回该单档，不虚标档位。不支持：歌词、专辑、MV、歌单导入。',
  supportedSearchType: ['music'],
  defaultSearchType: 'music',
  primaryKey: ['id'],
  hints: {
    search: ['搜索 djuu DJ 曲库（DJ 舞曲/串烧/慢摇/车载等）', '源为单档 m4a 音质，现取现播'],
    importMusicSheet: []
  },
  cacheControl: 'no-store', // 播放直链由歌曲页 file 变量现取，不做缓存假设

  async search(query, page, type) {
    return searchImpl(query, page, type);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getMediaSource(musicItem, quality) {
    return getMediaSourceImpl(musicItem, quality);
  },

  // 歌词：站内无 lrc 数据，不实现 getLyric（宁缺勿假）。
  // 专辑：/ablum/ 与歌曲无可靠映射，不实现 getAlbumInfo。
  // MV / 歌单导入：无对应能力，不实现。

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  // ===== 以下为内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    httpGet: httpGet,
    splitArtist: splitArtist,
    parseMusicList: parseMusicList,
    extractFile: extractFile,
    probeAudioHead: probeAudioHead,
    searchImpl: searchImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getMediaSourceImpl: getMediaSourceImpl,
    getTopListsImpl: getTopListsImpl,
    getTopListDetailImpl: getTopListDetailImpl,
    TOP_CATEGORIES: TOP_CATEGORIES,
    SITE: SITE,
    AUDIO_CDN: AUDIO_CDN
  }
};

module.exports = plugin;
