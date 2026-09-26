/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「喜马拉雅」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 喜马拉雅（Ximalaya）独立源插件 v1.0.0 — MusicFree
 * ============================================================
 * 喜马拉雅独立源。免登录、无需 Cookie；免费 + 付费音频均免登录可播
 * （付费走 mpay.ximalaya.com RC4 解密，已在沙箱端到端实测）。
 * 内容形态：有声书 / 相声 / 播客 / 专辑节目，单轨音频 ~64K AAC（免费）/
 * 48K AAC（付费）。**旧版「付费需登录」认知已被实测推翻**。
 *
 * v1.0.0 changelog（2026-09-24）：
 *   ① search：GET www.ximalaya.com/revision/search?core={track|album}&kw=&page=
 *      （免登录、无需 xm-sign，文档 §4）。type=music→core=track（结果在
 *      data.result.response.docs，用数字 id；upload_id 的 "u_" 前缀形态不用于取链）；
 *      type=album→core=album；type=sheet→core=album（专辑即歌单）。
 *      type=artist 平台不可用（core=user 实测 ret=500，文档 §4.3），未声明支持。
 *   ② getMediaSource（音流口径：请求哪个音质取哪个音质 + 真链校验）：
 *      - 免费轨：GET /revision/play/tracks?trackIds={id} → data.tracksForAudioPlay[]
 *        （注意：响应字段是 tracksForAudioPlay，不是文档表格里暗示的其它名字），
 *        canPlay=true 且 src 存在 → 直链按魔数判档（ftyp→'64k' / MP3 帧同步→'32k'；
 *        playUrl64 实测 ~32K MP3：293243B/926s ≈ 32kbps，文档标 "64K MP3" 系按
 *        字段名误标，本插件按实测字节如实降档）。src 不可得或魔数校验未过、且
 *        条目非付费并携带 __albumId（search track 的 album_id / 专辑行 / 导入
 *        entry 的 albumId）时 → 回落专辑页（mobwsa playlist/album/page）行内
 *        免费直链候选 playPathAacv164(~64K AAC M4A) → playUrl64(实测 ~32K MP3)
 *        逐个魔数探测（QC P2-2 修复：v1.0.0 首版注释声称该回退链但未实现）。
 *      - 付费轨（play/tracks 无 src / canPlay=false）：GET
 *        mpay.ximalaya.com/mobile/track/pay/{id}?device=pc&isBackend=false →
 *        ret=0 → ep(Base64→RC4→"buy_key-sign-token-timestamp") + seed/fileId
 *        (LCG 随机置换表 → 文件名) → {domain}/download/{apiVersion}/{filename}
 *        ?buy_key=&sign=&token=&timestamp=&duration=（文档 §3 步骤 1-3，参数恰好
 *        5 个：多传 mediaType/device 等会 403；filename 非"/"开头需补 "/"）。
 *      - 真链校验：Range 0-15 魔数探测（M4A=offset4 'ftyp' / MP3='ID3' 或 0xFFEx
 *        帧同步）；付费链另有 size 源（mpay totalLength），Content-Range total 与
 *        之不一致判失败（实测 5220070==5220070 MATCH）；免费链平台无音质大小接口，
 *        仅魔数校验（如实说明，无大小比对源）。
 *   ③ 音质档位（宁低勿高，如实映射）：声明 ['64k']（平台免费真实最高 ~64K AAC）。
 *      免费命中 aacv164 → actualQuality '64k'；回落 playUrl64 → '32k'（实际值，
 *      未虚标 64k）；付费解密 → '48k'（文件名实测含 -aacv2-48K，未虚标）。
 *      更高音质（VIP 128K/320K 等）免登录不可得，文档标注未测试，不声明。
 *   ④ getAlbumInfo：GET mobwsa.ximalaya.com/mobile/playlist/album/page?albumId=
 *      &pageId={page}（免登录，付费专辑可完整翻 720 集；免登录 playUrl 类字段为空
 *      但 trackId/title/duration/isPaid 齐全，取链由 getMediaSource 分轨处理）。
 *      专辑元信息（标题/封面/总集数）取自列表行自带的 albumTitle/coverLarge。
 *   ⑤ getTopLists：GET mobile.ximalaya.com/mobile/discovery/v2/rankingList/group
 *      （27 个榜单）。其中仅 10 个节目榜单可如实取详情（categoryId∈{2,3,4,5,6,9,
 *      10,12,18,59→18} 即 yinyue/youshengshu/ertong/waiyu/xiangsheng/qinggan/yule/
 *      shangye/keji/lishi 十个分类拼音映射，经 web 端 queryCategoryPageAlbums
 *      ?category={拼音}&subtype=0&state={榜单key}&page={n} 逐个实测 ret=200、50 条/页）；
 *      其余 12 个节目榜单（categoryId=0 的定制榜/飙升榜/最热榜等）与 5 个主播榜：
 *      state 在 web 分类接口无分类归属（category 参数主导结果集，硬拼会张冠李戴）、
 *      且 app 端 rankingList/{id}/albums 404——**如实不支持，不凑数**。
 *      getTopListDetail 返回的 musicList 为专辑条目（__asAlbum=true），点击播放
 *      自动解析为该专辑第一集（getMediaSource 内分轨处理）；专辑完整列表走搜索
 *      （type=album）或 importMusicSheet。
 *   ⑥ getMusicSheetInfo：sheet 即专辑（搜索 type=sheet 结果 id 为 albumId），分页
 *      同 getAlbumInfo。importMusicSheet：解析 www.ximalaya.com/album/{id}（多页
 *      拉全，上限 40 页/800 集保护）。importMusicItem：/sound/{id} 或纯数字 id，
 *      经 play/tracks 补齐元数据。
 *   ⑦ 范围决策（宁缺毋滥，文档未覆盖/不可行）：
 *      - 歌词 getLyric / getWordByWordLyric：有声书/播客内容平台不提供歌词，stub
 *        reject（宿主惯例同 qingting v1.0.0）；
 *      - getRecommendSheetTags / getRecommendSheetsByTag / getMusicComments /
 *        getArtistWorks：文档未覆盖相关接口，stub reject；MV return null；
 *      - 直播 HLS（live.xmcdn.com/live/{id}/{码率}.m3u8）：宿主以单曲形态消费，
 *        HLS 直播流形态不匹配（同 qingting 决策），v1.0.0 不支持；电台列表接口
 *        mobile/live/radios 实测 404，无列表来源，不接入。
 *   ⑧ 安全：RC4/LCG/Base64 纯 JS 自实现（宿主 RN 环境无 node crypto/atob）；
 *      直链 host 白名单（*.xmcdn.com / *.ximalaya.com）防上游注入任意 URL；
 *      所有请求超时 8s，取链总预算 9s（QC P2-1 修复：各阶段间 deadline 短路
 *      强制生效，超预算即失败，不进入下一阶段）。
 *
 * v1.0.0-r2 修订（2026-09-24，按交叉质检报告 P2 逐条修复 + 复测）：
 *   R1（P2-1）取链预算 9s 落地为各阶段间 deadline 短路（v1.0.0 仅定义未强制）；
 *   R2（P2-2）实现注释 ② 声称的免费直链回退链：src 失败 → __albumId 专辑页行内
 *      playPathAacv164 → playUrl64 逐个魔数探测（search/专辑行/导入条目均补
 *      __albumId；仅非付费条目启用）；头注释 ② 同步改为与实现一致；
 *   R3（P2-4）fetchFreeSrc 收紧为严格 trackId 匹配（移除 || tp.length === 1
 *      容错分支，防多 trackId 响应时错配取链）；
 *   R4（P2-3）自测 #20 importMusicItem 样本由付费 1507146 改为免费 87654321，
 *      元数据补齐断言真实有效。
 *
 * 接口与参数来源：《喜马拉雅接口完整文档_综合实测版 v2.6》（2026-09-24）+
 * 本沙箱 2026-09-24 逐接口复测（免费/付费取链端到端 206+魔数+大小比对 MATCH、
 * 搜索 track/album 字段全景、付费专辑 720 集完整列表、10 个榜单详情逐一验证）。
 * 文档两处与实测不符已修正：榜单 group 的 list 数组实测为空（非完整数据）；
 * playUrl64 实测 ~32K（非文档标称 64K MP3）。
 *
 * 作者：研发1号 | 仅限个人技术研究学习，尊重版权与平台条款。
 * ============================================================
 */
