// 我是DJ (54dj.com) MusicFree 插件 v1.1.0
// Laravel 服务端渲染，CDN cdn.54dj.vip
// 搜索: /searches?q={kw}&page={p}              → .track-list-item
// 分类: /forum/category-{cid}?page={p}         → .track-list-item
// 榜单: /ranks/{code}（8个月/年榜）            → .track-list-item
// 取链: /topics/{id} → cdn.54dj.vip/low/...m4a（免费试听）
// 封面: img.track-list-cover-img 的 data-src（cdn.54dj.vip/Images...jpg）
// 高品: 320kbps mp3 需 2 金币（付费），免登录不可得，不伪造
// 注: www.54dj.cn 已被劫持停放，真实站为 www.54dj.com

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://www.54dj.com';
const PLATFORM = '我是DJ';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;

const RANKS = [
    ['cs-md', '串烧下载月榜'], ['dq-md', '单曲下载月榜'],
    ['cs-ml', '串烧热播月榜'], ['dq-ml', '单曲热播月榜'],
    ['cs-yd', '串烧年度下载榜'], ['dq-yd', '单曲年度下载榜'],
    ['cs-yl', '串烧年度热播榜'], ['dq-yl', '单曲年度热播榜'],
];

const CATEGORIES = [
    [42, '现场串烧'], [1, '沈风串烧'], [41, '中文串烧'], [43, '英文串烧'],
    [24, '中英文串烧'], [37, '中文舞曲'], [3, '沈风中文'], [38, '包厢中文'],
    [35, '外文舞曲'], [8, '沈风外文'], [2, 'Bounce'], [48, 'Electro'],
    [36, 'HOUSE'], [30, '经典怀旧'], [44, '越鼓专区'], [46, 'Vina House'],
    [45, 'Lak House'],
];

async function get(url) {
    return axios.get(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
        timeout: TIMEOUT,
    });
}

// 时长：中文 "TIME 06分27秒"
function parseCnDuration(text) {
    const m = text.match(/TIME\s*(\d+)分(\d+)秒/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return undefined;
}

// 统一解析 .track-list-item（搜索/分类/榜单通用）
function parseItems(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('.track-list-item').each((i, row) => {
        const $row = $(row);
        let id = $row.find('.select-input').val() || $row.find('.track-list-number').text().trim();
        if (!id) {
            const m = ($row.find('a[href*="/topics/"]').first().attr('href') || '').match(/topics\/(\d+)/);
            id = m && m[1];
        }
        const $ta = $row.find('.track-list-name-text').first();
        const title = ($ta.attr('title') || $ta.text() || '').replace(/\s+/g, ' ').trim();
        if (!id || !title) return;
        let cover = $row.find('.track-list-cover-img').attr('data-src') || '';
        if (!cover || /cover\.png/.test(cover)) cover = '';
        data.push({
            id: String(id),
            title,
            artist: PLATFORM,
            artwork: cover,
            duration: parseCnDuration($row.text()),
        });
    });
    return data;
}

function hasPage(html, p) {
    return new RegExp('[?&]page=' + p + '\\b').test(html);
}


// Range 探测真实体积（HEAD 在部分 CDN 不返 content-length）；失败返 0 由调用方兜底。
// 用 arraybuffer+Range：宿主 axios 在 RN 侧走 XMLHttpRequest，没有 stream 适配器。
async function probeTotalBytes(url, headers) {
    try {
        const r = await axios.get(url, {
            headers: Object.assign({ 'User-Agent': UA, Range: 'bytes=0-1023' }, headers || {}),
            timeout: TIMEOUT,
            responseType: 'arraybuffer',
            maxRedirects: 3,
            validateStatus: function (s) { return s === 200 || s === 206; },
        });
        const cr = String((r.headers && r.headers['content-range']) || '');
        const total = Number((cr.split('/')[1] || '').trim()) || Number(r.headers['content-length'] || 0);
        return total > 1 ? total : 0;
    } catch (e) {
        return 0;
    }
}


module.exports = {
    cacheControl: 'no-store',
    name: '我是DJ',
    platform: PLATFORM,
    version: '1.1.1',
    author: 'hebijunge',
    description: '我是DJ(54DJ) 串烧/包厢/Bounce/Vina舞曲，支持搜索、17分类、8榜单、封面、试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/54dj-source.plugin.v1.1.1.js',
    supportedSearchType: ['music'],
    // 实测 2026-10-03 cdn.54dj.vip/low m4a：mdhd 448s、3,727,116B → 66.5kbps，站点标注 low 档
    supportedQualities: ['64k'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await get(ORIGIN + '/searches?q=' + encodeURIComponent(query) + '&page=' + p);
        const html = typeof res.data === 'string' ? res.data : '';
        return { isEnd: !hasPage(html, p + 1), data: parseItems(html) };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id);
        const res = await get(ORIGIN + '/topics/' + id);
        const html = typeof res.data === 'string' ? res.data : '';
        const m = html.match(/https?:\/\/cdn\.54dj\.vip\/low\/[^\s"'<>]+\.m4a/);
        if (!m) throw new Error('取链失败（320k 高品需金币）');
        // 免费仅 low m4a，所有音质请求返回该地址，不伪造高品
        const u = m[0];
            const headers = null;
            // 宿主只在 result.quality 存在时覆盖档位标签，否则沿用用户请求档渲染 → 必须显式回写
            const size = await probeTotalBytes(u, headers || undefined);
            const result = { url: u, quality: '64k', actualQuality: '64k' };
            if (headers) result.headers = headers;
            if (size) result.size = size;
            return result;
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        return [
            {
                title: '榜单排行',
                data: RANKS.map(([code, t]) => ({
                    id: 'rank_' + code, title: t, kind: 'rank', code,
                })),
            },
            {
                title: '曲风分类',
                data: CATEGORIES.map(([cid, t]) => ({
                    id: 'cat_' + cid, title: t, kind: 'category', cid,
                })),
            },
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        let url;
        if (topListItem.kind === 'rank') {
            url = ORIGIN + '/ranks/' + topListItem.code;
        } else if (topListItem.kind === 'category') {
            url = ORIGIN + '/forum/category-' + topListItem.cid + '?page=' + p;
        } else throw new Error('未知榜单类型');
        const res = await get(url);
        const html = typeof res.data === 'string' ? res.data : '';
        const data = parseItems(html);
        // 榜单单页全量；分类按分页
        const isEnd = topListItem.kind === 'rank' ? true : !hasPage(html, p + 1);
        return { isEnd, musicList: data };
    },
};
