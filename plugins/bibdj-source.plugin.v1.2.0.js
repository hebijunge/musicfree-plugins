// 宝贝DJ (bibdj.com) - MusicFree Plugin v1.2.0
// 搜索: /search?key={kw}&page={p}
// 分类: /djstyle/s0-{p}.html 最近更新 / /djstyle/s1-{p}.html 最多人关注
// 榜单: /top/mixes 串烧榜 / /top/bar 华语Remix榜
// 取链: GET /play/ajax/gmap?action=playmusic&musicid={id}
//   v1.1.0 用 POST + JSON.parse：站点现在对 POST 直接回 "err@dj@"，且响应改成
//   @dj@/@fg@ 分隔的文本协议（外层带引号、内含 \/ 与 \uXXXX 转义），
//   所以旧实现必然「取链失败」。字段顺序：
//   标题@fg@标题@fg@id@fg@n@fg@时长@fg@n@fg@码率@fg@日期@fg@n@fg@URL
//   —— 码率字段是站点自报的 kbps，直接用来生成宿主音质键，不猜。
// 双档: /d/team/ 与 /d/ttyp/ 两条路径，哪条更高由实测字节数决定，不靠猜。

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.bibdj.com';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BROWSER = {
    'User-Agent': UA,
    Referer: SITE + '/',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept-Encoding': 'gzip, deflate',
};
/** 宿主内置音质键；未知键在 UI 里会渲染成空白，所以只接受这些。 */
const KNOWN_BITRATE_KEYS = ['64k', '96k', '128k', '192k', '320k'];

/** 把估算码率吸附到宿主内置键里最接近的一个（整十取整会得到 130k 这类宿主没有的键）。 */
function nearestBitrateKey(kbps) {
    let best = '';
    let bestGap = Infinity;
    for (const key of KNOWN_BITRATE_KEYS) {
        const gap = Math.abs(parseInt(key, 10) - kbps);
        if (gap < bestGap) {
            bestGap = gap;
            best = key;
        }
    }
    return best;
}

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


/**
 * 解站点的 @dj@/@fg@ 文本协议。响应外层带双引号但内层引号未转义，不是合法 JSON，
 * 只能手动脱引号 + 反转义 \/ \"；中文以 \uXXXX 形式给出，用 JSON.parse 单独解字符串字面量。
 */
