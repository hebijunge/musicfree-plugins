/**
 * [v1.9.15 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「网易云音乐」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 网易云音乐独立源插件（MusicFree）v1.9.11
 * ================================
 * v1.9.15（2026-09-25 接口吸收版，基线 v1.9.14）：v1.9.15 接口吸收版（承接「23 个音乐插件可吸收取链接口」调研，实测存活口径 2026-09-25）：① P1-3 既有三路 eapi 通道响应解密修复——2026-09-25 真网探针实测 eapi 响应体为 AES-128-ECB 密文（同 key e82ckenh8dichen8），旧实现明文 JSON.parse 必失败致通道静默失效，本版改 arraybuffer 接收 + 纯 JS AES 解密（新增 aes128EcbDecrypt/bytesToUtf8/eapiParseResponseData）+ 明文错误响应兜底直解，修复后游客态免费曲（fee=0）实测取回 m8xx.music.126.net 官方直链、VIP/无版权 url=null 如实拒收接力；② P0-2 海棠 wy.php 直连兜底（music.haitangw.cc/music/wy.php，302/JSON 双形态，standard→standard/high→exhigh/super→lossless）挂 stdChain 与 high+ 链尾第二兜底（outerUrl 之前），不改变主链优先级，actualQuality 如实声明由外层守卫 fail-closed；详见头部 changelog；
 *   详情：版本字段行同款摘要，此处不重复展开。
 * v1.9.14（2026-09-24 长青 SVIP 网易替补通道接入版，基线 v1.9.13）：
 *  - 接入背景（2026-09-24 每日健康探测）：网易主力 yy.zddyr.top/lx/api 连续 2 天失效
 *    （09-23 http_0 超时、09-24 http_503 拒绝），网易竞速池失主力；长青 SVIP 网易
 *    HTTPS 入口（yinyue.haitangw.net/wy/wy.php）同日复测 6/8 档位可用且 magic 校验全过：
 *    standard（真 mp3 3.87MB）/exhigh（真 mp3 9.68MB）/lossless（真 FLAC 28.4MB）/
 *    flac/hires/jymaster（真 FLAC 28.4MB）；higher 间歇 502（不映射、不使用）。
 *  - 新增通道 netease:longqing（longqing_netease，长青 SVIP 网易）：GET
 *    https://yinyue.haitangw.net/wy/wy.php?type=mp3&id={songId}&level={level}，端点
 *    直出音频流（mp3/fLaC 容器），Range 0-15 魔数探测校验后以端点 URL 直接作为播放
 *    url 返回（无 br/size 字段；size 由 getMediaSource 既有 probeHeadSize 兜底）。
 *  - 竞速池注入（既有通道零改动、不删除任何既有通道）：长青通道作为星海主力
 *    yy.zddyr.top 的故障替补，靠后排——standard 接力链与 high+ 首段竞速两处均为
 *    zddyr().catch(longqing) 包裹，仅 zddyr 失败/503 后才启用，主力健康时零请求不抢跑。
 *  - 档位映射（请求哪个音质取哪个音质）：standard/low→standard、high→exhigh（长青
 *    exhigh 实测真 320k mp3）、super→lossless、hires→hires、master→jymaster、
 *    atmos/dolby→hires（尽力降级，actualQuality 如实标注，对齐海棠 haitangLevelOf 惯例）。
 *  - 320k 档位映射问题处理（任务实测长青服务端 320k 档实返 fLaC 28.4MB，服务端档位
 *    定义与内部口径不一致）：①内部 high 档一律请求 exhigh（真 320k），绝不请求 320k
 *    level；②有损档响应魔数守卫：standard/exhigh 请求检出 fLaC 视为服务端虚标拒收
 *    接力（防服务端后续把有损档也映射到无损）。verifyQualitySize 魔数兜底等既有
 *    音质大小比对逻辑零改动。
 *  - 失败重试与超时：复用竞速池既有机制（RELAY_TIMEOUT/SOURCE_TIMEOUT、withTimeout、
 *    全局 8s 预算、负缓存），长青通道无独立重试。
 * v1.9.12（2026-09-20 包升版，基线 v1.9.11）：QQ 源接入 a.aa.cab/qq.music 搜索型取链新通道（详见 qq-v1912.js 头部 changelog）；本源无代码改动，版本号随包统一升 v1.9.12。
 * v1.9.11（2026-09-12 星澜 stellarwave v4.0.0 可用通道接入版，基线 v1.9.10）：
 *  - 接入背景：星澜聚合音源 v4.0.0 实测报告（tx/wy 两链真实、kw/kg/mg 不可用或虚标）。
 *    任务「可用的就接入」：逐通道真网复测（3 歌 × 3 档，沙箱探针 probe-results.json），
 *    wy 侧实测可用的新后端通道接入竞速池，QQ 侧全部失效（详见 QQ 插件 v1.9.11 changelog）。
 *  - 新增通道 ① netease:stellarwave-zddyr（星澜 wy 星海主后端 yy.zddyr.top/lx/api/）：
 *    GET ?source=netease&songmid={id}&quality=128k|320k|flac，响应自带 quality/level/br/size
 *    实档字段。3 歌 × 3 档实测 6/9 可用：128k/320k 稳定（~0.6-3.1s）；flac 档部分歌 503
 *    或虚标（孤勇者 wy id 2737753398 flac 请求回 br=128000 mp3）。防虚标校验：lossless 请求
 *    br<700000 直接拒收接力 + fLaC 魔数二次校验（Range 0-15）；standard/high 按 br 如实标注
 *    （宁低勿高，实测 320k 请求回 128k 时如实标 128k）。
 *  - 新增通道 ② netease:stellarwave-cenguigui（星澜 wy 笒鬼鬼 api.cenguigui.cn
 *    /api/netease/music_v1.php）：GET ?id={id}&type=json&level=standard|exhigh|lossless。
 *    3 歌 × 3 档实测 9/9 全真（128k/320k mp3 大小随档递增、flac fLaC 魔数 53.4MB 实锤，
 *    ~1.3-2.0s）。防虚标校验：响应无 br 字段，返回真实字节数（data.size 解析）交由
 *    resolveWithFallback 按标称时长码率估档；lossless 请求必须 fLaC 魔数（实测 2737753398
 *    flac 请求回 3.90MB mp3，魔数校验拒收）。
 *  - 竞速池注入：standard 档第三方接力链 ikun 后插入两通道（oiapi 之前）；high/super/hires
 *    首段竞速追加两通道（海棠 + ikun + eapi 并发）。既有通道零改动。
 *  - 星澜其余 wy 后端复测失效不接入：残像 canxiang（空响应 ~5.1s）、念心 wy（404）、
 *    FishAPI/gdstudio（空响应）、FFAPI（接口已关闭）、HYWmusic（空响应）；
 *    星澜「网易云官方 eapi」= 本插件既有 neteaseEapiAnonResolve 同源实现（v1.6.0 起接入），
 *    端点 /eapi/song/enhance/player/url/v1 与 level 三档完全一致，无增量不重复接入。
 *  - 两通道返回 URL 均为 music.126.net 官方 CDN（iot1xx/iot2xx/m7xx/m8xx），命中既有
 *    http 域名白名单，无需新增。
 *
 * v1.9.5（2026-09-11 全页面音质标识核查 + VIP 标识移除版，基线 v1.9.4）：
 *  - 专辑/歌手作品页条目补 quals 音质标识（此前仅搜索/榜单/歌单带表）；
 *  - 全接口停写 fee（VIP 角标）字段，getMusicInfo 不再回填，feeOfNetease 移除；
 *  - alias（歌词搜索关键词）保留不受影响。
 * v1.9.4（2026-09-11 第三方取链修复 + size 字段版，基线 v1.9.3）：
 *  - 任务一：getMediaSource 返回值加 size 字段（单位：字节），供宿主下载前预估大小与播放前音质校验。
 *    size 取值优先级：取链响应直带 bytes（听会 inner.size）> HEAD 探测 Content-Range/Content-Length
 *    （getMediaSource 边界补 attachSizeIfMissing 兜底）> 留空。v1.9.3 各通道返回 url/actualQuality
 *    但未统一回填 size，本轮统一处理。
 *  - 任务二：第三方取链通道实测修复（2026-09-11 探针）。
 *    - 8 路实况：
 *       ① 海棠（musicserver.haitangw.cc/v1/music/resolve-url）：晴 503 UPSTREAM RESOLVE_FAILED，
 *          夜车/孤勇者等亦 503。本轮未动（竞速链容错，自动接力下一通道）。
 *       ② GD Studio / 星海 wy（music-api.gdstudio.xyz/api.php）：429 限流、免费歌返回空 url、
 *          通道冷却 5min。整体失效 → 移除。
 *       ③ 7boe（api.7boe.top/song/url）：免费歌 url=null，VIP 歌 trial clip，整体失效 → 移除。
 *       ④ SE 云音 sedet（music.sedet.top/api.php）：全档 url 空 + code 404（~3.9s），
 *          v1.1.0 已知失效，本轮正式从竞速池移除。
 *       ⑤ 听会（47.109.94.179/music_v1.php）：连接超时 / 站点 502，已死 → 移除。
 *       ⑥ oiapi（oiapi.net/api/Music_163）：免费歌正常 200 + url 完整，VIP 歌 pay:true 快速接力。
 *          本轮保留。
 *       ⑦ bugpk（api.bugpk.com）：限流 alive（标准 HTTP 429），保留。
 *       ⑧ ikun wy（c.wwwweb.top/music/url）：晴/夜车/孤勇者 alive，VIP 歌 500；保留。
 *       ⑨ outer/url（music.163.com/song/media/outer/url）：免费歌 302→官方 CDN mp3 alive；保留。
 *    - 处置：失效 4 通道（GD Studio / 7boe / Sedet / 听会）保留函数体注释掉、标注 2026-09-11
 *      失效日期，从竞速池移除——保留源码便于未来该端点恢复时复活。
 *    - 网络搜索新第三方网易云取链接口（hjkf.dynv6.net/wy 等 5 个候选）均为 404/接口关闭/
 *      要求付费，无新通道可接入。
 *
 * v1.9.3（2026-09-11 WebView 短链跟随修复版，基线 v1.9.2）：
 *  - 真机 WebView 下 XMLHttpRequest 会自动跟随 302 重定向，axios 的 maxRedirects:0
 *    仅 Node.js 生效 → followRedirects 拿到 status=200 且无 location，误判「无重定向」
 *    直接返回原始短链 → SHEET_URL_RESOLVERS 匹配不到 id 抛 SHEET_URL_UNRECOGNIZED
 *    （网易云 163cn.tv 短链真机导入失败场景，沙箱 Node 环境测不出）。
 *  - 修复：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——status=200 且
 *    res.request.responseURL 为绝对 URL 且异于当前 URL 时，视为 WebView 已自动跟随
 *    到最终页，取最终 URL 返回；Node 环境 res.request 无 responseURL，行为不变。
 *    5 跳手动跟随循环保留不变。
 *
 * v1.9.2（2026-09-11 分享链接文本自动提取 URL 版，基线 v1.9.1）：
 *  - 分享文本自动提取 URL：用户分享常带前后文字/emoji/换行（如「分享歌单 | xxx https://... 快来听」），
 *    旧版部分平台正则锚定开头（汽水域名门 ^https、咪咕短链 ^c.migu.cn、网易云短链 ^163cn.tv）
 *    导致识别失败。
 *  - 修复：resolveSheetId 入口统一先 extractShareUrl 提取第一个 http/https URL（任务给定正则
 *    [^\s<>"']+，另裁剪粘连在 URL 后的中文/全角字符与句尾标点），再走短链跟随/域名门/id 提取；
 *    提取不到（纯数字 id / 纯文本）保持原有行为不变。
 *  - 六平台（汽水/咪咕/网易云/QQ/酷我/酷狗）一致接入；带前缀文字（中文+emoji+空格）链接实测通过，
 *    纯 URL / 纯数字 id / 短链跟随回归不受影响。
 *
 * v1.9.1（2026-09-11 六平台歌单导入收尾版，基线 v1.9.0）：
 *  - 歌单对象补 author 别名字段：宿主 IMusicSheetItemBase 契约字段为 artist，
 *    任务字段清单要求 author，现两者都传（normalizeImportedMusicSheet spread 不受影响）。
 *  - 随包升版 v1.9.1；歌单导入功能性修复（咪咕/汽水短链、酷狗 gcid 全量）
 *    详见各自平台插件对应 changelog 与本轮六平台真实链接自测清单。
 *
 * v1.9.0 变更（2026-09-10，BakaMusic 高价值音源接入版，基于 v1.8.4）：
 *  - 零代码增量，随包升版 v1.9.0。BakaMusic 研究对照复核结论：
 *    ① P0 次合代 wy 通道 = 本插件既有 resolveNeteaseXinghai（GDStudio API_URL
 *      music-api.gdstudio.xyz，br 映射 128/320/740/999，含 429→5min 冷却治理）——
 *      同一端点同一形态，v1.3.1 起已在竞速池，不重复建设；
 *    ② P0 ikun wy 通道 = 本插件既有 resolveNeteaseIkun（c.wwwweb.top/music/url，
 *      atmos 档实测 fLaC ~92MB ≈2740kbps 全场最高音质，2026-09-10 复测通过）——
 *      v1.1.0 起已接入，atmos→atmos 映射与「宁低勿高」口径一致，不重复建设；
 *    ③ P1 全豆要 wy 通道不接入：BakaMusic 实测其网易云仅 128k，宣称 MasterAtmos
 *      属虚标（宁低勿高原则）；
 *    ④ P2 共享咪咕/聆澜付费档不接入（无卡密无法实测，报告同口径）。
 *
 * v1.8.4 变更（2026-09-10，歌单导入元数据版，基于 v1.8.3）：
 *  - P0 导入返回结构：importMusicSheet 由「歌曲数组」改为「完整 IMusicSheetItem 歌单对象」
 *    （id/platform/isImported/title/artwork/worksNum/musicList[/description/artist/playCount]）。
 *    此前返回数组走宿主旧插件兼容分支，normalizeImportedMusicSheet 的 sourceSheet=null，
 *    歌单标题落到 fallback「来自netease的歌单」——用户真机实测的标题缺失根因即此。
 *  - P0 歌单标题：v6/playlist/detail 响应自带 name/coverImgUrl/creator.nickname/trackCount
 *    （零额外请求），随列表顺带回传组装歌单对象；meta 拉取失败兜底「网易云歌单 #<id>」，
 *    宿主不再显示「来自{platform}的歌单」。
 *  - P0 歌单介绍：description 字段对齐宿主 v1.0.0 IMusic.IMusicSheetItemBase 契约字段名
 *    （宿主侧就叫 description，经 normalizeImportedMusicSheet 透传）；接口返回的
 *    pl.description 原文透传，无简介时不传该字段。
 * v1.8.3 变更（2026-09-10，质检遗留优化版，基于 v1.8.2，对应交叉质检报告问题清单）：
 *  - Q-02 错误消息前缀统一：sheetImportError 统一补 [netease] 前缀（对齐 qq/kuwo/migu/qishui）。
 *  - Q-03 兜底分支 code 统一：「该平台暂不支持歌单导入」SHEET_FETCH_FAILED →
 *    SHEET_URL_UNRECOGNIZED（对齐 qq/migu/qishui 口径）。
 *
 * v1.8.2 变更（2026-09-10，歌单解析修复版，基于 v1.8.1）：
 *  - P0-1 mobile URL：SHEET_URL_RESOLVERS.netease 正则放宽为
 *    music\.163\.com(?:\/m)?\/(?:#\/)?(?:discover\/)?playlist——兼容移动端 H5
 *    music.163.com/m/playlist?id=xxx（用户真实失败用例 6666112560 实测 125 首）
 *    与发现页 #/discover/playlist/?id=xxx 路由（报告 P2 #8 顺手修复）。
 *  - P1-3 短链格式：music.163.com/playlist/{id}（无 ?id= 参数）路径形态补齐正则回退；
 *    163cn.tv 短链既有 302 跟随链在新正则下自动生效。
 *  - P2 #6 歌单条目 platform：buildSheetItem 补 platform: entry.source（宿主
 *    canPlayMusicVideo 按 platform 反查插件依赖该字段，对齐 kuwo/qq 口径）。
 *  - P2 #12 错误码：歌单导入路径 throw 的 Error 补 code 字段
 *    （SHEET_URL_UNRECOGNIZED / SHEET_FETCH_FAILED / SHEET_EMPTY），文案不变。
 *  - 未修（记录）：报告 P2「qualities 仅 l/m 档」——v3/song/detail 批量接口对部分
 *    曲目只回 l/m 两档，逐首补音质会击穿插件方法 10s 硬上限（v1.3.0 已有结论，
 *    见 fetchNeteaseSongsByIds 注释），维持不修。
 * v1.8.0 变更（2026-09-10，MV 参数对齐基线，对照 MusicFree v1.0.0 宿主协议）：
 *  - P0-3 顶层守卫字段兜底：getMvSourceImpl 移除 `_src` 硬前置（此前外链导入/旧缓存条目
 *    若 musicItem._src 为空直接 return null，导致 canPlayMusicVideo=true 但 getMvSourceImpl
 *    仍取不到 MV）；改为 musicItem.mv / mvId / mvid 任一命中即把值映射回 _src.netease.mv
 *    （与酷我/QQ/咪咕 v1.8.0 顶层守卫字段兜底行为一致）。
 *  - P1-1 videoQuality 写回：getMvSourceImpl 内取链成功后 mv.videoQuality 命中即写回
 *    musicItem.videoQuality（try/catch 兜 frozen item，宿主 UI 切档后回显）。
 *  - P1-2 width/height：availableVideoQualities 补 width/height（按档位标称值 16:9 估算；
 *    网易云官方 MV 接口不返回尺寸信息，与酷我/QQ/咪咕 v1.8.0 兜底口径一致）。
 *  - P1-4 codec：网易云官方接口不返回独立 codec 字段（仅 r=240/480/720/1080 标号），
 *    不硬编，留空由宿主走默认。
 *  - P1-5 availableVideoQualities：官方/海棠双通道已在 v1.2.0 落地，本轮对齐酷我/QQ/咪咕
 *    口径统一为结构化对象 {key,label,width,height,mimeType}。
 *  - 海棠兜底 result 补 userAgent（对齐官方通道 userAgent 字段口径）。
 *  - 兼容性：插件级 primaryKey（['id']）+ canPlayMusicVideo 守卫（mv/mvId/mvid 任一 truthy
 *    且 plugin.supportedMethods.has('getMvSource')）保持不变；版本 v1.6.0→v1.8.0；
 *    node --check 通过；全部改动 edit 模式精确替换。
 * ================================
 * 由聚合搜索插件 v0.8.0 拆分：移除酷我/咪咕/酷狗/QQ/汽水五源，仅保留网易云源。
 * 搜索：网易云全量（歌曲/专辑/歌手/歌单/歌词）；
 * 取链：standard 档官方 128k GET 与 eapi 官方直连（AES-128-ECB e82ckenh8dichen8 + MD5 签名，
 *       需用户自备 Cookie）竞速；high/super/hires 档海棠 wy → 星海 API → 7boe 接力链，
 *       带试听片段守卫（freeTrialInfo / 内容长度探测）。
 * 歌词：LRC + 翻译（tlyric）+ 逐字歌词（YRC）。
 * 榜单：网易云官方榜（/api/toplist 全量 63 榜，免登录）。
 * 其余：歌单/单曲分享链接导入、专辑/歌手/歌单搜索与详情、MV 播放、推荐歌单广场、歌曲评论。
 * 兼容性：ES8 语法（async/await），不使用 ?. / ??（安卓端风险，官方技能包提示）。
 *
 * v1.6.0（go-music-dl 调研对齐，P0 + P1）：
 * - P0 匿名 eapi 取链通道 neteaseEapiAnonResolve（免 Cookie）：/eapi/song/enhance/player/url/v1，
 *   level=standard/exhigh/lossless 三档。payload 关键坑（2026-09-08 探针实测）：header 字段
 *   必须以「字符串化 JSON」内嵌（{"os":"pc","appver":"2.9.7","deviceId":"pyncm!"}），v1 端点
 *   传 br 数字会参数错误(400)只能传 level，建议同时带 encodeType:'flac'。免费歌（fee=0/8）
 *   实测 exhigh/lossless 均出 320k 官方直链（魔数 ID3、206 全长可达）——免费内容音质上限
 *   从官方免登录 128k 提到 320k/无损（歌曲自身有无损时）；VIP 歌匿名 url=null / 试听片段，
 *   freeTrialInfo 守卫拒收后照常落第三方链，行为无损。接入位置：standard 档官方 128k 竞速组、
 *   high/super 档首段竞速组（hires/atmos/master/dolby 匿名不可用，维持 Cookie 专用）。
 * - P1 YRC 逐字歌词：v1.4.x 已实现（/api/song/lyric yv=1 → yrcToQrcSource 转宿主 QRC 格式
 *   rawLrc 返回），本轮实测回归 3 首歌确认格式与逐字标签数量，无需改码。
 * - P1 搜索 result.songs 解析路径核验：cloudsearch / search/get/web 等入口均为 result.songs
 *   （非 data.songs），实测确认在位无需改码。
 * - 版本 v1.5.1 → v1.6.0；node --check 通过；全部改动 edit 模式精确替换。
 *
 * v1.5.1（字段补齐：fee VIP 标记 + alias 别名，对齐宿主字段需求清单/分析报告）：
 * - P1 fee：搜索（cloudsearch type=1/1006）、歌词搜索、歌单/榜单/专辑/歌手作品条目、
 *   单曲详情（v3/song/detail）及 getMusicInfo 补齐，全链路透传 t.fee
 *   （0=免费 1=VIP 4=购买专辑 8=低音质免费，接口文档实测节；仅数值才透传）。
 *   宿主 fee===1 判断在详情页显示 VIP 角标，无需宿主改动。
 *   注：getMediaSource 协议（IMediaSourceResult）无 fee 字段，取链结果不涉及该补齐。
 * - P2 alias：t.alia（别名数组，优先）/ t.tns（翻译名数组）拼接透传，
 *   宿主歌词搜索关键词（alias 优先）、搜索封面副标题与 metadata 备注消费。
 * - P2 核实项：primaryKey: ['id']（v1.2.0 起）与 supportedSearchType 含 'lyric'
 *   （v1.5.0 起）均已在位且正确，本轮核验无需改动。
 *
 * v1.5.0（歌词搜索，对齐酷我/QQ/咪咕接入方式）：
 * - 歌词搜索接入：supportedSearchType 增 'lyric'，search() 增 lyric 分支——宿主歌词关联
 *   面板（searchLrc，歌曲详情页「搜索歌词」入口）调 search(q, page, 'lyric')，期望
 *   ILyricItem[] = IMusicItem 字段 + rawLrcTxt（纯文本歌词预览）。
 * - 接口：GET /api/cloudsearch/pc type=1006（接口文档 §2.3 实测 2026-09-08）。响应条目自带
 *   lyrics 歌词片段（行数组、命中行带 <b> 高亮，拼接后即纯文本预览）——一次请求同时拿到
 *   歌曲元数据（ar/al 含封面、h/m/l/sq 音质表、dt/fee/mv）与歌词预览，零二次请求
 *   （酷我搜索响应无歌词片段字段才做并发预览补拉，网易云无需）。
 * - 结果口径与单曲搜索一致：复用 aggregateItems/scoreOf/buildMusicItem（稳定 id =
 *   netease_sid、_src 保留、qualities 音质表挂载），选中条目后 getMediaSource/getLyric
 *   链路与普通搜索结果完全一致；分页 limit/offset 与单曲搜索同参（SEARCH_PAGE_SIZE）。
 * - 同曲去重保留首条（上游 alg_search_precision_lyric_tab 相关性序，首条歌词匹配度最高）。
 * - 顺带修复（既有缺陷）：cloudsearch 新格式时长字段为 dt（ms），旧 searchNetease 只读
 *   duration → 单曲搜索结果时长恒缺失（v1.4.0 及之前即存在，实测复现）；两个歌曲映射器
 *   统一改为 duration || dt，MV/详情等旧格式接口不受影响。
 *
 * v1.4.0（曲链效率优化：URL 结果缓存 + VIP 标准档竞速 + 官方通道免守卫）：
 * - 优化1 URL 结果缓存：resolveWithFallback 成功后按 'id|quality' 缓存
 *   {url,channel,actualQuality,bytes}，LRU 上限 200 条、TTL 30min（第三方 CDN 直链实测
 *   有效期 ~2h，留足安全余量）；命中直接返回、跳过全链与守卫（写入前已过白名单+守卫）。
 *   成功缓存与失败负缓存键同名但独立存储，成功后既有 resolveNegCacheDel 清负缓存逻辑不变。
 * - 优化2 VIP 歌 standard 档听会⇄ikun 竞速：仅官方全败进入第三方接力时生效（免费歌官方
 *   直连成功不经过此段，行为不变），串行 ~645ms → 竞速取最快 ~250ms（实测基准）。
 * - 优化3 官方 128k 通道跳过守卫：netease-official-128k 直出 126.net 官方 CDN、无试听截断
 *   （freeTrialInfo 已在适配器内拦截），省 20-90ms HEAD 探测开销；isAllowedMediaUrl 白名单
 *   校验对官方通道保留；其余通道守卫照旧。
 * - 基准对比（VIP《孤勇者》1901371647 / 免费《晴天(DJ版)》2730151393，五档，2026-09-08 沙箱
 *   实测）随交付说明给出。
 *
 * v1.3.2（fix 免费歌高档偶发全链失败）：
 * - 定位：high+ 接力链此前止于听会/ikun，缺少官方 outer/url 终极兜底（仅 standard 档有）。
 *   免费歌走 hires/atmos/master 档时，bugpk 单 IP 2QPS 限流（实测 520）、7boe 公共实例部分歌
 *   无 url、星海/海棠抖动叠加即全链失败（实测复现）；60s 负缓存使重试也快速失败，体感"偶发坏档"。
 * - 修复：high+ 接力链尾追加 resolveNeteaseOuterUrl——免费歌 302→官方 CDN mp3 稳定降级 128k
 *   （actualQuality 如实标 128k）；VIP 歌 302→HTML 被既有 redirect-非-CDN 守卫秒拒，VIP 语义不变。
 * - 附带确认：部分"免费歌"（如 186016）当前官方 128k 接口亦返回 no url、outer/url 302→404，
 *   属歌曲本身暂不可播，全链失败为正确行为，非插件缺陷。
 *
 * v1.3.1（第三方取链通道扩充：听会音乐 + ikun音源，接口文档实测整合版）：
 * - P1 新增听会通道（resolveNeteaseTinghui）：GET 47.109.94.179/music_v1.php，5 档
 *   standard/exhigh/lossless/hires/jymaster 全真（实测 jymaster 155.2MB fLaC，~500ms，免 Cookie）；
 *   ⚠️ 免费歌高档 code=200 但 url 为中文错误文案 → 校验 url 以 http 开头后快速失败。
 * - P1 新增 ikun 通道（resolveNeteaseIkun）：POST c.wwwweb.top/music/url（X-API-Key 空串，
 *   ⚠️ 参数名 musicId 非 songId），6 档 128k/320k/flac/hires/atmos/master，官方 126.net CDN 直链；
 *   响应 quality 为实际交付档位，如实标注 actualQuality。
 * - P1 接线：standard 兜底链 听会→ikun 置于 oiapi 之前（VIP 歌免 Cookie 可取真档）；
 *   high+ 竞速首段扩为 海棠+听会+ikun(+星海+eapi-v1)，接力链 7boe 后追加听会/ikun 二次兜底。
 * - P1 音质诚实性：听会响应无音质字段 → 返回真实字节数（data.size），由 resolveWithFallback
 *   用标称时长按码率估档补 actualQuality（阈值按孤勇者实测标定，宁低勿高；时长未知不填）。
 * - 实测不接入 HYWmusic：flac 档静默降级 128k 且响应无 quality 字段（违反 actualQuality
 *   诚实原则），且本质为 gdstudio 包装、与既有星海通道同源无增量。
 *
 * v1.2.1（歌单分类走查修正）：
 * - P1 分类浮层组标题修正：getRecommendSheetTags 的 data 分组标题改用 catalogue 返回的真实分类名
 *   （categories {0:语种, 1:风格, 2:场景, 3:情感, 4:主题}），此前硬编码「华语/欧美/亚洲/怀旧/综艺」
 *   （实为各组首个标签名），宿主「全部分类」浮层组标题显示错误；pinned 扁平结构与各标签取数逻辑不变。
 *
 * v1.2.0（对齐 baka 网易云 v1.1.0）：
 * - P0 pinned 结构修正：getRecommendSheetTags 的 pinned 改为宿主期望的扁平标签数组
 *   （catalogue sub[].hot 热门标签 + 精品歌单入口），修复歌单分类横向 pinned 无法显示；
 * - P0 默认分类补齐：getRecommendSheetsByTag 空 tag id 视为「全部」（hot 歌单列表）；
 * - P1 MV 返回字段富化：回填实际档位 r/size/expiresAt/headers/availableVideoQualities；
 * - P1 歌曲对象新增 qualities 音质表（l/m/h/sq/hr + privilege 推导），
 *   宿主音质菜单优先消费该字段，只展示歌曲实际可用档位；
 * - P1 新增 getMusicDetailPageUrl（歌曲分享链接）；
 * - P2 歌词新增 romanization（罗马音，/api/song/lyric rv=-1）；
 * - P2 新增 primaryKey: ['id']（宿主 mediameta 存储约定）。
 * 不采纳项：MV 4K 档（官方接口 r=2160 实测降级 1080）、
 * baka 预填第三方 url 字段（share.duan.cn，与现取直链策略冲突）。
 * [v1.5.0 备注] v1.4.0 前述「不采纳 baka 歌词搜索」已过时：宿主搜索页虽无 lyric tab，
 * 但歌词关联面板（searchLrc）以 search(q, page, 'lyric') 调用，本轮已按酷我/QQ/咪咕
 * 同款方式接入（见 v1.5.0 段）。
 *
 * v1.3.0（音质传递补全 + 增强档位声明，对齐 baka 差距清单）：
 * - P0 getMusicInfo 返回 qualities：宿主下载/音质面板在 qualities 缺失或无 size 时会调 getMusicInfo
 *   补大小，此前只补封面/专辑/时长/MV 导致文件大小永远补不上；现在把 v3/song/detail 的 t 喂给
 *   qualMapOfNetease 后合并回填（已有档位不覆盖，仅补缺失/无 size 档）；
 * - P0 单曲详情解析补 quals：SONG_DETAIL_FETCHERS.netease 此前丢弃 l/m/h/sq/hr 尺寸，
 *   单曲导入条目无音质表；现在同样挂 qualMapOfNetease 结果，importMusicItem 即刻带音质大小；
 * - P1 增强档位声明：supportedQualities 新增 atmos/master/dolby（此前折叠进 hires），
 *   eapi-v1 level 映射 sky/jymaster/dolby（需 VIP Cookie），第三方备源无对应档位时按
 *   hires/lossless 尽力降级并按响应如实标注 actualQuality；未配置 Cookie 自动回落第三方链；
 * - P1 歌单分页性能：批量详情单批超时收紧到 SOURCE_TIMEOUT，500 首最坏 5×4.5s < 宿主 30s RPC
 *   上限（baka 歌单逐首补音质超 30s 超时教训）；维持批量接口自带尺寸、不逐首补音质；
 * - P2 逐字歌词修复：getWordByWordLyric 改为 ILyricSource { rawLrc } 返回（此前返回裸 YRC 字符串，
 *   宿主只消费 lrcSource.rawLrc，逐字歌词实际未生效），并过滤 YRC 头部 JSON 元数据行/注释行。
 */

