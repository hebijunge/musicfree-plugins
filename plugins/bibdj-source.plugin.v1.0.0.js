// 宝贝DJ (bibdj.com) - MusicFree Plugin v1.0.0
// 搜索: /search?key={kw}&page={p}
// 取链: POST /play/ajax/gmap?action=playmusic&musicid={id} → JSON url
// 高品: /d/team/ ↔ /d/ttyp/ 互换

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '宝贝DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '宝贝DJ音乐网 - 128K/320K双档',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/bibdj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.bibdj.com/search', {
            params: { key: query, page: page || 1 },
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
            data.push({ id: m[1], title, artist: '宝贝DJ' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.post('https://www.bibdj.com/play/ajax/gmap',
            'action=playmusic&musicid=' + musicItem.id,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0' } }
        );
        let d = res.data;
        if (typeof d === 'string') d = JSON.parse(d);
        if (d && d.data && typeof d.data === 'string') d = JSON.parse(d.data);
        let url = d && (d.url || d.mp3 || d.playurl);
        if (!url) throw new Error('取链失败');
        const isHigh = (quality === 'high' || quality === 'super');
        if (isHigh) url = url.replace('/d/team/', '/d/ttyp/');
        else url = url.replace('/d/ttyp/', '/d/team/');
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
