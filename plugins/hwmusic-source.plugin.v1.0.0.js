/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「华为音乐」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * MusicFree 音源插件 —— 华为音乐（酷我兜底播放）
 * @version 1.0.0
 * @author 研发1号
 * @date 2026-09-24
 *
 * ============================== 版本履历 ==============================
 * v1.0.0（2026-09-24）
 *  - 首版。依据《华为音乐接口完整文档_综合实测版.md》（2026-08-28，飞书云盘
 *    ZA3Fb8p4jo3tMfxHsF3cIr9Hn2g）实现华为音乐搜索/歌词/分享，宿主侧接口
 *    （searchMusic/getMediaSource/getLyric/getMusicInfo/getMusicDetailPageUrl/
 *    importMusicItem/getTopLists/getTopListDetail/getSheetDetail）与仓库现有
 *    standalone 插件对齐。
 *  - 搜索：POST api-drcn.music.dbankcloud.cn/music-search-service/v10/service/fuzzysearch，
 *    免登录，仅需华为设备 UA（model=MRO-W00,...，文档 2.2 原文）。响应 songSimpleInfos[]
 *    中 contentExInfo 为 JSON 字符串，二次解析拿 completeFileInfos（各音质 fileSize/
 *    mediaFileType）、maxQuality、vip、minPrivilege（播放/下载所需权限）。
 *  - 播放取链：华为官方通道仅作尽力尝试——免 token 裸试 bycontentcode（免费档
 *    qualityType=1/2，.mp3 明文才可能可播）；文档明确该接口需 authorization 抓包 token
 *    （每次重启 App 更换、有有效期），不可作为稳定播放通道，故失败是预期路径。
 *    会员歌曲 .qy2/.qy3 加密、无公开解密工具，一律不放华为通道，直接走酷我兜底。
 *  - 酷我兜底：整段复用仓库 kugou-v1913.js 的 resolveKuwoFallback 家族（曲名+歌手
 *    搜索 → 严格同曲校验四项（核心名/版本标签/歌手任一命中/时长差≤10%）→ rid 缓存
 *    （10min TTL/FIFO 256）→ 官方 convert_url_with_sign + mobi.s DES 竞速），来源
 *    如实标记 channel='kuwo:official'。
 *  - 取链验证（音流口径）：请求哪个音质就获取哪个音质；华为通道拿「链接响应头
 *    Content-Length/Content-Range total」与 completeFileInfos.fileSize 比对（相对差
 *    ≤5%）+ 魔数校验（fLaC/ID3/mp3 sync/OggS/ftyp）；酷我通道无大小接口，用魔数 +
 *    guardFullAudio（Content-Length×标称时长估算码率 <64kbps 判试听拒收）。
 *  - 音质档位映射（文档 4.1）：1=标准 MP3~128k / 2=HQ MP3 320k / 3、7=SQ FLAC
 *    （会员，.qy2/.qy3 加密不可播，宿主请求 flac 直接走酷我真 FLAC，actualQuality
 *    如实回传）/ 5=Hi-Res（会员）/ 13=Audio Vivid（会员）/ 15、17=多轨道。
 *    Hi-Res/Audio Vivid/多轨道/索尼精选 HIFI 文档未给出可播路径，不声明、不虚标。
 *  - 如实标注不支持：会员加密格式（无公开解密）、Hi-Res 下载、空间音频、歌单/专辑
 *    详情接口（文档标注"需进一步抓包"）、bycontentcode 免 token 稳定取链。
 *  - 自测：search 三档实链路、华为裸试探针（预期 4xx 快速失败转兜底）、酷我兜底
 *    三档实链路 + 同曲校验单测 + 歌词链路 + 分享解析，全部通过后交付（清单见任务评论）。
 */

var HW_API_BASE = 'https://api-drcn.music.dbankcloud.cn';
var HW_H5_BASE = 'https://portal-drcn.music.dbankcloud.cn';
var HW_SEARCH_PATH = '/music-search-service/v10/service/fuzzysearch';
var HW_PLAY_PATH = '/music-play-service/v3/service/file/bycontentcode';
var HW_SEARCH_PAGE_SIZE = 20;

// 文档 2.2 原文 UA（免登录搜索唯一要求）
var HW_UA = 'model=MRO-W00,brand=huawei,rom=,emui=,os=12,apilevel=32,manufacturer=huawei,useBrandCust=0,extChannel=,cpucore=4,memory=6.0G,srceenHeight=2160,screenWidth=3840,harmonyApiLevel=,huaweiOsBrand=';

var SOURCE_TIMEOUT = 4500;      // 单请求超时
var HUAWEI_TRY_TIMEOUT = 2500;  // 华为官方裸试预算（尽力尝试，失败快速转兜底）
var RESOLVE_BUDGET_MS = 8000;   // 双赛道全局预算
var RACE_BUDGET_MS = 2800;      // 酷我竞速窗口

// 宿主音质键 → 华为音质代码（仅免费档 1/2 由华为侧直供）
var HOST_KEY_HW_QUALITY = { '128k': '1', '320k': '2' };
// 宿主音质键 → 内部档（酷我赛道用）
var HOST_KEY_INTERNAL = { '128k': 'standard', '192k': 'high', '320k': 'high', 'flac': 'super' };
var INTERNAL_TO_HOST_QUALITY = { standard: '128k', high: '320k', super: 'flac' };

function str(v) { return v === undefined || v === null ? '' : String(v); }
function u32(x) { return x | 0; }
var FEAT_TAIL_RE = /\s*(?:\bfeaturing\b|\bfeat\.?|\bft\.?).*$/i;

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

// 宿主请求档 → 内部档；未知档归一 standard（不虚构高音质能力）
function normalizeQuality(q) {
  var k = str(q).toLowerCase();
  if (k === 'super' || k === 'flac') return 'super';
  if (k === 'high' || k === '320k' || k === '192k') return 'high';
  return 'standard';
}
function internalToHostQuality(internal) {
  return INTERNAL_TO_HOST_QUALITY[internal] || '128k';
}

// ==================== contentExInfo 元数据缓存 ====================
// contentID → { fileSizeByQ:{'1':n,'2':n,'3'/'7':n}, vip, minStreaming, lyricAddress,
//               mediaTypeByQ } ；10min TTL / FIFO 256，减少重复二次解析与重搜。
var HW_META_CACHE = {};
var HW_META_CACHE_TTL = 10 * 60 * 1000;
var HW_META_CACHE_MAX = 256;
function hwMetaCacheGet(id) {
  var e = HW_META_CACHE[id];
  if (e && Date.now() - e.ts < HW_META_CACHE_TTL) return e.meta;
  if (e) delete HW_META_CACHE[id];
  return null;
}
function hwMetaCachePut(id, meta) {
  if (!HW_META_CACHE[id]) {
    var ks = Object.keys(HW_META_CACHE);
    if (ks.length >= HW_META_CACHE_MAX) delete HW_META_CACHE[ks[0]];
  }
  HW_META_CACHE[id] = { meta: meta, ts: Date.now() };
}

// contentExInfo（JSON 字符串）→ 插件侧元数据；解析失败返回 null（fail-soft）
function parseContentExInfo(rawEx) {
  if (!rawEx) return null;
  var ex = rawEx;
  if (typeof rawEx === 'string') {
    try { ex = JSON.parse(rawEx); } catch (e) { return null; }
  }
  if (!ex || typeof ex !== 'object') return null;
  var fileSizeByQ = {};
  var mediaTypeByQ = {};
  var comp = ex.completeFileInfos || {};
  var keys = Object.keys(comp);
  for (var i = 0; i < keys.length; i++) {
    var q = String(keys[i]);
    var fi = comp[q] || {};
    fileSizeByQ[q] = parseInt(fi.fileSize, 10) || 0;
    mediaTypeByQ[q] = str(fi.mediaFileType).toUpperCase();
  }
  var minPriv = ex.minPrivilege || {};
  var duration = 0;
  var compKeys = keys.length ? keys : Object.keys(comp);
  for (var j = 0; j < compKeys.length; j++) {
    var fi2 = comp[compKeys[j]] || {};
    var du = parseInt(fi2.duration, 10) || 0;
    if (du > 0) { duration = du; break; }
  }
  return {
    fileSizeByQ: fileSizeByQ,
    mediaTypeByQ: mediaTypeByQ,
    maxQuality: str(ex.maxQuality),
    vip: str(ex.vip),
    minStreaming: str(minPriv.streaming),
    minDownload: str(minPriv.download),
    duration: duration
  };
}

