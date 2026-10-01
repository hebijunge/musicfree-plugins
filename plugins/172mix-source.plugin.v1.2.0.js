// 172Mix (172mix.com) - MusicFree Plugin v1.2.0
// 列表/搜索: /searches?query={kw}&page={p}、/genre/{slug}[/page/N]、/ranks/{id}[/page/N]、/album/{id}
// 取链: /play/{id} 页面内联 https://mp3.172mix.com/....m4a（单档在线试听流）
// v1.2.0 重写：v1.1.0 的列表选择器写的是相对链接 a[href^="/play/"]，而站点输出的是
//   绝对链接 https://www.172mix.com/play/123，一条都匹配不上 → 搜索/榜单恒 0 条。

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.172mix.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 15000;

const GENRES = [
    { slug: 'top40', name: 'Top40' }, { slug: 'csds1', name: '车载DJ' },
    { slug: 'csds2', name: '慢摇串烧' }, { slug: 'dj7suo', name: 'DJ独家' },
    { slug: 'dj7suocs', name: 'DJ现场' }
];
const RANKS = [
    { slug: 'sole', name: '独家舞曲' }, { slug: 'zwphb', name: '中文排行榜' },
    { slug: 'wwphb', name: '外文排行榜' }, { slug: 'housephb', name: '电音House排行榜' },
    { slug: 'sjcsds', name: '串烧大赛' }
];

function get(url, referer) {
    return axios.get(url, {
        headers: { 'User-Agent': UA, Referer: referer || SITE + '/' },
        timeout: TIMEOUT,
        validateStatus: (s) => s >= 200 && s < 400,
    });
}

// 「六哲 - 会受伤的人只有一种可能(Dj阿航 ProgHouse Mix国语男)」→ 歌手 + 曲名。
// 仅在出现「空格-连字符-空格」这种明确的歌手分隔时拆；「Dj蛋挞-国粤语…串烧」这类
// 混音师前缀不带空格，整串留作曲名（站点自身也是整串展示）。
function splitArtistTitle(name) {
    const s = String(name || '').replace(/\s+/g, ' ').trim();
    const m = s.match(/^(.{1,40}?)\s+-\s+(.+)$/);
    if (m) return { artist: m[1].trim(), title: m[2].trim() };
    return { artist: '172Mix', title: s };
}

function parseTracks(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = new Set();
    $('li.track-item').each((i, el) => {
        const $a = $(el).find('a[href*="/play/"]').first();
        const href = $a.attr('href') || '';
        const m = href.match(/\/play\/(\d+)/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;
        seen.add(id);
        const raw = ($a.attr('title') || $a.text() || '').replace(/^(试听|下载|收藏)/, '').trim();
        if (!raw || raw.length < 2) return;
        const t = splitArtistTitle(raw);
        data.push({ id: id, title: t.title, artist: t.artist, album: '', _full: raw });
    });
    return data;
}

// 专辑（站点称「专辑」，实为 DJ 套曲合辑）列表页 → /album/{id} 条目
function parseAlbums(html) {
    const $ = cheerio.load(html);
    const out = [];
    const seen = new Set();
    $('a[href*="/album/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/album\/(\d+)/);
        if (!m || seen.has(m[1])) return;
        const title = $(el).text().replace(/\s+/g, ' ').trim();
        if (!title || title.length < 2) return;
        seen.add(m[1]);
        const $img = $(el).find('img').first();
        const src = $img.attr('data-src') || $img.attr('src') || '';
        out.push({
            id: 'album_' + m[1], title: title, kind: 'album', albumId: m[1],
            artwork: src ? (/^https?:/.test(src) ? src : SITE + (src.startsWith('/') ? '' : '/') + src) : undefined,
        });
    });
    return out;
}

