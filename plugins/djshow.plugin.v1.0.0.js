/**
 * [v1.0.0 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「DJ秀」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * DJ秀 独立源插件（MusicFree）
 * ================================
 * v1.0.0（2026-09-24 首版）：
 *  - 依据《DJ秀 APP 音乐接口逆向分析报告（最终版）》（包名 com.kuaiyuhudong.djshow v8.4.6.2，
 *    2026-09-02 root 真机 frida 实测）接入：
 *    分类列表(classlist) / 歌曲列表(songlist, 页码从0) / 搜索(search.php, 必须 POST+完整设备参数)
 *    / 歌曲详情(detail, mid+ts) / 热门搜索 / 歌词(lyric.php?cmd=get_dj_lyric, 明文 LRC 无需解密)
 *    / 榜单(rankinglist_v2 + songlist.php?cmd=detail, 页码从1) / 歌单(songsheets + 同 detail 端点)
 *    / 评论(songtopic, sid 为数字 id)。
 *  - 播放面（2026-09-24 二轮：解密算法已复现并激活）：
 *    libacdec.so（ARM aarch64）静态逆向结论（capstone 反汇编 + unicorn 2.1.4 逐指令模拟验证）：
 *    · .acbz 文件的加密 = tkmDec 的纯 XOR 流变换，3DES 层（历史假设 attemptor
 *      attemptEdeK1K2K3：D(K1)→E(K2)→D(K3) 逐块）存在于 so 但对该格式不参与——密文相距 128 字节（i² mod 256 周期）的块
 *      仅差个别比特，真块密码不可能保留该关系；用 PRNG 表直接 XOR 实测解出标准 MP4 头
 *      （00 00 00 20 'ftyp' 'mp42'，moov/free/mdat box 结构完整）。
 *    · 算法：out[j] = in[j] ^ T[(i*i + 0x13c1b) & 0xff]，i = 全局字节偏移（整文件解密时
 *      i = j；分块时 i = 块首文件偏移 + 块内偏移，即 tkmDec(offset, block) 的 offset 语义）；
 *      i² mod 256 仅依赖 i mod 128，故内建 128 项索引基表加速；offset < 0 时宿主跳过 XOR。
 *    · T = so 内 .rodata 0x5020 处 256 字节表（本文件内嵌 ACBZ_XOR_TABLE）。
 *    · so 中另证实：K1/K2/K3 三密钥为 .data 静态 blob（与报告一致），initAcDec→0x1280
 *      仅做签名 MD5 校验 + 日志，不改写密钥与表；tkmDec XOR 公式从 ARM64 指令
 *      （x5 = i*0x80010003; idx = (i*i + 0x13c1b) & 0xff; data[j] ^= T[idx]）直接读出。
 *    · 双路由（经用户确认的 fork 宿主路线 + 标准宿主兜底）：
 *      ① fork 宿主（MusicFree-toskysun）：宿主在插件沙箱注入 __ACBZ_PROXY__ 标志，
 *         插件直接返回 { url: <远程 .acbz>, acbz: 'tkm-xor' }，由宿主解密代理落本地缓存
 *         file:// 播放（无 base64 膨胀、支持 seek）；
 *      ② 标准 MusicFree 宿主：getMediaSource 下载 .acbz → 全量 XOR 解密 → 音频魔数校验
 *         （ftyp/ID3/fLaC/mp3 sync）→ base64 data: URI 返回（20MB 保险丝，实验路径）。
 *  - 已知限制：
 *    · 搜索接口在数据中心 IP 下返回空（报告 2026-09-02 真机实测正常；响应结构正常无报错，
 *      疑似服务端按网络环境/设备参数一致性过滤），真机行为待复验；
 *    · 专辑(albumlist)仅有列表无歌曲详情端点（detail.php?type=album 实测报「错误的歌曲ID」、
 *      cmd=albumdetail 返回空），故专辑不接入 UI；频道(channellist)仅有频道名、无歌曲列表端点，
 *      不接入 UI；歌手作品无端点，不实现 getArtistWorks；
 *    · .aclrc 离线加密歌词不接入（歌词走明文接口，.aclrc 仅离线场景使用）；
 *    · data: URI 播放为全量下载（单首最大约 9.8MB + base64 膨胀约 33%），受沙箱 10 秒/次
 *      方法超时约束，高音质(hpath)在弱网可能超时——这是该实验路径的固有风险（用户已知悉）。
 *  - 音质映射（诚实标注，请求哪个音质就取哪个音质）：
 *    low → path  (_l.acbz, m4a, 实测约 65kbps)
 *    standard → mpath (_m.acbz, mp3, 实测约 192kbps)
 *    high/super → hpath (_h.acbz, mp3, 实测约 321kbps，部分歌曲 hpath 为空则抛错由宿主降级重试)
 */

