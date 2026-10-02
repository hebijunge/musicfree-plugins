// QQDJ清风DJ音乐网 - MusicFree Plugin v1.2.1
// 搜索结果直接带 data-audio 直链，无需二次请求
// 分类: /genre/{slug}/
// 音质（2026-10-02 实测，与清风DJ 同一 CDN pan.urlkj.com，规则一致）：
//   /play/…mp3?t=&sign= → 96k CBR MP3；/down/…mp3 → 320k CBR MP3
//   签名绑定 /play/，换 /down/ 必须去掉 query 且不带 Referer，否则 403
//   "media sign required (invalid)"。
//   v1.2.0 的档位判断只认 legacy high/super，宿主实际传 320k/flac，故永不升级档位。

const axios = require('axios');
const cheerio = require('cheerio');

const SITE = 'https://www.qqdjs.com';
const UA = 'Mozilla/5.0';

const CATEGORIES = [
    { slug: 'xccs', name: '现场串烧' },
    { slug: 'zwcs', name: '中文串烧' },
    { slug: 'wycs', name: '外语串烧' },
    { slug: 'zycs', name: '中英串烧' },
    { slug: 'Pop_Music', name: '流行串烧' },
    { slug: 'zwwq', name: '中文舞曲' },
    { slug: 'ywwq', name: '英文舞曲' },
    { slug: 'reboedm', name: '硬核电音' }
];

// 站点只有 96k / 320k 两档：192k 及以上（legacy high/super 与新版高键都算）给 320k，不向下凑；
// 返回的 quality 是实际给到的档位，不是宿主请求的键。
const WANTS_HIGH_RE = /high|super|192k|224k|256k|320k|flac|hires|vinyl|dolby|atmos|master/i;
function wantsHigh(quality) { return WANTS_HIGH_RE.test(String(quality || '')); }

function parseList(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('[data-id][data-audio]').each((i, el) => {
        const id = $(el).attr('data-id');
        const audio = $(el).attr('data-audio');
        if (!id || !audio) return;
        const $el = $(el);
        const $title = $el.find('a[href*="/play/"]').first();
        const title = $title.text().trim() || $el.text().trim().split('\n')[0].trim();
        data.push({
            id: id,
            title: title || 'DJ' + id,
            artist: 'QQDJ',
            artwork: $el.find('img').attr('src') || '',
            _audio: audio
        });
    });
    const seen = new Set();
    return data.filter(d => !seen.has(d.id) && seen.add(d.id));
}

module.exports = {
    cacheControl: 'no-store',
    name: 'QQDJ',
    platform: 'QQDJ',
    version: '1.2.1',
    author: 'hebijunge',
    description: '清风DJ音乐网 - 分类/封面/96k与320k两档实测取链',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/qqdjs-source.plugin.v1.2.1.js',
    supportedSearchType: ['music'],
    supportedQualities: ['96k', '320k'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const url = page > 1
            ? SITE + '/search/page/' + page + '.html?keys=' + encodeURIComponent(query)
            : SITE + '/search/?keys=' + encodeURIComponent(query);
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: CATEGORIES.map(c => ({ id: 'cat_' + c.slug, title: c.name })) }
        ];
    },

    async getTopListDetail(topListItem, page) {
        const slug = topListItem.id.replace('cat_', '');
        const url = page > 1
            ? SITE + '/genre/' + slug + '/page/' + page + '.html'
            : SITE + '/genre/' + slug + '/';
        const res = await axios.get(url, { headers: { 'User-Agent': UA } });
        const data = parseList(res.data);
        return { isEnd: data.length < 10, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        let url = musicItem._audio || '';
        if (!url) {
            const res = await axios.get(SITE + '/play/' + musicItem.id + '.html', {
                headers: { 'User-Agent': UA }
            });
            const m = res.data.match(/data-audio="([^"]+)"/);
            if (!m) throw new Error('未找到播放链接');
            url = m[1];
        }
        // 高品320K: /play/ → /down/，并去掉绑定在 play 路径上的签名
        const isPlay = url.includes('/play/');
        if (wantsHigh(quality) && isPlay) {
            return { url: url.replace('/play/', '/down/').split('?')[0], quality: '320k' };
        }
        return isPlay ? { url, quality: '96k' } : { url };
    },

    async getLyric() { return { rawLrc: '' }; }
};
