/**
 * [v1.0.1 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「一听音乐」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
var axios = require('axios');

/**
 * 一听音乐独立源插件 v1.0.1（MusicFree 插件规范 · 音流 fork 宿主对齐）
 *
 * ==================== v1.0.1 changelog（交叉质检修正版，2026-09-24） ====================
 * 依据质检1号交叉质检报告（总体通过建议合入，2 项 🟡 修正 + 1 项 🟢 复核）：
 *  1. 码率守卫接线（原 🟡1）：v1.0.0 中 verifyBitrateFloor 未被 getMediaSourceImpl 调用，
 *     头注释声明的「码率下限 ≥96kbps」实际永不生效。现接入 getMediaSourceImpl——宿主
 *     musicItem.duration（秒）可得且 ≥60s 时，以取链探得的 Content-Length 实算码率并执行
 *     下限守卫；同时修复质检探针发现的边界：kbps 四舍五入为 0（伪时长+极小文件）时原实现
 *     放行，现 kbps < 下限（含 0）一律拒收。
 *  2. 措辞修正（原 🟡2）：「上游仅搜索+播放直链两个接口存活」与文档 2.3 不符（歌手搜索
 *     实测可用），改为「歌曲搜索+播放直链两类核心能力存活；歌手搜索接口可用但未接入
 *     （上游无歌手作品列表接口）」。
 *  3. 仓库内字段形态 diff 复核（原 🟢3）已在收口时于研发沙箱仓库内执行（qianqian-v1000.js /
 *     kuwo-v1912.js 导出字段逐项比对，见自测清单 v1.0.1 补充节），插件代码无因该项改动。
 *
 * ==================== v1.0.0 changelog（首发版） ====================
 * 依据：《一听音乐接口完整文档_综合实测版.md》（2026-08-28 实测，2026-09-24 用户提供，
 *        飞书云盘 token QLpVbE0Hhow5snxoQmZcpalinqd）——端点、字段、音质能力均以该文档为
 *        权威依据；宿主侧接口形态对齐 plugins/standalone/qianqian-v1000.js / kuwo-v1912.js。
 *
 * ① 能力边界（如实呈现，文档实测口径）：
 *    - 歌曲搜索 + 播放直链两类核心能力存活（文档三节：歌词/歌曲详情/榜单 API
 *      已 404 或 403 下线，h5 api/song/info 与 api/song/lyric 返回空数组）；
 *      歌手搜索接口（so.1ting.com/singer/json）实测可用但未接入——上游无歌手作品列表
 *      接口，无法支撑歌手页数据链路，supportedSearchType 不含 artist 属如实取舍；
 *    - 单一音质档：约 128kbps MP3（文档平台概况与 2.2 节），无 320k/无损/Hi-Res，
 *      supportedQualities 如实仅透出 ['128k']，不虚构更高音质；
 *    - 曲库大幅缩减：主流歌手版权丢失（周杰伦/林俊杰/Taylor Swift 搜索 0 结果），
 *      剩余经典老歌/民歌/钢琴曲/冷门内容，属上游版权现状，插件不做任何伪装补齐。
 *
 * ② 搜索：GET https://so.1ting.com/song/json?q={关键词URL编码}&page={页}&size={20}
 *    请求头 UA + Referer: http://h5.1ting.com/；响应 count 为字符串需转数字；
 *    结果映射 song_id/song_name/singer_name/album_name/song_filepath；
 *    未实现专辑搜索（so.1ting.com/album/json 部分关键词 0 结果，且专辑详情接口无存档，
 *    无法支撑专辑页数据链路，supportedSearchType 仅 ['music']）。
 *
 * ③ 播放取链（核心逻辑，文档 2.2 节）：
 *    - 搜索返回 song_filepath 为 .wma 路径，必须将扩展名 .wma 替换为 .mp3（仅替换扩展名，
 *      不做全串 wma→mp3 盲替换，防路径中其他 wma 字样被误改）；
 *    - 原始 .wma 路径直接访问实测 404（文档注意事项），插件因此只出 mp3 换名链；
 *    - 完整播放 URL = https://h5.1ting.com/file?url={mp3路径}（路径保持原样拼接，
 *      与文档示例一致，不做整体百分号编码）；
 *    - 请求哪个音质就获取哪个音质：一听只有 128k 单档，任何音质请求统一交付该档，
 *      actualQuality 如实标注 '128k'，宁低勿虚（对齐音流口径）；
 *    - 返回 headers 携带 UA + Referer（h5 代理域名校验请求头）。
 *
 * ④ 取链验证沿用音流口径：取链后拿「链接响应头 Content-Length（或 Content-Range total）」
 *    与实际情况比对 + 魔数校验（ID3 / mp3 帧同步，fail-closed：非音频魔数拒收）；
 *    一听无「音质大小接口」可提供声明大小（详情接口已下线），故声明大小比对项不适用，
 *    以「size>0 + 魔数 + Content-Type audio/mpeg + 码率下限（时长可得时 ≥96kbps）」
 *    替代校验组合，任何一项不过即拒收抛错，不做静默降级。
 *
 * ⑤ 不支持能力（如实标注，不伪造实现）：
 *    - 歌词：歌词接口全部下线（文档三节），getLyric 返回 null；
 *    - 榜单：榜单 API 404 / 页面 403，getTopLists 返回空列表；
 *    - 歌单：不支持歌单解析（文档六节缺点 6），不实现 getMusicSheetInfo / importMusicSheet；
 *    - 歌曲详情页：歌曲详情接口已下线，无可靠详情页 URL 规则，不实现 getMusicDetailPageUrl。
 *
 * 验证方法（研发自测口径，见交付自测清单）：
 *   沙箱 NODE_PATH=仓库 node_modules，插件副本转 .cjs（仓库 package.json type=module），
 *   跑真实 HTTP：搜索（命中/0 结果版权缺失/翻页）、取链 Range 探测与魔数校验、
 *   wma 原路径 404 负向、单档音质如实降档标注、歌词/榜单不支持口径逐项实测。
 *
 * 历史版本：无（v1.0.0 首发）。
 */