const axios = require('axios');

// ==================== [v1.2.0] 歌曲音质表推导（对齐 baka applyPrivilegeQualities）====================
// 宿主 getAvailableQualities 优先消费 musicItem.qualities（utils/qualities.ts），
// 有该字段时音质菜单只显示歌曲实际可用档位；缺失则回退显示插件声明全集（会虚标不可用档）。
// 网易云 cloudsearch/榜单/歌单条目自带 l/m/h/sq/hr 尺寸与 privilege（maxbr/maxBrLevel），
// 据此推导：128k/192k/320k/flac/hires + master/jm、atmos/sk|je、dolby/db（v1.3.0 起声明）。
function qualEntry(size, br) {
  var e = {};
  if (size) e.size = size;
  if (br) e.bitrate = br;
  return e;
}

function qualMapOfNetease(t) {
  if (!t || typeof t !== 'object') return undefined;
  var q = {};
  if (t.l && t.l.size) q['128k'] = qualEntry(t.l.size, t.l.br || 128000);
  if (t.m && t.m.size) q['192k'] = qualEntry(t.m.size, t.m.br || 192000);
  if (t.h && t.h.size) q['320k'] = qualEntry(t.h.size, t.h.br || 320000);
  if (t.sq && t.sq.size) q['flac'] = qualEntry(t.sq.size, t.sq.br || 1411000);
  if (t.hr && t.hr.size) q['hires'] = qualEntry(t.hr.size, t.hr.br || 2304000);
  // [v1.3.0 P1] 增强档位：jm=超清母带（master）、sk/je=沉浸环绕（atmos，sk 优先）、db=杜比全景声（dolby）。
  // 需 VIP 才有真实尺寸；免登录/普通账号列表不回这些字段，不虚标。
  if (t.jm && t.jm.size) q['master'] = qualEntry(t.jm.size, t.jm.br || 1999000);
  if ((t.sk && t.sk.size) || (t.je && t.je.size)) {
    var at = (t.sk && t.sk.size) ? t.sk : t.je;
    q['atmos'] = qualEntry(at.size, at.br || 3450000);
  }
  if (t.db && t.db.size) q['dolby'] = qualEntry(t.db.size, t.db.br || 3450000);
  // privilege 兜底：列表接口缺尺寸时，按最大码率/档位补「可用」标记
  var pv = t.privilege;
  if (pv) {
    var maxbr = Number(pv.maxbr || pv.playMaxbr || 0);
    if (maxbr >= 128000 && !q['128k']) q['128k'] = qualEntry(0, 128000);
    if (maxbr >= 192000 && !q['192k']) q['192k'] = qualEntry(0, 192000);
    if (maxbr >= 320000 && !q['320k']) q['320k'] = qualEntry(0, 320000);
    if (maxbr >= 999000 && !q['flac']) q['flac'] = qualEntry(0, 1411000);
    var level = String(pv.maxBrLevel || pv.maxbrLevel || pv.playMaxBrLevel || '').toLowerCase();
    if (!q['flac'] && /lossless|sq/.test(level)) q['flac'] = qualEntry(0, 1411000);
    if (!q['hires'] && (maxbr >= 1999000 || /hires|hr/.test(level))) q['hires'] = qualEntry(0, 2304000);
    // [v1.3.0 P1] 增强档位 privilege 兜底：maxBrLevel 命中即标「可用」（无 size，仅档位标记）
    if (!q['master'] && /jymaster/.test(level)) q['master'] = qualEntry(0, 1999000);
    if (!q['atmos'] && /sky|jyeffect/.test(level)) q['atmos'] = qualEntry(0, 3450000);
    if (!q['dolby'] && /dolby/.test(level)) q['dolby'] = qualEntry(0, 3450000);
  }
  if (Object.keys(q).length === 0) return undefined;
  return q;
}

// ==================== 通用工具 ====================

var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
// v0.7.1 P1-3：取链全局超时预算。宿主 getMediaSource 单方法 10s 硬上限，
// 原实现最坏 6 段 × 4.5s × 3 候选源 ≈ 81s 必然被掐断。
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
var RELAY_TIMEOUT = 2500;     // 接力段（备源）单请求超时，首段仍用 SOURCE_TIMEOUT
var DURATION_TOLERANCE_SEC = 6;

function str(v) { return v === undefined || v === null ? '' : String(v); }

function splitArtists(list) {
  if (!list || !list.length) return '';
  var names = [];
  for (var i = 0; i < list.length; i++) {
    var n = list[i] && list[i].name;
    if (n) names.push(String(n));
  }
  return names.join(', ');
}

function firstAlbumName(albums) {
  if (albums && albums.length && albums[0] && albums[0].name) return String(albums[0].name);
  return '';
}

// ==================== 归一化与同曲判定（移植自 yinliu-app/src/core/search/songMatch.ts / versionTags.ts）====================

function normalizeTitle(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[·・~～_]/g, '')
    .trim();
}

function normalizeArtist(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .split(/\s*(?:[、，,/&]|\bfeaturing\b|\bfeat\.?|\bft\.?)\s*/i)[0]
    .replace(/\s+/g, '') // 歌手名内空白归一（跨源 "Jay Chou" vs "Jay  Chou"）
    .trim();
}

function makeKey(title, artist) {
  return normalizeTitle(title) + '|' + normalizeArtist(artist);
}

// 宽松标题键：进一步剥离裸露的版本词（不依赖括号），
// 使「晴天 Live」与「晴天(Live)」这类跨源写法归到同一键；
// 原版/版本差异仍由 versionCompatible 把关，此处只放宽键比较。
var VERSION_WORD_RE = /\b(?:live|remix|piano|acoustic|covers?|dj|instrumental)\b|现场|混音|改编|钢琴|对唱|合唱|翻唱|伴奏|纯音乐/gi;
function looseTitleKey(rawTitle) {
  return normalizeTitle(String(rawTitle || '').replace(VERSION_WORD_RE, ''));
}

var FEAT_TAIL_RE = /\s*(?:\bfeaturing\b|\bfeat\.?|\bft\.?).*$/i;

var VERSION_HINTS = [
  { re: /\blive\b|现场/i, tag: 'live' },
  { re: /\bremix\b|混音|改编/i, tag: 'remix' },
  { re: /\bpiano\b|钢琴/i, tag: 'piano' },
  { re: /\bacoustic\b/i, tag: 'acoustic' },
  { re: /对唱|合唱/i, tag: 'duet' },
  { re: /\bcovers?\b|翻唱/i, tag: 'cover' },
  { re: /伴奏|\binstrumental\b|纯音乐/i, tag: 'instrumental' }
];

var PACKAGING_HINT_RE = /主题曲|片头曲|片尾曲|插曲|推广曲|概念曲|宣传曲|\bOST\b|\bsoundtrack\b/i;
var MEDIA_HINT_RE = /hi-?res|无损|高品质|\bsq\b|\bflac\b|4K|1080P|高清|3D环绕|立体|8D|重低音/i;

function detectDj(title) {
  var brackets = String(title).match(/（[^）]*）|\([^)]*\)|【[^】]*】|\[[^\]]*\]/g) || [];
  for (var i = 0; i < brackets.length; i++) {
    if (/\bdj\b/i.test(brackets[i])) return true;
  }
  var tail = (String(title).split(/\s*[-—–|｜]\s*/).pop() || '').trim();
  return /\bdj(版|version)?\s*$/i.test(tail);
}

function parseVersionTags(rawTitle) {
  var title = String(rawTitle || '').replace(FEAT_TAIL_RE, '');
  var versions = [];
  for (var i = 0; i < VERSION_HINTS.length; i++) {
    if (VERSION_HINTS[i].re.test(title)) versions.push(VERSION_HINTS[i].tag);
  }
  if (detectDj(title)) versions.push('dj');
  var pm = title.match(PACKAGING_HINT_RE);
  var mm = title.match(MEDIA_HINT_RE);
  return {
    versions: versions,
    packaging: pm ? [pm[0]] : [],
    media: mm ? [mm[0]] : []
  };
}

function versionCompatible(a, b) {
  var av = a.versions.slice().sort();
  var bv = b.versions.slice().sort();
  var seenA = {}, ua = [], seenB = {}, ub = [], i;
  for (i = 0; i < av.length; i++) { if (!seenA[av[i]]) { seenA[av[i]] = 1; ua.push(av[i]); } }
  for (i = 0; i < bv.length; i++) { if (!seenB[bv[i]]) { seenB[bv[i]] = 1; ub.push(bv[i]); } }
  if (ua.length === 0 && ub.length === 0) return true;
  if (ua.length === 0 || ub.length === 0) return false;
  if (ua.length !== ub.length) return false;
  for (i = 0; i < ua.length; i++) { if (ua[i] !== ub[i]) return false; }
  return true;
}

var TAG_TIER = {
  live: 0.85, remix: 0.85, piano: 0.85, acoustic: 0.85, duet: 0.85,
  dj: 0.40, cover: 0.40, instrumental: 0.30
};

function versionTier(parse) {
  var tier = 1.0;
  for (var i = 0; i < parse.versions.length; i++) {
    var t = TAG_TIER[parse.versions[i]];
    if (t !== undefined && t < tier) tier = t;
  }
  return tier;
}

/**
 * 同曲判定（P0 口径）：
 * 1. 归一化 key 相同；2. 版本标签互斥判定；3. 双方有时长 → ±6s 容差；
 * 4. 任一方缺时长 → 仅同源同 id（跨音质重复行）合并；
 *    任一方缺时长时放宽为「专辑名也一致」才合并
 *    （比音流 P0 的「一律不合并」略宽，避免整源条目全部无法归组）。
 */
function isSameSong(a, b) {
  if (normalizeTitle(a.title) !== normalizeTitle(b.title)) {
    // 严格键不等时走宽松键（剥离裸露版本词）：
    // 「晴天 Live」 vs 「晴天(Live)」归到同键；「晴天」 vs 「晴天 Live」宽松键也相等，
    // 但会被下方 versionCompatible 判为版本互斥 → 仍不合并。
    if (looseTitleKey(a.title) !== looseTitleKey(b.title)) return false;
  }
  if (normalizeArtist(a.artist) !== normalizeArtist(b.artist)) return false;
  if (!versionCompatible(parseVersionTags(a.title), parseVersionTags(b.title))) return false;
  if (a.duration && b.duration) {
    return Math.abs(a.duration - b.duration) <= DURATION_TOLERANCE_SEC;
  }
  if (a.source && a.sid && a.source === b.source && a.sid === b.sid) return true;
  if (a.duration || b.duration) {
    // 一方有时长一方缺 → 需专辑名一致（归一化）才允许跨源合并
    return !!a.album && !!b.album &&
      normalizeTitle(a.album) === normalizeTitle(b.album);
  }
  return false;
}

// ==================== 源权重与音质能力 ====================

var SOURCE_WEIGHT = {
  netease: 1.00
};

// 音质能力：standard=128k（官方直连）/ high=320k / super=无损 FLAC / hires=Hi-Res 24bit
// [v1.3.0 P1] atmos/master/dolby 增强档（eapi-v1 需 VIP Cookie，第三方链按 hires 降级）
// high/super/hires 走海棠 wy → 星海 → 7boe 接力链；standard 走官方 128k GET 与 eapi 官方直连竞速
var SOURCE_QUALITIES = {
  netease: ['standard', 'high', 'super', 'hires', 'atmos', 'master', 'dolby']
};

function canServe(source, quality) {
  var caps = SOURCE_QUALITIES[source] || [];
  return caps.indexOf(quality) >= 0;
}

// ==================== 搜索适配器（网易云） ====================
// 每个适配器返回统一内部条目：
// { source, sid, title, artist, album, duration(sec, 可为0), artwork, raw }

function neteaseHeaders() {
  var headers = { Referer: 'https://music.163.com/' };
  var env = typeof global !== 'undefined' && global.env ? global.env : null;
  if (env && env.getUserVariables) {
    try {
      var uv = env.getUserVariables();
      if (uv && uv.neteaseCookie) headers.Cookie = String(uv.neteaseCookie);
    } catch (e) { /* 免登录继续 */ }
  }
  return headers;
}

// ==================== [v1.5.1 -> v1.9.5] alias 公共映射 ====================
// （v1.9.5 起 feeOfNetease/VIP 标识透传整体移除，宿主不再渲染 VIP 角标）
// alias：别名（t.alia 数组，优先）→ 翻译名（t.tns 数组）兜底，'/' 拼接为字符串；
// 宿主歌词搜索关键词（alias 优先）、搜索封面副标题与 metadata 备注消费。无别名为空串。
function aliasOfNetease(t) {
  var a = Array.isArray(t.alia) && t.alia.length ? t.alia
    : (Array.isArray(t.tns) && t.tns.length ? t.tns : null);
  return a ? a.join('/') : '';
}

