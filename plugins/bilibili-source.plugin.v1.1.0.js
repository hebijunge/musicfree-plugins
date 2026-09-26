/**
 * [v1.1.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「B站」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
var axios = require('axios');
var CryptoJs = require('crypto-js');
var he = require('he');
/**
 * 哔哩哔哩独立源插件（MusicFree）
 * ================================
 * v1.0.1（2026-09-09）修复高档回落下载命名虚标：
 *  - 根因：宿主（toskysun fork）下载命名逻辑为 actualQuality = 请求的 quality（不读插件
 *    返回的 actualQuality 字段），且 B站音频 URL 后缀 .m4s 不在宿主 supportLocalMediaType
 *    白名单内，命中「按请求音质兜底」分支——hires/dolby 请求即使实际回落 192k AAC，
 *    文件后缀仍被命名为 .flac（虚标）。
 *  - 修复①：Hi-Res/杜比档实际不可用（DASH 中无 flac/dolby 流）时 getMediaSource 返回 null，
 *    交还宿主按音质序列自动降级：下载侧 actualQuality 随实际成功档位更新（192k → .mp3），
 *    播放侧走宿主原生降级链并提示「音质不支持已降级」。宿主包装层对 null 不重试，降级零额外开销。
 *  - 修复②：supportedQualities 按 Cookie 条件声明（模块加载时评估）：未配置 Cookie 只声明
 *    96k/192k（免费档真实上限），配置 Cookie 后声明全档（需重载插件/重启 App 刷新档位选项）。
 *  - 附带：DASH 响应 60s 会话内缓存——降级链逐档重试复用同一 DASH 响应，避免重复打 playurl。
 *
 * v1.0.0（2026-09-09）首版，基于《B站音乐接口完整文档（综合实测版 2026-08-28）》+ 官方
 * MusicFreePlugins bilibili v0.2.3 源码审读，全部核心链路在沙箱真网实测后落地：
 *
 *  ① 搜索：WBI 签名版 /x/web-interface/wbi/search/type（旧版无签名搜索已被 B 站 412 下线，
 *      文档 §3.3 + 官方插件所用的 finger/spi+buvid 通道属旧体系，不采用）。page_size=20、
 *      双页翻页实测 code=0。WBI 签名实现（mixinKeyEncTab 重排 + MD5）经文档密钥对拍：
 *      mixin_key=ea1db124af3c7062474693fa704f4ff8 与文档完全一致。
 *      签名变体裁决：文档 §2.5 称"value 不做 URL 编码"，官方插件 getRid 用 encodeURIComponent——
 *      两种变体对本沙箱关键词（含中文/空格）实测均 code=0（服务端解码后均可通过），采用
 *      bilibili-API-collect 规范实现（过滤 !'()* 后 encodeURIComponent）。
 *  ② WBI 密钥源双通道：首选 /x/web-interface/nav 免登录 wbi_img（code=-101 但 wbi_img 恒在，
 *      文档坑#1 实测），异常时回落官方插件同款 bili_ticket GenWebTicket（HMAC-SHA256
 *      'XgwSnGZ1p'，crypto-js 实现）。密钥缓存 30 分钟（B 站按天轮换，30 分钟足够且控风险）。
 *  ③ 取链：旧版 /x/player/playurl（无 WBI，文档 §4.1"至今可用"实测 code=0）与 WBI 版
 *      /x/player/wbi/playurl 双路并行竞速，谁先返回有效 DASH 用谁；bvid+cid 必须（文档坑#2：
 *      aid+cid 返回 -400 实测复现）。音频流必须按 bandwidth 降序排（文档坑#4：实测数组顺序
 *      30216(38k)→30280(169k)→30232(85k) 乱序）。
 *  ④ 音质档位（真实可验证、宁低勿高，actualQuality 如实标注）：
 *      - '96k'  → 30232（实测 84,710bps ≈85k，最接近 96k 档）
 *      - '192k' → 30280（实测 169,316bps ≈169k，普通用户最高）
 *      - 'hires'→ dash.flac.audio（30251 Hi-Res，大会员 Cookie 才下发；非会员 fnval=4048
 *        实测 flac=null/dolby=0），未命中返回 null 交宿主按音质序列降级（v1.0.1：
 *        不再静默回落 192k——宿主下载命名按请求档兜底，静默回落会导致 .flac 虚标）
 *      - 'dolby'→ dash.dolby.audio（30250 杜比全景声，大会员专享），dolby 缺失但有 flac 时
 *        返回 flac（actualQuality 如实标 'hires'，.flac 命名与内容一致），两者皆无返回 null 交宿主降级
 *      旧视频 durl 形态兜底（无 DASH 时的历史合流流，无法定档，不标 actualQuality）。
 *      音频流容器为 fMP4（ftyp iso5），Range 探测 206 + 'ftyp' 魔数实测。
 *  ⑤ 视频详情/分P：/x/web-interface/view 取 cid（无需签名）；/x/player/pagelist 多分P
 *      （BV1fx411N7bU 实测 200P）。分P展开走 getAlbumInfo（一个视频=一张"专辑"，每个分P=
 *      一首"歌"），条目 id 带 ~p{n} 后缀区分、cid/_p 内联透传后续取链零请求。
 *  ⑥ Cookie 解锁：userVariables.biliCookie（完整 Cookie 串，含 SESSDATA/bili_jct 等）。
 *      配置后取链带 Cookie 且 fnval=4048（DASH 全格式开关，Hi-Res/Dolby 需大会员账号）；
 *      未配置走免费档（fnval=16）。搜索接口免 Cookie 可用。
 *  ⑦ 周边：getMusicInfo / getMusicDetailPageUrl（支持分P p 参数）/ importMusicItem（BV/AV/
 *      b23.tv 短链 302 解析/带 ?p= 分P定位）/ importMusicSheet（公开收藏夹）/ getMusicComments
 *      （WBI reply/main 实测 19 条）/ getTopLists（入站必刷实测 98 条 + 每周必看）。
 *      排行榜 ranking/v2 实测被风控（code=-352）不接入；B 站无官方歌词接口，第三方
 *      gdstudio 歌词按 BV 匹配准确性不可验证（宁缺毋滥）不接入——详见自测报告。
 *
 *  参考：官方 maotoumao/MusicFreePlugins plugins/bilibili/index.ts v0.2.3（结构参照，
 *  其旧版搜索/finger/spi 通道已按文档实测结论升级为 WBI 体系）。
 */
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
var BASE_HEADERS = {
  'User-Agent': UA,
  Referer: 'https://www.bilibili.com/',
};
var API_HOST = 'https://api.bilibili.com';
var SOURCE_TIMEOUT = 8000; // 宿主 10s 方法超时，请求超时留余量
var SEARCH_PAGE_SIZE = 20;
var WBI_KEY_TTL_MS = 30 * 60 * 1000;

