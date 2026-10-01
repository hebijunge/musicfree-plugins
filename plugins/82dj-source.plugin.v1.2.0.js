// 82DJ舞曲网 - MusicFree Plugin v1.2.0
// 站点现状（2026-10-01 对活站实测，非引用文档）：
//   - 单曲取链接口已全部废弃：create_cookie / create_cookies 只回 {"code":200,"msg":"添加成功"}，
//     get_cookie 回 {"code":200,"data":[]}。v1.1.0 依赖它们，所以取链必然抛「未找到播放链接」。
//   - 唯一元数据来源是列表接口 change.html?type=2（data.left + data.right，各 12 条）与
//     next_page_right.html?type=2&page=N（翻页，同样带 shiti_path），字段含
//     shiti_path(64K 相对路径,.mp4) / path(320K 相对路径,.mp3 带站点水印) / first_cate。
//   - /play/{id} 详情页 165KB 全文不含任何播放地址，确认站点无单曲接口。
//   - CDN 有防盗链：带 Referer(https://www.82dj.com/) 返回 206，不带返回 404 + HTML。
//   - 文件名含中文/空格/括号/水印，必须按 UTF-8 字节逐段小写百分号编码（只保留 unreserved），
//     按 Unicode 码点编码会得到 %4e30 这类错值，服务器按字节解成 "N0" 直接 404。
//   - 列表/搜索/榜单是 HTML：带 X-Requested-With 会被服务端返回 JS 转义字符串（`<\/tr>`），
//     解析结果为 0 行，故这类请求不带该头；JSON 接口反之要带完整浏览器头 + 预热会话。

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.82dj.com';
const CDN_BASE = 'https://mp3.82dj.com/82dj';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/** 一级分类 first_cate → CDN 分类拼音段。实测串烧/慢歌/中文/英文/视频；英文是 waiwen 不是 yingwen。 */
const CATE_SLUG = { 1: 'chuanshao', 2: 'mange', 3: 'zhongwen', 4: 'waiwen', 10: 'shipin' };
/** first_cate 缺失时的兜底候选。 */
const KNOWN_SLUGS = ['chuanshao', 'mange', 'zhongwen', 'waiwen', 'shipin'];

const CATEGORIES = [
    { id: 1, name: '串烧舞曲' },
    { id: 2, name: '慢歌连版' },
    { id: 3, name: '中文舞曲' },
    { id: 4, name: '英文舞曲' },
    { id: 10, name: 'DJ视频' },
];

const RANKS = [
    { id: 1, name: '串烧舞曲总榜' },
    { id: 2, name: '慢歌连版总榜' },
    { id: 3, name: '中文舞曲总榜' },
    { id: 4, name: '英文舞曲总榜' },
];

/** 播放器/下载器请求音频时必须带的水链头。 */
const MEDIA_HEADERS = { Referer: SITE + '/', 'User-Agent': UA };

/** JSON 接口用（带 XHR 标识，走会话）。 */
const API_HEADERS = {
    'User-Agent': UA,
    Referer: SITE + '/',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Accept-Encoding': 'gzip, deflate',
};

/** HTML 页面用：绝不能带 X-Requested-With，否则服务端返回转义 HTML 导致解析 0 行。 */
const HTML_HEADERS = {
    'User-Agent': UA,
    Referer: SITE + '/',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
};

// ==================== 工具 ====================

function encSegment(seg) {
    let out = '';
    for (const ch of seg) {
        if (/[A-Za-z0-9\-_.~]/.test(ch)) {
            out += ch;
            continue;
        }
        const bytes = Buffer.from(ch, 'utf8');
        for (let i = 0; i < bytes.length; i++) {
            out += '%' + bytes[i].toString(16).padStart(2, '0');
        }
    }
    return out;
}

/** 逐路径段编码（query 不参与）。 */
function normalizeCdnUrl(url) {
    const schemeEnd = url.indexOf('//');
    const hostEnd = url.indexOf('/', schemeEnd + 2);
    if (hostEnd < 0) return url;
    return url.slice(0, hostEnd) + url.slice(hostEnd).split('/').map(encSegment).join('/');
}

function absoluteUrl(raw) {
    if (!raw) return undefined;
    const s = String(raw).trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return 'https:' + s;
    return SITE + (s.startsWith('/') ? s : '/' + s);
}

