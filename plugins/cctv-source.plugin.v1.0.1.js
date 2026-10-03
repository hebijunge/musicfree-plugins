/**
 * CCTV 听音源插件 v1.0.1
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
 * v1.0.1（2026-10-03 档位诚实性 + 内容错位收口，全部为真网实测定案）：
 *  5. resolveGuid 此前只抓 `var parentGuid`（整期节目），而搜索条目是 1~3 分钟看点切片：
 *     点一条 durations=179 的看点实际播出 2,298s 整期（实测切片 pid a77c3c4e… 变体 18 段/179s，
 *     parentGuid ab91527f… 变体 230 段/2,298s）——内容错位。切片页同时有 var guid（切片自身）
 *     与 var parentGuid（整期），改为优先切片自身 guid，parentGuid 只在无切片 guid 时兜底。
 *  6. 取链此前返回自适应 master 且完全忽略 quality 参数，只回 {url} → 宿主沿用用户请求档渲染，
 *     选 320k/flac 就显示 320k/flac。实测 master 的四条 BANDWIDTH 在音频侧只有两档
 *     （460800≡870400＝74kbps、1228800≡2048000＝174kbps，逐段字节实测一致），
 *     故按请求档固定选变体并如实回标 64k/128k（宁低勿高），无损类键直接拒绝不降级；
 *     同时声明 supportedQualities ['64k','128k']、用变体播放列表 EXTINF 求和回传真实 size。
 *  7. 补 getTopLists/getTopListDetail：此前听音只有「歌单分类」入口（需先进推荐页再选标签），
 *     榜单入口缺失；分类数据与本插件 getRecommendSheetTags 同一端点，抽出 fetchCategoryGroups 共用，
 *     榜单条目=分类下的专辑，播放该专辑第一集（resolveGuid 走 albumUrl 分支）。
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


// ==================== 音频档实测口径（2026-10-03）====================
// master 里四条 #EXT-X-STREAM-INF（BANDWIDTH=460800/870400/1228800/2048000）看着像四档，
// 实测音频只有两档：460800 与 870400 首段同为 92,120B/10.000s＝74kbps，
// 1228800 与 2048000 同为 217,3xx B/10.000s＝174kbps，差异全在视频流（听音用不到）。
// 切片与整期两个 pid 的这四条变体字节数完全一致，故档位口径与内容形态无关。
// 宿主最低内置档是 64k，按「宁低勿高」：74kbps 标 '64k'、174kbps 标 '128k'。
var CCTV_AUDIO_TIERS = {
    '64k': { minBw: 0, maxBw: 1100000, bytesPerSec: 9212 },
    '128k': { minBw: 1100000, maxBw: Infinity, bytesPerSec: 21740 },
};
// 请求键 → 实际交付档（本源无无损，无损类键一律如实拒绝，不降级虚标）
// 交付原则：给不低于请求档的那条（64k 请求走 74kbps 档；96k 及以上都走 174kbps 档），
// 标签按实测「宁低勿高」——74kbps 标 64k、174kbps 标 128k。
// legacy 名按宿主 legacyQualityMap 的语义折算：low→128k、standard→192k、high→320k、super→flac（拒）。
var CCTV_KEY_TO_LABEL = {
    '64k': '64k',
    '96k': '128k', '128k': '128k', '192k': '128k', '320k': '128k',
    low: '128k', standard: '128k', high: '128k', exhigh: '128k', higher: '128k',
    hq: '128k', original: '128k',
};
var CCTV_LOSSLESS_KEYS = {
    flac: 1, flac24bit: 1, hires: 1, master: 1,
    atmos: 1, atmos_plus: 1, dolby: 1, vinyl: 1,
    super: 1, sq: 1, zq: 1, lossless: 1,
};

function cctvLabelFor(quality) {
    var key = String(quality === undefined || quality === null || quality === '' ? '64k' : quality);
    if (CCTV_LOSSLESS_KEYS[key]) {
        throw new Error('CCTV 听音音频实测最高 174kbps（AAC over HLS），无 [' + key + '] 无损档，不降级虚标');
    }
    return CCTV_KEY_TO_LABEL[key] || '64k';
}

// 从 master 挑该档里 BANDWIDTH 最小的一条变体（固定档，不再交给播放器自适应）
function cctvPickVariant(master, masterUrl, label) {
    var tier = CCTV_AUDIO_TIERS[label] || CCTV_AUDIO_TIERS['64k'];
    var variants = [];
    var re = /#EXT-X-STREAM-INF:[^\n]*BANDWIDTH=(\d+)[^\n]*\n([^\s#][^\n]*)/g;
    var m;
    while ((m = re.exec(master)) !== null) {
        variants.push({ bw: Number(m[1]), uri: String(m[2]).trim() });
    }
    if (!variants.length) throw new Error('CCTV 播放列表无可用变体');
    var cand = variants.filter(function (v) {
        return v.bw >= tier.minBw && v.bw < tier.maxBw;
    });
    if (!cand.length) cand = variants;
    cand.sort(function (a, b) { return a.bw - b.bw; });
    var uri = cand[0].uri;
    if (uri.indexOf('http') === 0) return uri;
    var hm = /^(https?:\/\/[^/]+)/.exec(String(masterUrl));
    var host = hm ? hm[1] : '';
    return host + (uri.indexOf('/') === 0 ? uri : '/' + uri);
}

// 变体播放列表累计时长（EXTINF 求和），用于给宿主回传真实体积
function cctvPlaylistSeconds(text) {
    var re = /#EXTINF:([\d.]+)/g;
    var m, sum = 0;
    while ((m = re.exec(text)) !== null) sum += Number(m[1]);
    return sum;
}


// 分类数据（tv.cctv.com/ty/m/sxy/data.jsonp）：fc=一级分类，sc=二级栏目
async function fetchCategoryGroups() {
    var res = await axios.get('https://tv.cctv.com/ty/m/sxy/data.jsonp', {
        params: { cb: 'fenlei' },
        headers: { 'User-Agent': UA_MOBILE },
        timeout: 8000,
    });
    var m = String(res.data).match(/fenlei\(([\s\S]*?)\)\s*$/);
    if (!m) throw new Error('CCTV 分类接口响应异常');
    var rawList = JSON.parse(m[1]).data.list || [];
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
    return order.map(function (fc) {
        return { title: fc, data: groups[fc] };
    });
}

// 某分类下的专辑页列表
async function fetchAlbumsByCategory(sc, page) {
    var res = await axios.get('https://api.cntv.cn/newVideoset/getVideoAlbumListByPageIdTvty', {
        params: { sc: sc, p: page, id: '', n: PAGE_SIZE_SHEET, serviceId: 'tvty' },
        headers: API_HEADERS,
        timeout: 8000,
    });
    var data = (res.data && res.data.data) || {};
    var total = Number(data.total) || 0;
    var list = data.list || [];
    return {
        isEnd: total <= page * PAGE_SIZE_SHEET,
        list: list.map(function (it) {
            return {
                id: it.url,
                title: stripHtml(it.title),
                artwork: it.image,
                description: stripHtml(it.brief || ''),
                artist: it.colum_name || undefined,
            };
        }),
    };
}

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
    // 榜单/分类条目 = 整张专辑：取第一集（专辑页本身不是可播切片）
    if (musicItem.albumUrl) {
        var first = await fetchEpisodes(musicItem.albumUrl, 1);
        if (first.musicList.length && first.musicList[0].guid) return first.musicList[0].guid;
        throw new Error('CCTV 专辑无可用分集: ' + musicItem.albumUrl);
    }
    var page = await axios.get(musicItem.id, {
        headers: { 'User-Agent': UA_MOBILE },
        timeout: 8000,
    });
    var body = String(page.data);
    // 修正⑤：优先切片自身 guid（var guid），parentGuid 是整期节目，只在无切片 guid 时兜底
    var m = body.match(/var\s+guid\s*=\s*"([0-9a-f]{32})"/)
        || body.match(/var\s+parentGuid\s*=\s*"([0-9a-f]{32})"/);
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
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/cctv-source.plugin.v1.0.1.js',
    name: 'CCTV听音',
    platform: 'cctv',
    version: '1.0.1',
    author: '研发2号',
    description: 'CCTV 听音（央视网有声节目：听音历史/评书/名著/儿童故事等）。官方接口，HLS 音频播放。',
    supportedSearchType: ['music'],
    // 实测音频只有两档：74kbps 与 174kbps（AAC over HLS），宁低勿高标 64k/128k；
    // 无损档不存在，请求 flac/hires/master/atmos 等如实报错不降级。
    supportedQualities: ['64k', '128k'],
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
        // 修正②：上游 getMusicInfo 引用已注释变量必崩，本版不提供该方法
        // 修正⑥：先定档再取链——无损类键在发请求前就拒绝，拿到的是固定档变体而非自适应 master
        var label = cctvLabelFor(quality);
        var guid = await resolveGuid(musicItem);
        var masterUrl = await resolveHlsUrl(guid);
        var mres = await axios.get(masterUrl, { headers: API_HEADERS, timeout: 8000 });
        var url = cctvPickVariant(String(mres.data), masterUrl, label);
        var result = { url: url, quality: label, actualQuality: label };
        var totalSec = 0;
        try {
            var pl = await axios.get(url, { headers: API_HEADERS, timeout: 8000 });
            totalSec = cctvPlaylistSeconds(String(pl.data));
        } catch (e) {
            totalSec = 0; // 变体列表取不到就不回 size，不拿估算值冒充
        }
        if (totalSec) {
            var tier = CCTV_AUDIO_TIERS[label] || CCTV_AUDIO_TIERS['64k'];
            result.size = Math.round(totalSec * tier.bytesPerSec);
        }
        return result;
    },

    async getTopLists() {
        // 修正⑦：榜单入口。此前只有 getRecommendSheetTags（要先进推荐页再选标签才够得着分类）
        var groups = await fetchCategoryGroups();
        return groups.map(function (g) {
            return {
                title: g.title,
                data: g.data.map(function (c) {
                    return { id: 'cat_' + c.id, title: c.title, kind: 'category', sc: c.id };
                }),
            };
        });
    },

    async getTopListDetail(topListItem, page) {
        if (!topListItem || topListItem.kind !== 'category') throw new Error('未知榜单类型');
        var p = Math.max(1, Number(page) || 1);
        var r = await fetchAlbumsByCategory(topListItem.sc, p);
        return {
            isEnd: r.isEnd,
            musicList: r.list.map(function (it) {
                // 专辑映射为条目（与相声评书同口径）：点击播放该专辑第一集，
                // 需要整张专辑走「歌单」入口（getMusicSheetInfo/importMusicSheet 已支持）
                return Object.assign({}, it, { albumUrl: it.id });
            }),
        };
    },

    async getLyric() {
        // 修正③：上游返回第三方歌词站 URL 字符串冒充歌词（协议不合法）。听音为有声节目，无歌词，如实抛错
        throw new Error('CCTV 听音为有声节目，无歌词');
    },

    async getRecommendSheetTags() {
        // 按 fc（一级分类）分组，优于上游全部塞进同一组（与 getTopLists 共用抓取）
        var groups = await fetchCategoryGroups();
        return { data: groups };
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