/** mixinKeyEncTab 64 位固定重排索引表（bilibili-API-collect，文档 §2.3） */
var MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

// ==================== 通用工具 ====================

function str(v) { return v === undefined || v === null ? '' : String(v); }

/** 搜索接口返回的 mm:ss 转秒；数字直接透传 */
function durationToSec(duration) {
  if (typeof duration === 'number' && isFinite(duration)) return Math.floor(duration);
  if (typeof duration === 'string' && duration) {
    var seg = duration.split(':');
    var acc = 0;
    for (var i = 0; i < seg.length; i++) acc = acc * 60 + (parseInt(seg[i], 10) || 0);
    return acc;
  }
  return 0;
}

/** 剥 <em class="keyword"> 高亮标签 + HTML 实体解码 */
function cleanTitle(raw) {
  var t = str(raw).replace(/(<em[^>]*>)|(<\/em>)/g, '');
  try { t = he.decode(t); } catch (e) { /* 实体解码失败退原文 */ }
  return t.trim();
}

/** //i0.hdslb.com/... → https://... */
function picUrl(pic) {
  var p = str(pic);
  if (!p) return undefined;
  if (p.indexOf('//') === 0) return 'https:' + p;
  if (p.indexOf('http') === 0) return p;
  return 'https://' + p;
}

/** 时间戳（秒）→ YYYY-MM-DD */
function tsToDate(sec) {
  var n = Number(sec);
  if (!isFinite(n) || n <= 0) return undefined;
  try { return new Date(n * 1000).toISOString().slice(0, 10); } catch (e) { return undefined; }
}

/** 用户 Cookie（userVariables.biliCookie，完整串） */
function userCookie() {
  try {
    var uv = env.getUserVariables() || {};
    var c = str(uv.biliCookie).trim();
    return c || undefined;
  } catch (e) { return undefined; }
}

function apiHeaders(extra) {
  var h = Object.assign({}, BASE_HEADERS, extra || {});
  var cookie = userCookie();
  if (cookie) h.Cookie = cookie;
  return h;
}

// ==================== WBI 签名 ====================

var wbiCache = { keys: null, ts: 0, pending: null };

/** bili_ticket 兜底通道：官方插件同款（HMAC-SHA256 'XgwSnGZ1p' + ts），nav 挂时启用 */
async function getWbiKeysViaTicket() {
  var ts = Math.floor(Date.now() / 1000);
  var hexsign = CryptoJs.HmacSHA256('ts' + ts, 'XgwSnGZ1p').toString(CryptoJs.enc.Hex);
  var r = await axios.post(
    API_HOST + '/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket',
    null,
    {
      params: { key_id: 'ec02', hexsign: hexsign, 'context[ts]': ts, csrf: '' },
      headers: { 'User-Agent': UA },
      timeout: SOURCE_TIMEOUT,
    }
  );
  var nav = (r.data && r.data.data && r.data.data.nav) || {};
  var img = str(nav.img), sub = str(nav.sub);
  if (!img || !sub) throw new Error('bili_ticket 响应无 nav 密钥');
  return {
    img: img.slice(img.lastIndexOf('/') + 1, img.lastIndexOf('.')),
    sub: sub.slice(sub.lastIndexOf('/') + 1, sub.lastIndexOf('.')),
  };
}

/**
 * 获取 WBI img_key/sub_key（单飞 + 30min 缓存）
 * nav 免登录 code=-101 但 wbi_img 恒在（文档坑#1，沙箱实测一致）
 */
