/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「Y2002电音」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
var axios = require('axios');
/**
 * Y2002电音 独立源插件（MusicFree）
 * ================================
 * v1.0.0（2026-09-24 首发版）：依据《Y2002电音接口完整文档_综合实测版》（com.blueocean.musicplayer v2.8.0.8 实测，2026-09-02）
 * 全免签名路线接入。沙箱全链路实测（2026-09-24）：
 *  - 搜索：GET http://pc-api.yy-5.com/api/music/search?key=&pi=&pz=&deviceId=&version=1.0.6 → result.datalist
 *    （songname/nickname/songurl 试听相对路径/ownerid/duration 毫秒/typeid/headpic），明文 HTTP、免签名；
 *  - 分类：/api/music/tabs → result 直接是数组（12 分类 id 667-678，实测非 {datalist} 包裹）；
 *    分类歌曲 /api/music/ListByTab?tabid=&pi=&pz=&cursor= → 翻页用返回 result.cursor（p1/p2 id 零重叠）；
 *  - 推荐：/api/music/RecListOfPc?pi=&pz=&cursor= → result.cursor（32hex）翻页；标题实测多为真实
 *    歌名，个别为占位符（如"(250)"）→ 占位符条目回填主站详情页真实标题（并发≤6，失败不致命）；
 *  - 最新上传（首页第一页）：GET https://www.y2002.com/ 解析 <a href='/Songs/{ownerId}/{id}.html'
 *    class='song'>（实测 84 首，class 门必需——同页 /Songs/ 锚点共 130 个，无 class 的不能要）；
 *    翻页回退 RecListOfPc（cursor 会话内缓存接力，非连续页翻页回退 cursor=0 并在注释留痕）；
 *  - 播放链（核心）：GET https://www.y2002.com/Songs/{ownerid}/{id}.html → 正则 var\s+mu\s*=\s*"([^"]+)"
 *    提取已签名直链（fd-y2-p-p.y2002.com，sign/t 时效数小时 → cacheControl no-store 每次实时获取）；
 *    试听 m4a（实测 ftyp isom、Range 206、Content-Type 标 audio/mpeg 不可信，只认魔数）；
 *  - 音质派生（如实标注，不虚标不静默降级）：songurl 后缀标识原始上传格式（_mp3.m4a/_wav.m4a/_flac.m4a）。
 *    standard=试听 m4a（全部歌曲）；high=原始 mp3 完整文件（仅 _mp3 源，实测约 25% 可用，404 即拒绝）；
 *    super=原始 wav/flac 完整文件（仅 _wav/_flac 源）。下载链：路径去掉 _xxx.m4a 换原始扩展名，
 *    t=hex(Unix秒+5h)，sign=MD5(DOWNLOAD_KEY+path+t)（纯 JS MD5，无 Buffer 依赖），域 fd-y2-p-d.y2002.com；
 *    请求档位与歌曲原始格式不符时直接拒绝（不发请求），档内失败不做跨档静默降级（音流口径：
 *    请求哪个音质就获取哪个音质，取链后 Range 探测魔数（m4a ftyp isom / mp3 ID3 / wav RIFF / flac fLaC）
 *    + Content-Length/Content-Range 总大小校验，不匹配判不可用）；
 *  - App API（app.y2002.com）需爱加密 native 签名、/api/System/Token 实测 404 死锁，勿用；文档三章已知坑
 *    （PC API 仅 search/tabs/ListByTab/RecListOfPc 四接口，searchkeys/hotlist/newlist/ranklist/SheetList/
 *    SheetDetail/ListByFilter/user/info/RecList 全 404 或需签名）——故本插件不实现歌单/榜单/专辑/歌词
 *    （Y2002 无歌词接口，getLyric 恒 null；无歌单体系，不实现 getMusicSheetInfo/importMusicSheet 等）；
 *  - deviceId：固定 UUID 常量持久化（文档建议固定防风控），可用 userVariables.y2002DeviceId 覆盖。
 * ================================
 */

