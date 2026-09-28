// DJ娱乐 (djyule.com) - MusicFree Plugin v1.2.0
// 搜索: https://appso.djyule.com/search.asp?key=xxx&page=N (XML)
// 播放: https://sj.djyule.com/player.asp?id=xxx → <source src> 直链
// 榜单: DJ娱乐榜 + 体验精选320k(tiyan320.xml)
// 歌词: https://www.djyule.com/showLRC.asp?id=xxx
// 免登录

const axios = require('axios');
const cheerio = require('cheerio');

const SJ = 'https://sj.djyule.com';
const APP = 'https://appso.djyule.com';
const APPXML = 'https://appxml.djyule.com';
const BASE = 'https://www.djyule.com';
const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile';

function parseSongXml(xml) {
    const $ = cheerio.load(xml, { xmlMode: true });
    const data = [];
    $('CATALOG > plants > PLANT').each((i, el) => {
        const $el = $(el);
        const id = $el.find('ID').text().trim();
        const name = $el.find('NAME').text().trim();
        const time = $el.find('TIME').text().trim();
        const zzname = $el.find('ZZname').text().trim();
        if (!id || !name) return;
        data.push({
            id: id,
            title: name,
            artist: zzname || 'DJ娱乐',
            duration: time
        });
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
        if (!name) return;
        data.push({
            id: 'ty_' + i,
            title: name,
            artist: '体验精选',
            _playUrl: url320 || url64
        });
    });
    return data;
}

function parseRankHtml(html) {
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

module.exports = {
    cacheControl: 'no-cache',
    name: 'DJ娱乐',
    platform: 'DJ娱乐',
    version: '1.2.0',
    author: 'hebijunge',
    description: 'DJ娱乐网 - App XML搜索/排行榜/体验精选320k/歌词',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djyule-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = page || 1;
        const res = await axios.get(APP + '/search.asp', {
            params: { key: query, page: p },
            headers: { 'User-Agent': UA }
        });
        const data = parseSongXml(res.data);
        const $ = cheerio.load(res.data, { xmlMode: true });
        const pagecount = parseInt($('pagecount').text()) || 1;
        return { isEnd: p >= pagecount, data };
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
        const data = parseRankHtml(res.data);
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
            if (text.length > 10 && text.indexOf('[') === 0) return { rawLrc: text };
        } catch (e) {}
        throw new Error('暂无歌词');
    }
};