// 播放页 → 内联在线试听流（单档 AAC/m4a，非站点标称的 320K 下载档）
function parsePlayPage(html) {
    const body = String(html);
    const urls = body.match(/https?:\/\/mp3\.172mix\.com\/[^"'\s\\)]+?\.(?:mp3|m4a)/g) || [];
    const uniq = [...new Set(urls)];
    return uniq.length ? uniq[0] : '';
}

// Range 分段读 mp4 盒：mvhd 里拿真实时长，用来把「总字节 / 时长」折算成码率如实标档。
// 站点下载档标称 320Kbps，但在线试听流实测只有 ~65Kbps，不能拿标称当能力。
async function measureAudio(url) {
    let total = 0;
    let head;
    try {
        head = await axios.get(url, {
            headers: { 'User-Agent': UA, Referer: SITE + '/', Range: 'bytes=0-65535' },
            responseType: 'arraybuffer', timeout: TIMEOUT, validateStatus: () => true,
        });
    } catch (e) {
        return { total: 0, seconds: 0 };
    }
    const cr = String(head.headers['content-range'] || '');
    const m = cr.match(/\/(\d+)\s*$/);
    if (m) total = parseInt(m[1], 10) || 0;
    else total = parseInt(String(head.headers['content-length'] || '0'), 10) || 0;
    let buf = Buffer.from(head.data || []);
    let idx = buf.indexOf('mvhd');
    if (idx < 0 && total > buf.length) {
        try {
            const tail = await axios.get(url, {
                headers: { 'User-Agent': UA, Referer: SITE + '/', Range: 'bytes=' + Math.max(0, total - 262144) + '-' + (total - 1) },
                responseType: 'arraybuffer', timeout: TIMEOUT, validateStatus: () => true,
            });
            buf = Buffer.concat([buf, Buffer.from(tail.data || [])]);
            idx = buf.indexOf('mvhd');
        } catch (e) { /* 尾部读不到就不标时长 */ }
    }
    if (idx < 0) return { total: total, seconds: 0 };
    const p = idx + 4;
    const version = buf[p];
    let ts = 0, dur = 0;
    if (version === 1) {
        ts = buf.readUInt32BE(p + 20);
        dur = Number(buf.readBigUInt64BE(p + 24));
    } else {
        ts = buf.readUInt32BE(p + 12);
        dur = buf.readUInt32BE(p + 16);
    }
    return { total: total, seconds: ts > 0 ? dur / ts : 0 };
}

function pageSuffix(page) {
    const p = parseInt(page, 10) || 1;
    return p > 1 ? '/page/' + p : '';
}

module.exports = {
    cacheControl: 'no-store',
    name: '172Mix',
    platform: '172Mix',
    version: '1.2.0',
    author: 'hebijunge',
    description:
        '172Mix电音网：分类/榜单/专辑/搜索/播放。' +
        '在线试听流实测约 65Kbps AAC（单档），站点标称的 320Kbps 是需登录下载的另一份文件，故只声明 64k。' +
        '站点 CDN 对含非 ASCII 字符的搜索词直接 403（未登录无 cookie 可绕），中文关键词搜索返回空属站点限制。',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/172mix-source.plugin.v1.2.0.js',
    supportedSearchType: ['music'],
    supportedQualities: ['64k'],
    hints: [
        '搜索仅 ASCII 关键词可用（中文词被站点 CDN 判 403）',
        '单档 ~65Kbps AAC 在线流，非站点下载档的 320Kbps',
        '舞曲/串烧长音频，串烧普遍 30~90 分钟',
    ],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        let res;
        try {
            res = await axios.get(SITE + '/searches', {
                params: { query: query, page: page || 1 },
                headers: { 'User-Agent': UA, Referer: SITE + '/' },
                timeout: TIMEOUT,
                validateStatus: (s) => s >= 200 && s < 400,
            });
        } catch (e) {
            // 403：站点 WAF 拦非 ASCII 关键词；其余网络错误照常抛出
            if (/status code 403/i.test(String(e && e.message))) return { isEnd: true, data: [] };
            throw e;
        }
        const data = parseTracks(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getTopLists() {
        const groups = [
            { title: '曲风分类', data: GENRES.map(g => ({ id: 'genre_' + g.slug, title: g.name, kind: 'genre', slug: g.slug })) },
            { title: '榜单', data: RANKS.map(r => ({ id: 'rank_' + r.slug, title: r.name, kind: 'rank', slug: r.slug })) },
        ];
        try {
            const res = await get(SITE + '/album/order-hot');
            const albums = parseAlbums(res.data).slice(0, 30);
            if (albums.length) groups.push({ title: '热门专辑', data: albums });
        } catch (e) { /* 专辑入口失败不影响分类与榜单 */ }
        return groups;
    },

    async getTopListDetail(topListItem, page) {
        const kind = topListItem.kind || 'genre';
        let url;
        if (kind === 'genre') url = SITE + '/genre/' + topListItem.slug + pageSuffix(page);
        else if (kind === 'rank') url = SITE + '/ranks/' + topListItem.slug + pageSuffix(page);
        else if (kind === 'album') url = SITE + '/album/' + topListItem.albumId;
        else throw new Error('未知分类');
        const res = await get(url, SITE + '/');
        const musicList = parseTracks(res.data);
        // 仅 /genre/{slug}/page/N 真翻页；/ranks/*、/album/* 带 page 仍返回同一份内容，
        // 若继续声明可翻页，宿主会反复拿到重复列表
        const paged = kind === 'genre';
        return { isEnd: !paged || musicList.length < 20, musicList: musicList };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id || '').replace(/[^0-9]/g, '');
        if (!id) throw new Error('无效的 172Mix 曲目 id');
        const res = await get(SITE + '/play/' + id);
        const url = parsePlayPage(res.data);
        if (!url) throw new Error('取链失败：播放页未找到音频直链（可能需登录或已下架）');
        const m = await measureAudio(url);
        // 只按实测码率标档：>=120kbps 才敢标 128k，其余按站点实际能力标 64k
        const kbps = m.seconds > 0 ? m.total * 8 / m.seconds / 1000 : 0;
        const quality = kbps >= 110 ? '128k' : '64k';
        const out = {
            url: url,
            headers: { Referer: SITE + '/', 'User-Agent': UA },
            quality: quality,
            actualQuality: quality,
        };
        if (m.total > 0) out.size = m.total;
        return out;
    },

    async getLyric() { return { rawLrc: '' }; },
};