// ==================== 常量 ====================

var SOURCE_TIMEOUT = 8000; // 单请求超时（宿主单方法 10s 硬上限内）

var SEARCH_URL = 'https://so.1ting.com/song/json';
var FILE_URL = 'https://h5.1ting.com/file';
// 文档 2.1/2.2 节请求头
var YT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var YT_REFERER = 'http://h5.1ting.com/';

var SEARCH_PAGE_SIZE = 20;
var MP3_KBPS_FLOOR = 96; // 128k 档码率下限（对齐 kuwo 模板 128k→96kbps 口径）

function str(v) { return v === undefined || v === null ? '' : String(v); }

// ==================== 基础请求 ====================

function ytGetJson(url, timeoutMs) {
  return axios.get(url, {
    timeout: timeoutMs || SOURCE_TIMEOUT,
    headers: { 'User-Agent': YT_UA, Referer: YT_REFERER },
    responseType: 'json'
  }).then(function (res) {
    return res.data;
  });
}

// ==================== 搜索 ====================

async function searchMusicImpl(kw, page) {
  var p = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
  var url = SEARCH_URL + '?q=' + encodeURIComponent(String(kw)) + '&page=' + p + '&size=' + SEARCH_PAGE_SIZE;
  var data = await ytGetJson(url);
  if (!data || !Array.isArray(data.results)) {
    // 接口异常/结构不符：如实返回空页，不伪造数据
    return { isEnd: true, data: [] };
  }
  var count = parseInt(str(data.count), 10) || 0;
  var items = data.results.map(function (raw) {
    var sid = str(raw.song_id);
    if (!sid) return null;
    var item = {
      id: sid,
      title: str(raw.song_name),
      artist: str(raw.singer_name),
      album: str(raw.album_name),
      platform: '1ting',
      // 搜索接口不返回时长/封面/音质表：不伪造，缺省交由宿主默认处理
      // song_filepath 为 .wma 原始路径（文档 2.1 节），取链时换名 .mp3
      song_filepath: str(raw.song_filepath)
    };
    if (!item.title) return null;
    return item;
  }).filter(Boolean);
  var isEnd = items.length < SEARCH_PAGE_SIZE || (p * SEARCH_PAGE_SIZE >= count && count > 0);
  if (count === 0) isEnd = true;
  return { isEnd: isEnd, data: items };
}

