// 36DJ - MusicFree Plugin v1.1.0
// 搜索: /e/search/?searchget=1&keyboard={kw}
// 分类: /xc/ /myxc/ /zw/ /my/ /yw/
// 榜单: /top/
// 取链: /play/{id}.html → playurl → tn1.72djapp.cn (192~320kbps)

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.36dj.com';
const UA = 'Mozilla/5.0';

const CATEGORIES = [
    { path: '/xc/', name: '串烧舞曲' },
    { path: '/myxc/', name: '慢摇串烧' },
    { path: '/zw/', name: '中文舞曲' },
    { path: '/my/', name: '慢摇舞曲' },
    { path: '/yw/', name: '英文舞曲' },
    { path: '/html/new/', name: '最新舞曲' },
    { path: '/html/good/', name: '推荐舞曲' },
    { path: '/top/', name: 'DJ舞曲榜' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('li input[name="check"]').each((i, el) => {
        const id = $(el).attr('value');
        const $a = $(el).parent().find('a[href*="/play/"]').first();
        const title = $a.text().trim();
        if (!id || !title || title.length < 2) return;
        data.push({ id, title, artist: '36DJ' });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    platform: '36DJ',
    version: '1.1.0',
    author: 'hebijunge',
    description: '36DJ舞曲网 - 分类/榜单/搜索/高品直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/36dj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/e/search/', {
            params: { searchget: 1, keyboard: query, classid: 0, show: 'title' },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: true, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: CATEGORIES.map((c, i) => ({ id: 'cat_' + i, title: c.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const idx = parseInt(topListItem.id.replace('cat_', ''));
        const cat = CATEGORIES[idx];
        if (!cat) throw new Error('未知分类');
        const url = SITE + cat.path + (page > 1 ? (page + '.html') : '');
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', {
            headers: { 'User-Agent': UA, Referer: SITE + '/' }
        });
        const m = String(res.data).match(/playurl\s*:\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: 'https://tn1.72djapp.cn/' + m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
