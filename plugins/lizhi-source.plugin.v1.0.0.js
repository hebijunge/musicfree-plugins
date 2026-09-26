/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「荔枝FM」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 荔枝FM 独立源插件（MusicFree）
 * ================================
 * v1.0.0（2026-09-24 首版，基线=荔枝FM接口完整文档_综合实测版 v1.2 + 2026-09-24 沙箱实探复核）
 *
 * 数据来源（全部来自文档实测端点 + 本沙箱 2026-09-24 复测，无猜测 URL）：
 *  - 详情+取链：GET https://m.lizhi.fm/vodapi/voice/info/{voiceId}
 *      复测：2884692679220625926 → code=0，trackUrl=http://cdn5.lizhi.fm/audio/2021/07/17/..._hd.mp3
 *  - 音质切换：trackUrl 后缀派生 `_hd.mp3`(HD MP3 ~128kbps) ↔ `_sd.m4a`(SD M4A ~14kbps)
 *      复测：HD 206 total=30548138B(~129kbps) 魔数 ID3；SD 206 total=3436796B(~14kbps)
 *  - 搜索：GET https://m.lizhi.fm/vodapi/search/voice?deviceId=..&keywords=..&page=..&receiptData=..
 *      复测：code=0 正常返回；⚠️ 实测 `page` 参数被上游忽略（page=1/2/3 返回同批 18 条），
 *      真实翻页仅由 receiptData 驱动且每页条数不固定（18/13/6…）——本插件按「会话累积
 *      缓冲 + 定长切片」实现宿主分页，receiptData 为空即 isEnd。
 *  - 付费音频 URL 派生：付费条目 trackUrl 为空，用封面 URL 的 /YYYY/MM/DD/ 日期段
 *      + 音频ID 构造 cdn5.lizhi.fm 直链（CDN 不校验付费状态）
 *      复测：5107598488703065222 → 封面 2020/04/26 → 派生 HD 206 total=20797529B 魔数 ID3
 *  - 主播作品列表：GET https://m.lizhi.fm/vodapi/user/{主播ID}?pageNo={n}&pageSize={m}
 *      复测：30126 → pageNo=1/2 各 10 条
 *
 * ⚠️ 实探修正（相对文档 v1.2 的重要偏差，2026-09-24 实测）：
 *  - CDN（cdn5.lizhi.fm）对 iPhone Safari UA 一律 403 ACCESS DENIED（非限频，45s 后仍 403，
 *    响应体为 HTML 风控页）；Android Chrome UA 高频使用会被 API 与 CDN 同时临时拉黑 403；
 *    okhttp/4.10.0（MusicFree 移动端 axios 默认 UA）API/CDN 全链实测可用——本插件 API 与
 *    CDN 校验统一 okhttp UA，CDN 探测带 UA 池轮换自愈，取链成功的 UA 经 getMediaSource
 *    返回值 headers.User-Agent 透传给宿主播放器；https 访问 CDN 同样 403，直链保持 http。
 *  - 主播作品列表 /vodapi/user/{id} 实测仅 userId 有效（band 返回 code=0 空数据，
 *    文档 §2.2「band 或 userId 皆可」不符）——条目拆 _uid(userId)/_band(分享页) 两字段。
 *  - 搜索 keywords 必须为复数（keyword 单数 → HTTP 400），deviceId 为文档实测固定值。
 *
 * 取链验证口径（音流）：请求哪个音质就取哪个音质；取链后以 Range 0-2047 探测
 * 「Content-Range/Content-Length 总长」并做魔数校验（MP3: 'ID3'/0xFFEx；M4A: offset4 'ftyp'；
 * '<h' 开头 = 风控 HTML 页拒收），总长还需通过「时长×码率」区间校验（HD 60~320kbps、
 * SD 4~48kbps，荔枝无音质大小接口，以码率区间代替文档口径中的「音质大小接口比对」），
 * 全部通过才判定为可用真链，否则抛错。
 *
 * 能力边界（文档未覆盖，如实不实现）：
 *  - 无歌词（播客/电台内容，文档「无歌词」结论）→ getLyric 显式抛错
 *  - 无排行榜/歌单/专辑/评论/MV 官方接口 → getTopLists / getMusicSheetInfo / getAlbumInfo /
 *    getMusicComments / getMvSource / importMusicSheet 均不声明
 *  - 搜索仅 voice（音频）类型，无主播/歌单搜索
 *  - importMusicItem 支持 www/m.lizhi.fm/{主播ID}/{音频ID} 分享链接与纯音频ID
 */

