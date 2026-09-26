// ============================================================
// MusicFree 插件：网易云电台（neteaseradio）
// 数据来源：music.163.com 官方接口（weapi 加密链）
// 移植基础：GuGuMur/MusicFreePlugin-NeteaseRadio（MIT License,
//   Copyright (c) 2023 猫头猫 & 咕咕mur）+ 本仓修复，见 changelog。
//
// changelog v1.0.0（相对上游 0.0.2 的修复）：
//   1. getAlbumInfo isEnd 修复：上游 `res.programs <= page*pageSize`
//      是数组与数字比较（恒 false），改为 `res.count <= page*pageSize`。
//   2. 搜索 isEnd 修复：上游用 result.albumCount，实测响应无该字段，
//      改用实测存在的 result.djRadiosCount。
//   3. getLyric 修复：上游 weapi POST /api/dj/program/detail 实测
//      400 参数错误（接口已不可用），改用官方 /api/song/lyric
//      （免费免登录，本仓网易源插件生产在用）；电台节目多无歌词，
//      无则如实返回空。
//   4. 主播搜索不再逐个 N+1 请求 worksNum（去掉 byuser 循环）。
//   5. 封面 http→https 规范化（p1-p4.music.126.net 支持 https）。
// ============================================================
var axios = require('axios');
var CryptoJs = require('crypto-js');
var qs = require('qs');
var bigInt = require('big-integer');

var HEADERS = {
    authority: 'music.163.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36',
    'content-type': 'application/x-www-form-urlencoded',
    accept: '*/*',
    origin: 'https://music.163.com',
    referer: 'https://music.163.com/',
    'accept-language': 'zh-CN,zh;q=0.9',
};

var PAGE_SIZE = 30;

