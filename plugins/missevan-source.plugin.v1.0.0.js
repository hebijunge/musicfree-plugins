/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「猫耳FM」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 猫耳FM（MissEvan）独立源插件 v1.0.0 —— MusicFree
 * ============================================================
 * 猫耳FM（missevan.com）独立源：广播剧 / 有声小说 / 音乐翻唱 / 配音作品。
 * 免费音频免登录可播；搜索与广播剧剧集列表需登录 Cookie（userVariables 配置）。
 *
 * v1.0.0 changelog（2026-09-24）：
 *   ① getMediaSource：GET /sound/getsound?soundid= 免登录取播放信息。
 *      音质档位按 2026-09-24 实测如实映射（文档"64k"标注已过时）：
 *      - dash.audio id=128（soundurl_128 HLS 同源同字节）：实测 ≈128kbps → 宿主 '128k'；
 *      - dash.audio id=64（soundurl HLS 同源同字节）：实测码率 194~324kbps 区间
 *        （三首探针 194.6 / 295.5 / 324.0 kbps，随源文件变化）→ 宿主 '192k' 档声明，
 *        actualQuality 按实测字节/时长计算、宁低勿高（<192k 降标 '128k'）。
 *      取链链路：请求 ≥192k 档 → dash64 优先；请求 ≤128k 档 → dash128 优先；
 *      每档失败按链回落，HLS（m3u8，fMP4 分片）作 DASH 直链不可用时的兜底。
 *   ② 取链验证沿用音流口径（请求哪个音质拿哪个音质）：
 *      - DASH 直链：Range 探测响应 Content-Range 总长 与 getsound 返回的
 *        dash.audio[].size 字段比对（±2% 容差）+ 魔数校验（offset 4 起 'ftyp'）；
 *      - HLS：m3u8 以 #EXTM3U 起始 + quality_id 参数与本档一致校验 +
 *        首分片 Range 探测 'ftyp' 魔数；
 *      - 任一校验不过视为该档不可用，继续回落链；直链 host 白名单
 *        （*.maoercdn.com / *.bilivideo.com，2026-09-24 实测 CDN 已从 B站CDN
 *        迁至猫耳自有 sound-ali-cdn-cn.maoercdn.com，白名单两者兼容）。
 *   ③ search：GET /dramaapi/search?keyword= 需登录 Cookie（免登录实测恒返
 *      code=100010007，2026-09-24 复核）。未配置 Cookie 时抛出带引导的明确错误；
 *      登录态下响应结构未实测（沙箱无登录态），按防御式多形态解析
 *      （info.sounds / info.Datas / info.dramas），如实标注待登录态验证。
 *   ④ 排行榜：平台无公开榜单接口，以免登录分类页 /sound/m/{cat_id} 充当
 *      分类精选（1=音频 4=情感 6=听书 8=音乐 48=二次创作，标题 2026-09-24
 *      逐页实测），详情页锚点解析 soundid+标题，单页返回。
 *   ⑤ getArtistWorks：GET /{user_id}/getusersound?page_size=100&p= 免登录
 *      （2026-09-24 复测可用，p 分页实测生效），主播全部音频。
 *   ⑥ importMusicItem：/sound/{id} 链接或裸 soundid 免登录导入；
 *      importMusicSheet / getMusicSheetInfo：广播剧 /drama/{id} 或
 *      /mdrama/drama/{id}，剧集列表（info.sounds）需登录 Cookie
 *      （免登录实测 sounds=null，2026-09-24 复核），无 Cookie 抛明确引导错误。
 *   ⑦ getLyric：平台不提供歌词（文档 §6：广播剧/配音内容无歌词，无歌词接口），
 *      如实抛错。getMusicInfo 补全标题/主播/封面/时长。
 *   ⑧ 范围决策（宁缺毋滥）：专辑/评论/推荐歌单——平台无对应公开接口，不接入。
 *
 * 接口与参数来源：《猫耳FM接口完整文档_综合实测版》（2026-09-02，用户提供的任务附件）
 * + 本沙箱 2026-09-24 全量复核（getsound×3、DASH/HLS 取链×2 音质、getusersound
 * 分页、分类页×5、搜索免登录、广播剧详情免登录），实测数据与文档差异已在上文标注。
 *
 * 作者：研发2号 | 仅限个人技术研究学习，尊重版权与平台条款；付费内容不支持绕过。
 * ============================================================
 */
