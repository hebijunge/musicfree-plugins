/**
 * 汽水音乐独立源插件（MusicFree）
 * ================================
 * v1.9.12（2026-09-20 包升版，基线 v1.9.11）：QQ 源接入 a.aa.cab/qq.music 搜索型取链新通道（详见 qq-v1912.js 头部 changelog）；本源无代码改动，版本号随包统一升 v1.9.12。
 * v1.9.5（2026-09-11 全页面音质标识核查 + VIP 标识移除版，基线 v1.9.4）：
 *  - 音质标识核查：搜索/榜单/歌单/专辑/歌手/导入/详情各入口实测均带宿主标准键
 *    qualities，无缺口、零改动；
 *  - VIP 标识移除：全接口停写 fee 字段，聚合/榜单聚合/buildSheetItem/getMusicInfo
 *    不再透传回填，feeOfTrack 判定函数整体移除。
 * v1.9.4（2026-09-11 第三方取链排查 + size 字段版，基线 v1.9.3）：
 *  - 任务一：getMediaSource 返回值加 size 字段（单位：字节），供宿主下载前预估大小与播放前音质校验。
 *    size 取值优先级：取链响应直带 bytes/size（自有 share_page/seo_track 响应）>
 *    HEAD 探测 Content-Range/Content-Length（getMediaSource 边界补 attachSizeIfMissing 兜底）>
 *    留空。v1.9.3 各通道未统一回填 size，本轮统一处理。
 *  - 任务二：第三方取链通道排查（2026-09-11 探针）。
 *    - 汽水插件本轮排查：第三方/代理通道 1 路（bugpk = api.bugpk.com/api/qsmusic），
 *      实测 alive（限流 520 走 1.2s 重试）。无失效通道。
 *    - 自有 share_page / seo_track alive；
 *    - 海棠 musicserver.haitangw.cc 经酷我/网易云 fallback 共享，503 容错。
 *    - 网络搜索新第三方汽水取链接口（qs-api.dogecloud.com 等 3 个候选）均为 404/接口关闭/
 *      要求付费，无新通道可接入；本轮零增量随 v1.9.3 基线升版。
 *
 * v1.9.3（2026-09-11 WebView 短链跟随修复版，基线 v1.9.2）：
 *  - 真机 WebView 下 XMLHttpRequest 会自动跟随 302 重定向，axios 的 maxRedirects:0
 *    仅 Node.js 生效 → followRedirects 拿到 status=200 且无 location，误判「无重定向」
 *    直接返回原始短链 → SHEET_URL_RESOLVERS 匹配不到 id 抛 SHEET_URL_UNRECOGNIZED
 *    （汽水 qishui.douyin.com/s 短链真机导入失败根因，沙箱 Node 环境测不出）。
 *  - 修复：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——status=200 且
 *    res.request.responseURL 为绝对 URL 且异于当前 URL 时，视为 WebView 已自动跟随
 *    到最终页，取最终 URL 返回；Node 环境 res.request 无 responseURL，行为不变。
 *    检测到自动跟随即返回（已是最终页），多跳手动跟随循环与链级预算保留不变。
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
 *  - 零代码增量，随包升版 v1.9.0。P1 汽水对比评估结论：
 *    BakaMusic 汽水插件为 SEO 兜底形态（实测上限 320k mp3）；
 *    本插件已有 PC 三端点（medium/higher/highest 三档）+ guardFullAudio 完整性守卫
 *    + 302 解析链，音质上限与健壮性均覆盖 BakaMusic 版，判定不重复建设。
 *
 * v1.8.4 变更（2026-09-10，歌单导入元数据版，对照宿主 Toskysun-MusicFree v1.0.0 契约）：
 *  - importMusicSheet 返回值从 IMusicItem[] 升级为完整 IMusicSheetItem 歌单对象
 *    （对齐宿主 IImportMusicSheetResult 联合类型与咪咕 v1.2.0 同构）：
 *    { id: 'qishui_<playlistId>', platform: 'qishui', isImported: true,
 *      title, artwork, worksNum, musicList }；
 *    title 取 luna/playlist/detail 响应 playlist.title（兜底 '汽水歌单 #<id>'），
 *    修复宿主详情页显示「来自qishui的歌单」而非真实歌单名的问题。
 *  - 歌单元数据随分页首页响应零额外请求捕获（playlist 对象）：
 *    title/public_title、url_cover（qishuiCover 解析）、count_tracks、owner.nickname；
 *    实测该接口不返回歌单介绍字段（无 desc/description），按宿主契约
 *    description 为可选字段，不传（不造假内容）。
 * ================================
 * v1.8.3 变更（2026-09-10，质检遗留优化版，对照 v1.8.2 交叉质检报告 Q-01~Q-04）：
 *  - Q-02/Q-03 复核：importMusicSheet 错误抛出点已统一为 sheetImportError（前缀
 *    "[qishui] <描述>"，code 枚举 SHEET_URL_EMPTY/SHEET_URL_UNRECOGNIZED/
 *    SHEET_FETCH_FAILED/SHEET_EMPTY），本轮逐点复核确认已符合统一口径，
 *    无需代码改动，随包升版 v1.8.3。
 * ================================
 * v1.8.2 变更（2026-09-10，歌单解析修复版，对照 6 平台歌单解析实测报告）：
 *  - P2-1 音乐/歌单条目补 platform：buildMusicItem（搜索等全部音乐条目出口）与
 *    buildSheetItem（歌单导入条目）此前均无 platform，宿主 canPlayMusicVideo 按
 *    platform 反查插件会失败；分别补 best.source || 'qishui' / entry.source || 'qishui'。
 *  - P2-6 getRecommendSheetsByTag 歌单条目补 platform（实测确认 v1.8.1 未修，本轮补）。
 *  - P2-4 错误文案统一：新增 sheetImportError helper，歌单链接解析/拉取/空歌单错误
 *    携带结构化 code（SHEET_URL_EMPTY/SHEET_URL_UNRECOGNIZED/SHEET_FETCH_FAILED/SHEET_EMPTY）。
 * ================================
 * v1.1.0（2026-09-06 修复 + 接口扩充版，基线 v1.0.0）：
 *  - 🔴-1 主取链通道重建：track.php 双宿主实测失效（403 HTML / 404），主通道改为
 *    分享页 _ROUTER_DATA 直连算法（v4 §26 同源方案，免签名免 Cookie）；
 *  - 新增 bugpk qsmusic 备源通道（免解密明文，单档 ~129k，限速 2req/s + 失败负缓存限流）；
 *  - 🟠-2 音质如实声明：单档 128k（各通道实测 ~126-129k），不再假支持 4 档；
 *  - 🟠-3 超时预算分层：各通道独立预算 + 外层 8s 总预算，followRedirects 链级 6s 封顶；
 *  - 新增 PC 评论接口（getMusicComments）、音乐人歌曲榜（CHART_DEFS 第 4 榜）、
 *    逐字歌词（getWordByWordLyric：分享页 sentences / bugpk KRC）；
 *  - 🟠-4 歌词网易云兜底加匹配度校验；🟡-5/6/7/8/9/10/12/13、🟢-14~17 按审查报告修复。
 *  - 小修：移除歌词网易云搜索兜底与匹配打分逻辑，歌词只走汽水自身通道
 *    （分享页 sentences / bugpk KRC），supportedQualities 与取链逻辑不变。
 * v1.2.1（2026-09-07 榜单图片 + 歌单分类修复，基线 v1.1.0）：
 *  - 榜单封面不显示：宿主 topListItem.tsx 渲染只读 coverImg（topListItem?.coverImg），
 *    原 getTopLists 只返回 artwork → 补 coverImg（artwork 双写兼容）；getTopListDetail
 *    返回值透传 topListItem（与 baka v3.2.6 对齐）；CHART_DEFS 补齐新歌榜/欧美榜封面
 *    （取自 baka QISHUI_TOP_LIST_ITEMS 实证 URL）。
 *  - 歌单分类缺失：插件未实现 getRecommendSheetTags / getRecommendSheetsByTag，
 *    分类页无标签无数据 → 新增两方法（baka 同款）：pinned 扁平 13 标签（每日推荐/流行/
 *    华语/欧美/国风/民谣/摇滚/说唱/电子/R&B/治愈/睡前/学习）；
 *    POST luna/pc/discover/mix（sub_channel_id 选频道，cursor 翻页实测有效），
 *    inner_block[].resources[].entity.playlist → qishuiCover 解析封面。
 * v1.2.2（2026-09-07 歌单默认分类空 id 兜底，基线 v1.2.1）：
 *  - 宿主歌单广场进入时默认选中的 tag 是 { title: '默认', id: '' }（sheetBody.tsx
 *    defaultTag），不是 pinned[0]（{id:0}）。空 id 现显式映射到默认推荐频道
 *    sub_channel_id=0（与 pinned 首个「每日推荐」同一数据源），空 id 时返回的
 *    就是歌单默认推荐数据；
 *  - 空结果兜底：指定频道 0 条 → 回退默认推荐频道；默认推荐频道偶发 0 条
 *    （上游只回非歌单实体卡片）→ 同请求重试一次，仍空才如实返回；
 *  - 自测：真实网络 id='' 连续 10 次全部非空（8-10 条），翻页/标签回归通过。
 * v1.3.0（2026-09-07 跨源兜底取链，基线 v1.2.2）：
 *  - 汽水三通道全败后自动跨源兜底：按「歌名+歌手」搜酷我 → 同曲匹配（复用聚合模板
 *    isSameSong：归一化歌名+歌手+版本互斥+时长容差）→ 酷我多级竞速取链（nmobi/nmsublist/
 *    mobi.s 免签车载 + DES 手机/车载双渠道 + antiserver + 海棠 kw 兜底，移植自
 *    kuwo-source v1.3.0 取链实现，封装为 resolveViaKuwo）；
 *  - 酷我也失败 → 同流程搜网易云 → 网易云取链（官方 128k/eapi 竞速 + 海棠 wy + 星海 +
 *    oiapi + bugpk + 7boe + sedet + outer/url 接力，移植自 netease-source v1.2.1，
 *    封装为 resolveViaNetease）；
 *  - 音质映射三档一一对应：汽水 standard/high/super（宿主 128k/320k/flac）→ 酷我
 *    standard/high/super → 网易云 standard/high/super（官方 br 128k/320k/999k lossless）；
 *    supportedQualities 相应扩为 128k/192k/320k/flac——汽水自身仍是单档 ≈128k，高品档由
 *    兜底源提供，actualQuality 如实标注不虚标；
 *  - 匹配不上不强用：目标源搜索无同曲命中即跳过该源（负缓存 60s），绝不错播；只取
 *    第一条同曲命中（搜索引擎相关度序），不做多首尝试；
 *  - 预算编排：整体 8s deadline（汽水阶段 ≤4.5s、+酷我 ≤6.5s、网易云吃满剩余）；
 *    对外透明：条目 platform 仍为 qishui，返回汽水插件格式 { url, actualQuality }；
 *  - 代码组织：酷我/网易云取链各为独立函数组（kw/ne 专属符号 + 共享 raceSuccess/
 *    utf8Bytes/海棠封装），只移植取链与搜索必需代码，不搬整个插件；汽水主链
 *    resolveWithFallback 仅新增可选 deadlineOverride 参数，缺省行为不变。
 * v1.4.0（2026-09-07 参数传递对齐 baka v3.2.6，基线 v1.3.0）：
 *  - P0 音质大小：搜索/榜单/歌单/详情所有条目构造处读取上游原生 bit_rates[]（实测
 *    PC 三端点恒返回 medium/higher/highest 三档 quality/br/size 三元组），映射为
 *    宿主 qualities {128k/192k/320k: {size, bitrate}} 挂条目——宿主下载面板大小列、
 *    下载进度总量兜底（downloader parseQualityFileSize）、getSmartQuality 智能降级
 *    三处消费（qualities.ts / musicItemOptions.tsx L358 / operations.tsx L57）。
 *    键口径用宿主原生键而非 legacy standard/high/super：宿主 convertLegacyQuality
 *    会把 standard→192k/high→320k/super→flac 错位映射，且 getAvailableQualities 按
 *    supportedQualities（128k/192k/320k/flac）取键；上游 PC 端无 lossless 档，flac
 *    无实测 size 不挂键（宁缺毋假，与 actualQuality 同原则）；
 *  - P0 getMusicInfo 大小兜底：分享页 trackInfo.bit_rates → qualities（实测字段路径
 *    audioWithLyricsOption.trackInfo.bit_rates），条目缺 qualities 时补齐；
 *  - P1 取链 headers：返回值补 {User-Agent, Range: bytes=0-, Referer}——douyin/汽水系
 *    CDN 带 douyin Referer（baka AUDIO_PLAYBACK_HEADERS 同款），酷我/网易云兜底源只带
 *    通用 UA + Range 防跨源 Referer 干扰；上游加防盗链不再裸奔；
 *  - P1 fee VIP 标记：PC 端无 fee 字段（实测恒空），VIP 歌表现为 preview/audition_info
 *    非空（未登录仅 30/60s 试听，实测 duration=30001/60001ms）→ feeOfTrack 派生
 *    fee: 1|0，聚合条目任一成员判 VIP 即 1；
 *  - P2 30/60s 固定时长试听规则：guardFullAudio 增补——探测估算时长恰为 30/60s
 *    （±1.5s）且标称 ≥90s 时判试听（对齐 baka isPreviewVideoModel 语义，与既有
 *    previewStart/比例规则互补，覆盖 90-100s 短歌 60s 试听比例不触发的盲区）；
 *  - 未做：supportedVideoQualities/MV 声明（本插件无 getMvSource 能力，声明即虚标）；
 *    上游档名透传 qishuiQuality（主链单档影响小，报告 P2）。
 *
 * v1.5.0（2026-09-08 取链并行竞速，基线 v1.4.1）：
 *  - 编排重构：汽水主链与酷我兜底从「串行兜底」改为「并行竞速」——两臂在取链入口
 *    同时启动（酷我兜底臂复用既有 resolveViaKuwo，零重写），谁先返回有效结果（过
 *    URL 白名单 + guardFullAudio 试听守卫，非试听片段）用谁；慢的一臂不 cancel
 *    （其 Promise 自然走完、结果被丢弃），由 raceFirstValid 统一裁决并收集失败明细；
 *  - 动机：汽水自身接口基本不可用（基准实测 70%+ 请求实际借道酷我兜底），v1.3.0
 *    串行编排下酷我必须排在汽水主链 4.5s 阶段超时之后，两次串行取链叠加致平均
 *    3.28~3.57s（6 平台最慢）；并行化后酷我命中请求直接以酷我速度（~0.3s）胜出；
 *  - 降级链与校验逻辑不变：两臂全败仍走网易云兜底（吃满剩余全局预算）；试听片段
 *    检测（guardFullAudio + 30/60s 固定时长规则）、负缓存语义均沿用 v1.3.0；音质档位
 *    映射不变（宿主键 → standard/high/super/hires → 酷我同名内部档），actualQuality
 *    如实标注（宁低勿高）；同曲匹配升级见下方【核心约束修订】条目；
 *  - 预算编排：整体 8s deadline 不变；汽水臂仍以 FB_PHASE1_MS(4.5s) 封顶、酷我臂以
 *    FB_PHASE2_MS(6.5s) 封顶，保证两臂全败时网易云兜底仍有剩余预算可达；
 *  - 【核心约束修订 · 二次修订】严格同曲校验改为「拆分式精确匹配」（校验不通过的
 *    结果再快也不能用）：竞速兜底臂的同曲匹配 isSameSongStrict 重写——先从两侧歌名
 *    中拆分出核心歌名与版本标签，再分别校验：①核心歌名（剥离版本标签关键词后的
 *    剩余文本，去空格/标点/大小写）必须完全一致，不再做「剥版本词后比核心名」的
 *    宽松键比对（旧口径会把 Live 版与原版混为一谈）；②版本标签必须精确匹配——
 *    数量与类型都对应（原曲是 Live 兜底侧必须是 Live；原曲是原版兜底侧也必须是
 *    原版；标题显式写「原版/Original Version」视同无标签），标签关键词表补齐任务
 *    规格全部条目（Live/现场版/演唱会/伴奏/纯音乐/纯享版/Remix/DJ版/翻唱/原版/
 *    电影版/电视剧版/片段/节选/铃声版/3D/环绕/钢琴版/吉他版/女声版/男声版/童声版/
 *    完整版等）；③歌手按 feat./&/和/与/, 等分隔符拆集合逐个比对，至少一名匹配；
 *    ④双方有时长时 |Δ| > 汽水侧 10% 即判不同曲（兜底侧缺时长退回「专辑名也一致」
 *    保守口径）。校验前置在搜索之后、取链之前，不通过者不参与竞速、直接判负。
 *    自测新增 6 个同曲校验场景（原版↔原版、Live↔Live、伴奏↔伴奏应匹配；
 *    Live↔原版双向、同名不同歌手应不匹配），全部覆盖。
 *
 * v1.6.0（2026-09-08 字段补齐 + 逐字歌词修复，基线 v1.5.0）：
 *  - 🔴 P0 逐字歌词字段错位修复：v1.1.0 起 getWordByWordLyric 返回 { lrc: KRC 原文 }——
 *    lrc 是废弃的「歌词 URL」字段，宿主 lrcSource 只读 rawLrc（plugin.ts lrcSource?.rawLrc，
 *    缺 rawLrc 直接判 null）→ 逐字歌词功能实际失效。现统一转 QRC（[行起始ms,行持续]
 *    词(字起始ms,字持续)…，宿主 lrcParser 原生格式，酷狗插件 parseKrcForHost 同款转换）
 *    后放 rawLrc 返回；通道序：缓存 KRC → 分享页 sentences（word 级 startMs/endMs，
 *    2026-09-08 实测）→ bugpk KRC 现拉，三段任一命中即转 QRC；
 *  - P1 专辑/歌手搜索与详情补齐：supportedSearchType 扩为 music/album/artist/sheet；
 *    搜索接 luna/search/album（group id=albums）/ luna/search/artist（id=artists），
 *    实测 HTTP 200；详情改走分享页 SSR（share/album?album_id= / share/artist?artist_id，
 *    _ROUTER_DATA 含 albumInfo/artistInfo + 全结构 trackList）——文档 X.2/X.3 的
 *    /luna/pc/album|artist/{id} 系列端点已失效（2026-09-08 实测全量 404 Page not found，
 *    /luna/pc 前缀仅 charts/comments/discover 存活）；新增 getAlbumInfo（专辑详情+曲目，
 *    补 description/date/worksNum）与 getArtistWorks（歌手热门歌曲）；
 *  - P1 分享链接：新增 getMusicDetailPageUrl，复用取链同源分享页 URL
 *    （music.douyin.com/qishui/share/track?track_id=xx，实测 200 可访问）；
 *  - P2 primaryKey：声明 ['id']（宿主存档展示，对齐网易云/咪咕约定）；
 *  - P2 fee 复核：搜索/榜单/歌单/详情/专辑/歌手曲目条目全链路均经 feeOfTrack 派生
 *    （preview/audition_info 非空判 VIP），v1.4.0 已落地，本轮全链路核验无遗漏；
 *  - P2 alias 如实标注：汽水 track/album/artist 实体无别名字段（2026-09-08 实测
 *    trackList 全键无 alias 类字段），平台能力缺失，无法映射（宁缺毋假）；
 *  - P2 音质档位调研结论：Android 签名通道 6 档（含 lossless/hi_res）需 X-Gorgon/X-Argus
 *    等 7 头签名 + sessionid 登录态；免登录实测 /luna/player 返回空体，第三方签名服务
 *    api.music.qishui.vsaa.cn 已失效（502）→ 免登录条件不可接入。可行方案（需用户侧
 *    提供有效 sessionid + 可用签名服务，以 userVariables 接入 player 通道）记录于
 *    changelog，本轮不实现；
 *  - 自测：逐字 QRC 3 首、专辑/歌手搜索+详情各 2、fee 2 VIP + 2 免费、分享链接 2 首
 *    （URL 可访问）、primaryKey/alias 字段核验，全部通过（详见任务评论自测清单）。
 *
 * v1.8.0（2026-09-10 MV 参数对齐基线，基线 v1.7.0；对照 MusicFree v1.0.0 宿主协议）：
 *  - P0 显式声明无 MV 能力：补 getMvSource 空实现（return null，宿主不会因为没声明
 *    而误判无 MV 守卫字段→调 getMvSource→又得到空值，多此一举），同时在 buildMusicItem
 *    输出 item 顶层加 is_video: false（宿主 canPlayMusicVideo 守卫的 9 字段之一，
 *    显式 false 与缺省 undefined 行为有别——可观测、对齐其他 5 源插件的守卫字段策略，
 *    防止宿主因汽水条目无任何 MV 守卫字段而漏走快速过滤路径）；
 *  - P2 description 文档化：新增一句「本插件不提供 MV 播放」说明，宿主插件详情页
 *    透出，避免用户误判能力缺失为 bug。
 *
 * 兼容性：ES8 语法（async/await），不使用 ?. / ??（安卓端风险，官方技能包提示）。
 *
 * 取链路径（免登录，通道序）：
 *  - ① 分享页 _ROUTER_DATA 直连算法 ∥ seo_track 通道并行竞速（v1.7.0，raceSuccess 首胜即用）
 *  - ② bugpk qsmusic（https://api.bugpk.com/api/qsmusic?url=<分享页URL>，明文直链）
 *  - ③ track.php CENC（双宿主实测失效，末位保留 + 快速失败 + 负缓存，通道恢复自动启用）
 * 搜索路径：歌曲 luna/search/track（offset 游标分页）；歌单 luna/search/playlist；
 *   专辑 luna/search/album；歌手 luna/search/artist（v1.6.0）。
 */
var axios = require('axios');

// ==================== 通用工具 ====================

var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
// v0.7.1 P1-3：取链全局超时预算。宿主 getMediaSource 单方法 10s 硬上限。
// v1.1.0 🟠-3：超时预算分层——外层 8s 总预算罩底，各通道独立小预算（CHAN_TIMEOUT），
// 修复 v1.0.0「外层 4.5s withTimeout 罩死整条串行链（track.php→分享页→302 跟随）」的问题。
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
// v1.1.0：各取链通道独立预算（2026-09-06 实测耗时：分享页 ~0.6-2s，bugpk ~1-2s，track.php 死形态 <1s）
var CHAN_TIMEOUT = {
  share_page: 3500,
  // v1.7.0：seo_track 通道（两跳 GET：seo_track 元信息 → VOD GetPlayInfo，实测 ~0.8s 全程）
  seo_track: 3500,
  bugpk: 3000,
  track_php: 2500
};
var REDIRECT_HOP_TIMEOUT = 1500;      // 302 单跳超时（🟡-8：链级预算见 followRedirects）
var REDIRECT_CHAIN_BUDGET_MS = 6000;  // 302 跟随链级总预算
var DURATION_TOLERANCE_SEC = 6;

