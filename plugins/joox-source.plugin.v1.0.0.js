/**
 * JOOX 音乐独立源插件 v1.0.0
 *
 * 变更记录：
 *   v1.0.0（2026-09-26）：首发版。双通道架构——
 *     主通道：gdstudio 公共聚合 API（music-api.gdstudio.xyz/api.php，source=joox）
 *       - search/url/lyric 三端点；joox 源实测仅 br=128（MP3）与 br=999（FLAC 无损，
 *         含 24bit/48kHz 母带）两档有效，192/320/740 返回 br:-1（2026-09-26 逐档实测）；
 *       - VIP 曲目可取全曲（周杰伦《告白氣球》47MB FLAC / 林俊杰《不為誰而作的歌》
 *         31.4MB FLAC 头尾分段实测，2026-09-26）——该中转无会员墙，如实标注不虚报来源；
 *       - 限速 50 次/5 分钟（官方声明），超限返回 429/503，走备源接力。
 *     备源：JOOX 官方直连（协议吸收自《JOOX音乐接口完整文档（综合实测版）》，仅取
 *       接口协议事实、代码自行实现）
 *       - 搜索 cache.api.joox.com/openjoox/v3/search（固定 Cookie + X-Forwarded-For）；
 *       - 取链单曲页 __NEXT_DATA__ → passingArgumentsData（web_get_songinfo 已下线 404）；
 *         免费歌（vip_flag=0）refrain_url 为完整 MP3；VIP（vip_flag=1）仅 30s M4A 官方
 *         试听（error_code=9009002），返回时以 actualQuality + hint 如实标注「官方试听
 *         片段」，不做任何付费绕过；
 *         ⚠️ 实测边界（2026-09-26）：官方备源为尽力而为——部分免费歌页面未内嵌播放地址
 *         （refrain_url/play_url_list 均空，约占免费搜索结果半数），此时备源无直链、如实
 *         报错，不伪造；有内嵌直链的免费歌验证为完整 MP3（ak-hk.stream.music.joox.com）。
 *       - 歌词官方 web_lyric（JSONP 剥壳 + Base64）降级。
 *     边界：音质档 joox 仅两档有效，菜单 standard/high/super 三档中 high/super 实际
 *       同为 999 无损（actualQuality 如实回传）；中文关键词搜索结果多为 VIP 曲目（官方
 *       直连形态下仅 30s 试听），主通道无此限制。
 *
 * 依赖：axios（宿主环境提供）
 */

