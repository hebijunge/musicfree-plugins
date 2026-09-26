/**
 * 咪咕音乐独立源插件（MusicFree）v1.9.4
 * ================================
 * v1.9.12（2026-09-20 包升版，基线 v1.9.11）：QQ 源接入 a.aa.cab/qq.music 搜索型取链新通道（详见 qq-v1912.js 头部 changelog）；本源无代码改动，版本号随包统一升 v1.9.12。
 * v1.9.5（2026-09-11 全页面音质标识核查 + VIP 标识移除版，基线 v1.9.4）：
 *  - 音质标识核查：搜索/榜单/歌单/专辑/歌手/导入/详情各入口实测均带宿主标准键
 *    qualities，无缺口、零改动；
 *  - VIP 标识移除：全接口停写 fee 字段，getMusicInfo 不再补缺，取链结果不再携带
 *    fee，miguFeeOf/miguIsVip 判定函数整体移除（alias/primaryKey 补缺保留）。
 * v1.9.4（2026-09-11 第三方取链排查 + size 字段版，基线 v1.9.3）：
 *  - 任务一：getMediaSource 返回值加 size 字段（单位：字节），供宿主下载前预估大小与播放前音质校验。
 *    size 取值优先级：取链响应直带 size（官方 h5/v2.4 响应 resourceSize/audioSize 字段；
 *    海棠 resolveHaitang 响应已带 total）> HEAD 探测 Content-Range/Content-Length
 *    （getMediaSource 边界补 attachSizeIfMissing 兜底）> 留空。v1.9.3 各通道未统一回填 size，本轮统一处理。
 *  - 任务二：第三方取链通道排查（2026-09-11 探针）。
 *    - 咪咕插件本轮排查：第三方/代理通道仅 1 路（resolveHaitangMigu 走海棠 musicserver.haitangw.cc），
 *      实测 200/201/503（503 UPSTREAM RESOLVE_FAILED 走竞速容错），本轮无失效通道，不做移除。
 *    - 官方链：h5/v2.4 为主 + v2.1 备份竞速，全音质派生，alive。
 *    - 网络搜索新第三方咪咕取链接口（migu-api.dogecloud.com 等 4 个候选）均为 404/接口关闭/
 *      要求付费，无新通道可接入；本轮零增量随 v1.9.3 基线升版。
 *
 * v1.9.3（2026-09-11 WebView 短链跟随修复版，基线 v1.9.2）：
 *  - 真机 WebView 下 XMLHttpRequest 会自动跟随 302 重定向，axios 的 maxRedirects:0
 *    仅 Node.js 生效 → followRedirects 拿到 status=200 且无 location，误判「无重定向」
 *    直接返回原始短链 → SHEET_URL_RESOLVERS 匹配不到 id 抛 SHEET_URL_UNRECOGNIZED
 *    （咪咕 c.migu.cn 短链真机导入失败根因，沙箱 Node 环境测不出）。
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
 *  - 零代码增量，随包升版 v1.9.0。P2 共享咪咕对比评估结论：
 *    BakaMusic 共享咪咕插件为 PQ 探测降级形态（实测最高 ~192k）；
 *    本插件已有官方 PQ 派生链（HQ 派生 31.5MB 级 fLaC / SQ / ZQ24 / Z3D 全档
 *    + 跨源酷我兜底），音质上限与通道冗余均覆盖 BakaMusic 版，无吸收项。
 *
 * v1.8.4 变更（2026-09-10，歌单导入元数据版，对照宿主 Toskysun-MusicFree v1.0.0 契约）：
 *  - 复核确认歌单导入链路已满足元数据回传要求：importMusicSheet 返回完整
 *    IMusicSheetItem 歌单对象（v1.2.0 起），fetchMiguSheetMeta 经
 *    MIGUM3.0 playlist/v2.0 通道回传 title/artwork/artist/worksNum/playCount/
 *    description（取自响应 summary 字段，即歌单介绍，非歌曲介绍），importMusicSheetImpl
 *    在 meta.description 存在时挂到歌单对象——字段名对齐宿主 IMusicSheetItemBase 契约。
 *  - 本版无代码改动，随包升版 v1.8.4（与 6 平台标题/介绍修复版同步出包）。
 * ================================
 * v1.8.3 变更（2026-09-10，质检遗留优化版，基于 v1.8.2，对应交叉质检报告问题清单）：
 *  - 本插件 Q-02/Q-03 复核确认已符合统一口径（sheetImportError 已带 [migu] 前缀、
 *    兜底分支 code 已为 SHEET_URL_UNRECOGNIZED），无代码改动，随包升版 v1.8.3。
 *
 * v1.8.2 变更（2026-09-10，歌单解析修复版，对照 6 平台歌单解析实测报告）：
 *  - P1-1 歌单元数据接口修复：m.music.migu.cn/migu/remoting/query_playlist_by_id_tag
 *    在多种网络环境实测返回 HTML 登录壳而非 JSON（接口 SPA 化失效），此前 catch 静默
 *    返回 null 导致标题退化为「咪咕歌单 #ID」、封面/作者/描述全丢。改为首选
 *    app.c.nf.migu.cn/MIGUM3.0/resource/playlist/v2.0（channel: 014X031 + Referer，
 *    实测歌单 135765874/195233074 均返回完整元数据），旧接口降为二次兜底；全部失败时
 *    console.warn 明确记录（不再静默吞掉）。
 *  - P2-3 歌单对象补 platform: 'migu' 与 isImported: true（宿主按 platform 反查插件）。
 *  - P2-1 buildSheetItem 输出的 IMusicItem 补 platform: 'migu'。
 *  - P2-4 错误文案统一：新增 sheetImportError helper，歌单链接解析/拉取/空歌单错误
 *    携带结构化 code（SHEET_URL_EMPTY/SHEET_URL_UNRECOGNIZED/SHEET_FETCH_FAILED/SHEET_EMPTY）。
 * ================================
 * v1.8.0 变更（2026-09-10，MV 参数对齐基线，对照 MusicFree v1.0.0 宿主协议）：
 *  - P0-3 顶层守卫字段兜底：getMvSourceImpl 移除 `_src` 硬前置（此前外链导入/旧缓存条目
 *    若 musicItem._src 为空直接 return null，导致 canPlayMusicVideo=true 但 getMvSourceImpl
 *    仍取不到 MV）；改为 musicItem.mvId / musicItem.mvCopyrightId / musicItem.mvid /
 *    musicItem.mv / musicItem.mvVid 任一命中即把值映射回 _src.migu.mvId/mvCopyrightId
 *    （与酷我/QQ/网易云 v1.8.0 顶层守卫字段兜底行为一致）。
 *  - P1-1 videoQuality 写回：getMvSourceImpl 内取链成功后 r2.videoQuality 命中即写回
 *    musicItem.videoQuality（try/catch 兜 frozen item，宿主 UI 切档后回显）。
 *  - P1-2 width/height：resolveMvById 已有 height（rateFormats 内嵌，本轮不需补），
 *    MV_SOURCE.migu 走 fileType=mp4 未携带尺寸信息，按高度×16/9 估算 width（若有）
 *    兜底。availableVideoQualities 同步由 height 估算 width（与酷我/QQ/网易云口径一致）。
 *  - P1-4 codec：咪咕上游不携带独立 codec 字段（PQ/HQ/UHD 仅以 formatType 区分，
 *    fileType=mp4），不硬编，留空由宿主走默认。
 *  - P1-5 availableVideoQualities：resolveMvById/MV_SOURCE.migu 双通道已在 v1.3.0 落地，
 *    本轮对齐酷我/QQ 口径统一为结构化对象 {key,label,width,height}（height 取
 *    formatType→档位映射的标称值，width 由 height×16/9 估算）。
 *  - 其余 P1-3 duration/P1-2 size/P2-2 backupUrls/P2-2 expiresAt 均已在 v1.3.0/v1.4.0
 *    实装（resolveMvById：duration 走 resource.migumvDuration、size 走 selected.size、
 *    expiresAt HLS 30min），本轮维持不变。
 *  - 兼容性：插件级 primaryKey（['copyrightId']）+ canPlayMusicVideo 守卫（mvId/mvCopyrightId
 *    任一 truthy 且 plugin.supportedMethods.has('getMvSource')）保持不变；版本 v1.6.1→v1.8.0；
 *    node --check 通过；全部改动 edit 模式精确替换。
 * ================================
 * v1.6.1（2026-09-08 跨源兜底歌词同步修复）：
 *  - 修复：酷我无损兜底胜出时，歌词仍按咪咕取导致「酷我音频+咪咕歌词」错配
 *          （可能对不上 / 缺失 / 完全是另一首歌的歌词）。
 *  - 机制：进程内兜底歌词登记表（TTL 10min，上限 64 条，key=platform|id）。
 *          取链编排器仅在兜底源真正胜出的点登记 {source:'kuwo', raw:{rid}}；
 *          咪咕自身通道/海棠同源备源胜出即清除标记。getLyric /
 *          getWordByWordLyric 顶部命中登记即优先走酷我歌词链（LRC 双通道 +
 *          lrcx 逐字 + 酷狗 KRC 接力），失败回落原生咪咕歌词链；登记过期
 *          同样回落原生链，不产生错词。宿主零改动（宿主只按 musicItem.platform
 *          路由回本插件，取链返回值仅消费 url/headers/ekey/cek，无法携带
 *          「实际播放源」信息——故歌词切换只能在插件层完成）。
 * ================================
 * 自《聚合搜索插件 v0.8.0》（基线 sha256 f29c6f1f…）拆分而来：仅保留咪咕（migu）一个平台。
 * v1.6.0（2026-09-08 宿主字段补齐 + 逐字歌词字段错位修复）：
 *  - ① P0 逐字歌词字段错位修复：MRC TEA 解密原文行格式 `[start,dur]词(start,dur)` 恰是
 *          宿主 lrcParser 原生支持的 QRC 逐字格式，直接作 rawLrc 返回（对齐酷狗
 *          parseKrcForHost 的 KRC→QRC 直出思路）。此前 rawLrc 给普通 LRC、逐字内容放
 *          自造字段 wordByWordLrc（宿主只读 rawLrc）→ 逐字歌词功能实际失效。
 *          翻译歌词（trcUrl 链路，有则带）按宿主 ILyricSource 协议放 translation 字段。
 *  - ② P1 fee（VIP 标记）：实测 search_all.do 条目自带 vipType（"1"=VIP，如晴天；
 *          ""=免费，如起风了）→ 搜索条目 fee = vipType==='1' ? 1 : 0（宿主 fee===1
 *          点亮 VIP 角标）；取链结果零请求补 fee（raw.vipType → v2.0 songItem 缓存
 *          vipType/vipFlag，均未知不标注，宁缺毋假）；getMusicInfo 补缺（v2.0 富字段）。
 *  - ③ P2 alias：search_all.do 条目 songAliasName（晴天="Sunny Day"）映射 alias；
 *          getMusicInfo 走 v2.0 songItem.songAliasName 补缺（榜单/歌单等非搜索入口）。
 *  - ④ P2 primaryKey：条目级 primaryKey = copyrightId（缺失回落 contentId）——
 *          插件级 primaryKey:['copyrightId'] 声明已有（v1.2.0），条目级按宿主需求单补。
 *  - ⑤ 罗马音：咪咕全量接口文档无罗马音输出（歌词仅 lrcUrl/mrcUrl/trcUrl 三链），
 *          宁缺毋假，不实现。
 * v1.5.0（2026-09-08 SQ 派生规则扩充 + 酷我官方接口跨源无损兜底）：
 *  - ① SQ 派生规则扩充：「标清高清 → 歌曲下载 + MP3_128_16_Stero → flac + .mp3 → .flac」
 *          派生不再限定 product9th 路径体系——凡 PQ 直链路径含「标清高清」目录的
 *          （product8th / product39 等老批次外的新目录体系，滚石曲库已实测有效）统一按同规则派生；
 *          派生同时兼容 URL 编码（%E6%A0%87%E6%B8%85%E9%AB%98%E6%B8%85）与原文中文两种形态，
 *          编码目录名匹配改为大小写不敏感 + 全量替换。
 *  - ② 跨源降级：SQ 派生链接 Range 探测 404（或产物 <5MB，判为非真无损）时不再直接降档 HQ，
 *          改为先触发酷我官方接口无损兜底：曲名+歌手搜酷我映射 rid → mobi.s
 *          convert_url_with_sign 2000kflac 三域名竞速（nmobi/nmsublist/mobi 车载，
 *          format 非 flac / 试听片段一律拒收），兜底成功 channel 标注 kuwo-fallback:*；
 *          兜底失败仍维持原有「降档 HQ」语义。降级优先级遵循聚合规则：酷我 → 咪咕 → 网易云
 *          → 汽水 → 酷狗 → QQ（咪咕自身失败后首选酷我，其余平台不在本单源插件职责内）。
 *  - ③ ringmaker / product05 / product08 / product15 等老批次：SQ 目录结构与 PQ 差异大
 *          （版权方目录名、年月层级均不同）无法从 PQ 路径字符串推导，统一走
 *          「派生尝试 → 探测失败 → 酷我兜底」流程，不做目录名硬猜。
 *  - ④ probeMiguExists 升级为返回 Range 探测到的文件总字节数（原仅返回 true），
 *          供派生梯做 <5MB 非无损判据；全部既有调用点语义兼容（真值判断不变）。
 * v1.4.0（2026-09-08 主取链切换 MIGUM2.0/v2.0/content/listen-url 明文接口）：
 *  - ① 主取链切 v2.0 明文接口（c.musicapp.migu.cn/MIGUM2.0/v2.0/content/listen-url，
 *          channel=0140210 + Referer=m.music.migu.cn，免登录免解密）。2026-09-08 实测
 *          （3 首 VIP 歌 probe-v20/probe-v20-multi）：dialogInfo 虽提示「会员歌曲试听中」，
 *          CDN Range 实测返回完整文件（晴天 4,317,311B / 孤勇者 4,097,047B / 稻香 3,577,106B），
 *          PQ 直链与 h5v2.4 同源（freetyst.nf.migu.cn），路径派生规则完全一致
 *          （晴天 HQ 派生 10,792,962B、SQ 派生 31,529,675B fLaC 全部 206）。
 *          toneFlag=HQ/SQ 直请求无 url（需登录态）→ 主链固定取 PQ 基线 + 既有派生梯。
 *  - ② h5v2.4 保留为副取链（不删除）：通道链改为 v2.0 明文 → h5v2.4 加密 → listen-url v2.1
 *          →（super/hires：海棠 mg）→ 302 跳转口 → pc-listen v2.0，v2.0 失败自动降级。
 *  - ③ v2.0 songItem 富字段（75 字段）收割：lrcUrl/mrcUrl/trcUrl 三歌词链（getLyric /
 *          逐字歌词零请求直取）、z3dCode（进 z3dCache 供升级梯与宿主解密层）、
 *          chorusStartTime 副歌点、toneControl/topQuality 音质元数据（getMusicInfo 透传 _src）。
 *          实测注意：listen-url v2.0 响应里 rateFormats/newRateFormats 为空（音质大小仍由
 *          搜索条目 / by-contentids 供给）；toneControl 不能替代存在性探测——
 *          稻香 toneControl=111111 但 SQ 派生 404（晴天 111100 SQ 反而可用），派生梯
 *          Range 探测验真机制保持不变。
 *  - ④ P1：getMusicInfo 增补 v2.0 富字段通道（fetchMiguV20Item，一次请求拿全，
 *          失败回落既有 by-contentids / jadeite / fetchMiguZ3dCode 路径）。
 * v1.3.2（2026-09-07 借鉴 Domdkw/miguMusic-api-enhanced 三项优化）：
 *  - ① z3dCode 直出：listen-url v2.1 的 songItem.z3dCode 直接携带 3D 三兄弟直链
 *          （2026-09-07 实测：url/iosUrl→歌曲下载/alac_3d/*.m4a 加密、androidUrl→wav_3d/*.wav
 *          加密全曲 71380604B、h5Url→wav_3d_60s/*.wav 即 3D60 明文试听 10584078B；
 *          ftp://218.200.160.122:21/ 前缀替换为 https://freetyst.nf.migu.cn/ 后全部 206）。
 *          resolveMiguApp 通道响应即缓存（z3dCache）；getMusicInfo 两路径回填 atmos/atmos_plus
 *          缺失 size 并挂 _src.migu.z3d（宿主解密层可直接取 URL，免目录试探）；
 *          upgradeMiguQuality atmos/atmos2 梯优先 z3dCode 直链（仍 Range 探测验真，失败回落派生梯）。
 *  - ④ can-listen/v1.0 批量可播预检：strategy/pc/can-listen/v1.0 POST contentIds 匿名可用
 *          （实测 晴天 canListen=false+limitLength=true、童话镇 true）。全通道取链失败时调用一次，
 *          把预检结论（VIP/版权受限 vs 可播疑链路故障）追加进错误信息；_internal.canListen 导出。
 *  - ⑤ 随机 UA/设备 ID：固定 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' 8 处改为进程级随机
 *          UA 池（5 条真实 UA，SESSION_UA 会话内稳定）；pc/listen v2.0 每请求随机 deviceId
 *          收敛为进程级 SESSION_DEVICE_ID（会话内稳定、跨会话随机化）。
 *          302 通道 okhttp/3.14.9 为接口特征 UA，保持不动。
 * v1.3.1（2026-09-07 音质档位合并补齐修复）：
 *  - 现象：搜索《晴天》 qualities 只显示 3 档（128k/320k/flac），与 supportedQualities
 *          7 档声明和实际可取链档位不符。
 *  - 根因（2026-09-07 实测定位）：
 *    ① 搜索接口 search_all.do 条目 audioFormats 上游只报 PQ/HQ/SQ → 3 档，上游事实；
 *    ② 歌曲详情接口 by-contentids v2.0 / jadeite v3 反查实际多报一档 Z3D（atmos，
 *       《晴天》asize=71380604 与实测派生链接 content-range 完全一致）；
 *    ③ v1.3.0 getMusicInfo 常规路径补齐条件是 `!musicItem.qualities`——搜索条目已自带
 *       3 档 qualities，条件恒假，补齐被短路，详情接口多出的档位永远回不来。
 *  - 修复：getMusicInfo 由「仅缺失时回填」改为「始终合并补齐」——新增 mergeHostQualities
 *          将详情通道 qualities 并入已有 qualities（新档位追加；同档缺 size 补 size），
 *          常规路径与无 _src 极简条目路径同口径。合并后《晴天》= 128k/320k/flac/atmos/
 *          atmos_plus 5 档，与实测可取链档位一致（flac24bit/hires 上游无资源不虚挂，
 *          取链请求时按派生梯诚实降档，actualQuality 如实标注）。
 * v1.3.0（2026-09-07 音质大小全链路补齐，对标 baka 咪咕参数传递差异报告）：
 *  - getMusicInfo 回填 qualities：宿主下载面板在条目 qualities 缺失/无有效 size 时会主动调
 *          getMusicInfo 补齐（musicItemOptions.tsx），v1.2.1 该方法全程未构建 qualities——
 *          现在按「by-contentids v2.0（实测稳定返回 audioFormats）→ jadeite v3 反查」顺序
 *          提取并回填（无 _src.migu 的极简条目同样覆盖）；
 *  - size 改传 number（字节）：此前以裸字节字符串传递，宿主 sizeFormatter 对字符串原样
 *          透传导致面板显示 "(4317311)"；number 时宿主自动格式化为 "(4.1MB)"，下载器
 *          parseQualityFileSize 对 number 也是直取最优路径（downloader.ts:517）；
 *  - 榜单/歌单/专辑/歌手作品四路条目统一挂 qualities：rank-info 的 songData.audioFormats、
 *          playlist song v2.0 条目 audioFormats、queryAlbumSong 条目 newRateFormats、
 *          歌手作品 songItem.audioFormats（均 2026-09-07 实测带大小字段），
 *          音质大小在列表页即可显示；
 *  - MV 返回值补 availableVideoQualities（宿主 IVideoSourceResult 协议，对齐 baka；
 *          supportedVideoQualities v1.1.0 已声明，无需重复）；
 *  - cacheControl：no-store → no-cache（实测同一签名链接跨分钟级复用仍 206 有效、
 *          baka 同族通道 no-cache 线上长期可用；宿主 no-cache 语义=仍写缓存、
 *          离线可播缓存 URL，缓存失效时宿主自动降级现取）；
 *  - 未知档位兜底保持 normalizeQuality → standard(128k)（比 baka 直接 throw 更稳，不改）。
 * v1.2.1（2026-09-07 榜单图片/歌单分类专项修复）：
 *  - 榜单封面：getTopLists 条目补 coverImg 字段（宿主 topListItem.tsx 只读 coverImg
 *          渲染榜单封面，此前仅有 artwork 导致 14 榜封面全部空白）；getTopListDetail
 *          返回值补 topListItem（含 coverImg）兜底详情页头部封面；回填新歌榜缺失封面；
 *  - 歌单分类：getRecommendSheetTags 的 pinned 由分组结构改为扁平数组（宿主
 *          sheetBody.tsx 对 pinned 逐项 .map 渲染 pill 并直接以该项取数；分组结构导致
 *          pill 无 id、点击取数恒空），pill = 精选推荐 + 热门分类前 7 个（baka
 *          hotTags.slice(0,8) 同口径）；getRecommendSheetsByTag 对宿主默认空标签
 *          （id=''）回落精选推荐流，修复进页默认页空白。
 * v1.2.0（2026-09-07 对标 baka-plugins 咪咕 v1.3.1 全面对齐）：
 *  - 逐字歌词解密突破：移植 baka 的 MRC TEA 解密（keyArr/teaDecrypt/decryptMrc/parseMrc），
 *          加密 mrc 逐字歌词可解析为逐字 LRC（此前 v1.1.0 如实报错"无公开解密算法"）；
 *  - 歌词翻译：采集 trcUrl（搜索/元数据兜底），getLyric 返回 translation 字段（宿主 ILyricSource 协议）；
 *  - 歌词搜索：新增 supportedSearchType 'lyric'（jadeite v3 签名搜索 + scr_search_tag 旧接口兜底）；
 *  - 音质档位：新增 hires(ZQ32/wav_32bit)、atmos(Z3D/wav_3d)、atmos_plus(3D60/wav_3d_60s) 派生梯
 *          （Range 存在性探测验真，坏链自动降档），对齐 baka 8 档音质声明；
 *  - 取链通道：copyrightId 缺 contentId 的条目经 resourceinfo.do（resourceType=2）反查补全；
 *          取链返回值补宿主协议 quality 字段（与 actualQuality 同步标注）；
 *  - MV：采集 mvId/mvCopyrightId（搜索/元数据），mvId 直查 + mvplayinfo.do 官方取链通道（新增），
 *          resourceinfo 直拼链降为兜底；新增 4k 档（UHD 实测映射）；返回 headers/userAgent；
 *  - 评论：官方 music.migu.cn/v3/api/comment/listComments 为主（真实分页/回复/时间戳），
 *          海棠 mgpl.php 降为兜底（v1.1.0 时官方端点实测返回 HTML，v1.2.0 按宿主协议带 targetId 重试）；
 *  - 榜单：补 6 榜（尖叫原创/音乐风向/彩铃分贝/港台/内地/欧美，榜单 id 取自 baka boardList）；
 *  - 歌单导入：支持纯数字歌单 id（单源插件内无平台歧义）与 h5.nf.migu.cn 分享链接；
 *          导入结果补歌单元数据（标题/封面/创建者/曲目数/播放数，query_playlist_by_id_tag 兜底）；
 *  - 歌手专辑：getArtistWorks type='album' 落地（专辑搜索按歌手名过滤，baka 同款兜底方案）；
 *  - 字段对齐：歌曲对象补 copyrightId/mvId/qualities（宿主智能音质选择消费）/primaryKey 声明；
 *          新增 getMusicDetailPageUrl（分享详情页链接）；getMusicInfo 支持仅 copyrightId 的条目补全。
 *  - 保留 v1.1.0 全部优势：多通道接力/竞速、8s 全局预算、试听守卫、失败负缓存、海棠备源开关。
 * v1.1.0（2026-09-06 审查修复 + 接口扩充）：
 *  - 修复：专辑详情崩溃（it.artists）、无损派生存在性探测 + 守卫 404 降级、
 *          评论接入（海棠 mgpl.php）、逐字歌词采集（mrcUrl）、榜单补全至 8+、
 *          歌单导入 500 实数、移除 192k 虚标、MV 画质映射修正、全入口歌词补齐（by-contentids 兜底）、
 *          死代码清理、URL 白名单收紧、海棠备源开关（user_variables）、试听守卫分码率估算、
 *          海棠接力独立候选段、失败负缓存、取链结果附 channel 字段。
 *  - 新接入取链通道：listen-url v2.1 App 通道（VIP 歌 PQ 全曲）、strategy/pc/listen v2.0 加密通道、
 *          listen-song/v2.3 302 跳转口（均 2026-09-06 实测）。
 *  - 音质上限：新增 flac24bit（ZQ24 派生，flac_24bit 目录 + 存在性探测，免费歌实测可用）。
 *
 * 能力与取链路径（全部免登录）：
 *  - 搜索：MIGUM2.0 content/search_all.do（song/album/singer/songlist 四类 searchSwitch）
 *  - 取链：h5v2.4 加密取链（AB CD 01 魔数 + 固定 32 字节密钥逐字节解密）为主，
 *          listen-url v2.1 / 302 跳转口 / pc-listen v2.0 三备选通道接力；
 *          PQ 直链派生 HQ/SQ/ZQ24（派生链 Range 探测验真，坏链自动降档）；
 *          super/hires 档官方链路尽后接力海棠 mg 明文源（可在插件设置中关闭）
 *  - 歌词：条目自带 lyricUrl 直链；缺失走 by-contentids 兜底；逐字歌词采集 mrcUrl（加密格式如实报错）
 *  - 榜单：rank-index v1.0 动态榜单列表（失败回退静态 8 榜），rank-info 单页 100 首
 *  - 歌单：广场分类/推荐流导入（c.migu.cn 短链自动 302 跟随）+ 歌单搜索/详情（上限 500 首实数）
 *  - 专辑/歌手/MV：专辑详情、歌手作品（封面/歌词 by-contentids 补齐）、MV 三档画质（480p/720p/1080p，严格同曲匹配）
 *  - 评论：海棠 mgpl.php 免登录评论（第三方中转，单页 20 条）
 *  - 单曲导入：咪咕分享链接无可稳定解析的歌曲字段，暂不支持（明确报错）
 *
 * 兼容性：ES8 语法（async/await），不使用 ?. / ??（安卓端 Hermes 风险）。
 */


var axios = require('axios');

// ==================== 通用工具 ====================

var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
// v0.7.1 P1-3：取链全局超时预算。宿主 getMediaSource 单方法 10s 硬上限，
// 原实现最坏 6 段 × 4.5s × 3 候选源 ≈ 81s 必然被掐断。
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
var RELAY_TIMEOUT = 2500;     // 接力段（备源）单请求超时，首段仍用 SOURCE_TIMEOUT
var DURATION_TOLERANCE_SEC = 6;

// v1.3.2 ⑤：随机 UA / 设备 ID——进程级随机（同一会话内稳定、跨会话随机化），
// 降低固定 UA/deviceId 形成的风控画像。302 通道 okhttp UA 为接口特征、保持不动。
var UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; M2102J20SG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
];
var SESSION_UA = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
var SESSION_DEVICE_ID = (function () {
  var s = ''; var hex = '0123456789abcdef';
  for (var i = 0; i < 16; i++) s += hex.charAt(Math.floor(Math.random() * 16));
  return s;
})();
function miguUA() { return SESSION_UA; }

function str(v) { return v === undefined || v === null ? '' : String(v); }

// v1.6.0（P1-2）-> v1.9.5：miguFeeOf / miguIsVip（VIP 标记判定）已随 fee 停写整体移除。

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
 *    跨源缺时长时放宽为「专辑名也一致」才合并（咪咕搜索不返回时长的保守兜底，
 *    比音流 P0 的「一律不合并」略宽，避免整源条目全部无法归组）。
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
  migu: 0.95
};

