// ============================================================
// MusicFree 插件：网易云电台（neteaseradio）
// 数据来源：music.163.com 官方接口（weapi 加密链）
// 移植基础：GuGuMur/MusicFreePlugin-NeteaseRadio（MIT License,
//   Copyright (c) 2023 猫头猫 & 咕咕mur）+ 本仓修复，见 changelog。
//
// changelog v1.1.0（相对 v1.0.0，作者 研发1号）：
//   1. 放开 VIP 过滤：getAlbumInfoImpl 不再按 feeScope==0/8 过滤节目，
//      VIP 节目（feeScope≠0/8）进入列表；仅过滤缺 mainSong.id 的不可播条目。
//      条目带 _vip 标记，播放时路由到第三方取链。
//   2. 移植网易云插件 v1.9.15 第三方取链体系（standard 档口径）到电台插件：
//      官方 128k ⇄ outer/url 竞速（免费节目优先）→ 失败后第三方接力链：
//      ikun → 星海 zddyr（长青 SVIP 故障替补）→ 笒鬼鬼 cenguigui →
//      oiapi → bugpk → 海棠 wy.php 直连（music.haitangw.cc，302/JSON 双形态）
//      → outer/url 终极兜底。VIP 节目跳过官方段直达第三方链。
//   3. 全部通道按「请求哪个音质取哪个音质」：电台节目仅 standard（128k mp3）
//      一档，第三方请求对应 standard 档（wy.php level=standard、zddyr
//      quality=128k、ikun quality=128k、cenguigui level=standard、oiapi
//      quality=128、bugpk level=standard）。
//   4. 质量校验机制完整继承（对齐 v1.9.14/1.9.15 口径）：
//      - 魔数探测校验（Range 0-15）：standard 请求必须 ID3/mp3 sync，
//        检出 fLaC/OggS 视为虚标拒收接力；探测失败（Range 不支持/超时）
//        不惩罚放行（对齐 swProbeMagic 有损档口径）。
//      - 长青端点直出音频流，Range 探测内建魔数 + Content-Range 总长校验
//        （selfChecked，免二次探测）；官方 128k 通道免守卫（freeTrialInfo
//        已在适配器内拦截）。
//      - 大小校验 guardCheckSize：按 128kbps 估算时长 vs 标称时长 60%
//        判试听片段（cenguigui size 字符串经 parseMbSize 转真实字节；
//        无 size 字段的通道由 Range 探测 Content-Range 兜底）。
//      - URL 协议/域名白名单（http 仅放行 *.126.net / *.163.com /
//        *.163cn.tv，https 一律放行）。
//   5. 全局 8s 取链预算 + 分段超时（官方段 4500ms / 接力段 2500ms，
//      长青探测 4500ms——其 Range 实测延迟 1.4~4.1s，2500ms 会掐死替补）
//      + 失败负缓存（60s TTL）+ 成功缓存（LRU 200 条 / 30min TTL）。
//   6. channel 标签区分来源（neteaseradio-official-128k /
//      neteaseradio-outer-url / neteaseradio-ikun / neteaseradio-zddyr /
//      neteaseradio-longqing-wy-php / neteaseradio-cenguigui /
//      neteaseradio-oiapi / neteaseradio-bugpk /
//      neteaseradio-haitang-wy-php），便于每日健康探测归因。
//   7. 顶层加 name 字段「网易云电台」（对齐网易云插件中文化惯例）。
//
// changelog v1.0.0（相对上游 0.0.2 的修复）：
//   1. getAlbumInfo isEnd 修复：上游 `res.programs <= page*pageSize`
//      是数组与数字比较（恒 false），改为 `res.count <= page*pageSize`。
//   2. 搜索 isEnd 修复：上游用 result.albumCount，实测响应无该字段，
//      改用实测存在的 result.djRadiosCount。
//   3. getLyric 修复：上游 weapi POST /api/dj/program/detail 实测
//      400 参数错误（接口已不可用），改用官方 /api/song/lyric
//      （免费免登录，本仓网易源插件生产在用）；电台节目多无歌词，
//      无则如实返回空。
//   4. 主播搜索不再逐个 N+1 请求 worksNum（去掉 byuser 循环）。
//   5. 封面 http→https 规范化（p1-p4.music.126.net 支持 https）。
// ============================================================
var axios = require('axios');
var CryptoJs = require('crypto-js');
var qs = require('qs');
var bigInt = require('big-integer');

