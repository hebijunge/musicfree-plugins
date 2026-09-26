/**
 * [v1.1.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「番茄畅听」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 番茄音乐（NovelFM）独立源插件 v1.0.0 —— MusicFree
 * ============================================================
 * 番茄音乐（App 内代号「小番」，即 NovelFM / 懒人听书音乐板块）独立源。
 * 免登录、无签名、明文 M4A 直链；设备参数拼接在 URL Query。
 *
 * v1.0.0 changelog（2026-09-09）：
 *   ① search：POST /novelfm/bookmall/search/page/v1/（域名A），歌曲搜索，
 *      title/artist/album/artwork/duration 全字段，20 条/页分页；
 *      版权内容（audio_duration=0，如周杰伦）正常返回条目，播放时友好报错。
 *   ② getMediaSource：POST /novelfm/playerapi/video_model/mget/v1/
 *      LITE版(域名B-Lite) 主通道快速重试环 + 标准版(域名B) 一次兜底（2026-09-09 实测：
 *      标准版 aid=3040 已全局 403 "invalid aid" 端点失效；LITE 对可播/版权内容均随机
 *      灰度 403 抖动 ~60%，单次 ~100ms 重试即可命中；code=5000 才是内容级版权限制），
 *      全挂时降级 m.novelfm.com 歌曲页 SSR 直链兜底；video_model 为 JSON 字符串需二次
 *      解析；直链 host 白名单（*.novelfmvod.com）+ Range 魔数校验（M4A ftyp）；
 *      actualQuality 按文件大小/时长实测码率如实标注（宁低勿高）；
 *      版权内容（code=5000）识别后透传「平台限制播放」友好错误。
 *   ③ getLyric：m.novelfm.com/music/<book_id> 歌曲页 SSR 内嵌歌词
 *      （lyric_type 1=行级 LRC 直出；2=逐字格式转行级 LRC；0=无词如实抛错）；
 *      getWordByWordLyric：lyric_type=2 时返回原始逐字串（QRC 同族格式）。
 *   ④ getTopLists/getTopListDetail：www.novelfm.com 首页 SSR 热歌榜
 *      （hot_list_groups，实测 198 首，6h 内存缓存），50 条/页。
 *   ⑤ getMusicInfo：GET /novelfm/bookapi/detail/v1/ 补全专辑/封面/时长；
 *      getMusicDetailPageUrl：https://m.novelfm.com/music/<book_id>；
 *      importMusicItem：歌曲页 URL 或裸 book_id 导入。
 *   ⑥ 档位声明 ['128k','320k','flac']（不虚标）：
 *      higher(~129kbps 实测)→宿主 128k；highest(~254kbps 实测)→宿主 320k；
 *      lossless（仅部分内容有档）→宿主 flac；medium(~66kbps) 仅作内部兜底不声明。
 *      未命中声明档时按回落链实际命中档如实标注（宁低勿高）。
 *   ⑦ 范围决策（宁缺毋滥）：专辑/歌手/歌单搜索与详情、评论——平台无公开接口
 *      （APP 端榜单/歌单接口需 Lynx 运行时纯 HTTP 返回空 body，已实测证实），
 *      本插件不含；supportedSearchType 仅声明 'music'。
 *
 * 接口与参数来源：《番茄音乐接口完整文档（综合实测版）》（2026-08-28，7 项核心
 * 接口实测 100% 通过）+ 本沙箱 2026-09-09 复测（SSR 歌词 6 曲探针、版权内容
 * 5000 复现、LITE 通道）。设备参数为文档实测固定值，仅用于接口连通性，不
 * 规避任何登录态/风控（该平台免登录）。
 *
 * 作者：研发2号 | 仅限个人技术研究学习，尊重版权与平台条款。
 * ============================================================
 */
var axios = require('axios');

// ==================== 常量区 ====================

var PLUGIN_VERSION = '1.0.0';
// 文档 §1.3 实测 UA（移动端 Chrome）
var UA = 'Mozilla/5.0 (Linux; Android 16; 25102RKBEC Build/BP2A.250605.031.A3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

var HOST_API_A = 'https://api5-sinfonlinea.novelfm.com'; // 搜索/详情
var HOST_API_B = 'https://api5-sinfonlineb.novelfm.com'; // 播放信息·标准版
var HOST_LITE_B = 'https://api5-lite-sinfonlineb.novelfm.com'; // 播放信息·LITE版
var HOST_SITE = 'https://www.novelfm.com'; // 官网 SSR（热歌榜）
var HOST_M_SITE = 'https://m.novelfm.com'; // H5 站 SSR（歌词/直链兜底/详情页）

