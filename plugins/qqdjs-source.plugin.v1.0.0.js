// QQDJ清风DJ音乐网 - MusicFree Plugin v1.0.0
// 搜索结果直接带 data-audio 直链，无需二次请求

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: 'QQDJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '清风DJ音乐网 - 高音质DJ舞曲',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/qqdjs-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const url = page > 1
            ? `https://www.qqdjs.com/search/page/${page}.html?keys=${encodeURIComponent(query)}`
            : `https://www.qqdjs.com/search/?keys=${encodeURIComponent(query)}`;
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('[data-id][data-audio]').each((i, el) => {
            const id = $(el).attr('data-id');
            const audio = $(el).attr('data-audio');
            if (!id || !audio) return;
            const $el = $(el);
            const title = $el.find('.title, .song-title, a').first().text().trim() || $el.text().trim().split('\n')[0].trim();
            data.push({
                id: id,
                title: title || 'DJ' + id,
                artist: 'QQDJ',
                artwork: $el.find('img').attr('src') || '',
                _audio: audio
            });
        });
        return { isEnd: data.length < 10, data };
    },

    async getMediaSource(musicItem, quality) {
        if (musicItem._audio) return { url: musicItem._audio };
        const res = await axios.get(`https://www.qqdjs.com/play/${musicItem.id}.html`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const m = res.data.match(/data-audio="([^"]+)"/);
        if (!m) throw new Error('未找到播放链接');
        return { url: m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
