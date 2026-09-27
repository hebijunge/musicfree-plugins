// 73DJ - MusicFree Plugin v1.0.0
// 搜索: /search.htm?keyword={kw} (GB2312)
// 取链: /play/{id}.htm → danceFilePath → p21.72djapp.cn/m4adj

const axios = require('axios');
const cheerio = require('cheerio');

async function getGB(url) {
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        responseType: 'arraybuffer'
    });
    try { return new TextDecoder('gb2312').decode(new Uint8Array(res.data)); }
    catch (e) { return new TextDecoder('utf-8').decode(new Uint8Array(res.data)); }
}

module.exports = {
    platform: '73DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '73DJ舞曲网 - 64K m4a',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/73dj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const html = await getGB('https://www.73dj.com/search.htm?keyword=' + encodeURIComponent(query) + '&page=' + (page || 1));
        const $ = cheerio.load(html);
        const data = [];
        $('a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/play\/(\d+)\.htm/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: '73DJ' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const html = await getGB('https://www.73dj.com/play/' + musicItem.id + '.htm');
        const m = html.match(/danceFilePath\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: 'https://p21.72djapp.cn/m4adj/' + m[1] + '.m4a' };
    },

    async getLyric() { return { rawLrc: '' }; }
};