// 取链直链 host 白名单：仅放行番茄官方 CDN，防 SSR/上游注入任意 URL（v1.6.1 酷我同款防线）
var MEDIA_URL_ALLOW_RE = /^https:\/\/v\d+-novelfm\.novelfmvod\.com\//;

var SEARCH_PAGE_SIZE = 20;
var TOP_LIST_PAGE_SIZE = 50;
var SOURCE_TIMEOUT = 6000; // API 请求超时
var RACE_TIMEOUT = 3000; // 双通道竞速单通道超时（getMediaSource 10s 硬上限内）
var SSR_TIMEOUT = 6000;
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体预算（留 2s 余量给宿主）
// 取链整体预算状态（manifest 层 SSR 兜底与主实现共享同一 deadline）
var resolveDeadlineAt = 0;
function RESOLVE_DEADLINE() { return resolveDeadlineAt; }
var TOP_CACHE_TTL = 6 * 3600 * 1000; // SSR 榜单缓存 6h
var SSR_PAGE_CACHE_TTL = 600 * 1000; // m 站歌曲页 SSR 缓存 10min（歌词/兜底共用）

// 标准版设备参数（文档 §2.1 实测固定值）
function stdParams() {
  return 'device_platform=android&os=android&ssmix=a&_rticket=' + Date.now() +
    '&cdid=b501fece-ed1e-4f02-8939-28439d913e64&channel=vivo_3040_64&aid=3040&app_name=novel_fm' +
    '&version_code=556&version_name=5.5.6.32&manifest_version_code=556&update_version_code=55632' +
    '&resolution=1080*2272&dpi=440&device_type=M2012K10C&device_brand=Redmi&language=zh' +
    '&os_api=33&os_version=13&ac=wifi&device_id=4135726972408180' +
    '&need_personal_recommend=1&iid=3563956292032601&comment_tag_c=5&vip_state=0&category_style=1';
}
// LITE 版设备参数（文档 §2.2；device_id/iid 文档未给 LITE 实测值，不编造，仅传 §2.2 所列字段）
function liteParams() {
  return 'device_platform=android&os=android&_rticket=' + Date.now() +
    '&cdid=c940b404-2b15-48bb-b9cb-24907ce66ecb&channel=53931575a&aid=8661&app_name=novel_fm_lite' +
    '&version_code=624&version_name=6.2.4.32&manifest_version_code=624&update_version_code=62432' +
    '&resolution=540*960&dpi=240&device_type=PGAM10&device_brand=OPPO&language=zh' +
    '&os_api=32&os_version=12&ac=wifi&host_abi=arm64-v8a';
}

// 档位映射（宁低勿高）：宿主档 → 内部档尝试序；内部档 → 宿主静态标注
// 实测码率：highest≈254kbps / higher≈129kbps / medium≈66kbps（起风了 311s，文档 §5.4）
var HOST_TO_INTERNAL = {
  '128k': ['higher', 'medium'],
  '320k': ['highest', 'higher', 'medium'],
  'flac': ['lossless', 'highest', 'higher']
};
var INTERNAL_STATIC_HOST = { lossless: 'flac', highest: '320k', higher: '128k', medium: '128k' };
// 静态标注的码率下限守卫（kbps）：命中档实测码率低于下限时降一档标注
var BITRATE_FLOOR = { '320k': 192 }; // 320k 标注需实测 ≥192kbps，否则降标 128k

// ==================== 工具区 ====================

function apiHeaders(extra) {
  var h = { 'User-Agent': UA };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}

// 入参冻结守卫：所有 Impl 一律在克隆体上工作，绝不修改宿主传入的 musicItem
function cloneItem(musicItem) {
  var c = {};
  if (musicItem) { for (var k in musicItem) c[k] = musicItem[k]; }
  return c;
}

// 宿主档位归一（未识别档按 320k 档处理，取链内部按候选序回落）
function normalizeQuality(quality) {
  var q = String(quality || '');
  return HOST_TO_INTERNAL[q] ? q : '320k';
}

// 实测码率（kbps）标注 actualQuality：宁低勿高
// lossless 恒标 flac；其余按 size/duration 实算，无实测数据时退静态映射
function honestQuality(internal, size, durationSec) {
  if (internal === 'lossless') return 'flac';
  var label = INTERNAL_STATIC_HOST[internal] || '128k';
  if (size > 0 && durationSec > 0) {
    var kbps = Math.round(size * 8 / durationSec / 1000);
    if (label === '320k' && kbps < BITRATE_FLOOR['320k']) label = '128k'; // 254k→320k；129k→128k
  }
  return label;
}

