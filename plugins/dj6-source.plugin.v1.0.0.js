// DJ6.cn (皇族DJ学院) - MusicFree Plugin v1.0.0
// 列表: /mlist-{tid}-{page}.html → a[href^="/play-"]
// 取链: play-{id}.html → iframe m=media/...mp3 → mp3.dj6.cn
// 注意: 搜索已关闭，无封面，音质约32kbps

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    cacheControl: 'no-store',
    name: 'DJ6',
    platform: 'DJ6',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ6皇族DJ学院 - DJ舞曲列表（搜索已关闭）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj6-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        return { isEnd: true, data: [] };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.dj6.cn/play-' + musicItem.id + '.html');
        const m = String(res.data).match(/m=([^&"']+\.mp3)/);
        if (!m) throw new Error('取链失败');
        return { url: 'https://mp3.dj6.cn/' + m[1] };
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        return [{ title: 'DJ6', data: [
            { id: '2', title: 'DJ舞曲' },
            { id: '3', title: '酒吧舞曲' },
            { id: '4', title: '中文舞曲' },
            { id: '5', title: '舞曲串烧' }
        ]}];
    },

    async getTopListDetail(topListItem, page) {
        const res = await axios.get(`https://www.dj6.cn/mlist-${topListItem.id}-${page || 1}.html`);
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href^="/play-"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/play-(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title) return;
            data.push({ id: m[1], title, artist: 'DJ6' });
        });
        return { isEnd: data.length < 50, musicList: data };
    }
};