var axios = require('axios');

// ==================== 常量 ====================

var API_BASE = 'https://m.lizhi.fm/vodapi';
var CDN_BASE = 'http://cdn5.lizhi.fm';
var DEVICE_ID = 'h5-b6ef91a9-3dbb-c716-1fdd-43ba08851150'; // 文档实测固定值（2026-09-24 复测有效）
// CDN 对 iPhone Safari UA 一律 403 ACCESS DENIED（2026-09-24 实测，非限频）；
// Android Chrome UA 与 okhttp/4.10.0（MusicFree 移动端 axios 默认 UA）实测均可用，
// 但同一 UA 高频探测会被 CDN 临时拉黑（403）→ CDN 请求用 UA 池轮换自愈，
// 取链成功的 UA 经 getMediaSource 返回的 headers 透传给宿主播放器保持一致。
var UA_ANDROID = 'Mozilla/5.0 (Linux; Android 10; SM-G970F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
var UA_OKHTTP = 'okhttp/4.10.0';
var CDN_UA_POOL = [UA_OKHTTP, UA_ANDROID];
var cdnUaIdx = 0; // 记住最近成功的 UA，减少无效重试
var SOURCE_TIMEOUT = 8000;
var PROBE_TIMEOUT = 8000;

var SEARCH_PAGE_SIZE = 12;
var SHEET_PAGE_SIZE = 30; // 主播作品列表每页
var SEARCH_FETCH_MAX = 8;  // 单次 search 最多向上游翻页次数（防宿主 10s 沙箱超时）

// 取链码率区间校验（bps）：荔枝无音质大小接口，以「时长×码率」区间代替大小比对
var BITRATE_RANGE = {
  hd: [60 * 1000, 320 * 1000], // HD MP3 实测 ~129kbps
  sd: [4 * 1000, 48 * 1000]    // SD M4A 实测 ~14kbps
};

// ==================== 工具 ====================

function str(v) { return v === undefined || v === null ? '' : String(v); }

// API 与 CDN 统一 okhttp/4.10.0 UA（2026-09-24 实测：API/CDN 全链 200/206 可用；
// Android Chrome UA 高频使用会被 API 侧与 CDN 同时拉黑 403；iPhone UA 被 CDN 永拒）
function apiHeaders() {
  return { 'User-Agent': UA_OKHTTP, 'Accept': 'application/json', 'Referer': 'https://m.lizhi.fm/' };
}

function assertApiOk(res, what) {
  var d = res && res.data;
  if (!d || typeof d.code === 'undefined') {
    throw new Error('荔枝FM接口异常(' + what + ')：响应缺少 code');
  }
  if (Number(d.code) !== 0) {
    throw new Error('荔枝FM接口错误(' + what + ')：code=' + d.code + ' ' + str(d.msg || ''));
  }
}