var HEADERS = {
    authority: 'music.163.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36',
    'content-type': 'application/x-www-form-urlencoded',
    accept: '*/*',
    origin: 'https://music.163.com',
    referer: 'https://music.163.com/',
    'accept-language': 'zh-CN,zh;q=0.9',
};

var PAGE_SIZE = 30;

// ==================== 取链超时常量（对齐 v1.9.15） ====================
var SOURCE_TIMEOUT = 4500;    // 官方段/长青探测单请求超时（沙箱单方法 10s 硬上限内）
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
var RELAY_TIMEOUT = 2500;     // 第三方接力段单请求超时

// ---------- weapi 加密链（与官方一致：AES-CBC 双重加密 + RSA NoPadding） ----------
function random16() {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var s = '';
    for (var i = 0; i < 16; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}

function aesEncrypt(text, key) {
    return CryptoJs.AES.encrypt(
        CryptoJs.enc.Utf8.parse(text),
        CryptoJs.enc.Utf8.parse(key),
        { iv: CryptoJs.enc.Utf8.parse('0102030405060708'), mode: CryptoJs.mode.CBC }
    ).toString();
}

function rsaEncrypt(text) {
    var reversed = text.split('').reverse().join('');
    var hex = '';
    for (var i = 0; i < reversed.length; i++) {
        hex += reversed.charCodeAt(i).toString(16);
    }
    var pubKey = '010001';
    var modulus =
        '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
    var res = bigInt(hex, 16).modPow(bigInt(pubKey, 16), bigInt(modulus, 16)).toString(16);
    while (res.length < 256) {
        res = '0' + res;
    }
    return res;
}

function getParamsAndEnc(text) {
    var secret = random16();
    return {
        params: aesEncrypt(aesEncrypt(text, '0CoJUm6Qyw8W8jud'), secret),
        encSecKey: rsaEncrypt(secret),
    };
}

function weapiPost(url, payload) {
    var body = qs.stringify(getParamsAndEnc(JSON.stringify(payload)));
    return axios({
        method: 'post',
        url: url,
        headers: HEADERS,
        data: body,
        timeout: 10000,
    }).then(function (r) { return r.data; });
}

// ---------- 工具 ----------
function httpsPic(url) {
    if (url && url.indexOf('http://') === 0) {
        return 'https://' + url.slice(7);
    }
    return url;
}

// [v1.1.0] 放开 VIP 过滤：仅过滤缺 mainSong.id 的不可播条目。
// VIP（feeScope≠0/8）节目进入列表，条目带 _vip 标记，播放时走第三方通道。
// 数字专辑/无版权节目在 API 侧无可靠区分字段，进入列表后由取链链路
// 守卫（outer/url HTML 拒收 / 全链失败）自然形成边界，不会误播假链。
function isListableProgram(program) {
    return !!(program && program.mainSong && program.mainSong.id);
}

function formatMusicItem(program) {
    var mainSong = program.mainSong || {};
    var artistName = (mainSong.artists && mainSong.artists[0] && mainSong.artists[0].name) || '';
    return {
        id: mainSong.id,
        artwork: httpsPic(program.coverUrl),
        title: mainSong.name,
        artist: artistName || (program.dj && program.dj.nickname) || '网易电台',
        album: program.radio && program.radio.name,
        duration: mainSong.duration,
        qualities: {
            standard: { size: (mainSong.lMusic || {}).size },
        },
        // [v1.1.0] VIP 标记：feeScope 0/8 免费，其余（VIP/数字专辑等）走第三方链
        _vip: !(program.feeScope === 0 || program.feeScope === 8),
    };
}

function formatAlbumItem(radio) {
    return {
        id: radio.id,
        artist: radio.dj && radio.dj.nickname,
        title: radio.name,
        artwork: httpsPic(radio.picUrl),
        description: radio.desc,
    };
}

// ---------- 接口实现 ----------
function searchBase(query, page, type) {
    return weapiPost('https://music.163.com/weapi/search/get', {
        s: query,
        limit: PAGE_SIZE,
        type: type,
        offset: (page - 1) * PAGE_SIZE,
        csrf_token: '',
    });
}

function searchAlbum(query, page) {
    // 已知边界：网易 1009 电台搜索最多返回前 30 条（实测 offset=30 起返回空、
    // result 为空对象），第 1 页即 isEnd，宿主不会继续翻页——如实上报
    return searchBase(query, page, 1009).then(function (res) {
        var radios = (res.result && res.result.djRadios) || [];
        var total = (res.result && res.result.djRadiosCount) || radios.length;
        return {
            isEnd: total <= page * PAGE_SIZE,
            data: radios.map(formatAlbumItem),
        };
    });
}

function searchArtist(query, page) {
    return searchBase(query, page, 1002).then(function (res) {
        var users = (res.result && res.result.userprofiles) || [];
        return {
            isEnd: users.length < PAGE_SIZE,
            data: users.map(function (u) {
                return {
                    id: u.userId,
                    name: u.nickname,
                    avatar: httpsPic(u.avatarUrl),
                };
            }),
        };
    });
}

function searchUserRadio(uid) {
    return weapiPost('https://music.163.com/weapi/djradio/get/byuser', {
        userId: uid,
        csrf_token: '',
    });
}

function getAlbumInfoImpl(albumItem, page) {
    return weapiPost('https://music.163.com/weapi/dj/program/byradio', {
        radioId: albumItem.id,
        csrf_token: '',
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
    }).then(function (res) {
        var programs = res.programs || [];
        var total = res.count || 0;
        return {
            isEnd: total <= page * PAGE_SIZE,
            // [v1.1.0] VIP 节目不再被过滤，全部进入列表
            musicList: programs.filter(isListableProgram).map(formatMusicItem),
        };
    });
}

// ==================== 第三方取链体系（移植自 netease v1.9.15，standard 档口径） ====================

// [v0.7.3 移植] 并发竞速 helper：所有候选同时发起，首个成功结果胜出，全部失败才 reject。
function raceSuccess(promises) {
    return new Promise(function (resolve, reject) {
        var pending = promises.length, failed = 0;
        if (!pending) { reject(new Error('raceSuccess: 无候选')); return; }
        promises.forEach(function (p) {
            Promise.resolve(p).then(resolve, function () {
                failed++;
                if (failed === pending) reject(new Error('raceSuccess: 全部候选失败'));
            });
        });
    });
}

// v0.7.1 P1-5 移植：返回媒体 URL 协议/域名白名单校验。
// https 一律放行；http 仅放行网易官方 CDN 域名后缀（含海棠 wy 返回的 126.net 直链），
// http 且域名不在白名单（含裸 IP、被劫持改写的陌生域）一律拒绝，视为该通道失败继续接力。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
    /\.126\.net$/i, /\.163\.com$/i, /\.163cn\.tv$/i
];

