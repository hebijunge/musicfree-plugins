// DJ耶耶耶网 (djyyy.com) MusicFree 插件 v1.1.0
// 老牌舞曲文本站，音频无专辑封面；CDN ct.haiqu.vip
// 搜索:   GET /search.php?ac=dj&key={kw}&page={p}     → li[data-id]，25条/页
// 频道:   GET /{channel}/x_{page}.html                → li[data-id]，25条/页
//         channel: chuanshao串烧 manyao慢摇串烧 jinbao劲爆串烧 mange慢歌连版
//                  zhongwen中文 waiyu外文 jiaoyi交谊 hanmai喊麦
// 歌单:   GET /radio/hot/1/ 取 /dtbf/{id}_0.html 卡片
//         歌单详情 GET /dtbf/{id}_0.html → li[data-ids]，20首单页
// 取链:   GET /play/{id}.html → <script src="/t/{hash}">
//         GET /t/{hash} → playurl='ct.haiqu.vip/...m4a'（64kbps 试听）
// 高品:   320kbps 需登录（下载接口未登录返回空），免登录不可得，不伪造

const axios = require('axios');
const cheerio = require('cheerio');

const ORIGIN = 'https://djyyy.com';
const PLATFORM = 'DJ耶耶耶';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 10000;
const CHANNEL_SIZE = 25;

const CHANNELS = [
    { ch: 'chuanshao', title: '串烧舞曲' },
    { ch: 'manyao', title: '慢摇串烧' },
    { ch: 'jinbao', title: '劲爆串烧' },
    { ch: 'mange', title: '慢歌连版' },
    { ch: 'zhongwen', title: '中文舞曲' },
    { ch: 'waiyu', title: '外文舞曲' },
    { ch: 'jiaoyi', title: '交谊舞曲' },
    { ch: 'hanmai', title: '喊麦舞曲' },
];

async function get(url, extraHeaders) {
    return axios.get(url, {
        headers: Object.assign({
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }, extraHeaders || {}),
        timeout: TIMEOUT,
    });
}

function absUrl(u) {
    if (!u) return '';
    if (u.startsWith('http')) return u;
    if (u.startsWith('//')) return 'https:' + u;
    return ORIGIN + (u.startsWith('/') ? u : '/' + u);
}

// 时长：支持 HH:MM:SS / MM:SS
function parseDuration(text) {
    let m = text.match(/(\d{1,2}):(\d{2}):(\d{2})\b/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    m = text.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return undefined;
}

// 搜索/频道：li[data-id]
function parseTracks(html) {
    const $ = cheerio.load(html);
    const data = [];
    $('li[data-id]').each((i, li) => {
        const $li = $(li);
        const id = $li.attr('data-id');
        if (!id) return;
        const $a = $li.find('a[href*="/play/"]').first();
        const title = ($a.text() || '').replace(/\s+/g, ' ').trim();
        if (!title) return;
        data.push({
            id: String(id),
            title,
            artist: PLATFORM,
            artwork: '',
            duration: parseDuration($li.text()),
        });
    });
    return data;
}

// 歌单详情：li[data-ids]
function parseSheet(html, cover) {
    const $ = cheerio.load(html);
    const data = [];
    $('li[data-ids]').each((i, li) => {
        const $li = $(li);
        const id = $li.attr('data-ids');
        if (!id) return;
        const title = ($li.find('a.name').first().text() || '').replace(/\s+/g, ' ').trim();
        if (!title) return;
        data.push({
            id: String(id),
            title,
            artist: PLATFORM,
            artwork: cover || '',
            duration: parseDuration($li.text()),
        });
    });
    return data;
}

module.exports = {
    platform: PLATFORM,
    version: '1.1.0',
    author: 'hebijunge',
    description: 'DJ耶耶耶网 串烧/慢摇/交谊/DJ舞曲，支持搜索、频道分类、歌单、播放（64kbps试听）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djyyy-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = Math.max(1, Number(page) || 1);
        const res = await get(ORIGIN + '/search.php?ac=dj&key=' + encodeURIComponent(query) + '&page=' + p);
        const data = parseTracks(res.data);
        return { isEnd: data.length < CHANNEL_SIZE, data };
    },

    async getMediaSource(musicItem) {
        const id = String(musicItem.id);
        const playRes = await get(ORIGIN + '/play/' + id + '.html', { Referer: ORIGIN + '/' });
        const playHtml = typeof playRes.data === 'string' ? playRes.data : '';
        const sm = playHtml.match(/src="(\/t\/[A-Z0-9]+)"/);
        if (!sm) throw new Error('未找到取链脚本');
        const tRes = await get(ORIGIN + sm[1], { Referer: ORIGIN + '/play/' + id + '.html' });
        const tJs = typeof tRes.data === 'string' ? tRes.data : '';
        const um = tJs.match(/playurl\s*=\s*'([^']+)'/);
        if (!um || !um[1]) throw new Error('未获取到播放地址（320k 高品需登录）');
        // 免登录仅 64kbps m4a，所有音质请求均返回该地址，不伪造高品
        return { url: um[1] };
    },

    async getTopLists() {
        const groups = [
            {
                title: '舞曲频道',
                data: CHANNELS.map(c => ({
                    id: 'ch_' + c.ch, title: c.title,
                    kind: 'channel', ch: c.ch,
                })),
            },
        ];
        // 热门歌单（动态抓取）
        try {
            const res = await get(ORIGIN + '/radio/hot/1/');
            const $ = cheerio.load(res.data);
            const sheets = [];
            $('a[href*="/dtbf/"]').each((i, a) => {
                const href = $(a).attr('href') || '';
                const m = href.match(/\/dtbf\/(\d+)_0\.html/);
                if (!m) return;
                const sid = m[1];
                if (sheets.some(s => s.id === sid)) return;
                const img = absUrl($(a).find('img').attr('src'));
                let title = ($(a).find('.station-list__title').text() || '').trim();
                if (!title) title = ($(a).find('img').attr('alt') || $(a).text() || '').trim();
                if (!title) return;
                sheets.push({
                    id: 'sheet_' + sid, title, artwork: img,
                    kind: 'sheet', sheetId: sid,
                });
            });
            if (sheets.length) groups.push({ title: '热门歌单', data: sheets });
        } catch (e) {
            // 歌单抓取失败不影响频道
        }
        return groups;
    },

    async getTopListDetail(topListItem, page) {
        const p = Math.max(1, Number(page) || 1);
        const kind = topListItem.kind;
        if (kind === 'channel') {
            const res = await get(ORIGIN + '/' + topListItem.ch + '/x_' + p + '.html');
            const data = parseTracks(res.data);
            return { isEnd: data.length < CHANNEL_SIZE, musicList: data };
        }
        if (kind === 'sheet') {
            const sid = topListItem.sheetId;
            const res = await get(ORIGIN + '/dtbf/' + sid + '_0.html');
            const cover = absUrl('/upload/fav/' + sid + '_400x400.jpg');
            const data = parseSheet(res.data, cover);
            return { isEnd: true, musicList: data };
        }
        throw new Error('未知榜单类型');
    },
};