// 条目日期（createTime unix 秒 → YYYY-MM-DD）
function formatTs(ts) {
  var n = Number(ts);
  if (!n || isNaN(n)) return '';
  var d = new Date(n * 1000);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

// 上游条目（userVoice / search / user 列表通用结构）→ IMusicItem
function mapVoiceItem(it) {
  if (!it) return null;
  var ui = it.userInfo || {};
  var vi = it.voiceInfo || {};
  var vpp = it.voicePlayProperty || {};
  var vid = str(vi.voiceId || '');
  if (!vid) return null;
  return {
    id: vid,
    title: str(vi.name) || ('荔枝音频 ' + vid),
    artist: str(ui.name) || '未知主播',
    album: str(vi.lableName || vi.labelName || ''),
    artwork: str(vi.imageUrl || ''),
    duration: Number(vi.duration) || 0,
    date: formatTs(vi.createTime),
    // 扩展字段：后续方法使用
    // _uid=userId（主播作品列表 user/{id} 实测仅 userId 有效，band 返回空数据）
    // _band=band（分享页 www.lizhi.fm/{band}/{voiceId} 形态）
    _hdUrl: str(vpp.trackUrl || ''),
    _uid: str(ui.userId || ui.band || ''),
    _band: str(ui.band || ''),
    _cover: str(vi.imageUrl || '')
  };
}

// ==================== 会话式搜索分页 ====================
// 上游忽略 page 参数，翻页仅由 receiptData 驱动且每页条数不固定（实测 18/13/6），
// 故按关键词维护「累积缓冲」，宿主第 N 页 = 缓冲的第 N 个 SEARCH_PAGE_SIZE 切片。

var kwSessions = {}; // kw -> { items: [], ids: {}, receipt: '', done: false, fetches: 0, ts: 0 }
var SESSION_MAX = 16;
var SESSION_TTL = 10 * 60 * 1000;

function sessionSweep() {
  var now = Date.now();
  var keys = Object.keys(kwSessions);
  // 先清过期
  for (var i = 0; i < keys.length; i++) {
    if (now - kwSessions[keys[i]].ts > SESSION_TTL) delete kwSessions[keys[i]];
  }
  // 超量时淘汰最旧
  keys = Object.keys(kwSessions);
  while (keys.length > SESSION_MAX) {
    var oldest = keys[0];
    for (var j = 1; j < keys.length; j++) {
      if (kwSessions[keys[j]].ts < kwSessions[oldest].ts) oldest = keys[j];
    }
    delete kwSessions[oldest];
    keys = Object.keys(kwSessions);
  }
}

function fetchSearchRaw(kw, receipt) {
  var url = API_BASE + '/search/voice'
    + '?deviceId=' + encodeURIComponent(DEVICE_ID)
    + '&keywords=' + encodeURIComponent(kw)
    + '&page=1' // 上游忽略该参数（实测 page=2/3 返回同批数据），占位保持参数形态
    + '&receiptData=' + encodeURIComponent(receipt || '');
  return axios.get(url, { timeout: SOURCE_TIMEOUT, headers: apiHeaders() }).then(function (res) {
    assertApiOk(res, 'search');
    var list = (res.data.data || []).map(mapVoiceItem).filter(function (x) { return !!x; });
    return { items: list, receipt: str(res.data.receiptData || '') };
  });
}

function ensureSession(kw) {
  sessionSweep();
  if (!kwSessions[kw]) {
    kwSessions[kw] = { items: [], ids: {}, receipt: '', done: false, fetches: 0, ts: Date.now() };
  }
  var s = kwSessions[kw];
  s.ts = Date.now();
  return s;
}

async function ensureBuffer(kw, need) {
  var s = ensureSession(kw);
  // 预算按本次调用重置（跨调用累积会造成后续页永远空页的死锁）；
  // 上游翻页可能持续返回重叠数据（实测同批条目反复出现），连续 2 次零新增判会话枯竭
  var budget = SEARCH_FETCH_MAX;
  var noProgress = 0;
  while (!s.done && s.items.length < need && budget > 0) {
    budget -= 1;
    var r = await fetchSearchRaw(kw, s.receipt);
    s.fetches += 1;
    var added = 0;
    for (var i = 0; i < r.items.length; i++) {
      var it = r.items[i];
      if (!s.ids[it.id]) { s.ids[it.id] = 1; s.items.push(it); added += 1; }
    }
    if (!r.items.length || !r.receipt) { s.done = true; break; }
    s.receipt = r.receipt;
    if (added === 0) {
      noProgress += 1;
      if (noProgress >= 2) { s.done = true; break; } // receipt 翻页无推进 → 数据已尽，防无限空翻
    } else {
      noProgress = 0;
    }
  }
  return s;
}

// ==================== 取链（音质派生 + 校验） ====================

function normalizeQuality(q) {
  var s = String(q || '');
  if (s === 'standard' || s === 'low') return 'sd'; // 荔枝官方「标准」= SD 低码率
  return 'hd'; // 128k / high / super / 未知档 → 荔枝最高实际档 HD（宁低勿高，actualQuality 如实上报）
}

// 从 trackUrl 或封面 URL 派生 HD/SD 双链
// trackUrl 形如 http://cdn5.lizhi.fm/audio/2021/07/17/{voiceId}_hd.mp3
// 付费条目 trackUrl 为空 → 用封面 URL 的 /YYYY/MM/DD/ 日期段派生（文档 §4.4，复测通过）
function deriveUrls(voiceId, hdUrl, coverUrl) {
  var hd = '';
  var m = /_hd\.mp3$/.exec(str(hdUrl));
  if (hdUrl && m) hd = hdUrl;
  if (!hd) {
    var dm = /\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(str(coverUrl));
    if (!dm) return null;
    hd = CDN_BASE + '/audio/' + dm[1] + '/' + dm[2] + '/' + dm[3] + '/' + voiceId + '_hd.mp3';
  }
  var sd = hd.replace('_hd.mp3', '_sd.m4a');
  return { hd: hd, sd: sd };
}

// 取链探测：Range 0-2047 → 状态/总长/魔数/码率区间校验（音流口径）
// 403（CDN UA 级风控/拉黑）时按 UA 池轮换重试，返回实际生效的 UA 供播放头透传
async function probeMedia(url, kind, duration) {
  var res = null;
  var usedUa = '';
  var lastErr = '';
  for (var attempt = 0; attempt < CDN_UA_POOL.length; attempt++) {
    var idx = (cdnUaIdx + attempt) % CDN_UA_POOL.length;
    var ua = CDN_UA_POOL[idx];
    try {
      res = await axios.get(url, {
        timeout: PROBE_TIMEOUT,
        headers: { 'User-Agent': ua, 'Range': 'bytes=0-2047' },
        responseType: 'arraybuffer',
        validateStatus: function () { return true; }
      });
    } catch (e) {
      lastErr = str((e && e.message) || e);
      res = null;
      continue;
    }
    if (res.status === 403 && attempt < CDN_UA_POOL.length - 1) {
      lastErr = 'HTTP 403（UA=' + ua + '）';
      continue; // 该 UA 被风控，换下一个
    }
    usedUa = ua;
    cdnUaIdx = idx;
    break;
  }
  if (!res) {
    throw new Error('荔枝FM取链探测失败：' + lastErr.slice(0, 120));
  }
  var status = res.status;
  if (status !== 200 && status !== 206) {
    throw new Error('荔枝FM取链探测失败：HTTP ' + status + (lastErr ? '（曾' + lastErr.slice(0, 60) + '）' : ''));
  }
  if (!usedUa) usedUa = UA_OKHTTP;
  var h = res.headers || {};
  var head = new Uint8Array(res.data || []);
  if (head.length < 8) {
    throw new Error('荔枝FM取链校验未通过：响应体过短(' + head.length + 'B)');
  }
  // 风控 HTML 页（ERROR: ACCESS DENIED）拒收
  if (head[0] === 0x3c && head[1] === 0x68) { // '<h'
    throw new Error('荔枝FM取链校验未通过：返回风控 HTML 页而非音频');
  }
  // 魔数：MP3 = 'ID3' 或 0xFFEx；M4A = offset4 'ftyp'
  var magicOk = false;
  if (kind === 'hd') {
    magicOk = (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) ||
              (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0);
  } else {
    magicOk = head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70; // 'ftyp'
  }
  if (!magicOk) {
    throw new Error('荔枝FM取链校验未通过：魔数不符(' + kind + ' ' + Array.prototype.slice.call(head, 0, 8).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join(' ') + ')');
  }
  // 总长：206 取 Content-Range 尾段；200 取 Content-Length
  var total = 0;
  var cr = str(h['content-range'] || h['Content-Range'] || '');
  var crm = /\/(\d+)\s*$/.exec(cr);
  if (crm) total = parseInt(crm[1], 10) || 0;
  if (!total) total = parseInt(str(h['content-length'] || h['Content-Length'] || ''), 10) || 0;
  if (!total) {
    throw new Error('荔枝FM取链校验未通过：无法获得文件总长');
  }
  // 码率区间校验（代替音质大小接口比对；duration 缺失时跳过该项）
  var dur = Number(duration) || 0;
  if (dur > 0) {
    var bps = total * 8 / dur;
    var rng = BITRATE_RANGE[kind];
    if (bps < rng[0] || bps > rng[1]) {
      throw new Error('荔枝FM取链校验未通过：码率 ' + Math.round(bps / 1000) + 'kbps 超出 ' + kind + ' 档合理区间(' + Math.round(rng[0] / 1000) + '~' + Math.round(rng[1] / 1000) + 'kbps)，疑似错误文件');
    }
  }
  return { total: total, ua: usedUa };
}

async function resolveSource(musicItem, quality) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem');
  var kind = normalizeQuality(quality);
  var vid = str(musicItem.id);
  var hdUrl = str(musicItem._hdUrl || '');
  var cover = str(musicItem._cover || musicItem.artwork || '');

  // trackUrl 为空（付费/下架）→ voice/info 补取；仍为空 → 封面日期派生
  if (!hdUrl) {
    var res = await axios.get(API_BASE + '/voice/info/' + encodeURIComponent(vid), {
      timeout: SOURCE_TIMEOUT, headers: apiHeaders()
    });
    assertApiOk(res, 'voice/info');
    var uv = (res.data.data && res.data.data.userVoice) || {};
    var vi = uv.voiceInfo || {};
    var vpp = uv.voicePlayProperty || {};
    hdUrl = str(vpp.trackUrl || '');
    cover = str(vi.imageUrl || '') || cover;
  }

  var urls = deriveUrls(vid, hdUrl, cover);
  if (!urls) throw new Error('荔枝FM：无法确定播放地址（无 trackUrl 且封面缺少日期段）');
  var target = kind === 'sd' ? urls.sd : urls.hd;
  var probe = await probeMedia(target, kind, musicItem.duration);
  return {
    url: target,
    headers: { 'User-Agent': probe.ua || UA_OKHTTP }, // CDN 拒 iPhone UA，宿主播放请求带同 UA（取链实测成功者）
    actualQuality: kind === 'sd' ? 'standard' : '128k'
  };
}