function searchNetease(query, page) {
  // cloudsearch（/api/cloudsearch/pc）的 al.picUrl 全量返回；
  // 旧 search/get 实测 album 无 picUrl 字段（2026-09-05 探针），封面缺失故切换。
  var headers = neteaseHeaders();
  return axios.get('https://music.163.com/api/cloudsearch/pc', {
    params: { s: query, type: 1, limit: 20, offset: (page - 1) * 20 },
    timeout: SOURCE_TIMEOUT, headers: headers
  }).then(function (res) {
    var result = res.data && res.data.result;
    var list = (result && result.songs) || [];
    return list.map(function (it) {
      return {
        source: 'netease', sid: str(it.id),
        title: str(it.name), artist: splitArtists(it.ar),
        album: it.al && it.al.name ? String(it.al.name) : '',
        // [v1.5.0 顺带修复] cloudsearch 新格式时长在 dt（ms），旧代码只读 duration → 搜索结果时长恒缺失
        duration: (it.duration || it.dt) ? Math.round((it.duration || it.dt) / 1000) : 0,
        artwork: it.al && it.al.picUrl ? String(it.al.picUrl) : '',
        alias: aliasOfNetease(it), // [v1.5.1 P2] 别名（歌词搜索关键词 alias 优先）
        raw: { id: str(it.id), mv: it.mv ? String(it.mv) : '' },
        quals: qualMapOfNetease(it)
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

var SEARCH_ADAPTERS = {
  netease: searchNetease
};

// ==================== [v1.5.0] 歌词搜索 ====================
// 宿主歌词关联面板（searchLrc，歌曲详情页「搜索歌词」入口）调 search(q, page, 'lyric')，
// 期望 ILyricItem[] = IMusicItem 字段 + rawLrcTxt（纯文本歌词预览）。
// 接口文档 §2.3 实测（2026-09-08）：cloudsearch/pc 支持 type=1006 歌词搜索，响应条目自带
// lyrics.txt（纯文本歌词全文）——一次请求同时拿到歌曲元数据（ar/al 含封面 picUrl、
// h/m/l/sq 音质表、duration/fee/mv）与歌词预览，无需二次拉词补封面
// （酷我搜索响应无歌词片段字段才做并发预览补拉，网易云零额外请求）。

// ⚠️ 页大小在函数体内直接引用 SEARCH_PAGE_SIZE（调用时已求值）：v1.5.0 初版曾用
// `var LYRIC_SEARCH_PAGE_SIZE = SEARCH_PAGE_SIZE` 在 L376 处捕获——该行先于 SEARCH_PAGE_SIZE
// 定义行（L2000+）执行，var 提升值为 undefined，请求丢失 limit 参数（实测复现）。
var LYRIC_PREVIEW_CHARS = 800;

// 歌词搜索适配器：cloudsearch/pc type=1006。返回内部条目（同 searchNetease 口径）
// 外加 _lyricTxt（上游歌词全文，供 lyricSearchImpl 截取为 rawLrcTxt）。
function searchLyricNetease(q, page) {
  var headers = neteaseHeaders();
  return axios.get('https://music.163.com/api/cloudsearch/pc', {
    params: { s: q, type: 1006, limit: SEARCH_PAGE_SIZE, offset: (page - 1) * SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT, headers: headers
  }).then(function (res) {
    var result = res.data && res.data.result;
    var list = (result && result.songs) || [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || !it.id || !it.name) continue;
      var sid = str(it.id);
      if (seen[sid]) continue; // 同曲去重：保留首条（上游歌词相关性序，首条匹配度最高）
      seen[sid] = true;
      // 歌词片段解析：cloudsearch/pc 1006 的 lyrics 为行数组（带 <b>高亮</b>）；旧 search/get
      // 为 {txt} 对象。两种形态都兼容，统一剥高亮标记后作为 rawLrcTxt 预览来源。
      var lrcRaw = it.lyrics;
      var lrcTxt = Array.isArray(lrcRaw) ? lrcRaw.join('\n')
        : (lrcRaw && lrcRaw.txt ? String(lrcRaw.txt) : '');
      lrcTxt = lrcTxt.replace(/<\/?b>/g, '');
      out.push({
        source: 'netease', sid: sid,
        title: str(it.name), artist: splitArtists(it.ar),
        album: it.al && it.al.name ? String(it.al.name) : '',
        // cloudsearch 新格式时长在 dt（ms）；兼容旧 duration 字段
        duration: (it.duration || it.dt) ? Math.round((it.duration || it.dt) / 1000) : 0,
        artwork: it.al && it.al.picUrl ? String(it.al.picUrl) : '',
        raw: { id: sid, mv: it.mv ? String(it.mv) : '' },
        alias: aliasOfNetease(it), // [v1.5.1 P2] 别名（歌词搜索关键词 alias 优先）
        quals: qualMapOfNetease(it),
        _lyricTxt: lrcTxt
      });
    }
    return out;
  });
}

// 歌词搜索主实现：聚合/评分/构建复用单曲搜索口径（稳定 id、_src 保留、音质表挂载），
// 选中条目后 getMediaSource/getLyric 链路与普通搜索结果完全一致。
async function lyricSearchImpl(q, page) {
  // [v1.1.0 P2-1 同款] 失败 null 与「空结果 []」区分：零结果不误报「搜索失败」
  var items = await searchLyricNetease(q, page).catch(function () { return null; });
  if (items === null) throw new Error('歌词搜索失败：网易云请求失败');
  var groups = aggregateItems(items);
  var scored = groups.map(function (g, idx) {
    return { g: g, score: scoreOf(g.members[0], g.members.length), idx: idx };
  });
  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx; // 稳定排序：同分保持上游歌词相关性序
  });
  var data = [];
  for (var i = 0; i < scored.length; i++) {
    var mi = buildMusicItem(scored[i].g);
    // rawLrcTxt：取组内首个带歌词文本的成员（cloudsearch 1006 自带，零额外请求）；
    // 无歌词文本的条目置空串（协议字段存在），选中后宿主走 getLyric 取完整歌词
    var txt = '';
    var members = scored[i].g.members;
    for (var m = 0; m < members.length && !txt; m++) txt = members[m]._lyricTxt || '';
    if (txt.length > LYRIC_PREVIEW_CHARS) txt = txt.slice(0, LYRIC_PREVIEW_CHARS) + '…';
    mi.rawLrcTxt = txt;
    data.push(mi);
  }
  // isEnd 与单曲搜索同口径：按原始返回条数判断（聚合去重变少不代表没有下一页）
  return { isEnd: items.length < SEARCH_PAGE_SIZE, data: data };
}

// ==================== 聚合层 ====================

function scoreOf(item, hitSources) {
  var tier = versionTier(parseVersionTags(item.title));
  var w = SOURCE_WEIGHT[item.source] || 0.5;
  return tier * w * (1 + 0.15 * (hitSources - 1));
}

function aggregateItems(items) {
  var groups = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var merged = false;
    for (var g = 0; g < groups.length && !merged; g++) {
      var members = groups[g].members;
      for (var m = 0; m < members.length; m++) {
        if (isSameSong(members[m], it)) {
          members.push(it);
          merged = true;
          break;
        }
      }
    }
    if (!merged) groups.push({ members: [it] });
  }
  return groups;
}

function buildMusicItem(group) {
  // v0.7.1 P1-2：id 改为稳定的 source_sid（与 importMusicSheetImpl/buildSheetItem 的身份方案一致），
  // 去掉页内序号 seq——seq 随搜索词/翻页/各源命中数变化，同一首歌两次搜索 id 不同，
  // 宿主侧会判为不同歌曲（收藏/历史/歌单重复）。
  var members = group.members;
  // 代表条目 = 组内得分最高（同分且代表缺时长时，取有时长者）
  var best = members[0];
  var bestScore = -1;
  for (var i = 0; i < members.length; i++) {
    var s = scoreOf(members[i], members.length);
    if (s > bestScore || (s === bestScore && members[i].duration > 0 && best.duration === 0)) {
      bestScore = s; best = members[i];
    }
  }
  // 多源映射（同源多条取第一条）
  var src = {};
  for (var j = 0; j < members.length; j++) {
    var mm = members[j];
    if (!src[mm.source]) src[mm.source] = mm.raw;
  }
  // 展示字段：封面/时长取首个非空（按成员得分序）
  var artwork = best.artwork;
  var duration = best.duration;
  for (var k = 0; k < members.length && (!artwork || !duration); k++) {
    if (!artwork && members[k].artwork) artwork = members[k].artwork;
    if (!duration && members[k].duration) duration = members[k].duration;
  }
  // _srcOrder：源优先序（代表源置顶，其余按成员序），歌词/详情取数时原生源优先
  var srcOrder = [];
  for (var om = 0; om < members.length; om++) {
    if (srcOrder.indexOf(members[om].source) < 0) srcOrder.push(members[om].source);
  }
  var item = {
    id: best.source + '_' + best.sid, // v0.7.1 P1-2：稳定身份，不再拼页内序号
    title: best.title,
    artist: best.artist,
    album: best.album,
    artwork: artwork || undefined,
    duration: duration || undefined,
    _src: src,
    _srcOrder: srcOrder
  };
  // [v1.2.0] 歌曲音质表：宿主音质菜单优先消费（取代表条目，缺则取首个带表的成员）
  var quals = best.quals;
  for (var qi = 0; qi < members.length && !quals; qi++) {
    if (members[qi].quals) quals = members[qi].quals;
  }
  if (quals) item.qualities = quals;
  if (src.netease && src.netease.mv) item.mv = String(src.netease.mv);
  // [v1.5.1 -> v1.9.5] alias：代表条目优先，缺则取首个带值成员（歌词搜索关键词）；
  // v1.9.5 起 fee（VIP 角标）字段全面停写不再透传。
  for (var fi = 0; fi < members.length; fi++) {
    if (!item.alias && members[fi].alias) item.alias = members[fi].alias;
  }
  return item;
}

// ==================== 网易云官方榜（v0.8.0） ====================
// 文档 §9 实测：GET /api/toplist 免登录返回全量官方榜（飙升/新歌/热歌/原创/说唱/电音等 63 个），
// 含榜单 ID/名称/封面/updateFrequency（「每日更新」「刚刚更新」等更新频率文案，作条目 description）。
// 榜单=特殊歌单（文档 §16.3-10），详情复用 SHEET_FETCHERS.netease（playlist/trackIds 全量展开）。
// 条目 id 加 ne~ 前缀；2026-09-06 沙箱复测：code=200，热歌榜 updateTime 有效。
var NE_CHART_PREFIX = 'ne~';
var NE_TOPLIST_TTL_MS = 10 * 60 * 1000;
var neteaseToplistCache = { ts: 0, data: null };
var neteaseToplistInflight = null;

function fetchNeteaseToplistGroup() {
  var cached = neteaseToplistCache;
  if (cached.data && Date.now() - cached.ts < NE_TOPLIST_TTL_MS) {
    return Promise.resolve(cached.data);
  }
  if (neteaseToplistInflight) return neteaseToplistInflight; // 并发去重
  var p = axios.get('https://music.163.com/api/toplist', {
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  }).then(function (res) {
    var list = (res.data && res.data.list) || [];
    var data = list.map(function (it) {
      var cover = str(it.coverImageUrl || it.coverImgUrl || it.frontCoverUrl || '');
      var item = {
        id: NE_CHART_PREFIX + str(it.id),
        title: str(it.name),
        artwork: cover,
        coverImg: cover // 兼容宿主 ITopListItem 的 coverImg 字段（与 artwork 同值双写）
      };
      if (it.updateFrequency) item.description = str(it.updateFrequency); // 榜单更新时间/频率（文档 §9.4）
      return item;
    }).filter(function (it) { return it.id && it.title; });
    if (!data.length) throw new Error('netease toplist empty');
    neteaseToplistCache = { ts: Date.now(), data: data };
    return data;
  });
  var p2 = p.then(function (r) { neteaseToplistInflight = null; return r; },
    function (e) { neteaseToplistInflight = null; throw e; });
  neteaseToplistInflight = p2;
  return p2;
}

// 网易云官方榜详情：[v1.1.0 P0-1] 复用歌单详情通道（trackIds 全量 + /api/v3/song/detail 批量翻页），
// 条目走 buildSheetItem（带单源 _src），播放时接入网易云全档取链接力。
function fetchNeteaseChartDetail(chartId) {
  return SHEET_FETCHERS.netease(chartId).then(function (entries) {
    if (!entries.length) throw new Error('网易云榜单为空 #' + chartId);
    return dedupeBySid(entries).map(buildSheetItem);
  }).then(function (musicList) {
    return { isEnd: true, musicList: musicList };
  });
}

// ==================== 歌单导入 ====================
// 端点实测（artifacts/sheet-probe/，2026-09-05）：
// netease /api/v6/playlist/detail（tracks 全量，v6 字段 ar/al/dt）

var SHEET_MAX_PAGES = 4;      // 单源最多翻 4 页（插件方法 10s 硬上限内）
var SHEET_MAX_ITEMS = 500;    // 导入条数上限（防超时）

/** 各平台歌单 URL → 歌单 id（全部为实测存在的链接格式；返回 null 表示不认识） */
var SHEET_URL_RESOLVERS = {
  netease: function (s) {
    if (!/163\.com/.test(s)) return null;
    // [v1.1.0 O-3] 限定 /playlist 路径（含 #/playlist hash 路由）：
    // 此前只查 163.com + id 参数，会把歌曲页/专辑页/歌手页链接上的 id 误当歌单导入
    // [v1.8.2 P0-1] 放宽正则：允许移动端 /m/ 路径段（music.163.com/m/playlist，
    // 用户真实失败用例）与发现页 discover 路由（#/discover/playlist/?id=）；
    // y.music.163.com / m.music.163.com 子域因非锚定匹配天然命中。
    if (!/music\.163\.com(?:\/m)?\/(?:#\/)?(?:discover\/)?playlist/.test(s)) return null;
    var m = /[?&]id=(\d+)/.exec(s);
    // [v1.8.2 P1-3] 短链路径形态 music.163.com/playlist/{id}（无 ?id= 参数）；
    // 仅在路径确为 /playlist/<数字> 时命中，不会误吃歌曲页/专辑页 id。
    if (!m) m = /music\.163\.com(?:\/m)?\/(?:#\/)?(?:discover\/)?playlist\/(\d+)/.exec(s);
    return m ? m[1] : null;
  }
};

/** 跟随 302 短链（最多 5 跳），返回最终 URL；非 3xx 原样返回 */
async function followRedirects(url) {
  var cur = url;
  for (var i = 0; i < 5; i++) {
    var res = await axios.get(cur, {
      timeout: SOURCE_TIMEOUT,
      maxRedirects: 0,
      validateStatus: null,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var loc = res.headers && res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc && /^https?:\/\//.test(loc)) {
      cur = loc;
    } else {
      // [v1.9.3] WebView/XHR 自动跟随检测：maxRedirects:0 仅 Node 生效，浏览器/WebView
      // 的 XHR 已自动跟随到最终页（status=200、无 location），此时以 res.request.responseURL
      // （XHR 最终响应 URL）为准返回，否则原始短链漏出导致 SHEET_URL_UNRECOGNIZED。
      var finalUrl = res.request && res.request.responseURL;
      if (res.status === 200 && finalUrl && finalUrl !== cur && /^https?:\/\//.test(finalUrl)) {
        cur = finalUrl;
      }
      return cur;
    }
  }
  return cur;
}

/**
 * 解析歌单链接/纯数字 id → { source: 'netease', id }
 * 支持网易云歌单网页链接；163cn.tv 短链 302 跟随；纯数字 id 视为网易云歌单 id。
 */
// [v1.8.2 P2 #12] 歌单导入错误码（宿主统一处理用，文案不变）
function sheetImportError(code, msg) {
  var e = new Error('[netease] ' + msg);
  e.code = code;
  e.platform = 'netease';
  return e;
}
// [v1.9.2] 分享文本 URL 提取：用户分享常带前后文字/emoji/换行（如「分享歌单 | xxx https://... 快来听」），
// 旧版部分平台正则锚定开头导致识别失败。resolveSheetId 入口统一先提取第一个 http/https URL。
// 正则参考 [^\s<>"']+，另做两处收尾清理：
// ① 粘连在 URL 后面的中文/全角字符（分享文案与 URL 连写，如「...123快来听」）裁掉；
// ② 句尾标点（。，.! 等）裁掉。音乐平台 URL 路径不含裸 CJK 与句尾标点，不影响正常链接。
function extractShareUrl(text) {
  var m = /https?:\/\/[^\s<>"']+/.exec(String(text || ''));
  if (!m) return '';
  var u = m[0];
  var cut = u.search(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/);
  if (cut > 8) u = u.slice(0, cut); // 'https://' 为 8 字符，host 必为 ASCII，杜绝域名误裁
  return u.replace(/[.,;!?\u3002\uff0c\uff1b\uff1a\uff01\uff1f\u2026]+$/, '');
}

async function resolveSheetId(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw sheetImportError('SHEET_URL_EMPTY', '歌单链接为空');
  // [v1.9.2] 先从分享文本提取干净 URL，再走短链跟随/域名门/id 提取；提取不到（纯数字 id / 纯文本）保持原行为
  var extractedUrl = extractShareUrl(s);
  if (extractedUrl) s = extractedUrl;
  // 网易云短链 163cn.tv 先 302 跟随再匹配
  if (/^https?:\/\/163cn\.tv\//.test(s)) {
    s = await followRedirects(s);
  }
  if (/^\d{5,}$/.test(s)) return { source: 'netease', id: s }; // 纯数字 id 视为网易云歌单 id
  var id = SHEET_URL_RESOLVERS.netease(s);
  if (id) return { source: 'netease', id: id };
  throw sheetImportError('SHEET_URL_UNRECOGNIZED', '无法识别的歌单链接（支持网易云的歌单网页或分享链接）');
}

/** [v1.1.0 P0-1] 网易云歌曲条目公共映射（v6 字段 ar/al/dt 与旧版 artists/album/duration 兼容） */
function neteaseTrackEntry(t) {
  var al = t.al || t.album || {};
  var ar = t.ar || t.artists;
  return {
    source: 'netease', sid: str(t.id),
    title: str(t.name), artist: splitArtists(ar),
    album: al.name ? String(al.name) : '',
    duration: t.dt ? Math.round(t.dt / 1000) : (t.duration ? Math.round(t.duration / 1000) : 0),
    artwork: al.picUrl ? String(al.picUrl) : '',
    raw: { id: str(t.id), mv: t.mv ? String(t.mv) : '' },
    alias: aliasOfNetease(t), // [v1.5.1 P2] 别名
    quals: qualMapOfNetease(t)
  };
}

/** [v1.1.0 P0-1 + 接口扩充·高优2] trackIds 批量翻页：POST /api/v3/song/detail（c=[{"id":x},...]，官方文档 §8.3）
 *  每批 100 个 id，串行分批；单批失败不致命，继续取余下批次。
 *  [v1.3.0 P1 歌单分页性能] 单批超时收紧到 SOURCE_TIMEOUT：500 首最坏 5×4.5s=22.5s < 宿主 30s RPC
 *  上限（此前 ×2=9s/批，最坏 45s 必超时）；批量详情自带 l/m/h/sq/hr 尺寸，维持不逐首补音质
 *  （baka 歌单逐首补音质接口超 30s 超时的教训）。 */
async function fetchNeteaseSongsByIds(ids) {
  var out = [];
  var BATCH = 100;
  for (var i = 0; i < ids.length; i += BATCH) {
    var batch = ids.slice(i, i + BATCH);
    var c = JSON.stringify(batch.map(function (x) { return { id: parseInt(x, 10) }; }));
    try {
      var res = await axios.post('https://music.163.com/api/v3/song/detail', 'c=' + encodeURIComponent(c), {
        timeout: SOURCE_TIMEOUT, // [v1.3.0 P1] 9s→4.5s：保证 500 首全量最坏耗时不超宿主 30s RPC 上限
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': neteaseHeaders()['User-Agent'], Referer: neteaseHeaders().Referer }
      });
      var songs = (res.data && res.data.songs) || [];
      for (var j = 0; j < songs.length; j++) {
        var e = neteaseTrackEntry(songs[j]);
        if (e.sid && e.title) out.push(e);
      }
    } catch (e) { /* 单批失败不致命 */ }
  }
  return out;
}

var SHEET_FETCHERS = {
  netease: async function (listId) {
    // [v1.1.0 P0-1 阻断修复] /api/v6/playlist/detail 的 tracks 只回前 10 首（n 参数被服务端忽略），
    // 改为：trackIds 官方全量顺序 + /api/v3/song/detail 批量补齐（保序、上限 SHEET_MAX_ITEMS）
    var res = await axios.get('https://music.163.com/api/v6/playlist/detail', {
      params: { id: listId, n: SHEET_MAX_ITEMS },
      timeout: SOURCE_TIMEOUT * 2, headers: neteaseHeaders()
    });
    var pl = res.data && res.data.playlist;
    if (!pl) throw new Error('netease playlist not found #' + listId);
    var trackIds = (pl.trackIds || []).map(function (x) { return x && x.id ? str(x.id) : ''; })
      .filter(function (x) { return x; });
    if (!trackIds.length && !(pl.tracks || []).length) throw new Error('netease playlist empty #' + listId);
    var ids = trackIds.slice(0, SHEET_MAX_ITEMS);
    // [v1.3.0 P1] 歌单分页性能约定：音质信息一律取自批量详情（v3/song/detail 自带 l/m/h/sq/hr 尺寸），
    // 禁止在此处逐首补音质接口——baka 歌单逐首补全 40 首×音质接口即超宿主 30s RPC 超时。
    // tracks 里已有前 10 首预热数据，直接复用，其余走批量详情
    var byId = {};
    var head = ((pl.tracks) || []).map(neteaseTrackEntry).filter(function (it) { return it.sid && it.title; });
    for (var h = 0; h < head.length; h++) byId[head[h].sid] = head[h];
    var missing = [];
    for (var i = 0; i < ids.length; i++) { if (!byId[ids[i]]) missing.push(ids[i]); }
    if (missing.length) {
      var rest = await fetchNeteaseSongsByIds(missing);
      for (var r = 0; r < rest.length; r++) byId[rest[r].sid] = rest[r];
    }
    var out = [];
    for (var k = 0; k < ids.length; k++) { if (byId[ids[k]]) out.push(byId[ids[k]]); }
    if (!out.length) throw new Error('netease playlist detail failed #' + listId);
    // [v1.8.4] 歌单元数据随列表顺带回传（v6/playlist/detail 响应自带，零额外请求）：
    // importMusicSheetImpl 据此组装完整 IMusicSheetItem（description 字段名对齐宿主契约）
    out.meta = {
      title: str(pl.name),
      artwork: str(pl.coverImgUrl) || undefined,
      description: str(pl.description) || undefined,
      artist: (pl.creator && pl.creator.nickname) ? str(pl.creator.nickname) : undefined,
      worksNum: parseInt(pl.trackCount, 10) || undefined,
      playCount: parseInt(pl.playCount, 10) || undefined
    };
    return out;
  }
};

/** 归一化歌单条目 → 聚合条目（_src 带单源 raw，复用取链接力） */
function buildSheetItem(entry) {
  var src = {};
  src[entry.source] = entry.raw;
  var item = {
    id: entry.source + '_' + entry.sid,
    title: entry.title,
    artist: entry.artist,
    album: entry.album || undefined,
    duration: entry.duration || undefined,
    artwork: entry.artwork || undefined,
    // [v1.8.2 P2 #6] 歌单条目 platform 自报（宿主 canPlayMusicVideo 按 platform
    // 反查插件依赖该字段；对齐 kuwo/qq buildSheetItem 口径）
    platform: entry.source || 'netease',
    _src: src,
    _srcOrder: [entry.source]
  };
  // [v1.2.0] 歌曲音质表：榜单/歌单/详情条目同样输出（宿主音质菜单消费）
  if (entry.quals) item.qualities = entry.quals;
  if (src.netease && src.netease.mv) item.mv = String(src.netease.mv);
  // [v1.5.1 -> v1.9.5] alias：榜单/歌单/导入条目同样透传；fee 已停写（v1.9.5 移除 VIP 标识）
  if (entry.alias) item.alias = entry.alias;
  return item;
}

/**
 * 导入歌单：urlLike 支持网易云歌单网页/分享链接。
 * [v1.8.4] 返回完整 IMusicSheetItem 歌单对象（title/description/封面/作者 + musicList，
 * 对齐宿主 IImportMusicSheetResult 新契约）；条目带单源 _src，播放时复用取链接力。
 */
async function importMusicSheetImpl(urlLike) {
  var resolved = await resolveSheetId(urlLike);
  var fetcher = SHEET_FETCHERS[resolved.source];
  if (!fetcher) throw sheetImportError('SHEET_URL_UNRECOGNIZED', '该平台暂不支持歌单导入');
  var entries = await fetcher(resolved.id);
  if (!entries.length) throw sheetImportError('SHEET_EMPTY', '歌单为空或拉取失败（' + resolved.source + ' #' + resolved.id + '）');
  // 同源内按 sid 去重（部分平台歌单会有重复行）
  var seen = {};
  var out = [];
  for (var i = 0; i < entries.length && out.length < SHEET_MAX_ITEMS; i++) {
    var key = entries[i].sid;
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(buildSheetItem(entries[i]));
  }
  // [v1.8.4]（对齐宿主 IImportMusicSheetResult / 咪咕 v1.2.0 同构）：返回完整歌单对象。
  // meta 拉取失败时 title 兜底「网易云歌单 #<id>」，宿主不再显示「来自{platform}的歌单」。
  var meta = entries.meta || null;
  var sheet = {
    id: 'netease_' + resolved.id,
    platform: 'netease',
    isImported: true,
    title: (meta && meta.title) || ('网易云歌单 #' + resolved.id),
    artwork: (meta && meta.artwork) || (out[0] && out[0].artwork) || undefined,
    worksNum: (meta && meta.worksNum) || out.length,
    musicList: out
  };
  if (meta && meta.description) sheet.description = meta.description;
  if (meta && meta.playCount) sheet.playCount = meta.playCount;
  if (meta && meta.artist) { sheet.artist = meta.artist; sheet.author = meta.artist; } // [v1.9.1] author 别名（任务字段清单要求 author，宿主协议用 artist）
  return sheet;
}

// ==================== 单曲导入 & 歌曲详情（v0.7.0 P0-3/P0-4）====================
// 端点实测（artifacts/v07-probe/probe12.mjs，2026-09-06）：
// netease /api/v3/song/detail?c=[{"id":xxx}]（songs[0].ar/al/dt/mv）

var SONG_URL_RESOLVERS = {
  netease: function (s) {
    if (!/163\.com|163cn\.tv/.test(s)) return null;
    var m = /[?&]id=(\d+)/.exec(s) || /\/song\/(\d+)/.exec(s);
    return m ? m[1] : null;
  }
};

/**
 * 解析单曲分享链接 → { source: 'netease', id }
 * 网易云短链 163cn.tv 先 302 跟随再匹配；纯数字 id 视为网易云歌曲 id。
 */
async function resolveSongId(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw new Error('单曲链接为空');
  // 网易云短链 163cn.tv 先 302 跟随再匹配
  if (/^https?:\/\/163cn\.tv\//.test(s)) {
    s = await followRedirects(s);
  }
  var id = SONG_URL_RESOLVERS.netease(s) || (/^\d{5,}$/.test(s) ? s : null); // 纯数字 id 视为网易云歌曲 id
  if (id) return { source: 'netease', id: id };
  throw new Error('无法识别的单曲链接（支持网易云的歌曲分享链接）');
}

var SONG_DETAIL_FETCHERS = {
  netease: function (id) {
    return axios.get('https://music.163.com/api/v3/song/detail', {
      params: { c: '[{"id":' + id + '}]' },
      timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    }).then(function (res) {
      var t = res.data && res.data.songs && res.data.songs[0];
      if (!t) throw new Error('netease detail empty');
      var al = t.al || {};
      return {
        source: 'netease', sid: str(t.id),
        title: str(t.name), artist: splitArtists(t.ar),
        album: al.name ? String(al.name) : '',
        duration: t.dt ? Math.round(t.dt / 1000) : 0,
        artwork: al.picUrl ? String(al.picUrl) : '',
        raw: { id: str(t.id), mv: t.mv ? String(t.mv) : '' },
        alias: aliasOfNetease(t), // [v1.5.1 P2] 别名
        quals: qualMapOfNetease(t) // [v1.3.0 P0] 此前丢弃 l/m/h/sq/hr 尺寸 → 单曲导入条目无音质表
      };
    });
  }
};

/** 导入单曲：分享链接 → 详情 → 聚合条目（单源 _src，播放/歌词复用各源能力） */
async function importMusicItemImpl(urlLike) {
  var resolved = await resolveSongId(urlLike);
  var fetcher = SONG_DETAIL_FETCHERS[resolved.source];
  var entry = await fetcher(resolved.id);
  if (!entry || !entry.sid) throw new Error('单曲详情拉取失败（' + resolved.source + ' #' + resolved.id + '）');
  return buildSheetItem(entry);
}

/**
 * 歌曲详情补齐（P0-4）：MusicFree 协议 getMusicInfo。
 * 优先原生源详情（_srcOrder），失败降级按 _src 内其它源接力（≤2 次请求）；
 * 只补空缺字段（artwork/album/duration/mv/videoId），不覆盖已有值；
 * v1.3.0 起同时回填 qualities 音质表（缺失/无 size 档补齐，宿主下载面板消费）。
 */
async function getMusicInfoImpl(musicItem) {
  if (!musicItem) return musicItem;
  // [v1.8.1 P0-2] 裸 ID playById 反查——宿主把同一字符串写入 id/songid/songmid/
  // mid/hash/copyrightId 且无 _src，复用 SONG_DETAIL_FETCHERS + buildSheetItem
  // 重建条目（与 importMusicItemImpl 同路径）。参照 migu 兜底模式。
  if (!musicItem._src) {
    try {
      var bareId = String(musicItem.id || '').trim();
      if (bareId && SONG_DETAIL_FETCHERS.netease) {
        var entry = await SONG_DETAIL_FETCHERS.netease(bareId);
        if (entry && entry.sid) return buildSheetItem(entry);
      }
    } catch (e) { /* 裸 ID 反查失败按缺数据处理，由宿主兜底 */ }
    return musicItem;
  }
  var srcMap = musicItem._src;
  var order = (musicItem._srcOrder && musicItem._srcOrder.length)
    ? musicItem._srcOrder.slice()
    : pickCandidates(srcMap, 'standard');
  // 详情取数只对有实现且条目带 sid 的源生效
  order = order.filter(function (s) { return SONG_DETAIL_FETCHERS[s] && srcMap[s]; });
  var sidKey = { netease: 'id' };

  for (var i = 0; i < Math.min(order.length, 2); i++) {
    var s = order[i];
    var raw = srcMap[s] || {};
    var sid = raw[sidKey[s]] || '';
    if (!sid) continue;
    try {
      var detail = await SONG_DETAIL_FETCHERS[s](sid);
      if (!detail) continue;
      if (!musicItem.artwork && detail.artwork) musicItem.artwork = detail.artwork;
      if (!musicItem.album && detail.album) musicItem.album = detail.album;
      if (!musicItem.duration && detail.duration) musicItem.duration = detail.duration;
      if (detail.raw && detail.raw.mv && !musicItem.mv) musicItem.mv = String(detail.raw.mv);
      // [v1.5.1 -> v1.9.5] alias 补齐：只补空缺不覆盖（与 qualities 回填同策略）；
      // v1.9.5 起 fee（VIP 标识）不再回填。
      if (!musicItem.alias && detail.alias) musicItem.alias = detail.alias;
      // [v1.3.0 P0] qualities 补齐：宿主下载/音质面板在 qualities 缺失或无 size 时调 getMusicInfo
      // 补大小（musicItemOptions.tsx / albumCover operations），此前不回 qualities 导致补齐落空，
      // 单曲导入/缓存剥落后的条目永远看不到音质大小。合并策略：已有档位不覆盖，仅补缺失/无 size 档。
      if (detail.quals) {
        var q0 = musicItem.qualities || {};
        for (var qk in detail.quals) {
          if (Object.prototype.hasOwnProperty.call(detail.quals, qk) && (!q0[qk] || !q0[qk].size)) {
            q0[qk] = detail.quals[qk];
          }
        }
        musicItem.qualities = q0;
      }
      if (musicItem.artwork && musicItem.duration) break; // 关键字段齐了就停
    } catch (e) { /* 详情可选，失败换下个源 */ }
  }
  return musicItem;
}

// ==================== 取链适配器（网易云） ====================

// v0.7.3 通用：并发竞速 helper——所有候选同时发起，首个成功结果胜出，全部失败才 reject。
// 与 resolveWithFallback 的顺序接力互补：接力省请求但串行慢，竞速快但并发多打一路，仅用于双通道主力档。
function raceSuccess(promises) {
  return new Promise(function (resolve, reject) {
    var pending = promises.length, failed = 0;
    if (!pending) { reject(new Error('raceSuccess: 无候选')); return; }
    promises.forEach(function (p) {
      Promise.resolve(p).then(resolve, function () {
        failed++;
        if (failed === pending) reject(new Error('raceSuccess: 全部候选失败'));
      });
    });
  });
}

// ==================== 纯 JS 加密模块（网易云 eapi 签名用）====================
// 算法来源：《网易云音乐接口完整文档_实测整合版》§12.2/G.4 eapi 签名。
// 沙箱已对拍验证：MD5/AES-128-ECB 与 Node 内置 crypto 一致（20/20 向量通过）。
// 宿主 require 白名单无 crypto 模块，故纯 JS 实现；64 位数用 [lo,hi] 双 32 位字表示（PC1 输出可超 2^53，禁用 Number 合并）。
// 语法：ES8 兼容（无 ?. / ?? / BigInt / Buffer 依赖）。
// ---------- 基础 ----------
function utf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}

// 64 位整数用 [lo, hi] 两个 32 位字表示（位序与 Python 参考实现一致：bit i = i<32 ? lo>>>i : hi>>>(i-32)）
function md5Bytes(input) {
  var bytes = typeof input === 'string' ? utf8Bytes(input) : input;
  var s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
           5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
           4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
           6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = new Array(64);
  for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  var msgLen = bytes.length;
  var withPad = bytes.slice();
  withPad.push(0x80);
  while (withPad.length % 64 !== 56) withPad.push(0);
  var bitLen = msgLen * 8;
  var lo = bitLen % 4294967296, hi = Math.floor(bitLen / 4294967296);
  for (var j = 0; j < 4; j++) withPad.push((lo >>> (8 * j)) & 0xFF);
  for (var j2 = 0; j2 < 4; j2++) withPad.push((hi >>> (8 * j2)) & 0xFF);

  function rl(x, c) { return ((x << c) | (x >>> (32 - c))) | 0; }
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var chunk = 0; chunk < withPad.length; chunk += 64) {
    var M = new Array(16);
    for (var m = 0; m < 16; m++) {
      M[m] = (withPad[chunk + m * 4] | (withPad[chunk + m * 4 + 1] << 8) | (withPad[chunk + m * 4 + 2] << 16) | (withPad[chunk + m * 4 + 3] << 24)) | 0;
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var i2 = 0; i2 < 64; i2++) {
      var F, g;
      if (i2 < 16) { F = (B & C) | (~B & D); g = i2; }
      else if (i2 < 32) { F = (D & B) | (~D & C); g = (5 * i2 + 1) % 16; }
      else if (i2 < 48) { F = B ^ C ^ D; g = (3 * i2 + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i2) % 16; }
      F = (F + A + K[i2] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rl(F, s[i2])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  var out = [];
  [a0, b0, c0, d0].forEach(function (w) {
    out.push(w & 0xFF, (w >>> 8) & 0xFF, (w >>> 16) & 0xFF, (w >>> 24) & 0xFF);
  });
  return out;
}
function md5Hex(input) {
  return md5Bytes(input).map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}

// ---------- 纯 JS AES-128-ECB 加密（PKCS7） ----------
var AES_SBOX = [
0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16];
var AES_RCON = [0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function aes128ExpandKey(keyBytes) {
  var w = [];
  for (var i = 0; i < 4; i++) w.push([keyBytes[4 * i], keyBytes[4 * i + 1], keyBytes[4 * i + 2], keyBytes[4 * i + 3]]);
  for (var k = 4; k < 44; k++) {
    var t = w[k - 1].slice();
    if (k % 4 === 0) {
      t = [AES_SBOX[t[1]], AES_SBOX[t[2]], AES_SBOX[t[3]], AES_SBOX[t[0]]];
      t[0] ^= AES_RCON[k / 4 - 1];
    }
    w.push([w[k - 4][0] ^ t[0], w[k - 4][1] ^ t[1], w[k - 4][2] ^ t[2], w[k - 4][3] ^ t[3]]);
  }
  return w;
}
function aesXtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xFF; }

function aes128EcbEncrypt(plaintext, keyBytes) {
  var w = aes128ExpandKey(keyBytes);
  var out = [];
  var total = plaintext.length;
  var padLen = 16 - (total % 16); // PKCS7：含整块边界（total%16===0 时补整块 16）
  var padded = plaintext.slice();
  for (var p = 0; p < padLen; p++) padded.push(padLen);
  for (var off = 0; off < padded.length; off += 16) {
    var s = new Array(16);
    for (var i = 0; i < 16; i++) s[i] = padded[off + i];
    // AddRoundKey(0)
    for (var c = 0; c < 4; c++) for (var r2 = 0; r2 < 4; r2++) s[c * 4 + r2] ^= w[c][r2];
    for (var round = 1; round <= 10; round++) {
      for (var i2 = 0; i2 < 16; i2++) s[i2] = AES_SBOX[s[i2]];
      var t1 = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t1;
      var t2 = s[2]; s[2] = s[10]; s[10] = t2; var t2b = s[6]; s[6] = s[14]; s[14] = t2b;
      var t3 = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = s[3]; s[3] = t3;
      if (round < 10) {
        for (var c3 = 0; c3 < 4; c3++) {
          var a0 = s[c3 * 4], a1 = s[c3 * 4 + 1], a2 = s[c3 * 4 + 2], a3 = s[c3 * 4 + 3];
          var a0x = aesXtime(a0), a1x = aesXtime(a1), a2x = aesXtime(a2), a3x = aesXtime(a3);
          s[c3 * 4]     = a0x ^ a1x ^ a1 ^ a2 ^ a3;
          s[c3 * 4 + 1] = a0 ^ a1x ^ a2x ^ a2 ^ a3;
          s[c3 * 4 + 2] = a0 ^ a1 ^ a2x ^ a3x ^ a3;
          s[c3 * 4 + 3] = a0x ^ a0 ^ a1 ^ a2 ^ a3x;
        }
      }
      for (var c4 = 0; c4 < 4; c4++) for (var r4 = 0; r4 < 4; r4++) s[c4 * 4 + r4] ^= w[round * 4 + c4][r4];
    }
    for (var o = 0; o < 16; o++) out.push(s[o] & 0xFF);
  }
  return out;
}

// eapi 加密：MD5("nobody"+path+"use"+json+"md5forencrypt") → path-36cd479b6b5-json-36cd479b6b5-md5 → AES-ECB → hex 大写
function eapiEncrypt(path, paramsJson, keyStr) {
  var digest = md5Hex('nobody' + path + 'use' + paramsJson + 'md5forencrypt');
  var plain = path + '-36cd479b6b5-' + paramsJson + '-36cd479b6b5-' + digest;
  var pb = utf8Bytes(plain);
  var kb = utf8Bytes(keyStr);
  var enc = aes128EcbEncrypt(pb, kb);
  return enc.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('').toUpperCase();
}

// [v1.9.15 P1-3 修复] 纯 JS AES-128-ECB 解密（与既有 aes128EcbEncrypt 同构，逆 S 盒 + InvMixColumns）。
// 背景：2026-09-25 真网探针实测 eapi 响应体为 AES-128-ECB 密文（同 key e82ckenh8dichen8），
// 既有三路 eapi 通道按明文 JSON.parse 解析必然失败 → rd=null → 通道静默失效。本版补齐解密。
function bytesToUtf8(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var c = bytes[i];
    if (c < 0x80) { out += String.fromCharCode(c); }
    else if (c >= 0xC0 && c < 0xE0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((c & 0x1F) << 6) | (bytes[i + 1] & 0x3F)); i++;
    } else if (c >= 0xE0 && c < 0xF0 && i + 2 < bytes.length) {
      out += String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F)); i += 2;
    } else if (c >= 0xF0 && i + 3 < bytes.length) {
      var cp = ((c & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F); i += 3;
      cp -= 0x10000;
      out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
    }
  }
  return out;
}
var AES_INV_SBOX = (function () {
  var inv = new Array(256);
  for (var i = 0; i < 256; i++) inv[AES_SBOX[i]] = i;
  return inv;
})();
function aesMul(a, b) { // GF(2^8) 乘法（xtime 复用既有 aesXtime）
  var r = 0;
  while (b) { if (b & 1) r ^= a; a = aesXtime(a); b >>= 1; }
  return r & 0xFF;
}
function aes128EcbDecrypt(cipherBytes, keyBytes) {
  var w = aes128ExpandKey(keyBytes);
  function addRoundKey(s, round) {
    for (var c = 0; c < 4; c++) for (var r2 = 0; r2 < 4; r2++) s[c * 4 + r2] ^= w[round * 4 + c][r2];
  }
  function invSubBytes(s) { for (var i = 0; i < 16; i++) s[i] = AES_INV_SBOX[s[i]]; }
  function invShiftRows(s) {
    // 状态列主序 s[c*4+r]（与加密实现一致）；逆行移位 = 行 r 循环右移 r
    var t = new Array(16);
    for (var c = 0; c < 4; c++) for (var r3 = 0; r3 < 4; r3++) t[((c + r3) % 4) * 4 + r3] = s[c * 4 + r3];
    for (var j = 0; j < 16; j++) s[j] = t[j];
  }
  function invMixColumns(s) {
    for (var c = 0; c < 4; c++) {
      var a0 = s[c * 4], a1 = s[c * 4 + 1], a2 = s[c * 4 + 2], a3 = s[c * 4 + 3];
      s[c * 4]     = aesMul(a0, 14) ^ aesMul(a1, 11) ^ aesMul(a2, 13) ^ aesMul(a3, 9);
      s[c * 4 + 1] = aesMul(a0, 9)  ^ aesMul(a1, 14) ^ aesMul(a2, 11) ^ aesMul(a3, 13);
      s[c * 4 + 2] = aesMul(a0, 13) ^ aesMul(a1, 9)  ^ aesMul(a2, 14) ^ aesMul(a3, 11);
      s[c * 4 + 3] = aesMul(a0, 11) ^ aesMul(a1, 13) ^ aesMul(a2, 9)  ^ aesMul(a3, 14);
    }
  }
  var out = [];
  for (var off = 0; off + 16 <= cipherBytes.length; off += 16) {
    var s = new Array(16);
    for (var i = 0; i < 16; i++) s[i] = cipherBytes[off + i] & 0xFF;
    addRoundKey(s, 10);
    for (var round = 9; round >= 1; round--) {
      invShiftRows(s); invSubBytes(s); addRoundKey(s, round); invMixColumns(s);
    }
    invShiftRows(s); invSubBytes(s); addRoundKey(s, 0);
    for (var o = 0; o < 16; o++) out.push(s[o] & 0xFF);
  }
  // PKCS7 去填充（非法填充不裁剪，交由 JSON.parse 失败兜底）
  if (out.length && out[out.length - 1] >= 1 && out[out.length - 1] <= 16) {
    var pad = out[out.length - 1], ok = true;
    for (var p = out.length - pad; p < out.length; p++) if (out[p] !== pad) { ok = false; break; }
    if (ok) out = out.slice(0, out.length - pad);
  }
  return out;
}

// [v1.9.15 P1-3 修复] eapi 响应解析：标准形态 AES-128-ECB 密文（同 key 解密后 JSON），
// 错误响应兜底明文 JSON 直解；均失败返回 null（由调用方按 no url 拒收接力，fail-closed）。
function eapiParseResponseData(rd) {
  var u8 = null;
  if (rd instanceof ArrayBuffer) u8 = new Uint8Array(rd);
  else if (rd && typeof rd === 'object' && rd.buffer instanceof ArrayBuffer) {
    u8 = new Uint8Array(rd.buffer, rd.byteOffset || 0, rd.byteLength || rd.length);
  } else if (rd && typeof rd === 'object' && typeof rd.length === 'number' && !(rd instanceof String)) {
    try { u8 = new Uint8Array(rd); } catch (e) { /* 非 byte 数组 */ }
  }
  if (u8 && u8.length >= 16 && u8.length % 16 === 0) {
    try {
      var plain = aes128EcbDecrypt(Array.prototype.slice.call(u8), utf8Bytes('e82ckenh8dichen8'));
      var j = JSON.parse(bytesToUtf8(plain));
      if (j && typeof j === 'object') return j;
    } catch (e) { /* 密文形态失败 → 落明文兜底 */ }
  }
  var text = '';
  if (typeof rd === 'string') text = rd;
  else if (u8) { try { text = bytesToUtf8(u8); } catch (e2) { return null; } }
  try {
    var j2 = JSON.parse(text);
    return j2 && typeof j2 === 'object' ? j2 : null;
  } catch (e3) { return null; }
}

function haitangLevelOf(quality) {
  if (quality === 'super') return 'lossless';
  if (quality === 'hires') return 'hires';
  if (quality === 'high') return 'exhigh';
  // [v1.3.0 P1] atmos/master/dolby 无对应上游档位 → 尽力降级 hires（actualQuality 按响应如实标注）
  if (quality === 'atmos' || quality === 'master' || quality === 'dolby') return 'hires';
  return 'standard';
}

// 宿主音质键（fork: 96k/128k/192k/320k/flac/flac24bit/hires/master/atmos...）→ 插件内部档位。
// v0.6.0 及之前宿主传入 '320k'/'master' 会被当未知档落回 standard，此映射修正为正确档位。
var QUALITY_KEY_MAP = {
  '96k': 'standard', '128k': 'standard',
  '192k': 'high', '320k': 'high',
  'flac': 'super', 'flac24bit': 'super',
  // [v1.3.0 P1] atmos/master/dolby 不再折叠进 hires：内部档位与宿主键同名，
  // eapi-v1 分别映射 sky/jymaster/dolby（需 VIP Cookie）；vinyl 无独立上游档位，维持映射 hires
  'hires': 'hires', 'master': 'master', 'atmos': 'atmos', 'atmos_plus': 'atmos', 'dolby': 'dolby', 'vinyl': 'hires'
};
function normalizeQuality(q) {
  var s = String(q || '');
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'standard' || s === 'high' || s === 'super' || s === 'hires'
    || s === 'atmos' || s === 'master' || s === 'dolby') return s; // [v1.3.0 P1] 内部档位透传
  return 'standard';
}

// [v0.7.2 fix#10 P1] 音质诚实性：插件内部档位 → 宿主音质键（IMediaSourceResult.actualQuality）。
// 多源接力/降级后「宣称档位 ≠ 实际档位」是多源播放器通病；v0.7.2 起各取链解析器
// 在返回值上附 actualQuality（宿主音质键口径：128k/192k/320k/flac/flac24bit/hires），
// 供宿主 UI 角标展示真实档位。取不到确定档位的通道不填该字段（宁缺毋假）。
function internalToHostQuality(q) {
  if (q === 'high') return '320k';
  if (q === 'super') return 'flac';
  if (q === 'hires') return 'hires';
  // [v1.3.0 P1] 增强档位与宿主键同名直传（atmos_plus 归并到 atmos）
  if (q === 'atmos') return 'atmos';
  if (q === 'master') return 'master';
  if (q === 'dolby') return 'dolby';
  return '128k'; // standard / low / 未知
}

function resolveHaitang(source, rid, quality) {
  var r = String(rid || '');
  return axios.post('https://musicserver.haitangw.cc/v1/music/resolve-url', {
    source: source, rid: r, level: haitangLevelOf(quality)
  }, {
    timeout: RELAY_TIMEOUT, // v0.7.1 P1-3：接力段超时 2500ms
    headers: { Referer: 'https://musicserver.haitangw.cc/', 'Content-Type': 'application/json' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 0 || !d || !d.url) throw new Error('haitang no url');
    // [v0.7.2 fix#10] actualQuality：海棠 level 与请求档一一对应（standard→128k / exhigh→320k / lossless→flac / hires→hires）
    return { url: String(d.url), actualQuality: internalToHostQuality(quality), channel: 'haitang-wy' };
  });
}

// [v1.9.15 P0-2 吸收] 海棠 wy.php 直连通道（music.haitangw.cc/music/wy.php，与既有
// musicserver resolve-url 端点不同源不同形态）。2026-09-25 探针实测存活：JSON 形态 url 在
// data.url。请求哪个音质取哪个音质：level 映射 standard/low→standard、high→exhigh、
// super→lossless（hires 及增强档不接，无对应档）。双形态兼容：301/302 Location 直链 /
// 200 JSON；真机 WebView 自动跟随 302 场景以 responseURL 探测取最终直链（v1.9.3 同款）。
// 兜底定位：stdChain 与 high+ 链尾第二兜底（outerUrl 之前），不改变主链优先级；
// actualQuality 如实声明，外层守卫按声明档 fail-closed（无损魔数/码率下限不符即拒收接力）。
function resolveHaitangWyPhp(raw, quality) {
  if (!raw || !raw.id) return Promise.reject(new Error('haitang wy.php: no id'));
  var level = (quality === 'super') ? 'lossless' : (quality === 'high' ? 'exhigh' : 'standard');
  var api = 'https://music.haitangw.cc/music/wy.php?level=' + level + '&id=' + encodeURIComponent(String(raw.id));
  return axios.get(api, {
    timeout: RELAY_TIMEOUT,
    maxRedirects: 0,
    validateStatus: null,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://music.haitangw.cc/' }
  }).then(function (res) {
    var loc = res.headers && (res.headers.location || res.headers.Location);
    var u = (res.status === 301 || res.status === 302) && loc && /^https?:\/\//i.test(String(loc)) ? String(loc) : '';
    if (!u) {
      var j = res.data;
      u = (j && j.data && j.data.url) || (j && j.url) || '';
    }
    var finalUrl = res.request && res.request.responseURL;
    if (!u && finalUrl && /^https?:\/\//i.test(String(finalUrl)) && String(finalUrl) !== api) u = String(finalUrl);
    if (!u || !/^https?:\/\//i.test(String(u))) throw new Error('haitang wy.php: no url (status ' + res.status + ')');
    return { url: String(u), actualQuality: internalToHostQuality(quality), channel: 'haitang-wy-php' };
  });
}

// [v1.9.4] size 探测辅助：Range 0-0 HEAD 探测 Content-Range/Content-Length 写回。
// 优先级：Content-Range 的 total（如 "bytes 0-0/4319232"）> 200 响应 Content-Length。
// 失败 fail-soft：探测失败/4xx/超时返回 0，由调用方决定是否兜底。
function probeHeadSize(url, timeoutMs) {
  if (!url || typeof url !== 'string') return Promise.resolve(0);
  var ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 2000;
  return axios.get(url, {
    timeout: ms,
    headers: { Range: 'bytes=0-0' },
    responseType: 'arraybuffer',
    validateStatus: function (s) { return s >= 200 && s < 400; }
  }).then(function (res) {
    var headers = res.headers || {};
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) return parseInt(mm[1], 10) || 0;
    if (res.status !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      return parseInt(cl, 10) || 0;
    }
    return 0;
  }).catch(function () { return 0; });
}

// ---------- 第三方备源（仅网易云；文档 15.x 实测 + v4 文档 §1.7/1.8/25.2） ----------
// [v1.1.0] GD Studio（星海系后端）改用 v4 文档 §1.8 实测的 br 参数（128/192/320/740/999），
// 取代旧 quality=flac|flac24bit 写法；740=无损 FLAC、999=Hi-Res。
// 官方限速 50 次/5 分钟 → 通道冷却：任意失败冷却 60s，命中 429 冷却 5 分钟（冷却期内直接跳过）。
var GD_COOL_NORMAL_MS = 60000;
var GD_COOL_RATE_MS = 300000;
var gdCooldownUntil = 0;
function gdCoolingDown() { return Date.now() < gdCooldownUntil; }

// [v1.9.4 disabled since 2026-09-11] resolveNeteaseXinghai 实测整体失效，从竞速池移除，保留函数体注释。
function resolveNeteaseXinghai(raw, quality) {
  return Promise.reject(new Error('xinghai no url (disabled since 2026-09-11)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function resolveNeteaseXinghai(raw, quality) {
  if (gdCoolingDown()) return Promise.reject(new Error('gdstudio cooling down'));
  var br = (quality === 'hires' || quality === 'master' || quality === 'atmos' || quality === 'dolby')
    ? 999 : (quality === 'super' ? 740 : (quality === 'high' ? 320 : 128));
  return axios.get('https://music-api.gdstudio.xyz/api.php', {
    params: { types: 'url', source: 'netease', id: raw.id, br: br },
    timeout: RELAY_TIMEOUT, // v0.7.1 P1-3：接力段超时 2500ms
    headers: { Referer: 'https://music.gdstudio.xyz/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var url = res.data && res.data.url;
    if (!url) throw new Error('xinghai no url');
    // [v0.7.2 fix#10] actualQuality：按请求 br 档对应标注（响应 br 实测可能更高，如 1607kbps Hi-Res）
    var aq = br >= 999 ? 'hires' : (br >= 740 ? 'flac' : (br >= 320 ? '320k' : '128k'));
    return { url: String(url), actualQuality: aq, channel: 'gdstudio-xinghai' };
  }).catch(function (e) {
    var st = e && e.response && e.response.status;
    gdCooldownUntil = Date.now() + (st === 429 ? GD_COOL_RATE_MS : GD_COOL_NORMAL_MS);
    throw e;
  });
}

// [v0.8.0] 网易云第四段兜底：api.7boe.top（文档 15.9 实测：国内可访问的 NeteaseCloudMusicApi 公共实例，
// REST GET 免加密；2026-09-06 沙箱复测：免费歌 br=320000 完整直链 10.8MB，freeTrialInfo=null；
// VIP 歌公共实例无登录态整体降级 128k 试听——freeTrialInfo 守卫拒收、接力下一通道，宁低勿高）。
// 返回 URL 为 m7xx.music.126.net 官方 CDN（http），走既有 MEDIA_URL_HTTP_HOST_ALLOWLIST 校验，无需新增白名单。
*/

// [v1.9.4 disabled since 2026-09-11] resolveNetease7boe 实测整体失效，从竞速池移除，保留函数体注释。
function resolveNetease7boe(raw, quality) {
  return Promise.reject(new Error('7boe no url (disabled since 2026-09-11)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function resolveNetease7boe(raw, quality) {
  var br = (quality === 'super' || quality === 'hires') ? 999000 : (quality === 'high' ? 320000 : 128000);
  return axios.get('https://api.7boe.top/song/url', {
    params: { id: raw.id, br: br },
    timeout: RELAY_TIMEOUT, // v0.7.1 P1-3：接力段超时 2500ms
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var item = res.data && res.data.data && res.data.data[0];
    var url = item && item.url;
    if (!item || !url) throw new Error('7boe no url (code ' + (res.data && res.data.code) + ')');
    if (item.freeTrialInfo) {
      throw new Error('7boe trial clip ' + (item.freeTrialInfo.end || '') + 's');
    }
    // actualQuality：按响应 br 如实标注（宁低勿高）
    var gotBr = parseInt(item.br, 10) || 0;
    var aq = gotBr >= 999000 ? 'flac' : (gotBr >= 320000 ? '320k' : '128k');
    return { url: String(url), actualQuality: aq, channel: '7boe' };
  });
}

// [v1.1.0 P1-1] SE 云音兜底回归（v0.8.0 拆分聚合插件时被删，standard 档 VIP 歌自此无兜底）：
// GET music.sedet.top/api.php?action=url&id={id}&level={8档}（接口文档 §15.7）；
// VIP 歌请求 lossless/hires 自动降级 320k（_source=vip_fallback）。
// [v1.1.0 实测备注] 2026-09-06 实测 sedet 全档失效（响应 url 空 + code 404，~3.9s），
// 通道保留（服务恢复后自动生效），但在 standard 兜底链中已后移至 7boe 之后。
*/

// [v1.9.4 disabled since 2026-09-11] resolveNeteaseSedet 实测整体失效，从竞速池移除，保留函数体注释。
function resolveNeteaseSedet(raw, quality) {
  return Promise.reject(new Error('sedet no url (disabled since 2026-09-11)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function resolveNeteaseSedet(raw, quality) {
  // [v1.3.0 P1] atmos/master/dolby 无对应上游档位 → 降级 hires
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires', atmos: 'hires', master: 'hires', dolby: 'hires' };
  var level = levelMap[quality] || 'standard';
  return axios.get('https://music.sedet.top/api.php', {
    params: { action: 'url', id: raw.id, level: level },
    // [v1.1.0 实测调整] sedet 响应实测 ~3.9s，RELAY_TIMEOUT(2500ms) 会误超时；放宽到 6000ms
    timeout: 6000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data || {};
    var url = d.url || (d.data && d.data.url);
    if (!url) throw new Error('sedet no url (level ' + level + ')');
    var aq = internalToHostQuality(quality);
    // VIP 自动降级时按响应 level/br 如实标注
    var respLevel = d.level || (d.data && d.data.level) || '';
    if (respLevel === 'exhigh' || d._source === 'vip_fallback') aq = '320k';
    return { url: String(url), actualQuality: aq, channel: 'sedet' };
  });
}

// [v1.1.0 第三部分·1] oiapi.net 溯音（v4 文档 §1.7，洛雪"溯音音源"后端）：
// GET /api/Music_163?id=&quality=128|320|flac，无需 Key。
// 响应 {code:0,data:[{url,pay}]}；VIP 歌返回 code:0 + url:null + pay:true（明确无链 → 快速接力下一通道）。
*/

function resolveOiapi(raw, quality) {
  var q = (quality === 'super' || quality === 'hires' || quality === 'master'
    || quality === 'atmos' || quality === 'dolby') ? 'flac' : (quality === 'high' ? '320' : '128'); // [v1.3.0 P1] 增强档位降级 flac
  return axios.get('https://oiapi.net/api/Music_163', {
    params: { id: raw.id, quality: q },
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data || {};
    var item = d.data && d.data[0];
    if (d.code !== 0 || !item) throw new Error('oiapi bad code ' + d.code);
    if (!item.url) throw new Error(item.pay ? 'oiapi vip locked' : 'oiapi no url');
    var aq = q === 'flac' ? 'flac' : (q === '320' ? '320k' : '128k');
    return { url: String(item.url), actualQuality: aq, channel: 'oiapi' };
  });
}

// [v1.1.0 第三部分·3] bugpk 163_music（v4 文档 §25.2 全参数族实测）：
// GET api.bugpk.com/api/163_music?type=json&id={rid}&level=standard|exhigh|lossless|hires。
// ⚠️ 参数名是 ids（实测 id 会报 code 400「缺少url或ids参数」）；单 IP 限 2 QPS。
// VIP 歌 7 档全部回落 outer/url（128k）→ 免费歌才可能有高档，免费歌 hires 实测真 CDN 直链。
function resolveBugpk(raw, quality) {
  // [v1.3.0 P1] atmos/master/dolby 无对应上游档位 → 降级 hires
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires', atmos: 'hires', master: 'hires', dolby: 'hires' };
  return axios.get('https://api.bugpk.com/api/163_music', {
    // [v1.1.0 实测修正] bugpk 163_music 的单曲查询参数是 ids（不是 id——id 会报 code 400「缺少url或ids参数」）
    params: { type: 'json', ids: raw.id, level: levelMap[quality] || 'standard' },
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data || {};
    var url = d.url || (d.data && d.data.url);
    if (!url) throw new Error('bugpk no url (code ' + d.code + ')');
    var u = String(url);
    // outer/url 回落链（VIP 歌）：守卫/白名单会复核，这里直接交出去
    var aq = /outer\/url/.test(u) ? '128k' : internalToHostQuality(quality);
    return { url: u, actualQuality: aq, channel: 'bugpk-163' };
  });
}

// [v1.3.1 P1] 新增第三方取链通道：听会音乐 + ikun音源（接口文档 §15.4/§15.15/附录H.1，2026-09-07 沙箱实测）
// 实测结论（VIP 孤勇者 1901371647 Range 头 4KB 验证）：
// - 听会 GET http://47.109.94.179/music_v1.php?id=&level=standard|exhigh|lossless|hires|jymaster
//   5 档全真（jymaster 155.2MB fLaC 实锤），~500ms，无需签名/Cookie；⚠️ 免费歌高档 code=200 但
//   url 字段是中文错误文案（"获取歌曲地址失败…"），必须校验 url 以 http 开头后快速失败。
// - ikun POST https://c.wwwweb.top/music/url（X-API-Key 空串即可）6 档全通（hires 51.2MB ≠ flac
//   27.7MB，atmos 87.9MB、master 155.2MB），响应 quality 字段为实际交付档位（可诚实标注）；
//   免费歌干净返回 code=500。
// - HYWmusic（103.79.184.97）不接入：flac 档静默降级 128k 且响应无 quality 字段（违反
//   actualQuality 诚实原则），且本质是 gdstudio 包装、与既有星海通道同源无增量。
var TINGHUI_LEVEL_MAP = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires', atmos: 'hires', master: 'jymaster', dolby: 'jymaster' };
var IKUN_QUALITY_MAP = { standard: '128k', low: '128k', high: '320k', super: 'flac', hires: 'hires', atmos: 'atmos', master: 'master', dolby: 'master' };
var IKUN_AQ_MAP = { '128k': '128k', '320k': '320k', 'flac': 'flac', 'hires': 'hires', 'atmos': 'atmos', 'master': 'master' };

// "9.11MB" / "155.2MB" → bytes；解析失败返回 0
function parseMbSize(s) {
  var m = /^([\d.]+)\s*(KB|MB|GB)?/i.exec(String(s || '').trim());
  if (!m || !m[1]) return 0;
  var n = parseFloat(m[1]);
  var u = (m[2] || 'MB').toUpperCase();
  if (u === 'KB') return n * 1024;
  if (u === 'GB') return n * 1073741824;
  return n * 1048576;
}

// 按码率估档（宁低勿高）：响应无音质字段的通道（tinghui data.size）用它补 actualQuality；
// 时长未知/不足 60s 或字节数缺失时不估（返回 undefined，宁缺毋假）。
// 阈值按实测标定：孤勇者 258s —— 128k 3.9MB(≈120k)/flac 27.7MB(≈896k)/hires 51.2MB(≈1656k)/
// master 155.2MB(≈5020k)。
function bitrateHostAq(bytes, durSec) {
  if (!(bytes > 0) || !(durSec >= 60)) return undefined;
  var kbps = bytes * 8 / 1000 / durSec;
  if (kbps >= 2200) return 'master';
  if (kbps >= 1200) return 'hires';
  if (kbps >= 700) return 'flac';
  if (kbps >= 200) return '320k';
  return '128k';
}

// [v1.9.4 disabled since 2026-09-11] resolveNeteaseTinghui 实测整体失效，从竞速池移除，保留函数体注释。
function resolveNeteaseTinghui(raw, quality) {
  return Promise.reject(new Error('tinghui no url (disabled since 2026-09-11)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function resolveNeteaseTinghui(raw, quality) {
  var level = TINGHUI_LEVEL_MAP[quality] || 'standard';
  return axios.get('http://47.109.94.179/music_v1.php', {
    params: { id: raw.id, level: level },
    timeout: RELAY_TIMEOUT, // 实测 ~500ms，2500ms 足够
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data || {};
    var inner = d.data || {};
    var url = d.url || inner.url;
    if (d.code !== 200 || !url || !/^https?:\/\//i.test(String(url))) {
      // 免费歌高档：code=200 但 url 为错误文案，快速失败接力下一通道
      throw new Error('tinghui no url (level ' + level + ')');
    }
    // 响应无实际音质字段：不标 actualQuality，由 resolveWithFallback 用 data.size 真实字节数
    // + 标称时长按码率估档（宁低勿高）；CDN 为 iot*.music.126.net，命中既有 http 白名单
    return { url: String(url), bytes: parseMbSize(inner.size), channel: 'tinghui-wy' };
  });
}
*/

function resolveNeteaseIkun(raw, quality) {
  var q = IKUN_QUALITY_MAP[quality] || '128k';
  return axios.post('https://c.wwwweb.top/music/url',
    { source: 'wy', musicId: String(raw.id), quality: q }, // ⚠️ 参数名是 musicId（songId 会失败）
    {
      timeout: RELAY_TIMEOUT,
      headers: { 'X-API-Key': '', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var d = res.data || {};
      var url = d.url && String(d.url);
      if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) {
        throw new Error('ikun no url (code ' + d.code + ')');
      }
      // code=200 不代表真实成功（QQ/酷狗假成功是占位样本）：这里只接 wy，且下方白名单/守卫
      // 会复核 126.net 官方 CDN 域名；响应 quality 为实际交付档位，如实标注（宁低勿高）
      var aq = IKUN_AQ_MAP[d.quality] || IKUN_AQ_MAP[q];
      return { url: url, actualQuality: aq, channel: 'ikun-wy' };
    });
}

// [v1.9.11] 星澜（stellarwave v4.0.0）wy 可用后端通道接入。凯撒 +5 混淆 URL 已还原为明文；
// 通道可用性结论来自 2026-09-12 沙箱真网复测（3 歌 × 3 档：晴天/孤勇者/告白气球 wy id
// 2652820720/2737753398/2742150886，结果 artifacts/probe-results.json）。通道标识统一
// 'netease:stellarwave-*'，便于排查问题归因到星澜来源。
var SW_LEVEL_MAP = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'lossless', atmos: 'lossless', master: 'lossless', dolby: 'lossless' };

// Range 0-15 魔数探测（同酷我插件 probeMediaMagic 模式）：星澜 wy 后端存在「请求 flac 回
// 128k mp3」的虚标行为（实测 2737753398），lossless 档必须 fLaC 魔数否则拒收接力。
// 探测失败（Range 不支持/超时）返回 ''，仅 lossless 档据此拒收，不误杀有损档。
function swProbeMagic(url) {
  return axios.get(url, {
    timeout: RELAY_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var buf = res.data;
    var u8;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
    else return '';
    if (!u8 || u8.length < 4) return '';
    if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) return 'fLaC';
    if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'ID3';
    if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) return 'OggS';
    if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return 'mp3';
    return '';
  }).catch(function () { return ''; });
}

// 通道 ①：星澜 wy 星海主后端（yy.zddyr.top/lx/api/，lx 洛雪协议格式）。
// 响应自带实档字段：{code:200, url, quality, level, br, size, type}——br 为实际交付码率，
// 可精准防虚标（实测 320k/flac 请求无存货时回 br=128000，标称档与实档分离）。
// 档位策略：standard/low→128k、high→320k、super 及以上→lossless（上游仅三档）。
function resolveNeteaseZddyr(raw, quality) {
  var q = (quality === 'high') ? '320k' : (quality === 'standard' || quality === 'low' || !quality ? '128k' : 'flac');
  return axios.get('https://yy.zddyr.top/lx/api/?source=netease&songmid=' + encodeURIComponent(raw.id) + '&quality=' + q, {
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
  }).then(function (res) {
    var d = res.data || {};
    var url = d && d.url && String(d.url);
    if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) {
      throw new Error('stellarwave-zddyr no url (code ' + (d && d.code) + ')');
    }
    var br = parseInt(d.br, 10) || 0;
    if (q === 'flac') {
      // [v1.9.11 防虚标] lossless 请求：br<700000 视为上游虚标（实测 br=128000 mp3）拒收接力；
      // br 达标再做 fLaC 魔数二次校验，双保险
      if (br < 700000) throw new Error('stellarwave-zddyr fake lossless (br ' + br + ')');
      return swProbeMagic(url).then(function (mg) {
        if (mg !== 'fLaC') throw new Error('stellarwave-zddyr magic ' + (mg || 'none') + ' != fLaC');
        // flac 实档按 br 如实标注（wy lossless 实测 br≈743000 → flac；24bit 档上游不存在）
        return { url: url, actualQuality: br >= 999000 ? 'hires' : 'flac', channel: 'netease:stellarwave-zddyr' };
      });
    }
    // standard/high：按响应 br 如实标注（宁低勿高，实测 320k 请求回 128k 时如实标 128k）
    var aq = br >= 700000 ? 'flac' : (br >= 300000 ? '320k' : '128k');
    return { url: url, actualQuality: aq, channel: 'netease:stellarwave-zddyr' };
  });
}

// 通道 ②：星澜 wy 笒鬼鬼（api.cenguigui.cn/api/netease/music_v1.php）。
// 响应 {code:200, data:{url, size:"53.44MB", format, duration, ...}}——无 br 数值字段，
// size 字符串经 parseMbSize 转真实字节数，交由 resolveWithFallback 按标称时长码率估档
// （bitrateHostAq，宁低勿高）；lossless 请求必须 fLaC 魔数（实测 2737753398 flac 回 3.90MB mp3）。
function resolveNeteaseCenguigui(raw, quality) {
  var level = SW_LEVEL_MAP[quality] || 'standard';
  return axios.get('https://api.cenguigui.cn/api/netease/music_v1.php', {
    params: { id: raw.id, type: 'json', level: level },
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Accept: 'application/json' }
  }).then(function (res) {
    var d = res.data || {};
    var item = d.data || {};
    var url = item.url && String(item.url);
    if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) {
      throw new Error('stellarwave-cenguigui no url (code ' + (d && d.code) + ')');
    }
    var bytes = parseMbSize(item.size || d.size);
    if (level === 'lossless') {
      return swProbeMagic(url).then(function (mg) {
        if (mg !== 'fLaC') throw new Error('stellarwave-cenguigui magic ' + (mg || 'none') + ' != fLaC');
        return { url: url, bytes: bytes, channel: 'netease:stellarwave-cenguigui' };
      });
    }
    return { url: url, bytes: bytes, channel: 'netease:stellarwave-cenguigui' };
  });
}

// [v1.1.0] outer/url 免登录外链（官方接口文档 §21.1）：免费歌 302→官方 CDN mp3；VIP 歌 302→HTML 页。
// maxRedirects:0 探测 302 Location：指向官方 CDN（白名单域）才收，HTML/无跳转一律拒收。
function resolveNeteaseOuterUrl(raw) {
  return axios.get('https://music.163.com/song/media/outer/url?id=' + raw.id + '.mp3', {
    timeout: RELAY_TIMEOUT, maxRedirects: 0, validateStatus: null,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var ctype = String((res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '');
    if (/text\/html/i.test(ctype)) throw new Error('outer-url html (vip)');
    var loc = res.headers && (res.headers.location || res.headers.Location);
    if (!loc || !/^https?:\/\//.test(loc)) throw new Error('outer-url no redirect');
    // [v1.1.0 守卫收紧] 重定向目标必须是官方 CDN（*.music.126.net）；
    // VIP 歌会 302 到 music.163.com 登录/提示 HTML 页，一律拒收
    if (!/^https?:\/\/[^/]*music\.126\.net\//.test(String(loc))) {
      throw new Error('outer-url redirect not cdn: ' + String(loc).slice(0, 80));
    }
    return { url: String(loc), actualQuality: '128k', channel: 'netease-outer-url' };
  });
}

function userVariablesSafe() {
  var env = typeof global !== 'undefined' && global.env ? global.env : null;
  if (env && env.getUserVariables) {
    try { return env.getUserVariables() || {}; } catch (e) { /* 沙箱无 env */ }
  }
  return {};
}

function neteaseCookieValue() {
  var uv = userVariablesSafe();
  return uv.neteaseCookie ? String(uv.neteaseCookie) : '';
}

function neteaseEapiResolve(raw, quality) {
  var ck = neteaseCookieValue();
  if (!ck) return Promise.reject(new Error('netease eapi: 未配置 Cookie'));
  var eapiPath = '/api/song/enhance/player/url';
  var br = (quality === 'super' || quality === 'hires') ? 999000 : (quality === 'high' ? 320000 : 128000);
  var params = JSON.stringify({ ids: '[' + raw.id + ']', br: br });
  var body = 'params=' + eapiEncrypt(eapiPath, params, 'e82ckenh8dichen8');
  return axios.post('https://interface3.music.163.com/eapi' + eapiPath, body, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      Cookie: /os=pc/i.test(ck) ? ck : (ck + '; os=pc; appver=2.9.7')
    },
    // [v1.9.15 P1-3 修复] eapi 响应体为 AES-128-ECB 密文（2026-09-25 真网探针实测，旧明文
    // JSON.parse 必失败致通道静默失效）：改 arraybuffer 接收，由 eapiParseResponseData 统一
    // 解密/明文兜底解析（axios 默认 utf8 字符串会破坏二进制密文，必须 arraybuffer 保真）
    responseType: 'arraybuffer',
    transformResponse: [function (d) { return d; }]
  }).then(function (res) {
    // [v1.9.15 P1-3 修复] 密文解密 / 明文兜底统一入口（详见 eapiParseResponseData 注释）
    var rd = eapiParseResponseData(res.data);
    var item = rd && rd.data && rd.data[0];
    var url = item && item.url;
    if (!url) throw new Error('netease eapi no url (code ' + (rd && rd.code) + ')');
    // [v1.1.0 P1-2 严重修复] 试听守卫收紧：只要下发 freeTrialInfo 即为试听片段——
    // ≥60s 的试听（如 end:90）和无 end 字段的试听此前会漏放成完整曲假象，一律拒收
    if (item.freeTrialInfo) {
      throw new Error('netease eapi trial clip ' + (item.freeTrialInfo.end || '') + 's');
    }
    // 音质档位校验（宁低勿高）：actualQuality 按响应 br 如实标注，不按请求档宣称
    var gotBr = parseInt(item.br, 10) || 0;
    var aq = gotBr >= 999000 ? 'flac' : (gotBr >= 320000 ? '320k' : '128k');
    return { url: String(url), actualQuality: aq, channel: 'netease-eapi' };
  });
}

// [v1.6.0 P0] 匿名 eapi 取链通道（免 Cookie，go-music-dl 同款）：
// /eapi/song/enhance/player/url/v1，level=standard/exhigh/lossless 三档。payload 关键坑
// （2026-09-08 探针实测）：① header 字段必须以「字符串化 JSON」内嵌进 payload
// （'{"os":"pc","appver":"2.9.7","deviceId":"pyncm!"}'——漏掉该字段或不序列化都会失败）；
// ② v1 端点传 br 数字会参数错误(code=400)，只能传 level；③ encodeType:'flac' 一并带上。
// 免费歌（fee=0/8）实测 exhigh/lossless 均出官方直链（320k 魔数 ID3、206 全长可达，
// 歌曲自身有无损时 lossless 出无损）；VIP 歌匿名 url=null（code 200 空数据）或试听片段
// （freeTrialInfo 守卫拒收）→ 本通道 reject，交还竞速/接力，行为无损。
function neteaseEapiAnonResolve(raw, quality) {
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless' };
  var level = levelMap[quality];
  if (!level || !raw || !raw.id) return Promise.reject(new Error('netease eapi anon: unsupported quality ' + quality));
  var eapiPath = '/api/song/enhance/player/url/v1';
  var params = JSON.stringify({
    ids: '[' + raw.id + ']',
    level: level,
    encodeType: 'flac',
    header: '{"os":"pc","appver":"2.9.7","deviceId":"pyncm!"}' // 必须字符串化（实测坑）
  });
  var body = 'params=' + eapiEncrypt(eapiPath, params, 'e82ckenh8dichen8');
  return axios.post('https://interface3.music.163.com/eapi' + eapiPath, body, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/'
    },
    // [v1.9.15 P1-3 修复] eapi 响应体为 AES-128-ECB 密文（2026-09-25 真网探针实测，旧明文
    // JSON.parse 必失败致通道静默失效）：改 arraybuffer 接收，由 eapiParseResponseData 统一
    // 解密/明文兜底解析（axios 默认 utf8 字符串会破坏二进制密文，必须 arraybuffer 保真）
    responseType: 'arraybuffer',
    transformResponse: [function (d) { return d; }]
  }).then(function (res) {
    // [v1.9.15 P1-3 修复] 密文解密 / 明文兜底统一入口（详见 eapiParseResponseData 注释）
    var rd = eapiParseResponseData(res.data);
    var item = rd && rd.data && rd.data[0];
    var url = item && item.url;
    if (!url) throw new Error('netease eapi anon no url (code ' + (rd && rd.code) + ', ' + quality + ')');
    // 试听守卫与既有 eapi 通道同款：下发 freeTrialInfo 一律拒收
    if (item.freeTrialInfo) {
      throw new Error('netease eapi anon trial clip ' + (item.freeTrialInfo.end || '') + 's');
    }
    // 音质档位校验（宁低勿高）：actualQuality 按响应 br 如实标注，不按请求档宣称
    var gotBr = parseInt(item.br, 10) || 0;
    var aq = gotBr >= 999000 ? 'flac' : (gotBr >= 320000 ? '320k' : '128k');
    return { url: String(url), actualQuality: aq, channel: 'netease-eapi-anon' };
  });
}

// [v1.1.0 接口扩充·高优1] level 版取链 /api/song/enhance/player/url/v1（官方文档 §4.2）：
// level=standard|exhigh|lossless|hires（另支持 jyeffect/sky/dolby/jymaster），encodeType=flac；
// 响应结构与旧版一致（data[0].url / freeTrialInfo / br / level）。高档位需有效 VIP Cookie。
function neteaseEapiResolveV1(raw, quality) {
  var ck = neteaseCookieValue();
  if (!ck) return Promise.reject(new Error('netease eapi v1: 未配置 Cookie'));
  // [v1.3.0 P1] 增强档位映射：atmos→sky（沉浸环绕）、master→jymaster（超清母带）、dolby→dolby（杜比全景声）。
  // 三档均需有效 VIP Cookie，未配置/无权益时本通道 reject → 竞速退化 → 第三方链按 hires 尽力降级
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires', atmos: 'sky', master: 'jymaster', dolby: 'dolby' };
  var eapiPath = '/api/song/enhance/player/url/v1';
  var params = JSON.stringify({
    ids: '[' + raw.id + ']',
    level: levelMap[quality] || 'standard',
    encodeType: 'flac'
  });
  var body = 'params=' + eapiEncrypt(eapiPath, params, 'e82ckenh8dichen8');
  return axios.post('https://interface3.music.163.com/eapi' + eapiPath, body, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      Cookie: /os=pc/i.test(ck) ? ck : (ck + '; os=pc; appver=2.9.7')
    },
    // [v1.9.15 P1-3 修复] eapi 响应体为 AES-128-ECB 密文（2026-09-25 真网探针实测，旧明文
    // JSON.parse 必失败致通道静默失效）：改 arraybuffer 接收，由 eapiParseResponseData 统一
    // 解密/明文兜底解析（axios 默认 utf8 字符串会破坏二进制密文，必须 arraybuffer 保真）
    responseType: 'arraybuffer',
    transformResponse: [function (d) { return d; }]
  }).then(function (res) {
    // [v1.9.15 P1-3 修复] 密文解密 / 明文兜底统一入口（详见 eapiParseResponseData 注释）
    var rd = eapiParseResponseData(res.data);
    var item = rd && rd.data && rd.data[0];
    var url = item && item.url;
    if (!url) throw new Error('netease eapi v1 no url (code ' + (rd && rd.code) + ')');
    // [v1.1.0 P1-2] 同口径守卫：下发 freeTrialInfo 一律拒收
    if (item.freeTrialInfo) {
      throw new Error('netease eapi v1 trial clip ' + (item.freeTrialInfo.end || '') + 's');
    }
    // actualQuality：响应 level 优先，br 兜底（宁低勿高）；[v1.3.0 P1] sky/jymaster/dolby 如实标注增强档
    var gotBr = parseInt(item.br, 10) || 0;
    var lvl = item.level || '';
    var aq = (lvl === 'jymaster') ? 'master'
      : (lvl === 'sky') ? 'atmos'
      : (lvl === 'dolby') ? 'dolby'
      : (lvl === 'hires' || gotBr >= 999000) ? 'hires'
      : (lvl === 'lossless' || gotBr >= 900000) ? 'flac'
      : (lvl === 'exhigh' || gotBr >= 320000) ? '320k' : '128k';
    return { url: String(url), actualQuality: aq, channel: 'netease-eapi-v1' };
  });
}
// [v1.9.14] 长青 SVIP 网易通道（yinyue.haitangw.net/wy/wy.php，端点直出音频流）。
// 接入背景：2026-09-24 每日健康探测——网易主力 yy.zddyr.top/lx/api 连续 2 天失效
// （09-23 http_0 超时、09-24 http_503 拒绝），竞速池失主力；长青 SVIP 网易 HTTPS
// 入口同日复测 6/8 档位可用且 magic 全过：standard（真 mp3 3.87MB）/exhigh（真 mp3
// 9.68MB）/lossless（真 FLAC 28.4MB）/flac/hires/jymaster（真 FLAC 28.4MB）；
// higher 间歇 502，不映射不使用。通道定位：yy.zddyr.top（星海网易主力）的故障替补，
// 靠后排——仅当 zddyr 失败/503 时启用，主力健康时不抢跑（见 resolveNetease 两处
// zddyr().catch(longqing) 包裹，竞速/接力池其余通道零改动）。
// 档位映射（内部档 → 长青 level，请求哪个音质取哪个音质）：
//   standard/low→standard、high→exhigh（长青 exhigh 实测真 320k mp3 9.68MB）；
//   super→lossless、hires→hires、master→jymaster、atmos/dolby→hires（尽力降级，
//   actualQuality 如实标注，对齐海棠 haitangLevelOf 惯例）。
// 320k 档位映射问题处理：任务实测长青服务端 320k 档实际返回 fLaC 28.4MB（服务端
// 档位定义与内部口径不一致），本版双保险——①内部 high 档一律请求 exhigh（真 320k），
// 绝不请求 320k level；②有损档响应魔数守卫：standard/exhigh 请求若检出 fLaC 视为
// 服务端虚标拒收接力（防服务端后续把有损档也映射到无损）。
// 响应处理：端点直出音频流（mp3/fLaC 容器），魔数探测校验通过后以端点 URL 直接
// 作为播放 url 返回；503/502/超时按既有竞速机制接力，无独立重试。
var LQ_LEVEL_MAP = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires', master: 'jymaster', atmos: 'hires', dolby: 'hires' };
function resolveNeteaseLongqing(raw, quality) {
  var level = LQ_LEVEL_MAP[quality] || 'standard';
  var url = 'https://yinyue.haitangw.net/wy/wy.php?type=mp3&id=' + encodeURIComponent(raw.id) + '&level=' + level;
  // Range 0-15 魔数探测即校验（端点直出音频流、无 JSON 元数据字段）：HTTP 4xx/5xx、
  // HTML 错误页、JSON 错误体、魔数不符一律 reject 交还竞速/接力，不惩罚不冷却。
  var lossy = (level === 'standard' || level === 'exhigh' || level === 'higher');
  // [v1.9.14] 超时用 SOURCE_TIMEOUT(4500ms) 而非 RELAY_TIMEOUT(2500ms)：长青 Range 探测
  // 实测延迟 1.4~4.1s（2026-09-24 晴天 8 档实测），2500ms 会掐死替补通道致其永远无法胜出；
  // 仍在 RESOLVE_BUDGET_MS 8s 全局预算内，且本通道仅在主力 zddyr 失败后才发出请求
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    if (res.status >= 400) throw new Error('longqing http_' + res.status);
    var ctype = String((res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '');
    if (/text\/html/i.test(ctype)) throw new Error('longqing html response');
    var buf = res.data;
    var u8 = null;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length);
    if (!u8 || u8.length < 4) throw new Error('longqing empty probe');
    var isFlac = u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43; // fLaC
    var isId3 = u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33; // ID3
    var isMp3 = u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0; // MPEG sync
    if (lossy) {
      // 有损档守卫：检出 fLaC = 服务端把有损档映射到无损（320k 档实返 fLaC 28.4MB
      // 同源问题），拒绝虚标接力；放行 ID3/mp3 真有损流
      if (isFlac) throw new Error('longqing fake quality (fLaC on ' + level + ')');
      if (!isId3 && !isMp3) throw new Error('longqing magic not mp3 (' + level + ')');
    } else if (!isFlac) {
      // 无损档守卫（对齐 cenguigui lossless 档口径）：必须 fLaC，ID3/其他拒收
      throw new Error('longqing magic ' + (isId3 ? 'ID3' : 'none') + ' != fLaC (' + level + ')');
    }
    // actualQuality 按请求档如实标注（长青各档 magic/大小实测达标）；atmos/dolby 尽力
    // 降级取 hires 实档，如实标 flac（宁低勿高，不虚标增强档）
    var lqAq = (quality === 'atmos' || quality === 'dolby') ? 'flac' : internalToHostQuality(quality);
    // [v1.9.14] Range 0-15 响应自带 Content-Range 总长，直接回填 size/bytes：
    // 省掉 getMediaSource 边界 probeHeadSize 的 ~2s 探测（guard HEAD 对 wy.php 挂起
    // 已耗 ~2.5s，链路贴近 8s 全局预算）；拿不到总长则留空走既有探测兜底
    var lqTotal = 0;
    var lqCr = res.headers && (res.headers['content-range'] || res.headers['Content-Range']);
    if (lqCr) {
      var lqMm = String(lqCr).match(/\/(\d+)\s*$/);
      if (lqMm) lqTotal = parseInt(lqMm[1], 10) || 0;
    }
    var lqResult = { url: url, actualQuality: lqAq, channel: 'longqing_netease' };
    if (lqTotal > 0) { lqResult.bytes = lqTotal; lqResult.size = lqTotal; }
    return lqResult;
  });
}

function resolveNetease(raw, quality) {
  // [v1.1.0 P1-1] standard 档恢复第三方兜底链（v0.8.0 拆分聚合插件时被删，属回归）：
  // 官方 128k ⇄ eapi 竞速 → SE 云音 → oiapi → bugpk → 7boe → outer/url
  if (quality === 'standard' || quality === 'low' || !quality) {
    var official128 = axios.get('https://music.163.com/api/song/enhance/player/url', {
      params: { ids: '[' + raw.id + ']', br: 128000 },
      timeout: SOURCE_TIMEOUT,
      headers: neteaseHeaders()
    }).then(function (res) {
      var list = res.data && res.data.data;
      var item = list && list[0];
      var url = item && item.url;
      if (!url) throw new Error('netease no url (vip?)');
      if (item.freeTrialInfo) {
        throw new Error('netease trial clip ' + (item.freeTrialInfo.end || '') + 's');
      }
      // [v0.7.2 fix#10] actualQuality：官方免登录 br=128000
      return { url: String(url), actualQuality: '128k', channel: 'netease-official-128k' };
    });
    // [v0.7.3] eapi 官方直连与官方 128k GET 并发竞速，先成功者胜
    // （未配置 Cookie 时 eapi 立即 reject，竞速退化为单通道；两路各自独立超时 SOURCE_TIMEOUT）
    // [v1.6.0 P0] 匿名 eapi 通道加入竞速：免费歌免 Cookie 即可取 exhigh（实测 320k），
    // 免费内容音质上限从官方免登录 128k 提升；VIP 歌匿名空 url/试听 → 拒收落第三方链不变
    return raceSuccess([official128, neteaseEapiResolve(raw, quality), neteaseEapiAnonResolve(raw, quality)]).catch(function () {
      // [v1.1.0 P1-1] 官方两路全败（VIP 歌无 Cookie / 接口异常）→ 第三方兜底链接力
      // [v1.1.0 实测调整] sedet 2026-09-06 全档失效（免费/VIP 均 url 空 code 404，响应 ~3.9s），
      // 后移到 7boe 之后避免拖慢有效通道；恢复后自动回到兜底序列
      var stdChain = [
        // [v1.4.0 优化2] ikun 单路替代听会（v1.9.4 起听会 47.109.94.179 死亡）：竞速无意义直接调用
        // 仅 standard 档官方全败（典型：VIP 歌无 Cookie，官方 ~55ms 必败）进入第三方接力时
        // 生效；胜者出链、败者丢弃，实测 VIP 128k 冷链 ~645ms → ~250ms。
        // 免费歌 128k 官方直连成功（~137ms），不会进入此段，行为不变
        function () { return resolveNeteaseIkun(raw, quality); },
        // [v1.9.11] 星澜 wy 可用通道（星海 zddyr + 笒鬼鬼 cenguigui）加入 standard 接力链
        // [v1.9.14] 长青 SVIP 网易作为星海 zddyr 的故障替补：仅 zddyr 失败/503 后启用，
        // 主力健康时零请求不抢跑
        function () { return resolveNeteaseZddyr(raw, quality).catch(function () { return resolveNeteaseLongqing(raw, quality); }); },
        function () { return resolveNeteaseCenguigui(raw, quality); },
        function () { return resolveOiapi(raw, quality); },
        function () { return resolveBugpk(raw, quality); },
        // [v1.9.4 disabled since 2026-09-11] 7boe / sedet 实测整体失效，从竞速池移除
        // function () { return resolveNetease7boe(raw, quality); },
        // function () { return resolveNeteaseSedet(raw, quality); },
        // [v1.9.15 P0-2 吸收] 海棠 wy.php 直连兜底（链尾第二兜底，outerUrl 之前）
        function () { return resolveHaitangWyPhp(raw, quality); },
        function () { return resolveNeteaseOuterUrl(raw); }
      ];
      var walkStd = function (i) {
        if (i >= stdChain.length) return Promise.reject(new Error('netease standard all channels failed'));
        return stdChain[i]().catch(function () { return walkStd(i + 1); });
      };
      return walkStd(0);
    });
  }
  // high/super/hires：[v1.1.0] 首段改并发竞速（海棠 + GD Studio[未冷却时] + eapi v1 level 取链[需 Cookie]），
  // 任一先成功即胜出；后续 oiapi → bugpk → 7boe 接力。
  // v0.7.1 P1-5：全链 HTTPS；v0.8.0 7boe 末位兜底保留。
  // [v1.3.1 P1] 竞速通道扩充：海棠 + 听会 + ikun（+ 星海[未冷却] + eapi v1[需 Cookie]），任一先成功即胜出
  var first = [
    function () { return resolveHaitang('wy', raw.id, quality); },
    // [v1.9.4 disabled since 2026-09-11] 听会 47.109.94.179 死亡，从竞速池移除
    // function () { return resolveNeteaseTinghui(raw, quality); },
    function () { return resolveNeteaseIkun(raw, quality); }
  ];
  // [v1.9.4 disabled since 2026-09-11] GD Studio music-api.gdstudio.xyz 实测整体失效，从竞速池移除
  // if (!gdCoolingDown()) first.push(function () { return resolveNeteaseXinghai(raw, quality); });
  // [v1.9.11] 星澜 wy 可用通道加入首段竞速（星海 zddyr + 笒鬼鬼 cenguigui）：
  // 与海棠/ikun/eapi 并发竞速，先成功者胜；lossless 档两通道带 fLaC 魔数防虚标校验
  // [v1.9.14] 竞速池内长青 SVIP 网易作为 zddyr 故障替补：zddyr 失败/503 后才启动
  // （zddyr().catch(longqing) 包裹），主力健康时零请求、不抢跑、不额外并发
  first.push(function () { return resolveNeteaseZddyr(raw, quality).catch(function () { return resolveNeteaseLongqing(raw, quality); }); });
  first.push(function () { return resolveNeteaseCenguigui(raw, quality); });
  if (neteaseCookieValue()) first.push(function () { return neteaseEapiResolveV1(raw, quality); });
  // [v1.6.0 P0] 匿名 eapi 加入首段竞速（仅 standard/high/super 有匿名可用档位）：
  // 免费歌免 Cookie 取 exhigh/lossless 官方直链，先成功者胜；VIP 匿名空 url/试听自动拒收
  if (quality === 'standard' || quality === 'high' || quality === 'super') {
    first.push(function () { return neteaseEapiAnonResolve(raw, quality); });
  }
  var chain = [
    function () { return raceSuccess(first.map(function (f) { return f(); })); },
    function () { return resolveOiapi(raw, quality); },
    function () { return resolveBugpk(raw, quality); },
    // [v1.9.4 disabled since 2026-09-11] 7boe 实测整体失效，从竞速池移除
    // function () { return resolveNetease7boe(raw, quality); },
    // [v1.3.1 P1] 竞速全败时 ikun 二次兜底（听会已死、改为 ikun 单路）
    function () { return resolveNeteaseIkun(raw, quality); },
    // [v1.3.2 fix] 链尾补官方 outer/url 终极兜底（此前仅 standard 档有，high+ 档缺失）：
    // 免费歌高档在 bugpk 限流(520/2QPS)/海棠超时叠加时曾全链失败
    // （实测复现）；免费歌 outer/url 302→官方 CDN mp3 稳定降级 128k；VIP 歌 302→HTML
    // 被既有 redirect-非-CDN 守卫秒拒，不影响 VIP 链路语义。
    // [v1.9.15 P0-2 吸收] 海棠 wy.php 直连兜底（链尾第二兜底，outerUrl 之前）
    function () { return resolveHaitangWyPhp(raw, quality); },
    function () { return resolveNeteaseOuterUrl(raw); }
  ];
  var attempt = function (i) {
    if (i >= chain.length) return Promise.reject(new Error('netease ' + quality + ' all third-party failed'));
    return chain[i]().catch(function () { return attempt(i + 1); });
  };
  return attempt(0);
}

var RESOLVE_ADAPTERS = {
  netease: resolveNetease
};

/**
 * 能力路由 + 失败接力：
 * 候选顺序 = 支持请求档位的源（按源权重降序）→ 其余兜底源。
 * 最多接力 3 个候选，控制 10s 上限。
 */
function pickCandidates(srcMap, quality) {
  var sources = [];
  for (var k in srcMap) { if (Object.prototype.hasOwnProperty.call(srcMap, k)) sources.push(k); }
  sources.sort(function (a, b) {
    var ca = canServe(a, quality) ? 0 : 1;
    var cb = canServe(b, quality) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return (SOURCE_WEIGHT[b] || 0.5) - (SOURCE_WEIGHT[a] || 0.5);
  });
  return sources;
}

// v0.7.1 P1-5：返回媒体 URL 协议/域名白名单校验。
// https 一律放行；http 仅放行网易云官方 CDN 域名后缀（含海棠 wy 返回的 126.net 直链），
// http 且域名不在白名单（含裸 IP、被劫持改写的陌生域）一律拒绝，视为该源失败继续接力。
// [v1.2.0 P1] 补 /.126.net$/：官方 MV CDN 为 vodkgeyttp8.vod.126.net 等子域，
// 旧白名单只放行 music.126.net，导致 MV 官方直链被误拒返回 null（实测复现并修复）。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.126\.net$/i, /\.163\.com$/i, /\.163cn\.tv$/i
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (/^https:\/\//i.test(s)) return true; // https 一律放行
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  for (var i = 0; i < MEDIA_URL_HTTP_HOST_ALLOWLIST.length; i++) {
    if (MEDIA_URL_HTTP_HOST_ALLOWLIST[i].test(host)) return true;
  }
  return false;
}

// v0.7.1 P1-3：给单个 Promise 套剩余时间上限（先到者胜出：段超时 or 请求自身失败）
function withTimeout(promise, ms, msg) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; reject(new Error(msg)); }
    }, ms);
    promise.then(function (v) {
      if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
    }, function (e) {
      if (!settled) { settled = true; clearTimeout(timer); reject(e || new Error(msg)); }
    });
  });
}