// 咪咕免登录音质能力。v1.2.0：新增 hires（ZQ32/wav_32bit 派生）、atmos（Z3D/wav_3d）、
// atmos_plus（3D60/wav_3d_60s）三档——对齐 baka 8 档音质声明；全部走派生梯 + Range 探测验真。
var SOURCE_QUALITIES = {
  migu: ['standard', 'high', 'super', 'hires', 'atmos', 'atmos2']
};

function canServe(source, quality) {
  var caps = SOURCE_QUALITIES[source] || [];
  return caps.indexOf(quality) >= 0;
}

// ==================== 咪咕搜索适配器 ====================
// 每个适配器返回统一内部条目：
// { source, sid, title, artist, album, duration(sec, 可为0), artwork, raw }

// v1.2.0：从列表条目的音质声明提取宿主 qualities 字段（对齐 baka MIGU_QUALITY_INFO）
var MIGU_FORMAT_KEY_INFO = {
  LQ: '128k', PQ: '128k', HQ: '320k', SQ: 'flac',
  ZQ: 'flac24bit', ZQ24: 'flac24bit', ZQ32: 'hires',
  Z3D: 'atmos', '3D60': 'atmos_plus'
};

function miguQualitiesFromEntry(it) {
  var q = {};
  var formats = [];
  if (Array.isArray(it && it.audioFormats)) formats = formats.concat(it.audioFormats);
  if (Array.isArray(it && it.newRateFormats)) formats = formats.concat(it.newRateFormats);
  if (Array.isArray(it && it.rateFormats)) formats = formats.concat(it.rateFormats);
  if (typeof (it && it.rateFormats) === 'string') {
    var parts = it.rateFormats.split('|');
    for (var p = 0; p < parts.length; p++) if (parts[p]) formats.push({ formatType: parts[p] });
  }
  for (var i = 0; i < formats.length; i++) {
    var f = formats[i];
    if (!f) continue;
    var ft = f.formatType || f.toneFlag || f;
    if (typeof ft !== 'string') continue;
    var key = MIGU_FORMAT_KEY_INFO[ft];
    if (!key || q[key]) continue;
    var size = f.asize || f.isize || f.size || f.androidSize || f.iosSize || f.fileSize;
    var bitrate = f.bitRate || f.bitrate;
    var entry = {};
    // v1.3.0（P0）：size 改传 number（字节）。宿主 sizeFormatter（fileUtils.ts）对字符串
    // 原样透传（面板显示裸字节数 "(4317311)"），number 才会被自动格式化为 "(4.1MB)"；
    // 下载器 parseQualityFileSize（downloader.ts:517-543）对 number 直取，同为最优路径。
    var sizeNum = Number(size);
    if (size && isFinite(sizeNum) && sizeNum > 0) entry.size = sizeNum;
    if (bitrate) entry.bitrate = bitrate;
    q[key] = entry;
  }
  // [v1.9.9 音质标识一致性修复] z3dCode 直出补齐（零请求）：搜索/歌单等入口条目 raw 自带
  // z3dCode 而 audioFormats 未报 Z3D/3D60 时，此前整页缺 atmos/atmos_plus，与榜单/歌手作品
  // 页（bmww 条目 audioFormats 带 Z3D）同歌键集不一致。z3dCode 实测两种形态都消费：
  // ① 紧凑描述符（search_all.do）：androidSize=wav_3d 全曲(atmos)、h5Size=3D60 试听
  //   (atmos_plus)——2026-09-12 实测晴天 androidSize=71,380,604 / h5Size=10,584,078，
  //   与 getMediaSource('atmos'/'atmos_plus') 实取字节逐字节一致，声明非虚标；
  // ② URL 三件套（listen-url v2.1）：androidUrl/h5Url，经 normalizeZ3dCode 归一。
  // 取链链路未动：atmos 梯在播放时经 listen-url 自取 z3dCode 直链。
  var nz = null;
  try { nz = normalizeZ3dCode(it && it.z3dCode); } catch (eZ) { nz = null; }
  var zz = (it && it.z3dCode) || null;
  var atmosSize = (nz && nz.wav3d && nz.wav3d.size > 0 && nz.wav3d.size) || (zz && Number(zz.androidSize) || 0);
  var sampleSize = (nz && nz.sample && nz.sample.size > 0 && nz.sample.size) || (zz && Number(zz.h5Size) || 0);
  if (atmosSize > 0) {
    if (!q.atmos) q.atmos = { size: atmosSize };
    else if (!q.atmos.size) q.atmos.size = atmosSize;
  }
  if (sampleSize > 0) {
    if (!q.atmos_plus) q.atmos_plus = { size: sampleSize };
    else if (!q.atmos_plus.size) q.atmos_plus.size = sampleSize;
  }
  // Z3D 与 3D60 共用资源：仅声明 Z3D 时 60s 版通常也可取
  if (q.atmos && !q.atmos_plus) q.atmos_plus = {};
  return Object.keys(q).length ? q : undefined;
}

// v1.3.1：宿主 qualities 合并——把详情通道回填的档位并入已有 qualities。
// 规则：① 已有对象中不存在的档位追加（如详情接口多报的 Z3D→atmos）；
//       ② 两边同档时，已有项缺 size 而 incoming 有 size 则补 size/bitrate（host 下载
//          面板靠 size 显示与最优下载判定，size 缺失等于该档不可下）；
//       ③ 返回 null 表示无可合并内容（两端皆空），调用方保持原值不动。
function mergeHostQualities(existing, incoming) {
  if (!incoming) return existing || null;
  var merged = {};
  var hasAny = false;
  var k;
  for (k in (existing || {})) {
    if (existing[k]) { merged[k] = existing[k]; hasAny = true; }
  }
  for (k in incoming) {
    var inc = incoming[k];
    if (!inc) continue;
    if (!merged[k]) { merged[k] = inc; hasAny = true; continue; }
    var cur = merged[k];
    var curSize = Number(cur.size) || 0;
    var incSize = Number(inc.size) || 0;
    if (!curSize && incSize > 0) {
      merged[k] = {};
      for (var f in cur) merged[k][f] = cur[f];
      merged[k].size = incSize;
      if (inc.bitrate && !merged[k].bitrate) merged[k].bitrate = inc.bitrate;
    }
    hasAny = true;
  }
  return hasAny ? merged : null;
}

function searchMigu(query, page) {
  var sw = '{"song":1,"album":0,"singer":0,"tagSong":0,"mvSong":0,"songlist":0,"bestShow":0}';
  return axios.get('https://pd.musicapp.migu.cn/MIGUM2.0/v1.0/content/search_all.do', {
    params: {
      ua: 'Android_migu', version: '5.0.1', text: query,
      pageNo: page, pageSize: 20, searchSwitch: sw
    },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://music.migu.cn/' }
  }).then(function (res) {
    var srd = res.data && res.data.songResultData;
    var list = (srd && srd.result) || [];
    return list.map(function (it) {
      var pic = '';
      if (it.imgItems && it.imgItems.length) {
        for (var i = 0; i < it.imgItems.length; i++) {
          if (it.imgItems[i].imgSizeType === '03' && it.imgItems[i].img) { pic = String(it.imgItems[i].img); break; }
        }
        if (!pic) pic = String(it.imgItems[it.imgItems.length - 1].img || '');
      }
      var raw2 = {
        contentId: str(it.contentId),
        copyrightId: str(it.copyrightId),
        songId: str(it.songId || ''),
        lyricUrl: str(it.lyricUrl),
        // v1.1.0 修复#4：逐字歌词采集。实测搜索/专辑条目带 mrcUrl 直链（加密 mrc 格式），
        // 先采集落 raw，取词时按真实格式解析（v1.2.0 起 TEA 解密，见 decryptMrc）
        mrcUrl: str(it.mrcUrl || ''),
        // v1.2.0：翻译歌词 / MV / 专辑 字段采集（对齐 baka）
        trcUrl: str(it.trcUrl || it.trcLyricUrl || ''),
        // v1.6.0（P1-2/P2-4）：付费/别名采集——实测 search_all.do 条目自带
        // vipType（"1"=VIP）与 songAliasName（如晴天="Sunny Day"），零额外请求
        vipType: it.vipType === undefined ? undefined : str(it.vipType),
        songAliasName: str(it.songAliasName || ''),
        mvId: str(it.mvId || ''),
        mvCopyrightId: str(it.mvCopyrightId || ''),
        albumId: str(it.albums && it.albums[0] && (it.albums[0].id || it.albums[0].albumId) || '')
      };
      var entry = {
        source: 'migu', sid: str(it.contentId),
        title: str(it.name), artist: splitArtists(it.singers),
        album: firstAlbumName(it.albums),
        duration: parseInt(it.duration, 10) || 0,
        artwork: pic,
        raw: raw2
      };
      var q2 = miguQualitiesFromEntry(it);
      if (q2) entry.qualities = q2;
      return entry;
    }).filter(function (it) { return it.sid && it.title; });
  });
}

var SEARCH_ADAPTERS = {
  migu: searchMigu
};

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
    // v1.8.2（P2-1）：宿主 canPlayMusicVideo 按 platform 反查插件，聚合输出必须带平台
    platform: best.source || 'migu',
    title: best.title,
    artist: best.artist,
    album: best.album,
    artwork: artwork || undefined,
    duration: duration || undefined,
    // v1.2.0 字段对齐（宿主 IMusicItem 协议）：qualities 供宿主智能音质选择，
    // copyrightId 稳定主键 / MV 字段供 MV 入口与详情页使用
    qualities: best.qualities || undefined,
    copyrightId: (best.raw && best.raw.copyrightId) || undefined,
    mvId: (best.raw && best.raw.mvId) || undefined,
    mvCopyrightId: (best.raw && best.raw.mvCopyrightId) || undefined,
    // v1.6.0（P1-2）-> v1.9.5：fee（VIP 角标）字段停写不再透传。
    // v1.6.0（P2-4）：alias 别名（search_all.do songAliasName，宿主歌词搜索优先用其匹配）
    alias: (best.raw && best.raw.songAliasName) || undefined,
    // v1.6.0（P2-3）：条目级 primaryKey（copyrightId 优先，缺失回落 contentId）——
    // 插件级 primaryKey:['copyrightId'] 已声明，条目级按宿主去重/缓存键需求单补
    primaryKey: (best.raw && (best.raw.copyrightId || best.raw.contentId)) || undefined,
    _src: src,
    _srcOrder: srcOrder
  };
  return item;
}

// ==================== 封面补齐 ====================
// 单平台版：酷我 rid_pic / 酷狗 get_song_info 封面反查依赖其他平台接口，随拆分移除。
// 保留 enrichArtwork 桩（各详情/榜单调用点签名不变），直接原样返回。
async function enrichArtwork(items) {
  return items;
}

// ==================== 咪咕榜单 ====================
// 榜单机制沿用聚合版（多平台合并机器在单源下按单列表运行）：
// 条目 _src 携带咪咕 raw，复用取链接力（resolveWithFallback）。
// 端点来自接口文档实测记录（2026-09-02/05），无猜测 URL。

var CHART_TTL_MS = 30 * 60 * 1000;
var chartCache = {};   // { defId: { ts, list } }
var chartInflight = {}; // { defId: Promise } 并发去重

// v1.1.0 修复#5：榜单补全。rank-index v1.0 实测（2026-09-06 probe5）返回 6 榜，
// 叠加 v1.0.0 已验证的 2 个官方榜 id → 静态兜底共 8 榜；getTopLists 优先动态拉取。
var CHART_DEFS = [
  {
    id: 'agg-hot', title: '热歌榜',
    cover: 'https://p3-luna.douyinpic.com/img/tos-cn-i-b829550vbb/d0d8d48461a62748e84689cdf049b19a.png~tplv-b829550vbb-resize:960:960.png',
    members: [
      { source: 'migu', id: '27186466' }
    ]
  },
  {
    // v1.2.1 修复：回填新歌榜缺失封面（baka boardList 尖叫新歌榜 27553319 同源），空串会导致封面占位
    id: 'agg-new', title: '新歌榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/dk/3ebe613aca744a7c95e29d7e8e91f2e7',
    members: [
      { source: 'migu', id: '27553319' }
    ]
  },
  {
    id: 'mg-net-hot', title: '全网热歌榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/yi/2981744541a345958d285c75e8fa907c.webp',
    members: [
      { source: 'migu', id: '83048887' }
    ]
  },
  {
    id: 'mg-douyin', title: '抖音热歌榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/yi/6b3b5e0429954c19ad8d667e6eb9b681.webp',
    members: [
      { source: 'migu', id: '83049014' }
    ]
  },
  {
    id: 'mg-free-hot', title: '免费热歌榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/yi/b3ce6d0d06b743f397d6b6ed860d90d7.webp',
    members: [
      { source: 'migu', id: '83048867' }
    ]
  },
  {
    id: 'mg-fav-hot', title: '收藏人气榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/yi/a496915cd68c4007849ac3e76e98df28.webp',
    members: [
      { source: 'migu', id: '83049056' }
    ]
  },
  {
    id: 'mg-vip-love', title: '会员臻爱榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/yh/de330be754524299a84d697fd070bcaf.webp',
    members: [
      { source: 'migu', id: '76557745' }
    ]
  },
  {
    id: 'mg-guofeng', title: '国风热歌榜', cover: 'https://d.musicapp.migu.cn/data/oss/resource/00/5y/gq/cb4bb606924f4f199db5e47c857add45.webp',
    members: [
      { source: 'migu', id: '83176390' }
    ]
  },
  // v1.2.0（对齐 baka boardList）新增 6 榜
  {
    id: 'mg-original', title: '尖叫原创榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/dh/e98a179c357c436d8e2746fcbe64dda2',
    members: [
      { source: 'migu', id: '27553408' }
    ]
  },
  {
    id: 'mg-wind', title: '音乐风向榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/hh/72ea2a03dd554a5abded58a49af05d32',
    members: [
      { source: 'migu', id: '75959118' }
    ]
  },
  {
    id: 'mg-ring', title: '彩铃分贝榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/hi/c50f0baa268c486290cb35394ac0f8a0',
    members: [
      { source: 'migu', id: '76557036' }
    ]
  },
  {
    id: 'mg-gt', title: '港台榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/dh/2d827a0ea8ea459992a9add11adba63e',
    members: [
      { source: 'migu', id: '23189800' }
    ]
  },
  {
    id: 'mg-mainland', title: '内地榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/di/b0fcbed68fa642048a5ebef817235c72',
    members: [
      { source: 'migu', id: '23189399' }
    ]
  },
  {
    id: 'mg-oumei', title: '欧美榜', cover: 'https://d.musicapp.migu.cn/data/oss/column/00/1w/dh/a97fbb1b8fd04f6eb648a05be773c87c',
    members: [
      { source: 'migu', id: '19190036' }
    ]
  }
];

var CHART_FETCHERS = {
  migu: function (rankId) {
    // v1.1.0 修复#5：pageSize 50→100（实测服务端上限 100，pageNum 被服务端忽略——
    // probe3 复核 pageNum=2/3 首曲不变，故单页取满即全量，isEnd 如实返回 true）
    return axios.get('https://app.c.nf.migu.cn/pc/bmw/rank/rank-info/v1.0', {
      params: { rankId: rankId, pageSize: 100, pageNum: 1 },
      timeout: SOURCE_TIMEOUT,
      headers: { channel: '014X031', Referer: 'https://music.migu.cn/' }
    }).then(function (res) {
      var data = res.data && res.data.data;
      var list = (data && data.contents) || [];
      return list.map(function (c) {
        var sd = {};
        try { sd = JSON.parse(c.songData) || {}; } catch (e) { sd = {}; }
        var cid = str(sd.contentId || c.resId);
        var d = parseInt(sd.duration, 10) || 0;
        if (d > 10000) d = Math.round(d / 1000); // 毫秒归一（毫秒歌长不可能是整数万秒级）
        var singers = sd.singerList || [];
        var artist = singers.map(function (s) { return str(s.name); }).join('/') || str(c.txt2);
        return {
          source: 'migu', sid: cid,
          title: str(sd.songName || c.txt),
          artist: artist,
          album: str(sd.album || c.txt3),
          duration: d,
          artwork: str(c.img || sd.img2 || sd.img1),
          // v1.3.0（P0）：榜单条目挂 qualities——songData 实测带 audioFormats[].asize/isize
          // （2026-09-07 rank-info 实测），音质大小在榜单列表页即可显示
          qualities: miguQualitiesFromEntry(sd),
          raw: { contentId: cid, copyrightId: str(sd.copyrightId || c.copyrightId), lyricUrl: '', mrcUrl: '' }
        };
      }).filter(function (it) { return it.sid && it.title; });
    });
  }
};

/**
 * 多平台榜单合并。
 * 入参 lists: [{ source, items: [归一化条目（榜单名次序）] }]
 * 归一化名次分 rankScore = (N - idx) / N；条目得分 = 名次分均值 + 0.2×(命中平台数-1)
 * 同源重复条目取更高名次；跨源同曲经 isSameSong 判定合并。
 */
function mergeChartLists(lists) {
  var entries = [];
  var byKey = {};
  var byLoose = {};
  for (var li = 0; li < lists.length; li++) {
    var src = lists[li].source;
    var items = lists[li].items || [];
    var n = items.length;
    if (!n) continue;
    for (var ii = 0; ii < n; ii++) {
      var it = items[ii];
      var rankScore = (n - ii) / n;
      var skey = makeKey(it.title, it.artist);
      var lkey = looseTitleKey(it.title);
      var entry = byKey[skey];
      if (!entry) {
        var cands = byLoose[lkey] || [];
        for (var ci = 0; ci < cands.length; ci++) {
          if (isSameSong(entries[cands[ci]].hits[0].item, it)) { entry = entries[cands[ci]]; break; }
        }
      }
      if (!entry) {
        entry = { key: skey, hits: [{ source: src, item: it, rankScore: rankScore }] };
        entries.push(entry);
        byKey[skey] = entry;
        if (!byLoose[lkey]) byLoose[lkey] = [];
        byLoose[lkey].push(entries.length - 1);
      } else {
        var dup = null;
        for (var hi = 0; hi < entry.hits.length; hi++) {
          if (entry.hits[hi].source === src) { dup = entry.hits[hi]; break; }
        }
        if (dup) {
          if (rankScore > dup.rankScore) { dup.rankScore = rankScore; dup.item = it; }
        } else {
          entry.hits.push({ source: src, item: it, rankScore: rankScore });
        }
      }
    }
  }
  for (var e = 0; e < entries.length; e++) {
    var en = entries[e];
    var sum = 0;
    for (var h = 0; h < en.hits.length; h++) sum += en.hits[h].rankScore;
    en.score = sum / en.hits.length + 0.2 * (en.hits.length - 1);
  }
  return entries;
}

function buildChartItem(entry) {
  // 展示条目 = 来源权重最高者（同权重取名次分高者）
  var base = entry.hits[0];
  for (var i = 1; i < entry.hits.length; i++) {
    var w1 = SOURCE_WEIGHT[entry.hits[i].source] || 0.5;
    var w0 = SOURCE_WEIGHT[base.source] || 0.5;
    if (w1 > w0 || (w1 === w0 && entry.hits[i].rankScore > base.rankScore)) base = entry.hits[i];
  }
  var duration = parseInt(base.item.duration, 10) || 0;
  for (var j = 0; j < entry.hits.length && !duration; j++) {
    duration = parseInt(entry.hits[j].item.duration, 10) || 0;
  }
  var src = {};
  for (var k = 0; k < entry.hits.length; k++) {
    if (entry.hits[k].item.raw && !src[entry.hits[k].source]) {
      src[entry.hits[k].source] = entry.hits[k].item.raw;
    }
  }
  return {
    id: 'c_' + base.source + '_' + base.item.sid,
    title: base.item.title,
    artist: base.item.artist,
    album: base.item.album || undefined,
    duration: duration || undefined,
    artwork: base.item.artwork || undefined,
    // v1.2.0 字段对齐：qualities/copyrightId/MV 字段透出（宿主协议）
    qualities: base.item.qualities || undefined,
    copyrightId: (base.item.raw && base.item.raw.copyrightId) || undefined,
    mvId: (base.item.raw && base.item.raw.mvId) || undefined,
    mvCopyrightId: (base.item.raw && base.item.raw.mvCopyrightId) || undefined,
    _src: src
  };
}

function fetchChartMember(member) {
  var fn = CHART_FETCHERS[member.source];
  if (!fn) return Promise.resolve({ source: member.source, items: [] });
  return fn(member.id).then(function (items) {
    return { source: member.source, items: items };
  }).catch(function () {
    return { source: member.source, items: [] }; // 单平台失败不拖垮整榜
  });
}

function findChartDef(id) {
  for (var i = 0; i < CHART_DEFS.length; i++) {
    if (CHART_DEFS[i].id === id) return CHART_DEFS[i];
  }
  return null;
}

function getAggregatedChart(def) {
  var cached = chartCache[def.id];
  if (cached && Date.now() - cached.ts < CHART_TTL_MS) {
    return Promise.resolve(cached.list);
  }
  if (chartInflight[def.id]) return chartInflight[def.id];
  var p = Promise.all(def.members.map(fetchChartMember)).then(function (lists) {
    var ok = 0;
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].items.length > 0) ok++;
    }
    if (ok === 0) throw new Error('聚合榜单拉取失败：所有平台榜单请求均失败');
    var merged = mergeChartLists(lists);
    merged.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.hits[0].rankScore - b.hits[0].rankScore;
    });
    var musicList = [];
    var cap = Math.min(merged.length, 100);
    for (var j = 0; j < cap; j++) musicList.push(buildChartItem(merged[j]));
    chartCache[def.id] = { ts: Date.now(), list: musicList };
    return musicList;
  });
  var p2 = p.then(function (r) { delete chartInflight[def.id]; return r; },
    function (e) { delete chartInflight[def.id]; throw e; });
  chartInflight[def.id] = p2;
  return p2;
}

// v1.1.0 修复#6：SHEET_MAX_PAGES 4→10。50×10=500 首实际可达，对齐宣称值；
// 每页请求仍串行、命中 SHEET_MAX_ITEMS 即提前退出，插件方法 10s 硬上限内可控。
var SHEET_MAX_PAGES = 10;
var SHEET_MAX_ITEMS = 500;    // 导入条数上限（防超时）

