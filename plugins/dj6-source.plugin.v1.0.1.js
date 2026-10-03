// DJ6.cn (皇族DJ学院) - MusicFree Plugin v1.0.1
// 列表: /mlist-{tid}-{page}.html → a[href^="/play-"]（首页导航实测仅 2/3/4/5 四类，与插件一致）
// 取链: play-{id}.html → iframe m=media/...mp3 → mp3.dj6.cn
// 注意: 搜索已关闭（站点侧），列表页 HTML 无时长/大小（0 处 MM:SS），无封面
// v1.0.1 档位诚实性：声明 supportedQualities ['64k'] 并回写 quality/size。
//   实测 2026-10-03 逐帧：id 对应 439,397B / 1,912 帧 / 50.0s → 64kbps；
//   文档旧样本 747,746B / 186.8s → 32kbps，本站码率在 32~64kbps 间逐曲浮动，
//   宿主最低内置档即 64k（无更低键可标），按懒人/博看先例标 64k 并留真值注释。

const axios = require('axios');
const cheerio = require('cheerio');

// Range 探测真实体积（arraybuffer+Range：宿主 axios 在 RN 侧走 XHR，无 stream 适配器）
async function probeTotalBytes(url) {
    try {
        const r = await axios.get(url, {
            headers: { Range: 'bytes=0-1023' },
            timeout: 10000,
            responseType: 'arraybuffer',
            maxRedirects: 3,
            validateStatus: function (st) { return st === 200 || st === 206; },
        });
        const cr = String((r.headers && r.headers['content-range']) || '');
        const total = Number((cr.split('/')[1] || '').trim()) || Number(r.headers['content-length'] || 0);
        return total > 1 ? total : 0;
    } catch (e) {
        return 0;
    }
}

module.exports = {
    cacheControl: 'no-store',
    name: 'DJ6',
    platform: 'DJ6',
    version: '1.0.1',
    author: 'hebijunge',
    description: 'DJ6皇族DJ学院 - DJ舞曲列表（搜索已关闭）',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/dj6-source.plugin.v1.0.1.js',
    supportedSearchType: ['music'],
    // 单档 mp3（逐曲 32~64kbps，宿主最低内置档 64k），不虚构更高音质
    supportedQualities: ['64k'],

    async search(query, page, type) {
        return { isEnd: true, data: [] };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.get('https://www.dj6.cn/play-' + musicItem.id + '.html');
        const m = String(res.data).match(/m=([^&"']+\.mp3)/);
        if (!m) throw new Error('取链失败');
        const url = 'https://mp3.dj6.cn/' + m[1];
        const total = await probeTotalBytes(url);
        const result = { url: url, quality: '64k', actualQuality: '64k' };
        if (total) result.size = total;
        return result;
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        return [{ title: 'DJ6', data: [
            { id: '2', title: 'DJ舞曲' },
            { id: '3', title: '酒吧舞曲' },
            { id: '4', title: '中文舞曲' },
            { id: '5', title: '舞曲串烧' }
        ]}];
    },

    async getTopListDetail(topListItem, page) {
        const res = await axios.get(`https://www.dj6.cn/mlist-${topListItem.id}-${page || 1}.html`);
        const $ = cheerio.load(res.data);
        const data = [];
        $('a[href^="/play-"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const m = href.match(/play-(\d+)\.html/);
            if (!m) return;
            const title = $(el).text().trim();
            if (!title) return;
            data.push({ id: m[1], title, artist: 'DJ6' });
        });
        return { isEnd: data.length < 50, musicList: data };
    }
};