function isAllowedMediaUrl(url) {
    var s = String(url || '').trim();
    if (!/^https?:\/\//i.test(s)) return false;
    if (/^https:\/\//i.test(s)) return true; // https 一律放行
    var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
    if (!m) return false;
    var host = m[1].toLowerCase().split(':')[0].split('@').pop();
    for (var i = 0; i < MEDIA_URL_HTTP_HOST_ALLOWLIST.length; i++) {
        if (MEDIA_URL_HTTP_HOST_ALLOWLIST[i].test(host)) return true;
    }
    return false;
}

// v0.7.1 P1-3 移植：给单个 Promise 套剩余时间上限（先到者胜出：段超时 or 请求自身失败）
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

// "9.68MB" / "155.2MB" → bytes；解析失败返回 0（移植 v1.3.1 parseMbSize）
function parseMbSize(s) {
    var m = /^([\d.]+)\s*(KB|MB|GB)?/i.exec(String(s || '').trim());
    if (!m || !m[1]) return 0;
    var n = parseFloat(m[1]);
    var u = (m[2] || 'MB').toUpperCase();
    if (u === 'KB') return n * 1024;
    if (u === 'GB') return n * 1073741824;
    return n * 1048576;
}

// [v1.1.0 P2-3 移植] 通用长度校验：优先按官方声明大小（qualities.standard.size =
// mainSong.lMusic.size，完整文件字节数）判片段——total < 声明 60% 即试听片段；
// 无声明大小时回退 128kbps 估算（est vs 标称时长 60%，高码率文件会被高估时长、
// 不会误杀完整文件）。⚠️ 单位口径：本插件条目 duration 为毫秒（mainSong.duration），
// 先换算秒再比较；v1.9.15 原版按秒口径实现（其条目存秒），直接照搬会对毫秒条目
// 误杀全链（实测复现）。声明大小优先是本插件新增：电台节目声明的 lMusic.size 即
// 完整档大小，且 VIP 节目（djfee）各通道只给 26KB/98KB 预览片段，按码率估算对
// 低码率语音节目（实测 37kbps）会误杀完整文件，声明大小比对无此问题。
function guardCheckSize(total, musicItem) {
    var q = musicItem && musicItem.qualities;
    var declared = q && q.standard && parseInt(q.standard.size, 10) || 0;
    if (total > 0 && declared > 0) {
        if (total < declared * 0.6) {
            throw new Error('guard: trial clip ' + Math.round(total / 1024) + 'KB/' + Math.round(declared / 1048576 * 100) / 100 + 'MB declared');
        }
        return;
    }
    var durMs = parseInt(musicItem && musicItem.duration, 10) || 0;
    var durSec = durMs >= 10000 ? Math.round(durMs / 1000) : durMs; // >=10000 视为毫秒口径
    if (total > 0 && durSec >= 60) {
        var est = total / 16000; // 128000bps / 8bit
        if (est < durSec * 0.6) {
            throw new Error('guard: trial clip ~' + Math.round(est) + 's/' + durSec + 's');
        }
    }
}

// [v1.1.0] 魔数 + 大小一次探测（Range 0-15：魔数与 Content-Range 总长一并拿回，
// 省一次请求）：standard（128k mp3）请求必须 ID3/mp3 sync；fLaC/OggS 视为虚标拒收
// 接力（对齐 v1.9.14 长青有损档守卫口径）；探测失败（Range 不支持/超时）返回 '',
// 不惩罚放行（对齐 swProbeMagic 有损档口径）。返回 { magic, total }。
function probeMagicAndSize(url) {
    return axios.get(url, {
        timeout: RELAY_TIMEOUT,
        headers: { Range: 'bytes=0-15', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        responseType: 'arraybuffer'
    }).then(function (res) {
        var buf = res.data;
        var u8;
        if (buf instanceof Uint8Array) u8 = buf;
        else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
        else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
        else return { magic: '', total: 0 };
        var magic = '';
        if (u8 && u8.length >= 4) {
            if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) magic = 'fLaC';
            else if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'ID3';
            else if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) magic = 'OggS';
            else if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) magic = 'mp3';
        }
        var total = 0;
        var cr = res.headers && (res.headers['content-range'] || res.headers['Content-Range']);
        var mm = cr && String(cr).match(/\/(\d+)\s*$/);
        if (mm) total = parseInt(mm[1], 10) || 0;
        else if (res.status !== 206) {
            var cl = res.headers && (res.headers['content-length'] || res.headers['Content-Length']);
            total = parseInt(cl, 10) || 0;
        }
        return { magic: magic, total: total };
    }).catch(function () { return { magic: '', total: 0 }; });
}