// ==================== v1.3.0 跨源兜底编排常量（v1.5.0 并行竞速沿用） ====================
// 整体 deadline 8s（宿主 getMediaSource 单方法 10s 硬上限内）。v1.5.0 起汽水主链与
// 酷我兜底并行竞速：汽水臂仍以 4.5s 封顶（保证臂内多通道接力走得到）、酷我臂以 6.5s
// 封顶（正常 0.3~1s 胜出，封顶只是预算护栏），两臂全败时网易云兜底吃满剩余预算。
// 兜底源搜索/取链失败负缓存 60s（仅「搜索无同曲命中」这类确定性失败入负缓存，
// 通道瞬时失败不惩罚，下次仍可重试）。
var FB_TOTAL_BUDGET_MS = 8000;
var FB_PHASE1_MS = 4500;   // 汽水主链阶段预算上限
var FB_PHASE2_MS = 6500;   // 汽水+酷我阶段累计预算上限
var FB_SEARCH_TIMEOUT = 3500; // 兜底搜索单请求超时
var RELAY_TIMEOUT = 2500;     // 兜底源接力段单请求超时（海棠/星海/7boe/oiapi/bugpk/outer-url）
var FB_NEG_TTL_MS = 60000;
var fbNeg = {};
function fbNegHit(key) {
  var t = fbNeg[key];
  if (t && Date.now() < t) return true;
  if (t) delete fbNeg[key];
  return false;
}
function fbNegMark(key) { fbNeg[key] = Date.now() + FB_NEG_TTL_MS; }

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

// 宽松标题键：进一步剥离裸露的版本词（不依赖括号）+ 剥特殊符号，
// 使「晴天 Live」与「晴天(Live)」这类跨源写法归到同一键；
// 原版/版本差异仍由 versionCompatible 把关，此处只放宽键比较。
// v1.5.0：补标点剥离（严格校验规则①「忽略空格和特殊符号」）。
var VERSION_WORD_RE = /\b(?:live|remix|piano|acoustic|covers?|dj|instrumental|original|version|ver\.?)\b|现场|混音|改编|钢琴|对唱|合唱|翻唱|伴奏|纯音乐|原版/gi;
var PUNCT_RE = /[!！?？.。,，;；:：'’"“”·•\-—–+*#@%^&~=|｜]/g;
function looseTitleKey(rawTitle) {
  return normalizeTitle(String(rawTitle || '').replace(VERSION_WORD_RE, '')).replace(PUNCT_RE, '');
}

var FEAT_TAIL_RE = /\s*(?:\bfeaturing\b|\bfeat\.?|\bft\.?).*$/i;

var VERSION_HINTS = [
  { re: /\blive\b|现场/i, tag: 'live' },
  { re: /\bremix\b|混音|改编/i, tag: 'remix' },
  { re: /\bpiano\b|钢琴/i, tag: 'piano' },
  { re: /\bacoustic\b/i, tag: 'acoustic' },
  { re: /对唱|合唱/i, tag: 'duet' },
  { re: /\bcovers?\b|翻唱/i, tag: 'cover' },
  { re: /伴奏|\binstrumental\b|纯音乐/i, tag: 'instrumental' },
  // v1.5.0 竞速约束：影视版本类后缀也是「特殊版本」，与原曲互斥
  { re: /电影版|剧场版|动画版|电视剧版|影视版/i, tag: 'movie' }
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

// [v1.5.0 竞速核心约束 · 拆分式严格同曲校验] 仅用于竞速兜底通道（酷我/网易云）的同曲
// 匹配；与聚合去重共用的 isSameSong 口径完全隔离，互不影响。
// 口径（二次修订）：先拆分核心歌名与版本标签，再分别校验，四条规则全部满足才算同曲：
// 1) 核心歌名一致：从歌名中剥离版本标签关键词后的剩余文本，去掉空格、标点、大小写
//    后完全一致（不再做「剥版本词后比核心名」的宽松键——旧口径会把 Live 版和原版
//    混为一谈）；
// 2) 版本标签精确匹配（关键）：标签数量与类型都必须对应——原曲是 Live，兜底侧必须
//    是 Live；原曲是原版（无标签），兜底侧也必须是原版（无标签；标题显式写「原版/
//    Original Version」视同无标签）；
// 3) 歌手集合交集：按 、，, / & 和 与 × feat./ft./featuring 拆成歌手集合逐个比对，
//    至少一名匹配（兜底源署名顺序/多人合作写法常与汽水不同，不能只比第一个歌手）；
// 4) 时长：双方都有时长时 |Δ| > 汽水侧 10% 即判不同曲；汽水侧有时长、兜底侧缺失时
//    退回「专辑名也一致」的保守口径（无法核时长就不放行无佐证的候选）。
// 标签提取按任务规格：从歌名末尾往前匹配命中关键词的部分作为版本标签（一首歌可
// 有多个标签，全部提取），剩余部分为核心歌名。src 存正则源串，使用时现编译，
// 避免 /g 正则 test 的 lastIndex 状态污染。
var STRICT_TAG_DEFS = [
  { tag: 'live',         src: '\\b(?:live|concert)版?\\b|现场版?|演唱会' },
  { tag: 'instrumental', src: '伴奏版?|纯音乐|\\binstrumental版?\\b' },
  { tag: 'pure',         src: '纯享版?' },
  { tag: 'remix',        src: '\\bremix(?:es)?版?\\b|混音版?|改编' },
  { tag: 'cover',        src: '\\bcovers?版?\\b|翻唱版?' },
  { tag: 'orig',         src: '原版|\\boriginal(?:\\s+version)?版?\\b' },
  { tag: 'movie',        src: '电影版|剧场版|影视版' },
  { tag: 'tv',           src: '电视剧版|动画版' },
  { tag: 'clip',         src: '片段|节选' },
  { tag: 'ringtone',     src: '铃声版' },
  { tag: 'surround',     src: '\\b3D版?\\b|\\b8D版?\\b|环绕版?' },
  { tag: 'piano',        src: '钢琴版?|\\bpiano版?\\b' },
  { tag: 'guitar',       src: '吉他版?|\\bguitar版?\\b' },
  { tag: 'female',       src: '女声版?' },
  { tag: 'male',         src: '男声版?' },
  { tag: 'child',        src: '童声版?' },
  { tag: 'full',         src: '完整版' },
  { tag: 'acoustic',     src: '\\bacoustic版?\\b' },
  { tag: 'duet',         src: '对唱版?|合唱版?' },
  { tag: 'dj',           src: '\\bDJ版|\\bDJ\\s*version\\b' }
];

var ARTIST_SEP_RE = /\s*(?:[、，,&\/]|\bfeaturing\b|\bfeat\.?|\bft\.?|和|与|×)\s*/i;
function normalizeArtistSet(raw) {
  if (!raw) return [];
  var parts = String(raw).toLowerCase().split(ARTIST_SEP_RE);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].replace(/\s+/g, '').trim();
    if (p && out.indexOf(p) < 0) out.push(p);
  }
  return out;
}

function artistSetsIntersect(a, b) {
  var as = normalizeArtistSet(a), bs = normalizeArtistSet(b);
  if (!as.length || !bs.length) return false;
  for (var i = 0; i < as.length; i++) {
    for (var j = 0; j < bs.length; j++) {
      if (as[i] === bs[j]) return true;
    }
  }
  return false;
}

// 拆分核心歌名与版本标签：返回 { core, tags }。core = 剥离标签关键词与 feat 尾缀、
// 去空括号/标点/空白、转小写后的剩余文本；tags = 命中的版本标签类型列表（去重保序）。
function splitStrictTitle(rawTitle) {
  var title = String(rawTitle || '').replace(FEAT_TAIL_RE, '');
  var tags = [], core = title, i, djFromDef = false;
  for (i = 0; i < STRICT_TAG_DEFS.length; i++) {
    if (new RegExp(STRICT_TAG_DEFS[i].src, 'i').test(title)) {
      tags.push(STRICT_TAG_DEFS[i].tag);
      core = core.replace(new RegExp(STRICT_TAG_DEFS[i].src, 'gi'), '');
      if (STRICT_TAG_DEFS[i].tag === 'dj') djFromDef = true;
    }
  }
  if (!djFromDef && detectDj(title)) {
    // 裸 DJ（括号内或尾部）也计为 dj 标签，并把命中片段从核心名剥掉
    tags.push('dj');
    core = core.replace(/\s*\bdj(?:\s*版|\s*version)?\s*$/i, '');
  }
  // 括号内容整体剥离（标签关键词多写在括号里，已在上面从原始标题提取并移除；
  // 剩余括号内容多为署名/备注，不参与核心名比对），再归一化核心名
  core = core
    .replace(/（[^（）]*）|\([^()]*\)|【[^【】]*】|\[[^\[\]]*\]/g, '')
    .replace(PUNCT_RE, '')
    .replace(/[（）()\[\]【】·・~～_]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  return { core: core, tags: tags };
}

// 版本标签精确匹配：数量与类型都必须对应；「orig」（显式声明原版）视同无标签。
function strictTagSetsEqual(a, b) {
  var na = [], nb = [], i;
  for (i = 0; i < a.length; i++) {
    if (a[i] !== 'orig' && na.indexOf(a[i]) < 0) na.push(a[i]);
  }
  for (i = 0; i < b.length; i++) {
    if (b[i] !== 'orig' && nb.indexOf(b[i]) < 0) nb.push(b[i]);
  }
  if (na.length !== nb.length) return false;
  na.sort(); nb.sort();
  for (i = 0; i < na.length; i++) { if (na[i] !== nb[i]) return false; }
  return true;
}

function isSameSongStrict(a, b) {
  // ①② 先拆分核心歌名与版本标签，再分别校验
  var pa = splitStrictTitle(a.title), pb = splitStrictTitle(b.title);
  if (pa.core !== pb.core) return false;
  if (!strictTagSetsEqual(pa.tags, pb.tags)) return false;
  // ③ 歌手集合交集
  if (!artistSetsIntersect(a.artist, b.artist)) return false;
  // ④ 时长 10% 容差
  if (a.duration > 0 && b.duration > 0) {
    return Math.abs(a.duration - b.duration) <= a.duration * 0.10;
  }
  if (a.duration > 0) {
    // 汽水侧有时长、兜底侧缺失 → 无法核时长，退回「专辑名也一致」的保守口径
    return !!a.album && !!b.album && normalizeTitle(a.album) === normalizeTitle(b.album);
  }
  // 汽水侧无时长 → 10% 规则不适用，由曲名/歌手/版本三道把关
  return true;
}

// ==================== 源权重与音质能力 ====================

var SOURCE_WEIGHT = {
  qishui: 0.50
};

// v1.1.0 🟠-3 音质如实声明：全通道实际产出一档 ≈128k m4a（bugpk video_meta.real_bitrate
// ≈129663bps、分享页 preview/full 同级），声明 4 档属假支持，收敛为单档 standard（128k）。
var SOURCE_QUALITIES = {
  qishui: ['standard'] // 实测单档 ≈128k m4a；通道升级（真无损直链出现）后再扩档
};


function canServe(source, quality) {
  var caps = SOURCE_QUALITIES[source] || [];
  if (source === 'qishui') return true; // 单档兜底源
  return caps.indexOf(quality) >= 0;
}

// ==================== 汽水搜索适配器 ====================
// 每个适配器返回统一内部条目：
// { source, sid, title, artist, album, duration(sec, 可为0), artwork, raw }

// 汽水封面构造（文档 15）：url_cover = {uri, urls[]}，urls 为 CDN 基址，
// 完整 URL = urls[0] + uri + '~noop.image'（无后缀实测 400 fail to get template）。
function qishuiCover(urlCover) {
  if (!urlCover) return '';
  if (typeof urlCover === 'string') {
    return /^https?:\/\//.test(urlCover) ? urlCover : '';
  }
  var base = urlCover.urls && urlCover.urls[0];
  var uri = urlCover.uri;
  if (!base || !uri) return '';
  return base + uri + '~noop.image';
}

// ==================== v1.4.0 音质大小 / VIP 标记映射 ====================
// 上游 bit_rates（quality/br/size 三元组，2026-09-07 实测 PC 搜索/榜单/歌单三端点恒返回）
// → 宿主 qualities。键口径用宿主原生键：fork qualities.ts convertLegacyQuality 会把
// legacy 键 standard→192k / high→320k / super→flac 错位映射，且 getAvailableQualities
// 与 getSmartQuality 均按 supportedQualities（128k/192k/320k/flac）取键，legacy 键会
// 丢 128k 档。上游 PC 端无 lossless 及以上档——flac/hires 无实测 size 不挂键（宁缺毋假）。
var BIT_RATE_KEY_MAP = {
  medium: '128k', higher: '192k', highest: '320k',
  lossless: 'flac', hi_res: 'hires'
};

function qualitiesFromBitRates(bitRates) {
  var out = {};
  if (!bitRates || !bitRates.length) return out;
  for (var i = 0; i < bitRates.length; i++) {
    var b = bitRates[i] || {};
    var key = BIT_RATE_KEY_MAP[b.quality];
    if (!key) continue;
    // [v1.9.7 菜单 size 诚实性修正] 上游 bit_rates.size 是汽水自有通道标称档
    // （medium≈64k / higher≈130k / highest≈260k）的文件大小；实际交付常由跨源兜底
    // （酷我真 128k/320k，VBR 97k~136k）胜出。2026-09-11 逐曲 HEAD（Range 0-0
    // Content-Range）探测 8 曲 16 次实测：320k 档偏差 0.99~1.23 倍、128k 档偏差
    // 1.47~2.05 倍，且 VBR 波动无法用公式换算、取链前无法预知胜出通道——菜单不再
    // 挂该标称 size（宁缺毋假）；下载面板大小以 getMediaSource 返回的 probeHeadSize
    // 实测 size 为准（本轮 16/16 与 HEAD 实测完全一致）。
    var entry = {};
    if (typeof b.br === 'number' && b.br > 0) entry.bitrate = b.br;
    if (!Object.keys(entry).length) continue;
    out[key] = entry;
  }
  return out;
}

// [v1.9.5] feeOfTrack（VIP 标记判定）已随 fee 停写整体移除。

function searchQishui(query, page) {
  var params = {
    aid: 386088, app_name: 'luna_pc', device_id: '2170852561392692',
    version_name: '1.7.0', version_code: 10070000, ac: 'wifi',
    tz_name: 'Asia/Shanghai', device_platform: 'windows',
    device_type: 'Windows', os_version: 'Windows',
    q: query, count: 20, search_method: 'history', cursor: (page - 1) * 20
  };
  return axios.get('https://api.qishui.com/luna/search/track', {
    params: params, timeout: SOURCE_TIMEOUT,
    headers: {
      'User-Agent': 'LunaPC/3.0.0(290101097)',
      Referer: 'https://api.qishui.com/'
    }
  }).then(function (res) {
    var groups = (res.data && res.data.result_groups) || [];
    var data = [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] && groups[i].id === 'tracks' && groups[i].data) { data = groups[i].data; break; }
    }
    var out = [];
    for (var j = 0; j < data.length; j++) {
      var d = data[j];
      // v1.7.0 P1：entity.track 主路径实测正确（result_groups[].id=='tracks' → data[].entity.track），
      // 防御性兼容不同端/版本响应多包一层的情况：entity.track_wrapper.track / d.track
      var t = d && d.entity && d.entity.track;
      if (!t && d && d.entity && d.entity.track_wrapper) t = d.entity.track_wrapper.track;
      if (!t && d && d.track) t = d.track;
      if (!t || !t.id || !t.name) continue;
      out.push({
        source: 'qishui', sid: str(t.id),
        title: str(t.name), artist: splitArtists(t.artists),
        album: t.album && t.album.name ? String(t.album.name) : '',
        duration: t.duration ? Math.round(t.duration / 1000) : 0,
        artwork: qishuiCover(t.album && t.album.url_cover),
        // v1.4.0 P0 -> v1.9.5：bit_rates 原样携带，聚合构建器统一映射 qualities；
        // fee（VIP 标识）停写
        rates: t.bit_rates,
        raw: { trackId: str(t.id) }
      });
    }
    return out;
  });
}

var SEARCH_ADAPTERS = {
  qishui: searchQishui
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
    // v1.8.2（P2-1）：宿主 canPlayMusicVideo 按 platform 反查插件，音乐条目必须带平台
    platform: best.source || 'qishui',
    title: best.title,
    artist: best.artist,
    album: best.album,
    artwork: artwork || undefined,
    duration: duration || undefined,
    // v1.8.0 P0：汽水无 MV 通道，显式置 is_video: false，对齐宿主 canPlayMusicVideo
    // 守卫的 9 字段策略，让宿主可观测地走「无 MV」路径（vs 缺省 undefined 行为）。
    is_video: false,
    _src: src,
    _srcOrder: srcOrder
  };
  // v1.4.0 P0：音质大小——代表成员的 bit_rates 派生 qualities（宿主下载面板大小列/
  // 进度总量兜底/getSmartQuality 三处消费）；代表缺档时取首个有档成员。
  var qualities = qualitiesFromBitRates(best.rates);
  if (!Object.keys(qualities).length) {
    for (var qm = 0; qm < members.length; qm++) {
      var qAlt = qualitiesFromBitRates(members[qm].rates);
      if (Object.keys(qAlt).length) { qualities = qAlt; break; }
    }
  }
  if (Object.keys(qualities).length) item.qualities = qualities;
  // v1.4.0 P1 -> v1.9.5：fee（VIP 标识）停写不再透传。
  return item;
}

// ==================== 聚合榜单 ====================
// 汽水榜单：luna/pc/charts 单源榜单；条目 _src 携带汽水 raw，走 resolveWithFallback 取链。
// 端点来自《汽水音乐接口文档》实测记录。


var CHART_TTL_MS = 30 * 60 * 1000;
var chartCache = {};   // { defId: { ts, list } }
var chartInflight = {}; // { defId: Promise } 并发去重

var CHART_DEFS = [
  {
    id: 'agg-hot', title: '热歌榜',
    cover: 'https://p3-luna.douyinpic.com/img/tos-cn-i-b829550vbb/d0d8d48461a62748e84689cdf049b19a.png~tplv-b829550vbb-resize:960:960.png',
    members: [
      { source: 'qishui', id: '7036274230471712007' }
    ]
  },
  {
    id: 'agg-new', title: '新歌榜',
    cover: 'https://p3-luna.douyinpic.com/img/tos-cn-i-b829550vbb/f12f7eb5b54d0899c7c724df009668a8.png~tplv-b829550vbb-resize:960:960.png',
    members: [
      { source: 'qishui', id: '7060812597884869927' }
    ]
  },
  {
    id: 'agg-west', title: '欧美榜',
    cover: 'https://p3-luna.douyinpic.com/img/tos-cn-i-b829550vbb/33747550ed5499b58feda42a21748637.png~tplv-b829550vbb-resize:960:960.png',
    members: [
      { source: 'qishui', id: '7061475546400005410' }
    ]
  },
  {
    // v1.1.0 🟡-6：音乐人歌曲榜（chart_id 7415959718721494311，28 首，实测存活）
    id: 'agg-musician', title: '音乐人歌曲榜',
    cover: 'https://p3-luna.douyinpic.com/img/tos-cn-v-2774c002/o8FQKiQQBxHWa2hzsBNAgYOX6iEHEAibADAbfB~tplv-b829550vbb-resize:960:960.png',
    members: [
      { source: 'qishui', id: '7415959718721494311' }
    ]
  }
];


