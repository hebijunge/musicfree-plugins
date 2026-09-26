/**
 * ============================================================================
 * djuu DJ 音乐 音源插件 for MusicFree
 * ----------------------------------------------------------------------------
 * @version   1.1.0
 * @author    研发3号
 * @date      2026-09-26
 * ----------------------------------------------------------------------------
 * v1.1.0 changelog（官方 API 升级版）：
 *  - 接口依据：《DJ叮叮（djuu）APK 接口逆向分析》文档（2026-08-06，jadx +
 *    androguard 逆向 App 2.0.4）+ 本轮 2026-09-26 真网全端点复测，以实测为准。
 *  - 主通道切换：网页爬虫 → 官方 App JSON API（https://android.djuu.com/app/v1，
 *    仅需 Accept: application/json，公开接口免密，统一信封 {code,msg,time,data}）。
 *    收益：结构化字段（id/title/coverImgShow/duration/hits_num/size）替代正则解析，
 *    列表信息完整度显著提升；JSON 载荷远小于整页 HTML。
 *  - 取链切换：歌曲页爬取 var music.file → GET /music/listen?id= 直返 listenurl
 *    （mp4.djuu.com/{...}.m4a 直链，无 302、无 Referer 校验）。保留 Range 0-15
 *    探测 + 魔数白名单校验。vipListenUrl（VIP 高码率）未登录为空：仅当响应非空
 *    且请求 high/super 音质时启用，为空则如实回落 listenurl，不虚标音质。
 *  - 新增 getRecommendSheets / getRecommendSheetById：
 *      DJ 专场   /album/djList（实测 total 775）→ 专辑歌曲 /music/djList?album_id=
 *      热门专辑 /album/popularList（实测 total 88）→ /music/popularList?album_id=
 *      独家专区 /exclusive/list（实测 total 140）→ /music/exclusiveList?user_id=
 *    ⚠ 参数坑点（文档 5.1）：专辑维度是 album_id 不是 id；独家是 user_id。
 *  - 榜单升级：新增官方播放排行 /music/playRankings?rankType=1/2/3（实测 total
 *    288320 / 80793 / 288320）；rankType 语义文档仅确认 1=热门、2=推荐，3 未定，
 *    按参数如实命名不硬猜。站内 16 个网页分类保留。
 *  - 网页爬虫降级为兜底：搜索 / 详情 / 取链在官方通道失败（网络/code!=1）时自动
 *    回落 v1.0.0 网页通道；分类浏览保留网页通道为唯一实现——官方 /music/list
 *    （categorie_pids）本轮实测服务端 500（文档 2026-08-06 曾实测通过，已劣化），
 *    /music/search 的 categorie_id/categorie_tag 实测不过滤（total 不变），故官方
 *    分类浏览通道不可用，宁缺勿假不接入。
 *  - 不实现（宁缺勿假）：歌词（无 lrc 数据）、/music/download（强制登录态，
 *    未登录后端报错，免费曲下载即 listenurl）、/music/chartsList（type 合法值
 *    文档未确认）、/music/boxList（无公开电台列表入口）、MV、歌单导入。
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
 * ============================================================================
 */
var axios = require('axios');

// ==================== 常量 ====================
var PLATFORM = 'djuu';
var VERSION = '1.1.0';

var API_BASE = 'https://android.djuu.com/app/v1';
var SITE = 'https://www.djuu.com';
var AUDIO_CDN = 'https://mp4.djuu.com';
var UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 com.djuu.player';
var TIMEOUT = 15000;

// 每页条数
var ROW_SEARCH = 20;
var ROW_RANK = 30;
var ROW_SHEET = 15;       // 歌单/专辑列表页（getRecommendSheets）
var ROW_SHEET_MUSIC = 30; // 歌单内歌曲页

// 站内网页分类（v1.0.0 实测保留；官方 /music/list 分类通道已劣化 500，见头部说明）
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

