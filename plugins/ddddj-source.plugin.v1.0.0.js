// 清风DJ (ddddj.com) - MusicFree Plugin v1.2.0
// 搜索: /search.html?keys={kw}
// 列表: /genre/{slug}/{type}-0-0-0-{page}-1.html
// 榜单: /ranks/sole/{type}-0-0-0-{page}.html
// 音质: 试听=play.urlkj.com/m4a2022/(压缩128K), 高品320K=down.urlkj.com/(去掉m4a2022层)

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.ddddj.com';
const UA = 'Mozilla/5.0';

const GENRES = [
    { slug: 'cswq', name: '串烧舞曲' }, { slug: 'mycs', name: '慢摇串烧' },
    { slug: 'xcwq', name: '现场串烧' }, { slug: 'mccs', name: '喊麦现场' },
    { slug: 'gqlb', name: '慢歌连版' }, { slug: 'zwwq', name: '中文舞曲' },
    { slug: 'proghouse', name: 'ProgHouse' }, { slug: 'lakhouse', name: 'LakHouse' },
    { slug: 'electro', name: 'Electro' }, { slug: 'funkyhouse', name: 'FunkyHouse' },
    { slug: 'vinahouse', name: 'VinaHouse' }, { slug: 'ywwq', name: '英文舞曲' }
];

const RANKS = [
    { id: '1', name: '独家推荐' }, { id: '2', name: '独家中文' }, { id: '3', name: '独家英文' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('div.isgood_list').each((i, el) => {
        const id = $(el).attr('data-id');
        const name = $(el).attr('data-name');
        const artist = $(el).attr('data-artist') || '清风DJ';
        const cover = $(el).attr('data-cover');
        const audio = $(el).attr('data-audio');
        if (!id || !name) return;
        data.push({
            id, title: name, artist,
            artwork: cover,
            _audio: audio || undefined
        });
    });
    return data;
}

module.exports = {
    platform: '清风DJ',
    version: '1.2.0',
    author: 'hebijunge',
    description: '清风DJ舞曲网 - 分类/榜单/封面/高品320K直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/ddddj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/search.html', {
            params: { keys: query, page: page || 1 },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getTopLists() {
        const groups = [
            { title: '分类', data: GENRES.map(g => ({ id: 'genre_' + g.slug, title: g.name })) },
            { title: '榜单', data: RANKS.map(r => ({ id: 'rank_' + r.id, title: r.name })) }
        ];
        return groups;
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (id.startsWith('genre_')) {
            const slug = id.slice(6);
            url = SITE + '/genre/' + slug + '/0-0-0-' + (page || 1) + '-1.html';
        } else if (id.startsWith('rank_')) {
            const type = id.slice(5);
            url = SITE + '/ranks/sole/' + type + '-0-0-0-' + (page || 1) + '.html';
        } else {
            throw new Error('未知分类');
        }
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        // 优先用列表页直接给的 audio（试听版）
        let url = musicItem._audio;
        if (!url) {
            // 请求播放页提取 playurl
            const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', {
                headers: { 'User-Agent': UA, Referer: SITE + '/' }
            });
            const m = String(res.data).match(/var\s+playurl\s*=\s*["']([^"']+)["']/);
            if (!m) throw new Error('取链失败');
            url = m[1];
        }
        // 高品320K: play→down, 去掉 /m4a2022/ 路径层
        if (quality === 'high' || quality === 'super') {
            url = url.replace('play.urlkj.com', 'down.urlkj.com').replace('/m4a2022/', '/');
        }
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
