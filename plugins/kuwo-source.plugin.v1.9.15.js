/**
 * [v1.9.15 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「酷我音乐」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
var axios = require('axios');
/**
 * 酷我音乐独立源插件（MusicFree）
 * ================================
 * v1.9.15（2026-09-25 接口吸收版，基线 v1.9.14）：v1.9.15 接口吸收版（承接「23 个音乐插件可吸收取链接口」调研，实测存活口径 2026-09-25）：本源新增三条兜底通道，全部挂在既有海棠 resolve-url 兜底之后（不改变主链优先级）：① 海棠 kw.php 直连（musicapi.haitangw.net/music/kw.php，302/JSON 双形态，standard→128k/high→320k/super→lossless，探针实测 lossless 302→car-er.kuwo.cn 官方 fLaC 55.4MB）；② nxinxz 补充档位（music.nxinxz.com/kw.php，仅 standard/low/high，探针实测 320k ID3 mp3 10.79MB）；③ antiserver 320k 备选（anti.s convert_url，仅 high 档链尾，返回档位不稳定由守卫按 320k 声明码率下限 fail-closed）。三通道 actualQuality 如实声明，外层 resolveWithFallback 守卫（无损魔数/码率下限）不过即拒收接力；详见头部 changelog；
 *   详情：版本字段行同款摘要，此处不重复展开。
 * v1.9.12（2026-09-20 包升版，基线 v1.9.11）：QQ 源接入 a.aa.cab/qq.music 搜索型取链新通道（详见 qq-v1912.js 头部 changelog）；本源无代码改动，版本号随包统一升 v1.9.12。
 * v1.9.5（2026-09-11 全页面音质标识核查 + VIP 标识移除版，基线 v1.9.4）：
 *  - 榜单聚合条目补 qualities 音质表透传（此前榜单页音质标识全部缺失）；
 *  - 新增 enrichKuwoQualities：musicpay ids 逗号批量（实测一次返回多条）给专辑/歌手
 *    作品页等 N_MINFO 缺失入口补音质标识，已覆盖入口零额外请求；
 *  - 全接口停写 fee（VIP 角标）字段，getMusicInfo/getMediaSource 不再回填，kwFeeOfRaw 移除。
 * v1.9.4（2026-09-11 第三方取链修复 + size 字段版，基线 v1.9.2）：
 *  - 任务一：getMediaSource 返回值加 size 字段（单位：字节），供宿主下载前预估大小与播放前音质校验。
 *    size 取值优先级：取链响应直带 size（第三方 URL 响应 Content-Range/Content-Length 已在 verifyMediaSizeStrict
 *    中确认非 0）> HEAD 探测 Content-Range/Content-Length（getMediaSource 边界补 attachSizeIfMissing 兜底）>
 *    留空。v1.9.2 第三方通道 verifyMediaSizeStrict 仅做非零校验，未回填到最终结果，本轮统一回填。
 *  - 任务二：第三方取链通道实测修复。
 *    - 4 路实况（2026-09-11 探针）：
 *       ① 官方 nmobi（nmobi.kuwo.cn/mobi.s）：convert_url3 形态 404 已实落全豆要 convert_url_with_sign 兜底，
 *          实测 176ms 首胜稳定，本轮未动。
 *       ② 官方 mobi（mobi.kuwo.cn）：同 nmobi 形态，本轮未动。
 *       ③ 屿溪/海棠（musicserver.haitangw.cc/v1/music/resolve-url）：标准 POST 200/201，data.url 全齐；
 *          502/503 时 race 链自然接力下一通道，本轮未动。
 *       ④ 星海 kw（yy.zddyr.top/lx/api/）：2026-09-11 实测 503「仅限授权用户使用」；探针查响应中推荐
 *          替代 zrcdy.dpdns.org/lx/，但 vers.php 是 HTML 插件下载中心、/lx/api/ 返 PHP warning
 *          （require 失败），无可用替代端点 → 整体死亡。
 *    - 处置：星海通道保留函数体，注释为失效，标注 2026-09-11 失效日期，从竞速池移除——保留源码
 *      便于未来该端点恢复时复活（仅解注释+恢复 race pool 一行）；竞速池由 6 路降为 5 路
 *      （nmobi→mobi→屿溪→次合代→ikun）。
 *    - 网络搜索新第三方酷我取链接口（zuohao1996/tingmusic/leitingku 等 6 个候选）均为 404/接口关闭/
 *      要求付费，无新通道可接入。
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
 * v1.8.4 = 歌单导入元数据版（2026-09-10，基于 v1.8.3）：
 *  - P0 导入返回结构：importMusicSheet 由「歌曲数组」改为「完整 IMusicSheetItem 歌单对象」
 *    （id/platform/isImported/title/artwork/worksNum/musicList[/description/artist/playCount]）。
 *    此前返回数组走宿主旧插件兼容分支，歌单标题落到 fallback「来自kuwo的歌单」。
 *  - P0 歌单标题/介绍：pl.svc getlistinfo 响应顶层自带 title/info/pic/uname/total/playnum
 *    （探针 2026-09-10：pid 3678099088 → title「华语R&B•撩拨耳畔的浪漫旖思」+ info 简介），
 *    首页顺带回传零额外请求；info 富文本标签转纯文本（kuwoStripHtml）；
 *    meta 拉取失败兜底「酷我歌单 #<pid>」。
 *  - P0 字段名对齐：歌单介绍字段名确认沿用宿主 v1.0.0 IMusic.IMusicSheetItemBase 的
 *    description（经 normalizeImportedMusicSheet 透传）；无简介时不传该字段。
 *
 * v1.9.0 = BakaMusic 高价值音源接入版（2026-09-10，基于 v1.8.4）：
 *  - P0 次合代酷我通道（kwCihedaiResolve）：GET music.nxinxz.com/kw.php?id={rid}&level={...}&type=mp3，
 *    standard→standard / high→exhigh / super→lossless；端点直出音频流（http 直链），
 *    Range 实测（晴天 rid=228908，2026-09-10）：lossless=fLaC 55.4MB（≈1647kbps）/
 *    exhigh=mp3 10.8MB / standard=mp3 4.3MB，探测 RTT 0.49~0.70s。
 *  - P0 ikun 酷我通道（kwIkunResolve）：POST c.wwwweb.top/music/url {source:'kw',musicId,quality}，
 *    X-API-Key 空串免卡密；128k/320k/flac 三档实测全真（flac=fLaC 55.4MB 295ms / 320k=mp3
 *    10.8MB 147ms），响应 quality 字段为实际交付档。防假成功：ikun 对酷狗/QQ 无卡密返回
 *    10 秒占位 mp3——本插件只接酷我（任务口径），且所有返回 URL 必过 verifyMediaSizeStrict
 *    （试听片段守卫 est<60%×dur 拒收占位样本）。
 *  - P1 全豆要酷我（kwQdyFallback）：nmobi.kuwo.cn convert_url_with_sign 随机 user/loginUid
 *    形态（BakaMusic quandouyao 原样），实测与本插件 nmobi 官方竞速第一路同端点同上游
 *    （同曲同文件 55.4MB，121ms）——判重复建设不新增竞速路；作为 nmobi 通道
 *    （convert_url3→天宝 with_sign）全败后的第三形态回落接入，正常路径不多打一路、
 *    少伪造一次随机凭据，nmobi 被风控单独掐掉时仍有独立存活的回落形态。
 *  - 竞速池扩容：raceNewChannels 4→6 路（nmobi[+全豆要回落] 0ms / mobi 250ms / 屿溪 400ms /
 *    星海 550ms / 次合代 700ms / ikun 850ms）；新增两路经 userVariables.kwCihedai / kwIkun
 *    可设 off 关闭（默认开）。
 *  - 复核结论（零增量不接入）：BakaMusic 长青酷我端点（musicapi.haitangw.net）与既有屿溪/
 *    海棠同上游；ikun 酷狗/QQ 无卡密假成功（任务明确不接）；次合代/长青/全豆要酷狗端点
 *    haitangw.cc 实测 code 201 已挂（2026-09-10，报告同口径）。
 *
 * v1.8.3 = 质检遗留优化版（2026-09-10，基于 v1.8.2，对应交叉质检报告问题清单）：
 *  - 本插件 Q-02/Q-03 复核确认已符合统一口径（sheetImportError 已带 [kuwo] 前缀、
 *    兜底分支 code 已为 SHEET_URL_UNRECOGNIZED），无代码改动，随包升版 v1.8.3。
 *
 * v1.8.2 = 歌单解析修复版（2026-09-10，对照 6 平台歌单解析实测报告）：
 *  - P2-2 歌单歌曲补 qualities：实测报告称 pl.svc musiclist 无音质信息已过时——
 *    探针复核条目自带 MINFO/N_MINFO 分号串（level/bitrate/format/size），歌单入口
 *    raw 补 N_MINFO 透传，buildSheetItem 用既有 parseKuwoQualityInfo 挂 qualities，
 *    零额外请求（与 v1.4.3 其他五入口同口径）。
 *  - P2-4 错误文案统一：新增 sheetImportError helper，歌单链接解析/拉取/空歌单错误
 *    携带结构化 code（SHEET_URL_EMPTY/SHEET_URL_UNRECOGNIZED/SHEET_FETCH_FAILED/SHEET_EMPTY）。
 *  - P2-5 album 复核：实测 78/78 歌单条目 album（FALBUM）完整，SHEET_FETCHERS 已有
 *    album: str(it.album || it.FALBUM)，无需代码改动，维持现状。
 * ================================
 * v1.7.0 = 第三方/备选竞速通道接入（实测落地 2026-09-10）：
 *      ① P0 竞速通道池扩容至 2 官方 + 2 第三方 = 4 通道优先级错峰并发竞速（nmobi 官方 > mobi 官方 > 屿溪 > 星海 kw），
 *         接入 standard / high / super 三档；hires / master / atmos 沿用 QMC + 海棠母带/全景声链不动（任务清单只定义三档）。
 *         a) 通道 1 nmobi 官方 + 通道 2 mobi 官方：任务清单给出 convert_url3 形态（from=kwplayerhd_9.5.4.2_kw.android / user=0 / quality=128kmp3|320kmp3|2000kflac），
 *            沙箱实测全变体（http/https/±UA/±source/±br）均 404；自动回落同 host 的 convert_url_with_sign 天宝/车机形态（沙箱已 200 实证，data.code=200/data.url/bitrate/format 全齐）。
 *         b) 通道 3 屿溪（musicserver.haitangw.cc）：任务清单给出 /api/resolve-url 形态，沙箱实测 404「Cannot POST」；实际可用端点 /v1/music/resolve-url（与插件 v1.6.1 海棠封装同源异名，body={source:'kw',rid,level}，状态 201，code:0，data.url），与 v1.6.1 resolveHaitang 复用同一上游，本版本抽出独立 yuxiResolve 加严音质大小校验。
 *         c) 通道 4 星海 kw（yy.zddyr.top）：任务清单给出 /?type=kw&id=&quality= 形态，沙箱实测返 HTML 首页；实际为带 X-Token+X-Client 鉴权的 /lx/api/?source=kw&name=&singer=&songmid=&interval=&albumName=&quality=
 *            （github.com/cdyUuu/lx-music-xinghai-source v3.2.12，2026-09-10 沙箱实测 200/200/200，code:200/url 完整；token=base64({device_id,ip,timestamp,random})，ip 走 /ip.php 异步取一次后缓存；落地需 musicItem 携带 name/singer/duration/album 字段，插件条目原生具备）。
 *      ② P0 音质大小校验（硬性要求）：每个新通道响应层校验（HTTP 200/201、非空 data.url、Content-Length>0 不可）后，再做 Range 0-15 魔数/码率探测——明文无损档必须 fLaC 魔数（ID3/OggS/裸 mp3 视为静默降级拒收），有损档按 duration 反推码率下限（128k→≥96k / 320k→≥256k，< 75% 视为降级拒收），实现 verifyMediaSizeStrict 独立函数（区别于 guardFullAudio 不误杀规则，本通道要求严苛、失败即抛错换下一路）。
 *      ③ P0 优先级错峰并发：racePriority 实现 staggered start（nmobi 0ms / mobi 80ms / 屿溪 180ms / 星海 300ms），
 *         既满足"4 通道并发竞速"（同时在飞），又满足"优先级 nmobi > mobi > 屿溪 > 星海"（早到者先抢跑，迟到者兜底）；首个通过音质大小校验的 promise 胜出，全部失败才 reject。
 *      ④ P1 失败降级：单通道任一环节失败（HTTP 非 200/201、空响应、data.url 空、魔数/码率/Content-Length 任一不符）抛错，race 框架自动切下一通道；与现有 raceSuccess 同语义，无需外层 catch 改造。
 *      ⑤ P1 端点形态修正留痕：convert_url3（任务给定）/api/resolve-url（任务给定）/?type=kw（任务给定）三组端点沙箱实测均失效，详见头部 changelog 段「v1.7.0 沙箱实测形态修正」；落地代码实现"任务给定形态优先尝试 → 沙箱实证形态自动回落"，保证按任务清单的 4 通道语义全部接活。
 *      ⑥ P2 取链模式总览：standard/high 档新增 raceNewChannels（4 通道），super 档 raceSuccess(racers) 中包含 raceNewChannels
 *         （2000kflac/flac/lossless/flac 全部映射正确），hires/master/atmos 维持 QMC+海棠母带/全景声链；racers 数组尾部追加，单一 raceSuccess 框架不变。
 * v1.8.0（2026-09-10 MV 参数对齐基线，基线 v1.7.1；对照 MusicFree v1.0.0 宿主协议）：
 *  - P1 顶层 result 补字段：① width/height 派生（上游 anymatch/mobi.s 不带显式宽高，按 16:9 从
 *    height 派生，宿主 UI 进度条/画布需要宽高比）；② codec 字段位置保留（上游不返编码信息，
 *    宁缺毋假，结构对齐 QQ/网易云）；③ availableVideoQualities 加 width 字段（结构化 5 字段
 *    对齐 IVideoQualityOption）；
 *  - P1-1 videoQuality 写回 musicItem.videoQuality：三层兜底链（直连/legacy/搜索）任一返回即写回；
 *  - 兼容：v1.7.1 全功能（星海 token 纯 JS base64 + nmobi/mobi 错峰 0/250/400/550ms 竞速 +
 *    AbortController 取消 + IMediaSourceResult 标准字段）保持不变；版本 v1.7.1 → v1.8.0；
 *    node --check 通过。
 * v1.6.1 = HotDownloader 借鉴优化（调研报告实测落地 2026-09-08）：
 *      ① P0 档位真实性校验增强——HotDownloader 实测酷我对不存在档位静默降级（3/36），且本沙箱
 *      复现更严重形态：rid=505792 请求 20900kmflac 回 48k aac、rid=401577137 回 20201kmflac+ekey
 *      （放行会虚标 master）。加固三层：a) kwQmcResolve 响应 bitrate/format 与请求档严格相等
 *      校验（HotDownloader 同款语义），b) kwOfficialResolve/kuwoDesResolve super/high 档补
 *      bitrate 下限校验（super>=2000 / high>=320），c) 守卫升级 guardFullAudio → 文件魔数 +
 *      码率双重校验（Range bytes=0-15 单请求 ≈25ms：明文无损档必须 fLaC 魔数、有损档按
 *      Content-Range 总长/标称时长反推实际码率，<声明档 75% 拒收）——校验不通过视为该档不可用，
 *      继续下一路竞速/降级。关键修复：kw-er/car-er CDN 对无 UA 请求一律 403，原守卫探测
 *      一直空转，现已带 UA 头（实测 206 + fLaC）。
 *      ② P1 Hi-Res 档位扩展——调研确认 20900kmflac 与 2000kflac 是同一接口（mobi.s
 *      convert_url_with_sign）不同 br 参数（HotDownloader 实测 20900kmflac 186.9MB ≈20.9Mbps
 *      带 ekey；本插件 v1.4.0 已作 master 档接入）；本版新增宿主 'hires' 档（20201kmflac
 *      优先 → 20900kmflac 母带 → 母带尾链），supportedQualities 增补 'hires'。
 *      ③ P1 取链提速——新增 kwHdResolve 第四路竞速（HotDownloader 原样形态：http://mobi.kuwo.cn
 *      + 显式 format 参数 + from=PC + okhttp/4.10.0 UA + Referer，实测均值 67ms，比现有
 *      nmsublist 形态快约 30ms；media URL http://kw-er.kuwo.cn 已在白名单 .kuwo.cn$ 内）。
 *      ④ P2 源码审读——HotDownloader 酷我模块（搜索 r.s/歌词 newlyric/歌单 pl.svc）能力均为
 *      本插件已覆盖子集且无分页/榜单/评论/专辑，无新增可借鉴接口；其「响应 bitrate 严格相等」
 *      与「随机 user+android_id」已分别落入 ① 与 ③。
 * v1.6.0 = P1/P2 优化（go-music-dl 调研落地 2026-09-08）：① Hi-Res 档位标注——kwOfficialResolve /
 *      kuwoDesResolve 在 format=flac 且 bitrate>=2000 时 actualQuality 标 'hires'（真·无损
 *      2000kflac 55MB 级）。实测：convert_url_with_sign br=2000kflac → fLaC 55,397,039B（晴天）；
 *      br=flac 反而降级 mp3 128；DES convert_url2 format=flac 实测即返回 bitrate=2000，而
 *      format=2000kflac 不被稳定接受（228908 降级 mp3 128）——不改请求格式，只对结果标注。
 *      ② 逐字歌词增强——fetchKuwoLrcx 新增 GET 通道（POST 失败后降级，同解密链）；新增
 *      parseKuwoLrcxText 专用解析器（lrcx 行头 [mm:ss.mmm]、词标签两字段 <a,b> 含负数，
 *      为滚动渐变数据非词时间轴——go-music-dl 同样剥标签，旧版误用 KRC 解析器导致全不匹配）；
 *      getWordByWordLyricImpl 改 KRC 真逐字优先 → lrcx 行级兜底。③ 搜索单引号 JSON 容错
 *      （searchKuwo/searchAlbumKuwo/kuwoRsSearch 响应为字符串时走 parseKwDict）。④ 死链核查：
 *      nplserver pl.svc 与 www playUrl 报告称已死、实测 2026-09-08 均存活，保留并注释证据。
 * v1.5.0 = 宿主字段补齐（对照《MusicFree 宿主字段需求 × 6 插件返回字段 全量对比与补齐方案》
 * P1/P2 清单 + 沙箱探针实测 2026-09-08）：① getWordByWordLyric 逐字歌词接入——酷我原生
 * newlyric.lrc lrcx 通道（XOR yeelion + zlib inflate（宿主 require 白名单含 pako）+ 二次
 * base64/XOR 解密，沙箱实测 TP=DENY 疑似机房 IP 风控、设备端可能放行故保留为首选通道），
 * 失败自动接力酷狗 KRC 跨源通道（mobiles 搜曲 → krcs 定位 → decodeKrc → parseKrcForHost
 * 转宿主 QRC 格式 [ms,dur]词(ms,dur)，移植自酷狗插件 v1.4.1 同款实现）；② getMusicComments
 * 评论接入——酷我官方 ncomment com.s 已死（全 sid 返回 code=600，v1.4.4 注释既知事实），
 * 改接海棠代理 kwpl.php（实测 200，rows 含 userName/text/avatar/time/timeStr/likedCount，
 * page/total/maxPage 分页齐全），映射宿主 IComment（nickName/comment/avatar/time/likedCount）；
 * ③ fee 付费标记——搜索条目按 fpay/payInfo.feeType.song 判定（实测：晴天 fpay=1/feeType.song=1
 * 判 VIP，免费伴奏 PAY=0/fpay=0 不误标；PAY 位掩码含 vip:1 的免费可听歌不误标），搜索结果/
 * getMusicInfo/取链结果三处补齐，宿主 fee===1 详情页 VIP 角标点亮；④ getMusicDetailPageUrl
 * 分享链接——https://www.kuwo.cn/play_detail/{rid}（实测 200 可达）；⑤ primaryKey=['id'] 声明
 * （对齐网易云/咪咕，宿主 mediameta 存档展示）；⑥ alias 别名透传（r.s/搜索响应 ALIAS 字段，
 * 歌词搜索关键词 alias 优先）。
 * 由聚合搜索插件 v0.8.0 拆分；v1.1.0 = 审查报告修复（S/M/O 全量）+ 接口扩充 + 第三方通道接入。
 * v1.2.0 = 取链优化三连：① mobi.s 免签车载通道（mobi.kuwo.cn/mobi.s convert_url_with_sign，
 * 车载渠道包名免 DES/免 Cookie/免签名，standard/high/super 档第 5 路竞速；任务文档给的
 * mobi.s.kuwo.cn/url convert_url3 形态实测 502 已死，按 2026-09-06 探针实测可用形态接入）
 * ② high 档 format 校验（免费歌请求 320kmp3 返回 ogg 100k 降级档直接拒收，交给竞速对手/海棠）
 * ③ antiserver 通道 VIP 试听片段竞速内拒收（拿到直链后轻量 Range 探测，明显试听即弃，
 * 不再浪费一路竞速；搜索 pay 字段实测不可区分免费/VIP 故不做预判）。
 * v1.2.1 = 显示修复 + 全档兜底：① getRecommendSheetTags 补协议包装（v1.1.0 起裸数组返回，
 * 宿主读 result.data=undefined 导致歌单分类页不渲染；36/36 榜单封面 URL 已探针验证有效可达，
 * 分类页渲染被打断即榜单封面不显示的同根因）② 海棠 kw 兜底从 high/super/hires 扩展到
 * 全音质档（standard/low 竞速全挂时走海棠 standard→128k，用户确认方向）。
 * v1.2.2 = hires 档升级真母带：海棠 kw master 档实测可用（~187MB 真 FLAC，24bit ≈5.6Mbps，
 * 流式端点 http://175.27.166.236:8928/kwstream，URL 稳定；白名单精确放行该 host），
 * hires 档改为 master 优先（fLaC 魔数探测校验，免费歌 master 返 400 JSON 自动回落）
 * → DES 竞速 2000kflac → 海棠 lossless（探测非 fLaC 即下探）→ 海棠 standard 128k mp3 保底；
 * 海棠 kw 'hires' 档实测只回 128kmp3（虚标）已弃用。档位矩阵实测（2026-09-06，3 歌 × 9 档名）：
 * kw 可用档仅 standard/exhigh/lossless/hires/master，flac24bit/320k/flac/super 上游不识别；
 * master 仅部分 VIP 歌有货，lossless 真 FLAC（晴天 55MB/1647kbps），免费歌全档 ogg 95k 降级。
 * v1.2.3 = 至臻全景声独立成档：海棠 kw atmos 档实测可用（晴天 31,168,013B fLaC ≈927kbps，
 * 流式端点与 master 同形态；仅部分 VIP 歌有货，稻香 atmos 400 与 master 同模式），
 * 宿主 atmos/atmos_plus/dolby 键不再顶到 hires，独立走 atmos 优先链（fLaC 魔数校验）
 * → 回落 master-first 母带链；master 键升为独立内部档（actualQuality 诚实标 master/atmos）；
 * supportedQualities 增补 master/atmos 供宿主 UI 直选。DTS 系档名（dts/dtsx/dts_x/dtshd）
 * 实测上游全部不识别（UPSTREAM_RESOLVE_FAILED），酷我 DTS:X 不接入——宁缺毋滥。
 * v1.2.4 = 榜单封面与歌单分类修复（对照宿主 fork 源码 + 社区版 baka-plugins v1.1.1 + 沙箱探针）：
 * ① 榜单封面：宿主榜单卡片渲染读 coverImg 字段（topListItem.tsx: source={topListItem?.coverImg}），
 * 本插件 v1.2.3 及之前只回 artwork 字段 → 封面永远不显示；现榜单条目补 coverImg（pic5→pic2→pic
 * 优先级，与社区版一致，36/36 榜单叶子实测三字段全有值），artwork 保留双写兼容官方宿主；
 * ② 歌单分类：v1.2.3 的 getRecommendSheetsByTag 忽略 tag 参数恒回热门推荐流，点任何分类看到的都是
 * 同一批内容（用户感知「点击没反应」）；现按社区版协议按 tag.digest 分流——digest=10000 走
 * getTagPlayList（2026-09-07 探针实测可用，短视频 tag total=10472；早前「恒空」结论系参数形态
 * 错误），digest=43 走 er.s get_pc_qz_data（实测经典老歌专区 flat=23 条），无 tag.id 回热门流；
 * getRecommendSheetTags 标签补 digest 字段回传；getRcmPlayList 分页基址修正为 0 基（原 pn=page
 * 会跳过第一页，社区版 pn=page-1）。
 * v1.2.5 = 歌手搜索接入（对照宿主 fork 源码 + 社区版 baka-plugins v1.1.1 + 沙箱探针 2026-09-07）：
 * 根因①：v1.2.4 supportedSearchType 未声明 'artist'，宿主 getSearchablePlugins('artist') 直接过滤掉
 * 本插件，歌手搜索根本不会调用到酷我；根因②：search() 对非 music/album/sheet 类型也恒返回空。
 * 修复：supportedSearchType 补 'artist'；search() 增 artist 分支走 r.s ft=artist（免登录实测可通，
 * 「周杰伦」TOTAL=67，ARTISTID/ARTIST/hts_PICPATH/desc/SONGNUM 齐全）；条目字段对齐宿主 IArtist
 * （id/name/avatar/worksNum/description）。同步实现 getArtistWorks（stype=artist2music 实测
 * total=706 / stype=albumlist 实测 total=39，artistid=336 周杰伦），歌曲条目复用 _src 取链接力、
 * 专辑条目复用 _asrc 专辑详情链路——否则歌手搜索修好后点进歌手详情页仍是死胡同。
 * v1.2.6 = 歌词搜索 + defaultSearchType + 歌单分类横向标签（对照宿主搜索能力报告 + 横向分类
 * 分析报告 + 社区版 baka-plugins v1.1.1 + 沙箱探针 2026-09-07）：
 * ① 歌词搜索（lyric 类型）：supportedSearchType 补 'lyric'；search() 增 lyric 分支——复用
 * music 主路径聚合口径（聚合去重评分排序），对前 8 条并发 4 拉 openapi getlyric（兜底
 * songinfoandlrc）取完整歌词，截前 480 字符作 rawLrcTxt 预览（宿主 ILrcItem 消费字段），
 * 其余条目 rawLrcTxt 置空串、选中后走 getLyric 拿完整歌词，不在搜索关键路径全量拉词。
 * 搜索响应本身无歌词片段字段（实测 keys 复核），预览文本只能经歌词接口获取。
 * ② 补 defaultSearchType: 'music' 显式声明（消除对宿主回退链的隐式依赖）。
 * ③ 歌单分类横向显示：getRecommendSheetTags 的 pinned 从真实标签动态挑（宿主 sheetBody.tsx
 * 渲染 pinned 为横向快捷标签栏，v1.2.5 恒为空数组 → 横向栏只剩「默认」）——「心情」前 3
 * （伤感/解压/励志）+「语言」前 3（华语/欧美/韩语），均为 digest='10000' 普通标签、必走
 * getTagPlayList 通道；上游分组改名时退化为全组前 6 个普通标签，保证横向栏非空。
 * v1.2.7 = 歌手详情补齐（对照宿主 fork artist.d.ts/artistDetail 页 + 边缘能力评估报告 + 社区版
 * baka-plugins 酷狗 singer/info 模式 + 沙箱探针 2026-09-07）：
 * ① search() 歌手分支并发补齐 fans 粉丝数（宿主歌手页 header 渲染 fans 的唯一数据来源——
 * 宿主无独立歌手详情插件方法，header 拿的就是搜索结果传入的 artistItem，artist.d.ts:5 fans?），
 * 走官方 web 端 www.kuwo.cn/api/www/artist/artistInfo（csrf + kw_token cookie 配对，社区标准
 * 口径，返回 fans/pic300/introduction/musicNum/albumNum/mvNum），并发 4 / 前 8 条 / 单条 2.5s
 * 超时 / 5 分钟 TTL 缓存，失败静默忽略不影响搜索可用性。
 * ② 新增 getArtistDetail 方法：返回宿主 IArtistItemBase 对齐字段（id/name/avatar/fans/description/
 * worksNum + musicNum/albumNum/mvNum 扩展），上游失败时回退传入条目自带字段（宁缺勿造）。
 * 端点可用性实测（2026-09-07 沙箱）：www 域 artistInfo 返回 "The request is illegal!"（数据中心
 * IP 被酷我风控，同域 musicInfo 同样被拦，评估报告结论一致）；wapi 域 artistInfo 实测为忽略一切
 * 参数的固定热门列表（id/name/key/keyword 均无效，恒回 total=8623 热门流）不可用于单歌手详情；
 * wapi artist/introduction、artistDesc、m.kuwo.cn 均 404。真机（家宽/移动网络 IP）预期可用，
 * 需装机后验证；被拦时插件行为 = 搜索无 fans、getArtistDetail 回退传入字段，不报错不造假。
 *
 * 能力：搜索（歌曲/专辑/歌手/歌单/歌词）、歌手作品页（getArtistWorks 歌曲/专辑分页）、取链（standard/low 档 nmobi + nmsublist + mobi.s 免签车载 +
 * DES 手机渠道 + DES 车载渠道 + antiserver 六路竞速；high/super 档 nmobi + nmsublist + mobi.s
 * 免签车载 + DES 双渠道四路竞速；全音质档竞速全挂统一海棠 kw 兜底）、
 * 歌词（openapi getlyric + m.kuwo.cn songinfoandlrc 双通道）、动态榜单树（wapi bang/list
 * 5 分组 36 榜 + ksong.s 真翻页）、推荐歌单（getRcmPlayList + getTagList）、
 * 歌单/单曲分享链接导入、专辑搜索与详情、歌单搜索与详情、MV（r.s ft=video + anymatch）、
 * 歌曲详情与封面反查。
 *
 * v1.2.8 = MV 标识补齐（打通宿主「播放 MV」入口，对照宿主搜索能力报告 ⑤ 章链路 + 宿主
 * fork canPlayMusicVideo 守卫 + 2026-09-07 沙箱探针）：
 * ① 六个歌曲数据入口（searchMusicBykeyWord 搜索 / ksong.s 榜单 / fetchKuwoBang 榜单详情 /
 * pl.svc 歌单 / r.s artist2music 歌手作品 / wapi albumInfo 专辑）响应的 mvpayinfo.vid
 * 统一采集进 raw.mv（mvVidOf helper 过滤无 MV 条目恒返的字符串 "0"——"0" 是 truthy）；
 * ② buildMusicItem 组内任一成员有 MV 即提升顶层 mv 字段（宿主守卫读顶层
 * mv/mvId/videoId 任一，getMvSourceImpl 主路径读 musicItem.mv || videoId 直连 anymatch）；
 * ③ buildMusicItem/buildSheetItem 自报顶层 platform='kuwo'：宿主 wrapper 对列表入口会盖
 * platform，但 normalizeImportedMusicSheet 只盖歌单不盖 musicList 条目，导入/备份恢复的
 * 条目无 platform 时宿主按 musicItem.platform 反查插件失败 → MV 菜单永不出现；自报值与
 * wrapper 盖的值相同，线上入口零波及。getMvSource / supportedVideoQualities 既有实现
 * （r.s ft=video 搜索兜底 + anymatch 6 画质）零改动，仅回归验证。
 * v1.3.0 = MV 全面对齐 baka 酷我（对照《社区插件 MV 分析报告》+ baka v1.1.1 逐项 diff，
 * 目标：MV 菜单一定能显示、MV 播放一定能跑通）：
 * ① MV 字段全面对齐：除既有 mv 外新增 mvId 别名（宿主守卫 9 个字段名之一）+ mvArtwork
 * （酷我 hts_MVPIC/MVPIC 现成数据，短路径补 https://img3.kuwo.cn/wmvpic/ 前缀）+ mvSongId；
 * 七个数据入口（搜索 / ksong.s 榜单 / fetchKuwoBang 榜单详情 / pl.svc 歌单 / r.s 歌手作品 /
 * wapi 专辑 / wapi 歌曲详情）的 raw 统一携带 mv+mvArtwork，buildMusicItem/buildSheetItem/
 * buildChartItem 三处构建器顶层提升四字段；buildChartItem 补齐 v1.2.9 缺口（榜单条目既无
 * platform 自报也无 mv → 榜单 MV 菜单永不亮）；歌曲详情 raw.vid 改走 mvVidVal 过滤，
 * 堵住 vid="0"（truthy）泄漏到顶层 videoId 导致菜单亮但播放必败的隐患；getMusicInfo
 * 回填 mvId + mv→mvId 同步 + mvArtwork；
 * ② getMvSource 全面对齐 baka：画质 6 档收敛为 baka 同款 5 档（240p/360p/480p/720p/1080p，
 * MP4L/MP4/MP4HV/MP4UL/MP4BD，补齐报告指出的 360p 缺档）；返回结构按宿主 IVideoSourceResult
 * 全量填充 url/headers/videoQuality/mimeType/bitrate/availableVideoQualities；主取链通道
 * anymatch 升级双通道竞速（api/mv/play JSON + mobi.s 多行 key=value 文本协议，baka 同参数集
 * f=web&prod=kwplayer_ar_12.1.6.0&corp=kuwo&newver=3&type=get_url_by_vid 等）；
 * ③ 旧版 playUrl 按 songId 兜底：knownVid 拿不到时走 kuwo.cn/api/v1/www/music/playUrl?
 * mid=<songId>&type=mv（baka 同款 Secret+Cookie 头），再兜 r.s ft=video 严格匹配搜索；
 * 端到端走查：platform 字段三个构建器全部自报，getMusicInfo 无条件回填（v1.2.9 修复保留）。
 * v1.2.9 = MV 可用性两连修（对照 MV 菜单不显示排查报告，srcUrl 更新源按用户决策不接入）：
 * ① getMvSourceImpl 去掉 !musicItem._src 硬前置——主路径读顶层 mv/videoId 直连
 * anymatch、兜底走 r.s ft=video 搜索，均不依赖 _src；该前置只让「缺 _src 但带 mv」
 * 的条目（备份恢复/跨端迁移字段丢失场景）连兜底都不执行，MV 整体失效；
 * ② getMusicInfoImpl 无条件回填 platform='kuwo'——v1.2.8 之前入库的旧条目无 platform，
 * 宿主 canPlayMusicVideo 按 musicItem.platform 反查插件失败 → MV 菜单不亮；
 * 播放/进详情触发 getMusicInfo 后回填，宿主合并回条目即点亮（守卫 2 修复）。
 * v1.4.0 = 酷我 QMC 加密档接入（母带/增强档官方直源，插件侧解链、宿主零改动）：
 * 旧 v0.6.0「酷我 712B 密钥物理上无法经 ekey 通道下发」的结论已被端到端实测推翻
 * （2026-09-07 沙箱，RID=228908 晴天，真实请求+真实解密）：酷我官方 mobi.s 的 ekey 真实
 * 结构是三层嵌套——ekey(972字符)=base64(酷我自定义DES密文)，用 ylzsxkwm 解密（小端位序
 * +自定义S盒，非标准 DES）得 720 字符文本，其【尾部 704 字符】即合法 QQ V1 信封 ekey →
 * 宿主既有 decryptEKeyV1 通道原生解出 512B QMC 密钥 → QMC2 RC4 解密得 fLaC（nmsublist
 * 20900kmflac 与 nmobi 20201kmflac 双端点实测打通；20900kmflac 解出密钥与 baka 母带档
 * 完全一致，交叉验证成立）。插件侧只需 DES 解密+尾 704 提取，把 704 字符 QQ ekey 挂
 * 结果 ekey 字段下发，宿主零改动。
 * ① DES 模块补解密方向（子密钥逆序）+ base64 解码 + extractQmcEkey 尾 704/364 提取；
 * ② kwQmcResolve 官方 convert_url_with_sign 通道（nmobi/nmsublist 双域名竞速，
 *    br=20900kmflac 母带 / 20201kmflac hires；jymaster 实测未登录空 ekey 不接入）；
 * ③ 母带链升级：QMC 双域名竞速 → 海棠 kw master（fLaC 魔数校验）→ DES 双渠道竞速
 *    → 海棠 lossless → standard 保底；hires 档共用此链。actualQuality 按实际档如实标注。
 * v1.4.1 = super 档官方高音质升级：flac/flac24bit 档此前官方只请求 2000kflac 明文，
 * 现优先后请求官方更高档 20201kmflac（24bit hires，QMC 加密，插件解链下发 QQ ekey；
 * nmobi/nmsublist 双域名沙箱实测 fLaC 打通、512B 密钥、bitrate=20201），未命中回落
 * 原 2000kflac 明文竞速池与海棠兜底。actualQuality 'hires' 按上游档位如实标注。
 * v1.4.2 = super/atmos 档官方高音质全档阶梯：20201 之上的官方档未登录双域名实测全部打通
 * （RID=228908 晴天：20900kmflac 母带 / 20501kmflac 至臻全景声均回 mflac+972 字符 ekey、
 * 全链解出 fLaC，两档 512B 密钥互不相同——真实独立档位；jymaster 未登录仍空 ekey，不接入）。
 * ① super 档逐档回落阶梯：QMC 20900 母带 → 20501 全景声 → 20201 24bit（各档双域名竞速）
 *    → 2000kflac 明文竞速池 → 海棠兜底；② atmos 档官方 20501kmflac 升为首选
 *    （未命中 → 海棠 atmos fLaC 校验 → 母带链）；③ 母带链在 20900 与海棠 master 之间
 *    补 20501 档间回落。actualQuality 按命中档如实标注 master/atmos/hires
 *    （internalToHostQuality 原样透传宿主）。
 * v1.4.3 = 各音质文件大小返回宿主（对齐 baka 酷我 qualities 口径）：①解析酷我搜索原生
 * N_MINFO 字段（level/bitrate/format/size 分号串，实测晴天：母带 178.32MB、全景声
 * 76.71MB、24bit 29.72MB、flac 52.83Mb、320k 10.29Mb、128k 4.12Mb），bitrate→宿主键映射
 * （128/192/320→128k/192k/320k、2000→flac、20201+4000→hires、20501→atmos、20900→master，
 * format 白名单 mp3/flac/mflac），五处 raw 构造点透传 N_MINFO，buildMusicItem 挂
 * musicItem.qualities={size,bitrate,format}；②详情回填走 musicpay 免登录接口（文档 §6.1，
 * 实测 200，按 rid 精确取 MINFO，wapi musicInfo 无大小字段）——musicpay 只有明文档大小、
 * 加密档大小在 r.s N_MINFO，两路互补；缺字段/解析为空不输出该字段（宁缺毋假）。
 * v1.4.4 = 清理聚合拆分残留（审查建议级）：① CHART_DEFS 榜单 id 聚合命名 agg-hot/agg-new/
 * agg-rise/agg-douyin 改单源命名 kw-hot/kw-new/kw-rise/kw-douyin（单源插件无多平台合并语义，
 * 纯命名澄清，成员与榜单内容不变，getTopLists/getTopListDetail 按 def.id 引用、缓存键随 id
 * 自然切换，无需其它改动）；② 移除热歌榜封面硬编码抖音 CDN（p3-luna.douyinpic.com，聚合时期
 * 共享素材，非酷我自有资源），与其他榜单 cover:'' 口径一致。
 *
 * 端点与参数全部来自《六平台接口文档（实测整合版）》《酷我音乐接口文档》与第三方 API 文档 v4，
 * 并经 2026-09-06 本沙箱真实网络探针（probe1/2/3）逐条复核，未做任何盲猜。
 * 兼容性：ES8 语法（async/await），不使用 ?. / ??（安卓端风险，官方技能包提示）。
 */

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