/** "58分41秒" / "1小时02分" → 秒 */
function parseCnDuration(text) {
    if (!text) return undefined;
    const hour = /(\d+)\s*小时/.exec(text);
    const minute = /(\d+)\s*分/.exec(text);
    const second = /(\d+)\s*秒/.exec(text);
    if (!hour && !minute && !second) return undefined;
    return (
        (hour ? +hour[1] * 3600 : 0) + (minute ? +minute[1] * 60 : 0) + (second ? +second[1] : 0)
    );
}

/**
 * 清洗站点自加水印：`82DJ舞曲网[www.82dj.com]`、`(www.82dj.com)`、结尾随机 4 位尾巴等。
 * 只作用于展示标题；URL 路径必须原样使用，改了会 404。
 */
function stripWatermark(title) {
    let t = String(title || '');
    t = t.replace(/[\[\(（【]\s*(?:www\.)?82dj\.com\s*[\])）】]/gi, ' ');
    t = t.replace(/82DJ\s*舞曲网\s*(?:\[[^\]]*\]|\([^)]*\))?/gi, ' ');
    t = t.replace(/[-_\s][A-Za-z0-9]{4}(?=\.mp3$|\.mp4$)/gi, '');
    t = t.replace(/\s{2,}/g, ' ').replace(/\s+([-_()（）\[\]])/g, '$1').trim();
    return t || String(title || '');
}

/** 明显是广告/模板推广的行，直接丢进行解析。 */
function looksLikeAd(title) {
    return /广告|模板下载|QQ\s*[:：]?\d{5,}|微信|QQ群|代理|客服|免版权|商用授权|http?:\/\/(?!www\.82dj\.com)/i
        .test(String(title || ''));
}

/**
 * 站点自报码率（`shiti_yinzhi` / `yinzhi`，形如 "64 Kbps" / "320 Kbps"）→ 宿主音质键。
 * 宿主音质词表是内置的（64k/96k/128k/192k/320k/flac…），未知键在 UI 里会渲染成空白，
 * 所以只接受能精确命中的整数码率，推不出来就不声明这一档，而不是硬套一个假档位。
 */
function bitrateKey(text) {
    const m = String(text || '').match(/(\d+)\s*(?:kbps|k)/i);
    if (!m) return '';
    const kbps = parseInt(m[1], 10);
    const key = kbps + 'k';
    return KNOWN_BITRATE_KEYS.indexOf(key) >= 0 ? key : '';
}
const KNOWN_BITRATE_KEYS = ['64k', '96k', '128k', '192k', '320k'];

/** 站点的 "147 MB" 实测按 MiB 计（147MiB ≈ 154,651,775 字节），故乘 1024^2。 */
function parseSiteSize(text) {
    const m = String(text || '').match(/([\d.]+)\s*(GB|MB|KB)/i);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    const unit = m[2].toUpperCase();
    const mult = unit === 'GB' ? 1024 * 1024 * 1024 : unit === 'MB' ? 1024 * 1024 : 1024;
    return Math.round(n * mult);
}

/** 站点占位歌手名归一，避免列表里出现品牌名当歌手。 */
function normalizeArtist(name) {
    const n = (name || '').trim();
    if (!n || /^(82DJ|82DJ舞曲网|未知)$/i.test(n)) return '未知歌手';
    return n;
}

// ==================== 会话预热 ====================

let sessionCookie = '';
let sessionWarmed = false;

async function warmSession() {
    if (sessionWarmed) return;
    sessionWarmed = true;
    try {
        const res = await axios.get(SITE + '/', { headers: HTML_HEADERS, timeout: 15000 });
        const sc = res.headers['set-cookie'];
        if (Array.isArray(sc)) {
            sessionCookie = sc.map(c => String(c).split(';')[0]).join('; ');
        }
    } catch (e) {
        // 预热失败不阻塞：接口仍可能可用，失败会在上层以取链错误暴露
    }
}

function apiHeaders(referer) {
    const h = Object.assign({}, API_HEADERS);
    if (referer) h.Referer = referer;
    if (sessionCookie) h.Cookie = sessionCookie;
    return h;
}

function htmlHeaders(referer) {
    const h = Object.assign({}, HTML_HEADERS);
    if (referer) h.Referer = referer;
    if (sessionCookie) h.Cookie = sessionCookie;
    return h;
}

// ==================== 取链元数据索引 ====================