var axios = require('axios');

// ==================== 常量区 ====================

var PLUGIN_VERSION = '1.0.0';

var WEB_HOST = 'https://www.ximalaya.com';
var MPAY_HOST = 'https://mpay.ximalaya.com';
var MOBWSA_HOST = 'http://mobwsa.ximalaya.com';
var MOBILE_HOST = 'http://mobile.ximalaya.com';

var APP_UA = 'Ximalaya/8.0.0 Android/10'; // 文档 §5 移动端 API 实测请求头
var WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 取链直链 host 白名单（实测 CDN 域）：防上游/代理注入任意 URL
var MEDIA_URL_ALLOW_RE = /^https?:\/\/([A-Za-z0-9-]+\.)*(xmcdn\.com|ximalaya\.com)\//;

// 榜单：categoryId → web 分类拼音（queryCategoryPageAlbums 逐个实测 ret=200 的白名单）
var RANKING_CATEGORY_PINYIN = {
  2: 'yinyue', 3: 'youshengshu', 4: 'yule', 5: 'waiyu', 6: 'ertong', 8: 'shangye',
  9: 'lishi', 10: 'qinggan', 12: 'xiangsheng', 18: 'keji'
};

var SEARCH_PAGE_SIZE = 20;   // revision/search 固定 10 条/页（pageSize 参数实测不生效）
var ALBUM_PAGE_SIZE = 20;    // playlist/album/page 固定 20 条/页
var IMPORT_SHEET_MAX_PAGES = 40; // importMusicSheet 拉全上限（40 页 × 20 = 800 集）
var IMPORT_TRACK_LOOKUP_PAGES = 3;
var TOP_LIST_PAGE_SIZE = 50; // queryCategoryPageAlbums 固定 50 条/页
var SOURCE_TIMEOUT = 8000;
var PROBE_TIMEOUT = 6000;
var RESOLVE_BUDGET_MS = 9000;

// ==================== Base64 / RC4 / 随机种子文件名（纯 JS 实现） ====================

// 标准 Base64 解码（字节级，宿主 RN 无 atob 也能跑）
var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64DecodeBytes(input) {
  var s = String(input || '').replace(/[\r\n\s=]+/g, '');
  var out = [];
  var bits = 0, acc = 0;
  for (var i = 0; i < s.length; i++) {
    var idx = B64_CHARS.indexOf(s.charAt(i));
    if (idx < 0) continue;
    acc = (acc << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xFF);
    }
  }
  return out;
}