var axios = require('axios');

// ==================== 常量区 ====================

var PLUGIN_VERSION = '1.0.0';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
var HOST = 'https://www.missevan.com';

// 取链直链 host 白名单：2026-09-24 实测 DASH 直链在 *.maoercdn.com（猫耳自有 CDN），
// 文档 2026-09-02 实测期为 *.bilivideo.com（B站CDN），两者兼容放行，其余一律拒绝。
var MEDIA_URL_ALLOW_RE = /^https:\/\/([a-z0-9-]+\.)*(maoercdn\.com|bilivideo\.com)\//i;

// 排行榜（分类精选）：cat_id 与标题为 2026-09-24 逐页实测（<title> 标签）
var TOP_CATS = [
  { catId: '8', title: '音乐专区' },
  { catId: '6', title: '听书专区' },
  { catId: '48', title: '二次创作专区' },
  { catId: '4', title: '情感专区' },
  { catId: '1', title: '音频专区' }
];

var API_TIMEOUT = 6000;        // getsound / getusersound / getdrama 超时
var RESOLVE_TIMEOUT = 5000;    // 单次取链探测超时
var RESOLVE_BUDGET_MS = 8000;  // getMediaSource 整体预算（宿主 10s 上限内留余量）
var CATEGORY_PAGE_TIMEOUT = 8000;
var SEARCH_PAGE_SIZE_HINT = 20;

// 魔数：fMP4（m4s/m4a）box 头 offset 4-7 为 'ftyp'
function isFtypMagic(u8) {
  return u8 && u8.length >= 8 &&
    u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70; // 'ftyp'
}

// ==================== 工具区 ====================

function apiHeaders(extra) {
  var h = { 'User-Agent': UA, Referer: HOST + '/' };
  var cookie = getCookie();
  if (cookie) h.Cookie = cookie;
  if (extra) { for (var k in extra) { if (k !== 'Cookie' || extra[k]) h[k] = extra[k]; } }
  return h;
}

// 登录态：userVariables.cookie（免费音频播放/榜单/主播作品不需要，搜索与广播剧剧集需要）
function getCookie() {
  try {
    var uv = env.getUserVariables();
    return (uv && uv.cookie && String(uv.cookie).trim()) || '';
  } catch (e) { return ''; }
}

// 入参冻结守卫：在克隆体上工作，绝不修改宿主传入对象
function cloneItem(item) {
  var c = {};
  if (item) { for (var k in item) c[k] = item[k]; }
  return c;
}

function str(s) { return s == null ? '' : String(s); }

// 按实测字节总量与时长安低标 actualQuality（宁低勿高）：
// ≥192kbps → '192k'；≥112kbps → '128k'；其余 → '64k'（三档均为宿主可显示的诚实标注）
function actualQualityOf(totalBytes, durationSec) {
  if (!totalBytes || !durationSec || durationSec <= 0) return '128k'; // 无法推算时按保守低标
  var kbps = (totalBytes * 8) / durationSec / 1000;
  if (kbps >= 192) return '192k';
  if (kbps >= 112) return '128k';
  return '64k';
}

// 宿主档位归一：≥192k 全部按"高码率档"意图处理，≤128k 按 128k 意图处理
function wantsHighQuality(quality) {
  var q = String(quality || '').toLowerCase();
  var lowSet = { 'low': 1, 'standard': 1, '96k': 1, '128k': 1, '64k': 1 };
  return !lowSet[q]; // 未识别档（320k/flac/hires/master 等）一律按高码率意图，actualQuality 诚实回标
}

// ==================== API 层 ====================

