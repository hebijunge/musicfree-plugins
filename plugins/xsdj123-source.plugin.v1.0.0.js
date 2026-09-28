// 先上DJ (xsdj123.com) - MusicFree Plugin v1.0.0
// 搜索: /music/find?keyword=xxx&page=N
// 列表: /music/list-1-0?type=new&page=N
// 详情: /music/info-{id} → <audio src> aac 直链
// 免登录, AAC 直链

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.xsdj123.com';
const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile';

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = {};
    $('tr.p-tr').each((i, el) => {
        const $el = $(el);
        const href = $el.find('a[href*="/music/info-"]').first().attr('href') || '';
        const m = href.match(/info-(\d+)/);
        if (!m || seen[m[1]]) return;
        seen[m[1]] = true;
        const img = $el.find('img.list-img').first();
        const title = (img.attr('alt') || $el.find('.p-box-a').text()).trim();
        const cover = img.attr('src');
        if (!title) return;
        data.push({
            id: m[1],
            title: title,
            artist: '先上DJ',
            artwork: cover
        });
    });
    return data;
}

module.exports = {
    cacheControl: 'no-cache',
    name: '先上DJ',
    platform: '先上DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '先上DJ - AAC直链/搜索/最新舞曲',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/xsdj123-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = page || 1;
        const res = await axios.get(SITE + '/music/find', {
            params: { keyword: query, page: p },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 15, data };
    },

    async getTopLists() {
        return [
            { title: '推荐', data: [
                { id: 'new', title: '最新舞曲' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = page || 1;
        const res = await axios.get(SITE + '/music/list-1-0', {
            params: { type: 'new', page: p },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 15, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SITE + '/music/info-' + musicItem.id, {
            headers: { 'User-Agent': UA }
        });
        const m = res.data.match(/<audio[^>]+src="([^"]+\.aac[^"]*)"/i);
        if (!m) throw new Error('未找到播放地址');
        return { url: m[1] };
    },

    async getLyric(musicItem) {
        throw new Error('该音源暂无歌词');
    }
};