var PLATFORM = 'y2002';
var PC_API = 'http://pc-api.yy-5.com';
var WWW = 'https://www.y2002.com';
var IMG_CDN = 'https://y2002-img.y2002.com';
var DOWNLOAD_HOST = 'https://fd-y2-p-d.y2002.com';
var DOWNLOAD_KEY = '71aaaaa864a8efa91c8bb0980dba29ba15a86e89';
var API_VERSION = '1.0.6';
var DEFAULT_DEVICE_ID = 'a3f8c2e1-9b4d-4c6a-8e2f-1d5b7a9c3e04';
var PAGE_SIZE = 20;
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
var API_TIMEOUT = 12000;
var SOURCE_TIMEOUT = 15000;
var TITLE_PATCH_TIMEOUT = 8000;

// tabs 接口故障时的 12 分类兜底（文档 3.2 实测值，2026-09-02）
var FALLBACK_TABS = [
  { id: 667, title: '经典老歌' }, { id: 668, title: '车载串烧' },
  { id: 669, title: 'DTS环绕' }, { id: 670, title: '磁性女声' },
  { id: 671, title: '超嗨电锯' }, { id: 672, title: '试音碟' },
  { id: 673, title: '电子琴' }, { id: 674, title: '的士高' },
  { id: 675, title: '荷东' }, { id: 676, title: '纯音乐' },
  { id: 677, title: '粤语' }, { id: 678, title: '英文歌' }
];

// ==================== 基础工具 ====================

function str(v) { return v === undefined || v === null ? '' : String(v); }

function withTimeout(promise, ms, msg) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error(msg || 'timeout ' + ms + 'ms')); }, ms);
    })
  ]);
}

// HTML 实体解码（首页锚点 / 详情页 h3 含 &nbsp; 等）
function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, function (_, n) {
      var code = parseInt(n, 10);
      return (code > 0 && code < 0x10ffff) ? String.fromCodePoint(code) : '';
    });
}

// ==================== 纯 JS MD5（RFC 1321，移植自 kugou/qianqian 插件，无 Buffer/Hermes 兼容） ====================

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

// ==================== deviceId（固定持久化 + userVariables 可覆盖） ====================

function userVar(key, defVal) {
  try {
    var env = (typeof global !== 'undefined' && global.env) ? global.env : null;
    var uv = (env && typeof env.getUserVariables === 'function') ? (env.getUserVariables() || {}) : {};
    var v = uv[key];
    if (v === undefined || v === null || String(v) === '') return defVal || '';
    return String(v);
  } catch (e) { return defVal || ''; }
}

var UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function deviceId() {
  var v = userVar('y2002DeviceId', DEFAULT_DEVICE_ID).trim();
  return UUID_RE.test(v) ? v : DEFAULT_DEVICE_ID;
}

// ==================== PC API（免签名；文档三章：仅 search/tabs/ListByTab/RecListOfPc 四接口） ====================

function pcGet(path, params, timeoutMs) {
  var qs = [];
  var p = params || {};
  Object.keys(p).forEach(function (k) {
    if (p[k] !== undefined && p[k] !== null) qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(p[k]));
  });
  var url = PC_API + path + '?' + qs.join('&');
  return axios.get(url, {
    timeout: timeoutMs || API_TIMEOUT,
    headers: { 'User-Agent': UA },
    // 明文 HTTP 网关偶发 5xx/超时，重试一次
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var d = res.data;
    if (!d || typeof d !== 'object') throw new Error('[y2002] PC API 响应非 JSON: ' + path);
    if (d.retcode !== 1) throw new Error('[y2002] PC API retcode=' + d.retcode + ' ' + str(d.retmsg) + ' (' + path + ')');
    return d.result === undefined ? {} : d.result;
  });
}

function pcGetRetry(path, params, timeoutMs) {
  return pcGet(path, params, timeoutMs).catch(function (e) {
    return pcGet(path, params, timeoutMs);
  });
}

// ==================== 主站 H5 ====================

