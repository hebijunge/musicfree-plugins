// 小熊电音 (xxedm.com) - MusicFree Plugin v1.0.0
// 搜索: /search.htm?keyword={kw}
// 取链: /thread-{id}.htm → <source src> pan.urlkj.com
// 高品: /play/ → /down/

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '小熊电音',
    version: '1.0.0',
    author: 'hebijunge',
    description: '小熊电音 - DJ舞曲论坛，128K/320K双档',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/xxedm-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('http://xxedm.com/search.htm', {
            params: { keyword: query },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/thread-"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/thread-(\d+)\.htm/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 3) return;
            data.push({ id: m[1], title, artist: '小熊电音' });
        });
        const seen = new Set();
        return { isEnd: true, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('http://xxedm.com/thread-' + musicItem.id + '.htm');
        const m = String(res.data).match(/<source[^>]+src="(https?:\/\/pan\.urlkj\.com\/[^"]+\.mp3)"/);
        if (!m) throw new Error('取链失败');
        let url = m[1];
        if (quality === 'high' || quality === 'super') {
            url = url.replace('/play/', '/down/');
        }
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
