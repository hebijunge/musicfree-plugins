// 电音阁 (dianyinge.com) MusicFree 插件 v1.1.0
// 服务端渲染；封面域 dyg.dianyinge.com，播放域 ys.dianyinge.com
// 搜索: /index/search/index/keyword/{kw}/p/{p}     → div.isgood_list
// 分类: /cate/{main}/0/1/{page}（7主分类）         → div.isgood_list
// 榜单: /rank/{1..5}（新歌/人气/收藏/点赞/下载）   → div.isgood_list
// 歌单: /radio_more/3/{page} 列表 → /radio/{sid}   → #musicct a[musicid]
// 取链: /play/{id}.html → playurl="https://ys.dianyinge.com/...mp4"
// 注: 单一直链（mp4/AAC），页面标 320kbps，无多档切换，不伪造

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://www.dianyinge.com';
const PLATFORM = '电音阁';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;

const RANKS = [
    [1, '新歌排行榜'], [2, '人气排行榜'], [3, '收藏排行榜'],
    [4, '点赞排行榜'], [5, '下载排行榜'],
];

const CATEGORIES = [
    [13, '独家舞曲'], [4, '国潮中文DJ'], [2, '夜店商业舞曲'],
    [1, '国际电音舞曲'], [6, '套曲串烧'], [7, '流行音乐'], [3, '3D环绕'],
];

async function get(url) {
    return axios.get(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
        timeout: TIMEOUT,
    });
}

function cleanCover(src) {
    if (!src) return '';
    return src.split('?x-oss-process')[0];
}

// 解析 div.isgood_list（搜索/分类/榜单通用）
function parseSongList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('div.isgood_list').each((i, el) => {
        const $el = $(el);
        const $a = $el.find('a[href*="/play/"]').first();
        const href = $a.attr('href') || '';
        const m = href.match(/\/play\/(\d+)\.html/);
        if (!m) return;
        const title = ($a.attr('title') || $a.text() || '').replace(/\s+/g, ' ').trim();
        if (!title) return;
        data.push({
            id: m[1],
            title,
            artist: PLATFORM,
            artwork: cleanCover($el.find('img').first().attr('src')),
        });
    });
    return data;
}

// 解析歌单详情 #musicct
function parseSheetTracks(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href*="musicid="]').each((i, a) => {
        const href = $(a).attr('href') || '';
        const m = href.match(/musicid=(\d+)/);
        if (!m) return;
        let title = ($(a).attr('title') || $(a).text() || '').replace(/\s+/g, ' ').trim();
        title = title.replace(/^\d+\./, '').trim();
        if (!title) return;
        data.push({ id: m[1], title, artist: PLATFORM });
    });
    return data;
}

// 解析歌单列表卡片
function parseSheetCards(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href*="/radio/"]').each((i, a) => {
        const href = $(a).attr('href') || '';
        const m = href.match(/\/radio\/(\d+)\.html/);
        if (!m) return;
        const sid = m[1];
        if (data.some(d => d.sheetId === sid)) return;
        const title = ($(a).attr('title') || $(a).find('.radio_list_left_c_title').text() || '').trim();
        if (!title) return;
        data.push({
            id: 'sheet_' + sid,
            title,
            artwork: cleanCover($(a).find('img').first().attr('src')),
            kind: 'sheet',
            sheetId: sid,
        });
    });
    return data;
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
    name: '电音阁',
    platform: PLATFORM,
    version: '1.1.1',
    author: 'hebijunge',
    description: '电音阁DJ 国潮/商业/套曲/3D环绕，支持搜索、7分类、5榜单、歌单、封面、320k试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dianyinge-source.plugin.v1.1.1.js',
    supportedSearchType: ['music'],
    // 实测 2026-10-03 ys.dianyinge.com mp4：mdhd 4,770s、38,571,503B → 64.6kbps（文档 ffprobe 64005bps 一致）
    supportedQualities: ['64k'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const url = ORIGIN + '/index/search/index/keyword/' + encodeURIComponent(query) + '/p/' + p;
        const res = await get(url);
        const html = typeof res.data === 'string' ? res.data : '';
        const data = parseSongList(html);
        const isEnd = !new RegExp('/keyword/[^/]+/p/' + (p + 1) + '\\b').test(html);
        return { isEnd, data };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id);
        const res = await get(ORIGIN + '/play/' + id + '.html');
        const html = typeof res.data === 'string' ? res.data : '';
        const m = html.match(/playurl\s*=\s*["'](https?:\/\/[^"']+)["']/);
        if (!m) throw new Error('取链失败');
        const u = m[1];
            const headers = { Referer: ORIGIN + '/' };
            // 宿主只在 result.quality 存在时覆盖档位标签，否则沿用用户请求档渲染 → 必须显式回写
            const size = await probeTotalBytes(u, headers || undefined);
            const result = { url: u, quality: '64k', actualQuality: '64k' };
            if (headers) result.headers = headers;
            if (size) result.size = size;
            return result;
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        const groups = [
            {
                title: '排行榜',
                data: RANKS.map(([r, t]) => ({ id: 'rank_' + r, title: t, kind: 'rank', rank: r })),
            },
            {
                title: '舞曲分类',
                data: CATEGORIES.map(([c, t]) => ({
                    id: 'cate_' + c, title: t, kind: 'category', cate: c,
                })),
            },
        ];
        try {
            const res = await get(ORIGIN + '/radio_more/3/1');
            const sheets = parseSheetCards(typeof res.data === 'string' ? res.data : '');
            if (sheets.length) groups.push({ title: '推荐歌单', data: sheets });
        } catch (e) {
            // 歌单抓取失败不影响其他
        }
        return groups;
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        const kind = topListItem.kind;
        if (kind === 'sheet') {
            const res = await get(ORIGIN + '/radio/' + topListItem.sheetId + '.html');
            const html = typeof res.data === 'string' ? res.data : '';
            return { isEnd: true, musicList: parseSheetTracks(html) };
        }
        let url;
        if (kind === 'rank') url = ORIGIN + '/rank/' + topListItem.rank;
        else if (kind === 'category') url = ORIGIN + '/cate/' + topListItem.cate + '/0/1/' + p;
        else throw new Error('未知榜单类型');
        const res = await get(url);
        const html = typeof res.data === 'string' ? res.data : '';
        const data = parseSongList(html);
        let isEnd = true;
        if (kind === 'category') {
            isEnd = !new RegExp('/cate/' + topListItem.cate + '/0/1/' + (p + 1) + '\\b').test(html);
        }
        return { isEnd, musicList: data };
    },

    async getMusicSheetInfo(sheetItem) {
        const sid = sheetItem.sheetId || String(sheetItem.id).replace(/^sheet_/, '');
        const res = await get(ORIGIN + '/radio/' + sid + '.html');
        const html = typeof res.data === 'string' ? res.data : '';
        return { isEnd: true, musicList: parseSheetTracks(html) };
    },
};
