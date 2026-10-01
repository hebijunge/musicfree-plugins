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

module.exports = {
    cacheControl: 'no-store',
    name: '36DJ',
    platform: '36DJ',
    version: '1.2.0',
    author: 'hebijunge',
    description: '36DJ舞曲网 - 分类/榜单/搜索/高品直链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/36dj-source.plugin.v1.2.0.js',
    supportedSearchType: ['music'],

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
        return { url, headers: { Referer: SITE + '/', 'User-Agent': UA } };
    },

    async getLyric() { return { rawLrc: '' }; }
};