// ==================== 取链路径构造（文档 2.2 核心逻辑） ====================

// 仅替换扩展名 .wma → .mp3；不做全串盲替换（防路径中其他 wma 字样被误改）
function buildMp3Path(filepath) {
  var fp = str(filepath).trim();
  if (!fp) return '';
  if (/\.wma$/i.test(fp)) return fp.replace(/\.wma$/i, '.mp3');
  // 非常备形态：非 .wma 结尾（上游口径变化时）原样返回，交由后续校验判定可用性
  return fp;
}

function buildPlayUrl(filepath) {
  var mp3Path = buildMp3Path(filepath);
  if (!mp3Path) return '';
  return FILE_URL + '?url=' + mp3Path;
}

// ==================== 取链验证（音流口径替代组合） ====================

// Range 0-15 探测：Content-Length（或 Content-Range total）+ 魔数 + 码率下限
// 一听无音质大小接口（详情 API 已下线）→ 无声明大小可比对，本组合替代 verifyMediaSizeStrict 的
// declaredSize 比对项；fail-closed：任何一项不过即抛错拒收。
function verifyLinkStrict(url, timeoutMs) {
  return axios.get(url, {
    timeout: timeoutMs || SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': YT_UA, Referer: YT_REFERER },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var st = res.status;
    if (st !== 200 && st !== 206) throw new Error('[1ting] size verify: HTTP ' + st);
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total <= 0) throw new Error('[1ting] size verify: Content-Length=0 或响应无大小（文档口径：可用真链必有非 0 Content-Length）');

    var ctype = str(headers['content-type'] || headers['Content-Type']).toLowerCase();
    // h5 代理正常回 audio/mpeg（文档 2.2 实测）；异常形态（text/html 停放页等）拒收
    if (ctype && !/audio|octet-stream/.test(ctype)) {
      throw new Error('[1ting] size verify: Content-Type 异常 ' + ctype);
    }

    var buf = res.data;
    var u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = '';
    if (u8 && u8.length >= 2) {
      if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'ID3';
      else if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) magic = 'mp3';
    }
    // 文档 2.2：返回的是真实 MP3（ID3 标签）；fail-closed——非 ID3/mp3 魔数一律拒收
    if (!magic) throw new Error('[1ting] size verify: 魔数非音频（预期 ID3/mp3 帧同步）');

    return { total: total, magic: magic, contentType: ctype };
  });
}

// ==================== getMediaSource 编排 ====================

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem) throw new Error('[1ting] missing musicItem');
  // 音质口径：一听仅 128k 单档（文档 2.2），任何请求档统一交付该档，actualQuality 如实标注，
  // 宁低勿虚（对齐音流「请求哪个音质就获取哪个音质，档内不虚标」口径）
  var url = buildPlayUrl(musicItem.song_filepath);
  if (!url) throw new Error('[1ting] musicItem 缺少 song_filepath（请通过本插件搜索获取条目）');
  var v = await verifyLinkStrict(url);
  // 码率下限守卫（v1.0.1 接线，修复 v1.0.0 声明未生效问题）：
  // 宿主补齐 musicItem.duration（单位秒）且 ≥60s 时实算码率执行下限校验；
  // kbps < 下限（含四舍五入为 0 的伪时长+极小文件边界）一律拒收，不做静默降级
  var dur = parseInt(musicItem.duration, 10) || 0;
  if (dur >= 60) {
    var kbps = Math.round(v.total * 8 / dur / 1000);
    if (kbps < MP3_KBPS_FLOOR) {
      throw new Error('[1ting] size verify: 码率下限 ~' + kbps + 'kbps < ' + MP3_KBPS_FLOOR + 'kbps（时长 ' + dur + 's / 实测 ' + v.total + 'B）');
    }
  }
  return {
    url: url,
    quality: '128k',
    actualQuality: '128k',
    size: v.total,
    headers: { 'User-Agent': YT_UA, Referer: YT_REFERER }
  };
}