/** id → {shitiPath, highPath, firstCate, title, size} */
const metaIndex = new Map();
let indexFetchedAt = 0;
const INDEX_TTL_MS = 30 * 1000;
/** 翻页找单曲时最多翻几页（每页 12 条）；再深就判定取不到。 */
const INDEX_MAX_PAGES = 8;

function collectObjects(payload) {
    const out = [];
    if (!payload) return out;
    const data = payload.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
        for (const key of ['left', 'right']) {
            if (Array.isArray(data[key])) out.push(...data[key]);
        }
    }
    return out;
}

function cacheMeta(objects) {
    for (const o of objects || []) {
        if (!o || o.id === undefined) continue;
        if (!o.shiti_path) continue;
        metaIndex.set(String(o.id), {
            shitiPath: String(o.shiti_path),
            highPath: o.path ? String(o.path) : '',
            firstCate: Number(o.first_cate) || 0,
            title: o.title ? String(o.title) : '',
            // 站点自报的两档码率与大小；shiti_size 实测常为空，空就不显示，不猜
            stdBitrate: bitrateKey(o.shiti_yinzhi),
            highBitrate: bitrateKey(o.yinzhi),
            stdSize: parseSiteSize(o.shiti_size),
            highSize: parseSiteSize(o.size),
        });
    }
}

async function refreshIndex(force) {
    const now = Date.now();
    if (!force && now - indexFetchedAt < INDEX_TTL_MS) return;
    indexFetchedAt = now;
    await warmSession();
    const res = await axios.get(SITE + '/index/index/change.html?type=2', {
        headers: apiHeaders(SITE + '/'),
        responseType: 'json',
        timeout: 20000,
    });
    cacheMeta(collectObjects(res.data));
}

/**
 * 站点无单曲接口，只能经由列表对象按 id 查元数据：先查首页 change.html，
 * 未命中再沿 next_page_right.html 翻页，命中即停。
 */
async function lookupMeta(id) {
    const key = String(id);
    await refreshIndex(false);
    if (metaIndex.get(key)) return metaIndex.get(key);

    await warmSession();
    for (let page = 1; page <= INDEX_MAX_PAGES; page++) {
        let res;
        try {
            res = await axios.get(SITE + '/index/index/next_page_right.html?type=2&page=' + page, {
                headers: apiHeaders(SITE + '/'),
                responseType: 'json',
                timeout: 20000,
            });
        } catch (e) {
            break;
        }
        const objects = collectObjects(res.data);
        if (!objects.length) break;
        cacheMeta(objects);
        if (metaIndex.get(key)) return metaIndex.get(key);
    }
    return null;
}

function buildStdUrl(meta) {
    const slug = CATE_SLUG[meta.firstCate];
    if (slug) return normalizeCdnUrl(`${CDN_BASE}/64KB/${slug}/${meta.shitiPath}`);
    return normalizeCdnUrl(`${CDN_BASE}/64KB/${KNOWN_SLUGS[0]}/${meta.shitiPath}`);
}

/**
 * 直链探活：取头部 12 字节并要求命中音频魔数。
 * 只看 HTTP 状态会被骗——站点被防盗链拦截时返回 200/404 + HTML 广告页，
 * 状态正常但内容不是音频，播出来就是静音或报错。
 */