// 核心：音频信息 + 播放地址（免登录；付费音频需 Cookie 且已购买）
async function apiGetSound(soundId) {
  var res = await axios.get(HOST + '/sound/getsound', {
    params: { soundid: soundId },
    timeout: API_TIMEOUT,
    headers: apiHeaders()
  });
  var d = res.data || {};
  if (!d.success) {
    var err = new Error('猫耳FM：音频不存在或接口拒绝（code=' + (d.code || 'unknown') + '）');
    err.code = d.code;
    throw err;
  }
  var sound = (d.info && d.info.sound) || null;
  if (!sound || !sound.id) throw new Error('猫耳FM：音频不存在或已下架');
  return sound;
}

// 主播全部音频（免登录，p 分页实测生效）
async function apiUserSounds(userId, page) {
  var res = await axios.get(HOST + '/' + encodeURIComponent(userId) + '/getusersound', {
    params: { page_size: 100, p: page || 1 },
    timeout: API_TIMEOUT,
    headers: apiHeaders()
  });
  var d = res.data || {};
  if (!d.success) throw new Error('猫耳FM：主播音频接口拒绝（code=' + (d.code || 'unknown') + '）');
  var info = d.info || {};
  return {
    datas: info.Datas || [],
    pagination: info.pagination || {}
  };
}

// 广播剧详情（基本信息免登录；剧集列表 info.sounds 需登录 Cookie）
async function apiGetDrama(dramaId) {
  var res = await axios.get(HOST + '/dramaapi/getdrama', {
    params: { drama_id: dramaId },
    timeout: API_TIMEOUT,
    headers: apiHeaders()
  });
  var d = res.data || {};
  if (!d.success) throw new Error('猫耳FM：广播剧不存在或接口拒绝（code=' + (d.code || 'unknown') + '）');
  return d.info || {};
}

// 分类页 HTML 锚点解析（免登录内容发现）：id + title 成对提取并去重
function parseCategoryAnchors(html) {
  var seen = {};
  var out = [];
  var re = /<a[^>]+href="[^"]*\/sound\/(\d+)[^"]*"[^>]*title="([^"]{1,120})"/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var id = m[1];
    if (seen[id]) continue;
    seen[id] = 1;
    var title = m[2].replace(/\s+/g, ' ').trim();
    if (title) out.push({ id: id, title: title });
  }
  return out;
}

// ==================== 取链验证层（音流口径） ====================

// Range 探测：返回 { status, total, magicOk, u8 }
async function probeRange(url, headers) {
  var res = await axios.get(url, {
    timeout: RESOLVE_TIMEOUT,
    responseType: 'arraybuffer',
    maxContentLength: 8 * 1024 * 1024,
    headers: apiHeaders({ Range: 'bytes=0-1023' })
  });
  var buf = res.data;
  var u8 = null;
  if (buf instanceof Uint8Array) u8 = buf;
  else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
  var total = 0;
  var h = res.headers || {};
  var cr = str(h['content-range'] || h['Content-Range']);
  var mm = /\/(\d+)\s*$/.exec(cr);
  if (mm) total = parseInt(mm[1], 10) || 0;
  else if (res.status === 200) {
    total = parseInt(str(h['content-length'] || h['Content-Length']), 10) || 0;
  }
  return { status: res.status, total: total, magicOk: isFtypMagic(u8), u8: u8 };
}

// DASH 直链候选验证：白名单 + 魔数 + Content-Range 总长 vs getsound dash.size（±2% 或 2KB 容差）
// 通过返回 { url, headers, actualQuality, size }，否则 throw（由回落链接住）
async function verifyDashCandidate(baseurl, declaredSize, durationSec) {
  if (!MEDIA_URL_ALLOW_RE.test(baseurl)) throw new Error('直链未通过官方 CDN 白名单校验（' + hostOf(baseurl) + '）');
  var p = await probeRange(baseurl);
  if (p.status !== 206 && p.status !== 200) throw new Error('DASH 直链探测失败（HTTP ' + p.status + '）');
  if (!p.magicOk) throw new Error('DASH 直链魔数校验未通过（非 fMP4）');
  if (p.total > 0 && declaredSize > 0) {
    var tol = Math.max(2048, declaredSize * 0.02);
    if (Math.abs(p.total - declaredSize) > tol) {
      throw new Error('取链大小比对不符（响应 ' + p.total + 'B vs 接口 ' + declaredSize + 'B），判定为不可用真链');
    }
  }
  var q = actualQualityOf(p.total || declaredSize, durationSec);
  return { url: baseurl, headers: { 'User-Agent': UA, Referer: HOST + '/' }, actualQuality: q, size: p.total || declaredSize };
}

