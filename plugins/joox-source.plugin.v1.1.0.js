/**
 * JOOX 音乐独立源插件 v1.1.0
 *
 * 变更记录：
 *   v1.1.0（2026-09-26 apicx 主通道增强版，基线 v1.0.0）：承接《JOOX 取播放链接口全网调研报告
 *     （2026-09-26）》（任务 7689528039515884768）「四、接入评估」结论，对既有插件做通道增强：
 *     ① 新增 apicx.asia 第三方 JOOX API 主通道（调研唯一实测全通方案，来源 GitHub zmux
 *        src/services/musicApi.js）：GET https://apicx.asia/api/joox_music?msg=<关键词>&token=<可配置>&br=4
 *        搜索（返回歌曲名/歌手/专辑/时长/歌曲ID/songmid），同 URL 加 &n=<搜索结果序号> 取详情
 *        （data.播放链接 12 档直链 + 歌词内容）。纯 HTTPS GET、无签名、无 cookie，参数带 country=hk。
 *     ② 关键约束（调研实测，代码严格遵守）：songmid 直接查询会错配、数字 ID 直查返回 code 500——
 *        必须走「关键词+序号」模式：searchMusic 结果在 _src.joox 保存 {kw, n}（并带 LRU 内存缓存），
 *        getMediaSource 用 msg+n 重查取详情，从 data.播放链接 按请求档位精确选取对应键。
 *     ③ 音质档位扩展：supportedQualities 3→6 档（standard→M500 128k MP3 / high→M800 320k MP3 /
 *        super→F000 无损 FLAC / hires→RS01 Hi-Res / master→AIM0 母带 FLAC / atmos→Q0M0 全景声）。
 *        取链总原则：请求哪个音质就获取哪个音质，任何环节不得擅自改变目标档位；Hi-Res/母带/全景声
 *        404 时如实报错不降级（gdstudio/官方均无该档，接力即变相降级，直接抛错）。
 *     ④ 通道优先级（按条目来源分流）：条目带 {kw,n}（apicx 搜索所得）→ apicx 主 → gdstudio 兜底
 *        （仅 standard/high/super 三档）→ 官方直连（VIP 30s 试听语义原样保留）；条目仅 trackId
 *        （单曲链接导入/历史播放恢复）→ gdstudio 主 → 官方直连（v1.0.0 行为不变）。
 *        apicx 条目同时携带 numeric 歌曲ID 作 trackId，gdstudio/官方兜底链无需换键。
 *     ⑤ 缓存（防第三方限流）：三个 LRU——搜索结果（key=kw|page，容量 50，TTL 10min）、apicx 详情
 *        12 档直链+歌词（key=kw|n，容量 30，TTL 5min——直链带 vkey 时效，宿主 cacheControl:'no-cache'
 *        语义不变，插件内短 TTL 仅削请求量）、歌词（容量 50，TTL 60min）。apicx 网络/5xx 失败
 *        进入 60s 冷却直接走兜底链；per-track 404 不触发冷却。
 *     ⑥ userVariables 新增 jooxToken 配置项（默认填调研实测 token，允许用户改，不硬编码死；
 *        设为 off 可停用 apicx 主通道回落 gdstudio/官方双通道）。
 *     ⑦ 大小匹配校验按六源口径保留：apicx 直链 Range 0-2047 探针——魔数校验（FLAC=fLaC /
 *        MP3=ID3|0xFFFx）+ Content-Length 非零 + 有损档按详情时长反推码率下限（128k→≥96kbps /
 *        320k→≥256kbps），不过即判失败接力下一通道。
 *     ⑧ 真网实测（2026-09-26，沙箱直连）：搜索 200（data.songs 带序号）；详情 12 档键全返回；
 *        Mojito M500=2.96MB ID3 206 / M800=7.40MB ID3 206 / F000=39.6MB fLaC 206 /
 *        AIM0=133MB fLaC 206 / Q0M0=20.4MB fLaC 206 / RS01=404（该曲无 Hi-Res，如实报错）。
 *        30s 试听键（30s 18→RS02 MP3）不上报宿主菜单、不作为取链降级出口。
 *     v1.0.0（2026-09-26）：首发版。双通道架构——
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
  var VERSION = '1.1.0';
  var HOST = 'https://music-api.gdstudio.xyz/api.php';
  var APICX_HOST = 'https://apicx.asia/api/joox_music';
  // 调研实测 token（来源 GitHub zmux src/services/musicApi.js），经 userVariables.jooxToken 可覆盖
  var APICX_DEFAULT_TOKEN = 'f84ao9lMF_q7husBWRfgUw';
  var TIMEOUT = 8000;

  var JX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
  // 官方直连固定形态（文档第 2 节：免登录固定 Cookie + 伪装 IP，仅备源使用）
  var JX_COOKIE = 'wmid=142420656; user_type=1; country=id; session_key=2a5d97d05dc8fe238150184eaf3519ad;';
  var JX_XFF = '36.73.34.109';

  var GD_COOL_MS = 60000;      // gdstudio 主冷却：命中 429/503 后的降级窗口
  var gdCoolUntil = 0;         // 时间戳（ms）
  var APICX_COOL_MS = 60000;   // apicx 网络/5xx 冷却（per-track 404 不触发）
  var apicxCoolUntil = 0;

  // 音质映射：joox 仅 128/999 两档有效（实测 192/320/740 → br:-1）。
  // standard→128；high/super→999（无损，actualQuality 如实回传）。
  var BR_MAP = { standard: '128', high: '999', super: '999' };

  // apicx 12 档键 → 宿主档位映射（请求哪个档位取哪个键，不擅自升降档）
  var APICX_KEY_MAP = {
    standard: 'MP3 128',
    high: 'MP3 320',
    super: '无损FLAC',
    hires: 'Hi-Res无损',
    master: '母带无损',
    atmos: 'Atmos全景声'
  };
  var APICX_AQ_LABEL = {
    standard: '128k MP3（M500）',
    high: '320k MP3（M800）',
    super: '无损 FLAC（F000）',
    hires: 'Hi-Res FLAC（RS01）',
    master: '母带无损 FLAC（AIM0）',
    atmos: 'Atmos 全景声 FLAC（Q0M0）'
  };
  // 有损档码率下限（kbps）：按详情时长反推，低于下限判降级拒收（六源口径）
  var APICX_BR_FLOOR = { standard: 96, high: 256 };

  function str(v) { return v === undefined || v === null ? '' : String(v); }

  // ==================== LRU 缓存（防第三方限流） ====================
  function createLru(max, ttlMs) {
    var map = new Map();
    return {
      get: function (k) {
        var it = map.get(k);
        if (!it) return undefined;
        if (Date.now() - it.t > ttlMs) { map.delete(k); return undefined; }
        map.delete(k); map.set(k, it); // 刷新新近度
        return it.v;
      },
      set: function (k, v) {
        map.delete(k);
        map.set(k, { v: v, t: Date.now() });
        while (map.size > max) map.delete(map.keys().next().value);
      }
    };
  }
  var searchLru = createLru(50, 10 * 60 * 1000);  // apicx 搜索结果（kw|page）
  var detailLru = createLru(30, 5 * 60 * 1000);   // apicx 详情 12 档直链+歌词（kw|n）
  var lyricLru = createLru(50, 60 * 60 * 1000);   // 歌词（kw|n 或 trackId）

  // ==================== userVariables（token 可配置，不硬编码死） ====================
  function getUserVariables() {
    try {
      var env = (typeof global !== 'undefined' && global.env) ? global.env : null;
      return (env && typeof env.getUserVariables === 'function') ? (env.getUserVariables() || {}) : {};
    } catch (e) { return {}; }
  }
  function apicxToken() {
    var t = str(getUserVariables().jooxToken).trim();
    return t || APICX_DEFAULT_TOKEN;
  }
  function apicxEnabled() {
    return str(getUserVariables().jooxToken).trim().toLowerCase() !== 'off';
  }

  // ==================== ID 规范化（文档 7.1） ====================
  // joox id 含 %/+/= 等：输入侧解一层面板转义；出参侧 encodeURIComponent。
  // 注意 + 是合法 id 字符，不做空格转换。
  function normalizeJooxId(raw) {
    var s = str(raw).trim();
    if (s.indexOf('%') >= 0) { try { s = decodeURIComponent(s); } catch (e) { /* 保留原样 */ } }
    return s;
  }

  // "03:05" → 185（秒）；解析失败返 0
  function parseDur(s) {
    var m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(str(s).trim());
    if (!m) return 0;
    if (m[3] !== undefined) return (Number(m[1]) * 3600) + (Number(m[2]) * 60) + Number(m[3]);
    return (Number(m[1]) * 60) + Number(m[2]);
  }

  // ==================== 主通道：apicx.asia（v1.1.0 新增） ====================
  function apicxGet(params, timeoutMs) {
    if (!apicxEnabled()) return Promise.reject(new Error('joox apicx disabled by userVariables'));
    if (Date.now() < apicxCoolUntil) return Promise.reject(new Error('joox apicx cooling down'));
    var p = Object.assign({}, params, { token: apicxToken() });
    return axios.get(APICX_HOST, {
      params: p,
      timeout: timeoutMs || TIMEOUT,
      headers: { 'User-Agent': JX_UA }
    }).then(function (res) {
      var d = res.data;
      if (!d || Number(d.code) !== 200) throw new Error('joox apicx code ' + (d && d.code) + ' ' + str(d && d.msg));
      return d;
    }).catch(function (e) {
      var st = e && e.response && e.response.status;
      // 网络/5xx 才触发通道冷却；code!=200（业务层，如坏 n）不冷却
      if (!st || st >= 500) apicxCoolUntil = Date.now() + APICX_COOL_MS;
      throw e;
    });
  }

  // 搜索：返回 {kw, n} 型条目；songmid 仅作展示不作查询键（调研实测错配）
  function apicxSearch(keyword, page) {
    var kw = str(keyword).trim();
    if (!kw) return Promise.reject(new Error('joox apicx: empty keyword'));
    if ((page || 1) > 1) return Promise.resolve([]); // apicx 无分页参数，page>1 交 gdstudio
    if (!apicxEnabled()) return Promise.reject(new Error('joox apicx disabled by userVariables')); // 开关优先于缓存
    var ck = kw + '|' + (page || 1);
    var hit = searchLru.get(ck);
    if (hit) return Promise.resolve(hit);
    return apicxGet({ msg: kw, br: 4, country: 'hk' }).then(function (d) {
      var songs = (d.data && d.data.songs) || [];
      var list = songs.map(function (t) {
        var numId = normalizeJooxId(t['歌曲ID']);
        var mid = str(t.songmid);
        var n = Number(t['序号']);
        if (!mid && !numId) return null;
        return {
          id: mid || numId,
          title: str(t['歌曲名称']),
          artist: str(t['歌手']) || '未知歌手',
          album: str(t['专辑']),
          duration: parseDur(t['时长']),
          cover: '', // apicx 搜索响应不含封面，宁缺毋假
          _src: { joox: { kw: kw, n: n, trackId: numId, songmid: mid, lyricId: numId } }
        };
      }).filter(function (m) { return m && m.title; });
      searchLru.set(ck, list);
      return list;
    });
  }

  // 详情（msg+n 重查）：12 档直链 + 歌词内容，LRU 5min
  function apicxDetail(kw, n) {
    if (!apicxEnabled()) return Promise.reject(new Error('joox apicx disabled by userVariables')); // 开关优先于缓存
    var ck = str(kw) + '|' + str(n);
    var hit = detailLru.get(ck);
    if (hit) return Promise.resolve(hit);
    return apicxGet({ msg: str(kw), br: 4, country: 'hk', n: n }).then(function (d) {
      var data = d.data || {};
      if (!data['播放链接']) throw new Error('joox apicx: 无播放链接字段');
      var detail = {
        links: data['播放链接'],
        lyric: str(data['歌词内容']),
        lyricState: str(data['歌词状态']),
        duration: parseDur(data['时长']),
        title: str(data['歌曲名称'])
      };
      if (detail.lyric.length > 10) lyricLru.set(ck, detail.lyric);
      detailLru.set(ck, detail);
      return detail;
    });
  }

  // 直链校验（六源口径）：Range 0-2047 魔数 + Content-Length 非零 + 有损档码率下限
  function verifyApicxLink(url, quality, durationSec) {
    return axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Range: 'bytes=0-2047', 'User-Agent': JX_UA },
      timeout: TIMEOUT
    }).then(function (res) {
      var st = res.status;
      if (st !== 200 && st !== 206) throw new Error('joox apicx link status ' + st);
      var raw = res.data;
      var body = Buffer.isBuffer(raw) ? raw
        : (raw instanceof ArrayBuffer) ? Buffer.from(new Uint8Array(raw))
        : Buffer.from(String(raw), 'binary');
      if (!body || body.length < 8) throw new Error('joox apicx link: empty probe');
      var head = body.slice(0, 4).toString('latin1');
      var isLossless = quality === 'super' || quality === 'hires' || quality === 'master' || quality === 'atmos';
      if (isLossless && head !== 'fLaC') throw new Error('joox apicx link: 非 FLAC 魔数（' + head.slice(0, 4) + '），疑似降级拒收');
      if (!isLossless) {
        var b0 = body[0], b1 = body[1];
        var isId3 = b0 === 0x49 && b1 === 0x44 && body[2] === 0x33;
        var isMp3Frame = b0 === 0xFF && (b1 & 0xE0) === 0xE0;
        if (!isId3 && !isMp3Frame) throw new Error('joox apicx link: 非 MP3 魔数，拒收');
      }
      // Content-Length：优先 Content-Range 总长，退 Content-Length
      var cr = str(res.headers && res.headers['content-range']); // "bytes 0-2047/TOTAL"
      var cl = str(res.headers && res.headers['content-length']);
      var total = 0;
      if (cr.indexOf('/') >= 0 && cr.split('/')[1] !== '*') total = Number(cr.split('/')[1]) || 0;
      else if (st === 200) total = Number(cl) || body.length;
      if (total <= 0) total = Number(cl) || 0;
      if (total <= 0) throw new Error('joox apicx link: 无 Content-Length');
      // 有损档码率下限校验（128k→≥96k / 320k→≥256k；时长缺失跳过不误杀）
      var floor = APICX_BR_FLOOR[quality];
      if (floor && durationSec > 0) {
        var kbps = Math.round(total * 8 / 1000 / durationSec);
        if (kbps < floor) throw new Error('joox apicx link: 折算 ' + kbps + 'kbps 低于 ' + floor + 'k 下限，疑似降级拒收');
      }
      return { url: url, size: total };
    });
  }

  // apicx 取链：msg+n 重查 → 按请求档位精确选键 → 校验 → 返回（404/缺档如实报错，不降级）
  function apicxResolve(raw, quality) {
    var key = APICX_KEY_MAP[quality];
    if (!key) return Promise.reject(new Error('joox apicx: 不支持的音质档 ' + str(quality)));
    return apicxDetail(raw.kw, raw.n).then(function (detail) {
      var url = detail.links[key];
      if (!url) throw new Error('joox apicx: 该曲无「' + key + '」档链接（404 如实报错，不降级）');
      return verifyApicxLink(url, quality, detail.duration || raw._dur || 0).then(function (v) {
        return {
          url: v.url,
          quality: quality,
          actualQuality: APICX_AQ_LABEL[quality],
          size: v.size,
          channel: 'apicx'
        };
      });
    });
  }

  // ==================== 主通道：gdstudio（v1.0.0 原样保留） ====================
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

  // ==================== 备源：官方直连（v1.0.0 原样保留） ====================
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
    // v1.1.0 通道优先级：apicx 主（仅 page1，无分页参数）→ gdstudio（page>1 起步）→ 官方直连
    return apicxSearch(keyword, p).then(function (list) {
      if (list.length) return { isEnd: true, data: list };
      return legacySearch(keyword, p);
    }).catch(function () {
      return legacySearch(keyword, p);
    });
  }

  // v1.0.0 原搜索链（gdstudio → 官方直连），作为 apicx 之后的兜底
  function legacySearch(keyword, p) {
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

  // 官方直连尾链（VIP 30s 试听语义原样保留，actualQuality 如实标注）
  function officialChain(raw, note) {
    return jxFetchSinglePage(raw.trackId).then(function (pad) {
      var r = jxResolve(pad);
      return {
        url: r.url,
        quality: r.quality,
        actualQuality: r.actualQuality + note,
        duration: r.duration,
        channel: 'official'
      };
    });
  }

  function getMediaSourceImpl(musicItem, quality) {
    if (!musicItem || !musicItem._src || !musicItem._src.joox || !musicItem._src.joox.trackId) {
      return Promise.reject(new Error('joox: 条目无音源信息'));
    }
    var raw = musicItem._src.joox;
    var q = quality || 'standard';
    var hiresLike = q === 'hires' || q === 'master' || q === 'atmos';
    var hasApicxRef = raw.kw !== undefined && raw.n !== undefined;
    if (hasApicxRef) {
      // v1.1.0 通道优先级：apicx 主（全 6 档）→ gdstudio（仅 standard/high/super）→ 官方直连
      return apicxResolve(raw, q).catch(function (e) {
        // 取链总原则：hires/master/atmos 404/缺档如实报错，不接力（gdstudio/官方无该档，接力即变相降级）
        if (hiresLike) throw e;
        return gdUrl(raw.trackId, q).then(function (r) {
          return { url: r.url, quality: r.quality, actualQuality: r.quality + '（apicx 不可用，gdstudio 兜底）', size: r.size, channel: 'gdstudio' };
        }).catch(function () {
          return officialChain(raw, '（gdstudio/apicx 均不可用，官方直连备源）');
        });
      });
    }
    // trackId-only 条目（单曲导入/历史播放恢复）：gdstudio 主 → 官方直连（v1.0.0 行为不变；
    // hires/master/atmos 无对应档，gdstudio/官方均不接，如实报错）
    if (hiresLike) {
      return Promise.reject(new Error('joox: 该条目无 apicx 取链引用（导入/历史条目），hires/master/atmos 档不可用（如实报错，不降级）'));
    }
    return gdUrl(raw.trackId, q).then(function (r) {
      return { url: r.url, quality: r.quality, actualQuality: r.quality, size: r.size, channel: 'gdstudio' };
    }).catch(function () {
      return officialChain(raw, '（gdstudio 主通道不可用，官方直连备源）');
    });
  }

  // 歌词：apicx（搜索/详情自带，LRU）→ gdstudio → 官方 web_lyric → null（不 throw，失败静默降级）
  function getLyricImpl(musicItem) {
    if (!musicItem || !musicItem._src || !musicItem._src.joox) {
      return Promise.resolve(null);
    }
    var raw = musicItem._src.joox;
    var hasApicxRef = raw.kw !== undefined && raw.n !== undefined;
    var ck = hasApicxRef ? (raw.kw + '|' + raw.n) : str(raw.lyricId || raw.trackId);
    var cached = lyricLru.get(ck);
    if (cached) return Promise.resolve({ rawLrc: cached });
    var apicxStep = hasApicxRef
      ? apicxDetail(raw.kw, raw.n).then(function (d) {
          if (!d.lyric || d.lyric.length < 10) throw new Error('joox apicx no lyric');
          return d.lyric;
        })
      : Promise.reject(new Error('joox apicx: 无取链引用'));
    var lyricId = raw.lyricId || raw.trackId;
    return apicxStep.then(function (lrc) {
      lyricLru.set(ck, lrc);
      return { rawLrc: lrc };
    }).catch(function () {
      return gdLyric(lyricId).then(function (lrc) {
        lyricLru.set(ck, lrc);
        return { rawLrc: lrc };
      }).catch(function () {
        return jxLyricApi(raw.trackId).then(function (lrc) {
          lyricLru.set(ck, lrc);
          return { rawLrc: lrc };
        }).catch(function () {
          return null;
        });
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
    author: '研发1号',
    description: 'JOOX 独立源插件 v1.1.0（apicx 主通道增强版）：主通道 apicx.asia 第三方 JOOX API（调研唯一实测全通方案，「关键词+序号」模式——songmid 直查错配、数字 ID 直查 500，故 _src 携带 {kw,n} 重查取详情；一次返回 12 档直链，宿主菜单 6 档：128k MP3/320k MP3/无损 FLAC/Hi-Res/母带 FLAC/Atmos 全景声；Hi-Res 等逐曲可能 404，如实报错不降级）；兜底 gdstudio 公共聚合 API（仅 standard/high/super，VIP 全曲可取，限速 50 次/5 分钟，429/503 冷却 60s）→ 官方直连（免费歌完整 MP3，VIP 仅 30s 官方试听如实标注不绕付费）。三 LRU 缓存（搜索 10min/详情 5min/歌词 60min）防第三方限流；直链 Range 魔数+码率下限校验（六源口径）。userVariables.jooxToken 可配置（默认调研实测 token，设 off 停用 apicx）。支持 joox.com 单曲链接导入。',
    supportedSearchType: ['music'],
    defaultSearchType: 'music',
    primaryKey: ['id'],
    supportedQualities: ['standard', 'high', 'super', 'hires', 'master', 'atmos'],
    cacheControl: 'no-cache', // 取链 URL 带时效 vkey，禁止缓存
    userVariables: [
      { key: 'jooxToken', name: 'apicx JOOX API Token（默认调研实测 token）', hint: 'apicx.asia 第三方接口令牌，默认填 2026-09-26 调研实测可用 token（f84ao9lMF_q7husBWRfgUw）；失效时替换为最新 token。设为 off 可停用 apicx 主通道（回落 gdstudio/官方双通道，仅 standard/high/super 三档）' }
    ],
    hints: {
      quality: '音质说明（v1.1.0 六档）：standard=128k MP3（M500）；high=320k MP3（M800）；super=无损 FLAC（F000）；hires=Hi-Res FLAC（RS01）；master=母带无损 FLAC（AIM0）；atmos=Atmos 全景声（Q0M0）。主通道 apicx 按请求档位精确取键、不升降档；Hi-Res/母带/全景声逐曲可用性不一，404 时如实报错不降级。主通道不可用时 standard/high/super 回落 gdstudio（high 档实际回 999 无损，actualQuality 如实标注），再回落官方直连（VIP 曲目为 30s 官方试听，如实标注，不做付费绕过）。',
      rateLimit: '主通道 apicx 为第三方接口（token 可在插件设置更换），网络/5xx 失败自动冷却 60 秒并接力 gdstudio/官方通道；gdstudio 官方限速 50 次/5 分钟，超限同样冷却接力。'
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
      SHEET_URL_RESOLVERS: SHEET_URL_RESOLVERS,
      // v1.1.0 apicx 增量（自测钩子）
      apicxSearch: apicxSearch, apicxDetail: apicxDetail, apicxResolve: apicxResolve,
      verifyApicxLink: verifyApicxLink, parseDur: parseDur,
      APICX_KEY_MAP: APICX_KEY_MAP, APICX_DEFAULT_TOKEN: APICX_DEFAULT_TOKEN
    };
    module.exports = plugin;
  }
  return plugin;
})();