// [v1.2.8] MV vid 提取（打通宿主「播放 MV」入口的数据侧前提）。
// 酷我五个歌曲数据入口（searchMusicBykeyWord 搜索 / ksong.s 榜单 / pl.svc 歌单 /
// wapi albumInfo 专辑 / r.s artist2music 歌手作品，2026-09-07 实测）响应统一带
// mvpayinfo.vid；无 MV 的条目 vid 恒为字符串 "0" —— "0" 是 truthy，直接透传会让
// 宿主把无 MV 的歌也判为有 MV（菜单出现但点开必失败），此处统一过滤。
// v1.2.6 修复包同款（mvVidOf helper），v1.2.7 基线未包含、本版补齐。
// [v1.3.0] 对齐 baka 酷我 normalizeKuwoMvId（其 L276-282）：剥 "MV_" 前缀、
// 无效值集扩展到 "0"/"-1"/"false"/"null"/"undefined"（大小写不敏感）。
function mvVidVal(v) {
  var s = str(v).trim().replace(/^MV_/i, '');
  if (!s) return '';
  var low = s.toLowerCase();
  if (low === '0' || low === '-1' || low === 'false' || low === 'null' || low === 'undefined') return '';
  return s;
}

function mvVidOf(it) {
  return mvVidVal(it && it.mvpayinfo ? it.mvpayinfo.vid : undefined);
}

// [v1.3.0] MV 封面采集（对齐 baka 酷我 formatMusicItem 的 mvArtwork，其 L320-323）。
// 搜索入口实测（2026-09-07 probe-mv）：条目带 hts_MVPIC（全 URL）与 MVPIC（短路径，
// 如 "324/s4s75/52/1458871193.jpg"，对应 https://img3.kuwo.cn/wmvpic/ 前缀）；
// 榜单/详情入口无该字段 → 返回 ''，条目不带 mvArtwork（undefined），诚实缺省。
function mvPicOf(it) {
  if (!it) return '';
  var full = str(it.hts_MVPIC).trim();
  if (/^https?:\/\//.test(full)) return full;
  var short = str(it.MVPIC).trim();
  if (short && !/^https?:\/\//.test(short)) return 'https://img3.kuwo.cn/wmvpic/' + short.replace(/^\/+/, '');
  return /^https?:\/\//.test(short) ? short : '';
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
  kuwo: 1.00
};

// 各源声明的免登录音质能力（super=无损档）
// v0.7.0：全音质走第三方（用户确认方向）：
//   酷我 super = 官方 2000kflac 明文 → 海棠 kw lossless（沙箱 fLaC 复核）
var SOURCE_QUALITIES = {
  // [v1.2.3] hires/master/atmos = 海棠 kw 增强档（真 24bit 母带 / 至臻全景声，明文流式端点，
  // 非 mflac 加密档、不经宿主解密通道；仅部分 VIP 歌有货，未命中走回落链）。
  kuwo: ['low', 'standard', 'high', 'super', 'hires', 'master', 'atmos']
};

function canServe(source, quality) {
  var caps = SOURCE_QUALITIES[source] || [];
  return caps.indexOf(quality) >= 0;
}

// ==================== 搜索适配器 ====================
// 每个适配器返回统一内部条目：
// { source, sid, title, artist, album, duration(sec, 可为0), artwork, raw }

// [v1.5.0 -> v1.9.5] kwFeeOfRaw（付费标记判定）已随 VIP 标识停写整体移除。

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
    // [v1.6.0 P2-3] 响应为单引号 JSON 字符串（非标 JSON）时 parseKwBody 容错解析，避免静默空结果
    var body = parseKwBody(res.data, 'abslist');
    var list = (body && body.abslist) || [];
    // [v1.6.0 P2-3+] 主通道空结果回落：searchMusicBykeyWord 2026-09-08 实测恒空（HIT=0，
    // keywords/wd × Secret-Cookie/首页 csrf 三组变体均空），r.s ft=music 可用（HIT 1302）——
    // 回落 kuwoRsSearch 同款映射，主通道保留（上游恢复后自动切回）。
    if (!list.length) {
      return kuwoRsSearch('music', query, page).then(function (raw) {
        return raw.map(kwMusicItemOf).filter(function (it) { return it.sid && it.title; });
      });
    }
    return list.map(kwMusicItemOf).filter(function (it) { return it.sid && it.title; });
  });
}

// [v1.6.0 P2-3+] 音乐条目映射抽出（searchMusicBykeyWord 与 r.s 回落共用）
function kwMusicItemOf(it) {
  var rid = str(it.MUSICRID).replace(/^MUSIC_/, '');
  var pic = str(it.web_albumpic_short);
  return {
    source: 'kuwo', sid: rid,
    title: str(it.NAME || it.SONGNAME), artist: str(it.ARTIST),
    album: str(it.ALBUM), duration: parseInt(it.DURATION, 10) || 0,
    artwork: pic ? 'https://img1.kuwo.cn/star/albumcover/' + pic.replace('/120/', '/500/') : '',
    raw: { rid: rid, N_MINFO: str(it.N_MINFO), mv: mvVidOf(it), mvArtwork: mvPicOf(it), alias: str(it.ALIAS) } // [v1.3.0] mvpayinfo.vid + hts_MVPIC 进 raw；[v1.4.3] N_MINFO 音质大小透传；[v1.9.5] fee（VIP 标识）停写，alias 保留
  };
}

var SEARCH_ADAPTERS = {
  kuwo: searchKuwo
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
  // [v1.2.8] MV 标识提升：组内任一成员 raw.mv 有值即带上（各入口已采集并过滤 "0"）。
  // 宿主守卫（musicItemOptions 长按面板 canPlayMusicVideo）要求歌曲对象顶层
  // mv/mvId/videoId 任一 truthy 才渲染「播放 MV」菜单；getMvSourceImpl 主路径读
  // musicItem.mv || musicItem.videoId 直连 anymatch —— 缺顶层字段时入口永不出现。
  // [v1.3.0] 对齐 baka 酷我 formatMusicItem（其 L303-323）：① mvId 别名同值输出
  // （宿主九字段名单之一，多一层保险）；② mvArtwork 提升自 raw.mvArtwork（搜索入口
  // hts_MVPIC 实测有值）；③ mvSongId = 代表条目 sid（酷我 rid），legacy playUrl 兜底用。
  var mvVid = '';
  var mvArtwork = '';
  for (var mi = 0; mi < members.length && (!mvVid || !mvArtwork); mi++) {
    var mraw = members[mi].raw || {};
    if (!mvVid) mvVid = mvVidVal(mraw.mv);
    if (!mvArtwork) mvArtwork = str(mraw.mvArtwork);
  }
  // [v1.4.3] 各音质文件大小（对齐 baka 酷我 qualities）：解析酷我成员 raw 的 N_MINFO
  // （r.s 搜索原生携带，含加密档大小）；为空不输出该字段（宁缺毋假）。
  var kwQualityInfo = parseKuwoQualityInfo((src.kuwo && src.kuwo.N_MINFO) || '');
  var item = {
    id: best.source + '_' + best.sid, // v0.7.1 P1-2：稳定身份，不再拼页内序号
    title: best.title,
    artist: best.artist,
    album: best.album,
    artwork: artwork || undefined,
    duration: duration || undefined,
    // [v1.2.8] platform 自报：宿主 wrapper 对搜索/歌单/专辑/歌手/榜单入口会盖 platform，
    // 但 normalizeImportedMusicSheet（mediaUtils）只盖歌单不盖 musicList 条目 →
    // 导入歌单/收藏/备份恢复的条目无 platform，宿主反查不到插件（getByMedia 按
    // musicItem.platform 查）→ MV 菜单永不出现；自报 'kuwo' 与 wrapper 盖的值相同，零波及。
    platform: 'kuwo',
    mv: mvVid || undefined,
    mvId: mvVid || undefined, // [v1.3.0] baka 同款别名（宿主守卫九字段名单之二）
    mvSongId: best.sid || undefined, // [v1.3.0] baka 同款：legacy playUrl 按 songId 兜底
    mvArtwork: mvArtwork || undefined, // [v1.3.0] MV 封面（hts_MVPIC）
    qualities: Object.keys(kwQualityInfo).length ? kwQualityInfo : undefined, // [v1.4.3] 各音质 {size,bitrate,format}
    // [v1.5.0 -> v1.9.5] fee（VIP 角标）字段全面停写不再透传；alias（歌词搜索关键词）保留：
    alias: (function () {
      for (var ai = 0; ai < members.length; ai++) {
        var al = members[ai].source === 'kuwo' && members[ai].raw ? str(members[ai].raw.alias) : '';
        if (al) return al;
      }
      return undefined;
    })(),
    _src: src,
    _srcOrder: srcOrder
  };
  return item;
}

// ==================== 封面补齐 ====================
// 无封面条目按 _src 反查：酷我 rid_pic（文档 12.2，纯文本返回图片 URL，实测 200 image）。
// 带缓存 + 并发 6 控制。
var kuwoCoverCache = {};
var KUWO_COVER_CACHE_MAX = 200; // [v1.1.0 fix O-1] 缓存加上限，防长会话内存无界增长

