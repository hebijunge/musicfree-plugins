// 好听轻音乐 (htqyy.com) MusicFree 插件 v1.2.1
// 搜索: /home/search?keyword={kw}&p={p}
// 分类: /genre/{id}?p={p}
// 榜单: /top?p={p}、/top/latest?p={p}
// 歌单: /gedan 列表 → /gedan/{id}（20首单页）
// 取链: 播放页 var mp3="{id}/mp3/1" → http://s1.htqyy.com/play9/{id}/mp3/1（单档 mp3）
// 封面: 歌曲 http://i.htqyy.com/img8/0/{id}.jpg；歌单 http://i.htqyy.com/gedan/img/gd/{id}s.jpg
// 注: 站点仅 http（实测 https 443 连接被拒）；单档音质（mp3/2 变体实测 403），不伪造高品
// v1.2.1 修复: s1.htqyy.com 强制校验 Referer，旧实现取链不回传 headers，
//   带 Referer 实测 206 audio/mpeg，不带 401 XHTML —— 表现为「播放不了」而非站点失效。
//   另 srcUrl 原本写成 http://raw.githubusercontent.com（raw 只服务 https），自更新必然失败。

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'http://www.htqyy.com';
const UA = 'Mozilla/5.0';
const TIMEOUT = 10000;

const GENRES = [
    { id: 1, name: '纯音乐' }, { id: 2, name: '新世纪' },
    { id: 3, name: '钢琴曲' }, { id: 4, name: '减压放松' },
    { id: 5, name: '中国音乐' }, { id: 6, name: '天籁之音' },
    { id: 7, name: '影视原声' }, { id: 8, name: '电子乐' },
    { id: 9, name: '背景音乐' }, { id: 10, name: '手机铃声' },
    { id: 12, name: '胎教音乐' }, { id: 13, name: '佛乐' },
];

async function get(url) {
    return axios.get(url, {
        headers: { 'User-Agent': UA, Referer: SITE + '/' },
        timeout: TIMEOUT,
    });
}

// 解析曲目（标题链接与“播放”按钮同 id，去重并保留真实标题）
function parseTracks(html) {
    const $ = cheerio.load(html);
    const map = new Map();
    $('a[href*="/play/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/play\/(\d+)/);
        if (!m) return;
        const id = m[1];
        const raw = $(el).text().replace(/\s+/g, ' ').trim();
        const isBtn = /^(播放|play|▶)$/i.test(raw);
        if (!map.has(id)) map.set(id, isBtn ? '' : raw);
        else if (!isBtn && !map.get(id)) map.set(id, raw);
    });
    return [...map.entries()]
        .filter(([, t]) => t)
        .map(([id, title]) => ({
            id: String(id),
            title,
            artist: '好听轻音乐',
            artwork: 'http://i.htqyy.com/img8/0/' + id + '.jpg',
        }));
}


// Range 探测真实体积（HEAD 在部分 CDN 不返 content-length）；失败返 0 由调用方兜底。
// 用 arraybuffer+Range：宿主 axios 在 RN 侧走 XMLHttpRequest，没有 stream 适配器。
async function probeTotalBytes(url, headers) {
    try {
        const r = await axios.get(url, {
            headers: Object.assign({ 'User-Agent': UA, Range: 'bytes=0-1023' }, headers || {}),
            timeout: (typeof TIMEOUT !== 'undefined' ? TIMEOUT : 10000),
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
    name: '好听轻音乐',
    platform: '好听轻音乐',
    version: '1.2.2',
    author: 'hebijunge',
    description: '好听轻音乐网 纯音乐/钢琴/新世纪，支持搜索、12分类、榜单、歌单、封面、播放',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/htqyy-source.plugin.v1.2.2.js',
    supportedSearchType: ['music'],
    // 实测 2026-10-03 s1.htqyy.com/play9：MP3 首帧头 128kbps，站点仅此一路流
    supportedQualities: ['128k'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await get(SITE + '/home/search?keyword=' + encodeURIComponent(query) + '&p=' + (page || 1));
        const data = parseTracks(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id);
        const res = await get(SITE + '/play/' + id);
        const body = typeof res.data === 'string' ? res.data : '';
        const m = body.match(/var\s+mp3\s*=\s*"([^"]+)"/);
        if (!m) throw new Error('取链失败');
        // CDN 强制校验 Referer：缺它返回 401 + XHTML，播放器只会表现为「无法播放」
        const url = 'http://s1.htqyy.com/play9/' + m[1];
        const headers = { Referer: SITE + '/', 'User-Agent': UA };
        const size = await probeTotalBytes(url, headers);
        // 宿主只在 result.quality 存在时覆盖档位标签，否则沿用用户请求档渲染 → 必须显式回写
        const result = { url, quality: '128k', actualQuality: '128k', headers };
        if (size) result.size = size;
        return result;
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        const groups = [
            {
                title: '音乐分类',
                data: GENRES.map(g => ({
                    id: 'genre_' + g.id, title: g.name, kind: 'genre',
                })),
            },
            {
                title: '榜单',
                data: [
                    { id: 'top_hot', title: '热门排行', kind: 'top_hot' },
                    { id: 'top_latest', title: '最新音乐', kind: 'top_latest' },
                ],
            },
        ];
        // 热门歌单（动态抓取）
        try {
            const res = await get(SITE + '/gedan');
            const $ = cheerio.load(res.data);
            const sheets = [];
            $('a[href*="/gedan/"]').each((i, a) => {
                const href = $(a).attr('href') || '';
                if (href.indexOf('/gedan/index/') !== -1) return;
                const m = href.match(/\/gedan\/(\d+)(?:\?|$)/);
                if (!m) return;
                const sid = m[1];
                if (sheets.some(s => s.sheetId === sid)) return;
                const title = $(a).text().replace(/\s+/g, ' ').trim();
                if (!title) return;
                sheets.push({
                    id: 'sheet_' + sid, title,
                    artwork: 'http://i.htqyy.com/gedan/img/gd/' + sid + 's.jpg',
                    kind: 'sheet', sheetId: sid,
                });
            });
            if (sheets.length) groups.push({ title: '热门歌单', data: sheets });
        } catch (e) {
            // 歌单抓取失败不影响其他
        }
        return groups;
    },

    async getTopListDetail(topListItem, page) {
        const p = page || 1;
        const kind = topListItem.kind;
        let url;
        if (kind === 'genre') url = SITE + '/genre/' + topListItem.id.slice(6) + '?p=' + p;
        else if (kind === 'top_hot') url = SITE + '/top?p=' + p;
        else if (kind === 'top_latest') url = SITE + '/top/latest?p=' + p;
        else if (kind === 'sheet') url = SITE + '/gedan/' + topListItem.sheetId;
        else throw new Error('未知分类');
        const res = await get(url);
        const data = parseTracks(res.data);
        return { isEnd: kind === 'sheet' ? true : data.length < 20, musicList: data };
    },
};