var axios = require('axios');
var CryptoJS = require('crypto-js');

// ===== 常量 =====

var API_Q = 'https://qapi.djshow.cn/api';
var API_QN = 'https://qnapi.djshow.cn/api';

var HTTP_HEADERS = { 'User-Agent': 'okhttp/3.12.0' };
var REQUEST_TIMEOUT = 8000;

// 公共设备参数（报告第三章；搜索接口必须携带，其他接口建议携带）
// 取值来自报告 root 真机实测样本，服务端校验口径未知，如失效需真机抓包更新
var DEVICE_PARAMS = {
    device_id: 'b55ec13c-17d9-466b-81ae-e9c833c84628',
    brand: 'Redmi',
    sdk_version: '33',
    system_version: '13',
    product: 'camellia',
    model: 'M2103K19C',
    hardware: 'mt6833',
    system_id: 'TP1A.220624.014',
    manufacturer: 'Xiaomi',
    version_code: '117',
    ver: '4.7.7',
    market: 'xiaomi',
    package_name: 'com.kuaiyuhudong.djshow',
    guid: '664efc49d5b44c76902e99f9b8528c92',
    os: 'android',
    base_play: '0',
    base_playCount: '0',
};

function deviceParams() {
    var p = {};
    for (var k in DEVICE_PARAMS) {
        if (Object.prototype.hasOwnProperty.call(DEVICE_PARAMS, k)) {
            p[k] = DEVICE_PARAMS[k];
        }
    }
    p.guidts = String(Math.floor(Date.now() / 1000));
    return p;
}

var PAGE_SIZE = 30;
var SHEET_PAGE_SIZE = 50;
var COMMENT_PAGE_SIZE = 20;

// 音质映射：宿主 quality → 响应字段
var QUALITY_FIELD = {
    low: 'path',
    standard: 'mpath',
    high: 'hpath',
    super: 'hpath',
};

// ===== .acbz 解密管道 =====
var ACBZ_KEYS = {
    K1: '7303272ccc5a04685c77edd030a3b827',
    K2: '5d5787d463e692949468184e17aa51d4',
    K3: '32564e127db8806dfcf5ceb61b21f6cf',
};

var ACBZ_BLOCK_SIZE = 8192;
var ACBZ_MAX_BYTES = 20 * 1024 * 1024; // data: URI 全量路径的体积保险丝

var ACBZ_XOR_OFF = 0x13c1b;
var ACBZ_XOR_TABLE_HEX =
    'dd3dd83460b4627fc5793c8b01057ff9cef3de9c6cf94bc935d185f81edda157' +
    'e1ca8278d54cc60987ee6e95bf908a1457f5e3579b606b11dc979173639227aa' +
    'c5b8e98f337455dd8c2b18cd141faa32c1b2baf2fe25875581b8acafa886dd6a' +
    '9bc3a033b86d3404da651a98be0af786c20537463a9dfe03d696e17e6f8d0b92' +
    '1e5eca321ac8165fda99a792d87e7710cb00d1a5bb7b08470cbad93a8c68304e' +
    'a86ac742c2662afed817da0324c3bdc5d03880c445918675b5b827b5ec0d9d06' +
    '62fdbbdfcfae2cd469baf557959dffca64682e34e409392918894ec55d6e68e8' +
    '48988bbcddcf3c05180112456991e48a7567c5de2a2b74264cd5129111cd6ed5';
    '988bbcddcf3c05180112456991e48a7567c5de2a2b74264cd5129111cd6ed5';

