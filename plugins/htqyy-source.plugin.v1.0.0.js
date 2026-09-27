// 好听轻音乐 (htqyy.com) - MusicFree Plugin v1.0.0
// 搜索: /home/search?keyword={kw}
// 取链: 播放页提取 var mp3="x/mp3/y" → s1.htqyy.com/play9/

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '好听轻音乐',
    version: '1.0.0',
    author: 'hebijunge',
    description: '好听轻音乐网 - 纯音乐/轻音乐',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/htqyy-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('http://www.htqyy.com/home/search', {
            params: { keyword: query },
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://www.htqyy.com/' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/play\/(\d+)/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title || title.length < 2) return;
            data.push({ id: m[1], title, artist: '好听轻音乐' });
        });
        const seen = new Set();
        return { isEnd: data.length < 20, data: data.filter(d => !seen.has(d.id) && seen.add(d.id)) };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('http://www.htqyy.com/play/' + musicItem.id, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'http://www.htqyy.com/' }
        });
        const m = String(res.data).match(/var\s+mp3\s*=\s*"([^"]+)"/);
        if (!m) throw new Error('取链失败');
        return { url: 'http://s1.htqyy.com/play9/' + m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