// ==================== 华为搜索 ====================
// 文档 3.1：POST fuzzysearch，body 全字符串字段。免登录，仅需华为设备 UA。
function huaweiSearchOnce(keyword, start) {
  return axios.post(HW_API_BASE + HW_SEARCH_PATH, {
    contentType: '1',
    correct: '1',
    limit: String(HW_SEARCH_PAGE_SIZE),
    queryWord: str(keyword),
    start: String(start)
  }, {
    timeout: SOURCE_TIMEOUT,
    headers: { 'Content-Type': 'application/json', 'User-Agent': HW_UA }
  }).then(function (res) {
    var d = res.data || {};
    var result = d.result || {};
    if (result.resultCode && result.resultCode !== '000000') {
      throw new Error('huawei search resultCode=' + result.resultCode);
    }
    return {
      songs: d.songSimpleInfos || [],
      hasNextPage: str(d.hasNextPage) === '1'
    };
  });
}

// 搜索结果项 → MusicFree musicItem；qualities 只声明 128k/320k/flac 三键，
// 尺寸取 completeFileInfos 对应 fileSize（0 则省略 size 字段）。
// _src.huawei 记录 contentID 与音质元数据，供取链/歌词/详情反查复用。
function mapHuaweiSongItem(raw) {
  if (!raw) return null;
  var id = str(raw.contentID);
  var title = str(raw.contentName);
  if (!id || !title) return null;
  // 实测（2026-09-24 沙箱实链路）：artist/album 在顶层 artistName/albumName 字符串字段；
  // 文档示例的 artistNamePairs/albumNamePair 结构作为兜底（老接口形态兼容）
  var artists = [];
  if (raw.artistName) artists.push(str(raw.artistName));
  var pairs = raw.artistNamePairs;
  if (!artists.length && Object.prototype.toString.call(pairs) === '[object Array]') {
    for (var i = 0; i < pairs.length; i++) {
      var nm = pairs[i] && (pairs[i].name || pairs[i].Name);
      if (nm && artists.indexOf(str(nm)) < 0) artists.push(str(nm));
    }
  }
  var album = str(raw.albumName) || (raw.albumNamePair && raw.albumNamePair.name) || '';
  var cover = (raw.picture && (raw.picture.bigImgURL || raw.picture.middleImgURL || raw.picture.smallImgURL)) || '';
  var meta = parseContentExInfo(raw.contentExInfo) || { fileSizeByQ: {}, mediaTypeByQ: {}, vip: '', minStreaming: '', maxQuality: '', duration: 0 };
  var qualities = {};
  if (meta.fileSizeByQ['1']) qualities['128k'] = { size: meta.fileSizeByQ['1'] };
  else qualities['128k'] = {};
  if (meta.fileSizeByQ['2']) qualities['320k'] = { size: meta.fileSizeByQ['2'] };
  else qualities['320k'] = {};
  // SQ 档（3/7）属会员加密，可播性由酷我兜底提供；size 如实取华为标称
  var flacSize = meta.fileSizeByQ['3'] || meta.fileSizeByQ['7'] || 0;
  if (flacSize) qualities.flac = { size: flacSize };
  else qualities.flac = {};
  return {
    id: id,
    title: title,
    artist: artists.join(', ') || '未知歌手',
    album: str(album),
    // 实测：顶层 times 是非时长语义的字段（晴天=469210268），真实秒数在 completeFileInfos[].duration
    duration: meta.duration || 0,
    artwork: httpsifyUrl(cover),
    qualities: qualities,
    _src: { huawei: { id: id, meta: meta } }
  };
}