var ACBZ_XOR_TABLE = (function () {
    var hex = ACBZ_XOR_TABLE_HEX;
    var t = new Uint8Array(256);
    for (var i = 0; i < 256; i++) {
        t[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return t;
})();

// i² mod 256 仅依赖 i mod 128（i = 128k + r ⇒ i² ≡ r² mod 256），预计算索引基表加速
var ACBZ_IDX128 = (function () {
    var a = new Uint8Array(128);
    for (var r = 0; r < 128; r++) {
        a[r] = ((r * r) + ACBZ_XOR_OFF) & 0xff;
    }
    return a;
})();

// fork 宿主（MusicFree-toskysun）能力探测：宿主在插件沙箱 globalThis 注入 __ACBZ_PROXY__
var HAS_HOST_ACBZ_PROXY = (function () {
    try {
        return typeof __ACBZ_PROXY__ !== 'undefined' && !!__ACBZ_PROXY__;
    } catch (e) {
        return false;
    }
})();

/**
 * 音频魔数校验：解密后应为标准 M4A(ftypmp42) / MP3(ID3 或帧同步) / FLAC
 */
function isAudioMagic(head) {
    if (!head || head.length < 16) {
        return null;
    }
    // M4A: [4字节size] + 'ftyp'
    if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
        return { mime: 'audio/mp4', ext: 'm4a' };
    }
    // ID3 (mp3)
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
        return { mime: 'audio/mpeg', ext: 'mp3' };
    }
    // MP3 帧同步 0xFFEx/0xFFFx
    if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
        return { mime: 'audio/mpeg', ext: 'mp3' };
    }
    // fLaC
    if (head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) {
        return { mime: 'audio/flac', ext: 'flac' };
    }
    return null;
}

function wordArrayOfBytes(bytes) {
    var words = [];
    for (var i = 0; i < bytes.length; i += 4) {
        words.push(
            ((bytes[i] || 0) << 24) |
            ((bytes[i + 1] || 0) << 16) |
            ((bytes[i + 2] || 0) << 8) |
            (bytes[i + 3] || 0)
        );
    }
    return CryptoJS.lib.WordArray.create(words, bytes.length);
}

