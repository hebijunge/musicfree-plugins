// 波比DJ (bobidj.com) - MusicFree Plugin v1.0.0
// 搜索: /search/so?k={kw}&c=0&p=0&x=1&page={p}
// 列表: /list/{cat}_{sort}_{a}_{b}_{c}_{page}.html
// 取链: /play/{id}.html 内联 decrypt(ct,key,iv) → AES-128-CBC 解密 → p2.bobidj.com ...mp4?auth_key=...
// 注意: key/iv/ct 均从播放页动态提取, 不硬编码

const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');

const SITE = 'https://www.bobidj.com';
const UA = 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    const seen = new Set();
    $('a[href*="/play/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const m = href.match(/\/play\/(\d+)\.html/);
        if (!m) return;
        const id = m[1];
        if (seen.has(id)) return;
        const title = $(el).attr('title') || $(el).text().trim();
        if (!title || title.length < 2) return;
        seen.add(id);
        data.push({
            id: id,
            title: title,
            artist: '波比DJ'
        });
    });
    return data;
}

function decryptPlayUrl(html) {
    const m = html.match(/decrypt\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/);
    if (!m) throw new Error('未找到播放地址密文');
    const ct = m[1], key = m[2], iv = m[3];
    const decrypted = CryptoJS.AES.decrypt(ct, CryptoJS.enc.Utf8.parse(key), {
        iv: CryptoJS.enc.Utf8.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    const url = decrypted.toString(CryptoJS.enc.Utf8);
    if (!url) throw new Error('解密失败: 空结果');
    return url;
}

module.exports = {
    cacheControl: 'no-store',
    name: '波比DJ',
    platform: '波比DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '波比DJ音乐网 - AES解密取链/AAC试听/免登录',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/bobidj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = page || 1;
        const res = await axios.get(SITE + '/search/so', {
            params: { k: query, c: 0, p: 0, x: 1, page: p },
            headers: { 'User-Agent': UA }
        });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '舞曲分类', data: [
                { id: '1_0', title: '最新发布' },
                { id: '1_1', title: '人气排行' },
                { id: '1_2', title: '下载排行' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = page || 1;
        const url = SITE + '/list/' + topListItem.id + '_0_0_0_' + p + '.html';
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', {
            headers: { 'User-Agent': UA }
        });
        const url = decryptPlayUrl(res.data);
        return { url: url };
    },

    async getLyric(musicItem) {
        throw new Error('该音源暂无歌词');
    }
};