// [v1.1.0 优化] 取链失败负缓存（进程内，60s TTL；>500 条时先清理过期项）
var NEG_CACHE_TTL = 60000;
var resolveNegCache = {};
function resolveNegCacheSet(key, msg) {
  var now = Date.now();
  var keys = Object.keys(resolveNegCache);
  if (keys.length > 500) {
    for (var i = 0; i < keys.length; i++) {
      if (!resolveNegCache[keys[i]] || resolveNegCache[keys[i]].until < now) delete resolveNegCache[keys[i]];
    }
  }
  resolveNegCache[key] = { msg: msg, until: now + NEG_CACHE_TTL };
}
function resolveNegCacheGet(key) {
  var e = resolveNegCache[key];
  if (!e) return null;
  if (Date.now() > e.until) { delete resolveNegCache[key]; return null; }
  return e.msg;
}
function resolveNegCacheDel(key) { delete resolveNegCache[key]; }

// [v1.4.0 优化1] URL 结果成功缓存（进程内 LRU）：
// resolveWithFallback 成功后按 'id|quality' 缓存 {url,channel,actualQuality,bytes}，
// TTL 30min（第三方 CDN 直链实测有效期 ~2h，留足安全余量），上限 200 条
// （超出先清过期项，仍超按最久未访问淘汰）。命中直接返回、跳过全链与守卫——
// 写入前结果已过 isAllowedMediaUrl 白名单 + 守卫探测，命中无需复核。
// 键与失败负缓存同名但独立存储；成功路径既有 resolveNegCacheDel(negKey) 负责清负缓存。
var OK_CACHE_TTL = 30 * 60 * 1000;
var OK_CACHE_MAX = 200;
var resolveOkCache = {};
function resolveOkCacheGet(key) {
  var e = resolveOkCache[key];
  if (!e) return null;
  if (Date.now() > e.until) { delete resolveOkCache[key]; return null; }
  // LRU：命中即删除重插，刷新访问序（对象键按插入序，队首即最久未访问）
  delete resolveOkCache[key];
  resolveOkCache[key] = e;
  return Object.assign({}, e.val); // 浅拷贝防调用方改动污染缓存
}
function resolveOkCacheSet(key, val) {
  var now = Date.now();
  var keys = Object.keys(resolveOkCache);
  if (keys.length >= OK_CACHE_MAX) {
    for (var i = 0; i < keys.length; i++) {
      if (!resolveOkCache[keys[i]] || resolveOkCache[keys[i]].until < now) delete resolveOkCache[keys[i]];
    }
    keys = Object.keys(resolveOkCache);
  }
  while (keys.length >= OK_CACHE_MAX) {
    delete resolveOkCache[keys[0]];
    keys.shift();
  }
  resolveOkCache[key] = { val: val, until: now + OK_CACHE_TTL };
}