function fetchDetailHtml(ownerid, id) {
  if (!ownerid || !id) return Promise.reject(new Error('[y2002] 缺少 ownerid/id，无法构造详情页'));
  return axios.get(WWW + '/Songs/' + encodeURIComponent(ownerid) + '/' + encodeURIComponent(id) + '.html', {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': UA }
  }).then(function (res) {
    var html = typeof res.data === 'string' ? res.data : String(res.data || '');
    if (!html || html.length < 500) throw new Error('[y2002] 详情页内容异常 (' + ownerid + '/' + id + ')');
    return html;
  });
}

// 已签名试听直链（sign/t 时效数小时，每次实时获取，勿缓存）
function extractMu(html) {
  var m = html.match(/var\s+mu\s*=\s*"([^"]+)"/);
  var u = m ? m[1] : '';
  if (!u || !/^https?:\/\//i.test(u)) {
    // m 站为相对路径形态，www 站实测为完整 URL；防御性兜底
    if (u && u.charAt(0) === '/') u = 'https://fd-y2-p-p.y2002.com' + u;
    else return null;
  }
  return u;
}

// 详情页真实标题：<h3>正在播放：  A&nbsp;-&nbsp;B</h3>
function parsePlayingTitle(html) {
  var m = html.match(/<h3[^>]*>[^<]*正在播放[^<]*[:：]\s*([\s\S]*?)<\/h3>/);
  if (!m) return null;
  var raw = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
  return raw || null;
}

// ==================== 条目映射 ====================

// songurl 后缀 → 原始上传格式（_mp3.m4a/_wav.m4a/_flac.m4a）
function rawFormatOf(songurl) {
  var m = String(songurl || '').match(/_(mp3|wav|flac)\.m4a(?:\?|$)/i);
  return m ? m[1].toLowerCase() : '';
}

// songname 常为 "艺人 - 标题" 形态；无分隔符时整串作标题
function splitSongName(s) {
  var raw = decodeEntities(s).replace(/\s+/g, ' ').trim();
  var m = raw.match(/^(.{1,60}?)\s+-\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: '', title: raw };
}

function qualitiesOf(rawFormat) {
  var q = [{ quality: 'standard' }];
  if (rawFormat === 'mp3') q.push({ quality: 'high' });
  if (rawFormat === 'wav' || rawFormat === 'flac') q.push({ quality: 'super' });
  return q;
}

function mapItem(it) {
  if (!it || it.id === undefined || it.id === null) return null;
  var raw = rawFormatOf(it.songurl);
  var sp = splitSongName(it.songname);
  var durMs = parseInt(it.duration, 10) || 0;
  var item = {
    id: String(it.id),
    title: sp.title,
    artist: sp.artist || decodeEntities(str(it.nickname)).replace(/\s+/g, ' ').trim() || 'Y2002',
    duration: Math.round(durMs / 1000),
    ownerid: str(it.ownerid),
    songpath: str(it.songurl),
    rawFormat: raw,
    qualities: qualitiesOf(raw)
  };
  if (it.headpic) item.artwork = IMG_CDN + str(it.headpic);
  return item;
}

// 首页锚点条目（无 duration/songurl/headpic；标题取锚点文本，艺人取 "A - B" 前段）
function mapHomeItem(ownerId, id, text) {
  var sp = splitSongName(decodeEntities(text));
  return {
    id: String(id),
    title: sp.title,
    artist: sp.artist || 'Y2002',
    duration: 0,
    ownerid: String(ownerId),
    songpath: '',
    rawFormat: '',
    qualities: [{ quality: 'standard' }]
  };
}

// 占位符标题（如"(250)"）判定
function isPlaceholderTitle(t) {
  var s = String(t || '').trim();
  if (!s) return true;
  return /^\(\d+\)$/.test(s);
}

// 占位符标题回填主站详情页真实标题（并发≤6，失败不致命）
function patchPlaceholderTitles(items) {
  var need = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].ownerid && isPlaceholderTitle(items[i].title)) need.push(items[i]);
  }
  if (!need.length) return Promise.resolve(items);
  var POOL = 6;
  var idx = 0;
  function worker() {
    if (idx >= need.length) return Promise.resolve();
    var it = need[idx++];
    return fetchDetailHtml(it.ownerid, it.id).then(function (html) {
      var t = parsePlayingTitle(html);
      if (t) {
        var sp = splitSongName(t);
        if (!isPlaceholderTitle(sp.title)) {
          it.title = sp.title;
          if (sp.artist) it.artist = sp.artist;
        }
      }
    }).catch(function () { /* 非致命：保留占位标题 */ }).then(worker);
  }
  var workers = [];
  for (var w = 0; w < Math.min(POOL, need.length); w++) workers.push(worker());
  return Promise.all(workers).then(function () { return items; });
}