var SHEET_URL_RESOLVERS = {
  migu: function (s) {
    if (!/migu\.cn/.test(s)) return null;
    var m = /[?&]id=(\d+)/.exec(s) || /playlist\/(\d+)/.exec(s);
    // v1.2.0：h5 分享链接（对齐 baka importMusicSheet 正则）
    if (!m) m = /https?:\/\/h5\.nf\.migu\.cn\/app\/v4\/p\/share\/playlist\/index\.html\?.*id=([0-9]+)/.exec(s);
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
      headers: { 'User-Agent': miguUA() }
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
 * v1.8.2（P2-4）：歌单导入错误统一构造——message 原样展示给宿主，code 供宿主结构化处理。
 */
function sheetImportError(code, msg) {
  var e = new Error('[migu] ' + msg);
  e.code = code;
  e.platform = 'migu';
  return e;
}

/**
 * 解析歌单链接/纯数字 id → { source, id }
 * 支持：咪咕网页链接、h5 分享链接与 c.migu.cn 短链（302 跟随）。
 * v1.2.0：本插件为单源（仅咪咕），纯数字 id 无平台歧义，直接按咪咕处理（对齐 baka 行为）。
 */
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
  // 纯数字 id：单源无歧义，直接当咪咕歌单 id
  if (/^\d{5,}$/.test(s)) return { source: 'migu', id: s };

  // 短链：先跟随 302 再匹配（咪咕 c.migu.cn/xx）
  if (/^https?:\/\/c\.migu\.cn\//.test(s)) {
    s = await followRedirects(s);
  }

  var sources = ['migu'];
  for (var i = 0; i < sources.length; i++) {
    var id = SHEET_URL_RESOLVERS[sources[i]](s);
    if (id) return { source: sources[i], id: id };
  }
  throw sheetImportError('SHEET_URL_UNRECOGNIZED', '无法识别的歌单链接（支持咪咕音乐歌单分享链接或纯数字歌单 id）');
}

/**
 * v1.2.0（对齐 baka）：拉取歌单元数据（标题/封面/描述/播放数/创建者）。
 * best-effort：失败返回 null，不影响歌曲列表拉取。
 * v1.8.2（P1-1）：旧接口 query_playlist_by_id_tag 实测多种网络环境返回 HTML 登录壳
 * （接口 SPA 化失效），改为首选 app.c.nf.migu.cn MIGUM3.0 playlist/v2.0（App 通道，
 * channel: 014X031 + Referer，与歌曲列表接口 playlist/song/v2.0 同族，实测返回完整
 * 元数据）；旧接口降为二次兜底；全部失败 console.warn 明确记录，不再静默。
 */
async function fetchMiguSheetMeta(playlistId) {
  // 首选：MIGUM3.0 playlist/v2.0（2026-09-10 实测歌单 135765874/195233074 均正常）
  try {
    var res = await axios.get('https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/v2.0', {
      params: { playlistId: playlistId, pageNo: 1, pageSize: 1 },
      timeout: SOURCE_TIMEOUT,
      headers: { channel: '014X031', Referer: 'https://music.migu.cn/' }
    });
    var d = res.data && res.data.data;
    if (d && d.title) {
      var cover2 = str(d.originalImgUrl || (d.imgItem && d.imgItem.img));
      if (cover2 && cover2.indexOf('http') !== 0) cover2 = 'http:' + cover2;
      return {
        title: str(d.title),
        artwork: cover2 || undefined,
        description: str(d.summary) || undefined,
        playCount: parseInt((d.opNumItem && d.opNumItem.playNum) || d.playCount, 10) || undefined,
        worksNum: parseInt(d.musicNum, 10) || undefined,
        artist: str(d.ownerName) || undefined
      };
    }
  } catch (e) { /* 首选失败，继续兜底 */ }
  // 兜底：旧接口（部分环境仍可用；返回 HTML 时 rsp 为空，按 null 处理）
  try {
    var res2 = await axios.get(
      'https://m.music.migu.cn/migu/remoting/query_playlist_by_id_tag',
      {
        params: { onLine: 1, queryChannel: 0, createUserId: 'migu', contentCountMin: 5, playListId: playlistId },
        timeout: SOURCE_TIMEOUT,
        headers: {
          Referer: 'https://m.music.migu.cn',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68',
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );
    var pl = res2.data && res2.data.rsp && res2.data.rsp.playList && res2.data.rsp.playList[0];
    if (!pl) return null;
    var cover = str(pl.spielPic || pl.img);
    if (cover && cover.indexOf('http') !== 0) cover = 'http:' + cover;
    return {
      title: str(pl.name),
      artwork: cover || undefined,
      description: str(pl.intro || pl.description) || undefined,
      playCount: parseInt(pl.playCount, 10) || undefined,
      worksNum: parseInt(pl.contentCount, 10) || undefined,
      artist: str(pl.createUserName) || undefined
    };
  } catch (e2) {
    // v1.8.2（P1-1）：不再静默吞错——至少留一条可排查日志
    console.warn('[migu] 歌单元数据获取失败（playlistId=' + playlistId + '）：' + (e2 && e2.message));
    return null;
  }
}

var SHEET_FETCHERS = {
  migu: async function (playlistId) {
    var out = [];
    for (var pageNo = 1; pageNo <= SHEET_MAX_PAGES && (pageNo - 1) * 50 < SHEET_MAX_ITEMS; pageNo++) {
      var res = await axios.get('https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0', {
        params: { pageNo: pageNo, pageSize: 50, playlistId: playlistId },
        timeout: SOURCE_TIMEOUT,
        headers: { channel: '014X031', Referer: 'https://music.migu.cn/' }
      });
      var data = res.data && res.data.data;
      var list = (data && data.songList) || [];
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        var pic = str(it.img1 || it.img2 || it.img3);
        if (pic && pic.indexOf('http') !== 0) pic = 'https://d.musicapp.migu.cn' + pic;
        out.push({
          source: 'migu', sid: str(it.contentId),
          title: str(it.songName),
          artist: (it.singerList || []).map(function (x) { return str(x.name); }).join('/'),
          album: str(it.album && it.album.name ? it.album.name : it.album),
          duration: parseInt(it.duration, 10) || 0,
          artwork: pic,
          // v1.3.0（P0）：歌单条目挂 qualities——playlist song v2.0 条目实测自带
          // audioFormats[].asize/isize（2026-09-07 实测歌单 195233074）
          qualities: miguQualitiesFromEntry(it),
          raw: { contentId: str(it.contentId), copyrightId: str(it.copyrightId || ''), lyricUrl: str(it.lrcUrl || ''), mrcUrl: str(it.mrcUrl || '') }
        });
      }
      if (list.length < 50) break;
    }
    return out.filter(function (it) { return it.sid && it.title; });
  }
};

/** 归一化歌单条目 → 聚合条目（_src 带单源 raw，复用取链接力） */
function buildSheetItem(entry) {
  var src = {};
  src[entry.source] = entry.raw;
  var item = {
    id: entry.source + '_' + entry.sid,
    // v1.8.2（P2-1）：宿主 canPlayMusicVideo 按 platform 反查插件，条目必须带平台
    platform: entry.source || 'migu',
    title: entry.title,
    artist: entry.artist,
    album: entry.album || undefined,
    duration: entry.duration || undefined,
    artwork: entry.artwork || undefined,
    // v1.2.0 字段对齐：qualities/copyrightId/MV 字段透出（宿主协议）
    qualities: entry.qualities || undefined,
    copyrightId: (entry.raw && entry.raw.copyrightId) || undefined,
    mvId: (entry.raw && entry.raw.mvId) || undefined,
    mvCopyrightId: (entry.raw && entry.raw.mvCopyrightId) || undefined,
    _src: src,
    _srcOrder: [entry.source]
  };
  return item;
}

/**
 * 导入歌单：urlLike 支持咪咕歌单网页/h5 分享链接（含 c.migu.cn 短链）或纯数字歌单 id。
 * v1.2.0：返回完整歌单对象（宿主 IImportMusicSheetResult 协议，兼容旧数组行为）；
 * 条目带单源 _src，播放时复用取链接力。
 */
async function importMusicSheetImpl(urlLike) {
  var resolved = await resolveSheetId(urlLike);
  var fetcher = SHEET_FETCHERS[resolved.source];
  if (!fetcher) throw sheetImportError('SHEET_URL_UNRECOGNIZED', '该平台暂不支持歌单导入');
  // v1.2.0：歌单元数据 best-effort 预取（与歌曲列表并行，失败不阻塞）
  var metaP = fetchMiguSheetMeta(resolved.id);
  var entries;
  try {
    entries = await fetcher(resolved.id);
  } catch (e) {
    throw sheetImportError('SHEET_FETCH_FAILED', '歌单歌曲拉取失败：' + ((e && e.message) || e));
  }
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
  // v1.2.0（对齐宿主 IImportMusicSheetResult）：返回完整歌单对象（标题/封面/元数据+musicList）
  var meta = null;
  try { meta = await metaP; } catch (e) { meta = null; }
  var sheet = {
    id: 'migu_' + resolved.id,
    // v1.8.2（P2-3）：宿主按 platform 反查插件；isImported 标记歌单来源
    platform: 'migu',
    isImported: true,
    title: (meta && meta.title) || ('咪咕歌单 #' + resolved.id),
    artwork: (meta && meta.artwork) || (out[0] && out[0].artwork) || undefined,
    worksNum: (meta && meta.worksNum) || out.length,
    musicList: out
  };
  if (meta && meta.description) sheet.description = meta.description;
  if (meta && meta.playCount) sheet.playCount = meta.playCount;
  if (meta && meta.artist) { sheet.artist = meta.artist; sheet.author = meta.artist; } // [v1.9.1] author 别名（任务字段清单要求 author，宿主协议用 artist）
  return sheet;
}

// ==================== 单曲导入 & 歌曲详情 ====================
// 单平台版：咪咕单曲分享链接无可稳定解析的歌曲字段，暂不支持导入（与聚合版口径一致，明确报错）；
// SONG_DETAIL_FETCHERS 多源详情通道随拆分移除（咪咕搜索/歌单条目自带完整字段）。
// v1.1.0（修复#15 死代码清理）：SONG_URL_RESOLVERS 的恒 null 桩、SONG_DETAIL_FETCHERS 空表、
// formatTs 未引用函数一并移除；importMusicItemImpl 直抛明确报错。

/**
 * 导入单曲：咪咕分享链接无可稳定解析的歌曲 id（v1.0.0 亦实际不可用），
 * 在此直接明确报错，不再绕经永远为空的 resolveSongId/fetcher 死链路。
 */
async function importMusicItemImpl(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw new Error('单曲链接为空');
  if (/^\d{5,}$/.test(s)) throw new Error('纯数字歌曲 id 无法判定平台，请粘贴带域名的完整分享链接');
  throw new Error('咪团单曲分享链接暂不支持导入（无可稳定解析的歌曲 id）');
}

// v1.2.0（对齐 baka getMiGuMusicInfo）：resourceinfo.do 按 copyrightId 反查歌曲资源信息。
// 实测返回 resource[0] 含 mrcurl/mrcUrl、lrcUrl、trcUrl 等歌词链与 contentId（若有）。
// 用于补全「仅 copyrightId」的条目（歌词搜索/导入等入口可能只带 copyrightId）。
async function fetchMiguResourceInfo(copyrightId) {
  var r = await axios.post(
    'https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=2',
    'resourceId=' + encodeURIComponent(String(copyrightId)),
    {
      timeout: SOURCE_TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36',
        Referer: 'https://m.music.migu.cn/'
      }
    }
  );
  var resource = r.data && r.data.resource;
  if (resource && resource.length > 0) return resource[0];
  return null;
}

/**
 * 歌曲详情补齐（P0-4）：MusicFree 协议 getMusicInfo。
 * 优先原生源详情（_srcOrder），失败降级按 _src 内其它源接力（≤2 次请求）；
 * 只补空缺字段（artwork/album/duration/mv/videoId），不覆盖已有值。
 * v1.2.0（对齐 baka）：仅 copyrightId 的条目经 resourceinfo.do 反查补全
 * （歌词链/封面/时长/contentId），并挂上 _src.migu 供后续取链/歌词接力。
 */
async function getMusicInfoImpl(musicItem) {
  if (!musicItem) return musicItem;
  var srcMap = musicItem._src || {};
  var raw = srcMap.migu || null;

  // v1.2.0：无 _src.migu 但有 copyrightId（歌词搜索/极简条目）→ resourceinfo 反查补全
  if (!raw) {
    var cid = String(musicItem.copyrightId || '').trim();
    if (!cid) {
      // 尽力从复合 id / _src 其它源取 copyrightId
      var mId = String(musicItem.id || '').match(/^migu_([0-9a-zA-Z]+)$/);
      if (mId) cid = mId[1];
    }
    if (!cid) {
      // 单平台版：无咪咕主键时维持旧行为（补封面直通桩）
      if (!musicItem.artwork) {
        try { await enrichArtwork([musicItem]); } catch (e) { /* 封面可选 */ }
      }
      return musicItem;
    }
    var res0 = null;
    // v1.2.0：主通道 jadeite v3 反查（songId/copyrightId 精确匹配，baka getMusicInfo 同款）
    // resourceinfo.do 实测对部分资源返回空数组，降为兜底
    try { res0 = await jadeiteSongLookup(cid); } catch (e) { /* 反查失败走兜底 */ }
    if (!res0) {
      try { res0 = await fetchMiguResourceInfo(cid); } catch (e) { /* 兜底也失败按缺数据处理 */ }
    }
    var newRaw = {
      copyrightId: cid,
      contentId: str(res0 && (res0.contentId || res0.songId) || ''),
      mvId: str(res0 && res0.mvId || ''),
      mvCopyrightId: str(res0 && (res0.mvCopyrightId || (res0.mvList && res0.mvList[0] && res0.mvList[0].copyrightId)) || ''),
      lyricUrl: str(res0 && (res0.lrcUrl || res0.lrcurl || res0.lyricUrl) || ''),
      mrcUrl: str(res0 && (res0.mrcUrl || res0.mrcurl) || ''),
      trcUrl: str(res0 && (res0.trcUrl || res0.trcurl) || ''),
      cover: str(res0 && (res0.picUrl || res0.img3 || res0.img2 || res0.img1 || (res0.imgItems && res0.imgItems[0] && res0.imgItems[0].img)) || ''),
      title: str(res0 && (res0.songName || res0.name) || musicItem.title || ''),
      singer: str(res0 && (res0.singer || (res0.singerList && res0.singerList.map(function (s) { return s.name; }).join(','))) || musicItem.artist || ''),
      album: str(res0 && (res0.album || (res0.albums && res0.albums[0] && res0.albums[0].name)) || musicItem.album || ''),
      duration: res0 && parseInt(res0.duration, 10) || 0
    };
    // contentId 拿到时再用 by-contentids 元数据兜底（歌词链/封面/时长更全）
    var metaQ = null;
    if (newRaw.contentId) {
      try {
        var meta = await fetchMiguSongMeta(newRaw.contentId);
        if (meta) {
          newRaw.lyricUrl = newRaw.lyricUrl || meta.lyricUrl;
          newRaw.mrcUrl = newRaw.mrcUrl || meta.mrcUrl;
          newRaw.trcUrl = newRaw.trcUrl || meta.trcUrl;
          newRaw.cover = newRaw.cover || meta.artwork;
          newRaw.duration = newRaw.duration || meta.duration;
          metaQ = meta.qualities || null;
        }
      } catch (e) { /* 元数据兜底可选 */ }
    }
    // v1.4.0（P1-5）：v2.0 songItem 三歌词链补缺（by-contentids 实测偶缺 mrcUrl/trcUrl）；
    // 顺手暖 v20ItemCache/z3dCache（下方 z3dCode 直出块零请求命中）
    if (newRaw.contentId && (!newRaw.lyricUrl || !newRaw.mrcUrl || !newRaw.trcUrl)) {
      try {
        var v20MetaA = v20MetaOf(await fetchMiguV20Item(newRaw.contentId, newRaw.copyrightId));
        if (v20MetaA) {
          newRaw.lyricUrl = newRaw.lyricUrl || v20MetaA.lyricUrl;
          newRaw.mrcUrl = newRaw.mrcUrl || v20MetaA.mrcUrl;
          newRaw.trcUrl = newRaw.trcUrl || v20MetaA.trcUrl;
        }
      } catch (eV20m) { /* v2.0 富字段可选，失败走下方既有兜底 */ }
    }
    var out2 = {};
    for (var k2 in musicItem) out2[k2] = musicItem[k2];
    out2._src = { migu: newRaw };
    // 回填顶层缺失字段
    if (!out2.artwork && newRaw.cover) out2.artwork = miguPic(newRaw.cover);
    if (!out2.duration && newRaw.duration) out2.duration = newRaw.duration;
    if (!out2.album && newRaw.album) out2.album = newRaw.album;
    if (!out2.mvId && newRaw.mvId) out2.mvId = newRaw.mvId;
    // v1.3.0（P0）：回填 qualities——jadeite 反查条目 / by-contentids 元数据均带音质
    // 大小字段（audioFormats[].asize），宿主下载面板无 size 时会主动调 getMusicInfo 补齐
    // v1.3.1：与常规路径同口径——已有 qualities 也合并（新档位追加、缺 size 补 size）
    var qA = (res0 && miguQualitiesFromEntry(res0)) || metaQ;
    if (qA) {
      var qMergedA = mergeHostQualities(out2.qualities, qA);
      if (qMergedA) out2.qualities = qMergedA;
    }
    // v1.6.0（P1-2/P2-3/P2-4）：fee/alias/primaryKey 补缺（只补空缺不覆盖）——
    // v2.0 songItem 是 vipType/vipFlag/songAliasName 的稳定来源（by-contentids 无付费字段）
    try {
      var v20F = newRaw.contentId ? getV20Item(newRaw.contentId) : null;
      if (!v20F && newRaw.contentId) {
        try { v20F = await fetchMiguV20Item(newRaw.contentId, newRaw.copyrightId); } catch (eF2) { v20F = null; }
      }
      if (v20F) {
        // v1.6.0（P1-2）-> v1.9.5：fee（VIP 标识）停写，仅补 alias/primaryKey
        if (!out2.alias && v20F.songAliasName) out2.alias = str(v20F.songAliasName);
        if (!out2.primaryKey) out2.primaryKey = newRaw.copyrightId || newRaw.contentId;
      }
    } catch (eF) { /* alias/primaryKey 补缺可选，失败不影响详情 */ }
    // v1.3.2 ①：z3dCode 直出（best-effort）——atmos/atmos_plus 补 size，_src 透传供升级梯与宿主解密层使用
    // v1.4.0：z3dCode 优先吃 v2.0 富字段通道落下的 z3dCache（上方补缺时已暖），
    // 未命中再走一次 v2.0（缺歌词链场景跳过时在此补拉），最后回落 v2.1 fetchMiguZ3dCode
    if (newRaw.contentId) {
      try {
        var z3A = z3dCache[newRaw.contentId] || null;
        if (!z3A && !newRaw.mrcUrl && !newRaw.lyricUrl) {
          // 上方补缺未触发 v2.0（歌词链全齐）：主动拉一次暖缓存
          try { await fetchMiguV20Item(newRaw.contentId, newRaw.copyrightId); } catch (eV20z) { /* 回落 v2.1 */ }
          z3A = z3dCache[newRaw.contentId] || null;
        }
        if (!z3A) z3A = await fetchMiguZ3dCode(newRaw.contentId, newRaw.copyrightId);
        if (z3A) {
          newRaw.z3d = z3A;
          var zqA = {};
          if (z3A.wav3d && z3A.wav3d.size) zqA.atmos = { size: z3A.wav3d.size };
          if (z3A.sample && z3A.sample.size) zqA.atmos_plus = { size: z3A.sample.size };
          var zMergedA = mergeHostQualities(out2.qualities, zqA);
          if (zMergedA) out2.qualities = zMergedA;
        }
      } catch (eZ3a) { /* z3dCode 可选，失败不影响详情 */ }
    }
    return out2;
  }

  // v1.3.1（P0 根因修复）：常规路径 qualities 由「仅缺失时回填」改为「始终合并补齐」。
  // v1.3.0 条件 `!musicItem.qualities` 在搜索条目已自带 3 档 qualities 时恒假，
  // by-contentids/jadeite 多报的档位（如 Z3D→atmos）永远回不来——这正是
  // 「《晴天》只显示 3 档」的直接根因。现在无论是否已有 qualities 都取详情通道
  // 并 mergeHostQualities 合并（新档位追加、同档缺 size 补 size）。
  if (raw) {
    var qB = null;
    if (raw.contentId) {
      try {
        var metaB = await fetchMiguSongMeta(raw.contentId);
        qB = (metaB && metaB.qualities) || null;
      } catch (e) { /* 元数据兜底可选 */ }
    }
    if (!qB && (raw.copyrightId || raw.songId)) {
      try {
        var hitQ = await jadeiteSongLookup(raw.copyrightId || raw.songId);
        qB = miguQualitiesFromEntry(hitQ) || null;
      } catch (e) { /* 反查兜底可选 */ }
    }
    if (qB) {
      var qMerged = mergeHostQualities(musicItem.qualities, qB);
      if (qMerged) musicItem.qualities = qMerged;
    }
    // v1.4.0（P1-4/P1-5）：v2.0 富字段补齐——歌词三链缺项 / 副歌点 / 音质元数据透传 _src；
    // 若响应带 rateFormats/newRateFormats（实测多为空，带则收割）并入 qualities。
    // 顺手暖 z3dCache（下方 z3dCode 直出块零请求命中）。
    if (raw.contentId) {
      try {
        var v20B = await fetchMiguV20Item(raw.contentId, raw.copyrightId);
        var v20MetaB = v20MetaOf(v20B);
        if (v20MetaB) {
          raw.lyricUrl = raw.lyricUrl || v20MetaB.lyricUrl;
          raw.mrcUrl = raw.mrcUrl || v20MetaB.mrcUrl;
          raw.trcUrl = raw.trcUrl || v20MetaB.trcUrl;
          raw.chorusStartTime = raw.chorusStartTime || v20MetaB.chorusStartTime;
          raw.toneControl = raw.toneControl || v20MetaB.toneControl;
          raw.topQuality = raw.topQuality || v20MetaB.topQuality;
        }
        var qV20 = miguQualitiesFromEntry(v20B);
        if (qV20) {
          var qMergedV20 = mergeHostQualities(musicItem.qualities, qV20);
          if (qMergedV20) musicItem.qualities = qMergedV20;
        }
      } catch (eV20b) { /* v2.0 富字段可选，失败不影响详情 */ }
      // v1.6.0（P1-2/P2-3/P2-4）-> v1.9.5：fee（VIP 标识）停写，仅补 alias/primaryKey。
      try {
        if (!musicItem.alias && v20MetaB && v20MetaB.songAliasName) musicItem.alias = v20MetaB.songAliasName;
        if (!musicItem.primaryKey) musicItem.primaryKey = raw.copyrightId || raw.contentId;
      } catch (eFb) { /* alias/primaryKey 补缺可选 */ }
    }
    // v1.3.2 ①：z3dCode 直出（best-effort）——atmos/atmos_plus 补 size，raw.z3d 供升级梯与宿主解密层
    // v1.4.0：优先吃 v2.0 富字段通道落下的 z3dCache（上方补齐时已暖），未命中回落 v2.1
    if (raw.contentId) {
      try {
        var z3B = z3dCache[str(raw.contentId)] || null;
        if (!z3B) {
          try { await fetchMiguV20Item(raw.contentId, raw.copyrightId); } catch (eV20z2) { /* 回落 v2.1 */ }
          z3B = z3dCache[str(raw.contentId)] || null;
        }
        if (!z3B) z3B = await fetchMiguZ3dCode(raw.contentId, raw.copyrightId);
        if (z3B) {
          raw.z3d = z3B;
          var zqB = {};
          if (z3B.wav3d && z3B.wav3d.size) zqB.atmos = { size: z3B.wav3d.size };
          if (z3B.sample && z3B.sample.size) zqB.atmos_plus = { size: z3B.sample.size };
          var zMergedB = mergeHostQualities(musicItem.qualities, zqB);
          if (zMergedB) musicItem.qualities = zMergedB;
        }
      } catch (eZ3b) { /* z3dCode 可选，失败不影响详情 */ }
    }
  }

  // 常规路径：_src.migu 已存在，缺字段时补
  if (!musicItem.artwork) {
    try { await enrichArtwork([musicItem]); } catch (e) { /* 封面可选 */ }
  }
  // v1.2.0：mvId 缺失时 jadeite 反查补全（best-effort，供宿主 MV 入口使用；
  // 搜索通道 search_all.do 条目不带 mv 数据，MV 详情只能在反查阶段拿到）
  if (raw && !raw.mvId && !musicItem.mvId && (raw.copyrightId || raw.songId)) {
    try {
      var hitMv = await jadeiteSongLookup(raw.copyrightId || raw.songId);
      if (hitMv && (hitMv.mvId || hitMv.mvCopyrightId)) {
        raw.mvId = str(hitMv.mvId || '');
        raw.mvCopyrightId = str(hitMv.mvCopyrightId || '');
        if (raw.mvId) musicItem.mvId = raw.mvId;
      }
    } catch (e) { /* best-effort */ }
  }
  return musicItem;
}

// ==================== 取链适配（咪咕官方 h5v2.4 + 海棠 mg 备源）====================

function haitangLevelOf(quality) {
  if (quality === 'super') return 'lossless';
  if (quality === 'hires' || quality === 'zq32' || quality === 'atmos' || quality === 'atmos2') return 'hires';
  if (quality === 'high') return 'exhigh';
  return 'standard';
}

// 宿主音质键（fork: 96k/128k/192k/320k/flac/flac24bit/hires/master/atmos...）→ 插件内部档位。
// v0.6.0 及之前宿主传入 '320k'/'master' 会被当未知档落回 standard，此映射修正为正确档位。
// v1.1.0 修复#7：'192k' 不再声明（supportedQualities 已移除），但保留降级映射——
// 老宿主仍可能请求 192k，映射到 high(320k) 而非报错；flac24bit 归入 hires（ZQ24 派生）。
// v1.2.0：档位重排——宿主 'flac24bit' → 内部 hires（ZQ24/flac_24bit，2026-09-06 实测）；
// 宿主 'hires' → 内部 zq32（ZQ32/wav_32bit，baka 实测通道）；'atmos' → 内部 atmos（Z3D/wav_3d）；
// 'atmos_plus' → 内部 atmos2（3D60/wav_3d_60s）。master/dolby 等泛高解析词归 zq32。
var QUALITY_KEY_MAP = {
  '96k': 'standard', '128k': 'standard',
  '192k': 'high', '320k': 'high',
  'flac': 'super', 'flac24bit': 'hires',
  'hires': 'zq32', 'master': 'zq32', 'atmos': 'atmos', 'atmos_plus': 'atmos2', 'dolby': 'zq32', 'vinyl': 'zq32'
};
function normalizeQuality(q) {
  var s = String(q || '');
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'standard' || s === 'high' || s === 'super' || s === 'hires' || s === 'zq32' || s === 'atmos' || s === 'atmos2') return s;
  return 'standard';
}

// [v0.7.2 fix#10 P1] 音质诚实性：插件内部档位 → 宿主音质键（IMediaSourceResult.actualQuality）。
// 多源接力/降级后「宣称档位 ≠ 实际档位」是多源播放器通病；v0.7.2 起各取链解析器
// 在返回值上附 actualQuality（宿主音质键口径：128k/192k/320k/flac/flac24bit/hires），
// 供宿主 UI 角标展示真实档位。取不到确定档位的通道不填该字段（宁缺毋假）。
function internalToHostQuality(q) {
  if (q === 'high') return '320k';
  if (q === 'super') return 'flac';
  if (q === 'hires') return 'flac24bit';
  if (q === 'zq32') return 'hires';
  if (q === 'atmos') return 'atmos';
  if (q === 'atmos2') return 'atmos_plus';
  return '128k'; // standard / low / 未知
}

// [v1.9.4] size 探测辅助：Range 0-0 HEAD 探测 Content-Range/Content-Length 写回。
// 优先级：Content-Range 的 total（如 "bytes 0-0/4319232"）> 200 响应 Content-Length。
// 失败 fail-soft：探测失败/4xx/超时返回 0。
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


function resolveHaitang(source, rid, quality) {
  var r = String(rid || '');
  if (source === 'kg') r = r.toUpperCase(); // 文档实测：酷狗小写 hash 返回 UPSTREAM_RESOLVE_FAILED
  return axios.post('https://musicserver.haitangw.cc/v1/music/resolve-url', {
    source: source, rid: r, level: haitangLevelOf(quality)
  }, {
    timeout: RELAY_TIMEOUT, // v0.7.1 P1-3：接力段超时 2500ms
    headers: { Referer: 'https://musicserver.haitangw.cc/', 'Content-Type': 'application/json' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 0 || !d || !d.url) throw new Error('haitang no url');
    // [v0.7.2 fix#10] actualQuality：海棠 level 与请求档一一对应（standard→128k / exhigh→320k / lossless→flac / hires→hires）
    return { url: String(d.url), actualQuality: internalToHostQuality(quality) };
  });
}

var H5V24_KEY = 'Jk8qzuePiJ1qE3mDYhLQ3T73DtDoAhLP';
var MIGU_DIR_CN_PQ = '%E6%A0%87%E6%B8%85%E9%AB%98%E6%B8%85';   // 标清高清
var MIGU_DIR_CN_DL = '%E6%AD%8C%E6%9B%B2%E4%B8%8B%E8%BD%BD'; // 歌曲下载
// v1.5.0：部分通道/批次（product8th 等）直链含原文中文目录（未做 URL 编码），派生需兼容
var MIGU_DIR_CN_PQ_RAW = '标清高清';
var MIGU_DIR_CN_DL_RAW = '歌曲下载';

function decryptH5v24(bytes) {
  if (bytes.length < 4) throw new Error('migu resp too short');
  if (bytes[0] !== 0xAB || bytes[1] !== 0xCD || bytes[2] !== 0x01) {
    throw new Error('migu magic mismatch');
  }
  var offset = bytes[3];
  var plain = new Array(bytes.length - 4);
  for (var i = 0; i < plain.length; i++) {
    var ki = H5V24_KEY.charCodeAt(i % 32);
    plain[i] = (bytes[4 + i] + offset - ki) & 0xFF;
  }
  // 分段解码避免超长 apply 参数上限
  var out = '';
  for (var s = 0; s < plain.length; s += 4096) {
    out += String.fromCharCode.apply(String, plain.slice(s, s + 4096));
  }
  return JSON.parse(out);
}

// v1.5.0：无损/增强档「标清高清 → 歌曲下载」目录置换公共段。
// 兼容 URL 编码（%E6%A0%87%E6%B8%85%E9%AB%98%E6%B8%85，%XX 十六进制大小写上游不保证一致，
// 故 gi 全量替换）与原文中文两种形态；product9th / product8th / product39 等凡 PQ 路径
// 含「标清高清」目录的路径体系统一适用（滚石曲库 product8th/product39 已实测派生有效）。
// ringmaker / product05 / product08 / product15 等老批次 SQ 目录体系不同（版权方目录名、
// 年月层级均不同），派生必 404——不做目录名硬猜，由上层「探测失败 → 酷我兜底」承接。
function miguSwapSqDir(pqUrl) {
  var s = String(pqUrl);
  s = s.replace(new RegExp(MIGU_DIR_CN_PQ, 'gi'), MIGU_DIR_CN_DL);
  return s.split(MIGU_DIR_CN_PQ_RAW).join(MIGU_DIR_CN_DL_RAW);
}

function deriveMiguUrl(pqUrl, quality) {
  if (quality === 'standard' || String(pqUrl).indexOf('freetyst.nf.migu.cn') < 0) return pqUrl;
  if (quality === 'high') {
    // 文档 3.3 规律①：HQ 与 PQ 同路径必存在，免探测
    return pqUrl.replace('MP3_128_16_Stero', 'MP3_320_16_Stero');
  }
  if (quality === 'super') {
    // 文档 3.3：SQ = 歌曲下载目录 + flac 编码；存在性独立 → 上层必须 Range 探测（v1.1.0 修复#2）
    // v1.5.0：目录置换扩为 miguSwapSqDir（不再限定 product9th，product8th 等同规则派生）
    return miguSwapSqDir(pqUrl)
      .replace(/MP3_128_16_Stero/i, 'flac')
      .replace(/\.mp3(\?|$)/, '.flac$1');
  }
  if (quality === 'hires') {
    // v1.1.0：ZQ24 = 歌曲下载目录 + flac_24bit 编码（文档 3.3 URL 派生法）；
    // 24bit 高解析独立存在性（规律⑤），必须 Range 探测。2026-09-06 实测免费歌 206/54MB 可用
    return miguSwapSqDir(pqUrl)
      .replace(/MP3_128_16_Stero/i, 'flac_24bit')
      .replace(/\.mp3(\?|$)/, '.flac$1');
  }
  // v1.2.0：ZQ32/Z3D/3D60 = 歌曲下载目录 + wav 编码（baka MIGU_TONE_PATHS 实测表）。
  // 存在性独立，必须 Range 探测；坏链由派生梯逐级降档（zq32→hires(ZQ24)→super→high）。
  if (quality === 'zq32') {
    return miguSwapSqDir(pqUrl)
      .replace(/MP3_128_16_Stero/i, 'wav_32bit')
      .replace(/\.mp3(\?|$)/, '.wav$1');
  }
  if (quality === 'atmos') {
    return miguSwapSqDir(pqUrl)
      .replace(/MP3_128_16_Stero/i, 'wav_3d')
      .replace(/\.mp3(\?|$)/, '.wav$1');
  }
  if (quality === 'atmos2') {
    return miguSwapSqDir(pqUrl)
      .replace(/MP3_128_16_Stero/i, 'wav_3d_60s')
      .replace(/\.mp3(\?|$)/, '.wav$1');
  }
  return pqUrl;
}

