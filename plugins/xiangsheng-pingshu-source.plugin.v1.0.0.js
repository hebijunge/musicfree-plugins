/**
 * 相声评书（xsmp3.com 相声随身听 + psmp3.com 评书随身听）MusicFree 插件
 * version 1.0.0
 *
 * changelog:
 * - v1.0.0 初始版本：
 *   - 同一引擎双源：www.xsmp3.com（相声）+ www.psmp3.com（评书），
 *     排行榜分类入口（相声 14 类 / 评书 7 类）、搜索、专辑详情（全集分集列表）、单曲导入。
 *   - 取链：专辑详情页 JS 变量 `audio: [...]` 提取分集直链（//audio.xsmp3.com / //audio.psmp3.com），
 *     防盗链实测要求 UA + Referer 双带（缺任一返回 403），getMediaSource 返回 headers 透传。
 *   - 音质：源为单档 mp3 直链，按实际提供处理，所有音质请求返回同一直链（宁低勿高，不虚标）。
 *
 * 取链依据（2026-09-26 实测，沙箱数据中心 IP）：
 *   - 专辑页 https://www.xsmp3.com/gdg-yq/gdg-yq-1.html 内嵌
 *     `audio: [{name: "001《爱情时代》", artist: "郭德纲 于谦", url: "//audio.xsmp3.com/55/1/ABUI..."}...]`
 *   - 直链 UA+Referer 双带 → 200 audio/mpeg（实测 xsmp3 单集约 6.9MB 起）；仅 UA 或仅 Referer → 403。
 *   - 分类列表页 /{分类}/{页码}.html，#post_list_box li 条目，.pagelist class="next" 判断末页。
 *   - 搜索页 /so/{关键词}_{页码}.html 在沙箱数据中心 IP 被 Cloudflare 拦截（403），
 *     真机（住宅/移动网络）待验；解析逻辑与列表页同构。
 */

var axios = require('axios');
var cheerio = require('cheerio');

var UA =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

/** 双源定义：同一引擎（Z-BlogPHP + APlayer），仅 host 与分类不同 */
var SOURCES = {
    xs: {
        tag: 'xs',
        siteName: '相声随身听',
        host: 'https://www.xsmp3.com',
        referer: 'https://www.xsmp3.com/',
        categories: [
            { id: 'gdg', title: '郭德纲' },
            { id: 'dys', title: '德云社' },
            { id: 'xsxsl', title: '相声新势力' },
            { id: 'qqs', title: '青曲社' },
            { id: 'msl', title: '马三立' },
            { id: 'hbl', title: '侯宝林' },
            { id: 'lbr', title: '刘宝瑞' },
            { id: 'mj', title: '马季' },
            { id: 'hyw', title: '侯耀文' },
            { id: 'ssj', title: '师胜杰' },
            { id: 'jk', title: '姜昆' },
            { id: 'mzm', title: '马志明' },
            { id: 'swm', title: '苏文茂' },
            { id: 'gyp', title: '高英培' },
        ],
    },
    ps: {
        tag: 'ps',
        siteName: '评书随身听',
        host: 'https://www.psmp3.com',
        referer: 'https://www.psmp3.com/',
        categories: [
            { id: 'ykc', title: '袁阔成' },
            { id: 'stf', title: '单田芳' },
            { id: 'tly', title: '田连元' },
            { id: 'llf', title: '刘兰芳' },
            { id: 'llr', title: '连丽如' },
            { id: 'zsz', title: '张少佐' },
            { id: 'tzy', title: '田战义' },
        ],
    },
};

/** 取页面 HTML；失败如实抛错 */
async function fetchPage(url, referer) {
    var res = await axios.get(url, {
        timeout: 10000,
        headers: {
            'User-Agent': UA,
            Referer: referer,
        },
    });
    if (typeof res.data !== 'string' || !res.data) {
        throw new Error('页面返回为空: ' + url);
    }
    return res.data;
}

/**
 * 解析专辑详情页内嵌的 `audio: [...]` JS 字面量（无引号键名 + 尾逗号，不能 JSON.parse）。
 * 页面实态：`audio: [{name: "...", artist: "...", url: "//audio.xsmp3.com/...", cover: "..."},]});`
 */
