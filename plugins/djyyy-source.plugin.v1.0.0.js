// DJ耶耶耶 (djyyy.com) - MusicFree Plugin v1.0.0
// 搜索: /search.php?ac=dj&key={kw}
// 取链: /play/{id}.html → /t/{hash} → playurl='...m4a'

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: 'DJ耶耶耶',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ耶耶耶网 - 慢四/交谊舞/DJ舞曲',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djyyy-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://djyyy.com/search.php', {
            params: { ac: 'dj', key: query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('li[data-id]').each((i, el) => {
            const id = $(el).attr('data-id');
            const $a = $(el).find('a[href*="/play/"]');
            const title = $a.text().trim();
            if (!id || !title) return;
            data.push({ id, title, artist: 'DJ耶耶耶' });
        });
        return { isEnd: data.length < 20, data };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://djyyy.com/play/' + musicItem.id + '.html', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://djyyy.com/' }
        });
        const hashM = String(res.data).match(/<script[^>]+src="\/t\/([^"]+)"/);
        if (!hashM) throw new Error('提取hash失败');
        const tJs = await axios.get('https://djyyy.com/t/' + hashM[1], {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://djyyy.com/' }
        });
        const urlM = String(tJs.data).match(/playurl\s*=\s*["']([^"']+)["']/);
        if (!urlM) throw new Error('提取playurl失败');
        let url = urlM[1].replace(/\\\//g, '/').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