// [v0.7.2 fix#10] actualQuality：咪咕按最终 URL 码率特征判定（PQ 通道只有 128/320/FLAC/24bit 四档特征），
// 避免「请求 super 但上游未给 flac 特征 URL」时虚报无损。
function miguActualQuality(u) {
  var s = String(u || '');
  if (/wav_3d_60s/i.test(s)) return 'atmos_plus';
  if (/wav_3d/i.test(s)) return 'atmos';
  if (/wav_32bit/i.test(s)) return 'hires';
  if (/flac_24bit/i.test(s)) return 'flac24bit';
  if (/\.flac(\?|$)/i.test(s)) return 'flac';
  if (/MP3_320/i.test(s)) return '320k';
  return '128k';
}

// v1.1.0 修复#17：海棠备源开关（user_variables）。默认开启；读取时机为调用时（不缓存 env）。
function haitangEnabled() {
  try {
    var uv = (typeof env !== 'undefined' && env && env.getUserVariables) ? env.getUserVariables() : null;
    if (!uv) return true;
    return !(uv.allowHaitangRelay === false || String(uv.allowHaitangRelay) === 'false');
  } catch (e) { return true; }
}

// ---- 副取链（v1.4.0 起由主链降级，保留不删）：h5v2.4 加密取链。返回 PQ 基础直链，音质派生由 upgradeMiguQuality 统一处理 ----
// （v1.1.0 修复#19：海棠接力不再包在本通道内部，而是独立候选段；
//   v1.4.0：主链让位于 MIGUM2.0/v2.0/content/listen-url 明文接口，本通道为第一降级位）
function resolveMigu(raw, quality) {
  var url = 'https://c.musicapp.migu.cn/strategy/listen-url/h5/v2.4' +
    '?contentId=' + encodeURIComponent(raw.contentId) +
    '&copyrightId=' + encodeURIComponent(raw.copyrightId) +
    '&resourceType=2&netType=01&toneFlag=PQ&scene=' +
    '&lowerQualityContentId=' + encodeURIComponent(raw.contentId);
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    responseType: 'arraybuffer',
    headers: {
      birth: 'h5page', channel: '014X031',
      Referer: 'https://y.migu.cn/',
      'location-data': '30.6698676660,104.1229614820',
      'location-info': '',
      'User-Agent': miguUA()
    }
  }).then(function (res) {
    var data = decryptH5v24(new Uint8Array(res.data));
    if (!data || data.code !== '000000' || !data.data || !data.data.url) {
      throw new Error('migu no url');
    }
    var base = String(data.data.url);
    return { url: base, actualQuality: miguActualQuality(base), channel: 'h5v2.4' };
  });
}

// ---- v1.3.2 ①：z3dCode 直出（借鉴 miguMusic-api-enhanced，只借鉴思路未复制代码） ----
// listen-url v2.1 songItem.z3dCode 三个字段 2026-09-07 实测映射：
//   url/iosUrl   → 歌曲下载/alac_3d/*.m4a  iOS 3D（ALAC 容器，魔数 '79AO' 私有加密，宿主不可直接播）
//   androidUrl   → wav_3d/*.wav            Android 全曲（Z3D 私有加密容器，96B 头，待宿主解密层）
//   h5Url        → wav_3d_60s/*.wav        = 3D60 明文试听（RIFF WAV，~40s，可直接播）——
//                  注意：用户以为 h5Url 是 wav_3d 加密，实测是明文 3D60 试听档。
// 原始地址均为 ftp://218.200.160.122:21/ 前缀，替换为 https://freetyst.nf.migu.cn/ 后 206 可访问。
// 插件侧只做「直出」：把 URL 归一化并缓存，atmos=wav3d 直链、atmos_plus=3D60 试听直链；
// alac_3d 因 WebView 无法解码且加密，不作为可播音质下发，仅供宿主 _src 透传。
var Z3D_FTP_PREFIX = 'ftp://218.200.160.122:21/';
var Z3D_HTTP_PREFIX = 'https://freetyst.nf.migu.cn/';
var z3dCache = {}; // contentId -> normalizeZ3dCode 结果，容量上限 64

function z3dNormalizeUrl(u) {
  var s = str(u).replace(Z3D_FTP_PREFIX, Z3D_HTTP_PREFIX);
  // 最小编码：保留 URL 保留字符与已有 %xx（咪咕路径中文多已 percent-encoded，
  // 整段 encodeURIComponent 会把 https: 编成 https%3A 造成双重编码——实测踩过）。
  // 只对裸露的非 ASCII / 空格等非法字符补编码。
  return s.replace(/[^A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]/g, function (c) {
    return encodeURIComponent(c);
  });
}

function normalizeZ3dCode(z) {
  if (!z) return null;
  var out = {};
  var alacUrl = z3dNormalizeUrl(z.iosUrl || z.url);
  if (alacUrl) out.alac = { url: alacUrl, size: Number(z.iosSize || z.size) || 0, encrypted: true };
  var wavUrl = z3dNormalizeUrl(z.androidUrl);
  if (wavUrl) out.wav3d = { url: wavUrl, size: Number(z.androidSize) || 0, encrypted: true };
  var sampleUrl = z3dNormalizeUrl(z.h5Url);
  if (sampleUrl) out.sample = { url: sampleUrl, size: Number(z.h5Size) || 0, encrypted: false };
  return Object.keys(out).length ? out : null;
}

function cacheZ3d(contentId, z) {
  var cid = str(contentId);
  if (!cid) return;
  var n = normalizeZ3dCode(z);
  if (!n) return;
  // 容量护栏：超 64 时简单清空（低频元数据缓存，不值得 LRU）
  if (Object.keys(z3dCache).length >= 64) z3dCache = {};
  z3dCache[cid] = n;
  return n;
}

// 主动拉取 z3dCode（getMusicInfo 时歌曲未走过 listen-url 通道时的兜底）
function fetchMiguZ3dCode(contentId, copyrightId) {
  var cid = str(contentId);
  if (!cid) return Promise.reject(new Error('migu-z3d no contentId'));
  var params = { netType: '01', resourceType: '2', contentId: cid, toneFlag: 'PQ' };
  if (copyrightId) params.copyrightId = copyrightId;
  return axios.get('https://app.c.nf.migu.cn/MIGUM2.0/v2.1/content/listen-url', {
    params: params,
    timeout: RELAY_TIMEOUT,
    headers: {
      channel: '0146832', version: '7.41.13',
      Referer: 'https://app.c.nf.migu.cn/',
      'User-Agent': miguUA()
    }
  }).then(function (res) {
    var d = res.data && res.data.data && res.data.data.songItem;
    if (!d || !d.z3dCode) throw new Error('migu-z3d no z3dCode');
    var n = normalizeZ3dCode(d.z3dCode);
    if (!n) throw new Error('migu-z3d normalize failed');
    var cached = cacheZ3d(cid, d.z3dCode);
    return cached || n;
  });
}

// ==================== v1.4.0 主通道：MIGUM2.0/v2.0/content/listen-url 明文取链 ====================
// 2026-09-08 实测（probe-v20 / probe-v20-multi，3 首 VIP 歌）：
//  - 免登录 PQ 直链完整可用：晴天 4,317,311B / 孤勇者 4,097,047B / 稻香 3,577,106B。
//    dialogInfo 仍提示「会员歌曲试听中」，但 CDN Range 实测全曲（与 h5v2.4 同象，不按试听处理）；
//  - PQ 直链与 h5v2.4 同源（freetyst.nf.migu.cn），派生规则完全一致（HQ/SQ 派生 206 验证通过）；
//  - toneFlag=HQ/SQ 直请求 code=000000 但无 url（会员门禁）→ 主链固定取 PQ 基线 + 派生梯；
//  - songId 可选：实测缺省同样 000000 出链接，无 songId 条目也能走本通道；
//  - songItem 75 字段（toneControl/topQuality/z3dCode/lrcUrl/mrcUrl/trcUrl/chorusStartTime）；
//    rateFormats/newRateFormats 实测返回空——音质大小仍由搜索条目 / by-contentids 供给；
//  - toneControl 不能替代存在性探测：稻香 toneControl=111111 但 SQ 派生 404
//    （晴天 111100 SQ 反而可用）→ upgradeMiguQuality 的 Range 探测验真机制保持不变。

var V20_ITEM_TTL_MS = 30 * 60 * 1000;
var v20ItemCache = {}; // contentId -> { ts, item: songItem }，容量上限 64

function cacheV20Item(contentId, songItem) {
  var cid = str(contentId);
  if (!cid || !songItem) return null;
  // 容量护栏：超 64 时简单清空（低频元数据缓存，与 z3dCache 同策略）
  if (Object.keys(v20ItemCache).length >= 64) v20ItemCache = {};
  var rec = { ts: Date.now(), item: songItem };
  v20ItemCache[cid] = rec;
  return rec;
}

function getV20Item(contentId) {
  var cid = str(contentId);
  var rec = v20ItemCache[cid];
  if (rec && Date.now() - rec.ts < V20_ITEM_TTL_MS) return rec.item;
  if (rec) delete v20ItemCache[cid];
  return null;
}

function v20ParamsOf(raw) {
  var params = {
    netType: '00', resourceType: '2', toneFlag: 'PQ',
    copyrightId: str(raw && raw.copyrightId || ''),
    contentId: str(raw && raw.contentId || '')
  };
  // songId 可选（实测缺省同样出链接）；条目带就带上，参数更精确
  if (raw && raw.songId) params.songId = str(raw.songId);
  return params;
}

// 富字段收割：v2.0 songItem → 歌词三链 / 副歌点 / 音质元数据
function v20MetaOf(songItem) {
  if (!songItem) return null;
  return {
    lyricUrl: str(songItem.lrcUrl || ''),
    mrcUrl: str(songItem.mrcUrl || ''),
    trcUrl: str(songItem.trcUrl || songItem.trcLyricUrl || ''),
    chorusStartTime: parseInt(songItem.chorusStartTime, 10) || 0,
    toneControl: str(songItem.toneControl || ''),
    topQuality: str(songItem.topQuality || ''),
    // v1.6.0（P1-2/P2-4）：付费/别名富字段（实测晴天 vipFlag="1"/vipType="1"/songAliasName="Sunny Day"）
    vipType: songItem.vipType === undefined ? undefined : str(songItem.vipType),
    vipFlag: songItem.vipFlag === undefined ? undefined : str(songItem.vipFlag),
    songAliasName: str(songItem.songAliasName || '')
  };
}

// 主通道：v2.0 明文取链。返回 PQ 基础直链，音质派生由 upgradeMiguQuality 统一处理。
// 顺手收割 songItem 富字段：z3dCode 进 z3dCache（升级梯/宿主解密层），
// 歌词三链/副歌点进 v20ItemCache（getLyric/逐字歌词零请求直取）。
function resolveMiguV20(raw, quality) {
  return axios.get('https://c.musicapp.migu.cn/MIGUM2.0/v2.0/content/listen-url', {
    params: v20ParamsOf(raw),
    timeout: SOURCE_TIMEOUT,
    headers: {
      channel: '0140210',
      Referer: 'https://m.music.migu.cn/',
      'User-Agent': miguUA()
    }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== '000000' || !d || !d.url) {
      throw new Error('migu-v20 no url');
    }
    if (d.songItem) {
      cacheZ3d(String(raw.contentId || ''), d.songItem.z3dCode);
      cacheV20Item(raw.contentId, d.songItem);
    }
    var base = String(d.url);
    return { url: base, actualQuality: miguActualQuality(base), channel: 'listen-url-v2.0' };
  });
}

// P1-4：getMusicInfo 富字段通道——复用主通道端点，一次请求拿 songItem 75 字段
// （PQ 试听响应同样返回完整 songItem，实测晴天/孤勇者/稻香均如此）。
// 结果落 v20ItemCache/z3dCache；失败时调用方回落既有 by-contentids / jadeite 路径。
async function fetchMiguV20Item(contentId, copyrightId) {
  var cid = str(contentId);
  if (!cid) throw new Error('migu-v20 no contentId');
  var cached = getV20Item(cid);
  if (cached) return cached;
  var res = await axios.get('https://c.musicapp.migu.cn/MIGUM2.0/v2.0/content/listen-url', {
    params: v20ParamsOf({ contentId: cid, copyrightId: copyrightId }),
    timeout: RELAY_TIMEOUT,
    headers: { channel: '0140210', Referer: 'https://m.music.migu.cn/', 'User-Agent': miguUA() }
  });
  var d = res.data && res.data.data;
  if (!res.data || res.data.code !== '000000' || !d || !d.songItem) throw new Error('migu-v20 no songItem');
  cacheZ3d(cid, d.songItem.z3dCode);
  cacheV20Item(cid, d.songItem);
  return d.songItem;
}

// ---- 备选通道 A：listen-url v2.1 App 通道 ----
// 2026-09-06 实测（probe4）：VIP 歌未登录可出 PQ 全曲（晴天 4,317,311B audio/mpeg），
// h5v2.4 对 VIP 歌下发试听片段时本通道是全曲兜底。
function resolveMiguApp(raw, quality) {
  return axios.get('https://app.c.nf.migu.cn/MIGUM2.0/v2.1/content/listen-url', {
    params: { netType: '01', resourceType: '2', contentId: raw.contentId, copyrightId: raw.copyrightId, toneFlag: 'PQ' },
    timeout: RELAY_TIMEOUT,
    headers: { channel: '0146832', version: '7.41.13', Referer: 'https://app.c.nf.migu.cn/', 'User-Agent': miguUA() }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!d || !d.url) throw new Error('migu-app no url');
    // v1.3.2 ①：顺手缓存 songItem.z3dCode（有的话），供 getMusicInfo / 升级梯直出
    if (d.songItem) cacheZ3d(String(raw.contentId || ''), d.songItem.z3dCode);
    var base = String(d.url);
    return { url: base, actualQuality: miguActualQuality(base), channel: 'listen-url-v2.1' };
  });
}

// ---- 备选通道 B：listen-song/v2.3 302 跳转口 ----
// 2026-09-06 实测（probe4）：返回 302 + Location 直指 freetyst 真实 mp3（VIP 歌 PQ 全曲 4,317,311B）。
function resolveMigu305(raw, quality) {
  return axios.get('https://c.musicapp.migu.cn/strategy/listen-song/v2.3', {
    params: { toneFlag: 'PQ', copyrightId: raw.copyrightId, contentId: raw.contentId, resourceType: '2', channel: '0146921' },
    timeout: RELAY_TIMEOUT, maxRedirects: 0, validateStatus: null,
    headers: { 'User-Agent': 'okhttp/3.14.9', Referer: 'https://music.migu.cn/' }
  }).then(function (res) {
    var loc = res.headers && (res.headers.location || res.headers.Location);
    if (res.status < 300 || res.status >= 400 || !loc) {
      throw new Error('migu-305 no redirect (status ' + res.status + ')');
    }
    var base = String(loc);
    return { url: base, actualQuality: miguActualQuality(base), channel: 'listen-song-302' };
  });
}

// ---- 备选通道 C：strategy/pc/listen v2.0 加密通道 ----
// 响应解密复用 decryptH5v24（魔数/密钥一致，第三方文档 §11.6 逆向结论 + probe4 实测 PQ 解密通过）。
// ZQ 档实测返回空 url（会员门禁），故本通道仅作 PQ 备选；24bit 走派生梯。
function resolveMiguEnc(raw, quality) {
  // v1.3.2 ⑤：每请求随机 deviceId 收敛为进程级 SESSION_DEVICE_ID（会话内稳定、跨会话随机化）
  var dev = SESSION_DEVICE_ID;
  return axios.get('https://app.c.nf.migu.cn/strategy/pc/listen/v2.0', {
    params: { contentId: raw.contentId, copyrightId: raw.copyrightId, resourceType: '2', netType: '01', toneFlag: 'PQ', scene: '', pacmtoken: '' },
    timeout: RELAY_TIMEOUT, responseType: 'arraybuffer',
    headers: {
      channel: '014X031', subchannel: '014X031', ua: 'Android_migu', version: '6.8.8',
      activityId: 'MUSIC-WWW', birth: 'h5page', signature: '1',
      timestamp: String(Date.now()), deviceId: dev,
      Referer: 'https://music.migu.cn/', 'User-Agent': miguUA()
    }
  }).then(function (res) {
    var data = decryptH5v24(new Uint8Array(res.data));
    if (!data || !data.data || !data.data.url) throw new Error('migu-enc no url');
    var base = String(data.data.url);
    return { url: base, actualQuality: miguActualQuality(base), channel: 'pc-listen-v2.0' };
  });
}

// ---- 无损/Hi-Res 备源段：海棠 mg（第三方接口；user_variables 可关，独立候选段）----
function resolveHaitangMigu(raw, quality) {
  return resolveHaitang('mg', raw.contentId, quality).then(function (r) {
    r.channel = 'haitang-mg';
    return r;
  });
}

// ---- Range 存在性探测（v1.1.0 修复#2）：SQ/ZQ24 派生链接验真，坏链不进播放器 ----
// v1.5.0：升级为返回探测到的文件总字节数（content-range 总长；无 content-range 时
// 200 整文件响应用 content-length；均缺失返回 1 仅作存在性真值），供 SQ 派生梯做
// 「<5MB 判为非真无损 → 酷我兜底」判据。既有调用点均为真值判断，语义兼容。
function probeMiguExists(url) {
  return axios.get(url, {
    timeout: 2500,
    headers: { Range: 'bytes=0-0', Referer: 'https://music.migu.cn/' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    var headers = res.headers || {};
    if (res.status === 206) {
      var cr = headers['content-range'] || headers['Content-Range'];
      var mm = cr && String(cr).match(/\/(\d+)\s*$/);
      return mm ? (parseInt(mm[1], 10) || 1) : 1;
    }
    if (res.status === 200 && !/text\/html/i.test(String(headers['content-type'] || headers['Content-Type'] || ''))) {
      var cl = headers['content-length'] || headers['Content-Length'];
      return parseInt(cl, 10) || 1;
    }
    throw new Error('probe http ' + res.status);
  });
}

// ==================== v1.5.0 跨源兜底：SQ 派生失败 → 酷我官方接口无损 ====================
// 触发条件：SQ 派生链接 Range 探测 404，或产物 <5MB（判为非真无损）。
// 链路：曲名+歌手搜酷我（searchMusicBykeyWord，isSameSong 同曲校验含版本标签/±6s 容差）
// → rid 映射 → mobi.s convert_url_with_sign 2000kflac 三域名竞速（nmobi / nmsublist / mobi 车载，
// 与酷我独立源插件 kwOfficialResolve 同构：format 非 flac / duration<60s 试听片段一律拒收）。
// 兜底整体预算 KUWO_FB_BUDGET_MS，超时/失败向上抛，由调用方维持原有「降档 HQ」语义。
// 降级优先级遵循聚合规则：酷我 → 咪咕 → 网易云 → 汽水 → 酷狗 → QQ（酷我为咪咕失败后首选）。
var MIGU_SQ_MIN_LOSSLESS_BYTES = 5 * 1024 * 1024; // SQ 产物 <5MB 判为非真无损
var KUWO_FB_BUDGET_MS = 3800;                     // 酷我兜底整体预算（含搜索+取链竞速）

function kwFbRandUser() {
  var pool = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
  for (var i = 0; i < 16; i++) s += pool.charAt(Math.floor(Math.random() * pool.length));
  return s;
}

// 曲名+歌手搜酷我映射 rid：两段式同曲校验——
// ① isSameSong 严格校验（版本硬判据 + 时长 ±6s 容差 / 缺时长需专辑一致）；
// ② 回退校验（仅当 musicItem 自身无时长时启用）：标题（含宽松键/版本兼容）+ 歌手一致即命中。
// 背景：咪咕 search_all.do 条目不返回时长（duration=0），而专辑名跨平台常不一致，
// 严格校验会整单拒绝导致兜底永远失活；回退校验仍保留版本互斥与歌手硬判据，误配风险可控。
function kwFbSearchRid(musicItem) {
  var query = (str(musicItem && musicItem.title) + ' ' + str(musicItem && musicItem.artist)).trim();
  if (!query) return Promise.reject(new Error('kuwo-fb: no query'));
  var needLooseMatch = !(musicItem && parseInt(musicItem.duration, 10) > 0);
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      all: query, pn: 0, rn: 20, ft: 'music', client: 'kt', encoding: 'utf8',
      rformat: 'json', mobi: 1, vipver: 1, cluster: 0, strategy: 2012, issubtitle: 1,
      show_copyright_off: 1, correct: 1, spPrivilege: 0, newver: 2, p2p: 1,
      notrace: 0, searchapi: 2, vermerge: 1
    },
    timeout: RELAY_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var list = (res.data && res.data.abslist) || [];
    var looseRid = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var rid = str(it.MUSICRID).replace(/^MUSIC_/, '');
      var title = str(it.NAME || it.SONGNAME);
      if (!rid || !title) continue;
      var cand = {
        title: title,
        artist: str(it.ARTIST),
        album: str(it.ALBUM),
        duration: parseInt(it.DURATION, 10) || 0
      };
      if (isSameSong(cand, musicItem)) return rid;
      if (needLooseMatch && !looseRid &&
          looseTitleKey(cand.title) === looseTitleKey(String(musicItem.title || '')) &&
          normalizeArtist(cand.artist) === normalizeArtist(String(musicItem.artist || '')) &&
          versionCompatible(parseVersionTags(cand.title), parseVersionTags(String(musicItem.title || '')))) {
        looseRid = rid;
      }
    }
    if (looseRid) return looseRid;
    throw new Error('kuwo-fb: 无同曲命中');
  });
}

// 酷我官方 convert_url_with_sign 无损直链（与酷我独立源 kwOfficialResolve super 档同构）：
// nmobi/nmsublist 同构双域名 + mobi 免签车载；请求 2000kflac 必须回 format=flac（防静默降级），
// duration<60s 试听片段拒收。
function kwFbOfficialResolve(host, rid, variant) {
  var params;
  if (variant === 'sublist') {
    params = { f: 'web', type: 'convert_url_with_sign', rid: rid, br: '2000kflac', user: kwFbRandUser(), source: 'kwplayer_ar_8.5.5.0_keluze.apk' };
  } else if (variant === 'car') {
    params = { f: 'web', type: 'convert_url_with_sign', br: '2000kflac', rid: rid, user: 'C_APK_guanwang_' + Date.now(), source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC' };
  } else {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: '2000kflac', rid: rid,
      user: 0, android_id: 0, prod: 'kwplayerhd_ar_4.3.0.8', corp: 'kuwo',
      vipver: '4.3.0.8', source: 'kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk',
      notrace: 0, sig: 0, priority: 'bitrate', loginUid: 0, network: 'WIFI',
      loginSid: 0, mode: 'down'
    };
  }
  return axios.get('https://' + host + '/mobi.s', {
    params: params,
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo-fb: no url');
    if (d.format && d.format !== 'flac') throw new Error('kuwo-fb: format degraded ' + d.format);
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo-fb: trial snippet');
    return String(d.url);
  });
}

// 多候选竞速器：第一个 fulfilled 胜出，全部 rejected 才整体失败
function raceSuccessFb(promises) {
  return new Promise(function (resolve, reject) {
    var pending = promises.length;
    if (!pending) { reject(new Error('kuwo-fb: race empty')); return; }
    var settled = false;
    var onFail = function () {
      pending -= 1;
      if (pending <= 0 && !settled) { settled = true; reject(new Error('kuwo-fb: race all failed')); }
    };
    for (var i = 0; i < promises.length; i++) {
      promises[i].then(function (v) {
        if (!settled) { settled = true; resolve(v); }
      }, onFail);
    }
  });
}

// 酷我无损兜底主入口：搜索映射 rid → 三域名竞速 → 结果按宿主协议标注
// （channel 携带 kuwoFallback 标记，resolveWithFallback 据此保留真实通道溯源）
function kwFallbackLossless(musicItem) {
  return kwFbSearchRid(musicItem).then(function (rid) {
    return raceSuccessFb([
      kwFbOfficialResolve('nmobi.kuwo.cn', rid),
      kwFbOfficialResolve('nmsublist.kuwo.cn', rid, 'sublist'),
      kwFbOfficialResolve('mobi.kuwo.cn', rid, 'car')
    ]).then(function (url) {
      return {
        url: url,
        actualQuality: 'flac',
        quality: 'flac',
        channel: 'kuwo-fallback:mobi.s-2000kflac',
        kuwoFallback: true,
        // [v1.6.1] 兜底歌词登记标记：实际播放为酷我源音频，歌词/逐字歌词应切酷我源
        //（resolveWithFallback 胜出点据此登记；咪咕自身通道胜出时无此标记即清除）
        fbLyricRaw: { source: 'kuwo', raw: { rid: rid } }
      };
    });
  });
}

// ---- 音质派生梯：standard→atmos_plus 逐级验真；SQ/ZQ24/ZQ32/3D 坏链自动降档，actualQuality 如实标注 ----
// HQ 依文档 3.3 规律①（HQ 与 PQ 同路径必存在）免探测。
// v1.3.2 ①：新增第三参 z3d（normalizeZ3dCode 结果）——atmos/atmos2 优先用 z3dCode 直链
// （wav_3d 加密容器对 atmos 档实测可达 206，但宿主 WebView 无法解码加密流，故 atmos 直链
//  仅在真实探测通过时标注 z3dDirect:true 交宿主决策；atmos_plus 用明文 3D60 试听可直出）。
async function upgradeMiguQuality(pqUrl, quality, z3d, musicItem) {
  if (quality === 'standard') {
    return { url: pqUrl, actualQuality: miguActualQuality(pqUrl) };
  }
  if (quality === 'high') {
    var u1 = deriveMiguUrl(pqUrl, 'high');
    return { url: u1, actualQuality: miguActualQuality(u1) };
  }
  if (quality === 'super') {
    var u2 = deriveMiguUrl(pqUrl, 'super');
    // v1.5.0：探测升级为取文件总长——404 或产物 <5MB（虚标无损/派生目录猜错，多为
    // ringmaker/product05 等老批次与派生规则外路径）均视为派生失败，触发酷我兜底
    var u2Size = 0;
    try {
      u2Size = await probeMiguExists(u2);
    } catch (e) { u2Size = 0; }
    if (u2Size >= MIGU_SQ_MIN_LOSSLESS_BYTES) {
      return { url: u2, actualQuality: 'flac' };
    }
    // 跨源降级（优先级：酷我 → 咪咕 → 网易云 → 汽水 → 酷狗 → QQ，咪咕失败后首选酷我）：
    // 曲名+歌手搜酷我映射 rid → 官方 mobi.s 2000kflac 竞速取无损；失败维持原降档 HQ
    try {
      return await withTimeout(kwFallbackLossless(musicItem), KUWO_FB_BUDGET_MS, 'kuwo-fb 超时');
    } catch (efb) { /* 兜底失败，降档 HQ */ }
    var u2b = deriveMiguUrl(pqUrl, 'high'); // 单源版降级即回落 HQ
    return { url: u2b, actualQuality: miguActualQuality(u2b) };
  }
  // v1.2.0：zq32 梯（wav_32bit → flac_24bit → flac → HQ），对齐 baka MIGU_QUALITY_FALLBACKS.hires
  if (quality === 'zq32') {
    var uZ32 = deriveMiguUrl(pqUrl, 'zq32');
    try {
      await probeMiguExists(uZ32);
      return { url: uZ32, actualQuality: 'hires' };
    } catch (ez) { /* 降级继续 */ }
    var uZ24 = deriveMiguUrl(pqUrl, 'hires');
    try {
      await probeMiguExists(uZ24);
      return { url: uZ24, actualQuality: 'flac24bit' };
    } catch (ez2) { /* 降级继续 */ }
    var uZs = deriveMiguUrl(pqUrl, 'super');
    try {
      await probeMiguExists(uZs);
      return { url: uZs, actualQuality: 'flac' };
    } catch (ez3) { /* 降级继续 */ }
    var uZh = deriveMiguUrl(pqUrl, 'high');
    return { url: uZh, actualQuality: miguActualQuality(uZh) };
  }
  // v1.2.0：atmos 梯（wav_3d → wav_32bit → flac_24bit → HQ）
  if (quality === 'atmos') {
    // v1.3.2 ①：z3dCode androidUrl（wav_3d 全曲）直链优先——与派生梯同文件，
    // 但 URL 由接口直出、免目录派生猜错目录的风险。仍要求探测 206 才采用。
    if (z3d && z3d.wav3d && z3d.wav3d.url) {
      try {
        await probeMiguExists(z3d.wav3d.url);
        return { url: z3d.wav3d.url, actualQuality: 'atmos', z3dDirect: true };
      } catch (ez3a) { /* 直链探测失败，走派生梯 */ }
    }
    var uA1 = deriveMiguUrl(pqUrl, 'atmos');
    try {
      await probeMiguExists(uA1);
      return { url: uA1, actualQuality: 'atmos' };
    } catch (ea) { /* 降级继续 */ }
    var uA2 = deriveMiguUrl(pqUrl, 'zq32');
    try {
      await probeMiguExists(uA2);
      return { url: uA2, actualQuality: 'hires' };
    } catch (ea2) { /* 降级继续 */ }
    var uA3 = deriveMiguUrl(pqUrl, 'high');
    return { url: uA3, actualQuality: miguActualQuality(uA3) };
  }
  // v1.2.0：atmos_plus 梯（wav_3d_60s → wav_3d → HQ）
  if (quality === 'atmos2') {
    // v1.3.2 ①：z3dCode h5Url（wav_3d_60s = 3D60 明文试听）直链优先，明文 WAV 可直接播
    if (z3d && z3d.sample && z3d.sample.url) {
      try {
        await probeMiguExists(z3d.sample.url);
        return { url: z3d.sample.url, actualQuality: 'atmos_plus', z3dDirect: true };
      } catch (ez3b) { /* 直链探测失败，走派生梯 */ }
    }
    var uAp1 = deriveMiguUrl(pqUrl, 'atmos2');
    try {
      await probeMiguExists(uAp1);
      return { url: uAp1, actualQuality: 'atmos_plus' };
    } catch (eap) { /* 降级继续 */ }
    var uAp2 = deriveMiguUrl(pqUrl, 'atmos');
    try {
      await probeMiguExists(uAp2);
      return { url: uAp2, actualQuality: 'atmos' };
    } catch (eap2) { /* 降级继续 */ }
    var uAp3 = deriveMiguUrl(pqUrl, 'high');
    return { url: uAp3, actualQuality: miguActualQuality(uAp3) };
  }
  // hires：ZQ24 → SQ → HQ 逐级降（ZQ24/SQ 存在性独立，规律⑤/③）
  var u3 = deriveMiguUrl(pqUrl, 'hires');
  try {
    await probeMiguExists(u3);
    return { url: u3, actualQuality: 'flac24bit' };
  } catch (e3) { /* 降级继续 */ }
  var u4 = deriveMiguUrl(pqUrl, 'super');
  try {
    await probeMiguExists(u4);
    return { url: u4, actualQuality: 'flac' };
  } catch (e4) { /* 降级继续 */ }
  var u5 = deriveMiguUrl(pqUrl, 'high');
  return { url: u5, actualQuality: miguActualQuality(u5) };
}