// Range 魔数探测：M4A = 偏移 4-7 'ftyp'（文档实测 head=0000001c66747970）；
// 兼容 ID3 头（个别内容可能挂 mp3 封装）
function probeMediaMagic(url) {
  return axios.get(url, {
    timeout: RACE_TIMEOUT,
    headers: apiHeaders({ Range: 'bytes=0-15' }),
    responseType: 'arraybuffer'
  }).then(function (res) {
    var buf = res.data;
    var u8;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
    else return '';
    if (!u8 || u8.length < 8) return '';
    if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) return 'm4a';
    if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'id3';
    return '';
  }).catch(function () { return ''; });
}

// Range 探测顺带取总大小（206 响应 Content-Range），供无 size 场景估码率
function contentLengthOf(res) {
  try {
    var cr = res.headers && (res.headers['content-range'] || res.headers['Content-Range']);
    if (cr) {
      var m = /\/(\d+)\s*$/.exec(String(cr));
      if (m) return parseInt(m[1], 10) || 0;
    }
  } catch (e) { /* 可选信息，忽略 */ }
  return 0;
}

function stripEm(s) {
  return String(s == null ? '' : s).replace(/<\/?em>/g, '');
}

// SSR 页 window._ROUTER_DATA 提取（www 首页榜 / m 站歌曲页同构）
function extractRouterData(html) {
  var m = /window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/.exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

// ==================== API 层 ====================

// ① 搜索：POST /novelfm/bookmall/search/page/v1/（域名A；文档 §3）
async function apiSearch(query, page) {
  var offset = (page - 1) * SEARCH_PAGE_SIZE;
  var body = {
    limit: SEARCH_PAGE_SIZE,
    offset: offset,
    query: query,
    search_ctx_info: '',
    // 文档 §3.1 实测入口参数，原样保留
    search_entrance: '{"type":1,"tab_type":6,"search_tab_id":3}',
    search_id: '',
    sub_tab_type: 32,
    tab_type: 3
  };
  var res = await axios.post(
    HOST_API_A + '/novelfm/bookmall/search/page/v1/?' + stdParams(),
    body,
    { timeout: SOURCE_TIMEOUT, headers: apiHeaders({ 'Content-Type': 'application/json' }) }
  );
  var j = res.data;
  if (!j || j.code !== 0) throw new Error('搜索失败 code=' + (j && j.code));
  var sds = (j.data && j.data.search_data) || [];
  var out = [];
  for (var i = 0; i < sds.length; i++) {
    var books = sds[i].books || [];
    for (var k = 0; k < books.length; k++) {
      var b = books[k];
      if (!b || !b.book_id) continue;
      var names = [];
      var ais = b.author_infos || [];
      for (var a = 0; a < ais.length; a++) { if (ais[a] && ais[a].name) names.push(ais[a].name); }
      var dur = Number(b.audio_duration) || 0;
      out.push({
        id: String(b.book_id),
        platform: 'fanqie', // [v1.1.0 P0-4] IMusicItem 缺 platform → 补
        title: stripEm(b.book_name) || '未知曲目',
        artist: names.join('/') || '未知歌手',
        album: (b.common_book_info && b.common_book_info.album_title) || undefined,
        artwork: b.thumb_url || undefined,
        // 版权内容 audio_duration=0：不填 duration（宿主显示 --:--），播放时接口报 5000 走友好错误
        duration: dur > 0 ? Math.round(dur) : undefined,
        version: b.singing_version_name || undefined, // 演唱版本（原唱/翻唱）扩展字段透传
        // [v1.1.0 P0-5] 番茄无原生音质表字段；按 supportedQualities 全档声明（搜索阶段
        // 取链后回填 actualQuality 即可，宿主只用于音质选项默认）
        qualities: ['128k', '320k', 'flac'],
        fee: 0, // [v1.1.0 P0-6] 番茄无会员体系，全条目免会员 0
        alias: undefined // [v1.1.0 P0-7] 番茄无别名字段（如有平台别名表后续 v1.x 补）
      });
    }
  }
  return out;
}

// ② 歌曲详情：GET /novelfm/bookapi/detail/v1/（文档 §4）
async function apiDetail(bookId) {
  var res = await axios.get(
    HOST_API_A + '/novelfm/bookapi/detail/v1/?book_id=' + encodeURIComponent(String(bookId)) + '&' + stdParams(),
    { timeout: SOURCE_TIMEOUT, headers: apiHeaders() }
  );
  var j = res.data;
  if (!j || j.code !== 0) throw new Error('详情失败 code=' + (j && j.code));
  return j.data || {};
}

// ③ 播放信息（单通道）：POST /novelfm/playerapi/video_model/mget/v1/
//    返回 { quality: { size, url } } map；坑：video_model 是 JSON 字符串需二次解析（文档 §10-1）
//    通道实测（2026-09-09 沙箱）：标准版 aid=3040 已全局 403 "invalid aid"（端点失效，
//    文档 2026-08-28 实测后平台漂移）；LITE aid=8661 正常，为主通道。版权内容在 LITE
//    通道表现为逐条 403（与端点级失效同码，按通道归因区分，见 getMediaSourceImpl）。
async function apiVideoModel(host, bookId, paramsFn, channel) {
  var body = {
    audio_type: 0, // 坑 §10-3：=1 时 video_model 为空
    bgm_used: 0,
    book_id: String(bookId),
    device_score: 0.0,
    item_ids: [String(bookId)], // 坑 §10-2：必须传 [book_id]，否则 code=4000
    multi_shift: true,
    source: 'music_continuous_preload_more',
    tone_id: 0,
    user_select_start_para: 0,
    user_select_start_para_off: 0
  };
  var res = await axios.post(
    host + '/novelfm/playerapi/video_model/mget/v1/?' + paramsFn(),
    body,
    { timeout: RACE_TIMEOUT, headers: apiHeaders({ 'Content-Type': 'application/json' }) }
  );
  var j = res.data;
  if (!j || j.code !== 0) {
    // code=5000 "internal error" = 内容级版权限制（可播内容从不返回 5000，2026-09-09 实测）；
    // code=403 "invalid aid" = 平台灰度抖动（可播/版权内容随机出现，上层重试环处理）
    var err = new Error(j && j.code === 5000
      ? '该内容为版权曲目或已下架，平台限制播放（接口 code=5000）'
      : '取链失败 code=' + (j && j.code));
    err.code = j && j.code;
    err.fanqieChannel = channel;
    throw err;
  }
  var vmds = (j.data && j.data.video_model_datas) || [];
  if (!vmds.length) throw new Error('取链失败：video_model_datas 为空');
  var vmRaw = vmds[0].video_model;
  var vm = typeof vmRaw === 'string' ? JSON.parse(vmRaw) : vmRaw; // 二次解析
  if (!vm || vm.status !== 10) throw new Error('取链失败 video_model.status=' + (vm && vm.status));
  var list = vm.video_list || [];
  var map = {};
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    var meta = (v && v.video_meta) || {};
    var q = meta.quality;
    var url = v.main_url || v.url;
    if (!q || !url) continue;
    map[q] = { size: Number(meta.size) || 0, url: String(url), urlExpire: v.url_expire };
  }
  if (!Object.keys(map).length) throw new Error('取链失败：video_list 无可用音质档');
  return map;
}

