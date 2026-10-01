// DJ766 (dj766.com) - MusicFree Plugin v1.2.0
// 同清风DJ CMS：data-* 内联 id/name/artist/cover/audio
// v1.2.0: 实测音频 CDN pan.urlkj.com 未登录访问返回明文「未授权，拒绝访问」(403)，
//   data-audio 直链需站点登录/授权态才可播 → description/hints 如实标注，未登录取链会失败。

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
    cacheControl: 'no-store',
    name: 'DJ766',
    platform: 'DJ766',
    version: '1.2.0',
    author: 'hebijunge',
    description: 'DJ766舞曲网 - 分类/榜单/搜索/封面（列表可浏览；音频直链需站点账号登录/授权，未登录取链会失败）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj766-source.plugin.v1.2.0.js',
    supportedSearchType: ['music'],
    hints: ['音频需登录/授权：列表与封面可免登录浏览，播放/下载直链未授权访问返回 403', '如你的账号可登录，请在代码里填入 Cookie 后自行验证'],

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

    async getMediaSource(musicItem, quality) {
        let url = musicItem._audio;
        if (!url) {
            const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', { headers: { 'User-Agent': UA, Referer: SITE + '/' } });
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
