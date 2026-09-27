// 172Mix - MusicFree Plugin v1.0.0
// 搜索: /searches?query={kw}
// 取链: /play/{id} → mp3.172mix.com m4a

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '172Mix',
    version: '1.0.0',
    author: 'hebijunge',
    description: '172Mix电音 - m4a试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/172mix-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.172mix.com/searches', {
            params: { query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a.track-name, a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/play\/(\d+)/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: '172Mix' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.172mix.com/play/' + musicItem.id);
        const m = String(res.data).match(/https?:\/\/mp3\.172mix\.com[^\s"\\]+\.m4a/);
        if (!m) throw new Error('取链失败');
        return { url: m[0] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