function bytesOfWordArray(wa) {
    var words = wa.words;
    var sigBytes = wa.sigBytes;
    var out = new Uint8Array(sigBytes);
    for (var i = 0; i < sigBytes; i++) {
        var w = words[i >>> 2];
        out[i] = (w >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return out;
}

function desRaw(wordBytes, keyHex, encrypt) {
    var key = CryptoJS.enc.Hex.parse(keyHex.substring(0, 16)); // 前 8 字节
    var cfg = { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.NoPadding };
    var des = encrypt ? CryptoJS.DES.encrypt : CryptoJS.DES.decrypt;
    // 兼容两种返回：encrypt 返回 CipherParams（明文在 .ciphertext），NoPadding 下 decrypt
    // 可能直接返回 WordArray（无 .ciphertext 属性）
    var wa = des(wordArrayOfBytes(wordBytes), key, cfg);
    var ct = (wa && wa.ciphertext && wa.ciphertext.words) ? wa.ciphertext : wa;
    return bytesOfWordArray(ct);
}

/**
 * 主 attemptor：tkmDec XOR 流解密（libacdec.so 逆向复现，unicorn 逐指令模拟对拍验证）。
 * out[j] = in[j] ^ T[(i² + 0x13c1b) & 0xff]，i = offset + j（全局字节偏移）。
 * offset 用 128 项基表 O(1) 取 i² mod 256（i² mod 256 仅依赖 i mod 128）。
 * 密文相距 128 字节的块与明文保持逐比特对应关系（纯 XOR 特征），实测解出 ftyp/mp42。
 */
function attemptTkmXor(block, offset) {
    try {
        if (!block || !block.length) {
            return null;
        }
        var off = typeof offset === 'number' && isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
        var out = new Uint8Array(block.length);
        for (var j = 0; j < block.length; j++) {
            out[j] = block[j] ^ ACBZ_XOR_TABLE[ACBZ_IDX128[(off + j) & 127]];
        }
        return out;
    } catch (e) {
        return null;
    }
}

/**
 * 历史假设 attemptor（3DES EDE 逐块 ECB：D(K1)→E(K2)→D(K3)，与下方实现一致）。
 * libacdec.so 逆向证实 .acbz 不走 3DES 层，此 attemptor 已从注册表摘除，
 * 保留作为算法回归对照与管道签名示例（(headBytes, offset) → Uint8Array | null）。
 */
function attemptEdeK1K2K3(headBytes) {
    try {
        var out = new Uint8Array(headBytes.length - (headBytes.length % 8));
        for (var i = 0; i + 8 <= headBytes.length; i += 8) {
            var blk = headBytes.subarray(i, i + 8);
            var a = desRaw(blk, ACBZ_KEYS.K1, false);
            var b = desRaw(a, ACBZ_KEYS.K2, true);
            var c = desRaw(b, ACBZ_KEYS.K3, false);
            out.set(c, i);
        }
        return out;
    } catch (e) {
        return null;
    }
}

/**
 * 可插拔解密器注册表：签名 (block: Uint8Array, offset: number) → Uint8Array | null。
 * offset = 该块在原始文件中的字节偏移（tkmDec 流状态语义）。
 */
var ACBZ_DECRYPTORS = [attemptTkmXor];

/**
 * 对文件头部运行全部已注册解密器，返回首个产出标准音频魔数的结果。
 */
function tryDecryptHead(headBytes) {
    for (var i = 0; i < ACBZ_DECRYPTORS.length; i++) {
        var plain = null;
        try {
            plain = ACBZ_DECRYPTORS[i](headBytes);
        } catch (e) {
            plain = null;
        }
        if (plain) {
            var magic = isAudioMagic(plain);
            if (magic) {
                return { plain: plain, magic: magic, decryptorIndex: i };
            }
        }
    }
    return null;
}

/**
 * tkmDec(offset, block) 语义的分块解密调度：每块独立、offset 参与状态（由 attemptor 内部处理）。
 */
function decryptChunk(offset, chunk, decryptor) {
    return decryptor(chunk, offset);
}

// ===== 网络工具 =====

async function httpGet(url, params) {
    var res = await axios.get(url, {
        params: params,
        headers: HTTP_HEADERS,
        timeout: REQUEST_TIMEOUT,
    });
    return res.data;
}

async function httpPostEmpty(url, params) {
    var res = await axios.post(url, null, {
        params: params,
        headers: HTTP_HEADERS,
        timeout: REQUEST_TIMEOUT,
    });
    return res.data;
}

// ===== 数据映射 =====

/**
 * 歌曲对象统一映射。title 用 songname（纯歌名），artist 单列，避免「歌手 - 歌名」重复展示。
 * 扩展字段：_ts(详情接口必需)、_sid(数字id, 评论接口)、_path/_mpath/_hpath(三档 .acbz 直链)、
 * _size/_msize/_hsize(各档文件大小, 取链比对与 size 回填)。
 */
function mapSong(s) {
    if (!s || !s.mid) {
        return null;
    }
    var item = {
        id: String(s.mid),
        title: s.songname || s.name || String(s.mid),
        artist: s.singer || '未知歌手',
        duration: typeof s.songtime === 'number' ? s.songtime : undefined,
        _ts: s.ts,
        _sid: s.id !== undefined && s.id !== null ? String(s.id) : undefined,
        _path: s.path || undefined,
        _mpath: s.mpath || undefined,
        _hpath: s.hpath || undefined,
        _size: s.size,
        _msize: s.msize,
        _hsize: s.hsize,
    };
    if (s.album_name) {
        item.album = s.album_name;
    }
    if (s.album_cover) {
        item.artwork = s.album_cover;
    }
    return item;
}

function mapSongList(songs) {
    var out = [];
    for (var i = 0; i < (songs || []).length; i++) {
        var m = mapSong(songs[i]);
        if (m) {
            out.push(m);
        }
    }
    return out;
}

// ===== 接口封装 =====

/**
 * 分类列表（17 个分类）。homepage.php?cmd=classlist，无需翻页。
 */
async function fetchClassList() {
    var data = await httpGet(API_Q + '/song/homepage.php', Object.assign(
        { cmd: 'classlist' }, deviceParams()));
    var result = (data && data.result) || [];
    if (!Array.isArray(result)) {
        throw new Error('DJ秀 分类列表响应结构异常');
    }
    return result;
}

/**
 * 分类歌曲列表。homepage.php?cmd=songlist&classid&page（0 起）&count。
 */
async function fetchClassSongs(classid, page /* 宿主 1 起 */) {
    var data = await httpGet(API_Q + '/song/homepage.php', Object.assign({
        cmd: 'songlist',
        classid: classid,
        page: Math.max(0, page - 1),
        count: PAGE_SIZE,
    }, deviceParams()));
    var result = data && data.result;
    if (!result || !Array.isArray(result.songs)) {
        throw new Error('DJ秀 分类歌曲列表响应结构异常');
    }
    return result;
}

/**
 * 榜单/歌单详情列表。songlist.php?cmd=detail&songlist_id&page（1 起）&count。
 */
async function fetchSonglistDetail(songlistId, page) {
    var data = await httpGet(API_Q + '/song/songlist.php', Object.assign({
        cmd: 'detail',
        songlist_id: songlistId,
        page: page,
        count: PAGE_SIZE,
    }, deviceParams()));
    var result = data && data.result;
    if (!result || !Array.isArray(result.song_details)) {
        throw new Error('DJ秀 歌单详情响应结构异常');
    }
    return result;
}

/**
 * 歌单广场。homepage.php?cmd=songsheets&page（1 起）&count。
 */
async function fetchSongSheets(page) {
    var data = await httpGet(API_Q + '/song/homepage.php', Object.assign({
        cmd: 'songsheets',
        page: page,
        count: SHEET_PAGE_SIZE,
    }, deviceParams()));
    var result = data && data.result;
    if (!result || !Array.isArray(result.songlists)) {
        throw new Error('DJ秀 歌单广场响应结构异常');
    }
    return result;
}

/**
 * 歌曲详情（mid + ts 双键）。detail.php?type=song。
 */
async function fetchSongDetail(mid, ts) {
    var params = { type: 'song', mid: mid };
    if (ts) {
        params.ts = ts;
    }
    var data = await httpGet(API_QN + '/banzou/detail.php', Object.assign(params, deviceParams()));
    var result = data && data.result;
    if (!result || !result.mid) {
        throw new Error('DJ秀 歌曲详情响应结构异常');
    }
    return result;
}

// ===== 插件主体 =====

async function search(query, page, type) {
    if (type !== 'music') {
        return { isEnd: true, data: [] };
    }
    // 搜索必须 POST + URL 完整设备参数，请求体为空（报告 5.3），否则返回空结果
    var data = await httpPostEmpty(API_QN + '/banzou/search.php', Object.assign({
        op: 'all',
        type: 'song',
        query: query,
        pn: Math.max(0, page - 1),
        count: PAGE_SIZE,
        from: '',
        uid: '',
    }, deviceParams()));
    var songWrap = data && data.song;
    var songs = (songWrap && songWrap.songs) || [];
    return {
        isEnd: songs.length < PAGE_SIZE,
        data: mapSongList(songs),
    };
}

async function getMediaSource(musicItem, quality) {
    var field = QUALITY_FIELD[quality] || 'mpath';
    var url = musicItem['_' + field];
    var sizeHint = musicItem[field === 'path' ? '_size' : field === 'mpath' ? '_msize' : '_hsize'];

    // 扩展字段缺失（旧缓存条目等）→ 详情接口补齐
    if (!url && musicItem.id) {
        var detail = await fetchSongDetail(musicItem.id, musicItem._ts);
        url = detail[field];
        sizeHint = field === 'path' ? detail.size : field === 'mpath' ? detail.msize : detail.hsize;
        if (musicItem._ts === undefined && detail.ts) {
            musicItem._ts = detail.ts;
        }
    }
    if (!url) {
        // 抛错触发宿主音质降级重试
        throw new Error('DJ秀 该歌曲无 [' + quality + '] 档音源，请尝试其他音质');
    }

    // ① fork 宿主路线（MusicFree-toskysun）：返回远程 .acbz 直链 + acbz 标志，
    //    由宿主解密代理（src/service/acbz）下载 → XOR 解密 → 本地缓存 file:// 播放
    if (HAS_HOST_ACBZ_PROXY) {
        // headers 跟随标准路线的 UA（okhttp/3.12.0），避免 fork 代理下载同一 CDN 时因缺 UA 被 403
        var forkResult = { url: url, acbz: 'tkm-xor', headers: Object.assign({}, HTTP_HEADERS) };
        if (typeof sizeHint === 'number' && sizeHint > 0) {
            forkResult.size = sizeHint;
        }
        return forkResult;
    }

    // ② 标准宿主路线：取文件头 8192 字节，运行可插拔解密器并做音频魔数校验
    var headRes = await axios.get(url, {
        headers: Object.assign({ Range: 'bytes=0-' + (ACBZ_BLOCK_SIZE - 1) }, HTTP_HEADERS),
        timeout: REQUEST_TIMEOUT,
        responseType: 'arraybuffer',
    });
    var head = new Uint8Array(headRes.data || []);
    if (!head.length) {
        throw new Error('DJ秀 音源文件头下载为空');
    }
    var decrypted = tryDecryptHead(head);
    if (!decrypted) {
        throw new Error(
            'DJ秀 音源解密结果非标准音频（算法已复现，若持续出现可能是上游格式变更），' +
            '数据面（搜索/歌单/榜单/歌词）不受影响'
        );
    }

    // ② 全量下载 → 逐块解密(offset) → base64 data: URI
    var fullRes = await axios.get(url, {
        headers: HTTP_HEADERS,
        timeout: REQUEST_TIMEOUT,
        responseType: 'arraybuffer',
    });
    var enc = new Uint8Array(fullRes.data || []);
    if (!enc.length) {
        throw new Error('DJ秀 音源下载为空');
    }
    if (enc.length > ACBZ_MAX_BYTES) {
        throw new Error('DJ秀 音源体积超过 data: URI 实验路径上限(' + ACBZ_MAX_BYTES + ' 字节)');
    }
    var decryptor = ACBZ_DECRYPTORS[decrypted.decryptorIndex];
    var plain = new Uint8Array(enc.length);
    for (var off = 0; off < enc.length; off += ACBZ_BLOCK_SIZE) {
        var chunk = enc.subarray(off, Math.min(off + ACBZ_BLOCK_SIZE, enc.length));
        var dec = decryptChunk(off, chunk, decryptor);
        if (!dec || dec.length !== chunk.length) {
            throw new Error('DJ秀 音频分块解密失败(offset=' + off + ')');
        }
        plain.set(dec, off);
    }
    var recheck = isAudioMagic(plain);
    if (!recheck) {
        throw new Error('DJ秀 全量解密后未检出标准音频魔数，解密结果不可信');
    }

    // base64（沙箱有 Buffer / btoa；用二进制串 + btoa 兼容分段）
    var binary = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < plain.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, plain.subarray(i, Math.min(i + CHUNK, plain.length)));
    }
    var b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(plain).toString('base64');

    var result = { url: 'data:' + recheck.mime + ';base64,' + b64 };
    if (typeof sizeHint === 'number' && sizeHint > 0) {
        result.size = sizeHint;
    }
    return result;
}