// ==================== 搜索 ====================

async function searchMusicImpl(kw, page) {
  var p = page && page > 0 ? page : 1;
  var res = await pcGetRetry('/api/music/search', {
    key: kw, pi: p, pz: PAGE_SIZE, deviceId: deviceId(), version: API_VERSION
  });
  var list = (res && Array.isArray(res.datalist)) ? res.datalist : [];
  var data = list.map(mapItem).filter(Boolean);
  return { isEnd: list.length < PAGE_SIZE, data: data };
}

// ==================== 榜单（最新上传 + 12 曲风分类） ====================

// cursor 会话内缓存：getTopListDetail(topListItem, page) 无状态传参，宿主逐页连续调用，
// 用 lastPi+cursor 接力；非连续页（跳页/刷新）回退 cursor=0，可能出现与第 1 页重叠——留痕不遮蔽。
var cursorCache = {};

function cursorFor(key, page) {
  var c = cursorCache[key];
  if (c && c.pi === page - 1 && c.cursor) return c.cursor;
  return 0;
}

function rememberCursor(key, page, cursor) {
  if (!cursor) return;
  var keys = Object.keys(cursorCache);
  if (keys.length > 32) delete cursorCache[keys[0]];
  cursorCache[key] = { pi: page, cursor: cursor };
}

async function fetchTabs() {
  try {
    var res = await withTimeout(pcGetRetry('/api/music/tabs', { deviceId: deviceId(), version: API_VERSION }), API_TIMEOUT, 'tabs timeout');
    var arr = Array.isArray(res) ? res : (res && Array.isArray(res.datalist) ? res.datalist : []);
    var tabs = arr.filter(function (t) { return t && t.id !== undefined && t.title; })
      .map(function (t) { return { id: t.id, title: decodeEntities(str(t.title)).trim() }; });
    return tabs.length ? tabs : FALLBACK_TABS;
  } catch (e) {
    return FALLBACK_TABS;
  }
}

// 首页最新歌曲：GET https://www.y2002.com/ 解析 class='song' 锚点
async function fetchHomeLatest() {
  var res = await axios.get(WWW + '/', {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': UA }
  });
  var html = typeof res.data === 'string' ? res.data : String(res.data || '');
  var re = /<a href='\/Songs\/(\d+)\/(\d+)\.html'[^>]*class='song'[^>]*>([\s\S]*?)<\/a>/g;
  var items = [];
  var seen = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    var id = m[2];
    if (seen[id]) continue;
    seen[id] = 1;
    var text = decodeEntities(m[3]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    items.push(mapHomeItem(m[1], id, text));
  }
  if (!items.length) throw new Error('[y2002] 首页最新歌曲解析为空');
  return items;
}

async function fetchRecList(page) {
  var key = 'y2002~latest';
  var res = await pcGetRetry('/api/music/RecListOfPc', {
    pi: page, pz: PAGE_SIZE, cursor: cursorFor(key, page),
    deviceId: deviceId(), version: API_VERSION
  });
  var list = (res && Array.isArray(res.datalist)) ? res.datalist : [];
  rememberCursor(key, page, res && res.cursor);
  var data = list.map(mapItem).filter(Boolean);
  return { data: data, isEnd: list.length < PAGE_SIZE || !(res && res.cursor) };
}

async function fetchTabList(tabId, page) {
  var key = 'y2002~tab~' + tabId;
  var res = await pcGetRetry('/api/music/ListByTab', {
    tabid: tabId, pi: page, pz: PAGE_SIZE, cursor: cursorFor(key, page),
    deviceId: deviceId(), version: API_VERSION
  });
  var list = (res && Array.isArray(res.datalist)) ? res.datalist : [];
  rememberCursor(key, page, res && res.cursor);
  var data = list.map(mapItem).filter(Boolean);
  return { data: data, isEnd: list.length < PAGE_SIZE || !(res && res.cursor) };
}