// ==================== 通用工具 ====================
function str(v) { return v === undefined || v === null ? '' : String(v); }
function pageOf(page) { var p = parseInt(page, 10); return (!p || p < 1) ? 1 : p; }

// 「歌手 - 标题」/「歌手-标题」拆分（无分隔符时 artist 留空，不猜测）
function splitArtist(title) {
  var t = str(title);
  var idx = t.indexOf(' - ');
  if (idx > 0) return { artist: t.slice(0, idx).trim(), title: t.slice(idx + 3).trim() };
  idx = t.indexOf('-');
  if (idx > 0) return { artist: t.slice(0, idx).trim(), title: t.slice(idx + 1).trim() };
  return { artist: '', title: t };
}

function isEndByTotal(page, row, total) {
  return page * row >= (parseInt(total, 10) || 0);
}

// 官方 API 响应归一化：防网关把响应二次包成 JSON 字符串（逐层解包，最多 2 层）
function unwrapJson(raw) {
  var obj = raw;
  for (var i = 0; i < 2; i++) {
    if (typeof obj === 'string') {
      try { obj = JSON.parse(obj); } catch (e) { break; }
    } else break;
  }
  return obj;
}

function extend(dst, src) {
  for (var k in src) dst[k] = src[k];
  return dst;
}

// ==================== 官方 API 通道 ====================
// 统一 GET：仅 Accept: application/json（公开接口免密，无需 token）
function apiGet(path, params) {
  var qs = [];
  Object.keys(params || {}).forEach(function (k) {
    var v = params[k];
    if (v === undefined || v === null || v === '') return;
    qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  });
  var url = API_BASE + path + (qs.length ? '?' + qs.join('&') : '');
  return axios.get(url, {
    timeout: TIMEOUT,
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    responseType: 'text',
    transformResponse: function (d) { return d; } // 保留原文，手动逐层解包
  }).then(function (resp) {
    var body = unwrapJson(resp.data);
    if (!body || typeof body !== 'object') throw new Error('djuu API: 响应非 JSON 信封');
    if (body.code !== 1) throw new Error('djuu API' + path + ' 失败 code=' + body.code + ' msg=' + str(body.msg));
    return body.data;
  });
}

// 官方歌曲对象 → MusicFree musicItem（字段均来自接口返回，不补造）
function normalizeSong(it) {
  if (!it || it.id === undefined) return null;
  var sp = splitArtist(it.title);
  return {
    id: str(it.id),
    title: sp.title || sp.artist || '',
    artist: sp.artist,
    artwork: str(it.coverImgShow),
    duration: parseInt(it.duration, 10) || 0,
    platform: PLATFORM
  };
}

// 搜索（官方）：/music/search?keywords=&page=&row=
function searchApi(query, page, type) {
  if (type && type !== 'music') return Promise.resolve({ isEnd: true, data: [] });
  var kw = str(query).trim();
  if (!kw) return Promise.resolve({ isEnd: true, data: [] });
  var p = pageOf(page);
  return apiGet('/music/search', { keywords: kw, page: p, row: ROW_SEARCH }).then(function (d) {
    var list = (d && d.list) || [];
    var data = [];
    for (var i = 0; i < list.length; i++) {
      var it = normalizeSong(list[i]);
      if (it) data.push(it);
    }
    return { isEnd: isEndByTotal(p, ROW_SEARCH, d && d.total), data: data };
  });
}

// 详情（官方）：/music/details?id= → 元数据来自接口返回，不补造
function musicInfoApi(id) {
  return apiGet('/music/details', { id: id }).then(function (d) {
    if (!d || d.id === undefined) throw new Error('djuu API: 详情为空');
    var sp = splitArtist(d.title);
    var descParts = [];
    if (d.create_time) descParts.push('上传：' + str(d.create_time));
    if (d.size) descParts.push('大小：' + str(d.size));
    if (d.hits_num !== undefined) descParts.push('播放：' + str(d.hits_num) + ' 次');
    return {
      id: str(d.id),
      title: sp.title || sp.artist || '',
      artist: sp.artist,
      artwork: str(d.coverImgShow),
      duration: parseInt(d.duration, 10) || 0,
      description: descParts.join(' · '),
      platform: PLATFORM
    };
  });
}

