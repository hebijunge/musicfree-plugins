// 电音阁 (dianyinge.com) - MusicFree Plugin v1.0.0
// 同清风DJ CMS：div.isgood_list + title + img

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.dianyinge.com';
const UA = 'Mozilla/5.0';

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('div.isgood_list').each((i, el) => {
        const $a = $(el).find('a[href*="/play/"]').first();
        const href = $a.attr('href') || '';
        const m = href.match(/\/play\/(\d+)\.html/);
        if (!m) return;
        const title = $a.attr('title') || $a.text().trim();
        const $img = $(el).find('img').first();
        const artwork = $img.attr('src');
        if (!title || title.length < 2) return;
        data.push({ id: m[1], title, artist: '电音阁', artwork });
    });
    return data;
}

module.exports = {
    platform: '电音阁',
    version: '1.0.0',
    author: 'hebijunge',
    description: '电音阁 - DJ舞曲/封面/搜索',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dianyinge-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get(SITE + '/index/search/index/keyword/' + encodeURIComponent(query) + '/p/' + (page || 1), {
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getMediaSource(musicItem) {
        const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', { headers: { 'User-Agent': UA } });
        const m = String(res.data).match(/playurl\s*=\s*["']([^"']+)["']/);
        if (!m) throw new Error('取链失败');
        let url = m[1];
        if (!url.startsWith('http')) url = 'https://ys.dianyinge.com' + url;
        return { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
