// DJ766 (dj766.com) - MusicFree Plugin v1.4.0
// 搜索页仍是老 CMS：data-* 内联 id/name/artist/cover/audio
// v1.4.0（2026-10-02 修「分类/榜单共 0 首」）：
//   分类页 /genre/{slug}/0-0-0-{page}-1.html 与榜单页 /ranks/sole/{id}-0-0-0-{page}.html
//   改版后 isgood_list / data-audio 出现 0 次（PC 与真机双向复现：4 个条目全 0 条），
//   且硬编码的 slug/id 与站点现状也不一致。改走官方 JSON API：
//     GET /api/genres → 分类；GET /api/ranks → 榜单（9 条）
//     GET /api/songs?cate=<分类id>&page=<n> / ?rank=<榜单id>&page=<n>
//   实测 cate/rank 均为真过滤器（返回项 genre_id 齐一），page 生效、size 被忽略（固定 20/页）。
//   列表项不带直链，取链时由 v1.3.0 加的 /api/songs/:id 兜底补 listen_url。
//   注意：列表项 play_time 是上传时间戳（如 1790838502），不是时长，不能当 duration 用。
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

// 分类与榜单不再硬编码：改由 /api/genres 与 /api/ranks 动态取（v1.3.0 之前那两份
// slug/id 与站点现状已脱节，导致浏览全空）。
const PAGE_SIZE = 20; // 实测 /api/songs 忽略 size，固定每页 20 条

async function apiList(path) {
    const res = await axios.get(SITE + path, { headers: { 'User-Agent': UA }, timeout: 15000 });
    const arr = res.data && res.data.result;
    return Array.isArray(arr) ? arr : [];
}

async function apiSongs(params) {
    const res = await axios.get(SITE + '/api/songs', { params, headers: { 'User-Agent': UA }, timeout: 15000 });
    const arr = res.data && res.data.result;
    return Array.isArray(arr) ? arr : [];
}

function mapApiSong(s) {
    const item = {
        id: String(s.id),
        title: s.name || String(s.id),
        artist: s.artist_name || s.up_uname || 'DJ766',
        artwork: s.cover_url || undefined,
    };
    if (s.album_name && s.album_name !== '未知') {
        item.album = s.album_name;
    }
    // 列表项的 play_time 是上传时间戳（如 1790838502）不是时长，不能映射成 duration
    return item;
}

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
    version: '1.4.0',
    author: 'hebijunge',
    description: 'DJ766舞曲网 - 分类/榜单走官方 JSON API + 搜索 + 96k/320k 两档匿名可播（直链须去签名、不带 Referer）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj766-source.plugin.v1.4.0.js',
    supportedSearchType: ['music'],
    supportedQualities: ['96k', '320k'],
    hints: ['音频 CDN 拒带 Referer 的请求，也拒一切签名 query（含站点 API 刚下发的），故取链一律去参数、不加头', '站点标的 listen_bitrate=64 与实测不符，实际 /play/ 为 96k、/down/ 为 320k', '分类/榜单条目不带直链，首次播放会多一次 /api/songs/:id 详情请求'],

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
        const genres = await apiList('/api/genres');
        const ranks = await apiList('/api/ranks');
        const gData = genres.filter(g => g && g.id !== undefined)
            .map(g => ({ id: 'g_' + g.id, title: g.name || String(g.id), worksNum: g.hits }));
        const rData = ranks.filter(r => r && r.id !== undefined)
            .map(r => ({ id: 'r_' + r.id, title: r.name || String(r.id), worksNum: r.hits }));
        const groups = [];
        if (gData.length) groups.push({ title: '分类', data: gData });
        if (rData.length) groups.push({ title: '榜单', data: rData });
        if (!groups.length) throw new Error('DJ766 分类与榜单接口均未返回数据');
        return groups;
    },

    async getTopListDetail(topListItem, page) {
        const m = /^(g|r)_(\d+)$/.exec(String((topListItem || {}).id || ''));
        if (!m) throw new Error('DJ766 未知条目: ' + (topListItem && topListItem.id));
        // cate=分类id、rank=榜单id，两者实测均为真过滤器（返回项 genre_id 齐一）
        const params = m[1] === 'g'
            ? { cate: m[2], page: page || 1 }
            : { rank: m[2], page: page || 1 };
        const songs = await apiSongs(params);
        return { isEnd: songs.length < PAGE_SIZE, musicList: songs.map(mapApiSong), topListItem };
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