// RC4（key: 字符串，data: 字节数组）→ 字节数组
function rc4(key, data) {
  var S = [];
  for (var i = 0; i < 256; i++) S[i] = i;
  var j = 0;
  for (i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    var t = S[i]; S[i] = S[j]; S[j] = t;
  }
  i = 0; j = 0;
  var out = [];
  for (var k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    t = S[i]; S[i] = S[j]; S[j] = t;
    out.push(data[k] ^ S[(S[i] + S[j]) % 256]);
  }
  return out;
}

// RC4 key 推导：文档 §3 get_rc4_key()（置换表映射 + 码字还原）
var PERM_TABLE = [19,1,4,7,30,14,28,8,24,17,6,35,34,16,9,10,13,22,32,29,31,21,18,3,2,23,25,27,11,20,5,15,12,0,33,26];
function getRc4Key() {
  var raw = 'dg3utf1k6yxdwi09';
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var c = raw.charAt(i);
    var a = (c >= 'a' && c <= 'z') ? c.charCodeAt(0) - 97 : (c.charCodeAt(0) - 48 + 26);
    for (var k = 0; k < 36; k++) {
      if (PERM_TABLE[k] === a) { a = k; break; }
    }
    out.push(a > 25 ? String.fromCharCode(a - 26 + 48) : String.fromCharCode(a + 97));
  }
  return out.join('');
}

// RandomSeed LCG（文档 §3 步骤 2）：seed → 字符置换表 → fileId 索引数组 → 文件名
var SEED_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ/\\:._-1234567890';
function randomSeedTable(seed) {
  var chars = SEED_CHARS;
  var state = seed;
  var ran = function () {
    state = (211 * state + 30031) % 65536;
    return state / 65536;
  };
  var table = '';
  for (var n = 0; n < SEED_CHARS.length; n++) {
    var idx = Math.floor(ran() * chars.length);
    table += chars.charAt(idx);
    chars = chars.substring(0, idx) + chars.substring(idx + 1);
  }
  return table;
}
// fileId 形如 "12*34*0*"（末尾空段）；索引指向置换表 → 拼文件路径
function encryptedFilename(seed, fileId) {
  var table = randomSeedTable(seed);
  var parts = String(fileId).split('*');
  var out = '';
  for (var i = 0; i < parts.length - 1; i++) {
    out += table.charAt(parseInt(parts[i], 10));
  }
  return out;
}

// ep 解密：Base64 → RC4 → "buy_key-sign-token-timestamp"
function decryptEp(ep) {
  var bytes = base64DecodeBytes(ep);
  var plainBytes = rc4(getRc4Key(), bytes);
  var plain = '';
  for (var i = 0; i < plainBytes.length; i++) plain += String.fromCharCode(plainBytes[i]);
  var parts = plain.split('-');
  if (parts.length < 4) throw new Error('ep 解密结果异常（段数不足）');
  return { buy_key: parts[0], sign: parts[1], token: parts[2], timestamp: parts[3] };
}

// ==================== 工具区 ====================

function apiHeaders(extra) {
  var h = { 'User-Agent': APP_UA, 'Accept': 'application/json' };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}
function webHeaders(extra) {
  var h = { 'User-Agent': WEB_UA, 'Referer': 'https://www.ximalaya.com/', 'Accept': 'application/json' };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}

// QC P2-2：条目携带所属专辑 id（search track 的 album_id / mobwsa 行的 albumId /
// play/tracks entry 的 albumId），供免费直链回退链定位专辑页。缺省 undefined。
function albumIdOf(it) {
  if (!it) return undefined;
  var v = (it.album_id !== undefined && it.album_id !== null) ? it.album_id : it.albumId;
  if (v === undefined || v === null || String(v) === '' || !/^\d+$/.test(String(v))) return undefined;
  return String(v);
}

function cloneItem(musicItem) {
  var c = {};
  if (musicItem) { for (var k in musicItem) c[k] = musicItem[k]; }
  return c;
}

function normalizeCover(p) {
  var s = String(p || '');
  if (!s) return undefined;
  if (s.indexOf('//') === 0) return 'https:' + s;
  if (s.indexOf('http') === 0) return s;
  return undefined;
}

function normalizeQuality(quality) {
  return quality === '64k' ? '64k' : '64k'; // 仅声明 64k 一档，统一按 64k 处理
}

// 数字化 track id（容忍字符串/数字输入；拒绝 upload_id 的 "u_" 形态）
function normalizeTrackId(id) {
  var s = String(id === undefined || id === null ? '' : id).trim();
  if (/^\d+$/.test(s)) return s;
  return null;
}

// Range 0-15 魔数探测：返回 { magic: 'm4a'|'mp3'|'', totalBytes: number, ok: boolean }
function probeMedia(url, expectedBytes) {
  return axios.get(url, {
    timeout: PROBE_TIMEOUT,
    headers: webHeaders({ 'Range': 'bytes=0-15' }),
    responseType: 'arraybuffer',
    maxRedirects: 3,
    validateStatus: function (s) { return s === 200 || s === 206; }
  }).then(function (res) {
    var buf = res.data;
    var u8;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
    else return { magic: '', totalBytes: 0 };
    if (!u8 || u8.length < 8) return { magic: '', totalBytes: 0 };
    var magic = '';
    if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) magic = 'm4a';       // 'ftyp'@4
    else if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'mp3';                     // 'ID3'
    else if (u8[0] === 0xFF && (u8[1] & 0xE0) === 0xE0) magic = 'mp3';                              // 帧同步
    if (!magic) return { magic: '', totalBytes: 0 };

    var totalBytes = 0;
    var cr = res.headers && (res.headers['content-range'] || res.headers['Content-Range']);
    if (res.status === 206 && cr) {
      var m = String(cr).match(/\/(\d+)$/);
      if (m) totalBytes = parseInt(m[1], 10);
    } else if (res.status === 200) {
      var cl = res.headers && (res.headers['content-length'] || res.headers['Content-Length']);
      if (cl) totalBytes = parseInt(String(cl), 10);
    }
    // 大小比对（有 size 源才比；免费链无 size 源 → 仅魔数）
    if (expectedBytes > 0 && totalBytes > 0 && totalBytes !== expectedBytes) {
      return { magic: '', totalBytes: totalBytes, sizeMismatch: true };
    }
    return { magic: magic, totalBytes: totalBytes };
  }).catch(function () { return { magic: '', totalBytes: 0 }; });
}

