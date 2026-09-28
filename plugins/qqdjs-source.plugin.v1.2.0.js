// QQDJ清风DJ音乐网 - MusicFree Plugin v1.1.0
// 搜索结果直接带 data-audio 直链，无需二次请求
// 分类: /genre/{slug}/

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.qqdjs.com';
const UA = 'Mozilla/5.0';

const CATEGORIES = [
    { slug: 'xccs', name: '现场串烧' },
    { slug: 'zwcs', name: '中文串烧' },
    { slug: 'wycs', name: '外语串烧' },
    { slug: 'zycs', name: '中英串烧' },
    { slug: 'Pop_Music', name: '流行串烧' },
    { slug: 'zwwq', name: '中文舞曲' },
    { slug: 'ywwq', name: '英文舞曲' },
    { slug: 'reboedm', name: '硬核电音' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('[data-id][data-audio]').each((i, el) => {
        const id = $(el).attr('data-id');
        const audio = $(el).attr('data-audio');
        if (!id || !audio) return;
        const $el = $(el);
        const $title = $el.find('a[href*="/play/"]').first();
        const title = $title.text().trim() || $el.text().trim().split('\n')[0].trim();
        data.push({
            id: id,
            title: title || 'DJ' + id,
            artist: 'QQDJ',
            artwork: $el.find('img').attr('src') || '',
            _audio: audio
        });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    cacheControl: 'no-store',
    name: 'QQDJ',
    platform: 'QQDJ',
    version: '1.2.0',
    author: 'hebijunge',
    description: '清风DJ音乐网 - 分类/封面/高音质(320K)',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/qqdjs-source.plugin.v1.2.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const url = page > 1
            ? SITE + '/search/page/' + page + '.html?keys=' + encodeURIComponent(query)
            : SITE + '/search/?keys=' + encodeURIComponent(query);
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: CATEGORIES.map(c => ({ id: 'cat_' + c.slug, title: c.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const slug = topListItem.id.replace('cat_', '');
        const url = page > 1
            ? SITE + '/genre/' + slug + '/page/' + page + '.html'
            : SITE + '/genre/' + slug + '/';
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        let url = musicItem._audio || '';
        if (!url) {
            const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', {
                headers: { 'User-Agent': UA }
            });
            const m = res.data.match(/data-audio="([^"]+)"/);
            if (!m) throw new Error('未找到播放链接');
            url = m[1];
        }
        // 高品320K: play → down，去掉签名参数
        if ((quality === 'high' || quality === 'super') && url.includes('/play/')) {
            url = url.replace('/play/', '/down/').split('?')[0];
        }
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