function resolveWithFallback(musicItem, quality) {
  var srcMap = musicItem._src || {};
  var order = pickCandidates(srcMap, quality);
  var tries = order.slice(0, 3);
  // v0.7.1 P1-3：全局超时预算。deadline 8s 内：首段 ≤SOURCE_TIMEOUT，接力段 ≤RELAY_TIMEOUT，
  // 每段进入前检查剩余时间，不足 500ms 直接失败——保证整体可预期地在宿主 10s 预算内给出结果。
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  var attempt = function (idx) {
    if (idx >= tries.length) {
      return Promise.reject(new Error('聚合取链失败：所有可用源均未取得播放链接'));
    }
    var remain = deadline - Date.now();
    if (remain <= 500) {
      return Promise.reject(new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms'));
    }
    var source = tries[idx];
    var adapter = RESOLVE_ADAPTERS[source];
    if (!adapter) return attempt(idx + 1);
    // [v1.1.0] 单源插件化后（srcMap 通常仅剩 netease），首段不再被 SOURCE_TIMEOUT 一刀切：
    // 留出全局预算余量（预留 1.5s 给守卫探测），适配器内部多通道兜底链才有机会走完
    var segTimeout = order.length === 1
      ? Math.max(Math.min(remain - 1500, 6500), 2000)
      : (idx === 0 ? SOURCE_TIMEOUT : RELAY_TIMEOUT);
    if (segTimeout > remain) segTimeout = remain;
    return withTimeout(adapter(srcMap[source], quality), segTimeout, source + ' 取链超时 ' + segTimeout + 'ms').then(function (r) {
      // v0.7.1 P1-5：返回 URL 协议/域名白名单校验，不通过视为该源失败、继续接力
      if (!isAllowedMediaUrl(r && r.url)) {
        throw new Error(source + ' 返回 URL 未通过协议/域名校验');
      }
      // [v1.3.1 音质诚实性] 通道响应无音质字段但带真实字节数（tinghui-wy data.size）时，
      // 用标称时长按码率估档补 actualQuality（宁低勿高）；时长未知/不足 60s 则不填（宁缺毋假）
      if (r && r.bytes > 0 && !r.actualQuality) {
        var durSecAq = parseInt(musicItem && musicItem.duration, 10) || 0;
        r.actualQuality = bitrateHostAq(r.bytes, durSecAq);
      }
      // 兜底守卫：适配器漏判的试听片段在这里被内容探测拦下并继续接力
      // （守卫按 content-length/Range 校验大小与标称时长一致性，明显不符即丢弃）
      // [v1.4.0 优化3] 官方 128k 通道跳过守卫：music.163.com 接口直出 126.net 官方 CDN，
      // 无试听截断（freeTrialInfo 已在适配器内拦截且与 url 互斥），省 20-90ms HEAD 探测；
      // isAllowedMediaUrl 白名单校验对官方通道仍保留（上方已执行）；其余通道守卫照旧
      if (r && r.channel === 'netease-official-128k') return r;
      var guardBudget = deadline - Date.now();
      if (guardBudget <= 500) throw new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(guardFullAudio(r.url, musicItem), guardBudget, 'guard 超时').then(function () { return r; });
    }).catch(function () {
      return attempt(idx + 1);
    });
  };
  // [v1.1.0 优化] 失败负缓存：同曲同档全链失败后 60s 内直接快速失败，
  // 避免每次重试都打满 8s 预算拖住切歌交互；成功后立即清除该键
  var negKey = String(musicItem && musicItem.id || '') + '|' + quality;
  var negMsg = resolveNegCacheGet(negKey);
  if (negMsg) return Promise.reject(new Error('聚合取链失败：' + negMsg + '（负缓存 ' + Math.round(NEG_CACHE_TTL / 1000) + 's）'));
  // [v1.4.0 优化1] 成功缓存命中：直接返回，跳过全链与守卫（进程内读取 <1ms，
  // 此前 VIP 歌 128k 冷链实测 ~645ms）；30min TTL 内复用，第三方 CDN 直链实测 ~2h 有效
  var okHit = resolveOkCacheGet(negKey);
  if (okHit) return Promise.resolve(okHit);
  return attempt(0).then(function (r) {
    resolveNegCacheDel(negKey);
    // [v1.4.0 优化1] 成功后写入结果缓存（含 url/channel/actualQuality/bytes）
    if (r && r.url) {
      resolveOkCacheSet(negKey, { url: r.url, channel: r.channel, actualQuality: r.actualQuality, bytes: r.bytes });
    }
    return r;
  }, function (e) {
    resolveNegCacheSet(negKey, String((e && e.message) || '所有通道失败').slice(0, 80));
    throw e;
  });
}

/**
 * 试听片段兜底守卫：Range 探测 audio 文件总长，
 * 按 128kbps 估算时长（高码率文件会被高估时长，不会误杀完整文件），
 * 估算时长 < 标称时长 60% 判为试听片段。仅标称时长 >=60s 时启用估算。
 * 探测请求自身失败（Range 不支持/超时）不惩罚源，放行由播放器处理。
 */
// [v1.1.0 P2-3] 通用长度校验：按 128kbps 估算时长 vs 标称时长 60% 判试听
// （高码率文件会被高估时长，不会误杀完整文件）；仅标称时长 >=60s 时启用估算。
function guardCheckSize(total, musicItem) {
  var dur = musicItem && parseInt(musicItem.duration, 10) || 0;
  if (total > 0 && dur >= 60) {
    var est = total / 16000; // 128000bps / 8bit
    if (est < dur * 0.6) {
      throw new Error('guard: trial clip ~' + Math.round(est) + 's/' + dur + 's');
    }
  }
}

// [v1.1.0 P2-3] Range 探测（旧路径，作为 HEAD 失败时的回退）
function guardRangeProbe(url, musicItem) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-0' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var headers = res.headers || {};
    var ctype = String(headers['content-type'] || headers['Content-Type'] || '');
    if (/text\/html/i.test(ctype)) {
      throw new Error('guard: not audio (html)');
    }
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) {
      total = parseInt(mm[1], 10) || 0;
    } else if (res.status !== 206) {
      // 无 content-range 且非 206：仅 200 整文件响应时 content-length 才等于总长
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    guardCheckSize(total, musicItem);
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // 探测请求本身失败：不拦，放行
  });
}

