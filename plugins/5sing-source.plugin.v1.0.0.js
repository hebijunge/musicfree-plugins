/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「5sing」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 5sing 音乐独立源插件 v1.0.0
 * =====================================================================
 * 平台：5sing（5sing.kugou.com，酷狗旗下原创音乐平台）
 * 内容：原创(yc) / 翻唱(fc) / 伴奏(bz) 三类
 * 依据：《5sing 音乐接口完整文档（综合实测版）v1.0》（2026-08-28 实测）
 *       https://my.feishu.cn/file/SucFb1kGBofwE0xKrfkcbLIUndc
 *
 * 接口体系（全部明文 HTTP，无加密/签名/Token，免登录）：
 *   - 搜索：  GET http://search.5sing.kugou.com/home/json?keyword=&sort=1&page=&filter=0&type=0|1
 *             （type 0=歌曲 1=歌单；songName/singer 含 <em class="keyword"> 高亮需清洗；
 *              时长按 320kbps 估算 duration=(songSize*8)/320000）
 *   - 取链：  GET http://mobileapi.5sing.kugou.com/song/getSongUrl?songid=&songtype=
 *             （成功 code=1000；squrl→squrl_backup→hqurl→hqurl_backup→lqurl→lqurl_backup
 *              取第一个非空；CDN 直链带时间戳+MD5 签名有时效，必须实时获取）
 *   - 歌词：  GET http://mobileapi.5sing.kugou.com/song/newget?songid=&songtype=
 *             （成功 code=0 非 1000，注意区分；dynamicWords 为 LRC 纯文本，空串=无歌词；
 *              伴奏 bz 无歌词属正常）
 *   - 歌单：  元数据 GET http://mobileapi.5sing.kugou.com/song/getsonglist?id=&songfields=ID,user
 *             （成功 code=0；data 为对象有效 / 空数组=歌单不存在；songfields 无实际效果，
 *              API 不返回歌曲列表）+ 歌曲 HTML 解析 GET http://5sing.kugou.com/{userId}/dj/{playlistId}.html
 *             （<li class="p_rel"> 块提取，歌手 class="s_soner" 为官方拼写错误，单页无翻页）
 *   - 不支持：歌单分类 / 用户歌单（平台无公开接口，文档 5.3）——本插件如实不实现
 *             getTopLists / getRecommendSheetTags 等方法，宿主侧入口自动隐藏，不虚标。
 *
 * 音质映射（MusicFree 档位）：SQ=无损/超清 → super（优先）、HQ=高品质 → high、LQ=流畅 → standard。
 * 并非所有歌曲都有全 3 档（实测 songId=2716815 仅 lq），按实际返回降级，actualQuality 如实上报。
 *
 * 取链验证（音流口径）：请求哪个音质就优先取哪个音质；取链后做
 *   ① 魔数校验（Range bytes=0-15，MP3 ID3/裸帧、fLaC、OggS 均认可）；
 *   ② Content-Length 与搜索条目 songSize 比对（songSize 对应 SQ 档实测一致，相对误差 >5% 判不可用，
 *      仅作用于 SQ 候选；HQ/LQ 无期望大小，做最小体积合理性检查）。
 * 校验不过自动顺延到下一候选；全部候选不可用才报错。
 *
 * 歌曲 ID：复合 ID `{songId}|{songType}`（songType=yc/fc/bz）。
 * =====================================================================
 * v1.0.0（2026-09-24）首发：
 *   - search（music + sheet）、getMediaSource（三档 + 降级 + 魔数/大小校验）、getLyric、
 *     getMusicInfo、getMusicDetailPageUrl、getMusicSheetInfo（元数据 API + HTML 双通道）、
 *     importMusicItem / importMusicSheet（分享链接解析，歌单链接 userId 可缺省由元数据补全）
 */
var axios = require('axios');

