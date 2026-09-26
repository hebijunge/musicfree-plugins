/**
 * Jamendo 开放音源插件 v1.0.1
 *
 * 数据来源：https://api.jamendo.com/v3.0/ （Jamendo 官方开放 API）
 * 音源性质：站内音乐均为创作者以 CC 等开放授权发布，合法可播。
 *
 * 语法基线：ES2017（使用 async/await，宿主沙箱支持；非 ES5）。
 *
 * 实现说明：参考实现 lmthunder2024/jamendo.js 无 LICENSE，按硬性要求本插件为
 * 全新自行实现，仅采用其验证过的官方 API 端点与参数事实（端点本身是 Jamendo
 * 公开文档内容，不属于任何作者的创作成果）。
 *
 * v1.0.1 修复（第3级交叉质检打回项）：
 *   P1-1 album/artist/sheet 搜索改传 namesearch（官方 /albums /artists /playlists
 *        参数表无 search，仅 /tracks 有 search）
 *   P1-2 getArtistWorks 改传 id（官方 /artists/tracks 与 /artists/albums 的歌手
 *        过滤参数为 id，无 artist_id）
 *   P1-3 榜单「最新上架单曲」order 由非法的 news 改为 releasedate（官方 /tracks
 *        order 枚举无 news，releasedate 为按上架日期排序）
 *   P2  专辑/歌单（及歌手作品）嵌套 tracks 无服务端分页（limit/offset 作用于
 *        父实体）：改为单次请求取全量嵌套数据 + 本地切片分页，页间不重复请求，
 *        切片越界的页直接返回空且 isEnd=true
 *   P3  自述修正：mp31 为 96kbps、mp32 为 VBR（官方 audioformat 标注），映射
 *        逻辑不变
 *
 * Client ID（必须）：插件不内置任何凭据。使用前在插件设置中填写
 * Jamendo Client ID —— 在 https://developer.jamendo.com 注册并在 My Apps
 * 创建应用即可免费获取。未填写时所有请求都会抛出引导报错。
 *
 * 端点事实（官方 API，参数以 developer.jamendo.com 各方法参数表为准）：
 *   响应信封 { headers: { status, error_message }, results: [] }，status=failed 即业务错误
 *   /tracks/                                  搜索与列表（search/limit/offset/order/tags）
 *   /albums/ /artists/ /playlists/            搜索与列表（namesearch/limit/offset/order）
 *   /albums/tracks/?id=  /playlists/tracks/?id=   专辑/歌单详情（嵌套 tracks 全量返回，无服务端分页）
 *   /artists/tracks/?id=  /artists/albums/?id=    歌手作品（id 为歌手 id，嵌套结果全量返回）
 *   /tracks/?id=&audioformat=mp31|mp32|ogg|flac   取链（mp31=96kbps，mp32=VBR；track.audio 为带签名时效直链）
 *   /tracks/?id=&include=lyrics               歌词（纯文本，无时间戳）
 *
 * 局限（如实标注）：沙箱内无有效 client_id，真实取链/搜索成功路径无法在沙箱
 * 验证；本版自测覆盖错误路径（真网）、参数与映射逻辑（夹具）与静态检查。
 * 用户注册 client_id 填入插件设置后即可正常使用；如线上出现取链问题，反馈后升版修复。
 */

var axios = require('axios');

var API_BASE = 'https://api.jamendo.com/v3.0';
var PAGE_SIZE = 30;
var UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// 内置风格 tag：Jamendo 无「标签列表」接口，此处为官方文档与站点通用的风格标签
var GENRES = [
    'electronic', 'rock', 'pop', 'jazz', 'classical', 'ambient', 'hip-hop',
    'metal', 'folk', 'blues', 'reggae', 'house', 'techno', 'trance',
    'chillout', 'instrumental', 'soundtrack', 'soul', 'punk', 'country',
];

// ---------- 凭据 ----------

function getClientId() {
    var vars = {};
    try {
        if (typeof env !== 'undefined' && env.getUserVariables) {
            vars = env.getUserVariables() || {};
        }
    } catch (e) { vars = {}; }
    var id = vars.clientId;
    if (!id || !String(id).trim()) {
        throw new Error('未配置 Jamendo Client ID：请在插件设置中填写（在 https://developer.jamendo.com 注册并在 My Apps 创建应用即可免费获取）');
    }
    return String(id).trim();
}

// ---------- 请求封装 ----------