(function () {
  var axios = require('axios'); // 对齐仓库既有插件惯例（宿主 Node 环境可 require；沙箱测试环境经 NODE_PATH 解析）
  var VERSION = '1.0.0';
  var HOST = 'https://music-api.gdstudio.xyz/api.php';
  var TIMEOUT = 8000;

  var JX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
  // 官方直连固定形态（文档第 2 节：免登录固定 Cookie + 伪装 IP，仅备源使用）
  var JX_COOKIE = 'wmid=142420656; user_type=1; country=id; session_key=2a5d97d05dc8fe238150184eaf3519ad;';
  var JX_XFF = '36.73.34.109';

  var GD_COOL_MS = 60000;      // 主通道冷却：命中 429/503 后的降级窗口
  var gdCoolUntil = 0;         // 时间戳（ms）

  // 音质映射：joox 仅 128/999 两档有效（实测 192/320/740 → br:-1）。
  // standard→128；high/super→999（无损，actualQuality 如实回传）。
  var BR_MAP = { standard: '128', high: '999', super: '999' };

  function str(v) { return v === undefined || v === null ? '' : String(v); }

  // ==================== ID 规范化（文档 7.1） ====================
  // joox id 含 %/+/= 等：输入侧解一层面板转义；出参侧 encodeURIComponent。
  // 注意 + 是合法 id 字符，不做空格转换。
  function normalizeJooxId(raw) {
    var s = str(raw).trim();
    if (s.indexOf('%') >= 0) { try { s = decodeURIComponent(s); } catch (e) { /* 保留原样 */ } }
    return s;
  }

  // ==================== 主通道：gdstudio ====================
  function gdGet(params, timeoutMs) {
    if (Date.now() < gdCoolUntil) return Promise.reject(new Error('joox gdstudio cooling down'));
    return axios.get(HOST, {
      params: params,
      timeout: timeoutMs || TIMEOUT,
      headers: { 'User-Agent': JX_UA }
    }).then(function (res) {
      var ct = str(res.headers && res.headers['content-type']);
      if (ct.indexOf('text/html') >= 0) {
        // 503 Cloudflare 挑战页会带 text/html——按主通道故障处理，接力备源
        gdCoolUntil = Date.now() + GD_COOL_MS;
        throw new Error('joox gdstudio challenge page (rate limited)');
      }
      return res.data;
    }).catch(function (e) {
      var st = e && e.response && e.response.status;
      if (st === 429 || st === 503) gdCoolUntil = Date.now() + GD_COOL_MS;
      throw e;
    });
  }

  function gdSearch(keyword, page) {
    return gdGet({
      types: 'search', source: 'joox',
      name: str(keyword), count: 30, pages: page || 1
    }).then(function (d) {
      var list = Array.isArray(d) ? d : (d && d.data) || [];
      return list.map(function (t) {
        var artists = Array.isArray(t.artist) ? t.artist.join('/') : str(t.artist);
        return {
          id: normalizeJooxId(t.id),
          title: str(t.name),
          artist: artists || '未知歌手',
          album: str(t.album),
          duration: 0, // gdstudio search 不返回时长，取链时回填
          cover: '',   // pic 端点按需取（pic_id），列表页不逐一请求以免触发限速
          _src: { joox: { trackId: normalizeJooxId(t.id), picId: str(t.pic_id), lyricId: normalizeJooxId(t.lyric_id || t.id) } }
        };
      }).filter(function (m) { return m.id && m.title; });
    });
  }

  function gdUrl(trackId, quality) {
    return gdGet({
      types: 'url', source: 'joox',
      id: trackId, br: BR_MAP[quality] || '128'
    }).then(function (d) {
      if (!d || !d.url) throw new Error('joox gdstudio no url (br:' + (d && d.br) + ')');
      return {
        url: str(d.url),
        // br=999 → lossless（FLAC，含 24bit 母带可能）；br=128 → 128k
        quality: (d.br === 999 || d.br === '999') ? 'lossless' : ((d.br === 128 || d.br === '128') ? '128k' : (str(d.br) + 'k')),
        size: Number(d.size) || undefined
      };
    });
  }

  function gdLyric(lyricId) {
    return gdGet({ types: 'lyric', source: 'joox', id: lyricId }).then(function (d) {
      var lrc = d && (d.lyric || d.lrc);
      if (!lrc || str(lrc).length < 10) throw new Error('joox gdstudio no lyric');
      return str(lrc);
    });
  }

  // ==================== 备源：官方直连 ====================
  function jxHeaders() {
    return {
      'User-Agent': JX_UA,
      Cookie: JX_COOKIE,
      'X-Forwarded-For': JX_XFF,
      Referer: 'https://www.joox.com/'
    };
  }

  function jxSearch(keyword, page) {
    return axios.get('https://cache.api.joox.com/openjoox/v3/search', {
      params: { country: 'sg', lang: 'zh_cn', keyword: str(keyword) },
      timeout: TIMEOUT,
      headers: jxHeaders()
    }).then(function (res) {
      var out = [];
      var sections = (res.data && res.data.section_list) || [];
      for (var i = 0; i < sections.length; i++) {
        var items = sections[i].item_list || [];
        for (var j = 0; j < items.length; j++) {
          var songs = items[j].song || [];
          for (var k = 0; k < songs.length; k++) {
            var info = songs[k].song_info || {};
            if (!info.id) continue;
            out.push(jxBuildMusicItem(info));
          }
        }
      }
      // 官方搜索无翻页参数，page>1 视为已尽
      if ((page || 1) > 1) return [];
      return out;
    });
  }

  function jxBuildMusicItem(info) {
    var artists = (info.artist_list || []).map(function (a) { return str(a.name); }).filter(Boolean).join('/');
    var id = normalizeJooxId(info.id);
    return {
      id: id,
      title: str(info.name),
      artist: artists || '未知歌手',
      album: str(info.album_name),
      duration: Number(info.play_duration) || 0,
      cover: jxPickImage(info.images),
      _src: { joox: { trackId: id, vipFlag: Number(info.vip_flag) || 0 } }
    };
  }

  function jxPickImage(images) {
    var arr = images || [];
    var want = [300, 1000, 100];
    for (var w = 0; w < want.length; w++) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].width === want[w] && str(arr[i].url)) return arr[i].url;
      }
    }
    for (var n = 0; n < arr.length; n++) { if (str(arr[n].url)) return arr[n].url; }
    return '';
  }

  // 单曲页 __NEXT_DATA__ 解析（文档第 4 节；web_get_songinfo 已下线）
  function jxFetchSinglePage(trackId) {
    var url = 'https://www.joox.com/hk/single/' + encodeURIComponent(trackId);
    return axios.get(url, { timeout: TIMEOUT + 4000, headers: jxHeaders() }).then(function (res) {
      var html = str(res.data);
      var m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
      if (!m) throw new Error('joox __NEXT_DATA__ not found');
      var nd = JSON.parse(m[1]);
      var pp = (nd.props && nd.props.pageProps) || {};
      return pp.passingArgumentsData || {};
    });
  }

  // 官方直连取链：免费歌完整 MP3 / VIP 30s 试听（如实标注，不绕付费）
  // 判定依据（文档 4.5 + 2026-09-26 实测）：VIP → error_code=9009002 / (vip_flag=1 且
  // is_playable=false) / play_duration=30；⚠️ node_is_preview 免费歌也为 true（文档 4.5
  // 「True（但实际完整）」），不能作为试听判据。
  function jxResolve(pad) {
    var playList = Array.isArray(pad.play_url_list) ? pad.play_url_list : [];
    var refrain = str(pad.refrain_url).replace(/&amp;/g, '&');
    var vipLocked = pad.error_code === 9009002 ||
      (Number(pad.vip_flag) === 1 && pad.is_playable === false);
    var url = playList[0] || refrain;
    if (!url) throw new Error('joox official no url');
    return {
      url: url,
      quality: vipLocked ? '96k' : '128k',
      actualQuality: vipLocked ? '官方试听片段 30s（M4A，VIP 全曲未解锁）' : '128k（官方完整 MP3）',
      isVipTrial: vipLocked,
      duration: Number(pad.play_duration) || undefined
    };
  }

  // 官方歌词（JSONP 剥壳 + Base64；文档 5.1）
  function jxLyricApi(trackId) {
    var url = 'https://api.joox.com/web-fcgi-bin/web_lyric?musicid=' + encodeURIComponent(trackId) + '&country=sg&lang=zh_cn';
    return axios.get(url, { timeout: TIMEOUT, headers: jxHeaders() }).then(function (res) {
      var raw = str(res.data);
      var idx = raw.indexOf('MusicJsonCallback(');
      var body = idx >= 0 ? raw.slice(idx + 'MusicJsonCallback('.length) : raw;
      body = body.trim().replace(/\)\s*;?\s*$/, '');
      var data = JSON.parse(body);
      if (!data.lyric) throw new Error('joox official no lyric');
      var buf = Buffer.from(str(data.lyric), 'base64');
      var lrc = buf.toString('utf-8');
      if (lrc.length < 10) throw new Error('joox official lyric empty');
      return lrc;
    });
  }

  // ==================== 协议实现 ====================
  function searchImpl(keyword, page, type) {
    var p = page || 1;
    if (type === undefined) type = 'music';
    if (type !== 'music') return Promise.resolve({ isEnd: true, data: [] });
    // 主通道 → 空结果/限速时接力官方直连（page>1 官方视为已尽）
    return gdSearch(keyword, p).then(function (list) {
      if (list.length) return { isEnd: list.length < 30, data: list };
      return jxSearch(keyword, p).then(function (jlist) {
        return { isEnd: true, data: jlist };
      });
    }).catch(function () {
      return jxSearch(keyword, p).then(function (jlist) {
        return { isEnd: true, data: jlist };
      });
    });
  }

  function getMediaSourceImpl(musicItem, quality) {
    if (!musicItem || !musicItem._src || !musicItem._src.joox || !musicItem._src.joox.trackId) {
      return Promise.reject(new Error('joox: 条目无音源信息'));
    }
    var raw = musicItem._src.joox;
    var q = quality || 'standard';
    // 主通道 gdstudio → 备源官方直连（VIP 30s 试听如实标注）
    return gdUrl(raw.trackId, q).then(function (r) {
      return { url: r.url, quality: r.quality, actualQuality: r.quality, size: r.size };
    }).catch(function () {
      return jxFetchSinglePage(raw.trackId).then(function (pad) {
        var r = jxResolve(pad);
        return {
          url: r.url,
          quality: r.quality,
          actualQuality: r.actualQuality + '（gdstudio 主通道不可用，官方直连备源）',
          duration: r.duration
        };
      });
    });
  }

  // 歌词：主通道 gdstudio → 官方 web_lyric → null（不 throw，失败静默降级）
  function getLyricImpl(musicItem) {
    if (!musicItem || !musicItem._src || !musicItem._src.joox || !musicItem._src.joox.trackId) {
      return Promise.resolve(null);
    }
    var raw = musicItem._src.joox;
    var lyricId = raw.lyricId || raw.trackId;
    return gdLyric(lyricId).then(function (lrc) {
      return { rawLrc: lrc };
    }).catch(function () {
      return jxLyricApi(raw.trackId).then(function (lrc) {
        return { rawLrc: lrc };
      }).catch(function () {
        return null;
      });
    });
  }

  // 分享链接导入：https://www.joox.com/{region}/single/{id}（id 已 URL 编码）
  var SHEET_URL_RESOLVERS = {
    joox: function (s) {
      if (!/^https?:\/\/([a-z0-9-]+\.)*(joox)\.com(?:[:\/?#]|$)/i.test(str(s))) return null;
      var m = /\/single\/([^\/?#]+)/i.exec(str(s));
      return m ? normalizeJooxId(m[1]) : null;
    }
  };

  function importMusicItemImpl(urlLike) {
    var id = SHEET_URL_RESOLVERS.joox(str(urlLike));
    if (!id) return Promise.reject(new Error('非 JOOX 单曲链接（支持 www.joox.com/*/single/{id}）'));
    // 官方页解析拿完整元数据（主通道 search 无 id 直查端点）
    return jxFetchSinglePage(id).then(function (pad) {
      return {
        id: id,
        title: str(pad.name) || '未知曲目',
        artist: (pad.artist_list || []).map(function (a) { return str(a.name); }).filter(Boolean).join('/') || '未知歌手',
        album: str(pad.album_name),
        cover: jxPickImage(pad.images),
        platform: 'joox',
        _src: { joox: { trackId: id, lyricId: id, picId: str(pad.pic_id || '') } }
      };
    });
  }

  // ==================== 插件定义 ====================
  var plugin = {
    name: 'JOOX音乐',
    platform: 'joox',
    version: VERSION,
    author: '研发3号',
    description: 'JOOX 独立源插件 v1.0.0（首发双通道版）：主通道 gdstudio 公共聚合 API joox 源（VIP 全曲可取，实测仅 128k MP3 / 999 无损 FLAC 两档有效，限速 50 次/5 分钟）；备源官方直连（固定 Cookie+XFF 免登录，搜索 openjoox/v3 + 单曲页 __NEXT_DATA__ 取链——web_get_songinfo 已下线 404；免费歌完整 MP3，VIP 仅 30s 官方试听如实标注不绕付费）。歌词双通道（gdstudio → 官方 web_lyric JSONP+Base64），支持 joox.com 单曲链接导入。已知边界：中文关键词搜索结果多为 VIP 曲目（官方直连形态下仅 30s 试听）；gdstudio 超限 429/503 自动冷却 60s 并接力备源。',
    supportedSearchType: ['music'],
    defaultSearchType: 'music',
    primaryKey: ['id'],
    supportedQualities: ['standard', 'high', 'super'],
    cacheControl: 'no-cache', // 取链 URL 带时效 vkey，禁止缓存
    userVariables: [],        // 零配置：无 Cookie / 无签名
    hints: {
      quality: '音质说明：JOOX 源仅两档有效——standard=128k MP3；high/super=999 无损 FLAC（含 24bit 母带可能，actualQuality 如实回传）。192/320/740 中间档该源不支持（实测 br:-1）。VIP 曲目主通道可取全曲无损；主通道限速/失效时接力官方直连，此时 VIP 曲目为 30s 官方试听（如实标注，不做付费绕过）。',
      rateLimit: '主通道 gdstudio 官方限速 50 次/5 分钟，超限自动冷却 60 秒并接力官方备源，稍后自动恢复。'
    },

    search: searchImpl,
    getMediaSource: getMediaSourceImpl,
    getLyric: getLyricImpl,
    importMusicItem: importMusicItemImpl
  };

  // ==================== 导出 ====================
  if (typeof module !== 'undefined' && module.exports) {
    plugin._internal = {
      gdSearch: gdSearch, gdUrl: gdUrl, gdLyric: gdLyric,
      jxSearch: jxSearch, jxFetchSinglePage: jxFetchSinglePage, jxResolve: jxResolve,
      jxLyricApi: jxLyricApi, jxPickImage: jxPickImage, normalizeJooxId: normalizeJooxId,
      SHEET_URL_RESOLVERS: SHEET_URL_RESOLVERS
    };
    module.exports = plugin;
  }
  return plugin;
})();