// [v1.1.0] 通用守卫：魔数校验 + 大小校验（selfChecked 通道——长青内建魔数+总长、
// 官方 128k freeTrialInfo 已拦——跳过）。任一不过即 reject，交还接力链换下一通道。
function guardResult(r, musicItem) {
    if (!r || !r.url || !isAllowedMediaUrl(r.url)) {
        return Promise.reject(new Error((r && r.channel || 'guard') + ': url 未通过协议/域名校验'));
    }
    if (r.selfChecked) {
        guardCheckSize(r.bytes || 0, musicItem);
        return Promise.resolve(r);
    }
    return probeMagicAndSize(r.url).then(function (pr) {
        // 魔数：standard 请求要求 ID3/mp3；fLaC/OggS 虚标拒收；''（探测失败）不惩罚放行
        if (pr.magic === 'fLaC' || pr.magic === 'OggS') {
            throw new Error(r.channel + ': fake quality (magic ' + pr.magic + ' on standard)');
        }
        if (pr.magic && pr.magic !== 'ID3' && pr.magic !== 'mp3') {
            throw new Error(r.channel + ': magic ' + pr.magic + ' != mp3');
        }
        // 大小：Range 探测拿到的总长做试听片段校验（探测失败 total=0 时不判）
        guardCheckSize(pr.total || r.bytes || 0, musicItem);
        return r;
    });
}

// [v1.1.0 优化 移植] 失败负缓存（进程内，60s TTL；>500 条时先清理过期项）
var NEG_CACHE_TTL = 60000;
var resolveNegCache = {};
function resolveNegCacheSet(key, msg) {
    var now = Date.now();
    var keys = Object.keys(resolveNegCache);
    if (keys.length > 500) {
        for (var i = 0; i < keys.length; i++) {
            if (!resolveNegCache[keys[i]] || resolveNegCache[keys[i]].until < now) delete resolveNegCache[keys[i]];
        }
    }
    resolveNegCache[key] = { msg: msg, until: now + NEG_CACHE_TTL };
}
function resolveNegCacheGet(key) {
    var e = resolveNegCache[key];
    if (!e) return null;
    if (Date.now() > e.until) { delete resolveNegCache[key]; return null; }
    return e.msg;
}
function resolveNegCacheDel(key) { delete resolveNegCache[key]; }