function guardFullAudio(url, musicItem) {
  // [v1.1.0 P2-3] HEAD 优先探测：零流量、content-length 即全文件总长（Range 探测对部分 CDN 拿不到
  // content-range 会漏判）；HEAD 不被支持或状态异常时回退旧 Range 探测，行为不回退。
  return axios.head(url, {
    timeout: RELAY_TIMEOUT, validateStatus: null, maxRedirects: 5
  }).then(function (res) {
    if (res.status >= 200 && res.status < 300) {
      var headers = res.headers || {};
      var ctype = String(headers['content-type'] || headers['Content-Type'] || '');
      if (/text\/html/i.test(ctype)) {
        throw new Error('guard: not audio (html)');
      }
      var total = parseInt(headers['content-length'] || headers['Content-Length'] || 0, 10) || 0;
      guardCheckSize(total, musicItem);
      return undefined;
    }
    throw new Error('guard: head status ' + res.status);
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    return guardRangeProbe(url, musicItem);
  });
}

// ==================== 歌词适配（网易云） ====================
// 端点均经 2026-09-05 探针实测（artifacts/lyric-probe/probe-result.json），无猜测 URL。
// 网易云：/api/song/lyric 免登录，lrc + tlyric（翻译）；逐字歌词 YRC（yv=1）。
//
// v0.7.0：歌词单源超时压到 3s（LYRIC_TIMEOUT），避免顶到 10s 沙箱上限。
var LYRIC_TIMEOUT = 3000;

// ---------- 逐字歌词（v0.7.0，P0-2） ----------
// 网易云 YRC：/api/song/lyric?lv=-1&tv=-1&yv=1 → yrc.lyric（[start,dur](s,d,0)字，部分歌返回空）。
async function fetchNeteaseYrc(id) {
  if (!id) throw new Error('yrc no id');
  var r = await axios.get('https://music.163.com/api/song/lyric', {
    params: { id: id, lv: -1, tv: -1, yv: 1 },
    timeout: LYRIC_TIMEOUT, headers: neteaseHeaders()
  });
  var yrc = r.data && r.data.yrc && r.data.yrc.lyric;
  if (!yrc) throw new Error('no yrc (song has none)');
  return String(yrc);
}

// [v1.3.0 P2] YRC → QRC 兼容格式转换（对齐 baka 更细粒度实现）：
// 网易云 YRC 行结构为 [startMs,durMs](startMs,durMs,0)字(startMs,durMs,0)字...，与 QRC 后缀式
// 逐字行同构，宿主 lrcParser 原生解析 [ms,dur] + (start,dur,0) 字级时间，无需改写时间戳；
// 需要做的只有两件事：
// ① 过滤 YRC 头部的 JSON 元数据行（{"t":0,"c":[...]}——宿主不识别，会成无时间戳垃圾行）与注释行；
// ② 以 ILyricSource { rawLrc } 形态返回：宿主 getWordByWordLyric 只消费 lrcSource.rawLrc，
//    v1.2.1 返回裸字符串时宿主判空丢弃，逐字歌词实际从未生效（v1.3.0 修复）。
function yrcToQrcSource(yrcText) {
  var s = String(yrcText || '');
  if (!s.trim()) throw new Error('yrc empty');
  var lines = s.split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i].trim();
    if (!ln) continue;
    if (ln.charAt(0) === '{') continue; // YRC 元数据行（歌曲/歌手信息 JSON）
    if (/^\[\d+,\d+\]\/\//.test(ln)) continue; // QRC/YRC 注释行（宿主同款过滤规则，双保险）
    out.push(ln);
  }
  if (!out.length) throw new Error('yrc no timed lines');
  return { rawLrc: out.join('\n') };
}

async function getWordByWordLyricImpl(musicItem) {
  if (!musicItem || !musicItem._src) throw new Error('该条目无音源信息，无法取逐字歌词');
  var srcMap = musicItem._src;
  var tried = [];
  // ① 网易云 YRC 直取
  if (srcMap.netease && srcMap.netease.id) {
    try { return await yrcToQrcSource(await fetchNeteaseYrc(srcMap.netease.id)); }
    catch (e) { tried.push('netease: ' + String(e && e.message).slice(0, 50)); }
  }
  // ② 云搜索接力（标题+歌手搜同曲 → YRC）
  try {
    var kw = (musicItem.title || '') + ' ' + (musicItem.artist || '');
    var cs = await axios.get('https://music.163.com/api/cloudsearch/pc', {
      params: { s: kw, type: 1, limit: 3 },
      timeout: LYRIC_TIMEOUT, headers: neteaseHeaders()
    });
    var songs = cs.data && cs.data.result && cs.data.result.songs;
    // [v1.1.0 P2-2] 接力命中必须同曲：标题归一化一致且歌手兼容，
    // 防止把同名翻唱/翻版/伴奏的逐字歌词张冠李戴
    if (songs && songs.length) {
      for (var si = 0; si < songs.length; si++) {
        var cand = songs[si];
        var candArtist = ((cand.ar || cand.artists || [])).map(function (a) { return (a && a.name) || ''; }).join('/');
        var titleOk = normalizeTitle(cand.name) === normalizeTitle(musicItem.title);
        var a1 = normalizeArtist(candArtist);
        var a2 = normalizeArtist(musicItem.artist || '');
        var artistOk = a1 === a2 || (a1 && a2 && (a1.indexOf(a2) >= 0 || a2.indexOf(a1) >= 0));
        if (titleOk && artistOk) {
          return await yrcToQrcSource(await fetchNeteaseYrc(String(cand.id)));
        }
      }
    }
    throw new Error('no same-song match');
  } catch (e) { tried.push('netease-relay: ' + String(e && e.message).slice(0, 50)); }
  throw new Error('逐字歌词不可用（' + tried.join(' | ') + '）');
}

// [v1.1.0 优化] 歌词缓存（进程内，24h TTL；>300 条整体重置——歌词内容不变，缓存收益稳定）
var LYRIC_CACHE_TTL = 24 * 60 * 60 * 1000;
var lyricCache = {};

var LYRIC_ADAPTERS = {
  netease: async function (raw) {
    if (!raw || !raw.id) throw new Error('netease no id');
    var cached = lyricCache[raw.id];
    if (cached && Date.now() - cached.ts < LYRIC_CACHE_TTL) return cached.val;
    var r = await axios.get('https://music.163.com/api/song/lyric', {
      params: { id: raw.id, lv: -1, tv: -1, rv: -1 }, // [v1.2.0] rv=-1：罗马音（romalrc）
      timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    });
    var lrc = r.data && r.data.lrc && r.data.lrc.lyric;
    if (!lrc) throw new Error('netease no lyric');
    var out = { rawLrc: String(lrc) };
    var tlyric = r.data && r.data.tlyric && r.data.tlyric.lyric;
    if (tlyric) out.translation = String(tlyric);
    // [v1.2.0 P2] 罗马音（对齐 baka：宿主 ILyricSource 支持 romanization）
    var romalrc = r.data && r.data.romalrc && r.data.romalrc.lyric;
    if (romalrc) out.romanization = String(romalrc);
    var cacheKeys = Object.keys(lyricCache);
    if (cacheKeys.length > 300) lyricCache = {}; // 整体重置，防无限增长
    lyricCache[raw.id] = { ts: Date.now(), val: out };
    return out;
  }
};

// 歌词源尝试顺序（v0.7.0 优化，P1-5）：条目原生源优先（命中率高且省一次跨源请求），
// 其余按直链稳定性排序；最多尝试 3 源（LYRIC_TIMEOUT=3s × 3 ≈ 9s < 10s 上限）
var LYRIC_SOURCE_ORDER = ['netease'];

async function getLyricImpl(musicItem) {
  if (!musicItem || !musicItem._src) throw new Error('该条目无音源信息，无法取歌词');
  var srcMap = musicItem._src;
  var tried = [];
  // 原生源置顶，其余按 LYRIC_SOURCE_ORDER 排列
  var order = [];
  if (musicItem._srcOrder) {
    for (var s0 = 0; s0 < musicItem._srcOrder.length; s0++) order.push(musicItem._srcOrder[s0]);
  }
  for (var oi = 0; oi < LYRIC_SOURCE_ORDER.length; oi++) {
    if (order.indexOf(LYRIC_SOURCE_ORDER[oi]) < 0) order.push(LYRIC_SOURCE_ORDER[oi]);
  }
  var maxAttempts = 3;
  var attempted = 0;
  for (var i = 0; i < order.length && attempted < maxAttempts; i++) {
    var src = order[i];
    if (!srcMap[src] || !LYRIC_ADAPTERS[src]) continue;
    attempted++;
    try {
      return await LYRIC_ADAPTERS[src](srcMap[src], musicItem);
    } catch (e) {
      tried.push(src + ': ' + String(e && e.message).slice(0, 60));
    }
  }
  throw new Error('歌词获取失败（' + tried.join(' | ') + '）');
}

// ==================== 插件定义 ====================