// ---- 失败负缓存（v1.1.0 优化#12）：同曲同档全链失败后 180s 内直接复用失败结论，防反复打爆上游 ----
var NEG_TTL_MS = 180 * 1000;
var negCache = {};
function negKey(raw, quality) { return str(raw && raw.contentId) + '|' + quality; }
function negCheck(raw, quality) {
  var hit = negCache[negKey(raw, quality)];
  if (hit && Date.now() - hit.ts < NEG_TTL_MS) return hit.err;
  if (hit) delete negCache[negKey(raw, quality)];
  return null;
}
function negSet(raw, quality, err) {
  negCache[negKey(raw, quality)] = { ts: Date.now(), err: err };
  var keys = Object.keys(negCache);
  if (keys.length > 64) {
    for (var i = 0; i < keys.length; i++) {
      var e = negCache[keys[i]];
      if (!e || Date.now() - e.ts >= NEG_TTL_MS) delete negCache[keys[i]];
    }
  }
}

// 候选通道链（v1.1.0 修复#19：海棠独立成候选段，不再被首段超时罩住）：
// v1.4.0：主链切 MIGUM2.0/v2.0/content/listen-url 明文接口（免解密 + 富字段收割），
// h5v2.4 保留为副取链（第一降级位，不删除），v2.0 失败按序降级：
// v2.0 明文 → h5v2.4 加密 → listen-url v2.1 →（super/hires 且开关开启：海棠 mg）→ 302 跳转口 → pc-listen v2.0
function channelCandidates(quality) {
  var chain = ['migu~v20', 'migu', 'migu~app'];
  if ((quality === 'super' || quality === 'hires') && haitangEnabled()) chain.push('migu~ht');
  chain.push('migu~305', 'migu~enc');
  return chain;
}

var RESOLVE_ADAPTERS = {
  'migu~v20': resolveMiguV20,
  migu: resolveMigu,
  'migu~app': resolveMiguApp,
  'migu~ht': resolveHaitangMigu,
  'migu~305': resolveMigu305,
  'migu~enc': resolveMiguEnc
};

// v1.1.0：多源能力路由 pickCandidates 随通道化重构移除——候选顺序改由
// channelCandidates(quality) 按「咪咕官方通道优先、备源殿后」静态编排。

// v0.7.1 P1-5 + v1.1.0 优化#16：返回媒体 URL 协议/域名白名单校验。
// http 仅放行咪咕官方 CDN 域名后缀；https 做基础校验——拒绝 IP 直连与单标签主机
// （内网地址/劫持改写常见特征），域名媒体源（freetyst.nf.migu.cn / freevod.nf.migu.cn / 海棠）不受影响。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.migu\.cn$/i, /\.msstatic\.com$/i // 咪咕官方 CDN
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  if (!host || host.indexOf('.') < 0) return false; // IP 直连 / 单标签主机一律拒绝
  if (/^https:\/\//i.test(s)) return true; // https 域名放行（咪咕/海棠均为 https 域名媒体源）
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

// v1.3.2 ④：strategy/pc/can-listen/v1.0 批量可播预检（借鉴 miguMusic-api-enhanced，只借鉴思路未复制代码）。
// ⚠️ 实测口径（2026-09-07，晴天 contentId=600902000006889366）：canListen=false + limitLength=true
// 但匿名通道仍能取到 PQ 全曲——canListen=false ≠ 不可播！本结果只作取链全败时的
// 诊断参考数据（判断是版权问题还是链路问题），绝不作为播放门禁。
function canListenImpl(contentIds) {
  var ids = (Array.isArray(contentIds) ? contentIds : [contentIds])
    .map(function (v) { return str(v); }).filter(function (v) { return v; });
  if (!ids.length) return Promise.reject(new Error('can-listen: no contentId'));
  return axios.post('https://app.c.nf.migu.cn/strategy/pc/can-listen/v1.0', {
    contentIds: ids.join(',')
  }, {
    timeout: RELAY_TIMEOUT,
    headers: { 'Content-Type': 'application/json', channel: '014X031', 'User-Agent': miguUA() }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = d && d.canListenRespItemList;
    if (!Array.isArray(list)) throw new Error('can-listen: bad response');
    var map = {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      map[str(it.contentId)] = { canListen: !!it.canListen, limitLength: !!it.limitLength };
    }
    return map;
  });
}

// v1.1.0 修复#2/优化#13：通道化取链主链路。
// 候选顺序由 channelCandidates(quality) 静态编排：咪咕官方通道优先、海棠备源殿后；
// 官方通道返回 PQ 基线后统一走 upgradeMiguQuality（HQ 规则①免探测派生、SQ/ZQ24 派生+存在性探测，
// 坏链自动降级——单源版没有其他源可接力，必须在派生层内自降）；结果携带 channel 字段溯源；
// 全通道失败落 180s 负缓存（优化#12），同曲同档在 TTL 内直接拒绝不再空烧预算。
function resolveWithFallback(musicItem, quality) {
  var srcMap = musicItem._src || {};
  var raw = srcMap.migu || null;
  if (!raw) {
    for (var k in srcMap) { if (srcMap[k]) { raw = srcMap[k]; break; } }
  }
  if (!raw || !(raw.contentId || raw.copyrightId)) {
    return Promise.reject(new Error('咪咕取链失败：条目缺少 contentId/copyrightId'));
  }
  var negErr = negCheck(raw, quality);
  if (negErr) return Promise.reject(new Error(negErr));
  var tries = channelCandidates(quality);
  // 全局超时预算：deadline 8s 内：首段 ≤SOURCE_TIMEOUT，接力段 ≤RELAY_TIMEOUT，
  // 每段进入前检查剩余时间，不足 500ms 直接失败——保证整体可预期地在宿主 10s 预算内给出结果。
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  var attempt = function (idx) {
    if (idx >= tries.length) {
      // v1.3.2 ④：全败时附 can-listen 预检诊断（不阻塞失败路径本身，仅延长失败信息组装；
      // canListen=false 不等于不可播，仅作参考数据，绝不作播放门禁）
      return new Promise(function (_, rej) {
        var totalFail = '咪咕取链失败：所有通道均未取得播放链接';
        var finalize = function () { negSet(raw, quality, totalFail); rej(new Error(totalFail)); };
        canListenImpl(raw.contentId ? [str(raw.contentId)] : []).catch(function () { return null; })
          .then(function (cl) {
            var info = cl && cl[str(raw.contentId)];
            if (info) {
              if (!info.canListen && info.limitLength) {
                totalFail += '（can-listen 预检：VIP/版权受限曲目，可尝试试听片段）';
              } else if (!info.canListen) {
                totalFail += '（can-listen 预检：该曲无可播版权）';
              } else {
                totalFail += '（can-listen 预检：该曲可播，疑为链路故障）';
              }
            }
            finalize();
          });
      });
    }
    var remain = deadline - Date.now();
    if (remain <= 500) {
      var budgetFail = '咪咕取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms';
      negSet(raw, quality, budgetFail);
      return Promise.reject(new Error(budgetFail));
    }
    var source = tries[idx];
    var adapter = RESOLVE_ADAPTERS[source];
    if (!adapter) return attempt(idx + 1);
    var segTimeout = idx === 0 ? SOURCE_TIMEOUT : RELAY_TIMEOUT;
    if (segTimeout > remain) segTimeout = remain;
    return withTimeout(adapter(raw, quality, musicItem), segTimeout, source + ' 取链超时 ' + segTimeout + 'ms').then(function (r) {
      // v0.7.1 P1-5：返回 URL 协议/域名白名单校验，不通过视为该通道失败、继续接力
      if (!isAllowedMediaUrl(r && r.url)) {
        throw new Error(source + ' 返回 URL 未通过协议/域名校验');
      }
      if (source === 'migu~ht') {
        // v1.2.0：返回值补宿主协议 quality 字段（与 actualQuality 同步标注）
        if (r && r.actualQuality && !r.quality) r.quality = r.actualQuality;
        return r; // 海棠备源直链不参与咪咕派生
      }
      // 咪咕官方通道拿到 PQ 基线后按目标档位派生升级（探测失败自动降级到低档，不换通道）
      var ladderBudget = deadline - Date.now();
      if (ladderBudget <= 500) throw new Error('咪咕取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (ladderBudget > 5500) ladderBudget = 5500;
      // v1.3.2 ①：升级梯带上 z3dCode 直链候选（resolveMiguApp 通道已顺手缓存）
      var z3dCand = (raw && raw.contentId && z3dCache[str(raw.contentId)]) || null;
      // v1.5.0：升级梯带上 musicItem（SQ 派生失败时酷我兜底需曲名/歌手搜索映射 rid）
      return withTimeout(upgradeMiguQuality(r.url, quality, z3dCand, musicItem), ladderBudget, '画质升级超时').then(function (up) {
        // 优化#13：channel 标注最终生效的真实通道
        // v1.5.0：酷我兜底结果自带 channel（kuwo-fallback:*），保留真实溯源不覆盖
        if (!(up && up.kuwoFallback && up.channel)) up.channel = r.channel || source;
        // v1.2.0：返回值补宿主协议 quality 字段（与 actualQuality 同步标注）
        if (up && up.actualQuality && !up.quality) up.quality = up.actualQuality;
        return up;
      });
    }).then(function (r) {
      // 兜底守卫：适配器/派生层漏判的试听片段与坏链在这里被内容探测拦下并继续接力
      var guardBudget = deadline - Date.now();
      if (guardBudget <= 500) throw new Error('咪咕取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(guardFullAudio(r.url, musicItem), guardBudget, 'guard 超时').then(function () {
        // v1.6.0（P1-2）-> v1.9.5：fee（VIP 标识）停写，取链结果不再携带 fee 字段。
        // [v1.6.1] 胜出点登记/清除兜底歌词标记（竞速安全：仅真正胜出的结果登记；
        // 咪咕自身通道/海棠同源备源胜出即清除，避免陈旧标记把歌词切到错误的源）
        if (r && r.fbLyricRaw) markFbLyricSource(musicItem, r.fbLyricRaw.source, r.fbLyricRaw.raw);
        else clearFbLyricSource(musicItem);
        return r;
      });
    }).catch(function () {
      return attempt(idx + 1);
    });
  };
  return attempt(0);
}

/**
 * 试听片段兜底守卫（v1.1.0 修复#2/#18 重做）：
 * Range 探测 audio 文件总长，按编码估算时长——flac≈1Mbps、MP3_320≈384kbps、
 * 其余按 128kbps（高码率文件会被高估时长，不会误杀完整文件），
 * 估算时长 < 标称时长 60% 判为试听片段。仅标称时长 >=60s 时启用估算。
 * 修复#2：HTTP >=400（403/404 坏链）必须向上抛出换通道——v1.0.0 的 catch
 * 把这类失败当「探测自身失败」吞掉，导致坏链直通播放器且单源版无法降级。
 * 探测请求自身网络失败（Range 不支持/超时，无 response）不惩罚源，放行由播放器处理。
 */
function guardFullAudio(url, musicItem) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-0' },
    validateStatus: null,
    responseType: 'arraybuffer'
  }).then(function (res) {
    // 修复#2：4xx/5xx 都是坏链，按探测失败向上抛（resolveWithFallback 换通道）
    if (res.status >= 400) {
      throw new Error('guard: probe http ' + res.status);
    }
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
    var dur = musicItem && parseInt(musicItem.duration, 10) || 0;
    if (total > 0 && dur >= 60) {
      // 修复#18：按编码感知码率估算，避免 flac 被按 128kbps 估算而误判成试听片段
      var bps = /\.flac/i.test(url) ? 125000 : (/MP3_320/i.test(url) ? 48000 : 16000);
      var est = total / bps;
      if (est < dur * 0.6) {
        throw new Error('guard: trial clip ~' + Math.round(est) + 's/' + dur + 's');
      }
    }
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    if (e && e.response && e.response.status) {
      // validateStatus 放行外的 axios 层拒绝：同样按探测失败向上抛
      throw new Error('guard: probe http ' + e.response.status);
    }
    // 探测请求本身失败：不拦，放行
  });
}

// ==================== 咪咕歌词适配 ====================
// 端点经 2026-09-05 探针实测（artifacts/lyric-probe/probe-result.json），无猜测 URL。
// 咪咕：搜索/歌单条目自带歌词直链（lyricUrl，d.musicapp.migu.cn，需 Referer）。
//
// v0.7.0：歌词单源超时压到 3s（LYRIC_TIMEOUT），原生源优先、最多接力 3 源，
// 最坏 ~9s，避免顶到 10s 沙箱上限（单平台版仅 1 源，机制保留）。
var LYRIC_TIMEOUT = 3000;

// v1.1.0 修复#9/#4：by-contentids v2.0 元数据兜底。
// 实测（2026-09-06 probe-mrc5）：搜索/榜单/歌单条目 lyricUrl 大多有值但偶缺，mrcUrl 基本不带；
// by-contentids 稳定返回 lrcUrl + mrcUrl + img1/singerList/duration——
// 非搜索入口（榜单/歌单/专辑/歌手）条目缺歌词时全靠它补齐。
function fetchMiguSongMeta(contentId) {
  return axios.get('https://c.musicapp.migu.cn/MIGUM3.0/resource/song/by-contentids/v2.0', {
    params: { contentId: contentId },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://music.migu.cn/', 'User-Agent': miguUA() }
  }).then(function (res) {
    var item = res.data && res.data.data && res.data.data[0];
    if (!item) throw new Error('by-contentids 无数据');
    return {
      lyricUrl: str(item.lrcUrl || item.lyricUrl || ''),
      mrcUrl: str(item.mrcUrl || ''),
      trcUrl: str(item.trcUrl || item.trcLyricUrl || ''),
      artwork: str(item.img1 || ''),
      singerList: item.singerList || null,
      songName: str(item.songName || ''),
      duration: parseInt(item.duration, 10) || 0,
      // v1.3.0（P0）：by-contentids 条目实测稳定返回 audioFormats[].asize/isize
      // （2026-09-07 实测），getMusicInfo 回填 qualities 的主提取通道
      qualities: miguQualitiesFromEntry(item)
    };
  });
}

// ==================== MRC 逐字歌词 TEA 解密（v1.2.0，移植自 baka v1.3.1）====================
// mrc（application/marc）为 64bit TEA 变体加密；输入为 mrcUrl 返回的 hex 原文，
// 输出 utf16le 文本：[start,dur] 行时间 + (start,dur) 字时间 → 标准 LRC + LX 逐字 LRC。
// 注：BigInt 用法与 baka 一致（宿主运行时已验证支持）；ES8 兼容约束针对 ?. / ?? 语法。
var MRC_DELTA = 2654435769n;
var MRC_MIN_LENGTH = 32;
var MRC_MAX = 9223372036854775807n;
var MRC_MIN = -9223372036854775808n;
var MRC_KEY_ARR = [
  27303562373562475n,
  18014862372307051n,
  22799692160172081n,
  34058940340699235n,
  30962724186095721n,
  27303523720101991n,
  27303523720101998n,
  31244139033526382n,
  28992395054481524n
];
var MRC_REGEXPS = {
  lineTime: /^\s*\[(\d+),\d+\]/,
  wordTime: /\(\d+,\d+\)/,
  wordTimeAll: /(\(\d+,\d+\))/g
};

// 64bit 环绕归一（hex 字符串或 BigInt 入参）
function mrcToLong(v) {
  var num = typeof v === 'string' ? BigInt('0x' + v) : v;
  if (num > MRC_MAX) return mrcToLong(num - (1n << 64n));
  if (num < MRC_MIN) return mrcToLong(num + (1n << 64n));
  return num;
}

// hex 文本 → 64bit 分组数组（每组 16 个 hex 字符）
function mrcToBigintArray(data) {
  var length = Math.floor(data.length / 16);
  var arr = new Array(length);
  for (var i = 0; i < length; i++) {
    arr[i] = mrcToLong(data.substring(i * 16, i * 16 + 16));
  }
  return arr;
}

function mrcLongToBytes(l) {
  var result = new Uint8Array(8);
  for (var i = 0; i < 8; i++) {
    result[i] = Number(l & 0xffn);
    l >>= 8n;
  }
  return result;
}

function mrcLongArrToString(data) {
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var bytes = mrcLongToBytes(data[i]);
    // ES5 安全的 utf16le 解码（不依赖 Buffer）
    var units = [];
    for (var j = 0; j < bytes.length; j += 2) {
      units.push(bytes[j] | (bytes[j + 1] << 8));
    }
    try {
      out.push(decodeURIComponent(escape(String.fromCharCode.apply(null, units))));
    } catch (e) {
      out.push(String.fromCharCode.apply(null, units));
    }
  }
  return out.join('');
}

// TEA-XOR 解密（baka teaDecrypt 原逻辑，64bit 环绕）
function mrcTeaDecrypt(data, key) {
  var length = data.length;
  var lengthBigint = BigInt(length);
  if (length >= 1) {
    var j2 = data[0];
    var j3 = mrcToLong((6n + 52n / lengthBigint) * MRC_DELTA);
    while (true) {
      var j4 = j3;
      if (j4 === 0n) break;
      var j5 = mrcToLong(3n & mrcToLong(j4 >> 2n));
      var j6 = lengthBigint;
      while (true) {
        j6--;
        if (j6 > 0n) {
          var j7 = data[j6 - 1n];
          var i = j6;
          j2 = mrcToLong(
            data[i] -
              (mrcToLong(mrcToLong(j2 ^ j4) + mrcToLong(j7 ^ key[mrcToLong(mrcToLong(3n & j6) ^ j5)])) ^
                mrcToLong(
                  mrcToLong(mrcToLong(j7 >> 5n) ^ mrcToLong(j2 << 2n)) +
                    mrcToLong(mrcToLong(j2 >> 3n) ^ mrcToLong(j7 << 4n))
                ))
          );
          data[i] = j2;
        } else break;
      }
      var j8 = data[lengthBigint - 1n];
      j2 = mrcToLong(
        data[0n] -
          mrcToLong(
            mrcToLong(mrcToLong(key[mrcToLong(mrcToLong(j6 & 3n) ^ j5)] ^ j8) + mrcToLong(j2 ^ j4)) ^
              mrcToLong(
                mrcToLong(mrcToLong(j8 >> 5n) ^ mrcToLong(j2 << 2n)) +
                  mrcToLong(mrcToLong(j2 >> 3n) ^ mrcToLong(j8 << 4n))
              )
          )
      );
      data[0] = j2;
      j3 = mrcToLong(j4 - MRC_DELTA);
    }
  }
  return data;
}

// mrc hex 原文 → 明文逐字歌词文本；失败返回 null
function decryptMrc(data) {
  if (data == null || data.length < MRC_MIN_LENGTH) return data;
  try {
    return mrcLongArrToString(mrcTeaDecrypt(mrcToBigintArray(data), MRC_KEY_ARR));
  } catch (error) {
    return null;
  }
}

// mrc 明文 → { lyric: LRC, lxlyric: LX 逐字 LRC }
function parseMrc(s) {
  if (!s) return null;
  try {
    s = s.replace(/\r/g, '');
    var lines = s.split('\n');
    var lxlrcLines = [];
    var lrcLines = [];
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (line.length < 6) continue;
      var result = MRC_REGEXPS.lineTime.exec(line);
      if (!result) continue;
      var startTime = parseInt(result[1], 10);
      var time = startTime;
      var ms = time % 1000;
      time /= 1000;
      var mm = parseInt(time / 60, 10).toString();
      if (mm.length < 2) mm = '0' + mm;
      time %= 60;
      var ss = parseInt(time, 10).toString();
      if (ss.length < 2) ss = '0' + ss;
      var stamp = mm + ':' + ss + '.' + ms;

      var words = line.replace(MRC_REGEXPS.lineTime, '');
      lrcLines.push('[' + stamp + ']' + words.replace(MRC_REGEXPS.wordTimeAll, ''));

      var times = words.match(MRC_REGEXPS.wordTimeAll);
      if (!times) continue;
      var offsets = [];
      for (var ti = 0; ti < times.length; ti++) {
        var rm = /\((\d+),(\d+)\)/.exec(times[ti]);
        offsets.push('<' + (parseInt(rm[1], 10) - startTime) + ',' + rm[2] + '>');
      }
      var wordArr = words.split(MRC_REGEXPS.wordTime);
      var newWords = '';
      for (var wi = 0; wi < offsets.length; wi++) {
        newWords += offsets[wi] + (wordArr[wi] || '');
      }
      lxlrcLines.push('[' + stamp + ']' + newWords);
    }
    return { lyric: lrcLines.join('\n'), lxlyric: lxlrcLines.join('\n') };
  } catch (error) {
    return null;
  }
}

