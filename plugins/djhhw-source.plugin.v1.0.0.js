// DJ嗨嗨 (djhhw.com) - MusicFree Plugin v1.0.0
// 搜索: /dance/search?key={kw}
// 取链: /dance/play/url/jp/{id} → var mp3_u (mvp.7idj.com)

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    name: 'DJ嗨嗨',
    cacheControl: 'no-store',
    platform: 'DJ嗨嗨',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ嗨嗨舞曲网 - mvp.7idj.com CDN，无防盗链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djhhw-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.djhhw.com/dance/search.html', {
            params: { key: query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/dance/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/dance\/(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: 'DJ嗨嗨' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.djhhw.com/index.php/dance/play/url/jp/' + musicItem.id, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.djhhw.com/' }
        });
        const m = String(res.data).match(/mp3_u\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
