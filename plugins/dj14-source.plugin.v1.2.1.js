// 水晶舞曲网 (dj14.com) MusicFree 插件 v1.2.1
// 站点使用 dj82 程序，资源存储于 cdn.dj1198.com
// 搜索:   GET /search?keys={kw}&cid=0&type=1&page={p}   → 表格 tr.sbg，20条/页
// 分类:   GET /genre/{cid}.html                        → tr.sbg，27条/页
//         翻页 GET /genre/{cid}/0-0-0-0-{p}.html
// 榜单:   GET /top/{mixes|club|bar|electro|dancing}.html → tr.sbg，单页约67条
// 取链:   GET /music/{id}.html，解析 window.__PLAYLIST_DATA__ 中 id 匹配条目的 mp3
//         免登录可得 128kbps MP3 单档（cdn.dj1198.com）
// 高品:   320kbps(约183MB) 需会员 + DJ币，免登录不可得，不伪造
// 封面:   列表/搜索直接返回 cdn.dj1198.com 真实封面
// v1.2.1 档位诚实性收口：声明 supportedQualities=['128k']，取链回写 quality/actualQuality
//         并 Range 探测真实 size（此前只回 {url}，宿主按请求档回显 → 320k 请求显示虚标）。
//         实测 2026-10-03 id=132267：MP3 首帧头 128kbps，55,867,056B ÷ 3,491s = 16,000B/s
//         = 128.0kbps，与帧头自洽；条目 size 由时长×16000 推导（同源恒定码率，非估算高标）。

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://dj14.com';
const PLATFORM = '水晶舞曲';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;
const SEARCH_SIZE = 20;
const GENRE_SIZE = 27;
const DJ14_128K_BYTES_PER_SEC = 16000; // 128kbps 恒定档：实测 55,867,056B ÷ 3,491s = 16,000B/s

// 排行榜
const RANKS = [
    { path: 'mixes', title: '串烧舞曲排行榜' },
    { path: 'club', title: '慢歌连版排行榜' },
    { path: 'bar', title: '华语Remix排行榜' },
    { path: 'electro', title: '外语Remix排行榜' },
    { path: 'dancing', title: '酒吧套曲排行榜' },
];

// 风格分类（一级 + 常用子分类）
const CATEGORIES = [
    { path: 'c1', title: '串烧舞曲' },
    { path: 'c2', title: '中文串烧' },
    { path: 'c3', title: '英文串烧' },
    { path: 'c4', title: '中英串烧' },
    { path: 'c1113', title: '喊麦串烧' },
    { path: 'c1114', title: '现场串烧' },
    { path: 'c1140', title: '经典复古Disco' },
    { path: 'c1115', title: '越南鼓串烧' },
    { path: 'c5', title: '慢歌连版' },
    { path: 'c6', title: '中文慢歌' },
    { path: 'c7', title: '英文慢歌' },
    { path: 'c1116', title: '发烧人声' },
    { path: 'c8', title: '中文Remix' },
    { path: 'c9', title: '站长推荐' },
    { path: 'c10', title: 'Dance Club' },
    { path: 'c11', title: 'Electro' },
    { path: 'c12', title: 'ProgHouse' },
    { path: 'c1121', title: 'VinaHouse越南鼓' },
    { path: 'c1122', title: 'Funky House' },
    { path: 'c1123', title: 'Melbourne' },
    { path: 'c1124', title: 'Bounce' },
    { path: 'c1125', title: 'Electro House' },
    { path: 'c1145', title: 'Lak/House' },
    { path: 'c1148', title: '经典Disco' },
    { path: 'c13', title: '英文Remix' },
    { path: 'c1130', title: 'Prog/House' },
    { path: 'c17', title: 'Techno/Trance' },
    { path: 'c1127', title: 'Techno/EDM' },
    { path: 'c1128', title: 'Disco/Club' },
    { path: 'c1131', title: 'ElectroHouse' },
    { path: 'c1132', title: 'Psy Trance' },
    { path: 'c1147', title: 'Mashup/Hardstyle' },
    { path: 'c1117', title: '酒吧套曲' },
    { path: 'c1135', title: '独家推荐' },
    { path: 'c1139', title: 'EDM电音' },
    { path: 'c1136', title: '越南鼓套曲' },
    { path: 'c1137', title: '国潮中英文' },
    { path: 'c1138', title: '经典舞曲' },
];

async function get(url) {
    return axios.get(url, {
        headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: TIMEOUT,
    });
}