// ④ m 站歌曲页 SSR（歌词 / 直链兜底 / 单曲导入共用，10min 缓存）
var ssrPageCache = {}; // bookId -> { at, data }
async function fetchMSSRPage(bookId) {
  var key = String(bookId);
  var hit = ssrPageCache[key];
  if (hit && (Date.now() - hit.at) < SSR_PAGE_CACHE_TTL) return hit.data;
  var res = await axios.get(HOST_M_SITE + '/music/' + key, {
    timeout: SSR_TIMEOUT,
    headers: apiHeaders({ Accept: 'text/html,application/xhtml+xml' })
  });
  var html = typeof res.data === 'string' ? res.data : String(res.data);
  var rd = extractRouterData(html);
  var pageData = null;
  if (rd && rd.loaderData) {
    // 路由键形如 'music_(id)/page'，按含 pageData 的值探测，避免键名硬编码
    for (var k in rd.loaderData) {
      var v = rd.loaderData[k];
      if (v && typeof v === 'object' && v.pageData && typeof v.pageData === 'object') { pageData = v.pageData; break; }
    }
  }
  if (!pageData) throw new Error('SSR 歌曲页数据缺失（页面可能已改版）');
  var out = {
    lyricType: Number(pageData.lyric_type) || 0,
    lyricInfo: typeof pageData.lyric_info === 'string' ? pageData.lyric_info : '',
    bookInfo: pageData.api_book_info || {},
    videoInfo: pageData.video_info || {}
  };
  ssrPageCache[key] = { at: Date.now(), data: out };
  return out;
}

// ⑤ 官网 SSR 热歌榜（文档 §12，6h 缓存）
var topCache = null; // { at, groups }
async function fetchTopGroups() {
  if (topCache && (Date.now() - topCache.at) < TOP_CACHE_TTL) return topCache.groups;
  var res = await axios.get(HOST_SITE + '/', { timeout: SSR_TIMEOUT, headers: apiHeaders() });
  var html = typeof res.data === 'string' ? res.data : String(res.data);
  var rd = extractRouterData(html);
  var groups = (rd && rd.loaderData && rd.loaderData.page && rd.loaderData.page.homeData
    && rd.loaderData.page.homeData.data && rd.loaderData.page.homeData.data.hot_list_groups) || null;
  if (!groups || !groups.length) throw new Error('SSR 热歌榜数据缺失（官网可能已改版）');
  topCache = { at: Date.now(), groups: groups };
  return groups;
}