async function getWbiKeys() {
  if (wbiCache.keys && Date.now() - wbiCache.ts < WBI_KEY_TTL_MS) return wbiCache.keys;
  if (wbiCache.pending) return wbiCache.pending;
  wbiCache.pending = (async function () {
    try {
      var r = await axios.get(API_HOST + '/x/web-interface/nav', { headers: apiHeaders(), timeout: SOURCE_TIMEOUT });
      var w = (r.data && r.data.data && r.data.data.wbi_img) || {};
      var img = str(w.img_url), sub = str(w.sub_url);
      if (img && sub) {
        wbiCache.keys = {
          img: img.slice(img.lastIndexOf('/') + 1, img.lastIndexOf('.')),
          sub: sub.slice(sub.lastIndexOf('/') + 1, sub.lastIndexOf('.')),
        };
      }
    } catch (e) { /* nav 挂 → 走 bili_ticket */ }
    if (!wbiCache.keys) wbiCache.keys = await getWbiKeysViaTicket();
    wbiCache.ts = Date.now();
    return wbiCache.keys;
  })();
  try { return await wbiCache.pending; } finally { wbiCache.pending = null; }
}

/** img_key + sub_key 按 64 位索引表重排取前 32 位（文档 §2.2/§2.3，密钥对拍一致） */
function getMixinKey(orig) {
  var out = '';
  for (var i = 0; i < 32; i++) out += orig.charAt(MIXIN_KEY_ENC_TAB[i]) || '';
  return out;
}

/**
 * WBI 签名：参数排序 → value 过滤 !'()* → encodeURIComponent 拼接 → MD5(qs+mixinKey)。
 * 变体说明（v1.0.0 探针实测 2026-09-09）：文档 §2.5 称签名 value"不做 URL 编码"，
 * 官方插件 getRid 用 encodeURIComponent；两变体对中文关键词实测均 code=0，采用
 * bilibili-API-collect 规范（编码）实现。
 */