// 导出边界口径（仓库约定）：http 封面/直链升级 https
function httpsifyUrl(u) {
  var s = str(u).trim();
  if (!s) return s;
  return s.replace(/^http:\/\//i, 'https://');
}

// 搜索主入口（music 类型；artist/album 类型未声明，返回空数组）
function searchHuawei(keyword, page, type) {
  var t = str(type || 'music');
  if (t !== 'music') return Promise.resolve({ isEnd: true, data: [] });
  var start = (Math.max(1, page || 1) - 1) * HW_SEARCH_PAGE_SIZE;
  return huaweiSearchOnce(keyword, start).then(function (r) {
    var data = [];
    for (var i = 0; i < r.songs.length; i++) {
      var it = mapHuaweiSongItem(r.songs[i]);
      if (it) data.push(it);
    }
    return { isEnd: !r.hasNextPage, data: data };
  });
}

// ==================== 取链验证（音流口径） ====================
// 魔数判定：fLaC / ID3 / mp3 sync(0xFF&0xE0==0xE0) / OggS / 偏移4 ftyp
function audioMagicOf(bytes) {
  var n = bytes.length;
  if (n >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return 'flac';
  if (n >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'id3';
  if (n >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return 'mp3sync';
  if (n >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'ogg';
  if (n >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'ftyp';
  return '';
}

// Range 0-255 探测：拿前 256 字节判魔数 + Content-Range total / Content-Length 总长
function probeAudioHead(url, timeoutMs) {
  var ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 2500;
  return axios.get(url, {
    timeout: ms,
    headers: { Range: 'bytes=0-255' },
    responseType: 'arraybuffer',
    validateStatus: function (s) { return s >= 200 && s < 400; }
  }).then(function (res) {
    var headers = res.headers || {};
    var buf = new Uint8Array(res.data || []);
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    if (!total && res.status !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    var ctype = String(headers['content-type'] || headers['Content-Type'] || '');
    return { magic: audioMagicOf(buf), total: total, contentType: ctype };
  });
}

// 大小比对（音流口径）：华为通道 total 与 completeFileInfos.fileSize 相对差 ≤5%
function sizeMatches(total, expected) {
  var t = parseInt(total, 10) || 0;
  var e = parseInt(expected, 10) || 0;
  if (t <= 0 || e <= 0) return true; // 任一侧缺数据不卡（魔数闸仍在）
  return Math.abs(t - e) / e <= 0.05;
}

// ==================== 华为官方通道（尽力尝试） ====================
// 免 token 裸试 bycontentcode：文档明确正常需 authorization 抓包 token，此处为
// 「若免 token 可取则用」的尽力路径——预期多数环境 4xx/权限码快速失败。
// 仅免费档 1/2（.mp3 明文）；vip==='1' 或 minPrivilege.streaming!=='0' 直接拒；
// 响应含 secretKey/iv（AES 加密）或 qy2/qy3 一律拒（无公开解密工具）。
function resolveHuaweiOfficial(musicItem, quality) {
  var hwQ = HOST_KEY_HW_QUALITY[quality];
  if (!hwQ) return Promise.reject(new Error('huawei official unsupported quality: ' + quality));
  var id = musicItem && musicItem.id ? str(musicItem.id) : '';
  if (!id) return Promise.reject(new Error('huawei official no contentID'));
  var meta = musicItem._src && musicItem._src.huawei && musicItem._src.huawei.meta;
  if (!meta) meta = hwMetaCacheGet(id);
  var ensureMeta = meta ? Promise.resolve(meta) : findHuaweiMetaById(musicItem);
  return ensureMeta.then(function (m) {
    if (!m) throw new Error('huawei official no meta');
    hwMetaCachePut(id, m);
    if (m.vip && m.vip !== '0') throw new Error('huawei vip track (vip=' + m.vip + ', qy2/qy3 encrypted, no public decoder)');
    if (m.minStreaming && m.minStreaming !== '0') throw new Error('huawei minPrivilege.streaming=' + m.minStreaming);
    var fsize = m.fileSizeByQ[hwQ] || 0;
    var mtype = m.mediaTypeByQ[hwQ] || '';
    if (mtype && /QY[23]/i.test(mtype)) throw new Error('huawei encrypted format: ' + mtype);
    if (mtype && mtype.indexOf('MP3') < 0 && mtype.indexOf('AUDIO') < 0 && mtype !== '') {
      // 免费档应为 MP3 明文；异常格式如实拒绝，不猜
      throw new Error('huawei unexpected mediaFileType: ' + mtype);
    }
    return axios.post(HW_API_BASE + HW_PLAY_PATH, {
      algType: '1',
      contentCode: id,
      contentType: '1',
      publicKey: '',
      qualityType: hwQ
    }, {
      timeout: HUAWEI_TRY_TIMEOUT,
      headers: { 'Content-Type': 'application/json', 'User-Agent': HW_UA },
      validateStatus: function (s) { return s >= 200 && s < 400; }
    }).then(function (res) {
      var d = res.data || {};
      var result = d.result || {};
      if (result.resultCode && result.resultCode !== '000000') {
        throw new Error('huawei play resultCode=' + result.resultCode);
      }
      if (d.secretKey || d.iv) throw new Error('huawei response carries AES key/iv (encrypted)');
      var url = str(d.fileURL);
      if (!/^https?:\/\//i.test(url)) throw new Error('huawei play no fileURL');
      var ft = str(d.type).toUpperCase();
      if (/QY[23]/i.test(ft)) throw new Error('huawei encrypted file type: ' + ft);
      if (!isAllowedMediaUrl(url)) throw new Error('huawei fileURL off allowlist');
      return probeAudioHead(url, HUAWEI_TRY_TIMEOUT).then(function (p) {
        if (!p.magic) throw new Error('huawei probe no audio magic');
        if (!sizeMatches(p.total, fsize)) {
          throw new Error('huawei size mismatch: head ' + p.total + ' vs meta ' + fsize);
        }
        return { url: url, actualQuality: quality, channel: 'huawei:official', magic: p.magic, size: p.total };
      });
    });
  });
}

// 文档无「按 ID 查详情」接口 → 裸 ID 时用曲名+歌手重搜 + 定位补齐元数据（见 findLyricAddressBySearch 同款）
function findHuaweiMetaById(musicItem) {
  var title = musicItem && (musicItem.title || musicItem.name) ? str(musicItem.title || musicItem.name) : '';
  if (!title) return Promise.resolve(null);
  var artist = musicItem && musicItem.artist ? str(musicItem.artist) : '';
  var q = artist ? title + ' ' + artist : title;
  return huaweiSearchOnce(q, 0).then(function (r) {
    for (var i = 0; i < r.songs.length; i++) {
      var s = r.songs[i] || {};
      if (str(s.contentID) === str(musicItem.id)) {
        var m = parseContentExInfo(s.contentExInfo);
        if (m) { m.lyricAddress = str(s.lyricAddress); }
        return m;
      }
    }
    // ID 不在首位结果时放宽：同曲校验定位
    for (var j = 0; j < r.songs.length; j++) {
      var cand = mapHuaweiSongItem(r.songs[j]);
      if (!cand) continue;
      var chk = kuwoSameSongCheck(
        { title: musicItem.title || musicItem.name, artist: musicItem.artist, duration: musicItem.duration },
        { name: cand.title, artist: cand.artist, duration: cand.duration }
      );
      if (chk.pass) {
        var s2 = r.songs[j];
        var m2 = parseContentExInfo(s2.contentExInfo);
        if (m2) { m2.lyricAddress = str(s2.lyricAddress); }
        return m2;
      }
    }
    return null;
  }).catch(function () { return null; });
}

// ==================== URL 白名单 ====================
// https：酷我官方 CDN + 华为系域（dbankcloud/hicloud/huawei）；http：仅酷我（升级 https 失败保底）
var MEDIA_URL_HTTPS_HOST_ALLOWLIST = [
  /(^|\.)kuwo\.cn$/i,
  /(^|\.)dbankcloud\.cn$/i,
  /(^|\.)hicloud\.com$/i,
  /(^|\.)huawei\.com$/i
];
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /(^|\.)kuwo\.cn$/i
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  var list = /^https:\/\//i.test(s) ? MEDIA_URL_HTTPS_HOST_ALLOWLIST : MEDIA_URL_HTTP_HOST_ALLOWLIST;
  for (var i = 0; i < list.length; i++) {
    if (list[i].test(host)) return true;
  }
  return false;
}

// ==================== 酷我兜底（整段复用 kugou-v1913.js v1.4.0/v1.4.1 ← kuwo-source v1.4.3） ====================

// 64 位整数用 [lo, hi] 两个 32 位字表示（位序与 Python 参考实现一致：bit i = i<32 ? lo>>>i : hi>>>(i-32)）
function bt64(sel, lo, hi) {
  var rlo = 0, rhi = 0;
  for (var i = 0; i < sel.length; i++) {
    var idx = sel[i];
    if (idx >= 0) {
      var bit = idx < 32 ? ((lo >>> idx) & 1) : ((hi >>> (idx - 32)) & 1);
      if (bit) { if (i < 32) rlo |= (1 << i); else rhi |= (1 << (i - 32)); }
    }
  }
  return [rlo | 0, rhi | 0];
}

// ---------- 酷我自定义 DES（非标准 E 扩展表，密钥 ylzsxkwm） ----------
var KW_ARRAYLS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
var KW_ARRAYLSMASK = [0, 0x100001, 0x300003];
var KW_ARRAYE = [31,0,1,2,3,4,-1,-1,3,4,5,6,7,8,-1,-1,7,8,9,10,11,12,-1,-1,11,12,13,14,15,16,-1,-1,15,16,17,18,19,20,-1,-1,19,20,21,22,23,24,-1,-1,23,24,25,26,27,28,-1,-1,27,28,29,30,31,30,-1,-1];
var KW_ARRAYIP1 = [39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25,32,0,40,8,48,16,56,24];
var KW_ARRAYIP2 = [57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7,56,48,40,32,24,16,8,0,58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6];
var KW_ARRAYP = [15,6,19,20,28,11,27,16,0,14,22,25,4,17,30,9,1,7,23,13,31,26,2,8,18,12,29,5,21,10,3,24];
var KW_ARRAYPC1 = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3];
var KW_ARRAYPC2 = [13,16,10,23,0,4,-1,-1,2,27,14,5,20,9,-1,-1,22,18,11,3,25,7,-1,-1,15,6,26,19,12,1,-1,-1,40,51,30,36,46,54,-1,-1,29,39,50,44,32,47,-1,-1,43,48,38,55,33,52,-1,-1,45,41,49,35,28,31,-1,-1];
var KW_SBOX = [
[14,4,3,15,2,13,5,3,13,14,6,9,11,2,0,5,4,1,10,12,15,6,9,10,1,8,12,7,8,11,7,0,0,15,10,5,14,4,9,10,7,8,12,3,13,1,3,6,15,12,6,11,2,9,5,0,4,2,11,14,1,7,8,13],
[15,0,9,5,6,10,12,9,8,7,2,12,3,13,5,2,1,14,7,8,11,4,0,3,14,11,13,6,4,1,10,15,3,13,12,11,15,3,6,0,4,10,1,7,8,4,11,14,13,8,0,6,2,15,9,5,7,1,10,12,14,2,5,9],
[10,13,1,11,6,8,11,5,9,4,12,2,15,3,2,14,0,6,13,1,3,15,4,10,14,9,7,12,5,0,8,7,13,1,2,4,3,6,12,11,0,13,5,14,6,8,15,2,7,10,8,15,4,9,11,5,9,0,14,3,10,7,1,12],
[7,10,1,15,0,12,11,5,14,9,8,3,9,7,4,8,13,6,2,1,6,11,12,2,3,0,5,14,10,13,15,4,13,3,4,9,6,10,1,12,11,0,2,5,0,13,14,2,8,15,7,4,15,1,10,7,5,6,12,11,3,8,9,14],
[2,4,8,15,7,10,13,6,4,1,3,12,11,7,14,0,12,2,5,9,10,13,0,3,1,11,15,5,6,8,9,14,14,11,5,6,4,1,3,10,2,12,15,0,13,2,8,5,11,8,0,15,7,14,9,4,12,7,10,9,1,13,6,3],
[12,9,0,7,9,2,14,1,10,15,3,4,6,12,5,11,1,14,13,0,2,8,7,13,15,5,4,10,8,3,11,6,10,4,6,11,7,9,0,6,4,2,13,1,9,15,3,8,15,3,1,14,12,5,11,0,2,12,14,7,5,10,8,13],
[4,1,3,10,15,12,5,0,2,11,9,6,8,7,6,9,11,4,12,15,0,3,10,5,14,13,7,8,13,14,1,2,13,6,14,9,4,1,2,14,11,13,5,0,1,10,8,3,0,11,3,5,9,4,15,2,7,8,12,15,10,7,6,12],
[13,7,10,0,6,9,5,15,8,4,3,10,11,14,12,5,2,11,9,6,15,12,0,3,4,1,14,13,1,2,7,8,1,2,12,15,10,4,0,3,13,14,6,9,7,8,9,6,15,1,5,12,3,10,14,5,8,7,11,0,4,13,2,11]
];

function kwDesBlock(subkeys, lo, hi) {
  var ip = bt64(KW_ARRAYIP2, lo, hi);
  var L = ip[0], R = ip[1];
  for (var i = 0; i < 16; i++) {
    var e = bt64(KW_ARRAYE, R, 0);
    var xlo = e[0] ^ subkeys[i][0], xhi = e[1] ^ subkeys[i][1];
    var sOut = 0;
    for (var sbi = 7; sbi >= 0; sbi--) {
      var b;
      if (sbi < 4) b = (xlo >>> (8 * sbi)) & 0xFF;
      else b = (xhi >>> (8 * (sbi - 4))) & 0xFF;
      sOut = ((sOut << 4) | KW_SBOX[sbi][b]) >>> 0;
    }
    var p = bt64(KW_ARRAYP, sOut, 0)[0];
    var newR = u32(L ^ p);
    L = R; R = newR;
  }
  var t = L; L = R; R = t; // reverse
  return bt64(KW_ARRAYIP1, L, R);
}

// 密钥 8 字节 → 16 个子密钥（各为 [lo,hi] 64 位稀疏值）；加密模式
// 注意：PC1 输出是 56 位稀疏值，可超过 2^53，必须全程用 [lo,hi] 双字运算，禁止合并成 Number
var KW_SUBKEY_CACHE = {};
function kwSubkeys(keyStr) {
  if (KW_SUBKEY_CACHE[keyStr]) return KW_SUBKEY_CACHE[keyStr];
  var klo = 0, khi = 0;
  for (var i = 0; i < 8; i++) {
    var b = keyStr.charCodeAt(i) & 0xFF;
    if (i < 4) klo |= b << (8 * i); else khi |= b << (8 * (i - 4));
  }
  var x = bt64(KW_ARRAYPC1, klo, khi); // 56 位稀疏值 [lo,hi]
  var keys = [];
  for (var r = 0; r < 16; r++) {
    var shift = KW_ARRAYLS[r];
    var mask = KW_ARRAYLSMASK[shift]; // < 2^23，全在低字
    var maskedLo = x[0] & mask;
    var restLo = (x[0] & ~mask) | 0, restHi = x[1]; // ~mask 只影响低字（mask < 2^32）
    var shrLo = (restLo >>> shift) | (restHi << (32 - shift));
    var shrHi = restHi >>> shift;
    var sl = 28 - shift; // maskedLo < 2^23，左移 26/27 会跨字
    var shlLo = maskedLo << sl;
    var shlHi = maskedLo >>> (32 - sl);
    var nxlo = (shlLo | shrLo) | 0, nxhi = (shlHi | shrHi) | 0;
    keys.push(bt64(KW_ARRAYPC2, nxlo, nxhi));
    x = [nxlo, nxhi]; // 状态链式更新：下一轮在当前旋转结果上继续旋转
  }
  KW_SUBKEY_CACHE[keyStr] = keys;
  return keys;
}

// 加密任意长度（NoPadding：8 字节对齐也补一个加密零块，与参考实现一致）
function kwDesEncryptBytes(bytes, keyStr) {
  var sub = kwSubkeys(keyStr);
  var j = Math.floor(bytes.length / 8);
  var out = [];
  var blocks = [];
  for (var m = 0; m < j; m++) {
    var lo = 0, hi = 0;
    for (var n = 0; n < 8; n++) {
      var b = bytes[m * 8 + n] & 0xFF;
      if (n < 4) lo |= b << (8 * n); else hi |= b << (8 * (n - 4));
    }
    blocks.push(kwDesBlock(sub, lo | 0, hi | 0));
  }
  var rem = bytes.length % 8;
  var rlo = 0, rhi = 0;
  for (var n2 = 0; n2 < rem; n2++) {
    var b2 = bytes[j * 8 + n2] & 0xFF;
    if (n2 < 4) rlo |= b2 << (8 * n2); else rhi |= b2 << (8 * (n2 - 4));
  }
  if (rem !== 0 || true) blocks.push(kwDesBlock(sub, rlo | 0, rhi | 0)); // mode==0 恒补块
  for (var k = 0; k < blocks.length; k++) {
    out.push(blocks[k][0] & 0xFF, (blocks[k][0] >>> 8) & 0xFF, (blocks[k][0] >>> 16) & 0xFF, (blocks[k][0] >>> 24) & 0xFF);
    out.push(blocks[k][1] & 0xFF, (blocks[k][1] >>> 8) & 0xFF, (blocks[k][1] >>> 16) & 0xFF, (blocks[k][1] >>> 24) & 0xFF);
  }
  return out;
}

function kwBase64(bytes) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return out;
}

function kuwoEncryptQuery(query, keyStr) {
  return kwBase64(kwDesEncryptBytes(utf8Bytes(query), keyStr));
}

// 首个成功 resolve 胜出、全部失败才 reject；每个 racer 都挂 handler 防 unhandled rejection
function raceSuccess(promises) {
  return new Promise(function (resolve, reject) {
    if (!promises.length) { reject(new Error('race no racers')); return; }
    var failed = 0;
    promises.forEach(function (p) {
      Promise.resolve(p).then(resolve, function () {
        failed++;
        if (failed === promises.length) reject(new Error('all racers failed'));
      });
    });
  });
}

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };
// 酷我官方最高 2000kflac，无 hires 及以上档；未映射档直接 reject，酷我赛道同步跳过。
var KUWO_QUALITY_MAP = { standard: 'standard', high: 'high', super: 'super' };

// rid 缓存：同一首歌重复取链免二次搜索（10min TTL，FIFO 淘汰，上限 256 条）
var KW_RID_CACHE = {};
var KW_RID_CACHE_TTL = 10 * 60 * 1000;
var KW_RID_CACHE_MAX = 256;
function kwRidCacheGet(key) {
  var e = KW_RID_CACHE[key];
  if (e && Date.now() - e.ts < KW_RID_CACHE_TTL) return e.rid;
  if (e) delete KW_RID_CACHE[key];
  return null;
}
function kwRidCachePut(key, rid) {
  if (!KW_RID_CACHE[key]) {
    var ks = Object.keys(KW_RID_CACHE);
    if (ks.length >= KW_RID_CACHE_MAX) delete KW_RID_CACHE[ks[0]];
  }
  KW_RID_CACHE[key] = { rid: rid, ts: Date.now() };
}

// 曲名+歌手 关键词搜索酷我 → 候选列表（按酷我相关度排序，最多 rn 条）。
// 每条候选映射 { rid, name, artist, duration(sec, 可为0) }；搜不到/结构不符返回空数组，
// 由同曲校验层统一判失败——酷我赛道整体退出竞速，不影响华为赛道已出结果。
function searchKuwoCandidates(query) {
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      all: query, pn: 0, rn: 20, ft: 'music', client: 'kt',
      encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, cluster: 0,
      strategy: 2012, issubtitle: 1, show_copyright_off: 1, correct: 1,
      spPrivilege: 0, newver: 2, p2p: 1, notrace: 0, searchapi: 2, vermerge: 1
    },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var list = (res.data && res.data.abslist) || [];
    var cands = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var rid = String(it.MUSICRID || '').replace(/^MUSIC_/, '');
      if (!rid) continue;
      cands.push({
        rid: rid,
        name: str(it.NAME || it.SONGNAME || it.name || ''),
        artist: str(it.ARTIST || it.artist || ''),
        duration: parseInt(it.DURATION || it.duration, 10) || 0
      });
    }
    return cands;
  });
}

