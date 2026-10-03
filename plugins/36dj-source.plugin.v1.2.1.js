// 36DJ - MusicFree Plugin v1.2.0
// 搜索: POST /e/search/index.php  {classid:1, keyboard, show:'title'}（v1.1.0 用 GET
//   /e/search/?searchget=1 只拿到空壳页，结果恒 0 条）
// 分类: /xc/ /myxc/ /zw/ /my/ /yw/
// 榜单: /top/
// 取链: /play/{id}.html → var info={playurl:"..."} → https://tn1.72djapp.cn/{playurl}（m4a）
// 注: 本机 CDN tn1.72djapp.cn(122.226.167.219) 直连被网络环境掐（连不上），
//   取链可达性需真机回归确认；搜索/列表走 www.36dj.com 正常。

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.36dj.com';
const CDN = 'https://tn1.72djapp.cn/';
const UA = 'Mozilla/5.0';

const CATEGORIES = [
    { path: '/xc/', name: '串烧舞曲' },
    { path: '/myxc/', name: '慢摇串烧' },
    { path: '/zw/', name: '中文舞曲' },
    { path: '/my/', name: '慢摇舞曲' },
    { path: '/yw/', name: '英文舞曲' },
    { path: '/html/new/', name: '最新舞曲' },
    { path: '/html/good/', name: '推荐舞曲' },
    { path: '/top/', name: 'DJ舞曲榜' }
];

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('li input[name="check"]').each((i, el) => {
        const id = $(el).attr('value');
        const $a = $(el).parent().closest('li,tr').find('a[href*="/play/"]').first();
        const title = $a.text().trim();
        if (!id || !title || title.length < 2) return;
        data.push({ id, title, artist: '36DJ' });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}


// Range 探测真实体积（HEAD 在部分 CDN 不返 content-length）；失败返 0 由调用方兜底。
// 用 arraybuffer+Range：宿主 axios 在 RN 侧走 XMLHttpRequest，没有 stream 适配器。
async function probeTotalBytes(url, headers) {
    try {
        const r = await axios.get(url, {
            headers: Object.assign({ 'User-Agent': UA, Range: 'bytes=0-1023' }, headers || {}),
            timeout: (typeof TIMEOUT !== 'undefined' ? TIMEOUT : 10000),
            responseType: 'arraybuffer',
            maxRedirects: 3,
            validateStatus: function (s) { return s === 200 || s === 206; },
        });
        const cr = String((r.headers && r.headers['content-range']) || '');
        const total = Number((cr.split('/')[1] || '').trim()) || Number(r.headers['content-length'] || 0);
        return total > 1 ? total : 0;
    } catch (e) {
        return 0;
    }
}


module.exports = {
    cacheControl: 'no-store',
    name: '36DJ',
    platform: '36DJ',
    version: '1.2.1',
    author: 'hebijunge',
    description: '36DJ舞曲网 - 分类/榜单/搜索/高品直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/36dj-source.plugin.v1.2.1.js',
    supportedSearchType: ['music'],
    // 实测 2026-10-03 tn1.72djapp.cn m4a：mdhd 4,316s、34,921,039B → 64.7kbps（下载页「192~320kbps」是付费下载档，免登录只有这一档）
    supportedQualities: ['64k'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        // v1.2.0: 搜索结果是 POST /e/search/index.php 返回的（GET 只回空壳）
        const res = await axios.post(SITE + '/e/search/index.php', new URLSearchParams({
            classid: 1, keyboard: query, show: 'title',
        }).toString(), {
            headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: SITE + '/e/search/' },
            timeout: 15000,
        });
        const data = parseList(res.data);
        return { isEnd: true, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: CATEGORIES.map((c, i) => ({ id: 'cat_' + i, title: c.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const idx = parseInt(topListItem.id.replace('cat_', ''));
        const cat = CATEGORIES[idx];
        if (!cat) throw new Error('未知分类');
        const url = SITE + cat.path + (page > 1 ? (page + '.html') : '');
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', {
            headers: { 'User-Agent': UA, Referer: SITE + '/' }
        });
        const body = String(res.data);
        // v1.2.0: 播放页给的是 var info = { "playurl": "相对路径.m4a" } —— playurl 是带引号的键，
        // 旧 regex /playurl\s*:/ 匹配不到引号键，取链恒失败
        const m = body.match(/["']?playurl["']?\s*:\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        const rel = String(m[1]).replace(/^\//, '');
        const url = /^https?:/i.test(rel) ? rel : CDN + rel;
        const headers = { Referer: SITE + '/', 'User-Agent': UA };
        const size = await probeTotalBytes(url, headers);
        // 宿主只在 result.quality 存在时覆盖档位标签，否则沿用用户请求档渲染 → 必须显式回写
        const result = { url, quality: '64k', actualQuality: '64k', headers };
        if (size) result.size = size;
        return result;
    },

    async getLyric() { return { rawLrc: '' }; }
};