// Range 探测真实体积（HEAD 在部分 CDN 上不返 content-length）；失败返 0 由调用方兜底。
// 用 arraybuffer + Range 而非 stream：宿主 axios 在 RN 侧走 XMLHttpRequest，无 stream 适配器。
async function probeTotalBytes(url) {
    try {
        const r = await axios.get(url, {
            headers: { 'User-Agent': UA, Range: 'bytes=0-1023' },
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

// 解析表格行 tr.sbg
function parseRows(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('tr.sbg').each((i, row) => {
        const $r = $(row);
        let id = $r.find('input.sortid').val();
        if (!id) id = $r.find('a.play').attr('data-id');
        if (!id) return;
        const $titleA = $r.find('.list_play_img_title .t1 a').first();
        const title = ($titleA.text() || '').replace(/\s+/g, ' ').trim();
        if (!title) return;
        const artwork = $r.find('.list_play_img img').first().attr('src') || '';
        const $dj = $r.find('.t2 a[href*="/djshow/"]').first();
        const artist = ($dj.text() || '').trim() || PLATFORM;
        // 时长：TIME 76.17（分钟）
        let duration;
        const t2Text = $r.find('.t2').text();
        const m = t2Text.match(/TIME[:\s]*([\d.]+)/);
        if (m) duration = Math.round(parseFloat(m[1]) * 60);
        // 免登录唯一档位 128kbps MP3（实测恒定），条目 size 按时长推导供音质菜单展示
        const item = { id: String(id), title, artist, artwork, duration };
        if (duration) item.qualities = { '128k': { size: Math.round(duration * DJ14_128K_BYTES_PER_SEC) } };
        data.push(item);
    });
    return data;
}

module.exports = {
    cacheControl: 'no-store',
    name: '水晶舞曲',
    platform: PLATFORM,
    version: '1.2.1',
    author: 'hebijunge',
    description: '水晶舞曲网 DJ串烧/Remix，支持搜索、分类、榜单、封面、播放（128kbps）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj14-source.plugin.v1.2.1.js',
    supportedSearchType: ['music'],
    // 免登录只有 128kbps MP3 单档；320k 需会员+DJ币，不声明不可达档位
    supportedQualities: ['128k'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await get(ORIGIN + '/search?keys=' + encodeURIComponent(query) + '&cid=0&type=1&page=' + p);
        const data = parseRows(res.data);
        return { isEnd: data.length < SEARCH_SIZE, data };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id);
        const res = await get(ORIGIN + '/music/' + id + '.html');
        const html = typeof res.data === 'string' ? res.data : '';
        const m = html.match(/window\.__PLAYLIST_DATA__\s*=\s*(\[[\s\S]*?\])\s*;/);
        if (!m) throw new Error('无法解析播放数据');
        let list;
        try {
            list = JSON.parse(m[1]);
        } catch (e) {
            throw new Error('播放数据格式错误');
        }
        const cur = list.filter(it => String(it.id) === id && it.mp3)[0];
        if (!cur || !cur.mp3) throw new Error('该曲目免登录无可播链接（站点仅提供会员下载）');
        // 免登录仅 128kbps MP3 单档，所有音质请求均返回该地址，不伪造高品；
        // quality 必须显式回写：不回写时宿主沿用「用户请求档」渲染，320k 请求会被显示成 320k。
        const size = await probeTotalBytes(cur.mp3)
            || (musicItem.duration ? Math.round(musicItem.duration * DJ14_128K_BYTES_PER_SEC) : 0);
        const result = { url: cur.mp3, quality: '128k', actualQuality: '128k' };
        if (size) result.size = size;
        return result;
    },

    async getTopLists() {
        return [
            {
                title: '排行榜',
                data: RANKS.map(r => ({
                    id: 'top_' + r.path, title: r.title,
                    kind: 'top', path: r.path,
                })),
            },
            {
                title: '风格分类',
                data: CATEGORIES.map(c => ({
                    id: 'genre_' + c.path, title: c.title,
                    kind: 'genre', path: c.path,
                })),
            },
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        const kind = topListItem.kind;
        const path = topListItem.path;
        let url;
        let isEnd;
        if (kind === 'top') {
            url = ORIGIN + '/top/' + path + '.html';
            isEnd = true; // 榜单单页
        } else if (kind === 'genre') {
            url = p === 1
                ? ORIGIN + '/genre/' + path + '.html'
                : ORIGIN + '/genre/' + path + '/0-0-0-0-' + p + '.html';
            isEnd = false; // 由条数判断
        } else {
            throw new Error('未知榜单类型');
        }
        const res = await get(url);
        const data = parseRows(res.data);
        if (kind === 'genre') isEnd = data.length < GENRE_SIZE;
        return { isEnd, musicList: data };
    },
};
