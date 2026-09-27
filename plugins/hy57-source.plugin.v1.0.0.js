// 黑色音频 (hy57.com) - MusicFree Plugin v1.0.0
// 搜索: /dance/search?key={kw} → /p/{id}.html
// 取链: /index.php/dance/play/url/jp/{id} → var mp3_u= → m4a.hy57.com:883

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: 'hy57',
    version: '1.0.0',
    author: 'hebijunge',
    description: '黑色音频DJ - 免费DJ舞曲M4A在线试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/hy57-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.hy57.com/dance/search', {
            params: { key: query },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href^="/p/"]').each((i, el) => {
            const href = $(el).attr('href');
            const m = href.match(/\/p\/(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title) return;
            data.push({ id: m[1], title, artist: 'hy57' });
        });
        return { isEnd: true, data };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.hy57.com/index.php/dance/play/url/jp/' + musicItem.id, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.hy57.com/p/' + musicItem.id + '.html'
            }
        });
        const m = String(res.data).match(/var\s+mp3_u\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