async function getLyric(musicItem) {
    if (!musicItem || !musicItem.id) {
        return {};
    }
    var data;
    try {
        // 歌词端点对不存在的 mid 返回 HTTP 500：无歌词属正常态，容错返回空对象
        data = await httpGet(API_Q + '/lrc/lyric.php', { cmd: 'get_dj_lyric', mid: musicItem.id });
    } catch (e) {
        return {};
    }
    var text = data && data.result && data.result.result;
    if (typeof text !== 'string' || !text.trim()) {
        return {}; // 无歌词不抛错
    }
    return { rawLrc: text };
}

async function getMusicInfo(musicItem) {
    if (!musicItem || !musicItem.id) {
        return {};
    }
    var detail = await fetchSongDetail(musicItem.id, musicItem._ts);
    var info = {};
    if (detail.album_name) {
        info.album = detail.album_name;
    }
    if (detail.album_cover) {
        info.artwork = detail.album_cover;
    }
    if (typeof detail.songtime === 'number') {
        info.duration = detail.songtime;
    }
    // 回填三档直链与 ts，供 getMediaSource / 后续调用免二次请求
    if (detail.ts) {
        info._ts = detail.ts;
    }
    if (detail.path) {
        info._path = detail.path;
        info._size = detail.size;
    }
    if (detail.mpath) {
        info._mpath = detail.mpath;
        info._msize = detail.msize;
    }
    if (detail.hpath) {
        info._hpath = detail.hpath;
        info._hsize = detail.hsize;
    }
    return info;
}