var plugin = {
  name: '网易云音乐',
  platform: 'netease',
  version: '1.9.15', // [v1.9.15 v1.9.15 接口吸收版（承接「23 个音乐插件可吸收取链接口」调研，实测存活口径 2026-09-25）：① P1-3 既有三路 eapi 通道响应解密修复——2026-09-25 真网探针实测 eapi 响应体为 AES-128-ECB 密文（同 key e82ckenh8dichen8），旧实现明文 JSON.parse 必失败致通道静默失效，本版改 arraybuffer 接收 + 纯 JS AES 解密（新增 aes128EcbDecrypt/bytesToUtf8/eapiParseResponseData）+ 明文错误响应兜底直解，修复后游客态免费曲（fee=0）实测取回 m8xx.music.126.net 官方直链、VIP/无版权 url=null 如实拒收接力；② P0-2 海棠 wy.php 直连兜底（music.haitangw.cc/music/wy.php，302/JSON 双形态，standard→standard/high→exhigh/super→lossless）挂 stdChain 与 high+ 链尾第二兜底（outerUrl 之前），不改变主链优先级，actualQuality 如实声明由外层守卫 fail-closed；详见头部 changelog；；v1.9.14 长青 SVIP 网易（yinyue.haitangw.net/wy/wy.php）故障替补通道接入版：新增 netease:longqing 通道作为星海主力 yy.zddyr.top 的替补，standard 接力链与 high+ 首段竞速均为 zddyr().catch(longqing) 包裹仅主力失效后启用；high 档映射 exhigh（真 320k）绕开长青 320k 档服务端虚标（实返 fLaC 28.4MB），有损档响应 fLaC 魔数守卫拒收接力；详见头部 changelog；v1.9.13 包升版（QQ 源 a.aa.cab 通道方案A 拒绝虚标修复，本源无代码改动）；v1.9.12 包升版（QQ 源接入 a.aa.cab 新通道，本源无代码改动）；v1.9.11 星澜 stellarwave v4.0.0 可用通道接入版：wy 侧新增 netease:stellarwave-zddyr（yy.zddyr.top lx API）与 netease:stellarwave-cenguigui（api.cenguigui.cn）两通道——standard 接力链 + high/super 首段竞速，lossless 档 fLaC 魔数 + br 双防虚标校验（实测 2737753398 flac 虚标回 128k mp3），星海 wy 后端（gdstudio）与官方 eapi（=既有 neteaseEapiAnonResolve 同源）等无增量不重复接入，详见头部 changelog；v1.9.10 随包升版（无代码改动，版本号统一升）；v1.9.9 音质标识一致性核查版（无代码行为改动，版本号统一升）：六页键集核查 0 虚标 0 不一致，取链真实性实测 9/9 通过（含 flac24bit/hires 实档），详见排查总表-v1.9.9；v1.9.8版本号统一 + 封面 https 升级版（导出边界把封面/头像类字段 http→https，白名单 *.126.net，cleartext 兼容）；v1.9.5 MV 画质表修复版：官方通道改以 api/mv/detail brs 上游实档构建 availableVideoQualities（旧版单实档致宿主画质菜单无法切档），enhance url 单档通道降为兜底，海棠 WYMV 兜底不变；v1.9.4 第三方取链修复 + size 字段版：GD Studio（music-api.gdstudio.xyz 实测整体失效、5min 限流） + 7boe + sedet + 听会（47.109.94.179 死亡）共 4 通道从竞速池移除，保留函数体注释掉，2026-09-11 标记失效；getMediaSource 返回值补 size 字段（取链响应直带 bytes > HEAD Range 0-0 探测 > 留空），详见头部 changelog；v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机 SHEET_URL_UNRECOGNIZED，详见头部 changelog；v1.9.1 随包升版：歌单对象补 author 别名字段（宿主协议读 artist，任务字段清单要求 author，两者都传），导入修复详见酷狗 v1.9.1 changelog 与本轮自测清单；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——次合代 wy=既有星海通道、ikun wy=既有 ikun 通道（atmos 实测 ~2740kbps），复核详见头部 changelog；v1.8.4] 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem（title/description 对齐宿主契约，meta 随 v6 detail 响应零额外请求回传）；[v1.8.3] 质检遗留优化版（Q-02 错误前缀统一 / Q-03 code 统一，详见头部）；[v1.8.2] 歌单解析修复版：P0-1 mobile URL 正则放宽 + P1-3 短链路径形态 + P2 条目 platform + P2 错误码（详见头部 v1.8.2 changelog）；[v1.8.0] MV 参数对齐基线，对照 MusicFree v1.0.0 宿主协议（getMvSourceImpl 顶层守卫字段兜底 + P1 字段补齐，详见头部 v1.8.0 changelog）
  author: '研发2号',
  description: '网易云音乐独立源插件 v1.9.8（v1.9.8 版本号统一 + 封面 https 升级版：导出边界把封面/头像类字段 http→https（白名单 *.126.net，安卓 cleartext 兼容）；v1.9.5 MV 画质表修复版：官方 MV 通道改以 api/mv/detail brs 上游实档构建 availableVideoQualities，宿主画质菜单可按实档切档；v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（axios maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机导入 SHEET_URL_UNRECOGNIZED，详见头部 changelog；上一版 v1.9.2 为分享链接文本自动提取 URL 版；v1.9.1 随包升版：歌单对象补 author 别名字段，详见头部 v1.9.1 changelog；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——BakaMusic 确认的次合代/ikun 网易云通道本插件 v1.3.1/v1.1.0 起已竞速接入（ikun atmos 实测 fLaC ~92MB ≈2740kbps 全场最高音质），全豆要 wy 实测虚标 128k 不接入，详见头部 v1.9.0 changelog；v1.8.4 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem 歌单对象——标题/介绍/封面/作者随 v6/playlist/detail 响应零额外请求回传，介绍字段 description 对齐宿主 v1.0.0 契约；v1.8.3 质检遗留优化版：错误消息统一 [netease] 前缀 + 兜底分支 code 统一为 SHEET_URL_UNRECOGNIZED；v1.8.2 歌单解析修复版：P0-1 移动端 m/playlist 链接导入修复 + P1-3 短链路径形态支持 + 歌单条目 platform 字段 + 歌单导入错误码统一；v1.8.0 MV 参数对齐基线：getMvSourceImpl 顶层守卫字段兜底（musicItem.mv/mvId/mvid 任一命中即映射到 _src.netease.mv），与酷我/QQ/咪咕 v1.8.0 行为一致；MV_SOURCE.netease 官方/海棠双通道已含 P1 字段（videoQuality/availableVideoQualities/size/expiresAt/userAgent/mimeType），v1.8.0 补：availableVideoQualities 补 width/height（按档位标称值 16:9 估算）+ getMvSourceImpl 内 videoQuality 写回 musicItem.videoQuality（宿主 UI 切档后回显）+ 海棠兜底 result 补 userAgent（对齐官方通道口径）；v1.6.0 匿名 eapi 取链通道（免费歌免 Cookie 提到 320k/无损）；YRC 逐字与 result.songs 解析路径实测核验在位）：搜索/取链/歌词（LRC/翻译/罗马音/YRC 逐字）/网易云官方榜 63 榜 + 新歌速递/歌单全量导入（trackIds 批量翻页）/专辑/歌手/歌单搜索与详情/MV 播放（画质菜单回填实际档位/大小/有效期/标称宽高）/精品歌单广场（hot 标签横向 pinned）/歌曲评论（按歌曲实际可用档位展示音质菜单，getMusicInfo 补齐音质大小）。',
  // [v1.2.0 P2] primaryKey：宿主 mediameta 存储约定（对齐 baka）
  primaryKey: ['id'],
  supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'], // [v1.5.0] 增 lyric（宿主歌词关联面板 searchLrc）
  // [v0.7.2 fix#8 核验] supportedQualities 全档声明；[v1.3.0 P1] 新增 atmos/master/dolby 增强档
  // （此前折叠进 hires 不可见）。可用性由条目 qualities 决定：无 VIP 权益的歌曲列表不带这三档
  // 尺寸/标记，宿主音质菜单自然不显示；取链无 Cookie 时 eapi-v1 拒答、第三方链按 hires 降级。
  supportedQualities: ['128k', '192k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master', 'dolby'],
  cacheControl: 'no-store', // 各源播放链接多为签名短时效链接，必须现取
  userVariables: [
    { key: 'neteaseCookie', name: '网易云 Cookie（可选）', hint: '选填；官方 eapi 高码率取链需有效 VIP Cookie，不填走第三方备源（海棠/GD Studio/SE 云音/oiapi/bugpk/7boe）。⚠️ Cookie 属敏感凭据，请仅填入自己账号的、来源可信的 Cookie，勿与他人共享' }
  ],
  hints: {
    search: ['检索网易云曲库，支持歌曲/专辑/歌手/歌单搜索', '播放时按音质档位自动路由：官方直连或第三方接力，主源失败自动切换备源', '歌词搜索：输入任意歌词片段（如「故事的小黄花」），返回歌词包含该片段的歌曲'],
    importMusicSheet: [
      '支持网易云歌单分享链接，如 music.163.com/playlist?id=xxx',
      '单次最多导入 500 首（trackIds 全量批量翻页，不受「详情页只显示 10 首」限制）',
      '纯数字歌单 ID 视为网易云歌单 id，可直接粘贴'
    ]
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }；解包出关键词（所有 searchType 通用）
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var q = kw;
    if (type === 'album') return aggregateSearchBy(ALBUM_SEARCH_ADAPTERS, q, page, albumKeyOf, buildAlbumItem);
    if (type === 'artist') return aggregateSearchBy(ARTIST_SEARCH_ADAPTERS, q, page, artistKeyOf, buildArtistItem);
    if (type === 'sheet') return aggregateSearchBy(SHEET_SEARCH_ADAPTERS, q, page, sheetKeyOf, buildSheetSearchItem);
    if (type === 'lyric') return lyricSearchImpl(q, page); // [v1.5.0] 歌词搜索（宿主歌词关联面板 searchLrc）
    if (type !== 'music') return { isEnd: true, data: [] };

    var names = ['netease'];
    var tasks = names.map(function (n) {
      // [v1.1.0 P2-1] 失败返回 null 与「空结果 []」区分：零结果不应误报「搜索失败」错误
      return SEARCH_ADAPTERS[n](q, page).catch(function () { return null; });
    });
    var settled = await Promise.all(tasks);
    var all = [];
    var okCount = 0;
    var rawLen = 0;
    for (var i = 0; i < settled.length; i++) {
      if (settled[i] === null) continue; // 通道失败
      okCount++;
      rawLen += settled[i].length;
      all = all.concat(settled[i]);
    }
    if (okCount === 0) throw new Error('搜索失败：网易云请求失败');

    var groups = aggregateItems(all);
    var scored = groups.map(function (g, idx) {
      return { g: g, score: scoreOf(g.members[0], g.members.length), idx: idx };
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.idx - b.idx;
    });
    var data = [];
    for (var j = 0; j < scored.length; j++) {
      data.push(buildMusicItem(scored[j].g));
    }
    // v0.7.0：封面反查移出搜索关键路径（逐条 HTTP 串行拖慢首屏），
    // 改由 getMusicInfo 在歌曲详情页/播放时按需补齐
    // [v1.1.0 O-2] isEnd 按原始返回条数判断：聚合去重后条数变少不代表没有下一页
    return { isEnd: rawLen < SEARCH_PAGE_SIZE, data: data };
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    var q = normalizeQuality(quality);
    var r = await resolveWithFallback(musicItem, q);
    // [v1.9.4] 边界补 size 兜底：竞速链返回无 size 时（老通道/官方链未带 size 字段），
    // Range 0-0 HEAD 探测 Content-Range/Content-Length 写回；探测失败留空（不阻断取链）。
    if (r && r.url && !r.size) {
      try {
        var sz = await probeHeadSize(r.url, 2000);
        if (sz > 0) r.size = sz;
      } catch (e) { /* fail-soft */ }
    }
    // [v1.9.4] 补宿主标准字段 quality（= actualQuality）：各通道仅携带 actualQuality，
    // 边界处统一补齐 quality 字段，对齐 QQ/酷我 v1.9.4 行为与 IMediaSourceResult 契约
    if (r && r.url && r.quality === undefined && r.actualQuality) r.quality = r.actualQuality;
    return r;
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  // v0.7.0 P0-2：逐字歌词（网易云 YRC）
  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  // v0.7.0 P0-3：单曲分享链接导入（网易云）
  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // v0.7.0 P0-4：歌曲详情（补齐封面/专辑/时长/MV）
  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  // [v1.2.0 P1] 歌曲分享链接（对齐 baka getMusicDetailPageUrl）：宿主分享面板消费
  async getMusicDetailPageUrl(musicItem) {
    var sid = '';
    if (musicItem && musicItem._src && musicItem._src.netease) {
      sid = String(musicItem._src.netease.id || '');
    }
    if (!sid && musicItem) {
      // 兜底：从复合 id（netease_<sid>）解析纯数字 sid
      var m = String(musicItem.id || '').match(/(\d+)\s*$/);
      if (m) sid = m[1];
    }
    return sid ? 'https://music.163.com/#/song?id=' + sid : '';
  },

  async getTopLists() {
    // [v0.8.0] 「网易云官方榜」组（/api/toplist 全量，免登录）；拉取失败返回空组
    var groups = [];
    try {
      var neList = await fetchNeteaseToplistGroup();
      if (neList && neList.length) {
        groups.push({ title: '网易云官方榜', data: neList });
      }
    } catch (e) { /* 官方榜接口失败降级 */ }
    // [v1.1.0 接口扩充·中优] 新歌速递入口（/api/personalized/newsong，免登录实测可用）
    groups.push({
      title: '网易云推荐', data: [
        { id: 'ne~newsong', title: '新歌速递', description: '每日推荐新音乐' }
      ]
    });
    return groups;
  },

  async getTopListDetail(topListItem, page) {
    if (page && page > 1) return { isEnd: true, musicList: [] };
    // [v0.8.0] 网易云官方榜条目（ne~ 前缀）走网易云官方榜详情
    var tid = topListItem && topListItem.id;
    if (typeof tid === 'string' && tid.indexOf(NE_CHART_PREFIX) === 0) {
      // [v1.1.0 接口扩充·中优] 新歌速递特殊分支
      if (tid === 'ne~newsong') return fetchNeteaseNewsong();
      return fetchNeteaseChartDetail(tid.slice(NE_CHART_PREFIX.length));
    }
    throw new Error('未知榜单: ' + (topListItem && topListItem.id));
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async getAlbumInfo(albumItem) {
    return getAlbumInfoImpl(albumItem);
  },

  async getArtistWorks(artistItem, page, type) {
    return getArtistWorksImpl(artistItem, page, type);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
  },

  async getRecommendSheetTags() {
    return getRecommendSheetTagsImpl();
  },

  async getRecommendSheetsByTag(tagItem, page) {
    return getRecommendSheetsByTagImpl(tagItem, page);
  },

  async getMusicComments(musicItem, page) {
    return getMusicCommentsImpl(musicItem, page);
  },

  async getMvSource(musicItem, videoQuality) {
    return getMvSourceImpl(musicItem, videoQuality);
  },

  supportedVideoQualities: [
    { key: '240p', label: '240P' },
    { key: '480p', label: '480P' },
    { key: '720p', label: '720P' },
    { key: '1080p', label: '1080P' }
  ],

  // ===== 以下为内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    normalizeTitle: normalizeTitle,
    looseTitleKey: looseTitleKey,
    normalizeArtist: normalizeArtist,
    makeKey: makeKey,
    parseVersionTags: parseVersionTags,
    versionCompatible: versionCompatible,
    versionTier: versionTier,
    isSameSong: isSameSong,
    aggregateItems: aggregateItems,
    buildMusicItem: buildMusicItem,
    scoreOf: scoreOf,
    pickCandidates: pickCandidates,
    canServe: canServe,
    SOURCE_WEIGHT: SOURCE_WEIGHT,
    SOURCE_QUALITIES: SOURCE_QUALITIES,
    SEARCH_ADAPTERS: SEARCH_ADAPTERS,
    searchLyricNetease: searchLyricNetease, // [v1.5.0] 歌词搜索适配器
    lyricSearchImpl: lyricSearchImpl, // [v1.5.0] 歌词搜索主实现
    RESOLVE_ADAPTERS: RESOLVE_ADAPTERS,
    guardFullAudio: guardFullAudio,
    SHEET_URL_RESOLVERS: SHEET_URL_RESOLVERS,
    SHEET_FETCHERS: SHEET_FETCHERS,
    resolveSheetId: resolveSheetId,
    buildSheetItem: buildSheetItem,
    importMusicSheetImpl: importMusicSheetImpl,
    LYRIC_ADAPTERS: LYRIC_ADAPTERS,
    getLyricImpl: getLyricImpl,
    getAlbumInfoImpl: getAlbumInfoImpl,
    getArtistWorksImpl: getArtistWorksImpl,
    getMusicSheetInfoImpl: getMusicSheetInfoImpl,
    getRecommendSheetTagsImpl: getRecommendSheetTagsImpl,
    getRecommendSheetsByTagImpl: getRecommendSheetsByTagImpl,
    getMusicCommentsImpl: getMusicCommentsImpl,
    getMvSourceImpl: getMvSourceImpl,
    aggregateSearchBy: aggregateSearchBy,
    normalizeQuality: normalizeQuality,
    QUALITY_KEY_MAP: QUALITY_KEY_MAP,
    importMusicItemImpl: importMusicItemImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getWordByWordLyricImpl: getWordByWordLyricImpl,
    SONG_URL_RESOLVERS: SONG_URL_RESOLVERS,
    resolveSongId: resolveSongId,
    SONG_DETAIL_FETCHERS: SONG_DETAIL_FETCHERS,
    fetchNeteaseComments: fetchNeteaseComments,
    fetchNeteaseYrc: fetchNeteaseYrc,
    yrcToQrcSource: yrcToQrcSource,
    haitangLevelOf: haitangLevelOf,
    resolveHaitang: resolveHaitang,
    resolveNeteaseXinghai: resolveNeteaseXinghai,
    resolveNetease7boe: resolveNetease7boe,
    fetchNeteaseToplistGroup: fetchNeteaseToplistGroup,
    fetchNeteaseChartDetail: fetchNeteaseChartDetail,
    NE_CHART_PREFIX: NE_CHART_PREFIX,
    neteaseEapiResolve: neteaseEapiResolve,
    neteaseEapiResolveV1: neteaseEapiResolveV1,
    neteaseEapiAnonResolve: neteaseEapiAnonResolve, // [v1.6.0 P0] 匿名 eapi 通道（自测用导出）
    resolveNeteaseZddyr: resolveNeteaseZddyr, // [v1.9.11] 星澜 wy 星海后端（自测用导出）
    resolveNeteaseCenguigui: resolveNeteaseCenguigui, // [v1.9.11] 星澜 wy 笒鬼鬼后端（自测用导出）
    resolveNeteaseSedet: resolveNeteaseSedet,
    resolveOiapi: resolveOiapi,
    resolveBugpk: resolveBugpk,
    resolveNeteaseTinghui: resolveNeteaseTinghui,
    resolveNeteaseIkun: resolveNeteaseIkun,
    bitrateHostAq: bitrateHostAq,
    parseMbSize: parseMbSize,
    resolveNeteaseOuterUrl: resolveNeteaseOuterUrl,
    resolveNegCacheGet: resolveNegCacheGet,
    resolveNegCacheDel: resolveNegCacheDel,
    NEG_CACHE_TTL: NEG_CACHE_TTL,
    fetchNeteaseSongsByIds: fetchNeteaseSongsByIds,
    neteaseTrackEntry: neteaseTrackEntry,
    fetchNeteaseNewsong: fetchNeteaseNewsong,
    getArtistInfoImpl: getArtistInfoImpl,
    getHotSearchImpl: getHotSearchImpl,
    searchMvImpl: searchMvImpl,
    getMvDetailImpl: getMvDetailImpl,
    gdCoolingDown: gdCoolingDown,
    qualMapOfNetease: qualMapOfNetease,
    LYRIC_TIMEOUT: LYRIC_TIMEOUT,
    isAllowedMediaUrl: isAllowedMediaUrl,
    withTimeout: withTimeout,
    RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
    RELAY_TIMEOUT: RELAY_TIMEOUT,
    internalToHostQuality: internalToHostQuality,
    eapiEncrypt: eapiEncrypt,
    md5Hex: md5Hex,
    raceSuccess: raceSuccess,
    resolveNetease: resolveNetease,
    resolveWithFallback: resolveWithFallback
  }
};

// [v1.9.7 封面 https 升级（cleartext 兼容）] 2026-09-11 封面图专项审计发现：网易 20/20、酷狗 19/19
// 封面 URL 为 http:// 明文，安卓 9+ WebView 默认禁明文 HTTP，App 内可能整页裂图。对已实测支持
// https 的图片 host（网易 *.126.net、酷狗 *.kugou.com，imge/singerimg.kugou.com 与 pX.music.126.net
// 均 200 实测）在插件导出边界统一升级 https；仅作用于封面/头像类字段，其它字段与未验证 host 不动。
var IMG_HTTPS_HOST_RE = /^http:\/\/(?:[a-z0-9-]+\.)*(?:126\.net|kugou\.com)\//i;
var IMG_HTTPS_FIELDS = { artwork: 1, coverImg: 1, avatar: 1, pictures: 1, cover: 1, mvArtwork: 1 };
function httpsifyImgs(v, depth) {
  if (!v || depth > 6) return v;
  if (Array.isArray(v)) {
    for (var _hi = 0; _hi < v.length; _hi++) httpsifyImgs(v[_hi], depth + 1);
    return v;
  }
  if (typeof v !== 'object') return v;
  for (var hk in v) {
    if (!Object.prototype.hasOwnProperty.call(v, hk)) continue;
    var hv = v[hk];
    if (typeof hv === 'string' && IMG_HTTPS_FIELDS[hk] && hv.indexOf('http://') === 0 && IMG_HTTPS_HOST_RE.test(hv)) {
      v[hk] = 'https://' + hv.slice(7);
    } else if (hv && typeof hv === 'object') {
      httpsifyImgs(hv, depth + 1);
    }
  }
  return v;
}
(function wrapImgHttps() {
  var IMG_SKIP = { platform: 1, version: 1, description: 1, supportedSearchType: 1, defaultSearchType: 1, primaryKey: 1, userVariables: 1, hints: 1, _internal: 1 };
  Object.keys(plugin).forEach(function (wk) {
    if (typeof plugin[wk] !== 'function' || IMG_SKIP[wk]) return;
    var _worig = plugin[wk];
    plugin[wk] = function () {
      var wr = _worig.apply(this, arguments);
      if (wr && typeof wr.then === 'function') return wr.then(function (wx) { return httpsifyImgs(wx, 0); });
      return httpsifyImgs(wr, 0);
    };
  });
})();

module.exports = plugin;

function formatTs(ts){var d=new Date(Number(ts));if(isNaN(d.getTime()))return '';return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}

// ==================== 专辑/歌手/歌单搜索（网易云） ====================
// 端点出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核（artifacts/v05-probe/）。
// 注：本段位于 module.exports 之后，函数声明提升 + 调用时求值，行为与前置声明一致。

var SEARCH_PAGE_SIZE = 20;