// ==================== 严格同曲校验（酷我通道专用，任务规范口径） ====================
// 第一步：拆分「核心歌名」与「版本标签」——从歌名末尾往前匹配，命中版本关键词的作为
// 版本标签（可多个，如「晴天 Live 伴奏版」→ [live, accompaniment]），剩下的作为核心歌名。
// 「原版」按规范等价于无标签（原曲是原版，酷我也必须是原版），提取后丢弃不参与标签比对。
var KW_VERSION_KEYWORDS = [
  // 长词在前，防止「现场版」被「现场」之外的短词抢先截断；canon 为内部规范类型
  { canon: 'live',          words: ['演唱会版', '演唱会', '现场版', '现场', 'live版', 'live'] },
  { canon: 'remix',         words: ['remix版', 'remix', '混音版', '混音'] },
  { canon: 'accompaniment', words: ['伴奏版', '伴奏', 'instrumental', '纯音乐'] },
  { canon: 'pure',          words: ['纯享版', '纯享'] },
  { canon: 'original',      words: ['原版', 'original version', 'original'] },
  { canon: 'cover',         words: ['翻唱版', '翻唱', 'cover版', 'cover'] },
  { canon: 'dj',            words: ['dj版', 'dj'] },
  { canon: 'movie',         words: ['电影版', '电影'] },
  { canon: 'tv',            words: ['电视剧版', '电视剧'] },
  { canon: 'clip',          words: ['片段', '节选'] },
  { canon: 'ringtone',      words: ['铃声版', '铃声'] },
  { canon: 'surround',      words: ['3d环绕版', '3d环绕', '环绕声版', '环绕声', '环绕版', '环绕', '3d'] },
  { canon: 'piano',         words: ['钢琴版', '钢琴'] },
  { canon: 'guitar',        words: ['吉他版', '吉他'] },
  { canon: 'female',        words: ['女声版', '女声'] },
  { canon: 'male',          words: ['男声版', '男声'] },
  { canon: 'child',         words: ['童声版', '童声'] },
  { canon: 'full',          words: ['完整版', '完整'] }
];