// ==================== Impl 层 ====================

// ---- 搜索 ----
async function searchImpl(query, page, type) {
  // 协议：query 可能为对象 { keyword, type }（对齐酷我 v1.6.1 解包口径）
  var kw = query && typeof query === 'object' ? String(query.keyword || '').trim() : String(query || '').trim();
  if (!kw) return { isEnd: true, data: [] };
  if (type !== 'music') return { isEnd: true, data: [] }; // 平台仅歌曲搜索，其余类型如实返回空
  var p = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  var items = await apiSearch(kw, p);
  return { isEnd: items.length < SEARCH_PAGE_SIZE, data: items };
}

// ---- 取链：双通道竞速 + SSR 兜底 + 魔数校验 ----
function pickTier(tierMap, internal) {
  var hit = tierMap[internal];
  return hit || null;
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var bookId = String(musicItem.id);
  var duration = Number(musicItem.duration) || 0;
  var hostQuality = normalizeQuality(quality);
  var internals = HOST_TO_INTERNAL[hostQuality].slice();
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  resolveDeadlineAt = deadline; // 同步给 manifest 层 SSR 兜底共享

  // 取链策略（2026-09-09 沙箱实测）：
  //   ① LITE 主通道快速重试环：平台对 playerapi 存在随机灰度 403 "invalid aid" 抖动
  //      （同一可播歌曲 ~60% 请求 403，单次仅 ~100ms，重试即可命中），code=5000
  //      "internal error" 为内容级版权限制（可播内容从不返回 5000），立即终止不重试；
  //   ② 标准版通道一次兜底（该通道 aid=3040 当前全局 403，保留以备平台恢复）；
  //   ③ 全部失败 → 抛「通道波动」错误，由 manifest 层落 m 站 SSR 直链兜底。
  var tierMap = null, lastCode = null, copyrightErr = null;
  var retryDeadline = Date.now() + 3500; // 重试环软上限，留预算给魔数校验与 SSR 兜底
  for (var attempt = 0; attempt < 8 && !tierMap; attempt++) {
    try {
      tierMap = await apiVideoModel(HOST_LITE_B, bookId, liteParams, 'lite');
    } catch (e) {
      lastCode = e && e.code;
      if (lastCode === 5000) { copyrightErr = e; break; } // 版权/下架：重试无意义
      if (Date.now() > retryDeadline) break; // 403 抖动：软预算内重试
    }
  }
  if (!tierMap && !copyrightErr) {
    try { tierMap = await apiVideoModel(HOST_API_B, bookId, stdParams, 'std'); }
    catch (e2) { lastCode = (e2 && e2.code) || lastCode; }
  }
  if (!tierMap) {
    if (copyrightErr) { copyrightErr.fanqieCopyright = true; throw copyrightErr; }
    throw new Error('取链暂不可用（平台通道波动 code=' + lastCode + '），请稍后重试');
  }

  // 按候选序尝试内部档：命中即 Range 魔数校验（M4A ftyp），魔数不过视为该档不可用
  var lastErr = null;
  for (var i = 0; i < internals.length; i++) {
    if (Date.now() > deadline) break;
    var t = pickTier(tierMap, internals[i]);
    if (!t) continue;
    if (!MEDIA_URL_ALLOW_RE.test(t.url)) { lastErr = new Error('直链未通过官方 CDN 白名单校验'); continue; }
    var magic = await probeMediaMagic(t.url);
    if (!magic) { lastErr = new Error('音质档 ' + internals[i] + ' 魔数校验未通过'); continue; }
    return {
      url: t.url,
      quality: hostQuality, // [v1.1.0 P1-12] 补 quality（请求档）
      headers: { 'User-Agent': UA },
      actualQuality: honestQuality(internals[i], t.size, duration)
    };
  }
  throw lastErr || new Error('所有音质档均不可用');
}

// SSR 直链兜底（双通道全挂时）：m 站歌曲页 video_info.main_url，无 size 用 Range 总长估码率
async function ssrMediaFallback(bookId, duration) {
  var page = await fetchMSSRPage(bookId);
  var url = page.videoInfo.main_url || page.videoInfo.back_url;
  if (!url) throw new Error('SSR 兜底亦无直链');
  if (!MEDIA_URL_ALLOW_RE.test(url)) throw new Error('SSR 直链未通过官方 CDN 白名单校验');
  var probed = await axios.get(url, {
    timeout: RACE_TIMEOUT,
    headers: apiHeaders({ Range: 'bytes=0-15' }),
    responseType: 'arraybuffer'
  });
  var size = contentLengthOf(probed);
  // 无 size 信息时不做码率声明依据，按 higher 档保守标注 128k
  var aq = honestQuality('higher', size, duration);
  return { url: url, quality: '128k', headers: { 'User-Agent': UA }, actualQuality: aq }; // [v1.1.0 P1-12] 补 quality（SSR 兜底默认 higher 静态标 128k）
}

