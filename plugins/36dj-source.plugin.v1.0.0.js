// 36DJ - MusicFree Plugin v1.0.0
// 搜索: /e/search/?searchget=1&keyboard={kw}
// 取链: /play/{id}.html → playurl: → tn1.72djapp.cn

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '36DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '36DJ舞曲网 - 在线DJ试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/36dj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.36dj.com/e/search/', {
            params: { searchget: 1, keyboard: query },
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
            data.push({ id: m[1], title, artist: '36DJ' });
        });
        const seen = new Set();
        return { isEnd: true, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.36dj.com/play/' + musicItem.id + '.html');
        const m = String(res.data).match(/playurl\s*:\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: 'https://tn1.72djapp.cn/' + m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
