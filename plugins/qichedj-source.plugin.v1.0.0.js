// 汽车DJ (qichedj.com / 大河DJ) MusicFree 插件 v1.1.0
// 全站 HTTP，接口需先访问首页拿 _d_id cookie，否则 403
// 搜索:   GET /search.php?keyword={kw}&page={p}            → .search-result-item，标题 .result-title a
// 分类:   GET /music.php?action=list&cat_id={cid}&page={p} → .song-row[data-id]，标题 a
//         cat_id: 0全部 1串烧 3中文 4外文 5酒吧 6抖音 7交谊
// 详情/取链: GET /include/music_lyrics.php?action=get&music_id={id}
//         → data.music_url 为 hscdn.dianyinduoduo.com 的 aac 直链；data.lrc/srt/txt.exists 标歌词
// 歌词内容: GET /include/music_lyrics.php?action=getContent&music_id={id}&type={lrc|srt|txt}
// 备用取链: GET /music.php?action=playlink&id={id} → data.play_url（签名，302跳CDN）
// 封面: 站点无真实专辑封面，使用播放器默认图

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'http://www.qichedj.com';
const PLATFORM = '汽车DJ';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;
const DEFAULT_COVER = ORIGIN + '/js/player/jplayer/daheplayer.jpg';
const PAGE_SIZE = 30;

let cookieJar = '';

async function ensureCookie() {
    if (cookieJar) return;
    const res = await axios.get(ORIGIN + '/', {
        headers: { 'User-Agent': UA }, timeout: TIMEOUT, maxRedirects: 0,
        validateStatus: s => s < 400,
    });
    collectCookie(res);
}

function collectCookie(res) {
    if (res.headers['set-cookie']) {
        cookieJar = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    }
}

async function get(url) {
    await ensureCookie();
    const res = await axios.get(url, {
        headers: { 'User-Agent': UA, Cookie: cookieJar },
        timeout: TIMEOUT, maxRedirects: 0, validateStatus: s => s < 400,
    });
    collectCookie(res);
    return res;
}

// 去掉 HTML 标签与多余空白
function clean(t) {
    return (t || '').replace(/<[^>]+>/g, '').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
}

// 详情聚合：music_url 直链 + 歌词标志
async function getDetail(id) {
    const res = await get(ORIGIN + '/include/music_lyrics.php?action=get&music_id=' + id);
    const j = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return j && j.data;
}

const CATS = [
    { id: 0, title: '全部舞曲' },
    { id: 1, title: '串烧舞曲' },
    { id: 3, title: '中文舞曲' },
    { id: 4, title: '外文舞曲' },
    { id: 5, title: '酒吧风格' },
    { id: 6, title: '抖音热歌' },
    { id: 7, title: '交谊舞曲' },
];

module.exports = {
    platform: PLATFORM,
    version: '1.1.0',
    author: 'hebijunge',
    description: '汽车DJ（大河DJ）：搜索、7个分类（含全站）、aac直链取链、LRC/SRT/TXT歌词（站点无真实封面，用默认图）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/qichedj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],
    cacheControl: 'no-store',

    async search(query, page, type) {
        if (type && type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await get(ORIGIN + '/search.php?keyword=' + encodeURIComponent(query) + '&page=' + p);
        const $ = cheerio.load(res.data);
        const seen = new Set();
        const data = [];
        $('.search-result-item').each((i, box) => {
            const $a = $(box).find('.result-title a').first();
            const hm = ($a.attr('href') || '').match(/id=(\d+)/);
            if (!hm || seen.has(hm[1])) return;
            seen.add(hm[1]);
            data.push({
                id: hm[1], title: clean($a.html()), artist: PLATFORM, artwork: DEFAULT_COVER,
            });
        });
        return { isEnd: data.length < PAGE_SIZE, data };
    },

    async getMediaSource(musicItem) {
        // 优先详情聚合接口的 CDN 直链
        try {
            const d = await getDetail(musicItem.id);
            if (d && d.music_url) return { url: d.music_url };
        } catch (e) { /* 回退 */ }
        // 备用：playlink 签名地址
        const res = await get(ORIGIN + '/music.php?action=playlink&id=' + musicItem.id);
        const j = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        let u = j && j.data && j.data.play_url;
        if (!u) throw new Error('汽车DJ取链失败');
        if (u.startsWith('/')) u = ORIGIN + u;
        return { url: u, headers: { Cookie: cookieJar, Referer: ORIGIN + '/' } };
    },

    async getLyric(musicItem) {
        const d = await getDetail(musicItem.id);
        if (!d) throw new Error('汽车DJ暂无歌词');
        let type = '';
        if (d.lrc && d.lrc.exists) type = 'lrc';
        else if (d.srt && d.srt.exists) type = 'srt';
        else if (d.txt && d.txt.exists) type = 'txt';
        if (!type) throw new Error('汽车DJ暂无歌词');
        const res = await get(ORIGIN + '/include/music_lyrics.php?action=getContent&music_id=' + musicItem.id + '&type=' + type);
        const j = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        const content = j && j.data && j.data.content;
        if (!content) throw new Error('汽车DJ暂无歌词');
        if (type === 'lrc') return { rawLrc: content };
        // srt/txt 无时间轴，作为纯文本
        return { rawLrc: content.replace(/\r/g, '') };
    },

    async getTopLists() {
        return [{
            title: '分类舞曲',
            data: CATS.map(c => ({ id: 'cat_' + c.id, title: c.title, cover: DEFAULT_COVER })),
        }];
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        const id = String(topListItem.id);
        if (id.indexOf('cat_') !== 0) throw new Error('汽车DJ未知榜单');
        const cid = id.slice(4);
        const res = await get(ORIGIN + '/music.php?action=list&cat_id=' + cid + '&order=new&page=' + p);
        const $ = cheerio.load(res.data);
        const data = [];
        $('.song-row[data-id]').each((i, row) => {
            const rid = $(row).attr('data-id');
            const $a = $(row).find('a[href]').first();
            const title = clean($a.html());
            if (rid && title) data.push({ id: rid, title, artist: PLATFORM, artwork: DEFAULT_COVER });
        });
        return { isEnd: data.length < PAGE_SIZE, musicList: data };
    },
};
