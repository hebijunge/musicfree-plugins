/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「快音」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * MusicFree 音源插件 —— 快音（kuaiyin）
 * ============================================================
 * 平台: com.kuaiyin.player v5.83.03 | 主域名: api.kaixinyf.cn
 * 依据: 《快音接口完整文档_综合实测版》(2026-09-02) + 本地全接口实测复验 (2026-09-24)
 *
 * 签名: HMAC-SHA256，密钥 apple = "apple-is-foolish"
 *   msg = 全部表单参数(业务+公共+t) 按 key 字典序排序后 "k=v&k=v" 拼接(无末尾&)
 *   输出表单参数 s = "apple|大写HEX"
 * 公共参数: platform=Android / app_v=5.83.03 / client_v=5.83.03 / t=13位毫秒
 * Header: platform, client-v, app-v, utm-source=tomato_listen, device-id(必须),
 *         platform-v=13, platform-brand=Xiaomi, platform-model=Redmi,
 *         network-type=wifi, tourist-token(大部分接口需要)
 *
 * 音质: 平台仅单一 m4a（play_url 直接可播，实测 ≈130kbps），映射为 128k 单档，
 *       无更高音质，不虚标。
 * 歌词: /music/lrc 返回纯文本（无 [mm:ss] 时间轴），rawLrc 原样返回，不伪造时间轴。
 *
 * 已知限制（如实标注，见交付报告）:
 *  - /PlaylistV2/GetPlaylistInfo·GetPlaylistMusics 上游返回 code=2（实测 owner uid
 *    组合仍失败）→ 歌单详情/歌单导入不可用，调用时抛出明确错误
 *  - SongLib/Category 通(195 频道)但下游 SongList 为歌单型条目且无详情出口、
 *    MusicSearch code=2 → 未暴露到 UI
 *  - SongLib/SongRankList 为用户榜(人气作者/土豪)非歌曲榜 → 不作歌曲榜单接入
 *  - 版权限制: 主流歌手（周杰伦等）搜索 0 结果，属平台特性
 * ============================================================
 */

var axios = require('axios');

// ===== 常量 =====
var BASE_URL = 'https://api.kaixinyf.cn';
var APP_VERSION = '5.83.03';
var CHANNEL = 'tomato_listen';
var DEVICE_ID = 'a84227f7be4c671e';
var SIGN_KEY_NAME = 'apple';
var SIGN_KEY = 'apple-is-foolish';

var HOME_FEED_STATISTICS = JSON.stringify({
    user_recent_finish_music_id_list: '',
    user_recent_finish_time: '',
    user_recent_play_music_id_list: '',
});

// ===== 签名与请求层 =====

/** 生成签名: 表单参数(不含 s)按 key 字典序排序 k=v&k=v，HMAC-SHA256 大写 hex，前缀 apple| */
function signParams(params) {
    var keys = Object.keys(params).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
        parts.push(keys[i] + '=' + params[keys[i]]);
    }
    // crypto-js 在宿主沙箱可用；node 侧测试用同一实现保证一致
    var CryptoJS = require('crypto-js');
    var digest = CryptoJS.HmacSHA256(parts.join('&'), SIGN_KEY).toString(CryptoJS.enc.Hex).toUpperCase();
    return SIGN_KEY_NAME + '|' + digest;
}

var _touristToken = '';
var _touristTokenPromise = null;

/** 获取游客 Token（带缓存与并发去重；force=true 强制刷新） */
function getTouristToken(force) {
    if (!force && _touristToken) return Promise.resolve(_touristToken);
    if (_touristTokenPromise) return _touristTokenPromise;
    _touristTokenPromise = postRaw('/Tourist/GetTouristInfo', { content: '' }, {})
        .then(function (body) {
            var payload = body && body.data;
            if (!payload || !payload.tourist_token) {
                throw new Error('快音: 获取游客 Token 失败（响应缺少 tourist_token）');
            }
            _touristToken = payload.tourist_token;
            _touristTokenPromise = null;
            return _touristToken;
        })
        .catch(function (e) {
            _touristTokenPromise = null;
            throw e;
        });
    return _touristTokenPromise;
}