// 码率下限守卫（时长可得时）：128k 档下限 96kbps；时长来自宿主补齐时才生效，搜索接口无时长
async function verifyBitrateFloor(url, durationSec) {
  var dur = parseInt(durationSec, 10) || 0;
  if (dur < 60) return { skipped: true };
  var v = await verifyLinkStrict(url);
  var kbps = Math.round(v.total * 8 / dur / 1000);
  if (kbps < MP3_KBPS_FLOOR) { // 含 kbps=0 边界（伪时长+极小文件），一律拒收
    throw new Error('[1ting] size verify: 码率下限 ~' + kbps + 'kbps < ' + MP3_KBPS_FLOOR + 'kbps');
  }
  return { kbps: kbps };
}

// ==================== 不支持能力（如实口径） ====================

// 歌词：一听歌词接口全部下线（文档三节实测 404 / 空数组），如实返回 null，不伪造时间戳
async function getLyricImpl() {
  return null;
}

// 榜单：榜单 API 404 / 榜单页 403（文档三节），返回空列表
async function getTopListsImpl() {
  return [];
}

async function getTopListDetailImpl() {
  // getTopLists 恒空，宿主不应触达；防御性返回空页
  return { isEnd: true, data: [] };
}

// ==================== 插件对象 ====================

var plugin = {
  name: '一听音乐',
  platform: '1ting',
  version: '1.0.1',
  author: '研发3号',
  description: '一听音乐（1ting.com）独立源插件 v1.0.1：歌曲搜索（so.1ting.com/song/json）+ 播放直链（h5.1ting.com/file?url=，.wma 扩展名换 .mp3）两类核心能力存活（歌手搜索接口可用但上游无歌手作品列表接口，未接入）；单档约 128kbps MP3 如实透出（supportedQualities 仅 128k，不虚构更高音质）；取链验证沿用音流口径（Content-Length 非 0 + 魔数 ID3/mp3 fail-closed + Content-Type 校验 + 时长可得时码率下限 ≥96kbps 实守卫，一听无音质大小接口、声明大小比对项不适用并如实注明）；歌词/歌曲详情/榜单/歌单接口上游已下线，对应能力如实标注不支持不伪造',
  primaryKey: ['id'],
  supportedSearchType: ['music'], // 专辑搜索部分关键词 0 结果且无专辑详情接口，不实现（文档三节）
  defaultSearchType: 'music',
  // 单档真实音质：约 128kbps MP3（文档平台概况/2.2 节），无 320k/无损
  supportedQualities: ['128k'],
  cacheControl: 'no-store', // 保守口径：直链为静态路径但保持与既有插件一致的现取策略
  userVariables: [],
  hints: {
    search: ['搜索一听音乐曲库（经典老歌/民歌/钢琴曲/冷门内容为主）', '主流流行歌手版权已丢失（如周杰伦/林俊杰/Taylor Swift 搜索 0 结果），属上游曲库现状'],
    importMusicSheet: ['一听音乐不支持歌单解析（上游无歌单接口），不支持导入']
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

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topListItem, page) {
    return getTopListDetailImpl(topListItem, page);
  },

  _internal: {
    searchMusicImpl: searchMusicImpl,
    getMediaSourceImpl: getMediaSourceImpl,
    buildMp3Path: buildMp3Path,
    buildPlayUrl: buildPlayUrl,
    verifyLinkStrict: verifyLinkStrict,
    verifyBitrateFloor: verifyBitrateFloor,
    getLyricImpl: getLyricImpl,
    getTopListsImpl: getTopListsImpl
  }
};

module.exports = plugin;
