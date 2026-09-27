// 黑色音频 (hy57.com) MusicFree 插件 v1.1.0
// 搜索: GET /dance/search?key={kw}            → tr.dbg，约20条
// 分类: GET /p/list-id-{cid}-{page}.html      → tr.dbg，30条/页，36个曲风分类
// 取链: GET /index.php/dance/play/url/jp/{id} → var mp3_u="m4a.hy57.com:883/...m4a"（试听）
// 歌词: GET /index.php/p/down/lrc/{id}
// 高品: 320k 下载需金币/VIP（下载页明确），免登录不可得，不伪造
// 注: 列表 /images/dj/N.jpg 为占位序号图，非真实封面

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://www.hy57.com';
const PLATFORM = '黑色音频';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;
const LIST_SIZE = 30;

const CATEGORIES = [
    [1, '串烧舞曲'], [3, '中文'], [4, 'HOUSE'], [29, 'ElectroHouse'],
    [30, 'ElectroBounce'], [31, 'ElectroMelbourne'], [32, 'ElectroDutch'], [33, 'ClubHouse'],
    [34, 'ProgHouse'], [36, 'TechHouse'], [35, 'DeepHouse'], [37, 'NuDisco'],
    [39, 'FutureHouse'], [40, 'FunkyHouse'], [53, 'BassHouse'], [54, 'Hardstyle'],
    [5, '酒吧'], [41, 'HipHop'], [42, 'Funky'], [43, 'Reggae'],
    [44, 'Dubstep'], [45, 'DanceHall'], [46, 'Trap'], [47, 'Rnb'],
    [48, 'Breakbeat'], [49, 'Pop'], [50, 'Rok'], [51, '蓝调'],
    [52, '中文(其他)'], [6, 'Mushup'], [7, '电竞DJ'], [10, '开场舞曲'],
    [21, '翻唱'], [22, '抖音神曲'], [60, '交谊舞曲'], [26, '其他'],
];

async function get(url, extraHeaders) {
    return axios.get(url, {
        headers: Object.assign({ 'User-Agent': UA }, extraHeaders || {}),
        timeout: TIMEOUT,
    });
}

// 统一解析 tr.dbg（搜索/分类列表通用）
function parseRows(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('tr.dbg').each((i, tr) => {
        const $tr = $(tr);
        let id = $tr.find('input.sortid').val();
        if (!id) {
            const m = ($tr.find('a[href*="/p/"]').first().attr('href') || '').match(/\/p\/(\d+)\.html/);
            id = m && m[1];
        }
        const $ta = $tr.find('.t1 a').first();
        const title = ($ta.attr('title') || $ta.text() || '').replace(/\s+/g, ' ').trim();
        if (!id || !title) return;
        data.push({
            id: String(id),
            title,
            artist: PLATFORM,
            artwork: '',
        });
    });
    return data;
}

module.exports = {
    platform: PLATFORM,
    version: '1.1.0',
    author: 'hebijunge',
    description: '黑色音频DJ 电子/HOUSE/串烧舞曲，支持搜索、36曲风分类、歌词、M4A试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/hy57-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await get(ORIGIN + '/dance/search?key=' + encodeURIComponent(query) + '&page=' + p);
        const data = parseRows(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id);
        const res = await get(ORIGIN + '/index.php/dance/play/url/jp/' + id, {
            Referer: ORIGIN + '/p/' + id + '.html',
        });
        const body = typeof res.data === 'string' ? res.data : '';
        const m = body.match(/var\s+mp3_u\s*=\s*["']([^"']+)["']/);
        if (!m || !m[1]) throw new Error('取链失败（高品下载需金币/VIP）');
        return { url: m[1] };
    },

    async getLyric(musicItem) {
        const id = String(musicItem.id);
        try {
            const res = await get(ORIGIN + '/index.php/p/down/lrc/' + id, {
                Referer: ORIGIN + '/p/' + id + '.html',
            });
            const lrc = (typeof res.data === 'string' ? res.data : '').trim();
            if (lrc && lrc.length > 10 && /\[\d{1,2}:\d{2}/.test(lrc)) return { rawLrc: lrc };
        } catch (e) {
            // 无歌词
        }
        return { rawLrc: '' };
    },

    async getTopLists() {
        return [
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
        if (topListItem.kind !== 'category') throw new Error('未知榜单类型');
        const res = await get(ORIGIN + '/p/list-id-' + topListItem.cid + '-' + p + '.html');
        const data = parseRows(res.data);
        return { isEnd: data.length < LIST_SIZE, musicList: data };
    },
};
