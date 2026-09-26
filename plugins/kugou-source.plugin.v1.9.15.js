/**
 * [v1.9.15 显示名中文化] 顶层新增 name 字段：导入/安装列表显示中文名「酷狗音乐」；platform 字段保持英文不变，不影响功能逻辑与既有识别逻辑。
 */
/**
 * 酷狗音乐独立源插件（MusicFree）
 * ================================
 * v1.9.15（2026-09-25 接口吸收版，基线 v1.9.14）：v1.9.15 接口吸收版（kuwo/netease/qq 三源集成调研吸收通道：酷我 kw.php/nxinxz/antiserver-high、网易 eapi 响应解密修复+wy.php 兜底、QQ xunhuisi；详见各源 changelog），本源无代码改动，随包升版；
 *   详情：版本字段行同款摘要，此处不重复展开。
 * v1.9.12（2026-09-20 包升版，基线 v1.9.11）：QQ 源接入 a.aa.cab/qq.music 搜索型取链新通道（详见 qq-v1912.js 头部 changelog）；本源无代码改动，版本号随包统一升 v1.9.12。
 * v1.9.5（2026-09-11 全页面音质标识核查 + VIP 标识移除版，基线 v1.9.4）：
 *  - 新增 enrichKugouQualities：榜单(kgrank)/歌单/专辑/歌手作品/导入等入口按主 hash
 *    批量查 get_res_privilege 补 qualities 音质标识（宿主标准键，60s TTL 缓存，
 *    已覆盖入口零额外请求，此前这些页面音质标识全部缺失）；
 *  - 全接口停写 fee（VIP 角标）字段，getMusicInfo/getMediaSource 不再回填，kugouFeeOf 移除。
 * v1.9.4（2026-09-11 第三方取链修复 + size 字段版，基线 v1.9.3）：
 *  - 任务一：getMediaSource 返回值加 size 字段（单位：字节），供宿主下载前预估大小与播放前音质校验。
 *    size 取值优先级：取链响应直带 bytes/Content-Range（海棠 resolveHaitang 已有 total）>
 *    HEAD 探测 Content-Range/Content-Length（getMediaSource 边界补 attachSizeIfMissing 兜底）>
 *    留空。v1.9.3 各通道未统一回填 size，本轮统一处理。
 *  - 任务二：第三方取链通道实测修复（2026-09-11 探针）。
 *    - 6 路实况：
 *       ① 官方 lx5（洛雪 v5）：免费歌 128k 完整；VIP 歌 url 空。本轮未动。
 *       ② trackercdn v2：匿名（无 kugouCookie）跳 20028 风控；需 userVariables.kugouCookie
 *          才能稳定取链，本轮未动。
 *       ③ 海棠（musicserver.haitangw.cc/v1/music/resolve-url）：标准 200/201/503（竞速容错）。
 *          本轮未动。
 *       ④ 酷我官方 fallback：晴 175-248ms / high 320k / super 真 FLAC，alive 保留。
 *       ⑤ HYWmusic（103.79.184.97/api/music/url）：2026-09-11 实测根路径 200 Next.js HTML 主页，
 *          /api/music/url 直接返 500（无论 key 是否有值），整体已退出取链 API 形态 → 失效。
 *       ⑥ zddyr.top（yy.zddyr.top/lx/api/）：2026-09-11 实测 503「仅限授权用户使用」，
 *          与酷我星海同 IP 同一鉴权机制 → 失效。
 *    - 处置：失效 2 通道（HYWmusic / zddyr）保留函数体注释掉、标注 2026-09-11 失效日期，
 *      从竞速池移除。
 *    - 网络搜索新第三方酷狗取链接口（kg-api.dogecloud.com 等 4 个候选）均为 404/接口关闭/
 *      要求付费，无新通道可接入。
 *
 * v1.9.3（2026-09-11 WebView 短链跟随修复版，基线 v1.9.2）：
 *  - 真机 WebView 下 XMLHttpRequest 会自动跟随 302 重定向，axios 的 maxRedirects:0
 *    仅 Node.js 生效 → followRedirects 拿到 status=200 且无 location，误判「无重定向」
 *    直接返回原始短链 → SHEET_URL_RESOLVERS 匹配不到 id 抛 SHEET_URL_UNRECOGNIZED
 *    （酷狗 t1.kugou.com 短链真机导入失败场景，沙箱 Node 环境测不出）。
 *  - 修复：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——status=200 且
 *    res.request.responseURL 为绝对 URL 且异于当前 URL 时，视为 WebView 已自动跟随
 *    到最终页，取最终 URL 返回；Node 环境 res.request 无 responseURL，行为不变。
 *    5 跳手动跟随循环与相对 Location 兼容（P2-5）保留不变。
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
 * v1.9.1（2026-09-11 酷狗歌单全量导入修复版，基线 v1.9.0）：
 *  - P0 gcid「我喜欢」类歌单全量导入：用户实测反馈分享页只出 10 首。根因两条，均已修复：
 *    ① 旧版分享页提取 specialid 命中 "specialid":0（「我喜欢」类默认歌单不落 specialid），
 *      返回 id='0' → 免签通道空结果 →「歌单为空」；
 *    ② gateway 签名参数串缺 mid+dfid → error_code 20006 签名校验失败
 *      （v1.8.2 changelog 判为「静态密钥失效」系误判，密钥本身有效，2026-09-11 实测定位）。
 *  - 修复方案（全部沙箱实测）：分享页 specialid=0 时改提取 listinfo 的
 *    list_create_userid/count/name（手机 UA 页内 SSR JSON），gateway nofilt 通道
 *    （pubsongs/v2/get_other_list_file_nofilt，签名串补 mid=39 位数字形态+dfid='-'）
 *    按 collection_3_{uid}_2_0 → collection_3_{uid}_1_0 → gcid_<token> 候选链取数；
 *    collection_3_1319494754_2_0 实测一次 pagesize=300 返回全部 99 首
 *    （data.count=99 与分享页 count 一致，无翻页）。
 *  - 防拿错歌单：分享页歌单名与 nofilt list_info.name 互不包含时跳过该候选
 *    （collection_3_{uid}_n_0 可能命中同用户其他默认歌单）。
 *  - 元数据：gcid 通道直接取 nofilt data.list_info（name「鹏飞喜欢的音乐」/
 *    pic/{size} 模板/intro/count/list_create_username），不再落「酷狗歌单 #id」兜底标题。
 *  - 歌单对象补 author 别名字段（宿主协议读 artist，任务字段清单要求 author，两者都传）。
 *
 * v1.9.0（2026-09-10 BakaMusic 高价值音源接入版，基线 v1.8.4）：
 *  - 零代码增量，随包升版 v1.9.0。BakaMusic 研究对照复核结论（酷狗侧无高价值增量）：
 *    ① ikun kg 通道不接入：无卡密返回 10 秒占位 mp3（171KB，cdn-img.gitcode.com），
 *      假成功链，任务明确不接；
 *    ② 次合代/长青/全豆要的酷狗端点 haitangw.cc 实测 code 201 已挂（2026-09-10，
 *      报告同口径），无可用增量；
 *    ③ 聆澜付费档不接入（无卡密无法实测）。
 *
 * v1.8.4（2026-09-10 歌单导入元数据版，基线 v1.8.3）：
 *  - P0 导入返回结构：importMusicSheet 由「歌曲数组」改为「完整 IMusicSheetItem 歌单对象」
 *    （id/platform/isImported/title/artwork/worksNum/musicList[/description/artist/playCount]）。
 *    此前返回数组走宿主旧插件兼容分支，歌单标题落到 fallback「来自kugou的歌单」——
 *    用户真机截图显示「来自kugou的歌单」的根因即此。
 *  - P0 歌单标题/介绍：新增 fetchKugouSheetMeta（mobilecdn v3/special/info，specialid 免签，
 *    探针 2026-09-10：specialid 8304355 → specialname「2026车载必备动感DJ丨动感热歌」+
 *    intro 简介 + imgurl/nickname/songcount/playcount 全量返回）。specialid 通道
 *    （分享页提取/酷狗码解码）首页顺带请求；gcid/kucode/direct 通道无 specialid，
 *    标题兜底「酷狗歌单 #<id>」，封面沿用分享页提取结果。
 *  - P0 字段名对齐：歌单介绍字段名确认沿用宿主 v1.0.0 IMusic.IMusicSheetItemBase 的
 *    description（经 normalizeImportedMusicSheet 透传）；无简介时不传该字段。
 *
 * 单平台源插件（由聚合搜索插件 v0.8.0 抽离酷狗源而成）：
 * 搜索走酷狗移动端接口，条目归一化输出；getMediaSource 走酷狗五级接力链做「能力路由 + 失败接力」。
 *
 * 端点与参数全部来自《六平台接口文档（实测整合版）》，未做任何盲猜。
 * 兼容性：ES8 语法（async/await），不使用 ?. / ??（安卓端风险，官方技能包提示）。
 *
 * v1.8.3（2026-09-10 质检遗留优化版，基线 v1.8.2，对应交叉质检报告问题清单 4 项）：
 *  - Q-01 specialid 提取正则收紧（双处）：分享页提取与 SHEET_URL_RESOLVERS URL 解析
 *    原宽松形态（specialid 后直接跟 =: 引号空白）改为两种锚定形态
 *    （JSON 字段 "specialid":NNN 与键/赋值形态 specialid=NNN，均排除前置下划线的
 *    global_specialid 等相近字段名）；真实 gcid 链接复测通过（见 self-test-v183.cjs）。
 *  - Q-02 错误消息前缀统一：sheetImportError 统一补 [kugou] 前缀（对齐 qq/kuwo/migu/qishui）。
 *  - Q-03 兜底分支 code 统一：「该平台暂不支持歌单导入」SHEET_FETCH_FAILED →
 *    SHEET_URL_UNRECOGNIZED（对齐 qq/migu/qishui 口径）；酷狗码解码失败补 SHEET_FETCH_FAILED。
 *  - Q-04 mobilecdn 免签条目 album/artwork 补齐（零额外请求）：① 分享页/歌单码解码
 *    顺带带出歌单封面，enrichArtwork 后仍无封面的条目以歌单封面兜底；② enrichArtwork
 *    已发出的 get_song_info 响应顺带记录 albumname 回填 album（kugouAlbumCache）。
 *    不新增逐曲请求，未覆盖部分仍由宿主 getMusicInfo 懒加载。
 *
 * v1.8.2（2026-09-10 歌单解析修复版，基线 v1.8.1）：
 *  - P0-2 gateway 签名失效绕行：静态签名密钥 OIlwieks28dk2k092lksi2UIkp 已失效
 *    （gateway.kugou.com pubsongs/v2/get_other_list_file_nofilt 100% 返回 error_code 20006，
 *    2026-09-10 实测），gcid 链接与纯数字歌单码全挂。改走免签链路：
 *    ① 纯数字歌单码经 t.kugou.com/command 解码后，响应 info.id 即 specialid
 *      （实测 17710954 → specialid 8304355 + 歌单名/封面/创建者），直接走
 *      mobilecdn v3/special/song 免签拉歌（SHEET_FETCHERS.kugou 既有通道）；
 *    ② gcid 分享链接抓分享页提取 specialid（必须手机 UA：桌面 UA 返回 16KB 无
 *      specialid 壳页，iPhone UA 返回 35KB 含 specialid，2026-09-10 实测）；
 *    ③ gateway 通道保留为最后兜底（密钥轮换后或 collection_ 原生 gcid 形态仍可用），
 *      并把 error_code 明确抛出（不再静默落成「歌单为空」）。
 *  - P1-2 gcid 解码修正：v1.8.1 把分享页 encode token（gcid_3z9vj1p5zb6z06a）原样当
 *    global_collection_id 用（真实形态应为 collection_3_520032980_391_0），且
 *    t.kugou.com/command 对该 token 实测报 strconv.Atoi（不可解码）——修复为先抓
 *    分享页取 specialid，token 直连降级为兜底；同时修复 v1.8.1 中 specialid 分支
 *    因 if/else 顺序永远不可达的死代码。
 *  - P2 #6 歌单条目 platform：buildSheetItem 补 platform: entry.source。
 *  - P2 #12 错误码：歌单导入路径 Error 补 code（SHEET_URL_EMPTY/UNRECOGNIZED/
 *    FETCH_FAILED/EMPTY），文案不变。
 *
 * v1.8.0（2026-09-10 MV 参数对齐基线，基线 v1.6.0；对照 MusicFree v1.0.0 宿主协议）：
 *  - P0 getMvSourceImpl 顶层字段兜底：v1.6.0 入口硬前置 `if (!musicItem || !musicItem._src)` 会
 *    把仅有顶层 mvHash/mv 而无 _src 的条目（外链导入/旧缓存/聚合转发）直接判无 MV——本轮移除
 *    硬前置，对齐酷我/QQ/咪咕/网易云 v1.8.0 行为；MV_SOURCE.kugou 本身已从 musicItem.mvHash
 *    读顶层字段（v1.2.0 baka 对齐版即如此），硬前置无谓；
 *  - P1 顶层 result 补字段：① userAgent（透传 UA 给宿主独立设置层）；② width/height（按 16:9
 *    从 height 派生，因酷狗上游 mp4 stream 不带显式宽高，宿主 UI 进度条/画布需要宽高比）；
 *    ③ codec（从 pickInfo.codec/codecs 透传，无则不挂键，对齐 QQ/网易云宁缺毋假策略）；
 *    ④ videoQuality 写回 musicItem.videoQuality；
 *  - 兼容：v1.6.0 全功能（trackercdn v2 重写 + 搜索风控应对 + fee/primaryKey/alias + 三路
 *    并行竞速 + 严格同曲校验 + MV 480p~4k + KRC 逐字 + 翻译罗马音 + 歌单广场 pinned + 官方
 *    评论 + 真分页专辑/歌手/榜单）保持不变；版本 v1.6.0 → v1.8.0；node --check 通过。
 *
 * 取链路径（全部免登录，除注明外）：
 *  - 酷狗：[v1.1.0] 四级接力：m.kugou.com getSongInfo.php（仅免费歌 128k，standard 档）→ 洛雪v5 服务端中转
 *          （88.lxmusic.xn--fiqs8s/v4s/url/kg，md5 多级签名 e/to/s2/si/s3，128k/320k/flac/flac24bit 全通）
 *          → 海棠 source=kg 兜底（真 FLAC/hires）→ zddyr.top LX Music 兼容第三方（128k/320k/flac，最终兜底）。
 *          trackercdn v1 实测已死（返回 "The Resource Needs to be Paid"），已摘除接力链、保留函数（⑯）；
 *          命中通道经 channel 字段返回并计入 _internal.resolveStats（⑯）。
 *
 * [v1.2.0] 对标 baka 酷狗插件（酷狗音乐_baka-plugins_v1.1.1）对齐补齐：
 *  - 取链：保留我们自有五级接力链（官方 → 洛雪v5 → 海棠 → zddyr，baka 取链依赖外部注入的
 *          requestMusicUrl、非自治，我们的多备源+竞速预算+试听守卫为优势项，不引入其单链实现）。
 *  - 搜索：单曲搜索切官方 song_search_v2（WebFilter，带 MvHash/Image/Grp 合唱拆分），失败降级 mobilecdn v3。
 *  - MV 字段对齐（本次核心）：条目透出 mvHash/mv（宿主 MV 菜单按该字段判定，缺字段菜单永不出现）；
 *          getMvSource 改 mv.php?cmd=100&ext=mp4 五路流（480p/720p/1080p/1080p/4k），
 *          返回 headers/videoQuality/mimeType/size/bitrate/duration/backupUrls/availableVideoQualities。
 *  - 歌单广场：getRecommendSheetTags 修正为宿主期望的扁平 pinned（推荐/最热/最新/热藏/飙升横向 chips）
 *          + tagids 分类标签组；getRecommendSheetsByTag 支持 排序位/分类页 + 每日推荐合流。
 *  - 歌单导入：新增 酷狗码（纯数字）与 gcid 分享歌单（gateway 分页网关）两条通道（对齐 baka）。
 *  - 专辑详情：真分页（page + total 判 isEnd），替代原仅第 1 页 100 首。
 *  - 歌手：搜索页第 1 页歌手信息富化（头像/简介/作品数）；新增 getArtistInfo。
 *  - 歌词：对齐宿主 ILyricSource——getLyric 返回 标准 LRC + 翻译 + 罗马音（KRC language 包解析）；
 *          getWordByWordLyric 返回宿主逐字格式 `[mm:ss.mmm]text(绝对ms,时长ms)`（原裸 KRC 文本宿主不可解析）。
 *  - 评论：官方 m.comment.service 接口为主（res_id + md5 签名），海棠 kgpl 降级兜底。
 *  - 榜单：getTopLists 按 classify 分组（热门/特色/全球/其他），条目带简介。
 *  - 搜索类型：supportedSearchType 增加 lyric（宿主歌词搜索）。
 *  - 所有新增代码保持 ES8 语法与无 Buffer 依赖（base64ToBytes/bytesToUtf8/md5Hex/pako）。
 *
 * [v1.2.1] 榜单图片 + 歌单分类修复（对照宿主源码 topListItem.tsx / sheetItem.tsx + baka 插件实测）：
 *  - 榜单封面字段：宿主榜单页组件（components/mediaItem/topListItem.tsx）渲染图片只读 coverImg，
 *          v1.2.0 的 rank/list 条目与静态兜底仅透出 artwork → 榜单页封面全空。
 *          本次补 coverImg（对齐 baka 字段写法），保留 artwork 兼容榜单详情页 header 的
 *          artwork ?? coverImg 读取链（musicSheetPage/components/header.tsx）。
 *  - 榜单/歌单分类端点 https→http：mobilecdn.kugou.com（rank/list、rank/song）与
 *          www2.kugou.kugou.com（getSpecial 标签组/排序位/分类页）的 https 实测被酷狗 CDN
 *          以不覆盖该域名的共享证书（default.chinanetcenter.com）应答，TLS 校验必挂、
 *          动态榜单整体降级、标签组/推荐歌单全空；对齐 baka 改 http（实测 200）。
 *  - 默认标签回退：宿主歌单广场初始 selectedTag 为 { id: '' }，v1.2.0 原样返回空列表；
 *          对齐 baka（空/未知标签 → t=5 推荐位），打开歌单广场即有数据。
 *  - 同根因顺带修复（验证期发现）：msearchcdn.kugou.com（专辑/歌手/歌单分类搜索 ×3）与
 *          m.comment.service.kugou.com（官方评论主通道）同样存在 https 证书不覆盖问题，改 http
 *          （均实测可达）；everydayrec.service.kugou.com https 探测在本沙箱不可达、代码已有
 *          catch 兜底（失败自动回退 getSpecial 推荐位），保持原状未动。
 *
 * [v1.4.0] 取链三路并行竞速（酷狗官方 + 海棠第三方 + 酷我官方）：
 *  - 背景（2026-09-08 基准报告）：热门歌曲原版哈希在官方+全部中转通道 0/24 可播（晴天/孤勇者/
 *          乌梅子酱/稻香/倔强/平凡之路全失效，只能拿到翻唱/Live 版）；高音质档 95~100% 依赖
 *          海棠（平均 0.7~0.95s）；27 次链路失败里酷狗占 14 次。
 *  - 方案：resolveKugou 改三路并行竞速——赛道A 酷狗官方通道（official→洛雪v5 顺序接力）、
 *          赛道B 海棠第三方、赛道C 酷我官方（新增，实现移植自 QQ 插件 resolveKuwoFallback /
 *          kuwo 插件 v1.4.x：曲名+歌手 关键词搜索酷我映射 rid → 按档位多端点竞速官方通道，
 *          DES 核心 + convert_url_with_sign + mobi.s DES-ECB）。谁先返回「过白名单 + 过试听
 *          守卫」的有效 URL 就用谁；三路全败仍走原有降级链剩余段（hyw → zddyr），试听检测、
 *          音质校验、全局 8s 预算全部不变（守卫已上移进赛道统一闸门，外层对已守卫结果跳过，
 *          避免同一 URL 重复 Range 探测）。
 *  - 档位映射（酷狗内部档 → 酷我档）：standard→standard(128kmp3) / high→high(320kmp3) /
 *          super→super(2000kflac)；hires（宿主 hires/master/atmos 归一后的内部档）酷我官方
 *          无对应档 → 不映射，该档只跑酷狗自己通道（宁缺毋降，酷我返回低档即拒收）。
 *  - rid 映射缓存（10min TTL / FIFO 256）避免同曲重复搜索；新增 RESOLVE_STATS.kuwo 通道
 *          命中统计（channel='kuwo'）；白名单放行酷我 CDN https 域（*.kuwo.cn）。
 * [v1.4.1] 酷我赛道新增「严格同曲校验」（核心约束：同曲校验不通过的结果，再快也不能用）：
 *          搜索候选先经 kuwoSameSongCheck 逐个校验（第一步拆分核心歌名与版本标签——
 *          版本标签从尾部往前提取、可多个、类型数量严格对应，原版≡无标签；
 *          第二步校验核心名一致/版本标签匹配/歌手任一命中/时长差≤10%），
 *          全部候选被拒则酷我赛道直接失败退出竞速、绝不取链，由其余两路继续。
 *          RESOLVE_STATS 新增 kuwoVerifyRejected 计数；_internal 暴露
 *          kuwoSameSongCheck / kwSplitTitleVersion / searchKuwoCandidates 供自测。
 *
 * [v1.5.0] 宿主字段补齐（对照《MusicFree 宿主字段需求 × 6 插件返回字段 全量对比与补齐方案》）：
 *  - fee（VIP 标记，P1）：搜索（v2/v3 双通道）、歌曲详情、getMusicInfo、取链结果全链路透出
 *          fee 字段（宿主 fee===1 显示 VIP 角标）。判定规则：privilege∉{0,8} 或 pay_type>0 → 1，
 *          否则 0。feetype 不可靠（实测晴天 VIP 但 feetype=0），弃用；实测 privilege 0/8=免费、
 *          VIP 歌 privilege=10/pay_type=3。
 *  - getMusicDetailPageUrl（P1）：返回酷狗官方歌曲分享页 https://www.kugou.com/mixsong/
 *          {encode_album_audio_id}.html。encode token 无确定性编码算法可由 album_audio_id 直推，
 *          经 complexsearch.kugou.com/v2/search/song（MD5 签名，盐 NVPh5oo7...，appid=1014/
 *          filter=10/token=/userid=0 参数集）取 EMixSongID；按条目 hash 与响应 FileHash 精确
 *          匹配防同名错配（探针 2026-09-08 实测：晴天→j410q60 / 十年→nzju3bd，页面均 200 真实歌页）。
 *  - 单曲导入顺带支持 encode token 分享页回导：页面 HTML 含 "hash":"<32hex>"（实测与搜索
 *          FileHash 一致），拉页反解 hash 走原有导入链。
 *  - primaryKey（P2）：插件元信息声明 primaryKey:['id']（对齐网易云/咪咕，宿主去重/缓存键）。
 *  - alias（P2）：搜索 v2 OtherName / v3 othername → 条目顶层 alias（歌词搜索优先匹配；
 *          接口该字段大多为空，非空才透出，如实映射不造值）。
 *  - 罗马音（P2）：核对宿主 ILyricSource 字段名为 romanization（非任务描述的 romaLrc）。
 *          [v1.5.0] 自测发现 v1.2.0 解析读错层级（读顶层 lyricContent/type，实测格式为
 *          顶层 {content:[{language,type,lyricContent}]}：译文条目 type=1、罗马音条目
 *          type=0），已修复 parseKrcForHost：遍历 content 条目，type=1 判译文，type!=1
 *          条目按拉丁字母占比判定罗马音；兼容旧顶层单组格式。
 *
 * [v1.6.0] P1 功能补齐（go-music-dl 调研落地，基线 v1.5.0）：
 *  - P1 trackercdn v2 备用取链：resolveKugouTrackercdn 重写为三 URL 顺序接力（music-lib
 *          kugou/download.go fetchTrackerSongInfo 逐行移植）——
 *          ① https://trackercdn.kugou.com/i/v2/?cdnBackup=1&behavior=download&pid=1&cmd=21
 *            &appid=1001&hash={h}&key={md5(h+'kgcloudv2')}
 *          ② http://trackercdnbj.kugou.com/i/v2/?cmd=23&pid=1&behavior=download&hash={h}
 *            &key={md5(h+'kgcloudv2')}
 *          ③ http://trackercdn.kugou.com/i/?cmd=4&pid=1&forceDown=0&vip=1&hash={h}
 *            &key={md5(h+'kgcloud')}（旧 v1 形态，末位保留）
 *          关键点：hash 必须先 toLowerCase 再算 key（大写 hash 的 key 必错，实测踩坑点）；
 *          url/backup_url 兼容 string 与 array（pickKugouURL 语义），响应 errcode 必须
 *          为 0；headers 对齐 go：PC UA + Referer https://www.kugou.com/ + Cookie +
 *          随机国内 IP 头（X-Forwarded-For/X-Real-IP）。启用条件：仅当用户配置了
 *          userVariables.kugouCookie（匿名环境实测 status=2/errcode=20028 风控，
 *          带 Cookie 后可用）；接入 kgLane 接力链（official→lx5 之后），命中计入
 *          RESOLVE_STATS.trackercdn，actualQuality 按 extName/bitRate 近似映射；
 *  - P1 搜索风控应对：searchKugou 加指数退避重试——空结果或风控/瞬时失败（403/429/5xx/
 *          超时/网络错误）时按 500ms×2^n + 0~250ms 抖动退避，最多重试 2 次（业务真
 *          空结果同样最多 2 次确认，防「连续多轮 0 结果」风控误判）；搜索请求头新增
 *          随机国内 IP（kugouRandomChinaIP：9 个常见电信/联通/移动前缀段 + 随机后两段，
 *          移植自 music-lib utils/ip.go RandomChinaIP / WithRandomIPHeader，设
 *          X-Forwarded-For 与 X-Real-IP）；trackercdn 同样使用；
 *  - 自测：trackercdn 3 首（hash 小写核对 + key 复算）、搜索退避（空结果/风控路径）、
 *          随机 IP 头格式，全部执行（详见任务评论自测清单）。
 */

const axios = require('axios');

// ==================== 通用工具 ====================

var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
// v0.7.1 P1-3：取链全局超时预算。宿主 getMediaSource 单方法 10s 硬上限，
// 原实现最坏 6 段 × 4.5s × 3 候选源 ≈ 81s 必然被掐断。
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
var RELAY_TIMEOUT = 2500;     // 接力段（备源）单请求超时，首段仍用 SOURCE_TIMEOUT
// [v1.4.0] 三路竞速窗口：酷狗官方→洛雪两步、海棠单请求、酷我搜索+取链两步都在该窗口内完成
// （实测三路常态 0.2~1s，2.8s 只兜异常尾部）；全败后剩余预算留给原降级链（hyw/zddyr）。
var RACE_BUDGET_MS = 2800;
var DURATION_TOLERANCE_SEC = 6;

function str(v) { return v === undefined || v === null ? '' : String(v); }

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
  kugou: 0.90
};

// 各源声明的免登录音质能力（super=无损档；hires=Hi-Res 24bit 档，仅酷狗/网易云）
// v0.7.0：全音质走第三方（用户确认方向，文档内置网易云 CK 已失效不作依赖）：
//   酷狗 super/hires = 海棠 kg sqhash（lossless=FLAC 30.2MB / hires=FLAC 24bit 52.8MB，文档实测+沙箱 fLaC 魔数复核）
// v0.8.0：酷狗新增洛雪v5 服务端中转为主力（128k/320k/flac/flac24bit 四档全通，md5 多级签名），
//   trackercdn v1（免费歌 128k）与 zddyr.top（LX Music 兼容，128k/320k/flac）补充兜底，接力链见 resolveKugou
var SOURCE_QUALITIES = {
  kugou: ['standard', 'high', 'super', 'hires']
};

function canServe(source, quality) {
  var caps = SOURCE_QUALITIES[source] || [];
  return caps.indexOf(quality) >= 0;
}

// ==================== 搜索适配器 ====================
// 每个适配器返回统一内部条目：
// { source, sid, title, artist, album, duration(sec, 可为0), artwork, raw }

