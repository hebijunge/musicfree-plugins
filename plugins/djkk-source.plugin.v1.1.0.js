// DJKK (pc.djkk.cn) MusicFree 插件 —— 与皮狗DJ同属 CSCms 系统、共用 pgdjz.fun CDN
// 搜索: GET /dance/search.html?key={kw}&page={p}  → ul.infolist（a.name 的 title 为干净歌名）
// 取链: POST /ajax/danceplayer → {code:1, playurl}（试听 64K m4a；320K 高品需站内登录，免登录拿不到，不伪造）
// 首页5榜: 推荐/最新/热门/收藏/下载（首页第一个 .layui-tab 的5个 .layui-tab-item）
// 分类: /dance/lists/{cid}.html，翻页 /dance/lists/{cid}/{p}.html（榜单式 li）
// 封面: 详情页 .musicpic .img img；歌词: 详情页 .correlationbox .txtbox 纯文本

const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://pc.djkk.cn';
const PLATFORM = 'DJKK';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;
const SEARCH_SIZE = 34;

const HEADERS = { 'User-Agent': UA };

// 首页5榜（顺序即首页第一个 .layui-tab 内 .layui-tab-item 顺序）
const HOME_RANKS = ['推荐歌曲', '最新歌曲', '热门歌曲', '热门收藏', '下载排行'];

// 主要分类（来自 /map.html → /dance/lists/{id}.html）
const CATEGORIES = [
    { id: 1, title: '无损舞曲' },
    { id: 2, title: '国外舞曲' },
    { id: 4, title: '国内舞曲' },
    { id: 6, title: '国外串烧' },
    { id: 13, title: '国外单曲' },
    { id: 16, title: '无损中文舞曲' },
    { id: 17, title: '无损英文舞曲' },
    { id: 18, title: '无损中文歌曲' },
    { id: 19, title: '无损英文歌曲' },
    { id: 22, title: '中文单曲' },
    { id: 29, title: '粤语嗨曲' },
    { id: 33, title: '无损串烧' },
    { id: 63, title: '中文串烧' },
    { id: 85, title: '车载音乐' },
    { id: 116, title: '车载3D音乐' },
    { id: 136, title: '8倍音乐' },
    { id: 137, title: '中文8倍音乐' },
    { id: 176, title: '早场Mix' },
    { id: 177, title: '中场Mix' },
    { id: 178, title: '后场Mix' },
    { id: 179, title: '主场Mix' },
    { id: 180, title: '开场Mix' },
];

