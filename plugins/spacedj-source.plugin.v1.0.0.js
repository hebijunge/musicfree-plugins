// SpaceDJ音乐网 - MusicFree Plugin v1.0.0
// 搜索: /search?keywords={kw}&type=single
// 列表: /music/single?page={p}
// 解析: Add_Single_TPList('title','poster','artist','bpm','key','url','id','token')

const axios = require('axios');

module.exports = {
    platform: 'SpaceDJ',
    version: '1.0.0',
    author: 'hebijunge',
    description: 'SpaceDJ音乐网 - 电子音乐平台，列表页直出试听URL',
    srcUrl: 'https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins/spacedj-source.plugin.v1.0.0.js',
    supportedSearchType: ['music'],

    _parseList(html) {
        const data = [];
        const re = /Add_Single_TPList\(([\s\S]*?)\)/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const args = m[1].match(/'([^']*)'/g);
            if (!args || args.length < 8) continue;
            const title = args[0].replace(/^'|'$/g, '').trim();
            const poster = args[1].replace(/^'|'$/g, '');
            const artist = args[2].replace(/^'|'$/g, '').trim();
            const url = args[5].replace(/^'|'$/g, '');
            const id = args[6].replace(/^'|'$/g, '');
            if (!id || !url) continue;
            data.push({ id, title, artist, artwork: poster, _url: url });
        }
        return data;
    },

    async search(query, page, type) {
        if (type !== 'music') return { isEnd: true, data: [] };
        const res = await axios.get('https://www.spacedj.cn/search', {
            params: { keywords: query, type: 'single', page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = this._parseList(res.data);
        return { isEnd: data.length < 20, data };
    },

    async getMediaSource(musicItem, quality) {
        if (musicItem._url) return { url: musicItem._url, headers: { 'Referer': 'https://www.spacedj.cn/' } };
        throw new Error('无试听链接');
    },

    async getLyric() { return { rawLrc: '' }; },

    async getTopLists() {
        return [
            { title: 'SpaceDJ', data: [
                { id: 'single', title: '单曲列表' },
                { id: 'cycle', title: '套曲列表' }
            ]}
        ];
    },

    async getTopListDetail(topListItem, page) {
        const res = await axios.get('https://www.spacedj.cn/music/' + topListItem.id, {
            params: { page: page || 1 },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = this._parseList(res.data);
        return { isEnd: data.length < 20, musicList: data };
    }
};