async function probe(url) {
    try {
        const res = await axios.get(url, {
            headers: Object.assign({ Range: 'bytes=0-11' }, MEDIA_HEADERS),
            responseType: 'arraybuffer',
            timeout: 12000,
            validateStatus: s => s === 200 || s === 206,
        });
        const b = Buffer.from(res.data || []);
        if (b.length < 12) return 0;
        // Content-Range: bytes 0-11/<total>；没有就退回 Content-Length
        const cr = String(res.headers['content-range'] || '');
        const m = cr.match(/\/(\d+)\s*$/);
        const total = m ? parseInt(m[1], 10) : parseInt(res.headers['content-length'] || '0', 10);
        const ascii = (from, len) => b.slice(from, from + len).toString('latin1');
        const isAudio =
            ascii(0, 3) === 'ID3' ||
            ascii(4, 4) === 'ftyp' ||
            ascii(0, 4) === 'fLaC' ||
            ascii(0, 4) === 'OggS' ||
            (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
        return isAudio ? total : 0;
    } catch (e) {
        return 0;
    }
}

async function resolveHighUrl(meta, slug) {
    if (!meta.highPath) return '';
    const candidates = [];
    if (slug) candidates.push(`${CDN_BASE}/320KB/${slug}/${meta.highPath}`);
    for (const s of KNOWN_SLUGS) {
        if (s !== slug) candidates.push(`${CDN_BASE}/320KB/${s}/${meta.highPath}`);
    }
    for (const raw of candidates) {
        const url = normalizeCdnUrl(raw);
        const total = await probe(url);
        if (total) return { url: url, size: total };
    }
    return null;
}

/**
 * 给列表项挂 qualities：宿主 UI 会按 supportedQualities 的顺序取 qualities[key]，
 * 并在有 size 时显示 (大小)。只挂索引里确实有元数据的曲目，挂不出来的就不写，
 * 避免显示站点根本没提供的档位或编造的大小。
 */
async function attachQualities(items) {
    // 索引来自 change.html（30 秒缓存）。拉不到不影响列表本身，只是这一屏不显示档位/大小。
    try {
        await refreshIndex(false);
    } catch (e) {
        return items;
    }
    for (const it of items) {
        const meta = metaIndex.get(String(it.id));
        if (!meta) continue;
        const q = {};
        if (meta.stdBitrate) {
            q[meta.stdBitrate] = meta.stdSize ? { size: meta.stdSize } : {};
        }
        if (meta.highBitrate && meta.highPath) {
            q[meta.highBitrate] = meta.highSize ? { size: meta.highSize } : {};
        }
        if (Object.keys(q).length) it.qualities = q;
    }
    return items;
}

// ==================== 列表解析 ====================

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = new Set();
    $('table.list_musiclist tr.sbg').each((_i, el) => {
        const id = $(el).find('input.sortid').val();
        if (!id || seen.has(String(id))) return;
        seen.add(String(id));

        const $title = $(el).find('.list_play_img_title p.t1 a');
        const rawTitle = ($title.attr('title') || $title.text() || '').trim();
        if (looksLikeAd(rawTitle)) return;
        const title = stripWatermark(rawTitle) || `舞曲 ${id}`;
        const artwork = $(el).find('.list_play_img img').attr('src');
        const $tds = $(el).find('td');
        const rowText = $(el).text() || '';

        const duration =
            parseCnDuration(
                (rowText.match(/TIME[:\s]*([0-9时分秒]+)/) || [])[1] ||
                    (rowText.match(/(\d+分\d+秒)/) || [])[1],
            ) || undefined;
        const sizeText = ($tds.eq(2).text() || '').trim();
        const dateText = ($tds.eq(4).text() || '').trim();

        data.push({
            id: String(id),
            title: title,
            artist: normalizeArtist(
                ($(el).find('.t2 a[href*="/dj/"]').text() || $tds.eq(3).text() || '').trim(),
            ),
            duration: duration,
            artwork: absoluteUrl(artwork),
            url: SITE + '/play/' + id,
            _82dj: {
                sizeText: sizeText,
                bitrate: rowText.indexOf('320 Kbps') >= 0 ? '320 Kbps' : '64 Kbps',
                publishTime: /^(\d{1,2}-\d{1,2})$/.test(dateText) ? dateText : undefined,
            },
        });
    });
    return data;
}

function parseVideoList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href*="/video/"]').each((_i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/video\/(\d+)/);
        if (!m) return;
        const title = ($(el).attr('title') || $(el).text() || '').trim();
        if (!title) return;
        data.push({
            id: m[1],
            title: title,
            artist: '82DJ视频',
            artwork: absoluteUrl($(el).find('img').attr('src')),
            url: absoluteUrl(href),
        });
    });
    const seen = new Set();
    return data.filter(x => (seen.has(x.id) ? false : seen.add(x.id)));
}