async function getTopLists() {
    var rankData = await httpGet(API_Q + '/song/homepage.php', Object.assign(
        { cmd: 'rankinglist_v2' }, deviceParams()));
    var ranks = (rankData && rankData.result) || [];
    if (!Array.isArray(ranks)) {
        throw new Error('DJ秀 榜单列表响应结构异常');
    }
    var cats = await fetchClassList();

    var rankItems = [];
    for (var i = 0; i < ranks.length; i++) {
        var r = ranks[i];
        if (!r || r.id === undefined) {
            continue;
        }
        rankItems.push({
            id: 'rank_' + r.id,
            title: r.name || String(r.id),
            worksNum: r.count,
            artwork: r.pic || undefined,
        });
    }
    var catItems = [];
    for (var j = 0; j < cats.length; j++) {
        var c = cats[j];
        if (!c || !c.id) {
            continue;
        }
        catItems.push({
            id: 'cat_' + c.id,
            title: c.name || String(c.id),
            worksNum: c.count,
        });
    }
    var groups = [];
    if (rankItems.length) {
        groups.push({ title: '官方榜单', data: rankItems });
    }
    if (catItems.length) {
        groups.push({ title: '分类曲库', data: catItems });
    }
    return groups;
}

async function getTopListDetail(topListItem, page) {
    var id = String(topListItem.id || '');
    var musicList;
    var isEnd;
    var extra = {};
    if (id.indexOf('rank_') === 0) {
        var rankResult = await fetchSonglistDetail(id.substring(5), page);
        musicList = mapSongList(rankResult.song_details);
        isEnd = page >= (rankResult.page_count || 1);
        if (page === 1 && rankResult.name) {
            extra.topListItem = {
                id: topListItem.id,
                title: rankResult.name,
                artwork: topListItem.artwork,
                worksNum: rankResult.total,
            };
        }
    } else if (id.indexOf('cat_') === 0) {
        var classResult = await fetchClassSongs(id.substring(4), page);
        musicList = mapSongList(classResult.songs);
        isEnd = page >= (classResult.page_count || 1);
    } else {
        throw new Error('DJ秀 未知的榜单条目: ' + id);
    }
    var res = { isEnd: isEnd, musicList: musicList };
    if (extra.topListItem) {
        res.topListItem = extra.topListItem;
    }
    return res;
}