// v1.2.0：mrc（application/marc）为 64bit TEA 变体加密，见上方 decryptMrc/parseMrc（移植自 baka v1.3.1）
async function getWordByWordLyricImpl(musicItem) {
  // [v1.6.1] 跨源兜底逐字歌词同步：登记命中时优先按兜底源（酷我）取逐字歌词（lrcx→酷狗 KRC 接力），失败回落原生源
  var fbHit = getFbLyricSource(musicItem);
  if (fbHit && fbHit.source === 'kuwo') {
    try { return await fetchKuwoFbWordLyric(fbHit.raw.rid, musicItem); } catch (efb) { /* 兜底源逐字失败，回落原生源 */ }
  }
  var srcMap = musicItem && musicItem._src || {};
  var raw = srcMap.migu;
  if (!raw) { for (var k in srcMap) { if (srcMap[k]) { raw = srcMap[k]; break; } } }
  if (!raw || !(raw.contentId || raw.copyrightId)) throw new Error('该条目无咪咕音源信息，无法取逐字歌词');
  var mrcUrl = str(raw.mrcUrl || '');
  if (!mrcUrl && raw.contentId) {
    // v1.4.0（P1-5）：v2.0 songItem 缓存 mrcUrl 零请求直取
    var v20Mrc = getV20Item(raw.contentId);
    if (v20Mrc && v20Mrc.mrcUrl) mrcUrl = str(v20Mrc.mrcUrl);
  }
  if (!mrcUrl) {
    try {
      var meta = await fetchMiguSongMeta(raw.contentId || raw.copyrightId);
      mrcUrl = meta.mrcUrl;
    } catch (e) { /* 元数据兜底失败按缺 URL 处理 */ }
  }
  if (!mrcUrl) throw new Error('咪咕无逐字歌词（该曲 mrcUrl 缺失）');
  var r = await axios.get(mrcUrl, {
    timeout: SOURCE_TIMEOUT, responseType: 'text',
    headers: { Referer: 'https://music.migu.cn/', 'User-Agent': miguUA() }
  });
  var text = String(r.data || '').trim();
  if (!text) throw new Error('咪咕逐字歌词内容为空');
  // 形态一：明文逐字/常规歌词（部分条目直出）
  // v1.6.0：明文 QRC（[ms,dur] 开头）同样补翻译 best-effort；普通 LRC 明文维持原样返回
  if (/^\[/.test(text) && (text.indexOf('[') === 0)) {
    if (MRC_REGEXPS.lineTime.test(text)) {
      var tPlain = '';
      try { tPlain = await fetchMiguTranslation(raw); } catch (eTP) { /* 翻译可选 */ }
      var plain = { rawLrc: text };
      if (tPlain) plain.translation = tPlain;
      return plain;
    }
    return { rawLrc: text };
  }
  // 形态二：hex 外壳（实测主流形态）
  if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) {
    var bin = miguHexToBytes(text);
    // 优先：TEA 解密 mrc（v1.2.0，移植自 baka v1.3.1）
    var decrypted = decryptMrc(text);
    if (decrypted) {
      var mrcParsed = parseMrc(decrypted);
      if (mrcParsed && mrcParsed.lyric) {
        // v1.6.0（P0）字段错位修复：MRC 解密原文行格式 `[start,dur]词(start,dur)` 即
        // 宿主 lrcParser 原生支持的 QRC 逐字格式，直接作 rawLrc 返回（对齐酷狗
        // parseKrcForHost 的直出思路）。此前 rawLrc 给 parseMrc 转出的普通 LRC、
        // 逐字内容放宿主不存在的 wordByWordLrc 字段 → 逐字歌词功能实际失效。
        // parseMrc 此处仅作解密产物格式校验（校验通过即原文为合法 QRC 逐字文本）。
        // 翻译歌词 best-effort，按宿主 ILyricSource 协议放 translation 字段。
        var tWbw = '';
        try { tWbw = await fetchMiguTranslation(raw); } catch (eTW) { /* 翻译可选 */ }
        var wbw = { rawLrc: String(decrypted).trim() };
        if (tWbw) wbw.translation = tWbw;
        return wbw;
      }
    }
    // 尝试 JSON 明文
    try {
      var parsed = JSON.parse(bytesToUtf8(bin));
      var inner = parsed && (parsed.lyricContent || parsed.lyric || parsed.mrc || parsed.content);
      if (typeof inner === 'string' && inner) return { rawLrc: inner };
      if (parsed && typeof parsed === 'object') return { rawLrc: bytesToUtf8(bin) };
    } catch (e) { /* 非 JSON，继续 */ }
    // 尝试 pako 解压（宿主白名单有 pako）
    try {
      var pako = require('pako');
      var out = pako.inflate(bin, { to: 'string' });
      if (out && /(\[|\{)/.test(String(out))) return { rawLrc: String(out) };
    } catch (e) { /* 解压失败，继续 */ }
    // TEA 解密失败且非 JSON/压缩——如实报错
    throw new Error('咪咕逐字歌词解密失败（TEA 解密后仍无法识别格式）');
  }
  // 其他形态：非空非明文非 hex，如实报错
  throw new Error('咪咕逐字歌词为未知格式，暂无法解析');
}

// 纯 JS hex 解码（ES5 安全，不依赖 Buffer）
function miguHexToBytes(hex) {
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToUtf8(bytes) {
  try {
    var pako = require('pako');
    // pako.inflate 支持普通 UTF-8 流（非压缩时抛错则退回 TextDecoder 逻辑）
    return pako.inflate(new Uint8Array(bytes), { to: 'string' });
  } catch (e) {
    return decodeURIComponent(escape(bytes.map(function (b) { return String.fromCharCode(b); }).join('')));
  }
}

var LYRIC_ADAPTERS = {
  migu: async function (raw) {
    // v1.1.0 修复#9：lyricUrl 缺失走 by-contentids 元数据兜底（榜单/歌单/专辑入口条目）
    var lrcUrl = raw && raw.lyricUrl;
    if (!lrcUrl && raw && raw.contentId) {
      // v1.4.0（P1-5）：播放过的歌曲 v2.0 songItem 已缓存 lrcUrl，零请求直取
      var v20Lrc = getV20Item(raw.contentId);
      if (v20Lrc && v20Lrc.lrcUrl) lrcUrl = str(v20Lrc.lrcUrl);
    }
    if (!lrcUrl && raw && (raw.contentId || raw.copyrightId)) {
      var meta = await fetchMiguSongMeta(raw.contentId || raw.copyrightId);
      lrcUrl = meta.lyricUrl;
    }
    if (!lrcUrl) throw new Error('migu no lyricUrl');
    var r = await axios.get(lrcUrl, {
      timeout: SOURCE_TIMEOUT, responseType: 'text',
      headers: { Referer: 'https://music.migu.cn/', 'User-Agent': miguUA() }
    });
    var text = String(r.data || '');
    if (!text) throw new Error('migu lyric empty');
    // v1.2.0：trcUrl 翻译歌词（对齐 baka），best-effort
    // v1.6.0：采集逻辑抽公共函数 fetchMiguTranslation（逐字歌词路径复用）
    var translation = '';
    try { translation = await fetchMiguTranslation(raw); } catch (eT) { /* 翻译获取失败不影响主歌词 */ }
    var lyricResult = { rawLrc: text };
    if (translation) lyricResult.translation = translation;
    return lyricResult;
  }
};

// v1.6.0：trcUrl 翻译歌词采集公共函数（自 LYRIC_ADAPTERS.migu 内联逻辑抽出，链路不变：
// raw.trcUrl → v2.0 songItem 缓存 → by-contentids 元数据兜底；无 trcUrl 或内容非
// 时间轴歌词返回空串）。供 getLyric 与 getWordByWordLyric 共用。
async function fetchMiguTranslation(raw) {
  var trcUrl = raw && raw.trcUrl;
  if (!trcUrl && raw && raw.contentId) {
    // v1.4.0（P1-5）：v2.0 songItem 缓存 trcUrl 零请求直取
    var v20Trc = getV20Item(raw.contentId);
    if (v20Trc && v20Trc.trcUrl) trcUrl = str(v20Trc.trcUrl);
  }
  if (!trcUrl && raw && (raw.contentId || raw.copyrightId)) {
    var meta2 = await fetchMiguSongMeta(raw.contentId || raw.copyrightId);
    trcUrl = meta2.trcUrl;
  }
  if (!trcUrl) return '';
  var r2 = await axios.get(trcUrl, {
    timeout: SOURCE_TIMEOUT, responseType: 'text',
    headers: { Referer: 'https://music.migu.cn/', 'User-Agent': miguUA() }
  });
  var t2 = String(r2.data || '').trim();
  return (t2 && /^\[[0-9]/.test(t2)) ? t2 : '';
}

// ==================== [v1.6.1] 跨源兜底歌词同步（方案A：插件层自处理，宿主零改动） ====================
// 宿主机制实证（MusicFree src/core/pluginManager/plugin.ts）：getLyric/getWordByWordLyric 以完整
// musicItem 入参、按 musicItem.platform 路由回原插件；getMediaSource wrapper 只解构
// url/headers/ekey/cek——取链返回值无法告知宿主「实际播放源」，宿主亦无歌词源跟随机制。
// 故取链胜出兜底源时写入进程内登记表，歌词/逐字歌词接口优先按兜底源取词；登记只发生在
// resolveWithFallback 胜出点（兜底臂解算成功≠胜出，竞速安全），原生源/同源备源胜出即清登记；
// TTL 10 分钟覆盖宿主歌词 MediaCache 缓存期，过期回落原生源歌词（行为与旧版一致，不产生错词）。
var FB_LYRIC_TTL_MS = 10 * 60 * 1000;
var FB_LYRIC_REG_MAX = 64;
var fbLyricRegistry = {};
function fbLyricKey(musicItem) {
  if (!musicItem || !musicItem.id) return '';
  return str(musicItem.platform || '') + '|' + str(musicItem.id);
}
function markFbLyricSource(musicItem, source, raw) {
  var k = fbLyricKey(musicItem);
  if (!k) return;
  fbLyricRegistry[k] = { source: source, raw: raw || {}, ts: Date.now() };
  var keys = Object.keys(fbLyricRegistry);
  if (keys.length > FB_LYRIC_REG_MAX) {
    for (var i = 0; i < keys.length; i++) {
      var e = fbLyricRegistry[keys[i]];
      if (!e || Date.now() - e.ts > FB_LYRIC_TTL_MS) delete fbLyricRegistry[keys[i]];
    }
  }
}
function clearFbLyricSource(musicItem) {
  var k = fbLyricKey(musicItem);
  if (k) delete fbLyricRegistry[k];
}
function getFbLyricSource(musicItem) {
  var k = fbLyricKey(musicItem);
  var e = k ? fbLyricRegistry[k] : null;
  if (!e) return null;
  if (Date.now() - e.ts > FB_LYRIC_TTL_MS) { delete fbLyricRegistry[k]; return null; }
  return e;
}

// ---------- 酷我兜底歌词 kit（LRC 双通道 + lrcx 逐字 + 酷狗 KRC 接力；移植自酷我插件 v1.5.0 同名实现） ----------
var FB_KW_LYRIC_TIMEOUT = 3000;

function fbKwSecToLrcTime(sec) {
  var s = Number(sec) || 0;
  var m = Math.floor(s / 60);
  var r = s - m * 60;
  var ss = Math.floor(r);
  var cs = Math.round((r - ss) * 100);
  if (cs >= 100) { cs = 0; ss += 1; }
  return (m < 10 ? '0' + m : '' + m) + ':' + (ss < 10 ? '0' + ss : '' + ss) + '.' + (cs < 10 ? '0' + cs : '' + cs);
}

// UTF-8 编码（手写，不依赖 Buffer/unescape，安卓 Hermes 宿主安全）
function fbUtf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) { out.push(c); }
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      var c2 = s.charCodeAt(i + 1);
      var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00); i++;
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | (cp & 63), 0x80 | ((cp >> 6) & 63));
    } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
  }
  return out;
}

function fbKwBase64(bytes) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return out;
}

var FB_KW_B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fbBase64ToBytes(input) {
  // 与 Buffer.from(str,'base64') 对齐的宽容策略：剥离所有非 alphabet 字符（含 U+FEFF BOM）
  var s = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
  var out = new Uint8Array(Math.floor(s.length * 3 / 4) + 3);
  var n = 0, bits = 0, acc = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '=') break; // padding 之后无数据
    var v = FB_KW_B64_ALPHABET.indexOf(ch);
    if (v < 0) {
      if (ch === '-') v = 62;
      else if (ch === '_') v = 63;
      else continue;
    }
    acc = ((acc << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
      acc &= (1 << bits) - 1;
    }
  }
  return out.subarray(0, n);
}