async function getTopListsImpl() {
  var tabs = await fetchTabs();
  return [
    {
      title: 'Y2002·最新电音',
      data: [{ id: 'y2002~latest', title: '最新上传', platform: PLATFORM }]
    },
    {
      title: 'Y2002·曲风分类',
      data: tabs.map(function (t) {
        return { id: 'y2002~tab~' + t.id, title: t.title, platform: PLATFORM };
      })
    }
  ];
}

async function getTopListDetailImpl(topListItem, page) {
  var p = page && page > 0 ? page : 1;
  var tid = topListItem && topListItem.id ? str(topListItem.id) : '';
  if (tid === 'y2002~latest') {
    if (p === 1) {
      var home = await fetchHomeLatest();
      return { isEnd: false, musicList: home };
    }
    var rec = await fetchRecList(p);
    await patchPlaceholderTitles(rec.data);
    return { isEnd: rec.isEnd, musicList: rec.data };
  }
  if (tid.indexOf('y2002~tab~') === 0) {
    var tabId = tid.slice('y2002~tab~'.length);
    if (!/^\d+$/.test(tabId)) throw new Error('[y2002] 未知分类 id: ' + tid.slice(0, 60));
    var tab = await fetchTabList(tabId, p);
    await patchPlaceholderTitles(tab.data);
    return { isEnd: tab.isEnd, musicList: tab.data };
  }
  throw new Error('[y2002] 未知榜单 id: ' + tid.slice(0, 60));
}

// ==================== 播放取链（核心） ====================

// Range 0-15 探测：状态码 + 魔数 + 总大小（音流口径：请求哪个音质就获取哪个音质，
// 魔数/大小不匹配判不可用；m4a ftyp isom / mp3 ID3|帧头 / wav RIFF / flac fLaC）
function detectMagic(u8) {
  if (!u8 || u8.length < 4) return '';
  if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    // MP4 容器：第 5-8 字节 'ftyp'（前 4 字节为 box size）
    return 'm4a';
  }
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'mp3'; // ID3
  if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return 'mp3';          // 裸帧头
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) return 'wav'; // RIFF
  if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) return 'flac'; // fLaC
  return '';
}

function verifyMedia(url, expectMagic) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': UA },
    responseType: 'arraybuffer',
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 206) throw new Error('[y2002] 取链探测 HTTP ' + st);
    var h = res.headers || {};
    var total = 0;
    var cr = h['content-range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else if (st !== 206) total = parseInt(h['content-length'], 10) || 0;
    if (total <= 0) throw new Error('[y2002] 取链探测 total=0（错误页/空文件）');
    var buf = res.data;
    var u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = detectMagic(u8);
    if (magic !== expectMagic) {
      throw new Error('[y2002] 魔数不符: 期望 ' + expectMagic + ' 实际 ' + (magic || '未知'));
    }
    return { total: total };
  });
}

// 下载直链派生：试听 path 去 _xxx.m4a 换原始扩展名 + DOWNLOAD_KEY 签名（文档 5.3 公式）
function buildDownloadUrl(songpath, ext) {
  var path = String(songpath || '');
  var re = /_(?:mp3|wav|flac)\.m4a$/i;
  if (re.test(path)) path = path.replace(re, '.' + ext);
  else if (/\.m4a$/i.test(path)) path = path.replace(/\.m4a$/i, '.' + ext);
  else return null;
  var t = formatHex5h();
  var sign = md5Hex(DOWNLOAD_KEY + path + t);
  return DOWNLOAD_HOST + path + '?sign=' + sign + '&t=' + t;
}

// t = hex(当前Unix秒 + 5小时)
function formatHex5h() {
  var v = Math.floor(Date.now() / 1000) + 3600 * 5;
  return v.toString(16);
}

