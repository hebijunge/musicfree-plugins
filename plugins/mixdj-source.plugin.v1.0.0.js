// MixDJ (mixdj.cn) - MusicFree Plugin v1.0.0
// SSR HTML 站点, 播放直链直接在列表项 url 属性中
// 搜索: /music/single.html?keyword=xxx&now_page=N
// 榜单: /music/single/sorting/3.html
// 试听: 48k MP3 直链, 免登录无Referer锁

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.mixdj.cn';
const UA = 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = new Set();
    $('.item').each((i, el) => {
        const $icon = $(el).find('.bfl .icon');
        const uid = $icon.attr('uid');
        if (!uid || seen.has(uid)) return;
        seen.add(uid);

        const name = $icon.attr('data-name') || $(el).find('.song-name').text().trim();
        const playUrl = $icon.attr('url');
        const cover = $(el).find('.song-img img').attr('src');

        // 歌手按第一个 " - " 切分
        let artist = 'MixDJ', title = name;
        const dashIdx = name.indexOf(' - ');
        if (dashIdx > 0) {
            artist = name.substring(0, dashIdx);
            title = name.substring(dashIdx + 3);
        }

        data.push({
            id: uid,
            title: title,
            artist: artist,
            artwork: cover ? (cover.startsWith('http') ? cover : SITE + cover) : undefined,
            _playUrl: playUrl ? (playUrl.startsWith('http') ? playUrl : SITE + playUrl) : undefined
        });
    });
    return data;
}

module.exports = {
    cacheControl: 'no-cache',
    name: 'MixDJ',
    platform: 'MixDJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '全球DJ舞曲同步网 - 48k试听/搜索/榜单/风格分类',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/mixdj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/music/single.html', {
            params: { keyword: query, now_page: page || 1, page_size: 20 },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '榜单', data: [
                { id: 'sort_3', title: '单曲下载榜' },
                { id: 'sort_1', title: '最新单曲' }
            ]},
            { title: '风格', data: [
                { id: 'style_671', title: 'Big Room' },
                { id: 'style_673', title: 'Future House' },
                { id: 'style_677', title: 'Hard Dance' },
                { id: 'style_1198', title: 'Techno' },
                { id: 'style_7', title: 'Electro House' },
                { id: 'style_1187', title: '中文Remix' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = page || 1;
        let url;
        if (topListItem.id.startsWith('sort_')) {
            url = SITE + '/music/single/sorting/' + topListItem.id.split('_')[1] + '.html?now_page=' + p;
        } else {
            url = SITE + '/music/style/id/' + topListItem.id.split('_')[1] + '.html?now_page=' + p;
        }
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        if (musicItem._playUrl) return { url: musicItem._playUrl };
        // 兜底: 请求详情页拿播放地址
        const res = await axios.get(SITE + '/music/info/id/' + musicItem.id + '.html', {
            headers: { 'User-Agent': UA }
        });
        const m = res.data.match(/url="(\/MusicData\/play\/[^"]+\.mp3)"/);
        if (!m) throw new Error('未找到播放地址');
        return { url: SITE + m[1] };
    },

    async getLyric(musicItem) {
        throw new Error('该音源暂无歌词');
    }
};