// HLS 候选验证：#EXTM3U 起始 + quality_id 与本档一致 + 首分片 'ftyp' 魔数
async function verifyHlsCandidate(m3u8Url, expectQualityId, durationSec) {
  if (!/^https:\/\/www\.missevan\.com\/x\/sound\/hls\.m3u8\?/.test(m3u8Url)) {
    throw new Error('HLS 地址未通过官方域白名单校验');
  }
  var qid = (/[?&]quality_id=(\d+)/.exec(m3u8Url) || [])[1];
  if (qid !== String(expectQualityId)) throw new Error('HLS 音质参数与本档不符（' + qid + ' != ' + expectQualityId + '）');
  var res = await axios.get(m3u8Url, { timeout: RESOLVE_TIMEOUT, headers: apiHeaders() });
  var text = str(res.data);
  if (text.indexOf('#EXTM3U') !== 0) throw new Error('HLS 播放列表校验未通过（非 m3u8）');
  // 首分片（绝对或相对路径）魔数校验
  var segLine = '';
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].trim();
    if (ln && ln.charAt(0) !== '#') { segLine = ln; break; }
  }
  if (!segLine) throw new Error('HLS 播放列表无可用分片');
  var segUrl = segLine;
  if (!/^https?:\/\//i.test(segUrl)) {
    segUrl = 'https://www.missevan.com/x/sound/' + segLine.replace(/^\//, '');
  }
  if (!MEDIA_URL_ALLOW_RE.test(segUrl)) throw new Error('HLS 分片未通过官方 CDN 白名单校验（' + hostOf(segUrl) + '）');
  var p = await probeRange(segUrl);
  if (!p.magicOk) throw new Error('HLS 首分片魔数校验未通过（非 fMP4）');
  // 标注：128 档实测 ≈128kbps；64 档实测 194~324kbps 区间，宁低勿高按 192k 标注
  var q = expectQualityId === '128' ? '128k' : actualQualityOf(p.total, durationSec) === '64k' ? '64k' : '192k';
  return { url: m3u8Url, headers: { 'User-Agent': UA, Referer: HOST + '/' }, actualQuality: q, size: p.total };
}

function hostOf(u) {
  var m = /^https?:\/\/([^\/]+)/.exec(str(u));
  return m ? m[1] : 'unknown';
}

// 候选链构造（请求哪个音质拿哪个音质；失败按链回落，标注始终诚实）
function buildCandidates(sound, wantHigh) {
  var dash = (sound.dash && sound.dash.audio) || [];
  var dash128 = null, dash64 = null;
  for (var i = 0; i < dash.length; i++) {
    if (String(dash[i].id) === '128' && dash[i].base_url) dash128 = dash[i];
    if (String(dash[i].id) === '64' && dash[i].base_url) dash64 = dash[i];
  }
  var hls128 = sound.soundurl_128 || '';
  var hls64 = sound.soundurl || '';
  if (wantHigh) {
    return [
      dash64 && { kind: 'dash', item: dash64, dur: sound.duration },
      hls64 && { kind: 'hls', url: hls64, expect: '64' },
      dash128 && { kind: 'dash', item: dash128, dur: sound.duration },
      hls128 && { kind: 'hls', url: hls128, expect: '128' }
    ].filter(Boolean);
  }
  return [
    dash128 && { kind: 'dash', item: dash128, dur: sound.duration },
    hls128 && { kind: 'hls', url: hls128, expect: '128' },
    dash64 && { kind: 'dash', item: dash64, dur: sound.duration },
    hls64 && { kind: 'hls', url: hls64, expect: '64' }
  ].filter(Boolean);
}

// ==================== Impl 层 ====================