// ==================== 搜索实现 ====================

async function searchImpl(query, page, type) {
  var kw = typeof query === 'string' ? query : String((query && query.keyword) || '');
  kw = kw.trim();
  if (!kw) return [];
  var pg = Math.max(1, Number(page) || 1);
  var core = type === 'music' ? 'track' : 'album'; // sheet→album；music→track
  var url = WEB_HOST + '/revision/search?core=' + core + '&kw=' + encodeURIComponent(kw)
    + '&page=' + pg;
  var res;
  try {
    res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: webHeaders() });
  } catch (e) {
    throw new Error('搜索网络失败：' + (e && e.message));
  }
  var j = res.data;
  if (!j || j.ret !== 200) throw new Error('搜索失败 ret=' + (j && j.ret));
  var docs;
  try {
    docs = j.data.result.response.docs || [];
  } catch (e) { docs = []; }

  var out = [];
  for (var i = 0; i < docs.length; i++) {
    var it = docs[i] || {};
    if (core === 'track') {
      var tid = normalizeTrackId(it.id);
      if (!tid) continue; // "u_" 形态 upload_id 不作取链 id（语义未证实），跳过
      out.push({
        id: tid,
        platform: 'ximalaya',
        title: String(it.title || '').trim() || '未知声音',
        artist: String(it.nickname || '').trim() || undefined,
        album: String(it.album_title || '').trim() || undefined,
        artwork: normalizeCover(it.cover_path),
        duration: Number(it.duration) > 0 ? Math.round(Number(it.duration)) : undefined,
        __isPaid: it.is_paid === true || it.is_paid === 1,
        __albumId: albumIdOf(it), // QC P2-2：免费直链回退链用
        qualities: ['64k'],
        fee: (it.is_paid === true || it.is_paid === 1) ? 1 : 0,
        alias: undefined
      });
    } else if (type === 'sheet') {
      var sid = normalizeTrackId(it.id);
      if (!sid) continue;
      out.push({
        id: sid,
        platform: 'ximalaya',
        title: String(it.title || '').trim() || '未知专辑',
        artist: String(it.nickname || '').trim() || undefined,
        artwork: normalizeCover(it.cover_path),
        description: String(it.intro || '').trim() ? String(it.intro).trim() : undefined,
        worksNum: Number(it.tracks) > 0 ? Number(it.tracks) : undefined,
        __isPaid: it.is_paid === true || it.is_paid === 1
      });
    } else {
      var aid = normalizeTrackId(it.id);
      if (!aid) continue;
      out.push({
        id: aid,
        platform: 'ximalaya',
        title: String(it.title || '').trim() || '未知专辑',
        artist: String(it.nickname || '').trim() || undefined,
        artwork: normalizeCover(it.cover_path),
        description: String(it.intro || '').trim() ? String(it.intro).trim() : undefined,
        worksNum: Number(it.tracks) > 0 ? Number(it.tracks) : undefined,
        qualities: ['64k'],
        fee: (it.is_paid === true || it.is_paid === 1) ? 1 : 0,
        alias: undefined
      });
    }
  }
  return out;
}

// ==================== 专辑详情（mobwsa playlist/album/page） ====================

async function fetchAlbumPage(albumId, page) {
  var pg = Math.max(1, Number(page) || 1);
  var url = MOBWSA_HOST + '/mobile/playlist/album/page?albumId=' + encodeURIComponent(albumId)
    + '&pageId=' + pg;
  var res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: apiHeaders() });
  var j = res.data;
  if (!j || j.ret !== 0) throw new Error('专辑列表失败 ret=' + (j && j.ret));
  return {
    list: j.list || [],
    totalCount: Number(j.totalCount) || 0,
    maxPageId: Number(j.maxPageId) || 1
  };
}

function trackRowToMusicItem(row, albumMeta) {
  var tid = normalizeTrackId(row.trackId || row.id);
  if (!tid) return null;
  var albumTitle = String(albumMeta.title || row.albumTitle || '').trim();
  return {
    id: tid,
    platform: 'ximalaya',
    title: String(row.title || '').trim() || '未知声音',
    artist: (albumMeta.artist || undefined),
    album: albumTitle || undefined,
    artwork: normalizeCover(albumMeta.cover || row.coverLarge || row.albumImage),
    duration: Number(row.duration) > 0 ? Math.round(Number(row.duration)) : undefined,
    __isPaid: row.isPaid === true || row.isPaid === 1,
    __albumId: albumIdOf(row), // QC P2-2：免费直链回退链用
    qualities: ['64k'],
    fee: (row.isPaid === true || row.isPaid === 1) ? 1 : 0,
    alias: undefined
  };
}

