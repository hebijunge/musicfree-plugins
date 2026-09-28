// DJF5 - MusicFree Plugin v1.0.0
// 搜索: /dance/search?key={kw} → /dance/play-{id}.html
// 取链: /dance/djuq/playurl/{id} → 302 CDN

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    name: 'DJF5',
    cacheControl: 'no-store',
    platform: 'DJF5',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJF5舞曲网 - 在线DJ舞曲试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djf5-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.djf5.com/dance/search', {
            params: { key: query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/dance/play-"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/play-(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: 'DJF5' });
        });
        return { isEnd: true, data };
    },

    async getMediaSource(musicItem, quality) {
        let url = 'https://www.djf5.com/dance/djuq/playurl/' + musicItem.id;
        if (quality === 'high' || quality === 'super') {
            url = url.replace('/play/', '/down/');
        }
        return { url, headers: { 'User-Agent': 'Mozilla/5.0' } };
    },

    async getLyric() { return { rawLrc: '' }; }
};
