// DJ娱乐 (djyule.com) - MusicFree Plugin v1.1.0
// 搜索: https://so.djyule.com/Default.asp?DJkey=xxx&page=N
// 播放: https://sj.djyule.com/player.asp?id=xxx → <source src> 直链
// 榜单: DJ娱乐榜(sj.djyule.com/phb) + 体验精选320k(appxml.djyule.com/tiyan320.xml)
// 歌词: https://www.djyule.com/showLRC.asp?id=xxx
// 免登录, MP3直链

const axios = require('axios');
const cheerio = require('cheerio');

const SJ = 'https://sj.djyule.com';
const SO = 'https://so.djyule.com';
const BASE = 'https://www.djyule.com';
const APPXML = 'https://appxml.djyule.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

function cleanTitle(text) {
    return text
        .replace(/^\d+\.\s*/, '')
        .replace(/\s*\d+:\d+(?::\d+)?\s*$/, '')
        .replace(/\s*\d+℃\s*/g, '')
        .replace(/\s*\d{4}-\d+-\d+\s*$/, '')
        .replace(/^查看\s*/, '')
        .trim();
}

function parseSearch(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = {};
    $('tr').each((i, el) => {
        const href = $(el).find('a[href*="music_ID="]').attr('href') || '';
        const m = href.match(/music_ID=(\d+)/);
        if (!m || seen[m[1]]) return;
        seen[m[1]] = true;
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        const title = cleanTitle(text);
        if (title.length < 2) return;
        data.push({ id: m[1], title: title, artist: 'DJ娱乐' });
    });
    return data;
}

function parseRank(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = {};
    $('a[href*="player.asp"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/id=(\d+)/);
        if (!m || seen[m[1]]) return;
        seen[m[1]] = true;
        const title = ($(el).attr('title') || $(el).text()).trim();
        if (title.length < 2) return;
        data.push({ id: m[1], title: title, artist: 'DJ娱乐' });
    });
    return data;
}

function parseTiyanXml(xml) {
    const $ = cheerio.load(xml, { xmlMode: true });
    const data = [];
    $('PLANT').each((i, el) => {
        const $el = $(el);
        const name = $el.find('NAME').text().trim();
        const url320 = $el.find('PLAYURL320').text().trim();
        const url64 = $el.find('PLAYURL64').text().trim();
        const time = $el.find('TIME').text().trim();
        if (!name) return;
        data.push({
            id: 'ty_' + i,
            title: name,
            artist: '体验精选',
            duration: time,
            _playUrl: url320 || url64
        });
    });
    return data;
}

module.exports = {
    cacheControl: 'no-cache',
    name: 'DJ娱乐',
    platform: 'DJ娱乐',
    version: '1.1.0',
    author: 'hebijunge',
    description: 'DJ娱乐网 - MP3直链/搜索/排行榜/体验精选320k/歌词',
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
                { id: 'phb', title: 'DJ娱乐榜' },
                { id: 'tiyan', title: '体验精选 320k' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        if (topListItem.id === 'tiyan') {
            const res = await axios.get(APPXML + '/tiyan320.xml', { headers: { 'User-Agent': UA } });
            const data = parseTiyanXml(res.data);
            return { isEnd: true, musicList: data, topListItem };
        }
        const res = await axios.get(SJ + '/phb/', { headers: { 'User-Agent': UA } });
        const data = parseRank(res.data);
        return { isEnd: true, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        if (musicItem._playUrl) return { url: musicItem._playUrl };
        const res = await axios.get(SJ + '/player.asp?id=' + musicItem.id, {
            headers: { 'User-Agent': UA }
        });
        const m = res.data.match(/<source[^>]+src="([^"]+\.mp3[^"]*)"/i);
        if (!m) throw new Error('未找到播放地址');
        return { url: m[1] };
    },

    async getLyric(musicItem) {
        try {
            const res = await axios.get(BASE + '/showLRC.asp', {
                params: { id: musicItem.id },
                headers: { 'User-Agent': UA }
            });
            const text = String(res.data || '').trim();
            if (text.length > 10 && text.indexOf('[') === 0) {
                return { rawLrc: text };
            }
        } catch (e) {}
        throw new Error('暂无歌词');
    }
};