async function getAlbumInfoImpl(albumItem, page) {
  if (!albumItem || !albumItem.id) throw new Error('missing albumItem.id');
  var albumId = String(albumItem.id);
  var pgData = await fetchAlbumPage(albumId, page || 1);
  var albumMeta = {
    title: String(albumItem.title || '').trim(),
    artist: String(albumItem.artist || '').trim(),
    cover: albumItem.artwork || undefined
  };
  if (!albumMeta.title && pgData.list.length) {
    albumMeta.title = String(pgData.list[0].albumTitle || '').trim();
    albumMeta.cover = normalizeCover(pgData.list[0].coverLarge || pgData.list[0].albumImage) || undefined;
  }
  var musicList = [];
  for (var i = 0; i < pgData.list.length; i++) {
    var mi = trackRowToMusicItem(pgData.list[i], albumMeta);
    if (mi) musicList.push(mi);
  }
  return {
    isEnd: (pgData.maxPageId <= (page || 1)) || (musicList.length < ALBUM_PAGE_SIZE),
    musicList: musicList
  };
}

// ==================== 音乐详情 ====================

async function getMusicInfoImpl(musicItem) {
  if (!musicItem || !musicItem.id) return musicItem;
  // 搜索结果已带全量元数据，原样返回（防御性补齐 album 字段）
  var cloned = cloneItem(musicItem);
  if (!cloned.album && musicItem.artist) cloned.album = musicItem.artist;
  return cloned;
}

// ==================== 取链实现 ====================

var resolveDeadlineAt = 0;
function RESOLVE_DEADLINE() { return resolveDeadlineAt; }

// QC P2-1：取链预算 9s 落地为各阶段间 deadline 短路（v1.0.0 首版仅计时未强制）
function checkResolveBudget(stage) {
  if (resolveDeadlineAt > 0 && Date.now() > resolveDeadlineAt) {
    throw new Error('取链预算耗尽（9s）：' + stage);
  }
}

// 免费轨：revision/play/tracks → tracksForAudioPlay[].src
async function fetchFreeSrc(trackId) {
  var url = WEB_HOST + '/revision/play/tracks?trackIds=' + encodeURIComponent(trackId);
  var res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: webHeaders() });
  var j = res.data;
  if (!j || j.ret !== 200) return null;
  var tp = (j.data && j.data.tracksForAudioPlay) || [];
  for (var i = 0; i < tp.length; i++) {
    var t = tp[i] || {};
    if (String(t.trackId) === String(trackId)) { // QC P2-4：严格匹配，移除 length===1 容错分支
      var src = String(t.src || '');
      if (src && t.canPlay !== false) return { src: src, entry: t };
      return null; // canPlay=false / 无 src → 付费或不可播
    }
  }
  return null;
}

// 付费轨：mpay 解密 → 直链 + totalLength（size 源）
async function fetchPaidSource(trackId) {
  var url = MPAY_HOST + '/mobile/track/pay/' + encodeURIComponent(trackId)
    + '?device=pc&isBackend=false&_=' + Date.now();
  var res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: webHeaders() });
  var d = res.data;
  if (!d) throw new Error('付费接口无响应');
  if (d.ret === 130) return null; // 免费音频（不返回加密信息）→ 走免费通道
  if (d.ret !== 0) return null;   // 130 之外的失败也回落免费通道再试
  if (!d.seed || !d.fileId || !d.ep || !d.domain) throw new Error('付费音频解密信息不完整');

  var epParts = decryptEp(d.ep);
  var fn = encryptedFilename(Number(d.seed), d.fileId);
  if (!fn) throw new Error('文件名解密为空（seed/fileId 异常）');
  if (fn.charAt(0) !== '/') fn = '/' + fn;
  var domain = String(d.domain);
  var qs = 'buy_key=' + encodeURIComponent(epParts.buy_key)
    + '&sign=' + encodeURIComponent(epParts.sign)
    + '&token=' + encodeURIComponent(epParts.token)
    + '&timestamp=' + encodeURIComponent(epParts.timestamp)
    + '&duration=' + encodeURIComponent(String(d.duration === undefined ? '' : d.duration));
  var fullUrl = domain + '/download/' + String(d.apiVersion || '1.0.0') + fn + '?' + qs;
  return {
    url: fullUrl,
    totalLength: Number(d.totalLength) || 0,
    duration: Number(d.duration) || 0
  };
}

// 榜单专辑条目兜底：解析专辑第一集（免费→src / 付费→解密）
async function resolveAlbumFirstTrack(albumId) {
  var pgData = await fetchAlbumPage(albumId, 1);
  if (!pgData.list.length) throw new Error('专辑暂无可用剧集');
  var first = pgData.list[0];
  var tid = normalizeTrackId(first.trackId || first.id);
  if (!tid) throw new Error('专辑第一集 ID 异常');
  return tid;
}

