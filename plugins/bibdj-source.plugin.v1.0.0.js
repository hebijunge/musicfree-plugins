// 宝贝DJ (bibdj.com) - MusicFree Plugin v1.1.0
// 搜索: /search?key={kw}&page={p}
// 分类: /djstyle/s0-1.html 最近更新 / djstyle/s1-1.html 最多人关注
// 榜单: /top/mixes 串烧榜 / top/bar 华语Remix榜
// 取链: POST /play/ajax/gmap → JSON url
// 高品: /d/team/ ↔ /d/ttyp/ 互换

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.bibdj.com';
const UA = 'Mozilla/5.0';

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('a[href*="/play/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/play\/(\d+)\.html/);
        if (!m) return;
        const $img = $(el).find('img');
        const title = $(el).attr('title') || $img.attr('alt') || $(el).text().trim();
        if (!title || title.length < 2) return;
        data.push({
            id: m[1],
            title: title,
            artist: '宝贝DJ',
            artwork: $img.attr('src') ? ($img.attr('src').startsWith('http') ? $img.attr('src') : SITE + $img.attr('src')) : undefined
        });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    platform: '宝贝DJ',
    version: '1.1.0',
    author: 'hebijunge',
    description: '宝贝DJ音乐网 - 分类/榜单/封面/128K/320K双档',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/bibdj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/search', {
            params: { key: query, page: page || 1 },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getTopLists() {
        return [
            { title: '专辑', data: [
                { id: 'style_new', title: '最近更新' },
                { id: 'style_hot', title: '最多人关注' }
            ]},
            { title: '榜单', data: [
                { id: 'rank_mixes', title: '串烧舞曲榜' },
                { id: 'rank_bar', title: '华语Remix榜' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const id = topListItem.id;
        let url;
        if (id === 'style_new') url = SITE + '/djstyle/s0-' + (page || 1) + '.html';
        else if (id === 'style_hot') url = SITE + '/djstyle/s1-' + (page || 1) + '.html';
        else if (id === 'rank_mixes') url = SITE + '/top/mixes';
        else if (id === 'rank_bar') url = SITE + '/top/bar';
        else throw new Error('未知分类');
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.post(SITE + '/play/ajax/gmap',
            'action=playmusic&musicid=' + musicItem.id,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA } }
        );
        let d = res.data;
        if (typeof d === 'string') d = JSON.parse(d);
        if (d && d.data && typeof d.data === 'string') d = JSON.parse(d.data);
        let url = d && (d.url || d.mp3 || d.playurl);
        if (!url) throw new Error('取链失败');
        const isHigh = (quality === 'high' || quality === 'super');
        if (isHigh) url = url.replace('/d/team/', '/d/ttyp/');
        else url = url.replace('/d/ttyp/', '/d/team/');
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