async function getRecommendSheetTags() {
    return {
        data: [
            {
                title: '歌单广场',
                data: [{ id: 'all', title: '全部歌单' }],
            },
        ],
    };
}

async function getRecommendSheetsByTag(tag, page) {
    var result = await fetchSongSheets(page);
    var sheets = [];
    for (var i = 0; i < result.songlists.length; i++) {
        var s = result.songlists[i];
        if (!s || s.id === undefined) {
            continue;
        }
        sheets.push({
            id: 'sheet_' + s.id,
            title: s.name || String(s.id),
            artwork: s.pic || undefined,
            worksNum: s.count,
        });
    }
    return {
        isEnd: page >= (result.page_count || 1),
        data: sheets,
    };
}

async function getMusicSheetInfo(sheetItem, page) {
    var id = String(sheetItem.id || '');
    if (id.indexOf('sheet_') !== 0) {
        throw new Error('DJ秀 未知的歌单条目: ' + id);
    }
    var result = await fetchSonglistDetail(id.substring(6), page);
    var res = {
        isEnd: page >= (result.page_count || 1),
        musicList: mapSongList(result.song_details),
    };
    if (page <= 1) {
        res.sheetItem = {
            id: sheetItem.id,
            title: result.name || sheetItem.title,
            artwork: result.pic || sheetItem.artwork,
            worksNum: result.total,
            description: result.desc || undefined,
        };
    }
    return res;
}

