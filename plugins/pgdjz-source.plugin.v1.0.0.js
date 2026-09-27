// 皮狗DJ (pgdjz.com) - MusicFree Plugin v1.0.0
// 搜索: /dance/search.html?key={kw}
// 取链: /ajax/danceplayer?id={id} → {code:1,playurl}

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '皮狗DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '皮狗DJ舞曲网 - m4a试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/pgdjz-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.pgdjz.com/dance/search.html', {
            params: { key: query },
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
            data.push({ id: m[1], title, artist: '皮狗DJ' });
        });
        const seen = new Set();
        return { isEnd: true, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.pgdjz.com/ajax/danceplayer?id=' + musicItem.id);
        if (!res.data || res.data.code !== 1 || !res.data.playurl) throw new Error('取链失败');
        return { url: res.data.playurl };
    },

    async getLyric() { return { rawLrc: '' }; }
};