// ---- 歌词（m 站 SSR）----
// lyric_type=2 逐字格式转行级 LRC：
//   行格式 [起始ms,行时长ms]<偏移,字时长,0>字<...>字...
//   → [mm:ss.xxx]拼合文本（字偏移仅用于校验行首，行级时间戳取行起始）
function wordLineToLrcLine(line) {
  var head = /^\[(\d+),\d+\]/.exec(line);
  if (!head) return '';
  var text = line.replace(/^\[\d+,\d+\]/, '').replace(/<\d+,\d+(?:,[^>]*)?>/g, '').trim();
  if (!text) return '';
  var ms = parseInt(head[1], 10) || 0;
  var mm = Math.floor(ms / 60000);
  var ss = Math.floor((ms % 60000) / 1000);
  var mmm = ms % 1000;
  return '[' + mm + ':' + (ss < 10 ? '0' : '') + ss + '.' + (mmm < 10 ? '00' : (mmm < 100 ? '0' : '')) + mmm + ']' + text;
}

async function getLyricImpl(musicItem) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var page = await fetchMSSRPage(musicItem.id);
  if (page.lyricType === 1 && page.lyricInfo) return { rawLrc: page.lyricInfo };
  if (page.lyricType === 2 && page.lyricInfo) {
    var lines = page.lyricInfo.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var l = wordLineToLrcLine(lines[i]);
      if (l) out.push(l);
    }
    if (!out.length) throw new Error('逐字歌词转换结果为空');
    return { rawLrc: out.join('\n') };
  }
  // lyric_type=0：无词（纯音乐/版权未提供），如实报错不编造
  throw new Error('该曲目无歌词（lyric_type=0）');
}

// 逐字歌词（宿主 fork 扩展，返回原始逐字串，对齐 QQ v1.6.1 返回形态）
async function getWordByWordLyricImpl(musicItem) {
  if (!musicItem || !musicItem.id) throw new Error('missing musicItem.id');
  var page = await fetchMSSRPage(musicItem.id);
  if (page.lyricType === 2 && page.lyricInfo) return page.lyricInfo;
  throw new Error('该曲目无逐字歌词（lyric_type=' + page.lyricType + '）');
}

// ---- 榜单（官网 SSR 热歌榜）----
function topListItemOf(group) {
  var first = (group.hot_list && group.hot_list[0]) || {};
  var cover = first.audio_thumb_uri || '';
  return {
    id: 'fq-top-' + group.id,
    title: group.tab_name || '番茄热歌榜',
    description: '番茄音乐官方热歌榜 · 共 ' + (group.hot_list ? group.hot_list.length : 0) + ' 首 · 按播放量排序',
    artwork: cover,
    coverImg: cover // 宿主 ITopListItem 双写（对齐网易云 v1.6.0）
  };
}

function topMusicItemOf(song) {
  return {
    id: String(song.book_id),
    platform: 'fanqie', // [v1.1.0 P0-4] IMusicItem 缺 platform → 补
    title: stripEm(song.book_name) || '未知曲目',
    artist: song.author || '未知歌手',
    album: song.album_title || undefined,
    artwork: song.audio_thumb_uri || undefined,
    version: song.singing_version_name || undefined,
    qualities: ['128k', '320k', 'flac'], // [v1.1.0 P0-5] 同 apiSearch 一致
    fee: 0, // [v1.1.0 P0-6] 同 apiSearch
    alias: undefined // [v1.1.0 P0-7] 同 apiSearch
  };
}

async function getTopListsImpl() {
  var groups = await fetchTopGroups();
  var out = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (!g || !g.hot_list || !g.hot_list.length) continue;
    out.push({ title: '番茄官方榜', data: [topListItemOf(g)] });
  }
  if (!out.length) throw new Error('热歌榜数据为空');
  return out;
}

async function getTopListDetailImpl(topListItem, page) {
  if (!topListItem || !topListItem.id) throw new Error('missing topListItem.id');
  var p = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  var groups = await fetchTopGroups();
  var gid = String(topListItem.id).replace(/^fq-top-/, '');
  var target = null;
  for (var i = 0; i < groups.length; i++) {
    if (String(groups[i] && groups[i].id) === gid) { target = groups[i]; break; }
  }
  if (!target) throw new Error('榜单不存在或已下线');
  var list = target.hot_list || [];
  var start = (p - 1) * TOP_LIST_PAGE_SIZE;
  var musicList = [];
  for (var j = start; j < Math.min(start + TOP_LIST_PAGE_SIZE, list.length); j++) {
    musicList.push(topMusicItemOf(list[j]));
  }
  // [v1.1.0 P1-13] 回传 topListItem，宿主榜单 UI 用其 title 渲染头部
  return {
    isEnd: start + TOP_LIST_PAGE_SIZE >= list.length,
    topListItem: topListItemOf(target), // 复用入参构造函数（cover/title/description 一致）
    musicList: musicList
  };
}