/** 发送 POST 表单请求（不做信封校验，返回解析后的 body） */
function postRaw(endpoint, business, extraCommon, withToken) {
    var t = String(Date.now());
    var all = {
        platform: 'Android',
        app_v: APP_VERSION,
        client_v: APP_VERSION,
        t: t,
    };
    var k;
    if (business) for (k in business) all[k] = String(business[k]);
    if (extraCommon) for (k in extraCommon) all[k] = String(extraCommon[k]);
    all.s = signParams(all);

    var headers = {
        'User-Agent': 'okhttp/4.9.3',
        'platform': 'Android',
        'client-v': APP_VERSION,
        'app-v': APP_VERSION,
        'utm-source': CHANNEL,
        'device-id': DEVICE_ID,
        'platform-v': '13',
        'platform-brand': 'Xiaomi',
        'platform-model': 'Redmi',
        'network-type': 'wifi',
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (withToken && _touristToken) headers['tourist-token'] = _touristToken;

    return axios.post(BASE_URL + endpoint, new URLSearchParams(all).toString(), {
        headers: headers,
        timeout: 8000,
    }).then(function (resp) {
        return resp.data;
    });
}

/** 业务请求：自动带游客 Token；code=10037(游客Token过期) 自动刷新重试一次 */
function request(endpoint, business, extraCommon) {
    return getTouristToken(false).then(function () {
        return postRaw(endpoint, business, extraCommon, true);
    }).then(function (body) {
        if (body && String(body.code) === '10037') {
            // 游客 Token 过期 → 刷新后重试一次
            return getTouristToken(true).then(function () {
                return postRaw(endpoint, business, extraCommon, true);
            });
        }
        return body;
    }).then(function (body) {
        if (!body || typeof body !== 'object') {
            throw new Error('快音接口 ' + endpoint + ' 响应异常（非 JSON 信封）');
        }
        if (String(body.code) !== '0') {
            throw new Error('快音接口 ' + endpoint + ' 失败 (code=' + body.code + ')' + (body.message ? ': ' + body.message : ''));
        }
        return body.data;
    });
}

// ===== last_id 分页缓存 =====
// 快音多个列表接口是 last_id 游标分页（非页码）。宿主按页码翻页，这里缓存
// 每个游标链第 p 页返回的 last_id，供第 p+1 页使用；缓存未命中时从第 1 页顺序补拉。
var _lastIdCache = {}; // key -> { '1': lastIdOfPage1, ... }（值为该页请求前使用的 last_id 输入）
var MAX_WALK_PAGES = 12;

function makeCursorKey(scope, id) {
    return scope + '|' + (id === undefined || id === null ? '' : String(id));
}

/** 取第 page 页应使用的 last_id 输入（page 从 1 开始） */
function getCursorInput(key, page) {
    var chain = _lastIdCache[key];
    if (page === 1) return chain && chain['1'] !== undefined ? chain['1'] : firstCursorValue(key);
    if (chain && chain[String(page)] !== undefined) return chain[String(page)];
    return null; // 需要补拉
}

function firstCursorValue(key) {
    // 各接口首页游标输入：分类音乐/榜单详情用 "0"，歌单广场/歌手/相关推荐用 ""
    return key.indexOf('catmusic') === 0 || key.indexOf('toplist') === 0 ? '0' : '';
}

function rememberCursorInput(key, page, value) {
    if (!_lastIdCache[key]) _lastIdCache[key] = {};
    _lastIdCache[key][String(page)] = value;
}

/**
 * 游标分页统一入口：调用 fetchPage(lastIdInput) -> Promise<{rows, lastId}>
 * 自动处理缓存未命中时的顺序补拉（从第 1 页走到第 page 页）。
 */
function cursorPage(scope, id, page, fetchPage) {
    var key = makeCursorKey(scope, id);
    var input = getCursorInput(key, page);
    if (input !== null) {
        rememberCursorInput(key, page, input);
        return fetchPage(input).then(function (r) {
            // 记录下一页（page+1）的输入 = 本页返回的 lastId
            if (!_lastIdCache[key]) _lastIdCache[key] = {};
            _lastIdCache[key][String(page + 1)] = r.lastId === undefined || r.lastId === null ? '' : String(r.lastId);
            return r;
        });
    }
    // 缓存未命中：从第 1 页顺序补拉到第 page 页
    var p = 1;
    var result = null;
    var walk = function () {
        var cur = getCursorInput(key, p);
        rememberCursorInput(key, p, cur);
        return fetchPage(cur).then(function (r) {
            if (!_lastIdCache[key]) _lastIdCache[key] = {};
            _lastIdCache[key][String(p + 1)] = r.lastId === undefined || r.lastId === null ? '' : String(r.lastId);
            result = r;
            p += 1;
            if (p <= page && r.lastId && p <= MAX_WALK_PAGES) return walk();
            return null;
        });
    };
    return walk().then(function () { return result; });
}

// ===== 数据映射 =====

/** 歌曲对象 → IMusicItem（play_url 缓存为扩展字段 _playUrl，避免二次请求） */
function mapMusicItem(raw) {
    if (!raw || !raw.code) return null;
    var item = {
        id: String(raw.code),
        title: raw.name || raw.title || raw.code,
        artist: raw.singer || '未知歌手',
        duration: raw.play_time || undefined,
        _playUrl: raw.play_url || '',
        _fileSize: raw.file_size || undefined,
        _hasLrc: raw.has_lrc === 1 || (raw.has_lrc === '1'),
    };
    var artwork = raw.cover || raw.cover_thumb || raw.default_cover;
    if (artwork) item.artwork = artwork;
    return item;
}

function mapMusicList(rows) {
    var out = [];
    var arr = rows || [];
    for (var i = 0; i < arr.length; i++) {
        var m = mapMusicItem(arr[i]);
        if (m) out.push(m);
    }
    return out;
}

// ===== 插件 =====

module.exports = {
    name: '快音',
    platform: '快音',
    version: '1.0.0',
    author: '研发2号',
    description: '快音音源（api.kaixinyf.cn）| 单一 m4a 音质 | 纯文本歌词 | UGC 平台：DJ/翻唱/广场舞为主，主流歌手可能无结果 | 歌单详情上游暂不可用',
    supportedSearchType: ['music'],
    supportedQualities: ['128k'],
    cacheControl: 'cache',
    hints: {
        importMusicItem: [
            '支持输入快音歌曲 code（16 位标识）或包含该 code 的链接文本',
        ],
        importMusicSheet: [
            '⚠ 快音歌单详情接口（PlaylistV2）上游返回参数错误，歌单导入暂不可用',
        ],
    },

    /** 搜索（仅音乐；结果直接带 play_url） */
    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        var pageSize = 30;
        var data = await request('/q/search', {
            q: query,
            type: '0',
            page: String(page),
            page_size: String(pageSize),
            tag_id: '',
        });
        var ml = (data && data.music_list) || {};
        var rows = ml.rows || [];
        var musicList = mapMusicList(rows);
        var isEnd;
        if (ml.total_page !== undefined && ml.total_page !== null) {
            isEnd = page >= Number(ml.total_page);
        } else {
            isEnd = rows.length < pageSize;
        }
        return { isEnd: isEnd, data: musicList };
    },

    /** 获取播放链接：单一 m4a，任何请求音质都返回同一真实直链（不虚标更高音质） */
    async getMediaSource(musicItem, quality) {
        var url = musicItem && musicItem._playUrl;
        if (!url) {
            var data = await request('/music/detail', { music_code: musicItem.id });
            var raw = (data && data.music_list && data.music_list[0]) || null;
            if (!raw || !raw.play_url) throw new Error('快音: 未取得该歌曲的播放链接');
            url = raw.play_url;
        }
        if (typeof url !== 'string' || url.indexOf('http') !== 0) {
            throw new Error('快音: 播放链接无效');
        }
        // 音频直链无需签名/Header（实测裸请求 200，audio/mp4a-latm）
        return { url: url };
    },

    /** 歌曲信息补全 */
    async getMusicInfo(musicItem) {
        var data = await request('/music/detail', { music_code: musicItem.id });
        var raw = (data && data.music_list && data.music_list[0]) || null;
        if (!raw) throw new Error('快音: 歌曲详情为空');
        var info = {};
        if (raw.cover || raw.cover_thumb) info.artwork = raw.cover || raw.cover_thumb;
        if (raw.play_time) info.duration = raw.play_time;
        if (raw.singer) info.artist = raw.singer;
        return info;
    },

    /** 歌词：上游为纯文本（无时间轴），原样返回，不伪造 LRC 时间标签 */
    async getLyric(musicItem) {
        var data = await request('/music/lrc', { music_code: musicItem.id });
        var content = (data && data.lrc && data.lrc.content) || '';
        if (!content) throw new Error('快音: 该歌曲暂无歌词');
        return { rawLrc: content };
    },

    /** 排行榜：分类专区（CategoryMusic，歌曲列表可用）+ 每日推荐（home/feed） */
    async getTopLists() {
        var groups = [];
        // 分组1: 分类专区（7 个，sign 动态下发）
        try {
            var data = await request('/CategoryMusic/init', {});
            var channels = (data && data.channels) || [];
            if (channels.length > 0) {
                var zoneItems = [];
                for (var i = 0; i < channels.length; i++) {
                    zoneItems.push({
                        id: 'zone:' + channels[i].sign,
                        title: channels[i].name || channels[i].sign,
                        artwork: channels[i].cover || undefined,
                    });
                }
                groups.push({ title: '分类专区', data: zoneItems });
            }
        } catch (e) { /* 分类专区失败不阻塞其它分组 */ }
        // 分组2: 每日推荐（home/feed 免登录可取 25 首）
        groups.push({
            title: '推荐',
            data: [{ id: 'homefeed', title: '每日热歌推荐' }],
        });
        return groups;
    },

    /** 排行榜详情 */
    async getTopListDetail(topListItem, page) {
        if (topListItem.id === 'homefeed') {
            if (page > 1) return { isEnd: true, musicList: [] };
            var feed = await request('/home/feed', {
                first_page: '1',
                personal: '1',
                music_statistics: HOME_FEED_STATISTICS,
            }, { channel: CHANNEL });
            var feedRows = (feed && feed.music_list) || [];
            return { isEnd: true, musicList: mapMusicList(feedRows) };
        }
        if (topListItem.id && topListItem.id.indexOf('zone:') === 0) {
            var sign = topListItem.id.slice(5);
            var r = await cursorPage('toplist', sign, page, function (lastId) {
                return request('/CategoryMusic/GetChannelMusics', {
                    sign: sign,
                    last_id: lastId,
                    limit: '20',
                }).then(function (d) {
                    var ml = (d && d.music_list) || [];
                    return { rows: ml, lastId: d && d.last_id };
                });
            });
            var list = mapMusicList(r.rows);
            var isEnd = !r.lastId || r.lastId === '0' || list.length === 0;
            return { isEnd: isEnd, musicList: list };
        }
        throw new Error('快音: 未知的榜单');
    },

    /** 推荐歌单标签（歌单广场 11 分类） */
    async getRecommendSheetTags() {
        var data = await request('/PlaylistSquare/GetCateList', {});
        var list = (data && data.list) || [];
        var pinned = null;
        var tags = [];
        for (var i = 0; i < list.length; i++) {
            var t = { id: list[i].title, title: list[i].name || list[i].title };
            if (i === 0) pinned = t;
            tags.push(t);
        }
        var result = { data: [{ title: '歌单广场', data: tags }] };
        if (pinned) result.pinned = [pinned];
        return result;
    },

    /** 按标签获取歌单（last_id 游标分页） */
    async getRecommendSheetsByTag(tag, page) {
        var category = (tag && tag.id) || '';
        var r = await cursorPage('sheets', category, page, function (lastId) {
            return request('/PlaylistSquare/GetPlaylists', {
                category: category,
                lastId: lastId,
                limit: '10',
            }).then(function (d) {
                var list = (d && d.list) || [];
                var sheets = [];
                for (var i = 0; i < list.length; i++) {
                    var it = list[i];
                    var sheet = {
                        id: String(it.playlist_id),
                        title: it.playlist_name || ('歌单 ' + it.playlist_id),
                        worksNum: it.music_num || undefined,
                        // 歌单主人的 uid：详情接口(GetPlaylistV2)需要，缓存备用
                        _uid: it.uid !== undefined && it.uid !== null ? String(it.uid) : undefined,
                    };
                    if (it.cover) sheet.artwork = it.cover;
                    sheets.push(sheet);
                }
                return { rows: sheets, lastId: d && d.last_id };
            });
        });
        return {
            isEnd: !r.lastId || r.rows.length === 0,
            data: r.rows,
        };
    },

    /** 歌单详情：上游 PlaylistV2 实测 code=2（含 owner uid 组合），如实抛错 */
    async getMusicSheetInfo(sheetItem, page) {
        var data = await request('/PlaylistV2/GetPlaylistMusics', {
            playlist_id: String(sheetItem.id),
            uid: String(sheetItem._uid || ''),
            last_id: page > 1 ? String((sheetItem._lastId || '')) : '',
            limit: '20',
        }).then(function (d) {
            var list = (d && d.list) || (d && d.music_list && d.music_list.rows) || [];
            return { list: list, lastId: d && d.last_id };
        }).catch(function (e) {
            throw new Error('快音歌单详情暂不可用（上游 PlaylistV2 接口参数校验失败，平台已知限制）: ' + e.message);
        });
        var musicList = mapMusicList(data.list);
        return {
            isEnd: !data.lastId || musicList.length === 0,
            musicList: musicList,
            sheetItem: page === 1 ? { worksNum: musicList.length } : undefined,
        };
    },

    /** 歌手作品（/Singer/GetSingerMusicList 返回 {list,last_id}，注意与 music_list 区分） */
    async getArtistWorks(artistItem, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        var singerId = artistItem && artistItem.id ? String(artistItem.id) : '';
        if (!singerId && artistItem && artistItem.name) {
            // 歌曲条目不携带 singer_id：按歌手名在歌手列表中定位（有界扫描，最多 2 页）
            singerId = await resolveSingerIdByName(artistItem.name);
            if (!singerId) throw new Error('快音: 未在歌手列表中找到「' + artistItem.name + '」');
        }
        if (!singerId) throw new Error('快音: 缺少歌手标识');
        var r = await cursorPage('artist', singerId, page, function (lastId) {
            return request('/Singer/GetSingerMusicList', {
                singer_id: singerId,
                last_id: lastId,
                limit: '20',
            }).then(function (d) {
                return { rows: (d && d.list) || [], lastId: d && d.last_id };
            });
        });
        var list = mapMusicList(r.rows);
        return {
            isEnd: (!r.lastId && list.length < 20) || list.length === 0,
            data: list,
        };
    },

    /** 导入单曲：识别 16 位 code 或含 code 的文本 */
    async importMusicItem(urlLike) {
        var m = String(urlLike || '').match(/([0-9a-fA-F]{16})/);
        if (!m) throw new Error('无法识别的链接/编号：未找到快音歌曲 code（16 位标识）');
        var data = await request('/music/detail', { music_code: m[1] });
        var raw = (data && data.music_list && data.music_list[0]) || null;
        if (!raw || !raw.code) throw new Error('快音: 未找到该歌曲（code=' + m[1] + '）');
        return mapMusicItem(raw);
    },

    /** 导入歌单：依赖 PlaylistV2（上游 code=2 已知限制），如实报错 */
    async importMusicSheet(urlLike) {
        var m = String(urlLike || '').match(/(\d{3,})/);
        if (!m) throw new Error('无法识别的歌单编号');
        var data = await request('/PlaylistV2/GetPlaylistMusics', {
            playlist_id: m[1],
            uid: '',
            last_id: '',
            limit: '20',
        }).catch(function (e) {
            throw new Error('快音歌单导入暂不可用（上游 PlaylistV2 接口参数校验失败，平台已知限制）');
        });
        var list = (data && data.list) || [];
        return mapMusicList(list);
    },

    /** 歌曲评论 */
    async getMusicComments(musicItem, page) {
        var size = 10;
        var data = await request('/comment/list', {
            music_code: musicItem.id,
            type: '0',
            p: String(page),
            size: String(size),
        });
        var rows = (data && data.rows) || [];
        var comments = [];
        for (var i = 0; i < rows.length; i++) {
            var c = rows[i];
            var u = c.user_info || {};
            comments.push({
                id: String(c.id),
                nickName: u.nickname || '匿名用户',
                avatar: u.avatar_url || undefined,
                comment: c.contents || '',
                like: c.praise_num ? Number(c.praise_num) || 0 : 0,
                createAt: c.create_time ? Number(c.create_time) * 1000 : undefined,
            });
        }
        var isEnd;
        if (data && data.total_page !== undefined && data.total_page !== null) {
            isEnd = page >= Number(data.total_page);
        } else {
            isEnd = rows.length < size;
        }
        return { isEnd: isEnd, data: comments };
    },

    // ===== 内部导出（仅供测试/质检，非宿主协议） =====
    _internal: {
        signParams: signParams,
        postRaw: postRaw,
        request: request,
        getTouristToken: getTouristToken,
        mapMusicItem: mapMusicItem,
        mapMusicList: mapMusicList,
        BASE_URL: BASE_URL,
        DEVICE_ID: DEVICE_ID,
        SIGN_KEY: SIGN_KEY,
    },
};

// ===== 内部辅助：歌手名定位（有界） =====
function resolveSingerIdByName(name) {
    return request('/Singer/GetSingerList', { last_id: '', limit: '50' }).then(function (d1) {
        var list = (d1 && d1.list) || [];
        var hit = findSinger(list, name);
        if (hit) return String(hit.id);
        var lastId = d1 && d1.last_id;
        if (!lastId) return '';
        return request('/Singer/GetSingerList', { last_id: String(lastId), limit: '50' }).then(function (d2) {
            var list2 = (d2 && d2.list) || [];
            var hit2 = findSinger(list2, name);
            return hit2 ? String(hit2.id) : '';
        });
    });
}

function findSinger(list, name) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].name === name) return list[i];
    }
    return null;
}
