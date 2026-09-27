// DJ14水晶舞曲网 - MusicFree Plugin v1.0.0
// 搜索: /search?keys={kw} → /music/{id}.html
// 取链: 详情页 __PLAYLIST_DATA__ JSON → mp3 直链

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: 'DJ14',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ14水晶舞曲网 - 免费DJ舞曲在线试听',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj14-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://dj14.com/search', {
            params: { keys: query, page },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href*="/music/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/\/music\/(\d+)\.html/);
            if (!m) return;
            const $item = $(el).closest('.list-item, .music-item, li, .item') || $(el);
            const title = $(el).text().trim() || $item.find('.title, .name').text().trim();
            if (!title) return;
            data.push({
                id: m[1],
                title: title,
                artist: 'DJ14',
                artwork: $item.find('img').attr('src') || ''
            });
        });
        const seen = new Set();
        const unique = data.filter(d => !seen.has(d.id) && seen.add(d.id));
        return { isEnd: unique.length < 10, data: unique };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://dj14.com/music/' + musicItem.id + '.html', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const m = res.data.match(/__PLAYLIST_DATA__\s*=\s*(\[[\s\S]*?\]\s*;)/);
        if (!m) throw new Error('未找到播放数据');
        const list = JSON.parse(m[1].replace(/;\s*$/, ''));
        if (!list.length || !list[0].mp3) throw new Error('无可用音频');
        return { url: list[0].mp3 };
    },

    async getLyric(musicItem) {
        return { rawLrc: '' };
    }
};