// [v1.4.0 优化1 移植] URL 结果成功缓存（进程内 LRU）：TTL 30min、上限 200 条。
// 命中直接返回、跳过全链与守卫——写入前结果已过白名单 + 守卫，命中无需复核。
var OK_CACHE_TTL = 30 * 60 * 1000;
var OK_CACHE_MAX = 200;
var resolveOkCache = {};
function resolveOkCacheGet(key) {
    var e = resolveOkCache[key];
    if (!e) return null;
    if (Date.now() > e.until) { delete resolveOkCache[key]; return null; }
    delete resolveOkCache[key];
    resolveOkCache[key] = e;
    return Object.assign({}, e.val);
}
function resolveOkCacheSet(key, val) {
    var now = Date.now();
    var keys = Object.keys(resolveOkCache);
    if (keys.length >= OK_CACHE_MAX) {
        for (var i = 0; i < keys.length; i++) {
            if (!resolveOkCache[keys[i]] || resolveOkCache[keys[i]].until < now) delete resolveOkCache[keys[i]];
        }
        keys = Object.keys(resolveOkCache);
    }
    while (keys.length >= OK_CACHE_MAX) {
        delete resolveOkCache[keys[0]];
        keys.shift();
    }
    resolveOkCache[key] = { val: val, until: now + OK_CACHE_TTL };
}

// ---------- 通道适配器（全部 standard 档：请求哪个音质取哪个音质） ----------

// 官方免登录 128k（免费节目主力，VIP 节目 url=null 快速失败落第三方链）
function resolveRadioOfficial128(raw) {
    return axios.get('https://music.163.com/api/song/enhance/player/url', {
        params: { ids: '[' + raw.id + ']', br: 128000 },
        timeout: SOURCE_TIMEOUT,
        headers: HEADERS
    }).then(function (res) {
        var list = res.data && res.data.data;
        var item = list && list[0];
        var url = item && item.url;
        if (!url) throw new Error('neteaseradio-official-128k: no url (vip?)');
        if (item.freeTrialInfo) {
            throw new Error('neteaseradio-official-128k: trial clip ' + (item.freeTrialInfo.end || '') + 's');
        }
        return { url: String(url), actualQuality: '128k', channel: 'neteaseradio-official-128k', selfChecked: true };
    });
}