function parseAudioTracks(html, src, albumTitle) {
    var key = 'audio: ';
    var i = html.indexOf(key);
    if (i < 0) {
        throw new Error('页面结构已变化：详情页未找到 audio 变量（' + src.siteName + '）');
    }
    var seg = html.slice(i + key.length);
    var end = seg.indexOf('})');
    if (end < 0) {
        throw new Error('页面结构已变化：audio 变量未正常闭合（' + src.siteName + '）');
    }
    var raw = seg.slice(0, end + 1);

    var tracks = [];
    var blockRe = /\{[^{}]*\}/g;
    var m;
    while ((m = blockRe.exec(raw)) !== null) {
        var block = m[0];
        var name = /name:\s*"([^"]*)"/.exec(block);
        var url = /url:\s*"([^"]*)"/.exec(block);
        var artist = /artist:\s*"([^"]*)"/.exec(block);
        var cover = /cover:\s*"([^"]*)"/.exec(block);
        if (!name || !url || !url[1]) {
            continue; // 缺名或缺链的脏条目跳过
        }
        tracks.push({
            id: src.tag + '|' + url[1],
            title: name[1],
            artist: (artist && artist[1]) || src.siteName,
            album: albumTitle || src.siteName,
            artwork: (cover && cover[1]) || undefined,
            _src: src.tag,
            _kind: 'track',
            _url: url[1].indexOf('//') === 0 ? 'https:' + url[1] : url[1],
        });
    }
    if (!tracks.length) {
        throw new Error('页面结构已变化：audio 变量解析出 0 个分集（' + src.siteName + '）');
    }
    return tracks;
}

/** 解析列表页（分类页/搜索页共用的 #post_list_box 结构）→ 专辑级条目 */
function parseAlbumList(html, src) {
    var $ = cheerio.load(html);
    var items = [];
    $('#post_list_box').find('li').each(function () {
        var li = $(this);
        var a = li.find('h2').find('a').first();
        var href = a.attr('href');
        var title = a.text().trim();
        if (!href || !title) {
            return;
        }
        var artist = li.find('.fenli').find('a').first().text().trim() || src.siteName;
        var img = li.find('img').first().attr('src');
        items.push({
            id: src.tag + '|' + href.replace(src.host, ''),
            title: title,
            artist: artist,
            album: src.siteName,
            artwork: img && img.indexOf('//') === 0 ? 'https:' + img : img,
            _src: src.tag,
            _kind: 'album',
            _path: href.indexOf('http') === 0 ? href.replace(src.host, '') : href,
        });
    });
    return items;
}

/** 列表页是否还有下一页（.pagelist 内 class="next" 链接） */
function hasNextPage(html) {
    return /class="next"/.test(html);
}

function getSource(tag) {
    var src = SOURCES[tag];
    if (!src) {
        throw new Error('未知音源: ' + tag);
    }
    return src;
}

/** 从专辑级条目取分集列表（并兜底解析专辑页标题） */
async function loadAlbumTracks(albumItem) {
    var src = getSource(albumItem._src);
    var html = await fetchPage(src.host + albumItem._path, src.referer);
    var albumTitle = albumItem.title;
    var h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (h1) {
        var t = h1[1].replace(/<[^>]*>/g, '').trim();
        if (t) {
            albumTitle = t;
        }
    }
    return parseAudioTracks(html, src, albumTitle);
}