// 取链（官方）：/music/listen?id= → listenurl（直链，无 302/无 Referer）
// vipListenUrl 为 VIP 高码率地址：未登录实测为空字符串；仅当非空且请求
// high/super 音质时启用，为空一律回落 listenurl，不虚标音质
function listenApi(id, quality) {
  return apiGet('/music/listen', { id: id }).then(function (d) {
    var main = str(d && d.listenurl);
    if (!main) throw new Error('djuu API: listen 未返回 listenurl（id=' + id + '）');
    var vip = str(d && d.vipListenUrl);
    if (vip && (quality === 'high' || quality === 'super')) return vip;
    return main;
  });
}

// 播放排行（官方）：/music/playRankings?rankType=1/2/3
function rankingsApi(rankType, page) {
  var p = pageOf(page);
  return apiGet('/music/playRankings', { rankType: rankType, page: p, row: ROW_RANK }).then(function (d) {
    var list = (d && d.list) || [];
    var data = [];
    for (var i = 0; i < list.length; i++) {
      var it = normalizeSong(list[i]);
      if (it) data.push(it);
    }
    return { isEnd: isEndByTotal(p, ROW_RANK, d && d.total), musicList: data };
  });
}

// 歌单/专辑三类列表（官方）
// kind: 'dj'→/album/djList  'pop'→/album/popularList  'ex'→/exclusive/list
function sheetListApi(kind, page) {
  var p = pageOf(page);
  var path = kind === 'dj' ? '/album/djList' : (kind === 'pop' ? '/album/popularList' : '/exclusive/list');
  return apiGet(path, { page: p, row: ROW_SHEET }).then(function (d) {
    var list = (d && d.list) || [];
    var data = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;
      var kindPrefix = kind === 'ex' ? 'djuu_ex_' : (kind === 'dj' ? 'djuu_dj_' : 'djuu_pop_');
      var key = kind === 'ex' ? str(it.user_id) : str(it.id);
      if (!key) continue;
      data.push({
        // 歌单 id 内嵌标题/封面（URL 编码，'|' 分隔）：详情接口不可用（热门专辑
        // 无详情端点）时兜底展示；DJ/独家仍优先调详情接口取更全元数据
        id: kindPrefix + key + '|' + encodeURIComponent(str(it.stage_name || it.title)) + '|' + encodeURIComponent(str(it.coverImgShow)),
        title: str(it.stage_name || it.title) || '未命名歌单',
        artwork: str(it.coverImgShow),
        description: str(it.introduction),
        worksNum: parseInt(it.music_num, 10) || 0,
        platform: PLATFORM
      });
    }
    return { isEnd: isEndByTotal(p, ROW_SHEET, d && d.total), data: data };
  });
}

