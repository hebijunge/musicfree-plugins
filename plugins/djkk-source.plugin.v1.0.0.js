// DJKK.cn - MusicFree Plugin v1.0.0
// 搜索: GET /dance/search.html?key={kw}
// 取链: POST /ajax/danceplayer body=id={id} → {playurl}

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: 'DJKK',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJKK舞曲网 - PC端DJ舞曲试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djkk-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://pc.djkk.cn/dance/search.html', {
            params: { key: query },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/dance/play/"], a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/(\d+)\.html?$/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: 'DJKK' });
        });
        const seen = new Set();
        return { isEnd: true, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.post('https://pc.djkk.cn/ajax/danceplayer',
            'id=' + musicItem.id + '&ids=' + musicItem.id,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' } }
        );
        if (res.data.code !== 1 || !res.data.playurl) throw new Error('取链失败');
        return { url: res.data.playurl };
    },

    async getLyric() { return { rawLrc: '' }; }
};