module.exports = {
    name: '82DJ舞曲网',
    platform: '82DJ',
    version: '1.2.0',
    author: 'hebijunge',
    description:
        '82DJ舞曲网：分类/榜单/搜索/封面/时长/320K 高品直链。' +
        '站点只有两档真实编码（64Kbps 与 320Kbps，均为全长），故只声明这两档。' +
        'v1.2.0 重写取链——站点已废弃 create_cookie/get_cookie，改由列表接口元数据确定性拼直链并带防盗链 Referer。',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/82dj-source.plugin.v1.2.0.js',
    cacheControl: 'no-store',
    /**
     * 站点自报 `shiti_yinzhi`="64 Kbps" / `yinzhi`="320 Kbps"，两档都是全长
     * （实测 31,283,255B / 3865s ≈ 64.8kbps，154,651,775B / 3865s ≈ 320.1kbps）。
     * 档位键名由这两个字段推导（见 bitrateKey），推不出可识别码率的曲目就不声明该档，
     * 而不是硬套一个宿主里根本不存在、UI 会渲染成空白的假键。
     * 宿主内置音质词表原本最低只到 96k，64k 是本次一并补上的（否则 64Kbps 源无档可声明）。
     */
    supportedQualities: ['64k', '320k'],
    supportedSearchType: ['music'],
    hints: ['舞曲/串烧长音频，时长普遍 30~90 分钟', '仅 64K / 320K 两档，均为全长', '高品探活失败自动回落 64K'],

    userVariables: [],

    async search(query, page, type) {
        await warmSession();
        const res = await axios.get(SITE + '/search', {
            params: { search: query, type: '', order: '', page: page || 1 },
            headers: htmlHeaders(SITE + '/'),
            timeout: 20000,
        });
        const data = await attachQualities(parseList(res.data));
        return { isEnd: data.length < 10, data: data };
    },

    async getTopLists() {
        return [
            {
                title: '分类',
                data: CATEGORIES.map(c => ({ id: 'cat_' + c.id, title: c.name })),
            },
            {
                title: '榜单',
                data: RANKS.map(r => ({ id: 'rank_' + r.id, title: r.name })),
            },
        ];
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (String(id).startsWith('cat_')) {
            url = SITE + '/list/' + String(id).slice(4) + '-0-0-' + (page || 1);
        } else if (String(id).startsWith('rank_')) {
            url = SITE + '/top/' + String(id).slice(5);
        } else {
            throw new Error('未知分类');
        }
        await warmSession();
        const res = await axios.get(url, { headers: htmlHeaders(SITE + '/'), timeout: 20000 });
        const musicList = await attachQualities(parseList(res.data));
        return { isEnd: musicList.length < 10, musicList: musicList, topListItem: topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const id = musicItem && musicItem.id;
        if (!id) throw new Error('82DJ 缺少曲目 id');
        const meta = await lookupMeta(id);
        if (!meta) {
            throw new Error(
                '82DJ 未在该曲列表接口中找到取链元数据（站点已无单曲接口，仅能经由最新列表解析）',
            );
        }

        const slug = CATE_SLUG[meta.firstCate];
        const stdUrl = buildStdUrl(meta);
        const stdKey = meta.stdBitrate || '64k';
        // 站点 shiti_size 常为空，这里用探测到的真实字节数补上，宿主才能显示 64K 档大小
        const stdTotal = await probe(stdUrl);
        if (!stdTotal) {
            throw new Error('82DJ 直链未通过音频校验（可能被防盗链或站点返回了广告页）');
        }

        // 站点只有两档：请求高档（high/super/320k 等）才去探 320K，探不到就回落到自报码率的标准档。
        // 返回的 quality 用站点自报的码率键，而不是宿主语义的 low/standard/high。
        const wantsHigh =
            quality === 'high' || quality === 'super' || /320/.test(String(quality || ''));
        if (wantsHigh && meta.highPath) {
            const high = await resolveHighUrl(meta, slug);
            if (high) {
                return {
                    url: high.url,
                    headers: MEDIA_HEADERS,
                    quality: meta.highBitrate || '320k',
                    size: meta.highSize || high.size,
                };
            }
        }
        return {
            url: stdUrl,
            headers: MEDIA_HEADERS,
            quality: stdKey,
            size: meta.stdSize || stdTotal,
        };
    },

    async getMusicInfo(musicItem) {
        const id = musicItem && musicItem.id;
        if (!id) return {};
        const meta = await lookupMeta(id);
        if (!meta) return {};
        return {
            _extra: {
                sourceTitle: meta.title,
                bitrate: meta.highPath ? '64K 试听 / 320K 高品' : '64K 试听',
            },
        };
    },

    async getLyric() {
        // 站点不提供歌词接口；返回空对象让宿主走歌词搜索兜底
        return {};
    },

    async getArtistWorks() {
        // 站点歌手页无稳定作品列表接口，明确不支持而非抛未实现
        return { isEnd: true, musicList: [], albumList: [] };
    },
};