async function searchImpl(query, page, type) {
  if (type !== 'music') return { isEnd: true, data: [] };
  var q = str(query).trim();
  if (!q) return { isEnd: true, data: [] };
  if (!getCookie()) {
    throw new Error('猫耳FM 搜索需要登录态：请在插件设置中配置猫耳FM Cookie（浏览器登录 www.missevan.com 后，F12 → 网络 → 复制请求 Cookie）。未配置时可用「排行榜」分类浏览免登录内容。');
  }
  var res = await axios.get(HOST + '/dramaapi/search', {
    params: { keyword: q, page: page || 1 },
    timeout: API_TIMEOUT,
    headers: apiHeaders()
  });
  var d = res.data || {};
  if (!d.success) {
    if (String(d.code) === '100010007') {
      throw new Error('猫耳FM：登录态无效或已过期（搜索需登录）。请更新插件设置中的 Cookie。');
    }
    throw new Error('猫耳FM：搜索失败（code=' + (d.code || 'unknown') + '）');
  }
  var info = d.info || {};
  var list = info.sounds || info.Datas || info.dramas || info.data || [];
  if (!Array.isArray(list)) list = [];
  var data = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var id = it.sound_id || it.id;
    var title = it.soundstr || it.name || it.title;
    if (!id || !title) continue;
    data.push({
      id: String(id),
      title: str(title),
      artist: str(it.username || it.uname || ''), // 登录态响应字段未实测，缺省留空
      artwork: it.front_cover || it.cover || undefined,
      duration: it.duration ? Math.round(Number(it.duration) / 1000) : undefined
    });
  }
  return { isEnd: data.length < SEARCH_PAGE_SIZE_HINT, data: data };
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var item = cloneItem(musicItem);
  var wantHigh = wantsHighQuality(quality);
  var deadline = Date.now() + RESOLVE_BUDGET_MS;

  var sound = await apiGetSound(String(item.id));
  var durationSec = Number(sound.duration) > 0 ? Number(sound.duration) / 1000 : (Number(item.duration) > 0 ? Number(item.duration) : 0);
  var candidates = buildCandidates(sound, wantHigh);
  var payWall = Number(sound.pay_type) === 1 || Number(sound.episode_vip) === 1;
  if (!candidates.length) {
    if (payWall) throw new Error('付费/VIP 内容：需登录已购买账号后才返回播放地址（本插件不支持绕过付费校验）');
    throw new Error('该音频无可用播放地址');
  }

  var lastErr = null;
  for (var i = 0; i < candidates.length; i++) {
    if (Date.now() > deadline) break;
    var c = candidates[i];
    try {
      if (c.kind === 'dash') {
        return await verifyDashCandidate(c.item.base_url, Number(c.item.size) || 0, durationSec);
      }
      return await verifyHlsCandidate(c.url, c.expect, durationSec);
    } catch (e) {
      lastErr = e;
    }
  }
  if (payWall && lastErr) {
    throw new Error('付费/VIP 内容：需登录已购买账号后才返回播放地址（本插件不支持绕过付费校验）');
  }
  throw lastErr || new Error('所有音质档均未通过取链校验');
}

async function getMusicInfoImpl(musicItem) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var sound = await apiGetSound(String(musicItem.id));
  return {
    title: str(sound.soundstr),
    artist: str(sound.username),
    artwork: sound.front_cover || undefined,
    duration: sound.duration ? Math.round(Number(sound.duration) / 1000) : undefined,
    fee: Number(sound.pay_type) === 1 ? 1 : 0
  };
}

async function getLyricImpl() {
  throw new Error('猫耳FM 为广播剧/有声/配音内容平台，不提供歌词（平台无歌词接口，实测确认）');
}

// 排行榜：免登录分类页充当分类精选（平台无公开榜单接口，宁缺毋滥）
async function getTopListsImpl() {
  return [{
    title: '分类精选',
    data: TOP_CATS.map(function (c) {
      return { id: 'cat_' + c.catId, title: c.title, _catId: c.catId };
    })
  }];
}

