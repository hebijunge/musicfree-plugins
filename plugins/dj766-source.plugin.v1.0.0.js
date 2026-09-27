// DJ766 (dj766.com) - MusicFree Plugin v1.0.0
// 同清风DJ CMS：data-* 内联 id/name/artist/cover/audio

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.dj766.com';
const UA = 'Mozilla/5.0';

const GENRES = [
    { slug: 'zwwq', name: '中文舞曲' }, { slug: 'ywwq', name: '英文舞曲' },
    { slug: 'mycs', name: '现场串烧' }, { slug: 'mglb', name: '慢歌连版' },
    { slug: 'xccs', name: '最新串烧' }
];
const RANKS = [
    { id: '1', name: '独家串烧' }, { id: '2', name: '独家中文' }, { id: '3', name: '独家英文' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('div.isgood_list').each((i, el) => {
        const id = $(el).attr('data-id');
        const name = $(el).attr('data-name');
        if (!id || !name) return;
        data.push({
            id, title: name,
            artist: $(el).attr('data-artist') || 'DJ766',
            artwork: $(el).attr('data-cover'),
            _audio: $(el).attr('data-audio') || undefined
        });
    });
    return data;
}

module.exports = {
    platform: 'DJ766',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ766舞曲网 - 分类/榜单/封面/直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj766-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/search.html', {
            params: { keys: query, page: page || 1, ajax: 1 },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: GENRES.map(g => ({ id: 'g_' + g.slug, title: g.name })) },
            { title: '榜单', data: RANKS.map(r => ({ id: 'r_' + r.id, title: r.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (id.startsWith('g_')) {
            url = SITE + '/genre/' + id.slice(2) + '/0-0-0-' + (page || 1) + '-1.html';
        } else if (id.startsWith('r_')) {
            url = SITE + '/ranks/sole/' + id.slice(2) + '-0-0-0-' + (page || 1) + '.html';
        } else throw new Error('未知分类');
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, musicList: data, topListItem };
    },

    async getMediaSource(musicItem) {
        if (musicItem._audio) return { url: musicItem._audio };
        const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', { headers: { 'User-Agent': UA, Referer: SITE + '/' } });
        const m = String(res.data).match(/var\s+playurl\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        return { url: m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
