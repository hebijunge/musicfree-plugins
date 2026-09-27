// 我是DJ (54dj.com) - MusicFree Plugin v1.0.0
// 搜索: /searches?q={kw}
// 取链: /topics/{id} → listenUrl → cdn.54dj.vip/low/...m4a
// 高品: low→high, m4a→mp3

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '我是DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '我是DJ(54dj) - DJ舞曲在线试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/54dj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.54dj.com/searches', {
            params: { q: query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href^="/topics/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/topics\/(\d+)/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 5) return;
            data.push({ id: m[1], title, artist: '54DJ' });
        });
        return { isEnd: data.length < 10, data };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.54dj.com/topics/' + musicItem.id, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
        });
        const m = String(res.data).match(/listenUrl\s*:\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        let url = m[1];
        if (quality === 'high' || quality === 'super') {
            url = url.replace('/low/', '/high/').replace(/\.m4a(\?|$)/i, '.mp3$1');
        }
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
