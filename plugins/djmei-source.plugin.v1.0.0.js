// 魅力DJ (djmei.com) - MusicFree Plugin v1.0.0
// 纯 JSON API, 无需登录/签名
// 搜索: POST /api/Song.php?enews=search  keyboard=xxx&page=0
// 列表: GET /api/Song.php?enews=SongList&classid=X&page=Y&orderby=new|click
// 播放: POST /api/play.php  a=play&q={id}&n=0 → downpath 拼域名
// page: API 从0开始, 插件从1开始, 已转换

const axios = require('axios');

const SITE = 'https://www.djmei.com';
const API = SITE + '/api';
const UA = 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';

function itemsFromSongList(songList) {
    if (!songList) return [];
    const arr = Array.isArray(songList) ? songList : Object.values(songList);
    return arr.map(item => ({
        id: String(item.id),
        title: item.title || '未知',
        artist: '魅力DJ',
        artwork: item.titlepic ? SITE + item.titlepic : undefined,
        album: item.classid ? ('分类' + item.classid) : undefined
    }));
}

module.exports = {
    cacheControl: 'no-cache',
    name: '魅力DJ',
    platform: '魅力DJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: '魅力DJ网 - 320kbps MP3直链/免登录/搜索/分类',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/djmei-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const p = (page || 1) - 1; // API page 从0开始
        const res = await axios.post(API + '/Song.php?enews=search',
            `keyboard=${encodeURIComponent(query)}&page=${p}`,
            { headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const data = itemsFromSongList(res.data.SongList);
        return { isEnd: !res.data.showmore, data };
    },

    async getTopLists() {
        return [
            { title: '分类', data: [
                { id: '2', title: '中文DJ单曲' },
                { id: '1', title: '舞曲串烧' },
                { id: '10', title: '专辑套曲' }
            ]},
            { title: '排序', data: [
                { id: '2_new', title: '单曲最新' },
                { id: '2_click', title: '单曲最热' },
                { id: '1_new', title: '串烧最新' },
                { id: '1_click', title: '串烧最热' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const p = (page || 1) - 1;
        let classid = topListItem.id, orderby = '';
        if (topListItem.id.includes('_')) {
            const parts = topListItem.id.split('_');
            classid = parts[0];
            orderby = parts[1] === 'click' ? 'click' : 'new';
        }
        const res = await axios.get(API + '/Song.php', {
            params: { enews: 'SongList', classid, page: p, orderby },
            headers: { 'User-Agent': UA }
        });
        const data = itemsFromSongList(res.data.SongList);
        return { isEnd: !res.data.showmore, musicList: data, topListItem };
    },

    async getMediaSource(musicItem, quality) {
        const res = await axios.post(API + '/play.php',
            `a=play&q=${musicItem.id}&n=0`,
            { headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        if (!res.data.downpath) throw new Error('未获取到播放地址');
        return { url: SITE + res.data.downpath };
    },

    async getLyric(musicItem) {
        throw new Error('该音源暂无歌词');
    }
};