async function apiCall(endpoint, params) {
    var baseParams = { client_id: getClientId(), format: 'json' };
    for (var k in (params || {})) baseParams[k] = params[k];
    var res = await axios.get(API_BASE + endpoint, {
        params: baseParams,
        timeout: 8000,
        headers: { 'User-Agent': UA_BROWSER, Accept: 'application/json' },
    });
    var data = res.data;
    if (!data || typeof data !== 'object' || !data.headers || !data.results) {
        throw new Error('Jamendo API 返回结构异常');
    }
    if (data.headers.status === 'failed') {
        throw new Error('Jamendo API 错误：' + (data.headers.error_message || '未知错误'));
    }
    return data;
}

// ---------- 映射 ----------

function normalizeImage(url) {
    if (!url) return undefined;
    if (String(url).indexOf('width=') >= 0) return String(url).replace(/width=\d+/, 'width=600');
    return url;
}

function toMusicItem(track, artistFallback) {
    return {
        id: String(track.id),
        title: track.name,
        artist: track.artist_name || artistFallback || '未知歌手',
        album: track.album_name || '',
        artwork: normalizeImage(track.image),
        duration: track.duration ? Number(track.duration) : undefined,
        albumId: track.album_id != null ? String(track.album_id) : undefined,
        artistId: track.artist_id != null ? String(track.artist_id) : undefined,
    };
}

function toAlbumItem(album) {
    return {
        id: String(album.id),
        title: album.name,
        artwork: normalizeImage(album.image),
        artist: album.artist_name || '未知歌手',
        artistId: album.artist_id != null ? String(album.artist_id) : undefined,
        createAt: album.releasedate ? new Date(album.releasedate).getTime() : undefined,
    };
}

function toArtistItem(artist) {
    return {
        id: String(artist.id),
        name: artist.name,
        avatar: normalizeImage(artist.image),
        artistId: String(artist.id),
    };
}

function toSheetItem(playlist) {
    return {
        id: String(playlist.id),
        title: playlist.name,
        artist: playlist.user_name || 'Jamendo 用户',
        createAt: playlist.creationdate ? new Date(playlist.creationdate).getTime() : undefined,
    };
}

// 嵌套数据无服务端分页（limit/offset 作用于父实体）：单次请求取全量后本地切片，
// 页间复用最近一次全量拉取，不重复请求；切片越界的页返回空且 isEnd=true
var NESTED_CACHE = { key: null, data: null };

// fetchFull 返回 { items: 全量条目, ...附带元信息 }，页间只做本地切片
async function fetchNestedPaged(cacheKey, fetchFull, page) {
    var data;
    if (NESTED_CACHE.key === cacheKey && NESTED_CACHE.data) {
        data = NESTED_CACHE.data;
    } else {
        data = await fetchFull();
        NESTED_CACHE.key = cacheKey;
        NESTED_CACHE.data = data;
    }
    var items = data.items || [];
    var start = (page - 1) * PAGE_SIZE;
    var slice = items.slice(start, start + PAGE_SIZE);
    return {
        isEnd: start + slice.length >= items.length,
        slice: slice,
        meta: data,
    };
}

// 专辑 tracks 分页拉取（getAlbumInfo 与 getMusicSheetInfo 的专辑形态共用）
async function fetchAlbumTracks(albumId, page, artistFallback) {
    var paged = await fetchNestedPaged('album:' + albumId, async function () {
        var data = await apiCall('/albums/tracks/', { id: albumId, limit: 'all' });
        var album = data.results[0];
        return {
            items: album ? (album.tracks || []) : [],
            albumName: album ? album.name : undefined,
            artwork: album ? normalizeImage(album.image) : undefined,
            artistName: album ? album.artist_name : undefined,
        };
    }, page);
    return {
        isEnd: paged.isEnd,
        musicList: paged.slice.map(function (t) { return toMusicItem(t, artistFallback || paged.meta.artistName); }),
        albumName: paged.meta.albumName,
        artwork: paged.meta.artwork,
        artistName: paged.meta.artistName,
    };
}