// 歌单内歌曲（官方）。key 按文档 5.1：dj/pop→album_id，ex→user_id
// 返回 {isEnd, musicList, sheet}；sheet 元数据优先取详情接口，失败用 id 内嵌信息
function sheetMusicApi(sheetId, page) {
  var parts = str(sheetId).split('|');
  var head = parts[0] || '';
  var encTitle = parts[1] || '';
  var encArt = parts[2] || '';
  var m = /^djuu_(dj|pop|ex)_(\d+)$/.exec(head);
  if (!m) return Promise.reject(new Error('djuu: 未知歌单 ' + head));
  var kind = m[1], key = m[2];
  var p = pageOf(page);

  var path, param;
  if (kind === 'dj') { path = '/music/djList'; param = { album_id: key }; }
  else if (kind === 'pop') { path = '/music/popularList'; param = { album_id: key }; }
  else { path = '/music/exclusiveList'; param = { user_id: key }; }

  function fallbackSheet() {
    var title = '';
    var art = '';
    try { title = decodeURIComponent(encTitle); } catch (e) { title = encTitle; }
    try { art = decodeURIComponent(encArt); } catch (e) { art = encArt; }
    return { id: str(sheetId), title: title, artwork: art, platform: PLATFORM };
  }

  var sheetMetaPromise;
  if (kind === 'dj') {
    sheetMetaPromise = apiGet('/album/djDetails', { id: key }).then(function (d) {
      return {
        id: str(sheetId), title: str(d.title), artwork: str(d.coverImgShow),
        description: str(d.introduction), worksNum: parseInt(d.music_num, 10) || 0, platform: PLATFORM
      };
    }).catch(function () { return fallbackSheet(); });
  } else if (kind === 'ex') {
    sheetMetaPromise = apiGet('/exclusive/details', { id: key }).then(function (d) {
      return {
        id: str(sheetId), title: str(d.stage_name), artwork: str(d.coverImgShow),
        description: str(d.introduction), worksNum: parseInt(d.music_num, 10) || 0, platform: PLATFORM
      };
    }).catch(function () { return fallbackSheet(); });
  } else {
    // 热门专辑无可用详情端点（/music/musicAlbum 传专辑 id 实测返回空壳）
    sheetMetaPromise = Promise.resolve(fallbackSheet());
  }

  return Promise.all([
    apiGet(path, extend(param, { page: p, row: ROW_SHEET_MUSIC })),
    sheetMetaPromise
  ]).then(function (rs) {
    var d = rs[0], sheet = rs[1];
    var list = (d && d.list) || [];
    var data = [];
    for (var i = 0; i < list.length; i++) {
      var it = normalizeSong(list[i]);
      if (it) data.push(it);
    }
    return {
      isEnd: isEndByTotal(p, ROW_SHEET_MUSIC, d && d.total),
      musicList: data,
      sheet: sheet
    };
  });
}

// ==================== 网页通道（v1.0.0 兜底实现） ====================
function httpGet(url) {
  return axios.get(url, {
    timeout: TIMEOUT,
    maxRedirects: 5,
    // Accept 显式声明 text/html：部分网关代理会在 Accept 含 application/json 时
    // 把响应二次包成 JSON 字符串，显式声明可避免（对直连环境无副作用）
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    responseType: 'text',
    transformResponse: function (d) { return d; }
  }).then(function (resp) { return String(resp.data || ''); });
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

// 网页搜索（v1.0.0 原实现）
function searchWeb(query, page, type) {
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

// 网页详情（v1.0.0 原实现）
function musicInfoWeb(musicItem) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djuu: 缺少歌曲 id'));
  var url = SITE + '/play/' + id + '.html';
  return httpGet(url).then(function (html) {
    var name = (/(?:^|,)\s*name:\s*'([^']*)'/.exec(html) || [])[1];
    var cover = (/class="play_background">\s*<img src="([^"]+)"/.exec(html) || [])[1]
      || (/id="mcover"\s+src='([^']+)'/.exec(html) || [])[1] || '';
    var desc = (/meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
    var sp = splitArtist(name || musicItem.title || '');
    return {
      id: str(id),
      title: sp.title || sp.artist || str(musicItem.title),
      artist: sp.artist || musicItem.artist || '',
      artwork: cover || musicItem.artwork || '',
      description: desc,
      platform: PLATFORM
    };
  });
}

// 歌曲页 var music = {..., file: 'c4/22/2026/xxxx', ...} → mp4.djuu.com/{file}.m4a
function extractFile(html) {
  var m = /var music = \{[^}]*file:\s*'([^']+)'/g.exec(html);
  if (m && m[1]) return m[1];
  return null;
}

