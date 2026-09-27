// 82DJ舞曲网 - MusicFree Plugin v1.0.0
// 搜索: /search?search={kw} → table.list_musiclist tr.sbg
// 取链: create_cookie?id={id} → get_cookie → path (64K试听直链)

const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    platform: '82DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '82DJ舞曲网 - 免费DJ舞曲串烧在线试听下载',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/82dj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.82dj.com/search', {
            params: { search: query, page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const data = [];
        $('table.list_musiclist tr.sbg').each((i, el) => {
            const id = $(el).find('input.sortid').val();
            if (!id) return;
            const $title = $(el).find('.list_play_img_title p.t1 a');
            data.push({
                id: String(id),
                title: $title.attr('title') || $title.text().trim(),
                artist: $(el).find('td').eq(3).text().trim() || '82DJ',
                artwork: 'https://www.82dj.com' + ($(el).find('.list_play_img img').attr('src') || '')
            });
        });
        return { isEnd: data.length < 10, data };
    },

    async getMediaSource(musicItem, quality) {
        await axios.get('https://www.82dj.com/index/index/create_cookie', {
            params: { id: musicItem.id },
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.82dj.com/play/' + musicItem.id }
        });
        const res = await axios.get('https://www.82dj.com/index/index/get_cookie', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.82dj.com/play/' + musicItem.id }
        });
        const list = res.data.data || [];
        const item = list.find(x => String(x.id) === String(musicItem.id)) || list[0];
        if (!item || !item.path) throw new Error('未找到播放链接');
        return { url: item.path };
    },

    async getLyric() { return { rawLrc: '' }; }
};