// QC P2-2：免费直链回退链（实现 v1.0.0 注释 ② 声称的
// playPathAacv164(~64K AAC M4A) → playUrl64(实测 ~32K MP3) 候选）——
// play/tracks 无 src 或校验未过时，按条目携带的 __albumId 回专辑页取行内
// 免费直链，逐个魔数探测判档。仅在条目未标记付费时启用（付费行免登录
// playUrl 类字段为空，探测必失败，不做无用请求）。
async function resolveFreeViaAlbum(albumId, trackId) {
  if (!albumId || !/^\d+$/.test(String(albumId))) return null;
  var pages = [1, 2];
  for (var p = 0; p < pages.length; p++) {
    checkResolveBudget('专辑页兜底 page=' + pages[p]);
    var pgData;
    try { pgData = await fetchAlbumPage(albumId, pages[p]); } catch (e) { return null; }
    var list = pgData.list || [];
    var row = null;
    for (var i = 0; i < list.length; i++) {
      var r = list[i] || {};
      if (String(r.trackId || r.id) === String(trackId)) { row = r; break; }
    }
    if (!row) {
      if (pages[p] >= (pgData.maxPageId || 1)) return null;
      continue;
    }
    var cands = [row.playPathAacv164, row.playUrl64];
    for (var c = 0; c < cands.length; c++) {
      var u = String(cands[c] || '');
      if (!u || !MEDIA_URL_ALLOW_RE.test(u)) continue;
      checkResolveBudget('专辑兜底探测 #' + (c + 1));
      var pr = await probeMedia(u, 0); // 免费链无 size 源，仅魔数
      if (pr.magic === 'm4a') return { url: u, actualQuality: '64k' };
      if (pr.magic === 'mp3') return { url: u, actualQuality: '32k' };
    }
    return null; // 行已命中但无可用直链，不再翻页
  }
  return null;
}

async function getMediaSourceImpl(musicItem, quality) {
  if (!musicItem || musicItem.id === undefined) throw new Error('missing musicItem.id');
  var hostQuality = normalizeQuality(quality);
  resolveDeadlineAt = Date.now() + RESOLVE_BUDGET_MS;

  // 榜单专辑条目：先解析成第一集 trackId
  var trackId;
  if (musicItem.__asAlbum) {
    trackId = await resolveAlbumFirstTrack(String(musicItem.id));
    checkResolveBudget('专辑第一集解析'); // QC P2-1
  } else {
    trackId = normalizeTrackId(musicItem.id);
    if (!trackId) throw new Error('track id 非法（须为纯数字）');
  }

  // 通道 1：免费轨（play/tracks 直链）
  var free = null;
  try { free = await fetchFreeSrc(trackId); } catch (e) { free = null; }
  checkResolveBudget('免费通道取链'); // QC P2-1
  if (free && free.src && MEDIA_URL_ALLOW_RE.test(free.src)) {
    // 免费链无 size 源 → 仅魔数校验（如实说明）
    var probeFree = await probeMedia(free.src, 0);
    if (probeFree.magic === 'm4a') {
      return { url: free.src, quality: hostQuality, actualQuality: '64k', headers: { 'User-Agent': WEB_UA } };
    }
    if (probeFree.magic === 'mp3') {
      // src 为 MP3 形态（实测 ~32K）：宁低勿高，如实标注
      return { url: free.src, quality: hostQuality, actualQuality: '32k', headers: { 'User-Agent': WEB_UA } };
    }
  }

  // 通道 1b：免费兜底（QC P2-2）——src 不可得或魔数校验未过时，
  // 回专辑页行内 playPathAacv164 → playUrl64 逐个魔数探测。
  // 榜单 __asAlbum 条目天然带专辑 id；普通条目用搜索/导入时携带的 __albumId。
  var fbAlbumId = musicItem.__asAlbum ? String(musicItem.id) : musicItem.__albumId;
  if (musicItem.__isPaid !== true && fbAlbumId) {
    var fb = null;
    try { fb = await resolveFreeViaAlbum(fbAlbumId, trackId); }
    catch (e) {
      if (/预算耗尽/.test(String((e && e.message) || ''))) throw e; // 预算短路向上抛
      fb = null;
    }
    if (fb) {
      return { url: fb.url, quality: hostQuality, actualQuality: fb.actualQuality, headers: { 'User-Agent': WEB_UA } };
    }
    checkResolveBudget('专辑兜底后'); // QC P2-1
  }

  // 通道 2：付费轨（mpay RC4 解密）— 付费 + size 比对（totalLength 为 size 源）
  checkResolveBudget('付费通道'); // QC P2-1
  var paid = null;
  try { paid = await fetchPaidSource(trackId); } catch (e) { paid = null; }
  if (paid && paid.url) {
    if (!MEDIA_URL_ALLOW_RE.test(paid.url)) throw new Error('付费直链未通过官方 CDN 白名单校验');
    var probePaid = await probeMedia(paid.url, paid.totalLength);
    if (probePaid.magic === 'm4a') {
      // 实测文件名含 -aacv2-48K → 真实 48K AAC，未虚标
      return { url: paid.url, quality: hostQuality, actualQuality: '48k', headers: { 'User-Agent': WEB_UA } };
    }
    if (probePaid.magic === 'mp3') {
      return { url: paid.url, quality: hostQuality, actualQuality: '48k', headers: { 'User-Agent': WEB_UA } };
    }
    var why = probePaid.sizeMismatch ? '（Content-Range 与 totalLength 不一致）' : '（魔数校验未通过）';
    throw new Error('付费音频真链校验失败' + why);
  }

  throw new Error('取链失败：免费/付费通道均未获得通过校验的直链（trackId=' + trackId + '）');
}

// ==================== 榜单实现 ====================

async function fetchRankingGroup() {
  var url = MOBILE_HOST + '/mobile/discovery/v2/rankingList/group?channel=and-a1&device=android'
    + '&includeActivity=true&includeSpecial=true&scale=2&version=5.4.45';
  var res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: apiHeaders() });
  var j = res.data;
  if (!j || j.ret !== 0) throw new Error('榜单分组失败 ret=' + (j && j.ret));
  var sections = j.datas || [];
  for (var i = 0; i < sections.length; i++) {
    if (sections[i] && sections[i].title === '节目榜单') return sections[i].list || [];
  }
  return [];
}