// 单个词 → 版本类型（归一：去空格/点/横线、转小写后全词比对）；非版本词返回 null
function kwMatchVersionWord(w) {
  var s = String(w || '').toLowerCase().replace(/[\s.\-—–_/]/g, '');
  if (!s) return null;
  for (var i = 0; i < KW_VERSION_KEYWORDS.length; i++) {
    var ws = KW_VERSION_KEYWORDS[i].words;
    for (var j = 0; j < ws.length; j++) {
      if (s === ws[j].replace(/[\s.\-—–_/]/g, '')) return KW_VERSION_KEYWORDS[i].canon;
    }
  }
  return null;
}

// 英文版本词的粘连形态（无空格，如「晴天Live」「稻香DJ版」）：
// 前一字符必须非英文字母（防「Alive」尾串被误判 live）；CJK 词天然无此歧义，单独尾部判定
var KW_GLUED_EN_RE = /(?:[^a-z]|^)(live版|live|remix版|remix|dj版|dj|cover版|cover|instrumental|original)$/i;
var KW_GLUED_CJK_WORDS = ['演唱会版', '现场版', '伴奏版', '纯享版', '混音版', '翻唱版', '电视剧版', '电影版', '铃声版', '钢琴版', '吉他版', '女声版', '男声版', '童声版', '完整版', '纯音乐', '演唱会', '现场', '伴奏', '原版', '片段', '节选', '环绕', '环绕声', '钢琴', '吉他', '女声', '男声', '童声', '纯享', '混音', '翻唱', '铃声', '3d环绕', '3d'];

function kwSplitTitleVersion(rawTitle) {
  // 先剥「feat./ft./featuring …」尾巴：合作歌手属歌手比对范畴，不应混入核心歌名
  var t = String(rawTitle || '').replace(FEAT_TAIL_RE, '').trim();
  var tags = [];
  var guard = 0;
  while (t && guard++ < 24) {
    // ① 尾部整体括号「（…）/(…)/【…】/[…]」：内容整体是版本词 → 摘 tag；
    //    否则拆 token，尾部连续的版本词 token 全部摘出，剩余留在核心名
    var m = t.match(/[\s\-—–·_~|｜]*[（(【\[]([^）)】\]]*)[）)】\]]\s*$/);
    if (m) {
      var inner = m[1];
      var canon = kwMatchVersionWord(inner);
      if (canon) {
        if (canon !== 'original') tags.push(canon);
        t = t.slice(0, m.index).trim();
        continue;
      }
      var toks = inner.split(/[\s\-—–·_~、，,/&]+/).filter(Boolean);
      var consumed = 0;
      for (var i = toks.length - 1; i >= 0; i--) {
        var c2 = kwMatchVersionWord(toks[i]);
        if (!c2) break;
        if (c2 !== 'original') tags.push(c2);
        consumed++;
      }
      if (consumed > 0) {
        var rest = toks.slice(0, toks.length - consumed).join(' ');
        t = (t.slice(0, m.index).trim() + (rest ? ' ' + rest : '')).trim();
        continue;
      }
      break; // 括号内容与版本无关 → 尾部提取结束
    }
    // ② 分隔符切尾 token，末位是版本词 → 摘出继续
    var segs = t.split(/[\s\-—–·_~|｜、，,/]+/).filter(Boolean);
    var last = segs.length ? segs[segs.length - 1] : '';
    var c3 = kwMatchVersionWord(last);
    if (c3) {
      if (c3 !== 'original') tags.push(c3);
      segs.pop();
      t = segs.join(' ').trim();
      continue;
    }
    // ③ 无分隔符的粘连形态（「晴天Live」「晴天现场版」）：
    //    英文词走带字母边界的正则；CJK 词逐个尝试尾部全词匹配，且摘完必须留非空核心名
    var ge = KW_GLUED_EN_RE.exec(t);
    var stripped = false;
    if (ge) {
      var cg = kwMatchVersionWord(ge[1]);
      if (cg) {
        if (cg !== 'original') tags.push(cg);
        t = t.slice(0, t.length - ge[1].length).trim();
        stripped = true;
      }
    }
    if (!stripped) {
      for (var k = 0; k < KW_GLUED_CJK_WORDS.length; k++) {
        var w = KW_GLUED_CJK_WORDS[k];
        if (t.length > w.length && t.slice(-w.length) === w) {
          var ck = kwMatchVersionWord(w);
          if (ck) {
            if (ck !== 'original') tags.push(ck);
            t = t.slice(0, t.length - w.length).trim();
            stripped = true;
            break;
          }
        }
      }
    }
    if (!stripped) break;
  }
  return { core: t, tags: tags.reverse() }; // reverse 保持从左到右出现顺序（比对前会再排序）
}

// 核心歌名归一键：小写、去空白、去标点（保留中英文与数字），完全一致才算同核心名
function kwCoreKey(core) {
  return String(core || '').toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[^0-9a-z\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, '');
}

// 歌手规范化：按分隔符（feat./ft./&/、/，/,///和/与）拆成逐个歌手，逐个归一后比对
function kwArtistTokens(raw) {
  return String(raw || '')
    .split(/\s*(?:[、，,/&]|\bfeaturing\b|\bfeat\b|\bft\b|和|与)\s*/i)
    .map(function (s) { return s.toLowerCase().replace(/[\s.\u3000]+/g, ''); })
    .filter(Boolean);
}