// ==================== 常量 ====================
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
var BASE_API = 'http://mobileapi.5sing.kugou.com';
var BASE_SEARCH = 'http://search.5sing.kugou.com';
var BASE_WEB = 'http://5sing.kugou.com';
var REQUEST_TIMEOUT = 8000;   // 搜索/元数据/歌词
var PROBE_TIMEOUT = 5000;     // 取链校验单请求（getMediaSource 整体须在宿主 10s 内完成）
// getSongUrl 六个候选字段，按文档优先级排列；前缀决定档位归属
var URL_FIELD_ORDER = ['squrl', 'squrl_backup', 'hqurl', 'hqurl_backup', 'lqurl', 'lqurl_backup'];
var TIER_OF_FIELD = {
  squrl: 'super', squrl_backup: 'super',
  hqurl: 'high', hqurl_backup: 'high',
  lqurl: 'standard', lqurl_backup: 'standard'
};
// 请求档位 → 候选优先顺序（请求哪个音质就优先取哪个音质；请求档无货时按 super→high→standard 降级）
var TIER_ORDER = {
  super: ['squrl', 'squrl_backup', 'hqurl', 'hqurl_backup', 'lqurl', 'lqurl_backup'],
  high: ['hqurl', 'hqurl_backup', 'squrl', 'squrl_backup', 'lqurl', 'lqurl_backup'],
  standard: ['lqurl', 'lqurl_backup', 'hqurl', 'hqurl_backup', 'squrl', 'squrl_backup']
};
// 宿主增强档别名 → 内部档（与仓库既有插件 normalizeQuality 口径一致）
var QUALITY_ALIASES = {
  standard: 'standard', '128k': 'standard', low: 'standard',
  high: 'high', '192k': 'high', '320k': 'high',
  super: 'super', flac: 'super', flac24bit: 'super', hires: 'super', master: 'super', atmos: 'super'
};
var MIN_AUDIO_BYTES = 65536;      // <64KB 视为试听片段/错误响应，拒收
var SQ_SIZE_TOLERANCE = 0.05;     // SQ 候选 Content-Length 与 songSize 相对误差容限

// ==================== 基础工具 ====================