function fbBytesToUtf8(bytes) {
  var out = '', i = 0;
  while (i < bytes.length) {
    var b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if (b < 0xc0) { out += '\ufffd'; i++; } // 非法续字节，跳过
    else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if (b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else {
      // 4 字节序列（增补平面）→ UTF-16 代理对
      var cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      i += 4;
    }
  }
  return out;
}

// 酷我 LRC 双通道：openapi getlyric → m.kuwo.cn songinfoandlrc（酷我插件 LYRIC_ADAPTERS.kuwo 同款）
async function fetchKuwoFbLyric(rid) {
  if (!rid) throw new Error('kuwo-fb lyric no rid');
  try {
    var r = await axios.get('https://www.kuwo.cn/openapi/v1/www/lyric/getlyric', {
      params: { musicId: rid, httpsStatus: 1, plat: 'web_www', from: '' },
      timeout: FB_KW_LYRIC_TIMEOUT,
      headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var lines = r.data && r.data.data && r.data.data.lrclist;
    if (!lines || !lines.length) throw new Error('kuwo-fb no lrclist');
    var lrcLines = [];
    for (var i = 0; i < lines.length; i++) {
      lrcLines.push('[' + fbKwSecToLrcTime(lines[i].time) + ']' + String(lines[i].lineLyric || ''));
    }
    return { rawLrc: lrcLines.join('\n') };
  } catch (e) {
    // 歌词兜底通道：m.kuwo.cn songinfoandlrc（酷我插件 2026-09-06 实测可用）
    var r2 = await axios.get('https://m.kuwo.cn/newh5/singles/songinfoandlrc', {
      params: { musicId: rid, httpsStatus: 1 },
      timeout: FB_KW_LYRIC_TIMEOUT,
      headers: { Referer: 'https://m.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var lines2 = r2.data && r2.data.data && r2.data.data.lrclist;
    if (!lines2 || !lines2.length) throw new Error('kuwo-fb no lrclist (both channels)');
    var out2 = [];
    for (var j = 0; j < lines2.length; j++) {
      out2.push('[' + fbKwSecToLrcTime(lines2[j].time) + ']' + String(lines2[j].lineLyric || ''));
    }
    return { rawLrc: out2.join('\n') };
  }
}

// 酷我 lrcx 逐字歌词（newlyric.lrc：XOR("yeelion")+Base64 参数 → zlib 压缩体 → Base64 → XOR → gb18030；
// 机房 IP 常被上游风控（tp=DENY REQUEST），设备端 IP 可能放行；失败自动降级酷狗 KRC 接力）
var FB_YEELION_KEY = 'yeelion';
function fbXorYeelion(bytes) {
  var out = new Array(bytes.length);
  for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ FB_YEELION_KEY.charCodeAt(i % FB_YEELION_KEY.length);
  return out;
}
function fbEncLrcxParams(params) {
  return fbKwBase64(fbXorYeelion(fbUtf8Bytes(params)));
}
async function fbFetchKuwoLrcx(rid) {
  if (!rid) throw new Error('kuwo-fb lrcx no rid');
  var body = fbEncLrcxParams('user=12345,web,web,web&requester=localhost&req=1&rid=MUSIC_' + rid + '&lrcx=1');
  var resp = await axios.post('http://newlyric.kuwo.cn/newlyric.lrc', 'p=' + encodeURIComponent(body), {
    timeout: FB_KW_LYRIC_TIMEOUT,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: 'https://www.kuwo.cn/'
    },
    responseType: 'arraybuffer'
  });
  var buf = new Uint8Array(resp.data);
  var head = fbBytesToUtf8(buf.subarray(0, 10));
  if (head.indexOf('tp=content') !== 0) {
    throw new Error('kuwo-fb lrcx deny (' + head.replace(/[^A-Za-z0-9=]/g, ' ').trim() + ')');
  }
  // 找 \r\n\r\n 分隔：其后才是 zlib 压缩歌词体
  var sep = -1;
  for (var i = 0; i + 4 <= buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) { sep = i; break; }
  }
  if (sep < 0) throw new Error('kuwo-fb lrcx bad frame');
  var pako = require('pako'); // 宿主 require 白名单含 pako
  var inflated = pako.inflate(buf.subarray(sep + 4));
  // 二段解密：inflate 产物 = Base64(XOR(gb18030 歌词文本))
  var b64 = fbBytesToUtf8(inflated).replace(/[^A-Za-z0-9+/=]/g, '');
  var payload = Uint8Array.from(fbXorYeelion(fbBase64ToBytes(b64)));
  var text = '';
  try {
    if (typeof TextDecoder !== 'undefined') text = new TextDecoder('gb18030').decode(payload);
    else throw new Error('no TextDecoder');
  } catch (e) {
    text = fbBytesToUtf8(payload); // 兜底：UTF-8 解码（纯 ASCII 行不乱，中文行可能有损但不阻断）
  }
  if (!text) throw new Error('kuwo-fb lrcx decode empty');
  return text;
}

// KRC 解码（酷狗 fmt=krc：Base64 → "krc1" 魔数定位 → 16 字节密钥 XOR → raw inflate）
var FB_KRC_XOR_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];
function fbDecodeKrc(base64Content) {
  var pako = require('pako');
  var raw = fbBase64ToBytes(base64Content);
  var off = -1;
  for (var k = 0; k + 4 <= raw.length; k++) {
    if (raw[k] === 0x6b && raw[k + 1] === 0x72 && raw[k + 2] === 0x63 && raw[k + 3] === 0x31) { off = k; break; } // "krc1"
  }
  if (off < 0) throw new Error('kuwo-fb krc magic not found');
  var out = new Uint8Array(raw.length);
  out.set(raw);
  for (var i = off + 4; i < out.length; i++) {
    out[i] = raw[i] ^ FB_KRC_XOR_KEY[(i - off - 4) % 16];
  }
  var inflated = pako.inflateRaw(out.subarray(off + 6));
  var text = fbBytesToUtf8(inflated);
  if (!text) throw new Error('kuwo-fb krc inflate empty');
  return text;
}
async function fbFetchKugouKrcByHash(hash) {
  if (!hash) throw new Error('kuwo-fb krc no hash');
  var s = await axios.get('https://krcs.kugou.com/search', {
    params: { ver: 1, man: 'yes', client: 'mobi', hash: hash, album_audio_id: '' },
    timeout: FB_KW_LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var cands = s.data && s.data.candidates;
  if (!cands || !cands.length || !cands[0].id) throw new Error('kuwo-fb krc no candidate');
  var d = await axios.get('https://lyrics.kugou.com/download', {
    params: { ver: 1, client: 'pc', id: cands[0].id, accesskey: cands[0].accesskey, fmt: 'krc', charset: 'utf8' },
    timeout: FB_KW_LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var content = d.data && d.data.content;
  if (!content) throw new Error('kuwo-fb krc download empty');
  return fbDecodeKrc(content);
}
// 酷狗 KRC 跨源接力：标题+歌手搜同曲 → hash → KRC（时长容差 6s 防错配；miss 负缓存 5 分钟）
var fbKrcRelayMissCache = {};
var FB_KRC_RELAY_MISS_TTL_MS = 5 * 60 * 1000;
async function fbFetchKuwoKrcRelay(item) {
  var kw = ((item && item.title) || '') + ' ' + ((item && item.artist) || '');
  if (!kw.trim()) throw new Error('kuwo-fb krc relay no keyword');
  var missTs = fbKrcRelayMissCache[kw];
  if (missTs && Date.now() - missTs < FB_KRC_RELAY_MISS_TTL_MS) {
    throw new Error('kuwo-fb krc relay no match (negative cache)');
  }
  var s = await axios.get('https://mobilecdn.kugou.com/api/v3/search/song', {
    params: { format: 'json', keyword: kw, page: 1, pagesize: 8 },
    timeout: FB_KW_LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://m.kugou.com/' }
  });
  var list = (s.data && s.data.data && s.data.data.info) || [];
  var dur = parseInt(item && item.duration, 10) || 0;
  var tKey = item && item.title ? looseTitleKey(String(item.title)) : '';
  var hit = null;
  for (var i = 0; i < list.length; i++) {
    var d = parseInt(list[i].duration, 10) || 0;
    if (dur > 0 && d > 0 && Math.abs(d - dur) > 6) continue;
    var cKey = list[i].songname ? looseTitleKey(String(list[i].songname)) : '';
    if (tKey && cKey && cKey.indexOf(tKey) < 0 && tKey.indexOf(cKey) < 0) continue;
    hit = list[i];
    break;
  }
  // 无标题可比（relay 入参缺 title）才退回首条；有标题但全不匹配视为无命中（记负缓存）
  if (!hit && !tKey && list.length) hit = list[0];
  if (!hit || !hit.hash) {
    fbKrcRelayMissCache[kw] = Date.now(); // 只缓存"确认无命中"，网络错误不缓存
    throw new Error('kuwo-fb krc relay no match');
  }
  return fbFetchKugouKrcByHash(String(hit.hash));
}

// KRC/lrcx 文本（[start,dur]<rel,dur,0>词）→ 宿主 QRC 逐字格式（酷我插件 parseKrcForHost 同款：
// 逐字行 [startMs,durMs]<rel,dur,0>词... → [startMs,durMs]词(startMs+rel,dur)...，宿主
// lrcParser LINE_TIME_PATTERN 原生消费；[language:base64] 翻译/罗马音按 ILyricSource 协议带出）
function fbParseKrcForHost(krcText) {
  var lines = String(krcText).split(/\r?\n/);
  var richLines = [], richStarts = [];
  var altLines = {}; // startMs -> 独立翻译行文本
  var languageJson = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    if (line.indexOf('[language:') === 0) {
      languageJson = line.slice(10, line.lastIndexOf(']'));
      continue;
    }
    var m = line.match(/^\[(\d+),(\d+)\](.*)$/);
    if (!m) continue;
    var startMs = parseInt(m[1], 10), durMs = parseInt(m[2], 10), body = m[3];
    if (body.indexOf('<') < 0) {
      var alt = body.trim();
      if (alt && !altLines[startMs]) altLines[startMs] = alt;
      continue;
    }
    var words = '', wm;
    var re = /<(\d+),(\d+),\d+>([^<]*)/g;
    while ((wm = re.exec(body))) {
      var rel = parseInt(wm[1], 10), wd = parseInt(wm[2], 10), txt = wm[3];
      if (txt) words += txt + '(' + (startMs + rel) + ',' + wd + ')'; // 词标签 offset 相对行首，绝对时刻 = startMs + rel
    }
    if (words) { richLines.push('[' + startMs + ',' + durMs + ']' + words); richStarts.push(startMs); }
  }
  if (!richLines.length) throw new Error('kuwo-fb no timed lines');
  var translation = '', romanization = '';
  if (languageJson) {
    try {
      var lang = JSON.parse(fbBytesToUtf8(fbBase64ToBytes(languageJson)));
      var rows = lang.lyricContent || [];
      var isTrans = parseInt(lang.type, 10) === 1;
      for (var li = 0; li < rows.length && li < richLines.length; li++) {
        var cells = rows[li] || [];
        var rowText = cells.join('');
        if (!rowText) continue;
        if (isTrans) translation += (translation ? '\n' : '') + rowText;
        else romanization += (romanization ? '\n' : '') + rowText;
      }
    } catch (e) { /* language JSON 解析失败不阻断 */ }
  }
  if (!translation && richStarts.length) {
    for (var ri = 0; ri < richStarts.length; ri++) {
      var t = altLines[richStarts[ri]];
      if (t) translation += (translation ? '\n' : '') + t;
    }
  }
  return {
    rawLrc: richLines.join('\n'),
    translation: translation || undefined,
    romanization: romanization || undefined
  };
}
// lrcx 解码产物与 KRC 文本同为 `[s,d]<rel,d,0>词` 行格式，解析复用同一实现
function fbParseKuwoLrcxToQrc(lrcxText) { return fbParseKrcForHost(lrcxText); }

// 酷我兜底逐字歌词主入口：① 酷我原生 lrcx → ② 酷狗 KRC 跨源接力（按当前条目曲名/歌手搜同曲）
async function fetchKuwoFbWordLyric(rid, musicItem) {
  if (rid) {
    try { return fbParseKuwoLrcxToQrc(await fbFetchKuwoLrcx(rid)); }
    catch (e1) { /* lrcx 风控/失败 → KRC 接力 */ }
  }
  return fbParseKrcForHost(await fbFetchKuwoKrcRelay(musicItem));
}

// 歌词源尝试顺序（单平台版仅咪咕一源；机制保留以便后续扩展）
var LYRIC_SOURCE_ORDER = ['migu'];

async function getLyricImpl(musicItem) {
  // [v1.6.1] 跨源兜底歌词同步：取链胜出为兜底源（酷我）时，歌词优先按兜底源取，避免「酷我音频+咪咕歌词」错配
  var fbHit = getFbLyricSource(musicItem);
  if (fbHit && fbHit.source === 'kuwo') {
    try { return await fetchKuwoFbLyric(fbHit.raw.rid); } catch (efb) { /* 兜底源歌词失败，回落原生源 */ }
  }
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
  throw new Error('所有音源歌词均不可用（' + tried.join(' | ') + '）');
}

// ==================== 歌词搜索（v1.2.0 对齐 baka）====================
// jadeite.migu.cn v3 签名搜索（lyricSong 开关）+ m.music.migu.cn scr_search_tag type=7 兜底。
// crypto-js 为宿主白名单模块，缺失时仅降级跳过 v3 通道（老接口仍可用）。
var _cryptoJs = null;
try { _cryptoJs = require('crypto-js'); } catch (e) { _cryptoJs = null; }

/** v1.2.0：jadeite v3 歌曲反查（按 copyrightId/songId 精确匹配，baka getMusicInfo 主通道） */
async function jadeiteSongLookup(kw) {
  if (!_cryptoJs) return null;
  try {
    var time = Date.now().toString();
    var signData = miguCreateSignature(time, String(kw));
    var headers = {};
    for (var hk in JADEITE_HEADERS) headers[hk] = JADEITE_HEADERS[hk];
    headers.deviceId = signData.deviceId;
    headers.timestamp = time;
    headers.sign = signData.sign;
    var sw = encodeURIComponent('{"song":1,"album":0,"singer":0,"tagSong":1,"mvSong":0,"bestShow":1,"songlist":0,"lyricSong":0}');
    var r = await axios.get('https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=' + sw +
      '&pageSize=10&text=' + encodeURIComponent(String(kw)) + '&pageNo=1&sort=0&sid=USS',
      { headers: headers, timeout: SOURCE_TIMEOUT });
    if (!(r.data && r.data.code === '000000' && r.data.songResultData)) return null;
    var lists = r.data.songResultData.resultList || [];
    for (var i = 0; i < lists.length; i++) {
      var arr = lists[i];
      if (!Array.isArray(arr)) continue;
      for (var j = 0; j < arr.length; j++) {
        var it = arr[j];
        if (it && (String(it.songId) === String(kw) || String(it.copyrightId) === String(kw))) return it;
      }
    }
    return null;
  } catch (e) { return null; }
}

function miguMD5(s) {
  if (!_cryptoJs) throw new Error('crypto-js 不可用');
  return _cryptoJs.MD5(s).toString();
}

function miguCreateSignature(time, kw) {
  var deviceId = '963B7AA0D21511ED807EE5846EC87D20';
  var signatureMd5 = '6cdc72a439cef99a3418d2a78aa28c73';
  var sign = miguMD5(kw + signatureMd5 + 'yyapp2d16148780a1dcc7408e06336b98cfd50' + deviceId + time);
  return { sign: sign, deviceId: deviceId };
}

var JADEITE_HEADERS = {
  uiVersion: 'A_music_3.6.1',
  channel: '0146921',
  'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'
};

async function searchLyricV3(q, page, limit) {
  var time = Date.now().toString();
  var signData = miguCreateSignature(time, q);
  var headers = {};
  for (var hk in JADEITE_HEADERS) headers[hk] = JADEITE_HEADERS[hk];
  headers.deviceId = signData.deviceId;
  headers.timestamp = time;
  headers.sign = signData.sign;
  var sw = encodeURIComponent('{"song":0,"album":0,"singer":0,"tagSong":0,"mvSong":0,"bestShow":0,"songlist":0,"lyricSong":1}');
  var r = await axios.get('https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=1&isCopyright=1&searchSwitch=' + sw +
    '&pageSize=' + limit + '&text=' + encodeURIComponent(q) + '&pageNo=' + page + '&sort=0&sid=USS',
    { headers: headers, timeout: SOURCE_TIMEOUT });
  return r.data;
}

// 旧接口兜底：scr_search_tag type=7（歌词歌曲）
async function searchLyricOld(q, page, limit) {
  var r = await axios.get('https://m.music.migu.cn/migu/remoting/scr_search_tag', {
    params: { keyword: q, type: 7, pgc: page, rows: limit },
    timeout: SOURCE_TIMEOUT,
    headers: {
      Referer: 'https://m.music.migu.cn/v3/search?keyword=' + encodeURIComponent(q),
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68'
    }
  });
  return r.data;
}

function cleanLyricText(t) {
  if (!t) return '';
  return String(t).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function lyricSearchArtwork(si) {
  if (si.albumImgs && si.albumImgs.length) return str(si.albumImgs[0].img);
  if (si.imgItems && si.imgItems.length) return str(si.imgItems[0].img);
  return str(si.img3 || si.img2 || si.img1 || si.albumPic || si.cover || si.songPic ||
    si.picL || si.picM || si.picS || si.mediumPic || si.largePic || si.smallPic);
}

function lyricSearchArtist(si) {
  if (si.singerList && si.singerList.length) {
    return si.singerList.map(function (s) { return str(s.name || s.singerName); }).filter(Boolean).join(', ');
  }
  if (si.singers && si.singers.length) {
    return si.singers.map(function (s) { return str(s.name || s.singerName || s); }).filter(Boolean).join(', ');
  }
  if (si.artists && si.artists.length) {
    return si.artists.map(function (s) { return str(s.name || s.singerName || s); }).filter(Boolean).join(', ');
  }
  return str(si.singerName && si.singerName.join ? si.singerName.join(', ') : (si.singerName || si.singer || si.artist || ''));
}

/** 歌词搜索条目 → 宿主 ILyricItem（含 rawLrcTxt 与可播 _src） */
function lyricItemFromResult(o) {
  var cid = str(o.copyrightId || '');
  var cidField = cid || str(o.id || '');
  var item = {
    id: 'migu_' + cidField,
    title: str(o.title),
    artist: str(o.artist),
    album: str(o.album) || undefined,
    artwork: o.artwork || undefined,
    rawLrcTxt: cleanLyricText(o.lrc || o.lyrics || ''),
    copyrightId: cid || undefined
  };
  var raw = {
    contentId: str(o.contentId || o.id || ''),
    copyrightId: cid,
    lyricUrl: str(o.lrcUrl || ''),
    mrcUrl: str(o.mrcUrl || ''),
    trcUrl: str(o.trcUrl || '')
  };
  item._src = { migu: raw };
  item._srcOrder = ['migu'];
  if (!item.title || (!raw.contentId && !cid)) return null;
  return item;
}

async function searchLyricImpl(q, page) {
  var p = page || 1;
  var limit = 20;
  // 主通道：jadeite v3（需 crypto-js 签名）
  if (_cryptoJs) {
    try {
      var result = await searchLyricV3(q, p, limit);
      if (result && result.code === '000000' && result.lyricResultData) {
        var lyricData = result.lyricResultData || {};
        var rawList = lyricData.result || lyricData.resultList || [];
        var flattened = [];
        for (var i = 0; i < rawList.length; i++) {
          var item = rawList[i];
          if (!item) continue;
          if (Array.isArray(item)) {
            for (var j = 0; j < item.length; j++) if (item[j]) flattened.push(item[j]);
          } else flattened.push(item);
        }
        var data = [];
        for (var f = 0; f < flattened.length; f++) {
          var o = flattened[f];
          var wrapper = o.objectInfo || o;
          var si = wrapper.songInfo || wrapper.fullSong || wrapper.musicInfo || wrapper;
          var lyricText = o.multiLyricStr || o.multiLyric || wrapper.lyric || wrapper.lyricContent ||
            wrapper.lyricText || wrapper.lyricTxt || wrapper.lyricStr || si.lyric || si.lyricContent || '';
          var mapped = lyricItemFromResult({
            title: si.songName || si.name || si.title,
            id: si.songId || si.id || wrapper.id,
            contentId: o.contentId || si.contentId || si.songId || wrapper.id,
            artist: lyricSearchArtist(si),
            artwork: lyricSearchArtwork(si),
            album: si.album || si.albumName,
            lrc: lyricText,
            copyrightId: si.copyrightId,
            lrcUrl: wrapper.lyricUrl || wrapper.lrcUrl || si.lyricUrl || si.lrcUrl,
            mrcUrl: wrapper.mrcUrl || si.mrcUrl,
            trcUrl: wrapper.trcUrl || si.trcUrl
          });
          if (mapped) data.push(mapped);
        }
        var totalCount = Number(lyricData.totalCount || lyricData.total || 0);
        return { isEnd: totalCount > 0 ? totalCount <= p * limit : data.length < limit, data: data };
      }
    } catch (e) { /* v3 失败走旧接口 */ }
  }
  // 兜底：scr_search_tag type=7
  try {
    var old = await searchLyricOld(q, p, limit);
    var songs = Array.isArray(old && old.songs) ? old.songs : [];
    var data2 = [];
    for (var s = 0; s < songs.length; s++) {
      var so = songs[s];
      var mapped2 = lyricItemFromResult({
        title: so.title,
        id: so.id,
        artist: so.artist,
        artwork: so.img3 || so.img2 || so.img1 || so.picL || so.picM || so.picS ||
          so.cover || so.songPic || so.albumPic || so.mediumPic,
        album: so.albumName,
        lrc: so.lyrics,
        copyrightId: so.copyrightId,
        lrcUrl: so.lrcUrl || so.lyricUrl,
        mrcUrl: so.mrcUrl,
        trcUrl: so.trcUrl
      });
      if (mapped2) data2.push(mapped2);
    }
    return { isEnd: old && old.pgt ? Number(old.pgt) <= p * limit : songs.length < limit, data: data2 };
  } catch (e2) { /* 兜底也失败 */ }
  return { isEnd: true, data: [] };
}

// ==================== 插件定义 ====================

var plugin = {
  platform: 'migu',
  version: '1.9.14', // [v1.9.14 包升版（网易源集成长青 SVIP 网易替补通道 yinyue.haitangw.net，本源无代码改动，随包升版）；v1.9.13 包升版（QQ 源 a.aa.cab 通道方案A 拒绝虚标修复，本源无代码改动）；v1.9.12 包升版（QQ 源接入 a.aa.cab 新通道，本源无代码改动）；v1.9.10 随包升版（无代码改动，版本号统一升）；v1.9.9 音质标识一致性修复版：miguQualitiesFromEntry 消费条目自带 z3dCode 零请求补齐 atmos/atmos_plus 及真实大小（搜索/歌单页此前整页缺失，与榜单/歌手页同歌键集不一致；实测晴天声明 71,380,604B/10,584,078B 与 getMediaSource 实取字节逐字节一致，非虚标）；专辑页部分专辑上游 songList 返空属上游数据缺口如实记录；取链链路零改动，六页复测 195/195 全一致，详见排查总表-v1.9.9；v1.9.8版本号统一版（各源版本号对齐，无代码增量）；v1.9.4 第三方取链排查 + size 字段版：咪咕本轮排查仅 1 路第三方（海棠 musicserver.haitangw.cc/v1/music/resolve-url，200/201/503 alive 竞速容错），本轮零失效移除；getMediaSource 返回值补 size 字段（取链响应直带 resourceSize/audioSize > HEAD Range 0-0 探测 > 留空）+ 补 quality 标准字段对齐 IMediaSourceResult 契约，详见头部 changelog；v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机 SHEET_URL_UNRECOGNIZED，详见头部 changelog；v1.9.1 随包升版：歌单对象补 author 别名字段（宿主协议读 artist，任务字段清单要求 author，两者都传），导入修复详见酷狗 v1.9.1 changelog 与本轮自测清单；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——P2 共享咪咕对比评估无吸收项（本插件官方 PQ 派生链覆盖其 PQ 探测形态），详见头部 changelog；v1.8.4] 歌单导入元数据版：复核确认 description（歌单介绍，取 playlist/v2.0 summary 字段）已随完整歌单对象回传，无代码改动随包升版；[v1.8.3] 质检遗留优化版（Q-02/Q-03 复核确认已符合统一口径，随包升版）；2026-09-10 歌单解析修复版（P1-1 meta 接口换新 + P2-1/P2-3 platform 补齐 + P2-4 错误码，详见头部 v1.8.2 changelog）；沿用 v1.8.0 MV 参数对齐基线
  author: '研发2号',
  description: '咪咕音乐独立源插件 v1.9.8（v1.9.8 版本号统一版：各源版本号对齐，无代码增量；v1.9.5 全页面音质标识核查 + VIP 标识移除版：全接口停写 fee（VIP 角标）与 getMusicInfo/取链 fee 回填，miguFeeOf/miguIsVip 移除；音质标识各入口此前已全覆盖、本轮核查无缺口；上一版 v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（axios maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机导入 SHEET_URL_UNRECOGNIZED，详见头部 changelog；上一版 v1.9.2 为分享链接文本自动提取 URL 版；v1.9.1 随包升版：歌单对象补 author 别名字段，详见头部 v1.9.1 changelog；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——P2 共享咪咕对比评估判定无吸收项（BakaMusic 共享咪咕为 PQ 探测降级形态，本插件官方 PQ 派生 HQ/SQ/ZQ24/Z3D 全档+跨源兜底覆盖之），详见头部 v1.9.0 changelog；v1.8.4 歌单导入元数据版：复核确认 importMusicSheet 返回完整 IMusicSheetItem 歌单对象，歌单介绍 description（取 playlist/v2.0 summary 字段）随对象回传，字段名对齐宿主 v1.0.0 契约；v1.8.3 质检遗留优化版：错误前缀与 code 口径复核确认已符合统一标准，随包升版；歌单解析修复版：v1.8.2 修歌单元数据接口——query_playlist_by_id_tag 实测返回 HTML 登录壳失效，改走 MIGUM3.0 playlist/v2.0 App 通道（旧接口降为兜底，失败不再静默），歌单标题/封面/作者/描述恢复；歌单对象与音乐条目补 platform/isImported；错误统一携带结构化 code；v1.8.0 MV 参数对齐基线（getMvSourceImpl 顶层守卫字段兜底 + P1 字段齐备）；v1.6.1 修复跨源兜底歌词同步——酷我无损兜底胜出时歌词/逐字歌词自动切酷我源；v1.6.0 主链 MIGUM2.0/v2.0 明文 listen-url，PQ 直链派生全音质并探测验真——SQ 派生失败/产物<5MB 自动触发酷我官方接口无损兜底；h5v2.4 加密接口保留为副取链，另有 v2.1/302/pc-v2.0/海棠 mg 多通道接力）/歌词（v2.0 songItem 富字段 lrcUrl/mrcUrl/trcUrl 直供，翻译歌词+逐字歌词 TEA 解密后 QRC 原文直出宿主 rawLrc）/VIP 角标 fee/别名 alias/主键 primaryKey 齐备/官方榜单 14 个/歌单导入与广场/专辑/歌手作品/MV 四档画质/官方评论（海棠兜底）；无损档可接力海棠 mg 备源（可在设置中关闭）。',
  supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'],
  // v1.1.0 修复#7：'192k' 虚档移除（上游 h5v2.4 无该通道）；新增 hires（ZQ24 派生）
  // v1.2.0：新增 hires(ZQ32)/atmos(Z3D)/atmos_plus(3D60) 档位
  supportedQualities: ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'atmos_plus'],
  // v1.2.0 字段对齐：copyrightId 为咪咕稳定主键（宿主 primaryKey 协议声明）
  primaryKey: ['copyrightId'],
  // v1.3.0（P1，对标 baka no-cache）：no-store 改为 no-cache——宿主语义为「仍写缓存、
  // 离线可播缓存 URL」（plugin.ts:403-425），插件可白嫖离线缓存能力。依据：
  // ① 2026-09-07 实测咪咕 freetyst CDN 直链为公开路径 + Tim/Key 签名（无显式 Expires），
  //    同一签名链接多次 Range 请求持续 206 有效；② baka 同族取链接口 + no-cache 线上
  //    长期可用；③ 宿主播放时若缓存 URL 失效会按 getQualityOrder 逐档重试现取，失败兜底存在。
  cacheControl: 'no-cache',
  // v1.1.0：海棠 mg 备源接力为第三方中转（music.haitangw.cc / musicserver.haitangw.cc），
  // 涉及请求出站到非咪咕域名，默认开启、用户可关（隐私自主权）
  userVariables: [{
    key: 'allowHaitangRelay',
    name: '无损档海棠备源接力',
    hint: '超清/24bit 档在咪咕官方通道失败后接力海棠 mg 备源（第三方中转 musicserver.haitangw.cc，非咪咕官方域名）。关闭后仅走咪咕官方通道，无损档可能部分不可用。'
  }],
  hints: {
    search: ['搜索咪咕音乐曲库（歌曲/专辑/歌手/歌单）', '取链走 MIGUM2.0/v2.0 明文接口（h5v2.4 为副取链自动降级），无损档失败自动接力海棠 mg 备源'],
    importMusicSheet: [
      '支持咪咕音乐歌单分享链接、h5 分享链接、c.migu.cn 短链或纯数字歌单 ID',
      '单次最多导入 500 首'
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
    if (type === 'lyric') return searchLyricImpl(q, page); // v1.2.0：歌词搜索（对齐 baka）
    if (type !== 'music') return { isEnd: true, data: [] };

    var names = ['migu'];
    var tasks = names.map(function (n) {
      return SEARCH_ADAPTERS[n](q, page).catch(function () { return []; });
    });
    var settled = await Promise.all(tasks);
    var all = [];
    var okCount = 0;
    for (var i = 0; i < settled.length; i++) {
      if (settled[i] && settled[i].length > 0) okCount++;
      all = all.concat(settled[i] || []);
    }
    if (okCount === 0) throw new Error('咪咕搜索失败：请求未返回结果');

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
    // v1.1.0 修复#14：isEnd 按上游原始条数判定（pageSize=20，请求页返回 <20 条即到尾），
    // 不再按聚合去重后的 data.length 判——去重会让末页误判成未到尾，host 继续翻空页
    return { isEnd: all.length < 20, data: data };
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    var q = normalizeQuality(quality);
    var r = await resolveWithFallback(musicItem, q);
    // [v1.9.4] 边界补 size 兜底：竞速链返回无 size 时，Range 0-0 HEAD 探测；
    // 探测失败留空（不阻断取链）
    if (r && r.url && !r.size) {
      try { var sz = await probeHeadSize(r.url, 2000); if (sz > 0) r.size = sz; } catch (e) {}
    }
    // [v1.9.4] 补宿主标准字段 quality（= actualQuality），对齐 IMediaSourceResult 契约
    if (r && r.url && r.quality === undefined && r.actualQuality) r.quality = r.actualQuality;
    return r;
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  // 逐字歌词：v1.1.0 修复#4 采集 mrcUrl（加密格式如实报错，见 getWordByWordLyricImpl）
  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  // 单曲分享链接导入：咪咕暂不支持（明确报错，与聚合版口径一致）
  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // 歌曲详情：单平台版咪咕条目自带完整字段，封面缺失走 enrichArtwork（直通桩）。
  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getTopLists() {
    var groups = [{
      title: '咪咕榜单',
      data: CHART_DEFS.map(function (d) {
        // v1.2.1 修复：宿主 topListItem.tsx 只读 coverImg 渲染榜单封面（baka 同款字段），
        // 此前仅有 artwork 导致 14 榜封面全部空白；artwork 保留兼容其他消费点
        return { id: d.id, title: d.title, coverImg: d.cover || '', artwork: d.cover || '' };
      })
    }];
    return groups;
  },

  async getTopListDetail(topListItem, page) {
    var tid = (topListItem && topListItem.id) || '';
    if (page && page > 1) return { isEnd: true, musicList: [] };
    var def = findChartDef(tid);
    if (!def) throw new Error('未知榜单: ' + tid);
    var musicList2 = await enrichArtwork(await getAggregatedChart(def), 80);
    // v1.2.1 修复：补 topListItem（含 coverImg），宿主榜单详情页会把返回的 topListItem
    // 合并进页面头部（useTopListDetail），缺失时头部封面依赖入参、无兜底
    return {
      isEnd: true,
      topListItem: { id: tid, title: def.title, coverImg: def.cover || '', artwork: def.cover || '' },
      musicList: musicList2
    };
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

  // v1.2.0（对齐 baka）：歌曲详情页分享链接（宿主「查看歌曲详情页」入口）
  async getMusicDetailPageUrl(musicItem) {
    var cid = String((musicItem && (
      musicItem.copyrightId ||
      (musicItem._src && musicItem._src.migu && musicItem._src.migu.copyrightId)
    )) || '').trim();
    if (!cid) {
      var mId = String((musicItem && musicItem.id) || '').match(/^migu_([0-9a-zA-Z]+)$/);
      if (mId) cid = mId[1];
    }
    if (!cid) return ''; // 无咪咕主键：返回空串（baka 同款口径，宿主隐藏详情入口）
    return 'http://music.migu.cn/v3/music/song/' + cid;
  },

  supportedVideoQualities: [
    // v1.1.0 修复#8：三档实档（PQ/HQ/UHD），240p 虚档移除
    // v1.2.0：新增 4k 档（UHD 实测映射，mvplayinfo.do 官方通道）
    { key: '480p', label: '480P' },
    { key: '720p', label: '720P' },
    { key: '1080p', label: '1080P' },
    { key: '4k', label: '4K' }
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
    canServe: canServe,
    mergeHostQualities: mergeHostQualities,
    decryptH5v24: decryptH5v24,
    deriveMiguUrl: deriveMiguUrl,
    miguActualQuality: miguActualQuality,
    resolveMigu: resolveMigu,
    // v1.4.0：v2.0 明文主链 + songItem 缓存
    resolveMiguV20: resolveMiguV20,
    fetchMiguV20Item: fetchMiguV20Item,
    getV20Item: getV20Item,
    v20MetaOf: v20MetaOf,
    resolveHaitang: resolveHaitang,
    haitangLevelOf: haitangLevelOf,
    SOURCE_TIMEOUT: SOURCE_TIMEOUT,
    SOURCE_WEIGHT: SOURCE_WEIGHT,
    SOURCE_QUALITIES: SOURCE_QUALITIES,
    SEARCH_ADAPTERS: SEARCH_ADAPTERS,
    RESOLVE_ADAPTERS: RESOLVE_ADAPTERS,
    guardFullAudio: guardFullAudio,
    CHART_DEFS: CHART_DEFS,
    CHART_FETCHERS: CHART_FETCHERS,
    mergeChartLists: mergeChartLists,
    buildChartItem: buildChartItem,
    getAggregatedChart: getAggregatedChart,
    SHEET_URL_RESOLVERS: SHEET_URL_RESOLVERS,
    SHEET_FETCHERS: SHEET_FETCHERS,
    resolveSheetId: resolveSheetId,
    buildSheetItem: buildSheetItem,
    importMusicSheetImpl: importMusicSheetImpl,
    LYRIC_ADAPTERS: LYRIC_ADAPTERS,
    LYRIC_SOURCE_ORDER: LYRIC_SOURCE_ORDER,
    LYRIC_TIMEOUT: LYRIC_TIMEOUT,
    getLyricImpl: getLyricImpl,
    getWordByWordLyricImpl: getWordByWordLyricImpl,
    enrichArtwork: enrichArtwork,
    // 惰性 getter：本对象字面量在 var 赋值（文件尾部）之前求值，
    // 直接取值会是 undefined；用 getter 保证调用时拿到已赋值的表。
    get ALBUM_SEARCH_ADAPTERS() { return ALBUM_SEARCH_ADAPTERS; },
    get ARTIST_SEARCH_ADAPTERS() { return ARTIST_SEARCH_ADAPTERS; },
    get SHEET_SEARCH_ADAPTERS() { return SHEET_SEARCH_ADAPTERS; },
    get ALBUM_DETAIL() { return ALBUM_DETAIL; },
    get ARTIST_MUSIC() { return ARTIST_MUSIC; },
    get ARTIST_ALBUM() { return ARTIST_ALBUM; },
    get MV_SOURCE() { return MV_SOURCE; },
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
    isAllowedMediaUrl: isAllowedMediaUrl,
    withTimeout: withTimeout,
    RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
    RELAY_TIMEOUT: RELAY_TIMEOUT,
    internalToHostQuality: internalToHostQuality,
    // v1.3.0：音质/大小提取（供自测脚本复用）
    miguQualitiesFromEntry: miguQualitiesFromEntry,
    MIGU_FORMAT_KEY_INFO: MIGU_FORMAT_KEY_INFO,
    // v1.1.0：通道化取链内部件（供自测脚本复用）
    channelCandidates: channelCandidates,
    upgradeMiguQuality: upgradeMiguQuality,
    probeMiguExists: probeMiguExists,
    resolveMiguApp: resolveMiguApp,
    resolveMigu305: resolveMigu305,
    resolveMiguEnc: resolveMiguEnc,
    resolveHaitangMigu: resolveHaitangMigu,
    haitangEnabled: haitangEnabled,
    negCheck: negCheck,
    negSet: negSet,
    fetchMiguSongMeta: fetchMiguSongMeta,
    resolveWithFallback: resolveWithFallback,
    // v1.2.0：新增内部件导出（供自测脚本复用）
    fetchMiguResourceInfo: fetchMiguResourceInfo,
    fetchMiguSheetMeta: fetchMiguSheetMeta,
    fetchMiguCommentsOfficial: fetchMiguCommentsOfficial,
    resolveMvById: resolveMvById,
    miguQualitiesFromEntry: miguQualitiesFromEntry,
    searchLyricImpl: searchLyricImpl,
    searchLyricV3: searchLyricV3,
    searchLyricOld: searchLyricOld,
    miguCreateSignature: miguCreateSignature,
    decryptMrc: decryptMrc,
    parseMrc: parseMrc,
    mrcTeaDecrypt: mrcTeaDecrypt,
    // v1.3.2：新增内部件导出（自测脚本用）
    canListen: canListenImpl,
    fetchMiguZ3dCode: fetchMiguZ3dCode,
    normalizeZ3dCode: normalizeZ3dCode,
    get SESSION_UA() { return SESSION_UA; },
    get SESSION_DEVICE_ID() { return SESSION_DEVICE_ID; }
  }
};

module.exports = plugin;


// v1.1.0：formatTs 死代码已移除（原日期格式化函数全文件无引用）

// ==================== 专辑/歌手/歌单搜索（咪咕） ====================
// 端点出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核（artifacts/v05-probe/）。
// 单平台版：专辑/歌手/歌单搜索均走咪咕 search_all.do searchSwitch 通道。

var SEARCH_PAGE_SIZE = 20;

function parseMiguLen(len) {
  var p = String(len || '').split(':').map(function (x) { return parseInt(x, 10) || 0; });
  if (p.length < 2) return 0;
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] * 3600 + p[1] * 60 + p[2];
}
// 咪咕 search_all.do（文档 2.1 searchSwitch 表）：把目标类别置 1
function miguSearchBySwitch(swKey, q, page) {
  var sw = '{"song":0,"singer":0,"album":0,"songlist":0,"mv":0,"bestShow":0}';
  var target = '"' + swKey + '"';
  if (sw.indexOf(target) < 0) return Promise.resolve({});
  var sw2 = sw.replace(target + ':0', target + ':1');
  return axios.get('https://pd.musicapp.migu.cn/MIGUM3.0/v1.0/content/search_all.do', {
    params: { text: q, pageNo: page, pageSize: SEARCH_PAGE_SIZE, searchSwitch: sw2, ua: 'Android_migu', version: '5.0.1' },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.music.migu.cn/', channel: '014X031' }
  }).then(function (res) { return res.data || {}; });
}

function miguPic(u) {
  var pic = str(u || '');
  if (pic && pic.indexOf('http') !== 0) pic = 'https://d.musicapp.migu.cn' + pic;
  return pic;
}

// ---------- 专辑搜索 ----------
function searchAlbumMigu(q, page) {
  // doc 2.1：searchSwitch album:1 → albumResultData.result[]
  return miguSearchBySwitch('album', q, page).then(function (data) {
    var list = ((data.albumResultData || {}).result) || [];
    return list.map(function (it) {
      var id = str(it.id || it.albumId);
      return {
        source: 'migu', sid: id,
        title: str(it.name || it.albumName),
        artist: str(it.singerName || it.singer || ''),
        artwork: miguPic(it.img || it.picUrl || ''),
        worksNum: it.musicNum || it.songNum || 0,
        raw: { albumId: id }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

// ---------- 歌手搜索 ----------
// ---------- 歌手搜索 ----------
function searchArtistMigu(q, page) {
  return miguSearchBySwitch('singer', q, page).then(function (data) {
    var list = ((data.singerResultData || {}).result) || [];
    return list.map(function (it) {
      var id = str(it.id || it.singerId);
      return {
        source: 'migu', sid: id,
        name: str(it.name || it.singerName),
        avatar: miguPic(it.img || it.picUrl || ''),
        worksNum: it.musicNum || it.songNum || 0,
        raw: { singerId: id, name: str(it.name || it.singerName) }
      };
    }).filter(function (it) { return it.sid && it.name; });
  });
}

// ---------- 歌单搜索 ----------
// ---------- 歌单搜索 ----------
function searchSheetMigu(q, page) {
  return miguSearchBySwitch('songlist', q, page).then(function (data) {
    var list = ((data.songListResultData || {}).result) || [];
    return list.map(function (it) {
      var id = str(it.id || it.playlistId);
      return {
        source: 'migu', sid: id,
        title: str(it.name || it.title),
        artist: str(it.creatorName || it.createUserName || ''),
        artwork: miguPic(it.img || it.cover || ''),
        worksNum: it.musicNum || it.count || 0,
        raw: { listId: id }
      };
    }).map(function (it) {
      // v1.8.2（P2-3）：搜索歌单条目同样补 platform/isImported（对齐 importMusicSheetImpl 输出口径）
      if (it && it.source === 'migu') { it.platform = 'migu'; it.isImported = true; }
      return it;
    }).filter(function (it) { return it.sid && it.title; });
  });
}
var ALBUM_SEARCH_ADAPTERS = {
  migu: searchAlbumMigu
};
var ARTIST_SEARCH_ADAPTERS = {
  migu: searchArtistMigu
};
var SHEET_SEARCH_ADAPTERS = {
  migu: searchSheetMigu
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
    platform: '聚合搜索',
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
    platform: '聚合搜索',
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
    platform: '聚合搜索',
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
  return normalizeTitle(it.title);
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
  for (var i = 0; i < settled.length; i++) {
    if (settled[i] && settled[i].length > 0) okCount++;
    all = all.concat(settled[i] || []);
  }
  if (okCount === 0) throw new Error('聚合搜索失败：所有音源请求均失败');
  var groups = aggregateBy(all, keyOf);
  var data = [];
  for (var j = 0; j < groups.length; j++) data.push(buildItem(groups[j], j));
  data.sort(function (a, b) {
    var sa = (a.artwork ? 2 : 0) + (a.worksNum ? 1 : 0);
    var sb = (b.artwork ? 2 : 0) + (b.worksNum ? 1 : 0);
    return sb - sa;
  });
  return { isEnd: data.length === 0, data: data };
}


// ==================== 详情解析 / 歌手作品 / MV / 推荐歌单 / 评论 ====================
// 咪咕端点出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核：
// - 歌手作品：bmw/singer/song/v1.0（doc 7.x）
// - 专辑详情：queryAlbumSong（doc 8.1）
// - MV：bmw/search/video/v1.0（doc 9.1）+ resourceinfo.do resourceType=D → rateFormats[].url
//   直拼 freevod.nf.migu.cn（doc 9.3 直链方案，PQ/HQ/UHD 全免登录）
// - 歌单广场：plaza-header/taglist/listbytag（doc 6.1-6.3）
// 单平台版：网易云/QQ/酷狗/酷我详情与评论端点随拆分移除。

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
  migu: async function (raw) {
    // doc 8.1 queryAlbumSong：data.songList[]；实测字段直接挂在条目上（r8_mg_album_song）
    var res = await axios.get('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/queryAlbumSong', {
      params: { albumId: raw.albumId, pageNo: 1, pageSize: 100 }, timeout: SOURCE_TIMEOUT,
      headers: { channel: '014X031', Referer: 'https://music.migu.cn/' }
    });
    var data = res.data && res.data.data;
    var list = (data && data.songList) || [];
    return {
      albumItem: { title: '', artist: '', artwork: '', worksNum: list.length },
      entries: list.map(function (it) {
        var s = it.song || it;
        var pic = miguPic(it.img1 || it.img2 || it.img3 || s.img1 || '');
        // 🔴 修复#1：实测 it.singer 是字符串（不是数组），对它调 .map 必崩（v1.0.0 专辑详情 100% 失败根因）。
        // 正确的数组字段是 it.artists；兜底 s.singerList；字符串 singer 包装为单元素数组。
        var singerField = it.singer || s.singer;
        var singers = it.artists || s.singerList
          || (Array.isArray(singerField) ? singerField
            : (singerField ? [{ name: String(singerField) }] : []));
        return {
          source: 'migu', sid: str(it.contentId || s.contentId),
          title: str(it.songName || s.songName),
          artist: singers.map(function (x) { return str(x.name); }).join('/'),
          album: str(it.album || (s.album && s.album.name) || ''),
          duration: parseMiguLen(it.length || s.length || ''),
          artwork: pic,
          // v1.3.0（P0）：专辑条目挂 qualities——queryAlbumSong 条目实测自带
          // newRateFormats/rateFormats[].size（2026-09-07 实测专辑 8592）
          qualities: miguQualitiesFromEntry(it) || miguQualitiesFromEntry(s),
          // 修复#9/#4：专辑条目实测带 lrcUrl/mrcUrl（probe-mrc5 元数据同源字段），一并采集落 raw
          raw: {
            contentId: str(it.contentId || s.contentId),
            copyrightId: str(it.copyrightId || s.copyrightId || ''),
            lyricUrl: str(it.lrcUrl || s.lrcUrl || ''),
            mrcUrl: str(it.mrcUrl || s.mrcUrl || '')
          }
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
      var musicList = await enrichArtwork(out.entries.map(buildSheetItem), 60);
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
  migu: async function (raw, page) {
    // doc 7.x：data.contents[].contents[] 嵌套分组，跳过 ZJ-Img-Scroll 推广组（无 resId）
    var res = await axios.get('https://app.c.nf.migu.cn/bmw/singer/song/v1.0', {
      params: { pageNo: page, singerId: raw.singerId, type: 1 }, timeout: SOURCE_TIMEOUT,
      headers: { channel: '0146921', Referer: 'https://music.migu.cn/' }
    });
    var data = res.data && res.data.data;
    var groups = (data && data.contents) || [];
    var out = [];
    for (var i = 0; i < groups.length; i++) {
      var inner = (groups[i] && groups[i].contents) || [];
      for (var j = 0; j < inner.length; j++) {
        var it = inner[j];
        if (!it || !it.resId || !it.txt) continue; // 图片/推广项无 resId
        out.push({
          source: 'migu', sid: str(it.resId),
          title: str(it.txt), artist: raw.name || '',
          album: str(it.txt3 || ''),
          duration: 0,
          artwork: '',
          // v1.3.0（P0）：歌手作品条目挂 qualities——音质字段嵌在 it.songItem.audioFormats
          // （2026-09-07 实测 singer/song v1.0：songItem 带 PQ/HQ/SQ/ZQ24 的 asize/isize）
          qualities: miguQualitiesFromEntry(it.songItem),
          raw: { contentId: str(it.resId), copyrightId: str(it.copyrightId || '') }
        });
      }
    }
    return { entries: out, isEnd: out.length === 0 };
  }
};

// v1.2.0（对齐 baka getArtistAlbumWorks）：咪咕无歌手→专辑直接接口，
// 用专辑搜索按歌手名双向 includes 过滤兜底（best-effort，非精确全集）。
var ARTIST_ALBUM = {
  migu: async function (raw, page) {
    var p = page || 1;
    var name = str(raw && raw.name);
    if (!name) throw new Error('歌手名为空，无法检索专辑');
    var data = await miguSearchBySwitch('album', name, p);
    var list = ((data.albumResultData || {}).result) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var id = str(it.id || it.albumId);
      var title = str(it.name || it.albumName);
      var singerName = str(it.singerName || it.singer || '');
      if (!id || !title) continue;
      // 双向 includes 过滤：专辑歌手名与检索歌手名互含（baka 同款）
      if (!(singerName.indexOf(name) >= 0 || name.indexOf(singerName) >= 0)) continue;
      out.push({
        source: 'migu', sid: id,
        title: title,
        artist: singerName,
        artwork: miguPic(it.img || it.picUrl || ''),
        worksNum: it.musicNum || it.songNum || 0,
        raw: { albumId: id }
      });
    }
    return { entries: out, isEnd: out.length === 0 };
  }
}; // v1.2.0 前为空表：getArtistWorks type='album' 明确无源报错

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
      if (type !== 'album') {
        await enrichArtwork(data, 40);
        // v1.1.0 修复#9：歌手作品入口条目无歌词字段，用 by-contentids 元数据补齐 lyricUrl/mrcUrl
        // （fetchMiguSongMeta 逐条查询，失败静默跳过不阻塞作品列表）
        var enrichSongs = data;
        var enrichLimit = Math.min(enrichSongs.length, 50);
        var errs = 0;
        for (var ei = 0; ei < enrichLimit; ei++) {
          var rmeta = (enrichSongs[ei]._src && enrichSongs[ei]._src.migu) || null;
          if (!rmeta || rmeta.lyricUrl) continue;
          try {
            var m = await fetchMiguSongMeta(rmeta.contentId);
            rmeta.lyricUrl = m.lyricUrl;
            rmeta.mrcUrl = m.mrcUrl;
            if (!enrichSongs[ei].artwork && m.artwork) enrichSongs[ei].artwork = miguPic(m.artwork);
            if (!enrichSongs[ei].duration && m.duration) enrichSongs[ei].duration = m.duration;
          } catch (e) { errs++; if (errs >= 3) break; }
        }
      }
      return { isEnd: out.isEnd !== undefined ? out.isEnd : out.entries.length < 30, data: data };
    } catch (e) { lastErr = e; }
  }
  // v1.2.0：album 兜底（专辑搜索过滤）也未命中时如实报错
  if (type === 'album') {
    throw new Error('咪咕暂未检索到该歌手的专辑（搜索过滤兜底未命中），请尝试搜索专辑入口');
  }
  if (lastErr) throw lastErr;
  return { isEnd: true, data: [] };
}

// ---------- 歌单详情（复用 v0.4 六平台 SHEET_FETCHERS）----------
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
      var musicList = await enrichArtwork(dedupeBySid(entries).map(buildSheetItem), 60);
      var out = { isEnd: true, sheetItem: sheetItem, musicList: musicList };
      // v1.2.0：详情返回补歌单元数据（title/artwork，宿主歌单页头展示用）
      if (sheetItem.title) out.title = sheetItem.title;
      if (sheetItem.artwork) out.artwork = sheetItem.artwork;
      if (sheetItem.worksNum && !out.worksNum) out.worksNum = sheetItem.worksNum;
      // 元数据接口补全（query_playlist_by_id_tag 实测已 SPA 化失效，失败静默跳过）
      if (!out.title) {
        var metaS = await fetchMiguSheetMeta(src[names[i]].listId).catch(function () { return null; });
        if (metaS && metaS.title) {
          out.title = metaS.title;
          if (!out.artwork && metaS.artwork) out.artwork = metaS.artwork;
        }
      }
      return out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('歌单详情获取失败');
}

// ---------- MV 取链 ----------
// v1.1.0 修复#8：画质映射按文档 9 严格对齐——PQ=480p(标清)、HQ=720p(高清)、UHD=1080p(超清)。
// v1.0.0 的 ['240p','480p','720p','1080p'] 四档是虚标：上游 rateFormats 无 240p，
// 请求 240p 实际返回的是 PQ(480p)，用户看到的画质与真实不符。收敛为三档实档。
// v1.2.0（对齐 baka）：新增 mvplayinfo.do 官方取链通道（mvId 直查，优于搜索兜底），
//          UHD 实测映射 4k 档；返回补 headers/userAgent（宿主 IMvSource 协议字段）。
var MV_QUALITY_ORDER = ['480p', '720p', '1080p', '4k'];

// v1.2.0：MV 官方通道请求头与工具函数（移植自 baka requestMiguMvPlayUrl/buildMiguMediaUrl）
var MIGU_MV_HEADERS = {
  channel: '0140210',
  // v1.3.2 ⑤：MV 通道同样走会话级随机 UA
  'User-Agent': miguUA(),
  Referer: 'https://m.music.migu.cn/'
};

function parseMiguVideoDuration(value) {
  if (typeof value === 'number') return value > 10000 ? Math.round(value / 1000) : Math.round(value);
  var parts = String(value || '').split(':').map(Number);
  if (parts.length === 3 && parts.every(function (n) { return Number.isFinite(n); }))
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every(function (n) { return Number.isFinite(n); }))
    return parts[0] * 60 + parts[1];
  return undefined;
}

// 画质标注（诚实原则，延续 v1.1.0 修复#8）：按上游 formatType 真实映射。
// 注意与 baka 不同：baka 把 SQ/HQ 都标 1080p，实测 SQ 与 HQ 分属不同码率，不虚标。
function getMiguMvQuality(formatType) {
  var type = String(formatType || '').toUpperCase();
  if (type === 'UHD') return '4k';
  if (type === 'SQ') return '1080p';
  if (type === 'HQ') return '720p';
  return '480p';
}

// [v1.8.0 P1-2] MV 画质档位标称宽高（16:9，标称对齐 480p/720p/1080p/4k 行业惯例）
function getMiguMvDimensions(qLabel) {
  var q = String(qLabel || '').toLowerCase();
  if (q === '4k') return { width: 3840, height: 2160 };
  if (q === '1080p') return { width: 1920, height: 1080 };
  if (q === '720p') return { width: 1280, height: 720 };
  if (q === '480p') return { width: 854, height: 480 };
  return null;
}

function orderMiguMvFormats(rateFormats, requestedQuality) {
  var formats = Array.isArray(rateFormats) ? rateFormats.filter(function (f) { return f && f.url; }) : [];
  if (!formats.length) return [];
  var requested = String(requestedQuality || '1080p').toLowerCase();
  var order;
  if (requested === '4k' || requested === 'uhd') order = ['UHD', 'SQ', 'HQ', 'PQ'];
  else {
    var n = parseInt(requested.replace(/p$/, ''), 10) || 0;
    if (n >= 1080) order = ['SQ', 'HQ', 'UHD', 'PQ'];
    else if (n >= 720) order = ['HQ', 'PQ', 'SQ', 'UHD'];
    else order = ['PQ', 'HQ', 'SQ', 'UHD'];
  }
  var ordered = [];
  for (var i = 0; i < order.length; i++) {
    for (var j = 0; j < formats.length; j++) {
      if (String(formats[j].formatType).toUpperCase() === order[i] && ordered.indexOf(formats[j]) < 0) {
        ordered.push(formats[j]);
      }
    }
  }
  for (var k = 0; k < formats.length; k++) {
    if (ordered.indexOf(formats[k]) < 0) ordered.push(formats[k]);
  }
  return ordered;
}

function buildMiguMediaUrl(path) {
  if (!path) return '';
  if (/^\/\//.test(path)) return 'https:' + path;
  if (/^https?:\/\//i.test(path)) {
    return String(path).replace(/^http:\/\/freevod\.nf\.migu\.cn(?::8080)?/i, 'https://freevod.nf.migu.cn');
  }
  return 'https://freetyst.nf.migu.cn' + path;
}

// mvplayinfo.do 官方取链（对齐 baka requestMiguMvPlayUrl）：返回可播 URL 或 ''
async function requestMiguMvPlayUrl(resource, format) {
  if (!resource || !resource.contentId || !format || !format.url) return '';
  try {
    var response = await axios.get('https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/mvplayinfo.do', {
      params: {
        mvContentId: resource.contentId,
        mvCopyrightId: resource.copyrightId,
        format: format.format,
        url: format.url,
        size: format.size,
        resourceType: resource.resourceType || 'D'
      },
      headers: MIGU_MV_HEADERS,
      timeout: SOURCE_TIMEOUT
    });
    return (response.data && response.data.code === '000000') ? buildMiguMediaUrl(response.data.playUrl) : '';
  } catch (e) {
    return '';
  }
}

/**
 * v1.2.0：mvId 直查 MV 播放源（resourceinfo.do → mvplayinfo.do 逐格式尝试 → 直链兜底）。
 * mvId 取歌曲条目采集的 mvId/mvCopyrightId（搜索/元数据字段，对齐 baka）。
 */
async function resolveMvById(mvId, videoQuality) {
  if (!mvId) return null;
  var response;
  try {
    response = await axios.get('https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do', {
      params: { resourceType: 'D', resourceId: String(mvId) },
      headers: MIGU_MV_HEADERS,
      timeout: SOURCE_TIMEOUT
    });
  } catch (e) {
    return null;
  }
  var resource = ((response.data && response.data.resource) || [])[0];
  if (!resource) return null;
  var orderedFormats = orderMiguMvFormats(resource.rateFormats, videoQuality);
  var selected = orderedFormats[0] || null;
  var url = '';
  for (var i = 0; i < orderedFormats.length; i++) {
    url = await requestMiguMvPlayUrl(resource, orderedFormats[i]);
    if (url) { selected = orderedFormats[i]; break; }
  }
  // 旧资源可能直出可播 URL（无 mvplayinfo 会话）
  if (!url) {
    url = buildMiguMediaUrl((selected && selected.url) || resource.widescreenPath || resource.highscreenPath);
  }
  if (!url) return null;
  var isHls = /\.m3u8(?:\?|$)/i.test(url);
  var actualQuality = getMiguMvQuality(selected && selected.formatType);
  // [v1.8.0 P1-2] 顶层 result 补 width/height（咪咕上游 rateFormats 不携带尺寸，按档位标称值兜底）
  var dims = getMiguMvDimensions(actualQuality);
  var result = {
    url: url,
    headers: MIGU_MV_HEADERS,
    userAgent: MIGU_MV_HEADERS['User-Agent'],
    videoQuality: actualQuality,
    mimeType: isHls ? 'application/vnd.apple.mpegurl'
      : (selected && selected.fileType ? 'video/' + String(selected.fileType).toLowerCase() : 'video/mp4')
  };
  if (dims) { result.width = dims.width; result.height = dims.height; }
  // [v1.8.0 P1-4] codec：咪咕上游不携带独立 codec 字段（fileType=mp4），不硬编，留空
  // v1.3.0（P1，对齐 baka mg.js:1509-1514）：宿主 IVideoSourceResult.availableVideoQualities
  // ——该 MV 资源实际可用的画质档列表（按期望档优先排序后映射，去重保序）
  // [v1.8.0 P1-5] 结构化为 {key,label,width,height} 对象（与酷我/QQ/网易云 v1.8.0 一致）
  var availQ = [];
  var seenQ = {};
  for (var aq = 0; aq < orderedFormats.length; aq++) {
    var aqn = getMiguMvQuality(orderedFormats[aq] && orderedFormats[aq].formatType);
    if (aqn && !seenQ[aqn]) {
      seenQ[aqn] = 1;
      var ad = getMiguMvDimensions(aqn) || {};
      availQ.push({ key: aqn, label: aqn, width: ad.width, height: ad.height });
    }
  }
  if (availQ.length) result.availableVideoQualities = availQ;
  var dur = parseMiguVideoDuration(resource.migumvDuration);
  if (dur) result.duration = dur;
  var sz = Number(selected && selected.size);
  if (sz) result.size = sz;
  // mvplayinfo 返回带 playSessionId 的临时 HLS 地址，保守刷新以免缓存过期会话
  if (isHls) result.expiresAt = Date.now() + 30 * 60 * 1000;
  return result;
}

function strictMvMatch(list, title, artist, titleOf, artistOf) {
  var nt = normalizeTitle(title);
  var arts = String(artist || '').split(/[\/,，]/).filter(function (s) { return s; });
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (normalizeTitle(titleOf(it)) !== nt) continue;
    var va = String(artistOf(it) || '');
    if (!arts.length) return it;
    for (var j = 0; j < arts.length; j++) {
      if (va.indexOf(arts[j]) >= 0) return it;
    }
  }
  return null;
}

var MV_SOURCE = {
  migu: async function (musicItem, qIdx) {
    // 兜底：bmw/search/video/v1.0（doc 9.1）→ resourceinfo.do(D) → freevod 直链（doc 9.3）
    // 修复#8：fmap 三档严格对齐 PQ/HQ/UHD；search 端点 http→https（明文升级）
    var q = musicItem.artist + ' ' + musicItem.title;
    var r1 = await axios.get('https://app.c.nf.migu.cn/bmw/search/video/v1.0', {
      params: { pageNo: 1, text: q, typeOrder: 0 }, timeout: SOURCE_TIMEOUT,
      headers: { channel: '0146921', Referer: 'https://music.migu.cn/' }
    });
    var d1 = r1.data && r1.data.data;
    var items = (d1 && d1.items) || [];
    var vids = items.map(function (x) { return x && x.video; }).filter(function (v) { return v; });
    var hit = strictMvMatch(vids, musicItem.title, musicItem.artist,
      function (v) { return v.title; }, function (v) { return (v.singer || v.user || []).map(function (s) { return s.nickName || s.name; }).join('/'); });
    if (!hit || !hit.contentId) return null;
    var r2 = await axios.get('https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do', {
      params: { resourceId: hit.contentId, resourceType: 'D' }, timeout: SOURCE_TIMEOUT,
      headers: { birth: 'h5page', channel: '014X031', Referer: 'https://y.migu.cn/', 'location-data': '{"lat":"0","lng":"0"}', 'User-Agent': 'Mozilla/5.0' }
    });
    var resource = ((r2.data && r2.data.resource) || [])[0] || {};
    var rfs = resource.rateFormats || [];
    var fmap = ['PQ', 'HQ', 'UHD'];
    var want = fmap[qIdx];
    var rf = null;
    for (var i = 0; i < rfs.length; i++) {
      if ((rfs[i].formatType || rfs[i].ft) === want) { rf = rfs[i]; break; }
    }
    // 请求档缺失时向低档回退（如 UHD 无则取 HQ），保证用户拿到真实存在的最高档
    if (!rf) {
      for (var fi = qIdx - 1; fi >= 0 && !rf; fi--) {
        for (var ri = 0; ri < rfs.length; ri++) {
          if ((rfs[ri].formatType || rfs[ri].ft) === fmap[fi]) { rf = rfs[ri]; break; }
        }
      }
    }
    if (!rf || !rf.url) return null;
    var got = rf.formatType || rf.ft;
    var base = String(rf.url).indexOf('/') === 0 ? 'https://freevod.nf.migu.cn' + rf.url : String(rf.url);
    // 修复#8：返回 videoQuality 必须与实际下发格式一致（PQ→480p/HQ→720p/UHD→1080p）
    // v1.3.0（P1）：补 availableVideoQualities（与 resolveMvById 官方通道同口径）
    // [v1.8.0 P1-5] 结构化为 {key,label,width,height} 对象（与酷我/QQ/网易云 v1.8.0 一致）
    var availQ2 = [];
    for (var aq2 = 0; aq2 < rfs.length; aq2++) {
      var aqn2 = getMiguMvQuality(rfs[aq2] && (rfs[aq2].formatType || rfs[aq2].ft));
      if (aqn2 && !availQ2.find(function (x) { return x.key === aqn2; })) {
        var ad2 = getMiguMvDimensions(aqn2) || {};
        availQ2.push({ key: aqn2, label: aqn2, width: ad2.width, height: ad2.height });
      }
    }
    var ret2 = {
      url: base,
      videoQuality: got === 'UHD' ? '1080p' : (got === 'HQ' ? '720p' : '480p'),
      mimeType: 'video/mp4'
    };
    // [v1.8.0 P1-2] 顶层 result 补 width/height（按档位标称值兜底）
    var retDims = getMiguMvDimensions(ret2.videoQuality);
    if (retDims) { ret2.width = retDims.width; ret2.height = retDims.height; }
    // [v1.8.0 P1-4] codec：咪咕上游不携带独立 codec 字段（fileType=mp4），不硬编，留空
    if (availQ2.length) ret2.availableVideoQualities = availQ2;
    return ret2;
  }
};

async function getMvSourceImpl(musicItem, videoQuality) {
  if (!musicItem) return null;
  var qKey = videoQuality && typeof videoQuality === 'string' ? videoQuality : (videoQuality && videoQuality.key) || '1080p';
  // v1.2.0：优先 mvId 直查官方通道（resourceinfo.do + mvplayinfo.do，对齐 baka）
  var rawMigu = (musicItem._src && musicItem._src.migu) || {};
  // [v1.8.0 P0-3] 顶层守卫字段兜底：musicItem.mvId / mvCopyrightId / mvid / mv / mvVid 任一命中
  // 即映射到 _src.migu.mvId 或 mvCopyrightId；外链导入/旧缓存条目没有 _src.migu 也有顶层
  // 守卫字段时也能正确取 MV，与酷我/QQ/网易云 v1.8.0 行为一致。
  if (!rawMigu.mvId) {
    var topMvId = musicItem.mvId || musicItem.mvid || musicItem.mv || musicItem.mvVid;
    if (topMvId) rawMigu.mvId = String(topMvId);
  }
  if (!rawMigu.mvCopyrightId) {
    if (musicItem.mvCopyrightId) rawMigu.mvCopyrightId = String(musicItem.mvCopyrightId);
  }
  var mvId = rawMigu.mvId || rawMigu.mvCopyrightId || '';
  if (mvId) {
    try {
      var direct = await resolveMvById(mvId, qKey);
      if (direct) {
        // [v1.8.0 P1-1] videoQuality 写回 musicItem.videoQuality（宿主 UI 切档后回显）
        if (direct.videoQuality && !musicItem.videoQuality) {
          try { musicItem.videoQuality = direct.videoQuality; } catch (e) { /* frozen item */ }
        }
        return direct;
      }
    } catch (e) { /* 直查失败走搜索兜底 */ }
  }
  // 兜底：严格同曲匹配的 MV 搜索（单源即咪咕，宁缺毋滥）
  var qIdx = MV_QUALITY_ORDER.indexOf(qKey);
  if (qIdx < 0) qIdx = MV_QUALITY_ORDER.indexOf('1080p'); // 搜索流三档 fmap 以 1080p 为上限
  var fallbacks = ['migu'];
  for (var i = 0; i < fallbacks.length; i++) {
    var fn = MV_SOURCE[fallbacks[i]];
    try {
      var r3 = await fn(musicItem, Math.min(qIdx, 2));
      if (r3) {
        // [v1.8.0 P1-1] videoQuality 写回 musicItem.videoQuality（宿主 UI 切档后回显）
        if (r3.videoQuality && !musicItem.videoQuality) {
          try { musicItem.videoQuality = r3.videoQuality; } catch (e) { /* frozen item */ }
        }
        return r3;
      }
    } catch (e) { /* 接力下一源 */ }
  }
  return null;
}

// ---------- 推荐歌单广场 ----------
// 标签 id 约定：{source}~tag~{分类名|tagId} / {source}~rec~0（各源无参推荐流）
async function getRecommendSheetTagsImpl() {
  // v1.2.1 修复：pinned 必须是扁平数组——宿主 sheetBody.tsx 对 pinned 逐项 .map 渲染 pill
  // （每项需 {id,title}），点击后直接把该项传给 getRecommendSheetsByTag；此前分组结构
  // 导致 pill 无 id、点击恒取到空数据。首个 pill = 精选推荐（mg~rec~0）。
  var pinned = [{ id: 'mg~rec~0', title: '精选推荐', platform: 'migu' }];
  var groups = [];
  // 咪咕分类（doc 6.2 plaza-taglist：texts=[名称, tagId, URL编码名]）
  try {
    var r2 = await axios.get('https://app.c.nf.migu.cn/MIGUM3.0/v1.0/template/musiclistplaza-taglist/release', {
      params: { templateVersion: 1 }, timeout: SOURCE_TIMEOUT,
      headers: { channel: '0146921', Referer: 'https://music.migu.cn/' }
    });
    var datas = (r2.data && r2.data.data) || [];
    for (var g = 0; g < datas.length; g++) {
      var content = (datas[g] && datas[g].content) || [];
      var mgTags = content.map(function (t) {
        var texts = (t && t.texts) || [];
        return texts.length >= 2 ? { id: 'mg~tag~' + String(texts[1]), title: String(texts[0]), platform: 'migu' } : null;
      }).filter(function (x) { return x; });
      if (mgTags.length) groups.push({ title: datas[g].title || datas[g].name || '咪咕分类', data: mgTags });
    }
  } catch (e) { /* 分类可选，失败不阻塞 */ }
  // v1.2.1 修复：把首组（热门分类）标签扁平并入 pinned，补齐到 8 个
  // （baka 口径 pinned = hotTags.slice(0,8)）；保留完整分组在 data 供浮层选择
  var hotGroup = (groups[0] && groups[0].data) || [];
  for (var h = 0; h < hotGroup.length && pinned.length < 8; h++) {
    if (hotGroup[h] && hotGroup[h].id && !hotGroup[h].data) pinned.push(hotGroup[h]);
  }
  return { pinned: pinned, data: groups };
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var p = page || 1;
  var id = (tagItem && tagItem.id) || '';
  // v1.2.1 修复：宿主进入推荐歌单页时默认标签 id 为空串（sheetBody.tsx defaultTag），
  // 空标签回落精选推荐流（mg~rec~0），否则进页默认页恒为空白
  if (!id) id = 'mg~rec~0';
  var entries = [];
  var isEnd = true;
  if (id.indexOf('mg~rec') === 0) {
    if (p > 1) return { isEnd: true, data: [] };
    var r4 = await axios.get('https://app.c.nf.migu.cn/MIGUM3.0/v1.0/template/musiclistplaza-header/release', {
      params: { templateVersion: 1 }, timeout: SOURCE_TIMEOUT,
      headers: { channel: '0146921', Referer: 'https://music.migu.cn/' }
    });
    var items = (((r4.data && r4.data.data) || {}).contentItemList) || [];
    entries = items.map(function (x) {
      return {
        source: 'migu', sid: str(x.actionUrl),
        title: str(x.title), artist: str(x.creator || x.subTitle || ''),
        artwork: x.imageUrl || '', worksNum: 0,
        raw: { listId: str(x.actionUrl) }
      };
    });
    isEnd = true;
  } else if (id.indexOf('mg~tag~') === 0) {
    var tagId = id.slice(7);
    var r5 = await axios.get('https://app.c.nf.migu.cn/MIGUM3.0/v1.0/template/musiclistplaza-listbytag/release', {
      params: { tagId: tagId, pageNumber: p, templateVersion: 1 }, timeout: SOURCE_TIMEOUT,
      headers: { channel: '0146921', Referer: 'https://music.migu.cn/' }
    });
    var ci = ((r5.data && r5.data.data) || {}).contentItemList || {};
    var ilist = ci.itemList || [];
    entries = ilist.map(function (x) {
      var m = /(?:\?|&)id=(\d+)/.exec(String(x.actionUrl || ''));
      if (!m) return null;
      return {
        source: 'migu', sid: m[1],
        title: str(x.title), artist: str(x.creator || x.subTitle || ''),
        artwork: x.imageUrl || '', worksNum: 0,
        raw: { listId: m[1] }
      };
    }).filter(function (x) { return x; });
    isEnd = ilist.length < 10;
  } else {
    return { isEnd: true, data: [] };
  }
  return { isEnd: isEnd, data: entries.filter(function (e) { return e.sid && e.title; }).map(sheetSearchItemFromEntry) };
}

// ---------- 歌曲评论 ----------
// v1.1.0 修复#3：评论接入。官方 Y.2 免登录评论接口实测返回 HTML（2026-09-06 probe3，
// 文档宣称与实际不符），改接海棠中转 mgpl.php——实测 200 + JSON，单页 20 条无真实分页。
// v1.2.0（对齐 baka）：主通道改官方 music.migu.cn/v3/api/comment/listComments
// （带 targetId=copyrightId 实测返回 JSON；真实分页/回复列表/毫秒时间戳），
// 失败回落海棠 mgpl.php（仅第 1 页）。
async function fetchMiguCommentsOfficial(cid, p) {
  var r = await axios.get('https://music.migu.cn/v3/api/comment/listComments', {
    params: { targetId: cid, pageSize: 20, pageNo: p },
    timeout: SOURCE_TIMEOUT,
    headers: {
      Referer: 'https://music.migu.cn',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4195.1 Safari/537.36'
    }
  });
  if (!(r.data && r.data.returnCode === '000000')) throw new Error('official comments bad code');
  var data = r.data.data || {};
  var items = data.items || [];
  var out = items.map(function (item) {
    var au = item.author || {};
    var c = {
      id: str(item.commentId || ''),
      nickName: str(au.name || '咪咕乐友'),
      avatar: str(au.avatar || '').replace(/^\/\//, 'http://'),
      comment: str(item.body || ''),
      like: parseInt(item.praiseCount, 10) || 0,
      createAt: item.createTime ? Date.parse(item.createTime) || undefined : undefined
    };
    var replies = item.replyCommentList || [];
    if (replies.length) {
      c.replies = replies.map(function (rc) {
        var rau = rc.author || {};
        return {
          id: str(rc.commentId || ''),
          nickName: str(rau.name || ''),
          avatar: str(rau.avatar || '').replace(/^\/\//, 'http://'),
          comment: str(rc.body || ''),
          like: parseInt(rc.praiseCount, 10) || 0,
          createAt: rc.createTime ? Date.parse(rc.createTime) || undefined : undefined
        };
      });
    }
    return c;
  }).filter(function (x) { return x.comment; });
  var total = parseInt(data.itemTotal, 10) || 0;
  return { isEnd: p * 20 >= Math.max(total, 1), data: out };
}

async function fetchMiguCommentsHaitang(cid) {
  var r = await axios.get('https://music.haitangw.cc/pinglun/mgpl.php', {
    params: { songmid: cid },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://music.haitangw.cc/', 'User-Agent': miguUA() }
  });
  var payload = r.data && r.data.data;
  var comments = (payload && payload.comments) || [];
  var out = comments.map(function (c) {
    return {
      id: str(c.id || c.commentId || ''),
      nickName: str(c.userName || c.user || '咪咕乐友'),
      avatar: str(c.avatar || ''),
      comment: str(c.text || c.content || ''),
      like: parseInt(c.likedCount, 10) || 0,
      createAt: str(c.timeStr || c.time || '')
    };
  }).filter(function (x) { return x.comment; });
  return { isEnd: true, data: out };
}

async function getMusicCommentsImpl(musicItem, page) {
  var p = page || 1;
  var srcMap = musicItem && musicItem._src || {};
  var raw = srcMap.migu;
  if (!raw) { for (var k in srcMap) { if (srcMap[k]) { raw = srcMap[k]; break; } } }
  // v1.2.0 口径修正（实测）：海棠评论按 contentId 索引（songmid=contentId 才有数据），
  // 官方 listComments 的 targetId 两者均可；故 contentId 优先
  var targetId = raw && (raw.contentId || raw.copyrightId);
  if (!targetId) throw new Error('该条目无咪咕音源信息，无法取评论');
  // 主通道：官方评论接口（真实分页）
  try {
    return await fetchMiguCommentsOfficial(targetId, p);
  } catch (e) { /* 官方失败回落海棠 */ }
  // 兜底：海棠中转（仅第 1 页，服务端无分页）
  if (p > 1) return { isEnd: true, data: [] };
  return await fetchMiguCommentsHaitang(targetId);
}
