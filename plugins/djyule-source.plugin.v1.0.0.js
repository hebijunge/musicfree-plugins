// DJ娱乐 (djyule.com) - MusicFree Plugin v1.0.0
// 搜索: https://so.djyule.com/Default.asp?DJkey=xxx&page=N
// 播放: https://sj.djyule.com/player.asp?id=xxx → <source src> 直链
// 榜单: https://sj.djyule.com/phb/
// 免登录, MP3直链

const axios = require('axios');
const cheerio = require('cheerio');

const SJ = 'https://sj.djyule.com';
const SO = 'https://so.djyule.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

function cleanTitle(text) {
    // 去掉排名、时长、温度、日期
    return text
        .replace(/^\d+\./, '')           // 排名
        .replace(/\s*\d+:\d+(?::\d+)?\s*$/, '')  // 时长
        .replace(/\s*\d+℃\s*/g, '')     // 温度
        .replace(/\s*\d{4}-\d+-\d+\s*$/, '') // 日期
        .replace(/^查看\s*/, '')
        .trim();
}

function parseSearch(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = new Set();
    $('tr').each((i, el) => {
        const $tr = $(el);
        const href = $tr.find('a[href*="music_ID="]').attr('href') || '';
        const m = href.match(/music_ID=(\d+)/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;
        seen.add(id);
        const text = $tr.text().replace(/\s+/g, ' ').trim();
        const title = cleanTitle(text);
        if (title.length < 2) return;
        data.push({ id: id, title: title, artist: 'DJ娱乐' });
    });
    return data;
}

function parseRank(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = new Set();
    $('a[href*="player.asp"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/id=(\d+)/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;
        seen.add(id);
        const title = $(el).attr('title') || $(el).text().trim();
        if (title.length < 2) return;
        data.push({ id: id, title: title, artist: 'DJ娱乐' });
    });
    return data;
}

module.exports = {
    cacheControl: 'no-cache',
    name: 'DJ娱乐',
    platform: 'DJ娱乐',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'DJ娱乐网 - MP3直链/搜索/排行榜/车载串烧',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djyule-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = page || 1;
        const res = await axios.get(SO + '/Default.asp', {
            params: { DJkey: query, px: 'new', page: p },
            headers: { 'User-Agent': UA }
        });
        const data = parseSearch(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '排行榜', data: [
                { id: 'phb', title: 'DJ娱乐榜' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const res = await axios.get(SJ + '/phb/', { headers: { 'User-Agent': UA } });
        const data = parseRank(res.data);
        return { isEnd: true, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SJ + '/player.asp?id=' + musicItem.id, {
            headers: { 'User-Agent': UA }
        });
        const m = res.data.match(/<source[^>]+src="([^"]+\.mp3[^"]*)"/i);
        if (!m) throw new Error('未找到播放地址');
        return { url: m[1] };
    },

    async getLyric(musicItem) {
        throw new Error('该音源暂无歌词');
    }
};