async function getTopListsImpl() {
  var rankings = await fetchRankingGroup();
  var groups = {};
  var groupOrder = [];
  for (var i = 0; i < rankings.length; i++) {
    var r = rankings[i] || {};
    var cid = Number(r.categoryId);
    if (!RANKING_CATEGORY_PINYIN[cid]) continue; // 仅声明可如实取详情的榜单（见头注释⑤）
    var g = '喜马拉雅榜单';
    if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
    groups[g].push({
      id: String(r.rankingListId || r.key || i),
      title: String(r.title || '').trim(),
      artwork: normalizeCover(r.coverPath),
      description: String(r.subtitle || '').trim() ? String(r.subtitle).trim() : undefined,
      __rankingKey: String(r.key || ''),
      __categoryId: cid
    });
  }
  return groupOrder.map(function (g) { return { title: g, data: groups[g] }; });
}

async function getTopListDetailImpl(topListItem, page) {
  if (!topListItem || !topListItem.__rankingKey || !topListItem.__categoryId) {
    throw new Error('榜单条目缺少 key/categoryId（不支持该榜单）');
  }
  var py = RANKING_CATEGORY_PINYIN[topListItem.__categoryId];
  var pg = Math.max(1, Number(page) || 1);
  var url = WEB_HOST + '/revision/category/queryCategoryPageAlbums?category=' + py
    + '&subtype=0&state=' + encodeURIComponent(topListItem.__rankingKey)
    + '&page=' + pg;
  var res = await axios.get(url, { timeout: SOURCE_TIMEOUT, headers: webHeaders() });
  var j = res.data;
  if (!j || j.ret !== 200) throw new Error('榜单详情失败 ret=' + (j && j.ret));
  var albums = (j.data && j.data.albums) || [];
  var musicList = [];
  for (var i = 0; i < albums.length; i++) {
    var a = albums[i] || {};
    var aid = normalizeTrackId(a.albumId || a.id);
    if (!aid) continue;
    musicList.push({
      id: aid,
      platform: 'ximalaya',
      title: String(a.title || '').trim() || '未知专辑',
      artist: String(a.anchorName || '').trim() || undefined,
      album: String(a.title || '').trim() || undefined,
      artwork: normalizeCover(a.coverPath),
      __asAlbum: true, // 榜单条目=专辑；点击播放自动解析第一集（getMediaSource 处理）
      __isPaid: a.isPaid === true || a.isPaid === 1,
      qualities: ['64k'],
      fee: (a.isPaid === true || a.isPaid === 1) ? 1 : 0,
      alias: undefined
    });
  }
  return {
    isEnd: musicList.length < TOP_LIST_PAGE_SIZE,
    musicList: musicList
  };
}

// ==================== 歌单（专辑即歌单） ====================

async function getMusicSheetInfoImpl(sheetItem, page) {
  return getAlbumInfoImpl(sheetItem, page);
}

function getRecommendSheetTagsImpl() {
  return Promise.reject(new Error('喜马拉雅未提供推荐歌单标签接口（文档未覆盖）'));
}
function getRecommendSheetsByTagImpl(_tag, _page) {
  return Promise.reject(new Error('喜马拉雅未提供标签歌单接口（文档未覆盖）'));
}

// ==================== 导入 ====================

async function importMusicItemImpl(urlLike) {
  var raw = String(urlLike || '').trim();
  if (!raw) throw new Error('导入内容为空');
  var m = raw.match(/ximalaya\.com\/sound\/(\d+)/);
  var tid = m ? m[1] : (/^\d+$/.test(raw) ? raw : null);
  if (!tid) throw new Error('无法解析声音链接或 ID：' + raw);
  // play/tracks 补齐元数据
  try {
    var free = await fetchFreeSrc(tid);
    var entry = free && free.entry;
    if (entry) {
      return {
        id: tid,
        platform: 'ximalaya',
        title: String(entry.trackName || '').trim() || ('喜马拉雅声音 #' + tid),
        artist: undefined,
        album: String(entry.albumName || '').trim() || undefined,
        artwork: normalizeCover(entry.trackCoverPath),
        duration: Number(entry.duration) > 0 ? Math.round(Number(entry.duration)) : undefined,
        __isPaid: entry.isPaid === true,
        __albumId: albumIdOf(entry), // QC P2-2：免费直链回退链用
        qualities: ['64k'],
        fee: entry.isPaid === true ? 1 : 0,
        alias: undefined
      };
    }
  } catch (e) { /* 元数据补齐失败不阻塞导入 */ }
  return {
    id: tid,
    platform: 'ximalaya',
    title: '喜马拉雅声音 #' + tid,
    qualities: ['64k'],
    fee: 0,
    alias: undefined
  };
}

async function importMusicSheetImpl(urlLike) {
  var raw = String(urlLike || '').trim();
  if (!raw) throw new Error('导入内容为空');
  var m = raw.match(/ximalaya\.com\/album\/(\d+)/);
  var aid = m ? m[1] : (/^\d+$/.test(raw) ? raw : null);
  if (!aid) throw new Error('无法解析专辑链接或 ID：' + raw);
  var all = [];
  var albumMeta = { title: '', artist: undefined, cover: undefined };
  var maxPageId = 1;
  for (var p = 1; p <= Math.min(IMPORT_SHEET_MAX_PAGES, maxPageId); p++) {
    var pgData = await fetchAlbumPage(aid, p);
    maxPageId = pgData.maxPageId || 1;
    if (!albumMeta.title && pgData.list.length) {
      albumMeta.title = String(pgData.list[0].albumTitle || '').trim();
      albumMeta.cover = normalizeCover(pgData.list[0].coverLarge || pgData.list[0].albumImage);
    }
    for (var i = 0; i < pgData.list.length; i++) {
      var mi = trackRowToMusicItem(pgData.list[i], albumMeta);
      if (mi) all.push(mi);
    }
    if (pgData.list.length < ALBUM_PAGE_SIZE || p >= maxPageId) break;
  }
  return all;
}