function probeAudioHead(url) {
  return axios.get(url, {
    timeout: TIMEOUT,
    maxRedirects: 5,
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

// 网页取链（v1.0.0 原实现，兜底）
function mediaSourceWeb(musicItem) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djuu: 缺少歌曲 id'));
  var url = SITE + '/play/' + id + '.html';
  return httpGet(url).then(function (html) {
    var file = extractFile(html);
    if (!file) throw new Error('djuu: 歌曲页结构变化或条目不存在，未提取到 file 变量（' + id + '）');
    var mediaUrl = AUDIO_CDN + '/' + file + '.m4a'; // 固定 .m4a 后缀
    return probeAudioHead(mediaUrl).then(function () {
      return { url: mediaUrl, headers: { 'User-Agent': UA }, userAgent: UA, platform: PLATFORM };
    });
  });
}

// 网页分类榜单详情（v1.0.0 原实现，官方分类通道劣化后的唯一分类浏览实现）
function topDetailWeb(topListItem, page) {
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

// ==================== 插件方法实现 ====================
// 官方优先，失败回落网页通道（搜索）
function searchImpl(query, page, type) {
  return searchApi(query, page, type).catch(function (err) {
    return searchWeb(query, page, type).then(function (r) {
      // 标记走了兜底，便于排查（不改变返回结构）
      r._fallback = 'web:' + str(err.message);
      return r;
    });
  });
}

function getMusicInfoImpl(musicItem) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djuu: 缺少歌曲 id'));
  return musicInfoApi(id).catch(function () {
    return musicInfoWeb(musicItem);
  });
}

function getMediaSourceImpl(musicItem, quality) {
  var id = musicItem && musicItem.id;
  if (!id) return Promise.reject(new Error('djuu: 缺少歌曲 id'));
  return listenApi(id, quality).then(function (url) {
    return probeAudioHead(url).then(function () {
      return { url: url, headers: { 'User-Agent': UA }, userAgent: UA, platform: PLATFORM };
    });
  }).catch(function (err) {
    // 官方取链失败（接口异常/直链探测失败）→ 网页爬虫兜底
    return mediaSourceWeb(musicItem).catch(function () { throw err; });
  });
}

// 榜单入口：官方播放排行 3 档 + 站内 16 个网页分类
// rankType 语义：文档仅确认 1=热门、2=推荐，3 合法但语义未定，按参数如实命名
function getTopListsImpl() {
  var mkRank = function (t, title) {
    return { id: 'djuu_rank_' + t, title: title, coverImg: '', artwork: '', platform: PLATFORM };
  };
  var mkCat = function (c) {
    return { id: 'djuu_top_' + c.cid, title: c.title, coverImg: '', artwork: '', platform: PLATFORM };
  };
  return Promise.resolve([
    { title: '播放排行（官方）', data: [mkRank(1, '热门榜'), mkRank(2, '推荐榜'), mkRank(3, '全站榜(rankType 3)')] },
    { title: '分类（站内）', data: TOP_CATEGORIES.map(mkCat) }
  ]);
}

function getTopListDetailImpl(topListItem, page) {
  var id = str(topListItem && topListItem.id);
  var m = /^djuu_rank_(\d+)$/.exec(id);
  if (m) {
    var rt = m[1];
    if (['1', '2', '3'].indexOf(rt) < 0) return Promise.reject(new Error('djuu: 未知 rankType ' + rt));
    return rankingsApi(rt, page).then(function (r) {
      return {
        isEnd: r.isEnd,
        musicList: r.musicList,
        topListItem: {
          id: topListItem.id, title: topListItem.title,
          coverImg: topListItem.coverImg || '', artwork: topListItem.artwork || '', platform: PLATFORM
        }
      };
    });
  }
  return topDetailWeb(topListItem, page); // 站内网页分类
}

// 歌单/专辑入口：官方三列表，每页返回三组（各取一页），组内翻页随插件页码推进
function getRecommendSheetsImpl(params) {
  var page = pageOf(params && params.page);
  return Promise.all([
    sheetListApi('dj', page).catch(function () { return { isEnd: true, data: [] }; }),
    sheetListApi('pop', page).catch(function () { return { isEnd: true, data: [] }; }),
    sheetListApi('ex', page).catch(function () { return { isEnd: true, data: [] }; })
  ]).then(function (rs) {
    var groups = [];
    if (rs[0].data.length) groups.push({ title: 'DJ 专场', data: rs[0].data });
    if (rs[1].data.length) groups.push({ title: '热门专辑', data: rs[1].data });
    if (rs[2].data.length) groups.push({ title: '独家专区', data: rs[2].data });
    return groups;
  });
}

function getRecommendSheetByIdImpl(id, page) {
  if (!str(id)) return Promise.reject(new Error('djuu: 缺少歌单 id'));
  return sheetMusicApi(id, page);
}

// ==================== 插件定义 ====================
var plugin = {
  name: 'djuu DJ',
  platform: PLATFORM,
  version: VERSION,
  author: '研发3号',
  description: 'djuu DJ 音乐（DJ叮叮 App 官方 API）音源插件 v1.1.0：主通道切换官方 JSON API（android.djuu.com/app/v1，逆向实测）。搜索 + 播放排行（rankType 1/2/3）+ 站内 16 分类 + DJ 专场/热门专辑/独家专区歌单 + 歌曲详情；取链 GET /music/listen?id= → listenurl m4a 直链（无 302/无 Referer），取链后 Range 探测魔数校验；vipListenUrl 为 VIP 高码率地址，未登录为空，仅在非空且请求高音质时启用。网页爬虫保留为搜索/详情/取链兜底（官方 /music/list 分类接口已劣化 500，分类浏览走站内网页通道）。不支持：歌词、MV、歌单导入、登录态下载。',
  supportedSearchType: ['music'],
  defaultSearchType: 'music',
  primaryKey: ['id'],
  hints: {
    search: ['搜索 djuu DJ 曲库（DJ 舞曲/串烧/慢摇/车载等）', '单档 m4a 音质，现取现播'],
    importMusicSheet: []
  },
  cacheControl: 'no-store', // 播放直链由 /music/listen 现取，不做缓存假设

  async search(query, page, type) {
    return searchImpl(query, page, type);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getMediaSource(musicItem, quality) {
    return getMediaSourceImpl(musicItem, quality);
  },

  // 歌词：源无 lrc 数据，不实现 getLyric（宁缺勿假）。
  // MV / 歌单导入：无对应能力，不实现。

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  async getRecommendSheets(params) {
    return getRecommendSheetsImpl(params);
  },

  async getRecommendSheetById(id, page) {
    return getRecommendSheetByIdImpl(id, page);
  },

  // ===== 以下为内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    apiGet: apiGet,
    normalizeSong: normalizeSong,
    unwrapJson: unwrapJson,
    searchApi: searchApi,
    searchWeb: searchWeb,
    musicInfoApi: musicInfoApi,
    musicInfoWeb: musicInfoWeb,
    listenApi: listenApi,
    rankingsApi: rankingsApi,
    sheetListApi: sheetListApi,
    sheetMusicApi: sheetMusicApi,
    extractFile: extractFile,
    probeAudioHead: probeAudioHead,
    mediaSourceWeb: mediaSourceWeb,
    topDetailWeb: topDetailWeb,
    searchImpl: searchImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getMediaSourceImpl: getMediaSourceImpl,
    getTopListsImpl: getTopListsImpl,
    getTopListDetailImpl: getTopListDetailImpl,
    getRecommendSheetsImpl: getRecommendSheetsImpl,
    getRecommendSheetByIdImpl: getRecommendSheetByIdImpl,
    splitArtist: splitArtist,
    parseMusicList: parseMusicList,
    TOP_CATEGORIES: TOP_CATEGORIES,
    API_BASE: API_BASE,
    SITE: SITE,
    AUDIO_CDN: AUDIO_CDN,
    ROW_SEARCH: ROW_SEARCH,
    ROW_RANK: ROW_RANK,
    ROW_SHEET: ROW_SHEET,
    ROW_SHEET_MUSIC: ROW_SHEET_MUSIC
  }
};

module.exports = plugin;
