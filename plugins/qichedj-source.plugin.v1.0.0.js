// 汽车DJ (qichedj.com) - MusicFree Plugin v1.0.0
// 搜索: /search.php?keyword={kw}
// 取链: cookie → music.php?action=playlink&id={id} → JSON

const axios = require('axios');
const cheerio = require('cheerio');

let cookieJar = '';

async function get(url) {
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookieJar },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: s => s < 400
    });
    if (res.headers['set-cookie']) {
        cookieJar = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    }
    return res;
}

module.exports = {
    platform: '汽车DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '汽车DJ舞曲网 - HTTP站，需cookie',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/qichedj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await get('http://www.qichedj.com/search.php?keyword=' + encodeURIComponent(query) + '&page=' + (page || 1));
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="music.php?action=detail"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/id=(\d+)/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: '汽车DJ' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await get('http://www.qichedj.com/music.php?action=playlink&id=' + musicItem.id);
        let d = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        const playUrl = d && d.data && d.data.play_url;
        if (!playUrl) throw new Error('取链失败');
        return { url: playUrl.startsWith('http') ? playUrl : 'http://www.qichedj.com' + playUrl };
    },

    async getLyric() { return { rawLrc: '' }; }
};
