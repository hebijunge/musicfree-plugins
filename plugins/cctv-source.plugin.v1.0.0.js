/**
 * CCTV 听音源插件 v1.0.0
 *
 * 数据来源：CCTV 央视网官方接口（tv.cctv.com 听音频道 / api.cntv.cn / search.cctv.com / vdn.apps.cntv.cn）
 * 上游参考：qwerwhr/musicfree-plugins 的 cctv 插件（无 LICENSE，按硬性要求未照搬其代码，仅采用其验证过的官方端点事实）
 *
 * v1.0.0 相对上游的修正（4 处缺陷）：
 *  1. getMediaSource 中 eval('(' + json + ')') 改为 JSON.parse（上游使用 eval，沙箱禁用且有注入风险）
 *  2. 上游 getMusicInfo 引用被注释掉的变量 obj，调用必崩 —— 本版移除该方法
 *  3. 上游 getLyric 返回第三方 2t58 的 URL 字符串冒充歌词（协议不合法），本版如实抛错：听音为有声节目无歌词
 *  4. 上游 getRecommendSheetsByTag 的 isEnd 恒为 false；本版用服务端 total 判定
 *
 * 播放链路（真网实证 2026-09-26）：
 *   专辑分集 guid（或搜索结果页解析 var parentGuid）
 *   → GET vdn.apps.cntv.cn/api/getIpadVideoInfo.do?pid=<guid>
 *   → 正则提取 var html5VideoData = '<json>' → JSON.parse
 *   → manifest.hls_audio_url（HLS 音频 m3u8，多码率）
 *
 * 已知风险（如实标注）：宿主 Android 端用 <audio> 播放，m3u8 HLS 兼容性需真机验证；
 *   若不兼容属宿主播放器能力问题，非本插件取链失败（m3u8 本身可访问已验证）。
 */

var axios = require('axios');

var PAGE_SIZE_SHEET = 20;
var PAGE_SIZE_EPISODE = 20;
var PAGE_SIZE_SEARCH = 20;
var UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

var API_HEADERS = {
    'User-Agent': UA_MOBILE,
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
};

// ---------- 工具 ----------