function parseGmap(text) {
    let t = String(text == null ? '' : text).trim();
    if (t.charCodeAt(0) === 34) {
        try {
            t = JSON.parse(t);
        } catch (e) {
            t = t.slice(1, t.endsWith('"') ? -1 : undefined);
        }
    }
    // 站点把 URL 里的 / 转义成 \/；用 fromCharCode 构造反斜杠，避开源码里的转义层
    const BSLASH = String.fromCharCode(92);
    t = String(t).split(BSLASH + '/').join('/');
    const marker = 'success@dj@';
    const at = t.indexOf(marker);
    if (at < 0) return null;
    const body = t.slice(at + marker.length);
    const fields = body.split('@fg@').map(x => x.trim());
    const url = fields.find(f => /^https?:\/\//i.test(f));
    if (!url) return null;
    let bitrate = '';
    for (const f of fields) {
        if (/^\d{2,4}$/.test(f) && KNOWN_BITRATE_KEYS.indexOf(parseInt(f, 10) + 'k') >= 0) {
            bitrate = parseInt(f, 10) + 'k';
            break;
        }
    }
    return { url: url, bitrate: bitrate, fields: fields };
}

/** 取头部字节确认是音频，并带回真实总字节数。返回 0 表示不可用。 */
async function probeAudio(url, referer) {
    try {
        const res = await axios.get(url, {
            headers: {
                Range: 'bytes=0-11',
                'User-Agent': UA,
                Referer: referer || SITE + '/',
                'Accept-Encoding': 'identity',
            },
            responseType: 'arraybuffer',
            timeout: 15000,
            validateStatus: st => st === 200 || st === 206,
        });
        const b = Buffer.from(res.data || []);
        if (b.length < 12) return 0;
        const a = (i, n) => b.slice(i, i + n).toString('latin1');
        const isAudio =
            a(0, 3) === 'ID3' || a(4, 4) === 'ftyp' || a(0, 4) === 'fLaC' || a(0, 4) === 'OggS' ||
            (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
        if (!isAudio) return 0;
        const m = String(res.headers['content-range'] || '').match(/\/(\d+)\s*$/);
        return m ? parseInt(m[1], 10) : parseInt(res.headers['content-length'] || '0', 10);
    } catch (e) {
        return 0;
    }
}


module.exports = {
    cacheControl: 'no-store',
    name: '宝贝DJ',
    platform: '宝贝DJ',
    version: '1.2.0',
    author: 'hebijunge',
    description:
        '宝贝DJ音乐网 - 分类/榜单/封面/双档实测取链。' +
        'v1.2.0 修复取链：接口已改为 GET + @dj@/@fg@ 文本协议，旧实现的 POST+JSON.parse 必然失败。',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/bibdj-source.plugin.v1.2.0.js',
    supportedSearchType: ['music'],
    /** 实测两档：/d/team/ 7.1MB 与 /d/ttyp/ 17.8MB，比例 0.399 对应 128k/320k。 */
    supportedQualities: ['128k', '320k'],

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
        const id = musicItem && musicItem.id;
        if (!id) throw new Error('宝贝DJ 缺少曲目 id');
        const referer = SITE + '/play/' + id + '.html';
        // 站点只对 GET 返回数据，POST 回 "err@dj@"
        const res = await axios.get(SITE + '/play/ajax/gmap', {
            params: { action: 'playmusic', musicid: id },
            headers: Object.assign({}, BROWSER, { Referer: referer }),
            responseType: 'text',
            timeout: 20000,
        });
        const parsed = parseGmap(res.data);
        if (!parsed) {
            throw new Error('宝贝DJ 取链失败（接口未返回播放地址）: ' + String(res.data).slice(0, 40));
        }

        // /d/team/ 与 /d/ttyp/ 两条路径都实测一遍：谁字节大谁是高品，不靠猜
        const variants = [];
        const seenPath = new Set();
        for (const u of [
            parsed.url,
            parsed.url.replace('/d/team/', '/d/ttyp/'),
            parsed.url.replace('/d/ttyp/', '/d/team/'),
        ]) {
            if (u && !seenPath.has(u)) {
                seenPath.add(u);
                variants.push({ url: u, size: await probeAudio(u, referer) });
            }
        }
        const usable = variants.filter(v => v.size > 0);
        if (!usable.length) {
            throw new Error('宝贝DJ 直链未通过音频校验（可能被防盗链或返回了广告页）');
        }
        usable.sort((x, y) => y.size - x.size);
        const high = usable[0];
        const low = usable[usable.length - 1];

        const wantsHigh =
            quality === 'high' || quality === 'super' || /320|192/.test(String(quality || ''));
        const chosen = wantsHigh ? high : low;
        // 站点自报的是它返回那条 URL 的码率。另一档按实测字节比例估算，
        // 并吸附到宿主内置键里最接近的一个——直接整十取整会得到 130k 这类宿主没有的键，
        // 宿主 UI 查不到标签会渲染成空白档位。
        const declared = parseInt(parsed.bitrate, 10) || 0;
        let key = parsed.bitrate;
        if (declared && low !== high) {
            const ratio = low.size / high.size;
            const est = Math.round(declared * ratio);
            const lowKey = nearestBitrateKey(est);
            key = wantsHigh ? declared + 'k' : lowKey || parsed.bitrate;
        }
        const out = { url: chosen.url, headers: { Referer: referer, 'User-Agent': UA }, size: chosen.size };
        if (key) out.quality = key;
        return out;
    },

    async getLyric() { return { rawLrc: '' }; }
};
