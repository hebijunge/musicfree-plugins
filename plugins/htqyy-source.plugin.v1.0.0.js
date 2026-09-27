// 好听轻音乐 (htqyy.com) - MusicFree Plugin v1.1.0
// 搜索: /home/search?keyword={kw}
// 分类: /genre/{id}
// 榜单: /top
// 歌单: /gedan
// 取链: 播放页提取 var mp3="x/mp3/y" → s1.htqyy.com/play9/

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'http://www.htqyy.com';
const UA = 'Mozilla/5.0';

const GENRES = [
    { id: 1, name: '纯音乐' }, { id: 2, name: '新世纪' },
    { id: 3, name: '钢琴曲' }, { id: 4, name: '减压放松' },
    { id: 5, name: '中国音乐' }, { id: 6, name: '天籁之音' },
    { id: 7, name: '影视原声' }, { id: 8, name: '电子乐' },
    { id: 9, name: '背景音乐' }, { id: 10, name: '手机铃声' },
    { id: 12, name: '胎教音乐' }, { id: 13, name: '佛乐' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href*="/play/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/play\/(\d+)/);
        if (!m) return;
        const title = $(el).text().trim();
        if (!title || title.length < 2) return;
        data.push({ id: m[1], title, artist: '好听轻音乐' });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    platform: '好听轻音乐',
    version: '1.1.0',
    author: 'hebijunge',
    description: '好听轻音乐网 - 分类/榜单/歌单/纯音乐',
    srcUrl: 'http://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/htqyy-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/home/search', {
            params: { keyword: query, p: page || 1 },
            headers: { 'User-Agent': UA, Referer: SITE + '/' }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getTopLists() {
        return [
            { title: '音乐分类', data: GENRES.map(g => ({ id: 'genre_' + g.id, title: g.name })) },
            { title: '榜单', data: [
                { id: 'top_hot', title: '热门排行' },
                { id: 'top_latest', title: '最新音乐' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (id.startsWith('genre_')) {
            url = SITE + '/genre/' + id.slice(6) + '?p=' + (page || 1);
        } else if (id === 'top_hot') {
            url = SITE + '/top?p=' + (page || 1);
        } else if (id === 'top_latest') {
            url = SITE + '/top/latest?p=' + (page || 1);
        } else throw new Error('未知分类');
        const res = await axios.get(url, { headers: { 'User-Agent': UA, Referer: SITE + '/' } });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SITE + '/play/' + musicItem.id, {
            headers: { 'User-Agent': UA, Referer: SITE + '/' }
        });
        const m = String(res.data).match(/var\s+mp3\s*=\s*"([^"]+)"/);
        if (!m) throw new Error('取链失败');
        return { url: 'http://s1.htqyy.com/play9/' + m[1] };
    },

    async getLyric() { return { rawLrc: '' }; }
};