async function getTopListDetailImpl(topListItem, page) {
  var p = page || 1;
  if (p > 1) return { isEnd: true, musicList: [] };
  var catId = (topListItem && (topListItem._catId || str(topListItem.id).replace(/^cat_/, ''))) || '';
  if (!/^\d+$/.test(catId)) throw new Error('无效的分类 ID');
  var res = await axios.get(HOST + '/sound/m/' + catId, {
    timeout: CATEGORY_PAGE_TIMEOUT,
    headers: { 'User-Agent': UA, Accept: 'text/html' }
  });
  var anchors = parseCategoryAnchors(str(res.data));
  var musicList = anchors.map(function (a) {
    return { id: a.id, title: a.title, artist: '未知主播' }; // 分类页无主播字段，播放时 getMusicInfo 补全
  });
  return { isEnd: true, musicList: musicList };
}

async function getArtistWorksImpl(artistItem, page, type) {
  var uid = (artistItem && artistItem.id) || '';
  if (!/^\d+$/.test(String(uid))) throw new Error('无效的主播 ID（需猫耳 user_id）');
  var r = await apiUserSounds(uid, page || 1);
  var name = str((artistItem && (artistItem.name || artistItem.artist)));
  var data = (r.datas || []).map(function (s) {
    return {
      id: String(s.id),
      title: str(s.soundstr),
      artist: name || str(s.username) || '猫耳主播',
      artwork: s.front_cover || undefined,
      duration: s.duration ? Math.round(Number(s.duration) / 1000) : undefined
    };
  });
  var hasMore = r.pagination && r.pagination.hasMore === true;
  return { isEnd: !hasMore || data.length === 0, data: data };
}

// 单曲导入：/sound/{id} 链接或裸 soundid（免登录）
async function importMusicItemImpl(urlLike) {
  var m = /\/sound\/(\d+)/.exec(str(urlLike));
  var sid = m ? m[1] : (/^\d+$/.test(str(urlLike).trim()) ? str(urlLike).trim() : '');
  if (!sid) throw new Error('无法识别的音频链接：支持 https://www.missevan.com/sound/{id} 或裸 soundid');
  var sound = await apiGetSound(sid);
  return {
    id: String(sound.id),
    title: str(sound.soundstr),
    artist: str(sound.username),
    artwork: sound.front_cover || undefined,
    duration: sound.duration ? Math.round(Number(sound.duration) / 1000) : undefined,
    fee: Number(sound.pay_type) === 1 ? 1 : 0
  };
}

// 广播剧剧集列表解析（info.sounds 形态防御式兼容）
function dramaSoundsToMusicList(info) {
  var sounds = info && info.sounds;
  if (!Array.isArray(sounds)) return null; // null = 未取得剧集列表（典型：未登录）
  var drama = (info && info.drama) || {};
  var out = [];
  for (var i = 0; i < sounds.length; i++) {
    var s = sounds[i] || {};
    var sid = s.sound_id || s.id;
    var title = s.soundstr || s.name || s.title;
    if (!sid || !title) continue;
    out.push({
      id: String(sid),
      title: str(title),
      artist: str(drama.name || '猫耳广播剧'),
      artwork: s.front_cover || drama.cover || undefined,
      duration: s.duration ? Math.round(Number(s.duration) / 1000) : undefined
    });
  }
  return out;
}

function extractDramaId(urlLike) {
  var s = str(urlLike);
  var m = /\/(?:m?drama\/)?drama\/(\d+)/.exec(s) || /\/drama\/(\d+)/.exec(s);
  return m ? m[1] : (/^\d+$/.test(s.trim()) ? s.trim() : '');
}

async function getMusicSheetInfoImpl(sheetItem, page) {
  var dramaId = (sheetItem && (sheetItem._dramaId || extractDramaId(str(sheetItem.id)))) || '';
  if (!dramaId) throw new Error('无法识别的广播剧 ID');
  var info = await apiGetDrama(dramaId);
  var drama = info.drama || {};
  var list = dramaSoundsToMusicList(info);
  if (list === null) {
    throw new Error('广播剧剧集列表需要登录后获取：请先在插件设置中配置猫耳FM Cookie（免费剧集播放无需 Cookie）');
  }
  var p = page || 1;
  var PAGE = 100;
  var start = (p - 1) * PAGE;
  var slice = list.slice(start, start + PAGE);
  return {
    isEnd: start + PAGE >= list.length,
    musicList: slice,
    sheetItem: {
      id: sheetItem.id,
      title: str(drama.name || sheetItem.title),
      artwork: drama.cover || (sheetItem && sheetItem.artwork) || undefined,
      _dramaId: dramaId
    }
  };
}