// ---- 基础信息 ----
// 歌曲详情补全（克隆体上工作，冻结安全）
async function getMusicInfoImpl(musicItem) {
  if (!musicItem || !musicItem.id) return musicItem;
  var mi = cloneItem(musicItem);
  try {
    var d = await apiDetail(mi.id);
    if (!mi.album && d.common_book_info && d.common_book_info.album_title) mi.album = d.common_book_info.album_title;
    if (!mi.artwork && d.thumb_url) mi.artwork = d.thumb_url;
    if (!mi.artwork && d.thumb_url_map_v2 && d.thumb_url_map_v2.large_thumb_url) mi.artwork = d.thumb_url_map_v2.large_thumb_url;
    if (!mi.duration && d.audio_duration) {
      var dur = Number(d.audio_duration);
      if (dur > 0) mi.duration = Math.round(dur);
    }
    if (!mi.artist && d.author_infos && d.author_infos.length && d.author_infos[0].name) mi.artist = d.author_infos[0].name;
  } catch (e) { /* 详情可选，失败返回原条目 */ }
  return mi;
}

function getMusicDetailPageUrlImpl(musicItem) {
  if (!musicItem || !musicItem.id) return '';
  return HOST_M_SITE + '/music/' + String(musicItem.id);
}

// 单曲导入：m 站歌曲页 URL 或裸 book_id
async function importMusicItemImpl(urlLike) {
  var s = String(urlLike || '').trim();
  var m = /music\/(\d+)/.exec(s);
  if (!m) m = /^(\d{15,25})$/.exec(s);
  if (!m) throw new Error('无法识别的链接，支持 m.novelfm.com/music/<id> 或裸 book_id');
  var bookId = m[1];
  var page = await fetchMSSRPage(bookId);
  var bi = page.bookInfo || {};
  if (!bi.book_id && !bi.book_name) throw new Error('导入失败：页面无曲目信息');
  return {
    id: String(bi.book_id || bookId),
    platform: 'fanqie', // [v1.1.0 P0-4] IMusicItem 缺 platform → 补
    title: bi.book_name || '未知曲目',
    artist: bi.author || '未知歌手',
    album: bi.album_title || undefined,
    artwork: bi.thumb_url || undefined,
    duration: Number(bi.audio_duration) > 0 ? Math.round(Number(bi.audio_duration)) : undefined,
    qualities: ['128k', '320k', 'flac'], // [v1.1.0 P0-5] 同 apiSearch
    fee: 0, // [v1.1.0 P0-6] 同 apiSearch
    alias: undefined // [v1.1.0 P0-7] 同 apiSearch
  };
}

// ==================== [v1.1.0 P1-14] 不支持方法 stub ====================
// 平台无公开接口（专辑/歌手/歌单/评论），按契约声明 stub 函数避免宿主「方法缺失」警告；
// 实现统一抛「平台未支持」错误——宿主包装层识别后会提示用户而非闪退。
function getAlbumInfoImpl(_albumItem) { return Promise.reject(new Error('番茄音乐无专辑详情接口（平台未提供）')); }
function getMusicSheetInfoImpl(_sheetItem, _page) { return Promise.reject(new Error('番茄音乐无歌单详情接口（平台未提供）')); }
function getArtistWorksImpl(_artistItem, _page) { return Promise.reject(new Error('番茄音乐无歌手作品接口（平台未提供）')); }
function importMusicSheetImpl(_urlLike) { return Promise.reject(new Error('番茄音乐无歌单导入接口（平台未提供）')); }
function getMusicCommentsImpl(_musicItem, _page) { return Promise.reject(new Error('番茄音乐无评论接口（平台未提供）')); }

// ==================== 插件定义 ====================