// ==================== 详情补全 ====================

async function fetchVoiceInfo(vid) {
  var res = await axios.get(API_BASE + '/voice/info/' + encodeURIComponent(vid), {
    timeout: SOURCE_TIMEOUT, headers: apiHeaders()
  });
  assertApiOk(res, 'voice/info');
  var uv = (res.data.data && res.data.data.userVoice) || {};
  var vi = uv.voiceInfo || {};
  var ui = uv.userInfo || {};
  var vpp = uv.voicePlayProperty || {};
  return {
    id: str(vi.voiceId || vid),
    title: str(vi.name) || ('荔枝音频 ' + vid),
    artist: str(ui.name) || '未知主播',
    album: str(vi.lableName || vi.labelName || ''),
    artwork: str(vi.imageUrl || ''),
    duration: Number(vi.duration) || 0,
    date: formatTs(vi.createTime),
    _hdUrl: str(vpp.trackUrl || ''),
    _uid: str(ui.userId || ui.band || ''),
    _band: str(ui.band || ''),
    _cover: str(vi.imageUrl || '')
  };
}

// ==================== 分享链接解析 ====================

// 支持：https://www.lizhi.fm/{band}/{voiceId} / https://m.lizhi.fm/{band}/{voiceId} /
//       纯音频ID（12 位以上数字）/ 含上述链接的任意文本
function extractVoiceId(urlLike) {
  var s = str(urlLike).trim();
  if (!s) return '';
  var m = /lizhi\.fm\/(?:[\w.\-]+\/)?(\d{10,})(?:[/?#]|\s|$)/.exec(s);
  if (m) return m[1];
  if (/^\d{10,}$/.test(s)) return s;
  return '';
}

// ==================== 插件主体 ====================

var plugin = {
  name: '荔枝FM',
  platform: 'lizhi',
  version: '1.0.0',
  author: '研发2号',
  description: '荔枝FM音源插件 v1.0.0（播客/电台/有声书）：搜索（keywords+deviceId+receiptData 会话分页，实测上游忽略 page 参数）、HD MP3(~128kbps)/SD M4A(~14kbps) 双音质取链（trackUrl 后缀派生）、付费音频封面日期派生直链、主播作品列表、分享链接/纯ID导入单曲；取链经 Range 探测魔数+码率区间校验（音流口径）。CDN 实测拒 iPhone UA，插件与播放均带 Android UA。无歌词/排行榜/歌单/专辑/评论接口，如实不实现。',
  primaryKey: ['id'],
  supportedSearchType: ['music'],
  supportedQualities: ['standard', '128k'], // standard=SD M4A ~14kbps；128k=HD MP3 ~128kbps（荔枝实际能力，如实呈现）
  cacheControl: 'no-store', // 直链长期有效但依赖条目扩展字段与风控状态，现取更稳
  hints: {
    search: ['搜索荔枝FM播客/电台/有声书音频'],
    importMusicItem: [
      '支持荔枝FM分享链接，如 https://www.lizhi.fm/{主播ID}/{音频ID}',
      '支持纯音频ID（长数字）'
    ]
  },

  async search(query, page, type) {
    if (type !== 'music') return { isEnd: true, data: [] };
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim() : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var p = Math.max(1, Number(page) || 1);
    var s = await ensureBuffer(kw, p * SEARCH_PAGE_SIZE);
    var start = (p - 1) * SEARCH_PAGE_SIZE;
    var data = s.items.slice(start, start + SEARCH_PAGE_SIZE);
    // 会话已结束且缓冲再无可取条目 → 到尾；会话未结束（缓冲未取满/未翻尽）→ 还有下一页
    var isEnd = data.length === 0 || (s.done && start + data.length >= s.items.length);
    return { isEnd: isEnd, data: data };
  },

  async getMediaSource(musicItem, quality) {
    var r = await resolveSource(musicItem, quality);
    r.quality = r.actualQuality; // 宿主 IMediaSourceResult.quality 标准字段
    return r;
  },

  async getMusicInfo(musicItem) {
    if (!musicItem || !musicItem.id) throw new Error('missing musicItem');
    return fetchVoiceInfo(musicItem.id);
  },

  async getLyric(musicItem) {
    // 荔枝FM为播客/电台内容，无歌词数据（文档「无歌词」结论）
    throw new Error('荔枝FM为播客/电台内容，暂无歌词数据');
  },

  async getArtistWorks(artistItem, page, type) {
    // 主播音频列表：GET /vodapi/user/{主播ID}?pageNo=&pageSize=（文档 §2.2，复测通过）
    // 2026-09-24 实测修正：该接口仅 userId 有效（band 返回 code=0 空数据），
    // 条目 _uid 优先；id 兜底兼容 userId 直传
    if (!artistItem || !(artistItem._uid || artistItem.id)) throw new Error('missing artistItem.id（主播ID）');
    var uid = str(artistItem._uid || artistItem.id);
    var p = Math.max(1, Number(page) || 1);
    var res = await axios.get(API_BASE + '/user/' + encodeURIComponent(uid), {
      params: { pageNo: p, pageSize: SHEET_PAGE_SIZE },
      timeout: SOURCE_TIMEOUT, headers: apiHeaders()
    });
    assertApiOk(res, 'user');
    var list = Array.isArray(res.data.data) ? res.data.data : [];
    var data = list.map(mapVoiceItem).filter(function (x) { return !!x; });
    return { isEnd: list.length < SHEET_PAGE_SIZE, data: data };
  },

  async importMusicItem(urlLike) {
    var vid = extractVoiceId(urlLike);
    if (!vid) throw new Error('无法识别的荔枝FM链接或音频ID');
    var item = await fetchVoiceInfo(vid);
    if (!item._hdUrl && !item._cover) {
      throw new Error('该音频无播放地址且无法派生（可能已下架）');
    }
    return item;
  },

  async getMusicDetailPageUrl(musicItem) {
    if (!musicItem || !musicItem.id) return null;
    var band = str(musicItem._band || '');
    if (!band) {
      try {
        var info = await fetchVoiceInfo(musicItem.id);
        band = info._band;
      } catch (e) { band = ''; }
    }
    // 分享页形态 https://www.lizhi.fm/{band}/{voiceId}（2026-09-24 实测 200 HTML）
    return band ? 'https://www.lizhi.fm/' + band + '/' + musicItem.id : null;
  },

  // ===== 内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    normalizeQuality: normalizeQuality,
    deriveUrls: deriveUrls,
    probeMedia: probeMedia,
    extractVoiceId: extractVoiceId,
    mapVoiceItem: mapVoiceItem,
    fetchVoiceInfo: fetchVoiceInfo,
    fetchSearchRaw: fetchSearchRaw,
    ensureBuffer: ensureBuffer,
    kwSessions: kwSessions,
    consts: {
      API_BASE: API_BASE, CDN_BASE: CDN_BASE, DEVICE_ID: DEVICE_ID,
      SEARCH_PAGE_SIZE: SEARCH_PAGE_SIZE, SHEET_PAGE_SIZE: SHEET_PAGE_SIZE,
      UA_ANDROID: UA_ANDROID, BITRATE_RANGE: BITRATE_RANGE
    }
  }
};

module.exports = plugin;