async function fetchKuwoCover(rid) {
  if (!rid) return '';
  if (kuwoCoverCache[rid]) return kuwoCoverCache[rid];
  var r = await axios.get('https://artistpicserver.kuwo.cn/pic.web', {
    params: { type: 'rid_pic', pictype: 'url', content: 'list', size: 500, rid: rid },
    timeout: SOURCE_TIMEOUT, responseType: 'text', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var url = String(r.data || '').trim();
  if (!/^https?:\/\//.test(url)) return '';
  var ck = Object.keys(kuwoCoverCache);
  if (ck.length >= KUWO_COVER_CACHE_MAX) {
    for (var ci = 0; ci < 40 && ci < ck.length; ci++) delete kuwoCoverCache[ck[ci]]; // 简单 FIFO 修剪
  }
  kuwoCoverCache[rid] = url;
  return url;
}

async function enrichArtwork(items, cap) {
  var limit = cap || 30;
  var targets = [];
  for (var i = 0; i < items.length && targets.length < limit; i++) {
    var it = items[i];
    if (it.artwork) continue;
    // 兼容两种条目形态：聚合 musicItem（_src）与内部统一条目（source+raw，歌单/榜单 fetcher 输出）
    var src = it._src;
    if (!src && it.raw && it.source) {
      if (it.source === 'kuwo' && it.raw.rid) src = { kuwo: it.raw };
    }
    if (!src) continue;
    if (src.kuwo && src.kuwo.rid) targets.push({ item: it, kind: 'kuwo', key: src.kuwo.rid });
  }
  if (!targets.length) return items;
  var CONCURRENCY = 6;
  var idx = 0;
  async function worker() {
    while (idx < targets.length) {
      var t = targets[idx++];
      try {
        var url = await fetchKuwoCover(t.key);
        if (url) t.item.artwork = url;
      } catch (e) { /* 封面可选，失败不影响条目 */ }
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(CONCURRENCY, targets.length); w++) workers.push(worker());
  await Promise.all(workers);
  return items;
}

// ==================== 聚合榜单 ====================
// 多平台同名榜单合并：按榜单名次归一化得分 + 跨平台命中加成；
// 条目 _src 携带各平台 raw，复用取链接力（resolveWithFallback）。
// 端点均来自接口文档实测记录（2026-09-02/05），无猜测 URL。

var CHART_TTL_MS = 30 * 60 * 1000;
var chartCache = {};   // { defId: { ts, list } }
var chartInflight = {}; // { defId: Promise } 并发去重

var CHART_DEFS = [
  {
    id: 'kw-hot', title: '热歌榜',
    cover: '', // [v1.4.4] 移除聚合期共享素材的抖音 CDN 封面硬编码（非酷我自有资源），与其他榜单 cover:'' 口径一致
    members: [
      { source: 'kuwo', id: '16' },
    ]
  },
  {
    id: 'kw-new', title: '新歌榜', cover: '',
    members: [
      { source: 'kuwo', id: '17' }
    ]
  },
  {
    id: 'kw-rise', title: '飙升榜', cover: '',
    members: [
      { source: 'kuwo', id: '93' }
    ]
  },
  {
    id: 'kw-douyin', title: '抖音热歌榜', cover: '',
    members: [
      { source: 'kuwo', id: '158' }
    ]
  }
];

var CHART_FETCHERS = {
  kuwo: function (bangId) {
    // kbangserver ksong.s（实测 2026-09-05 返回标准 JSON，musiclist[]）
    return axios.get('https://kbangserver.kuwo.cn/ksong.s', {
      params: { from: 'pc', type: 'bang', id: bangId, pn: 0, rn: 100 },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'http://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var list = (res.data && res.data.musiclist) || [];
      return list.map(function (it) {
        var rid = str(it.id);
        var d = parseInt(it.song_duration, 10) || parseInt(it.duration, 10) || 0;
        return {
          source: 'kuwo', sid: rid,
          title: str(it.name), artist: str(it.artist), album: str(it.album),
          duration: d, artwork: '',
          qualities: (function () { var q = parseKuwoQualityInfo(str(it.N_MINFO)); return Object.keys(q).length ? q : undefined; })(), // [v1.9.5] 榜单条目音质表（N_MINFO 就地解析，聚合条目 aggQuals 透传）
          raw: { rid: rid, N_MINFO: str(it.N_MINFO), mv: mvVidOf(it), mvArtwork: mvPicOf(it) } // [v1.3.0] 榜单入口实测无 MVPIC 字段；[v1.4.3] N_MINFO 透传
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
  // [v1.9.5] 音质表透传：代表条目优先，缺则按成员序补位（此前聚合条目丢音质表，
  // 宿主榜单页音质标识全部缺失——2026-09-11 全页面音质核查实测修复项）
  var aggQuals = base.item.qualities;
  for (var aq = 0; aq < entry.hits.length && !aggQuals; aq++) {
    if (entry.hits[aq].item.qualities) aggQuals = entry.hits[aq].item.qualities;
  }
  return {
    id: 'c_' + base.source + '_' + base.item.sid,
    qualities: aggQuals || undefined,
    title: base.item.title,
    artist: base.item.artist,
    album: base.item.album || undefined,
    duration: duration || undefined,
    artwork: base.item.artwork || undefined,
    // [v1.3.0] 榜单条目补齐 MV 链路（v1.2.9 缺口：buildChartItem 既无 platform 自报也无
    // mv 提升 → 榜单长按菜单永不出现「播放 MV」）：platform 自报（宿主 getByMedia 反查）
    // + mv/mvId/mvSongId/mvArtwork 提升（ksong.s 入口 raw 已采集，mvVidOf 过滤 "0"）
    platform: base.source || 'kuwo',
    mv: mvVidVal(base.item.raw && base.item.raw.mv) || undefined,
    mvId: mvVidVal(base.item.raw && base.item.raw.mv) || undefined,
    mvSongId: base.item.sid || undefined,
    mvArtwork: str(base.item.raw && base.item.raw.mvArtwork) || undefined,
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

// ==================== 歌单导入 ====================
// 端点全部实测（artifacts/sheet-probe/，2026-09-05）：
// kuwo   nplserver.pl.svc op=getlistinfo（pn/rn 分页；条目字段 id/name/artist/album/duration/albumpic）

// [v1.1.0 fix S-3] v1.0.0 翻 4 页(400 首)但 hints 宣称 500 首，宣称不符；5 页 × 100 = 500 对齐宣称
var SHEET_MAX_PAGES = 5;      // 单源最多翻 5 页（插件方法 10s 硬上限内）
var SHEET_MAX_ITEMS = 500;    // 导入条数上限（防超时）

/** 各平台歌单 URL → 歌单 id（全部为实测存在的链接格式；返回 null 表示不认识） */
var SHEET_URL_RESOLVERS = {
  kuwo: function (s) {
    if (!/kuwo\.cn/.test(s)) return null;
    var m = /playlist_detail\/(\d+)/.exec(s) || /[?&]pid=(\d+)/.exec(s);
    return m ? m[1] : null;
  }
};

/**
 * 解析歌单链接/纯数字 id → { source, id }
 * 支持：酷我网页链接。纯数字 id 无法唯一判定平台，不猜。
 */
// [v1.8.2 P2-4] 歌单导入错误统一构造——message 原样展示给宿主，code 供宿主结构化处理。
function sheetImportError(code, msg) {
  var e = new Error('[kuwo] ' + msg);
  e.code = code;
  e.platform = 'kuwo';
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
  var id = SHEET_URL_RESOLVERS.kuwo(s);
  if (id) return { source: 'kuwo', id: id };
  throw sheetImportError('SHEET_URL_UNRECOGNIZED', '无法识别的歌单链接（支持酷我 kuwo.cn 的网页或分享链接）');
}

// [v1.8.4] 富文本简介转纯文本（<br>→换行，去其余标签，解常用实体）
function kuwoStripHtml(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

var SHEET_FETCHERS = {
  kuwo: async function (pid) {
    // [v1.6.0 P2-4 死链核查] go-music-dl 调研报告称 nplserver pl.svc 已死(500)——2026-09-08
    // 实测 4 个 pid（3723048109/1865426195/2840365037/1060838765）全部 200 且带 musiclist，
    // 接口存活，按证据保留不移除。
    var out = [];
    // [v1.8.4] pl.svc 响应顶层自带歌单元数据（title/info/pic/uname/total/playnum），
    // 首页捕获随列表回传，importMusicSheetImpl 据此组装完整 IMusicSheetItem
    var sheetMeta = null;
    for (var pn = 0; pn < SHEET_MAX_PAGES && pn * 100 < SHEET_MAX_ITEMS; pn++) {
      var res = await axios.get('https://nplserver.kuwo.cn/pl.svc', {
        params: { op: 'getlistinfo', pid: pid, pn: pn, rn: 100, encode: 'utf8', keyset: 'pl2012', identity: 'kuwo', pcmp4: 1, vipver: 'MUSIC_9.1.1.2_BCS2', newver: 1 },
        timeout: SOURCE_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://www.kuwo.cn/' }
      });
      // [v1.8.4] 首页捕获顶层元数据（description 字段名对齐宿主契约；info 转纯文本）
      if (!sheetMeta && res.data && res.data.title) {
        sheetMeta = {
          title: str(res.data.title),
          artwork: str(res.data.pic) || undefined,
          description: kuwoStripHtml(res.data.info) || undefined,
          artist: str(res.data.uname) || undefined,
          worksNum: parseInt(res.data.total, 10) || undefined,
          playCount: parseInt(res.data.playnum, 10) || undefined
        };
      }
      var list = (res.data && res.data.musiclist) || [];
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        out.push({
          source: 'kuwo', sid: str(it.id),
          title: str(it.name || it.FSONGNAME), artist: str(it.artist || it.FARTIST),
          album: str(it.album || it.FALBUM),
          duration: parseInt(it.duration, 10) || 0,
          artwork: str(it.albumpic || '').replace('/120/', '/500/'),
          raw: { rid: str(it.id), N_MINFO: str(it.N_MINFO || it.MINFO || ''), mv: mvVidOf(it), mvArtwork: mvPicOf(it) } // [v1.3.0][v1.8.2 P2-2] N_MINFO 音质大小透传（歌单入口补齐，与其他五入口同口径）
        });
      }
      if (list.length < 100) break;
    }
    await enrichArtwork(out, 24); // v0.7.1 P1-4：300→24（首屏可见量），最坏 24÷6×4.5s≈18s→压进预算量级，其余封面靠 getMusicInfo 懒加载
    // [v1.8.4] 数组挂载 meta 附加属性（歌单标题/封面/简介/作者，同 qq total 惯例）
    var filtered = out.filter(function (it) { return it.sid && it.title; });
    filtered.meta = sheetMeta;
    return filtered;
  }
};

/** 归一化歌单条目 → 聚合条目（_src 带单源 raw，复用取链接力） */
function buildSheetItem(entry) {
  var src = {};
  src[entry.source] = entry.raw;
  // [v1.8.2 P2-2] 与 buildMusicItem 同口径：N_MINFO 解析为空不输出该字段（宁缺毋假）
  var sheetQualities = parseKuwoQualityInfo((entry.raw && entry.raw.N_MINFO) || '');
  var item = {
    id: entry.source + '_' + entry.sid,
    title: entry.title,
    artist: entry.artist,
    album: entry.album || undefined,
    duration: entry.duration || undefined,
    artwork: entry.artwork || undefined,
    // [v1.2.8] 单曲导入/歌手作品/专辑路径同口径：顶层 mv + platform 自报（理由同 buildMusicItem）
    // [v1.3.0] mvId/mvSongId/mvArtwork 同 buildMusicItem 对齐 baka 酷我（mvSongId=entry.sid）
    // [v1.8.2 P2-2] qualities：歌单入口 raw 补 N_MINFO 后与 buildMusicItem 同口径挂音质信息
    platform: entry.source || 'kuwo',
    qualities: Object.keys(sheetQualities).length ? sheetQualities : undefined, // [v1.8.2 P2-2]
    mv: (entry.raw ? mvVidVal(entry.raw.mv) : '') || undefined,
    mvId: (entry.raw ? mvVidVal(entry.raw.mv) : '') || undefined,
    mvSongId: entry.sid || undefined,
    mvArtwork: (entry.raw ? str(entry.raw.mvArtwork) : '') || undefined,
    _src: src,
    _srcOrder: [entry.source]
  };
  return item;
}

/**
 * 导入歌单：urlLike 支持酷我网页/分享链接。
 * [v1.8.4] 返回完整 IMusicSheetItem 歌单对象（title/description 对齐宿主契约）；
 * 条目带单源 _src，播放时复用取链接力。
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
  // [v1.8.4]（对齐宿主 IImportMusicSheetResult / 咪咕 v1.2.0 同构）：返回完整歌单对象。
  // meta（pl.svc title/info/pic/uname/total）随列表回传；失败时 title 兜底「酷我歌单 #<pid>」。
  var meta = entries.meta || null;
  var sheet = {
    id: 'kuwo_' + resolved.id,
    platform: 'kuwo',
    isImported: true,
    title: (meta && meta.title) || ('酷我歌单 #' + resolved.id),
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
// kuwo   wapi.kuwo.cn/api/www/music/musicInfo?mid=（v0.6 实测✅ + 本沙箱复核：
//        data.musicrid/name/artist/artistid/album/albumid/pic/duration/mvpayinfo.vid）

var SONG_URL_RESOLVERS = {
  kuwo: function (s) {
    if (!/kuwo\.cn/.test(s)) return null;
    var m = /play_detail\/(\d+)/.exec(s) || /yinyue\/(\d+)/.exec(s) || /[?&]rid=(\d+)/.exec(s);
    return m ? m[1] : null;
  }
};

/**
 * 解析单曲分享链接 → { source, id }
 * 支持：酷我歌曲分享链接。纯数字 id 无法唯一判定平台，不猜。
 */
async function resolveSongId(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw new Error('单曲链接为空');
  if (/^\d{5,}$/.test(s)) throw new Error('纯数字歌曲 id 无法判定平台，请粘贴带域名的完整分享链接');
  var id = SONG_URL_RESOLVERS.kuwo(s);
  if (id) return { source: 'kuwo', id: id };
  throw new Error('无法识别的单曲链接（支持酷我 kuwo.cn 的歌曲分享链接）');
}

var SONG_DETAIL_FETCHERS = {
  kuwo: function (rid) {
    return axios.get('https://wapi.kuwo.cn/api/www/music/musicInfo', {
      params: { mid: rid, httpsStatus: 1, reqId: Date.now() },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var d = res.data && res.data.data;
      if (!d) throw new Error('kuwo detail empty');
      var numRid = str(d.musicrid || rid).replace(/^MUSIC_/, '');
      // [v1.3.0] 原 var mvVid（未过滤直取）已内联为 raw.mv/raw.vid 的 mvVidVal(...) 调用，死变量移除
      return {
        source: 'kuwo', sid: numRid,
        title: str(d.name), artist: str(d.artist),
        album: d.album ? String(d.album) : '',
        duration: parseInt(d.duration, 10) || 0,
        artwork: d.pic || d.albumpic ? String(d.pic || d.albumpic) : '',
        // [v1.1.0 fix S-2] wapi musicInfo 免登录实测返回 mvpayinfo.vid；v1.0.0 丢弃该字段
        // 导致 getMusicInfoImpl 的 mv/videoId 补齐分支永不生效（宿主无 MV 入口）。
        // [v1.3.0] mv/vid 采集统一改走升级后的 mvVidVal（剥 MV_ 前缀 + 无效值集——原 vid 走
        // 未过滤的 mvVid，vid="0" 时 truthy 透传 → 宿主 videoId="0" 菜单亮但点开必失败）；
        // wapi 详情实测无 MVPIC/hts_MVPIC 字段（2026-09-07 probe-mv），mvPicOf 恒 '' → mvArtwork 诚实缺省。
        raw: { rid: numRid, mv: mvVidVal(d.mvpayinfo && d.mvpayinfo.vid), vid: mvVidVal(d.mvpayinfo && d.mvpayinfo.vid), mvArtwork: mvPicOf(d) }
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
  // [v1.2.9] 旧数据自愈：无条件回填 platform——v1.2.8 之前入库的条目无 platform，
  // 宿主 canPlayMusicVideo 按 musicItem.platform 反查插件失败 → MV 菜单永不亮；
  // 播放/进详情触发 getMusicInfo 后回填，宿主合并回条目即点亮（守卫 2 修复）。
  if (musicItem && !musicItem.platform) musicItem.platform = 'kuwo';
  if (!musicItem) return musicItem;
  // [v1.8.1 P0-2] 裸 ID playById 反查——酷我主键为 id，复用 SONG_DETAIL_FETCHERS
  // + buildSheetItem 重建条目（与 importMusicItemImpl 同路径）。参照 migu 兜底模式。
  if (!musicItem._src) {
    try {
      var bareId = String(musicItem.id || '').trim();
      if (bareId && SONG_DETAIL_FETCHERS.kuwo) {
        var entry = await SONG_DETAIL_FETCHERS.kuwo(bareId);
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
  var sidKey = { kuwo: 'rid' };

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
      // [v1.3.0] 对齐 baka 酷我 getMusicInfo（其 L1084-1097）：mvId 别名、mvArtwork 回填；
      // 并把已有 mv 同步给 mvId（旧条目只带 mv 时补别名，宿主守卫多一层命中面）
      if (detail.raw && detail.raw.mv && !musicItem.mvId) musicItem.mvId = String(detail.raw.mv);
      if (musicItem.mv && !musicItem.mvId) musicItem.mvId = String(musicItem.mv);
      if (detail.raw && detail.raw.mvArtwork && !musicItem.mvArtwork) musicItem.mvArtwork = String(detail.raw.mvArtwork);
      if (musicItem.artwork && musicItem.duration) break; // 关键字段齐了就停
    } catch (e) { /* 详情可选，失败换下个源 */ }
  }
  // [v1.4.3] 音质大小回填（文档 §6.1 musicpay）：条目无 qualities 且酷我成员在场时，
  // 按 rid 精确取 musicpay MINFO 解析补上（wapi musicInfo 无大小字段，2026-09-07 实测；
  // baka 酷我 getQualityByMusicId 同用途，此处用 rid 直查、比按歌名回搜更精确）。
  if (!musicItem.qualities && srcMap && srcMap.kuwo && srcMap.kuwo.rid) {
    try {
      var mpQ = parseKuwoQualityInfo(await kwMusicpayMinfo(String(srcMap.kuwo.rid)));
      if (Object.keys(mpQ).length) musicItem.qualities = mpQ;
    } catch (e) { /* 大小可选 */ }
  }
  // [v1.5.0 -> v1.9.5] fee（VIP 标识）停写不再回填。
  // 仍缺封面：走封面反查通道（酷我 rid_pic / 酷狗 get_song_info）
  if (!musicItem.artwork) {
    try { await enrichArtwork([musicItem]); } catch (e) { /* 封面可选 */ }
  }
  return musicItem;
}

// ==================== 取链适配器 ====================

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

// ---------- [v1.4.0] 酷我 QMC ekey 解链（官方接口直源，宿主零改动） ----------
// 酷我 mobi.s QMC 加密档（20201/20900kmflac 等）返回的 ekey（实测 972 字符）真实结构：
// ekey = base64( 酷我自定义DES( 文本 ) )，文本 = 前导段 + 【尾部 704 字符 QQ V1 信封 ekey】。
// 宿主 ekey 通道（Mp3UtilModule.decryptEKey → normalizeEkey 末 704 → QQ TEA V1/V2 信封）
// 恰好消费这个 704 字符 QQ ekey —— 插件侧解掉外层酷我 DES 即可直通，宿主零改动。
// （旧 v0.6.0「712B 密钥物理上无法下发」结论作废：外层解开后尾部恰好 704，装得下，
// 端到端实测 fLaC。）
function kwBase64Decode(s) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var map = {};
  for (var i = 0; i < chars.length; i++) map[chars.charAt(i)] = i;
  map['-'] = 62; map['_'] = 63; // URL-safe 变体兼容
  s = String(s || '').replace(/[^A-Za-z0-9+\/=\-_]/g, '');
  var out = [], buf = 0, bits = 0;
  for (var j = 0; j < s.length; j++) {
    var c = s.charAt(j);
    if (c === '=') break;
    var v = map[c];
    if (v === undefined) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xFF); }
  }
  return out;
}

// 酷我 DES 解密任意长度（输入须为 8 的倍数；与参考实现 kuwo_crypto mode=1 一致：
// 子密钥逆序、块独立 ECB、结果 rstrip 0x00 后按 ASCII 文本消费）
function kwDesDecryptBytes(bytes, keyStr) {
  var sub = kwSubkeys(keyStr).slice().reverse();
  var n = Math.floor(bytes.length / 8);
  if (n * 8 !== bytes.length) throw new Error('kw des decrypt: input not multiple of 8');
  var out = [];
  for (var m = 0; m < n; m++) {
    var lo = 0, hi = 0;
    for (var k = 0; k < 8; k++) {
      var b = bytes[m * 8 + k] & 0xFF;
      if (k < 4) lo |= b << (8 * k); else hi |= b << (8 * (k - 4));
    }
    var dec = kwDesBlock(sub, lo | 0, hi | 0);
    for (var t = 0; t < 8; t++) {
      out.push(t < 4 ? (dec[0] >>> (8 * t)) & 0xFF : (dec[1] >>> (8 * (t - 4))) & 0xFF);
    }
  }
  while (out.length && out[out.length - 1] === 0) out.pop(); // rstrip \x00
  return out;
}

// 酷我 ekey → QQ ekey（宿主原生可解）：外层 DES 解密得文本，尾部 704/364 字符过
// base64 字符集校验后返回（704=V1 信封→512B 密钥；364=V2 信封→宿主 decryptEKeyV2 路径）。
// 提取失败返回空串，由调用方拒收（宁缺毋滥）。
function extractQmcEkey(kwEkey) {
  var raw = kwBase64Decode(kwEkey);
  if (raw.length < 16 || raw.length % 8 !== 0) return '';
  var txt = kwDesDecryptBytes(raw, 'ylzsxkwm')
    .map(function (b) { return String.fromCharCode(b); }).join('');
  var cands = [704, 364]; // QMC_RAW_KEY_LENGTHS（QQ 侧 V1/V2 信封形态）
  for (var i = 0; i < cands.length; i++) {
    var L = cands[i];
    if (txt.length < L) continue;
    var tail = txt.slice(txt.length - L);
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(tail)) continue; // 标准 base64 字符集校验
    return tail;
  }
  return '';
}

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };

// [v1.4.0 更正] 下述 v0.6.0 结论已被端到端实测推翻：酷我 ekey 外层 DES 解开后是文本，
// 尾部 704 字符即 QQ V1 信封 ekey（512B 密钥恰好装得下），插件侧解链后宿主 ekey 通道
// 原生可解（fLaC 实测打通）。QMC 加密档已接入，见 extractQmcEkey / kwQmcResolve。
// （v0.6.0 原注：20201/20501/20900kmflac 为 QMCv2 加密档，误按标准 DES 派生 712B 原始
// 密钥直发，超出 ekey 通道 704 字符数学上限，故当时不接入。）
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
    // [v1.6.1 P0] super/hires 档补 bitrate 下限：format=flac 但 bitrate<2000 的虚标拒收
    if ((quality === 'super' || quality === 'hires') && br > 0 && br < 2000) {
      throw new Error('kuwo des bitrate degraded: ' + br);
    }
    // [v1.1.0 fix O-6] high 档请求 320kmp3 但响应 bitrate 不足 → 视为未命中（抛错交给竞速对手
    // nmobi/海棠），不再静默以低码率顶替高品档拉低命中率
    if (quality === 'high' && br > 0 && br < 320) {
      throw new Error('kuwo des bitrate degraded: ' + br);
    }
    // [v0.7.4] bitrate 口径修正：convert_url2 响应 bitrate 为 kbps（实测 128/320/2000），
    // 原阈值 320000/192000 按 bps 理解，导致 mp3 档恒标 128k
    var aq;
    // [v1.6.0 P1-1] Hi-Res 标注：DES convert_url2 format=flac 实测即返回 bitrate=2000（真 2000kflac
    // 无损，55MB 级），≥2000 标 'hires' 与普通 flac 区分；format=2000kflac 不被稳定接受（228908
    // 降级 mp3 128）故不改请求格式，仅按响应标注
    if (fmt === 'flac') aq = br >= 2000 ? 'hires' : 'flac';
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
function kwOfficialResolve(host, raw, quality, variant, signal) { // [v1.7.1 fix#4] +signal
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
    signal: signal || undefined, // [v1.7.1 fix#4] 落选取消（axios 低版本忽略，无副作用）
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) {
      throw new Error('kuwo no url');
    }
    if ((quality === 'super' || quality === 'hires') && d.format && d.format !== 'flac') {
      throw new Error('kuwo format degraded: ' + d.format);
    }
    // [v1.6.1 P0] super/hires 档补 bitrate 下限：请求 2000kflac 但响应 bitrate<2000 视为静默
    // 降级拒收（HotDownloader 严格校验语义；format=flac 的低码率虚标同样拦）
    if ((quality === 'super' || quality === 'hires') && d.bitrate && parseInt(d.bitrate, 10) < 2000) {
      throw new Error('kuwo bitrate degraded: ' + d.bitrate);
    }
    // [v1.2.0 优化②] high 档：请求 320kmp3，响应非 mp3（ogg 降级等）一律拒收
    if (quality === 'high' && d.format && d.format !== 'mp3') {
      throw new Error('kuwo high format degraded: ' + d.format);
    }
    // [v1.6.1 P0] high 档补 bitrate 下限：请求 320kmp3 回 128kmp3（format 同为 mp3 的隐性
    // 降级）拒收，交给竞速对手/海棠 exhigh 兜底
    if (quality === 'high' && d.bitrate && parseInt(d.bitrate, 10) < 320) {
      throw new Error('kuwo high bitrate degraded: ' + d.bitrate);
    }
    if (d.duration && d.duration > 0 && d.duration < 60) {
      throw new Error('kuwo trial snippet');
    }
    // [v0.7.4] actualQuality 按响应 bitrate 如实标注（nmobi 响应 bitrate 为 kbps 口径），不按请求档宣称
    // [v1.6.0 P1-1] Hi-Res 标注：br=2000kflac 实测 fLaC 55,397,039B（晴天 228908）；br=flac 反而
    // 降级 mp3 128——请求档保持 KUWO_BR 不变，返回 flac 且 bitrate>=2000 时标 'hires'
    var aq = (d.format === 'flac')
      ? ((d.bitrate >= 2000) ? 'hires' : 'flac')
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    return { url: String(d.url), actualQuality: aq };
  });
}

// [v1.4.0] 酷我 QMC 加密档官方通道（convert_url_with_sign，nmobi/nmsublist 同构双域名竞速）：
// 参数与沙箱端到端实测打通的形态逐字一致（2026-09-07，RID=228908 晴天）——
// nmobi: source=kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk + prod/vipver/corp/sig/android_id 参数集；
// nmsublist: source=kwplayer_ar_8.5.5.0_keluze.apk 极简参数集；UA okhttp/3.10.0；user 16 位随机小写数字。
// br=20900kmflac 母带 / 20501kmflac 至臻全景声 / 20201kmflac 24bit hires（jymaster 未登录
// 空 ekey 不接入；20501 与 20900 的 512B 密钥互不相同，实测为真实独立档位）。
// 响应 JSON data.url + data.ekey（972 字符酷我形态）：插件侧 extractQmcEkey 解出尾部 704 字符
// QQ ekey 挂结果 ekey 字段下发，宿主既有 ekey 通道（normalizeEkey 末 704 → QQ TEA V1 信封
// → QMC2 RC4）原生消费，宿主零改动。校验：ekey 缺失/<400 字符/提取失败/试听片段(duration<60s)
// 一律拒收交给竞速对手/海棠兜底（宁缺毋滥）。
function kwQmcRandUser() {
  var pool = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
  for (var i = 0; i < 16; i++) s += pool.charAt(Math.floor(Math.random() * pool.length));
  return s;
}
function kwQmcResolve(host, raw, br, aq) {
  var params;
  if (host === 'nmsublist.kuwo.cn') {
    params = {
      f: 'web', type: 'convert_url_with_sign', rid: raw.rid, br: br,
      user: kwQmcRandUser(), source: 'kwplayer_ar_8.5.5.0_keluze.apk'
    };
  } else {
    params = {
      f: 'web', type: 'convert_url_with_sign', rid: raw.rid, br: br,
      user: kwQmcRandUser(), sig: 0, android_id: 0, prod: 'kwplayerhd_ar_4.3.0.8',
      corp: 'kuwo', vipver: '4.3.0.8',
      source: 'kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk'
    };
  }
  return axios.get('https://' + host + '/mobi.s', {
    params: params,
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo qmc no url');
    // [v1.6.1 P0] 档位真实性校验（HotDownloader download.rs 同款语义：响应 bitrate/format 与
    // 请求档严格相等，不匹配即拒收）。实测降级形态：rid=401577137 请求 20900kmflac 回
    // 20201kmflac+ekey（旧逻辑放行会虚标 master）；rid=505792 请求 20900kmflac 回 48k aac
    // 无 ekey（旧逻辑已被 ekey 门禁拦截）。拒收后交给竞速对手/下一档回落链。
    var mReq = /^(\d+)k(\w+)$/.exec(String(br));
    if (mReq) {
      var wantBr = parseInt(mReq[1], 10), wantFmt = mReq[2];
      if (d.format && String(d.format) !== wantFmt) {
        throw new Error('kuwo qmc format degraded: ' + d.format);
      }
      if (d.bitrate && parseInt(d.bitrate, 10) !== wantBr) {
        throw new Error('kuwo qmc bitrate degraded: ' + d.bitrate);
      }
    }
    var ke = String(d.ekey || '');
    if (ke.length < 400) throw new Error('kuwo qmc no ekey');
    var qq = extractQmcEkey(ke);
    if (!qq) throw new Error('kuwo qmc ekey extract failed');
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo qmc trial snippet');
    return { url: String(d.url), ekey: qq, actualQuality: aq };
  });
}

// [v1.6.1 P1 提速] HotDownloader 原样形态竞速路（download.rs 1:1 对齐）：
// http://mobi.kuwo.cn/mobi.s + 显式 format 参数 + from=PC + 随机 u32 user / 16 位小写 hex
// android_id + okhttp/4.10.0 UA + Referer。沙箱实测（2026-09-08，晴天 × 5 档 × n=3）：
// 均值 62–74ms，比 nmsublist 极简形态（88–114ms）快约 30ms，响应 CDN 落 kw-er（现有
// 形态落 car-er）；media URL http://kw-er.kuwo.cn 在既有白名单 .kuwo.cn$ 内。
// 支持明文与 QMC 加密档（fmt=mflac/mgg 时走 extractQmcEkey 提 704 字符 QQ ekey）。
// minBr>0 时启用响应 bitrate 下限校验（静默降级拒收，交给竞速对手）。
function kwHdRandHex() {
  var pool = '0123456789abcdef', s = '';
  for (var i = 0; i < 16; i++) s += pool.charAt(Math.floor(Math.random() * 16));
  return s;
}
function kwHdResolve(raw, br, aq, minBr) {
  var mHd = /^(\d+)k(\w+)$/.exec(String(br));
  var fmt = mHd ? mHd[2] : String(br);
  var params = {
    f: 'web', user: String(Math.floor(Math.random() * 4294967295)),
    android_id: kwHdRandHex(), source: 'kwplayer_ar_5.1.0.0_B_jiakong_vh.apk',
    type: 'convert_url_with_sign', from: 'PC', rid: raw.rid, br: br, format: fmt
  };
  return axios.get('http://mobi.kuwo.cn/mobi.s', {
    params: params, timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'okhttp/4.10.0', Referer: 'http://www.kuwo.cn/' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo hd no url');
    // [v1.6.1 P0] format 严格相等（mp3 请求回 aac / flac 请求回 mp3 均拒收）
    if (d.format && String(d.format) !== fmt) throw new Error('kuwo hd format degraded: ' + d.format);
    var respBr = parseInt(d.bitrate, 10) || 0;
    if (minBr > 0 && respBr > 0 && respBr < minBr) throw new Error('kuwo hd bitrate degraded: ' + respBr);
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo hd trial snippet');
    var out;
    if (fmt === 'mflac' || fmt === 'mgg') {
      var ke = String(d.ekey || '');
      if (ke.length < 400) throw new Error('kuwo hd no ekey');
      var qq = extractQmcEkey(ke);
      if (!qq) throw new Error('kuwo hd ekey extract failed');
      out = { url: String(d.url), ekey: qq, actualQuality: aq };
    } else {
      // 明文档 actualQuality 按响应 bitrate 如实标注（宁低勿高，与 kwOfficialResolve 同口径）
      var aqOut = aq || ((fmt === 'flac')
        ? ((respBr >= 2000) ? 'hires' : 'flac')
        : (respBr >= 320 ? '320k' : (respBr >= 192 ? '192k' : '128k')));
      out = { url: String(d.url), actualQuality: aqOut };
    }
    return out;
  });
}

// [v1.6.1] QMC 加密档三路竞速 helper：官方双域名（nmobi/nmsublist）+ HD 形态（kwHdResolve）。
// minBr 取请求档数值（parseInt('20900kmflac')=20900），响应 bitrate 低于请求档即静默降级拒收。
function kwQmcRace(raw, br, aq) {
  return raceSuccess([
    kwQmcResolve('nmobi.kuwo.cn', raw, br, aq),
    kwQmcResolve('nmsublist.kuwo.cn', raw, br, aq),
    kwHdResolve(raw, br, aq, parseInt(br, 10) || 0)
  ]);
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
    // [v1.6.1] 守卫签名补 declared（antiserver 恒 128k mp3，启用码率下限 96k 校验）
    return guardFullAudio(url, musicItem, { actualQuality: '128k' }).then(function () {
      return { url: url, actualQuality: '128k' };
    });
  });
}

// [v1.9.15 P0-1 吸收] 海棠 kw.php 直连通道（musicapi.haitangw.net/music/kw.php）。与既有
// musicserver.haitangw.cc/v1/music/resolve-url 是不同域名不同形态的独立端点（2026-09-10 复核判
// 「重复不接入」的是 resolve-url 形态；kw.php 独立端点本轮按调研清单吸收，2026-09-25 探针实测
// lossless 302→car-er.kuwo.cn 酷我官方 fLaC 直链 55.4MB）。请求哪个音质取哪个音质：level 映射
// standard/low→128k、high→320k、super→lossless。返回双形态兼容：301/302 Location 直链 /
// 200 JSON（url 在 data.url，个别形态在顶层 url）。真机 WebView XHR 自动跟随 302
// （maxRedirects:0 仅 Node 生效）场景以 responseURL 探测取最终直链（v1.9.3 同款）。
// 兜底定位：海棠 resolve-url 兜底之后追加，不改变现有主链优先级；actualQuality 如实声明，
// 外层 resolveWithFallback 守卫按声明档校验（明文无损必须 fLaC / 有损码率下限 75%），
// 不符即拒收接力，fail-closed 不虚标。
function kwHaitangPhpResolve(raw, quality, musicItem) {
  var level = (quality === 'super') ? 'lossless' : (quality === 'high' ? '320k' : '128k');
  var api = 'https://musicapi.haitangw.net/music/kw.php?type=mp3&id=' + encodeURIComponent(String(raw.rid)) + '&level=' + level;
  return axios.get(api, {
    timeout: SOURCE_TIMEOUT,
    maxRedirects: 0,
    validateStatus: null,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://musicapi.haitangw.net/' }
  }).then(function (res) {
    var loc = res.headers && (res.headers.location || res.headers.Location);
    var u = (res.status === 301 || res.status === 302) && loc && /^https?:\/\//i.test(String(loc)) ? String(loc) : '';
    if (!u) {
      var j = res.data;
      u = (j && j.data && j.data.url) || (j && j.url) || '';
    }
    // 真机 WebView 自动跟随 302：status=200 且 responseURL 为绝对 URL 且异于请求 URL → 取最终直链
    var finalUrl = res.request && res.request.responseURL;
    if (!u && finalUrl && /^https?:\/\//i.test(String(finalUrl)) && String(finalUrl) !== api) u = String(finalUrl);
    if (!u || !/^https?:\/\//i.test(String(u))) throw new Error('kuwo haitang-php: no url (status ' + res.status + ')');
    return { url: String(u), actualQuality: internalToHostQuality(quality), channel: 'kuwo-haitang-php' };
  });
}

// [v1.9.15 P1-2 吸收] nxinxz 酷我直连通道（music.nxinxz.com/kw.php，仅 128/320 mp3 档）。
// 2026-09-25 探针实测：320k 302→car-er.kuwo.cn 官方直链（ID3 mp3 10.79MB）。level 映射
// standard/low→128k、high→320k；super/hires 不接（无对应档，避免静默降级虚标）。
// 双形态兼容 / responseURL 探测 / 外层守卫 fail-closed 同 kwHaitangPhpResolve。
function kwNxinxzResolve(raw, quality, musicItem) {
  if (quality !== 'standard' && quality !== 'low' && quality !== 'high') {
    return Promise.reject(new Error('kuwo nxinxz: unsupported quality ' + quality));
  }
  var level = quality === 'high' ? '320k' : '128k';
  var api = 'https://music.nxinxz.com/kw.php?id=' + encodeURIComponent(String(raw.rid)) + '&level=' + level + '&type=mp3';
  return axios.get(api, {
    timeout: SOURCE_TIMEOUT,
    maxRedirects: 0,
    validateStatus: null,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://music.nxinxz.com/' }
  }).then(function (res) {
    var loc = res.headers && (res.headers.location || res.headers.Location);
    var u = (res.status === 301 || res.status === 302) && loc && /^https?:\/\//i.test(String(loc)) ? String(loc) : '';
    if (!u) {
      var j = res.data;
      u = (j && j.data && j.data.url) || (j && j.url) || '';
    }
    var finalUrl = res.request && res.request.responseURL;
    if (!u && finalUrl && /^https?:\/\//i.test(String(finalUrl)) && String(finalUrl) !== api) u = String(finalUrl);
    if (!u || !/^https?:\/\//i.test(String(u))) throw new Error('kuwo nxinxz: no url (status ' + res.status + ')');
    return { url: String(u), actualQuality: quality === 'high' ? '320k' : '128k', channel: 'kuwo-nxinxz' };
  });
}

// [v1.9.15 P0-2 吸收] antiserver 酷我 320k 备选（anti.s convert_url）。既有 kwAntiserverResolve
// 仅 standard/low 档参与竞速且恒 128k；本通道仅 high 档链尾启用（format=mp3 请求 320 档）。
// 注意：antiserver 返回档位不稳定（匿名常返 128k、VIP 试听片段亦有），actualQuality 声明
// 320k 后由外层守卫按码率下限（<240kbps）与试听片段规则拒收接力，fail-closed 不虚标。
// 返回平文本裸 URL（主形态）+ JSON/键值兜底解析（调研模板同款正则）。
function kwAntiserverHighResolve(raw, quality, musicItem) {
  if (quality !== 'high') return Promise.reject(new Error('kuwo antiserver-high: high only'));
  return axios.get('https://antiserver.kuwo.cn/anti.s', {
    params: { type: 'convert_url', rid: 'MUSIC_' + raw.rid, format: 'mp3', response: 'url' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var text = String(res.data || '').trim();
    var m = text.match(/https?:\/\/\S+?\.(?:mp3|aac|m4a)\S*/i); // 裸 URL 平文本（主形态）
    var url = m ? m[0] : '';
    if (!url && /^http/i.test(text)) url = text.split(/\s+/)[0];
    if (!url) throw new Error('kuwo antiserver-high: no url');
    return { url: url, actualQuality: '320k', channel: 'kuwo-antiserver-high' };
  });
}

// [v1.2.3] 母带优先链（hires/master 共用；atmos 回落至此）：原 v1.2.2 hires 分支原样抽出。
// ① 海棠 kw master（真 24bit FLAC，fLaC 魔数校验）→ ② DES 手机/车载双渠道竞速
// → ③ 海棠 lossless（非 fLaC 下探）→ 海棠 standard 128k mp3 保底。
function resolveKuwoMasterChain(raw, quality) {
  // [v1.4.0] ① 酷我 QMC 加密档官方双域名竞速（20900kmflac 母带，插件侧解链得 704 字符
  // QQ ekey，宿主 ekey 通道原生消费）：官方直源、免第三方依赖，升为母带链首选；
  // actualQuality 'master' 经交叉验证（20900kmflac 解出密钥与 baka 母带档完全一致）。
  // ② 海棠 kw master（fLaC 魔数校验）→ ③ DES 手机/车载双渠道竞速 → ④ 海棠 lossless
  //（非 fLaC 下探）→ 海棠 standard 128k mp3 保底，原有回落链原样保留。
  // [v1.6.1] 双域名竞速升级 kwQmcRace 三路（+HD 形态，均值提速 ~30ms）；尾链抽出为
  // resolveKuwoMasterTail 与新增 hires 链共享。
  return kwQmcRace(raw, '20900kmflac', 'master')
  .catch(function () {
    // [v1.4.2] 官方档间回落：20900 母带无货 → 20501 至臻全景声（仍官方直源、未登录
    // 实测打通），再走第三方海棠。actualQuality 随实际命中档如实降标。
    return kwQmcRace(raw, '20501kmflac', 'atmos');
  }).catch(function () {
    return resolveKuwoMasterTail(raw);
  });
}

// [v1.6.1] 母带尾链（海棠 kw master → DES 手机/车载双渠道竞速 → 海棠 lossless（非 fLaC
// 下探）→ 海棠 standard 128k mp3 保底）：原 resolveKuwoMasterChain 第三段起原样抽出，
// master 与 hires（[v1.6.1] 新增宿主档）两条链共享。
function resolveKuwoMasterTail(raw) {
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

// ==================== [v1.7.0] 第三方/备选竞速通道 ====================
// 任务清单 4 通道：nmobi 官方 / mobi 官方 / 屿溪 / 星海 kw。本模块实现：
//   - 通道 1/2（nmobi/mobi 官方）convert_url3 形态优先 → 沙箱实证 convert_url_with_sign 形态回落
//   - 通道 3（屿溪）/v1/music/resolve-url POST，body {source:'kw',rid,level}，状态 201，code:0
//   - 通道 4（星海 kw）/lx/api/?source=kw&... GET，X-Token+X-Client 鉴权
// 音质大小校验（硬性）：响应层 + Range 0-15 魔数/码率双重校验，由 verifyMediaSizeStrict 统一把关。
// 竞速：racePriority 错峰并发（0/80/180/300ms），首个通过 size 校验者胜出，全部失败 reject。

// 任务清单音质映射（convert_url3 / 屿溪 / 星海）：标准→128k、高品→320k、无损→flac(=2000kflac)
var KWC3_QUALITY = { standard: '128kmp3', high: '320kmp3', super: '2000kflac' };
var YUXI_LEVEL = { standard: '128k', high: 'exhigh', super: 'lossless' };
var XINGHAI_QUALITY = { standard: '128k', high: '320k', super: 'flac' };

// 通道 1/2 内部：任务清单 convert_url3 形态（from=kwplayerhd_9.5.4.2_kw.android / user=0 / quality=128kmp3|320kmp3|2000kflac）
// 沙箱实测全变体 404（http/https/±UA/±source/±br 均 404），自动回落同 host 的 convert_url_with_sign 实证形态。
// 优先级与请求哪个音质就获取哪个音质：quality 参数严格按用户请求档位（standard→128kmp3 / high→320kmp3 / super→2000kflac），
// 不可跨档；响应层校验 data.url 非空、data.code=200、bitrate/format 与请求档严格匹配（宁低勿高），失败抛错换下一通道。
function kwConvertUrl3Resolve(host, raw, quality, variant, signal) { // [v1.7.1 fix#4] +signal
  var br = KWC3_QUALITY[quality];
  if (!br) throw new Error('kw c3: 不支持档位 ' + quality);
  // 第一形态：任务清单 convert_url3
  var p1 = {
    type: 'convert_url3',
    from: 'kwplayerhd_9.5.4.2_kw.android',
    user: 0,
    rid: raw.rid,
    quality: br
  };
  // 第二形态：沙箱实证 convert_url_with_sign（天宝参数 nmobi/nmsublist / 车机 mobi 变体）
  var p2;
  if (variant === 'car') {
    p2 = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: raw.rid,
      user: 'C_APK_guanwang_' + Date.now(),
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC'
    };
  } else {
    p2 = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: raw.rid,
      user: 0, android_id: 0, prod: 'kwplayerhd_ar_4.3.0.8', corp: 'kuwo',
      vipver: '4.3.0.8', source: 'kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk',
      notrace: 0, sig: 0, priority: 'bitrate', loginUid: 0, network: 'WIFI',
      loginSid: 0, mode: 'down'
    };
  }
  return axios.get('https://' + host + '/mobi.s', {
    params: p1,
    timeout: SOURCE_TIMEOUT,
    signal: signal || undefined, // [v1.7.1 fix#4] 落选取消（axios 低版本忽略，无副作用）
    headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    // convert_url3 形态层校验：data.code=200 + data.url 非空 + bitrate/format 严格匹配
    if (!res.data || res.data.code !== 200 || !res.data.data || !res.data.data.url) {
      throw new Error('kw c3 形态无效');
    }
    var d = res.data.data;
    if (quality === 'super' && d.format && d.format !== 'flac') {
      throw new Error('kw c3 super 降级: ' + d.format);
    }
    if (quality === 'super' && d.bitrate && parseInt(d.bitrate, 10) < 2000) {
      throw new Error('kw c3 super bitrate 降级: ' + d.bitrate);
    }
    if (quality === 'high' && d.format && d.format !== 'mp3') {
      throw new Error('kw c3 high 降级: ' + d.format);
    }
    if (quality === 'high' && d.bitrate && parseInt(d.bitrate, 10) < 320) {
      throw new Error('kw c3 high bitrate 降级: ' + d.bitrate);
    }
    if (d.duration && d.duration > 0 && d.duration < 60) {
      throw new Error('kw c3 试听片段');
    }
    var aq = (d.format === 'flac')
      ? ((d.bitrate >= 2000) ? 'hires' : 'flac')
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    return { url: String(d.url), actualQuality: aq };
  }).catch(function (err) {
    // 沙箱实测 convert_url3 全变体 404 → 自动回落 convert_url_with_sign 实证形态（kwOfficialResolve）
    return kwOfficialResolve(host, raw, quality, variant, signal); // [v1.7.1 fix#4] 透传
  });
}

// 通道 3 屿溪：POST musicserver.haitangw.cc/v1/music/resolve-url
// body={source:'kw', rid, level}；状态 201，code:0，data.url 非空。
// 注：任务清单的 /api/resolve-url 形态沙箱实测 404「Cannot POST」，实际可用端点为 /v1/music/resolve-url，
// 与 v1.6.1 resolveHaitang 复用同一上游，本版本抽出独立 yuxiResolve 加严音质大小校验（resolveHaitang 是兜底，此处是主动竞速）。
function yuxiResolve(raw, quality, musicItem, signal) { // [v1.7.1 fix#4] +signal
  var level = YUXI_LEVEL[quality];
  if (!level) throw new Error('yuxi: 不支持档位 ' + quality);
  return axios.post('https://musicserver.haitangw.cc/v1/music/resolve-url', {
    source: 'kw', rid: String(raw.rid), level: level
  }, {
    timeout: RELAY_TIMEOUT,
    signal: signal || undefined, // [v1.7.1 fix#4] 落选取消
    headers: { 'Content-Type': 'application/json', Referer: 'https://musicserver.haitangw.cc/' }
  }).then(function (res) {
    // 响应层校验：状态由 axios 200/201 自动放过；body.code=0 + data.url 非空 + level 一致
    if (!res.data || res.data.code !== 0 || !res.data.data || !res.data.data.url) {
      throw new Error('yuxi 响应无效: ' + (res.data && res.data.message || 'no url'));
    }
    var url = String(res.data.data.url);
    if (!/^http/i.test(url)) throw new Error('yuxi url 非 http(s)');
    return { url: url, actualQuality: internalToHostQuality(quality) };
  });
}

// 通道 4 星海 kw：GET yy.zddyr.top/lx/api/?source=kw&...  X-Token + X-Client 鉴权
// 鉴权：token = base64({device_id, ip, timestamp, random})；ip 异步取一次 /ip.php 后缓存；
// 字段需求：musicItem.name/title / singer/artist / songmid=raw.rid / interval=musicItem.duration / albumName / quality
// 沙箱实测（2026-09-10）：rid=228908 128k/320k/flac 三档均 200/200/200，code:200，url 完整；
// 稻香 227587 flac 命中但返回 mp3 链接（M500003fjuRW4FcWEB.mp3）—— 上游虚标，由 verifyMediaSizeStrict 魔数校验拒收，行为正确。
var XINGHAI_DEVICE_ID = null;
var XINGHAI_IP = '0.0.0.0';
var XINGHAI_IP_FETCHED = false;
var XINGHAI_TOKEN_TS = 0;
var XINGHAI_TOKEN_TTL = 5 * 60 * 1000; // 5 分钟刷新
var XINGHAI_TOKEN = '';
function xinghaiRand(n) {
  var pool = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
  for (var i = 0; i < n; i++) s += pool.charAt(Math.floor(Math.random() * pool.length));
  return s;
}
function xinghaiBase64(s) {
  // [v1.7.1 fix#1] 去宿主 btoa 依赖：Hermes 引擎（React Native 默认 JS 引擎）没有
  // btoa，v1.7.0 在该环境下 xinghaiBase64 恒抛错返回 ''，星海通道 token 恒为空串、
  // 通道恒败。改为纯 JS UTF-8 + base64 编码，复用文件内既有 utf8Bytes()（同文件
  // DES 实现同款路径），不依赖任何宿主全局；输出与 btoa(unescape(encodeURIComponent(s)))
  // 标准带填充 base64 逐字节一致（单测已对拍）。
  try {
    var bytes = utf8Bytes(String(s));
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i];
      var b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
      var b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
      out += chars[b0 >> 2];
      if (b1 === undefined) {
        // 余 1 字节：2 个数据字符 + '=='
        out += chars[(b0 & 3) << 4];
        out += '==';
      } else if (b2 === undefined) {
        // 余 2 字节：3 个数据字符 + '='
        out += chars[((b0 & 3) << 4) | (b1 >> 4)];
        out += chars[(b1 & 15) << 2];
        out += '=';
      } else {
        out += chars[((b0 & 3) << 4) | (b1 >> 4)];
        out += chars[((b1 & 15) << 2) | (b2 >> 6)];
        out += chars[b2 & 63];
      }
    }
    return out;
  } catch (e) {
    return '';
  }
}
function xinghaiTokenFresh() {
  if (XINGHAI_TOKEN && (Date.now() - XINGHAI_TOKEN_TS) < XINGHAI_TOKEN_TTL) return XINGHAI_TOKEN;
  if (!XINGHAI_DEVICE_ID) {
    XINGHAI_DEVICE_ID = 'lx-online-' + xinghaiRand(6) + Date.now().toString(36).slice(-4);
  }
  var payload = {
    device_id: XINGHAI_DEVICE_ID,
    ip: XINGHAI_IP,
    timestamp: Math.floor(Date.now() / 1000),
    random: xinghaiRand(10)
  };
  XINGHAI_TOKEN = xinghaiBase64(JSON.stringify(payload));
  XINGHAI_TOKEN_TS = Date.now();
  return XINGHAI_TOKEN;
}
function xinghaiFetchIp() {
  // 异步取一次 IP 后缓存（不影响首次取链关键路径：取链发起后异步 fetch，token 用 0.0.0.0 也可工作，
  // 仅在 ip 已知后才有机会被 server 用于 trust 度提升；不阻塞取链）
  if (XINGHAI_IP_FETCHED) return Promise.resolve(XINGHAI_IP);
  XINGHAI_IP_FETCHED = true;
  return axios.get('https://yy.zddyr.top/ip.php', { timeout: 3000, headers: { 'User-Agent': 'lx-music' } })
    .then(function (r) { XINGHAI_IP = (r.data && r.data.ip) || XINGHAI_IP; })
    .catch(function () { /* 取 ip 失败不阻塞取链 */ });
}
// [v1.9.4 disabled since 2026-09-11] yy.zddyr.top/lx/api/ 实测 503「仅限授权用户使用」；
// 响应中推荐替代 zrcdy.dpdns.org/lx/ 实测：vers.php 是 HTML 插件下载中心、/lx/api/ 返 PHP warning
// （require 失败）——无可用替代端点，整体死亡。从竞速池移除，保留函数体便于未来恢复。
function xinghaiResolve(raw, quality, musicItem, signal) {
  return Promise.reject(new Error('xinghai disabled since 2026-09-11 (yy.zddyr.top 503)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function xinghaiResolve(raw, quality, musicItem, signal) { // [v1.7.1 fix#4] +signal
  var q = XINGHAI_QUALITY[quality];
  if (!q) throw new Error('xinghai: 不支持档位 ' + quality);
  var name = (musicItem && (musicItem.title || musicItem.name)) || '';
  var singer = (musicItem && (musicItem.artist || musicItem.singer)) || '';
  var interval = (musicItem && musicItem.duration) || '';
  var albumName = (musicItem && (musicItem.album || musicItem.albumName)) || '';
  var params = {
    source: 'kw', name: name, singer: singer, songmid: String(raw.rid),
    interval: String(interval), albumName: albumName, quality: q
  };
  var url = 'https://yy.zddyr.top/lx/api/?' + Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  xinghaiFetchIp();
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    signal: signal || undefined,
    headers: {
      'X-Token': xinghaiTokenFresh(),
      'X-Client': 'XingHaiMusicSource/v3.2.12 (Linux)',
      'User-Agent': 'lx-music'
    }
  }).then(function (res) {
    if (!res.data || res.data.code !== 200 || !res.data.url) {
      throw new Error('xinghai 响应无效: ' + (res.data && (res.data.msg || res.data.message) || 'no url'));
    }
    var u = String(res.data.url);
    if (!/^http/i.test(u)) throw new Error('xinghai url 非 http(s)');
    var aq = (quality === 'super') ? 'flac' : ((quality === 'high') ? '320k' : '128k');
    return { url: u, actualQuality: aq };
  });
}
*/

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

// 严格音质大小校验：与 guardFullAudio 区别——本通道要求严苛，任一环节失败即抛错。
// 流程：Range 0-15 探测响应 → Content-Range total>0 / Content-Length>0（不可为 0）→ 魔数识别 → 码率下限校验。
// declared = {actualQuality, musicItem (含 duration)}。
function verifyMediaSizeStrict(url, musicItem, declared, signal) { // [v1.7.1 fix#4] +signal
  var dec = declared || {};
  var aq = dec.actualQuality;
  var dur = (musicItem && parseInt(musicItem.duration, 10)) || 0;
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    signal: signal || undefined, // [v1.7.1 fix#4] 落选取消
    headers: { Range: 'bytes=0-15', 'User-Agent': 'okhttp/3.10.0' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    // 1) HTTP 状态：Range 探测通常 206；200/206/201 均视为通过
    var st = res.status;
    if (st !== 200 && st !== 201 && st !== 206) throw new Error('size verify: HTTP ' + st);
    // 2) Content-Length / Content-Range 不为 0（硬性要求）
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) total = parseInt(mm[1], 10) || 0;
    else if (st !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total === 0) throw new Error('size verify: Content-Length=0 或响应无 total');
    // 3) 魔数识别（明文无损档必须 fLaC；有损档仅在 duration 足够时校验码率下限）
    var u8 = null, buf = res.data;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = '';
    if (u8 && u8.length >= 4) {
      if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) magic = 'fLaC';
      else if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'ID3';
      else if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) magic = 'OggS';
      else if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) magic = 'mp3';
    }
    // 3a) 明文无损档（flac/hires/master/atmos 且无 ekey）必须 fLaC
    var LOSSLESS = { flac: 1, hires: 1, master: 1, atmos: 1 };
    if (LOSSLESS[aq] && !dec.ekey && magic && magic !== 'fLaC') {
      throw new Error('size verify: 无损档魔数不符 ' + magic + ' (declared ' + aq + ')');
    }
    // 3b) 试听片段守卫（按 size/duration 比）
    if (total > 0 && dur >= 60) {
      var est = total / 16000;
      if (est < dur * 0.6) throw new Error('size verify: 试听片段 ~' + Math.round(est) + 's/' + dur + 's');
    }
    // 3c) 有损档码率下限：128k→≥96k / 320k→≥256k（75% 容差，留 VBR/容器开销余量）
    if (total > 0 && dur >= 60 && aq) {
      var kbps = Math.round(total * 8 / dur / 1000);
      var floor = (aq === '320k') ? 240 : (aq === '192k') ? 144 : (aq === '128k') ? 96 : 0;
      if (floor > 0 && kbps > 0 && kbps < floor) {
        throw new Error('size verify: 码率降级 ~' + kbps + 'kbps < ' + aq);
      }
    }
  });
}

// ============ [v1.9.0] BakaMusic 高价值第三方通道 ============
// 来源：BakaMusic 音源研究实测（2026-09-10 复测通过）。
// 统一接入模式：独立取链函数 + verifyMediaSizeStrict 严格校验 + userVariables 开关（默认开）。
// 校验失败的通道静默拒绝（抛错即被 racePriority 落选），不影响其他通道。

// 通道开关：userVariables 值为 'off' 时关闭对应通道（默认开启）。
function kuwoBakaChannelEnabled(key) {
  try {
    var env = (typeof global !== 'undefined' && global.env) ? global.env : null;
    var uv = (env && typeof env.getUserVariables === 'function') ? (env.getUserVariables() || {}) : {};
    return String(uv[key] || '').toLowerCase() !== 'off';
  } catch (e) { return true; }
}

// P0 次合代 kw 通道（来源：BakaMusic/次合代聚合音源）：直出 URL 型端点，
// kw.php?id=<rid>&level=<standard|exhigh|lossless>&type=mp3，实测：
//   lossless → fLaC 55397039B(~1647kbps) 699ms / exhigh → mp3 10792943B 557ms / standard → mp3 4317292B 487ms。
// 端点本身直接服务音频流（响应即 audio，非 JSON 中转），axios 侧无需解析响应体；
// 返回的 URL 即请求 URL，真伪交给 verifyMediaSizeStrict（Range 魔数/码率）判定。
// 音质映射（宁低勿高）：standard→128k / exhigh→320k / lossless→flac。
function kwCihedaiResolve(raw, quality, signal) {
  var level = (quality === 'super') ? 'lossless' : (quality === 'high' ? 'exhigh' : 'standard');
  var url = 'http://music.nxinxz.com/kw.php?id=' + encodeURIComponent(String(raw.rid)) + '&level=' + level + '&type=mp3';
  var aq = (quality === 'super') ? 'flac' : (quality === 'high' ? '320k' : '128k');
  return Promise.resolve({ url: url, actualQuality: aq });
}

// P0 ikun kw 通道（来源：BakaMusic/ikun 音源，酷我通道实测真无损）：
// POST https://c.wwwweb.top/music/url {source:'kw', musicId, quality}，header X-API-Key 空串即可用。
// 注意：ikun 对酷狗/QQ 无卡密返回 10 秒占位 mp3（假成功链），酷我/网易云通道实测真实——
// 故只接酷我/网易云两平台；返回 audio/* 直链由 verifyMediaSizeStrict 复核（fLaC 魔数 + 码率下限），
// 占位 mp3 会被 lossless 档 fLaC 校验拒收。actualQuality 以响应 d.quality 为准（响应未带则按请求档）。
var IKUN_KW_QUALITY = { standard: '128k', high: '320k', super: 'flac' };
var IKUN_KW_AQ = { '128k': '128k', '320k': '320k', flac: 'flac' };
function kwIkunResolve(raw, quality, signal) {
  var q = IKUN_KW_QUALITY[quality];
  if (!q) return Promise.reject(new Error('ikun kw: 不支持档位 ' + quality));
  return axios.post('https://c.wwwweb.top/music/url',
    { source: 'kw', musicId: String(raw.rid), quality: q },
    {
      timeout: RELAY_TIMEOUT, signal: signal || undefined,
      headers: { 'X-API-Key': '', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var d = res.data || {};
      var url = d.url && String(d.url);
      if (d.code !== 200 || !url || !/^https?:\/\//i.test(url)) throw new Error('ikun kw 无有效 url (code ' + d.code + ')');
      return { url: url, actualQuality: IKUN_KW_AQ[d.quality] || IKUN_KW_AQ[q] };
    });
}

// P1 全豆要 kw 通道（来源：BakaMusic/全豆要）：酷我官方 mobi.s convert_url_with_sign 直连，
// 实测 121ms 极快、flac bitrate2000 与既有 nmobi 通道返回同一文件（同上游）。
// 复核结论：与竞速池 lane#1（kwConvertUrl3Resolve nmobi convert_url3 形态）同上游，不再重复建道；
// 这里作为 nmobi 快速失败时的第三形态兜底（convert_url_with_sign 签名形态），不单独占竞速道。
// 网易云通道不接：BakaMusic 实测其 wy 仅 128k，宣称 MasterAtmos 属虚标（宁低勿高原则）。
function kwQdyFallback(raw, quality, signal) {
  var br = KWC3_QUALITY[quality];
  if (!br) return Promise.reject(new Error('qdy: 不支持档位 ' + quality));
  return axios.get('https://nmobi.kuwo.cn/mobi.s', {
    params: {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: raw.rid,
      user: Math.floor(Math.random() * 4294967295), loginUid: Math.floor(Math.random() * 4294967295),
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk'
    },
    timeout: RELAY_TIMEOUT, signal: signal || undefined, headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    if (!res.data || res.data.code !== 200 || !res.data.data || !res.data.data.url) throw new Error('qdy 响应无效');
    var d = res.data.data;
    if (quality === 'super' && d.format && d.format !== 'flac') throw new Error('qdy super 降级: ' + d.format);
    if (quality === 'high' && d.format && d.format !== 'mp3') throw new Error('qdy high 降级: ' + d.format);
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('qdy 试听片段');
    var brNum = parseInt(d.bitrate, 10) || 0;
    var aq = (d.format === 'flac') ? (brNum >= 2000 ? 'hires' : 'flac')
      : (brNum >= 320 ? '320k' : (brNum >= 192 ? '192k' : '128k'));
    return { url: String(d.url), actualQuality: aq };
  });
}

// 优先级错峰并发：builds = [{delay, build}]，delay 错峰启动；首个 resolve 胜出。
// [v1.7.1 fix#3] 胜出（或全部失败）即封盘：清除未触发的错峰定时器，此后任何通道的
// resolve/reject 不再生效（v1.7.0 落选通道的结果仍会进入 then 链被重复结算）。
// [v1.7.1 fix#4] AbortController 支持：宿主环境存在 AbortController 时为每个通道创建
// signal 并传给 build(signal)（build 声明形参才传，length>=1 判定，既有无参 build 调用点
// 向后兼容）；胜出后 abort 落选通道的在途 HTTP 请求——axios>=0.22 消费 signal 真取消，
// 低版本 axios 忽略未知配置项，无副作用。任务口径：非阻塞增强，无 AbortController 环境自动退化为 v1.7.0 行为。
function racePriority(builds) {
  return new Promise(function (resolve, reject) {
    var pending = builds.length, failed = 0;
    if (!pending) { reject(new Error('racePriority: 无候选')); return; }
    var settled = false;
    var timers = [];
    var controllers = [];
    function settle(fn, val) {
      if (settled) return;
      settled = true;
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      for (var j = 0; j < controllers.length; j++) {
        try { if (controllers[j] && typeof controllers[j].abort === 'function') controllers[j].abort(); } catch (e) { /* 忽略 */ }
      }
      fn(val);
    }
    builds.forEach(function (b) {
      var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
      if (ctrl) controllers.push(ctrl);
      var buildFn = b.build;
      if (ctrl && typeof buildFn === 'function' && buildFn.length >= 1) {
        var orig = buildFn;
        buildFn = function () { return orig(ctrl.signal); };
      }
      timers.push(setTimeout(function () {
        Promise.resolve().then(buildFn).then(function (v) {
          settle(resolve, v);
        }, function () {
          failed++;
          if (failed === pending) settle(reject, new Error('racePriority: 全部候选失败'));
        });
      }, b.delay));
    });
  });
}

// 4 通道竞速包装：每个通道先做响应层校验，再做 verifyMediaSizeStrict 严格音质大小校验，
// 通过则 resolve {url, actualQuality}，任一失败抛错换下一通道。
// [v1.7.1 fix#2 nmobi/mobi 双发] 错峰 0/80/180/300 → 0/250/400/550：nmobi 与 mobi 同为
// kuwo.cn host、同一 rid，实测 nmobi 首胜 ~176ms，mobi@80ms 几乎必然形成同 host 双发、
// 流量翻倍；拉开到 250ms 后常规情形 nmobi 胜出时 mobi 定时器已被 fix#3 封盘清除，不再
// 多发。代价：nmobi 快速失败的最坏情形下整体延迟 +~170ms（0→250ms 才启动下一路），
// 由 fix#4 胜出 abort 部分对冲；屿溪/星海为不同 host 的第三方通道，错峰仅控制并发压力。
// [v1.7.1 fix#4] 各通道透传 racePriority 下发的 AbortSignal，胜出后在途请求被取消。
function raceNewChannels(raw, quality, musicItem) {
  return racePriority([
    {
      delay: 0,
      build: function (signal) {
        // [v1.9.0] nmobi（convert_url3 形态）失败时接续全豆要兜底（convert_url_with_sign
        // 签名形态，同上游但独立请求形态），两形态合并为一路竞速，失败不占额外错峰位。
        return kwConvertUrl3Resolve('nmobi.kuwo.cn', raw, quality, undefined, signal)
          .then(function (r) {
            return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
              .then(function () { return r; });
          })
          .catch(function () {
            return kwQdyFallback(raw, quality, signal).then(function (r) {
              return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
                .then(function () { return r; });
            });
          });
      }
    },
    {
      delay: 250,
      build: function (signal) {
        return kwConvertUrl3Resolve('mobi.kuwo.cn', raw, quality, 'car', signal).then(function (r) {
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
            .then(function () { return r; });
        });
      }
    },
    {
      delay: 400,
      build: function (signal) {
        return yuxiResolve(raw, quality, musicItem, signal).then(function (r) {
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
            .then(function () { return r; });
        });
      }
    },
    /* [v1.9.4 disabled since 2026-09-11] 星海 yy.zddyr.top 503 死亡，竞速池移除
    {
      delay: 550,
      build: function (signal) {
        return xinghaiResolve(raw, quality, musicItem, signal).then(function (r) {
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
            .then(function () { return r; });
        });
      }
    },
    */
    // [v1.9.0 P0] 次合代 kw 通道（错峰 700ms，第三方直出 URL 型，开关默认开）
    {
      delay: 700,
      build: function (signal) {
        if (!kuwoBakaChannelEnabled('kwCihedai')) return Promise.reject(new Error('kwCihedai 已关闭'));
        return kwCihedaiResolve(raw, quality, signal).then(function (r) {
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
            .then(function () { return r; });
        });
      }
    },
    // [v1.9.0 P0] ikun kw 通道（错峰 850ms，POST JSON API，开关默认开；占位假链由 fLaC/码率校验过滤）
    {
      delay: 850,
      build: function (signal) {
        if (!kuwoBakaChannelEnabled('kwIkun')) return Promise.reject(new Error('kwIkun 已关闭'));
        return kwIkunResolve(raw, quality, signal).then(function (r) {
          return verifyMediaSizeStrict(r.url, musicItem, { actualQuality: r.actualQuality }, signal)
            .then(function () { return r; });
        });
      }
    }
  ]);
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
  if (quality === 'master') {
    return resolveKuwoMasterChain(raw, quality);
  }
  if (quality === 'hires') {
    // [v1.6.1 P1] hires 独立成档（此前与 master 共用母带链、且 supportedQualities 未声明）：
    // 官方 20201kmflac（24bit 加密无损，未登录实测打通）优先 → 20900kmflac 母带 →
    // 母带尾链（海棠 master → DES hires → 海棠 lossless/standard）。actualQuality 随
    // 实际命中档如实标注（hires/master）。
    return kwQmcRace(raw, '20201kmflac', 'hires')
      .catch(function () { return kwQmcRace(raw, '20900kmflac', 'master'); })
      .catch(function () { return resolveKuwoMasterTail(raw); });
  }
  if (quality === 'atmos') {
    // [v1.4.2] 官方 20501kmflac 至臻全景声升为首选（未登录双域名实测 fLaC 打通），
    // 未命中回落海棠 atmos（fLaC 魔数校验）→ 母带链。actualQuality 'atmos' 如实标注。
    // [v1.6.1] 升级 kwQmcRace 三路竞速（+HD 形态）。
    return kwQmcRace(raw, '20501kmflac', 'atmos').catch(function () {
      return resolveHaitang('kw', raw.rid, 'atmos')
        .then(function (r) {
          return probeMediaMagic(r.url).then(function (magic) {
            if (magic === 'fLaC') return r;
            throw new Error('haitang atmos not flac: ' + (magic || 'empty'));
          });
        });
    }).catch(function () {
      // 该歌全景声无货（实测与 master 同为部分 VIP 歌有货模式）→ 回落母带链
      return resolveKuwoMasterChain(raw, quality);
    });
  }
  var racers = [
    kwOfficialResolve('nmobi.kuwo.cn', raw, quality),
    kwOfficialResolve('nmsublist.kuwo.cn', raw, quality),
    kwOfficialResolve('mobi.kuwo.cn', raw, quality, 'car'),
    kuwoDesResolve(raw, quality),
    kuwoDesResolve(raw, quality, 'car'),
    // [v1.6.1 P1 提速] HD 形态第六路（HotDownloader 原样，均值 67ms 最快；minBr 按档取下限）
    kwHdResolve(raw, KUWO_BR[quality] || KUWO_BR.standard, '', quality === 'high' ? 320 : (quality === 'super' ? 2000 : 0))
  ];
  if (quality === 'standard' || quality === 'low') racers.push(kwAntiserverResolve(raw, musicItem));
  // [v1.7.0 P0] 第三方/备选竞速通道（nmobi 官方 → mobi 官方 → 屿溪 → 星海 kw，错峰并发 + 严格音质大小校验）
  if (quality === 'standard' || quality === 'high' || quality === 'super') {
    racers.push(raceNewChannels(raw, quality, musicItem));
  }
  // [v1.4.2] super 档官方高音质全档阶梯：20201 之上的官方档未登录实测全部打通
  // （晴天 rid=228908：20900kmflac 母带 / 20501kmflac 全景声均 mflac+972 字符 ekey，
  // 全链解出 fLaC，两档 512B 密钥互不相同；jymaster 未登录空 ekey 不接入）。
  // 逐档回落：母带 → 全景声 → 24bit（各档双域名竞速，档间 catch 串接，无货/空 ekey
  // 被 kwQmcResolve 拒收后无损降级）→ 原 2000kflac 明文竞速池 → 海棠兜底。
  // actualQuality 按命中档如实标注（master/atmos/hires 经 internalToHostQuality 透传宿主）。
  if (quality === 'super') {
    // [v1.6.1] qmcRace 升级为模块级 kwQmcRace 三路竞速（官方双域名 + HD 形态）
    return kwQmcRace(raw, '20900kmflac', 'master')
      .catch(function () { return kwQmcRace(raw, '20501kmflac', 'atmos'); })
      .catch(function () { return kwQmcRace(raw, '20201kmflac', 'hires'); })
      .catch(function () { return raceSuccess(racers); })
      .catch(function () { return resolveHaitang('kw', raw.rid, quality); })
      // [v1.9.15 P0-1 吸收] 海棠 kw.php 直连兜底（super→lossless，守卫 fLaC 魔数 fail-closed）
      .catch(function () { return kwHaitangPhpResolve(raw, quality, musicItem); });
  }
  var raced = raceSuccess(racers);
  // 海棠 kw 兜底（[v1.2.1 fix②] 全音质兜底，用户确认方向：不再限高品/无损档，
  // standard/low 竞速全挂也走海棠 standard→128k；kw lossless 真 FLAC 沙箱 fLaC 复核）
  // [v1.9.15 P0/P1 吸收] 海棠 resolve-url 兜底之后追加三通道（全部末位兜底，不改变主链优先级）：
  // kw.php 直连（全档）→ nxinxz（standard/low/high）→ antiserver 320k（仅 high）；
  // actualQuality 如实声明，外层 resolveWithFallback 守卫 fail-closed，不符即整体失败如实上抛
  return raced.catch(function () { return resolveHaitang('kw', raw.rid, quality || 'standard'); })
    .catch(function () { return kwHaitangPhpResolve(raw, quality || 'standard', musicItem); })
    .catch(function () { return kwNxinxzResolve(raw, quality || 'standard', musicItem); })
    .catch(function () { return kwAntiserverHighResolve(raw, quality, musicItem); });
}

// 海棠 resolve-url 公共封装（用户已确认接受第三方备源）：
// source: 'tx'(QQ) / 'kg'(酷狗) / 'kw'(酷我) / 'wy'(网易云) / 'mg'(咪咕，线路存在但上游波动)
// level 映射（文档实测）：standard/exhigh/lossless/hires/master
//（v0.7.0 文档曾记 master/flac24bit 降级 128k；[v1.2.2] kw master 实测复核：VIP 真 24bit FLAC，
//  flac24bit 上游不支持返回 UPSTREAM_RESOLVE_FAILED，kw 'hires' 档实测虚标只回 128kmp3）
// 文档实测：kg 必须 hash 全大写；QQ/酷狗 VIP 返回真 FLAC（酷狗 lossless 30.2MB / hires 24bit 52.8MB）
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
var QUALITY_KEY_MAP = {
  '96k': 'standard', '128k': 'standard',
  '192k': 'high', '320k': 'high',
  'flac': 'super', 'flac24bit': 'super',
  'hires': 'hires', 'master': 'master', // [v1.2.3] master 升独立内部档（海棠 kw master 真 24bit 母带）
  'atmos': 'atmos', 'atmos_plus': 'atmos', 'dolby': 'atmos', // [v1.2.3] 至臻全景声独立档
  'vinyl': 'master'
};
function normalizeQuality(q) {
  var s = String(q || '');
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'standard' || s === 'high' || s === 'super' || s === 'hires' || s === 'master' || s === 'atmos') return s;
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
  if (q === 'master') return 'master'; // [v1.2.3] 海棠 kw master 命中时是真 24bit 母带 FLAC，独立标注（回落链各段各自返回真实档）
  if (q === 'atmos') return 'atmos'; // [v1.2.3] 海棠 kw atmos 命中时是真至臻全景声，独立标注
  return '128k'; // standard / low / 未知
}

// [v1.4.3] 各音质文件大小解析（对齐 baka 酷我 parseKuwoQualityInfo）：输入 N_MINFO/MINFO
// 形如 "level:zply,bitrate:20900,format:mflac,size:178.32Mb;..."（分号串）。bitrate→宿主
// 音质键（internalToHostQuality 同族口径）；format 白名单 mp3/flac/mflac——ogg/aac/mgg/zp
// 非本插件交付格式，跳过不造值。同键多条后者覆盖（baka switch 同语义）。
function parseKuwoQualityInfo(infoStr) {
  var out = {};
  var segs = String(infoStr || '').split(';');
  var regExp = /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/;
  for (var i = 0; i < segs.length; i++) {
    var m = segs[i].match(regExp);
    if (!m) continue;
    var br = parseInt(m[2], 10), fmt = m[3];
    if (fmt !== 'mp3' && fmt !== 'flac' && fmt !== 'mflac') continue;
    var key = '';
    if (br === 128) key = '128k';
    else if (br === 192) key = '192k';
    else if (br === 320) key = '320k';
    else if (br === 2000) key = 'flac';
    else if (br === 4000 || br === 20201) key = 'hires';
    else if (br === 20501) key = 'atmos';
    else if (br === 20900) key = 'master';
    else continue;
    out[key] = { size: String(m[4]).toUpperCase(), bitrate: br, format: fmt };
  }
  return out;
}

// [v1.4.3] musicpay 免登录详情（文档 §6.1）：按 rid 精确取 MINFO（含各明文档 size），
// 文档钦定用途即"补全列表源歌曲缺失的音质大小信息"。实测 200 errorcode=0。
// 注意：musicpay 的 MINFO 只有明文档（flac/mp3/ogg/aac），加密档（20900/20501/20201）
// 大小只在 r.s N_MINFO——两路互补。失败返回 ''（大小可选，宁缺毋假）。
function kwMusicpayMinfo(rid) {
  return axios.get('https://musicpay.kuwo.cn/music.pay', {
    params: { src: 'kwplayer_ar_11.3.0.0_40.apk', op: 'query', action: 'play', ids: String(rid || '') },
    timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': 'okhttp/3.10.0' }
  }).then(function (res) {
    var s = (res.data && res.data.songs && res.data.songs[0]) || {};
    return str(s.MINFO || s.minfo || '');
  }).catch(function () { return ''; });
}

// [v1.9.5] 列表页音质补齐：N_MINFO 缺失的条目（wapi 专辑等入口不返回该字段，实测专辑页
// qualities 全空）按 rid 批量查 musicpay MINFO（ids 支持逗号分隔，实测一次返回多条），
// 解析后只补缺失条目；已有 qualities 的条目跳过（零额外请求，搜索/歌单/榜单等已覆盖入口不受影响）。
async function enrichKuwoQualities(musicList, cap) {
  var need = [];
  for (var i = 0; i < (musicList || []).length; i++) {
    var it = musicList[i];
    if (!it || it.qualities) continue;
    var rw = it._src && it._src.kuwo;
    var rid = rw && rw.rid ? String(rw.rid) : '';
    if (rid) need.push({ idx: i, rid: rid });
    if (need.length >= (cap || 30)) break;
  }
  if (!need.length) return;
  var CHUNK = 30;
  for (var c = 0; c < need.length; c += CHUNK) {
    var batch = need.slice(c, c + CHUNK);
    try {
      var res = await axios.get('https://musicpay.kuwo.cn/music.pay', {
        params: { src: 'kwplayer_ar_11.3.0.0_40.apk', op: 'query', action: 'play', ids: batch.map(function (x) { return x.rid; }).join(',') },
        timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': 'okhttp/3.10.0' }
      });
      var songs = (res.data && res.data.songs) || [];
      for (var b = 0; b < batch.length; b++) {
        var song = null;
        for (var sb = 0; sb < songs.length; sb++) {
          if (str(songs[sb].id) === batch[b].rid || str(songs[sb].rid) === batch[b].rid) { song = songs[sb]; break; }
        }
        if (!song) continue;
        var q = parseKuwoQualityInfo(str(song.MINFO || song.minfo || ''));
        if (Object.keys(q).length) musicList[batch[b].idx].qualities = q;
      }
    } catch (e) { /* 音质大小可选，批量失败静默 */ }
  }
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

var RESOLVE_ADAPTERS = {
  kuwo: resolveKuwo
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
// https 一律放行；http 仅放行已知平台 CDN 域名后缀，
// http 且域名不在白名单（含裸 IP、被劫持改写的陌生域）一律拒绝，视为该源失败继续接力。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.kuwo\.cn$/i,          // 酷我 CDN
  /^175\.27\.166\.236$/i   // [v1.2.2] 海棠 kw master 流式端点（http 裸 IP:8928，kwstream stream=1，
                           // URL 稳定非一次性签名；与聚合插件听会通道同一 IP，2026-09-06 探针复核）
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
    var segTimeout = idx === 0 ? SOURCE_TIMEOUT : RELAY_TIMEOUT;
    if (segTimeout > remain) segTimeout = remain;
    return withTimeout(adapter(srcMap[source], quality, musicItem), segTimeout, source + ' 取链超时 ' + segTimeout + 'ms').then(function (r) {
      // v0.7.1 P1-5：返回 URL 协议/域名白名单校验，不通过视为该源失败、继续接力
      if (!isAllowedMediaUrl(r && r.url)) {
        throw new Error(source + ' 返回 URL 未通过协议/域名校验');
      }
      // 兜底守卫：适配器漏判的试听片段在这里被内容探测拦下并继续接力
      // （守卫按 content-length/Range 校验大小与标称时长一致性，明显不符即丢弃）
      // [v1.6.1 P0] 守卫升级：传入解析结果（声明档 actualQuality + ekey 加密态），
      // 追加文件魔数（明文无损必须 fLaC）与实际码率（有损档 < 声明 75% 拒收）校验
      var guardBudget = deadline - Date.now();
      if (guardBudget <= 500) throw new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(guardFullAudio(r.url, musicItem, r), guardBudget, 'guard 超时').then(function () { return r; });
    }).catch(function () {
      return attempt(idx + 1);
    });
  };
  return attempt(0);
}

/**
 * 试听片段兜底守卫 + [v1.6.1 P0] 档位真实性守卫（HotDownloader 借鉴：文件级校验而非仅信响应字段）。
 * Range bytes=0-15 单请求（≈25ms，不拖慢取链主路径）同时取：
 *  - 文件魔数（fLaC/ID3/OggS/裸 MP3 sync word）
 *  - Content-Range 总长
 * 校验规则（按 declared.actualQuality 声明档 + declared.ekey 加密态分派）：
 *  1) 明文无损（flac/hires/master/atmos 且无 ekey）：魔数必须 fLaC——ID3/OggS/裸 MP3 均为
 *     静默降级产物，拒收（guard: 前缀上抛 → resolveWithFallback 继续下一源接力）；
 *  2) 有损档（128k/192k/320k）：按 Content-Range 总长/标称时长反推实际码率，
 *     < 声明档 75% 拒收（如 320k 实得 128k）——时长缺失/无总长时跳过该项；
 *  3) 加密档（带 ekey）：载荷为 QMC 加密流无法验魔数，档位真实性由解析器内响应
 *     bitrate/format 严格校验保证（v1.6.1 P0-a/b），此处仅保留试听片段守卫；
 *  4) 探测请求自身失败（403/超时/Range 不支持）不惩罚源，放行由播放器处理（宁缺毋假、不误杀）。
 *  5) 试听片段守卫（原有）：估算时长 < 标称 60% 判片段。
 * 关键修复：kw-er/car-er CDN 对无 UA 请求一律 403（沙箱实测），原守卫不带 UA → 官方直链
 * 探测一直空转；现带 okhttp UA（实测 206 + fLaC 魔数返回）。
 */
function guardFullAudio(url, musicItem, declared) {
  var dec = declared || {};
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Range: 'bytes=0-15', 'User-Agent': 'okhttp/3.10.0' },
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
    // [v1.6.1 P0] 魔数识别（与 probeMediaMagic 同族逻辑，8 字节足够）
    var u8 = null;
    var buf = res.data;
    if (buf instanceof Uint8Array) u8 = buf;
    else if (buf && buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, Math.min(buf.byteLength || 0, 16));
    else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
    var magic = '';
    if (u8 && u8.length >= 4) {
      if (u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43) magic = 'fLaC';
      else if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) magic = 'ID3';
      else if (u8[0] === 0x4f && u8[1] === 0x67 && u8[2] === 0x67 && u8[3] === 0x53) magic = 'OggS';
      else if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) magic = 'mp3';
    }
    // [v1.6.1 P0] 规则 1：明文无损必须 fLaC。空魔数（探测失败/0 字节）不在此拒——走规则 4 放行。
    var LOSSLESS = { flac: 1, hires: 1, master: 1, atmos: 1 };
    if (LOSSLESS[dec.actualQuality] && !dec.ekey && magic && magic !== 'fLaC') {
      throw new Error('guard: lossless degraded to ' + magic + ' (declared ' + dec.actualQuality + ')');
    }
    var dur = musicItem && parseInt(musicItem.duration, 10) || 0;
    // [v1.6.1 P0] 规则 2：有损档实际码率下限（总长×8/标称时长；75% 容差留 VBR/容器开销余量）
    if (total > 0 && dur >= 60 && dec.actualQuality) {
      var kbps = Math.round(total * 8 / dur / 1000);
      var floorMap = { '320k': 240, '192k': 144, '128k': 96 };
      var floor = floorMap[dec.actualQuality];
      if (floor && kbps > 0 && kbps < floor) {
        throw new Error('guard: bitrate degraded ~' + kbps + 'kbps < ' + dec.actualQuality);
      }
    }
    if (total > 0 && dur >= 60) {
      var est = total / 16000; // 128000bps / 8bit
      if (est < dur * 0.6) {
        throw new Error('guard: trial clip ~' + Math.round(est) + 's/' + dur + 's');
      }
    }
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // 探测请求本身失败：不拦，放行
  });
}