function normalizeQuality(q) {
  var s = String(q || '').toLowerCase();
  if (s === 'standard' || s === '128k' || s === '64k' || s === 'low') return 'standard';
  if (s === 'high' || s === '320k' || s === '192k') return 'high';
  if (s === 'super' || s === 'flac' || s === 'hires' || s === 'master' || s === 'lossless') return 'super';
  return '';
}

function extForQuality(quality, rawFormat) {
  if (quality === 'standard') return 'm4a'; // 试听 m4a（走详情页 var mu，不用下载派生）
  if (quality === 'high') {
    if (rawFormat !== 'mp3') return null; // 无 mp3 完整档，拒绝（不跨档降级）
    return 'mp3';
  }
  if (quality === 'super') {
    if (rawFormat === 'wav') return 'wav';
    if (rawFormat === 'flac') return 'flac';
    return null;
  }
  return null;
}

function magicForExt(ext) {
  if (ext === 'm4a') return 'm4a';
  if (ext === 'mp3') return 'mp3';
  if (ext === 'wav') return 'wav';
  if (ext === 'flac') return 'flac';
  return '';
}

async function getMediaSourceImpl(musicItem, quality) {
  var q = normalizeQuality(quality);
  if (!q) throw new Error('[y2002] 不支持音质档位: ' + str(quality));
  var id = musicItem && musicItem.id !== undefined ? str(musicItem.id) : '';
  if (!id) throw new Error('[y2002] musicItem 缺少 id');
  var ownerid = musicItem && musicItem.ownerid ? str(musicItem.ownerid) : '';

  if (q === 'standard') {
    if (!ownerid) throw new Error('[y2002] musicItem 缺少 ownerid，无法取播放链');
    var html = await fetchDetailHtml(ownerid, id);
    var mu = extractMu(html);
    if (!mu) throw new Error('[y2002] 详情页未提取到播放直链 (' + ownerid + '/' + id + ')');
    var v = await verifyMedia(mu, 'm4a');
    return { url: mu, headers: { 'User-Agent': UA }, actualQuality: 'standard', size: v.total };
  }

  // high / super：原始格式完整文件，仅按歌曲原始上传格式派生（不虚标不静默降级）
  var rawFormat = musicItem && musicItem.rawFormat ? String(musicItem.rawFormat) : rawFormatOf(musicItem && musicItem.songpath);
  var ext = extForQuality(q, rawFormat);
  if (!ext) {
    throw new Error('[y2002] 该歌曲无 ' + q + ' 完整档（原始上传格式: ' + (rawFormat || '未知') + '）');
  }
  var songpath = musicItem && musicItem.songpath ? String(musicItem.songpath) : '';
  if (!songpath) throw new Error('[y2002] musicItem 缺少 songpath，无法派生下载链');
  var durl = buildDownloadUrl(songpath, ext);
  if (!durl) throw new Error('[y2002] 下载路径派生失败: ' + songpath.slice(0, 80));
  var v2;
  try {
    v2 = await verifyMedia(durl, magicForExt(ext));
  } catch (e) {
    // 实测约 25% _mp3 源有完整文件，其余 404（CL=30 错误页在魔数/大小校验即拒）——
    // 档内无第二通道可接力，如实抛错交宿主回退 standard，不静默降级虚标
    throw new Error('[y2002] ' + q + ' (' + ext + ') 完整档不可用: ' + e.message);
  }
  return { url: durl, headers: { 'User-Agent': UA }, actualQuality: q, size: v2.total };
}

// ==================== 单曲信息 / 歌词 ====================

async function getMusicInfoImpl(musicItem) {
  var id = musicItem && musicItem.id !== undefined ? str(musicItem.id) : '';
  var ownerid = musicItem && musicItem.ownerid ? str(musicItem.ownerid) : '';
  if (!id || !ownerid) return null;
  try {
    var html = await fetchDetailHtml(ownerid, id);
    var t = parsePlayingTitle(html);
    if (!t) return null;
    var sp = splitSongName(t);
    var out = { title: sp.title };
    if (sp.artist) out.artist = sp.artist;
    return out;
  } catch (e) {
    return null;
  }
}

// Y2002 无歌词接口（App 端 lrcinfo 需签名，PC API 无 lrc）——恒返回 null，不虚造
async function getLyricImpl() {
  return null;
}