function stripHtml(s) {
    return String(s || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

// 从专辑/歌单页 URL 提取 VIDE 专辑 token
// 形如 https://tv.cctv.com/2026/09/21/VIDAucshYImi7elg2cRsrpA1260921.shtml
function albumTokenOf(pageUrl) {
    var m = String(pageUrl || '').match(/([A-Za-z0-9]+)\.shtml/);
    return m ? m[1] : null;
}

// 从音乐条目解析可播放 guid：
// 优先扩展字段 guid（专辑分集自带），其次播放页 ?guid=，最后取页解析（搜索结果无 guid 时）
async function resolveGuid(musicItem) {
    if (musicItem.guid) return musicItem.guid;
    var urlGuid = String(musicItem.id || '').match(/[?&]guid=([0-9a-f]{32})/);
    if (urlGuid) return urlGuid[1];
    var page = await axios.get(musicItem.id, {
        headers: { 'User-Agent': UA_MOBILE },
        timeout: 8000,
    });
    var m = String(page.data).match(/var\s+parentGuid\s*=\s*"([0-9a-f]{32})"/);
    if (m) return m[1];
    throw new Error('无法从页面解析节目 pid: ' + musicItem.id);
}

// 核心取链：pid → getIpadVideoInfo.do → html5VideoData → hls_audio_url
async function resolveHlsUrl(guid) {
    var res = await axios.get('https://vdn.apps.cntv.cn/api/getIpadVideoInfo.do', {
        params: { pid: guid },
        headers: API_HEADERS,
        timeout: 8000,
    });
    var body = String(res.data || '');
    var m = body.match(/var\s+html5VideoData\s*=\s*'(.*?)';\s*getHtml5VideoData/);
    if (!m) throw new Error('CCTV 取链响应不含 html5VideoData（pid=' + guid + '）');
    var info = JSON.parse(m[1]); // 修正①：上游用 eval，此处 JSON.parse
    if (info.status !== '001') throw new Error('CCTV 节目不可播（status=' + info.status + '）');
    var manifest = info.manifest || {};
    var url = manifest.hls_audio_url || manifest.audio_mp3 || info.hls_url;
    if (!url) throw new Error('CCTV 响应无可用音频 HLS 地址（pid=' + guid + '）');
    return url;
}

// 专辑分集（getMusicSheetInfo / getAlbumInfo 共用）
async function fetchEpisodes(pageUrl, page) {
    var token = albumTokenOf(pageUrl);
    if (!token) throw new Error('无法解析 CCTV 专辑 id: ' + pageUrl);
    var res = await axios.get('https://api.cntv.cn/NewVideo/getVideoListByAlbumIdNew', {
        params: {
            id: token,
            serviceId: 'tvty',
            pub: 2,
            mode: 2,
            p: page,
            n: PAGE_SIZE_EPISODE,
            sort: 'asc',
        },
        headers: API_HEADERS,
        timeout: 8000,
    });
    var data = (res.data && res.data.data) || {};
    var total = Number(data.total) || 0;
    var list = data.list || [];
    return {
        isEnd: total <= page * PAGE_SIZE_EPISODE,
        musicList: list.map(function (it) {
            return {
                id: it.id,
                title: stripHtml(it.title),
                album: undefined, // 由宿主按专辑上下文补全
                artwork: it.image,
                guid: it.guid,
                brief: it.brief ? stripHtml(it.brief).slice(0, 120) : undefined,
            };
        }),
    };
}

// ---------- 插件主体 ----------

module.exports = {
    platform: 'cctv',
    version: '1.0.0',
    author: '研发2号',
    description: 'CCTV 听音（央视网有声节目：听音历史/评书/名著/儿童故事等）。官方接口，HLS 音频播放。',
    supportedSearchType: ['music'],
    cacheControl: 'no-store',
    hints: {
        importMusicSheet: [
            '支持 CCTV 专辑/栏目页链接，例如：',
            'https://tv.cctv.com/2026/09/21/VIDAucshYImi7elg2cRsrpA1260921.shtml',
        ],
    },
    // 注意：不设 fake 的 pinned「栏目」tag——上游 pinned 的「栏目」在 getRecommendSheetsByTag 无对应处理，点了必空

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        var res = await axios.get('https://search.cctv.com/ifsearch.php', {
            params: {
                page: page,
                qtext: query,
                sort: 'relevance',
                pageSize: PAGE_SIZE_SEARCH,
                type: 'video',
            },
            headers: { 'User-Agent': UA_MOBILE },
            timeout: 8000,
        });
        var d = res.data || {};
        var totalpage = Number(d.totalpage) || 0;
        // 实测：该接口对越界页钳制返回末页内容（page=999 仍回 20 条），这里按 totalpage 钳制为空页
        if (totalpage > 0 && page > totalpage) return { isEnd: true, data: [] };
        var list = d.list || [];
        return {
            isEnd: totalpage > 0 ? page >= totalpage : true,
            data: list.map(function (it) {
                return {
                    id: it.urllink,
                    title: stripHtml(it.all_title || it.title),
                    artist: it.channel || it.TV || 'CCTV',
                    artwork: it.imglink,
                    duration: Number(it.durations) || undefined,
                    playtime: it.uploadtime,
                };
            }),
        };
    },

    async getMediaSource(musicItem, quality) {
        // 修正②：上游 getMusicInfo 引用已注释变量必崩，本版不提供该方法；取链前不做无谓补全
        var guid = await resolveGuid(musicItem);
        var url = await resolveHlsUrl(guid);
        return { url: url };
    },

    async getLyric() {
        // 修正③：上游返回第三方歌词站 URL 字符串冒充歌词（协议不合法）。听音为有声节目，无歌词，如实抛错
        throw new Error('CCTV 听音为有声节目，无歌词');
    },

    async getRecommendSheetTags() {
        var res = await axios.get('https://tv.cctv.com/ty/m/sxy/data.jsonp', {
            params: { cb: 'fenlei' },
            headers: { 'User-Agent': UA_MOBILE },
            timeout: 8000,
        });
        var m = String(res.data).match(/fenlei\(([\s\S]*?)\)\s*$/);
        if (!m) throw new Error('CCTV 分类接口响应异常');
        var rawList = JSON.parse(m[1]).data.list || [];
        // 按 fc（一级分类）分组，优于上游全部塞进同一组
        var groups = {};
        var order = [];
        rawList.forEach(function (it) {
            var fc = it.fc || '其他';
            if (!groups[fc]) {
                groups[fc] = [];
                order.push(fc);
            }
            groups[fc].push({ id: it.sc, title: it.sc });
        });
        return {
            data: order.map(function (fc) {
                return { title: fc, data: groups[fc] };
            }),
        };
    },

    async getRecommendSheetsByTag(tagItem, page) {
        // 修正④：isEnd 用服务端 total 判定（上游恒 false，导致无限翻页）
        var res = await axios.get('https://api.cntv.cn/newVideoset/getVideoAlbumListByPageIdTvty', {
            params: {
                sc: tagItem.id,
                p: page,
                id: '',
                n: PAGE_SIZE_SHEET,
                serviceId: 'tvty',
            },
            headers: API_HEADERS,
            timeout: 8000,
        });
        var data = (res.data && res.data.data) || {};
        var total = Number(data.total) || 0;
        var list = data.list || [];
        return {
            isEnd: total <= page * PAGE_SIZE_SHEET,
            data: list.map(function (it) {
                return {
                    id: it.url, // 专辑页 URL，作为后续分集解析的 key
                    title: stripHtml(it.title),
                    artwork: it.image,
                    description: stripHtml(it.brief || ''),
                    artist: it.colum_name || undefined,
                };
            }),
        };
    },

    async getMusicSheetInfo(sheetItem, page) {
        var r = await fetchEpisodes(sheetItem.id, page);
        return {
            isEnd: r.isEnd,
            musicList: r.musicList,
            sheetItem: {
                title: sheetItem.title,
                artwork: sheetItem.artwork,
                description: sheetItem.description,
            },
        };
    },

    async getAlbumInfo(albumItem, page) {
        // 搜索结果为单集（可直接播放），专辑入口主要来自分类浏览；此处与歌单同构，保证专辑页可打开
        var r = await fetchEpisodes(albumItem.id, page);
        return {
            isEnd: r.isEnd,
            musicList: r.musicList,
            albumItem: {
                title: albumItem.title,
                artwork: albumItem.artwork,
                description: albumItem.description,
            },
        };
    },

    async importMusicSheet(urlLike) {
        var m = String(urlLike || '').match(/tv\.cctv\.com\/[^\s]*\.shtml/);
        if (!m) throw new Error('仅支持 tv.cctv.com 专辑页链接');
        var all = [];
        var page = 1;
        var isEnd = false;
        while (!isEnd && page <= 50) {
            var r = await fetchEpisodes(m[0], page);
            all = all.concat(r.musicList);
            isEnd = r.isEnd;
            page += 1;
        }
        return all;
    },
};