function searchKugouV3Fallback(query, page) {
  return axios.get('http://mobilecdn.kugou.com/api/v3/search/song', {
    params: { format: 'json', keyword: query, page: page, pagesize: 20 },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var data = res.data && res.data.data;
    var list = (data && data.info) || [];
    return list.map(function (it) {
      var title = str(it.songname || '');
      var artist = str(it.singername || '');
      if (!title && it.filename) {
        var parts = String(it.filename).split(' - ');
        if (parts.length >= 2) { artist = artist || parts[0]; title = parts.slice(1).join(' - '); }
        else title = String(it.filename);
      }
      var pic = str(it.img || it.album_img || it.imgurl || '').replace('{size}', '400');
      return {
        source: 'kugou', sid: str(it.hash),
        title: title, artist: artist,
        album: str(it.album_name || ''), duration: parseInt(it.duration, 10) || 0,
        artwork: pic,
        raw: { hash: str(it.hash), hash320: str(it['320hash'] || ''), hashSq: str(it.sqhash || ''), mixsongid: str(it.mixsongid || ''),
               // [v1.5.0 P1-1/P2-4 -> v1.9.5] fee（VIP 标记）停写；alias 保留（v3 snake_case）
               alias: str(it.othername || '') }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

// [v1.5.0 P1-1 -> v1.9.5] kugouFeeOf（fee 判定）已随 VIP 标识停写整体移除。

// [v1.2.0] 单曲搜索切换官方 song_search_v2（对齐 baka）：
// WebFilter 渠道返回 FileHash/HQFileHash/SQFileHash/MvHash/Image/Audioid/Duration（秒），
// 并带 Grp[] 合唱/伴奏分组——展开后与主条目同权重进入归一化，避免合唱副歌版本丢失。
// MvHash 透传到 raw（宿主 MV 菜单判定依赖，见 buildMusicItem）。
// [v1.5.0 -> v1.9.5] raw 增加 alias（OtherName，非空才带）；fee（VIP 标识）已停写移除。
function mapSongSearchV2Item(it) {
  var fileHash = str(it.FileHash || '');
  var title = str(it.SongName || it.OriSongName || '').replace(/<[^>]+>/g, '');
  var artist = str(it.SingerName || '');
  if (!artist && Array.isArray(it.Singers)) {
    artist = it.Singers.map(function (s) { return str(s.name || ''); }).filter(Boolean).join(', ');
  }
  return {
    source: 'kugou', sid: fileHash,
    title: title, artist: artist,
    album: str(it.AlbumName || ''),
    duration: parseInt(it.Duration, 10) || 0,
    artwork: it.Image ? String(it.Image).replace('{size}', '400') : '',
    raw: {
      hash: fileHash,
      hash320: str(it.HQFileHash || ''),
      hashSq: str(it.SQFileHash || ''),
      mixsongid: str(it.Audioid || it.MixSongID || ''),
      mvHash: str(it.MvHash || it.MVHash || ''),
      // [v1.3.0 P0-2] 搜索接口自带三档字节大小（WebFilter 渠道实测 FileSize/HQFileSize/SQFileSize）：
      // 零额外请求即可在列表页挂 qualities.size（宿主音质菜单显示 + 下载进度基准）
      size128: parseInt(it.FileSize, 10) || 0,
      size320: parseInt(it.HQFileSize, 10) || 0,
      sizeSq: parseInt(it.SQFileSize, 10) || 0,
      // [v1.5.0 P1-1/P2-4 -> v1.9.5] fee（VIP 标记）停写；alias 保留（OtherName 非空才带）
      alias: str(it.OtherName || '')
    }
  };
}

// [v1.6.0] 随机国内 IP 头（music-lib utils/ip.go RandomChinaIP / WithRandomIPHeader 移植）：
// 9 个常见电信/联通/移动前缀段 + 随机后两段（1-254），设 X-Forwarded-For 与 X-Real-IP。
// 酷狗搜索按 IP 限频明显（调研报告实测连续多轮 0 结果），换 IP 头可缓解。
var KG_IP_PREFIXES = [
  [116, 255], [116, 228], [218, 192], [124, 0], [14, 132],
  [183, 14], [58, 14], [113, 116], [120, 230]
];
function kugouRandomChinaIP() {
  var p = KG_IP_PREFIXES[Math.floor(Math.random() * KG_IP_PREFIXES.length)];
  return p[0] + '.' + p[1] + '.' + (Math.floor(Math.random() * 254) + 1) + '.' + (Math.floor(Math.random() * 254) + 1);
}
function kugouRiskIpHeaders() {
  var ip = kugouRandomChinaIP();
  return { 'X-Forwarded-For': ip, 'X-Real-IP': ip };
}
// [v1.6.0] 指数退避：500ms×2^n + 0~250ms 抖动
function kugouSearchBackoffDelay(attemptNo) {
  return 500 * Math.pow(2, attemptNo) + Math.floor(Math.random() * 250);
}
function kugouSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// [v1.6.0] 单次搜索请求（原 searchKugou 主体抽出，不带重试）
function searchKugouAttempt(query, page) {
  var riskIp = kugouRandomChinaIP();
  return axios.get('https://songsearch.kugou.com/song_search_v2', {
    params: {
      keyword: query, page: page, pagesize: 20, userid: 0, clientver: '',
      platform: 'WebFilter', filter: 2, iscorrection: 1, privilege_filter: 0, area_code: 1
    },
    timeout: SOURCE_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: 'https://www.kugou.com/',
      'X-Forwarded-For': riskIp,
      'X-Real-IP': riskIp
    }
  }).then(function (res) {
    // [v1.6.0] 风控判定：顶层 status 存在且非 1 视为风控/限频响应（抛错走退避重试）
    if (res.data && res.data.status !== undefined && res.data.status !== 1) {
      throw new Error('kugou search risk status=' + res.data.status);
    }
    var d = res.data && res.data.data;
    var rawList = (d && d.lists) || [];
    var seen = {};
    var entries = [];
    for (var i = 0; i < rawList.length; i++) {
      var it = rawList[i];
      var key = str(it.Audioid || '') + str(it.FileHash || '');
      if (!seen[key]) { seen[key] = 1; entries.push(it); }
      var grp = it.Grp || [];
      for (var g = 0; g < grp.length; g++) {
        var ck = str(grp[g].Audioid || '') + str(grp[g].FileHash || '');
        if (!seen[ck]) { seen[ck] = 1; entries.push(grp[g]); }
      }
    }
    return entries.map(mapSongSearchV2Item).filter(function (it) { return it.sid && it.title; });
  });
}

function searchKugou(query, page, attemptNo) {
  var an = attemptNo || 0;
  // [v1.6.0] 风控/瞬时失败判定：403/429/5xx/超时/网络错误/风控 status
  var isRiskErr = function (e) {
    var msg = String((e && e.message) || '');
    var st = e && e.response && e.response.status;
    return st === 403 || st === 429 || (typeof st === 'number' && st >= 500) ||
      st === undefined || msg.indexOf('risk') >= 0 || msg.indexOf('timeout') >= 0;
  };
  return searchKugouAttempt(query, page).then(function (list) {
    if (list.length || an >= 2) return list;
    // [v1.6.0] 空结果同样退避重试：连续多轮 0 结果多为 IP 限频风控（调研报告实测），
    // 最多 2 次重试确认，避免误判也避免吃满搜索预算
    return kugouSleep(kugouSearchBackoffDelay(an)).then(function () {
      return searchKugou(query, page, an + 1);
    });
  }).catch(function (e) {
    if (an < 2 && isRiskErr(e)) {
      return kugouSleep(kugouSearchBackoffDelay(an)).then(function () {
        return searchKugou(query, page, an + 1);
      });
    }
    // [v1.2.0] v2 渠道失败降级 mobilecdn v3（旧通道，保留可达性）
    return searchKugouV3Fallback(query, page);
  });
}

var SEARCH_ADAPTERS = {
  kugou: searchKugou
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
    title: best.title,
    artist: best.artist,
    album: best.album,
    artwork: artwork || undefined,
    duration: duration || undefined,
    _src: src,
    _srcOrder: srcOrder
  };
  // [v1.2.0] MV 字段对齐：宿主 canPlayMusicVideo 按条目顶层 mv/mvId/mvid/mvHash/mvVid/videoId
  // 判定「有 MV」，缺字段则 MV 菜单永不出现。代表条目 raw 里的 MvHash/mv 透出到顶层。
  var bestRaw = best.raw || {};
  if (bestRaw.mvHash) { item.mvHash = bestRaw.mvHash; item.mv = bestRaw.mvHash; }
  else if (bestRaw.mv) { item.mv = bestRaw.mv; }
  // [v1.5.0 P1-1/P2-4] fee/alias 透出到条目顶层：宿主读 fee===1 挂 VIP 角标、读 alias 做
  // 歌词搜索优先匹配。代表条目缺值时按成员序取首个非缺（合唱/多源聚合下任一成员可提供）。
  // [v1.5.0 -> v1.9.5] fee（VIP 角标）字段全面停写不再透传。
  var alias0 = bestRaw.alias;
  for (var am = 0; am < members.length && !alias0; am++) {
    alias0 = members[am].raw ? members[am].raw.alias : '';
  }
  if (alias0) item.alias = alias0;
  // [v1.3.0 P0-2] 搜索结果条目挂 qualities（零额外请求）：song_search_v2 自带 128k/320k/flac
  // 三档字节大小，按 kugou 成员 raw 构建。宿主音质菜单优先按条目 qualities 实际键展示，
  // size 供菜单 (xxMB) 后缀与下载进度基准（downloader expectedFileSize 只读 qualities）。
  var kugouRaw = src.kugou || (best.source === 'kugou' ? bestRaw : null);
  var qFromSearch = qualitiesFromSearchRaw(kugouRaw);
  if (qFromSearch) item.qualities = qFromSearch;
  return item;
}

// ==================== 封面补齐 ====================
// 无封面条目按 _src 反查：酷狗 get_song_info（文档 F.3，album_img 含 {size} 占位符）。
// 注意：酷狗 stdmusic/{hash}.jpg 直拼实测返回固定默认图（假 hash 同字节数），不可用，
// 必须走 get_song_info 取带日期路径的真实封面。带缓存 + 并发 6 控制。
var kugouCoverCache = {};
var kugouAlbumCache = {}; // [v1.8.3 Q-04] get_song_info 响应顺带记录的 albumname（hash → 专辑名）

async function fetchKugouCover(hash) {
  if (!hash) return '';
  if (kugouCoverCache[hash]) return kugouCoverCache[hash];
  var r = await axios.get('https://m.kugou.com/api/v1/song/get_song_info', {
    params: { cmd: 'playInfo', hash: hash, mid: '123456789123456789' },
    timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var img = r.data && r.data.album_img ? String(r.data.album_img) : '';
  var url = img ? img.replace('{size}', '480') : '';
  if (url) kugouCoverCache[hash] = url;
  // [v1.8.3 Q-04] 顺带记录专辑名：歌单导入 album 回填复用本次响应（零额外请求）。
  var albumRaw = r.data && (r.data.albumname || r.data.album_name || (r.data.data && (r.data.data.albumname || r.data.data.album_name)));
  if (albumRaw) kugouAlbumCache[hash] = String(albumRaw);
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
      if (it.source === 'kugou' && it.raw.hash) src = { kugou: it.raw };
    }
    if (!src) continue;
    if (src.kugou && src.kugou.hash) targets.push({ item: it, kind: 'kugou', key: src.kugou.hash });
  }
  if (!targets.length) return items;
  var CONCURRENCY = 6;
  var idx = 0;
  async function worker() {
    while (idx < targets.length) {
      var t = targets[idx++];
      try {
        var url = await fetchKugouCover(t.key);
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
// 按榜单名次归一化得分 + 跨源命中加成；
// 条目 _src 携带原始 raw，复用取链接力（resolveWithFallback）。
// 端点均来自六平台接口文档实测记录（2026-09-02/05），无猜测 URL。

var CHART_TTL_MS = 30 * 60 * 1000;
var chartCache = {};   // { defId: { ts, list } }
var chartInflight = {}; // { defId: Promise } 并发去重

var CHART_DEFS = [
  {
    id: 'agg-hot', title: '热歌榜', cover: '',
    members: [
      { source: 'kugou', id: '8888' }
    ]
  },
  {
    id: 'agg-new', title: '新歌榜', cover: '',
    members: [
      { source: 'kugou', id: 'new' }
    ]
  }
];

// 酷狗新歌速递（v0.8.0 新增）：m.kugou.com/?json=true，data[] 为最新首发歌曲（含 hash/sqhash）
function fetchKugouNewSongs() {
  return axios.get('https://m.kugou.com/', {
    params: { json: true },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://m.kugou.com/' }
  }).then(function (res) {
    var list = (res.data && res.data.data) || [];
    return list.map(function (it) {
      var artist = Array.isArray(it.authors)
        ? it.authors.map(function (a) { return str(a.author_name || a.name || ''); }).filter(Boolean).join('/')
        : str(it.author_name || '');
      var pic = str(it.img || it.imgurl || '').replace('{size}', '400');
      return {
        source: 'kugou', sid: str(it.hash),
        title: str(it.songname), artist: artist, album: str(it.album_name || ''),
        duration: parseInt(it.duration, 10) || 0, artwork: pic,
        raw: { hash: str(it.hash), hash320: str(it['320hash'] || ''), hashSq: str(it.sqhash || ''), mixsongid: str(it.mixsongid || '') }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

var CHART_FETCHERS = {
  kugou: function (rankId) {
    // rankId='new'：新歌速递（m.kugou.com/?json=true，v0.8.0 新增接入 agg-new 新歌榜）
    if (rankId === 'new') return fetchKugouNewSongs();
    return axios.get('https://m.kugou.com/rank/info/', {
      params: { rankid: rankId, page: 1, json: true },
      timeout: SOURCE_TIMEOUT,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var songs = res.data && res.data.songs;
      var list = (songs && songs.list) || [];
      return list.map(function (it) {
        var artist = str(it.singername || '');
        var title = str(it.songname || '');
        if (!title && it.filename) {
          var parts = String(it.filename).split(' - ');
          if (parts.length >= 2) { artist = artist || parts[0]; title = parts.slice(1).join(' - '); }
          else title = String(it.filename);
        }
        var pic = str(it.img || it.album_img || it.imgurl || '').replace('{size}', '400');
        return {
          source: 'kugou', sid: str(it.hash),
          title: title, artist: artist, album: str(it.album_name || ''),
          duration: parseInt(it.duration, 10) || 0, artwork: pic,
          raw: { hash: str(it.hash), hash320: str(it['320hash'] || ''), hashSq: str(it.sqhash || ''), mixsongid: str(it.mixsongid || '') }
        };
      }).filter(function (it) { return it.sid && it.title; });
    });
  }
};

/**
 * 多源榜单合并。
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

// ==================== 官方榜单 55+（P2-1 v1.1.0）====================
// 端点实测（probeF/G/H，2026-09-06）：mobilecdn api/v3/rank/list（56 榜，rankid/rankname/imgurl）
// 与 api/v3/rank/song（rankid/page/pagesize 真分页，data.info[] 含 hash/320hash/sqhash/hash_high）。
// 条目 id 前缀 kgrank~；拉取失败时 getTopLists 降级回静态 CHART_DEFS（不阻断）。
var KGRANK_PAGESIZE = 30;
var kgrankListCache = null; // { ts, list }
var KGRANK_LIST_TTL_MS = 30 * 60 * 1000;

async function fetchKugouRankList() {
  if (kgrankListCache && Date.now() - kgrankListCache.ts < KGRANK_LIST_TTL_MS) {
    return kgrankListCache.list;
  }
  var res = await axios.get('http://mobilecdn.kugou.com/api/v3/rank/list', { // [v1.2.1] https→http：CDN 证书不覆盖该域名，https 必挂（baka 同走 http，实测 200）
    params: { format: 'json' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var info = (res.data && res.data.data && res.data.data.info) || [];
  var list = info.map(function (it) {
    var rankid = str(it.rankid || '');
    if (!rankid || !it.rankname) return null;
    return {
      id: 'kgrank~' + rankid,
      title: str(it.rankname),
      // [v1.2.1] 宿主榜单页组件只读 coverImg（topListItem.tsx: source={topListItem?.coverImg}），必须透出
      coverImg: str(it.imgurl || '').replace('{size}', '480'),
      artwork: str(it.imgurl || '').replace('{size}', '480'), // 详情页 header 读 artwork ?? coverImg，双字段兜底
      classify: parseInt(it.classify, 10) || 0, // [v1.2.0] 分类：1,2=热门 3,5=特色 4=全球（baka 对齐）
      intro: str(it.intro || '').replace(/<[^>]+>/g, '') || undefined // [v1.2.0] 榜单简介
    };
  }).filter(Boolean);
  if (!list.length) throw new Error('rank/list 空结果');
  kgrankListCache = { ts: Date.now(), list: list };
  return list;
}

// [v1.2.0] 榜单分类分组（baka 对齐）：classify 1,2→热门榜单；3,5→特色音乐榜；4→全球榜；其余→更多榜单
function groupKugouRankList(list) {
  var hot = [], feat = [], global = [], others = [];
  for (var i = 0; i < list.length; i++) {
    var c = list[i].classify;
    if (c === 1 || c === 2) hot.push(list[i]);
    else if (c === 3 || c === 5) feat.push(list[i]);
    else if (c === 4) global.push(list[i]);
    else others.push(list[i]);
  }
  var groups = [];
  if (hot.length) groups.push({ title: '热门榜单', data: hot });
  if (feat.length) groups.push({ title: '特色音乐榜', data: feat });
  if (global.length) groups.push({ title: '全球榜', data: global });
  if (others.length) groups.push({ title: '更多榜单', data: others });
  return groups.length ? groups : [{ title: '酷狗榜单', data: list }];
}

async function fetchKugouRankSongs(rankid, page) {
  var pg = parseInt(page, 10) || 1;
  if (pg < 1) pg = 1;
  var res = await axios.get('http://mobilecdn.kugou.com/api/v3/rank/song', { // [v1.2.1] https→http（同 rank/list，CDN 证书不覆盖该域名）
    params: { rankid: rankid, page: pg, pagesize: KGRANK_PAGESIZE, json: true },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var info = (res.data && res.data.data && res.data.data.info) || [];
  var musicList = info.map(function (it) {
    var hash = str(it.hash);
    if (!hash) return null;
    var artist = Array.isArray(it.authors)
      ? it.authors.map(function (a) { return str(a.author_name || a.name || ''); }).filter(Boolean).join('/')
      : str(it.author_name || '');
    var title = str(it.songname || '');
    if (!title && it.filename) {
      var parts = String(it.filename).split(' - ');
      if (parts.length >= 2) { artist = artist || parts[0]; title = parts.slice(1).join(' - '); }
      else title = String(it.filename);
    }
    // raw 三档：hash_high 为 hires（官方免登录详情文档口径），sqhash→hashSq、320hash→hash320
    var raw = { hash: hash, hash320: str(it['320hash'] || ''), hashSq: str(it.sqhash || ''), mixsongid: str(it.album_audio_id || '') };
    if (it.hash_high) raw.hashHires = str(it.hash_high);
    if (it.mvhash) raw.mvHash = str(it.mvhash); // [v1.2.0] MV 字段透出（宿主 MV 菜单判定依赖）
    return {
      id: 'kr_' + hash,
      title: title, artist: artist,
      album: str(it.album_name || '') || undefined,
      duration: parseInt(it.duration, 10) || undefined,
      artwork: str(it.img || it.album_img || it.imgurl || '').replace('{size}', '400') || undefined,
      mvHash: raw.mvHash || undefined, // [v1.2.0] MV 菜单判定字段
      mv: raw.mvHash || undefined, // [v1.2.0]
      _src: { kugou: raw }
    };
  }).filter(Boolean);
  await enrichArtwork(musicList, 30);
  await enrichKugouQualities(musicList); // [v1.9.9] 榜单页音质标识补齐（cap 放开至全量，跨页一致）
  return { isEnd: info.length < KGRANK_PAGESIZE, musicList: musicList };
}

// ==================== 歌单导入 ====================
// 端点全部实测（artifacts/sheet-probe/，2026-09-05）：
// kugou  mobilecdn api/v3/special/song（page/pagesize 真分页；info[] 字段 filename "歌手 - 名" + hash 三档）

var SHEET_MAX_PAGES = 4;      // 单源最多翻 4 页（插件方法 10s 硬上限内）
var SHEET_MAX_ITEMS = 500;    // 导入条数上限（防超时）

/** 各平台歌单 URL → 歌单 id（全部为实测存在的链接格式；返回 null 表示不认识） */
var SHEET_URL_RESOLVERS = {
  kugou: function (s) {
    if (!/kugou\.com/.test(s)) return null;
    var m = /\/playlist\/id\/(\d+)/.exec(s) || /(?:^|[^\w])specialid[=:"]+(\d+)/.exec(s); // [v1.8.3 Q-01] 前置字符非 \w，排除 global_specialid 等变体
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
    if (res.status >= 300 && res.status < 400 && loc && String(loc).trim()) {
      var locS = String(loc).trim();
      // [P2-5 v1.1.0] 兼容相对 Location：绝对地址原样；根相对（/x）拼 origin；路径相对拼目录
      if (/^https?:\/\//i.test(locS)) {
        cur = locS;
      } else {
        var mOrigin = cur.match(/^(https?:\/\/[^\/]+)/i);
        var origin = mOrigin ? mOrigin[1] : '';
        cur = locS.charAt(0) === '/' ? (origin + locS) : (cur.replace(/\/[^\/]*$/, '/') + locS);
      }
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
 * [v1.2.0] 歌单导入新通道（对齐 baka）：酷狗码 / gcid / kucode
 * ① 酷狗码解码：t.kugou.com/command POST（baka 同款固定参数）
 */
async function resolveKugouCode(code) {
  var res = await axios.post('https://t.kugou.com/command', {
    appid: 1001, clientver: 9020,
    mid: '21511157a05844bd085308bc76ef3343',
    clienttime: 640612895, key: '36164c4015e704673c588ee202b9ecb8',
    data: String(code)
  }, {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Content-Type': 'application/json' }
  });
  if (!res.data || res.data.status !== 1) throw sheetImportError('SHEET_FETCH_FAILED', '酷狗码解码失败');
  var d = res.data.data || {};
  var info = d.info || {};
  // [v1.8.2 P0-2] info.id 即 specialid（歌单码解码实测：17710954 → id 8304355、type 2、
  // name/img/username 为歌单元数据）；带出给 resolveSheetId 走 mobilecdn 免签拉歌。
  if (info.global_collection_id) {
    return {
      kind: 'gcid',
      gcid: String(info.global_collection_id),
      specialid: info.id ? String(info.id) : '',
      type: parseInt(info.type, 10) || 0,
      // [v1.8.3 Q-04] 歌单封面随解码响应带出（零额外请求），供免签通道兜底 artwork
      cover: info.img ? String(info.img).replace('{size}', '480') : ''
    };
  }
  if (info.id && (info.collect_type || info.type)) {
    return {
      kind: 'kucode',
      id: String(info.id),
      userid: String(info.userid || 0),
      collectType: String(info.collect_type || info.type || ''),
      count: parseInt(info.count, 10) || 0
    };
  }
  // 部分口令直接回歌曲列表
  if (Array.isArray(d.list) && d.list.length) return { kind: 'list', songs: d.list };
  return null;
}

// [v1.9.1] gateway 请求参数/请求头用 mid（39 位数字形态，2026-09-11 实测通过签名校验；
// 旧版签名串缺 mid+dfid → error_code 20006 签名校验失败，v1.8.2 changelog 误判为「密钥失效」）
var KUGOU_GW_MID = '239526275778893399526700786998289824956';

// [v1.9.1] nofilt 单次请求：参数按 key 排序后拼串（与 kugouGatewaySign 的排序一致），补 mid+dfid
async function kugouNofiltOnce(gcidVal, beginIdx) {
  var p = {
    area_code: '1', appid: '1005', begin_idx: String(beginIdx),
    clienttime: String(Math.floor(Date.now() / 1000)), clientver: '20489',
    dfid: '-', extend_fields: 'abtags,hot_cmt,popularization',
    global_collection_id: String(gcidVal), mid: KUGOU_GW_MID, mode: '1',
    pagesize: '300', personal_switch: '1', plat: '1', type: '1', uuid: '-'
  };
  var keys = Object.keys(p).sort();
  var paramsStr = '';
  for (var k = 0; k < keys.length; k++) paramsStr += (k ? '&' : '') + keys[k] + '=' + p[keys[k]];
  var sign = kugouGatewaySign(paramsStr, '', 'OIlwieks28dk2k092lksi2UIkp');
  var res = await axios.get('https://gateway.kugou.com/pubsongs/v2/get_other_list_file_nofilt?' + paramsStr + '&signature=' + sign, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      dfid: '-', mid: KUGOU_GW_MID, clienttime: p.clienttime,
      'kg-rc': '1', 'kg-thash': '5d816a0', 'kg-rec': '1', 'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F'
    }
  });
  var rErr = parseInt(res.data && res.data.error_code, 10) || 0;
  if (rErr) {
    throw sheetImportError('SHEET_FETCH_FAILED', '酷狗 gateway 通道拒绝（error_code ' + rErr + '，collection_id=' + gcidVal + '）');
  }
  // [v1.9.1] 响应体为 {status,error_code,data:{songs,count,list_info,...}}：
  // v1.9.0 读 res.data.data.data.songs 多套了一层（旧版从未通过签名校验，解析路径零覆盖
  // 所以没暴露），实测 body.data.songs 即歌曲数组。
  return (res.data && res.data.data) || {};
}

// ② gcid 歌单（get_other_list_file_nofilt，baka 同款签名，begin_idx 步进 300 分页）
// [v1.9.1] 全量修复（用户实测反馈：分享页 SSR 只内嵌 10 首，绝不能拿 10 首当导入结果）：
//  ① 签名参数串补 mid+dfid（修复 20006，见 KUGOU_GW_MID 注）；
//  ② global_collection_id 候选链：collection_3_{uid}_2_0（「我喜欢」类默认歌单内部 ID，
//    2026-09-11 实测一次 pagesize=300 拉全 99 首）→ gcid_<token> 原形态 →
//    collection_3_{uid}_1_0（实测 status=1 songs=0，作快速跳过候选）；
//  ③ 分享页带歌单名时校验 list_info.name 与其一致（防拿错同用户其他默认歌单）；
//  ④ 元数据直接取 nofilt data.list_info（name/pic/count/intro/list_create_username）。
// 返回 { songs, meta }；全部候选失败时抛最后一个错误（明确 error_code，不再落「歌单为空」）。
async function fetchKugouGcidSheet(candidates, pageName) {
  var out = [];
  var meta = null;
  var lastErr = null;
  for (var c = 0; c < candidates.length && !out.length; c++) {
    try {
      var beginIdx = 0;
      var total = Infinity;
      var dd = null;
      var pageSongs = [];
      for (var page = 0; page < 10 && beginIdx < total && pageSongs.length < SHEET_MAX_ITEMS; page++) {
        dd = await kugouNofiltOnce(candidates[c], beginIdx);
        var songs = dd.songs || [];
        if (!Array.isArray(songs) || !songs.length) break;
        total = parseInt(dd.count, 10) || (beginIdx + songs.length + 1);
        for (var i = 0; i < songs.length && pageSongs.length < SHEET_MAX_ITEMS; i++) {
          var sg = songs[i];
          var hash = str(sg.hash || '');
          if (!hash) continue;
          var name = str(sg.name || sg.filename || '');
          var artist = '', title = name;
          if (name.indexOf(' - ') > 0) {
            var parts = name.split(' - ');
            artist = parts[0]; title = parts.slice(1).join(' - ');
          }
          pageSongs.push({
            source: 'kugou', sid: hash,
            title: title, artist: artist,
            album: (sg.albuminfo && sg.albuminfo.name && str(sg.albuminfo.name)) || '',
            duration: parseInt(sg.timelength, 10) || 0,
            artwork: '',
            raw: { hash: hash, mixsongid: str(sg.audio_id || sg.album_audio_id || '') }
          });
        }
        beginIdx += songs.length;
      }
      // 身份校验：分享页歌单名与 nofilt 返回的歌单名都不为空且互不包含 → 该候选不是目标歌单
      var li = (dd && dd.list_info) || {};
      if (pageName && li.name && String(li.name) !== String(pageName)
        && String(li.name).indexOf(pageName) < 0 && String(pageName).indexOf(li.name) < 0) continue;
      if (pageSongs.length) {
        out = pageSongs;
        meta = {
          title: str(li.name) || undefined,
          artwork: str(li.pic).replace('{size}', '480') || undefined,
          description: str(li.intro) || undefined,
          artist: str(li.list_create_username) || undefined,
          worksNum: parseInt(li.count, 10) || undefined
        };
      }
    } catch (e) { lastErr = e; out = []; meta = null; }
  }
  if (out.length) {
    await enrichArtwork(out, 24);
    return { songs: out, meta: meta };
  }
  if (lastErr) throw lastErr;
  throw sheetImportError('SHEET_EMPTY', '歌单为空（gateway 候选全部无数据）');
}

// ③ kucode（口令直取歌单，kucodeAndShare 接口）
async function fetchKugouKucodeSheet(dec) {
  var body = {
    appid: 1001, clientver: 10112,
    mid: '70a02aad1ce4648e7dca77f2afa7b182',
    clienttime: 722219501, key: '381d7062030e8a5a94cfbe50bfe65433',
    data: {
      id: dec.id, type: 3, userid: dec.userid || 0,
      collect_type: dec.collectType || '',
      page: 1, pagesize: Math.min(dec.count || 100, SHEET_MAX_ITEMS)
    }
  };
  var res = await axios.post('https://www2.kugou.kugou.com/apps/kucodeAndShare/app/', body, {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Content-Type': 'application/json' }
  });
  var d = res.data && res.data.data;
  var list = Array.isArray(d) ? d : ((d && d.info) || (d && d.songs) || []);
  var out = [];
  for (var i = 0; i < list.length && out.length < SHEET_MAX_ITEMS; i++) {
    var sg = list[i];
    var hash = str(sg.hash || '');
    if (!hash) continue;
    var name = str(sg.filename || sg.name || '');
    var artist = '', title = name;
    if (name.indexOf(' - ') > 0) {
      var parts = name.split(' - ');
      artist = parts[0]; title = parts.slice(1).join(' - ');
    }
    out.push({
      source: 'kugou', sid: hash,
      title: title, artist: artist,
      album: '',
      duration: parseInt(sg.duration || sg.timelength, 10) || 0,
      artwork: '',
      raw: { hash: hash, mixsongid: str(sg.audio_id || sg.mixsongid || '') }
    });
  }
  await enrichArtwork(out, 24);
  return out;
}

// [v1.8.4] 歌单元数据：mobilecdn v3/special/info（specialid 免签，探针 2026-09-10：
// specialname/intro/imgurl/nickname/songcount/playcount 全量返回）。best-effort，
// 调用方 try/catch 兜底；imgurl 为 {size} 模板时取 480 档。
async function fetchKugouSheetMeta(specialid) {
  var res = await axios.get('http://mobilecdn.kugou.com/api/v3/special/info', {
    params: { specialid: specialid },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var d = res.data && res.data.data;
  if (!d || !d.specialname) return null;
  var cover = str(d.imgurl).replace('{size}', '480');
  return {
    title: str(d.specialname),
    artwork: cover || undefined,
    description: str(d.intro) || undefined, // 介绍字段名对齐宿主 IMusicSheetItemBase.description
    artist: str(d.nickname) || undefined,
    worksNum: parseInt(d.songcount, 10) || undefined,
    playCount: parseInt(d.playcount, 10) || undefined
  };
}

// [v1.8.2 P0-2] 分享页 specialid 提取必须手机 UA：桌面 UA 返回 16KB 壳页无 specialid，
// iPhone UA 返回 35KB 完整页（2026-09-10 实测）。其余酷狗请求沿用桌面 UA 不动。
var KUGOU_SHEET_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

// [v1.8.2 P2 #12] 歌单导入错误码（宿主统一处理用，文案不变）
function sheetImportError(code, msg) {
  var e = new Error('[kugou] ' + msg);
  e.code = code;
  e.platform = 'kugou';
  return e;
}

// [v1.8.3 Q-04] 分享页歌单封面提取（"pic" 为歌单封面 soft/collection 路径，
// "cover" 作次选；零额外请求——复用抓取分享页的既有响应）。
function extractKugouSheetCover(page) {
  var m = /["']pic["']\s*:\s*["']([^"']+)["']/.exec(page)
       || /["']cover["']\s*:\s*["']([^"']+)["']/.exec(page);
  return m ? m[1].replace(/\\\//g, '/').replace('{size}', '480') : '';
}

/**
 * 解析歌单链接/纯数字 id → { source, id } 或 { source, kind, ... }
 * [v1.2.0] 支持：酷狗网页链接；gcid 分享链（gcid 直连 gateway 分页，或抓分享页提取 specialid）；
 * 纯数字酷狗码（t.kugou.com/command 解码，baka 对齐）。
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

  // [v1.2.0] 纯数字酷狗码（对齐 baka：t.kugou.com/command 解码）
  if (/^\d{5,}$/.test(s)) {
    var dec = await resolveKugouCode(s);
    // [v1.8.2 P0-2] 解码结果带 specialid（type=2 歌单码实测命中）→ 直接走
    // mobilecdn v3/special/song 免签拉歌；gateway 签名通道（密钥已失效 20006）降为兜底。
    if (dec && dec.kind === 'gcid' && dec.specialid && (dec.type === 2 || !dec.type)) {
      return { source: 'kugou', id: dec.specialid, cover: dec.cover || '' };
    }
    if (dec && dec.kind === 'gcid') return { source: 'kugou', kind: 'gcid', gcid: dec.gcid };
    if (dec && dec.kind === 'kucode') return { source: 'kugou', kind: 'kucode', id: dec.id, userid: dec.userid, collectType: dec.collectType, count: dec.count };
    if (dec && dec.kind === 'list') return { source: 'kugou', kind: 'direct', songs: dec.songs };
    throw sheetImportError('SHEET_URL_UNRECOGNIZED', '酷狗码无法识别对应歌单内容');
  }

  // 酷狗 gcid 分享链：[v1.8.2 P0-2/P1-2] 先抓分享页（手机 UA）提取 specialid 走免签拉歌
  // （分享 token 不可经 t.kugou.com/command 解码——实测 strconv.Atoi 报错；也不能直接当
  // global_collection_id 用）；[v1.9.1] specialid=0（「我喜欢」类默认歌单不落 specialid）
  // 不再当有效 id 返回（旧版返回 id='0' → 免签通道空结果 →「歌单为空」的根因），改为提取
  // listinfo 的 list_create_userid/count/name，走 collection_3_{uid}_2_0 全量通道。
  if (/kugou\.com\/songlist\/gcid_/.test(s)) {
    var gcidM = /gcid_([0-9a-zA-Z]+)/.exec(s);
    if (/^https?:\/\//.test(s)) {
      try {
        var html = await axios.get(s, {
          timeout: SOURCE_TIMEOUT,
          headers: { 'User-Agent': KUGOU_SHEET_MOBILE_UA }
        });
        // [v1.8.3 Q-01] 收紧为两种锚定形态：JSON 字段（"specialid":NNN）与键/赋值
        // 形态（specialid=NNN / specialid:NNN，前置字符必须非 \w，排除 global_specialid）。
        var page = String(html.data || '');
        var mg = /["']specialid["']\s*:\s*["']?(\d+)/.exec(page)
              || /(^|[^\w])specialid\s*[=:]\s*["']?(\d+)/.exec(page);
        var sid = mg ? (mg[1] || mg[2]) : '';
        if (sid && sid !== '0') return { source: 'kugou', id: sid, cover: extractKugouSheetCover(page) };
        // [v1.9.1] specialid=0/缺失 → 提取「我喜欢」默认歌单内部 ID 三要素
        // （listinfo 块内截取，避免命中页面其他 count/name 字段）
        var liM = /["']listinfo["']\s*:\s*\{/.exec(page);
        if (liM && gcidM) {
          var liTxt = page.slice(liM.index, liM.index + 1200);
          var uidM = /["']list_create_userid["']\s*:\s*"?(\d+)/.exec(liTxt);
          if (uidM) {
            var cntM = /["']count["']\s*:\s*"?(\d+)/.exec(liTxt);
            var nmM = /["']name["']\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(liTxt);
            var pageName = '';
            if (nmM) { try { pageName = JSON.parse('"' + nmM[1] + '"'); } catch (e2) { pageName = nmM[1]; } }
            return {
              source: 'kugou', kind: 'gcid', gcid: gcidM[1],
              uid: uidM[1],
              count: cntM ? parseInt(cntM[1], 10) : 0,
              pageName: pageName,
              cover: extractKugouSheetCover(page)
            };
          }
        }
      } catch (e) { /* 分享页抓取失败 → 落回 gcid 直连通道 */ }
    }
    if (gcidM) return { source: 'kugou', kind: 'gcid', gcid: gcidM[1] };
    throw sheetImportError('SHEET_URL_UNRECOGNIZED', '酷狗分享页中未找到歌单标识');
  }

  var sources = ['kugou'];
  for (var i = 0; i < sources.length; i++) {
    var id = SHEET_URL_RESOLVERS[sources[i]](s);
    if (id) return { source: sources[i], id: id };
  }
  throw sheetImportError('SHEET_URL_UNRECOGNIZED', '无法识别的歌单链接（支持酷狗的网页或分享链接）');
}

var SHEET_FETCHERS = {
  kugou: async function (specialid, sheetCover) {
    var out = [];
    for (var page = 1; page <= SHEET_MAX_PAGES && (page - 1) * 100 < SHEET_MAX_ITEMS; page++) {
      var res = await axios.get('http://mobilecdn.kugou.com/api/v3/special/song', {
        params: { specialid: specialid, page: page, pagesize: 100, plat: 2, version: 7910 },
        timeout: SOURCE_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      var data = res.data && res.data.data;
      var list = (data && data.info) || [];
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        var artist = str(it.singername || '');
        var title = str(it.songname || '');
        if (!title && it.filename) {
          var parts = String(it.filename).split(' - ');
          if (parts.length >= 2) { artist = artist || parts[0]; title = parts.slice(1).join(' - '); }
          else title = String(it.filename);
        }
        out.push({
          source: 'kugou', sid: str(it.hash),
          title: title, artist: artist,
          album: str(it.album_name || ''),
          duration: parseInt(it.duration, 10) || 0,
          artwork: str(it.img || it.album_img || '').replace('{size}', '400'),
          raw: { hash: str(it.hash), hash320: str(it['320hash'] || ''), hashSq: str(it.sqhash || ''), mixsongid: str(it.mixsongid || ''), mvHash: str(it.mvhash || '') }
        });
      }
      if (list.length < 100) break;
    }
    await enrichArtwork(out, 24); // v0.7.1 P1-4：300→24（首屏可见量），其余封面靠 getMusicInfo 懒加载
    // [v1.8.3 Q-04] 零额外请求补齐 album/artwork：① 复用 enrichArtwork 已发出的
    // get_song_info 响应（kugouAlbumCache）回填专辑名；② 仍无封面的条目以歌单封面兜底
    // （分享页/歌单码解码顺带带出）。不新增逐曲请求，未覆盖部分仍由宿主 getMusicInfo 懒加载。
    for (var j = 0; j < out.length; j++) {
      var rj = out[j].raw || {};
      if (!out[j].album && rj.hash && kugouAlbumCache[rj.hash]) out[j].album = kugouAlbumCache[rj.hash];
      if (!out[j].artwork && sheetCover) out[j].artwork = sheetCover;
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
    title: entry.title,
    artist: entry.artist,
    album: entry.album || undefined,
    duration: entry.duration || undefined,
    artwork: entry.artwork || undefined,
    // [v1.8.2 P2 #6] 歌单条目 platform 自报（对齐 kuwo/qq 口径）
    platform: entry.source || 'kugou',
    _src: src,
    _srcOrder: [entry.source]
  };
  // [v1.2.0] MV 字段透出（宿主 MV 菜单判定依赖，与 buildMusicItem 同口径）
  var entryRaw = entry.raw || {};
  if (entryRaw.mvHash) { item.mvHash = entryRaw.mvHash; item.mv = entryRaw.mvHash; }
  else if (entryRaw.mv) { item.mv = entryRaw.mv; }
  return item;
}

/**
 * 导入歌单：urlLike 支持酷狗网页/分享链接（含 gcid 分享链）。
 * [v1.8.4] 返回完整 IMusicSheetItem 歌单对象（title/description 对齐宿主契约）；
 * 条目带单源 _src，播放时复用取链接力。
 */
async function importMusicSheetImpl(urlLike) {
  var resolved = await resolveSheetId(urlLike);
  // [v1.2.0] 新通道分发：gcid / kucode / 口令直出列表
  var entries;
  var gcidMeta = null;
  if (resolved.kind === 'gcid') {
    // [v1.9.1] 候选链：collection_3_{uid}_2_0（「我喜欢」类默认歌单，实测一次拉全量）
    // → collection_3_{uid}_1_0 → gcid 原形态（解码结果可能已是完整 collection_/gcid_ 形态，
    // 裸 token 补 gcid_ 前缀）；结果带 nofilt list_info 元数据。
    var gcidToken = str(resolved.gcid || '');
    var gcidCands = [];
    if (resolved.uid) {
      gcidCands.push('collection_3_' + resolved.uid + '_2_0');
      gcidCands.push('collection_3_' + resolved.uid + '_1_0');
    }
    if (gcidToken) {
      gcidCands.push(/^(gcid_|collection_)/.test(gcidToken) ? gcidToken : 'gcid_' + gcidToken);
    }
    var gcidRes = await fetchKugouGcidSheet(gcidCands, resolved.pageName || '');
    entries = gcidRes.songs;
    gcidMeta = gcidRes.meta;
  } else if (resolved.kind === 'kucode') {
    entries = await fetchKugouKucodeSheet(resolved);
  } else if (resolved.kind === 'direct') {
    var direct = [];
    var dlist = resolved.songs || [];
    for (var di = 0; di < dlist.length && direct.length < SHEET_MAX_ITEMS; di++) {
      var dsg = dlist[di];
      var dhash = str(dsg.hash || '');
      if (!dhash) continue;
      var dname = str(dsg.filename || dsg.name || '');
      var dartist = '', dtitle = dname;
      if (dname.indexOf(' - ') > 0) {
        var dparts = dname.split(' - ');
        dartist = dparts[0]; dtitle = dparts.slice(1).join(' - ');
      }
      direct.push({
        source: 'kugou', sid: dhash,
        title: dtitle, artist: dartist,
        album: '',
        duration: 0,
        artwork: '',
        raw: { hash: dhash }
      });
    }
    await enrichArtwork(direct, 24);
    entries = direct;
  } else {
    var fetcher = SHEET_FETCHERS[resolved.source];
    if (!fetcher) throw sheetImportError('SHEET_URL_UNRECOGNIZED', '该平台暂不支持歌单导入');
    entries = await fetcher(resolved.id, resolved.cover);
  }
  if (!entries.length) throw sheetImportError('SHEET_EMPTY', '歌单为空或拉取失败（' + (resolved.source || 'kugou') + '）');
  // 同源内按 sid 去重（部分平台歌单会有重复行）
  var seen = {};
  var out = [];
  for (var i = 0; i < entries.length && out.length < SHEET_MAX_ITEMS; i++) {
    var key = entries[i].sid;
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(buildSheetItem(entries[i]));
  }
  await enrichKugouQualities(out); // [v1.9.9] 导入歌单音质标识补齐（cap 全量）
  // [v1.8.4]（对齐宿主 IImportMusicSheetResult / 咪咕 v1.2.0 同构）：返回完整歌单对象。
  // 元数据 best-effort：specialid 通道（分享页提取/酷狗码解码）拉 v3/special/info；
  // [v1.9.1] gcid 通道元数据直接用 nofilt list_info（gcidMeta，标题/封面/创建者/worksNum）。
  var meta = null;
  if (resolved.id) {
    try { meta = await fetchKugouSheetMeta(resolved.id); } catch (e) { meta = null; }
  }
  if (!meta && gcidMeta) meta = gcidMeta;
  var keyId = str(resolved.id || resolved.gcid || '');
  var sheet = {
    id: 'kugou_' + (keyId || 'imported'),
    platform: 'kugou',
    isImported: true,
    title: (meta && meta.title) || ('酷狗歌单 #' + (keyId || 'imported')),
    artwork: (meta && meta.artwork) || resolved.cover || (out[0] && out[0].artwork) || undefined,
    worksNum: (meta && meta.worksNum) || out.length,
    musicList: out
  };
  if (meta && meta.description) sheet.description = meta.description;
  if (meta && meta.playCount) sheet.playCount = meta.playCount;
  if (meta && meta.artist) { sheet.artist = meta.artist; sheet.author = meta.artist; } // [v1.9.1] author 别名（任务字段清单要求 author，宿主协议用 artist）
  return sheet;
}

// ==================== 单曲导入 & 歌曲详情（v0.7.0 P0-3/P0-4）====================
// 端点实测（artifacts/v07-probe/probe12.mjs + 汽水分享页探针，2026-09-06）：
// kugou  m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=（真实 hash 复核 errcode=0：
//        songName/singerName/albumid/album_img/timeLength/hash/url）

var SONG_URL_RESOLVERS = {
  kugou: function (s) {
    if (!/kugou\.com/.test(s)) return null;
    var m = /mixsong\/([0-9a-fA-F]{32})/.exec(s) || /([0-9a-fA-F]{32})/.exec(s);
    if (m) return m[1].toUpperCase();
    // [v1.5.0 P1-2] 官方分享页 https://www.kugou.com/mixsong/{encode_album_audio_id}.html：
    // encode token（如 j410q60）非 32hex、不可由 album_audio_id 确定性推导，回导时拉页面
    // 取 "hash":"<32hex>"（探针 2026-09-08 实测与搜索 FileHash 一致）。
    var t = /mixsong\/([0-9a-z]{4,16})\.html/i.exec(s);
    return t ? { encodeToken: t[1] } : null;
  }
};

/**
 * [v1.5.0] encode token 分享页 → 32hex hash（回导链）。失败返回空串。
 */
async function fetchHashFromSharePage(token) {
  var res = await axios.get('https://www.kugou.com/mixsong/' + encodeURIComponent(String(token)) + '.html', {
    timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var m = /"hash":\s*"([0-9a-fA-F]{32})"/.exec(String(res.data));
  return m ? m[1].toUpperCase() : '';
}

/**
 * 解析单曲分享链接 → { source, id }
 * 短链（t1.kugou.com）先 302 跟随再匹配；
 * [v1.5.0] encode token 分享页（mixsong/{token}.html）拉页反解 hash；
 * 纯数字 id 无法唯一判定平台，不猜。
 */
async function resolveSongId(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw new Error('单曲链接为空');
  if (/^https?:\/\/t1\.kugou\.com/.test(s)) {
    s = await followRedirects(s);
  }
  if (/^\d{5,}$/.test(s)) throw new Error('纯数字歌曲 id 无法判定平台，请粘贴带域名的完整分享链接');

  var sources = ['kugou'];
  for (var i = 0; i < sources.length; i++) {
    var id = await SONG_URL_RESOLVERS[sources[i]](s);
    if (id) {
      if (id && id.encodeToken) {
        var h = await fetchHashFromSharePage(id.encodeToken);
        if (!h) throw new Error('分享页未取得歌曲 hash（酷狗 ' + id.encodeToken + '）');
        return { source: sources[i], id: h };
      }
      return { source: sources[i], id: id };
    }
  }
  throw new Error('无法识别的单曲链接（支持酷狗的歌曲分享链接）');
}

var SONG_DETAIL_FETCHERS = {
  kugou: function (hash) {
    var H = String(hash).toUpperCase();
    return axios.get('https://m.kugou.com/app/i/getSongInfo.php', {
      params: { cmd: 'playInfo', hash: H, mid: '123456789123456789' },
      timeout: SOURCE_TIMEOUT, headers: kugouCookieHeaders()
    }).then(async function (res) {
      var d = (res.data && res.data.data) || res.data;
      if (!d || d.errcode !== 0 || !d.hash) throw new Error('kugou detail empty');
      // [P1-1 v1.1.0] 单曲导入三档 hash 反查补齐：getSongInfo 只回主 hash，
      // 不反查则 320k/无损档拿 128k hash 请求（actualQuality 虚标）。
      // 反查：mobilecdn v3 搜索（歌名+歌手），优先主 hash 精确匹配，回退 歌名+时长 匹配；
      // 失败不阻断导入，退化为仅主 hash（与 v1.0.0 行为一致）。
      var raw = { hash: String(d.hash).toUpperCase(), hash320: '', hashSq: '', mixsongid: str(d.album_audio_id || ''),
                  // [v1.5.0 P1-1/P2-4 -> v1.9.5] fee（VIP 标记）停写；alias 详情无，由下方反查
                  // hit.othername 回填。
                  alias: '' };
      try {
        var kw = (str(d.songName) + ' ' + str(d.singerName)).trim();
        if (kw) {
          var s = await axios.get('http://mobilecdn.kugou.com/api/v3/search/song', {
            params: { format: 'json', keyword: kw, page: 1, pagesize: 20 },
            timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          var list = (s.data && s.data.data && s.data.data.info) || [];
          var dur = parseInt(d.timeLength, 10) || 0;
          var hit = null;
          for (var i = 0; i < list.length; i++) {
            if (String(list[i].hash || '').toUpperCase() === H) { hit = list[i]; break; }
          }
          if (!hit) {
            for (var j = 0; j < list.length; j++) {
              var jd = parseInt(list[j].duration, 10) || 0;
              if (dur > 0 && jd === dur && str(list[j].songname) === str(d.songName)) { hit = list[j]; break; }
            }
          }
          if (hit) {
            raw.hash320 = str(hit['320hash'] || '');
            raw.hashSq = str(hit.sqhash || '');
            if (!raw.mixsongid) raw.mixsongid = str(hit.album_audio_id || '');
            if (hit.mvhash) raw.mvHash = str(hit.mvhash); // [v1.2.0] MV 字段对齐（反查通道带回）
            // [v1.5.0 P1-1/P2-4 -> v1.9.5] 反查带回 alias（fee 已停写）
            raw.alias = str(hit.othername || '');
          }
        }
      } catch (eProbe) { /* 反查失败不阻断 */ }
      return {
        source: 'kugou', sid: str(d.hash),
        title: str(d.songName), artist: str(d.singerName),
        album: d.albumname || '',
        duration: parseInt(d.timeLength, 10) || 0,
        artwork: d.album_img ? String(d.album_img).replace('{size}', '480') : '',
        // [v1.5.0 -> v1.9.5] 详情条目带 alias（fee/VIP 标识已停写）
        alias: raw.alias || undefined,
        raw: raw
      };
    });
  }
};

// [⑮ v1.1.0] 单曲详情缓存包装：正向 60s TTL + 失败负缓存 60s
// （审查 P3-5：官方 getSongInfo 接口限频约 80 次/IP，重复导入/详情补齐会反复打同一 hash）
var songDetailCache = {}; // HASH -> { ts, val | err }
var SONG_DETAIL_TTL_MS = 60 * 1000;
var _kugouDetailBase = SONG_DETAIL_FETCHERS.kugou;
SONG_DETAIL_FETCHERS.kugou = function (hash) {
  var H = String(hash).toUpperCase();
  var c = songDetailCache[H];
  if (c && Date.now() - c.ts < SONG_DETAIL_TTL_MS) {
    return c.err ? Promise.reject(c.err) : Promise.resolve(c.val);
  }
  return _kugouDetailBase(H).then(function (v) {
    songDetailCache[H] = { ts: Date.now(), val: v };
    return v;
  }, function (e) {
    songDetailCache[H] = { ts: Date.now(), err: e };
    throw e;
  });
};

// ==================== [v1.5.0 P1-2] 官方歌曲分享页（getMusicDetailPageUrl）====================
// 分享页格式：https://www.kugou.com/mixsong/{encode_album_audio_id}.html（探针 2026-09-08：
// 纯数字 mixsongid 页面 302→首页、hash 拼接页 404，活页面只认 encode token）。
// encode token 取自 complexsearch.kugou.com/v2/search/song 响应的 EMixSongID 字段：
//   签名 = md5(盐 + sorted(k=v)拼接 + 盐)，盐 NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt，
//   参数集 appid=1014/bitrate=0/callback=callback123/clienttime(ms)/clientver=1000/dfid=-/
//   filter=10/inputtype=0/iscorrection=1/isfuzzy=0/keyword/mid/dfid 同值/page/pagesize=30/
//   platform=WebFilter/privilege_filter=0/srcappid=2919/token=/userid=0/uuid（CSDN 逆向实测 + 本方复测通过）。
// 匹配策略：优先 FileHash 与条目 hash 精确一致（防同名错配），无 hash 时取首个 EMixSongID。
var KUGOU_COMPLEX_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
var KUGOU_COMPLEX_MID = 'aa67be01ec4f35db52689b116d8b8775';
var KUGOU_COMPLEX_DFID = '3x7fD93RtFKs0C9yg30SZhjL';
var sharePageCache = {};   // cacheKey(hash 或 title|artist) -> { ts, url }
var SHARE_PAGE_TTL_MS = 10 * 60 * 1000;

function complexSearchSignature(params) {
  var keys = Object.keys(params).sort();
  var acc = '';
  for (var i = 0; i < keys.length; i++) acc += keys[i] + '=' + params[keys[i]];
  return md5Hex(KUGOU_COMPLEX_SALT + acc + KUGOU_COMPLEX_SALT);
}

/** complexsearch v2/song 签名搜索 → lists[]（失败抛错，调用方兜底） */
async function complexSearchSong(keyword) {
  var ts = String(Date.now());
  var params = {
    appid: '1014', bitrate: '0', callback: 'callback123', clienttime: ts, clientver: '1000',
    dfid: KUGOU_COMPLEX_DFID, filter: '10', inputtype: '0', iscorrection: '1', isfuzzy: '0',
    keyword: keyword, mid: KUGOU_COMPLEX_MID, page: '1', pagesize: '30',
    platform: 'WebFilter', privilege_filter: '0', srcappid: '2919', token: '',
    userid: '0', uuid: KUGOU_COMPLEX_MID
  };
  var sig = complexSearchSignature(params);
  var keys = Object.keys(params);
  var qs = [];
  for (var i = 0; i < keys.length; i++) qs.push(keys[i] + '=' + encodeURIComponent(params[keys[i]]));
  var res = await axios.get('https://complexsearch.kugou.com/v2/search/song?' + qs.join('&') + '&signature=' + sig, {
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36', Referer: 'https://www.kugou.com/' }
  });
  var text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  var jm = /^\s*callback123\(([\s\S]*)\)\s*$/.exec(text);
  if (jm) text = jm[1];
  var j = JSON.parse(text);
  if (!j || j.status !== 1) throw new Error('complexsearch 状态异常 ' + (j && j.error_code));
  return (j.data && j.data.lists) || [];
}

/** [v1.5.0 P1-2] 官方分享页链接（宿主分享/浏览器打开用）。取不到返回 null，宿主有 fallback。 */
async function getMusicDetailPageUrlImpl(musicItem) {
  if (!musicItem) return null;
  var title = str(musicItem.title || '');
  if (!title) return null;
  var artist = str(musicItem.artist || '');
  // 条目酷狗 hash（_src.kugou.hash；导入/搜索条目均在）
  var H = '';
  if (musicItem._src && musicItem._src.kugou && musicItem._src.kugou.hash) {
    H = String(musicItem._src.kugou.hash).toUpperCase();
  }
  var cacheKey = H || (title + '|' + artist);
  var c = sharePageCache[cacheKey];
  if (c && Date.now() - c.ts < SHARE_PAGE_TTL_MS) return c.url;
  try {
    var lists = await complexSearchSong(artist ? title + ' ' + artist : title);
    var token = '';
    if (H) {
      for (var i = 0; i < lists.length; i++) {
        if (str(lists[i].FileHash).toUpperCase() === H && lists[i].EMixSongID) { token = str(lists[i].EMixSongID); break; }
      }
    }
    if (!token && lists.length && lists[0].EMixSongID) token = str(lists[0].EMixSongID);
    if (!token) return null;
    var url = 'https://www.kugou.com/mixsong/' + token + '.html';
    sharePageCache[cacheKey] = { ts: Date.now(), url: url };
    return url;
  } catch (e) {
    return null; // 分享页属增强信息，失败走宿主 platform@id fallback
  }
}

/** 导入单曲：分享链接 → 详情 → 聚合条目（单源 _src，播放/歌词复用源能力） */
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
  // [v1.8.1 P0-2] 裸 ID playById 反查——酷狗主键为 hash，复用 SONG_DETAIL_FETCHERS
  // + buildSheetItem 重建条目（与 importMusicItemImpl 同路径）。参照 migu 兜底模式。
  if (!musicItem._src) {
    try {
      var bareId = String(musicItem.hash || musicItem.id || '').trim();
      if (bareId && SONG_DETAIL_FETCHERS.kugou) {
        var entry = await SONG_DETAIL_FETCHERS.kugou(bareId);
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
  var sidKey = { kugou: 'hash' };

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
      // [v1.2.0] MV 字段补齐：详情反查带回 mvHash 而条目缺失时补上（宿主 MV 菜单判定依赖）
      if (!musicItem.mvHash && detail.raw && detail.raw.mvHash) {
        musicItem.mvHash = detail.raw.mvHash;
        if (!musicItem.mv) musicItem.mv = detail.raw.mvHash;
      }
      // [v1.5.0 P1-1/P2-4 -> v1.9.5] alias 补齐：详情带回而条目缺失时补上（fee 已停写）
      if (!musicItem.alias && detail.alias) musicItem.alias = detail.alias;
      if (musicItem.artwork && musicItem.duration) break; // 关键字段齐了就停
    } catch (e) { /* 详情可选，失败换下个源 */ }
  }
  // 仍缺封面：走封面反查通道（酷狗 get_song_info）
  if (!musicItem.artwork) {
    try { await enrichArtwork([musicItem]); } catch (e) { /* 封面可选 */ }
  }
  // [v1.3.0 P0-1] 音质大小补齐（宿主官方通道）：条目缺 qualities/size 时宿主会主动调
  // getMusicInfo 并合并返回的 qualities（musicDetail operations / musicItemOptions 的
  // 「补大小」触发器）。用免签名批量接口 get_res_privilege 查全档 filesize（含 atmos/master），
  // 返回带 qualities 的副本——不改原条目（宿主按返回值合并，就地改可能丢）。
  try {
    var kugouRaw0 = srcMap.kugou || {};
    if (kugouRaw0.hash) {
      var sizeMap = await fetchQualitySizes([kugouRaw0.hash]);
      var q0 = sizeMap[String(kugouRaw0.hash).toUpperCase()];
      if (q0) {
        var out = Object.assign({}, musicItem);
        // 搜索期已挂的三档 qualities 保留，get_res_privilege 全档结果覆盖合并
        out.qualities = Object.assign({}, musicItem.qualities, q0);
        return out;
      }
    }
  } catch (e) { /* 大小属增强信息，失败不阻塞详情返回 */ }
  return musicItem;
}

// ==================== 取链适配器 ====================


// [⑭ v1.1.0] raceSuccess 死代码已删除：定义并导出但全文件零调用（审查 P3-3），
// 顺序接力（resolveKugou）省请求且更稳，保留竞速无收益。

// ==================== v0.7.3 纯 JS 加密模块 ====================
// 算法来源：《六平台接口文档（实测整合版）》。
// 沙箱已对拍验证：MD5 与 Node 内置 crypto 一致（20/20 向量通过）。
// 宿主 require 白名单无 crypto 模块，故纯 JS 实现。
// 语法：ES8 兼容（无 ?. / ?? / BigInt / Buffer 依赖）。
// ---------- 基础 ----------
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

// ---------- 纯 JS MD5（RFC 1321） ----------
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

// 海棠 resolve-url 公共封装（用户已确认接受第三方备源）：
// source: 'kg'(酷狗)
// level 映射（文档实测）：standard/exhigh/lossless/hires（master/flac24bit 会降级 128k，不用）
// 文档实测：kg 必须 hash 全大写；酷狗 VIP 返回真 FLAC（酷狗 lossless 30.2MB / hires 24bit 52.8MB）
function haitangLevelOf(quality) {
  if (quality === 'super') return 'lossless';
  if (quality === 'hires') return 'hires';
  if (quality === 'high') return 'exhigh';
  return 'standard';
}

// ==================== [v1.3.0 P0-1] 音质大小通道 ====================
// 酷狗免签名批量接口（实测 2026-09-07：无需签名/登录/X-API-Key，普通 UA 即可访问）：
// POST https://gateway.kugou.com/goodsmstore/v1/get_res_privilege
//   ?appid=1005&clientver=20049&clienttime={ms}&mid=NeZha
//   body: { behavior:'play', clientver:'20049', resource:[{id:0,type:'audio',hash}],
//           area_code:'1', quality:'128',
//           qualities:['128','320','flac','high','dolby','viper_atmos','viper_tape','viper_clear'] }
// 字节大小取响应 data[].relate_goods[].info.filesize（实测结构：quality/info/hash 直接挂在
// relate_goods[] 元素上，无 quality_data 包装）；消费通道为条目 qualities[q].size
// （宿主音质菜单显示 + downloader 下载进度 expectedFileSize）。仅走非关键路径，不进取链。
var GOODSMSTORE_URL = 'https://gateway.kugou.com/goodsmstore/v1/get_res_privilege';
var GOODS_QUALITY_MAP = {
  '128': '128k', '320': '320k', 'flac': 'flac', 'flac24bit': 'flac24bit'
  // [v1.9.9 音质标识一致性修复] 剔除不可交付档位映射：high(hires)/dolby/viper_atmos(atmos)/
  // viper_clear(master)。依据 2026-09-12 实测：酷狗自有取链通道仅 128k/320k/flac/flac24bit
  // 全通（hires 及以上 code:6 未开放）；hires 原接力通道海棠已 404 下线、第三方洛雪无 hires
  // 档，实测「晴天」请求 hires/atmos/master 全部取链失败（128k/320k/flac 成功）。此前列表页
  // 按 get_res_privilege 透出这些键属虚标（点开取不到链接），与搜索页三档口径也不一致。
  // 取链链路未动：QUALITY_KEY_MAP 对 hires/atmos/master 的内部归一与 actualQuality 如实
  // 上报保持原样；supportedQualities 菜单声明（baka 对齐）保持原样。
  // viper_tape 实测与 320k 同码率同 hash（2026-09-07），不映射，避免虚标
};
// [v1.9.9] 请求列表保持原 8 档不动：实测裁剪为 4 档时接口返回空 goods（2026-09-12
// 对照实验），接口行为依赖完整 qualities 参数；不可交付档在 GOODS_QUALITY_MAP 映射层剔除。
var RES_PRIVILEGE_QUALITIES = ['128', '320', 'flac', 'high', 'dolby', 'viper_atmos', 'viper_tape', 'viper_clear'];
var resPrivilegeCache = {};  // 大写 HASH -> { ts, val }（60s TTL：搜索/详情/补大小共用，防重复打点）
var RES_PRIVILEGE_TTL_MS = 60 * 1000;

/** 批量查音质大小。返回 { 大写HASH: { '128k': {size,bitrate,hash}, ... } }；失败返回 {}（大小属增强信息，不阻塞主流程） */
async function fetchQualitySizes(hashList) {
  var hashes = [];
  for (var i = 0; i < hashList.length; i++) {
    var h = String(hashList[i] || '').toUpperCase();
    if (h && hashes.indexOf(h) < 0) hashes.push(h);
  }
  if (!hashes.length) return {};
  var now = Date.now();
  var need = [];
  for (var j = 0; j < hashes.length; j++) {
    var c = resPrivilegeCache[hashes[j]];
    if (!(c && now - c.ts < RES_PRIVILEGE_TTL_MS)) need.push(hashes[j]);
  }
  if (need.length) {
    var res = await axios.post(GOODSMSTORE_URL, {
      behavior: 'play',
      clientver: '20049',
      resource: need.map(function (h2) { return { id: 0, type: 'audio', hash: h2 }; }),
      area_code: '1',
      quality: '128',
      qualities: RES_PRIVILEGE_QUALITIES
    }, {
      params: { appid: 1005, clientver: 20049, clienttime: now, mid: 'NeZha' },
      timeout: SOURCE_TIMEOUT,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var dataList = (res.data && res.data.data) || [];
    for (var k = 0; k < dataList.length; k++) {
      var entry = dataList[k] || {};
      var entryHash = String(entry.hash || '').toUpperCase();
      if (!entryHash) continue;
      var qualities = {};
      var goods = entry.relate_goods || [];
      for (var g = 0; g < goods.length; g++) {
        var good = goods[g] || {};
        var qKey = GOODS_QUALITY_MAP[good.quality];
        var info = good.info || {};
        var size = parseInt(info.filesize, 10) || 0;
        if (qKey && size > 0) {
          qualities[qKey] = {
            size: size, // 字节 number：宿主 parseQualityFileSize 首选路径，下载进度最稳
            bitrate: info.bitrate || undefined,
            hash: String(good.hash || '') || undefined
          };
        }
      }
      resPrivilegeCache[entryHash] = { ts: now, val: qualities };
    }
  }
  var out = {};
  for (var m = 0; m < hashes.length; m++) {
    var cached = resPrivilegeCache[hashes[m]];
    if (cached && cached.val) out[hashes[m]] = cached.val;
  }
  return out;
}

// [v1.9.5] 列表页音质补齐：榜单(kgrank)/歌单/专辑/歌手作品/导入等入口条目不带音质表，
// 按主 hash 批量查 get_res_privilege（fetchQualitySizes，含 60s TTL 缓存），返回宿主
// 标准 quality 键（[v1.9.9] 仅 128k/320k/flac/flac24bit 可交付档，不可取链档已剔除），
// 只补缺失条目；已有 qualities 的条目跳过（搜索等已覆盖入口零额外请求）。
// [v1.9.9] cap 缺省=全量（此前榜单 30/专辑 60/歌手 40 等截断导致同歌跨页键集不一致），
// 每批 ≤30 hash 顺序补齐，失败静默（宁缺毋假）。
async function enrichKugouQualities(musicList, cap) {
  var need = [];
  for (var i = 0; i < (musicList || []).length; i++) {
    var it = musicList[i];
    if (!it || it.qualities) continue;
    var kg = it._src && it._src.kugou;
    var h = kg && kg.hash ? String(kg.hash) : '';
    if (h) need.push({ idx: i, hash: h });
    if (need.length >= (cap || musicList.length)) break; // [v1.9.9] cap 缺省=全量，保证同歌跨页键集一致
  }
  if (!need.length) return;
  var CHUNK = 30;
  for (var c = 0; c < need.length; c += CHUNK) {
    var batch = need.slice(c, c + CHUNK);
    try {
      var sizeMap = await fetchQualitySizes(batch.map(function (x) { return x.hash; }));
      for (var b = 0; b < batch.length; b++) {
        var q0 = sizeMap[String(batch[b].hash).toUpperCase()];
        if (q0 && Object.keys(q0).length) musicList[batch[b].idx].qualities = q0;
      }
    } catch (e) { /* 大小属增强信息，失败不阻塞 */ }
  }
}

/** 从搜索 raw（song_search_v2 三档字节大小）构建 qualities；无可用大小返回 undefined */
function qualitiesFromSearchRaw(raw) {
  if (!raw) return undefined;
  var q = {};
  if (raw.size128 > 0) q['128k'] = { size: raw.size128 };
  if (raw.size320 > 0) q['320k'] = { size: raw.size320 };
  if (raw.sizeSq > 0) q['flac'] = { size: raw.sizeSq };
  var has = false;
  for (var k in q) { has = true; break; }
  return has ? q : undefined;
}

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

// [v0.7.2 fix#10 P1] 音质诚实性：插件内部档位 → 宿主音质键（IMediaSourceResult.actualQuality）。
// 多源接力/降级后「宣称档位 ≠ 实际档位」是多源播放器通病；v0.7.2 起各取链解析器
// 在返回值上附 actualQuality（宿主音质键口径：128k/192k/320k/flac/flac24bit/hires），
// 供宿主 UI 角标展示真实档位。取不到确定档位的通道不填该字段（宁缺毋假）。
function internalToHostQuality(q) {
  if (q === 'high') return '320k';
  if (q === 'super') return 'flac';
  if (q === 'hires') return 'hires';
  return '128k'; // standard / low / 未知
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

// ---------- 洛雪v5 服务端中转取链（v0.8.0 新增；签名算法来自《洛雪v5独家音源接口完整逆向报告》§三/§五/§六，已沙箱实测 4 档全通） ----------
// 域名用 punycode（88.lxmusic.xn--fiqs8s = 88.lxmusic.中国），避免部分运行环境 IDN 兼容问题
var LX5_BASE = 'https://88.lxmusic.xn--fiqs8s';
var LX5_UA = 'lx-music-pc/2.0.0';
// 常量（逆向报告已验证）：FP 指纹 / SALT 签名盐 / M·B 脚本常量 / Θ 时间切换点 / v 协议版本
var LX5_FP = '74c52ba24b386a2301983d94596246c2';
var LX5_SALT = 'LxSrv@2026#Sig';
var LX5_M = 'cbf73813e164e32a13bbe2d1f4e4e7bd';
var LX5_B = 'fb637140c486c08b146712411604a861';
var LX5_THETA = 1788677560604;
var LX5_V = 5;

// s2/s3 共用的多级 md5 链：md5( md5( ... md5(seed+k1)+k2 ... )+kn)
function lx5Md5Chain(seed, keys) {
  var acc = seed;
  for (var i = 0; i < keys.length; i++) {
    acc = md5Hex(acc + keys[i]);
  }
  return acc;
}

// si（脚本完整性指纹）：M 逐字节仿射变换 c=(111+(T0 mod 256)+(T0>=Θ?42:0)) mod 256，
// A[i] = c × (M[i]+1) mod 256，转 16 字节 hex 串后 md5(hexString+B)
function lx5Si(t0) {
  var c = (111 + (t0 % 256) + (t0 >= LX5_THETA ? 42 : 0)) % 256;
  var hexStr = '';
  for (var i = 0; i < 16; i++) {
    var mByte = parseInt(LX5_M.substr(i * 2, 2), 16);
    var a = (c * (mByte + 1)) % 256;
    hexStr += (a < 16 ? '0' : '') + a.toString(16);
  }
  return md5Hex(hexStr + LX5_B);
}

// 生成洛雪v5取链完整查询串（e/to/s2/v=5/si/s3；s3 仅 v4s 取链请求需要）
// to：T0 十六进制串逐字符与 e 的对应字节异或（循环次数按 h 实际长度，当前 11 字符）
function lx5SignQuery(path, src, id, quality) {
  var t0 = Date.now();
  var e = md5Hex(String(t0));
  var eB = md5Bytes(String(t0));
  var h = t0.toString(16);
  var to = '';
  for (var i = 0; i < h.length; i++) {
    var x = (h.charCodeAt(i) ^ eB[i]) & 0xFF;
    to += (x < 16 ? '0' : '') + x.toString(16);
  }
  // s2：路径绑定，5 级链 /L → vx → 4S → sr → /v（v4s 路径后缀序列）
  var s2 = lx5Md5Chain(md5Hex(path + '|' + t0 + '|' + LX5_FP + '|' + LX5_SALT), ['/L', 'vx', '4S', 'sr', '/v']);
  // s3：资源绑定，3 级 SALT 链；id 侧为 hash 字符串倒序
  var rid = String(id).split('').reverse().join('');
  var s3 = lx5Md5Chain(md5Hex(src + '|' + rid + '|' + quality + '|' + LX5_V + '|' + LX5_FP + '|' + t0 + '|' + LX5_SALT), [LX5_SALT, LX5_SALT, LX5_SALT]);
  return 'e=' + e + '&to=' + to + '&fp=' + LX5_FP + '&s2=' + s2 + '&v=' + LX5_V + '&si=' + lx5Si(t0) + '&s3=' + s3;
}

// 洛雪v5 取链：GET {BASE}/v4s/url/kg/{hash}/{quality}，UA 必须为 lx-music-pc/2.0.0
// 音质档位（实测）：128k/320k/flac/flac24bit 全通；更高（hires/atmos/dolby/master）code:6 暂未开放
// 响应：code:0 成功 data 为直链；code:2 上游转换失败；code:6 音质未开放；403 = 签名错误
// 直链约 1 小时过期（宿主侧缓存寿命），签名重放窗口仅数秒（每次实时生成）
function resolveLx5Kugou(hash, quality) {
  if (!hash) return Promise.reject(new Error('lx5 no hash'));
  var path = '/v4s/url/kg/' + hash + '/' + quality;
  var full = LX5_BASE + path + '?' + lx5SignQuery(path, 'kg', hash, quality);
  return axios.get(full, {
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': LX5_UA }
  }).then(function (res) {
    var d = res.data || {};
    if (d.code === 0 && d.data) {
      var url = String(d.data);
      if (url.indexOf('http') !== 0) throw new Error('lx5 bad url');
      return { url: url, actualQuality: quality === 'flac24bit' ? 'hires' : quality };
    }
    throw new Error('lx5 code:' + d.code + (d.message ? ' ' + d.message : ''));
  });
}

function resolveKugou(raw, quality, musicItem) {
  // 档位→hash 对应（文档 8.1：128k 用 hash / 320k 用 320hash / 无损与 hires 用 sqhash；
  // 海棠实测任意 hash 也能解出对应档位，缺档时回退主 hash）
  var hash = raw.hash;
  if (quality === 'high' && raw.hash320) hash = raw.hash320;
  if ((quality === 'super' || quality === 'hires') && raw.hashSq) hash = raw.hashSq;
  if (!hash) hash = raw.hash;
  // ① 官方 m.kugou getSongInfo（仅免费歌约28%可下，VIP 歌 status=0 无 URL；固定返回 128k 直链 → 仅 standard 档参与；
  //    惰性创建：非 standard 档不构造该 rejected promise，避免成功路径上的 unhandled rejection）
  var official = quality !== 'standard'
    ? null
    : axios.get('https://m.kugou.com/app/i/getSongInfo.php', {
        params: { cmd: 'playInfo', hash: hash },
        timeout: SOURCE_TIMEOUT,
        headers: kugouCookieHeaders()
      }).then(function (res) {
        // 响应兼容两种形状：扁平 { errcode, url, ... }（实测）与包裹 { data: { url } }
        var d = (res.data && res.data.data) || res.data;
        var url = d && d.url;
        if (!url) throw new Error('kugou no url');
        // 官方通道固定 128k 直链，actualQuality 如实报 standard（宁低勿高）
        return { url: String(url), actualQuality: 'standard' };
      });
  // ② 洛雪v5 服务端中转（v0.8.0 新增主力）：4 档全通，LX5 一律用主 hash（逆向报告实测）
  // 档位映射：standard→128k / high→320k / super→flac / hires→flac24bit
  var lx5QualityMap = { standard: '128k', high: '320k', super: 'flac', hires: 'flac24bit' };
  var lx5Thunk = function () { return resolveLx5Kugou(raw.hash || hash, lx5QualityMap[quality] || '128k'); };
  // ③ [v1.4.0] 三路并行竞速：酷狗自有通道（official→洛雪v5）‖ 海棠 ‖ 酷我官方直取
  //    谁先返回「通过协议/域名校验 + 非试听守卫」的有效 URL 就用谁（raceSuccess 首胜即用）；
  //    竞速窗口 RACE_BUDGET_MS 内三路全败时，回落原降级链剩余段（HYWmusic → zddyr，逻辑不变）。
  //    [v1.6.0] trackercdn v2 重写并接回接力链（官方兜底三 URL，带 Cookie 时生效；匿名
  //    环境风控 20028 自动跳过——v1 摘除的 "The Resource Needs to be Paid" 即该风控形态）。
  //    [v1.3.1 P1] HYWmusic 仍在降级链 zddyr 之前（免费歌 ~171KB 假文件自检拒收逻辑不变）。
  //    酷我通道按 KUWO_QUALITY_MAP 映射（standard/high/super）；hires 无对应官方档，
  //    resolveKuwoFallback 直接 reject 跳过，不同步竞速（宁缺毋降）。
  //    守卫统一上移到赛道闸门 guarded()：竞速胜出 URL 已过 guardFullAudio → 标记 r.guarded，
  //    resolveWithFallback 外层对已守卫结果跳过，避免胜出 URL 重复 Range 探测。
  // [⑯ v1.1.0] 通道命中统计 + 结果 channel 字段（审查 P3-6：洛雪v5 命中率可观测）
  var statTag = function (tag, r) {
    RESOLVE_STATS.total++;
    RESOLVE_STATS[tag] = (RESOLVE_STATS[tag] || 0) + 1;
    if (r && !r.channel) r.channel = tag; // 标注实际命中的取链通道
    return r;
  };
  // 赛道 A：酷狗自有（standard 才含官方 128k；洛雪v5 一律主 hash）——沿用惰性 thunk，
  // 只有前级失败才创建下一级 promise，避免成功路径上的 unhandled rejection
  // [v1.6.0] trackercdn v2 接回接力链（official→lx5 之后）：主线 VIP 歌 url 为空时兜底，
  // 匿名环境（无 kugouCookie）内自动 reject 跳过，不影响既有链
  var kgLane = (quality === 'standard'
    ? [['official', function () { return official; }], ['lx5', lx5Thunk], ['trackercdn', function () { return resolveKugouTrackercdn(raw, quality); }]]
    : [['lx5', lx5Thunk], ['trackercdn', function () { return resolveKugouTrackercdn(raw, quality); }]]
  ).reduce(function (acc, pair) {
    return acc.catch(function () {
      return pair[1]().then(function (r) { return statTag(pair[0], r); });
    });
  }, Promise.reject(new Error('kugou lane start')));
  // 赛道 B：海棠（全档兜底，VIP 歌真 FLAC/hires）
  var htLane = resolveHaitang('kg', hash, quality).then(function (r) { return statTag('haitang', r); });
  // 赛道 C：酷我官方直取（曲名+歌手搜 rid → convert_url_with_sign 五变体竞速，rid 10min 缓存）
  var kwLane = resolveKuwoFallback(musicItem, quality).then(function (r) { return statTag('kuwo', r); });
  var raceDeadline = Date.now() + RACE_BUDGET_MS;
  var guarded = function (lane, tag) {
    return withTimeout(lane, Math.max(300, raceDeadline - Date.now()), tag + ' 竞速超时').then(function (r) {
      if (!r || !r.url) throw new Error(tag + ' 无直链');
      if (!isAllowedMediaUrl(r.url)) throw new Error(tag + ' 返回 URL 未通过协议/域名校验');
      return withTimeout(guardFullAudio(r.url, musicItem), Math.max(300, raceDeadline - Date.now()), tag + ' 守卫超时')
        .then(function () { r.guarded = true; return r; });
    });
  };
  var raced = raceSuccess([
    guarded(kgLane, 'kugou'),
    guarded(htLane, 'haitang'),
    guarded(kwLane, 'kuwo')
  ]);
  if (quality === 'hires') return raced; // hires：酷狗自有链本就只有洛雪+海棠，竞速全败即失败
  // 竞速全败 → 原降级链剩余段照旧（HYWmusic → zddyr.top，逐级 catch 降级，全失败才抛错；
  // zddyr 有 QPS 限制勿并发，此处串行接力且只在竞速失败后才会创建请求）
  // [v1.9.4 disabled since 2026-09-11] HYWmusic / zddyr 实测整体失效，从接力链移除
  var rest = [
    // ['hyw', function () { return resolveHywKugou(raw, quality); }],
    // ['zddyr', function () { return resolveKugouZddyr(raw, quality); }]
  ];
  return raced.catch(function () {
    return rest.reduce(function (acc, pair) {
      return acc.catch(function () {
        return pair[1]().then(function (r) { return statTag(pair[0], r); });
      });
    }, Promise.reject(new Error('kugou relay start')));
  });
}

// trackercdn v2（v1.6.0 重写，music-lib kugou/download.go fetchTrackerSongInfo 逐行移植）：
// 主线 getSongInfo.php VIP 歌 url 为空时的官方兜底链路，三 URL 顺序接力：
//   ① https://trackercdn.kugou.com/i/v2/?cdnBackup=1&behavior=download&pid=1&cmd=21&appid=1001&hash={h}&key={md5(h+'kgcloudv2')}
//   ② http://trackercdnbj.kugou.com/i/v2/?cmd=23&pid=1&behavior=download&hash={h}&key={md5(h+'kgcloudv2')}
//   ③ http://trackercdn.kugou.com/i/?cmd=4&pid=1&forceDown=0&vip=1&hash={h}&key={md5(h+'kgcloud')}（旧 v1 形态，末位保留）
// ⚠️ 关键点：hash 必须先转小写再算 key（大写 hash 算出的 key 必错，实测最容易踩的坑）。
// url/backup_url 兼容 string 与 array（Go pickKugouURL 语义），errcode 必须为 0。
// 风控：匿名环境实测 status=2/errcode=20028（"需要付费"），带用户 Cookie 可用 →
// 仅当 userVariables.kugouCookie 非空才参与接力，匿名调用直接 reject（省必败请求）。
function resolveKugouTrackercdn(raw, quality) {
  // 兼容两种调用形态：v1 旧签名 resolveKugouTrackercdn(hash) 与 v2 新签名 (raw, quality)
  var hash = str(typeof raw === 'string' ? raw : (raw && raw.hash) || '');
  if (!hash) return Promise.reject(new Error('trackercdn no hash'));
  var ck = userVariablesSafe().kugouCookie;
  if (!ck) return Promise.reject(new Error('trackercdn skipped: no kugouCookie (匿名风控 20028，需用户 Cookie)'));
  // ⚠️ 先转小写再算 key（v1 实现缺这步，是当时必失败的原因之一）
  var h = String(hash).toLowerCase();
  var urls = [
    'https://trackercdn.kugou.com/i/v2/?cdnBackup=1&behavior=download&pid=1&cmd=21&appid=1001&hash=' + encodeURIComponent(h) + '&key=' + md5Hex(h + 'kgcloudv2'),
    'http://trackercdnbj.kugou.com/i/v2/?cmd=23&pid=1&behavior=download&hash=' + encodeURIComponent(h) + '&key=' + md5Hex(h + 'kgcloudv2'),
    'http://trackercdn.kugou.com/i/?cmd=4&pid=1&forceDown=0&vip=1&hash=' + encodeURIComponent(h) + '&key=' + md5Hex(h + 'kgcloud')
  ];
  var headers = (function () {
    var hd = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: 'https://www.kugou.com/',
      Cookie: String(ck)
    };
    var iph = kugouRiskIpHeaders();
    hd['X-Forwarded-For'] = iph['X-Forwarded-For'];
    hd['X-Real-IP'] = iph['X-Real-IP'];
    return hd;
  })();
  // url/backup_url 兼容 string 与 array（取首个非空 string，Go pickKugouURL 语义）
  var pickU = function (v) {
    if (typeof v === 'string' && v) return v;
    if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) {
        if (typeof v[j] === 'string' && v[j]) return v[j];
      }
    }
    return '';
  };
  var tryUrl = function (i) {
    if (i >= urls.length) return Promise.reject(new Error('trackercdn all endpoints failed'));
    return axios.get(urls[i], { timeout: RELAY_TIMEOUT, headers: headers }).then(function (res) {
      var d = res.data || {};
      var u = pickU(d.url) || pickU(d.backup_url);
      if (u) u = String(u).replace(/\\\//g, '/');
      if (d.errcode !== 0 || !u || String(u).indexOf('http') !== 0) {
        throw new Error('trackercdn status:' + d.status + ' errcode:' + d.errcode);
      }
      // actualQuality 按 extName/bitRate 近似映射（宁低勿高：不明就报 standard）
      var br = parseInt(d.bitRate, 10) || 0;
      var ext = str(d.extName).toLowerCase();
      var actual = (ext === 'flac' || br >= 500) ? 'super' : (br >= 320 ? 'high' : 'standard');
      return { url: u, actualQuality: actual, channel: 'trackercdn' };
    }).catch(function () { return tryUrl(i + 1); });
  };
  return tryUrl(0);
}

// zddyr.top（v0.8.0 新增）：LX Music 兼容第三方，128k/320k/flac 三档，最终兜底（有 QPS 限制，勿并发）
// GET https://yy.zddyr.top/lx/api/?source=kg&quality={q}&songmid={mid}&albumId=&mainHash={hash}
// songmid 非严格必填（实测传 hash 也能取链），优先用搜索时缓存的 mixsongid，缺省回退主 hash
// [v1.9.4 disabled since 2026-09-11] yy.zddyr.top/lx/api/ 实测 503 鉴权，与酷我星海同 IP → 整体死亡。
function resolveKugouZddyr(raw, quality) {
  return Promise.reject(new Error('zddyr disabled since 2026-09-11 (yy.zddyr.top 503)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function resolveKugouZddyr(raw, quality) {
  var zq = quality === 'high' ? '320k' : (quality === 'super' ? 'flac' : '128k');
  var mainHash = raw.hash || '';
  if (!mainHash) return Promise.reject(new Error('zddyr no hash'));
  return axios.get('https://yy.zddyr.top/lx/api/', {
    params: { source: 'kg', quality: zq, songmid: raw.mixsongid || mainHash, albumId: '', mainHash: mainHash },
    timeout: RELAY_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var d = res.data || {};
    if (d.code === 200 && d.url) {
      var url = String(d.url);
      if (url.indexOf('http') !== 0) throw new Error('zddyr bad url');
      // 直链含 qu128/qu320/quflac 段，可提取实际音质；无该段按请求档位如实回报
      var m = url.match(/qu(128|320|flac)/);
      var actual = m ? (m[1] === '128' ? 'standard' : (m[1] === '320' ? 'high' : 'super'))
                     : (zq === '320k' ? 'high' : (zq === 'flac' ? 'super' : 'standard'));
      return { url: url, actualQuality: actual };
    }
    throw new Error('zddyr code:' + d.code + (d.message ? ' ' + d.message : ''));
  });
}

// HYWmusic（v1.3.1 P1 新增，用户提供）：卡密制第三方聚合，kg 源支持 128k/320k/flac 三档（hires 不支持）
// GET http://103.79.184.97/api/music/url?source=kg&songId={hash}&quality={q}&key={CARD_KEY}
//   headers: X-Card-Key + 普通 UA；响应 { code:200, url, tier, sourceName, responseTime }
// 实测（2026-09-07）：
//   128k 免费/VIP 均完整直链（/yp/full/，字节 2829338/4317292 与官方、洛雪完全一致，bdycdn CDN）；
//   VIP 歌 320k=10792943 / flac=31633244，真 FLAC（与洛雪 v5 同字节）；
//   ⚠ 免费歌 320k/flac 返回 171072 字节占位假文件（cdn-img.gitcode.com，两档同字节）——
//   在本函数内 Range 探测总字节、按搜索挂载的档位大小比对拒收（拒收后接力链自动落 zddyr），
//   不依赖 getMediaSourceImpl 层的 guardFullAudio（那层按源兜底，接力已在链内结束，接不住）。
// 卡密可用宿主 userVariables.hywCardKey 覆盖默认值（避免硬编码单点）。
var HYW_API_BASE = 'http://103.79.184.97';
var HYW_CARD_KEY = 'MOLAN-BAIJI'; // 默认卡密（用户提供）；userVariables.hywCardKey 优先
var HYW_MIN_FULL_BYTES = 262144;  // 搜索档位缺失时的绝对下限：完整 128k 实测 ≥2.8MB，假文件 171072
*/

// [v1.9.4 disabled since 2026-09-11] 103.79.184.97/api/music/url 实测 500（无论 key 是否有值），
// 根路径已变为 Next.js 静态页，接口整体退出取链 API 形态 → 死亡。
function resolveHywKugou(raw, quality) {
  return Promise.reject(new Error('hyw disabled since 2026-09-11 (103.79.184.97 500)'));
}

/* 保留的旧实现（[v1.9.4 disabled since 2026-09-11]）：
function resolveHywKugou(raw, quality) {
  var hq = quality === 'high' ? '320k' : (quality === 'super' ? 'flac' : '128k');
  var mainHash = raw && raw.hash ? String(raw.hash) : '';
  if (!mainHash) return Promise.reject(new Error('hyw no hash'));
  var cardKey = String(userVariablesSafe().hywCardKey) || HYW_CARD_KEY;
  return axios.get(HYW_API_BASE + '/api/music/url', {
    params: { source: 'kg', songId: mainHash, quality: hq, key: cardKey },
    timeout: SOURCE_TIMEOUT, // [v1.3.1] 实测该 API 延迟常态 1~3.5s，RELAY_TIMEOUT(2500ms) 会在 2.5s+ 尾部误超时提前落 zddyr
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'X-Card-Key': cardKey }
  }).then(function (res) {
    var d = res.data || {};
    var url = d.url || (d.data && d.data.url);
    if (d.code !== 200 || !url) throw new Error('hyw code:' + d.code + ((d.msg || d.message) ? ' ' + (d.msg || d.message) : ''));
    var u = String(url);
    if (u.indexOf('http') !== 0) throw new Error('hyw bad url');
    // 假文件自检：Range 探测总字节 vs 期望大小（搜索档位字节，v1.3.0 P0-2 挂载）
    var expected = hq === '320k' ? (raw.size320 || 0) : (hq === 'flac' ? (raw.sizeSq || 0) : (raw.size128 || 0));
    return axios.get(u, {
      timeout: RELAY_TIMEOUT,
      headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0' },
      responseType: 'arraybuffer'
    }).then(function (probe) {
      var headers = probe.headers || {};
      var total = 0;
      var mm = String(headers['content-range'] || headers['Content-Range'] || '').match(/\/(\d+)\s*$/);
      if (mm) total = parseInt(mm[1], 10) || 0;
      else if (probe.status === 200) total = parseInt(headers['content-length'] || headers['Content-Length'], 10) || 0;
      // 有期望值：实际 < 期望 60% 判假（同源同文件字节应一致，留 CDN 差异余量）
      if (total > 0 && expected > 0 && total < expected * 0.6) {
        throw new Error('hyw placeholder file ' + total + 'B < expected ' + expected + 'B');
      }
      // 无期望值：低于绝对下限判假
      if (total > 0 && expected <= 0 && total < HYW_MIN_FULL_BYTES) {
        throw new Error('hyw placeholder file ' + total + 'B < floor ' + HYW_MIN_FULL_BYTES + 'B');
      }
      return {
        url: u,
        // 请求档位如实回报（假文件已在上面拒收，到这里即完整文件）
        actualQuality: hq === '320k' ? 'high' : (hq === 'flac' ? 'super' : 'standard')
      };
    });
    // 探测请求自身失败（超时/不支持 Range）：不惩罚源，放行由上层守卫与播放器处理
  });
}

// userVariables：kugouCookie（v0.7.0 新增，用户自备）
*/

function userVariablesSafe() {
  var env = typeof global !== 'undefined' && global.env ? global.env : null;
  if (env && env.getUserVariables) {
    try { return env.getUserVariables() || {}; } catch (e) { /* 沙箱无 env */ }
  }
  return {};
}

// 酷狗 Cookie：附带在官方 getSongInfo 请求上（官方无损主要仍走海棠备源，此项提升免费歌命中率）
function kugouCookieHeaders() {
  var h = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://m.kugou.com/' };
  var ck = userVariablesSafe().kugouCookie;
  if (ck) h.Cookie = String(ck);
  return h;
}

// ==================== [v1.4.0] 酷我官方直取并行竞速通道 ====================
// 参考 QQ 插件 v1.3.8 resolveKuwoFallback（移植自 kuwo-source v1.4.3，2026-09-06 实测验真：
// VIP rid 未登录 2000kflac 明文直链；DES 与 Python 参考实现对拍一致）。职责：
// 与酷狗自有通道、海棠通道三路并行竞速，谁先返回「音质匹配、非试听、非降级」的有效 URL 用谁。
// 曲目映射：曲名+歌手 关键词搜索酷我 → 首个命中 rid（结果 10min TTL / FIFO 256 缓存，
// 同一首歌 3 次自测内仅首次付搜索成本）。实现移植自 kuwo-source v1.4.3：
// DES 核心 + convert_url_with_sign + mobi.s DES-ECB，无 Buffer/BigInt 依赖（安卓宿主安全）。
// 档位映射（宁缺毋降）：standard→128kmp3 / high→320kmp3 / super→2000kflac；
// hires/atmos/master 酷我官方无对应档 → 不同步竞速（resolveKuwoFallback 直接 reject 跳过）。

function u32(x) { return x | 0; }

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

// 首个成功 resolve 胜出、全部失败才 reject；每个 racer 都挂 handler 防 unhandled rejection
function raceSuccess(promises) {
  return new Promise(function (resolve, reject) {
    if (!promises.length) { reject(new Error('race no racers')); return; }
    var failed = 0;
    promises.forEach(function (p) {
      Promise.resolve(p).then(resolve, function () {
        failed++;
        if (failed === promises.length) reject(new Error('all racers failed'));
      });
    });
  });
}

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };
// 酷狗档位 → 酷我官方档位映射：酷我官方最高 2000kflac，无 hires 及以上档；
// 未映射档（hires/atmos/master）由 resolveKuwoFallback 直接 reject，酷我赛道同步跳过。
var KUWO_QUALITY_MAP = { standard: 'standard', high: 'high', super: 'super' };

// rid 缓存：同一首歌重复取链免二次搜索（10min TTL，FIFO 淘汰，上限 256 条）
var KW_RID_CACHE = {};
var KW_RID_CACHE_TTL = 10 * 60 * 1000;
var KW_RID_CACHE_MAX = 256;
function kwRidCacheGet(key) {
  var e = KW_RID_CACHE[key];
  if (e && Date.now() - e.ts < KW_RID_CACHE_TTL) return e.rid;
  if (e) delete KW_RID_CACHE[key];
  return null;
}
function kwRidCachePut(key, rid) {
  if (!KW_RID_CACHE[key]) {
    var ks = Object.keys(KW_RID_CACHE);
    if (ks.length >= KW_RID_CACHE_MAX) delete KW_RID_CACHE[ks[0]];
  }
  KW_RID_CACHE[key] = { rid: rid, ts: Date.now() };
}

// [v1.4.1] 曲名+歌手 关键词搜索酷我 → 候选列表（按酷我相关度排序，最多 rn 条）。
// 每条候选映射 { rid, name, artist, duration(sec, 可为0) }；搜不到/结构不符返回空数组，
// 由同曲校验层统一判失败——酷我赛道整体退出竞速，不影响其余两路。
function searchKuwoCandidates(query) {
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      all: query, pn: 0, rn: 20, ft: 'music', client: 'kt',
      encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, cluster: 0,
      strategy: 2012, issubtitle: 1, show_copyright_off: 1, correct: 1,
      spPrivilege: 0, newver: 2, p2p: 1, notrace: 0, searchapi: 2, vermerge: 1
    },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var list = (res.data && res.data.abslist) || [];
    var cands = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var rid = String(it.MUSICRID || '').replace(/^MUSIC_/, '');
      if (!rid) continue;
      cands.push({
        rid: rid,
        name: str(it.NAME || it.SONGNAME || it.name || ''),
        artist: str(it.ARTIST || it.artist || ''),
        duration: parseInt(it.DURATION || it.duration, 10) || 0
      });
    }
    return cands;
  });
}

// ==================== [v1.4.1] 严格同曲校验（酷我通道专用，任务规范口径） ====================
// 第一步：拆分「核心歌名」与「版本标签」——从歌名末尾往前匹配，命中版本关键词的作为
// 版本标签（可多个，如「晴天 Live 伴奏版」→ [live, accompaniment]），剩下的作为核心歌名。
// 「原版」按规范等价于无标签（原曲是原版，酷我也必须是原版），提取后丢弃不参与标签比对。
var KW_VERSION_KEYWORDS = [
  // 长词在前，防止「现场版」被「现场」之外的短词抢先截断；canon 为内部规范类型
  { canon: 'live',          words: ['演唱会版', '演唱会', '现场版', '现场', 'live版', 'live'] },
  { canon: 'remix',         words: ['remix版', 'remix', '混音版', '混音'] },
  { canon: 'accompaniment', words: ['伴奏版', '伴奏', 'instrumental', '纯音乐'] },
  { canon: 'pure',          words: ['纯享版', '纯享'] },
  { canon: 'original',      words: ['原版', 'original version', 'original'] },
  { canon: 'cover',         words: ['翻唱版', '翻唱', 'cover版', 'cover'] },
  { canon: 'dj',            words: ['dj版', 'dj'] },
  { canon: 'movie',         words: ['电影版', '电影'] },
  { canon: 'tv',            words: ['电视剧版', '电视剧'] },
  { canon: 'clip',          words: ['片段', '节选'] },
  { canon: 'ringtone',      words: ['铃声版', '铃声'] },
  { canon: 'surround',      words: ['3d环绕版', '3d环绕', '环绕声版', '环绕声', '环绕版', '环绕', '3d'] },
  { canon: 'piano',         words: ['钢琴版', '钢琴'] },
  { canon: 'guitar',        words: ['吉他版', '吉他'] },
  { canon: 'female',        words: ['女声版', '女声'] },
  { canon: 'male',          words: ['男声版', '男声'] },
  { canon: 'child',         words: ['童声版', '童声'] },
  { canon: 'full',          words: ['完整版', '完整'] }
];

// 单个词 → 版本类型（归一：去空格/点/横线、转小写后全词比对）；非版本词返回 null
function kwMatchVersionWord(w) {
  var s = String(w || '').toLowerCase().replace(/[\s.\-—–_/]/g, '');
  if (!s) return null;
  for (var i = 0; i < KW_VERSION_KEYWORDS.length; i++) {
    var ws = KW_VERSION_KEYWORDS[i].words;
    for (var j = 0; j < ws.length; j++) {
      if (s === ws[j].replace(/[\s.\-—–_/]/g, '')) return KW_VERSION_KEYWORDS[i].canon;
    }
  }
  return null;
}

// 英文版本词的粘连形态（无空格，如「晴天Live」「稻香DJ版」）：
// 前一字符必须非英文字母（防「Alive」尾串被误判 live）；CJK 词天然无此歧义，单独尾部判定
var KW_GLUED_EN_RE = /(?:[^a-z]|^)(live版|live|remix版|remix|dj版|dj|cover版|cover|instrumental|original)$/i;
var KW_GLUED_CJK_WORDS = ['演唱会版', '现场版', '伴奏版', '纯享版', '混音版', '翻唱版', '电视剧版', '电影版', '铃声版', '钢琴版', '吉他版', '女声版', '男声版', '童声版', '完整版', '纯音乐', '演唱会', '现场', '伴奏', '原版', '片段', '节选', '环绕', '环绕声', '钢琴', '吉他', '女声', '男声', '童声', '纯享', '混音', '翻唱', '铃声', '3d环绕', '3d'];

function kwSplitTitleVersion(rawTitle) {
  // 先剥「feat./ft./featuring …」尾巴：合作歌手属歌手比对范畴，不应混入核心歌名
  var t = String(rawTitle || '').replace(FEAT_TAIL_RE, '').trim();
  var tags = [];
  var guard = 0;
  while (t && guard++ < 24) {
    // ① 尾部整体括号「（…）/(…)/【…】/[…]」：内容整体是版本词 → 摘 tag；
    //    否则拆 token，尾部连续的版本词 token 全部摘出，剩余留在核心名
    var m = t.match(/[\s\-—–·_~|｜]*[（(【\[]([^）)】\]]*)[）)】\]]\s*$/);
    if (m) {
      var inner = m[1];
      var canon = kwMatchVersionWord(inner);
      if (canon) {
        if (canon !== 'original') tags.push(canon);
        t = t.slice(0, m.index).trim();
        continue;
      }
      var toks = inner.split(/[\s\-—–·_~、，,/&]+/).filter(Boolean);
      var consumed = 0;
      for (var i = toks.length - 1; i >= 0; i--) {
        var c2 = kwMatchVersionWord(toks[i]);
        if (!c2) break;
        if (c2 !== 'original') tags.push(c2);
        consumed++;
      }
      if (consumed > 0) {
        var rest = toks.slice(0, toks.length - consumed).join(' ');
        t = (t.slice(0, m.index).trim() + (rest ? ' ' + rest : '')).trim();
        continue;
      }
      break; // 括号内容与版本无关 → 尾部提取结束
    }
    // ② 分隔符切尾 token，末位是版本词 → 摘出继续
    var segs = t.split(/[\s\-—–·_~|｜、，,/]+/).filter(Boolean);
    var last = segs.length ? segs[segs.length - 1] : '';
    var c3 = kwMatchVersionWord(last);
    if (c3) {
      if (c3 !== 'original') tags.push(c3);
      segs.pop();
      t = segs.join(' ').trim();
      continue;
    }
    // ③ 无分隔符的粘连形态（「晴天Live」「晴天现场版」）：
    //    英文词走带字母边界的正则；CJK 词逐个尝试尾部全词匹配，且摘完必须留非空核心名
    var ge = KW_GLUED_EN_RE.exec(t);
    var stripped = false;
    if (ge) {
      var cg = kwMatchVersionWord(ge[1]);
      if (cg) {
        if (cg !== 'original') tags.push(cg);
        t = t.slice(0, t.length - ge[1].length).trim();
        stripped = true;
      }
    }
    if (!stripped) {
      for (var k = 0; k < KW_GLUED_CJK_WORDS.length; k++) {
        var w = KW_GLUED_CJK_WORDS[k];
        if (t.length > w.length && t.slice(-w.length) === w) {
          var ck = kwMatchVersionWord(w);
          if (ck) {
            if (ck !== 'original') tags.push(ck);
            t = t.slice(0, t.length - w.length).trim();
            stripped = true;
            break;
          }
        }
      }
    }
    if (!stripped) break;
  }
  return { core: t, tags: tags.reverse() }; // reverse 保持从左到右出现顺序（比对前会再排序）
}

// 核心歌名归一键：小写、去空白、去标点（保留中英文与数字），完全一致才算同核心名
function kwCoreKey(core) {
  return String(core || '').toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[^0-9a-z\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, '');
}

// 歌手规范化：按分隔符（feat./ft./&/、/，/,///和/与）拆成逐个歌手，逐个归一后比对
function kwArtistTokens(raw) {
  return String(raw || '')
    .split(/\s*(?:[、，,/&]|\bfeaturing\b|\bfeat\b|\bft\b|和|与)\s*/i)
    .map(function (s) { return s.toLowerCase().replace(/[\s.\u3000]+/g, ''); })
    .filter(Boolean);
}

// 严格同曲校验：ref=酷狗侧（musicItem 归一：title/artist/duration），cand=酷我搜索候选。
// 四项全部通过才放行参与竞速；任一不通过即拒（返回 pass:false + reason 供日志/自测）。
// 时长规则按任务规范：酷狗侧有时长且酷我侧也有时长时，差距 >10% 判不同曲；
// 任一侧缺时长（0）无法判定 → 放行（不因数据缺失误杀同曲）。
function kuwoSameSongCheck(ref, cand) {
  var a = kwSplitTitleVersion(ref && (ref.title || ref.name));
  var b = kwSplitTitleVersion(cand && (cand.name || cand.title));
  if (kwCoreKey(a.core) !== kwCoreKey(b.core)) {
    return { pass: false, reason: 'core', detail: '核心名不一致: [' + a.core + '] vs [' + b.core + ']' };
  }
  var ta = a.tags.slice().sort();
  var tb = b.tags.slice().sort();
  if (ta.length !== tb.length) {
    return { pass: false, reason: 'version', detail: '版本标签数量不一致: [' + a.tags.join(',') + '] vs [' + b.tags.join(',') + ']' };
  }
  for (var i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) {
      return { pass: false, reason: 'version', detail: '版本标签类型不一致: [' + a.tags.join(',') + '] vs [' + b.tags.join(',') + ']' };
    }
  }
  var aa = kwArtistTokens(ref && ref.artist);
  var ba = kwArtistTokens(cand && cand.artist);
  var hit = false;
  for (var x = 0; x < aa.length && !hit; x++) {
    for (var y = 0; y < ba.length; y++) {
      if (aa[x] && aa[x] === ba[y]) { hit = true; break; }
    }
  }
  if (!hit) {
    return { pass: false, reason: 'artist', detail: '无共同歌手: [' + (ref && ref.artist) + '] vs [' + (cand && cand.artist) + ']' };
  }
  var d1 = parseInt(ref && ref.duration, 10) || 0;
  var d2 = parseInt(cand && cand.duration, 10) || 0;
  if (d1 > 0 && d2 > 0 && Math.abs(d2 - d1) / d1 > 0.10) {
    return { pass: false, reason: 'duration', detail: '时长差超10%: ' + d1 + 's vs ' + d2 + 's' };
  }
  return { pass: true, reason: 'ok' };
}

// 候选列表 → 首个通过同曲校验的 rid；全部被拒 → 抛错（酷我赛道失败退出竞速，
// 其余两路继续——「校验不通过的结果，再快也不能用」）
function pickKuwoVerifiedRid(cands, musicItem) {
  var ref = {
    title: musicItem && (musicItem.title || musicItem.name) || '',
    artist: (musicItem && musicItem.artist) || '',
    duration: (musicItem && musicItem.duration) || 0
  };
  var rejected = [];
  for (var i = 0; i < cands.length; i++) {
    var chk = kuwoSameSongCheck(ref, cands[i]);
    if (chk.pass) return cands[i].rid;
    rejected.push('#' + i + '[' + cands[i].name + '|' + cands[i].artist + '] ' + chk.reason + '(' + chk.detail + ')');
  }
  RESOLVE_STATS.kuwoVerifyRejected = (RESOLVE_STATS.kuwoVerifyRejected || 0) + 1;
  throw new Error('kuwo same-song check rejected all ' + cands.length + ' candidates: ' + rejected.join('; '));
}

function searchKuwoVerifiedRid(musicItem, query) {
  return searchKuwoCandidates(query).then(function (cands) {
    if (!cands.length) throw new Error('kuwo search no candidate');
    return pickKuwoVerifiedRid(cands, musicItem);
  });
}

// 校验通过后才写 rid 缓存（query 由 musicItem 曲名+歌手派生，同 query 侧同曲，缓存安全）
function searchKuwoVerifiedRidCached(musicItem, query) {
  var hit = kwRidCacheGet(query);
  if (hit) return Promise.resolve(hit);
  return searchKuwoVerifiedRid(musicItem, query).then(function (rid) {
    kwRidCachePut(query, rid);
    return rid;
  });
}

// 官方 convert_url_with_sign 通道（nmobi/nmsublist 全参数同构 + mobi 车载免签变体）
// 校验：super 必须 flac（拒降级）、high 必须 mp3 且 bitrate≥320（拒 ogg 降级档）、
// duration<60s 视为试听片段拒收；actualQuality 按响应 bitrate 如实标注。
function kuwoOfficialResolve(host, rid, quality, variant) {
  var br = KUWO_BR[quality] || KUWO_BR.standard;
  var params;
  if (variant === 'car') {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: rid,
      user: 'C_APK_guanwang_' + Date.now(),
      source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC'
    };
  } else {
    params = {
      f: 'web', type: 'convert_url_with_sign', br: br, rid: rid,
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
    if (!res.data || res.data.code !== 200 || !d || !d.url) throw new Error('kuwo official no url');
    if ((quality === 'super' || quality === 'hires') && d.format && d.format !== 'flac') {
      throw new Error('kuwo official format degraded: ' + d.format);
    }
    if (quality === 'high' && d.format && d.format !== 'mp3') {
      throw new Error('kuwo official high format degraded: ' + d.format);
    }
    // [v1.4.0] 强化：high 档除 format 外再校验 bitrate，防 mp3 容器低码率冒充
    if (quality === 'high' && d.bitrate > 0 && d.bitrate < 320) {
      throw new Error('kuwo official high bitrate degraded: ' + d.bitrate);
    }
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo official trial snippet');
    var aq = (d.format === 'flac') ? 'flac'
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    // [v1.4.0] 酷我 CDN 直链实测为 http，但同签名路径 https 可用（206 audio/mpeg 实测一致），
    // 统一升级 https 过协议白名单（保持本插件 https 优先语义）
    var u = String(d.url).replace(/^http:\/\//i, 'https://');
    return { url: u, actualQuality: aq };
  });
}

// mobi.s DES-ECB 通道（std=手机渠道 / car=车载渠道，同端点同密钥互为风控冗余 racer）
function kuwoDesResolve(rid, quality, variant) {
  var fmt = (quality === 'super' || quality === 'hires') ? 'flac' : 'mp3';
  var q;
  if (variant === 'car') {
    q = 'user=C_APK_guanwang_' + Date.now() + '&corp=kuwo&source=kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + rid;
  } else {
    q = 'user=0&corp=kuwo&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format=' + fmt + '&rid=' + rid;
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
    var fmtGot = mFmt ? String(mFmt[1]).trim() : '';
    if ((quality === 'super' || quality === 'hires') && fmtGot !== 'flac') {
      throw new Error('kuwo des format mismatch: ' + fmtGot);
    }
    var br = parseInt(mBr ? mBr[1] : '0', 10) || 0;
    if (quality === 'high' && br > 0 && br < 320) throw new Error('kuwo des bitrate degraded: ' + br);
    var aq;
    if (fmt === 'flac') aq = 'flac';
    else aq = br >= 320 ? '320k' : (br >= 192 ? '192k' : '128k');
    // [v1.4.0] 同 kuwoOfficialResolve：http 直链统一升级 https（实测同签名路径 206 一致）
    return { url: String(url).replace(/^http:\/\//i, 'https://'), actualQuality: aq };
  });
}

// [v1.4.0] 酷我竞速赛道（[v1.4.1] 强化）：搜索映射候选 → 严格同曲校验 → 首个通过校验的
// rid（10min 缓存）→ 按档位竞速官方通道。校验不通过的候选即使先返回也不取链、直接丢弃，
// 全部候选被拒则本赛道失败退出，由酷狗自有/海棠两路继续竞速。
// standard：128kmp3×3 racer；high：320kmp3×3（ogg/低码率降级拒收）；super：
// DES flac（std+car）+ convert_url_with_sign 2000kflac×3（试听片段拒收）。
// 未映射档（hires 及以上）直接 reject（宁缺毋降，不拖竞速窗口）。
// 返回 channel='kuwo:official'；kuwo CDN 均为 https，过 isAllowedMediaUrl 白名单。
function resolveKuwoFallback(musicItem, quality) {
  var kwq = KUWO_QUALITY_MAP[quality];
  if (!kwq) return Promise.reject(new Error('kuwo unmapped quality: ' + quality));
  var title = musicItem && (musicItem.title || musicItem.name) ? String(musicItem.title || musicItem.name) : '';
  var artist = musicItem && musicItem.artist ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('kuwo fallback no keyword'));
  var q = artist ? title + ' ' + artist : title;
  return searchKuwoVerifiedRidCached(musicItem, q).then(function (rid) {
    var jobs;
    if (kwq === 'super') {
      jobs = [
        kuwoDesResolve(rid, 'super', 'std'),
        kuwoDesResolve(rid, 'super', 'car'),
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, 'super', 'car')
      ];
    } else {
      jobs = [
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, kwq),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, kwq),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, kwq, 'car')
      ];
    }
    return raceSuccess(jobs);
  }).then(function (r) {
    return { url: r.url, actualQuality: r.actualQuality, channel: 'kuwo:official' };
  });
}

var RESOLVE_ADAPTERS = {
  kugou: resolveKugou
};

// [⑯ v1.1.0] 取链通道命中统计：official/lx5/haitang/zddyr 各通道成功次数与总次数；
// trackercdn 摘链后不再累加（若复活可重新挂链）。经 _internal.resolveStats 暴露，宿主可读。
var RESOLVE_STATS = { total: 0, official: 0, lx5: 0, haitang: 0, hyw: 0, zddyr: 0, trackercdn: 0, kuwo: 0, kuwoVerifyRejected: 0 }; // [v1.3.1] +hyw；[v1.4.0] +kuwo 竞速通道；[v1.4.1] +kuwoVerifyRejected 同曲校验拒收次数

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
// [⑬ v1.1.0] 白名单收窄（审查 P3-2）：原 https 一律放行 = 任意域可过，假链防护只剩
// guardFullAudio 内容探测一道闸。现 https/http 均按域后缀白名单：
// 酷狗官方（kugou.com/kugou.net/kgimg.com）+ 取链三备源实际回源域
// （海棠 bdycdn 回源 CDN、海棠 haitangw.cc、zddyr.top、洛雪 v5 中转域）。
// 不在白名单的直链视为该源失败继续接力（与 http 拒绝行为一致）。
var MEDIA_URL_HTTPS_HOST_ALLOWLIST = [
  /\.kugou\.com$/i, /\.kugou\.net$/i, /\.kgimg\.com$/i,            // 酷狗官方 CDN/分享域
  /\.bdycdn\.com$/i,                                               // 海棠中转回源 CDN（实测取链前置域）
  /\.haitangw\.cc$/i,                                              // 海棠
  /(^|\.)zddyr\.top$/i,                                            // zddyr
  /(^|\.)xn--fiqs8s$/i,                                            // 洛雪v5 中转域（中文域名 punycode）
  /(^|\.)kuwo\.cn$/i                                               // [v1.4.0] 酷我官方直取竞速通道（nmobi/mobi.kuwo.cn 及其 CDN）
];
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.kugou\.com$/i, /\.kugou\.net$/i, /\.kgimg\.com$/i, // 酷狗
  /(^|\.)kuwo\.cn$/i, // [v1.4.0] 酷我兜底：升级 https 失败时保底放行（白名单域不变）
];

function isAllowedMediaUrl(url) {
  var s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  var m = /^https?:\/\/([^\/?#@\s]+)/i.exec(s);
  if (!m) return false;
  var host = m[1].toLowerCase().split(':')[0].split('@').pop();
  var list = /^https:\/\//i.test(s) ? MEDIA_URL_HTTPS_HOST_ALLOWLIST : MEDIA_URL_HTTP_HOST_ALLOWLIST;
  for (var i = 0; i < list.length; i++) {
    if (list[i].test(host)) return true;
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


function resolveWithFallback(musicItem, quality) {
  var srcMap = musicItem._src || {};
  var order = pickCandidates(srcMap, quality);
  var tries = order.slice(0, 3);
  // v0.7.1 P1-3：全局超时预算。deadline 8s 内：首段 ≤SOURCE_TIMEOUT，接力段 ≤RELAY_TIMEOUT，
  // 每段进入前检查剩余时间，不足 500ms 直接失败——保证整体可预期地在宿主 10s 预算内给出结果。
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  var attempt = function (idx) {
    if (idx >= tries.length) {
      return Promise.reject(new Error('酷狗取链失败：未取得播放链接'));
    }
    var remain = deadline - Date.now();
    if (remain <= 500) {
      return Promise.reject(new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms'));
    }
    var source = tries[idx];
    var adapter = RESOLVE_ADAPTERS[source];
    if (!adapter) return attempt(idx + 1);
    // [v1.4.0] 首段预算放宽到全局预算：resolveKugou 内部已是三路竞速（窗口 RACE_BUDGET_MS）
    // + 全败后接力原降级链剩余段，SOURCE_TIMEOUT(4.5s) 会把竞速失败后的降级链拦腰截断
    var segTimeout = idx === 0 ? RESOLVE_BUDGET_MS : RELAY_TIMEOUT;
    if (segTimeout > remain) segTimeout = remain;
    return withTimeout(adapter(srcMap[source], quality, musicItem), segTimeout, source + ' 取链超时 ' + segTimeout + 'ms').then(function (r) {
      // [v1.5.0 P1-1 -> v1.9.5] fee（VIP 标识）停写：取链结果不再携带 fee 字段。
      // v0.7.1 P1-5：返回 URL 协议/域名白名单校验，不通过视为该源失败、继续接力
      if (!isAllowedMediaUrl(r && r.url)) {
        throw new Error(source + ' 返回 URL 未通过协议/域名校验');
      }
      // [v1.4.0] 竞速胜出结果已在赛道闸门 guarded() 内完成守卫（r.guarded=true），此处跳过，
      // 避免胜出 URL 重复 Range 探测；其余通道结果仍走兜底守卫
      if (r && r.guarded) return r;
      // 兜底守卫：适配器漏判的试听片段在这里被内容探测拦下并继续接力
      // （守卫按 content-length/Range 校验大小与标称时长一致性，明显不符即丢弃）
      var guardBudget = deadline - Date.now();
      if (guardBudget <= 500) throw new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(guardFullAudio(r.url, musicItem), guardBudget, 'guard 超时').then(function () { return r; });
    }).catch(function () {
      return attempt(idx + 1);
    });
  };
  return attempt(0);
}

/**
 * 试听片段兜底守卫：Range 探测 audio 文件总长，
 * 按 128kbps 估算时长（高码率文件会被高估时长，不会误杀完整文件），
 * 估算时长 < 标称时长 60% 判为试听片段。仅标称时长 >=60s 时启用估算。
 * 探测请求自身失败（Range 不支持/超时）不惩罚源，放行由播放器处理。
 */
function guardFullAudio(url, musicItem) {
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
      // [P1-2 v1.1.0] 原固定按 128kbps 估时（est<0.6*dur 等效 76.8kbps 阈值），会把
      // <76.8kbps 的合法完整文件（低码率电台/有声书）误判为试听拒播。
      // 改按实际码率判定：估算码率 < 64kbps 才判试听（试听片段典型 32~48kbps），错误信息带估算码率。
      var kbps = Math.round(total * 8 / dur / 1000);
      if (kbps < 64) {
        throw new Error('guard: trial clip, est ' + kbps + 'kbps < 64kbps (' + Math.round(total / 16000) + 's/' + dur + 's)');
      }
    }
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // 探测请求本身失败：不拦，放行
  });
}

// ==================== 歌词适配 ====================
// 端点均经 2026-09-05 探针实测（artifacts/lyric-probe/probe-result.json），无猜测 URL。
// 酷狗：krcs 搜索 → lyrics 下载两步，content 为 Base64 LRC。
//
// v0.7.0：接力链优化（P1-5）——歌词单源超时压到 3s（LYRIC_TIMEOUT），原生源优先、
// 最多接力 3 源（原生 + 2 备源），最坏 ~9s，避免顶到 10s 沙箱上限。
var LYRIC_TIMEOUT = 3000;

// ---------- 逐字歌词（v0.7.0，P0-2） ----------
// 酷狗 KRC：krcs 搜索 → lyrics.kugou.com/download?fmt=krc → Base64 → 解码。
// 解码（探针 2026-09-06 实测，变体B）：Base64 解码后定位 "krc1" 魔数，魔数后 4 字节起
// 按 16 字节密钥 XOR，再从 魔数+6 字节处 raw inflate，得到 KRC 文本（[ti:][ar:] + [time,dur]<t,d,0>字）。
// 网易云 YRC：/api/song/lyric?lv=-1&tv=-1&yv=1 → yrc.lyric（[start,dur](s,d,0)字，部分歌返回空）。
var KRC_XOR_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];

// [P0-2 v1.1.0] 无 Buffer 环境纯 JS 工具：Base64 解码（RFC 4648，兼容 URL-safe 变体）与 UTF-8 解码。
// Hermes / RN 宿主不保证存在全局 Buffer（审查报告 P0-2：歌词全链路依赖 Buffer，LRC/KRC 全挂）。
var B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(input) {
  // [P0-2 v1.1.0] 与 Buffer.from(str,'base64') 对齐的宽容策略：剥离所有非 alphabet 字符
  // （实测酷狗 download 接口的 content 首字节带 U+FEFF BOM，Buffer 会静默忽略，此处同策略）
  var s = String(input).replace(/[^A-Za-z0-9+\/=]/g, '');
  var out = new Uint8Array(Math.floor(s.length * 3 / 4) + 3);
  var n = 0, bits = 0, acc = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '=') break; // padding 之后无数据
    var v = B64_ALPHABET.indexOf(ch);
    if (v < 0) {
      if (ch === '-') v = 62;
      else if (ch === '_') v = 63;
      else continue; // 理论不可达（正则已剥离），兜底跳过
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
  // v0.7.1 P0-1：宿主 require 白名单（pluginManager/plugin.ts L84-97）含 pako、无 zlib，
  // 原 require('zlib') 在沙箱内运行时必抛 Cannot find module 'zlib'，改用 pako.inflateRaw。
  var pako = require('pako');
  // [P0-2 v1.1.0] 去 Buffer：纯 JS base64 → Uint8Array → 字节级魔数查找 → XOR → inflate → 手写 UTF-8 解码
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

// 跨源逐字歌词接力：用 标题+歌手 在酷狗搜同曲 → 拿 hash → KRC（时长容差 6s 防错配）
// [⑮ v1.1.0] miss 负缓存：同一关键词 5 分钟内不重复搜（relay 常见于冷门曲，miss 后反复搜纯耗配额）
var krcRelayMissCache = {}; // kw -> ts
var KRC_RELAY_MISS_TTL_MS = 5 * 60 * 1000;
async function fetchKugouKrcRelay(item) {
  var kw = ((item && item.title) || '') + ' ' + ((item && item.artist) || '');
  if (!kw.trim()) throw new Error('krc relay no keyword');
  var missTs = krcRelayMissCache[kw];
  if (missTs && Date.now() - missTs < KRC_RELAY_MISS_TTL_MS) {
    throw new Error('krc relay no match (negative cache ' + Math.ceil((KRC_RELAY_MISS_TTL_MS - (Date.now() - missTs)) / 1000) + 's)');
  }
  // [v1.9.10] mobilecdn.kugou.com 在部分网络 DNS 污染致 KRC 接力断链，relay 搜索换同构替代域名
  // mobiles.kugou.com（参数/响应结构一致，2026-09-12 实测全链路打通）；http→https 同步升级
  var s = await axios.get('https://mobiles.kugou.com/api/v3/search/song', {
    params: { format: 'json', keyword: kw, page: 1, pagesize: 8 },
    timeout: LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://m.kugou.com/' }
  });
  var list = (s.data && s.data.data && s.data.data.info) || [];
  var dur = parseInt(item && item.duration, 10) || 0;
  var tKey = item && item.title ? looseTitleKey(String(item.title)) : '';
  var hit = null;
  // [P2-6 v1.1.0] 歌名匹配优先（normalize 后比对），时长容差仅作过滤；不再盲取首条防错配歌词
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
    krcRelayMissCache[kw] = Date.now(); // [⑮ v1.1.0] 只缓存"确认无命中"，网络错误不缓存
    throw new Error('krc relay no match');
  }
  return fetchKugouKrc(String(hit.hash));
}

// ---------- [v1.2.0] 歌词链路对齐 baka：lyrics.kugou.com 候选检索 + KRC 解析为宿主 ILyricSource ----------
var KUGOU_LYRIC_HEADERS = {
  'KG-RC': '1',
  'KG-THash': 'expand_search_manager.cpp:852736169:451',
  'User-Agent': 'KuGou2012-9020-ExpandSearchManager'
};

// baka 同款候选检索：标题 + hash + 时长(ms) 定位候选，失败回落 krcs.kugou.com（原 mobi 通道保留）
async function kugouLyricCandidates(raw, musicItem) {
  var params = { ver: 1, man: 'yes', client: 'pc' };
  if (musicItem && musicItem.title) params.keyword = String(musicItem.title);
  if (raw && raw.hash) params.hash = raw.hash;
  var dur = parseInt(musicItem && musicItem.duration, 10) || 0;
  if (dur > 0) params.timelength = dur * 1000;
  try {
    var s = await axios.get('https://lyrics.kugou.com/search', {
      params: params, timeout: LYRIC_TIMEOUT, headers: KUGOU_LYRIC_HEADERS
    });
    var cands = s.data && s.data.candidates;
    if (cands && cands.length && cands[0].id) {
      return cands.map(function (c) { return { id: c.id, accesskey: c.accesskey }; });
    }
    throw new Error('no candidate');
  } catch (e) {
    // 回落：原 mobi 检索通道
    if (!raw || !raw.hash) throw e;
    var s2 = await axios.get('https://krcs.kugou.com/search', {
      params: { ver: 1, man: 'yes', client: 'mobi', hash: raw.hash, album_audio_id: '' },
      timeout: LYRIC_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var cands2 = s2.data && s2.data.candidates;
    if (!cands2 || !cands2.length || !cands2[0].id) throw new Error('no lyric candidate');
    return cands2.map(function (c) { return { id: c.id, accesskey: c.accesskey }; });
  }
}

async function kugouDownloadLyric(cand, fmt) {
  var d = await axios.get('https://lyrics.kugou.com/download', {
    params: { ver: 1, client: 'pc', id: cand.id, accesskey: cand.accesskey, fmt: fmt, charset: 'utf8' },
    timeout: LYRIC_TIMEOUT, headers: KUGOU_LYRIC_HEADERS
  });
  var content = d.data && d.data.content;
  if (!content) throw new Error('lyric download empty');
  // [v1.2.0] content 为 base64：lrc=明文 LRC；krc=krc1 XOR 加密体，须 decodeKrc 解密
  if (fmt === 'krc') return decodeKrc(String(content));
  return bytesToUtf8(base64ToBytes(String(content)));
}

// KRC 文本 → 宿主 ILyricSource：
// 逐字行 `[startMs,durMs]<rel,dur,0>词...` → `[startMs,durMs]词(abs,dur)...`（宿主 lrcParser LINE_TIME_PATTERN）
// 翻译/罗马音：优先 [language:base64] JSON（type 1=译文，type 0=罗马音，lyricContent 按逐字行序对齐）；
// 无 language 时回落采集同起点无词标签的独立译文行
function parseKrcForHost(krcText) {
  var lines = String(krcText).split(/\r?\n/);
  var richLines = [], richStarts = [];
  var altLines = {}; // startMs -> 独立译文行文本
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
      if (txt) words += txt + '(' + (startMs + rel) + ',' + wd + ')'; // [v1.2.0] KRC 词标签 offset 相对行首，绝对时刻 = startMs + rel
    }
    if (words) { richLines.push('[' + startMs + ',' + durMs + ']' + words); richStarts.push(startMs); }
  }
  if (!richLines.length) throw new Error('krc no timed lines');
  var translation = '', romanization = '';
  if (languageJson) {
    try {
      var lang = JSON.parse(bytesToUtf8(base64ToBytes(languageJson)));
      // [v1.5.0] 实测酷狗 language 包格式为顶层 {content:[{language,type,lyricContent}],version}：
      // 译文条目 type=1，罗马音条目 type=0（且多组条目 language 字段均为 0，不可依赖）。
      // 兼容旧顶层 lyricContent 单组格式。
      var entries = lang.content || (lang.lyricContent ? [lang] : []);
      for (var ei = 0; ei < entries.length; ei++) {
        var rows = entries[ei].lyricContent || [];
        var isTrans = parseInt(entries[ei].type, 10) === 1;
        var buf = '';
        for (var li = 0; li < rows.length && li < richLines.length; li++) {
          var cells = rows[li] || [];
          var rowText = cells.join('');
          if (!rowText) continue;
          buf += (buf ? '\n' : '') + rowText;
        }
        if (!buf) continue;
        if (isTrans) { translation = translation ? translation + '\n' + buf : buf; continue; }
        // type 非 1 的条目按文字系统判定：拉丁字母为主视为罗马音，避免其它语言译文误入
        var letters = buf.replace(/[^A-Za-z]/g, '');
        var nonLatin = buf.replace(/[A-Za-z\s'’\-,.\u3000]/g, '');
        if (letters.length > 0 && letters.length >= nonLatin.length) {
          romanization = romanization ? romanization + '\n' + buf : buf;
        }
      }
    } catch (e) { /* language JSON 解析失败不阻断 */ }
  }
  if (!translation && richStarts.length) {
    // 回落：同起点独立译文行
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

async function getWordByWordLyricImpl(musicItem) {
  if (!musicItem || !musicItem._src) throw new Error('该条目无音源信息，无法取逐字歌词');
  var srcMap = musicItem._src;
  var tried = [];
  // ① 原生源直取（酷狗 KRC）
  if (srcMap.kugou && srcMap.kugou.hash) {
    try { return parseKrcForHost(await fetchKugouKrc(srcMap.kugou.hash)); }
    catch (e) { tried.push('kugou: ' + String(e && e.message).slice(0, 50)); }
  }
  // ② 酷狗跨源接力（KRC 覆盖面最广）
  try { return parseKrcForHost(await fetchKugouKrcRelay(musicItem)); }
  catch (e) { tried.push('kugou-relay: ' + String(e && e.message).slice(0, 50)); }
  throw new Error('逐字歌词不可用（' + tried.join(' | ') + '）');
}

var LYRIC_ADAPTERS = {
  // [v1.2.0] KRC-first：候选检索（baka 通道）→ fmt=krc 解析出逐字+翻译/罗马音；失败回落 fmt=lrc
  kugou: async function (raw, musicItem) {
    if (!raw || !raw.hash) throw new Error('kugou no hash');
    var cands = await kugouLyricCandidates(raw, musicItem);
    var lastErr = null;
    for (var i = 0; i < Math.min(cands.length, 3); i++) {
      try {
        var krcText = await kugouDownloadLyric(cands[i], 'krc');
        var parsed = parseKrcForHost(krcText);
        return parsed;
      } catch (e) { lastErr = e; }
    }
    // 回落：标准 LRC
    try {
      var lrc = await kugouDownloadLyric(cands[0], 'lrc');
      if (!lrc) throw new Error('kugou lyric decode empty');
      return { rawLrc: lrc };
    } catch (e) {
      throw lastErr || e;
    }
  }
};

// 歌词源尝试顺序（v0.7.0 优化，P1-5）：条目原生源优先（命中率高且省一次跨源请求），
// 其余按直链稳定性排序；最多尝试 3 源（LYRIC_TIMEOUT=3s × 3 ≈ 9s < 10s 上限）
var LYRIC_SOURCE_ORDER = ['kugou'];

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
  throw new Error('所有音源歌词均不可用（' + tried.join(' | ') + '）');
}

// ==================== 插件定义 ====================

var plugin = {
  name: '酷狗音乐',
  platform: 'kugou',
  // [v1.3.0 P1-4] 版本号与文件名对齐（v1.2.1 时代 manifest 误标 1.2.0）。
  // [v1.3.0] 音质大小通道：免签名批量接口 get_res_privilege（relate_goods[].info.filesize）
  // → getMusicInfo 返回带 qualities 副本（宿主补大小官方通道）+ 搜索条目零成本挂三档大小。
  // [v1.3.1] 取链新增 HYWmusic 通道（用户提供的卡密制第三方，128k/320k/flac 三档、VIP 歌真
  // FLAC）：插在海棠与 zddyr 之间接替 zddyr 的实质兜底位（zddyr 限流常态）；免费歌 320k/flac
  // 假文件在通道内按搜索档位字节自检拒收后自动落 zddyr。卡密可经 userVariables.hywCardKey 覆盖。
  version: '1.9.15', // [v1.9.15 v1.9.15 接口吸收版（kuwo/netease/qq 三源集成调研吸收通道：酷我 kw.php/nxinxz/antiserver-high、网易 eapi 响应解密修复+wy.php 兜底、QQ xunhuisi；详见各源 changelog），本源无代码改动，随包升版；；v1.9.14 包升版（网易源集成长青 SVIP 网易替补通道 yinyue.haitangw.net，本源无代码改动，随包升版）；v1.9.13 包升版（QQ 源 a.aa.cab 通道方案A 拒绝虚标修复，本源无代码改动）；v1.9.12 包升版（QQ 源接入 a.aa.cab 新通道，本源无代码改动）；v1.9.10 KRC 接力域名修复版：fetchKugouKrcRelay 搜索域名 mobilecdn.kugou.com → mobiles.kugou.com（http→https 同步升级）——mobilecdn 在部分网络 DNS 污染致逐字歌词接力断链，mobiles 同构（参数/响应一致），2026-09-12 实测全链路打通；搜索/榜单/歌单等既有 mobilecdn 通道属 v1.2.x 老链路不在本版范围，零改动；v1.9.9 音质标识一致性修复版：GOODS_QUALITY_MAP 剔除不可交付档映射 high(hires)/dolby/viper_atmos(atmos)/viper_clear(master)——2026-09-12 实测该曲请求 hires/atmos/master 取链全败（自有通道 code:6 未开放、海棠已下线），列表页透出属虚标且与搜索页三档口径不一致；enrichKugouQualities cap 缺省全量（原榜单 30/专辑 60/歌手 40/导入 200 截断致同歌跨页键集不一致）；RES_PRIVILEGE_QUALITIES 请求列表保持 8 档（裁剪 4 档实测返空 goods）；取链链路零改动，六页复测 7/7 全一致，详见排查总表-v1.9.9；v1.9.8版本号统一 + 封面 https 升级版（导出边界把封面/头像类字段 http→https，白名单 *.kugou.com，cleartext 兼容）；v1.9.4 第三方取链修复 + size 字段版：HYWmusic（103.79.184.97/api 返 500、根路径已 Next.js 化）+ zddyr.top（yy.zddyr.top 503 鉴权）共 2 通道从竞速池移除，保留函数体注释掉，2026-09-11 标记失效；getMediaSource 返回值补 size 字段（取链响应直带 > HEAD Range 0-0 探测 > 留空），详见头部 changelog；v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机 SHEET_URL_UNRECOGNIZED，详见头部 changelog；v1.9.1 歌单全量导入修复版：gcid「我喜欢」类歌单经 collection_3_{uid}_2_0 通道全量导入（签名串补 mid+dfid 修复 20006，specialid=0 不再误判），详见头部 changelog；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——ikun kg 无卡密假成功不接入、次合代等酷狗端点 haitangw.cc 已挂、聆澜无卡密不实测，详见头部 changelog；v1.8.4] 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem（title/description 对齐宿主契约，specialid 通道拉 v3/special/info 免签元数据）；[v1.8.3] 质检遗留优化版（Q-01 specialid 正则收紧 / Q-02 错误前缀统一 / Q-03 code 统一 / Q-04 免签通道 album-artwork 零请求补齐，详见头部）；[v1.8.2] 歌单解析修复版：P0-2 gateway 签名失效免签绕行（specialid 链路）+ P1-2 gcid 分享 token 解码修正 + P2 条目 platform + P2 错误码（详见头部 v1.8.2 changelog）；[v1.8.0] MV 参数对齐基线：getMvSourceImpl 顶层字段兜底+result 补 userAgent/width/height/codec/videoQuality 写回（基线 v1.6.0 P1 trackercdn v2 + 搜索风控；v1.5.0 宿主字段补齐；v1.4.1 严格同曲校验；v1.4.0 三路竞速；v1.2.0 baka 对齐）
  author: '研发2号',
  description: '酷狗音乐独立源插件 v1.9.8（v1.9.8 版本号统一 + 封面 https 升级版：导出边界把封面/头像类字段 http→https（白名单 *.kugou.com，安卓 cleartext 兼容）；v1.9.5 全页面音质标识核查 + VIP 标识移除版：榜单/歌单/专辑/歌手作品/导入入口补 qualities 音质标识（get_res_privilege 批量）；全接口停写 fee（VIP 角标）；上一版 v1.9.3 WebView 短链跟随修复版：followRedirects 非 3xx 分支新增 responseURL 自动跟随检测——真机 WebView 下 XHR 自动跟随 302（axios maxRedirects:0 仅 Node 生效），短链解析拿到最终 URL 而非原始短链，修复真机导入 SHEET_URL_UNRECOGNIZED，详见头部 changelog；上一版 v1.9.2 为分享链接文本自动提取 URL 版；v1.9.1 酷狗歌单全量导入修复版：gcid 分享链 specialid=0 时改提取 listinfo 创建者走 collection_3_{uid}_2_0 全量通道，gateway 签名串补 mid+dfid 修复 error_code 20006，实测 99 首一次拉全，详见头部 v1.9.1 changelog；v1.9.0 BakaMusic 高价值音源接入版：零代码增量随包升版——酷狗侧无高价值增量（ikun kg 无卡密假成功链不接入、第三方酷狗端点 haitangw.cc 实测已挂、聆澜付费档无卡密不实测），详见头部 v1.9.0 changelog；v1.8.4 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem 歌单对象——specialid 通道经 mobilecdn v3/special/info 免签拉标题/介绍/封面/作者，介绍字段 description 对齐宿主 v1.0.0 契约，gcid/kucode 通道标题兜底；v1.8.3 质检遗留优化版：specialid 提取正则收紧 + 错误前缀/code 统一 + 免签通道 album/artwork 零额外请求补齐；v1.8.2 歌单解析修复版：gateway 静态签名密钥失效（error_code 20006）后 gcid 分享链/纯数字歌单码改走免签 specialid 链路（分享页手机 UA 提取 specialid → mobilecdn v3/special/song），签名通道保留兜底并明确抛错；v1.8.0 MV 参数对齐基线：getMvSourceImpl 顶层字段兜底+result 补 userAgent/width/height/codec/videoQuality 写回；基线 v1.6.0 P1 trackercdn v2 重写 + 搜索风控应对；v1.4.0 三路竞速 + 严格同曲校验；v1.2.0 baka 对齐）：搜索（含歌词搜索，v1.6.0 加指数退避重试 + 随机国内 IP 头应对 IP 限频风控）、四音质档位取链（standard/high/super/hires，v1.4.0 升级为三路并行竞速：酷狗自有官方 getSongInfo→洛雪v5→trackercdn v2（v1.6.0 重写接回，hash 先小写再算 key，带 kugouCookie 时生效）‖ 海棠 ‖ 酷我官方直取，谁先返回有效链接用谁，全败回落 HYW→zddyr.top 降级链；v1.4.1 酷我赛道新增严格同曲校验——核心歌名+版本标签+歌手+时长四项全过才可参与竞速，校验不过的候选再快也直接丢弃）、fee VIP 标记全链路透出（搜索/详情/取链，宿主角标）、官方歌曲分享页 getMusicDetailPageUrl、KRC 逐字歌词+翻译/罗马音、官方榜单分类分组（真分页）、歌单广场（推荐位 pinned + 分类）与歌单导入（网页/分享链/酷狗码/gcid/kucode）、歌手信息与作品、专辑详情（真分页）、MV（480p/720p/1080p/4k）、官方评论接口，以及热门搜索/搜索推荐等 _internal 扩展接口；试听片段守卫与播放链接域名白名单校验保留',
  // [v1.5.0 P2-3] primaryKey：条目唯一键声明（对齐网易云/咪咕）。酷狗条目 id=source_sid（稳定身份，
  // v0.7.1 P1-2 起），宿主跨源去重/缓存键按 primaryKey 读取。
  primaryKey: ['id'],
  supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'], // [v1.2.0] 增加 lyric（baka 对齐）
  // [v0.7.2 fix#8 核验] supportedQualities 自 v0.7.0 已全档声明：含 flac/flac24bit/hires（无损与 Hi-Res
  // 在音质菜单可见）；宿主增强音质键（master/atmos/dolby/vinyl 等）经 QUALITY_KEY_MAP 全量映射到内部
  // 档位，normalizeQuality 兜底 standard，无需改动。
  // [v1.3.0 P1-3] 增补 atmos/master 档位声明（baka 对齐）：菜单可见、条目 qualities 按
  // get_res_privilege 实际返回透出真实键（VIP 曲库才有）；请求时经 QUALITY_KEY_MAP 优雅
  // 降级到内部 hires 档接力取链——VIP 档不可用不阻塞播放，无虚标（降级后 actualQuality 如实上报）。
  supportedQualities: ['128k', '192k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master'],
  cacheControl: 'no-store', // 各源播放链接多为签名短时效链接，必须现取
  userVariables: [
    { key: 'kugouCookie', name: '酷狗 Cookie（可选）', hint: '选填；填写后酷狗取链带登录态，可提升 VIP 曲目官方直链成功率，不填走第三方备源' }, // [v1.3.2] 补充声明 hywCardKey：v1.3.1 新增 HYWmusic 通道代码读取 userVariables.hywCardKey 覆盖卡密，但 manifest 未声明导致配置入口缺失（审查「一般」级问题）
    { key: 'hywCardKey', name: 'HYWmusic 卡密（可选）', hint: '留空使用默认值' }
  ],
  hints: {
    search: ['搜索酷狗音乐曲库，结果为酷狗源列表', '播放时三路通道（酷狗自有/海棠/酷我官方）并行竞速，最快有效链接优先；全败自动回落 HYW→zddyr 降级链'],
    importMusicSheet: [
      '支持酷狗的歌单分享链接，如 kugou.com/playlist/id/xxx',
      '酷狗分享口令里的 gcid 链接也可识别；单次最多导入 400 首', // [P2-2 v1.1.0] 与 SHEET_MAX_PAGES(4)×100 实际上限对齐，原提示 500 虚标
      '支持纯数字酷狗码（口令里的邀请码），自动解码歌单或歌曲列表' // [v1.2.0] baka 对齐
    ]
  },

  async search(query, page, type) {
    // MusicFree 协议：query 为对象 { keyword, type }；解包出关键词（所有 searchType 通用）
    var kw = query && typeof query === 'object' ? String(query.keyword || '').trim()
      : String(query || '').trim();
    if (!kw) return { isEnd: true, data: [] };
    var q = kw;
    if (type === 'album') return aggregateSearchBy(ALBUM_SEARCH_ADAPTERS, q, page, albumKeyOf, buildAlbumItem);
    if (type === 'artist') return enrichArtistSearchPage(await aggregateSearchBy(ARTIST_SEARCH_ADAPTERS, q, page, artistKeyOf, buildArtistItem)); // [v1.2.0] 第 1 页歌手信息富化
    if (type === 'sheet') return aggregateSearchBy(SHEET_SEARCH_ADAPTERS, q, page, sheetKeyOf, buildSheetSearchItem);
    if (type !== 'music' && type !== 'lyric') return { isEnd: true, data: [] }; // [v1.2.0] lyric 搜索复用歌曲结果（宿主歌词条目即歌曲条目）

    var names = ['kugou'];
    var searchErrors = []; // [P1-3] 与"合法无结果"区分
    var tasks = names.map(function (n) {
      return SEARCH_ADAPTERS[n](q, page).catch(function (e) { searchErrors.push(String((e && e.message) || e).slice(0, 80)); return []; });
    });
    var settled = await Promise.all(tasks);
    var all = [];
    var okCount = 0;
    for (var i = 0; i < settled.length; i++) {
      if (settled[i] && settled[i].length > 0) okCount++;
      all = all.concat(settled[i] || []);
    }
    if (okCount === 0) {
      // [P1-3] 无结果 ≠ 失败：请求成功但空 = 正常空页；有真实错误才抛
      if (searchErrors.length > 0) throw new Error('酷狗搜索失败：' + searchErrors.join('；'));
      return { isEnd: true, data: [] };
    }

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
    return { isEnd: data.length === 0, data: data };
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    var q = normalizeQuality(quality);
    // [v1.8.1 P1-7] 边界回填 quality 字段（参照 qq/kuwo/migu/netease/qishui 模板，
    // 宿主 IMediaSourceResult.quality 在 v1.0.0 协议为标准字段，actualQuality 仅作扩展回传）
    return resolveWithFallback(musicItem, q).then(function (r) {
      if (r) r.quality = r.actualQuality || q;
      // [v1.9.4] 边界补 size 兜底：竞速链返回无 size 时，Range 0-0 HEAD 探测；
      // 探测失败留空（不阻断取链）
      if (r && r.url && !r.size) {
        return probeHeadSize(r.url, 2000).then(function (sz) {
          if (sz > 0) r.size = sz;
          return r;
        }).catch(function () { return r; });
      }
      return r;
    });
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  // v0.7.0 P0-2：逐字歌词（酷狗 KRC / 网易云 YRC，原生源优先 + 跨源接力）
  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  // v0.7.0 P0-3：单曲分享链接导入（网易云/QQ/酷我/酷狗/汽水）
  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // v0.7.0 P0-4：歌曲详情（多源补齐封面/专辑/时长/MV）
  // [v0.7.2 fix#9 核验] getMusicInfo 自 v0.7.0 P0-4 已实现（getMusicInfoImpl）：多源详情补齐
  // （专辑/时长/MV 字段），仍缺封面时 enrichArtwork 反查兜底（酷我 rid_pic / 酷狗 get_song_info），
  // 覆盖架构报告「封面补全兜底」诉求，无需改动。
  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  // [v1.5.0 P1-2] 酷狗官方歌曲分享页：https://www.kugou.com/mixsong/{encode_album_audio_id}.html
  // encode token 经 complexsearch v2 签名搜索（EMixSongID）按条目 hash 精确匹配取得；
  // 取不到返回 null（宿主有 platform@id fallback）。
  async getMusicDetailPageUrl(musicItem) {
    return getMusicDetailPageUrlImpl(musicItem);
  },

  async getTopLists() {
    // [P2-1 v1.1.0] 官方 rank/list 动态榜单（55+ 榜）优先；失败降级静态 CHART_DEFS
    try {
      var rankList = await fetchKugouRankList();
      return groupKugouRankList(rankList); // [v1.2.0] classify 分组（热门/特色/全球/更多）
    } catch (eRank) { /* 降级 */ }
    return [{
      title: '聚合榜单',
      data: CHART_DEFS.map(function (d) {
        return { id: d.id, title: d.title, coverImg: d.cover || '', artwork: d.cover || '' }; // [v1.2.1] 补 coverImg（宿主榜单组件只读 coverImg）
      })
    }];
  },

  async getTopListDetail(topListItem, page) {
    // [P2-1 v1.1.0] kgrank~ 前缀 = 官方 rank/song 真分页榜单（P2-1，rank/list 56 榜实测）
    var tid = (topListItem && topListItem.id) || '';
    if (String(tid).indexOf('kgrank~') === 0) {
      var rankid = String(tid).slice(7);
      var _kgr = await fetchKugouRankSongs(rankid, page);
      _kgr.topListItem = { id: topListItem.id, title: topListItem.title, coverImg: topListItem.coverImg, artwork: topListItem.artwork, platform: 'kugou' };
      return _kgr;
    }
    if (page && page > 1) return { isEnd: true, musicList: [] };
    var def = findChartDef(topListItem && topListItem.id);
    if (!def) throw new Error('未知榜单: ' + (topListItem && topListItem.id));
    var musicList = await enrichArtwork(await getAggregatedChart(def), 80);
    return { isEnd: true, musicList: musicList, topListItem: { id: topListItem.id, title: topListItem.title, coverImg: topListItem.coverImg, artwork: topListItem.artwork, platform: 'kugou' } };
  },

  async importMusicSheet(urlLike) {
    return importMusicSheetImpl(urlLike);
  },

  async getAlbumInfo(albumItem, page) { // [v1.2.0] page 透传
    return getAlbumInfoImpl(albumItem, page);
  },

  async getArtistInfo(artistItem) { // [v1.2.0] 新增：歌手头像/简介/作品数（对齐 baka）
    return getArtistInfoImpl(artistItem);
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
    // [P2-3 v1.1.0] MV 档位诚实化：mv.php?cmd=100 实测仅 sd/hd 两档（240P/480P，mkv 封装），
    // 原声明 4 档（含 720P/1080P）为虚标，宿主选高档会静默降级。
    { key: '240p', label: '240P' },
    { key: '480p', label: '480P' }
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
    getLyricImpl: getLyricImpl,
    enrichArtwork: enrichArtwork,
    fetchKugouCover: fetchKugouCover,
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
    // v0.7.0 新增（P0/P1 自测用）
    normalizeQuality: normalizeQuality,
    QUALITY_KEY_MAP: QUALITY_KEY_MAP,
    importMusicItemImpl: importMusicItemImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getWordByWordLyricImpl: getWordByWordLyricImpl,
    SONG_URL_RESOLVERS: SONG_URL_RESOLVERS,
    resolveSongId: resolveSongId,
    SONG_DETAIL_FETCHERS: SONG_DETAIL_FETCHERS,
    fetchKugouComments: fetchKugouComments,
    decodeKrc: decodeKrc,
    fetchKugouKrc: fetchKugouKrc,
    fetchKugouKrcRelay: fetchKugouKrcRelay,
    haitangLevelOf: haitangLevelOf,
    resolveHaitang: resolveHaitang,
    LYRIC_TIMEOUT: LYRIC_TIMEOUT,
    // v0.7.1 新增（走查修复自测用）
    isAllowedMediaUrl: isAllowedMediaUrl,
    withTimeout: withTimeout,
    RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
    RELAY_TIMEOUT: RELAY_TIMEOUT,
    // [v0.7.2] 新增（还债包回归自测用）
    internalToHostQuality: internalToHostQuality,
    md5Hex: md5Hex,
    // [⑭ v1.1.0] raceSuccess 导出已随死代码一并移除；[v1.4.0] 随三路竞速恢复导出
    resolveWithFallback: resolveWithFallback,
    resolveStats: RESOLVE_STATS, // [⑯ v1.1.0] 通道命中统计（channel 字段配套）
    // [v1.4.0] 酷我并行竞速通道（自测/调试可直调）；[v1.4.1] searchKuwoRid → 候选+同曲校验
    raceSuccess: raceSuccess,
    resolveKuwoFallback: resolveKuwoFallback,
    kuwoOfficialResolve: kuwoOfficialResolve,
    kuwoDesResolve: kuwoDesResolve,
    searchKuwoCandidates: searchKuwoCandidates,
    searchKuwoVerifiedRid: searchKuwoVerifiedRid,
    kuwoSameSongCheck: kuwoSameSongCheck,
    kwSplitTitleVersion: kwSplitTitleVersion,
    pickKuwoVerifiedRid: pickKuwoVerifiedRid,
    KW_VERSION_KEYWORDS: KW_VERSION_KEYWORDS,
    KUWO_BR: KUWO_BR,
    KUWO_QUALITY_MAP: KUWO_QUALITY_MAP,
    RACE_BUDGET_MS: RACE_BUDGET_MS,
    // [v1.5.0] 宿主字段补齐（自测/调试可直调）
    complexSearchSong: complexSearchSong,
    getMusicDetailPageUrlImpl: getMusicDetailPageUrlImpl,
    fetchHashFromSharePage: fetchHashFromSharePage,
    // [v1.6.0] 搜索风控应对（自测可直调）
    searchKugouAttempt: searchKugouAttempt,
    searchKugou: searchKugou,
    kugouRandomChinaIP: kugouRandomChinaIP,
    kugouRiskIpHeaders: kugouRiskIpHeaders,
    kugouSearchBackoffDelay: kugouSearchBackoffDelay,
    KG_IP_PREFIXES: KG_IP_PREFIXES,
    // v0.8.0 酷狗扩展：洛雪v5 签名/取链 + trackercdn/zddyr 解析器 + internal-only 扩展接口
    lx5SignQuery: lx5SignQuery,
    lx5Si: lx5Si,
    resolveLx5Kugou: resolveLx5Kugou,
    resolveKugouTrackercdn: resolveKugouTrackercdn,
    resolveKugouZddyr: resolveKugouZddyr,
    fetchKugouNewSongs: fetchKugouNewSongs,
    fetchKugouSingerInfo: fetchKugouSingerInfo,
    fetchKugouHotSearch: fetchKugouHotSearch,
    fetchKugouSearchRecommend: fetchKugouSearchRecommend,
    searchKugouByType: searchKugouByType,
    fetchKugouSingerClass: fetchKugouSingerClass,
    fetchKugouSingerList: fetchKugouSingerList,
    fetchKugouSingerRecommend: fetchKugouSingerRecommend,
    fetchKugouSingerMv: fetchKugouSingerMv,
    fetchKugouMvRecommend: fetchKugouMvRecommend,
    fetchKugouTagList: fetchKugouTagList,
    fetchKugouCategoryList: fetchKugouCategoryList,
    // [v1.2.0] baka 对齐新增导出（自测与宿主扩展用）
    searchKugouV3Fallback: searchKugouV3Fallback,
    mapSongSearchV2Item: mapSongSearchV2Item,
    MV_LEVEL_HEIGHT: MV_LEVEL_HEIGHT,
    mvHostQuality: mvHostQuality,
    KG_SHEET_PINNED_SORTS: KG_SHEET_PINNED_SORTS,
    mapKugouRecommendSheet: mapKugouRecommendSheet,
    resolveKugouCode: resolveKugouCode,
    fetchKugouGcidSheet: fetchKugouGcidSheet,
    fetchKugouKucodeSheet: fetchKugouKucodeSheet,
    kugouGatewaySign: kugouGatewaySign,
    parseKrcForHost: parseKrcForHost,
    kugouLyricCandidates: kugouLyricCandidates,
    kugouDownloadLyric: kugouDownloadLyric,
    fetchKugouResId: fetchKugouResId,
    fetchKugouOfficialComments: fetchKugouOfficialComments,
    fetchKugouArtistInfo: fetchKugouArtistInfo,
    enrichArtistSearchPage: enrichArtistSearchPage,
    getArtistInfoImpl: getArtistInfoImpl,
    groupKugouRankList: groupKugouRankList
  }
};

// ---------- v0.8.0 酷狗扩展接口（internal-only） ----------
// 说明：MusicFree 插件协议没有"歌手浏览/MV浏览/热门搜索/标签分类"对应的宿主 UI 接口，
// 以下函数经 plugin._internal 暴露，供宿主自定义页面或调试调用；全部免登录、失败时抛错由调用方降级。

// 热门搜索词：mobilecdn api/v3/search/hot（实测返回 keyword[]）
function fetchKugouHotSearch(count) {
  return axios.get('http://mobilecdn.kugou.com/api/v3/search/hot', {
    params: { format: 'json', plat: 2, count: count || 30 },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && d.info) || [];
    return list.map(function (it) { return { keyword: str(it.keyword), jumpurl: str(it.jumpurl || '') }; })
      .filter(function (it) { return it.keyword; });
  });
}

// 搜索推荐：mobilecdn api/v3/search/recommend?keyword={kw}（输入联想）
function fetchKugouSearchRecommend(keyword) {
  if (!keyword) return Promise.resolve([]);
  return axios.get('http://mobilecdn.kugou.com/api/v3/search/recommend', {
    params: { format: 'json', keyword: keyword },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.list)) || [];
    return list.map(function (it) { return str(it.keyword || it.highlight || ''); }).filter(Boolean);
  });
}

// 多分类搜索（type = album / singer / special / mv；song 走正常 search）：
// mobilecdn api/v3/search/{type}，singer 搜索的 data 是 list 的坑在此统一处理
function searchKugouByType(type, keyword, page) {
  if (!keyword) return Promise.reject(new Error('kugou type search: no keyword'));
  var p = page || 1;
  return axios.get('http://mobilecdn.kugou.com/api/v3/search/' + type, {
    params: { format: 'json', keyword: keyword, page: p, pagesize: 30 },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = Array.isArray(d) ? d : ((d && (d.info || d.list)) || []);
    return { page: p, total: (d && d.total) || 0, list: list };
  });
}

// 歌手分类列表：m.kugou.com/singer/class?json=true（classid/classname）
function fetchKugouSingerClass() {
  return axios.get('https://m.kugou.com/singer/class', {
    params: { json: true },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var root = res.data && res.data.list;
    var arr = (root && (root.list || root.info)) || [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var g = arr[i];
      if (g && g.classid !== undefined) {
        out.push({ classid: str(g.classid), classname: str(g.classname) });
      } else if (g && Array.isArray(g.list)) {
        for (var j = 0; j < g.list.length; j++) {
          out.push({ classid: str(g.list[j].classid), classname: str(g.list[j].classname) });
        }
      }
    }
    return out.filter(function (it) { return it.classid && it.classname; });
  });
}

// 歌手列表（按分类）：m.kugou.com/singer/list/{classid}?json=true&page={p}
// ⚠️ classid=0 返回 total=0 空列表，默认落 1（华语）；每条 info.singer[0] 为歌手对象
function fetchKugouSingerList(classid, page) {
  var cid = parseInt(classid, 10) || 1;
  var p = page || 1;
  return axios.get('https://m.kugou.com/singer/list/' + cid, {
    params: { json: true, page: p },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var singers = res.data && res.data.singers;
    var listWrap = singers && singers.list;
    var info = (listWrap && listWrap.info) || [];
    var out = [];
    for (var i = 0; i < info.length; i++) {
      var s = info[i] && info[i].singer && info[i].singer[0];
      if (s && s.singerid) {
        out.push({
          singerid: str(s.singerid), singername: str(s.singername),
          avatar: s.imgurl ? kgImgUrl(String(s.imgurl), '480') : '',
          songcount: parseInt(s.songcount, 10) || 0,
          albumcount: parseInt(s.albumcount, 10) || 0
        });
      }
    }
    return { page: p, total: (listWrap && listWrap.total) || 0, list: out };
  });
}

// 歌手推荐（相似歌手）：mobilecdn api/v3/singer/recommend?singername=&singerid=（两者都传）
function fetchKugouSingerRecommend(singerid, singername) {
  if (!singerid) return Promise.reject(new Error('kugou singer recommend: no id'));
  return axios.get('http://mobilecdn.kugou.com/api/v3/singer/recommend', {
    params: { format: 'json', singerid: singerid, singername: singername || '' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && d.info) || [];
    return list.map(function (it) {
      return {
        singerid: str(it.singerid), singername: str(it.singername),
        avatar: it.imgurl ? kgImgUrl(String(it.imgurl), '480') : '',
        songcount: parseInt(it.songcount, 10) || 0,
        intro: str(it.intro || '')
      };
    }).filter(function (it) { return it.singerid && it.singername; });
  });
}

// 歌手 MV：mobilecdn api/v3/singer/mv?singername=&singerid=（需双参数；m.kugou.com/singer/mv 为 Access Deny）
// 返回 hash 可直接喂给 getMvSourceImpl / mv.php?cmd=100
function fetchKugouSingerMv(singerid, singername, page) {
  if (!singerid) return Promise.reject(new Error('kugou singer mv: no id'));
  return axios.get('http://mobilecdn.kugou.com/api/v3/singer/mv', {
    params: { format: 'json', singerid: singerid, singername: singername || '', page: page || 1, pagesize: 30, json: true },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && d.info) || [];
    return list.map(function (it) {
      return {
        hash: str(it.hash),
        title: str(it.filename || it.mvname || ''),
        singer: str(it.singername || ''),
        artwork: it.imgurl ? String(it.imgurl).replace('{size}', '400') : '',
        addtime: str(it.addtime || '')
      };
    }).filter(function (it) { return it.hash; });
  });
}

// MV 推荐：mobilecdn api/v3/mv/recommend?hash={MV搜索hash}
// 返回 mainland[]（内地）/ hk[]（港台）/ other[]（其他）三组推荐
function fetchKugouMvRecommend(mvHash) {
  if (!mvHash) return Promise.reject(new Error('kugou mv recommend: no hash'));
  return axios.get('http://mobilecdn.kugou.com/api/v3/mv/recommend', {
    params: { format: 'json', hash: mvHash },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var groups = {};
    var keys = ['mainland', 'hk', 'other'];
    for (var k = 0; k < keys.length; k++) {
      var arr = (d && d[keys[k]]) || [];
      groups[keys[k]] = arr.map(function (it) {
        return {
          hash: str(it.hash), title: str(it.filename || ''),
          singer: str(it.singername || ''), remark: str(it.remark || '')
        };
      }).filter(function (it) { return it.hash; });
    }
    return groups;
  });
}

// 标签列表（歌单标签）：mobilecdn api/v3/tag/list
function fetchKugouTagList() {
  return axios.get('http://mobilecdn.kugou.com/api/v3/tag/list', {
    params: { format: 'json' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.list || d.data)) || [];
    return list.map(function (it) {
      return { id: str(it.id), name: str(it.subtitle || it.tagname || it.name) };
    }).filter(function (it) { return it.id && it.name; });
  });
}

// 分类列表：mobilecdn api/v3/category/list（categoryid/categoryname）
function fetchKugouCategoryList() {
  return axios.get('http://mobilecdn.kugou.com/api/v3/category/list', {
    params: { format: 'json' },
    timeout: SOURCE_TIMEOUT,
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.list || d.data)) || [];
    return list.map(function (it) {
      return {
        categoryid: str(it.categoryid), name: str(it.categoryname || it.name),
        imgurl: it.imgurl ? String(it.imgurl).replace('{size}', '400') : ''
      };
    }).filter(function (it) { return it.categoryid && it.name; });
  });
}

// [v1.9.7 封面 https 升级（cleartext 兼容）] 2026-09-11 封面图专项审计发现：酷狗封面/头像 URL 大量为
// http:// 明文（实测搜索 19/19），安卓 9+ WebView 默认禁明文 HTTP，App 内可能整页裂图。对已实测支持
// https 的图片 host（imge.kugou.com / singerimg.kugou.com 均 200 实测，白名单限 *.kugou.com）在插件
// 导出边界统一升级 https；仅作用于封面/头像类字段，其它字段与未验证 host 不动。
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

// ==================== 追加段 A：专辑/歌手/歌单搜索 ====================
// 端点出自酷狗接口探针实测记录，无猜测 URL。
// 范围决策：专辑/歌手/歌单搜索仅接酷狗源（由聚合插件 v0.8.0 抽离酷狗源而成）。
// 注：本段位于 module.exports 之后，函数声明提升 + 调用时求值，行为与前置声明一致。

var SEARCH_PAGE_SIZE = 20;

function kgImgUrl(s, size) {
  return String(s || '').replace('{size}', size || '480');
}
function searchAlbumKugou(q, page) {
  // doc 2.x 分类搜索：/search/album → data.info[]（防御式兼收 data.albums，探针 kg_search_album）
  return axios.get('http://msearchcdn.kugou.com/api/v3/search/album', {
    params: { format: 'json', keyword: q, page: page, pagesize: SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.albums)) || [];
    return list.map(function (it) {
      var albumid = str(it.albumid || it.album_id);
      return {
        source: 'kugou', sid: albumid,
        title: str(it.albumname || it.name).replace(/<[^>]+>/g, ''), // [v1.2.0] 去 HTML 高亮标签（baka 对齐）
        artist: str(it.singername || ''),
        artwork: kgImgUrl(it.imgurl || it.img),
        date: it.publishtime ? String(it.publishtime) : '',
        worksNum: it.songcount || it.song_count || 0,
        raw: { albumid: albumid }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
// ---------- 歌手搜索 ----------
function searchArtistKugou(q, page) {
  // ⚠️ 文档坑：singer 搜索的 data 本身就是列表（非 data.info，探针 kg_search_singer）
  return axios.get('http://msearchcdn.kugou.com/api/v3/search/singer', {
    params: { format: 'json', keyword: q, page: page, pagesize: SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = Array.isArray(d) ? d : ((d && (d.info || d.singers)) || []);
    return list.map(function (it) {
      var singerid = str(it.singerid || it.singer_id || it.id);
      var name = str(it.singername || it.name);
      return {
        source: 'kugou', sid: singerid,
        name: name,
        avatar: kgImgUrl(it.imgurl || it.img),
        worksNum: it.songcount || it.song_count || 0,
        raw: { singerid: singerid, singername: name }
      };
    }).filter(function (it) { return it.sid && it.name; });
  });
}
// ---------- 歌单搜索 ----------
function searchSheetKugou(q, page) {
  // doc 2.x：/search/special（歌单=special，探针 kg_search_special）
  return axios.get('http://msearchcdn.kugou.com/api/v3/search/special', {
    params: { format: 'json', keyword: q, page: page, pagesize: SEARCH_PAGE_SIZE },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.specials)) || [];
    return list.map(function (it) {
      var sid = str(it.specialid || it.id);
      return {
        source: 'kugou', sid: sid,
        title: str(it.specialname || it.name),
        artist: str(it.nickname || it.nick || ''),
        artwork: it.img ? String(it.img) : kgImgUrl(it.imgurl),
        worksNum: it.count || it.play || 0,
        raw: { listId: sid }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}
var ALBUM_SEARCH_ADAPTERS = {
  kugou: searchAlbumKugou
};
var ARTIST_SEARCH_ADAPTERS = {
  kugou: searchArtistKugou
};
var SHEET_SEARCH_ADAPTERS = {
  kugou: searchSheetKugou
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
    platform: 'kugou',
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
    platform: 'kugou',
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
    platform: 'kugou',
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
  var agErrors = []; // [P1-3] 记录适配器真实失败，与"合法无结果"区分
  var tasks = names.map(function (n) {
    return adapterMap[n](q, page).catch(function (e) {
      // [P0-1] Hermes/无 Node 全局环境无 process，typeof 守卫防 ReferenceError
      if (typeof process !== 'undefined' && process && process.env && process.env.AG_DEBUG) console.error('[adapter:' + n + '] ' + String((e && e.message) || e).slice(0, 200));
      agErrors.push(n + ': ' + String((e && e.message) || e).slice(0, 80));
      return [];
    });
  });
  var settled = await Promise.all(tasks);
  if (typeof process !== 'undefined' && process && process.env && process.env.AG_DEBUG) {
    for (var di = 0; di < settled.length; di++) console.error('[agg:' + names[di] + '] items=' + (settled[di] || []).length);
  }
  var all = [];
  var okCount = 0;
  for (var i = 0; i < settled.length; i++) {
    if (settled[i] && settled[i].length > 0) okCount++;
    all = all.concat(settled[i] || []);
  }
  if (okCount === 0) {
    // [P1-3] 适配器全部成功但返回空 = 无结果，正常返回空页；仅存在真实请求错误时才抛"失败"
    if (agErrors.length > 0) throw new Error('酷狗搜索失败：' + agErrors.join('；'));
    return { isEnd: true, data: [] };
  }
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


// ==================== v0.5.0 追加段 B：详情解析 / 歌手作品 / MV / 推荐歌单 / 评论 ====================
// 端点全部出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核：
// - 酷狗：album/info+album/song(doc 3.7)、singer/song+singer/album(doc 3.6，须 singername+singerid 双参)、
//   search/mv + mv.php?cmd=100(doc 3.8，sd/hd 为 mkv) [探针 kg_album_song/kg_singer_song/kg_singer_album/kg_search_mv/kg_mv_play]
// - 歌单广场：酷狗 plist/index [探针 r7_kg_plist_index]

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

// ---------- 歌手详情（[v1.2.0] 对齐 baka：v3/singer/info 富化 + getArtistInfo） ----------
// baka 同款参数：version:9108, singerid, area_code:1 → data.data.{imgurl,profile,intro,songcount}
async function fetchKugouArtistInfo(singerid) {
  var res = await axios.get('http://mobilecdn.kugou.com/api/v3/singer/info', {
    params: { version: 9108, singerid: singerid, area_code: 1, format: 'json' },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  });
  var d = (res.data && res.data.data) || {};
  return {
    avatar: kgImgUrl(d.imgurl || d.img, '480'),
    description: str(d.profile || d.intro || ''),
    worksNum: parseInt(d.songcount || d.song_count, 10) || 0
  };
}

// 歌手搜索结果富化：仅对第 1 页（宿主首屏）且无头像/简介的条目补 v3/singer/info，并发 6 防拖慢
async function enrichArtistSearchPage(result) {
  try {
    if (!result || !Array.isArray(result.data)) return result;
    var items = result.data.filter(function (it) {
      var raw = it && it._rsrc && it._rsrc.kugou;
      return raw && raw.singerid && (!it.avatar || !it.description);
    }).slice(0, 20);
    if (!items.length) return result;
    var CONC = 6, idx = 0;
    async function worker() {
      while (idx < items.length) {
        var it = items[idx++];
        try {
          var raw = it._rsrc.kugou;
          var info = await fetchKugouArtistInfo(raw.singerid);
          if (info.avatar && !it.avatar) it.avatar = info.avatar;
          if (info.description) it.description = info.description;
          if (info.worksNum && !it.worksNum) it.worksNum = info.worksNum;
        } catch (e) { /* 单条富化失败不影响列表 */ }
      }
    }
    var workers = [];
    for (var w = 0; w < Math.min(CONC, items.length); w++) workers.push(worker());
    await Promise.all(workers);
  } catch (e) { /* 富化整体失败不影响搜索结果 */ }
  return result;
}

async function getArtistInfoImpl(artistItem) {
  var src = (artistItem && artistItem._rsrc) || {};
  var names = sourcesByWeight(src);
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    if (names[i] !== 'kugou') continue;
    try {
      var raw = src[names[i]] || {};
      if (!raw.singerid) throw new Error('missing singerid');
      var info = await fetchKugouArtistInfo(raw.singerid);
      var out = {};
      for (var k in artistItem) { if (k !== '_rsrc') out[k] = artistItem[k]; }
      if (info.avatar) out.avatar = info.avatar;
      if (info.description) out.description = info.description;
      if (info.worksNum) out.worksNum = info.worksNum;
      return out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('歌手信息获取失败');
}

// ---------- 专辑详情 ----------
var ALBUM_DETAIL = {
  kugou: async function (raw, page) { // [v1.2.0] 专辑真分页（对齐 baka：page 透传 + isEnd 按总量）
    var hdrs = { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' };
    var r = await axios.get('http://mobilecdn.kugou.com/api/v3/album/info', {
      params: { albumid: raw.albumid, format: 'json' }, timeout: SOURCE_TIMEOUT, headers: hdrs
    });
    var info = (r.data && r.data.data) || {};
    var r2 = await axios.get('http://mobilecdn.kugou.com/api/v3/album/song', {
      params: { albumid: raw.albumid, page: page || 1, pagesize: 100, format: 'json' }, timeout: SOURCE_TIMEOUT, headers: hdrs
    });
    var d2 = r2.data && r2.data.data;
    var list = (d2 && (d2.info || d2.songs)) || [];
    return {
      albumItem: {
        title: info.albumname ? String(info.albumname) : '',
        artist: info.singername ? String(info.singername) : '',
        artwork: info.imgurl ? kgImgUrl(String(info.imgurl), '480') : '',
        date: info.publishtime ? String(info.publishtime) : '',
        worksNum: (d2 && d2.total) || list.length
      },
      entries: list.map(function (it) {
        var name = it.songname || it.filename || it.name || '';
        var artist = it.singername || (String(name).indexOf(' - ') > 0 ? String(name).split(' - ')[0] : '');
        var title = it.songname || (String(name).indexOf(' - ') > 0 ? String(name).split(' - ').slice(1).join(' - ') : name);
        return {
          source: 'kugou', sid: str(it.hash || it.album_audio_id),
          title: str(title), artist: str(artist),
          album: it.albumname ? String(it.albumname) : '',
          duration: parseInt(it.duration, 10) || 0,
          artwork: '',
          raw: { hash: str(it.hash), albumAudioId: it.album_audio_id ? String(it.album_audio_id) : '' }
        };
      }),
      total: parseInt((d2 && d2.total), 10) || 0 // [v1.2.0] 专辑歌曲总量，用于 isEnd
    };
  }
};

async function getAlbumInfoImpl(albumItem, page) { // [v1.2.0] 支持 page 透传（宿主协议 getAlbumInfo(albumItem, page)）
  page = parseInt(page, 10) || 1;
  var src = (albumItem && albumItem._asrc) || {};
  var names = sourcesByWeight(src);
  if (!names.length) throw new Error('该条目无可用的专辑详情源');
  var lastErr = null;
  for (var i = 0; i < names.length; i++) {
    try {
      var out = await ALBUM_DETAIL[names[i]](src[names[i]], page);
      if (!out.entries.length) throw new Error('empty album');
      var musicList = out.entries.map(buildSheetItem);
      await enrichKugouQualities(musicList); // [v1.9.9] 专辑页音质标识补齐（cap 全量）
      await enrichArtwork(musicList, 60);
      var item = {};
      for (var k in albumItem) { if (k !== '_asrc') item[k] = albumItem[k]; }
      if (out.albumItem.title && !item.title) item.title = out.albumItem.title;
      if (out.albumItem.date && !item.date) item.date = out.albumItem.date;
      if (out.albumItem.worksNum && !item.worksNum) item.worksNum = out.albumItem.worksNum;
      if (out.albumItem.artwork && !item.artwork) item.artwork = out.albumItem.artwork;
      var isEnd = out.total > 0 ? (page * 100 >= out.total) : (out.entries.length < 100); // [v1.2.0] 对齐 baka：page*100 >= total
      return { isEnd: isEnd, albumItem: item, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('专辑详情获取失败');
}

// ---------- 歌手作品 ----------
var ARTIST_MUSIC = {
  kugou: async function (raw, page) {
    // doc 3.6：singername + singerid 必须双传（实测只传一个返回"参数不合法"）
    var res = await axios.get('http://mobilecdn.kugou.com/api/v3/singer/song', {
      params: { format: 'json', singername: raw.singername, singerid: raw.singerid, page: page, pagesize: 30 },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.songs)) || [];
    return {
      entries: list.map(function (it) {
        var name = it.songname || it.filename || it.name || '';
        var artist = it.singername || (String(name).indexOf(' - ') > 0 ? String(name).split(' - ')[0] : '');
        var title = it.songname || (String(name).indexOf(' - ') > 0 ? String(name).split(' - ').slice(1).join(' - ') : name);
        return {
          source: 'kugou', sid: str(it.hash || it.album_audio_id),
          title: str(title), artist: str(artist),
          album: it.albumname ? String(it.albumname) : '',
          duration: parseInt(it.duration, 10) || 0,
          artwork: '',
          raw: { hash: str(it.hash), albumAudioId: it.album_audio_id ? String(it.album_audio_id) : '' }
        };
      }),
      isEnd: list.length < 30
    };
  }
};

var ARTIST_ALBUM = {
  kugou: async function (raw, page) {
    var res = await axios.get('http://mobilecdn.kugou.com/api/v3/singer/album', {
      params: { format: 'json', singername: raw.singername, singerid: raw.singerid, page: page, pagesize: 30 },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var d = res.data && res.data.data;
    var list = (d && (d.info || d.albums)) || [];
    return {
      entries: list.map(function (it) {
        return {
          source: 'kugou', sid: str(it.albumid),
          title: str(it.albumname || it.name), artist: it.singername || raw.singername || '',
          artwork: it.imgurl ? kgImgUrl(String(it.imgurl), '480') : (it.img || ''),
          date: it.publishtime ? String(it.publishtime) : '',
          worksNum: it.songcount || 0,
          raw: { albumid: str(it.albumid) }
        };
      }),
      isEnd: list.length < 30
    };
  }
};

// 酷狗歌手信息（v0.8.0 新增）：m.kugou.com/singer/info/{singerid}，免登录
// 返回 { avatar, description, worksNum }；用于 getArtistWorks 第 1 页富化（失败静默跳过，不影响歌曲/专辑列表）
async function fetchKugouSingerInfo(singerid) {
  if (!singerid) throw new Error('kugou singer info: no id');
  var res = await axios.get('https://m.kugou.com/singer/info/' + singerid, {
    params: { json: true },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
  });
  var d = (res.data && res.data.data) || res.data || {};
  var info = d.info || d;
  return {
    avatar: info.imgurl ? kgImgUrl(String(info.imgurl), '480') : (str(info.img) || ''),
    description: str(info.intro || info.introduce || ''),
    worksNum: parseInt(info.worksNum || info.songcount, 10) || 0
  };
}

// 第 1 页富化：给酷狗歌手条目补头像/简介/作品数（异步等待但失败不阻断）
async function enrichKugouArtistData(data, singerid) {
  try {
    var info = await fetchKugouSingerInfo(singerid);
    for (var i = 0; i < data.length; i++) {
      if (info.avatar && !data[i].avatar) data[i].avatar = info.avatar;
      if (info.description && !data[i].description) data[i].description = info.description;
      if (info.worksNum && !data[i].worksNum) data[i].worksNum = info.worksNum;
    }
  } catch (e) { /* 富化失败不影响主流程 */ }
}

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
        await enrichKugouQualities(data); // [v1.9.9] 歌手作品页音质标识补齐（cap 全量）
        await enrichArtwork(data, 40);
      }
      // 酷狗歌手第 1 页：补歌手头像/简介/作品数（v0.8.0 新增，失败静默跳过）
      if (p === 1 && src.kugou && src.kugou.singerid) {
        await enrichKugouArtistData(data, src.kugou.singerid);
      }
      return { isEnd: out.isEnd !== undefined ? out.isEnd : out.entries.length < 30, data: data };
    } catch (e) { lastErr = e; }
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
      var musicList = dedupeBySid(entries).map(buildSheetItem);
      await enrichKugouQualities(musicList); // [v1.9.9] 歌单页音质标识补齐（cap 全量）
      await enrichArtwork(musicList, 60);
      return { isEnd: true, sheetItem: sheetItem, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('歌单详情获取失败');
}

// ---------- MV 取链 ----------
// [v1.2.0] 对齐 baka：mv.php?cmd=100&ext=mp4 提供五路流 le/sd/hd/sq/rq
// （480p/720p/1080p/1080p/4k，mkv 时代结束）。优先用条目自带 mvHash（搜索/榜单/详情透传），
// 无 mvHash 才走 search/mv 严格匹配兜底（宁缺毋滥）。
var MV_QUALITY_ORDER = ['480p', '720p', '1080p', '4k'];
var MV_LEVEL_HEIGHT = { le: 480, sd: 720, hd: 1080, sq: 1080, rq: 2160 };

function mvHostQuality(height) {
  if (height >= 2160) return '4k';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  return '480p';
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
  kugou: async function (musicItem, targetHeight) {
    // ① 条目带 mvHash（32 位 hex）→ 直接取流（对齐 baka：搜索结果 MvHash 透传）
    var mvHash = str(musicItem && musicItem.mvHash);
    if (!mvHash || !/^[0-9a-fA-F]{32}$/.test(mvHash)) {
      // ② 兜底：search/mv 歌名+歌手严格匹配
      var q = musicItem.artist + ' ' + musicItem.title;
      var r1 = await axios.get('http://mobilecdn.kugou.com/api/v3/search/mv', {
        params: { format: 'json', keyword: q, page: 1, pagesize: 8 }, timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
      });
      var d1 = r1.data && r1.data.data;
      var list = (d1 && (d1.info || d1.mvs)) || [];
      var hit = strictMvMatch(list, musicItem.title, musicItem.artist,
        function (x) { return x.filename || x.name; }, function (x) { return x.singername || x.singer; });
      if (!hit || !hit.hash) return null;
      mvHash = String(hit.hash);
    }
    // ③ ext=mp4：五路流（le/sd/hd/sq/rq）
    var r2 = await axios.get('https://m.kugou.com/app/i/mv.php', {
      params: { cmd: 100, ext: 'mp4', hash: mvHash }, timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var d2 = r2.data || {};
    var mvdata = d2.mvdata;
    if (!mvdata || (d2.status !== undefined && parseInt(d2.status, 10) !== 1 && !mvdata.le && !mvdata.sd && !mvdata.hd && !mvdata.sq && !mvdata.rq)) {
      return null;
    }
    var streams = [];
    for (var k in MV_LEVEL_HEIGHT) {
      if (Object.prototype.hasOwnProperty.call(mvdata, k) && mvdata[k] && (mvdata[k].downurl || mvdata[k].url || mvdata[k].urlHead)) {
        streams.push({ level: k, height: MV_LEVEL_HEIGHT[k], info: mvdata[k] });
      }
    }
    if (!streams.length) return null;
    streams.sort(function (a, b) { return a.height - b.height; });
    // 选流：精确命中 → 不超过目标的最大档 → 最低档（宁低勿高）
    var pick = null;
    for (var i = 0; i < streams.length; i++) { if (streams[i].height === targetHeight) { pick = streams[i]; break; } }
    if (!pick) {
      for (var j = streams.length - 1; j >= 0; j--) { if (streams[j].height <= targetHeight) { pick = streams[j]; break; } }
      if (!pick) pick = streams[0];
    }
    var pickInfo = pick.info;
    var url = String(pickInfo.downurl || pickInfo.url || pickInfo.urlHead);
    var durationMs = parseInt(pickInfo.timelength || d2.timelength, 10) || 0;
    var backupValue = pickInfo.backupdownurl || pickInfo.backupDownUrl || pickInfo.backupurl;
    var backupUrls = [];
    if (Array.isArray(backupValue)) {
      for (var b1 = 0; b1 < backupValue.length; b1++) if (backupValue[b1]) backupUrls.push(String(backupValue[b1]));
    } else if (backupValue) {
      backupUrls.push(String(backupValue));
    }
    for (var b2 = 0; b2 < streams.length; b2++) {
      if (streams[b2] === pick) continue;
      var bu = String(streams[b2].info.downurl || streams[b2].info.url || streams[b2].info.urlHead || '');
      if (bu.indexOf('http') === 0 && backupUrls.indexOf(bu) < 0) backupUrls.push(bu);
    }
    var availableVideoQualities = [];
    for (var a = 0; a < streams.length; a++) {
      var hq = mvHostQuality(streams[a].height);
      if (availableVideoQualities.indexOf(hq) < 0) availableVideoQualities.push(hq);
    }
    return {
      url: url,
      headers: { Referer: 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' },
      // [v1.8.0 P1-5] 顶层 userAgent（透传 UA 给宿主独立设置层）
      userAgent: 'Mozilla/5.0 (Linux; Android 10)',
      videoQuality: mvHostQuality(pick.height),
      mimeType: 'video/mp4',
      // [v1.8.0 P1-2] width/height 派生：上游 mp4 stream 不带显式宽高，按 16:9 从 height 派生
      // （宿主 UI 进度条/画布需要宽高比，对齐 MusicFree v1.0.0 IVideoSourceResult 15 字段）
      height: pick.height,
      width: pick.height ? Math.round(pick.height * 16 / 9) : undefined,
      size: parseInt(pickInfo.filesize || pickInfo.fileSize || pickInfo.size, 10) || undefined,
      bitrate: parseInt(pickInfo.bitrate, 10) || undefined,
      duration: durationMs > 0 ? Math.round(durationMs / 1000) : undefined,
      // [v1.8.0 P1-4] codec 透传（无则不挂键，对齐 QQ/网易云宁缺毋假策略）
      codec: pickInfo.codec || pickInfo.codecs || undefined,
      backupUrls: backupUrls.length ? backupUrls : undefined,
      // [v1.8.0 P1-5] availableVideoQualities 升级为结构化列表（含 label/width/height）
      availableVideoQualities: availableVideoQualities.map(function (q) {
        var qh = q === '4k' ? 2160 : parseInt(q, 10) || 0;
        return {
          key: q, label: q === '4k' ? '4K' : q,
          width: qh ? Math.round(qh * 16 / 9) : undefined,
          height: qh || undefined,
          mimeType: 'video/mp4'
        };
      })
    };
  }
};

async function getMvSourceImpl(musicItem, videoQuality) {
  if (!musicItem) return null;
  // [v1.8.0 P0-3] 移除 _src 硬前置——MV_SOURCE.kugou 本身已从 musicItem.mvHash 读顶层字段，
  // _src 硬前置无谓且会拒外链导入/旧缓存/聚合转发条目（仅顶层 mvHash 无 _src.kugou）
  var qKey = videoQuality && typeof videoQuality === 'string' ? videoQuality : (videoQuality && videoQuality.key) || '1080p';
  // 档位 key → 目标高度（4k=2160）；未知档落 1080p（对齐 baka pickKugouMvStream）
  var targetHeight = qKey === '4k' ? 2160 : (parseInt(qKey, 10) || 1080);
  var fallbacks = ['kugou'];
  for (var i = 0; i < fallbacks.length; i++) {
    var fn = MV_SOURCE[fallbacks[i]];
    try {
      var r3 = await fn(musicItem, targetHeight);
      if (r3) {
        // [v1.8.0 P1-1] videoQuality 写回 musicItem.videoQuality
        if (r3.videoQuality && !musicItem.videoQuality) {
          try { musicItem.videoQuality = r3.videoQuality; } catch (e) { /* frozen item */ }
        }
        return r3;
      }
    } catch (e) { /* 取流失败返回 null */ }
  }
  return null;
}

// ---------- 推荐歌单广场（v1.2.0 对齐 baka） ----------
// 宿主协议（src/pages/recommendSheets/components/body/sheetBody.tsx 实读）：
//   pinned: IMusicSheetItemBase[] 扁平数组 → 渲染成横向 TypeTag chips；
//   data: { title, data: [tag] }[] 分组标签。
// v1.1.0 旧实现 pinned 塞了 {title,data:[...]} 嵌套 → 宿主渲染不出横向 pinned，v1.2.0 修正。
// pinned = 官方排序位（推荐/最热/最新/热藏/飙升，getSpecial t=sortId）；
// data = 官方 getSpecial?is_smarty=1 的 tagids 标签组。
var KG_SHEET_PINNED_SORTS = [
  { sortId: 5, title: '推荐' },
  { sortId: 6, title: '最热' },
  { sortId: 7, title: '最新' },
  { sortId: 3, title: '热藏' },
  { sortId: 8, title: '飙升' }
];

var kgSheetTagCache = null; // { ts, result }
var KG_SHEET_TAG_TTL_MS = 30 * 60 * 1000;

async function getRecommendSheetTagsImpl() {
  if (kgSheetTagCache && Date.now() - kgSheetTagCache.ts < KG_SHEET_TAG_TTL_MS) {
    return kgSheetTagCache.result;
  }
  var pinned = [];
  for (var s = 0; s < KG_SHEET_PINNED_SORTS.length; s++) {
    pinned.push({ id: 'kg~sort~' + KG_SHEET_PINNED_SORTS[s].sortId, title: KG_SHEET_PINNED_SORTS[s].title, platform: 'kugou' });
  }
  var groups = [];
  try {
    var res = await axios.get('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial', { // [v1.2.1] https→http：CDN 证书不覆盖该域名（baka 同走 http，实测 200）
      params: { is_smarty: 1 },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var tagids = (res.data && res.data.data && res.data.data.tagids) || {};
    var idx = 0;
    for (var name in tagids) {
      if (!Object.prototype.hasOwnProperty.call(tagids, name)) continue;
      var tags = (tagids[name] && tagids[name].data) || [];
      var children = [];
      for (var j = 0; j < tags.length; j++) {
        if (tags[j] && tags[j].id !== undefined && tags[j].name) {
          children.push({ id: 'kg~cat~' + tags[j].id, title: str(tags[j].name), platform: 'kugou' });
        }
      }
      if (children.length) { groups.push({ title: str(name), data: children }); idx++; }
      if (idx >= 8) break; // 控制标签组数量，防页面过长
    }
  } catch (e) { /* 标签组拉取失败不阻断，pinned 仍可用 */ }
  var result = { pinned: pinned, data: groups };
  kgSheetTagCache = { ts: Date.now(), result: result };
  return result;
}

// 歌单广场条目映射（对齐 baka formatRecommendSheetItem 的字段兜底链）
function mapKugouRecommendSheet(it) {
  var coverRaw = it.img || it.flexible_cover || it.imgurl || it.Avatar;
  return {
    source: 'kugou',
    sid: str(it.specialid || it.rankid || it.albumid || it.id || ''),
    title: str(it.specialname || it.rankname || it.albumname || it.title || ''),
    artist: str(it.nickname || it.username || ''),
    artwork: coverRaw ? String(coverRaw).replace('{size}', '480') : '',
    worksNum: parseInt(it.song_count || it.songcount, 10) ||
      ((it.extra && it.extra.resp && it.extra.resp.all_total) ? parseInt(it.extra.resp.all_total, 10) : 0),
    playCount: parseInt(it.play_count || it.playcount, 10) || 0,
    raw: { listId: str(it.specialid || it.id || '') }
  };
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var p = page || 1;
  var id = (tagItem && tagItem.id) || '';
  // [v1.2.1] 默认标签（宿主歌单广场初始 selectedTag 为 { id: '' }）与未知标签回退推荐位（对齐 baka：空/未知 → t=5）
  if (String(id).indexOf('kg~') !== 0) id = 'kg~sort~5';
  var entries = [];
  var isEnd = true;
  var PG_SIZE = 30;
  if (id.indexOf('kg~sort~') === 0) {
    // [v1.2.0] 官方排序位：getSpecial?is_ajax=1&cdn=cdn&t=sortId&p=page
    var sortId = parseInt(id.slice(8), 10) || 5;
    if (sortId === 5 && p === 1) {
      // 推荐位首页：每日推荐（guess_special_recommend）+ 常规推荐合流（对齐 baka）
      var recPromise = axios({
        url: 'https://everydayrec.service.kugou.com/guess_special_recommend',
        method: 'post',
        timeout: SOURCE_TIMEOUT,
        data: {
          appid: 1001, clienttime: Date.now(), clientver: 8275,
          key: 'f1f93580115bb106680d2375f8032d96',
          mid: '21511157a05844bd085308bc76ef3343', platform: 'pc',
          userid: '262643156', return_min: 6, return_max: 15
        },
        headers: { 'User-Agent': 'KuGou2012-8275-web_browser_event_handler' }
      }).catch(function () { return { data: {} }; });
      var listPromise = axios.get('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial', { // [v1.2.1] https→http：CDN 证书不覆盖该域名（baka 同走 http，实测 200）
        params: { is_ajax: 1, cdn: 'cdn', t: sortId, c: '', p: p, pagesize: PG_SIZE },
        timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
      }).catch(function () { return { data: {} }; });
      var both = await Promise.all([recPromise, listPromise]);
      var recList = (both[0].data && both[0].data.data && both[0].data.data.special_list) || [];
      var normalList = (both[1].data && both[1].data.special_db) || [];
      var recEntries = recList.map(mapKugouRecommendSheet).filter(function (e) { return e.sid && e.title; });
      var normEntries = normalList.map(mapKugouRecommendSheet).filter(function (e) { return e.sid && e.title; });
      entries = recEntries.concat(normEntries);
      isEnd = normEntries.length < PG_SIZE;
    } else {
      var r1 = await axios.get('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial', { // [v1.2.1] https→http：CDN 证书不覆盖该域名（baka 同走 http，实测 200）
        params: { is_ajax: 1, cdn: 'cdn', t: sortId, c: '', p: p, pagesize: PG_SIZE },
        timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
      });
      var list1 = (r1.data && r1.data.special_db) || [];
      entries = list1.map(mapKugouRecommendSheet).filter(function (e) { return e.sid && e.title; });
      isEnd = list1.length < PG_SIZE;
    }
  } else if (id.indexOf('kg~cat~') === 0) {
    // [v1.2.0] 分类标签：getSpecial?is_ajax=1&cdn=cdn&t=6(最热)&c=categoryId
    var catId = id.slice(7);
    var r2 = await axios.get('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial', { // [v1.2.1] https→http：CDN 证书不覆盖该域名（baka 同走 http，实测 200）
      params: { is_ajax: 1, cdn: 'cdn', t: 6, c: catId, p: p, pagesize: PG_SIZE },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://www.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var list2 = (r2.data && r2.data.special_db) || [];
    entries = list2.map(mapKugouRecommendSheet).filter(function (e) { return e.sid && e.title; });
    isEnd = list2.length < PG_SIZE;
  } else if (id.indexOf('kg~hot') === 0) {
    // 旧通道保留（v1.1.0 兼容）：mobilecdn plist/index
    var r3 = await axios.get('http://mobilecdn.kugou.com/api/v3/plist/index', {
      params: { format: 'json', page: p, pagesize: PG_SIZE }, timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }
    });
    var d3 = r3.data && r3.data.data;
    var klist = (d3 && (d3.info || d3.specials || d3.list)) || [];
    entries = klist.map(function (it) {
      return {
        source: 'kugou', sid: str(it.specialid),
        title: str(it.specialname || it.name),
        artist: it.nickname || '',
        artwork: it.imgurl ? kgImgUrl(String(it.imgurl), '480') : (it.img || ''),
        worksNum: it.playcount || 0,
        raw: { listId: str(it.specialid) }
      };
    });
    isEnd = klist.length < PG_SIZE;
  } else {
    return { isEnd: true, data: [] };
  }
  return { isEnd: isEnd, data: entries.filter(function (e) { return e.sid && e.title; }).map(sheetSearchItemFromEntry) };
}

// ---------- 歌曲评论（酷狗：海棠 kgpl.php）----------
// 酷狗  海棠 kgpl.php?songmid={hash}&page={n}（文档 D.7.3；本沙箱复核 200，data.comments[] 每页 20）

// [v1.2.0] 官方评论接口（对齐 baka）：gateway 取 res_id → m.comment.service 排序签名请求
// 签名规则（baka signatureParams）：md5(key + params.split('&').sort().join('') + body + key)
function kugouGatewaySign(paramsStr, body, keyparam) {
  var arr = String(paramsStr).split('&').sort();
  return md5Hex(keyparam + arr.join('') + (body || '') + keyparam);
}

// gateway.kugou.com/v3/album_audio/audio POST → classification[0].res_id（评论 mixsongid）
async function fetchKugouResId(hash) {
  var body = {
    area_code: '1', show_privilege: 1, show_album_info: '1',
    appid: 1005, clientver: 11451, mid: '1', dfid: '-',
    clienttime: Date.now(), key: 'OIlwieks28dk2k092lksi2UIkp',
    fields: 'album_info,author_name,audio_info,ori_audio_name,base,songname,classification',
    data: [{ hash: String(hash).toLowerCase() }]
  };
  var res = await axios.post('https://gateway.kugou.com/v3/album_audio/audio', body, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'KG-THash': '13a3164', 'KG-RC': '1', 'KG-Fake': '0', 'KG-RF': '00869891',
      'User-Agent': 'Android712-AndroidPhone-11451-376-0-FeeCacheUpdate-wifi',
      'x-router': 'kmr.service.kugou.com',
      'Content-Type': 'application/json'
    }
  });
  var d0 = res.data && res.data.data;
  var first = d0 && d0[0] && d0[0][0];
  var resId = first && first.classification && first.classification[0] && first.classification[0].res_id;
  if (!resId) throw new Error('kugou res_id not found');
  return String(resId);
}

async function fetchKugouOfficialComments(hash, page) {
  var resId = await fetchKugouResId(hash);
  var paramsStr = 'appid=1005'
    + '&clienttime=' + Date.now()
    + '&clienttoken=0'
    + '&clientver=11409'
    + '&code=fc4be23b4e972707f36b8a828a93ba8a'
    + '&dfid=0'
    + '&extdata=' + String(hash).toLowerCase()
    + '&kugouid=0'
    + '&mid=16249512204336365674023395779019'
    + '&mixsongid=' + resId
    + '&p=' + (page || 1)
    + '&pagesize=20'
    + '&uuid=0'
    + '&ver=10';
  var sign = kugouGatewaySign(paramsStr, '', 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt');
  var url = 'http://m.comment.service.kugou.com/r/v1/rank/newest?' + paramsStr + '&signature=' + sign; // [v1.2.1] https→http：同酷狗 CDN 证书问题族（http 实测可达）
  var res = await axios.get(url, {
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://m.kugou.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var list = (res.data && res.data.list) || [];
  return {
    newest: list.map(function (c) {
      return {
        commentId: c.id,
        msg: c.content,
        user: { nickname: c.user_name, avatarUrl: c.user_pic, location: c.location },
        likedCount: (c.like && c.like.likenum) || 0,
        time: c.addtime // 数字秒级时间戳或字符串
      };
    }),
    isEnd: list.length < 20
  };
}

async function fetchKugouComments(hash, page) {
  var res = await axios.get('https://music.haitangw.cc/pinglun/kgpl.php', {
    params: { songmid: String(hash).toUpperCase(), page: page },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://music.haitangw.cc/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var list = (res.data && res.data.data && res.data.data.comments) || [];
  return { hot: [], newest: list, isEnd: list.length < 20 };
}

// [P2-4 v1.1.0] 跨页评论去重：海棠 kgpl 相邻页存在重叠评论，页内 seen 换成模块级已见集合。
// key = 歌曲hash|评论id（评论 id 全局唯一，加 hash 前缀防极端复用）；超 2 万条整体重置防内存膨胀。
var kgCommentSeen = {};
var kgCommentSeenCount = 0;
var KG_COMMENT_SEEN_MAX = 20000;
function kgCommentSeenCheck(scope, cid) {
  if (kgCommentSeenCount >= KG_COMMENT_SEEN_MAX) { kgCommentSeen = {}; kgCommentSeenCount = 0; }
  var key = scope + '|' + String(cid);
  if (kgCommentSeen[key]) return false;
  kgCommentSeen[key] = 1;
  kgCommentSeenCount++;
  return true;
}

async function getMusicCommentsImpl(musicItem, page) {
  var p = page || 1;
  var src = (musicItem && musicItem._src) || {};
  var commentScope = (src.kugou && src.kugou.hash) || (musicItem && musicItem.id) || 'kg';

  var tasks = [];
  var sources = [];
  if (src.kugou && src.kugou.hash) {
    sources.push('kugou');
    // [v1.2.0] 官方评论接口优先（baka 对齐），失败回落海棠 kgpl
    tasks.push(fetchKugouOfficialComments(src.kugou.hash, p)
      .catch(function () { return fetchKugouComments(src.kugou.hash, p); })
      .catch(function () { return null; }));
  }
  if (!tasks.length) return { isEnd: true, data: [] };

  var settled = await Promise.all(tasks);
  // [v1.2.0] 官方接口返回空列表时（网关风控/无数据），补试海棠通道
  if (settled[0] && sources[0] === 'kugou' && (!settled[0].newest || !settled[0].newest.length)) {
    try {
      var alt = await fetchKugouComments(src.kugou.hash, p);
      if (alt && alt.newest && alt.newest.length) settled[0] = alt;
    } catch (e) { /* 保留空结果 */ }
  }
  var data = [];
  function push(c, isHot, source) {
    if (!c) return;
    var cid = c.commentId || c.id || c.CmId;
    if (!cid || !kgCommentSeenCheck(commentScope, cid)) return; // [P2-4 v1.1.0] 跨页去重
    var body = c.msg || c.content || c.Content;
    var nick = (c.user && (c.user.nickname || c.user.nick)) || c.Nick || c.userName || c.u_name;
    var avatar = (c.user && (c.user.avatarUrl || c.user.avatar)) || c.Avatar || c.avatar || c.u_pic;
    var like = c.likedCount || c.PraiseNum || c.likedCount || c.like_num || c.praiseNum || 0;
    var time = c.time || c.PubTime;
    var loc = (c.user && c.user.location) || c.Location || c.location;
    var createAt;
    if (typeof time === 'number') createAt = formatTs(time * (time > 1e12 ? 1 : 1000));
    else if (typeof time === 'string' && time) createAt = time; // 酷狗 kgpl 直出 "YYYY-MM-DD HH:mm:SS"
    data.push({
      id: source + '_' + String(cid).slice(0, 64),
      nickName: nick ? String(nick) : '未知用户',
      avatar: avatar ? String(avatar) : undefined,
      comment: body ? String(body) : '',
      like: like || 0,
      createAt: createAt,
      location: loc ? String(loc) : undefined,
      isHot: isHot
    });
  }
  var anyData = false;
  var hasMore = false;
  for (var s = 0; s < settled.length; s++) {
    var r = settled[s];
    if (!r) continue;
    anyData = true;
    if (sources[s] === 'kugou' && r.isEnd === false) hasMore = true;
    var hot = r.hot || [], newest = r.newest || [];
    for (var i = 0; i < hot.length; i++) push(hot[i], true, sources[s]);
    for (var j = 0; j < newest.length; j++) push(newest[j], false, sources[s]);
  }
  if (!anyData) return { isEnd: true, data: [] };
  return { isEnd: !hasMore, data: data };
}