// ---------- weapi 加密链（与官方一致：AES-CBC 双重加密 + RSA NoPadding） ----------
function random16() {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var s = '';
    for (var i = 0; i < 16; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}

function aesEncrypt(text, key) {
    return CryptoJs.AES.encrypt(
        CryptoJs.enc.Utf8.parse(text),
        CryptoJs.enc.Utf8.parse(key),
        { iv: CryptoJs.enc.Utf8.parse('0102030405060708'), mode: CryptoJs.mode.CBC }
    ).toString();
}

function rsaEncrypt(text) {
    var reversed = text.split('').reverse().join('');
    var hex = '';
    for (var i = 0; i < reversed.length; i++) {
        hex += reversed.charCodeAt(i).toString(16);
    }
    var pubKey = '010001';
    var modulus =
        '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
    var res = bigInt(hex, 16).modPow(bigInt(pubKey, 16), bigInt(modulus, 16)).toString(16);
    while (res.length < 256) {
        res = '0' + res;
    }
    return res;
}

function getParamsAndEnc(text) {
    var secret = random16();
    return {
        params: aesEncrypt(aesEncrypt(text, '0CoJUm6Qyw8W8jud'), secret),
        encSecKey: rsaEncrypt(secret),
    };
}

function weapiPost(url, payload) {
    var body = qs.stringify(getParamsAndEnc(JSON.stringify(payload)));
    return axios({
        method: 'post',
        url: url,
        headers: HEADERS,
        data: body,
        timeout: 10000,
    }).then(function (r) { return r.data; });
}

// ---------- 工具 ----------
function httpsPic(url) {
    if (url && url.indexOf('http://') === 0) {
        return 'https://' + url.slice(7);
    }
    return url;
}

function musicCanPlayFilter(program) {
    // feeScope 0/8 为免费可播节目，其余（VIP/数字专辑）过滤
    return program.feeScope === 0 || program.feeScope === 8;
}

function formatMusicItem(program) {
    var mainSong = program.mainSong || {};
    var artistName = (mainSong.artists && mainSong.artists[0] && mainSong.artists[0].name) || '';
    return {
        id: mainSong.id,
        artwork: httpsPic(program.coverUrl),
        title: mainSong.name,
        artist: artistName || (program.dj && program.dj.nickname) || '网易电台',
        album: program.radio && program.radio.name,
        duration: mainSong.duration,
        qualities: {
            standard: { size: (mainSong.lMusic || {}).size },
        },
    };
}

function formatAlbumItem(radio) {
    return {
        id: radio.id,
        artist: radio.dj && radio.dj.nickname,
        title: radio.name,
        artwork: httpsPic(radio.picUrl),
        description: radio.desc,
    };
}

// ---------- 接口实现 ----------
function searchBase(query, page, type) {
    return weapiPost('https://music.163.com/weapi/search/get', {
        s: query,
        limit: PAGE_SIZE,
        type: type,
        offset: (page - 1) * PAGE_SIZE,
        csrf_token: '',
    });
}

function searchAlbum(query, page) {
    // 已知边界：网易 1009 电台搜索最多返回前 30 条（实测 offset=30 起返回空、
    // result 为空对象），第 1 页即 isEnd，宿主不会继续翻页——如实上报
    return searchBase(query, page, 1009).then(function (res) {
        var radios = (res.result && res.result.djRadios) || [];
        var total = (res.result && res.result.djRadiosCount) || radios.length;
        return {
            isEnd: total <= page * PAGE_SIZE,
            data: radios.map(formatAlbumItem),
        };
    });
}

function searchArtist(query, page) {
    return searchBase(query, page, 1002).then(function (res) {
        var users = (res.result && res.result.userprofiles) || [];
        return {
            isEnd: users.length < PAGE_SIZE,
            data: users.map(function (u) {
                return {
                    id: u.userId,
                    name: u.nickname,
                    avatar: httpsPic(u.avatarUrl),
                };
            }),
        };
    });
}

function searchUserRadio(uid) {
    return weapiPost('https://music.163.com/weapi/djradio/get/byuser', {
        userId: uid,
        csrf_token: '',
    });
}

function getAlbumInfoImpl(albumItem, page) {
    return weapiPost('https://music.163.com/weapi/dj/program/byradio', {
        radioId: albumItem.id,
        csrf_token: '',
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
    }).then(function (res) {
        var programs = res.programs || [];
        var total = res.count || 0;
        return {
            isEnd: total <= page * PAGE_SIZE,
            musicList: programs.filter(musicCanPlayFilter).map(formatMusicItem),
        };
    });
}

module.exports = {
    platform: 'neteaseradio',
    version: '1.0.0',
    author: '研发2号',
    description:
        '网易云音乐电台/播客：搜索电台与主播、浏览节目列表并播放（基于 GuGuMur MIT 版修复移植）',
    srcUrl: 'https://hebijunge.github.io/musicfree-plugins/plugins/neteaseradio-source.plugin.v1.0.0.js',
    cacheControl: 'no-store',
    supportedSearchType: ['album', 'artist'],

    search: function (query, page, type) {
        if (type === 'album') {
            return searchAlbum(query, page);
        }
        if (type === 'artist') {
            return searchArtist(query, page);
        }
        return Promise.resolve({ isEnd: true, data: [] });
    },

    getAlbumInfo: function (albumItem, page) {
        return getAlbumInfoImpl(albumItem, page);
    },

    getMusicSheetInfo: function (sheetItem, page) {
        return getAlbumInfoImpl(sheetItem, page).then(function (r) {
            r.sheetItem = sheetItem;
            return r;
        });
    },

    getArtistWorks: function (artistItem, page, type) {
        if (type === 'album') {
            return searchUserRadio(artistItem.id).then(function (res) {
                var radios = res.djRadios || [];
                return {
                    isEnd: true,
                    data: radios.map(formatAlbumItem),
                };
            });
        }
        return Promise.resolve({ isEnd: true, data: [] });
    },

    getLyric: function (musicItem) {
        return axios
            .get('https://music.163.com/api/song/lyric', {
                params: { id: musicItem.id, lv: -1, tv: -1 },
                headers: HEADERS,
                timeout: 10000,
            })
            .then(function (r) {
                var lrc = (r.data && r.data.lrc && r.data.lrc.lyric) || '';
                return { rawLrc: lrc };
            });
    },

    getMediaSource: function (musicItem, quality) {
        // 电台节目仅 standard（128k mp3）一档，outer/url 302 到官方 CDN
        return Promise.resolve({
            url: 'https://music.163.com/song/media/outer/url?id=' + musicItem.id + '.mp3',
            quality: 'standard',
        });
    },
};
