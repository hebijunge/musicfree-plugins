// 清风DJ (ddddj.com) - MusicFree Plugin v1.0.0
// 搜索: /search?keyword={kw}
// 取链: /play/{id}.html → var playurl (pan.urlkj.com 带签名)

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '清风DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '清风DJ舞曲网 - pan.urlkj.com CDN',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/ddddj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.ddddj.com/search.html', {
            params: { keys: query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/play\/(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: '清风DJ' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.ddddj.com/play/' + musicItem.id + '.html', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.ddddj.com/' }
        });
        const m = String(res.data).match(/var\s+playurl\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
