// SpaceDJ音乐网 (spacedj.cn) MusicFree 插件 v1.1.0
// 电子音乐平台，列表页直出 mp3 直链（downloads.spacedj.cn）
// 反爬: 内页首次请求返回 403 + JS 跳转挑战并 Set-Cookie，需带更新后 cookie 重试
// 搜索: GET /search?keywords={kw}&type=single&page={p}
// 单曲: GET /music/single?page={p}[&style_name={style}]
//       Add_Single_TPList('title','cover','artist','bpm','key','url','id','token')  8字段
// 套曲: GET /music/cycle?page={p}[&style_name={style}]
//       Add_Divert_TPList('title','cover','artist','url','id','token')             6字段

const axios = require('axios');

const ORIGIN = 'https://www.spacedj.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;

const SINGLE_STYLES = [
    'Tech House/反拍House', 'HipHop / Funky / 霓虹', 'Hardstyle/Hard Bounce/Hard Dance',
    'Korea Bounce/宇宙Bounce', '国潮Mix/中文Boolteg', '私货/Mush Up/Remix/Bootleg',
    '抖音TikTolk热播/Tik Tok Hot Songs', 'Afro House', '中文 Lak House',
    'Bass House/Future House', '节日主题/限时推荐', '中文 Electro House',
    '中文 Prog House', 'Techno', '中文 Funky House', '气氛爆点/互动颗粒',
    '中文 Melbourne Bounce', 'Melodic Techno/Melodic House', 'Trance/PSY Trance',
    'Bigroom House/Electro/EDM', 'Vina House/Lak House/越南鼓', '其他',
];
const CYCLE_STYLES = ['早场', '中场', '主场', '后场'];

// 带 cookie 挑战的 GET：首页预热 + 最多 3 次重试
async function challengeGet(url) {
    const jar = new Map();
    function absorb(setCookie) {
        (setCookie || []).forEach(c => {
            const pair = c.split(';')[0];
            const eq = pair.indexOf('=');
            if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
        });
    }
    function cookieHeader() {
        return [...jar].map(([k, v]) => k + '=' + v).join('; ');
    }
    try {
        const h = await axios.get(ORIGIN + '/', {
            headers: { 'User-Agent': UA }, timeout: TIMEOUT, validateStatus: () => true,
        });
        absorb(h.headers['set-cookie']);
    } catch (e) { /* ignore */ }

    let last = null;
    for (let i = 0; i < 3; i++) {
        last = await axios.get(url, {
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': ORIGIN + '/',
                'Cookie': cookieHeader(),
            },
            timeout: TIMEOUT,
            validateStatus: () => true,
        });
        absorb(last.headers['set-cookie']);
        const body = typeof last.data === 'string' ? last.data : '';
        if (last.status === 200 && body.indexOf('window.location.href') === -1) return last;
    }
    if (last && last.status === 200) return last;
    throw new Error('请求失败（' + (last && last.status) + '）');
}

function absUrl(u) {
    if (!u) return '';
    if (u.startsWith('http')) return u;
    if (u.startsWith('//')) return 'https:' + u;
    return ORIGIN + (u.startsWith('/') ? u : '/' + u);
}

function hasPage(html, p) {
    return new RegExp('[?&]page=' + p + '\\b').test(html);
}

// 单曲：Add_Single_TPList 8字段（标题含右括号，须用完整结构）
function parseSingles(html) {
    const re = /Add_Single_TPList\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g;
    const data = [];
    const seen = new Set();
    let m;
    while ((m = re.exec(html)) !== null) {
        const title = m[1].replace(/\s+/g, ' ').trim();
        const id = m[7];
        if (!id || !title || seen.has(id)) continue;
        seen.add(id);
        data.push({
            id: String(id), title,
            artist: m[3].replace(/\s+/g, ' ').trim(),
            artwork: absUrl(m[2]),
            _url: m[6], bpm: m[4],
        });
    }
    return data;
}

// 套曲：Add_Divert_TPList 6字段
function parseDiverts(html) {
    const re = /Add_Divert_TPList\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g;
    const data = [];
    const seen = new Set();
    let m;
    while ((m = re.exec(html)) !== null) {
        const title = m[1].replace(/\s+/g, ' ').trim();
        const id = m[5];
        if (!id || !title || seen.has(id)) continue;
        seen.add(id);
        data.push({
            id: String(id), title,
            artist: m[3].replace(/\s+/g, ' ').trim(),
            artwork: absUrl(m[2]),
            _url: m[4],
        });
    }
    return data;
}

module.exports = {
    cacheControl: 'no-store',
    name: 'SpaceDJ',
    platform: 'SpaceDJ',
    version: '1.1.0',
    author: 'hebijunge',
    description: 'SpaceDJ电子音乐平台 Korea Bounce/Tech House/套曲，支持搜索、风格分类、封面、MP3直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/spacedj-source.plugin.v1.1.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await challengeGet(ORIGIN + '/search?keywords=' + encodeURIComponent(query) + '&type=single&page=' + p);
        const html = typeof res.data === 'string' ? res.data : '';
        const data = parseSingles(html);
        return { isEnd: !hasPage(html, p + 1), data };
    },

    async getMediaSource(musicItem) {
        if (!musicItem._url) throw new Error('无试听链接');
        return { url: musicItem._url, headers: { Referer: ORIGIN + '/' } };
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        return [
            {
                title: '单曲风格',
                data: [
                    { id: 'single_all', title: '全部单曲', kind: 'list', listType: 'single' },
                ].concat(SINGLE_STYLES.map(s => ({
                    id: 'single_' + s, title: s, kind: 'list', listType: 'single', style: s,
                }))),
            },
            {
                title: '套曲风格',
                data: [
                    { id: 'cycle_all', title: '全部套曲', kind: 'list', listType: 'cycle' },
                ].concat(CYCLE_STYLES.map(s => ({
                    id: 'cycle_' + s, title: s, kind: 'list', listType: 'cycle', style: s,
                }))),
            },
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        let url = ORIGIN + '/music/' + topListItem.listType + '?page=' + p;
        if (topListItem.style) url += '&style_name=' + encodeURIComponent(topListItem.style);
        const res = await challengeGet(url);
        const html = typeof res.data === 'string' ? res.data : '';
        const isCycle = topListItem.listType === 'cycle';
        const data = isCycle ? parseDiverts(html) : parseSingles(html);
        return { isEnd: !hasPage(html, p + 1), musicList: data };
    },
};