var plugin = {
  name: '番茄畅听',
  platform: 'fanqie',
  version: '1.1.0', // [v1.1.0] P0-4/5/6/7 + P1-12/13/14 全量修复
  author: '研发2号',
  description: '番茄音乐（NovelFM）独立源插件（v1.1.0）：在 v1.0.0 基础上按 MusicFree v1.0.0 宿主契约全量参数对齐——补 IMusicItem.platform/qualities/fee/alias（apiSearch/topMusicItemOf/importMusicItem 共 3 构造位点）、getMediaSource 双通道与 SSR 兜底均补 quality 字段、getTopListDetail 补 topListItem 回传、补 5 个不支持方法的 stub（getAlbumInfo/getMusicSheetInfo/getArtistWorks/importMusicSheet/getMusicComments）。其余功能（搜索/取链/详情/导入/歌词/榜单）与 v1.0.0 一致。',
  supportedSearchType: ['music'], // 平台仅歌曲搜索（专辑/歌手/歌单无公开接口，宁缺毋滥）
  defaultSearchType: 'music',
  primaryKey: ['id'], // 对齐酷我/网易云/咪咕：book_id 即唯一标识
  // 档位声明（不虚标）：higher 实测≈129kbps→128k；highest 实测≈254kbps→320k；
  // lossless 仅部分内容有档；medium（≈66k）仅作内部兜底不对外声明。
  // 版权内容无任何档可取，播放时明确报「平台限制播放」。
  supportedQualities: ['128k', '320k', 'flac'],
  // [v1.1.0 P1-14] 番茄为音频源不提供视频流；空集避免宿主把 supportedQualities 误作视频档
  supportedVideoQualities: [],
  cacheControl: 'no-store', // 直链含签名且 24h 过期（文档 §10-7），必须现取
  userVariables: [], // 全链路免登录（文档 §11.2 关键发现 1），无需用户配置
  hints: {
    search: ['搜索番茄音乐（NovelFM）曲库，20 条/页', '版权曲目（如周杰伦）可搜索展示，但播放受平台限制', '音质档位按内容实际支持情况回落，播放器标注为实际命中档'],
    importMusicItem: ['支持番茄音乐 H5 歌曲页链接，如 https://m.novelfm.com/music/7565796622534183961', '也支持直接粘贴纯数字 book_id']
  },

  async search(query, page, type) {
    return searchImpl(query, page, type);
  },

  async getMediaSource(musicItem, quality) {
    // 双通道竞速失败时按错误类型分流：版权限制（code=5000）直接透传友好错误；
    // 其余失败在预算内落一次 m 站 SSR 直链兜底（10min 缓存复用），兜底也挂则抛原始错误
    var r = null, origErr = null;
    try {
      r = await getMediaSourceImpl(musicItem, quality);
    } catch (e) {
      origErr = e;
    }
    if (r) return r;
    if (origErr && origErr.fanqieCopyright) throw origErr; // 版权/下架内容：SSR 页同样无直链，不浪费一次请求
    if (musicItem && musicItem.id && Date.now() < RESOLVE_DEADLINE()) {
      try {
        return await ssrMediaFallback(String(musicItem.id), Number(musicItem.duration) || 0);
      } catch (e) { /* 兜底失败，抛原始错误 */ }
    }
    throw origErr || new Error('所有取链通道均不可用');
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // [v1.1.0 P1-14] 5 个不支持方法 stub
  getAlbumInfo: getAlbumInfoImpl,
  getMusicSheetInfo: getMusicSheetInfoImpl,
  getArtistWorks: getArtistWorksImpl,
  importMusicSheet: importMusicSheetImpl,
  getMusicComments: getMusicCommentsImpl
};

// SSR 兜底整合说明：getMediaSourceImpl 双通道全挂抛错后，manifest 层落 SSR 兜底，
// 预算外仅一次 m 站请求（10min 缓存内复用），不逼近宿主 10s 硬上限。

// ==================== 自测出口（不影响运行时） ====================
var _internal = {
  stdParams: stdParams,
  liteParams: liteParams,
  normalizeQuality: normalizeQuality,
  honestQuality: honestQuality,
  probeMediaMagic: probeMediaMagic,
  apiSearch: apiSearch,
  apiDetail: apiDetail,
  apiVideoModel: apiVideoModel,
  fetchMSSRPage: fetchMSSRPage,
  fetchTopGroups: fetchTopGroups,
  searchImpl: searchImpl,
  getMediaSourceImpl: getMediaSourceImpl,
  ssrMediaFallback: ssrMediaFallback,
  getLyricImpl: getLyricImpl,
  getWordByWordLyricImpl: getWordByWordLyricImpl,
  getTopListsImpl: getTopListsImpl,
  getTopListDetailImpl: getTopListDetailImpl,
  getMusicInfoImpl: getMusicInfoImpl,
  getMusicDetailPageUrlImpl: getMusicDetailPageUrlImpl,
  importMusicItemImpl: importMusicItemImpl,
  wordLineToLrcLine: wordLineToLrcLine,
  extractRouterData: extractRouterData,
  MEDIA_URL_ALLOW_RE: MEDIA_URL_ALLOW_RE
};
for (var k2 in _internal) { plugin._internal = plugin._internal || {}; plugin._internal[k2] = _internal[k2]; }

module.exports = plugin;
