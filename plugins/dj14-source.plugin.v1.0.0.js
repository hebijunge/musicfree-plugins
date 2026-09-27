// DJ14水晶舞曲网 - MusicFree Plugin v1.1.0
// 搜索: /search?keys={kw} → /music/{id}.html
// 分类: /genre/c{id}.html
// 榜单: /top/mixes.html 等
// 取链: 详情页 __PLAYLIST_DATA__ JSON → mp3 直链

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://dj14.com';
const UA = 'Mozilla/5.0';

const CATEGORIES = [
    { id: 1, name: '串烧舞曲' },
    { id: 5, name: '慢歌连版' },
    { id: 8, name: '中文Remix' },
    { id: 13, name: '英文Remix' },
    { id: 1117, name: '酒吧套曲' },
    { id: 1135, name: '独家推荐' },
    { id: 1139, name: 'EDM电音' },
    { id: 1136, name: '越南鼓套曲' },
    { id: 1137, name: '国潮中英文' }
];

const RANKS = [
    { path: '/top/mixes.html', name: '串烧排行榜' },
    { path: '/top/club.html', name: '慢歌连版榜' },
    { path: '/top/bar.html', name: '华语Remix榜' },
    { path: '/top/electro.html', name: '外语Remix榜' },
    { path: '/top/dancing.html', name: '酒吧套曲榜' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href*="/music/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/music\/(\d+)\.html/);
        if (!m) return;
        const title = $(el).text().trim();
        if (!title || title.length < 2) return;
        const $item = $(el).closest('.list-item, .music-item, li, .item') || $(el);
        data.push({
            id: m[1],
            title: title,
            artist: 'DJ14',
            artwork: $item.find('img').attr('src') || ''
        });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    platform: 'DJ14',
    version: '1.1.0',
    author: 'hebijunge',
    description: 'DJ14水晶舞曲网 - 分类/榜单/封面/高音质',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj14-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/search', {
            params: { keys: query, page },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: CATEGORIES.map(c => ({ id: 'cat_' + c.id, title: c.name })) },
            { title: '榜单', data: RANKS.map((r, i) => ({ id: 'rank_' + i, title: r.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (id.startsWith('cat_')) {
            url = SITE + '/genre/c' + id.slice(4) + '.html';
            if (page > 1) url = SITE + '/genre/c' + id.slice(4) + '-' + page + '.html';
        } else if (id.startsWith('rank_')) {
            const idx = parseInt(id.slice(5));
            url = SITE + RANKS[idx].path;
        } else throw new Error('未知分类');
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SITE + '/music/' + musicItem.id + '.html', {
            headers: { 'User-Agent': UA }
        });
        const m = res.data.match(/__PLAYLIST_DATA__\s*=\s*(\[[\s\S]*?\]\s*;)/);
        if (!m) throw new Error('未找到播放数据');
        const list = JSON.parse(m[1].replace(/;\s*$/, ''));
        if (!list.length || !list[0].mp3) throw new Error('无可用音频');
        return { url: list[0].mp3 };
    },

    async getLyric() { return { rawLrc: '' }; }
};
