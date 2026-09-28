// 82DJ舞曲网 - MusicFree Plugin v1.1.0
// 搜索: /search?search={kw} → table.list_musiclist tr.sbg
// 分类: /list/{cat}-{sub}-{sort}-{page}
// 榜单: /top/{cat}
// 取链: create_cookie → get_cookie → path (64K试听)
// 高品: 64KB→320KB 路径替换（无需登录）

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.82dj.com';
const UA = 'Mozilla/5.0';

const CATEGORIES = [
    { id: 1, name: '串烧舞曲' },
    { id: 2, name: '慢歌连版' },
    { id: 3, name: '中文舞曲' },
    { id: 4, name: '英文舞曲' }
];

const RANKS = [
    { id: 1, name: '串烧榜' },
    { id: 2, name: '慢歌榜' },
    { id: 3, name: '中文榜' },
    { id: 4, name: '英文榜' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('table.list_musiclist tr.sbg').each((i, el) => {
        const id = $(el).find('input.sortid').val();
        if (!id) return;
        const $title = $(el).find('.list_play_img_title p.t1 a');
        const artwork = $(el).find('.list_play_img img').attr('src');
        data.push({
            id: String(id),
            title: $title.attr('title') || $title.text().trim(),
            artist: $(el).find('td').eq(3).text().trim() || '82DJ',
            artwork: artwork ? 'https://www.82dj.com' + artwork : undefined
        });
    });
    return data;
}

module.exports = {
    cacheControl: 'no-store',
    name: '82DJ',
    platform: '82DJ',
    version: '1.1.0',
    author: 'hebijunge',
    description: '82DJ舞曲网 - 分类/榜单/封面/高品320K直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/82dj-source.plugin.v1.1.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/search', {
            params: { search: query, page: page || 1 },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: CATEGORIES.map(c => ({ id: 'cat_' + c.id, title: c.name })) },
            { title: '榜单', data: RANKS.map(r => ({ id: 'rank_' + r.id, title: r.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (id.startsWith('cat_')) {
            url = SITE + '/list/' + id.slice(4) + '-0-0-' + (page || 1);
        } else if (id.startsWith('rank_')) {
            url = SITE + '/top/' + id.slice(5);
        } else throw new Error('未知分类');
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        await axios.get(SITE + '/index/index/create_cookie', {
            params: { id: musicItem.id },
            headers: { 'User-Agent': UA, Referer: SITE + '/play/' + musicItem.id }
        });
        const res = await axios.get(SITE + '/index/index/get_cookie', {
            headers: { 'User-Agent': UA, Referer: SITE + '/play/' + musicItem.id }
        });
        const list = res.data.data || [];
        const item = list.find(x => String(x.id) === String(musicItem.id)) || list[0];
        if (!item || !item.path) throw new Error('未找到播放链接');
        let url = item.path;
        // 高品320K: 64KB→320KB 路径替换
        if (quality === 'high' || quality === 'super') {
            if (item.path && item.shiti_path) {
                const hostMatch = url.match(/^(https?:\/\/[^\/]+)/);
                if (hostMatch && item.path) {
                    const host = hostMatch[1];
                    const slugMatch = url.match(/\/64KB\/([^\/]+)\//);
                    if (slugMatch) {
                        url = host + '/82dj/320KB/' + slugMatch[1] + '/' + item.path;
                    }
                }
            }
        }
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
