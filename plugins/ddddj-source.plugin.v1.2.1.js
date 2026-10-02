// 清风DJ (ddddj.com) - MusicFree Plugin v1.2.1
// 搜索: /search.html?keys={kw}
// 列表: /genre/{slug}/{type}-0-0-0-{page}-1.html
// 榜单: /ranks/sole/{type}-0-0-0-{page}.html
// 音质（2026-10-02 实测，同一 CDN pan.urlkj.com，两站清风DJ/QQDJ 通用）：
//   /play/<日期>/<曲名>.mp3?t=&sign= → 96k CBR MP3（列表页 data-audio 给的就是这条）
//   /down/<日期>/<曲名>.mp3          → 320k CBR MP3
//   签名绑定在 /play/ 上：换 /down/ 必须整段去掉 query，否则 CDN 回 403
//   "media sign required (invalid)"；/down/ 也不接受 Referer，故不附任何自定义头。
//   旧实现按 play.urlkj.com→down.urlkj.com 改写，站点早已不用该域名/路径，规则永不命中，
//   等于所有音质都给 96k。

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

// 站点只有 96k / 320k 两档：192k 及以上（含 legacy high/super 与新版各高键）一律给 320k，
// 不向下凑；返回的 quality 是实际给到的档位，不是宿主请求的键。
const WANTS_HIGH_RE = /high|super|192k|224k|256k|320k|flac|hires|vinyl|dolby|atmos|master/i;
function wantsHigh(quality) { return WANTS_HIGH_RE.test(String(quality || '')); }

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
    cacheControl: 'no-store',
    name: '清风DJ',
    platform: '清风DJ',
    version: '1.2.1',
    author: 'hebijunge',
    description: '清风DJ舞曲网 - 分类/榜单/封面/96k与320k两档实测取链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/ddddj-source.plugin.v1.2.1.js',
    supportedSearchType: ['music'],
    supportedQualities: ['96k', '320k'],

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
        // 优先用列表页直接给的 audio（96k 试听版）
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
        const isPlay = url.includes('/play/');
        if (wantsHigh(quality) && isPlay) {
            // /play/ → /down/ 且必须丢掉绑定在 play 路径上的签名
            return { url: url.replace('/play/', '/down/').split('?')[0], quality: '320k' };
        }
        return isPlay ? { url, quality: '96k' } : { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