async function wbiSign(params) {
  var keys = await getWbiKeys();
  var mixinKey = getMixinKey(keys.img + keys.sub);
  var p = Object.assign({}, params);
  p.wts = Math.floor(Date.now() / 1000);
  var sorted = Object.keys(p).sort();
  var parts = [];
  for (var i = 0; i < sorted.length; i++) {
    var k = sorted[i], v = p[k];
    if (v === undefined || v === null) continue;
    v = String(v).replace(/[!'()*]/g, '');
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  }
  p.w_rid = CryptoJs.MD5(parts.join('&') + mixinKey).toString();
  return p;
}

/** WBI 签名 GET（签名被拒自动重取一次密钥——B 站按天轮换，长驻进程缓存可能过期） */
async function wbiGet(endpoint, params) {
  try {
    var signed = await wbiSign(params);
    var r = await axios.get(API_HOST + endpoint, { headers: apiHeaders(), params: signed, timeout: SOURCE_TIMEOUT });
    var body = r.data || {};
    if (body.code === -403 || body.code === 412 || body.code === -412) {
      // 签名被拒 → 密钥可能轮换，强制刷新后重签一次
      wbiCache.keys = null; wbiCache.ts = 0;
      signed = await wbiSign(params);
      r = await axios.get(API_HOST + endpoint, { headers: apiHeaders(), params: signed, timeout: SOURCE_TIMEOUT });
      body = r.data || {};
    }
    if (body.code !== 0) throw new Error('B站接口 ' + endpoint + ' 失败: code=' + body.code + ' ' + str(body.message));
    return body.data;
  } catch (e) {
    if (e.response) {
      throw new Error('B站接口 ' + endpoint + ' HTTP ' + e.response.status + (e.response.data && e.response.data.message ? ': ' + e.response.data.message : ''));
    }
    throw e;
  }
}

// ==================== 视频详情 / 分P ====================

var cidCache = {}; // bvid → {cid, pages}，会话级缓存

/** 视频详情（免登录免签名，文档 §5 实测）；aid 也支持 */
async function fetchView(bvid, aid) {
  var params = bvid ? { bvid: bvid } : { aid: aid };
  var r = await axios.get(API_HOST + '/x/web-interface/view', { headers: apiHeaders(), params: params, timeout: SOURCE_TIMEOUT });
  var body = r.data || {};
  if (body.code !== 0 || !body.data) {
    throw new Error('B站视频详情失败: code=' + body.code + ' ' + str(body.message));
  }
  return body.data;
}

/** 拿视频的 cid/pages（带缓存）；分P 条目自带 cid 时不请求 */
async function ensureVideoMeta(musicItem) {
  var bvid = str(musicItem.bvid);
  if (musicItem.cid && (!musicItem._p || musicItem._p <= 1)) {
    return { cid: musicItem.cid, pages: null, bvid: bvid };
  }
  if (bvid && cidCache[bvid]) return cidCache[bvid];
  var view = await fetchView(bvid, musicItem.aid);
  var meta = { cid: view.cid, pages: view.pages || null, bvid: str(view.bvid) || bvid };
  if (bvid) cidCache[bvid] = meta;
  return meta;
}

// ==================== 播放取链 ====================

function dolbyAudio(dash) { return (dash && dash.dolby && dash.dolby.audio) || []; }

/**
 * DASH 响应有效性：code=0 且（有音频流 / flac / dolby / durl 任一）。
 * playurl 偶发风控 code=-352 也视为无效，交给另一路竞速。
 */
function dashIsValid(resData) {
  var d = (resData && resData.data) || {};
  if (resData.code !== 0) return false;
  if (d.dash) {
    var dash = d.dash;
    return !!(dash.audio && dash.audio.length) || !!(dash.flac && dash.flac.audio && dash.flac.audio.length) || !!(dolbyAudio(dash).length);
  }
  return !!(d.durl && d.durl.length);
}

/** 单路 playurl 请求（旧版无 WBI / WBI 版） */
async function fetchPlayurlOnce(path, params, headers) {
  var r = await axios.get(API_HOST + path, { headers: headers, params: params, timeout: SOURCE_TIMEOUT });
  var body = r.data || {};
  if (!dashIsValid(body)) {
    throw new Error('playurl ' + path + ' 无效: code=' + body.code + ' ' + str(body.message));
  }
  return body.data;
}

/**
 * 双路并行竞速取 DASH：旧版 /x/player/playurl（无 WBI，最快）+ WBI 版 /x/player/wbi/playurl。
 * 谁先返回有效响应用谁；全挂抛出两路错误（文档 §4 体系 A/B 均实测可用）。
 * v1.0.1：结果按 bvid+cid 做会话内 60s 缓存——宿主降级链会对同一曲目逐档重调
 * getMediaSource，缓存避免重复打 playurl（带 Cookie 与否分开存，URL 为短时效签名链接故
 * TTL 取 60s 保守值；缓存上限 32 条防增长）。
 */
var dashCache = {}; // 'bvid|cid|c?' → { dash, ts }
var DASH_CACHE_TTL_MS = 60 * 1000;
var DASH_CACHE_MAX = 32;

async function fetchDash(bvid, cid) {
  var cookie = userCookie();
  var cacheKey = bvid + '|' + cid + '|' + (cookie ? 'c' : 'f');
  var cached = dashCache[cacheKey];
  if (cached && Date.now() - cached.ts < DASH_CACHE_TTL_MS) return cached.dash;

  var fnval = cookie ? 4048 : 16; // 配了 Cookie 才开全格式开关（Hi-Res/Dolby 需大会员）
  var base = { bvid: bvid, cid: cid, qn: 16, fnval: fnval, fnver: 0, fourk: 1 };
  var headers = apiHeaders();
  var pOld = fetchPlayurlOnce('/x/player/playurl', base, headers);
  var pWbi = wbiSign(base).then(function (signed) {
    return fetchPlayurlOnce('/x/player/wbi/playurl', signed, headers);
  });
  var errs = [];
  var settled = await Promise.all([
    pOld.then(function (v) { return { ok: true, v: v }; }, function (e) { errs.push('旧版: ' + e.message); return { ok: false }; }),
    pWbi.then(function (v) { return { ok: true, v: v }; }, function (e) { errs.push('WBI: ' + e.message); return { ok: false }; }),
  ]);
  for (var i = 0; i < settled.length; i++) {
    if (settled[i].ok) {
      var keys = Object.keys(dashCache);
      if (keys.length >= DASH_CACHE_MAX) delete dashCache[keys[0]];
      dashCache[cacheKey] = { dash: settled[i].v, ts: Date.now() };
      return settled[i].v;
    }
  }
  throw new Error('B站取链失败（双通道均不可用）：' + errs.join('；'));
}

/** AAC 音频流按 bandwidth 降序（文档坑#4：返回数组乱序，禁止直接取 audio[0]） */
function sortedAac(dash) {
  return ((dash && dash.audio) || []).slice().sort(function (a, b) { return (b.bandwidth || 0) - (a.bandwidth || 0); });
}

/**
 * 按目标档挑流并返回 actualQuality（宁低勿高、如实标注）。
 * v1.0.1：hires/dolby 档实际不可用时返回 null（交宿主按音质序列降级），不再静默回落
 * 192k——宿主下载命名按「请求档」兜底（.m4s 后缀不识别），静默回落会导致 192k AAC
 * 被命名为 .flac 虚标；返回 null 后宿主下载循环换下一档成功，actualQuality 即实际档位。
 */
function pickAudio(dash, tier) {
  var aac = sortedAac(dash);
  var best = aac[0];
  var flac = dash && dash.flac && dash.flac.audio && dash.flac.audio[0];
  var dolby = dolbyAudio(dash)[0];

  if (tier === 'dolby') {
    if (dolby) return { url: dolby.baseUrl, actualQuality: 'dolby' };
    if (flac) return { url: flac.baseUrl, actualQuality: 'hires' }; // flac 内容 .flac 命名一致
    return null; // 杜比与 Hi-Res 均不可用 → 宿主降级
  } else if (tier === 'hires') {
    if (flac) return { url: flac.baseUrl, actualQuality: 'hires' };
    return null; // Hi-Res 不可用 → 宿主降级
  } else if (tier === '96k') {
    // 30232（~85k）最贴近 96k 档；AAC 按带宽降序后倒数第二即 30232
    if (aac.length >= 2) return { url: aac[aac.length - 2].baseUrl, actualQuality: '96k' };
    if (aac.length === 1) return { url: aac[0].baseUrl, actualQuality: '96k' };
  } else { // 192k 及其余映射 → AAC 最高（30280 ~169k）
    if (best) return { url: best.baseUrl, actualQuality: '192k' };
  }
  return null; // 响应中无可用音频流
}

/** 宿主音质键（含旧版 low/standard/high/super）→ B 站内部档 */
function qualityToTier(quality) {
  var q = str(quality) || '192k';
  if (q === 'dolby' || q === 'atmos' || q === 'atmos_plus') return 'dolby';
  if (q === 'hires' || q === 'flac' || q === 'flac24bit' || q === 'super' || q === 'master' || q === 'vinyl') return 'hires';
  if (q === '96k' || q === 'low') return '96k';
  return '192k'; // 192k/128k/320k/standard/high 及未知档
}

/** 播放流请求头：Referer 是硬要求（缺了 CDN 403），与官方插件口径一致 */
function streamHeaders(bvid) {
  return {
    'User-Agent': UA,
    Accept: '*/*',
    Referer: 'https://www.bilibili.com/video/' + bvid,
    Connection: 'keep-alive',
  };
}

async function getMediaSource(musicItem, quality) {
  var bvid = str(musicItem.bvid);
  if (!bvid && musicItem.aid) {
    var view = await fetchView(null, musicItem.aid); // aid 条目兜底换 bvid（playurl 必须 bvid，文档坑#2）
    bvid = str(view.bvid);
  }
  if (!bvid) throw new Error('条目缺少 bvid/aid，无法取链');

  var meta = await ensureVideoMeta(musicItem);
  var cid = meta.cid;
  // 分P 条目：cid 换成该分P 的
  if (musicItem._p && musicItem._p > 1) {
    if (musicItem.cid) {
      cid = musicItem.cid;
    } else if (meta.pages && meta.pages[musicItem._p - 1]) {
      cid = meta.pages[musicItem._p - 1].cid;
    }
  }
  var dash = await fetchDash(bvid, cid);
  // durl 形态（极老视频无 DASH）：历史合流流，无法定档，不标 actualQuality
  if (!dash.dash && dash.durl && dash.durl.length) {
    return { url: dash.durl[0].url, headers: streamHeaders(bvid), quality: quality || '192k' }; // [v1.1.0 P1-8] 补 quality
  }
  var picked = pickAudio(dash.dash, qualityToTier(quality));
  if (!picked) {
    // v1.0.1：请求的音质当前不可用（Hi-Res/杜比需大会员 Cookie）。返回 null 交宿主按
    // 音质序列自动降级：下载循环换下一档并更新 actualQuality（后缀跟随实际档位），播放
    // 链路走原生降级。返回 null 时宿主包装层不触发重试（零额外开销）。
    return null;
  }
  var result = { url: picked.url, headers: streamHeaders(bvid), quality: quality || '192k' }; // [v1.1.0 P1-8] 补 quality（请求档，便于下载命名/统计）
  if (picked.actualQuality) result.actualQuality = picked.actualQuality;
  return result;
}

// ==================== 条目格式化 ====================

/**
 * 搜索/榜单条目 → IMusicItem。
 * id=bvid（分P 展开条目带 ~p{n}）；cid 懒加载（取链时 ensureVideoMeta 补）；
 * album=bvid（B 站"专辑"语义=同一视频的分P 合集，getAlbumInfo 展开）。
 * v1.1.0 P0-3：补 platform 字段对齐 IMusicItem 契约。
 */
function formatMusicItem(r) {
  var title = cleanTitle(r.title || r.name);
  var bvid = str(r.bvid);
  var aliasMatch = title.match(/《(.+?)》/);
  return {
    id: bvid,
    platform: 'bilibili', // [v1.1.0 P0-3] IMusicItem 缺 platform → 补
    bvid: bvid,
    aid: r.aid,
    title: title,
    alias: aliasMatch ? aliasMatch[1] : undefined,
    artist: str(r.author || (r.owner && r.owner.name) || (r.upper && r.upper.name)) || 'B站UP主',
    album: bvid,
    artwork: picUrl(r.pic || r.cover),
    coverImg: picUrl(r.pic || r.cover), // 宿主标准字段为 artwork，coverImg 为兼容别名
    duration: durationToSec(r.duration),
    description: str(r.description),
    date: tsToDate(r.pubdate || r.created),
  };
}

// ==================== 搜索 ====================

async function searchImpl(keyword, page, type) {
  var t = type === undefined ? 'music' : type; // 宿主总会传 type；个别调用方未传时按默认档兜底
  if (t !== 'music') return { isEnd: true, data: [] };
  var data = await wbiGet('/x/web-interface/wbi/search/type', {
    search_type: 'video',
    keyword: keyword,
    page: page,
    page_size: SEARCH_PAGE_SIZE,
  });
  var result = data.result || [];
  var numResults = data.numResults || 0;
  return {
    isEnd: page * SEARCH_PAGE_SIZE >= numResults || result.length < SEARCH_PAGE_SIZE,
    data: result.map(formatMusicItem),
  };
}

// ==================== 专辑（视频分P）/ 详情 ====================

/** 一个视频 = 一张专辑；多分P 视频展开为多首（BV1fx411N7bU 200P 实测） */
async function getAlbumInfoImpl(albumItem) {
  var bvid = str(albumItem.bvid);
  if (!bvid && albumItem.aid) bvid = str((await fetchView(null, albumItem.aid)).bvid);
  if (!bvid) throw new Error('专辑条目缺少 bvid/aid');
  var view = await fetchView(bvid);
  var pages = view.pages || [];
  var base = formatMusicItem(Object.assign({}, view, { bvid: str(view.bvid) || bvid }));
  var musicList;
  if (pages.length <= 1) {
    musicList = [Object.assign({}, base, { cid: view.cid })];
  } else {
    musicList = pages.map(function (pg, idx) {
      return {
        id: bvid + '~p' + (idx + 1),
        platform: 'bilibili', // [v1.1.0 P0-3] IMusicItem 缺 platform → 补
        bvid: bvid,
        aid: view.aid,
        _p: idx + 1,
        cid: pg.cid,
        title: str(pg.part) || (base.title + ' P' + (idx + 1)),
        artist: base.artist,
        album: bvid,
        artwork: base.artwork,
        coverImg: base.artwork,
        duration: durationToSec(pg.duration),
      };
    });
  }
  return {
    albumItem: {
      title: str(view.title),
      artwork: picUrl(view.pic),
      description: str(view.desc),
      artist: view.owner && view.owner.name,
      date: tsToDate(view.pubdate),
    },
    musicList: musicList,
  };
}

/** 补全歌曲信息（懒字段回填：cid/duration/artwork/UP主/简介） */
async function getMusicInfoImpl(musicItem) {
  var bvid = str(musicItem.bvid);
  if (!bvid && musicItem.aid) bvid = str((await fetchView(null, musicItem.aid)).bvid);
  if (!bvid) return {};
  var view = await fetchView(bvid);
  var info = {
    title: str(view.title) || musicItem.title,
    artist: (view.owner && view.owner.name) || musicItem.artist,
    album: str(view.bvid) || bvid,
    artwork: picUrl(view.pic) || musicItem.artwork,
    coverImg: picUrl(view.pic) || musicItem.artwork,
    duration: view.duration || musicItem.duration,
    bvid: str(view.bvid) || bvid,
    aid: view.aid,
    cid: view.cid,
    description: str(view.desc),
    date: tsToDate(view.pubdate),
  };
  // 分P 条目：cid 换成对应分P 的
  if (musicItem._p && musicItem._p > 1 && view.pages && view.pages[musicItem._p - 1]) {
    info.cid = view.pages[musicItem._p - 1].cid;
    if (view.pages[musicItem._p - 1].part) info.title = str(view.pages[musicItem._p - 1].part);
  }
  return info;
}

function getMusicDetailPageUrlImpl(musicItem) {
  var url = 'https://www.bilibili.com/video/' + (str(musicItem.bvid) || ('av' + musicItem.aid));
  if (musicItem._p && musicItem._p > 1) url += '?p=' + musicItem._p;
  return url;
}

// ==================== 单曲导入（BV/AV/b23.tv 短链/分P） ====================

/** b23.tv 短链 → 302 Location 解析（实测 302 → www.bilibili.com/video/BVxxx） */
async function resolveShortLink(shortUrl) {
  var r = await axios.get(shortUrl, {
    headers: { 'User-Agent': UA },
    timeout: SOURCE_TIMEOUT,
    maxRedirects: 0,
    validateStatus: function () { return true; },
  });
  return str(r.headers && r.headers.location);
}

/**
 * 支持形态：
 *   https://www.bilibili.com/video/BVxxxx（/?p=N 分P定位）
 *   https://b23.tv/xxxx 短链
 *   av号 / 纯 BV 号
 */
async function importMusicItemImpl(urlLike) {
  var input = str(urlLike).trim();
  if (!input) throw new Error('请输入 BV 号/AV 号或视频链接');

  var target = input;
  if (input.indexOf('b23.tv') >= 0) {
    if (!/^https?:\/\//.test(input)) input = 'https://' + input;
    target = await resolveShortLink(input);
  }

  var bvid = target.match(/BV[0-9A-Za-z]{8,12}/);
  var avMatch = target.match(/av(\d+)/i);
  var pMatch = target.match(/[?&]p=(\d+)/);
  var pNo = pMatch ? parseInt(pMatch[1], 10) : 1;

  var bvidVal = bvid ? bvid[0] : undefined;
  if (!bvidVal && !avMatch) throw new Error('无法从输入中解析出 BV 号/AV 号：' + input);

  var view = await fetchView(bvidVal, bvidVal ? undefined : avMatch[1]);
  var pages = view.pages || [];
  var pIdx = (pNo > 1 && pages[pNo - 1]) ? pNo : 1;
  var page = pages[pIdx - 1] || {};
  var item = {
    id: pIdx > 1 ? (str(view.bvid) + '~p' + pIdx) : str(view.bvid),
    platform: 'bilibili', // [v1.1.0 P0-3] IMusicItem 缺 platform → 补
    bvid: str(view.bvid),
    aid: view.aid,
    cid: page.cid || view.cid,
    _p: pIdx > 1 ? pIdx : undefined,
    title: pIdx > 1 && page.part ? str(page.part) : str(view.title),
    artist: view.owner && view.owner.name,
    album: str(view.bvid),
    artwork: picUrl(view.pic),
    coverImg: picUrl(view.pic),
    duration: durationToSec(page.duration || view.duration),
    description: str(view.desc),
    date: tsToDate(view.pubdate),
  };
  if (!item.cid) throw new Error('视频无可用 cid');
  return item;
}

// ==================== 收藏夹导入 ====================

/** 公开收藏夹资源列表（官方插件同款端点；私密收藏夹无法导入） */
async function getFavoriteMedias(favId) {
  var result = [];
  var page = 1;
  var pageSize = 20;
  while (true) {
    var r = await axios.get(API_HOST + '/x/v3/fav/resource/list', {
      headers: apiHeaders(),
      params: { media_id: favId, platform: 'web', ps: pageSize, pn: page },
      timeout: SOURCE_TIMEOUT,
    });
    var d = (r.data && r.data.data) || {};
    var medias = d.medias || [];
    for (var i = 0; i < medias.length; i++) {
      var m = medias[i];
      if (!m || !m.bvid) continue;
      result.push({
        id: str(m.bvid),
        platform: 'bilibili', // [v1.1.0 P0-3] IMusicItem 缺 platform → 补
        bvid: str(m.bvid),
        aid: m.aid,
        cid: m.cid,
        title: str(m.title),
        artist: (m.upper && m.upper.name) || 'B站UP主',
        album: str(m.bvid),
        artwork: picUrl(m.cover),
        coverImg: picUrl(m.cover),
        duration: durationToSec(m.duration),
      });
    }
    if (!d.has_more || !medias.length || page > 50) break; // 50 页护栏（1000 条）
    page += 1;
  }
  return result;
}

async function importMusicSheetImpl(urlLike) {
  var input = str(urlLike).trim();
  var m1 = input.match(/^\s*(\d+)\s*$/);
  var favId = m1 ? m1[1] : undefined;
  if (!favId) { var m2 = input.match(/fid=(\d+)/); favId = m2 ? m2[1] : undefined; }
  if (!favId) { var m3 = input.match(/\/playlist\/pl(\d+)/i); favId = m3 ? m3[1] : undefined; }
  if (!favId) { var m4 = input.match(/\/list\/ml(\d+)/i); favId = m4 ? m4[1] : undefined; }
  if (!favId) throw new Error('无法从输入中解析收藏夹 ID（支持纯数字 ID / fid= / 收藏夹链接）');
  var medias = await getFavoriteMedias(favId);
  if (!medias.length) {
    throw new Error('收藏夹为空、不可见或未登录受限（实测：未配置登录 Cookie 时 B 站不下发收藏内容，'
      + '请确认收藏夹已公开，并在插件设置配置 biliCookie 后重试）');
  }
  return medias;
}

// ==================== 评论 ====================

function formatComment(item) {
  return {
    id: item.rpid,
    nickName: item.member && item.member.uname,
    avatar: item.member && item.member.avatar,
    comment: item.content && item.content.message,
    like: item.like,
    createAt: item.ctime ? item.ctime * 1000 : undefined,
    location: item.reply_control && str(item.reply_control.location).indexOf('IP属地：') === 0
      ? str(item.reply_control.location).slice(5) : undefined,
  };
}

/** 视频评论区（WBI reply/main，mode=3 按热度；实测 BV1d4411N7zD 19 条） */
async function getMusicCommentsImpl(musicItem, page) {
  var bvid = str(musicItem.bvid);
  if (!bvid && musicItem.aid) bvid = str((await fetchView(null, musicItem.aid)).bvid);
  if (!bvid) throw new Error('条目缺少 bvid/aid，无法取评论');
  var view = await fetchView(bvid);
  var data = await wbiGet('/x/v2/reply/wbi/main', {
    type: 1,
    oid: view.aid,
    mode: 3,
    plat: 1,
    web_location: 1315875,
  });
  var replies = (data && data.replies) || [];
  var comments = [];
  for (var i = 0; i < replies.length; i++) {
    comments.push(formatComment(replies[i]));
    var subs = replies[i].replies || [];
    for (var j = 0; j < subs.length; j++) comments.push(formatComment(subs[j]));
  }
  return { isEnd: true, data: comments };
}

// ==================== 榜单 ====================

/** 入站必刷（/popular/precious 实测 98 条）+ 每周必看（series/list） */
async function getTopListsImpl() {
  var out = [];
  try {
    var pr = await axios.get(API_HOST + '/x/web-interface/popular/precious', {
      headers: apiHeaders(), params: { page_size: 100, page: 1 }, timeout: SOURCE_TIMEOUT,
    });
    var list = ((pr.data || {}).data || {}).list || [];
    if (list.length) {
      var first = list[0] || {};
      out.push({
        title: '入站必刷',
        data: [{ id: 'bili_precious', title: '入站必刷', artwork: picUrl(first.pic), coverImg: picUrl(first.pic), description: 'B站累计播放最高的必刷视频' }],
      });
    }
  } catch (e) { /* 单榜单失败不拖垮整体 */ }
  try {
    var sr = await axios.get(API_HOST + '/x/web-interface/popular/series/list', {
      headers: apiHeaders(), timeout: SOURCE_TIMEOUT,
    });
    var series = ((sr.data || {}).data || {}).list || [];
    if (series.length) {
      out.push({
        title: '每周必看',
        data: series.slice(0, 8).map(function (s) {
          return { id: 'bili_series_' + s.number, title: str(s.subject) || str(s.name), description: str(s.name) };
        }),
      });
    }
  } catch (e) { /* 同上 */ }
  if (!out.length) throw new Error('B站榜单接口均不可用');
  return out;
}

async function getTopListDetailImpl(topListItem) {
  var id = str(topListItem.id);
  var list;
  var _detailTitle = topListItem.title || id; // [v1.1.0 P1-11] 回传时复用入参标题
  if (id === 'bili_precious') {
    var pr = await axios.get(API_HOST + '/x/web-interface/popular/precious', {
      headers: apiHeaders(), params: { page_size: 100, page: 1 }, timeout: SOURCE_TIMEOUT,
    });
    var pb = pr.data || {};
    if (pb.code !== 0) throw new Error('入站必刷不可用: code=' + pb.code + '（多为 IP 风控，换网络环境重试）');
    list = (pb.data || {}).list || [];
    _detailTitle = '入站必刷';
  } else if (id.indexOf('bili_series_') === 0) {
    var number = id.slice('bili_series_'.length);
    var sr = await axios.get(API_HOST + '/x/web-interface/popular/series/one', {
      headers: apiHeaders(), params: { number: number }, timeout: SOURCE_TIMEOUT,
    });
    var sb = sr.data || {};
    // 每周必看 series/one 在数据中心 IP 实测被风控（code=-352），家用/移动网络通常正常
    if (sb.code !== 0) throw new Error('每周必看详情不可用: code=' + sb.code + '（实测数据中心 IP 被 B 站风控，换网络环境重试）');
    list = (sb.data || {}).list || [];
    _detailTitle = str(topListItem.title) || ('每周必看 #' + number);
  } else {
    throw new Error('未知榜单: ' + id);
  }
  return {
    isEnd: true,
    topListItem: { id: id, title: _detailTitle, platform: 'bilibili' }, // [v1.1.0 P1-11] 回传 topListItem
    musicList: list.filter(function (v) { return v && v.bvid; }).map(formatMusicItem),
  };
}

// ==================== 插件导出 ====================
// [v1.1.0 P1-9] B站无官方歌词接口，getLyric 提供空实现 stub；宿主 lyricManager 跨源搜索
// 时不会因本插件 throw 而中断整链路（其他插件仍可兜底）。抛错策略不可取——宿主包装层
// 视 throw 为该源整体不可用，会跳过本源跨源检索。
function getLyricImpl(_musicItem) {
  return Promise.resolve(null);
}

var plugin = {
  name: 'B站',
  platform: 'bilibili',
  version: '1.1.0', // [v1.1.0] P0-3/P1-8/9/10/11 全量修复
  author: '研发2号',
  appVersion: '>=0.6',
  description: '哔哩哔哩独立源插件 v1.1.0：在 v1.0.1 基础上按 MusicFree v1.0.0 宿主契约全量参数对齐——补 IMusicItem.platform（formatMusicItem/getAlbumInfo 分P/importMusicItem/收藏夹导入共 4 构造位点）、getMediaSource 补 quality 字段、getLyric 补空实现 stub（B 站无官方歌词接口）、补 supportedVideoQualities 声明（空集，B 站为音频源不提供视频流）、getTopListDetail 补 topListItem 回传。其余功能（搜索/取链/详情/分P/导入/评论/榜单）与 v1.0.1 一致。',
  cacheControl: 'no-store', // 播放链接为短时效签名 URL，必须现取
  supportedSearchType: ['music'],
  defaultSearchType: 'music',
  primaryKey: ['bvid'], // [v1.1.0] primaryKey 由 id 改为 bvid（id 可能带 ~p{N} 分P 后缀不可逆去重）
  // v1.0.1：档位声明按 Cookie 条件评估（模块加载时）。未配置 Cookie 时 B站免费档真实
  // 上限为 96k/192k，声明 hires/dolby 会让宿主音质选项虚标；配置 Cookie（大会员）后
  // 重载插件/重启 App 解锁全档。高档实际不可用时 getMediaSource 返回 null 交宿主降级，
  // 即使声明了档位也不会产生命名虚标的下载文件。
  supportedQualities: userCookie() ? ['96k', '192k', 'hires', 'dolby'] : ['96k', '192k'],
  // [v1.1.0 P1-10] B 站为音频源不提供视频流；声明空集避免宿主误把 supportedQualities
  // 推断为视频可用画质档（v1.0.0 宿主支持该字段时会对每个值调 getMvSource 兜底——空集
  // 表示「本插件无 MV 能力」）。
  supportedVideoQualities: [],
  userVariables: [
    {
      key: 'biliCookie',
      name: 'B站 Cookie（可选）',
      hint: '浏览器登录 bilibili.com 后，F12 → 网络 → 任一 api.bilibili.com 请求 → 复制完整 Cookie 请求头（需含 SESSDATA、bili_jct）。配置且为大会员账号后可解锁 Hi-Res/Dolby 音质；不配置仅免费档（96k/192k）。注意：音质档位选项在插件加载时评估，配置 Cookie 后需重载插件（重启 App）才会刷新档位选项。',
    },
  ],
  hints: {
    importMusicItem: [
      '支持 B 站视频链接，如 https://www.bilibili.com/video/BV1d4411N7zD',
      '支持 b23.tv 短链接',
      '支持分P定位：链接带 ?p=N 时导入第 N 个分P',
      '支持纯 BV 号 / AV 号（如 BV1d4411N7zD / av55185686）',
    ],
    importMusicSheet: [
      '支持公开收藏夹：纯数字 ID 或收藏夹链接（fid=）',
      '未配置登录 Cookie 时 B 站不下发收藏内容（实测），导入收藏夹前请在插件设置配置 biliCookie',
      '私密收藏夹无法导入，请先在收藏夹设置中改为公开',
    ],
  },

  search: searchImpl,
  getMediaSource: getMediaSource,
  getMusicInfo: getMusicInfoImpl,
  getMusicDetailPageUrl: getMusicDetailPageUrlImpl,
  getAlbumInfo: getAlbumInfoImpl,
  importMusicItem: importMusicItemImpl,
  importMusicSheet: importMusicSheetImpl,
  getMusicComments: getMusicCommentsImpl,
  getTopLists: getTopListsImpl,
  getTopListDetail: getTopListDetailImpl,
  getLyric: getLyricImpl, // [v1.1.0 P1-9] 空实现 stub
};

module.exports = plugin;
