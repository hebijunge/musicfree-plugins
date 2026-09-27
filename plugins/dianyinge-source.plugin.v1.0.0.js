// 电音阁 (dianyinge.com) - MusicFree Plugin v1.0.0
// 搜索: /index/search/index/keyword/{kw}/p/{p}
// 取链: /play/{id}.html → var playurl= → ys.dianyinge.com

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '电音阁',
    version: '1.0.0',
    author: 'hebijunge',
    description: '电音阁 - DJ舞曲在线试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dianyinge-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.dianyinge.com/index/search/index/keyword/' + encodeURIComponent(query) + '/p/' + (page || 1));
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/play\/(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: '电音阁' });
        });
        return { isEnd: true, data };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.dianyinge.com/play/' + musicItem.id + '.html');
        const m = String(res.data).match(/playurl\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        let url = m[1];
        if (!url.startsWith('http')) url = 'https://ys.dianyinge.com' + url;
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
