// DJ766 (dj766.com) - MusicFree Plugin v1.3.0
// 同清风DJ CMS：data-* 内联 id/name/artist/cover/audio
// v1.3.0（2026-10-02 推翻「音频需登录」结论）：
//   实测 CDN pan.urlkj.com 的 403「media sign required (invalid)」不是鉴权失败，
//   而是签名本身不可用——连 /api/songs/:id 刚下发的新签名 listen_url 也照样 403
//   （签名疑似绑服务端会话/uid）。把 query 整段去掉、且不带 Referer，两档均可匿名取流：
//     /play/<日期>/<曲名>.mp3 → 96k CBR MP3（站点自己标的 listen_bitrate=64 是错的，实测 96k）
//     /down/<日期>/<曲名>.mp3 → 320k CBR MP3（体积与 download-status 声明逐条吻合：
//       13.01MB / 142.91MB / 12.15MB）
//   带 Referer 会被 CDN 拒（403），所以取链结果不附任何自定义头。
//   站点 download-status 里的 need_login=1 / coin=5 说的是它网页「下载」按钮要登录扣积分，
//   与流媒体取链无关。

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

// 站点只有 96k / 320k 两档：192k 及以上（legacy high/super 与新版高键都算）给 320k，不向下凑；
// 返回的 quality 是实测给到的档位，不是宿主请求的键。
const WANTS_HIGH_RE = /high|super|192k|224k|256k|320k|flac|hires|vinyl|dolby|atmos|master/i;
function wantsHigh(quality) { return WANTS_HIGH_RE.test(String(quality || '')); }

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
    version: '1.3.0',
    author: 'hebijunge',
    description: 'DJ766舞曲网 - 分类/榜单/搜索/封面 + 96k/320k 两档匿名可播（直链须去掉签名 query、不带 Referer）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj766-source.plugin.v1.3.0.js',
    supportedSearchType: ['music'],
    supportedQualities: ['96k', '320k'],
    hints: ['音频 CDN 拒带 Referer 的请求，也拒一切签名 query（含站点 API 刚下发的），故取链一律去参数、不加头', '站点标的 listen_bitrate=64 与实测不符，实际 /play/ 为 96k、/down/ 为 320k'],

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
            // 列表未给直链 → 官方 API 详情取 sub.listen_url（匿名可用，且带 play_time 等元数据）
            try {
                const api = await axios.get(SITE + '/api/songs/' + musicItem.id, {
                    headers: { 'User-Agent': UA }, timeout: 15000,
                });
                const sub = api.data && api.data.result && api.data.result.sub;
                url = sub && sub.listen_url;
            } catch (e) { url = null; }
        }
        if (!url) {
            const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', { headers: { 'User-Agent': UA, Referer: SITE + '/' } });
            const m = String(res.data).match(/var\s+playurl\s*=\s*["']([^"']+)["']/);
            if (!m) throw new Error('DJ766 取链失败：列表/API/播放页均未给到直链');
            url = m[1];
        }
        // 签名一律去掉（带任何签名都 403），且不能附 Referer
        const bare = url.split('?')[0];
        if (bare.includes('/play/')) {
            return wantsHigh(quality)
                ? { url: bare.replace('/play/', '/down/'), quality: '320k' }
                : { url: bare, quality: '96k' };
        }
        return { url: bare };
    },

    async getLyric() { return { rawLrc: '' }; }
};