module.exports = {
    platform: '相声评书',
    version: '1.0.0',
    author: '音流研发',
    description:
        '相声/评书随身听双源（www.xsmp3.com 相声 + www.psmp3.com 评书）：分类榜单、搜索、专辑全集分集播放；单档 mp3 直链，播放需 UA+Referer 防盗链（headers 已随链接返回）。',
    srcUrl:
        'https://hebijunge.github.io/musicfree-plugins/plugins/xiangsheng-pingshu-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],
    cacheControl: 'no-cache',

    hints: {
        importMusicItem: [
            '支持粘贴专辑页链接，例如：',
            'https://www.xsmp3.com/gdg-yq/gdg-yq-1.html',
            'https://www.psmp3.com/stf-styy/styy-1.html',
        ],
    },

    /**
     * 搜索：双源 /so/{kw}_{page}.html 结果合并。
     * 注：该路径在数据中心 IP 被 Cloudflare 拦截（403），住宅网络预期可用；
     * 单源失败时用另一源结果兜底，双源均失败才抛错。
     */
    async search(query, page, type) {
        if (type !== 'music') {
            return { isEnd: true, data: [] };
        }
        if (!query || !query.trim()) {
            return { isEnd: true, data: [] };
        }
        var kw = encodeURIComponent(query.trim());
        var that = this;

        async function searchOne(tag) {
            var src = getSource(tag);
            var html = await fetchPage(src.host + '/so/' + kw + '_' + page + '.html', src.referer);
            return {
                data: parseAlbumList(html, src),
                next: hasNextPage(html),
            };
        }

        var results = await Promise.all([
            searchOne('xs').catch(function (e) {
                return { error: e };
            }),
            searchOne('ps').catch(function (e) {
                return { error: e };
            }),
        ]);
        if (results[0].error && results[1].error) {
            throw new Error(
                '搜索源均不可用（相声: ' +
                    results[0].error.message +
                    '；评书: ' +
                    results[1].error.message +
                    '）'
            );
        }
        var data = [];
        var anyNext = false;
        results.forEach(function (r) {
            if (r.error) {
                return; // 单源失败不拖垮整体
            }
            data = data.concat(r.data);
            if (r.next) {
                anyNext = true;
            }
        });
        return { isEnd: !anyNext, data: data };
    },

    /** 排行榜入口 = 两站分类（相声 14 类 + 评书 7 类） */
    async getTopLists() {
        return [
            {
                title: '相声随身听 · 分类',
                data: SOURCES.xs.categories.map(function (c) {
                    return { id: 'xs:' + c.id, title: c.title };
                }),
            },
            {
                title: '评书随身听 · 分类',
                data: SOURCES.ps.categories.map(function (c) {
                    return { id: 'ps:' + c.id, title: c.title };
                }),
            },
        ];
    },

    /** 分类详情：/{分类}/{页码}.html → 专辑列表（专辑级条目，点进专辑看全集分集） */
    async getTopListDetail(topListItem, page) {
        var parts = String(topListItem.id).split(':');
        var tag = parts[0];
        var cateId = parts[1];
        var src = getSource(tag);
        var html = await fetchPage(src.host + '/' + cateId + '/' + page + '.html', src.referer);
        var data = parseAlbumList(html, src);
        return {
            isEnd: !hasNextPage(html),
            musicList: data,
        };
    },

    /** 专辑详情：解析 audio: 变量 → 全集分集列表 */
    async getAlbumInfo(albumItem) {
        if (albumItem._kind === 'track' && albumItem._url) {
            // 分集条目没有"专辑详情"概念，返回自身
            return { isEnd: true, musicList: [albumItem] };
        }
        var tracks = await loadAlbumTracks(albumItem);
        return {
            isEnd: true,
            musicList: tracks,
            albumItem: {
                title: (tracks[0] && tracks[0].album) || albumItem.title,
                artist: albumItem.artist,
                artwork: albumItem.artwork,
            },
        };
    },

    /**
     * 取播放链：分集直链 + 防盗链 headers（UA + Referer 双带，实测缺一即 403）。
     * 音质：源为单档 mp3 直链，按实际提供处理——任何 quality 都返回同一直链，不虚标。
     */
    async getMediaSource(musicItem, quality) {
        var item = musicItem;
        if (!item._url) {
            // 专辑级条目（搜索/榜单直接点播）：取专辑第一集
            var tracks = await loadAlbumTracks(item);
            item = tracks[0];
        }
        var src = getSource(item._src);
        var url = item._url;
        if (!url) {
            throw new Error('无法获取播放链接：条目缺少直链信息');
        }
        if (url.indexOf('//') === 0) {
            url = 'https:' + url;
        }
        return {
            url: url,
            headers: {
                'User-Agent': UA,
                Referer: src.referer,
            },
        };
    },

    /** 单曲/专辑导入：识别 xsmp3.com / psmp3.com 的专辑页链接 */
    async importMusicItem(urlLike) {
        var url = String(urlLike || '').trim();
        var m = /https?:\/\/www\.(xsmp3|psmp3)\.com\/([a-z][a-z0-9-]*\/[a-z][a-z0-9-]*-\d+\.html)/.exec(
            url
        );
        if (!m) {
            throw new Error('无法识别的链接：请粘贴 xsmp3.com / psmp3.com 的专辑页链接');
        }
        var tag = m[1] === 'xsmp3' ? 'xs' : 'ps';
        var src = getSource(tag);
        var path = '/' + m[2];
        var html = await fetchPage(src.host + path, src.referer);
        var h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
        var title = h1 ? h1[1].replace(/<[^>]*>/g, '').trim() : '';
        return {
            id: tag + '|' + path,
            title: title || src.siteName,
            artist: src.siteName,
            album: src.siteName,
            _src: tag,
            _kind: 'album',
            _path: path,
        };
    },
};