async function importMusicSheetImpl(urlLike) {
  var dramaId = extractDramaId(urlLike);
  if (!dramaId) throw new Error('无法识别的广播剧链接：支持 https://www.missevan.com/drama/{id} 或 /mdrama/drama/{id}');
  var info = await apiGetDrama(dramaId);
  var list = dramaSoundsToMusicList(info);
  if (list === null) {
    throw new Error('广播剧剧集列表需要登录后获取：请先在插件设置中配置猫耳FM Cookie（免费剧集播放无需 Cookie）');
  }
  if (!list.length) throw new Error('该剧集列表为空（可能需要登录已购买账号）');
  return list;
}

// ==================== exports ====================

var plugin = {
  name: '猫耳FM',
  platform: '猫耳FM',
  version: PLUGIN_VERSION,
  author: '研发2号',
  description: '猫耳FM（missevan.com）广播剧/有声/翻唱源。免费音频免登录播放（DASH fMP4 直链 + HLS 兜底，128k 实测档 + 高码率实测档）；搜索与广播剧剧集需在插件设置配置 Cookie。',
  srcUrl: '',
  cacheControl: 'no-store', // 播放地址含 token/expire_time 时效签名，必须现取
  supportedSearchType: ['music'],
  supportedQualities: ['128k', '192k'],
  userVariables: [{
    key: 'cookie',
    name: '猫耳FM Cookie',
    hint: '浏览器登录 www.missevan.com 后，F12 → 网络 → 复制任意请求的 Cookie 粘贴到这里。仅搜索与广播剧剧集列表需要；免费音频播放/榜单/主播作品免登录可用。'
  }],
  hints: {
    search: ['搜索需在插件设置中配置猫耳FM Cookie（平台搜索接口强制登录）', '未配置 Cookie 时可用「排行榜-分类精选」浏览免登录内容'],
    importMusicItem: ['支持音频页链接 https://www.missevan.com/sound/{id}，或直接粘贴纯数字 soundid'],
    importMusicSheet: ['支持广播剧链接 https://www.missevan.com/drama/{id} 或 /mdrama/drama/{id}', '剧集列表需登录 Cookie（插件设置中配置）']
  },

  async search(query, page, type) { return searchImpl(query, page, type); },
  async getMediaSource(musicItem, quality) { return getMediaSourceImpl(musicItem, quality); },
  async getLyric(musicItem) { return getLyricImpl(musicItem); },
  async getMusicInfo(musicItem) { return getMusicInfoImpl(musicItem); },
  async getTopLists() { return getTopListsImpl(); },
  async getTopListDetail(topListItem, page) { return getTopListDetailImpl(topListItem, page); },
  async getArtistWorks(artistItem, page, type) { return getArtistWorksImpl(artistItem, page, type); },
  async importMusicItem(urlLike) { return importMusicItemImpl(urlLike); },
  async importMusicSheet(urlLike) { return importMusicSheetImpl(urlLike); },
  async getMusicSheetInfo(sheetItem, page) { return getMusicSheetInfoImpl(sheetItem, page); }
};

// 自检/交叉质检用内部出口（不影响宿主协议）
plugin._internal = {
  apiGetSound: apiGetSound,
  apiUserSounds: apiUserSounds,
  apiGetDrama: apiGetDrama,
  parseCategoryAnchors: parseCategoryAnchors,
  buildCandidates: buildCandidates,
  verifyDashCandidate: verifyDashCandidate,
  verifyHlsCandidate: verifyHlsCandidate,
  probeRange: probeRange,
  actualQualityOf: actualQualityOf,
  wantsHighQuality: wantsHighQuality,
  MEDIA_URL_ALLOW_RE: MEDIA_URL_ALLOW_RE,
  TOP_CATS: TOP_CATS,
  dramaSoundsToMusicList: dramaSoundsToMusicList,
  extractDramaId: extractDramaId
};

module.exports = plugin;