// outer/url 免登录外链终极兜底：免费节目 302→官方 CDN mp3（128k）；
// VIP 节目 302→HTML 页——content-type/重定向目标双重守卫拒收，绝不误播假链。
function resolveRadioOuterUrl(raw) {
    return axios.get('https://music.163.com/song/media/outer/url?id=' + raw.id + '.mp3', {
        timeout: RELAY_TIMEOUT, maxRedirects: 0, validateStatus: null,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
        var ctype = String((res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '');
        if (/text\/html/i.test(ctype)) throw new Error('neteaseradio-outer-url: html (vip)');
        var loc = res.headers && (res.headers.location || res.headers.Location);
        if (!loc || !/^https?:\/\//.test(loc)) throw new Error('neteaseradio-outer-url: no redirect');
        // 重定向目标必须是官方 CDN（*.music.126.net）；VIP 歌 302 到 music.163.com
        // 登录/提示 HTML 页，一律拒收
        if (!/^https?:\/\/[^/]*music\.126\.net\//.test(String(loc))) {
            throw new Error('neteaseradio-outer-url: redirect not cdn: ' + String(loc).slice(0, 80));
        }
        return { url: String(loc), actualQuality: '128k', channel: 'neteaseradio-outer-url' };
    });
}

// ikun 音源（v1.3.1 移植口径）：POST c.wwwweb.top/music/url（X-API-Key 空串即可）。
// ⚠️ 参数名是 musicId（songId 会失败）；code=200 只接 wy 源，下方白名单/守卫复核。
function resolveRadioIkun(raw) {
    return axios.post('https://c.wwwweb.top/music/url',
        { source: 'wy', musicId: String(raw.id), quality: '128k' },
        {
            timeout: RELAY_TIMEOUT,
            headers: { 'X-API-Key': '', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        }).then(function (res) {
            var d = res.data || {};
            var url = d.url && String(d.url);
            if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) {
                throw new Error('neteaseradio-ikun: no url (code ' + d.code + ')');
            }
            return { url: url, actualQuality: '128k', channel: 'neteaseradio-ikun' };
        });
}

// 星海 zddyr（v1.9.11 移植口径）：yy.zddyr.top/lx/api/ 洛雪协议，standard 档 quality=128k。
// 响应自带 br 实际交付码率，如实标注（宁低勿高）。
function resolveRadioZddyr(raw) {
    return axios.get('https://yy.zddyr.top/lx/api/?source=netease&songmid=' + encodeURIComponent(String(raw.id)) + '&quality=128k', {
        timeout: RELAY_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
    }).then(function (res) {
        var d = res.data || {};
        var url = d && d.url && String(d.url);
        if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) {
            throw new Error('neteaseradio-zddyr: no url (code ' + (d && d.code) + ')');
        }
        var br = parseInt(d.br, 10) || 0;
        var aq = br >= 700000 ? 'flac' : (br >= 300000 ? '320k' : '128k');
        return { url: url, actualQuality: aq, channel: 'neteaseradio-zddyr' };
    });
}

// 长青 SVIP 网易（v1.9.14 移植口径）：yinyue.haitangw.net/wy/wy.php 端点直出音频流，
// 定位为星海 zddyr 的故障替补（仅 zddyr 失败/503 后启用，主力健康时零请求不抢跑）。
// Range 0-15 魔数探测即校验：standard 档检出 fLaC = 服务端虚标拒收；ID3/mp3 真有损流放行。
// Content-Range 总长直接回填 bytes（省 getMediaSource 边界二次探测）→ selfChecked。
// 超时用 SOURCE_TIMEOUT：长青 Range 探测实测延迟 1.4~4.1s，2500ms 会掐死替补通道。
function resolveRadioLongqing(raw) {
    var url = 'https://yinyue.haitangw.net/wy/wy.php?type=mp3&id=' + encodeURIComponent(String(raw.id)) + '&level=standard';
    return axios.get(url, {
        timeout: SOURCE_TIMEOUT,
        headers: { Range: 'bytes=0-15', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        responseType: 'arraybuffer'
    }).then(function (res) {
        if (res.status >= 400) throw new Error('neteaseradio-longqing-wy-php: http_' + res.status);
        var ctype = String((res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '');
        if (/text\/html/i.test(ctype)) throw new Error('neteaseradio-longqing-wy-php: html response');
        var buf = res.data;
        var u8 = null;
        if (buf instanceof Uint8Array) u8 = buf;
        else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
        else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
        if (!u8 || u8.length < 4) throw new Error('neteaseradio-longqing-wy-php: empty probe');
        var isFlac = u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43; // fLaC
        var isId3 = u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33; // ID3
        var isMp3 = u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0; // MPEG sync
        if (isFlac) throw new Error('neteaseradio-longqing-wy-php: fake quality (fLaC on standard)');
        if (!isId3 && !isMp3) throw new Error('neteaseradio-longqing-wy-php: magic not mp3');
        var total = 0;
        var cr = res.headers && (res.headers['content-range'] || res.headers['Content-Range']);
        if (cr) {
            var mm = String(cr).match(/\/(\d+)\s*$/);
            if (mm) total = parseInt(mm[1], 10) || 0;
        }
        var r = { url: url, actualQuality: '128k', channel: 'neteaseradio-longqing-wy-php', selfChecked: true };
        if (total > 0) { r.bytes = total; r.size = total; }
        return r;
    });
}

// 笒鬼鬼 cenguigui（v1.9.11 移植口径）：api.cenguigui.cn/api/netease/music_v1.php，standard 档。
// 响应 {code:200, data:{url, size:"9.68MB", ...}}——size 字符串经 parseMbSize 转真实字节
// 交守卫判试听片段；魔数由通用守卫探测。
function resolveRadioCenguigui(raw) {
    return axios.get('https://api.cenguigui.cn/api/netease/music_v1.php', {
        params: { id: raw.id, type: 'json', level: 'standard' },
        timeout: RELAY_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
    }).then(function (res) {
        var d = res.data || {};
        var item = d.data || {};
        var url = item.url && String(item.url);
        if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) {
            throw new Error('neteaseradio-cenguigui: no url (code ' + (d && d.code) + ')');
        }
        var bytes = parseMbSize(item.size || d.size);
        var r = { url: url, actualQuality: '128k', channel: 'neteaseradio-cenguigui' };
        if (bytes > 0) r.bytes = bytes;
        return r;
    });
}

// oiapi 溯音（v1.1.0 移植口径）：GET /api/Music_163?id=&quality=128，无需 Key。
// 响应 {code:0,data:[{url,pay}]}；VIP 歌 code:0 + url:null + pay:true → 快速接力。
function resolveRadioOiapi(raw) {
    return axios.get('https://oiapi.net/api/Music_163', {
        params: { id: raw.id, quality: '128' },
        timeout: RELAY_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
        var d = res.data || {};
        var item = d.data && d.data[0];
        if (d.code !== 0 || !item) throw new Error('neteaseradio-oiapi: bad code ' + d.code);
        if (!item.url) throw new Error(item.pay ? 'neteaseradio-oiapi: vip locked' : 'neteaseradio-oiapi: no url');
        return { url: String(item.url), actualQuality: '128k', channel: 'neteaseradio-oiapi' };
    });
}

// bugpk 163_music（v1.1.0 移植口径）：GET api.bugpk.com/api/163_music?type=json&ids=&level=standard。
// ⚠️ 参数名是 ids（id 会报 code 400）；单 IP 限 2 QPS；VIP 歌可能回落 outer/url（守卫复核）。
function resolveRadioBugpk(raw) {
    return axios.get('https://api.bugpk.com/api/163_music', {
        params: { type: 'json', ids: raw.id, level: 'standard' },
        timeout: RELAY_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
        var d = res.data || {};
        var url = d.url || (d.data && d.data.url);
        if (!url) throw new Error('neteaseradio-bugpk: no url (code ' + d.code + ')');
        var u = String(url);
        return { url: u, actualQuality: '128k', channel: 'neteaseradio-bugpk' };
    });
}

// 海棠 wy.php 直连（v1.9.15 P0-2 移植口径）：music.haitangw.cc/music/wy.php，
// 与长青端点不同源不同形态。双形态兼容：301/302 Location 直链 / 200 JSON（data.url）；
// 真机 WebView 自动跟随 302 场景以 responseURL 探测取最终直链（v1.9.3 同款）。
function resolveRadioHaitangWyPhp(raw) {
    var api = 'https://music.haitangw.cc/music/wy.php?level=standard&id=' + encodeURIComponent(String(raw.id));
    return axios.get(api, {
        timeout: RELAY_TIMEOUT,
        maxRedirects: 0,
        validateStatus: null,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://music.haitangw.cc/' }
    }).then(function (res) {
        var loc = res.headers && (res.headers.location || res.headers.Location);
        var u = (res.status === 301 || res.status === 302) && loc && /^https?:\/\//i.test(String(loc)) ? String(loc) : '';
        if (!u) {
            var j = res.data;
            u = (j && j.data && j.data.url) || (j && j.url) || '';
        }
        var finalUrl = res.request && res.request.responseURL;
        if (!u && finalUrl && /^https?:\/\//i.test(String(finalUrl)) && String(finalUrl) !== api) u = String(finalUrl);
        if (!u || !/^https?:\/\//i.test(String(u))) throw new Error('neteaseradio-haitang-wy-php: no url (status ' + res.status + ')');
        return { url: String(u), actualQuality: '128k', channel: 'neteaseradio-haitang-wy-php' };
    });
}

// ---------- 主链组织（对齐 v1.9.15 resolveNetease standard 段结构） ----------

function resolveRadioImpl(musicItem) {
    var raw = { id: musicItem.id };
    var negKey = String(raw.id) + '|standard';

    // 失败负缓存：同曲全链失败后 60s 内直接快速失败，避免每次重试打满 8s 预算
    var negMsg = resolveNegCacheGet(negKey);
    if (negMsg) return Promise.reject(new Error('电台取链失败：' + negMsg + '（负缓存 60s）'));
    // 成功缓存命中：直接返回，跳过全链与守卫
    var okHit = resolveOkCacheGet(negKey);
    if (okHit) return Promise.resolve(okHit);

    var deadline = Date.now() + RESOLVE_BUDGET_MS;

    // 段执行包装：剩余预算 <500ms 直接失败；每段带剩余时间上限；成功结果过守卫
    var runStep = function (fn, musicItem) {
        var remain = deadline - Date.now();
        if (remain <= 500) {
            return Promise.reject(new Error('电台取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms'));
        }
        return withTimeout(fn(), remain, '段超时').then(function (r) {
            var guardBudget = deadline - Date.now();
            if (guardBudget <= 500) throw new Error('电台取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
            return withTimeout(guardResult(r, musicItem), guardBudget, 'guard 超时');
        });
    };

    // 免费节目官方段：官方 128k ⇄ outer/url 并发竞速（先成功者胜出）
    // VIP 节目跳过官方段（官方免登录必败，省两路请求）直达第三方链
    var officialPart;
    if (musicItem._vip) {
        officialPart = Promise.reject(new Error('vip program -> third-party'));
    } else {
        officialPart = raceSuccess([
            resolveRadioOfficial128(raw),
            resolveRadioOuterUrl(raw)
        ]).then(function (r) {
            if (!isAllowedMediaUrl(r.url)) throw new Error('official: url 未通过协议/域名校验');
            // outer/url 胜出时补魔数校验（官方 128k API 直出 CDN 免守卫）
            if (r.channel === 'neteaseradio-official-128k') return r;
            return guardResult(r, musicItem);
        });
    }

    return officialPart.catch(function () {
        // 第三方接力链（顺序对齐 v1.9.15 standard 链：ikun → zddyr(长青替补)
        // → cenguigui → oiapi → bugpk → 海棠 wy.php → outer/url 终极兜底）
        var thirdPartyChain = [
            function () { return resolveRadioIkun(raw); },
            function () { return resolveRadioZddyr(raw).catch(function () { return resolveRadioLongqing(raw); }); },
            function () { return resolveRadioCenguigui(raw); },
            function () { return resolveRadioOiapi(raw); },
            function () { return resolveRadioBugpk(raw); },
            function () { return resolveRadioHaitangWyPhp(raw); },
            function () { return resolveRadioOuterUrl(raw); }
        ];
        var attempt = function (i) {
            if (i >= thirdPartyChain.length) {
                return Promise.reject(new Error('电台取链失败：所有通道均未取得播放链接'));
            }
            return runStep(thirdPartyChain[i], musicItem).catch(function () { return attempt(i + 1); });
        };
        return attempt(0);
    }).then(function (r) {
        resolveNegCacheDel(negKey);
        resolveOkCacheSet(negKey, { url: r.url, channel: r.channel, actualQuality: r.actualQuality, bytes: r.bytes });
        return { url: r.url, quality: 'standard', actualQuality: r.actualQuality || '128k' };
    }, function (e) {
        resolveNegCacheSet(negKey, String((e && e.message) || '所有通道失败').slice(0, 80));
        throw e;
    });
}

module.exports = {
    platform: 'neteaseradio',
    version: '1.1.0',
    name: '网易云电台',
    author: '研发1号',
    description:
        '网易云音乐电台/播客：搜索电台与主播、浏览节目列表并播放；v1.1.0 起 VIP 节目进入列表并经第三方通道取链（wy.php/ikun/星海/oiapi/bugpk 等，官方通道优先免费节目）',
    srcUrl: 'https://hebijunge.github.io/musicfree-plugins/plugins/neteaseradio-source.plugin.v1.1.0.js',
    cacheControl: 'no-store',
    supportedSearchType: ['album', 'artist'],

    search: function (query, page, type) {
        if (type === 'album') {
            return searchAlbum(query, page);
        }
        if (type === 'artist') {
            return searchArtist(query, page);
        }
        return Promise.resolve({ isEnd: true, data: [] });
    },

    getAlbumInfo: function (albumItem, page) {
        return getAlbumInfoImpl(albumItem, page);
    },

    getMusicSheetInfo: function (sheetItem, page) {
        return getAlbumInfoImpl(sheetItem, page).then(function (r) {
            r.sheetItem = sheetItem;
            return r;
        });
    },

    getArtistWorks: function (artistItem, page, type) {
        if (type === 'album') {
            return searchUserRadio(artistItem.id).then(function (res) {
                var radios = res.djRadios || [];
                return {
                    isEnd: true,
                    data: radios.map(formatAlbumItem),
                };
            });
        }
        return Promise.resolve({ isEnd: true, data: [] });
    },

    getLyric: function (musicItem) {
        return axios
            .get('https://music.163.com/api/song/lyric', {
                params: { id: musicItem.id, lv: -1, tv: -1 },
                headers: HEADERS,
                timeout: 10000,
            })
            .then(function (r) {
                var lrc = (r.data && r.data.lrc && r.data.lrc.lyric) || '';
                return { rawLrc: lrc };
            });
    },

    getMediaSource: function (musicItem, quality) {
        // 电台节目仅 standard（128k mp3）一档：免费节目官方通道优先（官方 128k ⇄
        // outer/url 竞速），VIP/官方失败走第三方接力链（移植自 netease v1.9.15）
        return resolveRadioImpl(musicItem);
    },
};