// 统一解析：容器内每个 li，找首个指向 /dance/{id}.html 的 <a>
function parseDanceItems($, container) {
    const out = [];
    $(container).find('li').each((i, li) => {
        const $li = $(li);
        let id = '';
        let $a = null;
        $li.find('a').each((j, a) => {
            const hm = ($(a).attr('href') || '').match(/\/dance\/(\d+)\.html/);
            if (hm && !$a) { $a = $(a); id = hm[1]; }
        });
        if (!$a) return;
        let title = ($a.attr('title') || '').trim();
        if (!title) title = ($li.find('.name').first().text() || $a.text()).trim();
                title = title.replace(/^\[(MP3|MP4|WAV|FLAC)\]/i, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (!id || !title) return;
        const item = { id, title, artist: PLATFORM };
        const fmt = ($li.find('.format,.ext').first().text() || '').trim();
        if (fmt) item._fmt = fmt;
        out.push(item);
    });
    return out;
}

// .txtbox → 纯文本（<br> 转换行）
function extractTxt($, box) {
    const $b = $(box).clone();
    $b.find('br').replaceWith('\n');
    let t = $b.text();
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return t;
}

module.exports = {
    name: PLATFORM,
    platform: PLATFORM,
    version: '1.1.0',
    author: 'hebijunge',
    description: 'DJKK站（与皮狗DJ同源）：搜索、首页5榜（推荐/最新/热门/收藏/下载）、22个分类、封面与纯文本歌词；试听为64K m4a，320K高品需站内登录（免登录无法获取，不伪造）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djkk-source.plugin.v1.1.0.js',
    supportedSearchType: ['music'],
    cacheControl: 'no-store',

    async search(query, page, type) {
        if (type && type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await axios.get(BASE + '/dance/search.html', {
            params: { key: query, page: p },
            headers: HEADERS,
            timeout: TIMEOUT,
        });
        const $ = cheerio.load(res.data);
        const data = parseDanceItems($, 'ul.infolist');
        let size = SEARCH_SIZE;
        const ds = $('#pages').attr('data-size');
        if (ds) size = Number(ds) || size;
        return { isEnd: data.length < size, data };
    },

    async getMediaSource(musicItem) {
        const res = await axios.post(
            BASE + '/ajax/danceplayer',
            'id=' + musicItem.id + '&ids=&historyid=',
            {
                headers: {
                    'User-Agent': UA,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Referer: BASE + '/dance/' + musicItem.id + '.html',
                },
                timeout: TIMEOUT,
            }
        );
        const d = res.data;
        if (!d || d.code !== 1 || !d.playurl) throw new Error('DJKK取链失败');
        return { url: d.playurl, headers: { Referer: BASE + '/' } };
    },

    async getMusicInfo(musicItem) {
        const res = await axios.get(BASE + '/dance/' + musicItem.id + '.html', {
            headers: HEADERS,
            timeout: TIMEOUT,
        });
        const $ = cheerio.load(res.data);
        const info = {};
        const cover = $('.musicpic .img img').attr('src');
        if (cover) info.artwork = cover;
        return info;
    },

    async getLyric(musicItem) {
        const res = await axios.get(BASE + '/dance/' + musicItem.id + '.html', {
            headers: HEADERS,
            timeout: TIMEOUT,
        });
        const $ = cheerio.load(res.data);
        const box = $('.correlationbox .txtbox').first();
        if (!box.length) throw new Error('DJKK暂无歌词');
                const raw = extractTxt($, box);
        if (!raw || /精选推荐|所属分类|下载次数|收藏次数|播放次数|点击次数/.test(raw)) {
            throw new Error('DJKK暂无歌词');
        }
        return { rawLrc: raw };
    },

    async getTopLists() {
        return [
            {
                title: '首页榜单',
                data: HOME_RANKS.map((t, i) => ({ id: 'home_' + i, title: t })),
            },
            {
                title: '分类曲库',
                data: CATEGORIES.map(c => ({ id: 'cat_' + c.id, title: c.title })),
            },
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        const id = String(topListItem.id);

        if (id.indexOf('home_') === 0) {
            const idx = Number(id.slice(5));
            const res = await axios.get(BASE + '/', { headers: HEADERS, timeout: TIMEOUT });
            const $ = cheerio.load(res.data);
            // 首页第一个 .layui-tab 为歌曲5榜（视频榜在其后）
            const $tab = $('.layui-tab').first();
            const ul = $tab.find('.layui-tab-item').eq(idx).find('ul');
            const data = parseDanceItems($, ul);
            return { isEnd: true, musicList: data };
        }

        if (id.indexOf('cat_') === 0) {
            const cid = id.slice(4);
            const u = p === 1
                ? BASE + '/dance/lists/' + cid + '.html'
                : BASE + '/dance/lists/' + cid + '/' + p + '.html';
            const res = await axios.get(u, { headers: HEADERS, timeout: TIMEOUT });
            const $ = cheerio.load(res.data);
            const data = parseDanceItems($, '.musicboxlist');
            let size = 30;
            const ds = $('#pages').attr('data-size');
            if (ds) size = Number(ds) || size;
            return { isEnd: data.length < size, musicList: data };
        }

        throw new Error('DJKK未知榜单');
    },
};