// ==================== 插件对象 ====================

var plugin = {
  name: 'Y2002电音',
  platform: PLATFORM,
  version: '1.0.0',
  author: '研发3号',
  description: 'Y2002电音（y2002.com，blueocean 家族）独立源插件 v1.0.0：全免签名路线（App API 需爱加密 native 签名实测不可复现，勿用）。搜索/12 曲风分类/推荐走 PC API（pc-api.yy-5.com，deviceId 固定 UUID 持久化防风控）；「最新上传」首页第一页解析主站 HTML（class=song 锚点，标题真实），翻页回退 RecListOfPc（占位符标题自动回填详情页真实标题）；播放链走主站详情页 var mu 提取已签名直链（sign/t 时效数小时，no-store 每次实时获取，试听 m4a ftyp isom Range 206）；音质按 songurl 后缀如实派生：standard=试听 m4a（全量），high=原始 mp3 完整文件（_mp3 源，实测约 25% 有完整档），super=原始 wav/flac 完整文件（_wav/_flac 源），下载链 fd-y2-p-d + DOWNLOAD_KEY MD5 签名（纯 JS MD5 无 Buffer 依赖）；取链后 Range 探测魔数（m4a/mp3/wav/flac）+ 总大小校验，档位不符拒绝、不跨档静默降级；Y2002 无歌词/歌单/榜单接口（实测 404 或需签名），不实现相应入口',
  primaryKey: ['id'],
  supportedSearchType: ['music'],
  defaultSearchType: 'music',
  supportedQualities: ['standard', 'high', 'super'],
  cacheControl: 'no-store', // 播放链 sign/t 时效数小时，必须现取
  userVariables: [
    { key: 'y2002DeviceId', name: 'deviceId（可选）', hint: 'PC API 设备号，固定 UUID；留空使用内置默认值。频繁变更可能触发风控' }
  ],
  hints: {
    search: ['搜索 Y2002 电音曲库（DJ/串烧/车载/电音）', '播放走主站已签名直链；完整档按歌曲原始上传格式提供（mp3/wav/flac）']
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim() : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    if (type !== 'music') return { isEnd: true, data: [] };
    return searchMusicImpl(kw, page);
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

  async getMusicDetailPageUrl(musicItem) {
    var id = musicItem && musicItem.id !== undefined ? str(musicItem.id) : '';
    var ownerid = musicItem && musicItem.ownerid ? str(musicItem.ownerid) : '';
    return (id && ownerid) ? WWW + '/Songs/' + ownerid + '/' + id + '.html' : null;
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  // Y2002 无歌单体系（SheetList/SheetDetail 实测 404）与专辑接口，不实现
  // getMusicSheetInfo / importMusicSheet / getRecommendSheetTags / getRecommendSheetsByTag / getAlbumInfo

  _internal: {
    md5Hex: md5Hex,
    decodeEntities: decodeEntities,
    rawFormatOf: rawFormatOf,
    splitSongName: splitSongName,
    qualitiesOf: qualitiesOf,
    mapItem: mapItem,
    mapHomeItem: mapHomeItem,
    isPlaceholderTitle: isPlaceholderTitle,
    extractMu: extractMu,
    parsePlayingTitle: parsePlayingTitle,
    detectMagic: detectMagic,
    buildDownloadUrl: buildDownloadUrl,
    formatHex5h: formatHex5h,
    deviceId: deviceId,
    normalizeQuality: normalizeQuality,
    extForQuality: extForQuality,
    verifyMedia: verifyMedia,
    pcGet: pcGet,
    fetchHomeLatest: fetchHomeLatest,
    fetchRecList: fetchRecList,
    fetchTabList: fetchTabList,
    searchMusicImpl: searchMusicImpl,
    getTopListsImpl: getTopListsImpl,
    getTopListDetailImpl: getTopListDetailImpl,
    getMediaSourceImpl: getMediaSourceImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    patchPlaceholderTitles: patchPlaceholderTitles,
    cursorCache: cursorCache
  }
};

module.exports = plugin;