// ==================== Stub（宁缺毋滥） ====================

function getLyricImpl(_musicItem) {
  return Promise.reject(new Error('喜马拉雅为有声书/播客内容，平台不提供歌词'));
}
function getWordByWordLyricImpl(_musicItem) {
  return Promise.reject(new Error('喜马拉雅不提供逐字歌词'));
}
function getArtistWorksImpl(_artistItem, _page) {
  return Promise.reject(new Error('喜马拉雅用户搜索接口实测不可用（ret=500），未提供歌手作品接口'));
}
function getMusicCommentsImpl(_musicItem, _page) {
  return Promise.reject(new Error('喜马拉雅未提供评论接口（文档未覆盖）'));
}
function getMvSourceImpl() { return null; }

// ==================== 插件定义 ====================

var plugin = {
  name: '喜马拉雅',
  platform: 'ximalaya',
  version: PLUGIN_VERSION,
  author: '研发1号',
  description: '喜马拉雅（Ximalaya）独立源插件（v1.0.0）：免登录搜索/播放/下载，免费+付费音频均免登录可播（付费走 mpay RC4 解密，seed/fileId/ep 端到端实测）；1 档音质（~64K AAC，免费；付费实际 48K AAC，宁低勿高如实标注）；10 个分类榜单（27 榜单中仅此 10 个可如实取详情）；专辑=歌单完整分页。能力：搜索（music/album/sheet）、专辑详情、榜单、导入（/sound/{id}、/album/{id}）、取链（魔数 + 付费大小比对）。Stub 不支持：歌词（有声内容）/ 歌手 / 评论 / MV / 直播 HLS / 推荐歌单。',
  supportedSearchType: ['music', 'album', 'sheet'], // artist 不可用（core=user ret=500）
  defaultSearchType: 'music',
  primaryKey: ['id'],
  supportedQualities: ['64k'], // 平台免费真实最高 ~64K AAC（实测字节码率），不虚标更高
  supportedVideoQualities: [],
  cacheControl: 'no-store', // 直链含签名/时效参数，URL 现取不缓存
  userVariables: [],
  hints: {
    search: [
      '搜索喜马拉雅曲库：music=声音（track）、album/sheet=专辑（有声书/相声/播客），固定 10 条/页',
      '付费音频免登录可播（走解密通道），实际音质 48K AAC；免费音质 ~64K AAC（均如实标注）',
      '有声内容平台不提供歌词'
    ],
    importMusicItem: [
      '支持声音链接：https://www.ximalaya.com/sound/{id}',
      '支持纯数字声音 ID'
    ],
    importMusicSheet: [
      '支持专辑链接：https://www.ximalaya.com/album/{id}（拉取全部剧集，上限 800 集）'
    ]
  },

  async search(query, page, type) { return searchImpl(query, page, type); },
  async getMediaSource(musicItem, quality) { return getMediaSourceImpl(musicItem, quality); },
  async getLyric(musicItem) { return getLyricImpl(musicItem); },
  async getWordByWordLyric(musicItem) { return getWordByWordLyricImpl(musicItem); },
  async getMusicInfo(musicItem) { return getMusicInfoImpl(musicItem); },
  async getAlbumInfo(albumItem, page) { return getAlbumInfoImpl(albumItem, page); },
  getTopLists: getTopListsImpl,
  getTopListDetail: getTopListDetailImpl,
  getMusicSheetInfo: getMusicSheetInfoImpl,
  getRecommendSheetTags: getRecommendSheetTagsImpl,
  getRecommendSheetsByTag: getRecommendSheetsByTagImpl,
  getArtistWorks: getArtistWorksImpl,
  getMusicComments: getMusicCommentsImpl,
  getMvSource: getMvSourceImpl,
  importMusicItem: importMusicItemImpl,
  importMusicSheet: importMusicSheetImpl
};

// ==================== 自测出口（不影响运行时） ====================
plugin._internal = {
  PLUGIN_VERSION: PLUGIN_VERSION,
  base64DecodeBytes: base64DecodeBytes,
  rc4: rc4,
  getRc4Key: getRc4Key,
  randomSeedTable: randomSeedTable,
  encryptedFilename: encryptedFilename,
  decryptEp: decryptEp,
  normalizeTrackId: normalizeTrackId,
  normalizeCover: normalizeCover,
  probeMedia: probeMedia,
  searchImpl: searchImpl,
  fetchAlbumPage: fetchAlbumPage,
  getAlbumInfoImpl: getAlbumInfoImpl,
  getMusicInfoImpl: getMusicInfoImpl,
  fetchFreeSrc: fetchFreeSrc,
  resolveFreeViaAlbum: resolveFreeViaAlbum,
  albumIdOf: albumIdOf,
  fetchPaidSource: fetchPaidSource,
  getMediaSourceImpl: getMediaSourceImpl,
  fetchRankingGroup: fetchRankingGroup,
  getTopListsImpl: getTopListsImpl,
  getTopListDetailImpl: getTopListDetailImpl,
  getMusicSheetInfoImpl: getMusicSheetInfoImpl,
  importMusicItemImpl: importMusicItemImpl,
  importMusicSheetImpl: importMusicSheetImpl
};

module.exports = plugin;