function searchAlbumNetease(q, page) {
  // doc 搜索：/api/search/get type=10 → result.albums[]
  return axios.get('https://music.163.com/api/search/get', {
    params: { s: q, type: 10, limit: SEARCH_PAGE_SIZE, offset: (page - 1) * SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  }).then(function (res) {
    var albums = ((res.data && res.data.result) || {}).albums || [];
    return albums.map(function (it) {
      return {
        source: 'netease', sid: str(it.id),
        title: str(it.name),
        artist: (it.artist && it.artist.name) ? String(it.artist.name) : splitArtists(it.artists),
        artwork: it.picUrl ? String(it.picUrl) : '',
        date: it.publishTime ? formatTs(it.publishTime) : '',
        worksNum: it.size || 0,
        raw: { id: str(it.id) }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
function searchArtistNetease(q, page) {
  return axios.get('https://music.163.com/api/search/get', {
    params: { s: q, type: 100, limit: SEARCH_PAGE_SIZE, offset: (page - 1) * SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  }).then(function (res) {
    var artists = ((res.data && res.data.result) || {}).artists || [];
    return artists.map(function (it) {
      return {
        source: 'netease', sid: str(it.id),
        name: str(it.name),
        avatar: it.picUrl ? String(it.picUrl) : '',
        worksNum: it.musicSize || it.albumSize || 0,
        raw: { id: str(it.id) }
      };
    }).filter(function (it) { return it.sid && it.name; });
  });
}
function searchSheetNetease(q, page) {
  return axios.get('https://music.163.com/api/search/get', {
    params: { s: q, type: 1000, limit: SEARCH_PAGE_SIZE, offset: (page - 1) * SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  }).then(function (res) {
    var pls = ((res.data && res.data.result) || {}).playlists || [];
    return pls.map(function (it) {
      return {
        source: 'netease', sid: str(it.id),
        title: str(it.name),
        artist: it.creator && it.creator.nickname ? String(it.creator.nickname) : '',
        artwork: it.coverImgUrl ? String(it.coverImgUrl) : '',
        worksNum: it.trackCount || it.count || 0,
        raw: { listId: str(it.id) }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
var ALBUM_SEARCH_ADAPTERS = {
  netease: searchAlbumNetease
};
var ARTIST_SEARCH_ADAPTERS = {
  netease: searchArtistNetease
};
var SHEET_SEARCH_ADAPTERS = {
  netease: searchSheetNetease
};

// ---------- 聚合器 ----------
function aggregateBy(items, keyOf) {
  var map = {}, order = [];
  for (var i = 0; i < items.length; i++) {
    var k = keyOf(items[i]);
    if (!k) continue;
    if (!map[k]) { map[k] = { members: [] }; order.push(k); }
    map[k].members.push(items[i]);
  }
  var out = [];
  for (var j = 0; j < order.length; j++) out.push(map[order[j]]);
  return out;
}
function bestMember(members) {
  var best = members[0], bw = SOURCE_WEIGHT[best.source] || 0.5;
  for (var i = 1; i < members.length; i++) {
    var w = SOURCE_WEIGHT[members[i].source] || 0.5;
    if (w > bw || (w === bw && !best.artwork && members[i].artwork)) { best = members[i]; bw = w; }
  }
  return best;
}
function srcMapOf(members) {
  var src = {};
  for (var i = 0; i < members.length; i++) {
    var m = members[i];
    if (!src[m.source]) src[m.source] = m.raw;
  }
  return src;
}
function buildAlbumItem(group, seq) {
  var members = group.members;
  var best = bestMember(members);
  var artwork = best.artwork, date = best.date, worksNum = best.worksNum;
  for (var i = 0; i < members.length; i++) {
    if (!artwork && members[i].artwork) artwork = members[i].artwork;
    if (!date && members[i].date) date = members[i].date;
    if (!worksNum && members[i].worksNum) worksNum = members[i].worksNum;
  }
  return {
    id: best.source + '~al~' + best.sid,
    platform: 'netease',
    title: best.title, artist: best.artist,
    artwork: artwork || undefined,
    date: date || undefined,
    worksNum: worksNum || undefined,
    description: '',
    _asrc: srcMapOf(members)
  };
}
function buildArtistItem(group, seq) {
  var members = group.members;
  var best = bestMember(members);
  var avatar = best.avatar, worksNum = best.worksNum;
  for (var i = 0; i < members.length; i++) {
    if (!avatar && members[i].avatar) avatar = members[i].avatar;
    if (!worksNum && members[i].worksNum) worksNum = members[i].worksNum;
  }
  return {
    id: best.source + '~ar~' + best.sid,
    platform: 'netease',
    name: best.name, avatar: avatar || '',
    worksNum: worksNum || 0,
    description: '',
    _rsrc: srcMapOf(members)
  };
}
function buildSheetSearchItem(group, seq) {
  var members = group.members;
  var best = bestMember(members);
  var artwork = best.artwork, worksNum = best.worksNum, artist = best.artist;
  for (var i = 0; i < members.length; i++) {
    if (!artwork && members[i].artwork) artwork = members[i].artwork;
    if (!worksNum && members[i].worksNum) worksNum = members[i].worksNum;
    if (!artist && members[i].artist) artist = members[i].artist;
  }
  return {
    id: best.source + '~pl~' + best.sid,
    platform: 'netease',
    title: best.title, artist: artist || '',
    artwork: artwork || undefined,
    worksNum: worksNum || undefined,
    description: '',
    _ssrc: srcMapOf(members)
  };
}
function albumKeyOf(it) {
  return normalizeTitle(it.title) + '|' + normalizeArtist(it.artist);
}
function artistKeyOf(it) {
  return normalizeTitle(it.name);
}
function sheetKeyOf(it) {
  // [v1.1.0 P2-5] 同名歌单追加创建者键：不同创建者的同名歌单此前会被错误聚合
  return normalizeTitle(it.title) + '|' + normalizeArtist(it.artist);
}
async function aggregateSearchBy(adapterMap, q, page, keyOf, buildItem) {
  var names = Object.keys(adapterMap);
  var tasks = names.map(function (n) {
    return adapterMap[n](q, page).catch(function (e) {
      if (process && process.env && process.env.AG_DEBUG) console.error('[adapter:' + n + '] ' + String((e && e.message) || e).slice(0, 200));
      return [];
    });
  });
  var settled = await Promise.all(tasks);
  if (process && process.env && process.env.AG_DEBUG) {
    for (var di = 0; di < settled.length; di++) console.error('[agg:' + names[di] + '] items=' + (settled[di] || []).length);
  }
  var all = [];
  var okCount = 0;
  var rawLen = 0;
  for (var i = 0; i < settled.length; i++) {
    // [v1.1.0 P2-1] 失败（null）与空结果区分：零结果不再误报「搜索失败」
    if (settled[i] === null) continue;
    okCount++;
    rawLen += settled[i].length;
    all = all.concat(settled[i]);
  }
  if (okCount === 0) throw new Error('搜索失败：网易云请求失败');
  var groups = aggregateBy(all, keyOf);
  var data = [];
  for (var j = 0; j < groups.length; j++) data.push(buildItem(groups[j], j));
  data.sort(function (a, b) {
    var sa = (a.artwork ? 2 : 0) + (a.worksNum ? 1 : 0);
    var sb = (b.artwork ? 2 : 0) + (b.worksNum ? 1 : 0);
    return sb - sa;
  });
  // [v1.1.0 O-2] isEnd 按原始条数判断（同 search 主链）
  return { isEnd: rawLen < SEARCH_PAGE_SIZE, data: data };
}

// ==================== 详情解析 / 歌手作品 / MV / 推荐歌单 / 评论（网易云） ====================
// 端点出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核：
// 网易云 /api/v1/album/{id}(doc 7.1)、/api/v1/artist/songs(doc 6.2)、/api/artist/albums/{id}(doc 6.3)、
// /api/playlist/catalogue(doc 8.1)、/api/playlist/list(doc 8.2)、/api/song/enhance/play/mv/url(doc 9.x，
// 旧 /api/mv/url 已失效勿用)、/api/v1/resource/comments/R_SO_4_{id}(doc H.1)

function dedupeBySid(entries) {
  var seen = {};
  var out = [];
  for (var i = 0; i < entries.length; i++) {
    var k = entries[i].source + '|' + entries[i].sid;
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(entries[i]);
  }
  return out;
}

// 按源权重降序取 keys（详情解析的接力顺序）
function sourcesByWeight(srcMap) {
  return Object.keys(srcMap).sort(function (a, b) {
    return (SOURCE_WEIGHT[b] || 0.5) - (SOURCE_WEIGHT[a] || 0.5);
  });
}

function albumItemFromEntry(e) { return buildAlbumItem({ members: [e] }, 0); }
function artistItemFromEntry(e) { return buildArtistItem({ members: [e] }, 0); }
function sheetSearchItemFromEntry(e) { return buildSheetSearchItem({ members: [e] }, 0); }

// ---------- 专辑详情 ----------
var ALBUM_DETAIL = {
  netease: async function (raw) {
    var res = await axios.get('https://music.163.com/api/v1/album/' + raw.id, {
      // [v1.1.0 P2-6] 合集型专辑歌曲数可超 100，limit 提到 200 一次取全
      params: { limit: 200 }, timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    });
    var al = res.data && res.data.album;
    var songs = (res.data && res.data.songs) || (al && al.songs) || [];
    return {
      albumItem: {
        title: al && al.name ? String(al.name) : '',
        artist: al && al.artist && al.artist.name ? String(al.artist.name) : '',
        artwork: al && al.picUrl ? String(al.picUrl) : '',
        date: al && al.publishTime ? formatTs(al.publishTime) : '',
        worksNum: songs.length
      },
      entries: songs.map(function (it) {
        return {
          source: 'netease', sid: str(it.id),
          title: str(it.name), artist: splitArtists(it.ar),
          album: it.al && it.al.name ? String(it.al.name) : '',
          duration: it.dt ? Math.round(it.dt / 1000) : 0,
          artwork: it.al && it.al.picUrl ? String(it.al.picUrl) : '',
          raw: { id: str(it.id), mv: it.mv ? String(it.mv) : '' },
          alias: aliasOfNetease(it), // [v1.5.1 P2] 别名
          quals: qualMapOfNetease(it) // [v1.9.5] 专辑页音质标识补齐
        };
      })
    };
  }
};

async function getAlbumInfoImpl(albumItem) {
  var src = (albumItem && albumItem._asrc) || {};
  var names = sourcesByWeight(src);
  if (!names.length) throw new Error('该条目无可用的专辑详情源');
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    try {
      var out = await ALBUM_DETAIL[names[i]](src[names[i]]);
      if (!out.entries.length) throw new Error('empty album');
      var musicList = out.entries.map(buildSheetItem);
      var item = {};
      for (var k in albumItem) { if (k !== '_asrc') item[k] = albumItem[k]; }
      if (out.albumItem.title && !item.title) item.title = out.albumItem.title;
      if (out.albumItem.date && !item.date) item.date = out.albumItem.date;
      if (out.albumItem.worksNum && !item.worksNum) item.worksNum = out.albumItem.worksNum;
      if (out.albumItem.artwork && !item.artwork) item.artwork = out.albumItem.artwork;
      return { isEnd: true, albumItem: item, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('专辑详情获取失败');
}

// ---------- 歌手作品 ----------
var ARTIST_MUSIC = {
  netease: async function (raw, page) {
    var res = await axios.get('https://music.163.com/api/v1/artist/songs', {
      params: { id: raw.id, limit: 30, offset: (page - 1) * 30, order: 'hot' },
      timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    });
    // [v0.8.0] 实测匿名返回存在两种形态：{data:{songs,more}}（新版）与顶层 {songs,total,code}（旧版字段
    // artists/album/duration/mvid，沙箱数据中心 IP 稳定复现），两种都兼容，任一形态为空即视为无结果。
    var body = res.data || {};
    var data = body.data;
    var songs = (data && data.songs) || body.songs || [];
    return {
      entries: songs.map(function (it) {
        var ar = it.ar || it.artists;
        var al = it.al || it.album;
        return {
          source: 'netease', sid: str(it.id),
          title: str(it.name), artist: splitArtists(ar),
          album: al && al.name ? String(al.name) : '',
          duration: (it.dt || it.duration) ? Math.round((it.dt || it.duration) / 1000) : 0,
          artwork: al && al.picUrl ? String(al.picUrl) : '',
          raw: { id: str(it.id), mv: (it.mv || it.mvid) ? String(it.mv || it.mvid) : '' },
          alias: aliasOfNetease(it), // [v1.5.1 P2] 别名
          quals: qualMapOfNetease(it) // [v1.9.5] 歌手作品页音质标识补齐
        };
      }),
      isEnd: songs.length < 30
    };
  }
};

var ARTIST_ALBUM = {
  netease: async function (raw, page) {
    var res = await axios.get('https://music.163.com/api/artist/albums/' + raw.id, {
      params: { limit: 30, offset: (page - 1) * 30 }, timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    });
    var albums = (res.data && res.data.hotAlbums) || [];
    return {
      entries: albums.map(function (it) {
        return {
          source: 'netease', sid: str(it.id),
          title: str(it.name), artist: it.artist && it.artist.name ? String(it.artist.name) : '',
          artwork: it.picUrl ? String(it.picUrl) : '',
          date: it.publishTime ? formatTs(it.publishTime) : '',
          worksNum: it.size || 0,
          raw: { id: str(it.id) }
        };
      }),
      isEnd: albums.length < 30
    };
  }
};

async function getArtistWorksImpl(artistItem, page, type) {
  var p = page || 1;
  var src = (artistItem && artistItem._rsrc) || {};
  var names = sourcesByWeight(src);
  if (!names.length) throw new Error('该条目无可用的歌手详情源');
  var resolvers = type === 'album' ? ARTIST_ALBUM : ARTIST_MUSIC;
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    var resolver = resolvers[names[i]];
    if (!resolver) continue;
    try {
      var out = await resolver(src[names[i]], p);
      if (!out.entries.length && p === 1) throw new Error('empty result');
      var data = out.entries.map(type === 'album' ? albumItemFromEntry : buildSheetItem);
      return { isEnd: out.isEnd !== undefined ? out.isEnd : out.entries.length < 30, data: data };
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return { isEnd: true, data: [] };
}

// ---------- 歌单详情（复用 SHEET_FETCHERS.netease）----------
async function getMusicSheetInfoImpl(sheetItem, page) {
  if (page && page > 1) return { isEnd: true, musicList: [] };
  var src = (sheetItem && sheetItem._ssrc) || {};
  var names = sourcesByWeight(src);
  if (!names.length) throw new Error('该条目无可用的歌单详情源');
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    try {
      var entries = await SHEET_FETCHERS[names[i]](src[names[i]].listId);
      if (!entries.length) throw new Error('empty sheet');
      var musicList = dedupeBySid(entries).map(buildSheetItem);
      return { isEnd: true, sheetItem: sheetItem, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('歌单详情获取失败');
}

// ---------- MV 取链 ----------
// 画质 240p/480p/720p/1080p 四档；直接源：网易云 raw.mv（官方全画质 + 海棠 WYMV 兜底）。

// 画质档位标称宽高（[v1.8.0 P1-2] 16:9，对齐酷我/QQ/咪咕 v1.8.0 标称值口径）
function getNeteaseMvDimensions(qLabel) {
  var q = String(qLabel || '').toLowerCase();
  if (q === '1080p') return { width: 1920, height: 1080 };
  if (q === '720p') return { width: 1280, height: 720 };
  if (q === '480p') return { width: 854, height: 480 };
  if (q === '240p') return { width: 426, height: 240 };
  return null;
}

var MV_QUALITY_ORDER = ['240p', '480p', '720p', '1080p'];

var MV_SOURCE = {
  netease: async function (raw, qKey) {
    if (!raw || !raw.mv) return null;
    // doc 9.x：官方免登录 MV 取链，旧 /api/mv/url 已失效；r=240/480/720/1080，服务端自动降级
    var qIdx = MV_QUALITY_ORDER.indexOf(qKey);
    if (qIdx < 0) qIdx = 1;
    var rmap = ['240', '480', '720', '1080'];
    var headers = neteaseHeaders();
    // [v1.2.0 P1] 返回字段富化（对齐 baka）：回填实际档位 r / size / expiresAt / headers，
    // 并输出 availableVideoQualities（宿主 mvPlayer 用其补全画质菜单与横竖屏锁定）。
    // 官方接口实测无 width/height/bitrate 字段；r=2160 自动降级 1080，故不声明 4K 档。
    // [v1.9.5 MV 画质表修复] ① 官方 api/mv/detail 的 brs = 该 MV 上游实有档位表（key 为
    // '240'/'480'/'720'/'1080'，value 为签名直链；2026-09-11 实测 mvId 186025 = 240/480 两档）。
    // 以实档构建 availableVideoQualities（对齐 QQ/酷狗/咪咕「上游实档」口径），修复旧版
    // 只回单档导致宿主画质菜单无法切档的问题；detail 失败/无 brs 时回落 ② enhance url 通道。
    var detailFlow = axios.get('https://music.163.com/api/mv/detail', {
      params: { id: raw.mv }, timeout: SOURCE_TIMEOUT, headers: headers
    }).then(function (res) {
      var brs = res.data && res.data.data && res.data.data.brs;
      if (!brs) throw new Error('netease mv no brs');
      var tiers = [];
      for (var ti = 0; ti < MV_QUALITY_ORDER.length; ti++) {
        var ru = brs[rmap[ti]];
        if (ru && String(ru).indexOf('http') === 0) tiers.push(ti);
      }
      if (!tiers.length) throw new Error('netease mv brs empty');
      // 请求档优先；请求档高于实档时降取更低实档；请求档低于最低实档时取最低实档（如实）
      var pickTi = -1;
      for (var di = qIdx; di >= 0; di--) { if (tiers.indexOf(di) >= 0) { pickTi = di; break; } }
      if (pickTi < 0) pickTi = tiers[0];
      var dUrl = String(brs[rmap[pickTi]]);
      var dKey = MV_QUALITY_ORDER[pickTi];
      var dOut = {
        url: dUrl,
        headers: { Referer: 'https://music.163.com/', Origin: 'https://music.163.com' },
        videoQuality: dKey,
        mimeType: 'video/mp4'
      };
      if (headers['User-Agent']) dOut.userAgent = headers['User-Agent'];
      var dDims = getNeteaseMvDimensions(dKey);
      if (dDims) { dOut.width = dDims.width; dOut.height = dDims.height; }
      // 画质表 = brs 实档全列；detail 接口不带 size（宁缺毋假，不虚挂 size）
      dOut.availableVideoQualities = tiers.map(function (t2) {
        var tk = MV_QUALITY_ORDER[t2];
        var td = getNeteaseMvDimensions(tk) || {};
        return { key: tk, label: tk, width: td.width, height: td.height, mimeType: 'video/mp4' };
      });
      return dOut;
    });
    // ② 官方 enhance/play/mv/url 单档回读通道（v1.2.0 P1 原样保留，作 detail 兜底）
    var official = axios.get('https://music.163.com/api/song/enhance/play/mv/url', {
      params: { id: raw.mv, r: rmap[qIdx] }, timeout: SOURCE_TIMEOUT, headers: headers
    }).then(function (res) {
      var d = res.data && res.data.data;
      var url = d && d.url ? String(d.url) : '';
      if (!url) throw new Error('netease mv no url');
      // 服务端可能降档：以返回的 r 为准回填实际画质键
      var actualR = Number(d.r) || parseInt(rmap[qIdx], 10);
      var actualKey = MV_QUALITY_ORDER[MV_QUALITY_ORDER.indexOf(actualR + 'p')];
      if (!actualKey) actualKey = MV_QUALITY_ORDER[qIdx];
      var out = {
        url: url,
        headers: { Referer: 'https://music.163.com/', Origin: 'https://music.163.com' },
        videoQuality: actualKey,
        mimeType: 'video/mp4'
      };
      if (headers['User-Agent']) out.userAgent = headers['User-Agent'];
      var size = Number(d.size) || 0;
      var expi = Number(d.expi || d.expiresIn) || 0;
      if (size > 0) out.size = size;
      if (expi > 0) out.expiresAt = Date.now() + expi * 1000;
      // [v1.8.0 P1-2] 顶层 result 补 width/height（按档位标称值 16:9 估算）
      var dims = getNeteaseMvDimensions(actualKey);
      if (dims) { out.width = dims.width; out.height = dims.height; }
      // [v1.8.0 P1-5] 结构化为 {key,label,width,height,mimeType}（与酷我/QQ/咪咕 v1.8.0 一致）
      var opt = { key: actualKey, label: actualKey, mimeType: 'video/mp4' };
      if (size > 0) opt.size = size;
      if (dims) { opt.width = dims.width; opt.height = dims.height; }
      out.availableVideoQualities = [opt];
      return out;
    });
    // ③ 海棠 WYMV.php 兜底（quality 纯数字 240/480/720/1080，文档 8.x 实测多画质✅）；
    //    通道序：detail 实档表 → enhance url 单档 → 海棠
    return detailFlow.catch(function () { return official; }).catch(function () {
      return axios.get('https://music.haitangw.cc/MV/WYMV.php', {
        params: { id: raw.mv, quality: rmap[qIdx] },
        timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://music.haitangw.cc/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      }).then(function (res) {
        var d = res.data;
        var url = d && (d.url || (d.data && d.data.url));
        if (!url) throw new Error('haitang wymv no url');
        var fbkKey = MV_QUALITY_ORDER[qIdx];
        var fbkOut = {
          url: String(url),
          headers: { Referer: 'https://music.haitangw.cc/' },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', // [v1.8.0] 对齐官方通道口径
          videoQuality: fbkKey,
          mimeType: 'video/mp4'
        };
        // [v1.8.0 P1-2] 海棠兜底也补 width/height（按档位标称值）
        var fbkDims = getNeteaseMvDimensions(fbkKey);
        if (fbkDims) { fbkOut.width = fbkDims.width; fbkOut.height = fbkDims.height; }
        // [v1.8.0 P1-5] 海棠兜底 availableVideoQualities 结构化（与官方通道口径一致）
        var fbkOpt = { key: fbkKey, label: fbkKey, mimeType: 'video/mp4' };
        if (fbkDims) { fbkOpt.width = fbkDims.width; fbkOpt.height = fbkDims.height; }
        fbkOut.availableVideoQualities = [fbkOpt];
        return fbkOut;
      });
    });
  }
};

async function getMvSourceImpl(musicItem, videoQuality) {
  if (!musicItem) return null;
  var qKey = videoQuality && typeof videoQuality === 'string' ? videoQuality : (videoQuality && videoQuality.key) || '480p';
  // [v1.2.0] 4k/2160p 等未声明档位就近降级到 1080p（官方接口 r=2160 实测降级 1080）
  if (MV_QUALITY_ORDER.indexOf(qKey) < 0) {
    qKey = /2160|4k/i.test(String(qKey)) ? '1080p' : MV_QUALITY_ORDER[1];
  }
  var src = musicItem._src || {};
  if (!src.netease) src.netease = {};
  var mvRaw = src.netease;
  // [v1.8.0 P0-3] 顶层守卫字段兜底：musicItem.mv / mvId / mvid 任一命中即映射到
  // _src.netease.mv；外链导入/旧缓存条目没有 _src.netease.mv 也有顶层守卫字段时
  // 也能正确取 MV，与酷我/QQ/咪咕 v1.8.0 行为一致。
  if (!mvRaw.mv) {
    var cand = musicItem.mv || musicItem.mvId || musicItem.mvid;
    if (cand && typeof cand === 'object') cand = cand.id || cand.mvId || cand.mvid;
    if (cand) mvRaw.mv = String(cand);
  }
  if (!mvRaw.mv) return null;
  try {
    var mv = await MV_SOURCE.netease(mvRaw, qKey);
    // [v1.1.0 P2-4] 中央白名单校验：MV 直链（含海棠兜底段）未通过协议/域名校验一律返回 null
    if (!mv || !mv.url || !isAllowedMediaUrl(mv.url)) return null;
    // [v1.8.0 P1-1] videoQuality 写回 musicItem.videoQuality（宿主 UI 切档后回显）
    if (mv.videoQuality && !musicItem.videoQuality) {
      try { musicItem.videoQuality = mv.videoQuality; } catch (e) { /* frozen item */ }
    }
    return mv;
  } catch (e) { return null; }
}

// ---------- [v1.1.0 接口扩充·中优] 新歌速递 / 歌手详情 / 热门搜索 / MV 搜索 / MV 详情 ----------
// 端点均出自《网易云音乐接口完整文档（实测整合版）》并经真实网络测试（见交付自测清单）。

// 新歌速递（doc §11.2，/api/personalized/newsong 免登录实测✅；/api/personalized 需登录 404 不用）
async function fetchNeteaseNewsong() {
  var r = await axios.get('https://music.163.com/api/personalized/newsong', {
    params: { limit: 30 }, timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  });
  var list = (r.data && r.data.result) || [];
  var entries = [];
  for (var i = 0; i < list.length; i++) {
    var e = neteaseTrackEntry((list[i] && list[i].song) || list[i]);
    if (e.sid && e.title) entries.push(e);
  }
  if (!entries.length) throw new Error('netease newsong empty');
  return { isEnd: true, musicList: dedupeBySid(entries).map(buildSheetItem) };
}

// 歌手详情（doc §6.1，GET /api/v1/artist/{id} 免登录；歌手条目 _rsrc 取 raw，与 getArtistWorksImpl 同源）
async function getArtistInfoImpl(artistItem) {
  var src = (artistItem && artistItem._rsrc) || {};
  var raw = src.netease || ((artistItem && artistItem._src) || {}).netease;
  var id = raw && raw.id;
  if (!id) throw new Error('该条目无网易云歌手 id');
  var r = await axios.get('https://music.163.com/api/v1/artist/' + id, {
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  });
  var art = r.data && r.data.artist;
  if (!art) throw new Error('netease artist not found #' + id);
  return {
    title: art.name ? String(art.name) : '',
    avatar: (art.img1v1Url || art.picUrl) ? String(art.img1v1Url || art.picUrl) : '',
    worksNum: art.musicSize || 0,
    albumNum: art.albumSize || 0,
    mvNum: art.mvSize || 0,
    description: ''
  };
}

// 热门搜索词（[v1.1.0 实测切换] eapi 匿名请求已拿不到数据 → 改 REST GET /api/search/hot?type=1111，
// 免登录实测 200；响应 hots[].first 为搜索词（兼容 searchWord 字段））
function getHotSearchImpl() {
  return axios.get('https://music.163.com/api/search/hot', {
    params: { type: 1111 },
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  }).then(function (res) {
    var hots = (res.data && res.data.result && res.data.result.hots)
      || (res.data && res.data.data && res.data.data.hots) || [];
    var words = hots.map(function (h) {
      return h ? String(h.first || h.searchWord || '') : '';
    }).filter(function (w) { return w; });
    if (!words.length) throw new Error('netease hot search empty');
    return words;
  });
}

// MV 搜索（/api/search/get type=1004，免登录，与专辑/歌手搜索同端点族）
async function searchMvImpl(q, page) {
  var p = page || 1;
  var r = await axios.get('https://music.163.com/api/search/get', {
    params: { s: q, type: 1004, limit: 20, offset: (p - 1) * 20 },
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  });
  var mvs = ((r.data && r.data.result) || {}).mvs || [];
  return {
    isEnd: mvs.length < 20,
    data: mvs.map(function (it) {
      return {
        source: 'netease', sid: str(it.id),
        title: str(it.name),
        artist: it.artistName ? String(it.artistName) : '',
        duration: it.duration ? Math.round(it.duration / 1000) : 0,
        artwork: it.cover ? String(it.cover) : '',
        raw: { id: str(it.id) }
      };
    }).filter(function (it) { return it.sid && it.title; })
  };
}

// MV 详情（/api/v1/mv/detail，免登录）
async function getMvDetailImpl(mvId) {
  var r = await axios.get('https://music.163.com/api/v1/mv/detail', {
    params: { id: mvId }, timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  });
  var d = (r.data && r.data.data) || null;
  if (!d || !d.name) throw new Error('netease mv detail not found #' + mvId);
  return {
    title: String(d.name),
    artist: d.artistName ? String(d.artistName) : '',
    artwork: d.cover ? String(d.cover) : '',
    description: d.desc ? String(d.desc) : '',
    playCount: d.playCount || 0,
    duration: d.duration ? Math.round(d.duration / 1000) : 0,
    raw: { id: String(mvId) }
  };
}

// ---------- 推荐歌单广场 ----------
// 标签 id 约定：{source}~tag~{分类名|tagId} / {source}~rec~0（各源无参推荐流）
async function getRecommendSheetTagsImpl() {
  var groups = [];
  // 网易云分类（doc 8.1：catalogue 5 组 70 类）
  var hotPinned = [];
  try {
    var r1 = await axios.get('https://music.163.com/api/playlist/catalogue', {
      timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    });
    var sub = (r1.data && r1.data.sub) || [];
    // [v1.2.1 P1] 分组标题改用 catalogue 返回的真实分类名（categories {0:语种,1:风格,2:场景,3:情感,4:主题}）：
    // v1.2.0 及之前硬编码 ['华语','欧美','亚洲','怀旧','综艺']（实为各组首个标签名），
    // 宿主「全部分类」浮层（sheetTags 面板按 tagGroupItem.title 渲染组标题）显示错误。
    var catNames = ['语种', '风格', '场景', '情感', '主题'];
    var catMap = (r1.data && r1.data.categories) || null;
    if (catMap && typeof catMap === 'object') {
      var mapped = [];
      var catHit = 0;
      for (var ci = 0; ci < 8; ci++) {
        if (catMap[ci]) { mapped[ci] = String(catMap[ci]); catHit++; }
      }
      if (catHit >= 3) catNames = mapped; // 至少命中 3 个真实分类名才采用，异常返回时保留兜底
    }
    for (var c = 0; c < catNames.length; c++) {
      if (!catNames[c]) continue;
      var tags = sub.filter(function (s) { return String(s.category) === String(c); })
        .map(function (s) { return { id: 'ne~tag~' + s.name, title: String(s.name), platform: 'netease' }; });
      if (tags.length) groups.push({ title: catNames[c], data: tags });
    }
    // [v1.2.0 P0] 宿主 pinned 期望「扁平标签数组」（sheetBody.tsx 横向 TypeTag 渲染），
    // v1.1.0 误用了分组结构导致 pinned 标签不可见。改为：catalogue hot 标签 + 精品歌单入口。
    for (var h = 0; h < sub.length && hotPinned.length < 8; h++) {
      if (sub[h] && sub[h].hot && sub[h].name) {
        hotPinned.push({ id: 'ne~tag~' + sub[h].name, title: String(sub[h].name), platform: 'netease' });
      }
    }
  } catch (e) { /* 分类可选，失败不阻塞 */ }
  return {
    pinned: hotPinned.concat([
      { id: 'ne~hq~全部', title: '精品歌单', platform: 'netease' }
    ]),
    data: groups
  };
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var p = page || 1;
  var id = (tagItem && tagItem.id) || '';
  // [v1.2.0 P0] 空 tag id = 宿主「默认」标签（sheetBody 默认 {id:''}），此前直接返回空列表；
  // 对齐 baka：视为「全部」分类（hot 歌单列表）。
  if (!id) id = 'ne~tag~全部';
  // [v1.1.0 接口扩充·中优3] 精品歌单（pinned 'ne~hq~{分类}' → /api/playlist/highquality/list）：
  // /api/personalized 免登录 404（需登录），精品歌单接口是其免登录替代（官方文档 §11 实测）
  if (id.indexOf('ne~hq~') === 0) {
    var hqCat;
    try { hqCat = decodeURIComponent(id.slice(6)); } catch (e) { hqCat = id.slice(6); }
    var rh = await axios.get('https://music.163.com/api/playlist/highquality/list', {
      params: { cat: hqCat || '全部', limit: 30, offset: (p - 1) * 30 },
      timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
    });
    var hpls = (rh.data && rh.data.playlists) || [];
    var hentries = hpls.map(function (it) {
      return {
        source: 'netease', sid: str(it.id),
        title: str(it.name),
        artist: it.creator && it.creator.nickname ? String(it.creator.nickname) : '',
        artwork: it.coverImgUrl ? String(it.coverImgUrl) : '',
        worksNum: it.playCount || 0,
        raw: { listId: str(it.id) }
      };
    });
    return { isEnd: hpls.length < 30, data: hentries.filter(function (e) { return e.sid && e.title; }).map(sheetSearchItemFromEntry) };
  }
  if (id.indexOf('ne~tag~') !== 0) return { isEnd: true, data: [] };
  // [v1.1.0 O-5] 分类名容错解码：非法百分号序列此前会直接抛 URIError
  var cat;
  try { cat = decodeURIComponent(id.slice(7)); } catch (e) { cat = id.slice(7); }
  var r = await axios.get('https://music.163.com/api/playlist/list', {
    params: { cat: cat, order: 'hot', limit: 30, offset: (p - 1) * 30 },
    timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  });
  var pls = (r.data && r.data.playlists) || [];
  var entries = pls.map(function (it) {
    return {
      source: 'netease', sid: str(it.id),
      title: str(it.name),
      artist: it.creator && it.creator.nickname ? String(it.creator.nickname) : '',
      artwork: it.coverImgUrl || it.cover || '',
      worksNum: it.trackCount || it.count || 0,
      raw: { listId: str(it.id) }
    };
  });
  return { isEnd: pls.length < 30, data: entries.filter(function (e) { return e.sid && e.title; }).map(sheetSearchItemFromEntry) };
}

// ---------- 歌曲评论（网易云 R_SO_4_{id}，免登录，doc H.1 实测✅）----------

async function fetchNeteaseComments(id, page) {
  var res = await axios.get('https://music.163.com/api/v1/resource/comments/R_SO_4_' + id, {
    params: { limit: 20, offset: (page - 1) * 20 }, timeout: SOURCE_TIMEOUT, headers: neteaseHeaders()
  });
  return {
    hot: (res.data && res.data.hotComments) || [],
    newest: (res.data && res.data.comments) || []
  };
}

async function getMusicCommentsImpl(musicItem, page) {
  var p = page || 1;
  var src = (musicItem && musicItem._src) || {};
  if (!src.netease || !src.netease.id) return { isEnd: true, data: [] };
  var r = await fetchNeteaseComments(src.netease.id, p).catch(function () { return null; });
  if (!r) return { isEnd: true, data: [] };
  var seen = {};
  var data = [];
  function push(c, isHot) {
    if (!c) return;
    var cid = c.commentId || c.id;
    if (!cid || seen[cid]) return;
    seen[cid] = 1;
    var time = c.time;
    var createAt;
    if (typeof time === 'number') createAt = formatTs(time * (time > 1e12 ? 1 : 1000));
    else if (typeof time === 'string' && time) createAt = time;
    data.push({
      id: 'netease_' + String(cid).slice(0, 64),
      nickName: (c.user && c.user.nickname) ? String(c.user.nickname) : '未知用户',
      avatar: (c.user && c.user.avatarUrl) ? String(c.user.avatarUrl) : undefined,
      comment: c.content ? String(c.content) : '',
      like: c.likedCount || 0,
      createAt: createAt,
      location: ((c.user && c.user.location) || c.location) ? String((c.user && c.user.location) || c.location) : undefined,
      isHot: isHot
    });
  }
  var hot = r.hot || [], newest = r.newest || [];
  for (var i = 0; i < hot.length; i++) push(hot[i], true);
  for (var j = 0; j < newest.length; j++) push(newest[j], false);
  return { isEnd: newest.length < 20, data: data };
}