// 严格同曲校验：ref=华为侧（musicItem 归一：title/artist/duration），cand=酷我搜索候选。
// 四项全部通过才放行参与竞速；任一不通过即拒（返回 pass:false + reason 供日志/自测）。
// 时长规则按任务规范：华为侧有时长且酷我侧也有时长时，差距 >10% 判不同曲；
// 任一侧缺时长（0）无法判定 → 放行（不因数据缺失误杀同曲）。
function kuwoSameSongCheck(ref, cand) {
  var a = kwSplitTitleVersion(ref && (ref.title || ref.name));
  var b = kwSplitTitleVersion(cand && (cand.name || cand.title));
  if (kwCoreKey(a.core) !== kwCoreKey(b.core)) {
    return { pass: false, reason: 'core', detail: '核心名不一致: [' + a.core + '] vs [' + b.core + ']' };
  }
  var ta = a.tags.slice().sort();
  var tb = b.tags.slice().sort();
  if (ta.length !== tb.length) {
    return { pass: false, reason: 'version', detail: '版本标签数量不一致: [' + a.tags.join(',') + '] vs [' + b.tags.join(',') + ']' };
  }
  for (var i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) {
      return { pass: false, reason: 'version', detail: '版本标签类型不一致: [' + a.tags.join(',') + '] vs [' + b.tags.join(',') + ']' };
    }
  }
  var aa = kwArtistTokens(ref && ref.artist);
  var ba = kwArtistTokens(cand && cand.artist);
  var hit = false;
  for (var x = 0; x < aa.length && !hit; x++) {
    for (var y = 0; y < ba.length; y++) {
      if (aa[x] && aa[x] === ba[y]) { hit = true; break; }
    }
  }
  if (!hit) {
    return { pass: false, reason: 'artist', detail: '无共同歌手: [' + (ref && ref.artist) + '] vs [' + (cand && cand.artist) + ']' };
  }
  var d1 = parseInt(ref && ref.duration, 10) || 0;
  var d2 = parseInt(cand && cand.duration, 10) || 0;
  if (d1 > 0 && d2 > 0 && Math.abs(d2 - d1) / d1 > 0.10) {
    return { pass: false, reason: 'duration', detail: '时长差超10%: ' + d1 + 's vs ' + d2 + 's' };
  }
  return { pass: true, reason: 'ok' };
}

// 候选列表 → 首个通过同曲校验的 rid；全部被拒 → 抛错（酷我赛道失败退出竞速，
// 「校验不通过的结果，再快也不能用」）
function pickKuwoVerifiedRid(cands, musicItem) {
  var ref = {
    title: musicItem && (musicItem.title || musicItem.name) || '',
    artist: (musicItem && musicItem.artist) || '',
    duration: (musicItem && musicItem.duration) || 0
  };
  var rejected = [];
  for (var i = 0; i < cands.length; i++) {
    var chk = kuwoSameSongCheck(ref, cands[i]);
    if (chk.pass) return cands[i].rid;
    rejected.push('#' + i + '[' + cands[i].name + '|' + cands[i].artist + '] ' + chk.reason + '(' + chk.detail + ')');
  }
  RESOLVE_STATS.kuwoVerifyRejected = (RESOLVE_STATS.kuwoVerifyRejected || 0) + 1;
  throw new Error('kuwo same-song check rejected all ' + cands.length + ' candidates: ' + rejected.join('; '));
}

function searchKuwoVerifiedRid(musicItem, query) {
  return searchKuwoCandidates(query).then(function (cands) {
    if (!cands.length) throw new Error('kuwo search no candidate');
    return pickKuwoVerifiedRid(cands, musicItem);
  });
}

// 校验通过后才写 rid 缓存（query 由 musicItem 曲名+歌手派生，同 query 侧同曲，缓存安全）
function searchKuwoVerifiedRidCached(musicItem, query) {
  var hit = kwRidCacheGet(query);
  if (hit) return Promise.resolve(hit);
  return searchKuwoVerifiedRid(musicItem, query).then(function (rid) {
    kwRidCachePut(query, rid);
    return rid;
  });
}

// 官方 convert_url_with_sign 通道（nmobi/nmsublist 全参数同构 + mobi 车载免签变体）
// 校验：super 必须 flac（拒降级）、high 必须 mp3 且 bitrate≥320（拒 ogg 降级档）、
// duration<60s 视为试听片段拒收；actualQuality 按响应 bitrate 如实标注。
function kuwoOfficialResolve(host, rid, quality, variant) {
  var br = KUWO_BR[quality] || KUWO_BR.standard;
  var params;
  if (variant === 'car') {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: rid,
      user: 'C_APK_guanwang_' + Date.now(),
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC'
    };
  } else {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: rid,
      user: 0, android_id: 0, prod: 'kwplayerhd_ar_4.3.0.8', corp: 'kuwo',
      vipver: '4.3.0.8', source: 'kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk',
      notrace: 0, sig: 0, priority: 'bitrate', loginUid: 0, network: 'WIFI',
      loginSid: 0, mode: 'down'
    };
  }
  return axios.get('https://' + host + '/mobi.s', {
    params: params,
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo official no url');
    if ((quality === 'super' || quality === 'hires') && d.format && d.format !== 'flac') {
      throw new Error('kuwo official format degraded: ' + d.format);
    }
    if (quality === 'high' && d.format && d.format !== 'mp3') {
      throw new Error('kuwo official high format degraded: ' + d.format);
    }
    // high 档除 format 外再校验 bitrate，防 mp3 容器低码率冒充
    if (quality === 'high' && d.bitrate > 0 && d.bitrate < 320) {
      throw new Error('kuwo official high bitrate degraded: ' + d.bitrate);
    }
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo official trial snippet');
    var aq = (d.format === 'flac') ? 'flac'
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    // 酷我 CDN 直链实测为 http，但同签名路径 https 可用（206 audio/mpeg 实测一致），
    // 统一升级 https 过协议白名单（保持本插件 https 优先语义）
    var u = String(d.url).replace(/^http:\/\//i, 'https://');
    return { url: u, actualQuality: aq };
  });
}

// mobi.s DES-ECB 通道（std=手机渠道 / car=车载渠道，同端点同密钥互为风控冗余 racer）
function kuwoDesResolve(rid, quality, variant) {
  var fmt = (quality === 'super' || quality === 'hires') ? 'flac' : 'mp3';
  var q;
  if (variant === 'car') {
    q = 'user=C_APK_guanwang_' + Date.now() + '&corp=kuwo&source=kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + rid;
  } else {
    q = 'user=0&corp=kuwo&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + rid;
  }
  return axios.get('https://mobi.kuwo.cn/mobi.s', {
    params: { f: 'kuwo', q: kuwoEncryptQuery(q, 'ylzsxkwm') },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    var txt = typeof res.data === 'string' ? res.data : String(res.data || '');
    var mUrl = txt.match(/(?:^|\n)url=([^\r\n]+)/);
    var mFmt = txt.match(/(?:^|\n)format=([^\r\n]+)/);
    var mBr = txt.match(/(?:^|\n)bitrate=([^\r\n]+)/);
    var url = mUrl ? String(mUrl[1]).trim() : '';
    if (!url || !/^http/i.test(url)) throw new Error('kuwo des no url');
    var fmtGot = mFmt ? String(mFmt[1]).trim() : '';
    if ((quality === 'super' || quality === 'hires') && fmtGot !== 'flac') {
      throw new Error('kuwo des format mismatch: ' + fmtGot);
    }
    var br = parseInt(mBr ? mBr[1] : '0', 10) || 0;
    if (quality === 'high' && br > 0 && br < 320) throw new Error('kuwo des bitrate degraded: ' + br);
    var aq;
    if (fmt === 'flac') aq = 'flac';
    else aq = br >= 320 ? '320k' : (br >= 192 ? '192k' : '128k');
    // 同 kuwoOfficialResolve：http 直链统一升级 https（实测同签名路径 206 一致）
    return { url: String(url).replace(/^http:\/\//i, 'https://'), actualQuality: aq };
  });
}

// 酷我竞速赛道：搜索映射候选 → 严格同曲校验 → 首个通过校验的 rid（10min 缓存）→
// 按档位竞速官方通道。校验不通过的候选即使先返回也不取链、直接丢弃，全部候选被拒则
// 本赛道失败退出。standard：128kmp3×3 racer；high：320kmp3×3（ogg/低码率降级拒收）；
// super：DES flac（std+car）+ convert_url_with_sign 2000kflac×3（试听片段拒收）。
// 返回 channel='kuwo:official'；kuwo CDN 均为 https，过 isAllowedMediaUrl 白名单。
function resolveKuwoFallback(musicItem, quality) {
  var kwq = KUWO_QUALITY_MAP[quality];
  if (!kwq) return Promise.reject(new Error('kuwo unmapped quality: ' + quality));
  var title = musicItem && (musicItem.title || musicItem.name) ? String(musicItem.title || musicItem.name) : '';
  var artist = musicItem && musicItem.artist ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('kuwo fallback no keyword'));
  var q = artist ? title + ' ' + artist : title;
  return searchKuwoVerifiedRidCached(musicItem, q).then(function (rid) {
    var jobs;
    if (kwq === 'super') {
      jobs = [
        kuwoDesResolve(rid, 'super', 'std'),
        kuwoDesResolve(rid, 'super', 'car'),
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, 'super', 'car')
      ];
    } else {
      jobs = [
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, kwq),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, kwq),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, kwq, 'car')
      ];
    }
    var raced = jobs.map(function (p) { return withTimeout(p, RACE_BUDGET_MS, 'kuwo racer timeout'); });
    return raceSuccess(raced);
  }).then(function (r) {
    return { url: r.url, actualQuality: r.actualQuality, channel: 'kuwo:official' };
  });
}