module.exports = {
    platform: 'jamendo',
    version: '1.0.1',
    author: '研发2号',
    description: 'Jamendo 开放授权（CC）音源：独立音乐人合法开放授权的作品。需在插件设置填写免费 Client ID。',
    cacheControl: 'no-store', // track.audio 为带签名时效直链，不缓存
    supportedSearchType: ['music', 'album', 'artist', 'sheet'],
    userVariables: [
        {
            key: 'clientId',
            name: 'Jamendo Client ID',
            hint: '在 https://developer.jamendo.com 注册并在 My Apps 创建应用获取（免费）',
        },
    ],
    hints: {
        importMusicItem: ['支持 Jamendo 歌曲链接或纯数字 ID，如 https://www.jamendo.com/track/123456'],
        importMusicSheet: ['支持 Jamendo 歌单链接或纯数字 ID，如 https://www.jamendo.com/playlist/123456'],
    },

    async search(query, page, type) {
        var offset = (page - 1) * PAGE_SIZE;
        var map, ep;
        if (type === 'music') { ep = '/tracks/'; map = toMusicItem; }
        else if (type === 'album') { ep = '/albums/'; map = toAlbumItem; }
        else if (type === 'artist') { ep = '/artists/'; map = toArtistItem; }
        else if (type === 'sheet') { ep = '/playlists/'; map = toSheetItem; }
        else return { isEnd: true, data: [] };
        // 官方参数表：仅 /tracks 有 search；/albums /artists /playlists 用 namesearch
        var searchParam = type === 'music' ? 'search' : 'namesearch';
        var reqParams = { limit: PAGE_SIZE, offset: offset };
        reqParams[searchParam] = query;
        var data = await apiCall(ep, reqParams);
        return {
            isEnd: data.results.length < PAGE_SIZE,
            data: data.results.map(map),
        };
    },

    async getMediaSource(musicItem, quality) {
        // 音质映射（官方 audioformat 标注：mp31=96kbps，mp32=VBR 约192kbps）：
        // low→mp31(96kbps)，super/high→flac（空则回落 mp32），其余→mp32(VBR)
        var fmt = quality === 'low' ? 'mp31' : (quality === 'super' || quality === 'high') ? 'flac' : 'mp32';
        var data = await apiCall('/tracks/', { id: musicItem.id, audioformat: fmt });
        var track = data.results[0];
        if ((!track || !track.audio) && fmt === 'flac') {
            data = await apiCall('/tracks/', { id: musicItem.id, audioformat: 'mp32' });
            track = data.results[0];
        }
        if (!track || !track.audio) throw new Error('该歌曲暂无可用音源（id=' + musicItem.id + '）');
        return { url: track.audio, userAgent: UA_BROWSER };
    },

    async getLyric(musicItem) {
        var data = await apiCall('/tracks/', { id: musicItem.id, include: 'lyrics' });
        var track = data.results[0];
        if (!track || !track.lyrics) return { rawLrc: '' }; // Jamendo 部分歌曲无歌词，空串如实返回
        var lines = String(track.lyrics).replace(/\r\n/g, '\n').split('\n');
        return {
            rawLrc: lines.map(function (line) {
                var t = line.trim();
                return t ? '[00:00.00]' + t : '';
            }).join('\n'),
        };
    },

    async getMusicInfo(musicItem) {
        var data = await apiCall('/tracks/', { id: musicItem.id });
        var track = data.results[0];
        if (!track) return {};
        var m = toMusicItem(track);
        return {
            title: m.title, artist: m.artist, album: m.album,
            artwork: m.artwork, duration: m.duration,
            albumId: m.albumId, artistId: m.artistId,
        };
    },

    async getAlbumInfo(albumItem, page) {
        var r = await fetchAlbumTracks(albumItem.id, page, albumItem.artist);
        var result = { isEnd: r.isEnd, musicList: r.musicList };
        if (page === 1) {
            result.albumItem = {
                title: r.albumName || albumItem.title,
                artwork: r.artwork || albumItem.artwork,
                artist: r.artistName || albumItem.artist,
                description: albumItem.description,
            };
        }
        return result;
    },

    async getMusicSheetInfo(sheetItem, page) {
        // 分类浏览返回的卡片实为专辑（isAlbumSheet 标记），走专辑接口
        if (sheetItem.isAlbumSheet) {
            var a = await fetchAlbumTracks(sheetItem.id, page, sheetItem.artist);
            var r1 = { isEnd: a.isEnd, musicList: a.musicList };
            if (page === 1) {
                r1.sheetItem = {
                    title: a.albumName || sheetItem.title,
                    artwork: a.artwork || sheetItem.artwork,
                    artist: a.artistName || sheetItem.artist,
                };
            }
            return r1;
        }
        // 嵌套 tracks 无服务端分页：单次取全量 + 本地切片（复用 NESTED_CACHE）
        var paged = await fetchNestedPaged('playlist:' + sheetItem.id, async function () {
            var data = await apiCall('/playlists/tracks/', { id: sheetItem.id, limit: 'all' });
            var playlist = data.results[0];
            return {
                items: playlist ? (playlist.tracks || []) : [],
                playlistName: playlist ? playlist.name : undefined,
                userName: playlist ? playlist.user_name : undefined,
            };
        }, page);
        var r2 = {
            isEnd: paged.isEnd,
            musicList: paged.slice.map(function (t) { return toMusicItem(t, sheetItem.artist); }),
        };
        if (page === 1) {
            r2.sheetItem = { title: paged.meta.playlistName || sheetItem.title, artist: paged.meta.userName || sheetItem.artist };
        }
        return r2;
    },

    async getArtistWorks(artistItem, page, type) {
        // 官方 /artists/tracks 与 /artists/albums 的歌手过滤参数均为 id（无 artist_id）；
        // limit/offset 作用于父实体（artist），嵌套结果无服务端分页 → 单次取全量 + 本地切片
        if (type === 'music') {
            var paged = await fetchNestedPaged('artist-tracks:' + artistItem.id, async function () {
                var t = await apiCall('/artists/tracks/', { id: artistItem.id, limit: 'all' });
                var artist = t.results[0];
                return { items: (artist && artist.tracks) || [] };
            }, page);
            return {
                isEnd: paged.isEnd,
                data: paged.slice.map(function (x) { return toMusicItem(x, artistItem.name); }),
            };
        }
        if (type === 'album') {
            var paged2 = await fetchNestedPaged('artist-albums:' + artistItem.id, async function () {
                var a2 = await apiCall('/artists/albums/', { id: artistItem.id, limit: 'all' });
                var artist2 = a2.results[0];
                return { items: (artist2 && artist2.albums) || [] };
            }, page);
            return { isEnd: paged2.isEnd, data: paged2.slice.map(toAlbumItem) };
        }
        return { isEnd: true, data: [] };
    },

    async getTopLists() {
        return [
            {
                title: '热门',
                data: [
                    { id: 'popularity_week', title: '本周热门单曲' },
                    { id: 'popularity_month', title: '本月热门单曲' },
                ],
            },
            // 官方 /tracks order 枚举无 news，最新上架用 releasedate（按上架日期排序）
            { title: '最新', data: [{ id: 'releasedate', title: '最新上架单曲' }] },
        ];
    },

    async getTopListDetail(topListItem, page) {
        var data = await apiCall('/tracks/', {
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            order: topListItem.id,
        });
        return {
            isEnd: data.results.length < PAGE_SIZE,
            musicList: data.results.map(toMusicItem),
        };
    },

    async getRecommendSheetTags() {
        return {
            pinned: [{ id: '', title: '全部' }],
            data: [{
                title: '音乐风格',
                data: GENRES.map(function (g) { return { id: g, title: g }; }),
            }],
        };
    },

    async getRecommendSheetsByTag(tagItem, page) {
        var params = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
        if (tagItem && tagItem.id) params.tags = tagItem.id;
        else params.order = 'popularity_week'; // 「全部」→ 本周热门专辑
        var data = await apiCall('/albums/', params);
        return {
            isEnd: data.results.length < PAGE_SIZE,
            data: data.results.map(function (album) {
                return {
                    id: String(album.id),
                    title: album.name,
                    artwork: normalizeImage(album.image),
                    artist: album.artist_name || '未知歌手',
                    artistId: album.artist_id != null ? String(album.artist_id) : undefined,
                    isAlbumSheet: true, // 该卡片实为专辑，getMusicSheetInfo 走专辑接口
                };
            }),
        };
    },

    async importMusicItem(urlLike) {
        var m = String(urlLike).match(/track\/(\d+)/i) || String(urlLike).match(/^(\d+)$/);
        if (!m) throw new Error('无法识别的链接，请输入 Jamendo 歌曲链接或纯数字 ID');
        var data = await apiCall('/tracks/', { id: m[1] });
        var track = data.results[0];
        if (!track) throw new Error('未找到该歌曲（id=' + m[1] + '）');
        return toMusicItem(track);
    },

    async importMusicSheet(urlLike) {
        var m = String(urlLike).match(/playlist\/(\d+)/i) || String(urlLike).match(/^(\d+)$/);
        if (!m) throw new Error('无法识别的链接，请输入 Jamendo 歌单链接或纯数字 ID');
        var all = [];
        var page = 1;
        while (page <= 20) {
            var sheet = await module.exports.getMusicSheetInfo({ id: m[1] }, page);
            all = all.concat(sheet.musicList);
            if (sheet.isEnd || !sheet.musicList.length) break;
            page += 1;
        }
        return all;
    },

    // 仅供测试脚本使用，宿主不会调用
    _internal: {
        apiCall: apiCall,
        getClientId: getClientId,
        toMusicItem: toMusicItem,
        toAlbumItem: toAlbumItem,
        toArtistItem: toArtistItem,
        toSheetItem: toSheetItem,
        normalizeImage: normalizeImage,
        fetchAlbumTracks: fetchAlbumTracks,
        fetchNestedPaged: fetchNestedPaged,
        resetNestedCache: function () { NESTED_CACHE.key = null; NESTED_CACHE.data = null; },
        GENRES: GENRES,
    },
};