async function getMusicComments(musicItem, page) {
    var sid = musicItem && musicItem._sid;
    if (!sid) {
        // 评论接口用数字歌曲 id；无 _sid 时尝试详情补齐
        if (musicItem && musicItem.id) {
            var detail = await fetchSongDetail(musicItem.id, musicItem._ts);
            sid = detail.id !== undefined && detail.id !== null ? String(detail.id) : undefined;
        }
        if (!sid) {
            return { isEnd: true, data: [] };
        }
    }
    var data = await httpGet(API_Q + '/songtopic/topicinfo.php', Object.assign({
        cmd: 'song_topic',
        sid: sid,
        page: page,
        count: COMMENT_PAGE_SIZE,
    }, deviceParams()));
    var result = (data && data.result) || {};
    var posts = result.posts || [];
    var comments = [];
    for (var i = 0; i < posts.length; i++) {
        var p = posts[i] || {};
        // 上游评论字段结构未在报告中实测（样本为空），做防御式映射
        comments.push({
            id: p.id !== undefined ? String(p.id) : undefined,
            nickName: p.nickname || p.uname || p.username || '匿名',
            comment: p.content || p.text || '',
            avatar: p.face || p.avatar || undefined,
            createAt: typeof p.ts === 'number' ? p.ts : undefined,
        });
    }
    var isEnd;
    if (typeof result.page_count === 'number') {
        isEnd = page >= result.page_count;
    } else {
        isEnd = posts.length < COMMENT_PAGE_SIZE;
    }
    return { isEnd: isEnd, data: comments };
}

module.exports = {
    name: 'DJ秀',
    platform: 'DJ秀',
    version: '1.0.0',
    author: '研发2号',
    description:
        'DJ秀(DJshow)音源插件。数据面全量接入（分类/搜索/歌单/榜单/明文歌词/评论）；' +
        '播放面已打通：.acbz 加密算法自 libacdec.so 逆向复现（tkmDec XOR 流变换），' +
        'fork 宿主走解密代理 file:// 播放，标准宿主走插件内全量解密 data: URI 实验路径。',
    supportedSearchType: ['music'],
    cacheControl: 'no-store',
    hints: {},

    search: search,
    getMediaSource: getMediaSource,
    getLyric: getLyric,
    getMusicInfo: getMusicInfo,
    getTopLists: getTopLists,
    getTopListDetail: getTopListDetail,
    getRecommendSheetTags: getRecommendSheetTags,
    getRecommendSheetsByTag: getRecommendSheetsByTag,
    getMusicSheetInfo: getMusicSheetInfo,
    getMusicComments: getMusicComments,

    // 测试钩子（非宿主协议）
    _internal: {
        mapSong: mapSong,
        mapSongList: mapSongList,
        deviceParams: deviceParams,
        DEVICE_PARAMS: DEVICE_PARAMS,
        QUALITY_FIELD: QUALITY_FIELD,
        ACBZ_KEYS: ACBZ_KEYS,
        ACBZ_XOR_TABLE: ACBZ_XOR_TABLE,
        ACBZ_IDX128: ACBZ_IDX128,
        ACBZ_XOR_OFF: ACBZ_XOR_OFF,
        HAS_HOST_ACBZ_PROXY: HAS_HOST_ACBZ_PROXY,
        ACBZ_DECRYPTORS: ACBZ_DECRYPTORS,
        tryDecryptHead: tryDecryptHead,
        isAudioMagic: isAudioMagic,
        attemptTkmXor: attemptTkmXor,
        attemptEdeK1K2K3: attemptEdeK1K2K3,
        fetchClassList: fetchClassList,
        fetchClassSongs: fetchClassSongs,
        fetchSonglistDetail: fetchSonglistDetail,
        fetchSongSheets: fetchSongSheets,
        fetchSongDetail: fetchSongDetail,
    },
};