var CHART_FETCHERS = {
  qishui: function (chartId) {
    return axios.get('https://api.qishui.com/luna/pc/charts/' + chartId, {
      params: { aid: 386088, app_name: 'luna_pc', device_platform: 'web', version_code: '1.0.0' },
      timeout: SOURCE_TIMEOUT,
      headers: { 'User-Agent': 'LunaPC/3.0.0(290101097)' }
    }).then(function (res) {
      var chart = res.data && res.data.chart;
      var list = (chart && chart.track_ranks) || [];
      return list.map(function (tr) {
        var t = (tr && tr.track) || tr || {};
        var al = t.album || {};
        var tsid = str(t.id || t.track_id);
        return {
          source: 'qishui', sid: tsid,
          title: str(t.name), artist: splitArtists(t.artists),
          album: al.name ? String(al.name) : '',
          duration: t.duration ? Math.round(t.duration / 1000) : 0,
          artwork: qishuiCover(al.url_cover),
          rates: t.bit_rates, // v1.4.0 P0；v1.9.5 fee（VIP 标识）停写
          raw: { trackId: tsid }
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
  var item = {
    id: 'c_' + base.source + '_' + base.item.sid,
    title: base.item.title,
    artist: base.item.artist,
    album: base.item.album || undefined,
    duration: duration || undefined,
    artwork: base.item.artwork || undefined,
    _src: src
  };
  // v1.4.0 P0：音质大小/VIP 标记（代表条目派生，缺档顺延其余命中）
  var qualities = qualitiesFromBitRates(base.item.rates);
  if (!Object.keys(qualities).length) {
    for (var qi = 0; qi < entry.hits.length; qi++) {
      var qAlt = qualitiesFromBitRates(entry.hits[qi].item.rates);
      if (Object.keys(qAlt).length) { qualities = qAlt; break; }
    }
  }
  if (Object.keys(qualities).length) item.qualities = qualities;
  // v1.9.5：fee（VIP 标识）停写不再透传。
  return item;
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

// ==================== 歌单导入 ====================
// 端点实测：汽水 luna/playlist/detail（count+cursor 游标分页；entity.track_wrapper.track，duration 毫秒）


var SHEET_MAX_PAGES = 4;      // 单源最多翻 4 页（插件方法 10s 硬上限内）
var SHEET_MAX_ITEMS = 500;    // 导入条数上限（防超时）

/** 各平台歌单 URL → 歌单 id（全部为实测存在的链接格式；返回 null 表示不认识） */
var SHEET_URL_RESOLVERS = {
  qishui: function (s) {
    // v1.1.0 🟡-9：域名门锚定——host 必须以 douyin.com/qishui.com 结尾，
    // 防「evil.com/?x=douyin.com」这类子串误配
    if (!/^https?:\/\/([a-z0-9-]+\.)*(douyin|qishui)\.com(?:[:\/?#]|$)/i.test(s)) return null;
    var m = /[?&]playlist_id=(\d+)/.exec(s);
    return m ? m[1] : null;
  }
};



/** 跟随 302 短链：v1.1.0 🟡-8 最多 3 跳 + 链级 6s 总预算（基线 5 跳 × 每跳 4.5s 可耗 22s+），
 * 返回最终 URL；非 3xx 原样返回。单跳超时 REDIRECT_HOP_TIMEOUT，总预算 REDIRECT_CHAIN_BUDGET_MS */
async function followRedirects(url) {
  var deadline = Date.now() + REDIRECT_CHAIN_BUDGET_MS;
  var cur = url;
  for (var i = 0; i < 3; i++) {
    var hopBudget = deadline - Date.now();
    if (hopBudget <= 0) break;
    if (hopBudget > REDIRECT_HOP_TIMEOUT) hopBudget = REDIRECT_HOP_TIMEOUT;
    var res = await axios.get(cur, {
      timeout: hopBudget,
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
 * 解析歌单链接/纯数字 id → { source, id }
 * 支持：汽水网页链接（含 playlist_id 参数）；汽水 qishui.douyin.com/s 短链（302 跟随）。
 * 纯数字 id 无法唯一判定来源，不猜。
 */
// [v1.8.2 P2-4] 歌单导入错误统一构造——message 原样展示给宿主，code 供宿主结构化处理。
function sheetImportError(code, msg) {
  var e = new Error('[qishui] ' + msg);
  e.code = code;
  e.platform = 'qishui';
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
  if (/^\d{5,}$/.test(s)) throw sheetImportError('SHEET_URL_UNRECOGNIZED', '纯数字歌单 id 无法判定平台，请粘贴带域名的完整分享链接');

  // 短链：先跟随 302 再匹配（汽水 qishui.douyin.com/s/xx）
  if (/^https?:\/\/qishui\.douyin\.com\/s\//.test(s)) {
    s = await followRedirects(s);
  }

  var sources = ['qishui'];
  for (var i = 0; i < sources.length; i++) {
    var id = SHEET_URL_RESOLVERS[sources[i]](s);
    if (id) return { source: sources[i], id: id };
  }
  throw sheetImportError('SHEET_URL_UNRECOGNIZED', '无法识别的歌单链接（支持汽水的网页或分享链接）');
}

var SHEET_FETCHERS = {
  qishui: async function (playlistId) {
    var out = [];
    var sheetMeta = null; // [v1.8.4] 歌单元数据（playlist 对象，随分页首页响应零额外请求捕获）
    var cursor = '0';
    for (var page = 0; page < SHEET_MAX_PAGES && out.length < SHEET_MAX_ITEMS; page++) {
      var res = await axios.get('https://api.qishui.com/luna/playlist/detail', {
        params: { playlist_id: playlistId, count: 50, cursor: cursor, aid: 386088, app_name: 'luna_pc', device_platform: 'web', version_code: '1.0.0' },
        timeout: SOURCE_TIMEOUT,
        headers: { 'User-Agent': 'LunaPC/3.0.0(290101097)' }
      });
      // [v1.8.4] 首页响应自带歌单元数据；实测无 desc/description 字段，不传歌单介绍
      if (!sheetMeta && res.data && res.data.playlist) {
        var plm = res.data.playlist;
        sheetMeta = {
          title: str(plm.title || plm.public_title || plm.name),
          artwork: qishuiCover(plm.url_cover) || undefined,
          artist: (plm.owner && plm.owner.nickname) ? str(plm.owner.nickname) : undefined,
          worksNum: parseInt(plm.count_tracks, 10) || undefined
        };
      }
      var mr = res.data && res.data.media_resources;
      var list = mr || [];
      for (var i = 0; i < list.length; i++) {
        var ent = list[i].entity || {};
        var t = (ent.track_wrapper && ent.track_wrapper.track) || ent.track || {};
        var al = t.album || {};
        var cover = qishuiCover(al.url_cover);
        out.push({
          source: 'qishui', sid: str(t.id || t.track_id),
          title: str(t.name),
          artist: splitArtists(t.artists),
          album: al.name ? String(al.name) : '',
          duration: t.duration ? Math.round(t.duration / 1000) : 0,
          artwork: cover ? String(cover) : '',
          rates: t.bit_rates, // v1.4.0 P0；v1.9.5 fee（VIP 标识）停写
          raw: { trackId: str(t.id || t.track_id) }
        });
      }
      if (!res.data || !res.data.has_more || !res.data.next_cursor) break;
      cursor = String(res.data.next_cursor);
    }
    // [v1.8.4] 元数据挂在过滤结果上，供 importMusicSheetImpl 组装完整歌单对象
    var filtered = out.filter(function (it) { return it.sid && it.title; });
    filtered.meta = sheetMeta;
    return filtered;
  }
};


// ==================== 推荐歌单分类（v1.2.1 新增，实现参考 baka v3.2.6） ====================
// 接口：POST https://api.qishui.com/luna/pc/discover/mix
//   body.sub_channel_id 选频道（0=每日推荐），body.cursor 翻页（实测传 (page-1)*20 有效）；
//   响应 inner_block[].resources[].entity.playlist 为歌单对象（url_cover 为 {uri,urls[]} 形态）。
// 宿主 sheetBody.tsx 按 (tags?.pinned ?? []).map 渲染横向 pill → pinned 必须是扁平数组。
var QISHUI_SHEET_TAGS = [
  { id: 0, title: '每日推荐' }, { id: 14, title: '流行' }, { id: 8, title: '华语' },
  { id: 9, title: '欧美' }, { id: 20, title: '国风' }, { id: 18, title: '民谣' },
  { id: 15, title: '摇滚' }, { id: 38, title: '说唱' }, { id: 16, title: '电子' },
  { id: 19, title: 'R&B' }, { id: 69, title: '治愈' }, { id: 45, title: '睡前' },
  { id: 40, title: '学习' }
];

// v1.2.2：宿主歌单广场进入时默认选中的 tag 是 { title: '默认', id: '' }（sheetBody.tsx
// defaultTag），不是 pinned[0]（{id:0}）。空串 parseInt 为 NaN，此前靠 isNaN→0 隐式兜底，
// 现显式化：tag 缺失 / id 空串 / 非数字 一律映射默认推荐频道 sub_channel_id=0
// （与 pinned 首个「每日推荐」同一数据源），空 id 时返回的就是歌单默认推荐数据。
function qishuiSubChannelIdOf(tag) {
  var raw = tag && tag.id !== undefined && tag.id !== null ? String(tag.id) : '';
  var n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

function qishuiMixRequest(subChannelId, page) {
  return axios.post('https://api.qishui.com/luna/pc/discover/mix', {
    block_type: 'discover_playlist_mix',
    feed_discover_extra: {},
    latest_douyin_liked_playlist_show_ts: 0,
    sub_channel_id: subChannelId,
    cursor: (page - 1) * 20
  }, {
    params: { aid: 386088, app_name: 'luna_pc', device_platform: 'web', version_code: '1.0.0' },
    timeout: SOURCE_TIMEOUT,
    headers: {
      'User-Agent': 'LunaPC/3.0.0(290101097)',
      Referer: 'https://api.qishui.com/',
      'Content-Type': 'application/json'
    }
  });
}

// inner_block[].resources[].entity.playlist → 歌单条目（v1.2.2 抽出复用）
function qishuiMixParse(resData) {
  var blocks = (resData && resData.inner_block) || [];
  var data = [];
  for (var i = 0; i < blocks.length; i++) {
    var rs = (blocks[i] && blocks[i].resources) || [];
    for (var j = 0; j < rs.length; j++) {
      var ent = rs[j] && rs[j].entity;
      var pl = ent && ent.playlist;
      if (!pl || !pl.id) continue;
      var cover = qishuiCover(pl.url_cover);
      data.push({
        id: String(pl.id),
        // v1.8.2（P2-6）：推荐歌单条目补 platform（宿主按 platform 反查插件；实测 v1.8.1 缺失）
        platform: 'qishui',
        title: str(pl.title || pl.public_title || pl.name),
        artist: str((pl.owner && pl.owner.nickname) ||
          (pl.user_artist_info && pl.user_artist_info.user_brief && pl.user_artist_info.user_brief.nickname)),
        artwork: cover || undefined,
        worksNum: pl.count_tracks || (pl.resource_cnt && pl.resource_cnt.track_cnt) || 0,
        description: pl.desc ? String(pl.desc) : undefined,
        // v1.2.1：携带 _ssrc（与搜索歌单条目同形态），宿主点进分类歌单时
        // getMusicSheetInfoImpl 依赖 sheetItem._ssrc.<源>.listId 拉取曲目
        _ssrc: { qishui: { listId: String(pl.id) } }
      });
    }
  }
  return { data: data, hasMore: !!(resData && resData.has_more === true) };
}

async function getRecommendSheetsByTagImpl(tag, page) {
  var subChannelId = qishuiSubChannelIdOf(tag);
  var parsed = qishuiMixParse((await qishuiMixRequest(subChannelId, page)).data);
  // v1.2.2 空结果兜底（默认页 id='' 走的就是默认推荐频道）：
  //   ① 指定频道 0 条 → 回退默认推荐频道（sub_channel_id=0，pinned「每日推荐」同源）；
  //   ② 默认推荐频道偶发 0 条（上游只回非歌单实体卡片）→ 同请求重试一次；仍空才如实返回。
  if (!parsed.data.length && subChannelId !== 0) {
    parsed = qishuiMixParse((await qishuiMixRequest(0, page)).data);
  }
  if (!parsed.data.length && subChannelId === 0) {
    parsed = qishuiMixParse((await qishuiMixRequest(0, page)).data);
  }
  return { isEnd: !parsed.hasMore, data: parsed.data };
}

/** 归一化歌单条目 → 聚合条目（_src 带单源 raw，复用取链接力） */
function buildSheetItem(entry) {
  var src = {};
  src[entry.source] = entry.raw;
  var item = {
    id: entry.source + '_' + entry.sid,
    // v1.8.2（P2-1）：宿主按 platform 反查插件，歌单条目同样带上
    platform: entry.source || 'qishui',
    title: entry.title,
    artist: entry.artist,
    album: entry.album || undefined,
    duration: entry.duration || undefined,
    artwork: entry.artwork || undefined,
    _src: src,
    _srcOrder: [entry.source]
  };
  // v1.4.0 P0：音质大小/VIP 标记透传（歌单搜索/歌单导入/单曲导入共用）
  var qualities = qualitiesFromBitRates(entry.rates);
  if (Object.keys(qualities).length) item.qualities = qualities;
  // v1.9.5：fee（VIP 标识）停写不再透传。
  return item;
}

/**
 * 导入歌单：urlLike 支持汽水的网页/分享链接（含汽水短链）。
 * [v1.8.4] 返回完整 IMusicSheetItem 歌单对象（对齐宿主 IImportMusicSheetResult）：
 * title/artwork/worksNum 随 luna/playlist/detail 响应 playlist 对象零额外请求回传，
 * 实测无 desc 字段故不传 description（宿主契约可选，不造假内容）。
 * musicList 条目带单源 _src，播放时复用取链接力。
 */
async function importMusicSheetImpl(urlLike) {
  var resolved = await resolveSheetId(urlLike);
  var fetcher = SHEET_FETCHERS[resolved.source];
  if (!fetcher) throw sheetImportError('SHEET_URL_UNRECOGNIZED', '该平台暂不支持歌单导入');
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
  // [v1.8.4] 组装完整歌单对象返回宿主（title 缺失时走兜底，避免「来自qishui的歌单」）
  var meta = entries.meta || null;
  var sheet = {
    id: 'qishui_' + resolved.id,
    platform: 'qishui',
    isImported: true,
    title: (meta && meta.title) || ('汽水歌单 #' + resolved.id),
    artwork: (meta && meta.artwork) || (out[0] && out[0].artwork) || undefined,
    worksNum: (meta && meta.worksNum) || out.length,
    musicList: out
  };
  if (meta && meta.artist) { sheet.artist = meta.artist; sheet.author = meta.artist; } // [v1.9.1] author 别名（任务字段清单要求 author，宿主协议用 artist）
  return sheet;
}

// ==================== 单曲导入 & 歌曲详情（v0.7.0 P0-3/P0-4）====================
// 端点实测（artifacts/v07-probe/probe12.mjs + 汽水分享页探针，2026-09-06）：
// qishui 分享页 _ROUTER_DATA.loaderData.track_page.audioWithLyricsOption：
//        track_id/trackName/artistName/artistIdStr/coverURL/duration/album_id/vid（本沙箱实测）


var SONG_URL_RESOLVERS = {
  qishui: function (s) {
    // v1.1.0 🟡-9：域名门锚定（同 SHEET_URL_RESOLVERS，host 必须以 douyin/qishui.com 结尾）
    if (!/^https?:\/\/([a-z0-9-]+\.)*(douyin|qishui)\.com(?:[:\/?#]|$)/i.test(s)) return null;
    var m = /[?&]track_id=(\d+)/.exec(s) || /\/track\/(\d+)/.exec(s);
    return m ? m[1] : null;
  },
};


/**
 * 解析单曲分享链接 → { source, id }
 * 短链（qishui.douyin.com/s）先 302 跟随再匹配；
 * 纯数字 id 无法唯一判定来源，不猜。
 */
async function resolveSongId(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw new Error('单曲链接为空');
  if (/^https?:\/\/qishui\.douyin\.com\/s/.test(s)) {
    s = await followRedirects(s);
  }
  if (/^\d{5,}$/.test(s)) throw new Error('纯数字歌曲 id 无法判定平台，请粘贴带域名的完整分享链接');

  var sources = ['qishui'];
  for (var i = 0; i < sources.length; i++) {
    // v1.1.0 🟡-7：只调一次解析器（基线在 if 和赋值处各调一次，双重调用）
    var id = SONG_URL_RESOLVERS[sources[i]](s);
    if (id) return { source: sources[i], id: id };
  }
  throw new Error('无法识别的单曲链接（支持汽水的歌曲分享链接）');
}

var SONG_DETAIL_FETCHERS = {
  // v1.1.0：复用 fetchShareTrackPage 共享 helper（与取链/歌词同一解析逻辑，消除三处重复实现）
  qishui: function (trackId) {
    return fetchShareTrackPage(trackId, SOURCE_TIMEOUT).then(function (r) {
      var page = r.page;
      var opt = page && page.audioWithLyricsOption;
      if (!opt || !opt.track_id) throw new Error('qishui detail empty');
      var dur = typeof opt.duration === 'number' ? opt.duration : 0;
      return {
        source: 'qishui', sid: str(opt.track_id),
        title: str(opt.trackName), artist: str(opt.artistName),
        album: '',
        duration: dur > 3000 ? Math.round(dur / 1000) : Math.round(dur),
        artwork: qishuiCover(opt.coverURL),
        // v1.4.0 P0：分享页 trackInfo 携带 bit_rates/preview（实测路径
        // audioWithLyricsOption.trackInfo.bit_rates），供 getMusicInfo 大小兜底
        rates: (opt.trackInfo && opt.trackInfo.bit_rates) || undefined,
        raw: { trackId: str(opt.track_id) } // v1.9.5 fee（VIP 标识）停写
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
 * 只补空缺字段（artwork/album/duration/mv/videoId），不覆盖已有值。
 */
async function getMusicInfoImpl(musicItem) {
  if (!musicItem) return musicItem;
  // [v1.8.1 P0-2] 裸 ID playById 反查——汽水主键为 id（fetcher 取 trackId，
  // 宿主把所有 ID 字段写为同一字符串故 musicItem.id 等价），复用 SONG_DETAIL_FETCHERS
  // + buildSheetItem 重建条目（与 importMusicItemImpl 同路径）。参照 migu 兜底模式。
  if (!musicItem._src) {
    try {
      var bareId = String(musicItem.id || '').trim();
      if (bareId && SONG_DETAIL_FETCHERS.qishui) {
        var entry = await SONG_DETAIL_FETCHERS.qishui(bareId);
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
  var sidKey = { qishui: 'trackId' };

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
      if (detail.raw && detail.raw.vid && !musicItem.videoId) musicItem.videoId = String(detail.raw.vid);
      // v1.4.0 P0：qualities/fee 兜底（分享页 trackInfo.bit_rates → 每档大小），
      // 条目缺 qualities 时补齐，确保点进下载面板时大小列可用
      if (!musicItem.qualities || !Object.keys(musicItem.qualities).length) {
        var dq = qualitiesFromBitRates(detail.rates);
        if (Object.keys(dq).length) musicItem.qualities = dq;
      }
      // v1.9.5：fee（VIP 标识）停写不再回填。
      if (musicItem.artwork && musicItem.duration) break; // 关键字段齐了就停
    } catch (e) { /* 详情可选，失败换下个源 */ }
  }
  return musicItem;
}

// ==================== 汽水取链适配器 ====================

// 宿主音质键（fork: 96k/128k/192k/320k/flac/flac24bit/hires/master/atmos...）→ 插件内部档位。
// v0.6.0 及之前宿主传入 '320k'/'master' 会被当未知档落回 standard，此映射修正为正确档位。
var QUALITY_KEY_MAP = {
  '96k': 'standard', '128k': 'standard',
  '192k': 'high', '320k': 'high',
  'flac': 'super', 'flac24bit': 'super',
  'hires': 'hires', 'master': 'hires', 'atmos': 'hires', 'atmos_plus': 'hires', 'dolby': 'hires', 'vinyl': 'hires'
};
function normalizeQuality(q) {
  var s = String(q || '');
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'standard' || s === 'high' || s === 'super' || s === 'hires') return s;
  return 'standard';
}

// [v0.7.2 fix#10 P1] 音质诚实性：actualQuality 由各取链通道按实际命中档位直接上报
// （宿主音质键口径：128k/192k/320k/flac/flac24bit/hires）。v1.1.0 删除未再使用的
// internalToHostQuality 转换层（音质收敛单档后无转换需求）。取不到确定档位的通道
// 不填该字段（宁缺毋假）。

// ---------- 汽水 track.php（v0.6.0，配合宿主 CENC 解密） ----------
// v1.1.0 🔴-1：双宿主实测已死（qishui.lxmapi.icu 返回 nginx 403 HTML 页、api.qishui.com 404），
// 本通道降为末位备源并加快速失败（响应开头是 '<' 即 HTML 错误页，不解密直接抛错接力）；
// 通道若恢复，负缓存过期后自动重新启用。
// 响应层：Base64 + AES-128-CBC（KEY/IV 见汽水文档 §12.5.1）；音频流层：CENC 加密 MP4，
// 插件返回 { url, cek }，宿主 Cenc.registerStream 用每样本 IV 的 AES-128-CTR 原生解密。
var QISHUI_TP_HOSTS = [
  'https://qishui.lxmapi.icu/apis/track.php',
  'https://api.qishui.com/apis/track.php'
];
var QISHUI_TP_KEY = 'seekmusicv260409';
var QISHUI_TP_IV = '260409seekmusicv';

// WordArray 头部去 N 字节（处理响应密文带 UTF-8 BOM EF BB BF 的情况）
function waDropHead(wa, n) {
  var words = wa.words;
  var dropWords = Math.floor(n / 4);
  var bitShift = (n % 4) * 8;
  var out = [];
  for (var i = dropWords; i < words.length; i++) {
    var w = words[i] >>> 0;
    if (bitShift) {
      var nxt = (i + 1 < words.length) ? (words[i + 1] >>> 0) : 0;
      w = ((w << bitShift) | (nxt >>> (32 - bitShift))) >>> 0;
    }
    out.push(w | 0);
  }
  return require('crypto-js').lib.WordArray.create(out, wa.sigBytes - n);
}

function decryptQishuiTrackResp(b64Text) {
  var CryptoJS = require('crypto-js');
  var wa = CryptoJS.enc.Base64.parse(String(b64Text).trim());
  var w0 = wa.words[0] >>> 0;
  if (wa.sigBytes >= 3 && (w0 >>> 24) === 0xef && ((w0 >>> 16) & 0xff) === 0xbb && ((w0 >>> 8) & 0xff) === 0xbf) {
    wa = waDropHead(wa, 3);
  }
  var decrypted = CryptoJS.AES.decrypt(
    { ciphertext: wa },
    CryptoJS.enc.Utf8.parse(QISHUI_TP_KEY),
    { iv: CryptoJS.enc.Utf8.parse(QISHUI_TP_IV), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  var json = decrypted.toString(CryptoJS.enc.Utf8);
  // BOM 可能出现在密文头（上面已剥）或明文头（部分实现把 BOM 编进了待加密文本），两头都处理
  json = json.replace(/^\uFEFF+/, '').trim();
  if (!json) throw new Error('qishui track.php decrypt empty');
  return json;
}

var QISHUI_TP_LEVEL = {
  super: ['lossless', 'highest', 'higher', 'medium'],
  high: ['highest', 'higher', 'medium'],
  standard: ['highest', 'higher', 'medium']
};
// [v0.7.2 fix#10] actualQuality：汽水 level → 宿主音质键。汽水不暴露精确码率字段，
// 此映射为保守近似（宁低勿高）：lossless=FLAC；highest/higher/medium 为 AAC 三档。
var QISHUI_ACTUAL = { lossless: 'flac', highest: '320k', higher: '192k', medium: '128k' };

function resolveQishuiTrackPhp(raw, quality) {
  if (!raw || !raw.trackId) return Promise.reject(new Error('qishui no trackId'));
  var order = QISHUI_TP_LEVEL[quality] || QISHUI_TP_LEVEL.standard;
  var tryHost = function (hi) {
    if (hi >= QISHUI_TP_HOSTS.length) {
      return Promise.reject(new Error('qishui track.php all hosts failed'));
    }
    return axios.get(QISHUI_TP_HOSTS[hi], {
      params: { track_id: raw.trackId },
      timeout: CHAN_TIMEOUT.track_php,
      responseType: 'text',
      headers: { 'User-Agent': 'LunaPC/3.0.0(290101097)' }
    }).then(function (res) {
      var body = typeof res.data === 'string' ? res.data : String(res.data || '');
      if (!body) throw new Error('qishui track.php empty');
      // v1.1.0 🔴-1 快速失败：403/404 时宿主返回 nginx HTML 错误页（首字符 '<'），
      // Base64 解析/AES 解密必然失败且浪费预算，直接抛错接力下一宿主
      if (body.charAt(0) === '<' || /<html|403 forbidden|404 not found|nginx/i.test(body.slice(0, 200))) {
        throw new Error('qishui track.php dead gateway (html/' + (res.status || '?') + ')');
      }
      var data = JSON.parse(decryptQishuiTrackResp(body));
      var audios = data && data.data && data.data.audios;
      if (!audios || !audios.length) throw new Error('qishui track.php no audios');
      var pick = function (a) {
        return a && a.url && a.decrypt_key ? { url: String(a.url), cek: String(a.decrypt_key) } : null;
      };
      // 按请求档位的 level 顺序选档（URL 短时效约 3 分钟，cacheControl no-store 现取现用）
      for (var li = 0; li < order.length; li++) {
        for (var ai = 0; ai < audios.length; ai++) {
          if (audios[ai] && audios[ai].level === order[li]) {
            var hit = pick(audios[ai]);
            if (hit) {
              // [v0.7.2 fix#10] actualQuality：按实际命中的 level 上报
              hit.actualQuality = QISHUI_ACTUAL[audios[ai].level];
              hit.channel = 'track_php'; // v1.1.0 🟢-10 取链结果标记通道
              return hit;
            }
          }
        }
      }
      // 请求档位全缺时取任一有效档（翻唱/网络歌曲常只有 AAC 三档）
      for (var aj = 0; aj < audios.length; aj++) {
        var any = pick(audios[aj]);
        if (any) {
          // [v0.7.2 fix#10] actualQuality：降级取档时按实际 level 上报（未知 level 不报）
          if (audios[aj] && audios[aj].level) any.actualQuality = QISHUI_ACTUAL[audios[aj].level];
          any.channel = 'track_php'; // v1.1.0 🟢-10 取链结果标记通道
          return any;
        }
      }
      throw new Error('qishui track.php no usable audio');
    }).catch(function () { return tryHost(hi + 1); });
  };
  return tryHost(0);
}

// ---------- v1.1.0 🔴-1 主取链通道重建 ----------
// 通道序（免登录，全部实测验证）：
//   ① share_page 分享页 _ROUTER_DATA 直连算法（v4 §26 同源方案，实测 ~0.6-2s，200 明文直链）
//   ② bugpk qsmusic（v4 §25.1，明文直链 + KRC 逐字歌词，实测 ~1-2s，限速 2req/s，仅作顺位备源）
//   ③ track.php CENC（双宿主实测已死 403/404，末位保留 + 快速失败 + 负缓存，恢复后自动启用）

// v4 §26：分享链接 302 落地页即 music.douyin.com/qishui/share/track?track_id=xx，
// 直接拼该 URL 免一次 302 跳转（实测等价）。
function qishuiSharePageUrl(trackId) {
  return 'https://music.douyin.com/qishui/share/track?track_id=' + encodeURIComponent(String(trackId));
}

// 共享 helper：拉取分享页 HTML 并解析 _ROUTER_DATA.track_page.audioWithLyricsOption。
// 失败一律 throw（含试听片段场景），由上层通道接力。歌词/详情/取链三处共用。
function fetchShareTrackPage(trackId, timeoutMs) {
  var tmo = timeoutMs || CHAN_TIMEOUT.share_page;
  var once = function (t) {
    return axios.get('https://music.douyin.com/qishui/share/track', {
      params: { track_id: trackId },
      timeout: t,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }).then(function (res) {
      var html = String(res.data || '');
      var m = html.match(/_ROUTER_DATA\s*=\s*({[\s\S]*?});/);
      if (!m) throw new Error('qishui no ROUTER_DATA');
      var data = JSON.parse(m[1]);
      var page = data && data.loaderData && data.loaderData.track_page;
      var opt = page && page.audioWithLyricsOption;
      if (!opt || !opt.url) throw new Error('qishui share page no url');
      return { html: html, opt: opt, page: page };
    });
  };
  // v1.1.0: 分享页存在瞬时结构异常（偶发缺 ROUTER_DATA / JSON 截断 / 空链接），
  // 对非超时类失败用更短超时单次重试；超时类不重试，避免吃掉通道接力预算。
  return once(tmo).catch(function (e) {
    var msg = String((e && e.message) || '');
    if (msg.indexOf('timeout') >= 0) throw e;
    return once(Math.min(tmo, 2000));
  });
}

// ① 分享页 _ROUTER_DATA 直连算法（v0.5 通道升级为主通道）
function resolveQishuiSharePage(raw) {
  if (!raw || !raw.trackId) return Promise.reject(new Error('qishui no trackId'));
  return fetchShareTrackPage(raw.trackId, CHAN_TIMEOUT.share_page).then(function (r) {
    var opt = r.opt, page = r.page;
    // 付费歌返回中段试听片段（previewStart/previewEnd 与 full duration 不符），必须抛错接力
    var fullDur = opt.duration || (page && page.trackInfo && page.trackInfo.duration);
    if (fullDur && fullDur > 3000) fullDur = fullDur / 1000; // 毫秒归一
    var ps = opt.previewStart, pe = opt.previewEnd;
    var clipLen = (typeof ps === 'number' && typeof pe === 'number' && pe > ps) ? (pe - ps) : 0;
    if ((typeof ps === 'number' && ps > 0.5) ||
        (fullDur && fullDur >= 60 && clipLen > 0 && clipLen < fullDur - 1)) {
      throw new Error('qishui preview clip ' + Math.round(clipLen) + 's/' + Math.round(fullDur || 0) + 's');
    }
    // [v1.9.6 音质诚实性] 分享页单一码率流：从 URL 参数 br=（实测 ~126≈higher 档）按
    // QISHUI_ACTUAL 同款约定如实标 actualQuality（宁低勿高）；解析失败不标、维持原状
    var brM = /[?&]br=(\d+)/.exec(String(opt.url));
    var out = { url: String(opt.url), channel: 'share_page' }; // 🟢-10 取链结果标记通道
    if (brM) {
      var brv = parseInt(brM[1], 10) || 0;
      if (brv >= 200) out.actualQuality = '320k';
      else if (brv >= 95) out.actualQuality = '192k';
      else if (brv > 0) out.actualQuality = '128k';
    }
    return out;
  });
}

// ---------- v1.7.0 ④ seo_track 通道（无签名 + 三档 m4a + 逐字歌词） ----------
// GET https://beta-luna.douyin.com/luna/h5/seo_track?track_id=&device_platform=web
// 免签名免 Cookie（2026-09-08 实测 ~0.5s，200 JSON）。响应顶层含 track_player / lyric：
//   track_player.url_player_info —— 完整 AWS4 签名 VOD GetPlayInfo URL（再 GET 一次即得直链）
//   lyric.type = 'krc'（逐字）/'lrc'（无逐字），content 为 KRC 逐字标签文本（与 bugpk KRC 同构）
// GetPlayInfo 响应：Result.Data.PlayInfoList[]（数组直挂），每项
//   { Bitrate, FileHash, Size, Format:'m4a', Codec:'aac', Quality:'medium'|'higher'|'highest',
//     Duration, EncryptionMethod, PlayAuth, MainPlayUrl, BackupPlayUrl }
// 实测三档码率：medium ~65k / higher ~130k / highest ~257k（AAC m4a）。
function fetchSeoTrack(trackId, timeoutMs) {
  var tmo = timeoutMs || CHAN_TIMEOUT.seo_track;
  return axios.get('https://beta-luna.douyin.com/luna/h5/seo_track', {
    params: { track_id: trackId, device_platform: 'web' },
    timeout: tmo,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Referer: 'https://www.douyin.com/'
    }
  }).then(function (res) {
    var data = res.data;
    // 兼容包裹形态 { data: { track_player } }
    var tp = data && (data.track_player || (data.data && data.data.track_player));
    var upi = tp && tp.url_player_info;
    if (!upi || typeof upi !== 'string' || upi.indexOf('http') !== 0) {
      throw new Error('qishui seo_track no url_player_info');
    }
    return { vodUrl: upi, lyric: data && data.lyric };
  });
}

// 第二跳：GET 签名 VOD GetPlayInfo URL → PlayInfoList 按请求档位选档。
// quality 用宿主档位键（standard/high/super/hires），选档序沿用 QISHUI_TP_LEVEL 同款
// （seo_track 无 lossless 档，该档自然落空）；actualQuality 沿用 QISHUI_ACTUAL 如实标注。
function resolveQishuiSeoTrack(raw, quality) {
  if (!raw || !raw.trackId) return Promise.reject(new Error('qishui no trackId'));
  var hop2 = CHAN_TIMEOUT.seo_track - 2000 > 500 ? CHAN_TIMEOUT.seo_track - 2000 : 1500;
  return fetchSeoTrack(raw.trackId, 2000).then(function (r) {
    // 逐字歌词顺手回填缓存（getWordByWordLyric 缓存命中即转 QRC，省一次分享页 SSR）
    if (r.lyric && r.lyric.type === 'krc' && r.lyric.content) {
      qishuiWordLyricCache[raw.trackId] = String(r.lyric.content);
    }
    return axios.get(r.vodUrl, {
      timeout: hop2,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    }).then(function (res) {
      var root = res.data && (res.data.Result || res.data);
      var list = root && root.Data && root.Data.PlayInfoList;
      if (!list || !list.length) throw new Error('qishui seo_track no PlayInfoList');
      var order = QISHUI_TP_LEVEL[quality] || QISHUI_TP_LEVEL.standard;
      var pick = function (p) {
        if (!p || !p.MainPlayUrl) return null;
        var out = { url: String(p.MainPlayUrl), channel: 'seo_track' };
        // [v0.7.2 fix#10 同原则] actualQuality 按实际命中档位如实上报（未知名不报）
        if (p.Quality) out.actualQuality = QISHUI_ACTUAL[p.Quality];
        // v1.7.0 加密曲目（CENC）：PlayAuth / EncryptionMethod 非空 → 提取密钥按 cek
        // 契约返回（宿主侧做 CENC 流解密，与 track_php decrypt_key 同一契约）
        if (p.PlayAuth || p.EncryptionMethod) {
          try {
            var k = extractPlayAuthKey(String(p.PlayAuth || ''));
            if (k) out.cek = k;
          } catch (eAuth) { /* 提取失败不拦截取链，URL 照常返回 */ }
        }
        return out;
      };
      for (var li = 0; li < order.length; li++) {
        for (var pi = 0; pi < list.length; pi++) {
          if (list[pi] && list[pi].Quality === order[li]) {
            var hit = pick(list[pi]);
            if (hit) return hit;
          }
        }
      }
      // 请求档位全缺 → 任一有效档（实测部分曲目仅 higher 一档）
      for (var pj = 0; pj < list.length; pj++) {
        var any = pick(list[pj]);
        if (any) return any;
      }
      throw new Error('qishui seo_track no usable audio');
    });
  });
}

// ---------- v1.7.0 CENC：play_auth 密钥提取（music-lib soda/crypto.go extractKey 逐行移植） ----------
// 无 Buffer 纯 JS（Hermes/RN 宿主无 Buffer）；ES8 语法。
function qishuiBase64ToBytes(s) {
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var clean = String(s || '').replace(/[^A-Za-z0-9+\/=]/g, '');
  var out = [];
  var bits = 0, acc = 0;
  for (var i = 0; i < clean.length; i++) {
    if (clean.charAt(i) === '=') break;
    var v = B64.indexOf(clean.charAt(i));
    if (v < 0) continue;
    acc = ((acc << 6) | v) & 0xFFFF;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xFF);
    }
  }
  return out;
}

// Go bitcount（32 位 popcount，SWAR 实现）
function bitcount32(n) {
  var u = n >>> 0;
  u = u - ((u >> 1) & 0x55555555);
  u = (u & 0x33333333) + ((u >> 2) & 0x33333333);
  return ((((u + (u >> 4)) & 0xF0F0F0F) * 0x1010101) >>> 24) & 0xFF;
}

// Go decodeBase36：'0'-'9'→0-9，'a'-'z'→10-35，其余 0xFF
function decodeBase36Char(code) {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 122) return code - 97 + 10;
  return 0xFF;
}

// Go decryptSpadeInner：result[i] = ((keyBytes[i]^buff[i]) - bitcount(i) - 21) mod 255，
// buff = [0xFA, 0x55] + keyBytes（i=0 异或 0xFA、i=1 异或 0x55、i>=2 时 buff[i]==keyBytes[i-2]）
function qishuiSpadeInner(keyBytes) {
  var result = new Array(keyBytes.length);
  var buff = [0xFA, 0x55].concat(keyBytes);
  for (var i = 0; i < result.length; i++) {
    var v = (keyBytes[i] ^ buff[i]) - bitcount32(i) - 21;
    while (v < 0) v += 255;
    result[i] = v & 0xFF;
  }
  return result;
}

// play_auth → hex 密钥。流程：base64 解码 → paddingLen=((b0^b1^b2)-48)&0xFF（Go 字节算术
// mod 256 语义）→ innerInput=b[1:len-paddingLen] → decryptSpadeInner → skipBytes=decodeBase36
// (tmpBuff[0]) → endIndex=1+(len-paddingLen-2)-skipBytes → hex 密钥=tmpBuff[1:endIndex]。
function extractPlayAuthKey(playAuth) {
  var bytesData = qishuiBase64ToBytes(playAuth);
  if (bytesData.length < 3) throw new Error('auth data too short');
  var paddingLen = (((bytesData[0] ^ bytesData[1] ^ bytesData[2]) - 48) & 0xFF);
  if (bytesData.length < paddingLen + 2) throw new Error('invalid padding length');
  var innerInput = bytesData.slice(1, bytesData.length - paddingLen);
  var tmpBuff = qishuiSpadeInner(innerInput);
  if (!tmpBuff.length) throw new Error('decryption failed');
  var skipBytes = decodeBase36Char(tmpBuff[0]);
  var endIndex = 1 + (bytesData.length - paddingLen - 2) - skipBytes;
  if (endIndex > tmpBuff.length || endIndex < 1) throw new Error('index out of bounds');
  var out = '';
  for (var i = 1; i < endIndex; i++) out += String.fromCharCode(tmpBuff[i]);
  return out;
}

// mp4 box 遍历检查 CENC（enca/senc box）：对 Range 探测拿到的文件头字节做静态检查。
// 返回 { enca: bool, senc: bool, boxes: [路径上的 box 类型] }。仅探测用，不影响取链主链。
function qishuiFindBoxes(bytes, start, end, depth) {
  var boxes = [];
  var off = start;
  while (off + 8 <= end) {
    var size = (((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0);
    var type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    var hdr = 8;
    if (size === 1) { // 64 位 largesize：存在性判断读低 32 位足够
      if (off + 16 > end) break;
      size = (((bytes[off + 12] << 24) | (bytes[off + 13] << 16) | (bytes[off + 14] << 8) | bytes[off + 15]) >>> 0);
      hdr = 16;
    } else if (size === 0) {
      size = end - off;
    }
    if (size < hdr || off + size > end) break;
    boxes.push({ type: type, start: off, size: size, depth: depth });
    off += size;
  }
  return boxes;
}

function detectCencBoxes(bytes) {
  var hits = { enca: false, senc: false, boxes: [] };
  var CONTAINERS = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd', 'moof', 'traf', 'edts', 'mvex'];
  function walk(list, depth) {
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.type === 'enca') hits.enca = true;
      if (b.type === 'senc') hits.senc = true;
      hits.boxes.push(new Array(depth + 1).join('  ') + b.type);
      if (depth < 6 && CONTAINERS.indexOf(b.type) >= 0) {
        // stsd 版本/标志(4)+entry_count(4) 后才是子项，其余容器 +8 即子项
        var cStart = (b.type === 'stsd') ? b.start + 16 : b.start + 8;
        walk(qishuiFindBoxes(bytes, cStart, Math.min(b.start + b.size, bytes.length), depth + 1), depth + 1);
      }
    }
  }
  walk(qishuiFindBoxes(bytes, 0, bytes.length, 0), 0);
  return hits;
}

// ② bugpk qsmusic 备源（v4 §25.1 / 汽水文档 §6.4）
// GET https://api.bugpk.com/api/qsmusic?url=<分享页URL>&type=json → data.url 明文直链。
// 实测支持直接拼 track_id 构造分享页 URL；video_meta.real_bitrate ≈129663bps（≈128k）。
// 接口限速 2req/s：负缓存兜底，避免高并发打点。
// [v1.9.4] size 探测辅助：Range 0-0 HEAD 探测 Content-Range/Content-Length 写回。
function probeHeadSize(url, timeoutMs) {
  if (!url || typeof url !== 'string') return Promise.resolve(0);
  var ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 2000;
  return axios.get(url, {
    timeout: ms, headers: { Range: 'bytes=0-0' }, responseType: 'arraybuffer',
    validateStatus: function (s) { return s >= 200 && s < 400; }
  }).then(function (res) {
    var h = res.headers || {};
    var cr = h['content-range'] || h['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) return parseInt(mm[1], 10) || 0;
    if (res.status !== 206) {
      var cl = h['content-length'] || h['Content-Length'];
      return parseInt(cl, 10) || 0;
    }
    return 0;
  }).catch(function () { return 0; });
}


function resolveQishuiBugpk(raw) {
  if (!raw || !raw.trackId) return Promise.reject(new Error('qishui no trackId'));
  var once = function () {
    return axios.get('https://api.bugpk.com/api/qsmusic', {
      params: { url: qishuiSharePageUrl(raw.trackId), type: 'json' },
      timeout: CHAN_TIMEOUT.bugpk,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
    }).then(function (res) {
      var d = res.data && res.data.data;
      var url = d && d.url;
      if (!url) throw new Error('qishui bugpk no url (code=' + String(res.data && res.data.code) + ')');
      return { url: String(url), channel: 'bugpk' }; // 🟢-10 取链结果标记通道
    });
  };
  return once().catch(function (e) {
    var st = e && e.response && e.response.status;
    // v1.1.0: bugpk 限速 ~2req/s，超速返回 HTTP 520 且具瞬时性（实测间隔 1.5s 即恢复），
    // 仅对 520 等 1.2s 重试一次；其余失败直接上抛走通道接力。
    if (st !== 520) throw e;
    return new Promise(function (resolve) { setTimeout(resolve, 1200); }).then(once);
  });
}

// ---------- v1.1.0 🟢-9 失败负缓存 ----------
// 死亡/限流通道做 60s 负缓存：同 key 请求期间直接跳过，省预算不省正确性。
// 网关死亡（403/404 HTML）按通道整体记负缓存；其余失败按「通道|曲目」记。
var QISHUI_NEG_TTL_MS = 60000;
var qishuiNeg = {}; // key -> expiry ts

function qishuiNegHit(key) {
  var t = qishuiNeg[key];
  if (t && Date.now() < t) return true;
  if (t) delete qishuiNeg[key];
  return false;
}
function qishuiNegMark(key) {
  qishuiNeg[key] = Date.now() + QISHUI_NEG_TTL_MS;
}

function resolveQishui(raw, quality) {
  if (!raw || !raw.trackId) return Promise.reject(new Error('qishui no trackId'));
  // v1.7.0 编排：① 分享页 ∥ seo_track 并行竞速（raceSuccess 首胜即用，负缓存命中的
  // 通道不进竞速）→ 全败接力 ② bugpk → ③ track_php（编排语义与负缓存记法沿用 v1.1.0）。
  var race = [];
  if (!qishuiNegHit('share_page|' + raw.trackId)) {
    race.push(resolveQishuiSharePage(raw).catch(function (e) {
      var msg = String((e && e.message) || '');
      qishuiNegMark('share_page' + (msg.indexOf('dead gateway') >= 0 ? '' : '|' + raw.trackId));
      throw e;
    }));
  }
  if (!qishuiNegHit('seo_track|' + raw.trackId)) {
    race.push(resolveQishuiSeoTrack(raw, quality).catch(function (e) {
      qishuiNegMark('seo_track|' + raw.trackId);
      throw e;
    }));
  }
  var raced = race.length
    ? raceSuccess(race)
    : Promise.reject(new Error('qishui race candidates all neg-cached'));
  var rest = [
    { key: 'bugpk', fn: function () { return resolveQishuiBugpk(raw); } },
    { key: 'track_php', fn: function () { return resolveQishuiTrackPhp(raw, quality); } }
  ];
  var idx = 0;
  var attempt = function () {
    if (idx >= rest.length) {
      return Promise.reject(new Error('qishui all channels failed'));
    }
    var ch = rest[idx++];
    if (qishuiNegHit(ch.key + '|' + raw.trackId)) return attempt();
    return ch.fn().catch(function (e) {
      var msg = String((e && e.message) || '');
      qishuiNegMark(ch.key + (msg.indexOf('dead gateway') >= 0 ? '' : '|' + raw.trackId));
      return attempt();
    });
  };
  return raced.catch(attempt);
}

var RESOLVE_ADAPTERS = {
  qishui: resolveQishui
};


/**
 * 能力路由 + 失败接力：
 * 候选顺序 = 支持请求档位的源（按源权重降序）→ 其余兜底源（汽水单档）。
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
// v1.1.0 🟢-18：https 不再一律放行——劫持/被改写的陌生 https 域同样过不了白名单；
// 协议不限，域名必须命中已知平台 CDN 后缀（汽水/字节系）。不通过视为该源失败继续接力。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.qishui\.com$/i, /\.douyinvod\.com$/i, /\.douyinpic\.com$/i, /\.zjcdn\.com$/i, // 汽水/字节
  /\.bytecdn\.cn$/i, /\.bytedance\.com$/i, /\.douyin\.com$/i
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
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

function resolveWithFallback(musicItem, quality, deadlineOverride) {
  var srcMap = musicItem._src || {};
  var order = pickCandidates(srcMap, quality);
  var tries = order.slice(0, 3);
  // v1.1.0 🟠-2：全局超时预算。deadline 8s 内每段用剩余时间兜底（段内小预算见 CHAN_TIMEOUT），
  // 每段进入前检查剩余时间，不足 500ms 直接失败——保证整体可预期地在宿主 10s 预算内给出结果。
  // v1.3.0：支持外部传入全局 deadline（跨源兜底编排共享同一预算）；缺省行为不变。
  var deadline = deadlineOverride || (Date.now() + RESOLVE_BUDGET_MS);
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
    // v1.1.0 🟠-2：段超时 = 剩余预算（不再固定 RELAY_TIMEOUT）。
    // 通道内部已有独立小预算（CHAN_TIMEOUT）先到先停，这里只兜整体 8s deadline，
    // 修复 v1.0.0「外层 4.5s 罩死整条串行链」的问题——多通道接力在 8s 内都走得到。
    var segTimeout = remain;
    if (segTimeout > remain) segTimeout = remain;
    return withTimeout(adapter(srcMap[source], quality, musicItem), segTimeout, source + ' 取链超时 ' + segTimeout + 'ms').then(function (r) {
      // v0.7.1 P1-5：返回 URL 协议/域名白名单校验，不通过视为该源失败、继续接力
      if (!isAllowedMediaUrl(r && r.url)) {
        throw new Error(source + ' 返回 URL 未通过协议/域名校验');
      }
      // 兜底守卫：适配器漏判的试听片段在这里被内容探测拦下并继续接力
      // （守卫按 content-length/Range 校验大小与标称时长一致性，明显不符即丢弃）
      var guardBudget = deadline - Date.now();
      if (guardBudget <= 500) throw new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(guardFullAudio(r.url, musicItem, r.actualQuality), guardBudget, 'guard 超时').then(function () { return r; });
    }).catch(function () {
      return attempt(idx + 1);
    });
  };
  return attempt(0);
}

/**
 * 试听片段兜底守卫：Range 探测 audio 文件总长，
 * 按码率估算时长（v1.1.0 🟢：按通道上报的 actualQuality 选码率，未知默认 128kbps），
 * 估算时长 < 标称时长 60% 判为试听片段。仅标称时长 >=60s 时启用估算。
 * 探测请求自身失败（Range 不支持/超时）不惩罚源，放行由播放器处理。
 */
var GUARD_BPS = {
  flac: 1000000,   // 真无损按 1Mbps 保守估
  hires: 2000000,
  '320k': 320000,
  '192k': 192000,
  '128k': 128000
};

function guardFullAudio(url, musicItem, actualQuality) {
  var bps = GUARD_BPS[actualQuality] || 128000;
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
    var dur = musicItem && parseInt(musicItem.duration, 10) || 0;
    if (total > 0 && dur >= 60) {
      var est = total * 8 / bps; // v1.1.0：按上报码率估算，不再硬编码 128kbps
      if (est < dur * 0.6) {
        throw new Error('guard: trial clip ~' + Math.round(est) + 's/' + dur + 's');
      }
      // v1.4.0 P2：30/60s 固定时长试听规则（对齐 baka isPreviewVideoModel 语义，与
      // previewStart/比例规则互补）：估算时长恰为 30/60s（±1.5s）且标称 ≥90s 时判试听——
      // 上游 VIP 试听固定切 30s/60s 片段，90-100s 短歌 60s 试听比例(0.6)不触发比例规则。
      if ((Math.abs(est - 30) <= 1.5 || Math.abs(est - 60) <= 1.5) && dur >= 90) {
        throw new Error('guard: fixed ' + Math.round(est) + 's preview /' + dur + 's');
      }
    }
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // 探测请求本身失败：不拦，放行
  });
}

// ==================== v1.3.0 跨源兜底取链（酷我 / 网易云） ====================
// 编排：汽水三通道全败 → 搜酷我同曲 → resolveKuwo 多级竞速取链 → 仍失败 → 搜网易云同曲
// → resolveNetease 取链。匹配不上不强用（宁可不播不错播）。代码移植自 kuwo-source
// v1.3.0 / netease-source v1.2.1 的取链实现（仅搜索 + getMediaSource 必需代码），
// 与汽水主逻辑零耦合；两模块共享 raceSuccess/utf8Bytes/海棠封装（各插件同源实现）。
// 对外透明：条目 platform 仍为 qishui，返回 { url, actualQuality } 汽水插件格式。

// ---------- 共享基础（酷我/网易云插件同源实现，各移植一份去重） ----------

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

// ==================== 兜底源①：酷我（移植自 kuwo-source v1.3.0） ====================
// 通道：nmobi/nmsublist/mobi.s 免签车载 + DES(ylzsxkwm) 手机/车载双渠道 + antiserver 竞速，
// 海棠 kw 全音质兜底；hires/master 母带优先链。仅移植取链与搜索必需代码。

// ==================== v0.7.3 纯 JS 加密模块 ====================
// 算法来源：《六平台接口文档（实测整合版）》酷我 §2.4 自定义 DES 参考实现。
// 沙箱已对拍验证：酷我 DES 输出与文档 Python 参考实现逐字节一致。
// 宿主 require 白名单无 crypto 模块，故纯 JS 实现；64 位数用 [lo,hi] 双 32 位字表示（PC1 输出可超 2^53，禁用 Number 合并）。
// 语法：ES8 兼容（无 ?. / ?? / BigInt / Buffer 依赖）。
// ---------- 基础 ----------
function u32(x) { return x | 0; }

// UTF-8 编码（手写，等价 unescape(encodeURIComponent(s))，不依赖 Annex B 的 unescape，安卓宿主安全）
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
function bt64(sel, lo, hi) {
  var rlo = 0, rhi = 0;
  for (var i = 0; i < sel.length; i++) {
    var idx = sel[i];
    if (idx >= 0) {
      var bit = idx < 32 ? ((lo >>> idx) & 1) : ((hi >>> (idx - 32)) & 1);
      if (bit) { if (i < 32) rlo |= (1 << i); else rhi |= (1 << (i - 32)); }
    }
  }
  return [rlo | 0, rhi | 0];
}

// ---------- 酷我自定义 DES（非标准 E 扩展表，密钥 ylzsxkwm） ----------
var KW_ARRAYLS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
var KW_ARRAYLSMASK = [0, 0x100001, 0x300003];
var KW_ARRAYE = [31,0,1,2,3,4,-1,-1,3,4,5,6,7,8,-1,-1,7,8,9,10,11,12,-1,-1,11,12,13,14,15,16,-1,-1,15,16,17,18,19,20,-1,-1,19,20,21,22,23,24,-1,-1,23,24,25,26,27,28,-1,-1,27,28,29,30,31,30,-1,-1];
var KW_ARRAYIP1 = [39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25,32,0,40,8,48,16,56,24];
var KW_ARRAYIP2 = [57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7,56,48,40,32,24,16,8,0,58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6];
var KW_ARRAYP = [15,6,19,20,28,11,27,16,0,14,22,25,4,17,30,9,1,7,23,13,31,26,2,8,18,12,29,5,21,10,3,24];
var KW_ARRAYPC1 = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3];
var KW_ARRAYPC2 = [13,16,10,23,0,4,-1,-1,2,27,14,5,20,9,-1,-1,22,18,11,3,25,7,-1,-1,15,6,26,19,12,1,-1,-1,40,51,30,36,46,54,-1,-1,29,39,50,44,32,47,-1,-1,43,48,38,55,33,52,-1,-1,45,41,49,35,28,31,-1,-1];
var KW_SBOX = [
[14,4,3,15,2,13,5,3,13,14,6,9,11,2,0,5,4,1,10,12,15,6,9,10,1,8,12,7,8,11,7,0,0,15,10,5,14,4,9,10,7,8,12,3,13,1,3,6,15,12,6,11,2,9,5,0,4,2,11,14,1,7,8,13],
[15,0,9,5,6,10,12,9,8,7,2,12,3,13,5,2,1,14,7,8,11,4,0,3,14,11,13,6,4,1,10,15,3,13,12,11,15,3,6,0,4,10,1,7,8,4,11,14,13,8,0,6,2,15,9,5,7,1,10,12,14,2,5,9],
[10,13,1,11,6,8,11,5,9,4,12,2,15,3,2,14,0,6,13,1,3,15,4,10,14,9,7,12,5,0,8,7,13,1,2,4,3,6,12,11,0,13,5,14,6,8,15,2,7,10,8,15,4,9,11,5,9,0,14,3,10,7,1,12],
[7,10,1,15,0,12,11,5,14,9,8,3,9,7,4,8,13,6,2,1,6,11,12,2,3,0,5,14,10,13,15,4,13,3,4,9,6,10,1,12,11,0,2,5,0,13,14,2,8,15,7,4,15,1,10,7,5,6,12,11,3,8,9,14],
[2,4,8,15,7,10,13,6,4,1,3,12,11,7,14,0,12,2,5,9,10,13,0,3,1,11,15,5,6,8,9,14,14,11,5,6,4,1,3,10,2,12,15,0,13,2,8,5,11,8,0,15,7,14,9,4,12,7,10,9,1,13,6,3],
[12,9,0,7,9,2,14,1,10,15,3,4,6,12,5,11,1,14,13,0,2,8,7,13,15,5,4,10,8,3,11,6,10,4,6,11,7,9,0,6,4,2,13,1,9,15,3,8,15,3,1,14,12,5,11,0,2,12,14,7,5,10,8,13],
[4,1,3,10,15,12,5,0,2,11,9,6,8,7,6,9,11,4,12,15,0,3,10,5,14,13,7,8,13,14,1,2,13,6,14,9,4,1,2,14,11,13,5,0,1,10,8,3,0,11,3,5,9,4,15,2,7,8,12,15,10,7,6,12],
[13,7,10,0,6,9,5,15,8,4,3,10,11,14,12,5,2,11,9,6,15,12,0,3,4,1,14,13,1,2,7,8,1,2,12,15,10,4,0,3,13,14,6,9,7,8,9,6,15,1,5,12,3,10,14,5,8,7,11,0,4,13,2,11]
];

// （56 位旋转逻辑内联在 kwSubkeys 中，值 < 2^53 用 Number 运算安全）

function kwDesBlock(subkeys, lo, hi) {
  var ip = bt64(KW_ARRAYIP2, lo, hi);
  var L = ip[0], R = ip[1];
  for (var i = 0; i < 16; i++) {
    var e = bt64(KW_ARRAYE, R, 0);
    var xlo = e[0] ^ subkeys[i][0], xhi = e[1] ^ subkeys[i][1];
    var sOut = 0;
    for (var sbi = 7; sbi >= 0; sbi--) {
      var b;
      if (sbi < 4) b = (xlo >>> (8 * sbi)) & 0xFF;
      else b = (xhi >>> (8 * (sbi - 4))) & 0xFF;
      sOut = ((sOut << 4) | KW_SBOX[sbi][b]) >>> 0;
    }
    var p = bt64(KW_ARRAYP, sOut, 0)[0];
    var newR = u32(L ^ p);
    L = R; R = newR;
  }
  var t = L; L = R; R = t; // reverse
  return bt64(KW_ARRAYIP1, L, R);
}

// 密钥 8 字节 → 16 个子密钥（各为 [lo,hi] 64 位稀疏值）；加密模式
// 注意：PC1 输出是 56 位稀疏值，可超过 2^53，必须全程用 [lo,hi] 双字运算，禁止合并成 Number
var KW_SUBKEY_CACHE = {};
function kwSubkeys(keyStr) {
  if (KW_SUBKEY_CACHE[keyStr]) return KW_SUBKEY_CACHE[keyStr];
  var klo = 0, khi = 0;
  for (var i = 0; i < 8; i++) {
    var b = keyStr.charCodeAt(i) & 0xFF;
    if (i < 4) klo |= b << (8 * i); else khi |= b << (8 * (i - 4));
  }
  var x = bt64(KW_ARRAYPC1, klo, khi); // 56 位稀疏值 [lo,hi]
  var keys = [];
  for (var r = 0; r < 16; r++) {
    var shift = KW_ARRAYLS[r];
    var mask = KW_ARRAYLSMASK[shift]; // < 2^23，全在低字
    var maskedLo = x[0] & mask;
    var restLo = (x[0] & ~mask) | 0, restHi = x[1]; // ~mask 只影响低字（mask < 2^32）
    var shrLo = (restLo >>> shift) | (restHi << (32 - shift));
    var shrHi = restHi >>> shift;
    var sl = 28 - shift; // maskedLo < 2^23，左移 26/27 会跨字
    var shlLo = maskedLo << sl;
    var shlHi = maskedLo >>> (32 - sl);
    var nxlo = (shlLo | shrLo) | 0, nxhi = (shlHi | shrHi) | 0;
    keys.push(bt64(KW_ARRAYPC2, nxlo, nxhi));
    x = [nxlo, nxhi]; // 状态链式更新：下一轮在当前旋转结果上继续旋转
  }
  KW_SUBKEY_CACHE[keyStr] = keys;
  return keys;
}

// 加密任意长度（NoPadding：8 字节对齐也补一个加密零块，与参考实现一致）
function kwDesEncryptBytes(bytes, keyStr) {
  var sub = kwSubkeys(keyStr);
  var j = Math.floor(bytes.length / 8);
  var out = [];
  var blocks = [];
  for (var m = 0; m < j; m++) {
    var lo = 0, hi = 0;
    for (var n = 0; n < 8; n++) {
      var b = bytes[m * 8 + n] & 0xFF;
      if (n < 4) lo |= b << (8 * n); else hi |= b << (8 * (n - 4));
    }
    blocks.push(kwDesBlock(sub, lo | 0, hi | 0));
  }
  var rem = bytes.length % 8;
  var rlo = 0, rhi = 0;
  for (var n2 = 0; n2 < rem; n2++) {
    var b2 = bytes[j * 8 + n2] & 0xFF;
    if (n2 < 4) rlo |= b2 << (8 * n2); else rhi |= b2 << (8 * (n2 - 4));
  }
  if (rem !== 0 || true) blocks.push(kwDesBlock(sub, rlo | 0, rhi | 0)); // mode==0 恒补块
  for (var k = 0; k < blocks.length; k++) {
    out.push(blocks[k][0] & 0xFF, (blocks[k][0] >>> 8) & 0xFF, (blocks[k][0] >>> 16) & 0xFF, (blocks[k][0] >>> 24) & 0xFF);
    out.push(blocks[k][1] & 0xFF, (blocks[k][1] >>> 8) & 0xFF, (blocks[k][1] >>> 16) & 0xFF, (blocks[k][1] >>> 24) & 0xFF);
  }
  return out;
}

function kwBase64(bytes) {
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

function kuwoEncryptQuery(query, keyStr) {
  return kwBase64(kwDesEncryptBytes(utf8Bytes(query), keyStr));
}

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };

// v0.6.0 说明（宁缺毋滥）：酷我 20201/20501/20900kmflac（至臻/全景声/母带）为 QMCv2 加密档，
// 需先 DES/ECB(ylzsxkwm) 派生 712 字节原始密钥。Toskysun 宿主的 ekey 通道
// （Mp3UtilModule.decryptEKey → normalizeEkey 截取末 704 字符 → QQ TEA V1/V2 信封）
// 数学上限只能承载 ≤518 字节密钥，且无 DES 派生逻辑 —— 酷我密钥物理上无法经该通道下发，
// 强行下发会在 registerMflacStream 抛错导致整条取链失败，故不接入；无损档 2000kflac
// 实测返回明文 FLAC（ekey 为空，文档 §13.1），走下面原逻辑即可。
// [v0.7.3] 酷我 DES-ECB 取链通道（mobi.s，密钥 ylzsxkwm）
// 算法与端点出自《酷我音乐接口完整文档_实测整合版》§2.4，加密实现见上方纯 JS 模块（沙箱已与 Python 参考实现对拍一致）。
// query 模板：user/corp/source/p2p/type=convert_url2/sig=0/format/rid；UA 固定 okhttp/3.10.0。
// 响应为 k=v 行格式（实测：format=flac\r\nbitrate=2000\r\nurl=...\r\nsig=...\r\nrid=...\r\ntype=0），
// 按 url=/format=/bitrate= 前缀行解析；format/bitrate 用于音质档位校验与 actualQuality 如实标注。
// 实测（2026-09-06）：VIP 歌（rid=228908 晴天）未登录返回 2000k flac 明文直链 —— DES 通道可解锁 nmobi 未登录给不出/给试听的无损档。

function kuwoDesResolve(raw, quality) {
  // [v1.1.0 第三部分] query 构造参数化：variant 'std'=手机渠道 kwplayer_ar_5.1.0.0（v1.0.0 原样），
  // 'car'=车载渠道 kwplayercar_ar_6.0.0.9（v4 第三方文档 §10 + 本沙箱实测 2026-09-06：
  // 免签名 user=C_APK_guanwang_{ts}，VIP 歌实测出 2000kflac 明文直链）。同端点同密钥同解析，
  // 两渠道互为风控冗余 racer。
  var fmt = (quality === 'super' || quality === 'hires') ? 'flac' : 'mp3';
  var q;
  if (arguments.length > 2 && arguments[2] === 'car') {
    q = 'user=C_APK_guanwang_' + Date.now() + '&corp=kuwo&source=kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + raw.rid;
  } else {
    q = 'user=0&corp=kuwo&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + raw.rid;
  }
  return axios.get('https://mobi.kuwo.cn/mobi.s', {
    params: { f: 'kuwo', q: kuwoEncryptQuery(q, 'ylzsxkwm') },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    var txt = typeof res.data === 'string' ? res.data : String(res.data || '');
    var mUrl = txt.match(/(?:^|\n)url=([^\r\n]+)/);
    var mFmt = txt.match(/(?:^|\n)format=([^\r\n]+)/);
    var mBr = txt.match(/(?:^|\n)bitrate=([^\r\n]+)/);
    var url = mUrl ? String(mUrl[1]).trim() : '';
    if (!url || !/^http/i.test(url)) throw new Error('kuwo des no url');
    // 音质档位校验（宁低勿高）：请求 flac 但响应 format 不是 flac → 视为未命中，交给竞速对手/降级链
    var fmtGot = mFmt ? String(mFmt[1]).trim() : '';
    if ((quality === 'super' || quality === 'hires') && fmtGot !== 'flac') {
      throw new Error('kuwo des format mismatch: ' + fmtGot);
    }
    var br = parseInt(mBr ? mBr[1] : '0', 10) || 0;
    // [v1.1.0 fix O-6] high 档请求 320kmp3 但响应 bitrate 不足 → 视为未命中（抛错交给竞速对手
    // nmobi/海棠），不再静默以低码率顶替高品档拉低命中率
    if (quality === 'high' && br > 0 && br < 320) {
      throw new Error('kuwo des bitrate degraded: ' + br);
    }
    // [v0.7.4] bitrate 口径修正：convert_url2 响应 bitrate 为 kbps（实测 128/320/2000），
    // 原阈值 320000/192000 按 bps 理解，导致 mp3 档恒标 128k
    var aq;
    if (fmt === 'flac') aq = 'flac'; // mobi DES 上限 2000kflac，hires 只能给到无损档
    else aq = br >= 320 ? '320k' : (br >= 192 ? '192k' : '128k'); // mp3 档按响应 bitrate 如实标注
    return { url: url, actualQuality: aq };
  });
}

// [v0.7.4] 官方 convert_url_with_sign 通道工厂：nmobi/nmsublist 同构双域名（文档 §4.1/§4.3），
// 竞速冗余 + 档位/试听校验：请求无损必须回 flac（防静默降级）；duration<60s 视为试听片段拒收
// （未登录 2000kflac 常给 ~11s 试听且响应快于 DES，不拒收会抢跑竞速、整轮被 guardFullAudio 白跑）
// [v1.2.0 优化①] variant='car'：mobi.s 免签车载通道（host 传 mobi.kuwo.cn）。车载渠道包名
// kwplayercar_ar_6.0.0.9 免 DES/免 Cookie/免签名，最小参数集即可（f/source/from/type/br/rid/user），
// user 为伪设备标识 C_APK_guanwang_{ts}。实测（2026-09-06 探针 probe-v120.js）：
// 免费 128k ✅ / VIP 320k ✅ / VIP 2000kflac 真 FLAC ✅（魔数验真），与 nmobi/nmsublist 同构同档。
// 任务文档给的 mobi.s.kuwo.cn/url convert_url3 形态实测 502 已死，不采用。
// [v1.2.0 优化②] high 档 format 校验：免费歌请求 320kmp3 时官方通道（含车载）返回
// format=ogg bitrate=100 降级档（≈95kbps，实测 1,442,964B），原逻辑只按 bitrate 标 128k 放行，
// 参与竞速拉低命中率。与 super 档 flac 校验对齐：请求 320kmp3 但响应非 mp3 → 视为未命中，
// 抛错交给竞速对手/海棠 exhigh 兜底。
function kwOfficialResolve(host, raw, quality, variant) {
  var br = KUWO_BR[quality] || KUWO_BR.standard;
  var params;
  if (variant === 'car') {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: raw.rid,
      user: 'C_APK_guanwang_' + Date.now(),
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC'
    };
  } else {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: raw.rid,
      user: 0, android_id: 0, prod: 'kwplayerhd_ar_4.3.0.8', corp: 'kuwo',
      vipver: '4.3.0.8', source: 'kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk',
      notrace: 0, sig: 0, priority: 'bitrate', loginUid: 0, network: 'WIFI',
      loginSid: 0, mode: 'down'
    };
  }
  return axios.get('https://' + host + '/mobi.s', {
    params: params,
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) {
      throw new Error('kuwo no url');
    }
    if ((quality === 'super' || quality === 'hires') && d.format && d.format !== 'flac') {
      throw new Error('kuwo format degraded: ' + d.format);
    }
    // [v1.2.0 优化②] high 档：请求 320kmp3，响应非 mp3（ogg 降级等）一律拒收
    if (quality === 'high' && d.format && d.format !== 'mp3') {
      throw new Error('kuwo high format degraded: ' + d.format);
    }
    if (d.duration && d.duration > 0 && d.duration < 60) {
      throw new Error('kuwo trial snippet');
    }
    // [v0.7.4] actualQuality 按响应 bitrate 如实标注（nmobi 响应 bitrate 为 kbps 口径），不按请求档宣称
    var aq = (d.format === 'flac') ? 'flac'
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    return { url: String(d.url), actualQuality: aq };
  });
}

// [v0.7.4] antiserver 固定 128k 官方直链（文档 §4.4：仅 standard/low 档参与并发）。
// 免签名、纯文本响应（axios JSON 解析失败自动回落字符串），是唯一永不降级的官方接口，
// 作 128k 档竞速兜底，消除「nmobi+DES 全败即报错」的单点
// [v1.2.0 优化③] VIP 试听片段竞速内拒收：antiserver 对 VIP 歌返回 ~11s 试听片段
// （实测晴天 181,521B ≈ 11.3s / 标称 269s），原逻辑返回后由外层 guardFullAudio 拦截，
// 但此时 antiserver 已在 raceSuccess 抢跑胜出 → 外层守卫拦截后无对手可接力 → 全链失败。
// 改为拿到直链后立即做轻量 Range 探测（复用试听守卫 guardFullAudio：探测自身失败不惩罚、
// 仅 guard: 前缀错误上抛），明显试听片段在竞速内部拒收，其余 racer 仍可胜出。
// 备选的「VIP 预判跳过」方案不可行：搜索响应 pay 字段实测不可区分免费/VIP
// （免费 Demo 与 VIP 歌 payInfo.feeType 均为 song=1/vip=1，probe-v120.js 实测）。
function kwAntiserverResolve(raw, musicItem) {
  return axios.get('http://antiserver.kuwo.cn/anti.s', {
    params: { type: 'convert_url', rid: 'MUSIC_' + raw.rid, format: 'mp3', response: 'url' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var url = String(res.data || '').trim();
    if (!url || !/^http/i.test(url)) throw new Error('kuwo antiserver no url');
    return guardFullAudio(url, musicItem).then(function () {
      return { url: url, actualQuality: '128k' };
    });
  });
}

// [v1.2.3] 母带优先链（hires/master 共用；atmos 回落至此）：原 v1.2.2 hires 分支原样抽出。
// ① 海棠 kw master（真 24bit FLAC，fLaC 魔数校验）→ ② DES 手机/车载双渠道竞速
// → ③ 海棠 lossless（非 fLaC 下探）→ 海棠 standard 128k mp3 保底。
function resolveKuwoMasterChain(raw, quality) {
  return resolveHaitang('kw', raw.rid, 'master')
    .then(function (r) {
      return probeMediaMagic(r.url).then(function (magic) {
        if (magic === 'fLaC') return r;
        throw new Error('haitang master not flac: ' + (magic || 'empty'));
      });
    })
    .catch(function () {
      // DES 段统一传内部档 'hires'（=2000kflac 请求 + format=flac 校验）：master/atmos 若
      // 原样透传，kuwoDesResolve 只认 super/hires 为 flac 档，会按 mp3 请求拿 128k/320k
      // 抢跑母带链——无损兜底语义不符。actualQuality 由 DES 段如实标 'flac'。
      return raceSuccess([kuwoDesResolve(raw, 'hires'), kuwoDesResolve(raw, 'hires', 'car')]);
    })
    .catch(function () {
      // 海棠 lossless 兜底（VIP 无母带歌曲的真 FLAC；注意 quality 传 'super' 才映射到
      // lossless 档）。免费歌该档上游只有 ogg 95k 降级档，探测非 fLaC 时降标并下探
      // standard 档拿 128k mp3——可播性优先，宁低勿高。
      return resolveHaitang('kw', raw.rid, 'super').then(function (r) {
        return probeMediaMagic(r.url).then(function (magic) {
          if (magic === 'fLaC') return r;
          return resolveHaitang('kw', raw.rid, 'standard');
        });
      });
    });
}

function resolveKuwo(raw, quality, musicItem) {
  // [v1.1.0 fix M-1] hires 档 KUWO_BR 无映射，kwOfficialResolve 落回 128kmp3 白跑且必被
  // flac 校验拒收 —— 官方 convert_url_with_sign 双域名只在 standard/high/super 参与；
  // [v1.1.0 第三部分] 车载渠道 DES 加入竞速（'car' 变体），与手机渠道互为风控冗余。
  // [v1.2.0 优化①] mobi.s 免签车载（kwOfficialResolve 'car' 变体，host=mobi.kuwo.cn）加入
  // standard/high/super 竞速池：与 hd 渠道（同构双域名）、DES 加密渠道并列的第三种独立形态
  // ——免 DES 依赖、不同 source 包名，任一渠道被风控单独掐掉时仍有独立存活的一路。
  // [v1.2.2] hires（宿主 master/hires/atmos 等增强键）= 母带优先链：
  // ① 海棠 kw master（实测 ~187MB 真 FLAC，24bit ≈5.6Mbps，URL 稳定流式端点）——fLaC 魔数
  //    探测校验（免费歌该端点 code=0 但内容是 400 JSON，非音频，校验不过即视为未命中）；
  // ② DES 手机/车载双渠道竞速（2000kflac，与 super 同源）；
  // ③ 海棠 lossless 兜底（真 FLAC 沙箱 fLaC 复核）。
  // 弃用海棠 kw 'hires' 档：实测虚标只回 128kmp3（4.3MB/269s，ID3 头）。
  // [v1.2.3] master/hires 共用此链；atmos 档先试海棠 kw atmos（至臻全景声，实测 ~31MB
  // fLaC ≈927kbps），未命中回落母带链。两分支实现见下方 resolveKuwoMasterChain。
  if (quality === 'hires' || quality === 'master') {
    return resolveKuwoMasterChain(raw, quality);
  }
  if (quality === 'atmos') {
    return resolveHaitang('kw', raw.rid, 'atmos')
      .then(function (r) {
        return probeMediaMagic(r.url).then(function (magic) {
          if (magic === 'fLaC') return r;
          throw new Error('haitang atmos not flac: ' + (magic || 'empty'));
        });
      })
      .catch(function () {
        // 该歌全景声无货（实测与 master 同为部分 VIP 歌有货模式）→ 回落母带链
        return resolveKuwoMasterChain(raw, quality);
      });
  }
  var racers = [
    kwOfficialResolve('nmobi.kuwo.cn', raw, quality),
    kwOfficialResolve('nmsublist.kuwo.cn', raw, quality),
    kwOfficialResolve('mobi.kuwo.cn', raw, quality, 'car'),
    kuwoDesResolve(raw, quality),
    kuwoDesResolve(raw, quality, 'car')
  ];
  if (quality === 'standard' || quality === 'low') racers.push(kwAntiserverResolve(raw, musicItem));
  var raced = raceSuccess(racers);
  // 海棠 kw 兜底（[v1.2.1 fix②] 全音质兜底，用户确认方向：不再限高品/无损档，
  // standard/low 竞速全挂也走海棠 standard→128k；kw lossless 真 FLAC 沙箱 fLaC 复核）
  return raced.catch(function () { return resolveHaitang('kw', raw.rid, quality || 'standard'); });
}

function haitangLevelOf(quality) {
  if (quality === 'super') return 'lossless';
  if (quality === 'hires') return 'hires';
  if (quality === 'master') return 'master'; // [v1.2.2] 显式透传母带档（kw 实测 ~187MB 真 FLAC 24bit）
  if (quality === 'atmos') return 'atmos'; // [v1.2.3] 至臻全景声（kw 实测 ~31MB fLaC ≈927kbps，部分 VIP 有货）
  if (quality === 'high') return 'exhigh';
  return 'standard';
}

// 宿主音质键（fork: 96k/128k/192k/320k/flac/flac24bit/hires/master/atmos...）→ 插件内部档位。
// v0.6.0 及之前宿主传入 '320k'/'master' 会被当未知档落回 standard，此映射修正为正确档位。

// [v0.7.2 fix#10 P1] 音质诚实性：插件内部档位 → 宿主音质键（IMediaSourceResult.actualQuality）。
// 多源接力/降级后「宣称档位 ≠ 实际档位」是多源播放器通病；v0.7.2 起各取链解析器
// 在返回值上附 actualQuality（宿主音质键口径：128k/192k/320k/flac/flac24bit/hires），
// 供宿主 UI 角标展示真实档位。取不到确定档位的通道不填该字段（宁缺毋假）。
function internalToHostQuality(q) {
  if (q === 'high') return '320k';
  if (q === 'super') return 'flac';
  if (q === 'hires') return 'hires';
  if (q === 'master') return 'master'; // [v1.2.3] 海棠 kw master 命中时是真 24bit 母带 FLAC，独立标注（回落链各段各自返回真实档）
  if (q === 'atmos') return 'atmos'; // [v1.2.3] 海棠 kw atmos 命中时是真至臻全景声，独立标注
  return '128k'; // standard / low / 未知
}

// v1.3.0 移植注：与酷我/网易云插件各自的 resolveHaitang 同源；追加第 4 参 channelTag
// 标注返回通道（酷我调用不传→无 channel 字段，网易云传 'haitang-wy'），其余逻辑逐字一致。
function resolveHaitang(source, rid, quality, channelTag) {
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
    return { url: String(d.url), actualQuality: internalToHostQuality(quality), channel: channelTag || undefined };
  });
}

function probeMediaMagic(url) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15' },
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

function searchKuwo(query, page) {
  var params = {
    all: query, pn: page - 1, rn: 20, ft: 'music', client: 'kt',
    encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, cluster: 0,
    strategy: 2012, issubtitle: 1, show_copyright_off: 1, correct: 1,
    spPrivilege: 0, newver: 2, p2p: 1, notrace: 0, searchapi: 2, vermerge: 1
  };
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: params, timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var list = (res.data && res.data.abslist) || [];
    return list.map(function (it) {
      var rid = str(it.MUSICRID).replace(/^MUSIC_/, '');
      var pic = str(it.web_albumpic_short);
      return {
        source: 'kuwo', sid: rid,
        title: str(it.NAME || it.SONGNAME), artist: str(it.ARTIST),
        album: str(it.ALBUM), duration: parseInt(it.DURATION, 10) || 0,
        artwork: pic ? 'https://img1.kuwo.cn/star/albumcover/' + pic.replace('/120/', '/500/') : '',
        raw: { rid: rid } // v1.3.0 兜底移植：仅取链需要 rid（MV 字段采集属酷我插件展示层，不随移植）
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

// ==================== 兜底源②：网易云（移植自 netease-source v1.2.1） ====================
// 通道：官方 128k ⇄ eapi 竞速（standard）/ 海棠 wy + 星海 + eapi v1 竞速（高档）→
// oiapi → bugpk → 7boe → sedet → outer/url 接力。仅移植取链与搜索必需代码。

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
        duration: it.duration ? Math.round(it.duration / 1000) : 0,
        artwork: it.al && it.al.picUrl ? String(it.al.picUrl) : '',
        raw: { id: str(it.id), mv: it.mv ? String(it.mv) : '' }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

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

var GD_COOL_NORMAL_MS = 60000;
var GD_COOL_RATE_MS = 300000;
var gdCooldownUntil = 0;
function gdCoolingDown() { return Date.now() < gdCooldownUntil; }

function resolveNeteaseXinghai(raw, quality) {
  if (gdCoolingDown()) return Promise.reject(new Error('gdstudio cooling down'));
  var br = quality === 'hires' ? 999 : (quality === 'super' ? 740 : (quality === 'high' ? 320 : 128));
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
function resolveNeteaseSedet(raw, quality) {
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires' };
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
function resolveOiapi(raw, quality) {
  var q = (quality === 'super' || quality === 'hires') ? 'flac' : (quality === 'high' ? '320' : '128');
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
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires' };
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
    // eapi 响应 content-type 为 text/plain，axios 不自动解析 JSON，需手动 parse
    transformResponse: [function (d) { return d; }]
  }).then(function (res) {
    var rd = res.data;
    if (typeof rd === 'string') { try { rd = JSON.parse(rd); } catch (e) { rd = null; } }
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

// [v1.1.0 接口扩充·高优1] level 版取链 /api/song/enhance/player/url/v1（官方文档 §4.2）：
// level=standard|exhigh|lossless|hires（另支持 jyeffect/sky/dolby/jymaster），encodeType=flac；
// 响应结构与旧版一致（data[0].url / freeTrialInfo / br / level）。高档位需有效 VIP Cookie。
function neteaseEapiResolveV1(raw, quality) {
  var ck = neteaseCookieValue();
  if (!ck) return Promise.reject(new Error('netease eapi v1: 未配置 Cookie'));
  var levelMap = { standard: 'standard', low: 'standard', high: 'exhigh', super: 'lossless', hires: 'hires' };
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
    // eapi 响应 content-type 为 text/plain，axios 不自动解析 JSON，需手动 parse
    transformResponse: [function (d) { return d; }]
  }).then(function (res) {
    var rd = res.data;
    if (typeof rd === 'string') { try { rd = JSON.parse(rd); } catch (e) { rd = null; } }
    var item = rd && rd.data && rd.data[0];
    var url = item && item.url;
    if (!url) throw new Error('netease eapi v1 no url (code ' + (rd && rd.code) + ')');
    // [v1.1.0 P1-2] 同口径守卫：下发 freeTrialInfo 一律拒收
    if (item.freeTrialInfo) {
      throw new Error('netease eapi v1 trial clip ' + (item.freeTrialInfo.end || '') + 's');
    }
    // actualQuality：响应 level 优先，br 兜底（宁低勿高）
    var gotBr = parseInt(item.br, 10) || 0;
    var lvl = item.level || '';
    var aq = (lvl === 'hires' || gotBr >= 999000) ? 'hires'
      : (lvl === 'lossless' || gotBr >= 900000) ? 'flac'
      : (lvl === 'exhigh' || gotBr >= 320000) ? '320k' : '128k';
    return { url: String(url), actualQuality: aq, channel: 'netease-eapi-v1' };
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
    return raceSuccess([official128, neteaseEapiResolve(raw, quality)]).catch(function () {
      // [v1.1.0 P1-1] 官方两路全败（VIP 歌无 Cookie / 接口异常）→ 第三方兜底链接力
      // [v1.1.0 实测调整] sedet 2026-09-06 全档失效（免费/VIP 均 url 空 code 404，响应 ~3.9s），
      // 后移到 7boe 之后避免拖慢有效通道；恢复后自动回到兜底序列
      var stdChain = [
        function () { return resolveOiapi(raw, quality); },
        function () { return resolveBugpk(raw, quality); },
        function () { return resolveNetease7boe(raw, quality); },
        function () { return resolveNeteaseSedet(raw, quality); },
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
  var first = [function () { return resolveHaitang('wy', raw.id, quality, 'haitang-wy'); }];
  if (!gdCoolingDown()) first.push(function () { return resolveNeteaseXinghai(raw, quality); });
  if (neteaseCookieValue()) first.push(function () { return neteaseEapiResolveV1(raw, quality); });
  var chain = [
    function () { return raceSuccess(first.map(function (f) { return f(); })); },
    function () { return resolveOiapi(raw, quality); },
    function () { return resolveBugpk(raw, quality); },
    function () { return resolveNetease7boe(raw, quality); }
  ];
  var attempt = function (i) {
    if (i >= chain.length) return Promise.reject(new Error('netease ' + quality + ' all third-party failed'));
    return chain[i]().catch(function () { return attempt(i + 1); });
  };
  return attempt(0);
}

// ---------- 跨源兜底编排（v1.3.0） ----------

// [v1.3.0] 酷我兜底 URL 白名单（与酷我插件同口径）：https 放行；http 仅酷我 CDN 与
// 海棠 kw master 流式端点（裸 IP，稳定非签名直链）。汽水主链白名单是字节系域名，
// 兜底源必须按各自口径复核，不复用汽水的 isAllowedMediaUrl。
var KW_MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.kuwo\.cn$/i,
  /^175\.27\.166\.236$/i
];
function kwIsAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (/^https:\/\//i.test(s)) return true;
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  for (var i = 0; i < KW_MEDIA_URL_HTTP_HOST_ALLOWLIST.length; i++) {
    if (KW_MEDIA_URL_HTTP_HOST_ALLOWLIST[i].test(host)) return true;
  }
  return false;
}

// [v1.3.0] 网易云兜底 URL 白名单（与网易云插件同口径）：https 放行；http 仅网易官方域
// （含海棠 wy 返回的 126.net 直链、官方 MV CDN 的 vod.126.net 子域）。
var NE_MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.126\.net$/i, /\.163\.com$/i, /\.163cn\.tv$/i
];
function neIsAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (/^https:\/\//i.test(s)) return true;
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  for (var i = 0; i < NE_MEDIA_URL_HTTP_HOST_ALLOWLIST.length; i++) {
    if (NE_MEDIA_URL_HTTP_HOST_ALLOWLIST[i].test(host)) return true;
  }
  return false;
}

// [v1.3.0 → v1.5.0] 跨源同曲匹配：目标源按「歌名+歌手」搜索，v1.5.0 起改用严格
// 校验 isSameSongStrict（拆分式：核心歌名 + 版本标签精确匹配 + 歌手集合交集 +
// 时长 10% 容差，四条全过才算同曲——校验不通过的结果再快也不能用），只取第一条命中（搜索结果即相关
// 度序），不做多首尝试；无命中返回 null（该臂直接判负，绝不错播）。
async function fbFindMatchOn(searchFn, musicItem) {
  var kw = (String(musicItem.title || '') + ' ' + String(musicItem.artist || '')).trim();
  if (!kw) return null;
  var list = await searchFn(kw, 1);
  if (!list || !list.length) return null;
  for (var i = 0; i < list.length; i++) {
    var cand = list[i];
    if (cand && cand.title && isSameSongStrict(musicItem, cand)) return cand;
  }
  return null;
}

// [v1.3.0] 兜底阶段①：酷我。搜索同曲 → resolveKuwo 多级竞速取链 → URL 白名单复核。
async function resolveViaKuwo(musicItem, quality, subDeadline) {
  var match = await fbFindMatchOn(searchKuwo, musicItem);
  if (!match) throw new Error('kuwo 兜底：搜索无同曲命中');
  var remain = subDeadline - Date.now();
  if (remain <= 500) throw new Error('kuwo 兜底：阶段预算不足');
  var r = await withTimeout(resolveKuwo(match.raw, quality, match), remain, 'kuwo 兜底取链超时');
  if (!kwIsAllowedMediaUrl(r && r.url)) throw new Error('kuwo 兜底 URL 未通过协议/域名校验');
  return r;
}

// [v1.3.0] 兜底阶段②：网易云。搜索同曲 → resolveNetease（eapi + 接力源）→ URL 白名单复核。
async function resolveViaNetease(musicItem, quality, subDeadline) {
  var match = await fbFindMatchOn(searchNetease, musicItem);
  if (!match) throw new Error('netease 兜底：搜索无同曲命中');
  var remain = subDeadline - Date.now();
  if (remain <= 500) throw new Error('netease 兜底：阶段预算不足');
  var r = await withTimeout(resolveNetease(match.raw, quality), remain, 'netease 兜底取链超时');
  if (!neIsAllowedMediaUrl(r && r.url)) throw new Error('netease 兜底 URL 未通过协议/域名校验');
  return r;
}

// v1.4.0 P1：取链结果补 headers（对齐 baka AUDIO_PLAYBACK_HEADERS 语义）。
// 宿主 wrapper 会把 headers 透传给播放器/下载器；上游一加防盗链，裸 URL 即断。
// 策略：douyin/汽水系 CDN 带 douyin Referer（baka 同款）；兜底源（酷我/网易云）
// 只带通用 UA + Range，避免跨源 Referer 干扰；Range: bytes=0- 声明流式取全程。
var PLAYBACK_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36';

function playbackHeadersOf(url) {
  var h = { 'User-Agent': PLAYBACK_UA, Range: 'bytes=0-' };
  if (/douyin|qishui|zjcdn|snssdk|bytedance|bytecdn|toutiao/i.test(String(url || ''))) {
    h.Referer = 'https://www.douyin.com/';
  }
  return h;
}

function withPlaybackHeaders(r) {
  if (!r || !r.url) return r;
  return Object.assign({}, r, { headers: playbackHeadersOf(r.url) });
}

// [v1.5.0] 并行竞速原语：全部任务同时启动，第一个 resolve 的直接胜出（携带胜者标签
// 与已观测到的失败明细）；全部 reject 才判负（返回各臂错误明细供 tried 记账与负缓存
// 判定）。慢的一方不 cancel——其 Promise 自然走完、结果被丢弃（本函数对每个任务都挂
// 了 handler，不会产生 unhandled rejection）。
function raceFirstValid(tasks) {
  return new Promise(function (resolve, reject) {
    var pending = tasks.length;
    var failures = [];
    if (!pending) { reject(failures); return; }
    tasks.forEach(function (t) {
      Promise.resolve(t.promise).then(function (v) {
        resolve({ winner: t.label, value: v, failures: failures });
      }, function (e) {
        failures.push({ label: t.label, error: e || new Error('unknown') });
        pending--;
        if (pending === 0) reject(failures);
      });
    });
  });
}

// [v1.5.0] 竞速失败臂记账：tried 摘要 +「无同曲命中」确定性失败进负缓存（沿用 v1.3.0 语义）。
function fbRecordFailure(tried, songKey, label, err) {
  var msg = String((err && err.message) || err || '');
  tried.push(label + ': ' + msg.slice(0, 60));
  if (label === 'kuwo' && /无同曲命中/.test(msg)) fbNegMark('kuwo|' + songKey);
}

// [v1.5.0] 酷我兜底竞速臂：搜索同曲 → resolveKuwo 多级竞速取链（v1.3.0 既有实现，
// 零重写）→ URL 白名单复核 → guardFullAudio 试听守卫。守卫在臂内完成，保证胜出结果
// 已过全部有效性校验（非试听片段才允许胜出）；非 guard 类探测失败（超时/网络）不
// 拦截、放行，沿用 v1.3.0 语义。
function kuwoRacerValidated(musicItem, q, subDeadline, totalDeadline) {
  return resolveViaKuwo(musicItem, q, subDeadline).then(function (r2) {
    if (!kwIsAllowedMediaUrl(r2 && r2.url)) throw new Error('kuwo 兜底 URL 未通过协议/域名校验');
    var g = Math.min(subDeadline, totalDeadline) - Date.now();
    var guardP = Promise.resolve();
    if (g > 500) {
      guardP = withTimeout(guardFullAudio(r2.url, musicItem, r2.actualQuality), Math.min(g, SOURCE_TIMEOUT), 'guard 超时')
        .catch(function (ge) {
          if (ge && /^guard:/.test(String(ge && ge.message))) throw ge; // 试听片段 → 竞速判负
        });
    }
    return guardP.then(function () {
      return withPlaybackHeaders(Object.assign({}, r2, { channel: r2.channel ? 'kuwo-fallback:' + r2.channel : 'kuwo-fallback' }));
    });
  });
}

// [v1.3.0 → v1.5.0] 取链总编排（并行竞速版）：
// v1.3.0 串行（汽水主链 ≤4.5s → 酷我兜底累计 ≤6.5s → 网易云 ≤8s）在「汽水自身接口
// 基本不可用、70%+ 请求实际借道酷我」的现状下，酷我必须排在汽水主链超时之后，两次
// 串行取链叠加致平均 3.28~3.57s。v1.5.0 改为：汽水主链与酷我兜底两臂同时启动、谁先
// 返回有效结果（过 URL 白名单 + guardFullAudio 试听守卫）用谁；慢的一臂不 cancel、
// 结果丢弃。两臂全败仍走网易云兜底（吃满剩余全局预算），降级链与试听/音质校验逻辑
// 不变。音质档位映射不变：宿主键 normalizeQuality → standard/high/super/hires，酷我
// 臂按同名内部档直取（resolveKuwo 内含海棠兜底与母带链）；hires/master 等增强键顺延
// 映射到酷我母带链/网易云 hires，属额外能力。失败负缓存只记「搜索无同曲命中」这类
// 确定性失败。
async function getMediaSourceWithFallback(musicItem, quality) {
  var q = normalizeQuality(quality);
  var started = Date.now();
  var deadline = started + FB_TOTAL_BUDGET_MS;
  var songKey = makeKey(musicItem.title, musicItem.artist);
  var tried = [];

  // ① 汽水主链竞速臂（v1.2.2 原逻辑不动，resolveWithFallback 内部逐源带 guard；
  //    共享全局 deadline，仍以 FB_PHASE1_MS 封顶——超时即判负，为网易云兜底保留预算）
  var p1End = Math.min(started + FB_PHASE1_MS, deadline);
  var qishuiRacer = withTimeout(
    resolveWithFallback(musicItem, q, deadline),
    Math.max(p1End - Date.now(), 0),
    '汽水主链阶段超时'
  ).then(withPlaybackHeaders);

  // ② 酷我兜底竞速臂（与汽水主链同时启动；负缓存命中则不参赛）
  var tasks = [{ label: 'qishui', promise: qishuiRacer }];
  if (fbNegHit('kuwo|' + songKey)) {
    tried.push('kuwo: 负缓存跳过');
  } else {
    var p2End = Math.min(started + FB_PHASE2_MS, deadline);
    tasks.push({ label: 'kuwo', promise: kuwoRacerValidated(musicItem, q, p2End, deadline) });
  }

  // 竞速裁决：任一臂先返回有效结果即用之；两臂全败则记账后进入网易云兜底
  try {
    var won = await raceFirstValid(tasks);
    for (var fi = 0; fi < won.failures.length; fi++) {
      fbRecordFailure(tried, songKey, won.failures[fi].label, won.failures[fi].error);
    }
    return won.value;
  } catch (failures) {
    for (var fj = 0; fj < failures.length; fj++) {
      fbRecordFailure(tried, songKey, failures[fj].label, failures[fj].error);
    }
  }

  // ③ 网易云兜底（吃满剩余全局预算；v1.3.0 逻辑不变）
  if (fbNegHit('netease|' + songKey)) {
    tried.push('netease: 负缓存跳过');
  } else {
    try {
      var r3 = await resolveViaNetease(musicItem, q, deadline);
      var g3 = Math.min(deadline - Date.now(), SOURCE_TIMEOUT);
      if (g3 > 500) {
        await withTimeout(guardFullAudio(r3.url, musicItem, r3.actualQuality), g3, 'guard 超时')
          .catch(function (ge) {
            if (ge && /^guard:/.test(String(ge.message))) throw ge;
          });
      }
      return withPlaybackHeaders(Object.assign({}, r3, { channel: r3.channel ? 'netease-fallback:' + r3.channel : 'netease-fallback' }));
    } catch (e3) {
      tried.push('netease: ' + String((e3 && e3.message) || '').slice(0, 60));
      if (/无同曲命中/.test(String(e3 && e3.message))) fbNegMark('netease|' + songKey);
    }
  }

  throw new Error('取链失败：汽水及全部兜底源（酷我/网易云）均未取得播放链接 [' + tried.join(' | ') + ']');
}


// ==================== 汽水歌词适配 ====================
// v1.1.0 🟡-5 歌词两段（小修：网易云搜索兜底与匹配打分已移除，歌词只走汽水自身通道）：
//   ① 分享页 _ROUTER_DATA lyrics.sentences（行级时间戳，与取链同源免额外成本）
//   ② bugpk qsmusic KRC 逐字歌词（转 LRC 交付，原始 KRC 缓存给 getWordByWordLyric）

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function msToLrcTime(ms) {
  var m0 = Math.floor(ms / 60000);
  var s0 = Math.floor((ms % 60000) / 1000);
  var c0 = Math.floor(ms % 1000);
  return pad2(m0) + ':' + pad2(s0) + '.' + (c0 < 10 ? '00' + c0 : c0 < 100 ? '0' + c0 : c0);
}

// 分享页 sentences（行级 startMs/endMs + words[].text）→ LRC
function sentencesToLrc(sentences) {
  if (!sentences || !sentences.length) return '';
  var lines = [];
  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i] || {};
    var text = '';
    var words = s.words || [];
    for (var w = 0; w < words.length; w++) text += String((words[w] && words[w].text) || '');
    if (!text) continue;
    lines.push('[' + msToLrcTime(Number(s.startMs) || 0) + ']' + text);
  }
  return lines.join('\n');
}

// bugpk KRC（[行起始ms,行持续]<字起始ms,字持续ms,0>字...）→ LRC
function krcToLrc(krcText) {
  var src = String(krcText || '');
  if (!src) return '';
  var out = [];
  var rows = src.split('\n');
  for (var i = 0; i < rows.length; i++) {
    var m = rows[i].match(/^\[(\d+),\d+\](.*)$/);
    if (!m) continue;
    var body = String(m[2] || '').replace(/<\d+,\d+,\d+>/g, '');
    if (!body) continue;
    out.push('[' + msToLrcTime(Number(m[1]) || 0) + ']' + body);
  }
  return out.join('\n');
}

// ==================== v1.6.0 P0：逐字歌词 QRC 转换 ====================
// 宿主 lrcSource 只读 rawLrc 且要求 QRC 行格式 [startMs,durMs]词(startMs,durMs)…
// （plugin.ts lrcSource?.rawLrc 判空 + lrcParser LINE_TIME_PATTERN 解析）。
// v1.1.0 返回 { lrc: KRC 原文 }——lrc 是废弃的「歌词 URL」字段，宿主不认，逐字歌词实际失效。

// 分享页 sentences（行级 startMs/endMs + words[] 逐字 startMs/endMs，2026-09-08 实测）
// → QRC。与取链同源免额外第三方依赖，作为逐字歌词的原生主通道。
function sentencesToQrc(sentences) {
  if (!sentences || !sentences.length) return '';
  var lines = [];
  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i] || {};
    var startMs = Number(s.startMs) || 0;
    var endMs = Number(s.endMs) || 0;
    var words = s.words || [];
    var body = '';
    for (var w = 0; w < words.length; w++) {
      var wd = words[w] || {};
      var txt = String(wd.text || '');
      if (!txt) continue;
      var ws = Number(wd.startMs) || 0;
      var we = Number(wd.endMs) || 0;
      body += txt + '(' + ws + ',' + (we > ws ? we - ws : 0) + ')';
    }
    if (!body) continue;
    lines.push('[' + startMs + ',' + (endMs > startMs ? endMs - startMs : 0) + ']' + body);
  }
  return lines.join('\n');
}

// bugpk KRC（[行起始ms,行持续]<字起始ms,字持续ms,0>字...）→ QRC。
// 酷狗插件 parseKrcForHost 核心同款：字 offset 相对行首，绝对时刻 = 行起始 + 字起始。
function krcToQrc(krcText) {
  var src = String(krcText || '');
  if (!src) return '';
  var out = [];
  var rows = src.split('\n');
  for (var i = 0; i < rows.length; i++) {
    var m = rows[i].match(/^\[(\d+),(\d+)\](.*)$/);
    if (!m) continue;
    var startMs = parseInt(m[1], 10);
    var durMs = parseInt(m[2], 10);
    var body = String(m[3] || '');
    if (body.indexOf('<') < 0) continue;
    var words = '', wm;
    var re = /<(\d+),(\d+),\d+>([^<]*)/g;
    while ((wm = re.exec(body))) {
      var rel = parseInt(wm[1], 10);
      var wd = parseInt(wm[2], 10);
      var txt = wm[3];
      if (txt) words += txt + '(' + (startMs + rel) + ',' + wd + ')';
    }
    if (words) out.push('[' + startMs + ',' + durMs + ']' + words);
  }
  return out.join('\n');
}

// KRC 逐字歌词缓存（getWordByWordLyric 用；lyric 适配器命中 bugpk 时回填）
var qishuiWordLyricCache = {};

var LYRIC_ADAPTERS = {
  qishui: async function (raw, item) {
    if (!raw || !raw.trackId) throw new Error('qishui lyric no trackId');
    // ① 分享页逐字 lyrics.sentences（行级时间戳，直连算法附带）
    try {
      var sp = await fetchShareTrackPage(raw.trackId, CHAN_TIMEOUT.share_page);
      var sentences = sp.opt && sp.opt.lyrics && sp.opt.lyrics.sentences;
      var lrc = sentencesToLrc(sentences);
      if (lrc) return { rawLrc: lrc };
    } catch (e1) { /* 接力 bugpk */ }
    // ② bugpk qsmusic KRC 逐字歌词
    try {
      var bk = await axios.get('https://api.bugpk.com/api/qsmusic', {
        params: { url: qishuiSharePageUrl(raw.trackId), type: 'json' },
        timeout: CHAN_TIMEOUT.bugpk,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
      });
      var krc = bk.data && bk.data.data && bk.data.data.lyric;
      var klrc = krcToLrc(krc);
      if (klrc) {
        qishuiWordLyricCache[raw.trackId] = String(krc); // 逐字 KRC 留给 getWordByWordLyric
        return { rawLrc: klrc };
      }
    } catch (e2) { /* 汽水两段通道均未命中，不再兜底 */ }
    throw new Error('qishui lyric: no lyric from qishui channels');
  }
};

// v1.6.0 P0 修复：逐字歌词字段错位——宿主只读 rawLrc（lrc 是废弃 URL 字段，宿主不认）。
// 双通道转 QRC（[ms,dur]词(ms,dur)）：① 分享页 sentences 原生逐字时戳 ② bugpk KRC→QRC 转换（对齐酷狗 parseKrcForHost 思路）
async function getWordByWordLyricImpl(musicItem) {
  if (!musicItem || !musicItem._src || !musicItem._src.qishui) return null;
  var trackId = musicItem._src.qishui.trackId;
  if (!trackId) return null;
  // ① 缓存命中的 KRC → QRC
  var krc = qishuiWordLyricCache[trackId];
  if (krc) {
    var cq = krcToQrc(krc);
    if (cq) return { rawLrc: cq };
  }
  // ①.5 [v1.7.0] seo_track 逐字歌词（lyric.type=krc，随取链接口一并返回，快于分享页 SSR）
  try {
    var seo = await fetchSeoTrack(trackId, 2000);
    var skrc = seo && seo.lyric && seo.lyric.type === 'krc' ? seo.lyric.content : '';
    if (skrc) {
      qishuiWordLyricCache[trackId] = String(skrc);
      var sq = krcToQrc(skrc);
      if (sq) return { rawLrc: sq };
    }
  } catch (e0) { /* 接力分享页 */ }
  // ② 分享页 sentences（逐字 startMs/endMs）→ QRC
  try {
    var sp = await fetchShareTrackPage(trackId, CHAN_TIMEOUT.share_page);
    var sentences = sp.opt && sp.opt.lyrics && sp.opt.lyrics.sentences;
    var qrc = sentencesToQrc(sentences);
    if (qrc) return { rawLrc: qrc };
  } catch (e1) { /* 接力 bugpk */ }
  // ③ bugpk qsmusic KRC 逐字歌词 → QRC（回填缓存）
  try {
    var bk = await axios.get('https://api.bugpk.com/api/qsmusic', {
      params: { url: qishuiSharePageUrl(trackId), type: 'json' },
      timeout: CHAN_TIMEOUT.bugpk,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
    });
    krc = bk.data && bk.data.data && bk.data.data.lyric;
    if (krc) qishuiWordLyricCache[trackId] = String(krc);
    var q2 = krcToQrc(krc);
    if (q2) return { rawLrc: q2 };
  } catch (e2) { /* 双通道均未命中 */ }
  return null;
}


// 歌词源尝试顺序：汽水单源插件，条目原生源（qishui）即全部，无跨源接力。
var LYRIC_SOURCE_ORDER = [];

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
  // v1.1.0：删除基线的尾部重复重试——order 已含 qishui（LYRIC_SOURCE_ORDER 虽为空，
  // 原生源 _srcOrder 即 qishui），再兜底一次等于同一通道重复请求，浪费时间不增加成功率。
  throw new Error('所有音源歌词均不可用（' + tried.join(' | ') + '）');
}

// ==================== 插件定义 ====================

var plugin = {
  platform: 'qishui',
  version: '1.9.14', // [v1.9.14 包升版（网易源集成长青 SVIP 网易替补通道 yinyue.haitangw.net，本源无代码改动，随包升版）；v1.9.13 包升版（QQ 源 a.aa.cab 通道方案A 拒绝虚标修复，本源无代码改动）；v1.9.12 包升版（QQ 源接入 a.aa.cab 新通道，本源无代码改动）；v1.9.10 随包升版（无代码改动，版本号统一升）；v1.9.9 音质标识一致性核查版（无代码改动，随包升版）：六页核查 0 虚标（sheet 页上游探无可用歌单未覆盖，import 与歌单详情同源通道）；已知边界：翻唱目录曲（如晴天钢琴版）跨全源不可取链属目录缺口非标识虚标，192k 请求如实上报 actual=320k，详见排查总表-v1.9.9；v1.9.8菜单 size 诚实性修正版：qualitiesFromBitRates 不再挂上游自有通道标称 size（逐曲 HEAD 探测 8 曲 16 次实测 320k 档偏差 0.99~1.23、128k 档 1.47~2.05，跨源兜底 VBR 无法换算，宁缺毋假），下载面板以 getMediaSource 实测 size 为准；v1.9.6 音质诚实性版：分享页通道从 URL br= 参数如实标注 actualQuality（实测 ~126≈higher→192k 约定，宁低勿高），杜绝单一码率流被宿主按请求档误标；v1.9.4 第三方取链排查 + size 字段版：汽水本轮排查第三方 bugpk（api.bugpk.com）alive 无失效，本轮零移除；getMediaSource 返回值补 size 字段（取链响应直带 > HEAD Range 0-0 探测 > 留空）+ 补 quality 标准字段对齐 IMediaSourceResult 契约，详见头部 changelog；v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机 SHEET_URL_UNRECOGNIZED，详见头部 changelog；v1.9.1 随包升版：歌单对象补 author 别名字段（宿主协议读 artist，任务字段清单要求 author，两者都传），导入修复详见酷狗 v1.9.1 changelog 与本轮自测清单；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——P1 汽水对比评估无吸收项（本插件 PC 三端点三档+完整性守卫覆盖其 SEO 兜底形态），详见头部 changelog；v1.8.4] 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem（title/artwork/worksNum 随 playlist 对象零额外请求回传，实测无 desc 不传 description）；[v1.8.3] 质检遗留优化版（Q-02/Q-03 复核确认已符合统一口径，详见头部 v1.8.3 changelog）；2026-09-10 歌单解析修复版（P2-1 音乐/歌单条目补 platform + P2-6 推荐歌单条目补 platform + P2-4 错误码统一，详见头部 v1.8.2 changelog）
  author: '研发2号',
  description: '汽水音乐独立源插件 v1.9.8（v1.9.8 菜单 size 诚实性修正版：qualitiesFromBitRates 不再挂上游自有通道标称 size（逐曲 HEAD 探测 8 曲 16 次实测 320k 档偏差 0.99~1.23、128k 档 1.47~2.05，跨源兜底 VBR 无法换算，宁缺毋假），菜单只保留 bitrate，下载面板以 getMediaSource 实测 size 为准；v1.9.5 全页面音质标识核查 + VIP 标识移除版：音质标识各入口核查无缺口；全接口停写 fee（VIP 角标）与聚合/回填链路，feeOfTrack 移除；上一版 v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（axios maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机导入 SHEET_URL_UNRECOGNIZED，详见头部 changelog；v1.9.2 分享链接文本自动提取 URL 版：resolveSheetId 入口先 extractShareUrl 提取第一个 http/https URL 再走短链跟随/域名门/id 提取，详见头部 changelog；v1.9.1 随包升版：歌单对象补 author 别名字段，详见头部 v1.9.1 changelog；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——P1 与 BakaMusic 汽水插件对比评估判定不重复建设（其 SEO 兜底形态实测上限 320k，本插件 PC 三端点 medium/higher/highest 三档 + guardFullAudio 完整性守卫 + 302 解析链覆盖之），详见头部 v1.9.0 changelog；v1.8.4 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem 歌单对象——标题/封面/曲数随 luna/playlist/detail 响应 playlist 对象零额外请求回传，实测无歌单介绍字段故不传 description，介绍字段名对齐宿主 v1.0.0 契约；v1.8.3 质检遗留优化版：Q-02/Q-03 错误前缀与 code 枚举复核确认已符合统一口径；v1.8.2 歌单解析修复版：音乐/歌单条目与推荐歌单条目补 platform（宿主按 platform 反查插件），歌单导入错误统一携带结构化 code；+ v1.8.0 MV 参数对齐基线 + v1.7.0 seo_track 通道（三档 m4a+逐字歌词）+ CENC play_auth 密钥提取 + entity.track 解析防御 + 逐字歌词 rawLrc 修复 + 专辑/歌手搜索与详情 + 分享链接 + primaryKey；本插件不提供 MV 播放）',
  // v1.6.0 P1：新增专辑/歌手搜索（music/sheet 原有）
  supportedSearchType: ['music', 'album', 'artist', 'sheet'],
  // v1.6.0 P2：声明主键字段（宿主存档展示，对齐其他平台插件约定）
  primaryKey: ['id'],
  // v1.1.0 🟠-3：汽水自身三通道实测均为单档 ≈128k m4a。
  // v1.3.0：接跨源兜底后对外扩为 4 档——standard 由汽水自身供给，high/super 由
  // 酷我/网易云兜底源供给；actualQuality 按实际命中档位如实标注（宁低勿高）。
  supportedQualities: ['128k', '192k', '320k', 'flac'],
  cacheControl: 'no-store', // 播放链接为签名短时效链接，必须现取
  userVariables: [
    // [v1.4.1] 新增 userVariables 声明：netease eapi 兜底通道（eapi / eapi v1 通道）读取
    // userVariables.neteaseCookie（qishui.js neteaseCookieValue()），但 manifest 此前完全未声明，
    // 配置入口不存在导致该值永远为空、eapi 通道不可达（审查「一般」级问题）。
    { key: 'neteaseCookie', name: '网易云 Cookie（可选）', hint: '用于 eapi 兜底取链，留空则跳过' }
  ],
  hints: {
    search: ['检索汽水音乐曲库', '播放走分享页直连算法取链（免登录明文直链），失败自动降级 bugpk 备源 / track.php；跨源兜底与自身通道并行竞速（酷我先到先用，全败再网易云兜底，同曲匹配不错播）'],
    importMusicSheet: [
      '支持汽水音乐歌单分享链接（含 playlist_id 参数的 qishui.douyin.com / douyin.com 链接）',
      '汽水短链接（qishui.douyin.com/s/xxx）可直接粘贴，自动跳转解析',
      '单次最多导入 500 首；纯数字歌单 ID 无法识别，请粘贴完整链接'
    ]
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }；解包出关键词（所有 searchType 通用）
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var q = kw;
    if (type === 'sheet') return aggregateSearchBy(SHEET_SEARCH_ADAPTERS, q, page, sheetKeyOf, buildSheetSearchItem);
    // v1.6.0 P1：专辑/歌手搜索（适配器声明提升自 module.exports 后追加段）
    if (type === 'album') return aggregateSearchBy(ALBUM_SEARCH_ADAPTERS, q, page, albumKeyOf, buildAlbumSearchItem);
    if (type === 'artist') return aggregateSearchBy(ARTIST_SEARCH_ADAPTERS, q, page, artistKeyOf, buildArtistSearchItem);
    if (type !== 'music') return { isEnd: true, data: [] };

    var names = ['qishui'];
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
    if (okCount === 0) throw new Error('搜索失败：汽水源请求失败');

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
    // 封面反查不进搜索关键路径，封面缺失由 getMusicInfo 在播放/详情页按需补齐
    return { isEnd: data.length === 0, data: data };
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    // v1.5.0：汽水主链 ∥ 酷我兜底并行竞速 → 全败再网易云兜底，编排与预算见 getMediaSourceWithFallback
    var r = await getMediaSourceWithFallback(musicItem, quality);
    // [v1.9.4] 边界补 size 兜底：竞速链返回无 size 时，Range 0-0 HEAD 探测；
    // 探测失败留空（不阻断取链）
    if (r && r.url && !r.size) {
      try { var sz = await probeHeadSize(r.url, 2000); if (sz > 0) r.size = sz; } catch (e) {}
    }
    // [v1.9.4] 补宿主标准字段 quality（= actualQuality），对齐 IMediaSourceResult 契约
    if (r && r.url && r.quality === undefined && r.actualQuality) r.quality = r.actualQuality;
    return r;
  },

  // v1.8.0 P0：显式声明无 MV 能力。汽水无 MV 通道（无接口、无上游数据），返回 null
  // 即可——宿主 canPlayMusicVideo 守卫因 item.is_video=false 不会走此路径；本方法
  // 存在仅为对齐 MusicFree v1.0.0 协议（其他 5 源均已实现 getMvSource）。
  async getMvSource(musicItem, videoQuality) {
    return null;
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  // v1.1.0 逐字歌词：v1.6.0 P0 修复——KRC/sentences 转 QRC 放 rawLrc 返回（宿主只读 rawLrc）
  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  // v0.7.0 P0-3：单曲分享链接导入（汽水）
  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // v0.7.0 P0-4：歌曲详情（补齐封面/专辑/时长）
  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  // v1.6.0 P1：专辑详情（专辑信息 + 专辑内曲目，走分享页 SSR）
  async getAlbumInfo(albumItem, page) {
    return getAlbumInfoImpl(albumItem, page);
  },

  // v1.6.0 P1：歌手作品（热门歌曲，走分享页 SSR；上游只回 4 首，isEnd 恒 true）
  async getArtistWorks(artistItem, page) {
    return getArtistWorksImpl(artistItem, page);
  },

  // v1.6.0 P1：分享链接（复用取链同源的分享页 URL，实测可访问）
  getMusicDetailPageUrl(musicItem) {
    var raw = musicItem && musicItem._src && musicItem._src.qishui;
    if (!raw || !raw.trackId) return '';
    return qishuiSharePageUrl(raw.trackId);
  },

  async getTopLists() {
    var groups = [{
      title: '汽水榜单',
      data: CHART_DEFS.map(function (d) {
        // v1.2.1：宿主 topListItem.tsx 渲染榜单封面只读 coverImg，artwork 双写兼容
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
    var musicList2 = await getAggregatedChart(def);
    // v1.2.1：透传 topListItem（含 coverImg），详情页头部可直接渲染封面（baka 对齐）
    return Object.assign({}, topListItem, { isEnd: true, musicList: musicList2 });
  },

  // v1.2.1 新增：推荐歌单分类（宿主 pinned.map 渲染横向 pill，须扁平数组）
  async getRecommendSheetTags() {
    return {
      data: [],
      pinned: QISHUI_SHEET_TAGS.map(function (t) {
        return { id: t.id, title: t.title };
      })
    };
  },

  async getRecommendSheetsByTag(tag, page) {
    return getRecommendSheetsByTagImpl(tag, page || 1);
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
  },

  async getMusicComments(musicItem, page) {
    return getMusicCommentsImpl(musicItem, page);
  },

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
    // v1.5.0：竞速兜底严格同曲校验（拆分式精确匹配，测试复用）
    isSameSongStrict: isSameSongStrict,
    splitStrictTitle: splitStrictTitle,
    strictTagSetsEqual: strictTagSetsEqual,
    STRICT_TAG_DEFS: STRICT_TAG_DEFS,
    normalizeArtistSet: normalizeArtistSet,
    artistSetsIntersect: artistSetsIntersect,
    aggregateItems: aggregateItems,
    buildMusicItem: buildMusicItem,
    scoreOf: scoreOf,
    pickCandidates: pickCandidates,
    canServe: canServe,
    decryptQishuiTrackResp: decryptQishuiTrackResp,
    resolveQishuiTrackPhp: resolveQishuiTrackPhp,
    resolveQishuiSharePage: resolveQishuiSharePage,
    waDropHead: waDropHead,
    qishuiCover: qishuiCover,
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
    QISHUI_SHEET_TAGS: QISHUI_SHEET_TAGS,
    getRecommendSheetsByTagImpl: getRecommendSheetsByTagImpl,
    // v1.2.2：空 id 兜底辅助（测试复用）
    qishuiSubChannelIdOf: qishuiSubChannelIdOf,
    qishuiMixParse: qishuiMixParse,
    SHEET_FETCHERS: SHEET_FETCHERS,
    resolveSheetId: resolveSheetId,
    buildSheetItem: buildSheetItem,
    importMusicSheetImpl: importMusicSheetImpl,
    LYRIC_ADAPTERS: LYRIC_ADAPTERS,
    getLyricImpl: getLyricImpl,
    // 惰性 getter：本对象字面量在函数声明求值之前赋值，用 getter 保证调用时拿到已赋值的表。
    get SHEET_SEARCH_ADAPTERS() { return SHEET_SEARCH_ADAPTERS; },
    // v1.6.0：专辑/歌手搜索与详情（module.exports 后追加段，同样用 getter）
    get ALBUM_SEARCH_ADAPTERS() { return ALBUM_SEARCH_ADAPTERS; },
    get ARTIST_SEARCH_ADAPTERS() { return ARTIST_SEARCH_ADAPTERS; },
    get buildAlbumSearchItem() { return buildAlbumSearchItem; },
    get buildArtistSearchItem() { return buildArtistSearchItem; },
    get getAlbumInfoImpl() { return getAlbumInfoImpl; },
    get getArtistWorksImpl() { return getArtistWorksImpl; },
    get albumKeyOf() { return albumKeyOf; },
    get artistKeyOf() { return artistKeyOf; },
    get trackEntryOf() { return trackEntryOf; },
    // v1.6.0 P0：QRC 转换（函数声明提升，直接引用）
    sentencesToQrc: sentencesToQrc,
    krcToQrc: krcToQrc,
    getMusicSheetInfoImpl: getMusicSheetInfoImpl,
    getMusicCommentsImpl: getMusicCommentsImpl,
    aggregateSearchBy: aggregateSearchBy,
    normalizeQuality: normalizeQuality,
    QUALITY_KEY_MAP: QUALITY_KEY_MAP,
    importMusicItemImpl: importMusicItemImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    SONG_URL_RESOLVERS: SONG_URL_RESOLVERS,
    resolveSongId: resolveSongId,
    SONG_DETAIL_FETCHERS: SONG_DETAIL_FETCHERS,
    isAllowedMediaUrl: isAllowedMediaUrl,
    withTimeout: withTimeout,
    RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
    // v1.1.0：RELAY_TIMEOUT/internalToHostQuality/raceSuccess/LYRIC_TIMEOUT 已删除（死代码/预算分层重构）
    QISHUI_ACTUAL: QISHUI_ACTUAL,
    resolveWithFallback: resolveWithFallback,
    CHAN_TIMEOUT: CHAN_TIMEOUT,
    REDIRECT_HOP_TIMEOUT: REDIRECT_HOP_TIMEOUT,
    REDIRECT_CHAIN_BUDGET_MS: REDIRECT_CHAIN_BUDGET_MS,
    fetchShareTrackPage: fetchShareTrackPage,
    qishuiSharePageUrl: qishuiSharePageUrl,
    resolveQishuiBugpk: resolveQishuiBugpk,
    resolveQishui: resolveQishui,
    // v1.7.0：seo_track 通道 + play_auth 密钥提取 + CENC box 检测（测试复用）
    fetchSeoTrack: fetchSeoTrack,
    resolveQishuiSeoTrack: resolveQishuiSeoTrack,
    extractPlayAuthKey: extractPlayAuthKey,
    qishuiBase64ToBytes: qishuiBase64ToBytes,
    bitcount32: bitcount32,
    decodeBase36Char: decodeBase36Char,
    qishuiSpadeInner: qishuiSpadeInner,
    detectCencBoxes: detectCencBoxes,
    qishuiFindBoxes: qishuiFindBoxes,
    qishuiNegHit: qishuiNegHit,
    qishuiNegMark: qishuiNegMark,
    QISHUI_NEG_TTL_MS: QISHUI_NEG_TTL_MS,
    sentencesToLrc: sentencesToLrc,
    krcToLrc: krcToLrc,
    // v1.4.0：音质大小/VIP 标记/播放 headers（测试复用）
    qualitiesFromBitRates: qualitiesFromBitRates,
    BIT_RATE_KEY_MAP: BIT_RATE_KEY_MAP,
    playbackHeadersOf: playbackHeadersOf,
    withPlaybackHeaders: withPlaybackHeaders,
    getWordByWordLyricImpl: getWordByWordLyricImpl,
    GUARD_BPS: GUARD_BPS,
    MEDIA_URL_HTTP_HOST_ALLOWLIST: MEDIA_URL_HTTP_HOST_ALLOWLIST,
    // v1.3.0：跨源兜底（测试复用）
    getMediaSourceWithFallback: getMediaSourceWithFallback,
    resolveViaKuwo: resolveViaKuwo,
    resolveViaNetease: resolveViaNetease,
    fbFindMatchOn: fbFindMatchOn,
    fbNegHit: fbNegHit,
    fbNegMark: fbNegMark,
    FB_TOTAL_BUDGET_MS: FB_TOTAL_BUDGET_MS,
    FB_PHASE1_MS: FB_PHASE1_MS,
    FB_PHASE2_MS: FB_PHASE2_MS,
    FB_NEG_TTL_MS: FB_NEG_TTL_MS,
    // 惰性 getter：移植段函数声明在 module.exports 之后求值，调用时才取值
    get searchKuwo() { return searchKuwo; },
    get searchNetease() { return searchNetease; },
    get resolveKuwo() { return resolveKuwo; },
    get resolveNetease() { return resolveNetease; },
    get kwIsAllowedMediaUrl() { return kwIsAllowedMediaUrl; },
    get neIsAllowedMediaUrl() { return neIsAllowedMediaUrl; }
  }
};


module.exports = plugin;


// v1.1.0 🟢：删除未使用的 formatTs（死代码，无调用方）。

// ==================== v0.5.0 追加段 A：歌单搜索（聚合） ====================
// 歌单搜索：汽水单源（luna/search/playlist，实测 2026-09-05）。
// 基线中专辑/歌手搜索无汽水通道，拆分时随其他平台代码一并移除。
// 注：本段位于 module.exports 之后，函数声明提升 + 调用时求值，行为与前置声明一致。


function searchSheetQishui(q, page) {
  var params = {
    aid: 386088, app_name: 'luna_pc', device_id: '2170852561392692',
    version_name: '1.7.0', version_code: 10070000, ac: 'wifi',
    tz_name: 'Asia/Shanghai', device_platform: 'windows',
    device_type: 'Windows', os_version: 'Windows',
    q: q, count: 20, search_method: 'history', cursor: (page - 1) * 20
  };
  return axios.get('https://api.qishui.com/luna/search/playlist', {
    params: params, timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'LunaPC/3.0.0(290101097)', Referer: 'https://api.qishui.com/' }
  }).then(function (res) {
    var groups = (res.data && res.data.result_groups) || [];
    var data = [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] && groups[i].id === 'playlists' && groups[i].data) { data = groups[i].data; break; }
    }
    var out = [];
    for (var j = 0; j < data.length; j++) {
      var d = data[j] || {};
      var ent = d.entity || d;
      var pl = ent.playlist || ent;
      if (!pl || (!pl.id && !pl.playlist_id)) continue;
      var pid = str(pl.id || pl.playlist_id);
      out.push({
        source: 'qishui', sid: pid,
        title: str(pl.name || pl.title),
        artist: str(pl.owner_name || (pl.owner && pl.owner.name) || ''),
        artwork: qishuiCover(pl.url_cover || pl.cover_url),
        worksNum: pl.track_count || pl.trackCount || 0,
        raw: { listId: pid }
      });
    }
    return out.filter(function (it) { return it.sid && it.title; });
  });
}

var SHEET_SEARCH_ADAPTERS = {
  qishui: searchSheetQishui
};


// ==================== v1.6.0 追加段 C：专辑/歌手搜索与详情（P1-2）====================
// 搜索：luna/search/album（group id=albums）/ luna/search/artist（id=artists），实测 2026-09-08 HTTP 200，
//       公共参数与 searchSheetQishui 一致（aid=386088/app_name=luna_pc/LunaPC UA）。
// 详情：接口文档 X.2/X.3 的 /luna/pc/album|artist/{id} 系列端点实测全量 404（已下线，8 个变体全试），
//       改走分享页 SSR：share/album?album_id= / share/artist?artist_id → _ROUTER_DATA.loaderData.{album|artist}_page
//       （albumInfo+trackList / artistInfo+trackList，track 为全结构含 bit_rates/preview/audition_info）。
// 注：本段位于 module.exports 之后，函数声明提升 + 调用时求值，行为与前置声明一致。


function searchAlbumQishui(q, page) {
  var params = {
    aid: 386088, app_name: 'luna_pc', device_id: '2170852561392692',
    version_name: '1.7.0', version_code: 10070000, ac: 'wifi',
    tz_name: 'Asia/Shanghai', device_platform: 'windows',
    device_type: 'Windows', os_version: 'Windows',
    q: q, count: 20, search_method: 'history', cursor: (page - 1) * 20
  };
  return axios.get('https://api.qishui.com/luna/search/album', {
    params: params, timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'LunaPC/3.0.0(290101097)', Referer: 'https://api.qishui.com/' }
  }).then(function (res) {
    var groups = (res.data && res.data.result_groups) || [];
    var data = [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] && groups[i].id === 'albums' && groups[i].data) { data = groups[i].data; break; }
    }
    var out = [];
    for (var j = 0; j < data.length; j++) {
      var d = data[j] || {};
      var ent = d.entity || d;
      var al = ent.album || ent;
      if (!al || !al.id || !al.name) continue;
      var aid = str(al.id);
      var names = [];
      var arts = al.artists || [];
      for (var k = 0; k < arts.length; k++) { if (arts[k] && arts[k].name) names.push(String(arts[k].name)); }
      out.push({
        source: 'qishui', sid: aid,
        title: str(al.name),
        artist: names.join(', '),
        artwork: qishuiCover(al.url_cover),
        date: qishuiDateOf(al.release_date),
        worksNum: al.count_tracks || 0,
        description: str(al.intro || ''),
        raw: { albumId: aid }
      });
    }
    return out.filter(function (it) { return it.sid && it.title; });
  });
}

function searchArtistQishui(q, page) {
  var params = {
    aid: 386088, app_name: 'luna_pc', device_id: '2170852561392692',
    version_name: '1.7.0', version_code: 10070000, ac: 'wifi',
    tz_name: 'Asia/Shanghai', device_platform: 'windows',
    device_type: 'Windows', os_version: 'Windows',
    q: q, count: 20, search_method: 'history', cursor: (page - 1) * 20
  };
  return axios.get('https://api.qishui.com/luna/search/artist', {
    params: params, timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'LunaPC/3.0.0(290101097)', Referer: 'https://api.qishui.com/' }
  }).then(function (res) {
    var groups = (res.data && res.data.result_groups) || [];
    var data = [];
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] && groups[i].id === 'artists' && groups[i].data) { data = groups[i].data; break; }
    }
    var out = [];
    for (var j = 0; j < data.length; j++) {
      var d = data[j] || {};
      var ent = d.entity || d;
      var ar = ent.artist || ent;
      if (!ar || !ar.id || !ar.name) continue;
      var rid = str(ar.id);
      out.push({
        source: 'qishui', sid: rid,
        name: str(ar.name),
        avatar: qishuiCover(ar.url_avatar),
        worksNum: ar.count_tracks || 0,
        description: '',
        raw: { artistId: rid }
      });
    }
    return out.filter(function (it) { return it.sid && it.name; });
  });
}

var ALBUM_SEARCH_ADAPTERS = {
  qishui: searchAlbumQishui
};

var ARTIST_SEARCH_ADAPTERS = {
  qishui: searchArtistQishui
};

function albumKeyOf(it) {
  return normalizeTitle(it.title);
}

function artistKeyOf(it) {
  return normalizeTitle(it.name);
}

function buildAlbumSearchItem(group, seq) {
  var members = group.members;
  var best = bestMember(members);
  var artwork = best.artwork, worksNum = best.worksNum, artist = best.artist, date = best.date;
  for (var i = 0; i < members.length; i++) {
    if (!artwork && members[i].artwork) artwork = members[i].artwork;
    if (!worksNum && members[i].worksNum) worksNum = members[i].worksNum;
    if (!artist && members[i].artist) artist = members[i].artist;
    if (!date && members[i].date) date = members[i].date;
  }
  return {
    id: best.source + '~al~' + best.sid,
    platform: '聚合搜索',
    title: best.title, artist: artist || '',
    artwork: artwork || undefined,
    date: date || undefined,
    worksNum: worksNum || undefined,
    description: best.description || '',
    _asrc: srcMapOf(members)
  };
}

function buildArtistSearchItem(group, seq) {
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
    name: best.name,
    avatar: avatar || undefined,
    worksNum: worksNum || undefined,
    description: best.description || '',
    _rsrc: srcMapOf(members)
  };
}

// ---------- 分享页 SSR 集合详情（专辑/歌手共用）----------
// 实测 share/album?album_id= / share/artist?artist_id 返回 200，_ROUTER_DATA.loaderData
// 的 album_page（albumInfo + trackList）/ artist_page（artistInfo + trackList）数据完整。
function fetchShareCollectionPage(kind, id) {
  var params = {};
  if (kind === 'album') params.album_id = id; else params.artist_id = id;
  var once = function (t) {
    return axios.get('https://music.douyin.com/qishui/share/' + kind, {
      params: params, timeout: t,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }).then(function (res) {
      var html = String(res.data || '');
      var m = html.match(/_ROUTER_DATA\s*=\s*({[\s\S]*?});/);
      if (!m) throw new Error('qishui ' + kind + ' no ROUTER_DATA');
      var data = JSON.parse(m[1]);
      var pg = data && data.loaderData && data.loaderData[kind + '_page'];
      if (!pg) throw new Error('qishui ' + kind + ' page empty');
      return pg;
    });
  };
  // 与 fetchShareTrackPage 同策略：非超时类失败用更短超时单次重试
  return once(CHAN_TIMEOUT.share_page).catch(function (e) {
    var msg = String((e && e.message) || '');
    if (msg.indexOf('timeout') >= 0) throw e;
    return once(Math.min(CHAN_TIMEOUT.share_page, 2000));
  });
}

// epoch 秒 → 'YYYY-MM-DD'（专辑/歌手 release_date，实测秒级）
function qishuiDateOf(epochSec) {
  var n = parseInt(epochSec, 10);
  if (!n || isNaN(n)) return undefined;
  var d = new Date(n * 1000);
  if (isNaN(d.getTime())) return undefined;
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// 分享页 trackList 全结构 track → buildSheetItem 口径条目（raw.trackId 供播放取链/歌词/分享链接）
function trackEntryOf(t) {
  if (!t || !t.id) return null;
  var names = [];
  var arts = t.artists || [];
  for (var i = 0; i < arts.length; i++) { if (arts[i] && arts[i].name) names.push(String(arts[i].name)); }
  var alb = t.album || {};
  return {
    source: 'qishui', sid: String(t.id),
    title: str(t.name),
    artist: names.join(', '),
    album: alb.name ? String(alb.name) : '',
    duration: typeof t.duration === 'number' ? Math.round(t.duration / 1000) : 0,
    artwork: qishuiCover(alb.url_cover),
    rates: t.bit_rates,
    raw: { trackId: String(t.id) } // v1.9.5 fee（VIP 标识）停写
  };
}

function entriesOfTrackList(tl) {
  var out = [];
  var list = tl || [];
  for (var i = 0; i < list.length; i++) {
    var e = trackEntryOf(list[i]);
    if (e) out.push(e);
  }
  return out;
}

var ALBUM_DETAIL_FETCHERS = {
  qishui: async function (raw) {
    if (!raw || !raw.albumId) throw new Error('qishui no albumId');
    var pg = await fetchShareCollectionPage('album', raw.albumId);
    var info = pg.albumInfo || {};
    var entries = entriesOfTrackList(pg.trackList);
    if (!entries.length) throw new Error('qishui album empty trackList');
    return {
      entries: entries,
      albumItem: {
        title: str(info.name),
        artist: splitArtists(info.artists),
        artwork: qishuiCover(info.url_cover),
        date: qishuiDateOf(info.release_date),
        worksNum: info.count_tracks || 0,
        description: str(info.intro || '')
      },
      total: entries.length
    };
  }
};

var ARTIST_MUSIC_FETCHERS = {
  qishui: async function (raw) {
    if (!raw || !raw.artistId) throw new Error('qishui no artistId');
    var pg = await fetchShareCollectionPage('artist', raw.artistId);
    var info = pg.artistInfo || {};
    var entries = entriesOfTrackList(pg.trackList);
    if (!entries.length) throw new Error('qishui artist empty trackList');
    return {
      entries: entries,
      artistInfo: {
        name: str(info.name),
        avatar: qishuiCover(info.url_avatar),
        worksNum: info.count_tracks || 0
      },
      // 分享页 SSR trackList 上限 4 首（实测 count_tracks=10 只回 4），无法翻页，isEnd 恒 true
      isEnd: true
    };
  }
};

async function getAlbumInfoImpl(albumItem, page) {
  page = parseInt(page, 10) || 1;
  if (page > 1) return { isEnd: true, albumItem: albumItem || {}, musicList: [] };
  var src = (albumItem && albumItem._asrc) || {};
  var names = sourcesByWeight(src);
  if (!names.length) throw new Error('该条目无可用的专辑详情源');
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    try {
      var out = await ALBUM_DETAIL_FETCHERS[names[i]](src[names[i]], page);
      if (!out.entries.length) throw new Error('empty album');
      var musicList = dedupeBySid(out.entries).map(buildSheetItem);
      var item = {};
      for (var k in albumItem) { if (k !== '_asrc') item[k] = albumItem[k]; }
      if (out.albumItem.title && !item.title) item.title = out.albumItem.title;
      if (out.albumItem.artist && !item.artist) item.artist = out.albumItem.artist;
      if (out.albumItem.artwork && !item.artwork) item.artwork = out.albumItem.artwork;
      if (out.albumItem.date && !item.date) item.date = out.albumItem.date;
      if (out.albumItem.worksNum && !item.worksNum) item.worksNum = out.albumItem.worksNum;
      if (out.albumItem.description && !item.description) item.description = out.albumItem.description;
      return { isEnd: true, albumItem: item, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('专辑详情获取失败');
}

async function getArtistWorksImpl(artistItem, page) {
  var p = parseInt(page, 10) || 1;
  if (p > 1) return { isEnd: true, data: [] };
  var src = (artistItem && artistItem._rsrc) || {};
  var names = sourcesByWeight(src);
  if (!names.length) throw new Error('该条目无可用的歌手详情源');
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    try {
      var out = await ARTIST_MUSIC_FETCHERS[names[i]](src[names[i]], p);
      if (!out.entries.length) throw new Error('empty result');
      var data = dedupeBySid(out.entries).map(buildSheetItem);
      // 第 1 页透传歌手富字段（头像在 artistItem 上，作品数补进行目）
      var info = out.artistInfo || {};
      if (info.worksNum) {
        for (var j = 0; j < data.length; j++) {
          if (!data[j].worksNum) data[j].worksNum = info.worksNum;
        }
      }
      return { isEnd: out.isEnd !== undefined ? out.isEnd : true, data: data };
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return { isEnd: true, data: [] };
}


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
function sheetKeyOf(it) {
  return normalizeTitle(it.title);
}
async function aggregateSearchBy(adapterMap, q, page, keyOf, buildItem) {
  // v1.1.0 🟢：process 引用守卫——沙箱/Hermes 环境可能无全局 process，直接引用会抛 ReferenceError
  var debug = false;
  try { debug = typeof process !== 'undefined' && process.env && !!process.env.AG_DEBUG; } catch (e) { debug = false; }
  var names = Object.keys(adapterMap);
  var tasks = names.map(function (n) {
    return adapterMap[n](q, page).catch(function (e) {
      if (debug) console.error('[adapter:' + n + '] ' + String((e && e.message) || e).slice(0, 200));
      return [];
    });
  });
  var settled = await Promise.all(tasks);
  if (debug) {
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


// ==================== v0.5.0 追加段 B：歌单详情 / 歌曲评论 ====================
// 歌单详情：复用 SHEET_FETCHERS（汽水 luna/playlist/detail）。
// 歌曲评论：v1.1.0 起接入汽水 PC 评论接口（getMusicCommentsImpl，实测存活）。
// 基线中专辑详情/歌手作品/MV/推荐歌单广场均无汽水通道，拆分时随其他平台代码一并移除。


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

// ---------- 歌单详情（复用 SHEET_FETCHERS）----------

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

// ---------- 歌曲评论（v1.1.0：接入汽水 PC 评论接口，实测存活；替换基线死壳） ----------
// GET https://api.qishui.com/luna/pc/comments?group_id=<trackId>&cursor=&count=20&group_type=1&image_strategy=2
// 响应顶层 comments[]（content/time_created/user.nickname/user.medium_avatar_url.urls[0]）/cursor/has_more。
// cursor 为服务端不透明串，用 qishuiCommentCursor 缓存 page→cursor 链（仅支持按序翻页）。
var qishuiCommentCursor = {}; // trackId -> ['0', page2cursor, ...]

async function getMusicCommentsImpl(musicItem, page) {
  var p = Math.max(1, parseInt(page, 10) || 1);
  var raw = musicItem && musicItem._src && musicItem._src.qishui;
  if (!raw || !raw.trackId) return { isEnd: true, data: [] }; // 非汽水源条目：空列表
  var trackId = String(raw.trackId);
  var chain = qishuiCommentCursor[trackId] || ['0'];
  if (p > chain.length) return { isEnd: true, data: [] }; // 只允许按序翻页
  var cursor = chain[p - 1];

  var res = await axios.get('https://api.qishui.com/luna/pc/comments', {
    params: {
      group_id: trackId, cursor: cursor, count: 20,
      group_type: 1, image_strategy: 2,
      aid: 386088, app_name: 'luna_pc', device_platform: 'web', version_code: '1.0.0'
    },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://www.douyin.com/' }
  });
  var cl = (res.data && res.data.comments) || [];
  var data = [];
  for (var i = 0; i < cl.length; i++) {
    var c = cl[i] || {};
    var u = c.user || {};
    var av = u.medium_avatar_url && u.medium_avatar_url.urls && u.medium_avatar_url.urls[0];
    data.push({
      id: c.id ? 'qc_' + String(c.id) : 'qc_' + trackId + '_' + p + '_' + i,
      nickname: str(u.nickname),
      avatar: av ? String(av) : '',
      content: str(c.content || c.text),
      createAt: c.time_created ? String(c.time_created) : ''
    });
  }
  if (res.data && res.data.has_more && res.data.cursor && chain.length === p) {
    chain.push(String(res.data.cursor));
    qishuiCommentCursor[trackId] = chain;
    return { isEnd: false, data: data };
  }
  return { isEnd: true, data: data };
}
