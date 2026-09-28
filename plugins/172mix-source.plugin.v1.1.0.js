// 172Mix - MusicFree Plugin v1.0.0
// 搜索: /searches?query={kw}
// 分类: /genre/{slug}
// 取链: /play/{id} → 提取 mp3/m4a URL

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.172mix.com';
const UA = 'Mozilla/5.0';

const GENRES = [
    { slug: 'top40', name: 'Top40' }, { slug: 'csds1', name: '车载DJ' },
    { slug: 'csds2', name: '慢摇串烧' }, { slug: 'dj7suo', name: 'DJ独家' },
    { slug: 'dj7suocs', name: 'DJ现场' }
];

function parseItems(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href^="/play/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/play\/(\d+)/);
        if (!m) return;
        const title = ($(el).attr('title') || $(el).text() || '').replace(/^(试听|下载|收藏)/, '').trim();
        if (!title || title.length < 2) return;
        const $img = $(el).find('img').first();
        const artwork = $img.attr('data-src') || $img.attr('src') || '';
        data.push({ id: m[1], title, artist: '172Mix', artwork: artwork ? (artwork.startsWith('http') ? artwork : SITE + artwork) : undefined });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    cacheControl: 'no-store',
    name: '172Mix',
    platform: '172Mix',
    version: '1.1.0',
    author: 'hebijunge',
    description: '172Mix电音 - 分类/搜索/封面/播放',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/172mix-source.plugin.v1.1.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/searches', {
            params: { query: query, page: page || 1 },
            headers: { 'User-Agent': UA }
        });
        const data = parseItems(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getTopLists() {
        // 协议结构：[{ title?, data: [榜单项] }]，data 为榜单容器
        return [{
            title: '曲风分类',
            data: GENRES.map(g => ({ id: g.slug, title: g.name })),
        }];
    },

    async getTopListDetail(topListItem, page) {
        const res = await axios.get(SITE + '/genre/' + topListItem.id, {
            params: { page: page || 1 },
            headers: { 'User-Agent': UA }
        });
        const data = parseItems(res.data);
        return { isEnd: data.length < 20, musicList: data, topListItem };
    },

    async getMediaSource(musicItem) {
        const res = await axios.get(SITE + '/play/' + musicItem.id, { headers: { 'User-Agent': UA } });
        const m = String(res.data).match(/(https?:\/\/mp3\.172mix\.com\/[^"'\s]+\.(?:mp3|m4a))/);
        if (!m) throw new Error('取链失败');
        return { url: m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
