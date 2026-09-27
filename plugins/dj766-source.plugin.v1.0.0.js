// DJ766 - MusicFree Plugin v1.0.0
// 搜索: /search.html?keys={kw}
// 取链: /play/{id}.html → var playurl (pan.urlkj.com)
// 高品: /play/ → /down/

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: 'DJ766',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ766舞曲网 - 64K/320K双档',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj766-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.dj766.com/search.html', {
            params: { keys: query, page: page || 1, ajax: 1 },
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
            data.push({ id: m[1], title, artist: 'DJ766' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.dj766.com/play/' + musicItem.id + '.html');
        const m = String(res.data).match(/var\s+playurl\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        let url = m[1];
        if (quality === 'high' || quality === 'super') {
            url = url.split('?')[0].replace('/play/', '/down/').replace('https://', 'http://');
        }
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