// HTML 实体解码（覆盖搜索/歌单场景实际出现的实体；不引入 he 依赖）
function unescapeHtml(s) {
  var str = String(s == null ? '' : s);
  if (str.indexOf('&') < 0) return str;
  str = str.replace(/&#x([0-9a-fA-F]+);/g, function (m, h) {
    var c = parseInt(h, 16);
    return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m;
  });
  str = str.replace(/&#(\d+);/g, function (m, d) {
    var c = parseInt(d, 10);
    return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m;
  });
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// 搜索高亮清洗：去 <em class="keyword"> 与 </em> + 实体解码 + 压空白（文档 6.3 转义清理规则）
function cleanEm(s) {
  return unescapeHtml(String(s == null ? '' : s).replace(/<\/?em[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function str(v) { return v == null ? '' : String(v); }

// 复合 ID `{songId}|{songType}` 拆分；非法返回 null
function parseCompositeId(id) {
  var s = str(id);
  var m = s.match(/^(\d+)\|(yc|fc|bz)$/);
  return m ? { songId: m[1], songType: m[2] } : null;
}

// 歌曲分享链接解析（文档 6.2）：5sing.kugou.com/{yc|fc|bz}/{songId}.html
function parseSongLink(urlLike) {
  var m = str(urlLike).match(/5sing\.kugou\.com\/(\w+)\/(\d+)\.html/);
  if (!m) return null;
  var t = m[1];
  if (t !== 'yc' && t !== 'fc' && t !== 'bz') return null;
  return { songId: m[2], songType: t };
}

// 歌单分享链接解析（文档 6.2）：userId 可缺省
function parsePlaylistLink(urlLike) {
  var m = str(urlLike).match(/5sing\.kugou\.com\/(?:(\d+)\/)?dj\/([a-zA-Z0-9]+)\.html/);
  if (!m) return null;
  return { userId: m[1] || '', playlistId: m[2] };
}

// 从任意文本中提取第一个 5sing 链接（兼容分享口令混排文本）
function extractLink(text) {
  var m = str(text).match(/https?:\/\/[^\s"'<>]*5sing\.kugou\.com\/[^\s"'<>]*/);
  return m ? m[0] : '';
}

function normalizeQuality(q) {
  var key = str(q).toLowerCase();
  return QUALITY_ALIASES[key] || 'standard';
}

// 剥离任意 HTML 标签（歌单页歌手段实测存在嵌套 <a target=...>，见 2026-09-24 实测）
function stripTags(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ');
}

// 时长按 320kbps 码率估算（文档 2.1 口径）
function estimateDuration(songSize) {
  var size = Number(songSize) || 0;
  return size > 0 ? Math.round((size * 8) / 320000) : 0;
}

function axiosGet(url, config) {
  var cfg = config || {};
  cfg.headers = cfg.headers || { 'User-Agent': UA };
  if (!cfg.headers['User-Agent']) cfg.headers['User-Agent'] = UA;
  cfg.timeout = cfg.timeout || REQUEST_TIMEOUT;
  return axios.get(url, cfg);
}

// ==================== 搜索适配 ====================

function buildMusicItemFromSearch(it) {
  var sid = str(it.songId || '');
  var stype = str(it.typeEname || '');
  if (!sid || !stype) return null;
  var songSize = Number(it.songSize) || 0;
  return {
    id: sid + '|' + stype,
    title: cleanEm(it.songName),
    artist: cleanEm(it.singer),
    duration: estimateDuration(songSize),
    songSize: songSize || undefined,
    _sid: sid,
    _stype: stype,
    url: BASE_WEB + '/' + stype + '/' + sid + '.html'
  };
}

function buildSheetItemFromSearch(it) {
  var pid = str(it.songListId || '');
  if (!pid) return null;
  var desc = cleanEm(it.content);
  if (desc === '0') desc = '';
  var userId = str(it.userId || '');
  return {
    id: pid,
    title: cleanEm(it.title),
    artist: cleanEm(it.userName) || (userId ? 'ID ' + userId : ''),
    artwork: str(it.pictureUrl) || undefined,
    worksNum: Number(it.songCnt) || undefined,
    playCount: Number(it.playCount) || undefined,
    description: desc || undefined,
    _uid: userId || undefined,
    url: BASE_WEB + '/' + (userId ? userId + '/' : '') + 'dj/' + pid + '.html'
  };
}

async function searchMusicPage(kw, page) {
  var res = await axiosGet(BASE_SEARCH + '/home/json', {
    params: { keyword: kw, sort: 1, page: page, filter: 0, type: 0 }
  });
  var list = (res.data && res.data.list) || [];
  var data = [];
  for (var i = 0; i < list.length; i++) {
    var item = buildMusicItemFromSearch(list[i]);
    if (item) data.push(item);
  }
  // 上游无总数/是否有更多标记：空页即到末页（多翻一页的代价可接受，不虚判）
  return { isEnd: data.length === 0, data: data };
}

async function searchSheetPage(kw, page) {
  var res = await axiosGet(BASE_SEARCH + '/home/json', {
    params: { keyword: kw, sort: 1, page: page, filter: 0, type: 1 }
  });
  var list = (res.data && res.data.list) || [];
  var data = [];
  for (var i = 0; i < list.length; i++) {
    var item = buildSheetItemFromSearch(list[i]);
    if (item) data.push(item);
  }
  return { isEnd: data.length === 0, data: data };
}

// ==================== 取链（核心） ====================

function getSongUrlData(sid, stype) {
  return axiosGet(BASE_API + '/song/getSongUrl', {
    params: { songid: sid, songtype: stype }
  }).then(function (res) {
    var body = res.data;
    if (!body || body.code !== 1000) {
      throw new Error('5sing取链失败：getSongUrl code=' + (body && body.code) + '（成功应为 1000）');
    }
    var d = body.data || {};
    return d;
  });
}

// 魔数 + 大小探测（音流口径；Range 0-15 拿头部，content-range total 拿全尺寸，回退 content-length）
function probeUrl(url) {
  return axios.get(url, {
    timeout: PROBE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': UA },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var buf = res.data;
    var u8;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
    else u8 = null;
    var magic = '';
    if (u8 && u8.length >= 4) {
      if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) magic = 'fLaC';
      else if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'ID3';
      else if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) magic = 'OggS';
      else if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) magic = 'mp3';
    }
    // Range 200/206：全尺寸优先取 content-range total，其次 content-length
    var headers = res.headers || {};
    var size = 0;
    var cr = str(headers['content-range']);
    if (cr) {
      var m = cr.match(/\/(\d+)$/);
      if (m) size = Number(m[1]) || 0;
    }
    if (!size) size = Number(headers['content-length']) || 0;
    return { magic: magic, size: size, status: res.status };
  }).catch(function () { return { magic: '', size: 0, status: 0 }; });
}

// 单候选校验：魔数非空 + 体积合理性（+SQ 档与 songSize 比对）
async function validateCandidate(cand, songSize, reasons) {
  var probe = await probeUrl(cand.url);
  if (!probe.magic) {
    reasons.push(cand.field + ':魔数校验失败(HTTP ' + probe.status + ')');
    return null;
  }
  if (probe.size && probe.size < MIN_AUDIO_BYTES) {
    reasons.push(cand.field + ':体积 ' + probe.size + 'B 低于下限，疑似片段/错误响应');
    return null;
  }
  if (cand.tier === 'super' && songSize > 0 && probe.size) {
    var diff = Math.abs(probe.size - songSize) / songSize;
    if (diff > SQ_SIZE_TOLERANCE) {
      reasons.push(cand.field + ':Content-Length ' + probe.size + 'B 与 songSize ' + songSize + 'B 偏差 ' + (diff * 100).toFixed(1) + '% 超容限');
      return null;
    }
  }
  return { url: cand.url, tier: cand.tier, magic: probe.magic, size: probe.size };
}

// 主取链：按请求档位优先取候选，逐个校验，全部不可用才报错（宁低勿高 + actualQuality 如实上报）
async function resolveMediaSource(musicItem, quality) {
  var comp = parseCompositeId(musicItem && musicItem.id);
  if (!comp) throw new Error('5sing：无效的歌曲 ID（应为 {songId}|{songType} 复合 ID）');
  var songSize = Number(musicItem.songSize) || 0;
  var data = await getSongUrlData(comp.songId, comp.songType);
  var order = TIER_ORDER[quality] || TIER_ORDER.standard;
  var reasons = [];
  for (var i = 0; i < order.length; i++) {
    var field = order[i];
    var url = str(data[field]);
    if (!url) { reasons.push(field + ':空'); continue; }
    var ok = await validateCandidate({ field: field, url: url, tier: TIER_OF_FIELD[field] }, songSize, reasons);
    if (ok) {
      return {
        url: ok.url,
        headers: { 'User-Agent': UA },
        quality: ok.tier,           // 宿主 v1.0.0 协议标准字段：实际命中的档位
        actualQuality: ok.tier,     // 扩展回传（与仓库既有插件口径一致）
        _magic: ok.magic,
        _size: ok.size
      };
    }
  }
  throw new Error('5sing：未取得有效播放链接（' + reasons.join('；') + '）');
}

// ==================== 歌词 / 歌曲详情 ====================

// newget：成功 code=0（非 1000，注意与 getSongUrl 区分）；文档注明源码未校验 code，失败也解析 data
async function getSongMeta(sid, stype) {
  var res = await axiosGet(BASE_API + '/song/newget', {
    params: { songid: sid, songtype: stype }
  });
  var d = res.data && res.data.data;
  if (!d || typeof d !== 'object') throw new Error('5sing：歌曲信息接口返回无效');
  return d;
}

async function getLyricImpl(musicItem) {
  var comp = parseCompositeId(musicItem && musicItem.id);
  if (!comp) throw new Error('5sing：无效的歌曲 ID');
  var d = await getSongMeta(comp.songId, comp.songType);
  var words = str(d.dynamicWords);
  if (!words) throw new Error('5sing：该歌曲无歌词（伴奏或未收录 LRC）');
  return { rawLrc: words };
}

// 歌曲详情补全：SN=歌名、user.NN=歌手、user.I=歌手头像（均为文档实测字段；头像缺失不虚填）
async function getMusicInfoImpl(musicItem) {
  var comp = parseCompositeId(musicItem && musicItem.id);
  if (!comp) throw new Error('5sing：无效的歌曲 ID');
  var d = await getSongMeta(comp.songId, comp.songType);
  var out = {};
  if (d.SN) out.title = cleanEm(d.SN);
  if (d.user && d.user.NN) out.artist = cleanEm(d.user.NN);
  if (d.user && str(d.user.I)) out.artwork = str(d.user.I);
  return out;
}

function getMusicDetailPageUrlImpl(musicItem) {
  var comp = parseCompositeId(musicItem && musicItem.id);
  if (!comp) return '';
  return BASE_WEB + '/' + comp.songType + '/' + comp.songId + '.html';
}

// ==================== 歌单（元数据 API + HTML 解析双通道） ====================

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// 元数据：data 为对象有效 / 空数组=歌单不存在或无权访问（文档 5.1 多态约定）
// code=13 为「操作太频繁」限流（文档 1.5 实测），按 1.2s/2.4s 退避重试，共 3 次
async function fetchSheetMeta(playlistId) {
  var lastCode = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1200 * attempt);
    var res = await axiosGet(BASE_API + '/song/getsonglist', {
      params: { id: playlistId, songfields: 'ID,user' }
    });
    var body = res.data;
    if (body && body.code === 0) {
      var d = body.data;
      if (!d || typeof d !== 'object' || !d.ID) {
        throw new Error('5sing：歌单不存在或无权访问');
      }
      return d;
    }
    lastCode = body && body.code;
    if (lastCode !== 13) break; // 非限流错误不重试
  }
  throw new Error('5sing：歌单元数据接口 code=' + lastCode + (lastCode === 13 ? '（操作太频繁，限流重试后仍失败）' : '（成功应为 0）'));
}

// HTML 解析歌单歌曲（文档 5.2 正则；s_soner 为官方拼写错误，按原样匹配；单页无翻页）
function parseSheetHtml(html) {
  var seen = {};
  var out = [];
  var blocks = str(html).match(/<li class="p_rel">([\s\S]*?)<\/li>/g) || [];
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var m = block.match(/href="http:\/\/5sing\.kugou\.com\/(yc|fc|bz)\/(\d+)\.html"[^>]*>([^<]+)<\/a>/);
    if (!m) continue;
    var kind = m[1], sid = m[2], rawName = m[3];
    var key = kind + '|' + sid;
    if (seen[key]) continue;
    seen[key] = true;
    var a = block.match(/class="s_soner[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    var rawArtist = a ? stripTags(a[1]) : ''; // 实测手段内嵌套 <a target=...>，先剥标签
    out.push({
      id: sid + '|' + kind,
      title: cleanEm(rawName),
      artist: cleanEm(rawArtist) || '',
      _sid: sid,
      _stype: kind,
      url: BASE_WEB + '/' + kind + '/' + sid + '.html'
    });
  }
  return out;
}

// 歌单详情主流程：元数据（含创建者 userId）→ HTML 歌曲 → 组装
// page 无意义（上游单页加载），page>1 返回空页
async function getMusicSheetInfoImpl(sheetItem, page) {
  if (page && page > 1) return { isEnd: true, musicList: [] };
  var pid = str(sheetItem && sheetItem.id);
  if (!pid) throw new Error('5sing：缺少歌单 ID');
  var meta = await fetchSheetMeta(pid);
  var uid = str(meta.user && meta.user.ID) || str(sheetItem._uid);
  var htmlRes = await axiosGet(BASE_WEB + '/' + uid + '/dj/' + pid + '.html');
  var musicList = parseSheetHtml(htmlRes.data);
  var sheetOut = {
    id: pid,
    title: cleanEm(meta.T),
    artist: cleanEm(meta.user && meta.user.NN) || undefined,
    artwork: str(meta.P) || undefined,
    worksNum: Number(meta.E) || undefined,
    playCount: Number(meta.H) || undefined,
    description: str(meta.C) || undefined,
    _uid: uid || undefined
  };
  return {
    isEnd: true,
    sheetItem: sheetOut,
    // 注：HTML 解析数可能少于元数据 E（差额为已删除/VIP 限定/隐藏歌曲，文档 5.2 实测），如实返回
    musicList: musicList
  };
}

// ==================== 导入 ====================

async function importMusicItemImpl(urlLike) {
  var link = extractLink(urlLike) || str(urlLike);
  var parsed = parseSongLink(link);
  if (!parsed) throw new Error('5sing：无法识别的歌曲链接，支持形如 http://5sing.kugou.com/yc/5394963.html');
  var title = '';
  var artist = '';
  try {
    var d = await getSongMeta(parsed.songId, parsed.songType);
    title = cleanEm(d.SN);
    artist = d.user && d.user.NN ? cleanEm(d.user.NN) : '';
  } catch (e) { /* 元数据失败不阻塞导入，标题走兜底 */ }
  return {
    id: parsed.songId + '|' + parsed.songType,
    title: title || ('5sing #' + parsed.songId),
    artist: artist,
    _sid: parsed.songId,
    _stype: parsed.songType,
    url: BASE_WEB + '/' + parsed.songType + '/' + parsed.songId + '.html'
  };
}

async function importMusicSheetImpl(urlLike) {
  var link = extractLink(urlLike) || str(urlLike);
  var parsed = parsePlaylistLink(link);
  if (!parsed) throw new Error('5sing：无法识别的歌单链接，支持形如 http://5sing.kugou.com/{userId}/dj/{playlistId}.html');
  var sheetRes = await getMusicSheetInfoImpl({ id: parsed.playlistId, _uid: parsed.userId || undefined }, 1);
  return sheetRes.musicList || [];
}

// ==================== 插件导出 ====================

module.exports = {
  name: '5sing',
  platform: '5sing',
  version: '1.0.0',
  author: '研发2号',
  primaryKey: ['id'],
  description: '5sing 独立源插件 v1.0.0（酷狗旗下原创音乐平台，原创 yc/翻唱 fc/伴奏 bz）：歌曲与歌单搜索（高亮标签清洗 + 320kbps 时长估算）、三档音质取链（SQ 无损/HQ 高品质/LQ 流畅，请求档优先、无货自动降级、actualQuality 如实上报，魔数 + Content-Length 比对 songSize 双重校验，CDN 签名直链实时获取）、LRC 歌词（伴奏无歌词如实报错）、歌单详情与导入（元数据 API + HTML 双通道，HTML 解析数少于元数据 E 时如实透出）、歌曲/歌单分享链接导入；歌单分类与用户歌单平台无公开接口，如实不实现（无排行榜/歌单广场入口）。平台接口全明文免登录。',
  supportedSearchType: ['music', 'sheet'],
  supportedQualities: ['standard', 'high', 'super'],
  cacheControl: 'no-store', // CDN 直链带时间戳+MD5 签名有时效，必须实时获取
  hints: {
    search: ['搜索 5sing 曲库（原创/翻唱/伴奏），关键词即搜', '音质档位：无损(super)/较高(high)/标准(standard)，歌曲实际无该档时自动降级'],
    importMusicItem: ['支持 5sing 歌曲页链接，如 http://5sing.kugou.com/yc/5394963.html', 'yc=原创 fc=翻唱 bz=伴奏'],
    importMusicSheet: ['支持 5sing 歌单页链接，如 http://5sing.kugou.com/66401956/dj/5b17173cb0f5baf7df069c39.html', '链接中 userId 可缺省，会自动从歌单元数据补全', '歌单歌曲走页面解析，实际导入数可能少于页面标注数（差额为已删除/隐藏歌曲）']
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }；解包出关键词
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var p = page || 1;
    if (type === 'music') return searchMusicPage(kw, p);
    if (type === 'sheet') return searchSheetPage(kw, p);
    return { isEnd: true, data: [] };
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    var q = normalizeQuality(quality);
    return resolveMediaSource(musicItem, q);
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  // 歌曲详情页 URL（宿主「查看详情」入口；5sing 页面播放/下载仍须走 API）
  async getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
  },

  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  // ===== 以下为内部函数，供测试/质检脚本复用（非插件协议方法）=====
  _internal: {
    stripTags: stripTags,
    sleep: sleep,
    unescapeHtml: unescapeHtml,
    cleanEm: cleanEm,
    parseCompositeId: parseCompositeId,
    parseSongLink: parseSongLink,
    parsePlaylistLink: parsePlaylistLink,
    extractLink: extractLink,
    normalizeQuality: normalizeQuality,
    estimateDuration: estimateDuration,
    buildMusicItemFromSearch: buildMusicItemFromSearch,
    buildSheetItemFromSearch: buildSheetItemFromSearch,
    searchMusicPage: searchMusicPage,
    searchSheetPage: searchSheetPage,
    getSongUrlData: getSongUrlData,
    probeUrl: probeUrl,
    validateCandidate: validateCandidate,
    resolveMediaSource: resolveMediaSource,
    getSongMeta: getSongMeta,
    fetchSheetMeta: fetchSheetMeta,
    parseSheetHtml: parseSheetHtml,
    getMusicSheetInfoImpl: getMusicSheetInfoImpl,
    importMusicItemImpl: importMusicItemImpl,
    importMusicSheetImpl: importMusicSheetImpl,
    constants: {
      UA: UA, BASE_API: BASE_API, BASE_SEARCH: BASE_SEARCH, BASE_WEB: BASE_WEB,
      URL_FIELD_ORDER: URL_FIELD_ORDER, TIER_ORDER: TIER_ORDER,
      MIN_AUDIO_BYTES: MIN_AUDIO_BYTES, SQ_SIZE_TOLERANCE: SQ_SIZE_TOLERANCE
    }
  }
};