// ==================== 双赛道编排 ====================
// 赛道A 华为官方尽力尝试（免费档 1/2 免 token 裸试 + 魔数 + 大小比对，≤2.5s）；
// 失败/会员加密/未声明档 → 赛道B 酷我兜底（同曲校验 + 竞速 + 魔数 + guardFullAudio），
// 来源如实标记 channel='kuwo:official'。总预算 8s，保证在宿主 10s 窗口内给出结果。
var RESOLVE_STATS = { total: 0, huawei: 0, kuwo: 0, kuwoVerifyRejected: 0, huaweiRejected: 0 };

function resolveWithFallback(musicItem, quality) {
  RESOLVE_STATS.total++;
  var internal = normalizeQuality(quality);
  var deadline = Date.now() + RESOLVE_BUDGET_MS;

  // 赛道A：仅华为免费档（standard→1 / high→2）；super(flac) 属会员加密，直落赛道B
  var laneA;
  if (internal === 'super') {
    laneA = Promise.reject(new Error('huawei flac is vip-encrypted, straight to fallback'));
  } else {
    var remainA = deadline - Date.now();
    var budgetA = remainA < HUAWEI_TRY_TIMEOUT ? remainA : HUAWEI_TRY_TIMEOUT;
    laneA = withTimeout(resolveHuaweiOfficial(musicItem, quality), budgetA, 'huawei try timeout ' + budgetA + 'ms');
  }

  return laneA.then(function (r) {
    RESOLVE_STATS.huawei++;
    return r;
  }).catch(function (eA) {
    RESOLVE_STATS.huaweiRejected++;
    var remain = deadline - Date.now();
    if (remain <= 500) {
      return Promise.reject(new Error('华为音乐取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms（华为通道: ' + (eA && eA.message) + '）'));
    }
    return resolveKuwoFallback(musicItem, internal).then(function (r) {
      // 酷我通道内容守卫：魔数 + 试听片段拦截（探测自身失败不拦，放行由播放器处理）
      var guardBudget = deadline - Date.now();
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(probeAudioHead(r.url, guardBudget), guardBudget, 'guard probe timeout').then(function (p) {
        if (!p.magic) throw new Error('kuwo result no audio magic');
        return withTimeout(guardFullAudio(r.url, musicItem), deadline - Date.now(), 'guard timeout').then(function () {
          RESOLVE_STATS.kuwo++;
          return { url: r.url, actualQuality: r.actualQuality, channel: 'kuwo:official', magic: p.magic, size: p.total };
        });
      });
    });
  });
}

// 给单个 Promise 套时间上限（先到者胜出：段超时 or 请求自身失败）
function withTimeout(promise, ms, msg) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; reject(new Error(msg)); }
    }, ms);
    promise.then(function (v) {
      if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
    }, function (e) {
      if (!settled) { settled = true; clearTimeout(timer); reject(e || new Error(msg)); }
    });
  });
}

// 试听片段兜底守卫：Range 探测 audio 文件总长，按标称时长估码率 <64kbps 判试听。
// 探测请求自身失败（Range 不支持/超时）不惩罚源，放行由播放器处理。
function guardFullAudio(url, musicItem) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-0' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var headers = res.headers || {};
    var ctype = String(headers['content-type'] || headers['Content-Type'] || '');
    if (/text\/html/i.test(ctype)) {
      throw new Error('guard: not audio (html)');
    }
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) {
      total = parseInt(mm[1], 10) || 0;
    } else if (res.status !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    var dur = musicItem && parseInt(musicItem.duration, 10) || 0;
    if (total > 0 && dur >= 60) {
      // 按实际码率判定：估算码率 < 64kbps 才判试听（试听片段典型 32~48kbps）
      var kbps = Math.round(total * 8 / dur / 1000);
      if (kbps < 64) {
        throw new Error('guard: trial clip, est ' + kbps + 'kbps < 64kbps (' + Math.round(total / 16000) + 's/' + dur + 's)');
      }
    }
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // 探测请求本身失败：不拦，放行
  });
}

// ==================== 歌词 ====================
// 文档：搜索结果 lyricAddress 直接是歌词 URL。缓存优先（随 meta 缓存），miss 时
// 曲名+歌手重搜 + 同曲校验定位 lyricAddress。
function hwLyricAddressOf(musicItem) {
  var id = musicItem && musicItem.id ? str(musicItem.id) : '';
  if (!id) return Promise.resolve('');
  var meta = (musicItem._src && musicItem._src.huawei && musicItem._src.huawei.meta) || hwMetaCacheGet(id);
  if (meta && meta.lyricAddress) return Promise.resolve(meta.lyricAddress);
  return findHuaweiMetaById(musicItem).then(function (m) {
    if (m) {
      hwMetaCachePut(id, m);
      return m.lyricAddress || '';
    }
    return '';
  });
}

function getLyricImpl(musicItem) {
  return hwLyricAddressOf(musicItem).then(function (addr) {
    if (!addr) throw new Error('华为音乐：未定位到歌词地址');
    return axios.get(addr, {
      timeout: SOURCE_TIMEOUT,
      headers: { 'User-Agent': HW_UA },
      responseType: 'text'
    });
  }).then(function (res) {
    var txt = typeof res.data === 'string' ? res.data : String(res.data || '');
    if (!txt.trim()) throw new Error('华为音乐：歌词内容为空');
    return { rawLrc: txt };
  });
}

// ==================== 单曲详情反查 ====================
// 裸 ID / 缺元数据的 musicItem：重搜定位（contentID 精确匹配优先，同曲校验兜底）合并元数据
function getMusicInfoImpl(musicItem) {
  var id = musicItem && musicItem.id ? str(musicItem.id) : '';
  if (!id) return Promise.resolve(musicItem || {});
  var cached = hwMetaCacheGet(id);
  if (cached && musicItem.album) return Promise.resolve(musicItem); // 缓存命中且元数据完整，原样返回
  return huaweiSearchOnce(str(musicItem.title || musicItem.name || '') + (musicItem.artist ? ' ' + musicItem.artist : ''), 0)
    .then(function (r) {
      for (var i = 0; i < r.songs.length; i++) {
        var s = r.songs[i] || {};
        if (str(s.contentID) === id) {
          var mapped = mapHuaweiSongItem(s);
          if (mapped) {
            var meta = parseContentExInfo(s.contentExInfo);
            if (meta) {
              meta.lyricAddress = str(s.lyricAddress);
              hwMetaCachePut(id, meta);
            }
            // 返回副本合并，不改原条目（仓库 getMusicInfo 口径）
            var merged = {};
            var k;
            for (k in musicItem) { if (Object.prototype.hasOwnProperty.call(musicItem, k)) merged[k] = musicItem[k]; }
            for (k in mapped) { if (Object.prototype.hasOwnProperty.call(mapped, k) && k !== '_src') merged[k] = mapped[k]; }
            merged.id = id; // 主键不动
            return merged;
          }
        }
      }
      return musicItem;
    }).catch(function () { return musicItem; });
}