// [v1.2.2] 轻量魔数探测：Range 取前 16 字节识别音频格式（兼容 Buffer / ArrayBuffer 载体）。
// 用于海棠 kw master 流式端点——免费歌该端点 code=0 但内容是 400 JSON（非音频），
// 必须在把链接交给宿主前验证。返回 'fLaC'/'ID3'/'OggS'/'mp3'/' 未识别时返回 ''。
function probeMediaMagic(url) {
  return axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    // [v1.6.1] 补 UA：kw-er/car-er CDN 对无 UA 请求一律 403（沙箱实测），不带 UA 探测恒空
    headers: { Range: 'bytes=0-15', 'User-Agent': 'okhttp/3.10.0' },
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

// ==================== 歌词适配 ====================
// 端点均经 2026-09-05 探针实测（artifacts/lyric-probe/probe-result.json），无猜测 URL。
// 酷我：openapi getlyric 返回秒制时间行数组（文档 7.1 推荐路径），转 LRC 时间轴。
//
// v0.7.0：接力链优化（P1-5）——歌词单源超时压到 3s（LYRIC_TIMEOUT），原生源优先、
// 最多接力 3 源（原生 + 2 备源），最坏 ~9s，避免顶到 10s 沙箱上限。
var LYRIC_TIMEOUT = 3000;

function secToLrcTime(sec) {
  var s = Number(sec) || 0;
  var m = Math.floor(s / 60);
  var r = s - m * 60;
  var ss = Math.floor(r);
  var cs = Math.round((r - ss) * 100);
  if (cs >= 100) { cs = 0; ss += 1; }
  return (m < 10 ? '0' + m : '' + m) + ':' + (ss < 10 ? '0' + ss : '' + ss) + '.' + (cs < 10 ? '0' + cs : '' + cs);
}

var LYRIC_ADAPTERS = {
  kuwo: async function (raw) {
    if (!raw || !raw.rid) throw new Error('kuwo no rid');
    try {
      var r = await axios.get('https://www.kuwo.cn/openapi/v1/www/lyric/getlyric', {
        params: { musicId: raw.rid, httpsStatus: 1, plat: 'web_www', from: '' },
        timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      var lines = r.data && r.data.data && r.data.data.lrclist;
      if (!lines || !lines.length) throw new Error('kuwo no lrclist');
      var lrcLines = [];
      for (var i = 0; i < lines.length; i++) {
        lrcLines.push('[' + secToLrcTime(lines[i].time) + ']' + String(lines[i].lineLyric || ''));
      }
      return { rawLrc: lrcLines.join('\n') };
    } catch (e) {
      // [v1.1.0 第三部分] 歌词兜底通道：m.kuwo.cn songinfoandlrc（本沙箱实测 2026-09-06 可用，
      // rid=228908 返回 63 行 lrclist，lineLyric/time 字段与 getlyric 同构）
      var r2 = await axios.get('https://m.kuwo.cn/newh5/singles/songinfoandlrc', {
        params: { musicId: raw.rid, httpsStatus: 1 },
        timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://m.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
      });
      var lines2 = r2.data && r2.data.data && r2.data.data.lrclist;
      if (!lines2 || !lines2.length) throw new Error('kuwo no lrclist (both channels)');
      var out2 = [];
      for (var j = 0; j < lines2.length; j++) {
        out2.push('[' + secToLrcTime(lines2[j].time) + ']' + String(lines2[j].lineLyric || ''));
      }
      return { rawLrc: out2.join('\n') };
    }
  }
};

// 歌词源尝试顺序（v0.7.0 优化，P1-5）：条目原生源优先（命中率高且省一次跨源请求），
// 其余按直链稳定性排序；最多尝试 3 源（LYRIC_TIMEOUT=3s × 3 ≈ 9s < 10s 上限）
var LYRIC_SOURCE_ORDER = ['kuwo'];

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
  var maxAttempts = 3; // [v1.1.0 fix O-4] 单源下实际最多尝试 1 次；保留结构以兼容未来多源扩展
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

// ==================== [v1.2.6] 歌词搜索 ====================
// 宿主歌词关联面板（searchLrc）调 search(q, page, 'lyric')，期望 ILrcItem[] =
// IMusicItem 字段 + rawLrcTxt（纯文本歌词预览）。策略：
// ① 复用 music 主路径（searchKuwo → aggregateItems → 评分排序 → buildMusicItem），
//    保证与单曲搜索同口径（_src 保留，选中后 getLyric 链路直接可用）；
// ② 酷我搜索响应实测无歌词片段字段（2026-09-07 keys 复核），预览文本只对前
//    LYRIC_PREVIEW_LIMIT 条并发拉歌词接口截取，其余条目 rawLrcTxt 置空串、
//    选中后宿主走 getLyric 取完整歌词——不在搜索关键路径全量拉词。
var LYRIC_PREVIEW_LIMIT = 8;
var LYRIC_PREVIEW_CONCURRENCY = 4;
var LYRIC_PREVIEW_CHARS = 480;

// 取单条歌词预览：复用 LYRIC_ADAPTERS.kuwo 双通道（openapi getlyric → songinfoandlrc），
// 失败返回空串（不拖垮整页结果）
function kuwoLyricPreview(rid) {
  if (!rid) return Promise.resolve('');
  return LYRIC_ADAPTERS.kuwo({ rid: rid }).then(function (r) {
    var txt = String((r && r.rawLrc) || '');
    return txt.length > LYRIC_PREVIEW_CHARS ? txt.slice(0, LYRIC_PREVIEW_CHARS) + '…' : txt;
  }).catch(function () { return ''; });
}

async function lyricSearchImpl(q, page) {
  var items = await searchKuwo(q, page).catch(function () { return []; });
  if (!items.length) throw new Error('歌词搜索失败：酷我搜索请求均失败');
  var groups = aggregateItems(items);
  var scored = groups.map(function (g, idx) {
    return { g: g, score: scoreOf(g.members[0], g.members.length), idx: idx };
  });
  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  var data = [];
  for (var i = 0; i < scored.length; i++) {
    data.push(buildMusicItem(scored[i].g));
  }
  // 填 rawLrcTxt 预览：前 LYRIC_PREVIEW_LIMIT 条分批并发，其余置空串（协议字段存在）
  var limit = Math.min(data.length, LYRIC_PREVIEW_LIMIT);
  for (var s = 0; s < limit; s += LYRIC_PREVIEW_CONCURRENCY) {
    var batch = [];
    for (var b0 = s; b0 < Math.min(s + LYRIC_PREVIEW_CONCURRENCY, limit); b0++) batch.push(b0);
    var previews = await Promise.all(batch.map(function (bi) {
      var src = (data[bi]._src && data[bi]._src.kuwo) || {};
      return kuwoLyricPreview(src.rid);
    }));
    for (var b1 = 0; b1 < batch.length; b1++) data[batch[b1]].rawLrcTxt = previews[b1] || '';
  }
  for (var r0 = limit; r0 < data.length; r0++) data[r0].rawLrcTxt = '';
  return { isEnd: items.length < 20, data: data }; // isEnd 与 music 主路径同口径
}

// ==================== 插件定义 ====================

var plugin = {
  name: '酷我音乐',
  platform: 'kuwo',
  version: '1.9.15', // [v1.9.15 v1.9.15 接口吸收版（承接「23 个音乐插件可吸收取链接口」调研，实测存活口径 2026-09-25）：本源新增三条兜底通道，全部挂在既有海棠 resolve-url 兜底之后（不改变主链优先级）：① 海棠 kw.php 直连（musicapi.haitangw.net/music/kw.php，302/JSON 双形态，standard→128k/high→320k/super→lossless，探针实测 lossless 302→car-er.kuwo.cn 官方 fLaC 55.4MB）；② nxinxz 补充档位（music.nxinxz.com/kw.php，仅 standard/low/high，探针实测 320k ID3 mp3 10.79MB）；③ antiserver 320k 备选（anti.s convert_url，仅 high 档链尾，返回档位不稳定由守卫按 320k 声明码率下限 fail-closed）。三通道 actualQuality 如实声明，外层 resolveWithFallback 守卫（无损魔数/码率下限）不过即拒收接力；详见头部 changelog；；v1.9.14 包升版（网易源集成长青 SVIP 网易替补通道 yinyue.haitangw.net，本源无代码改动，随包升版）；v1.9.13 包升版（QQ 源 a.aa.cab 通道方案A 拒绝虚标修复，本源无代码改动）；v1.9.12 包升版（QQ 源接入 a.aa.cab 新通道，本源无代码改动）；v1.9.10 KRC 接力域名修复版：fetchKuwoKrcRelay 搜索域名 mobilecdn.kugou.com → mobiles.kugou.com——mobilecdn 在部分网络 DNS 污染（证书 altnames 为 *.cdn.myqcloud.com）致逐字歌词接力断链，mobiles 同构（参数/响应一致），2026-09-12 实测搜索→krcs→download→decodeKrc 全链路打通；其余代码零改动；v1.9.9 音质标识一致性核查版（无代码改动，随包升版）：六页键集核查通过（v1.9.5 enrichQualities 为本轮参考实现）；遗留记录：专辑页(musicpay MINFO 明文档)与歌手页(N_MINFO 含加密档)同歌键集差异属上游数据口径不一致，宁缺毋假未动，详见排查总表-v1.9.9；v1.9.8版本号统一版（各源版本号对齐，无代码增量）；v1.9.6 MV 画质表修复版：availableVideoQualities 从「单实档」改为 baka 同款 5 档全 ladder（240p~1080p）——2026-09-11 复验实测酷我 anymatch 对仅 480p MV 请求 1080p 可出真实流，单档声明令宿主画质菜单无法切档；取链仍逐级降级+实档回读，诚实性不变；v1.9.5 全页面音质标识核查 + VIP 标识移除版：榜单页两路径（bang 树/聚合榜）补 qualities：聚合条目 aggQuals 透传 + ksong.s 实测无 N_MINFO 后接 enrichKuwoQualities（musicpay 批量 MINFO）兜底（榜单页此前全缺）；新增 enrichKuwoQualities（musicpay ids 批量）给专辑/歌手作品页补音质；全接口停写 fee（VIP 角标）与 getMusicInfo/取链 fee 回填，kwFeeOfRaw 移除；v1.9.4 第三方取链修复 + size 字段版：星海（yy.zddyr.top 503 鉴权死亡 + 替代 zrcdy.dpdns.org 也不可用）从竞速池移除（6→5 路）保留函数体注释掉，2026-09-11 标记失效；getMediaSource 返回值补 size 字段（取链响应直带 > HEAD Range 0-0 探测 > 留空），详见头部 changelog；v1.9.1 随包升版：歌单对象补 author 别名字段（宿主协议读 artist，任务字段清单要求 author，两者都传），导入修复详见酷狗 v1.9.1 changelog 与本轮自测清单；v1.9.0 BakaMusic 高价值音源接入版：P0 次合代/ikun 酷我通道入竞速池（4→6 路 0/250/400/550/700/850ms，严格校验+fLaC 魔数防假成功）+ P1 全豆要 nmobi 兜底回落 + userVariables 开关 kwCihedai/kwIkun 默认开；详见头部 changelog；v1.8.4 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem（title/description 对齐宿主契约，meta 随 pl.svc 顶层字段零额外请求回传）；v1.8.3 质检遗留优化版：Q-02/Q-03 复核确认已符合统一口径，随包升版；v1.8.2 歌单解析修复版：P2-2 歌单入口 qualities（N_MINFO 透传+parseKuwoQualityInfo）+ P2-4 错误码统一；]  v1.8.0 = MV 参数对齐基线：mvSourceResultOf 补 width/height/codec/availableVideoQualities.width + 三层兜底链 videoQuality 写回（基线 v1.7.1 = 星海 token 纯 JS base64 + nmobi/mobi 错峰 0/250/400/550ms 竞速 + AbortController + IMediaSourceResult 字段）；v1.7.0 = 第三方/备选竞速通道接入：2 官方（nmobi/mobi convert_url3 形态优先 → 实证 convert_url_with_sign 回落）+ 2 第三方（屿溪 /v1/music/resolve-url POST + 星海 /lx/api/ X-Token 鉴权）= 4 通道优先级错峰并发竞速（0/80/180/300ms），每通道通过严格音质大小校验（响应层 + Range 0-15 魔数/码率双重校验），standard/high/super 三档纳入竞速池，hires/master/atmos 维持 QMC+海棠母带/全景声链不动；详见头部 changelog 段；v1.6.1 = HotDownloader 借鉴：P0 档位真实性校验（QMC 严格相等 + super/high bitrate 下限 + 守卫魔数/码率双重校验 + CDN 探测补 UA）+ hires 宿主档（20201kmflac→20900→母带尾链）+ kwHdResolve 第四路提速竞速（HotDownloader 形态 ~67ms）；详见头部 changelog；v1.5.0 = 补齐宿主字段六项（P1 逐字歌词 getWordByWordLyric / 评论 getMusicComments / fee VIP 标记 / 分享链接 getMusicDetailPageUrl + P2 primaryKey / alias）；v1.4.4 = 清理聚合拆分残留（榜单 id agg-* 改 kw-* 单源命名 + 移除热歌榜抖音 CDN 封面硬编码）；v1.4.3 = 各音质文件大小返回宿主（N_MINFO 解析 + musicpay 详情回填，对齐 baka qualities）；v1.4.2 = super/atmos 档官方高音质全档阶梯（20900→20501→20201 逐档回落）；v1.4.1 = super 档 QMC 20201kmflac 优先后回落明文池；v1.4.0 = 母带/增强档接入酷我 QMC 加密档官方直源（插件侧 DES 解链+尾 704 提取得 QQ ekey 下发，宿主 ekey 通道零改动，母带链升级 QMC 双域名竞速首选）；v1.3.0 = MV 全面对齐 baka 酷我（mvId/mvSongId/mvArtwork 字段补齐 + 榜单条目 platform/mv 提升 + 5 画质档含 360p + anymatch 双通道竞速 + 旧版 playUrl 按 songId 兜底）；v1.2.9 = getMvSource 去 _src 硬前置 + getMusicInfo 回填 platform（旧数据 MV 菜单自愈；srcUrl 更新源按用户决策不接入）；由聚合搜索插件 v0.8.0 拆分；v1.2.8 = MV 标识补齐（六入口 mvpayinfo.vid 采集 + buildMusicItem/buildSheetItem 顶层 mv/platform 自报，打通宿主「播放 MV」入口）；v1.2.0 = 取链优化三连；v1.2.1 = tags 协议包装修复 + 海棠全音质兜底；v1.2.2 = hires 档升级海棠 kw master 真 24bit 母带 FLAC；v1.2.3 = 至臻全景声 atmos 独立成档（海棠 kw atmos，fLaC 校验 + master 链回落），DTS:X 上游不识别不接入；v1.2.4 = 榜单封面补 coverImg 字段 + 歌单分类按 tag.digest 真分流（getTagPlayList / get_pc_qz_data）+ getRcmPlayList 0 基分页；v1.2.5 = 歌手搜索接入（supportedSearchType 补 artist + r.s ft=artist）+ getArtistWorks 歌手作品页（歌曲/专辑）；v1.2.6 = 歌词搜索接入（lyric 分支 + rawLrcTxt 预览）+ defaultSearchType 显式声明 + 歌单分类 pinned 横向快捷标签（心情×3 + 语言×3 动态挑）；v1.2.7 = 歌手详情补齐（搜索歌手并发补 fans 粉丝数 + 新增 getArtistDetail 方法，www artistInfo 端点）
  author: '研发2号',
  description: '酷我音乐独立源插件 v1.9.8（v1.9.8 版本号统一版：各源版本号对齐，无代码增量；v1.9.6 MV 画质表修复：availableVideoQualities 改 baka 同款 5 档全 ladder，宿主画质菜单可切档；v1.9.5 全页面音质标识核查 + VIP 标识移除版：榜单页音质补齐（聚合透传 + musicpay 批量兜底，ksong.s 无 N_MINFO）；enrichKuwoQualities 批量补专辑/歌手/榜单页音质；全接口停写 fee（VIP 角标）；v1.9.1 随包升版：歌单对象补 author 别名字段，详见头部 v1.9.1 changelog；v1.9.0 BakaMusic 高价值音源接入版：P0 次合代/ikun 酷我第三方通道加入 standard/high/super 竞速池（4→6 路，错峰 0/250/400/550/700/850ms，全部过 Range 魔数/码率严格校验防假成功，userVariables kwCihedai/kwIkun 默认开）+ P1 全豆要 nmobi 兜底回落；v1.8.4 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem 歌单对象——标题/介绍/封面/作者随 pl.svc getlistinfo 顶层字段零额外请求回传，介绍字段 description 对齐宿主 v1.0.0 契约；v1.8.3 质检遗留优化版：错误前缀与 code 口径复核确认已符合统一标准，随包升版；v1.8.2 歌单解析修复版：歌单歌曲补 qualities（pl.svc 条目自带 N_MINFO 透传+既有 parseKuwoQualityInfo，零额外请求）+ 歌单导入错误统一携带结构化 code；基础 v1.7.1 = 修复与对齐：fix#1 星海 token 改纯 JS UTF-8+base64 编码（复用 utf8Bytes，输出与 btoa 逐字节一致，Hermes 无 btoa 环境通道恢复可用）；fix#2 nmobi/mobi 同 host 双发治理——错峰 0/80/180/300 → 0/250/400/550ms，nmobi 首胜 ~176ms 时 mobi 定时器已封盘清除、不再多发（最坏 +~170ms 由胜出 abort 对冲）；fix#3 竞速胜出即封盘（清定时器、落选结果不再结算）；fix#4 AbortController 可用时逐通道下发 signal 并在胜出后 abort 落选通道在途请求（axios>=0.22 真取消，低版本忽略；build.length>=1 判定向后兼容既有调用点）；fix#5 各通道/严格校验函数签名加 signal 透传；参数对齐 plugin.d.ts：getMediaSource 返回补宿主标准 quality 字段（=actualQuality）；v1.7.0 = 第三方/备选竞速通道：2 官方（nmobi/mobi convert_url3 形态优先 → 实证 convert_url_with_sign 回落）+ 2 第三方（屿溪 /v1/music/resolve-url POST + 星海 /lx/api/ X-Token 鉴权）= 4 通道优先级错峰并发竞速（0/80/180/300ms），严格音质大小校验（响应层 + Range 0-15 魔数/码率双重校验），standard/high/super 三档纳入竞速池，hires/master/atmos 维持 QMC+海棠母带/全景声链不动；v1.6.1 = HotDownloader 借鉴优化：P0 档位真实性校验（QMC 解析器 format/bitrate 严格相等 + super/high bitrate 下限 + 守卫层魔数/码率双重校验 + CDN 探测补 UA 修复 403 空转）+ hires 独立档（20201kmflac 24bit 优先→20900 母带→母带尾链）+ kwHdResolve 提速竞速；v1.6.0：Hi-Res 标注（flac 且 bitrate>=2000 → actualQuality hires，真 2000kflac 无损 55MB 级）、逐字歌词增强（lrcx GET 兜底通道 + lrcx 专用解析器 + KRC 真逐字优先通道序）、搜索单引号 JSON 容错；v1.5.0 宿主字段全量补齐：逐字歌词 getWordByWordLyric（酷我 lrcx 原生通道 XOR/Base64+zlib 解密→QRC，失败降级酷狗 KRC 跨源接力）、歌曲评论 getMusicComments（海棠代理通道 page 分页）、fee VIP 标记（fpay/feeType.song 判定，搜索/详情/取链三处）、分享链接 getMusicDetailPageUrl（play_detail 官方页）、primaryKey 声明、alias 别名透传；v1.4.4 清理聚合拆分残留——榜单 id 改 kw-* 单源命名、移除热歌榜抖音 CDN 封面；v1.4.3 各音质文件大小返回宿主（N_MINFO/musicpay 解析，对齐 baka qualities 口径）；v1.4.2 super 档官方高音质阶梯：20900 母带→20501 全景声→20201 24bit 逐档双域名竞速回落，各档插件解链下发 QQ ekey、actualQuality 如实标注；母带/增强档接入酷我 QMC 加密档官方直源：插件侧 DES 解链提取 QQ ekey、经宿主原生 ekey 通道解密，母带链 QMC 双域名竞速首选；MV 全面对齐 baka 酷我：歌曲条目带顶层 mv/mvId/mvSongId/mvArtwork 字段，5 画质档 240p~1080p，anymatch 双通道竞速 + 旧版 playUrl 按 songId 兜底；v1.2.9 getMvSource 去 _src 硬前置 + getMusicInfo 回填 platform；v1.2.8 补 MV 标识）：搜索（歌曲/专辑/歌手/歌单/歌词，歌词搜索带 rawLrcTxt 预览、选中后走 getLyric 取完整歌词）、歌手作品页（getArtistWorks 歌曲/专辑分页）、歌手详情（getArtistDetail 头像/粉丝数/简介，搜索歌手自动补 fans）、取链（standard/low 档 nmobi/nmsublist/mobi.s 免签车载/DES 手机渠道/DES 车载渠道/antiserver 六路竞速，high/super 档四路官方+DES 竞速，master/atmos 档海棠 kw 真 24bit 母带 FLAC（~187MB）/至臻全景声（~31MB）优先（fLaC 魔数校验）→ DES 2000kflac 竞速 → 海棠 lossless 兜底，全音质档竞速全挂统一海棠 kw 兜底，带试听守卫与档位校验，high 档 ogg 降级拒收）、歌词（openapi getlyric + songinfoandlrc 双通道）、动态榜单树（官方 bang/list 5 分组 36 榜 + ksong.s 真翻页）、推荐歌单与分类标签（含横向快捷标签栏）、歌单与单曲分享链接导入、专辑搜索与详情（分页）、MV（baka 同款 anymatch 双通道 5 画质 + 旧版 playUrl 按 songId 兜底）、歌曲详情与封面反查。支持音质：128k/192k/320k/无损 flac（2000k）/hires 档 24bit Hi-Res（20201kmflac，v1.6.1）/master 档 24bit 母带/atmos 档至臻全景声（母带与全景声仅部分 VIP 歌有货，未命中按回落链实际档如实标注；DTS:X 上游不支持）；实际无损上限为母带级 FLAC。',
  supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'],
  // [v1.2.6] 显式声明默认搜索类型，消除对宿主回退链（plugin.defaultSearchType ?? 'music'）的隐式依赖
  defaultSearchType: 'music',
  // [v1.5.0 P2-5] 唯一标识声明（对齐网易云/咪咕）：宿主 mediameta 存档展示与去重缓存键使用
  primaryKey: ['id'],
  // 酷我能力口径（SOURCE_QUALITIES）：standard/high/super/hires/master/atmos 内部档；
  // super=官方高音质阶梯（20900kmflac 母带→20501kmflac 全景声→20201kmflac 24bit
  // →2000kflac 明文）；hires=官方 20201kmflac 24bit Hi-Res 优先（[v1.6.1] HotDownloader
  // 调研：与 20900kmflac 同一 mobi.s 接口不同 br 参数，独立成档）→20900 母带→母带尾链；
  // master=官方 20900kmflac 母带首选、海棠 kw 真 24bit 母带兜底；
  // atmos=官方 20501kmflac 首选、海棠兜底；actualQuality 均按实际命中档如实标注。
  // DTS:X 上游不识别不接入（[v1.2.3]）。
  // [v1.1.0 fix O-8] 音质上限已在 description 声明：增强档未命中时按回落链实际档如实标注（宁低勿高）。
  supportedQualities: ['128k', '192k', '320k', 'flac', 'hires', 'master', 'atmos'],
  cacheControl: 'no-store', // 各源播放链接多为签名短时效链接，必须现取
  userVariables: [
    { key: 'kwCihedai', name: '次合代第三方通道（v1.9.0 新增，默认开）', hint: '设为 off 关闭；BakaMusic 实测真实无损（lossless≈1647kbps fLaC），加入 standard/high/super 竞速池（错峰 700ms），校验不过自动静默让路' },
    { key: 'kwIkun', name: 'ikun 第三方通道（v1.9.0 新增，默认开）', hint: '设为 off 关闭；BakaMusic 实测酷我真无损（X-API-Key 免卡密，仅酷我/网易云通道真实），加入竞速池（错峰 850ms），10 秒占位假链由严格校验过滤' }
  ], // [v1.9.0] 新增两个第三方通道开关，默认开启
  hints: {
    search: ['搜索酷我音乐曲库，结果按版本归一化去重排序', '搜索酷我歌手（v1.2.5），可进入歌手作品页听歌/看专辑', '搜索歌词（v1.2.6）：带歌词预览，选中后自动关联完整歌词', '播放时自动选择最优可用音质通道，主通道失败自动切换备源'],
    importMusicSheet: [
      '支持酷我的歌单分享链接，如 kuwo.cn/playlist_detail/xxx',
      '单次最多导入 500 首；纯数字歌单 ID 无法判定平台，请粘贴完整链接'
    ]
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }；解包出关键词（所有 searchType 通用）
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var q = kw;
    if (type === 'album') return aggregateSearchBy(ALBUM_SEARCH_ADAPTERS, q, page, albumKeyOf, buildAlbumItem);
    if (type === 'sheet') return aggregateSearchBy(SHEET_SEARCH_ADAPTERS, q, page, sheetKeyOf, buildSheetSearchItem);
    if (type === 'artist') {
      // [v1.2.7] 歌手详情补齐：聚合结果先并发补 fans（www artistInfo，静默降级）再返回——
      // 宿主歌手页 header 渲染 fans 的唯一来源就是这条搜索返回的 artistItem
      var artistRes = await aggregateSearchBy(ARTIST_SEARCH_ADAPTERS, q, page, artistKeyOf, buildArtistSearchItem);
      return await enrichArtistFans(artistRes);
    }
    if (type === 'lyric') return lyricSearchImpl(q, page); // [v1.2.6] 歌词搜索（复用 music 聚合口径 + rawLrcTxt 预览）
    if (type !== 'music') return { isEnd: true, data: [] };

    var names = ['kuwo'];
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
    if (okCount === 0) throw new Error('聚合搜索失败：所有音源请求均失败');

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
    return { isEnd: all.length < 20, data: data }; // [v1.1.0 fix O-3] 主路径 isEnd 同口径按上游返回量精判
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    var q = normalizeQuality(quality);
    var r = await resolveWithFallback(musicItem, q);
    // [v1.7.1 对齐] IMediaSourceResult 标准字段 quality 回填：各通道仅携带扩展字段
    // actualQuality（宿主 d.ts 无此字段），边界处统一补齐 quality = actualQuality
    if (r && r.url && r.quality === undefined && r.actualQuality) r.quality = r.actualQuality;
    // [v1.5.0 P1-3 -> v1.9.5] fee（VIP 标识）停写：取链结果不再携带 fee 字段。
    // [v1.9.4] 边界补 size 兜底：竞速链返回无 size 时（老通道/官方链未带 size 字段），
    // Range 0-0 HEAD 探测 Content-Range/Content-Length 写回；探测失败留空（不阻断取链）。
    if (r && r.url && !r.size) {
      try {
        var sz = await probeHeadSize(r.url, 2000);
        if (sz > 0) r.size = sz;
      } catch (e) { /* fail-soft */ }
    }
    return r;
  },

  // [v1.5.0 P1-1] 逐字歌词：酷我 lrcx 原生通道失败自动降级酷狗 KRC 跨源接力，统一输出 QRC
  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  // [v1.5.0 P1-2] 歌曲评论（海棠代理通道，page 分页）
  async getMusicComments(musicItem, page) {
    return getMusicCommentsImpl(musicItem, page);
  },

  // [v1.5.0 P1-4] 歌曲分享页链接（酷我官方网页版播放页）
  getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  // v0.7.0 P0-3：单曲分享链接导入（酷我）
  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // v0.7.0 P0-4：歌曲详情（多源补齐封面/专辑/时长/MV）
  // [v0.7.2 fix#9 核验] getMusicInfo 自 v0.7.0 P0-4 已实现（getMusicInfoImpl）：多源详情补齐
  // （专辑/时长/MV 字段），仍缺封面时 enrichArtwork 反查兜底（酷我 rid_pic），
  // 覆盖架构报告「封面补全兜底」诉求，无需改动。
  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  // [v1.2.5] 歌手作品页（歌曲/专辑分页）：宿主歌手详情页（artistDetail）进入时调用；
  // 歌曲条目带单源 _src 复用取链接力，专辑条目带 _asrc 复用 getAlbumInfo 链路
  async getArtistWorks(artistItem, page, type) {
    return getArtistWorksImpl(artistItem, page, type);
  },

  // [v1.2.7] 歌手详情（头像/粉丝数/简介/作品数）：宿主 IArtistItemBase 对齐；
  // 上游 www artistInfo 不可达时回退传入条目自带字段（宁缺勿造）
  async getArtistDetail(artistItem) {
    return getArtistDetailImpl(artistItem);
  },

  async getTopLists() {
    // [v1.1.0 B-1] 动态榜单树（wapi bang/list 实测 5 分组 36 榜，带 6h 缓存）替换 v1.0.0 硬编码 4 榜；
    // 拉取失败降级返回聚合硬编码榜，保证入口不白屏
    try {
      return await fetchBangTree();
    } catch (e) {
      return [{
        title: '酷我榜单',
        data: CHART_DEFS.map(function (d) {
          // [v1.2.4 fix①] 宿主 fork 榜单卡片渲染读 coverImg（topListItem.tsx），artwork 双写兼容官方宿主
          var cv = str(d.cover || '');
          return { id: d.id, title: d.title, coverImg: cv, artwork: cv };
        })
      }];
    }
  },

  async getTopListDetail(topListItem, page) {
    var tid = (topListItem && topListItem.id) || '';
    // [v1.1.0 B-1] bang 树榜单（kw_bang_<id>）→ ksong.s 真翻页（M-2），封面反查预算 24（M-7）
    var mBang = /^kw_bang_(\d+)$/.exec(tid);
    if (mBang) {
      var out = await fetchKuwoBang(mBang[1], page);
      var list2 = await enrichArtwork(out.musicList, 24);
      await enrichKuwoQualities(list2, 100); // [v1.9.5] 榜单页音质补齐（ksong.s 实测无 N_MINFO，musicpay 批量 MINFO 兜底）
      return { isEnd: out.isEnd, musicList: list2, topListItem: { id: topListItem.id, title: topListItem.title, coverImg: topListItem.coverImg, artwork: topListItem.artwork, platform: 'kuwo' } };
    }
    // 聚合硬编码榜（B-1 降级路径）
    if (page && page > 1) return { isEnd: true, musicList: [] };
    var def = findChartDef(tid);
    if (!def) throw new Error('未知榜单: ' + tid);
    var musicList2 = await enrichArtwork(await getAggregatedChart(def), 24); // [v1.1.0 fix M-7] 反查预算 80→24
    await enrichKuwoQualities(musicList2, 100); // [v1.9.5] 榜单页音质补齐（同上，ksong.s 无 N_MINFO）
    return { isEnd: true, musicList: musicList2, topListItem: { id: topListItem.id, title: topListItem.title, coverImg: topListItem.coverImg, artwork: topListItem.artwork, platform: 'kuwo' } };
  },

  // [v1.1.0 B-2] 推荐歌单分类标签（getTagList 8 分组真实标签）
  // [v1.2.1 fix①] 协议包装：宿主要求 {pinned?, data: 分组数组}，v1.1.0 起裸数组返回导致
  // 宿主读到 result.data=undefined，歌单分类页整个不渲染（含分类页上的榜单封面区域）。
  async getRecommendSheetTags() {
    // [v1.2.6] pinned = 横向快捷标签栏数据源（宿主 sheetBody.tsx 渲染；v1.2.5 恒为空数组
    // → 横向栏只剩「默认」chip、无法滑动，即「歌单分类没有横向显示」的根因）。
    // 从真实标签动态挑（不硬编码上游 id）：「心情」前 3 +「语言」前 3，详见 pickPinnedTags。
    var groups = await fetchKuwoTagGroups();
    return { pinned: pickPinnedTags(groups), data: groups };
  },

  // [v1.1.0 B-2] 按标签取歌单。
  // [v1.2.4 fix②] v1.2.3 忽略 tag 参数恒回热门推荐流（getTagPlayList 被误判下线），
  // 用户点任何分类看到的都是同一批内容，感知为「歌单分类点击没反应」。现按社区版
  // baka-plugins 协议分流：tag.digest='10000' → getTagPlayList（真翻页）；tag.digest='43'
  // （专区）→ er.s get_pc_qz_data（单次全量）；无 tag.id（默认 tab）→ 热门流 getRcmPlayList。
  // 任一通道失败不静默吞掉——上抛交给宿主按错误态重试，不做跨通道混装。
  async getRecommendSheetsByTag(tag, page) {
    var tid = tag && tag.id !== undefined && tag.id !== null && tag.id !== '' ? String(tag.id) : '';
    if (tid) {
      if (str(tag.digest) === '43') {
        var qz = await fetchKuwoQzSheets(tid);
        return { isEnd: qz.isEnd, data: qz.sheetList };
      }
      var tp = await fetchKuwoTagPlayList(tid, page);
      return { isEnd: tp.isEnd, data: tp.sheetList };
    }
    var out = await fetchKuwoRcmSheets(page);
    return { isEnd: out.isEnd, data: out.sheetList };
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async getAlbumInfo(albumItem) {
    return getAlbumInfoImpl(albumItem);
  },

  async getMusicSheetInfo(sheetItem, page) {
    return getMusicSheetInfoImpl(sheetItem, page);
  },

  async getMvSource(musicItem, videoQuality) {
    return getMvSourceImpl(musicItem, videoQuality);
  },

  supportedVideoQualities: [
    // [v1.3.0] 补 360p 档对齐 baka 酷我 5 档声明（其 L1856：240p~1080p）
    { key: '240p', label: '240P' },
    { key: '360p', label: '360P' },
    { key: '480p', label: '480P' },
    { key: '720p', label: '720P' },
    { key: '1080p', label: '1080P' }
  ],

  // ===== 以下为内部函数，供测试脚本复用（非插件协议方法）=====
  _internal: {
    // [v1.7.1] 新增导出：v1.7.1 修复路径单测复用（竞速封盘/取消、星海 token 编码、通道解析）
    xinghaiBase64: xinghaiBase64,
    utf8Bytes: utf8Bytes,
    racePriority: racePriority,
    raceNewChannels: raceNewChannels,
    kwConvertUrl3Resolve: kwConvertUrl3Resolve,
    yuxiResolve: yuxiResolve,
    xinghaiResolve: xinghaiResolve,
    verifyMediaSizeStrict: verifyMediaSizeStrict,
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
    RESOLVE_ADAPTERS: RESOLVE_ADAPTERS,
    guardFullAudio: guardFullAudio,
    // [v1.6.1] 档位真实性校验与竞速取链链路（自测脚本复用；均为函数声明，提升安全）
    kwQmcResolve: kwQmcResolve,
    kwHdResolve: kwHdResolve,
    kwQmcRace: kwQmcRace,
    kwOfficialResolve: kwOfficialResolve,
    kuwoDesResolve: kuwoDesResolve,
    resolveKuwoMasterChain: resolveKuwoMasterChain,
    resolveKuwoMasterTail: resolveKuwoMasterTail,
    resolveKuwo: resolveKuwo,
    probeMediaMagic: probeMediaMagic,
    isAllowedMediaUrl: isAllowedMediaUrl,
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
    secToLrcTime: secToLrcTime,
    getLyricImpl: getLyricImpl,
    enrichArtwork: enrichArtwork,
    fetchKuwoCover: fetchKuwoCover,
    // 惰性 getter：本对象字面量在 var 赋值（文件尾部）之前求值，
    // 直接取值会是 undefined；用 getter 保证调用时拿到已赋值的表。
    get ALBUM_SEARCH_ADAPTERS() { return ALBUM_SEARCH_ADAPTERS; },
    get SHEET_SEARCH_ADAPTERS() { return SHEET_SEARCH_ADAPTERS; },
    get ALBUM_DETAIL() { return ALBUM_DETAIL; },
    get MV_SOURCE() { return MV_SOURCE; },
    getAlbumInfoImpl: getAlbumInfoImpl,
    getMusicSheetInfoImpl: getMusicSheetInfoImpl,
    getMvSourceImpl: getMvSourceImpl,
    // [v1.3.0] MV 对齐 baka 后的新增内部函数（自测用）
    mvVidVal: mvVidVal,
    mvPicOf: mvPicOf,
    mvResponseQualityIdx: mvResponseQualityIdx,
    mvSourceResultOf: mvSourceResultOf,
    parseMvTextResponse: parseMvTextResponse,
    requestMvByVidJson: requestMvByVidJson,
    requestMvByVidText: requestMvByVidText,
    requestKuwoLegacyMvSource: requestKuwoLegacyMvSource,
    getKuwoSongIdOf: getKuwoSongIdOf,
    MV_QUALITY_ORDER: MV_QUALITY_ORDER,
    MV_ANYMATCH_QUALITY: MV_ANYMATCH_QUALITY,
    aggregateSearchBy: aggregateSearchBy,
    // v0.7.0 新增（P0/P1 自测用）
    normalizeQuality: normalizeQuality,
    QUALITY_KEY_MAP: QUALITY_KEY_MAP,
    importMusicItemImpl: importMusicItemImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    SONG_URL_RESOLVERS: SONG_URL_RESOLVERS,
    resolveSongId: resolveSongId,
    SONG_DETAIL_FETCHERS: SONG_DETAIL_FETCHERS,
    haitangLevelOf: haitangLevelOf,
    resolveHaitang: resolveHaitang,
    probeMediaMagic: probeMediaMagic,
    kuwoWapiHeaders: kuwoWapiHeaders,
    searchAlbumKuwo: searchAlbumKuwo,
    // [v1.2.5] 歌手搜索/歌手作品（自测用）
    searchArtistKuwo: searchArtistKuwo,
    getArtistWorksImpl: getArtistWorksImpl,
    buildArtistSearchItem: buildArtistSearchItem,
    artistKeyOf: artistKeyOf,
    // [v1.2.7] 歌手详情补齐（自测用）
    fetchKuwoArtistInfo: fetchKuwoArtistInfo,
    normalizeArtistInfo: normalizeArtistInfo,
    enrichArtistFans: enrichArtistFans,
    getArtistDetailImpl: getArtistDetailImpl,
    get ARTIST_INFO_CACHE() { return ARTIST_INFO_CACHE; },
    get ARTIST_INFO_BREAKER() { return ARTIST_INFO_BREAKER; },
    get ARTIST_SEARCH_ADAPTERS() { return ARTIST_SEARCH_ADAPTERS; },
    LYRIC_TIMEOUT: LYRIC_TIMEOUT,
    // v0.7.1 新增（走查修复自测用）
    isAllowedMediaUrl: isAllowedMediaUrl,
    withTimeout: withTimeout,
    RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
    RELAY_TIMEOUT: RELAY_TIMEOUT,
    // [v0.7.2] 新增（还债包回归自测用）
    internalToHostQuality: internalToHostQuality,
    // [v0.7.3] 新增（加密对拍与取链通道自测用）
    kuwoEncryptQuery: kuwoEncryptQuery,
    raceSuccess: raceSuccess,
    kuwoDesResolve: kuwoDesResolve,
    kwOfficialResolve: kwOfficialResolve,
    kwAntiserverResolve: kwAntiserverResolve,
    resolveKuwo: resolveKuwo,
    resolveWithFallback: resolveWithFallback,
    // [v1.1.0] 新增（审查修复与接口扩充自测用）
    kuwoDesQuery: typeof kuwoDesQuery !== 'undefined' ? kuwoDesQuery : null,
    fetchBangTree: fetchBangTree,
    fetchKuwoBang: fetchKuwoBang,
    fetchKuwoTagGroups: fetchKuwoTagGroups,
    fetchKuwoRcmSheets: fetchKuwoRcmSheets,
    // [v1.2.4] 歌单分类修复自测用
    fetchKuwoTagPlayList: fetchKuwoTagPlayList,
    fetchKuwoQzSheets: fetchKuwoQzSheets,
    buildKwSheetListItem: buildKwSheetListItem,
    getRecommendSheetTagsImpl: function () { return plugin.getRecommendSheetTags(); },
    getRecommendSheetsByTagImpl: function (tag, page) { return plugin.getRecommendSheetsByTag(tag, page); },
    // [v1.5.0] 宿主字段补齐（自测用）
    getWordByWordLyricImpl: getWordByWordLyricImpl,
    parseKwBody: parseKwBody, // [v1.6.0 P2-3] 搜索单引号 JSON 容错（自测用）
    getMusicCommentsImpl: getMusicCommentsImpl,
    getMusicDetailPageUrlImpl: getMusicDetailPageUrlImpl,
    fetchKuwoLrcx: fetchKuwoLrcx,
    parseKuwoLrcxToQrc: parseKuwoLrcxToQrc,
    parseKrcForHost: parseKrcForHost,
    decodeKrc: decodeKrc,
    fetchKuwoKrcRelay: fetchKuwoKrcRelay,
    fetchKugouKrc: fetchKugouKrc,
    encLrcxParams: encLrcxParams
  }
};

module.exports = plugin;

// [v1.1.0 fix O-5] 删除死代码 formatTs（v0.x 遗留，全文件无引用）

// ==================== v1.1.0 追加段：动态榜单树 / 推荐歌单（B-1/B-2） ====================
// 端点均经本沙箱真实网络探针实测（probe2/probe3，2026-09-06；v1.2.4 复探 2026-09-07）：
// - wapi /api/pc/bang/list：根节点 {id:489919, name:排行榜(新2018), child:[5 分组]}，
//   每组 {disname, child:[榜单叶子]}，叶子 {id,name,pic,pic2,pic5,intro,sourceid,...}，共 36 榜；
//   兼容 data 包装响应形态；v1.2.4 探针：36/36 叶子 pic/pic2/pic5 全有值
// - wapi /api/pc/classify/playlist/getTagList：8 分组 85 标签，标签 {id,name,digest,...}，
//   digest 分布 {10000: 67, 43: 18}（2026-09-07 探针）
// - wapi /api/pc/classify/playlist/getRcmPlayList?order=hot：total=1752，pn 为 0 基
//   （pn=0/pn=1 返回不同内容；v1.2.3 误按 1 基发请求会跳过第一页）
// - wapi getTagPlayList：社区版参数形态（loginUid=0&loginSid=0&appUid=76039576&pn=<0基>&id=<tag.id>&rn=）
//   实测可用（2026-09-07，短视频 tag id=2189 digest=10000 total=10472 首页 20 条）；
//   v1.1.0「恒 total=0 疑似下线」的结论系探针参数形态错误，v1.2.4 起按 digest=10000 接入
// - er.s get_pc_qz_data（digest=43 专区标签）：mobileinterfaces.kuwo.cn，
//   返回分组数组 [{list:[{id,name,img}]}]，经典老歌专区（id=211）实测 4 组 flat=23 条
var BANG_TREE_TTL_MS = 6 * 60 * 60 * 1000;
var bangTreeCache = { ts: 0, groups: null };
var RCM_SHEET_TTL_MS = 30 * 60 * 1000;
var tagGroupsCache = { ts: 0, groups: null };

function fetchBangTree() {
  if (bangTreeCache.groups && Date.now() - bangTreeCache.ts < BANG_TREE_TTL_MS) {
    return Promise.resolve(bangTreeCache.groups);
  }
  return axios.get('https://wapi.kuwo.cn/api/pc/bang/list', {
    timeout: SOURCE_TIMEOUT, headers: kuwoWapiHeaders()
  }).then(function (res) {
    var root = (res.data && res.data.data) || res.data; // 兼容 {data:[...]} 与根节点直返两种形态
    var groups = Array.isArray(root) ? root : ((root && root.child) || []);
    var out = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var leaves = (g && g.child) || [];
      if (!leaves.length) continue;
      out.push({
        title: str(g.disname || g.name),
        data: leaves.map(function (l) {
          // [v1.1.0 fix R5] 叶子 id（4899xx）与 ksong.s 的旧式 id 不同命名空间——ksong.s 对新 id 报
          // "no bangid"；叶子上的 sourceid 即 ksong.s 可用的旧式 id（36/36 实测可用，探针 2026-09-06）。
          // 无 sourceid 的叶子兜底回退叶子 id。
          var sid = str(l.sourceid || l.id);
          // [v1.2.4 fix①] 宿主 fork 榜单卡片渲染读 coverImg 字段（src/components/mediaItem/
          // topListItem.tsx source={topListItem?.coverImg}），此前仅回 artwork 导致封面恒空。
          // pic5→pic2→pic 优先级与社区版 baka-plugins 一致（36/36 叶子实测三字段全有值）；
          // artwork 双写保留，兼容读 artwork 的官方宿主。
          var cover = str(l.pic5 || l.pic2 || l.pic || '');
          return { id: 'kw_bang_' + sid, title: str(l.name), coverImg: cover, artwork: cover, description: str(l.intro) };
        })
      });
    }
    if (!out.length) throw new Error('bang/list empty');
    bangTreeCache.ts = Date.now();
    bangTreeCache.groups = out;
    return out;
  });
}

// [v1.1.0 fix M-2] 榜单详情真翻页：v1.0.0 固定 pn=0 rn=100 单页即 isEnd（300 首榜单截断 100 首）；
// 实测 ksong.s 支持 pn 翻页（rn=200 时 pn=0→200 条、pn=1→剩余 100 条）。按宿主页码翻页，isEnd 按实际条数。
async function fetchKuwoBang(bangId, page) {
  var pg = Math.max(1, page || 1);
  var res = await axios.get('https://kbangserver.kuwo.cn/ksong.s', {
    params: { from: 'pc', type: 'bang', id: bangId, pn: pg - 1, rn: 100 },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'http://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var list = (res.data && res.data.musiclist) || [];
  var musicList = list.map(function (it) {
    var rid = str(it.id);
    var d = parseInt(it.song_duration, 10) || parseInt(it.duration, 10) || 0;
    return {
      source: 'kuwo', sid: rid,
      title: str(it.name), artist: str(it.artist), album: str(it.album),
      duration: d, artwork: '', raw: { rid: rid, N_MINFO: str(it.N_MINFO), mv: mvVidOf(it), mvArtwork: mvPicOf(it) } // [v1.3.0] 歌手作品入口；[v1.4.3] N_MINFO 透传
    };
  }).filter(function (it) { return it.sid && it.title; }).map(buildSheetItem);
  return { musicList: musicList, isEnd: list.length < 100 };
}

// [v1.2.6] 横向快捷标签（pinned）挑选：宿主歌单分类页横向 ScrollView 渲染 pinned
// （sheetBody.tsx），字段需 id/title/digest 三件套（id 作选中判断与 key、title 作文案）。
// 方案 A（横向分类分析报告推荐）：从真实标签动态挑，不引入硬编码 id、不怕上游变动——
// 「心情」前 3（伤感/解压/励志）+「语言」前 3（华语/欧美/韩语），digest 均为 '10000'
// → 选中后必走 getTagPlayList 通道（与 v1.2.4 分类分流路由闭环，社区版行为一致）。
// 防御：上游分组改名/摘除时退化为全组前 6 个普通标签，保证横向栏非空。
function pickPinnedTags(groups) {
  function pick(gTitle, n) {
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].title === gTitle) {
        return (groups[i].data || []).filter(function (t) { return String(t.digest) === '10000'; }).slice(0, n);
      }
    }
    return [];
  }
  var pinned = pick('心情', 3).concat(pick('语言', 3));
  for (var g = 0; g < groups.length && pinned.length < 6; g++) {
    var tags = (groups[g].data || []).filter(function (t) { return String(t.digest) === '10000'; });
    for (var t2 = 0; t2 < tags.length && pinned.length < 6; t2++) {
      if (!pinned.some(function (p) { return p.id === tags[t2].id; })) pinned.push(tags[t2]);
    }
  }
  return pinned;
}

function fetchKuwoTagGroups() {
  if (tagGroupsCache.groups && Date.now() - tagGroupsCache.ts < RCM_SHEET_TTL_MS) {
    return Promise.resolve(tagGroupsCache.groups);
  }
  return axios.get('https://wapi.kuwo.cn/api/pc/classify/playlist/getTagList', {
    timeout: SOURCE_TIMEOUT, headers: kuwoWapiHeaders()
  }).then(function (res) {
    var groups = (res.data && res.data.data) || [];
    var out = [];
    for (var i = 0; i < groups.length; i++) {
      var tags = (groups[i] && groups[i].data) || [];
      if (!tags.length) continue;
      out.push({
        title: str(groups[i].name),
        data: tags.map(function (t) { return { id: String(t.id), title: str(t.name), digest: str(t.digest) }; })
      });
    }
    if (!out.length) throw new Error('getTagList empty');
    tagGroupsCache.ts = Date.now();
    tagGroupsCache.groups = out;
    return out;
  });
}

// [v1.2.4] 歌单条目映射助手：getRcmPlayList / getTagPlayList 两种响应的条目字段一致
// （{id,name,img,uname,total,listencnt,uid}；get_pc_qz_data 条目仅 id/name/img），
// 统一映射为宿主 ISheetItemBase 形态，_ssrc 供 getMusicSheetInfo / 导入链路解析 listId。
function buildKwSheetListItem(it) {
  var pid = str(it.id);
  return {
    id: 'kuwo~pl~' + pid,
    platform: 'kuwo',
    title: str(it.name),
    artist: str(it.uname),
    artwork: str(it.img || ''),
    worksNum: Number(it.total) || undefined,
    description: '',
    _ssrc: { kuwo: { listId: pid } }
  };
}

async function fetchKuwoRcmSheets(page) {
  var pg = Math.max(1, page || 1);
  // [v1.2.4 fix②] getRcmPlayList 的 pn 为 0 基（pn=0/pn=1 实测返回不同内容，2026-09-07 探针），
  // v1.2.3 按 1 基直发 page 会跳过第一页；对齐社区版 pn=page-1。isEnd 按 total 判定
  // （total 缺失时退回「不足一页」判定）。
  var res = await axios.get('https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList', {
    params: { pn: pg - 1, rn: 30, order: 'hot', httpsStatus: 1, reqId: Date.now() },
    timeout: SOURCE_TIMEOUT, headers: kuwoWapiHeaders()
  });
  var d = (res.data && res.data.data) || {};
  var list = d.data || d.list || [];
  var total = Number(d.total) || 0;
  var sheetList = list.map(buildKwSheetListItem).filter(function (it) { return it.title; });
  return { sheetList: sheetList, isEnd: total ? pg * 30 >= total : list.length < 30 };
}

// [v1.2.4 fix②] 按 tag 取歌单 · digest=10000 通道：wapi getTagPlayList（社区版参数形态，
// pn 0 基；2026-09-07 探针实测可用：短视频 tag id=2189 total=10472 首页 20 条）。
// 支持 page 翻页，isEnd 按 total 判定。
async function fetchKuwoTagPlayList(tagId, page) {
  var pg = Math.max(1, page || 1);
  var res = await axios.get('https://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList', {
    params: { loginUid: 0, loginSid: 0, appUid: 76039576, pn: pg - 1, id: tagId, rn: 30 },
    timeout: SOURCE_TIMEOUT, headers: kuwoWapiHeaders()
  });
  var d = (res.data && res.data.data) || {};
  var list = d.data || d.list || [];
  var total = Number(d.total) || 0;
  var sheetList = list.map(buildKwSheetListItem).filter(function (it) { return it.title; });
  return { sheetList: sheetList, isEnd: total ? pg * 30 >= total : list.length < 30 };
}

// [v1.2.4 fix②] 按 tag 取歌单 · digest=43 专区通道：er.s get_pc_qz_data（社区版同款，
// 无翻页参数，一次性返回全部分组 {list:[{id,name,img}]}，经典老歌专区实测 flat=23 条）。
// 跨分组按歌单 id 去重；条目无 uname/total 字段，artist/worksNum 留空（诚实标注）。
async function fetchKuwoQzSheets(tagId) {
  var res = await axios.get('http://mobileinterfaces.kuwo.cn/er.s', {
    params: { type: 'get_pc_qz_data', f: 'web', id: tagId, prod: 'pc' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var d = res.data;
  var arr = Array.isArray(d) ? d : ((d && d.data) || []);
  var seen = {};
  var sheetList = [];
  for (var i = 0; i < arr.length; i++) {
    var items = (arr[i] && arr[i].list) || [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var pid = str(it.id);
      if (!pid || seen[pid]) continue;
      seen[pid] = true;
      sheetList.push(buildKwSheetListItem(it));
    }
  }
  return { sheetList: sheetList.filter(function (s) { return s.title; }), isEnd: true };
}

// ==================== v0.5.0 追加段 A：专辑/歌单搜索（聚合） ====================
// 端点全部出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核（artifacts/v05-probe/）。
// 范围决策（宁缺毋滥）：专辑搜索接入酷我（v0.7.0 起 searchMusicBykeyWord ft=album 免登录通道）；
// 歌手搜索基线即未接入酷我（wapi 404 / r.s ft=singer 为空，均不可通），本插件不含歌手搜索；
// 歌单搜索接入酷我（歌单详情复用 SHEET_FETCHERS）。
// 注：本段位于 module.exports 之后，函数声明提升 + 调用时求值，行为与前置声明一致。

var SEARCH_PAGE_SIZE = 20;

function stripEm(s) {
  return String(s == null ? '' : s).replace(/<\/?em>/g, '');
}
function parseKwDict(text) {
  var s = String(text == null ? '' : text).trim();
  if (!s) return null;
  if (s[0] === '{') { try { return JSON.parse(s); } catch (e) {} }
  try {
    var j = s.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
      .replace(/([{,]\s*)'([^']+)':/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, function (m, v) { return ': "' + v.replace(/"/g, '\\"') + '"'; });
    return JSON.parse(j);
  } catch (e) { return null; }
}
// [v1.6.0 P2-3] 整体响应容错：酷我旧接口偶发直接返回单引号包裹的非标 JSON 字符串（go-music-dl
// 同样遇到并做全量引号替换修复），axios 按 JSON 解析失败时 res.data 会是字符串——识别为字符串
// 且含目标键时用 parseKwDict 容错解析（比全量替换引号更严谨：值内单引号不受影响），失败原样返回。
function parseKwBody(data, key) {
  if (data && typeof data === 'object') return data;
  if (typeof data !== 'string' || data.indexOf(key) === -1) return data;
  var fixed = parseKwDict(data);
  return fixed || data;
}
// 酷我 r.s（文档 9.3.2/11.1）：ft=playlist/video，abslist[] 为 Python 字典风格字符串
function kuwoRsSearch(ft, q, pn) {
  return axios.get('https://search.kuwo.cn/r.s', {
    // [v1.1.0 fix S-1] r.s 的 pn 为 0 起始，宿主页码为 1 起始；v1.0.0 直接把 1 起始页码当 pn 发，
    // 导致歌单/MV 搜索第一页永久丢失（MV 搜索跳过最相关第一条）。统一在此处减 1。
    params: { all: q, ft: ft, itemset: 'web', pn: (pn || 1) - 1, rn: 20, rformat: 'json', encoding: 'utf8', pcjson: 1 },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    // [v1.6.0 P2-3] 整体响应也可能直接是单引号 JSON 字符串，先 parseKwBody 容错再取 abslist
    var body = parseKwBody(res.data, 'abslist');
    var raw = (body && body.abslist) || [];
    return raw.map(function (x) { return typeof x === 'string' ? parseKwDict(x) : x; })
      .filter(function (x) { return x; });
  });
}

function kuwoWapiHeaders() {
  var token = 'XW' + Date.now().toString(36).toUpperCase();
  return {
    Referer: 'https://www.kuwo.cn/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    csrf: token,
    Cookie: 'kw_token=' + token
  };
}

// ---------- 专辑搜索 ----------
function searchAlbumKuwo(q, page) {
  // 实测 2026-09-06（artifacts/v07-probe）：searchMusicBykeyWord ft=album → data.albumlist[]
  //（albumid/name/artist/artistid/hts_img/showtime/musiccnt）
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      // [v1.1.0 fix S-4] searchMusicBykeyWord 的 pn 为 0 起始（与 searchKuwo 主路径同口径），补减 1
      all: q, pn: page - 1, rn: SEARCH_PAGE_SIZE, ft: 'album', client: 'kt',
      encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, strategy: 2012, correct: 1, newver: 2
    },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = parseKwBody(res.data, 'albumlist');
    var list = (body && body.albumlist) || [];
    return list.map(function (it) {
      return {
        source: 'kuwo', sid: str(it.albumid || it.id),
        title: str(it.name || it.falbum),
        artist: str(it.artist || it.fartist),
        artwork: it.hts_img ? String(it.hts_img).replace('/240/', '/500/') : '',
        date: str(it.showtime || it.pub),
        worksNum: parseInt(it.musiccnt, 10) || 0,
        raw: { albumid: str(it.albumid || it.id) }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
function searchSheetKuwo(q, page) {
  return kuwoRsSearch('playlist', q, page).then(function (list) {
    return list.map(function (it) {
      var pid = str(it.playlistid || it.id);
      return {
        source: 'kuwo', sid: pid,
        title: stripEm(str(it.name || it.title || it.playlistname)),
        artist: str(it.username || it.nick || ''),
        artwork: str(it.pic || it.img || ''),
        worksNum: parseInt(it.songnum || it.num, 10) || 0,
        raw: { listId: pid }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
var ALBUM_SEARCH_ADAPTERS = {
  kuwo: searchAlbumKuwo // v0.7.0：酷我搜索接口免登录可通（searchMusicBykeyWord ft=album）
};
var SHEET_SEARCH_ADAPTERS = {
  kuwo: searchSheetKuwo
};

// ---------- 歌手搜索（v1.2.5 新增）----------
// 根因：v1.2.4 supportedSearchType 未声明 'artist'，宿主 getSearchablePlugins('artist') 按
// supportedSearchType 过滤插件后歌手搜索根本不会调到本插件；且 search() 对非 music/album/sheet
// 类型也恒返回空 → 歌手搜索恒无结果。
// 接口实测（2026-09-07 沙箱探针）：search.kuwo.cn/r.s ft=artist itemset=web_2013 免登录可通，
// 「周杰伦」TOTAL=67，条目字段 ARTISTID/ARTIST/hts_PICPATH(全头像 URL)/desc/SONGNUM 齐全
// （实现参照社区版 baka-plugins v1.1.1 searchArtist；字段对齐宿主 IArtist：id/name/avatar/worksNum）。
function searchArtistKuwo(q, page) {
  return axios.get('https://search.kuwo.cn/r.s', {
    params: { all: q, ft: 'artist', itemset: 'web_2013', client: 'kt',
      pn: page - 1, rn: SEARCH_PAGE_SIZE, rformat: 'json', encoding: 'utf8', pcjson: 1 },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = parseKwBody(res.data, 'abslist');
    var list = (body && body.abslist) || [];
    return list.map(function (it) {
      var aid = str(it.ARTISTID);
      var pic = str(it.hts_PICPATH) || (str(it.PICPATH) ? 'http://img1.kuwo.cn/star/starheads/' + str(it.PICPATH) : '');
      return {
        source: 'kuwo', sid: aid,
        title: stripEm(str(it.ARTIST)),
        avatar: pic,
        description: str(it.desc),
        worksNum: parseInt(it.SONGNUM, 10) || 0,
        raw: { artistid: aid }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
var ARTIST_SEARCH_ADAPTERS = {
  kuwo: searchArtistKuwo
};
function artistKeyOf(it) {
  return normalizeArtist(it.title);
}
function buildArtistSearchItem(group, seq) {
  var members = group.members;
  var best = bestMember(members);
  var avatar = best.avatar, description = best.description, worksNum = best.worksNum;
  for (var i = 0; i < members.length; i++) {
    if (!avatar && members[i].avatar) avatar = members[i].avatar;
    if (!description && members[i].description) description = members[i].description;
    if (!worksNum && members[i].worksNum) worksNum = members[i].worksNum;
  }
  return {
    id: best.source + '~ar~' + best.sid,
    platform: 'kuwo',
    name: best.title,
    avatar: avatar || undefined,
    artistId: best.sid,
    worksNum: worksNum || 0,
    description: description || '',
    _arsrc: srcMapOf(members)
  };
}

// ---------- 歌手详情（v1.2.7 新增）----------
// 宿主歌手页 header（artistDetail/components/header.tsx）渲染 avatar/name/worksNum/description/fans，
// 其中 fans 是 v1.2.5 搜索条目唯一缺的字段（r.s ft=artist 无粉丝数）。宿主无独立歌手详情插件方法
// （plugin.d.ts 仅 getArtistWorks），header 拿的就是 search('artist') 返回的 artistItem，
// 所以 fans 必须在搜索阶段补齐（enrichArtistFans）；getArtistDetail 作为显式详情方法供协议完整性。
// 端点：官方 web 端 GET https://www.kuwo.cn/api/www/artist/artistInfo?id=<artistid>
//   要求 csrf 头与 kw_token cookie 配对（复用 kuwoWapiHeaders，与 wapi 域同构造），
//   社区标准口径返回 data: { id, name, pic300, fans, musicNum, albumNum, mvNum, introduction }。
//   沙箱实测（2026-09-07）：www 域被数据中心 IP 风控（"The request is illegal!"，同域 musicInfo
//   同样被拦）；真机家宽/移动 IP 预期可用，需装机验证。wapi 同路径实测为忽略参数的固定热门列表，
//   m.kuwo.cn / wapi artistDesc 均 404，无沙箱内可用替代端点——失败一律静默降级，宁缺勿造。
var ARTIST_DETAIL_TIMEOUT = 2500;
var ARTIST_DETAIL_ENRICH_BUDGET = 8;  // 搜索结果最多补前 N 个歌手（首屏可见范围）
var ARTIST_DETAIL_CONCURRENCY = 4;
var ARTIST_INFO_CACHE_TTL = 5 * 60 * 1000;
var ARTIST_INFO_CACHE = {}; // aid -> { t: Date.now(), v: normalizedInfo | null }（null 负缓存：风控期同 id 不复打）
var ARTIST_INFO_BREAKER = { fails: 0, until: 0 }; // 全局熔断：连续失败 ≥3 → TTL 内全跳过，防风控期拖慢搜索
var ARTIST_INFO_BREAKER_THRESHOLD = 3;

function normalizeArtistInfo(data) {
  if (!data || typeof data !== 'object') return null;
  var fans = parseInt(data.fans, 10);
  var musicNum = parseInt(data.musicNum, 10);
  var albumNum = parseInt(data.albumNum, 10);
  var mvNum = parseInt(data.mvNum, 10);
  return {
    name: str(data.name) || '',
    avatar: str(data.pic300) || str(data.pic) || '',
    fans: isNaN(fans) ? 0 : fans,
    musicNum: isNaN(musicNum) ? 0 : musicNum,
    albumNum: isNaN(albumNum) ? 0 : albumNum,
    mvNum: isNaN(mvNum) ? 0 : mvNum,
    description: str(data.introduction) || ''
  };
}

async function fetchKuwoArtistInfo(aid) {
  // 全局熔断期内直接抛（连续 ≥3 次失败后 5 分钟不再打点，搜索零额外延迟）
  if (Date.now() < ARTIST_INFO_BREAKER.until) {
    throw new Error('artistInfo 熔断期内跳过');
  }
  var hit = ARTIST_INFO_CACHE[aid];
  if (hit && Date.now() - hit.t < ARTIST_INFO_CACHE_TTL) {
    if (hit.v === null) throw new Error('artistInfo 负缓存命中');
    return hit.v;
  }
  try {
    var res = await axios.get('https://www.kuwo.cn/api/www/artist/artistInfo', {
      params: { id: aid, httpsStatus: 1, reqId: Date.now() },
      timeout: ARTIST_DETAIL_TIMEOUT,
      headers: kuwoWapiHeaders()
    });
    var body = res.data;
    // 官方成功响应 {code:200, data:{...}}；风控拦截返回 {success:false, message:'...'}（HTTP 200）
    if (!body || body.code !== 200 || !body.data) {
      throw new Error('artistInfo 响应异常: ' + str(body && (body.message || body.msg)));
    }
    var info = normalizeArtistInfo(body.data);
    ARTIST_INFO_CACHE[aid] = { t: Date.now(), v: info };
    ARTIST_INFO_BREAKER.fails = 0;
    return info;
  } catch (e) {
    // 负缓存 + 熔断计数：风控/超时不阻断搜索主路径，且短时间内不再重复打点
    ARTIST_INFO_CACHE[aid] = { t: Date.now(), v: null };
    ARTIST_INFO_BREAKER.fails++;
    if (ARTIST_INFO_BREAKER.fails >= ARTIST_INFO_BREAKER_THRESHOLD) {
      ARTIST_INFO_BREAKER.until = Date.now() + ARTIST_INFO_CACHE_TTL;
    }
    throw e;
  }
}

// 搜索歌手结果并发补 fans（原地写条目，静默忽略单条失败；res = { isEnd, data }）
async function enrichArtistFans(res, budget) {
  var list = (res && res.data) || [];
  var targets = [];
  for (var i = 0; i < list.length && targets.length < (budget || ARTIST_DETAIL_ENRICH_BUDGET); i++) {
    var aid = str(list[i] && list[i].artistId).replace(/^[a-z]+~ar~/, '');
    if (aid && !(list[i].fans > 0)) targets.push({ item: list[i], aid: aid });
  }
  for (var k = 0; k < targets.length; k += ARTIST_DETAIL_CONCURRENCY) {
    var wave = targets.slice(k, k + ARTIST_DETAIL_CONCURRENCY);
    await Promise.all(wave.map(function (t) {
      return fetchKuwoArtistInfo(t.aid).then(function (info) {
        if (info && info.fans > 0) t.item.fans = info.fans;
      }).catch(function () { /* 风控/超时静默：不阻断搜索主路径 */ });
    }));
  }
  return res;
}

// getArtistDetail：宿主 IArtistItemBase 对齐（id/name/platform/avatar/fans?/description?/worksNum）
// 上游失败时回退传入条目自带字段（宁缺勿造，绝不编 fans）
async function getArtistDetailImpl(artistItem) {
  if (!artistItem) throw new Error('missing artistItem');
  var aid = str(artistItem.artistId || artistItem.id).replace(/^[a-z]+~ar~/, '');
  var base = {
    id: str(artistItem.id) || (aid ? 'kuwo~ar~' + aid : ''),
    platform: 'kuwo',
    name: str(artistItem.name || artistItem.title) || '',
    avatar: str(artistItem.avatar) || undefined,
    description: str(artistItem.description) || '',
    worksNum: parseInt(artistItem.worksNum, 10) || 0,
    artistId: aid || undefined
  };
  if (artistItem.fans > 0) base.fans = artistItem.fans;
  if (!aid) return base;
  try {
    var info = await fetchKuwoArtistInfo(aid);
    if (info) {
      if (info.name) base.name = info.name;
      if (info.avatar) base.avatar = info.avatar;
      if (info.fans > 0) base.fans = info.fans;
      if (info.description) base.description = info.description;
      if (info.musicNum > 0) base.worksNum = info.musicNum;
      base.musicNum = info.musicNum;
      base.albumNum = info.albumNum;
      base.mvNum = info.mvNum;
    }
  } catch (e) { /* 上游不可达（沙箱风控/真机偶发）→ 回退传入字段 */ }
  return base;
}

// ---------- 歌手作品（v1.2.5 新增）----------
// 歌手搜索修好后宿主歌手详情页会调 getArtistWorks（plugin.ts:1033 → artistDetail/useQuery.ts:35），
// 不实现则点进歌手仍是死胡同。接口实测（2026-09-07 沙箱探针，artistid=336 周杰伦）：
// stype=artist2music → total=706，musiclist 字段 musicrid/name/artist/album/albumid/duration；
// stype=albumlist → total=39，albumlist 字段 albumid/name/artist/hts_img/img/pub。免登录可通。
// 歌曲条目带单源 _src（buildSheetItem 复用），播放走插件自身取链接力；专辑条目带 _asrc，
// 详情走 getAlbumInfoImpl 同一链路。
var ARTIST_WORKS_PAGE_SIZE = 30;
var ARTIST_WORKS_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
async function getArtistWorksImpl(artistItem, page, type) {
  var isAlbum = type === 'album';
  var aid = str(artistItem && (artistItem.artistId || artistItem.id)).replace(/^[a-z]+~ar~/, '');
  if (!aid) throw new Error('歌手条目缺少 artistId，无法拉取作品');
  var pn = (page || 1) - 1;
  var res = await axios.get('https://search.kuwo.cn/r.s', {
    params: {
      pn: pn, rn: ARTIST_WORKS_PAGE_SIZE, artistid: aid,
      stype: isAlbum ? 'albumlist' : 'artist2music', sortby: isAlbum ? 1 : 0,
      alflac: 1, show_copyright_off: 1, pcmp4: 1, encoding: 'utf8', plat: 'pc',
      thost: 'search.kuwo.cn', vipver: 'MUSIC_9.1.1.2_BCS2', devid: '38668888', newver: 1, pcjson: 1
    },
    timeout: SOURCE_TIMEOUT, headers: ARTIST_WORKS_HEADERS
  });
  var d = res.data || {};
  var total = Number(d.total) || 0;
  if (isAlbum) {
    var albums = (d.albumlist || []).map(function (it) {
      var alid = str(it.albumid || it.id);
      var img = str(it.hts_img) || (str(it.img) ? 'https://img1.kuwo.cn/star/albumcover/' + str(it.img).replace('/120/', '/500/') : '');
      return {
        id: 'kuwo~al~' + alid,
        platform: 'kuwo',
        title: stripEm(str(it.name || it.falbum)),
        artist: str(it.artist || it.fartist),
        artwork: img,
        date: str(it.pub || ''),
        worksNum: 0,
        description: '',
        _asrc: { kuwo: { albumid: alid } }
      };
    }).filter(function (it) { return it.id.indexOf('kuwo~al~') === 0; });
    return { isEnd: albums.length < ARTIST_WORKS_PAGE_SIZE || (pn + 1) * ARTIST_WORKS_PAGE_SIZE >= total, data: albums };
  }
  var entries = (d.musiclist || []).map(function (it) {
    var rid = str(it.musicrid).replace(/^MUSIC_/, '');
    var pic = str(it.web_albumpic_short);
    return {
      source: 'kuwo', sid: rid,
      title: stripEm(str(it.name)),
      artist: str(it.artist),
      album: str(it.album),
      duration: Number(it.duration) || 0,
      artwork: pic ? 'https://img1.kuwo.cn/star/albumcover/' + pic.replace('/120/', '/500/') : '',
      raw: { rid: rid, N_MINFO: str(it.N_MINFO), mv: mvVidOf(it), mvArtwork: mvPicOf(it) } // [v1.3.0] 歌单搜索入口；[v1.4.3] N_MINFO 透传
    };
  }).filter(function (it) { return it.sid && it.title; });
  var items = entries.map(buildSheetItem);
  // r.s artist2music 不保证条目带封面，走 rid_pic 反查兜底（与歌单路径同口径，cap 24 控首屏耗时）
  await enrichArtwork(items, 24);
  return { isEnd: entries.length < ARTIST_WORKS_PAGE_SIZE || (pn + 1) * ARTIST_WORKS_PAGE_SIZE >= total, data: items };
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
    platform: 'kuwo',
    title: best.title, artist: best.artist,
    artwork: artwork || undefined,
    date: date || undefined,
    worksNum: worksNum || undefined,
    description: '',
    _asrc: srcMapOf(members)
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
    platform: 'kuwo',
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

function sheetKeyOf(it) {
  return normalizeTitle(it.title);
}
async function aggregateSearchBy(adapterMap, q, page, keyOf, buildItem) {
  var names = Object.keys(adapterMap);
  var tasks = names.map(function (n) {
    return adapterMap[n](q, page).catch(function (e) {
      if (typeof process !== 'undefined' && process.env && process.env.AG_DEBUG) console.error('[adapter:' + n + '] ' + String((e && e.message) || e).slice(0, 200)); // [v1.1.0 fix M-6] RN/Hermes 无 process 全局，裸引用会 ReferenceError
      return [];
    });
  });
  var settled = await Promise.all(tasks);
  if (typeof process !== 'undefined' && process.env && process.env.AG_DEBUG) {
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
  // [v1.1.0 fix O-2] 去掉按 artwork/worksNum 的重排序：单源场景排序键恒等价、纯打乱 r.s 相关性序，
  // 恢复上游搜索序（含 em 高亮原序）
  return { isEnd: all.length < SEARCH_PAGE_SIZE, data: data }; // [v1.1.0 fix O-3] isEnd 按上游返回量精判
}

// ==================== v0.5.0 追加段 B：详情解析 / MV ====================
// 端点出自《六平台接口文档（实测整合版）》酷我部分，并经 2026-09-05 探针复核：
// - 酷我：r.s ft=video(文档 9.3.2) + anymatch api/mv/play(文档 11.2，6画质免登录，仅需 f/type/vid/quality) [探针 kw_rs_video/kw_mv_play]

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
function sheetSearchItemFromEntry(e) { return buildSheetSearchItem({ members: [e] }, 0); }

// ---------- 专辑详情 ----------
var ALBUM_DETAIL = {
  kuwo: async function (raw) {
    // v0.7.0 P1-10：酷我专辑详情（wapi albumInfo，kw_token 免登录实测可通，artifacts/v07-probe）
    // [v1.1.0 fix M-3] v1.0.0 固定 rn=100 单页即 isEnd（>100 首专辑假截断）；改为按 total 翻页
    // 循环（单页 rn=100，最多 3 页 = 300 首，插件方法 10s 硬上限内的保护性封顶）
    var PAGE = 100, MAX_PAGES = 3;
    var all = [], meta = null;
    for (var p = 0; p < MAX_PAGES; p++) {
      var res = await axios.get('https://wapi.kuwo.cn/api/www/album/albumInfo', {
        params: { albumId: raw.albumid, pn: p + 1, rn: PAGE, httpsStatus: 1, reqId: Date.now() },
        timeout: SOURCE_TIMEOUT, headers: kuwoWapiHeaders()
      });
      var d = res.data && res.data.data;
      if (!d) throw new Error('kuwo albumInfo empty');
      var al = d.album || d;
      var list = d.musicList || d.list || [];
      if (!meta) meta = { al: al, total: Number(al.total) || 0 };
      all = all.concat(list);
      if (list.length < PAGE) break;
      if (meta.total && all.length >= meta.total) break;
    }
    var al2 = meta.al, total2 = meta.total;
    return {
      albumItem: {
        title: str(al2.name || al2.albumname || ''),
        artist: str(al2.artist || al2.artistname || ''),
        artwork: str(al2.pic || al2.img || al2.imgurl || ''),
        date: str(al2.releaseDate || al2.pub || ''),
        worksNum: total2 || all.length
      },
      entries: all.map(function (it) {
        var rid = str(it.rid || it.musicrid || '').replace(/^MUSIC_/, '');
        return {
          source: 'kuwo', sid: rid,
          title: str(it.name || it.songname || ''),
          artist: str(it.artist || it.artistname || ''),
          album: str(it.album || al.name || ''),
          duration: Number(it.duration) || 0,
          artwork: str(it.pic || it.hts_img || it.img || ''),
          raw: { rid: rid, albumid: raw.albumid, N_MINFO: str(it.N_MINFO), mv: mvVidOf(it), mvArtwork: mvPicOf(it) } // [v1.3.0]；[v1.4.3] N_MINFO 透传
        };
      }).filter(function (it) { return it.sid; })
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
      await enrichKuwoQualities(musicList, 60); // [v1.9.5] 专辑页音质补齐（wapi 无 N_MINFO）
      await enrichArtwork(musicList, 60);
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
      await enrichKuwoQualities(musicList, 60); // [v1.9.5] 歌手作品页音质补齐（缺 N_MINFO 的条目）
      await enrichArtwork(musicList, 60);
      return { isEnd: true, sheetItem: sheetItem, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('歌单详情获取失败');
}

// ---------- MV 取链 ----------
// [v1.3.0] 画质对齐 baka 酷我 5 档（240p~1080p，补 360p=MP4 档）；按权重做「歌名+歌手严格匹配」
// 的 MV 搜索（宁缺毋滥，匹配不上不返回）。返回格式对齐宿主 IVideoSourceResult：
// url/headers/userAgent/videoQuality/mimeType/bitrate/availableVideoQualities/duration。
var MV_QUALITY_ORDER = ['240p', '360p', '480p', '720p', '1080p'];
// anymatch 请求档映射（baka KUWO_MV_REQUEST_QUALITY 其 L28-34；360p 请求档为 MP4）
var MV_ANYMATCH_QUALITY = ['MP4L', 'MP4', 'MP4HV', 'MP4UL', 'MP4BD'];
// 响应档回读映射：api/mv/play 实测回 quality=MP4BD；baka 对 SMP4xx 剥前导 S（其 L937-941）
function mvResponseQualityIdx(code) {
  return MV_ANYMATCH_QUALITY.indexOf(String(code || '').trim().toUpperCase().replace(/^S(?=MP4)/, ''));
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
  kuwo: async function (musicItem, qIdx) {
    // 兜底：r.s ft=video 搜索（探针 kw_rs_video）→ anymatch 取链（文档 11.2）
    // [v1.1.0 fix] r.s ft=video 实测字段为大写 SONGNAME/ARTIST（小写 name/artist 缺失，
    // probe2 rs_video2 证实），v1.0.0 匹配器用小写字段恒 miss —— 补大写字段兼容；
    // [v1.1.0 fix M-4] anymatch 单档请求失败改为逐级降级重试，并以响应 quality 回读实际档；
    // [v1.1.0 fix M-5] anymatch http→https（实测 https 可用，规避明文劫持）
    var q = musicItem.artist + ' ' + musicItem.title;
    var res = await kuwoRsSearch('video', q, 1);
    var hit = strictMvMatch(res, musicItem.title, musicItem.artist,
      function (x) { return x.SONGNAME || x.name; }, function (x) { return x.ARTIST || x.artist; });
    if (!hit || !hit.vid) return null;
    return fetchAnyMatchUrl(hit.vid, qIdx, musicItem); // [v1.3.0] 透传 musicItem（duration 进返回体）
  }
};

// [v1.3.0] 统一 MV 返回构造：对齐宿主 IVideoSourceResult（plugin.d.ts L36-58）与 baka 酷我
// 返回形态（其 L941-957）：url/headers/userAgent/videoQuality/mimeType/bitrate/
// availableVideoQualities/duration。headers 带 Referer+UA（宿主 video 播放器加载 CDN 直链用）。
var MV_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1';
var MV_QUALITY_HEIGHT = { '240p': 240, '360p': 360, '480p': 480, '720p': 720, '1080p': 1080 };

function mvSourceResultOf(url, qIdx, format, bitrateKbps, musicItem) {
  var q = MV_QUALITY_ORDER[qIdx >= 0 ? qIdx : 2];
  var dur = Number(musicItem && musicItem.duration);
  var br = Number(bitrateKbps);
  var qh = MV_QUALITY_HEIGHT[q];
  return {
    url: String(url),
    headers: { Referer: 'https://kuwo.cn/', 'User-Agent': MV_UA },
    userAgent: MV_UA,
    videoQuality: q,
    mimeType: format && String(format).toLowerCase() !== 'mp4' ? undefined : 'video/mp4',
    bitrate: br > 0 ? Math.round(br * 1000) : undefined, // 上游为 kbps（mobi.s bitrate=3000 实测），宿主按 bps
    // [v1.8.0 P1-2] width/height 派生：上游 anymatch/mobi.s 不带显式宽高，按 16:9 从 height 派生
    // （宿主 UI 进度条/画布需要宽高比，对齐 MusicFree v1.0.0 IVideoSourceResult 15 字段）
    width: qh ? Math.round(qh * 16 / 9) : undefined,
    height: qh,
    // [v1.8.0 P1-4] codec 字段位置保留（anymatch/mobi.s 上游不返编码信息，宁缺毋假）
    codec: undefined,
    // [v1.9.6 MV 画质表修复] 声明表从「单实档」改为 baka 同款 5 档全 ladder（240p~1080p）：
    // 2026-09-11 复验实测——酷我 anymatch 对声明仅 480p 的 MV 请求 1080p 也能取到真实
    // 1080p 出流，单档声明导致宿主画质菜单只有一个选项、无法切档。取链仍逐级降级并
    // 回读实档（顶层 videoQuality=实际档），档位诚实性不受影响。
    availableVideoQualities: MV_QUALITY_ORDER.map(function (qk) {
      var kh = MV_QUALITY_HEIGHT[qk];
      return {
        key: qk, label: qk,
        width: kh ? Math.round(kh * 16 / 9) : undefined,
        height: kh,
        mimeType: 'video/mp4'
      };
    }),
    duration: dur > 0 ? dur : undefined
  };
}

// mobi.s 文本协议响应解析（baka parseKuwoMvResponse 其 L871-884）：多行 key=value 文本
// （2026-09-07 探针实测：format=mp4\nbitrate=3000\nurl=http://kw-bj.kuwo.cn/...）
function parseMvTextResponse(txt) {
  var out = {};
  String(txt || '').split(/\r?\n/).forEach(function (line) {
    var i = line.indexOf('=');
    if (i <= 0) return;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return out;
}

// 通道 A：anymatch api/mv/play JSON（v1.1.0 起主通道，2026-09-07 复测 200 + MP4BD 档回读）
async function requestMvByVidJson(vid, qualityCode) {
  var r = await axios.get('https://anymatch.kuwo.cn/api/mv/play', {
    params: { f: 'web', type: 'get_url_by_vid', vid: vid, quality: qualityCode },
    timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': MV_UA }
  });
  var dd = r.data && r.data.data;
  if (!dd || !dd.url) return null;
  return { url: String(dd.url), qIdx: mvResponseQualityIdx(dd.quality), format: dd.format, bitrate: Number(dd.bitrate) || 0 };
}

// 通道 B：anymatch mobi.s 文本协议（baka requestKuwoMvSourceByVid 其 L903-933，端点
// https://anymatch.kuwo.cn/mobi.s，多参数形态照抄；2026-09-07 探针实测 200 text/plain 可解析）
async function requestMvByVidText(vid, qualityCode) {
  var r = await axios.get('https://anymatch.kuwo.cn/mobi.s', {
    params: {
      f: 'web', prod: 'kwplayer_ar_12.1.6.0', corp: 'kuwo', newver: 3, vipver: '12.1.6.0',
      source: 'kwplayer_ar_12.1.6.0_40.apk', p2p: 1, approval: false, allpay: 1, notrace: 0,
      vipMode: 0, type: 'get_url_by_vid', vid: vid, quality: qualityCode,
      secureScreen: 1, short_mv: 1, p2pid: 1, h265: 1
    },
    timeout: SOURCE_TIMEOUT, transformResponse: function (v) { return v; }, // 保留原始文本（默认 JSON 解析会碎）
    headers: { 'User-Agent': MV_UA, 'Accept-Encoding': 'gzip' }
  });
  var kv = parseMvTextResponse(r.data);
  if (!kv.url) return null;
  return { url: String(kv.url), qIdx: mvResponseQualityIdx(kv.quality), format: kv.format, bitrate: Number(kv.bitrate) || 0 };
}

// [v1.1.0 fix S-2/M-4] anymatch 取链共用 helper：给定 vid 从请求档逐级降级，回读实际档；
// [v1.3.0] 每档内双通道接力（JSON api → mobi.s 文本），任一命中即返回统一 IVideoSourceResult。
async function fetchAnyMatchUrl(vid, qIdx, musicItem) {
  if (qIdx < 0 || qIdx >= MV_QUALITY_ORDER.length) qIdx = 2;
  var chans = [requestMvByVidJson, requestMvByVidText];
  for (var qi = qIdx; qi >= 0; qi--) {
    var code = MV_ANYMATCH_QUALITY[qi];
    for (var ci = 0; ci < chans.length; ci++) {
      try {
        var hit = await chans[ci](vid, code);
        if (hit && hit.url) {
          return mvSourceResultOf(hit.url, hit.qIdx >= 0 ? hit.qIdx : qi, hit.format, hit.bitrate, musicItem);
        }
      } catch (e) { /* 本档本通道失败，切下一通道 / 下一档 */ }
    }
  }
  return null;
}

// [v1.3.0] baka 同款旧版 playUrl 按 songId 兜底（其 requestKuwoLegacyMvSource L960-982）：
// vid 不可用（缺/"0"/接口全挂）时按歌曲 rid 走 kuwo.cn/api/v1/www/music/playUrl?type=mv。
// headers 照抄 baka L19-24（Secret/Cookie 为 baka 硬编码值；2026-09-07 探针实测 200 code=200）。
// [v1.6.0 P2-4 死链核查] 调研报告称 www playUrl 备用链已死——2026-09-08 实测 MV 分支
// （mid=228908m&type=mv）200 code=200 带 url，接口存活，按证据保留不移除。
// 注：报告所指可能为歌曲播放分支（type=music 已被 convert_url 系列取代），本插件未使用该分支。
var KUWO_MV_LEGACY_HEADERS = {
  'Secret': '5470ccb31c2e253cf173fea957bd5e544d0b4f6e54f88190868a0817094e920000224d1a',
  'Cookie': 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324=w6nWhWQm4y2cTbFFcXi5Xxa3KtXKnjzS',
  'Referer': 'https://kuwo.cn/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

async function requestKuwoLegacyMvSource(songId, musicItem) {
  if (!songId) return null;
  var r = await axios.get('https://kuwo.cn/api/v1/www/music/playUrl', {
    params: { mid: songId, type: 'mv', httpsStatus: 1 },
    headers: KUWO_MV_LEGACY_HEADERS, timeout: SOURCE_TIMEOUT
  });
  var url = r.data && r.data.data && r.data.data.url;
  if (!url) return null;
  // 响应无档位字段；沿用 baka 的保守标注 360p（宁低勿高——实测资源路径 /le/resource/m2
  // 与 MP4BD 同形态，但上游不回档位，不虚标高档）
  return mvSourceResultOf(url, 1, 'mp4', 0, musicItem);
}

// [v1.3.0] baka getKuwoSongId 对齐（其 L890-901）：候选 mvSongId → _src.kuwo.rid → id 剥前缀。
// 本插件条目 id 形如 "kuwo_228908"（source_sid），剥 kuwo_/MUSIC_ 前缀后须为纯数字才采信。
function getKuwoSongIdOf(musicItem) {
  if (!musicItem) return '';
  var cands = [musicItem.mvSongId];
  if (musicItem._src && musicItem._src.kuwo) cands.push(musicItem._src.kuwo.rid);
  cands.push(str(musicItem.id).replace(/^kuwo_/, '').replace(/^MUSIC_/, ''));
  for (var i = 0; i < cands.length; i++) {
    var v = str(cands[i]).trim();
    if (v && v !== '0' && /^\d+$/.test(v)) return v;
  }
  return '';
}

async function getMvSourceImpl(musicItem, videoQuality) {
  // [v1.2.9] 去掉 !musicItem._src 硬前置：主路径读顶层 mv/videoId 直连 anymatch、
  // 兜底走 r.s ft=video 搜索，均不依赖 _src；该前置只让「缺 _src 但带 mv」的条目
  // （备份恢复/跨端迁移字段丢失场景）连兜底都不执行，MV 整体失效。
  // [v1.3.0] 兜底链对齐 baka getMvSource（其 L1014-1033）三段式：
  // ① vid 直连 anymatch 双通道（候选 mvId/mv/mvid/mvVid，baka getKuwoMvId 同口径）
  // ② 旧版 playUrl 按 songId 兜底（vid 缺失/"0"/接口全挂时覆盖）
  // ③ r.s ft=video 严格匹配搜索兜底（v1.1.0 起自有增强，baka 无此路）
  if (!musicItem) return null;
  var qKey = videoQuality && typeof videoQuality === 'string' ? videoQuality : (videoQuality && videoQuality.key) || '480p';
  var qIdx = MV_QUALITY_ORDER.indexOf(qKey);
  if (qIdx < 0) qIdx = 2; // [v1.3.0] 默认 480p（360p 插入后索引 1→2）
  // ① 已知 vid 直连（getMusicInfo 已补齐的 mv/mvId/videoId）
  var knownVid = mvVidVal(musicItem.mvId) || mvVidVal(musicItem.mv)
    || mvVidVal(musicItem.mvid) || mvVidVal(musicItem.mvVid)
    || mvVidVal(musicItem.videoId);
  if (knownVid && /^\d+$/.test(knownVid)) {
    try {
      var direct = await fetchAnyMatchUrl(knownVid, qIdx, musicItem);
      if (direct) {
        // [v1.8.0 P1-1] videoQuality 写回 musicItem.videoQuality
        if (direct.videoQuality && !musicItem.videoQuality) {
          try { musicItem.videoQuality = direct.videoQuality; } catch (e) { /* frozen */ }
        }
        return direct;
      }
    } catch (e) { /* 直连失败走 songId 兜底 */ }
  }
  // ② [v1.3.0] 旧版 playUrl 按 songId 兜底（baka L960-982 同款）
  try {
    var legacy = await requestKuwoLegacyMvSource(getKuwoSongIdOf(musicItem), musicItem);
    if (legacy) {
      if (legacy.videoQuality && !musicItem.videoQuality) {
        try { musicItem.videoQuality = legacy.videoQuality; } catch (e) { /* frozen */ }
      }
      return legacy;
    }
  } catch (e) { /* legacy 失败走搜索兜底 */ }
  // ③ 兜底：严格匹配的 MV 搜索（酷我 r.s ft=video → anymatch）
  var fallbacks = ['kuwo'];
  for (var i = 0; i < fallbacks.length; i++) {
    var fn = MV_SOURCE[fallbacks[i]];
    try {
      var r3 = await fn(musicItem, qIdx);
      if (r3) {
        if (r3.videoQuality && !musicItem.videoQuality) {
          try { musicItem.videoQuality = r3.videoQuality; } catch (e) { /* frozen */ }
        }
        return r3;
      }
    } catch (e) { /* 接力下一源 */ }
  }
  return null;
}

// ---------- 歌曲评论 ----------
// [v1.5.0] 旧结论作废：ncomment com.s 已死（code=600），改接海棠代理评论通道
// （GET https://music.haitangw.cc/pinglun/kwpl.php?songmid={rid}&page={pn}，实测 200：
//   {code:200,data:{source:'kw',comments:[{id,text,time(epoch s),timeStr,userName,avatar,userId,likedCount,images,reply}],total,page,limit,maxPage,type}}）

// ==================== v1.5.0 追加段：逐字歌词（lrcx→QRC + 酷狗 KRC 跨源接力） / 评论 / 分享链接 ====================

// ---------- ① 酷我原生 lrcx 逐字歌词（newlyric.lrc） ----------
// 文档 §2.5 解密链（probe_lrcx.py 沙箱实测口径）：请求参数 XOR("yeelion")+Base64 → POST newlyric.lrc（body: p=<enc>）
// → 响应 `tp=content\r\n\r\n` 头之后为 zlib 压缩体 → inflate → Base64 → XOR(yeelion) → gb18030 文本
// → 行格式 `[start,dur]<rel,dur,0>词`（KRC 同构，parseKrcForHost 直转 QRC）。
// 注意：沙箱机房 IP 实测被上游风控（tp=DENY REQUEST），设备端 IP 可能放行；失败自动降级酷狗 KRC 接力。
// 与 kuwoEncryptQuery（DES 链）不同：本通道参数加密只有 XOR+Base64，无 DES。
var YEELION_KEY = 'yeelion';
function xorYeelion(bytes) {
  var out = new Array(bytes.length);
  for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ YEELION_KEY.charCodeAt(i % YEELION_KEY.length);
  return out;
}
function encLrcxParams(params) {
  return kwBase64(xorYeelion(utf8Bytes(params)));
}
// [v1.6.0 P1-2] lrcx 响应解码抽公共实现：tp=content 帧 + \r\n\r\n 分隔 + zlib inflate +
// 二段 Base64/XOR + GB18030（POST/GET 两通道共用同一解密链）
function lrcxDecode(buf) {
  var head = bytesToUtf8(buf.subarray(0, 10));
  if (head.indexOf('tp=content') !== 0) {
    throw new Error('lrcx upstream deny (' + head.replace(/[^A-Za-z0-9=]/g, ' ').trim() + ')');
  }
  // 找 \r\n\r\n 分隔：其后才是 zlib 压缩歌词体
  var sep = -1;
  for (var i = 0; i + 4 <= buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) { sep = i; break; }
  }
  if (sep < 0) throw new Error('lrcx bad frame');
  var pako = require('pako'); // 宿主 require 白名单含 pako（酷狗插件同款）
  var inflated = pako.inflate(buf.subarray(sep + 4));
  // 二段解密：inflate 产物 = Base64(XOR(gb18030 歌词文本))
  var b64 = bytesToUtf8(inflated).replace(/[^A-Za-z0-9+/=]/g, '');
  var payload = Uint8Array.from(xorYeelion(base64ToBytes(b64)));
  var text = '';
  try {
    if (typeof TextDecoder !== 'undefined') text = new TextDecoder('gb18030').decode(payload);
    else throw new Error('no TextDecoder');
  } catch (e) {
    text = bytesToUtf8(payload); // 兜底：UTF-8 解码（纯 ASCII 歌名行不乱，中文行可能有损但不阻断）
  }
  if (!text) throw new Error('lrcx decode empty');
  return text;
}

// [v1.6.0 P1-2] 双通道：POST 首选（v1.5.0 形态）；POST 失败或风控拒绝（TP=DENY）时降级 GET 通道
// （go-music-dl 同款形态 `newlyric.lrc?<enc(params)>`，2026-09-08 沙箱实测 GET 通道可通、POST 曾 TP=DENY）
async function fetchKuwoLrcx(rid) {
  if (!rid) throw new Error('lrcx no rid');
  var body = encLrcxParams('user=12345,web,web,web&requester=localhost&req=1&rid=MUSIC_' + rid + '&lrcx=1');
  var errs = [];
  try {
    var resp = await axios.post('http://newlyric.kuwo.cn/newlyric.lrc', 'p=' + encodeURIComponent(body), {
      timeout: LYRIC_TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: 'https://www.kuwo.cn/'
      },
      responseType: 'arraybuffer'
    });
    return lrcxDecode(new Uint8Array(resp.data));
  } catch (e) { errs.push('post: ' + String(e && e.message).slice(0, 60)); }
  try {
    var resp2 = await axios.get('http://newlyric.kuwo.cn/newlyric.lrc?' + body, {
      timeout: LYRIC_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: 'https://www.kuwo.cn/'
      },
      responseType: 'arraybuffer'
    });
    return lrcxDecode(new Uint8Array(resp2.data));
  } catch (e) { errs.push('get: ' + String(e && e.message).slice(0, 60)); }
  throw new Error('lrcx both channels failed (' + errs.join(' | ') + ')');
}

// ---------- ② KRC 解码与 QRC 解析（移植自酷狗插件 v1.4.1 同名实现，宿主零改动） ----------
var KRC_XOR_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];
var B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(input) {
  // 与 Buffer.from(str,'base64') 对齐的宽容策略：剥离所有非 alphabet 字符（含 U+FEFF BOM）
  var s = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
  var out = new Uint8Array(Math.floor(s.length * 3 / 4) + 3);
  var n = 0, bits = 0, acc = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '=') break; // padding 之后无数据
    var v = B64_ALPHABET.indexOf(ch);
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
function bytesToUtf8(bytes) {
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
function decodeKrc(base64Content) {
  var pako = require('pako');
  var raw = base64ToBytes(base64Content);
  var off = -1;
  for (var k = 0; k + 4 <= raw.length; k++) {
    if (raw[k] === 0x6b && raw[k + 1] === 0x72 && raw[k + 2] === 0x63 && raw[k + 3] === 0x31) { off = k; break; } // "krc1"
  }
  if (off < 0) throw new Error('krc magic not found');
  var out = new Uint8Array(raw.length);
  out.set(raw);
  for (var i = off + 4; i < out.length; i++) {
    out[i] = raw[i] ^ KRC_XOR_KEY[(i - off - 4) % 16];
  }
  var inflated = pako.inflateRaw(out.subarray(off + 6));
  var text = bytesToUtf8(inflated);
  if (!text) throw new Error('krc inflate empty');
  return text;
}
async function fetchKugouKrc(hash) {
  if (!hash) throw new Error('krc no hash');
  var s = await axios.get('https://krcs.kugou.com/search', {
    params: { ver: 1, man: 'yes', client: 'mobi', hash: hash, album_audio_id: '' },
    timeout: LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var cands = s.data && s.data.candidates;
  if (!cands || !cands.length || !cands[0].id) throw new Error('krc no candidate');
  var d = await axios.get('https://lyrics.kugou.com/download', {
    params: { ver: 1, client: 'pc', id: cands[0].id, accesskey: cands[0].accesskey, fmt: 'krc', charset: 'utf8' },
    timeout: LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var content = d.data && d.data.content;
  if (!content) throw new Error('krc download empty');
  return decodeKrc(content);
}
// 酷狗 KRC 跨源逐字歌词接力：标题+歌手 搜同曲 → hash → KRC（时长容差 6s 防错配）
// miss 负缓存 5 分钟：relay 常见于冷门曲，miss 后反复搜纯耗配额
var krcRelayMissCache = {}; // kw -> ts
var KRC_RELAY_MISS_TTL_MS = 5 * 60 * 1000;
async function fetchKuwoKrcRelay(item) {
  var kw = ((item && item.title) || '') + ' ' + ((item && item.artist) || '');
  if (!kw.trim()) throw new Error('krc relay no keyword');
  var missTs = krcRelayMissCache[kw];
  if (missTs && Date.now() - missTs < KRC_RELAY_MISS_TTL_MS) {
    throw new Error('krc relay no match (negative cache ' + Math.ceil((KRC_RELAY_MISS_TTL_MS - (Date.now() - missTs)) / 1000) + 's)');
  }
  // [v1.9.10] mobilecdn.kugou.com 在部分网络 DNS 污染（证书 altnames 为 *.cdn.myqcloud.com）致 KRC 接力断链，
  // 换同构替代域名 mobiles.kugou.com（参数/响应结构一致，2026-09-12 实测搜索→krcs→download→decodeKrc 全链路打通）
  var s = await axios.get('https://mobiles.kugou.com/api/v3/search/song', {
    params: { format: 'json', keyword: kw, page: 1, pagesize: 8 },
    timeout: LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://m.kugou.com/' }
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
    krcRelayMissCache[kw] = Date.now(); // 只缓存"确认无命中"，网络错误不缓存
    throw new Error('krc relay no match');
  }
  return fetchKugouKrc(String(hit.hash));
}

// KRC/lrcx 文本 → 宿主 ILyricSource（QRC 格式）：
// 逐字行 `[startMs,durMs]<rel,dur,0>词...` → `[startMs,durMs]词(startMs+rel,dur)...`
// （宿主 lrcParser LINE_TIME_PATTERN 原生消费；酷狗插件 parseKrcForHost 同款）
function parseKrcForHost(krcText) {
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
  if (!richLines.length) throw new Error('krc no timed lines');
  var translation = '', romanization = '';
  if (languageJson) {
    try {
      var lang = JSON.parse(bytesToUtf8(base64ToBytes(languageJson)));
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
// [v1.6.0 P1-2] lrcx 专用解析器（移植 go-music-dl/music-lib convertKuwoNewLyric）：
// 酷我 lrcx 行头是 [mm:ss.mmm]（非 KRC 的 [ms,dur]）、词标签是两字段 <a,b> 含负数（非 KRC 三字段）
// ——且实测标签与真实词时间轴线性映射最大误差 5037ms，属滚动渐变数据、非词时间轴，go 同样剥标签
// 出行级文本。旧版复用 parseKrcForHost(KRC) 行头/标签全部不匹配。输出行级 QRC：
// [startMs,durMs]文本（dur 取下一行 start 差，末行 5s 兜底），译文/罗马音按 <0,0> 前缀判定。
function kuwoLrcxStripTags(payload) {
  var re = /<(-?\d+),(-?\d+)>([^<]*)/g, out = '', m, hit = false;
  while ((m = re.exec(payload))) { hit = true; out += m[3]; }
  if (!hit) return String(payload).trim();
  return out.trim();
}
function kuwoContainsHan(s) {
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fff) return true;
  }
  return false;
}
function kuwoContainsKana(s) {
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0xff66 && c <= 0xff9f)) return true;
  }
  return false;
}
function kuwoIsTransPayload(payload) {
  if (payload.indexOf('<0,0>') !== 0) return false;
  return kuwoContainsHan(kuwoLrcxStripTags(payload)) && !kuwoContainsKana(kuwoLrcxStripTags(payload));
}
function kuwoIsRomaText(text) {
  var hasLatin = false;
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { hasLatin = true; continue; }
    if (kuwoContainsHan(text[i]) || kuwoContainsKana(text[i])) return false;
  }
  return hasLatin;
}
function parseKuwoLrcxText(lrcxText) {
  var lines = String(lrcxText).split(/\r?\n/);
  var lineRe = /^\[(\d{2}):(\d{2})\.(\d{3})\](.*)$/;
  var metaRe = /^\[[A-Za-z]+:[^\]]*\]$/;
  var rows = []; // {startMs, text, roma, trans}
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var m = line.match(lineRe);
    if (!m) { metaRe.test(line); continue; } // [ti:xx] 等元数据行丢弃（go 同款，不进正文）
    var payload = m[4];
    if (kuwoIsTransPayload(payload)) continue; // 顶层孤立译文行跳过（go 同款）
    var text = kuwoLrcxStripTags(payload);
    if (!text) continue;
    var startMs = parseInt(m[1], 10) * 60000 + parseInt(m[2], 10) * 1000 + parseInt(m[3], 10);
    var row = { startMs: startMs, text: text, roma: '', trans: '' };
    // 跟随行：连续 <0,0> 前缀行为本行的罗马音/译文（go 同款游标前移）
    var j = i + 1;
    while (j < lines.length) {
      var nl = lines[j].trim();
      var nm = nl.match(lineRe);
      if (!nm || nm[4].indexOf('<0,0>') !== 0) break;
      var nt = kuwoLrcxStripTags(nm[4]);
      j++; i = j - 1;
      if (!nt) continue;
      if (kuwoIsTransPayload(nm[4]) && !row.trans) row.trans = nt;
      else if (kuwoIsRomaText(nt) && !row.roma) row.roma = nt;
    }
    rows.push(row);
  }
  if (!rows.length) throw new Error('lrcx no timed lines');
  var richLines = [], translation = '', romanization = '';
  for (var r = 0; r < rows.length; r++) {
    var dur = (r + 1 < rows.length ? rows[r + 1].startMs : rows[r].startMs + 5000) - rows[r].startMs;
    if (!(dur > 0)) dur = 5000;
    richLines.push('[' + rows[r].startMs + ',' + dur + ']' + rows[r].text);
    if (rows[r].roma) romanization += (romanization ? '\n' : '') + rows[r].roma;
    if (rows[r].trans) translation += (translation ? '\n' : '') + rows[r].trans;
  }
  return {
    rawLrc: richLines.join('\n'),
    translation: translation || undefined,
    romanization: romanization || undefined
  };
}
// lrcx 行头/标签格式与 KRC 不同，v1.6.0 起走专用解析器（不再复用 parseKrcForHost）
function parseKuwoLrcxToQrc(lrcxText) { return parseKuwoLrcxText(lrcxText); }

// [v1.6.0 P1-2] 通道序调整：KRC 真逐字优先（词级时间轴、标签数远超 lrcx，满足宿主逐字渲染）→
// 酷我原生 lrcx 行级兜底（lrcx 标签为滚动渐变数据非词时间轴，只能出行级）
async function getWordByWordLyricImpl(musicItem) {
  if (!musicItem) throw new Error('missing musicItem');
  var tried = [];
  var rid = getKuwoSongIdOf(musicItem);
  try { return parseKrcForHost(await fetchKuwoKrcRelay(musicItem)); }
  catch (e) { tried.push('kugou-krc-relay: ' + String(e && e.message).slice(0, 60)); }
  if (rid) {
    try { return parseKuwoLrcxToQrc(await fetchKuwoLrcx(rid)); }
    catch (e) { tried.push('kuwo-lrcx: ' + String(e && e.message).slice(0, 60)); }
  }
  throw new Error('逐字歌词不可用（' + tried.join(' | ') + '）');
}

// ---------- ③ 评论（海棠代理通道） ----------
async function getMusicCommentsImpl(musicItem, page) {
  var rid = getKuwoSongIdOf(musicItem);
  if (!rid) throw new Error('missing rid');
  var pn = Math.max(1, parseInt(page, 10) || 1);
  var r = await axios.get('https://music.haitangw.cc/pinglun/kwpl.php', {
    params: { songmid: rid, page: pn },
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://www.kuwo.cn/' }
  });
  var d = r.data && r.data.data;
  if (!d) throw new Error('comment upstream bad response');
  var list = d.comments || [];
  var data = list.map(function (c) {
    var ts = parseInt(c.time, 10) || 0;
    var liked = parseInt(c.likedCount, 10) || 0;
    return {
      id: str(c.id) || ('kw_' + rid + '_' + c.userId),
      nickName: str(c.userName) || '酷我网友',
      comment: str(c.text),
      avatar: str(c.avatar) || undefined,
      time: str(c.timeStr) || undefined,
      createAt: ts > 0 ? ts * 1000 : undefined,
      likedCount: liked,
      like: liked // 宿主评论面板部分版本读 like，双写兼容
    };
  });
  var maxPage = parseInt(d.maxPage, 10) || 0;
  var total = parseInt(d.total, 10) || 0;
  var isEnd = maxPage > 0 ? pn >= maxPage : list.length < 20;
  return { isEnd: isEnd, data: data, page: pn, total: total > 0 ? total : undefined };
}

// ---------- ④ 分享链接 ----------
// 酷我官方网页版播放页（probe 实测 200）：https://www.kuwo.cn/play_detail/{rid}
function getMusicDetailPageUrlImpl(musicItem) {
  var rid = getKuwoSongIdOf(musicItem);
  if (!rid) throw new Error('missing rid');
  return 'https://www.kuwo.cn/play_detail/' + rid;
}