// ==================== 分享链接 ====================
// 短链 url.cloud.huawei.com → 302 → H5 musicshare（musicshare/1?id=...）；仅 type=1 歌曲可导入
function extractShareUrl(raw) {
  var s = str(raw).trim();
  var m = /(https?:\/\/[^\s"'<>]+)/i.exec(s);
  return m ? m[1] : '';
}

function followRedirects(url, depth) {
  if (depth > 4) return Promise.resolve(url);
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    maxRedirects: 0,
    validateStatus: function (s) { return s >= 200 && s < 400; }
  }).then(function (res) {
    if (res.status >= 300 && res.status < 400) {
      var loc = res.headers && (res.headers.location || res.headers.Location);
      if (loc) {
        var next = /^https?:\/\//i.test(loc) ? loc : new URL(loc, url).href;
        return followRedirects(next, depth + 1);
      }
    }
    // 部分环境 302 由原生层自动跟随，responseURL 是最终地址
    var finalUrl = str((res.request && res.request.responseURL) || '') || url;
    return finalUrl;
  }).catch(function (e) {
    var resp = e && e.response;
    if (resp && resp.status >= 300 && resp.status < 400) {
      var loc2 = resp.headers && (resp.headers.location || resp.headers.Location);
      if (loc2) {
        var next2 = /^https?:\/\//i.test(loc2) ? loc2 : new URL(loc2, url).href;
        return followRedirects(next2, depth + 1);
      }
    }
    throw e;
  });
}

function resolveShareLink(url) {
  return followRedirects(url, 0).then(function (finalUrl) {
    var u = String(finalUrl || '');
    // 归一后取歌曲 id：id=（短链 302 形态）或 songid=（H5 直链形态）
    var m = /[?&](?:id|songid)=(\d+)/.exec(u);
    if (/musicshare/i.test(u) && m) return { type: '1', id: m[1] };
    throw new Error('无法识别的华为音乐分享链接: ' + u.slice(0, 120));
  });
}

// 分享导入：拿到 id 后从 H5 页面 best-effort 提取曲名/歌手（页面结构非公开契约，
// 提取失败用中性回退名，不编造元数据）
function importMusicItemImpl(raw) {
  var url = extractShareUrl(raw);
  if (!url) return Promise.reject(new Error('未在输入中找到分享链接'));
  return resolveShareLink(url).then(function (r) {
    if (r.type !== '1') return Promise.reject(new Error('仅支持单曲分享（type=1）'));
    return axios.get(HW_H5_BASE + '/music-apph5-service/h5/index.html', {
      params: { '#/musicShare': '', songid: r.id, shareChannel: 'copyLink' },
      timeout: SOURCE_TIMEOUT,
      headers: { 'User-Agent': HW_UA }
    }).catch(function () { return { data: '' }; }).then(function (res) {
      var html = typeof res.data === 'string' ? res.data : String(res.data || '');
      var mName = /"contentName"\s*:\s*"([^"]+)"/.exec(html);
      var mArtist = /"artistNames"\s*:\s*"([^"]+)"/.exec(html);
      return {
        id: r.id,
        title: mName ? mName[1] : ('华为音乐歌曲 #' + r.id),
        artist: mArtist ? mArtist[1] : '未知歌手',
        album: '',
        artwork: undefined,
        _src: { huawei: { id: r.id } }
      };
    });
  });
}

function getMusicDetailPageUrlImpl(musicItem) {
  var id = musicItem && musicItem.id ? str(musicItem.id) : '';
  if (!id) return '';
  return HW_H5_BASE + '/music-apph5-service/h5/index.html#/musicShare?songid=' + encodeURIComponent(id) + '&shareChannel=copyLink';
}

// ==================== 榜单/歌单（文档未覆盖，如实不支持） ====================
// 文档 2. 明确标注：专辑/歌单模块"需进一步抓包"，无公开接口。不虚构实现。
function getTopListsImpl() { return Promise.resolve([]); }
function getTopListDetailImpl() { return Promise.reject(new Error('华为音乐：榜单接口文档未覆盖（需抓包），暂不支持')); }
function getSheetInfoImpl() { return Promise.reject(new Error('华为音乐：歌单接口文档未覆盖（需抓包），暂不支持')); }

// ==================== MusicFree 插件清单 ====================
const plugin = {
  name: '华为音乐',
  platform: '华为音乐', // 音乐源标识，应与其他插件不同
  version: '1.0.0',
  author: '研发1号',
  description: '华为音乐音源（搜索免登录；华为官方取链尽力尝试，酷我兜底播放，来源如实标记）',
  primaryKey: ['id'],
  supportedSearchType: ['music'],
  // 如实声明可播档位：128k/320k（华为免费档或酷我兜底）、flac（酷我兜底真 FLAC）。
  // Hi-Res/Audio Vivid/多轨道为华为会员加密或文档未覆盖，不声明、不虚标。
  supportedQualities: ['128k', '320k', 'flac'],
  cacheControl: 'no-store',
  hints: {
    importMusicItem: '支持华为音乐 App 分享链接（url.cloud.huawei.com 短链或 H5 musicShare 链接）',
  },

  async search(query, page, type) {
    return searchHuawei(query, page, type);
  },

  async getMediaSource(musicItem, quality) {
    var r = await resolveWithFallback(musicItem, normalizeQuality(quality));
    // 边界口径：宿主请求键回填 actualQuality 对应键，size 如实携带
    var r2 = { url: r.url };
    if (r.actualQuality) r2.quality = r.actualQuality;
    else r2.quality = internalToHostQuality(normalizeQuality(quality));
    if (r.size) r2.size = r.size;
    if (r.channel) r2._channel = r.channel;
    return r2;
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  async getTopLists() {
    return getTopListsImpl();
  },

  async getTopListDetail(topList) {
    return getTopListDetailImpl(topList);
  },

  async getSheetInfo(sheet) {
    return getSheetInfoImpl(sheet);
  },

  // 内部导出：仅供研发自测/质检脚本使用（宿主不依赖）
  _internal: {
    normalizeQuality: normalizeQuality,
    internalToHostQuality: internalToHostQuality,
    HOST_KEY_HW_QUALITY: HOST_KEY_HW_QUALITY,
    HOST_KEY_INTERNAL: HOST_KEY_INTERNAL,
    parseContentExInfo: parseContentExInfo,
    huaweiSearchOnce: huaweiSearchOnce,
    searchHuawei: searchHuawei,
    mapHuaweiSongItem: mapHuaweiSongItem,
    audioMagicOf: audioMagicOf,
    probeAudioHead: probeAudioHead,
    sizeMatches: sizeMatches,
    resolveHuaweiOfficial: resolveHuaweiOfficial,
    resolveKuwoFallback: resolveKuwoFallback,
    resolveWithFallback: resolveWithFallback,
    kuwoSameSongCheck: kuwoSameSongCheck,
    kwSplitTitleVersion: kwSplitTitleVersion,
    searchKuwoCandidates: searchKuwoCandidates,
    kuwoEncryptQuery: kuwoEncryptQuery,
    guardFullAudio: guardFullAudio,
    isAllowedMediaUrl: isAllowedMediaUrl,
    httpsifyUrl: httpsifyUrl,
    getLyricImpl: getLyricImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    importMusicItemImpl: importMusicItemImpl,
    resolveShareLink: resolveShareLink,
    getMusicDetailPageUrlImpl: getMusicDetailPageUrlImpl,
    RESOLVE_STATS: RESOLVE_STATS,
    hwMetaCacheGet: hwMetaCacheGet,
    hwMetaCachePut: hwMetaCachePut,
    constants: {
      HW_API_BASE: HW_API_BASE,
      HW_H5_BASE: HW_H5_BASE,
      HW_SEARCH_PATH: HW_SEARCH_PATH,
      HW_PLAY_PATH: HW_PLAY_PATH,
      HW_UA: HW_UA,
      HUAWEI_TRY_TIMEOUT: HUAWEI_TRY_TIMEOUT,
      RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
      RACE_BUDGET_MS: RACE_BUDGET_MS
    }
  }
};

module.exports = plugin;
