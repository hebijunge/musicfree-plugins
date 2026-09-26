/**
 * QQ音乐独立源插件（MusicFree）
 * ================================
 * v1.9.13 (2026-09-21, 基于 v1.9.12)：
 *   - 【P1 修复】a.aa.cab/qq.music 通道虚标守门加固（方案 A·拒绝虚标）。2026-09-21 每日检查实测：
 *     该端点对未知/字符串音质码（type=128/320/flac/master 等 12 种）一律回落 C400 HQ m4a（3.28MB AAC，
 *     tips=「HQ 高品质」）——旧守门「未知 tips 跳过校验」正中该虚标向量；atmos/atmos_51/jymaster/dolby
 *     等增强档旧映射静默落入 128k 档。修复三件套：
 *     ① 音质准入白名单（方案 A）：仅放行 ≤320k 已知档（standard/128k/hq/mp3/aac/192k/higher/320k/exhigh），
 *        flac/flac24bit/lossless/hires/master/atmos/atmos_51/jymaster/dolby/super 及未知档一律直接拒绝
 *        （不参与竞速，由 kuwo:official / s01s-mid 等既有通道接力，基线实测 flac=F000 55.4MB 真 FLAC）；
 *     ② tips fail-closed：tips 非空但不在档位秩表（如「HQ 高品质」）→ 直接拒绝，不再跳过守门；
 *     ③ URL 路径前缀实档识别：music URL 文件名前缀必须在 {M500,C400,M800} 有损白名单内，
 *        且前缀档位秩 ≥ 请求档位（320k 请求仅接受 M800；F000/A000/R000/AI00 等无损/母带前缀拒绝），
 *        actualQuality 以前缀识别结果为权威标注。
 *     实测佐证（2026-09-21 探针）：数值码 0/1/4/5 仍返回真档（M500 4.3MB mp3 / M800 10.8MB mp3 /
 *     F000 55.4MB FLAC / AI00 187MB 母带 FLAC），≤320k 放行档真链可用；v1.9.12 验收记录的
 *     flac=55397039B 与本次探针逐字节一致，确认虚标仅发生于未知音质码路径。
 * v1.9.12 (2026-09-20, 基于 v1.9.11)：
 *   - 接入 a.aa.cab/qq.music 新端点（搜索型取链），替换 v1.9.4 已禁用的旧 HelloWorld 通道
 *   - 4 档全真（128k/320k/flac/master），VIP 歌曲可播，响应 <1s
 *   - 实测数据：3 歌 × 4 档共 12 次取链全部通过
 * v1.9.11（2026-09-12 星澜 stellarwave v4.0.0 tx 通道核查版（无代码增量，版本号统一升），基线 v1.9.10）：
 *  - 任务「星澜可用通道接入」QQ 侧结论：**无可接入的新通道，零代码改动**。
 *    星澜 43 个后端池中 QQ（tx）相关后端于 2026-09-12 逐个真网复测（3 歌 × 3 档：
 *    晴天 0039MnYb0qxYhV / 孤勇者 003UkWuI0E8U0l / 告白气球 003OUlho2HcRHC，
 *    沙箱探针 artifacts/probe-results.json + probe2-results.json），全部失效：
 *    ① 星海主后端 yy.zddyr.top：403「QQ 音乐仅对认证用户开放」（报告实测后新增认证墙，
 *       请求构造与星澜源码逐字节一致、无隐藏参数）；
 *    ② 317ak：403 Forbidden；
 *    ③ ygking（api.ygking.cn/api/song/url）：Invalid URL（服务端已改路径/下线）；
 *    ④ 念心直链（music.nxinxz.com/kgqq/tx.php）：404；
 *    ⑤ FishAPI/gdstudio 签名版（music.gdstudio.xyz）：响应空体 ~10s；
 *    ⑥ FFAPI（ffapi.cn）：官方声明「接口已经关闭！…已关闭对外使用」；
 *    ⑦ QQ越权（星澜硬编码 qm_keyst=1984LZXvCR / uin=1234567890）：code=0 无 purl，密钥失效；
 *    ⑧ HYWmusic（103.79.84.97，MOLAN-BAIJI 卡）：响应空体；
 *    ⑨ HelloWorld（a.aa.cab）：v1.9.4 已确认死亡；
 *    ⑩ QQ官方接口 / vkeys：与本插件既有官方通道（CgiGetVkey 匿名/kuwo 竞速）与
 *       qq:vkeys-legacy 同源同端点，无增量不重复接入。
 *  - 按接入原则 1「只接入实测确认真实可用的通道」，本轮 QQ 侧不接入任何通道；
 *    竞速池保持 v1.9.10 现状（官方 + kuwo 竞速 + 海棠 + 长青 + s01s + vkeys-legacy），
 *    取链成功率与音质校验行为零变化，满足「成功率不下降、零回归」验收。
 *  - 酷我/酷狗/咪咕/汽水对应星澜通道（kw 盲拼假成功 / kg 六档同 128k 虚标 / mg 全灭）
 *    同样不接入，各插件仅随包升版 v1.9.11。
 *
 * v1.9.5（2026-09-11 全页面音质标识核查 + VIP 标识移除版，基线 v1.9.4）：
 *  - 榜单聚合条目补 qualities 音质表透传（此前榜单页音质标识全部缺失）；
 *  - 全接口停写 fee（VIP 角标）字段，getMusicInfo 不再回填；VIP 语义改存
 *    _src.qq.vip 内部字段仅供取链 vipPreRoute 预判，宿主不渲染；
 *  - 旧缓存条目（带 fee）向下兼容。
 * v1.9.4（2026-09-11 第三方取链修复 + size 字段版，基线 v1.9.2）：
 *  - 任务一：getMediaSource 返回值加 size 字段（单位：字节），供宿主下载前预估大小与播放前音质校验。
 *    size 取值优先级：取链响应直带 size（s01s-mid 7 档 *song_size_X_str*、长青 *size* 字符串）>
 *    HEAD 探测 Content-Length/Content-Range（海棠第三方、走 verifyQualitySize 校验的同时复用 total）>
 *    留空。v1.9.2 各通道 verifyQualitySize 已返 total（v1.7.0 接入），未回填到最终结果是历史疏漏，
 *    本轮统一回填；getMediaSource 边界补 attachSizeIfMissing 兜底（无 size 时 Range 0-0 HEAD 探测）。
 *  - 任务二：第三方取链通道实测修复。
 *    - 5 路实况（2026-09-11 探针）：
 *       ① Hello World（a.aa.cab）：任意路径返回「云汐 API」HTML 主页，接口端点已下线/改版 → 失效。
 *       ② 长青（175.27.166.236/kgqq1/qq.php）：接口通，但无论 q 参数为何，URL 恒返回同一 4.12MB
 *          M500000bYDlc2XxKLs.mp3，响应的 *quality* 字段恒为「低音质 MP3」。本轮修复：响应体内
 *          解析 *quality* 字段，标注非「低音质 MP3」时（实际是上游误标）拒绝接力；只对 standard
 *          (128k) 请求放行，且 size 字段直读 *size*（4.12MB）；其它档位请求统一 reject 走旁路。
 *       ③ 念心（mcp.nianxinxz.com/ceshi）：404 站点下线 → 失效。
 *       ④ s01s-mid（tang.api.s01s.cn）：接口通，晴/夜车/孤勇者等实测：sq 档真 FLAC ~1647kbps、
 *          pq 档真 24bit FLAC ~926kbps、accom 档真 Atmos OGG、hq/standard/fq 档完整。v1.9.2
 *          FIELD_ORDER 漏 *song_play_url_pq*（24bit FLAC 通道）和 *song_play_url_accom*（Atmos
 *          OGG 通道），导致 master/hires 档落到 sq 16bit 而非真 24bit。本轮：FIELD_ORDER 补 pq
 *          至 master/hires 首位、accom 至 master 次位；新增 song_size_X_str 直读回 size。
 *       ⑤ 海棠（musicserver.haitangw.cc）：晴/夜车 201 成功 FLAC，3/5 其他 mid 503 UPSTREAM
 *          RESOLVE_FAILED，本轮未变（竞速链容错）。resolveHaitang 补 Range 0-0 HEAD 探测
 *          Content-Range 写回 size（verifier 已验真过音频格式，无需再开魔数探测）。
 *    - 处置：失效两通道（Hello World / 念心）保留函数体，注释为失效，标注 2026-09-11 失效日期，
 *      从竞速池移除——保留源码便于未来该端点恢复时复活（仅解注释+恢复 race pool 一行）。
 *    - 网络搜索新第三方 QQ 取链接口（cenguigui.cn 等 8 个候选）均为 404/接口关闭/要求付费，
 *      无新通道可接入。
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
 *  - P0 次合代 QQ 通道（resolveQqS01sMid）：s01s mid 直查形态
 *    GET tang.api.s01s.cn/music_open_api.php?mid={songmid}（免搜索、按 mid 精确命中），
 *    一次返回 sq/hq/standard/fq 四档直链，按请求档位字段序取用（BakaMusic/次合代原样）：
 *    master/flac24bit→sq、flac/exhigh→sq、320k/higher→hq、128k/standard→standard；
 *    与既有 resolveQqS01s（搜索式，站点 2026-09-06 起返回宝塔默认页）不同形态——
 *    mid 直查不走搜索匹配，站点恢复后两条路独立生效。
 *  - 音质档映射（宁低勿高）：sq→flac / hq→320k / standard→320k / fq→128k /
 *    song_play_url（通用兜底字段，实际档未知）→128k；所有返回 URL 过 verifyQualitySize
 *    魔数+大小校验，校验不过静默让路竞速下一通道。
 *  - 竞速接线：第三方竞速 6→7 路（官方串行链 + 酷我 + 海棠 + Hello World + 长青 + 念心 +
 *    s01s-mid），s01s-mid 通道可经 userVariables.qqS01sMid 设 off 关闭（默认开）。
 *  - 复核结论（不接入项）：ikun QQ 通道无卡密返回 10 秒占位 mp3（假成功链，任务明确不接）；
 *    次合代/长青/全豆要的酷狗端点 haitangw.cc 实测 code 201 已挂（2026-09-10）。
 *
 * v1.8.4 变更（2026-09-10，歌单导入元数据版，基于 v1.8.3）：
 *  - P0 导入返回结构：importMusicSheet 由「歌曲数组」改为「完整 IMusicSheetItem 歌单对象」
 *    （id/platform/isImported/title/artwork/worksNum/musicList[/description]）。
 *    此前返回数组走宿主旧插件兼容分支，歌单标题落到 fallback「来自qq的歌单」。
 *  - P0 歌单标题/介绍：CgiGetDiss 响应 dirinfo 自带 title/picurl/desc（探针 2026-09-10：
 *    dissid 7581343266 → dirinfo.title「情窦初开 | 想要甜甜的恋爱」+ desc 简介全文），
 *    首页顺带回传零额外请求；meta 拉取失败兜底「QQ歌单 #<disstid>」。
 *  - P0 字段名对齐：歌单介绍字段名确认沿用宿主 v1.0.0 IMusic.IMusicSheetItemBase 的
 *    description（经 normalizeImportedMusicSheet 透传）；无简介时不传该字段。
 * v1.8.3 变更（2026-09-10，质检遗留优化版，基于 v1.8.2，对应交叉质检报告问题清单）：
 *  - 本插件 Q-02/Q-03 复核确认已符合统一口径（sheetImportError 已带 [qq] 前缀、
 *    兜底分支 code 已为 SHEET_URL_UNRECOGNIZED），无代码改动，随包升版 v1.8.3。
 *
 * v1.8.2 变更（2026-09-10，歌单解析修复版，对照 6 平台歌单解析实测报告）：
 *  - 歌单链接格式扩展：SHEET_URL_RESOLVERS.qq 补 /playlistDetail/<id> 路径形态
 *    （既有 /playlist/<id>、?disstid=、?id= 保持不变）。
 *  - P2-4 错误文案统一：新增 sheetImportError helper，歌单链接解析/拉取/空歌单错误
 *    携带结构化 code（SHEET_URL_EMPTY/SHEET_URL_UNRECOGNIZED/SHEET_FETCH_FAILED/SHEET_EMPTY）。
 *  - P2-1 复核：buildSheetItem 输出已带 platform（'qq'），无需改动。
 * ================================
 * v1.7.0 变更（2026-09-10，第三方竞速通道接入）：
 *  - P0 第三方取链通道竞速：resolveQq 入口即同时发起 4 路并发竞速——
 *    ①QQ 自身串行链（官方 7 前缀批量 + GetEVkey 加密档 + UrlGetVkey 小米 + vkeys旧版 + vkeys/v2 +
 *      听会代理 + s01s + 海棠 + bugpk + cyapi[仅high档] + 酷我官方 + 咪咕官方兜底，保持 v1.6.1 不变）
 *    ②Hello World（a.aa.cab，tx 平台 5/5 稳定）——主力第三方
 *    ③长青（175.27.166.236/kgqq1/qq.php，裸 IP 5/5 稳定）——备份第三方
 *    ④念心（mcp.nianxinxz.com/ceshi，3/5 末位）——兜底第三方
 *    kuwoRaceSuccess 首个有效结果胜出；慢路不 cancel，在途结果丢弃。
 *  - 通道 1 主力 Hello World URL：https://a.aa.cab/?type=tx&id={songmid}&quality={quality}（GET，无签名）
 *    音质映射：standard→128k, higher→320k, exhigh→flac, lossless→master
 *  - 通道 2 备份 长青 URL：http://175.27.166.236/kgqq1/qq.php?ID={songmid}&q={quality}（GET，裸 IP）
 *    音质映射：standard→128k, higher→320k, exhigh→flac, lossless→flac24bit
 *  - 通道 3 兜底 念心 URL：https://mcp.nianxinxz.com/ceshi/?type=tx&id={songmid}&quality={quality}（GET）
 *    音质映射：standard→128k, higher→320k, exhigh→flac（无 lossless）
 *  - P0 音质大小校验：第三方通道返回 URL 后做 Range 探测（0-4095 字节）+ Content-Range total +
 *    魔数校验（fLaC/ID3/MPEG sync），与请求音质不匹配或非音频流视为失败，竞速继续。
 *  - P0 失败语义统一：HTTP 非 200/201/2xx、空响应、Content-Length 为 0、大小不匹配、非音频魔数
 *    均算失败，由 kuwoRaceSuccess 语义自然接力下一通道（与官方链段失败语义一致）。
 *  - P1 hostQuality 透传：getMediaSource → resolveWithFallback → resolveQq 链路把宿主原始
 *    quality 键（standard/higher/exhigh/lossless/hires/master/flac24bit...）传至第三方通道
 *    用于音质映射选择，内部三档（standard/high/super）保留用于官方链。
 *  - 优先级：官方 > Hello World > 长青 > 念心（与聚合插件的竞速模式一致；本插件中"官方"指
 *    QQ 自身串行链整体，作为单路与其他三路第三方平级竞速）。
 *  - 风险：全部第三方均为社区免费服务（与评估报告 §四 一致），寿命不可承诺；本轮实测 a.aa.cab
 *    已降级为静态 HTML（端点不可用），mcp.nianxinxz.com 已 404（端点已下线），仅 175.27.166.236
 *    仍稳定工作；本实现按任务规格完整接入 4 路、含 URL/参数/音质映射如实对齐，实测时如实记录
 *    端点状态并由竞速语义自然降级。
 *  - 兼容：v1.6.1 全功能（搜索/歌词/取链/QRC逐字/榜单/歌单/歌手/专辑/MV/评论/相似/热搜/罗马音/fee/
 *    primaryKey）保持不变；版本 v1.6.1 → v1.7.0；node --check 通过；全部改动 edit 模式精确替换。
 * v1.8.0 变更（2026-09-10，MV 参数对齐基线，对照 MusicFree v1.0.0 宿主协议）：
 *  - P0 getMvSourceImpl 顶层字段兜底：v1.7.0 入口硬前置 `if (!musicItem || !musicItem._src)` 会把
 *    仅有顶层 videoId/mv/mvId/mvVid 而无 _src.qq 的条目（外链导入/旧缓存）直接判无 MV——本轮移除
 *    硬前置，新增顶层字段 fallback：musicItem.videoId || musicItem.mvId || musicItem.mv ||
 *    musicItem.mvVid 命中即把 vid 写入 src.qq.vid 再走 MV_SOURCE.qq；与酷我/咪咕/网易云 v1.8.0
 *    行为对齐；
 *  - P1 顶层 result 补字段：① codec（从 picked.stream.codec/codecs 透传，QQ 实测 ft40 1080p
 *    有值）；② duration（从 musicItem.duration 透传，源条目无 MV duration 上游）；③ videoQuality
 *    写回 musicItem.videoQuality（宿主 UI 切档后回显）；
 *  - 兼容：v1.7.0 全功能（4 路竞速、7 前缀批量、QRC 逐字、罗马音、MV 360p~4k 档位、罗马音/fee/
 *    primaryKey）保持不变；版本 v1.7.1 → v1.8.0；node --check 通过；全部改动 edit 模式精确替换。
 * v1.6.1 变更（2026-09-08，HotDownloader 调研借鉴优化）：
 *  - P0 QRC 逐字歌词方案对拍（不迁移结论）：将 HotDownloader Rust qrc.rs 逐位 DES 1:1 移植为 JS
 *    与本插件 SP 表优化版对拍真实密文（晴天 hexLen 9808）——解密结果逐字符一致（equal=true，
 *    双方均得 8661 字符 QRC XML，63 行/602 词毫秒级时间戳）；性能整链（hex→文本）实测本插件
 *    2.2ms/次 vs HD 逐位版 4.8ms/次（JS 中逐位函数调用开销大，SP 表查表快 2.2 倍）。两方案
 *    是同一 3DES 变体的两种实现，HD 版无「能解我们不能解」的增量，维持现有实现不迁移。
 *  - P0 GetVkey 形态对比落码（借鉴 HD download.rs）：①登录态注入——HD 把 uin/qq/authst 放
 *    comm 体（而非仅 Cookie 头）+ param.uin/loginflag:1/platform:'20'，探针实测该形态匿名
 *    与我方结果一致但响应额外携带 sip CDN 列表（我方形态 sip=[]）；落码为 qqLoginState()
 *    （userVariables.qqAuthst/qqUin 优先，其次解析 Cookie qm_keyst/uin），有登录态时官方
 *    CgiGetVkey 与 GetEVkey 两通道按 HD 形态注入 comm 体，匿名行为与 v1.6.0 完全一致。
 *    ②sip 动态前缀——两通道 purl 前缀不再硬编码 wx.music.tc.qq.com，优先取响应 d.sip[0]
 *    （过 isAllowedMediaUrl 校验），落回默认 wx 前缀（对齐 resolveQqUrlGetVkey 既有做法）。
 *  - P1 音质档位核实（不加档结论）：HD 13 档 filename 规则逐档核实——C200/C400/C600(.m4a
 *    AAC 96k/192k/320k)/O4M0/O6M0(.mgg ogg) 均为我方已声明档位的同内容封装（宿主按码率归一，
 *    无独立增量）；A000(.ape) 匿名实测 101404；RSM1(.mflac hires) 匿名连 ekey 都不签发；
 *    AIM0(母带)/Q0M0/Q0M1(全景声) 匿名实测 ekey 可签发（704B）但 purl 被 104003 拦截——
 *    全链（登录态签发 purl）无法在无凭据环境验证，按「不能验证的不瞎加」原则维持
 *    supportedQualities 不变；登录态通道已就绪（填 qqAuthst 后 AI00 批量前缀即可覆盖母带）。
 *  - P1 登录态方案（HD login.rs 调研落码）：HD 的 QR 扫码+MQTT+refresh_token 自动刷新
 *    依赖应用层长驻进程，MusicFree 插件沙箱不可行；落地方案为用户手动填凭据——新增
 *    userVariables.qqAuthst（填 qm_keyst/musickey，即 HD 的 authst）与 qqUin（数字 uin），
 *    也可只填既有 qqCookie（自动解析 qm_keyst 与 uin）。refresh_token 仅存在于 QR 登录
 *    响应 JSON 不在 Cookie，手动填 Cookie 场景拿不到，凭据过期需用户重新填写（如实告知）。
 *  - P2 接口借鉴结论（不迁移）：HD search.rs 用 DoSearchForQQMusicMobile 全设备串 comm，
 *    探针实测该形态 item_song 恒空（我方 music.adaptor.SearchAdaptor do_search_v2 已验证
 *    可用且字段更全）；HD 无评论模块，歌单/热键（suggest.rs HotkeyService）走同一 musicu
 *    网关无增量接口。无接口值得迁移。
 *  - 版本 v1.6.0 → v1.6.1；node --check 通过；全部改动 edit 模式精确替换。
 * v1.6.0 变更（2026-09-08，go-music-dl 调研对齐，P0 + P1）：
 *  - P0 GetVkey 单请求 7 前缀批量查询：resolveQqPlainOfficial 由「单 filename 前缀」改为
 *    单请求同时下发 AI00/Q001/Q000/F000/O801/M800/M500 七个 filename（前缀+mediaMid+扩展名，
 *    comm cv=4747474，对齐 go-music-dl GetVkey 实现），响应 data.midurlinfo 按 filename 匹配，
 *    一次 RTT 探明全部 7 档可用性（原实现每档一次请求，取链延迟近似减半）。
 *  - P0 补齐缺失的 5 个前缀：AI00（Master 母带）/Q001、Q000（Hi-Res/臻音）/F000（flac）/
 *    O801（atmos 全景声）——super 档官方明文通道按 AI00>Q001>Q000>F000>O801 选序，有 Cookie
 *    的真机/家宽环境可直取母带/Hi-Res（原实现 super 档官方明文直接跳过）；匿名环境下高端
 *    purl 为空自动落 M800/M500 之外的既有接力链，行为无损。actualQuality 如实标注
 *    （无损族→flac / M800→320k / M500→128k），不跨档降级（降级仍交由链内后续通道）。
 *  - P0 顺带接入 X-Forwarded-For 随机国内 IP 头（go 的 WithRandomIPHeader 同思路）：
 *    2026-09-08 探针实测官方 GetVkey purl 签发与出口 IP 强相关——数据中心 IP 匿名 purl 全空，
 *    带随机国内 IP 头曾命中 M500 purl（机会主义优化，零成本，失败照常接力）。
 *  - P1 QRC 逐字歌词核验：v0.8.0 起已实现（music.musichallSong.PlayLyricInfo crypt:1 → hex
 *    密文 → 3 密钥 3DES 变体解密（非标准 S-box/密钥编排，标准加密库不可替代）→ inflate →
 *    QRC XML → rawLrc），本轮 3 首歌实测回归确认格式与逐字标签数量，无需改码。
 *  - P1 soso 搜索 Referer 常量化 + 兜底：新增 QQ_SOSO_REFERER 常量与 searchQqSoso 兜底——
 *    do_search_v2 报错或零结果时回落 c.y.qq.com/soso/fcgi-bin/search_for_qq_cp；实测对照
 *    Referer 必须带 https://y.qq.com/portal/search.html（缺失时 code=0 但恒空结果）。
 *  - P1 免费/VIP 预判：qqFeeOf 扩展 soso 字段名（payplay/paymonth/paydownload，与既有
 *    pay_play/pay_month/pay_down 双口径兼容）；resolveQq 对「无 Cookie 的 VIP 歌」跳过官方
 *    CgiGetVkey/GetEVkey 两段（探针实测 VIP 匿名批量 7 前缀 purl 必空），省 2 个注定失败的
 *    RTT 直达小米通道与第三方链；有 Cookie 用户维持全链不变。
 *  - 版本 v1.5.0 → v1.6.0；node --check 通过；全部改动 edit 模式精确替换。
 * v1.5.0 变更（2026-09-08，字段补齐——对齐宿主 MusicFree 字段需求清单 P1/P2）：
 *  - P1 fee（VIP 标记）：五处条目构建点（搜索/歌词搜索/榜单/歌单/单曲详情）全部携带
 *    fee，getMusicInfo 详情回填。映射依据为 2026-09-08 真实请求实测：QQ 各歌曲接口
 *    （do_search_v2 / fcg_play_single_song / CgiGetDiss / Toplist GetDetail）返回 pay
 *    对象（VIP 歌 pay_play/pay_month/pay_down=1，免费歌为 {} 或 0 位），任一付费位=1
 *    即 fee=1，否则 fee=0（宿主 fee===1 显示 VIP 角标，isVip 判断无需宿主改动）。
 *    注意：接口文档"关键字段"节未列 pay、登录节 vip_type 是用户 VIP 类型字段，
 *    均非歌曲付费标识，已以实测为准不采信文档口径。
 *  - P2 primaryKey：①插件定义声明 primaryKey: ['id']（对齐网易云/咪咕的宿主
 *    pluginManager 存档约定）；②音乐条目（buildMusicItem/buildSheetItem/搜索/详情）
 *    携带 item.primaryKey = songmid（歌曲唯一标识，任务口径的"宿主去重/缓存键"，
 *    稳定身份仍以 item.id = source_sid 为准，primaryKey 是补充可读标识）。
 *  - P2 罗马音歌词：新增 fetchQqRomaLrc——GetPlayLyricInfo roma=1（文档 4.2 节全参数，
 *    2026-09-08 实测✅）→ d.roma 与 d.lyric 同为 crypt:1 加密 hex → 复用 qrcDecryptHex
 *    （3 密钥 3DES + inflate）解密 → QRC XML 逐字罗马音 → 转标准 LRC（[mm:ss.xxx] 行 +
 *    拼合词内时序，无词间奏行跳过）→ getLyric 返回 romanization（宿主 lyric.d.ts 字段名）
 *    与 romaLrc（任务口径别名）双字段同值。与主歌词（H5 接口）并行请求，失败静默降级。
 *    中文歌 roma 字段为空（实测晴天），自然不返回罗马音字段。
 *  - P2 alias：如实不补——搜索/详情/歌单/榜单接口均无别名字段（实测 do_search_v2 与
 *    fcg_play_single_song 无 alias 键；subtitle 为"影视片尾曲"类副标题且绝大多数为空，
 *    映射进 alias 会以错误关键词污染歌词搜索，宁缺毋假）。
 *  - 版本 v1.4.0 → v1.5.0；node --check 通过；全部改动 edit 模式精确替换。
 * v1.4.0 变更（2026-09-08，取链并行竞速改造）：
 *  - 酷我兜底从「串行链尾」提前为「并行竞速」：resolveQq 入口即同时发起三路——
 *    QQ 自身串行链（官方/第三方全段）+ 酷我官方通道 resolveKuwoFallback + 海棠第三方
 *    通道 resolveHaitang，kuwoRaceSuccess 首个有效结果（音质匹配、非试听、非降级，
 *    各通道内部校验不变）直接胜出；慢路不 cancel、在途结果丢弃，不影响后续降级备用。
 *    预期收益：高音质档酷我命中时端到端 ~2s → ~0.3s（酷我搜索+取链 0.2~0.4s）。
 *  - 共享 Promise 防重发：三路均为入口创建的共享 Promise——QQ 链内海棠对冲段
 *    （v1.3.5 hedgeHaitang）与链尾酷我兜底段（v1.3.6）改为等待同一在途结果，
 *    竞速与降级链不重复发起请求；三路全败时 QQ 链尾仍按原降级逻辑接咪咕兜底，
 *    试听检测（guardFullAudio）、音质校验、负缓存、8s 全局预算全部不变。
 *  - 音质档位映射不变：宿主键（standard/128k/192k/320k/hq/sq/zq/flac/flac24bit/
 *    hires/master...）经 normalizeQuality 收敛为 internal 三档 standard/high/super，
 *    对应酷我 128kmp3/320kmp3/2000kflac（KUWO_BR），flac24bit→super 真无损档。
 *  - 代价说明：海棠由「慢路径才发起」改为每次取链必发一次（与酷我同价），VIP 快路径
 *    不再零额外请求；实测换取消除慢路径 1.5~2s 串行等待，净收益为正。
 *  - 同曲严格校验（2026-09-08 追加约束：同曲校验不通过的结果，再快也不能用）：酷我通道
 *    搜到候选后、取链之前，先按四项规则做同曲匹配——①核心歌名一致（剥空格/标点/大小写）；
 *    ②版本标签先拆分后精确比对（从歌名末尾往前提取标签，数量与类型一一对应：原曲 Live
 *    酷我也必须 Live，原曲原版酷我也必须原版，不能多也不能少）；③歌手规范化（剥 feat./
 *    &/、/,/与/和 等分隔符）逐个比对，至少一个主要歌手匹配；④双方均有时长时差距 ≤10%。
 *    校验不通过的候选即使排最前/最快也直接跳过；全部候选不通过则酷我通道整体退出竞速
 *    （抛错带首个候选的拒绝原因，由竞速语义自然接力其他通道，不影响降级链）。
 *  - 顺带修复（自测发现的存量缺陷，非竞速引入）：酷我接口实测会返回 http 直链
 *    （car-er/kw-er.kuwo.cn），而本插件 http 白名单自 v1.1.0 fix#5 起不含 .kuwo.cn，
 *    http 直链在白名单校验被拒→酷我兜底段整段无效（v1.3.6 接入以来酷我兜底命中率
 *    被此问题低估）。resolveKuwoFallback 出口统一升级 https（探针实证 206 全长可达），
 *    不放开 http 白名单、不改安全姿态。
 * v1.3.8 变更（2026-09-08，审查建议级清理）：
 *  - 删除已退出接力链的 96k 降级死代码：resolveQqHyw / resolveQqXcvts / resolveQqYunx
 *    三函数及其 HYW_KEY / XCVTS_KEY / XCVTS_KEY_BACKUP / YUNX_KEY 常量与 _internal 导出
 *    （v1.3.6 起三者已不在任何取链路径，仅 _internal 暴露，删除以防误用）；
 *  - platform 值风格统一：'QQ音乐' → 'qq'（与其余 5 个单源插件 ascii 小写口径一致）。
 * v1.3.7 变更（2026-09-08）：
 *  - 链尾二级全音质兜底：酷我官方接口之后追加咪咕官方取链 resolveMiguFallback（用户指定
 *    h5/v2.4 通道为主：magic AB CD 01 偏移字节解密 H5V24_KEY，code 000000；listen-url
 *    v2.1 明文 / listen-song v2.3 302 两路竞速备份）。曲名+歌手搜索 search_all.do 映射
 *    contentId/copyrightId，PQ 直链按档位派生（high=MP3_320 替换、super=下载目录+flac
 *    替换并 Range 探测 206 验真，探测失败如实回落 320k 并标注 actualQuality）
 * v1.3.6 变更（2026-09-08）：
 *  - 链尾兜底换血：QQ 链内 96k 降级兜底段全部摘除（HYW / xcvts / 玉宁熙；cyapi 仅保留
 *    high 档 M800 320k 非降级路径，standard 档其固定 96k 一并摘除），改接酷我官方接口
 *    全音质兜底 resolveKuwoFallback——曲名+歌手搜索酷我映射 rid 后按档位竞速官方通道：
 *    standard 128kmp3 / high 320kmp3（convert_url_with_sign 三通道，ogg 降级拒收）/
 *    super 2000kflac（mobi.s DES-ECB std+car 双渠道 + convert_url_with_sign×3，
 *    试听片段 duration<60s 拒收）。实现移植自 kuwo-source.plugin v1.4.3（DES 核心
 *    与 Python 参考实现对拍一致；VIP rid=228908 晴天未登录 2000kflac 明文实测验真）
 * v1.3.5 变更（2026-09-08）：
 *  - 长尾治理：全局 8s 预算经 chainSegTimeout 下传 QQ 适配器内部接力链——此前顶层源
 *    之间的预算检查管不到内部段，海棠/bugpk/听会同病时各段自有时限叠加出 12.7s 离群
 *    （实测）；现在内部段超时 = min(自有时限, 全局剩余)，最坏封顶 8s
 *  - 听会重试预算 5s→3s：实测 502 为 ~5s 慢失败，2s/1.5s/1s 尝试超时在收到 502 响应前
 *    已到点，重试在慢失败模式下救不回；降位后本段仅链尾消费，3s 足够吸收快速失败
 *  - 慢档海棠对冲：vkeys旧版（standard/high）/UrlGetVkey（super）失败即确认慢路径，
 *    提前并行发起海棠与 vkeys/v2、s01s 重叠，先到先用；VIP 快路径零额外请求，
 *    每首歌最多 1 次海棠请求不重发
 * v1.3.4 变更（2026-09-08）：
 *  - 听会段降位：从 vkeys/v2 之后挪到 bugpk 之后。实测（2026-09-08）听会健康时延迟
 *    1.5~5s、故障时烧满 5s 重试预算，置中段会把普通歌 standard 端到端拖到 7~9s；
 *    降位后普通歌 standard 走海棠 ~0.9s 命中（预期 ~1.5s），听会转为真备源（其
 *    v1.3.2 重试+退避逻辑不变，仅在前面全失败时才消费预算）。super 链本不含听会，不变
 * v1.3.3 变更（2026-09-08）：
 *  - cyapi 聚合通道接入（用户补 key 后实测）：standard→默认档 C400 AAC 96k（3283546B）；
 *    high→quality 参数档 M800 MP3 320k（10792943B，与 qualities.size 精确一致，相对 HYW
 *    仅 96k 为真升级）；无真 FLAC（quality=flac 亦返回 M800，不入 super 链伪装无损）
 *  - xcvts / 玉宁熙 链尾备份接入（key 用户提供，实测两接口任意音质档均返回同一 C400 96k，
 *    与 HYW 同源冗余；key 独立，作为 HYW 之后的全链最末备份段）
 * v1.3.2 变更（2026-09-08）：
 *  - 听会通道瞬时 502 加固（重试 + 指数退避）：最多 3 次尝试，仅对 502/503/504 及
 *    无响应网络错误重试（4xx/业务失败不重试，原样交回接力）；退避 300ms→600ms；
 *    单次超时递减 2000/1500/1000ms；段内总预算 5s 硬封顶——实测该服务 1.5~5s 波动、
 *    偶发 502，间隔数百 ms 重试即可成功，封顶保证不挤掉后段（海棠/bugpk）接力窗口
 * v1.3.1 变更（2026-09-08）：
 *  - 取链接力链扩充（结合用户提供的《QQ音乐接口完整文档_实测整合版》3.4.1/附录F/H，
 *    2026-09-08 全部真实请求实测，测试对象晴天 mid=0039MnYb0qxYhV，Range 验真文件全长）：
 *    ① 新增 vkeys旧版通道（落月API api.vkeys.cn/music/tencent/song/link，q=6/8）：
 *       VIP 歌实测返回全长 M500(4317292)/M800(10792943)——优于 /v2 端点（对 VIP 歌只给
 *       RS02 试听 960887 字节被拒收）；插在 /v2 之前；q=10 无损 code=110001 账号风控不支持
 *    ② 听会代理段恢复（175.27.166.236/kgqq1/qq.php，level=standard/exhigh）：v1.1.0 fix#5
 *       曾剔除（当时 HTTP 裸 IP 未验真），本轮实测 standard/exhigh 均返回酷我CDN HTTPS 直链
 *       （car-er.kuwo.cn，https 白名单放行），全长 4317292/10792943 与 qualities.size 精确一致；
 *       API 请求本身走 HTTP 裸 IP（有被劫持返回坏链风险），由 guardFullAudio 内容探测 +
 *       actualQuality 如实标注兜底；插在 /v2 之后、s01s 之前；不支持无损（flac 档名不副实）
 *    ③ 新增 HYWmusic 链尾兜底（103.79.184.97，key 取自用户文档 H 章）：实测各音质参数均返回
 *       同一 C400 AAC（3283546 字节 ≈96kbps 全长，isure6 QQ官方CDN），actualQuality 如实标
 *       '96k'；仅作全链最后兜底（在 bugpk 之后）；flac24bit 档 403 无权限
 *  - 接口文档其余可用项不接入：海棠w.net 备域名 musicapi.haitangw.net 实测服务端 VIP 过期
 *    （返回内嵌"获取音频失败/会员过期"假链，403）；cyapi/xcvts/玉宁熙 强制 apikey（文档抹除
 *    未提供）；HYW 上游即 cyapi 同源，接入 HYW 即覆盖该族；s01s 复测超时（维持失效状态）
 * v1.3.0 变更（2026-09-07）：
 *  - P0-1 音质大小传递（对齐 baka getBatchQualities/parseQualities）：新增 parseQqFileQualities，
 *          从 QQ file 元数据推导宿主 qualities[档位].size（数字字节），挂到搜索/歌词搜索/榜单/歌单/
 *          专辑/歌手/单曲详情全部条目构建点（buildSheetItem/buildMusicItem 统一透传）；
 *          另新增 fetchQqTrackInfoSizes（baka 同款 music.trackInfo.UniformRuleCtrl/CgiGetTrackInfo
 *          批量查询，2026-09-07 探针实测匿名可通且数值与搜索 file 一致），补齐无 file 尺寸的
 *          专辑详情主路（fcg_v8_album_info）条目
 *  - P0-2 getMusicInfo 补齐 qualities：宿主在 qualities 缺失时调 getMusicInfo 补大小
 *          （musicItemOptions.tsx L357 / operations.tsx L55），原实现只补 artwork/album/duration/mv，
 *          现把 qualities 纳入关键字段（单曲详情 fcg_play_single_song.fcg 的 file 尺寸回填）
 *  - P1-1 高端档（atmos/master/dolby）不声明：baka 经 ikun 后端的 master/atmos 实测返回 171KB
 *          audio/mpeg 占位片段（真 master 应为 ~187MB，见 file.size_new[0]），属假支持，宁缺毋假
 *  - P1-2 取链返回 headers：baka 音频取链仅返回 {url} 无 headers，无可借鉴项，维持现状
 *  - P2-1 MV availableVideoQualities 补 codec 字段（对齐 baka）
 *  - 歌词 QRC 不采纳 baka 方案：其 GetPlayLyricInfo crypt:1 未解密直接返回 hex 密文，
 *          我方 v0.8.0 起 3DES 解密 + 接力为真逐字歌词，保持
 * v1.2.1 变更（2026-09-07）：
 *  - fix#1 榜单分组去"聚合榜单"遗留命名 → 'QQ榜单'（单源插件对齐 QQ 官方分组口径）
 *  - fix#2 榜单条目封面补 coverImg 字段（宿主 topListItem.tsx 读 coverImg，原仅 artwork 不显示），
 *          官方 GetAll headPicUrl https 化，并用官方封面回填 CHART_DEFS 缺图榜单
 *  - fix#3 歌单曲数修正：SHEET_FETCHERS.qq 捕获 dirinfo.songnum 并在 getMusicSheetInfo 回填
 *          worksNum；推荐歌单 tag 榜单不再把 listennum（播放次数）误作 worksNum，Feed 条目改读 song_cnt
 *  - fix#4 歌单页默认第一个分类无数据：宿主 sheetBody 默认选中 {id:''} 的「默认」tag（对照宿主
 *          sheetBody.tsx defaultTag），原空 id 落 else 分支返回空数组；现空 id 与 'qq~rec' 同走
 *          GetRecommendFeed 推荐流（对照 baka 酷狗实现：空 tagId 走默认推荐而非空数据）
 * 自聚合搜索插件 v0.8.0 完整抽离的 QQ 音源：搜索/取链/歌词/榜单/歌单/歌手/专辑/MV/评论
 * 全功能保留；取链与歌词的跨源接力逻辑随多源架构一并移除（独立源无跨源可接力）。
 *
 * 端点与参数全部来自《六平台接口文档（实测整合版）》，未做任何盲猜。
 * 兼容性：ES8 语法（async/await），不使用 ?. / ??（安卓端风险，官方技能包提示）。
 *
 * 取链路径（全部免登录，除注明外）：
 *  - QQ：官方 CgiGetVkey 优先（真机家宽 IP 可用），海棠 resolve-url 兜底（用户已确认接受第三方）
 * 搜索路径：QQ 用综合搜索 V2（DoSearchForQQMusicMobile 移动端伪装体在数据中心 IP 被风控 2001）。
 */

var axios = require('axios');

// ==================== 通用工具 ====================

var SOURCE_TIMEOUT = 4500;   // 单源请求超时（沙箱/应用单方法 10s 硬上限内）
// v0.7.1 P1-3：取链全局超时预算。宿主 getMediaSource 单方法 10s 硬上限，
// 原实现最坏 6 段 × 4.5s × 3 候选源 ≈ 81s 必然被掐断。
var RESOLVE_BUDGET_MS = 8000; // getMediaSource 整体 deadline（留 2s 余量给宿主）
var RELAY_TIMEOUT = 2500;     // 接力段（备源）单请求超时，首段仍用 SOURCE_TIMEOUT
// [v1.3.5] 链内分段预算钳制：resolveWithFallback 把全局 deadline 写入 CHAIN_DEADLINE，
// 内部接力段超时 = min(自有时限, 全局剩余)。修复：顶层源之间的预算检查管不到 QQ 适配器
// 内部链，海棠/bugpk/听会三段同病时内部段各自为政叠加出 12.7s 离群（实测）突破 8s 预算。
// 并发取链时后写者覆盖 deadline，钳制精度略有偏差，方向仍是只紧不松，可接受。
var CHAIN_DEADLINE = 0;
var CHAIN_TOKEN = 0;
function chainSegTimeout(own) {
  if (!CHAIN_DEADLINE) return own;
  var r = CHAIN_DEADLINE - Date.now();
  if (r <= 300) return 300; // 预算将尽：300ms 快速失败，把窗口让给下一段/顶层源
  return Math.min(own, r);
}
var DURATION_TOLERANCE_SEC = 6;

function str(v) { return v === undefined || v === null ? '' : String(v); }

// [v1.5.0 P1] VIP 标记映射：QQ 各歌曲接口真实返回 pay 对象（2026-09-08 实测：
// VIP 歌 {pay_play:1,pay_month:1,pay_down:1,...}，免费歌 {} 或全 0 位），任一付费位=1
// 即 VIP。宿主 fee===1 显示 VIP 角标（musicItemOptions.tsx isVip）。
function qqFeeOf(pay) {
  if (!pay) return 0;
  // [v1.6.0 P1] 双口径兼容：do_search_v2 等新接口返回 pay_play/pay_month/pay_down，
  // soso 老接口（search_for_qq_cp）返回 payplay/paymonth/paydownload（2026-09-08 实测
  // VIP 歌 pay:{payplay:1,...}），任一付费位=1 即 VIP。
  if (parseInt(pay.pay_play, 10) === 1 || parseInt(pay.pay_month, 10) === 1 || parseInt(pay.pay_down, 10) === 1
    || parseInt(pay.payplay, 10) === 1 || parseInt(pay.paymonth, 10) === 1 || parseInt(pay.paydownload, 10) === 1) return 1;
  return 0;
}

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
 *    跨源缺时长时放宽为「专辑名也一致」才合并
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
  qq: 0.85
};

// 各源声明的免登录音质能力（super=无损档）
//   QQ super = GetEVkey(F0M0) → 官方 → 海棠 tx lossless（52.8MB 真 FLAC 沙箱复核；tx hires 文档实测返回 64 字节占位，不接入）
var SOURCE_QUALITIES = {
  qq: ['standard', 'high', 'super']
};

function canServe(source, quality) {
  var caps = SOURCE_QUALITIES[source] || [];
  return caps.indexOf(quality) >= 0;
}

// ==================== QQ 源搜索适配器 ====================
// 每个适配器返回统一内部条目：
// { source, sid, title, artist, album, duration(sec, 可为0), artwork, raw }

function searchQq(query, page) {
  // 综合搜索 V2：DoSearchForQQMusicMobile 移动端伪装体在数据中心 IP 被
  // 风控（req.code=2001），V2（comm ct=24/cv=0）实测 2026-09-05 数据中心可通；
  // 结果路径 req.data.body.item_song.items[]
  var body = {
    comm: { ct: '24', cv: '0' },
    req: {
      module: 'music.adaptor.SearchAdaptor',
      method: 'do_search_v2',
      param: {
        query: query, search_type: 0, page_num: page, num_per_page: 20
      }
    }
  };
  return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body, {
    timeout: SOURCE_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: 'https://y.qq.com/',
      'Content-Type': 'application/json'
    }
  }).then(function (res) {
    var reqData = res.data && res.data.req && res.data.req.data;
    var bodyData = reqData && reqData.body;
    var group = (bodyData && bodyData.item_song) || {};
    var list = (group && group.items) || [];
    var out = list.map(function (it) {
      var albumMid = it.album && it.album.mid ? String(it.album.mid) : '';
      return {
        source: 'qq', sid: str(it.mid),
        title: str(it.name), artist: splitArtists(it.singer),
        album: it.album && it.album.name ? String(it.album.name) : '',
        duration: parseInt(it.interval, 10) || 0,
        artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
        raw: { mid: str(it.mid), mediaMid: it.file && it.file.media_mid ? String(it.file.media_mid) : '', vid: it.mv && it.mv.vid ? String(it.mv.vid) : '', vip: qqFeeOf(it.pay) },
        qualities: parseQqFileQualities(it.file) // [v1.3.0 P0-1] 搜索条目带音质表（宿主 qualities[].size）
      };
    }).filter(function (it) { return it.sid && it.title; });
    // [v1.1.0 审查#10] item_song.total_num 是服务器真实命中总数，随数组透传供 isEnd 判定
    out.total = parseInt(group.total_num, 10) || parseInt(group.estimate_sum, 10) || 0;
    // [v1.6.0 P1] do_search_v2 结构性零结果（风控/改版）回落 soso 老接口
    if (!out.length) return searchQqSoso(query, page);
    return out;
  }).catch(function (e) {
    // [v1.6.0 P1] 报错也回落 soso；soso 再挂才抛原错误
    return searchQqSoso(query, page).catch(function () { throw e; });
  });
}

// [v1.6.0 P1] soso 老搜索兜底：c.y.qq.com/soso/fcgi-bin/search_for_qq_cp。
// Referer 必须为 https://y.qq.com/portal/search.html（2026-09-08 实测：带=10 条结果，不带=0 条），
// 常量化防漏。老接口返回 pay.payplay 口径（qqFeeOf 已双口径兼容）；
// 条目无 file 字段，音质表省略（宿主下载前实测大小由取链链路兜底）。
var QQ_SOSO_REFERER = 'https://y.qq.com/portal/search.html';
function searchQqSoso(query, page) {
  var p = page || 1;
  return axios.get('https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp', {
    timeout: SOURCE_TIMEOUT,
    params: { format: 'json', n: 20, p: p, w: query },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      Referer: QQ_SOSO_REFERER
    }
  }).then(function (res) {
    var d = res.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
    var songGrp = (d && d.data && d.data.song) || {};
    var list = songGrp.list || [];
    var out = list.map(function (s) {
      var albumMid = s.albummid ? String(s.albummid) : '';
      var singers = Array.isArray(s.singer) ? s.singer : [];
      return {
        source: 'qq', sid: str(s.songmid),
        title: str(s.songname),
        artist: singers.map(function (x) { return str(x && x.name); }).filter(Boolean).join('/'),
        album: s.albumname ? String(s.albumname) : '',
        duration: parseInt(s.interval, 10) || 0,
        artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
        raw: { mid: str(s.songmid), mediaMid: s.media_mid ? String(s.media_mid) : '', vid: '', vip: qqFeeOf(s.pay) }
      };
    }).filter(function (it) { return it.sid && it.title; });
    out.total = parseInt(songGrp.totalnum, 10) || 0;
    return out;
  });
}

// [v1.2.0 对齐 baka] 歌词搜索：DoSearchForQQMusicDesktop search_type=7，
// 响应 body.lyric.list[]（song 字段 + content=歌词全文，baka 同构）；条目可播放（raw 带 mid/vid）。
async function searchLyricQq(q, page) {
  var p = page || 1;
  var res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    req: { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicDesktop',
      param: { query: q, search_type: 7, page_num: p, num_per_page: 30 } }
    // [v1.8.1 P1-2] 携带用户配置 qqCookie（v1.7.1 未带 Cookie 风控静默空）
  }, { timeout: SOURCE_TIMEOUT, headers: qqCookieHeaders(QQ_SEARCH_HEADERS) });
  var reqData = res.data && res.data.req && res.data.req.data;
  // [v1.2.0 实测] search_type=7 的歌词组在 body.song.list[]（每项 song 字段 + content=歌词全文），
  // 不是 body.lyric（baka 注释同构但实测组名为 song）
  // [v1.8.1 P1-2] 显性化 reqcode + 全组空抛错（v1.7.1 静默空结果导致宿主 lyricManager
  // 跨插件 search lyric 误判「无歌词」不触发兜底）
  var _reqcode = res.data && res.data.req && res.data.req.code;
  if (_reqcode !== undefined && _reqcode !== 0) {
    throw new Error('QQ 歌词搜索 reqcode=' + _reqcode + '（疑似风控/缺登录态）');
  }
  var _body = reqData && reqData.body;
  var _songList = (_body && _body.song && _body.song.list) || [];
  var _lyricList = (_body && _body.lyric && _body.lyric.list) || [];
  if (_songList.length === 0 && _lyricList.length === 0) {
    throw new Error('QQ 歌词搜索全组为空 reqcode=' + _reqcode + '（疑似风控/缺登录态，请配置 qqCookie）');
  }
  var lyricGrp = (reqData && reqData.body && (reqData.body.song || reqData.body.lyric)) || {};
  var list = lyricGrp.list || [];
  var sum = parseInt(lyricGrp.sum, 10) || 0;
  var data = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it || !it.mid || !it.content) continue;
    var albumMid = it.album && it.album.mid ? String(it.album.mid) : (it.albummid ? String(it.albummid) : '');
    var item = buildSheetItem({
      source: 'qq', sid: str(it.mid),
      title: str(it.name || it.songname), artist: splitArtists(it.singer),
      album: it.album && it.album.name ? String(it.album.name) : (it.albumname ? String(it.albumname) : ''),
      duration: parseInt(it.interval, 10) || 0,
      artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
      raw: { mid: str(it.mid), mediaMid: it.file && it.file.media_mid ? String(it.file.media_mid) : '', vid: it.mv && it.mv.vid ? String(it.mv.vid) : '', vip: qqFeeOf(it.pay) },
      qualities: parseQqFileQualities(it.file) // [v1.3.0 P0-1] 歌词搜索条目带音质表
    });
    item.rawLrcTxt = str(it.content); // 宿主 ILyricItem.rawLrcTxt
    data.push(item);
  }
  return { isEnd: sum > 0 ? (p * 30 >= sum) : (list.length < 30), data: data };
}

var SEARCH_ADAPTERS = {
  qq: searchQq
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
    // [v1.7.1 对齐] IMusicItem 标准字段 platform 自报：宿主仅在搜索/榜单/歌单等入口
    // 覆写 platform，导入/备份恢复路径不覆写，缺失时 pluginManager.getByName(mediaItem.platform)
    // 无法定位插件（对齐酷我 v1.2.8 同款修复）
    platform: 'qq',
    title: best.title,
    artist: best.artist,
    album: best.album,
    artwork: artwork || undefined,
    duration: duration || undefined,
    _src: src,
    _srcOrder: srcOrder
  };
  if (src.qq && src.qq.vid) {
    // [v1.2.0 对齐 baka] MV 菜单别名：宿主 canPlayMusicVideo 白名单含 mv/mvId/mvVid/videoId，
    // 任一命中即在歌曲行显示 MV 入口；songmid 供宿主平台 ID 面板与取链兜底。
    item.videoId = String(src.qq.vid);
    item.mv = String(src.qq.vid);
    item.mvId = String(src.qq.vid);
    item.mvVid = String(src.qq.vid);
  }
  if (src.qq && src.qq.mid) item.songmid = String(src.qq.mid);
  // [v1.3.0 P0-1] 音质表合并：取代表条目（最高分成员）的 qualities，缺失时按成员序补位
  var quals = best.qualities;
  for (var qi = 0; qi < members.length && !quals; qi++) {
    if (members[qi].qualities) quals = members[qi].qualities;
  }
  if (quals) item.qualities = quals;
  // [v1.5.0 P1 -> v1.9.5] fee（VIP 角标）字段全面停写不再透传；VIP 语义保留在
  // _src.qq.vip 内部字段（各成员 raw 携带），仅 getMediaSource vipPreRoute 取链预判消费。
  // [v1.5.0 P2] primaryKey：歌曲唯一标识（songmid），宿主去重/缓存键补充字段；
  // 稳定身份仍以 item.id（source_sid）为准
  if (src.qq && src.qq.mid) item.primaryKey = String(src.qq.mid);
  return item;
}

// ==================== 聚合榜单 ====================
// 多平台同名榜单合并：按榜单名次归一化得分 + 跨平台命中加成；
// 条目 _src 携带源 raw，复用取链接力（resolveWithFallback）。
// 端点均来自六平台接口文档实测记录（2026-09-02/05），无猜测 URL。

var CHART_TTL_MS = 30 * 60 * 1000;
var chartCache = {};   // { defId: { ts, list } }
var chartInflight = {}; // { defId: Promise } 并发去重

var CHART_DEFS = [
  {
    id: 'agg-hot', title: '热歌榜',
    cover: 'https://p3-luna.douyinpic.com/img/tos-cn-i-b829550vbb/d0d8d48461a62748e84689cdf049b19a.png~tplv-b829550vbb-resize:960:960.png',
    members: [
      { source: 'qq', id: '26' }
    ]
  },
  {
    id: 'agg-new', title: '新歌榜', cover: '',
    members: [
      { source: 'qq', id: '27' }
    ]
  },
  {
    id: 'agg-west', title: '欧美榜', cover: '',
    members: [
      { source: 'qq', id: '61' }
    ]
  }
];

var CHART_FETCHERS = {
  qq: function (topId, offset) {
    // [v0.8.0] offset：getTopListDetail qqtop~ 分支分页复用（每页 100）
    return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      comm: { ct: '24', cv: '0' },
      req: {
        module: 'musicToplist.ToplistInfoServer',
        method: 'GetDetail',
        param: { topId: parseInt(topId, 10), offset: parseInt(offset, 10) || 0, num: 100, period: '' }
      }
    }, {
      timeout: SOURCE_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: 'https://y.qq.com/',
        'Content-Type': 'application/json'
      }
    }).then(function (res) {
      var reqData = res.data && res.data.req && res.data.req.data;
      var list = (reqData && reqData.songInfoList) || [];
      return list.map(function (it) {
        var albumMid = it.album && it.album.mid ? String(it.album.mid) : '';
        return {
          source: 'qq', sid: str(it.mid),
          title: str(it.name), artist: splitArtists(it.singer),
          album: it.album && it.album.name ? String(it.album.name) : '',
          duration: parseInt(it.interval, 10) || 0,
          artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
          raw: { mid: str(it.mid), mediaMid: it.file && it.file.media_mid ? String(it.file.media_mid) : '', vid: it.mv && it.mv.vid ? String(it.mv.vid) : '', vip: qqFeeOf(it.pay) },
          qualities: parseQqFileQualities(it.file) // [v1.3.0 P0-1] 榜单条目带音质表
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
    // [v1.7.1 qa#1 P1] 榜单歌曲条目补 IMusicItem 标准字段 platform 自报：宿主按
    // media.platform 路由取链（pluginManager.getByName），缺失时榜单点击播放直接失败
    platform: 'qq',
    title: base.item.title,
    artist: base.item.artist,
    album: base.item.album || undefined,
    duration: duration || undefined,
    artwork: base.item.artwork || undefined,
    qualities: aggQuals || undefined,
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
// qq     musicu.fcg music.srfDissInfo.DissInfo CgiGetDiss（song_begin/song_num 分页；条目字段 name/mid/album{name}/singer[]/file.media_mid）

var SHEET_MAX_PAGES = 5;      // 单源最多翻 5 页（500 首 = SHEET_MAX_ITEMS 对齐；插件方法 10s 硬上限内）[v1.1.0 fix#5]
var SHEET_MAX_ITEMS = 500;    // 导入条数上限（防超时）

/** 各平台歌单 URL → 歌单 id（全部为实测存在的链接格式；返回 null 表示不认识） */
var SHEET_URL_RESOLVERS = {
  qq: function (s) {
    if (!/qq\.com/.test(s)) return null;
    // v1.8.2：补 playlistDetail/<id>（新 app 分享格式 https://i.y.qq.com/n2/m/share/details/playlistDetail.html?...id=xx 已由 ?id= 兜住；
    // 此处主要覆盖 /playlistDetail/<id> 路径形态），其余沿用既有格式
    var m = /\/playlist\/(\d+)/.exec(s) || /\/playlistDetail\/(\d+)/.exec(s) || /[?&]disstid=(\d+)/.exec(s) || /[?&]id=(\d+)/.exec(s);
    return m ? m[1] : null;
  }
};

/**
 * 解析歌单链接/纯数字 id → { source, id }
 * [v1.2.0 对齐 baka] 单源插件纯数字 id 无平台歧义，直接按 QQ disstid 处理（CgiGetDiss 原生接受数字）。
 */
// [v1.8.2 P2-4] 歌单导入错误统一构造——message 原样展示给宿主，code 供宿主结构化处理。
function sheetImportError(code, msg) {
  var e = new Error('[qq] ' + msg);
  e.code = code;
  e.platform = 'qq';
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
  if (/^\d{4,}$/.test(s)) return { source: 'qq', id: s };
  var id = SHEET_URL_RESOLVERS.qq(s);
  if (id) return { source: 'qq', id: id };
  throw sheetImportError('SHEET_URL_UNRECOGNIZED', '无法识别的歌单链接（支持 QQ 音乐的歌单网页/分享链接/纯数字歌单 ID）');
}

// [v0.8.0] QQ 官方榜单组：ToplistInfoServer GetAll 匿名可用（2026-09-06 探针实测 4 组 30 榜），
// 字段 topId/title/titleDetail/intro/period/listenNum/headPicUrl。id 约定 'qqtop~{topId}'。
async function fetchQqToplistGroups() {
  var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '24', cv: '0' },
    req: {
      module: 'musicToplist.ToplistInfoServer', method: 'GetAll', param: {}
    }
  }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS });
  var gs = r.data && r.data.req && r.data.req.data && r.data.req.data.group;
  if (!gs || !gs.length) throw new Error('qq toplist GetAll no group');
  var out = [];
  for (var i = 0; i < gs.length; i++) {
    var g = gs[i] || {};
    var data = (g.toplist || []).map(function (t) {
      var tCover = (t && (t.headPicUrl || t.frontPicUrl)) ? String(t.headPicUrl || t.frontPicUrl).replace(/^http:/i, 'https:') : '';
      // [v1.2.1 fix#2] 宿主 topListItem.tsx 读 coverImg（baka 同构：headPicUrl || frontPicUrl）；
      // artwork 保留，兼容其他宿主读取路径
      return {
        id: 'qqtop~' + (t && t.topId),
        // [v1.7.1 qa#2 P2] 榜单卡片补 IMusicSheetItem 标准字段 platform（同批 platform 对齐）
        platform: 'qq',
        title: t && t.title ? String(t.title) : '',
        coverImg: tCover,
        artwork: tCover,
        description: (t && (t.titleDetail || t.intro)) ? String(t.titleDetail || t.intro) : undefined
      };
    }).filter(function (t) { return t.id && t.title; });
    if (data.length) out.push({ title: str(g.groupName) || 'QQ官方榜单', data: data });
  }
  return out;
}

var SHEET_FETCHERS = {
  qq: async function (disstid) {
    var out = [];
    // [v1.2.1 fix#3] CgiGetDiss 响应自带 dirinfo.songnum（歌单真实总曲数，探针 2026-09-07：
    // dissid 7239354742 → songnum=295 与分页数一致），透传给详情层回填 worksNum
    var dirTotal = 0;
    // [v1.8.4] dirinfo 自带歌单标题/封面/简介（探针 2026-09-10：title/picurl/desc），
    // 首页捕获随列表回传，importMusicSheetImpl 据此组装完整 IMusicSheetItem
    var sheetMeta = null;
    for (var begin = 0; begin < SHEET_MAX_ITEMS && begin / 100 < SHEET_MAX_PAGES; begin += 100) {
      var res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        comm: { ct: '24', cv: '0' },
        req: {
          module: 'music.srfDissInfo.DissInfo', method: 'CgiGetDiss',
          param: { disstid: parseInt(disstid, 10), dirid: 0, tag: false, song_begin: begin, song_num: 100, userinfo: false, orderlist: false, onlysonglist: true }
        }
      }, { timeout: SOURCE_TIMEOUT, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://y.qq.com/' } });
      var reqData = res.data && res.data.req && res.data.req.data;
      if (!dirTotal) dirTotal = parseInt(reqData && reqData.dirinfo && reqData.dirinfo.songnum, 10) || 0;
      // [v1.8.4] 首页捕获 dirinfo 元数据（title/picurl/desc；description 字段名对齐宿主契约）
      if (!sheetMeta && reqData && reqData.dirinfo) {
        var di0 = reqData.dirinfo;
        sheetMeta = {
          title: str(di0.title),
          artwork: str(di0.picurl) || undefined,
          description: str(di0.desc) || undefined,
          worksNum: parseInt(di0.songnum, 10) || undefined
        };
      }
      var list = (reqData && reqData.songlist) || [];
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        out.push({
          source: 'qq', sid: str(it.mid),
          title: str(it.name || it.title), artist: splitArtists(it.singer),
          album: it.album && it.album.name ? String(it.album.name) : '',
          duration: parseInt(it.interval, 10) || 0,
          artwork: it.album && it.album.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + it.album.mid + '.jpg' : '',
          raw: { mid: str(it.mid), mediaMid: it.file && it.file.media_mid ? String(it.file.media_mid) : '', vid: it.mv && it.mv.vid ? String(it.mv.vid) : '', vip: qqFeeOf(it.pay) },
          qualities: parseQqFileQualities(it.file) // [v1.3.0 P0-1] 歌单条目带音质表
        });
      }
      if (list.length < 100) break;
    }
    var filtered = out.filter(function (it) { return it.sid && it.title; });
    // [v1.2.1 fix#3] 数组挂载 total 附加属性（不改返回契约，importMusicSheetImpl 等数组用法不受影响）
    filtered.total = dirTotal;
    // [v1.8.4] 数组挂载 meta 附加属性（歌单标题/封面/简介，同 total 惯例）
    filtered.meta = sheetMeta;
    return filtered;
  }
};

// [v1.3.0 P0-1] 音质表推导（对齐 baka parseQualities）：从 QQ file 元数据推导宿主
// qualities[档位].size（数字字节；宿主 getQualitySize 显示 (3.2MB)、downloader 取
// qualities[actualQuality].size 做下载进度 expectedFileSize，数字格式精度优于 baka 的字符串）。
// 只声明插件有真实交付通道的档位（128k/320k/flac）——hires/dolby/master/atmos/atmos_plus 的
// size 字段虽在元数据中存在，但插件无真实取链通道（v1.1.0 fix#2：海棠 tx hires 64 字节占位、
// vkeys q=11/12 实测 code=500；v1.3.0 探针：baka 依赖的 ikun 后端 c.wwwweb.top 对 tx master/atmos
// 实测返回 171KB audio/mpeg 占位片段，真 master 应为 ~187MB）。虚标会让宿主音质菜单出现
// "选了拿不到"的档位，宁缺毋假。
function parseQqFileQualities(file) {
  if (!file) return undefined;
  var out = {};
  var q128 = parseInt(file.size_128mp3, 10) || 0;
  var q320 = parseInt(file.size_320mp3, 10) || 0;
  var qflac = parseInt(file.size_flac, 10) || 0;
  if (q128 > 0) out['128k'] = { size: q128 };
  if (q320 > 0) out['320k'] = { size: q320 };
  if (qflac > 0) out['flac'] = { size: qflac };
  return Object.keys(out).length ? out : undefined;
}

// [v1.3.0 P0-1] 批量音质大小查询（baka 同款 music.trackInfo.UniformRuleCtrl / CgiGetTrackInfo）
// 2026-09-07 探针实测匿名可通（req.code=0），size_128mp3/size_320mp3/size_flac 与搜索条目
// file 字段数值一致；size_hires=0（不可信）、size_new[] 为各高端档字节数但对应通道无可交付
// URL（见文件头 P1-1 结论），维持宁缺毋假只解析 128/320/flac。
// 返回 { mid: qualities }，单块 100 首、失败块静默跳过。
function fetchQqTrackInfoSizes(mids) {
  var all = [];
  for (var u = 0; u < (mids || []).length; u++) {
    var m = mids[u] && String(mids[u]);
    if (m && all.indexOf(m) < 0) all.push(m);
  }
  if (!all.length) return Promise.resolve({});
  var CHUNK = 100;
  var chunks = [];
  for (var c = 0; c < all.length; c += CHUNK) chunks.push(all.slice(c, c + CHUNK));
  var out = {};
  return chunks.reduce(function (chain, chunk) {
    return chain.then(function () {
      return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        comm: { ct: 19, cv: 1859, uin: 0 },
        req: { module: 'music.trackInfo.UniformRuleCtrl', method: 'CgiGetTrackInfo',
          param: { types: chunk.map(function () { return 0; }), ids: chunk.map(function () { return 0; }), mids: chunk, ctx: 0 } }
      }, { timeout: SOURCE_TIMEOUT, headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }).then(function (res) {
        var tracks = res.data && res.data.req && res.data.req.data && res.data.req.data.tracks;
        if (Array.isArray(tracks)) {
          for (var i = 0; i < tracks.length; i++) {
            var t = tracks[i];
            var mid = t && t.mid ? String(t.mid) : '';
            if (!mid) continue;
            var q = parseQqFileQualities(t.file);
            if (q) out[mid] = q;
          }
        }
      }).catch(function () { /* 单块失败不阻塞整体 */ });
    });
  }, Promise.resolve()).then(function () { return out; });
}

/** 归一化歌单条目 → 聚合条目（_src 带单源 raw，复用取链接力） */
function buildSheetItem(entry) {
  var src = {};
  src[entry.source] = entry.raw;
  var item = {
    id: entry.source + '_' + entry.sid,
    // [v1.7.1 对齐] IMusicSheetItem 标准字段 platform 自报（同 buildMusicItem 口径）
    platform: 'qq',
    title: entry.title,
    artist: entry.artist,
    album: entry.album || undefined,
    duration: entry.duration || undefined,
    artwork: entry.artwork || undefined,
    _src: src,
    _srcOrder: [entry.source]
  };
  if (entry.qualities) {
    // [v1.3.0 P0-1] 条目音质表透传：宿主音质菜单/下载面板直接读 item.qualities[档].size
    item.qualities = entry.qualities;
  }
  if (src.qq && src.qq.vid) {
    // [v1.2.0 对齐 baka] MV 菜单别名：宿主 canPlayMusicVideo 白名单含 mv/mvId/mvVid/videoId，
    // 任一命中即在歌曲行显示 MV 入口；songmid 供宿主平台 ID 面板与取链兜底。
    item.videoId = String(src.qq.vid);
    item.mv = String(src.qq.vid);
    item.mvId = String(src.qq.vid);
    item.mvVid = String(src.qq.vid);
  }
  if (src.qq && src.qq.mid) {
    item.songmid = String(src.qq.mid);
    item.primaryKey = String(src.qq.mid); // [v1.5.0 P2] primaryKey = songmid（宿主去重/缓存键）
  }
  // [v1.9.5] fee（VIP 标识）停写：entry 不再携带 fee，宿主不渲染 VIP 角标
  return item;
}

/**
 * 导入歌单：urlLike 支持 QQ 音乐歌单网页/分享链接。
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
  // meta（dirinfo.title/picurl/desc）随列表回传；失败时 title 兜底「QQ歌单 #<disstid>」。
  var meta = entries.meta || null;
  var sheet = {
    id: 'qq_' + resolved.id,
    platform: 'qq',
    isImported: true,
    title: (meta && meta.title) || ('QQ歌单 #' + resolved.id),
    artwork: (meta && meta.artwork) || (out[0] && out[0].artwork) || undefined,
    worksNum: (meta && meta.worksNum) || entries.total || out.length,
    musicList: out
  };
  if (meta && meta.description) sheet.description = meta.description;
  if (meta && meta.artist) { sheet.artist = meta.artist; sheet.author = meta.artist; } // [v1.9.1] author 别名（任务字段清单要求 author，宿主协议用 artist）
  return sheet;
}

// ==================== 单曲导入 & 歌曲详情（v0.7.0 P0-3/P0-4）====================
// 端点实测（artifacts/v07-probe/probe12.mjs，2026-09-06）：
// qq     c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=（文档 14.10 实测✅ + 本沙箱复核；
//        musicu get_song_detail_yqq 实测返回 info 百科结构非歌曲信息，弃用）

var SONG_URL_RESOLVERS = {
  qq: function (s) {
    if (!/qq\.com/.test(s)) return null;
    var m = /songDetail\/([0-9A-Za-z]+)/.exec(s) || /[?&]songid=([0-9A-Za-z]+)/.exec(s); // v0.7.1 P1-1：去掉贪婪前缀，否则捕获组只剩最后一个字符
    return m ? m[1] : null;
  }
};

/**
 * 解析单曲分享链接 → { source, id }
 * 支持：QQ 音乐歌曲分享链接。纯数字 id 无法唯一判定平台，不猜。
 */
async function resolveSongId(urlLike) {
  var s = String(urlLike || '').trim();
  if (!s) throw new Error('单曲链接为空');
  if (/^\d{5,}$/.test(s)) throw new Error('纯数字歌曲 id 无法判定平台，请粘贴带域名的完整分享链接');
  var id = SONG_URL_RESOLVERS.qq(s);
  if (id) return { source: 'qq', id: id };
  throw new Error('无法识别的单曲链接（支持 QQ 音乐的歌曲分享链接）');
}

var SONG_DETAIL_FETCHERS = {
  qq: function (mid) {
    return axios.get('https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg', {
      params: { songmid: mid, tp: 'yqq_song_detail', format: 'json' },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var t = res.data && res.data.data && res.data.data[0];
      if (!t) throw new Error('qq detail empty');
      var albumMid = t.album && t.album.mid ? String(t.album.mid) : '';
      return {
        source: 'qq', sid: str(t.mid),
        title: str(t.name), artist: splitArtists(t.singer),
        album: t.album && t.album.name ? String(t.album.name) : '',
        duration: parseInt(t.interval, 10) || 0,
        artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
        raw: { mid: str(t.mid), mediaMid: t.file && t.file.media_mid ? String(t.file.media_mid) : '', vid: t.mv && t.mv.vid ? String(t.mv.vid) : '', vip: qqFeeOf(t.pay) },
        qualities: parseQqFileQualities(t.file) // [v1.3.0 P0-2] 详情带音质表，getMusicInfoImpl 回填
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
  // [v1.8.1 P0-2] 裸 ID playById 反查——QQ 主键为 songmid/mid，复用 SONG_DETAIL_FETCHERS
  // + buildSheetItem 重建条目（与 importMusicItemImpl 同路径）。参照 migu 兜底模式。
  if (!musicItem._src) {
    try {
      var bareId = String(musicItem.songmid || musicItem.mid || musicItem.id || '').trim();
      if (bareId && SONG_DETAIL_FETCHERS.qq) {
        var entry = await SONG_DETAIL_FETCHERS.qq(bareId);
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
  var sidKey = { qq: 'mid' };

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
      // [v1.3.0 P0-2] qualities 补齐：宿主在 qualities 缺失/无 size 时主动调 getMusicInfo
      // 补文件大小（musicItemOptions.tsx L357 / operations.tsx L55），必须把音质表一并回填
      if (!musicItem.qualities && detail.qualities) musicItem.qualities = detail.qualities;
      if (detail.raw && detail.raw.mv && !musicItem.mv) musicItem.mv = String(detail.raw.mv);
      if (detail.raw && detail.raw.vid && !musicItem.videoId) musicItem.videoId = String(detail.raw.vid);
      // [v1.5.0 P1/P2 -> v1.9.5] primaryKey 详情回填；fee（VIP 标识）已停写不回填
      if (!musicItem.primaryKey && detail.raw && detail.raw.mid) musicItem.primaryKey = String(detail.raw.mid);
      if (musicItem.artwork && musicItem.duration && musicItem.qualities) break; // 关键字段（含音质表）齐了就停
    } catch (e) { /* 详情可选，失败换下个源 */ }
  }
  return musicItem;
}

// ==================== QQ 取链适配器 ====================

// 海棠 resolve-url 公共封装（用户已确认接受第三方备源）：
// source: 'tx'(QQ)
// level 映射（文档实测）：standard/exhigh/lossless/hires（master/flac24bit 会降级 128k，不用）
// 文档实测：QQ VIP 返回真 FLAC
function haitangLevelOf(quality) {
  if (quality === 'super') return 'lossless';
  if (quality === 'high') return 'exhigh';
  return 'standard';
  // [v1.1.0 fix#2] hires 档位整体下线（假支持）：
  //   - 原实现 master/atmos/dolby/vinyl→hires 后唯一落点海棠 tx hires，实测返回 64 字节占位文件
  //   - vkeys q=11/12 高解析档 2026-09-06 探针实测 code=500（端点劣化），无可用真实 hires 通道
  //   - 现统一映射到 super（真无损），actualQuality 如实标 flac，宁低勿高
}

// 宿主音质键（fork: 96k/128k/192k/320k/flac/flac24bit/hires/master/atmos...）→ 插件内部档位。
// v0.6.0 及之前宿主传入 '320k'/'master' 会被当未知档落回 standard，此映射修正为正确档位。
var QUALITY_KEY_MAP = {
  '96k': 'standard', '128k': 'standard',
  '192k': 'high', '320k': 'high',
  'flac': 'super', 'flac24bit': 'super',
  // [v1.1.0 fix#2] hires/master/atmos/dolby/vinyl 全部映射 super（真无损），
  // 不再映射假 hires 链路（海棠 tx hires 64 字节占位 / vkeys q=11 实测失效）
  'hires': 'super', 'master': 'super', 'atmos': 'super', 'atmos_plus': 'super', 'dolby': 'super', 'vinyl': 'super'
};
function normalizeQuality(q) {
  var s = String(q || '');
  if (QUALITY_KEY_MAP[s]) return QUALITY_KEY_MAP[s];
  if (s === 'standard' || s === 'high' || s === 'super') return s;
  return 'standard';
}

// [v0.7.2 fix#10 P1] 音质诚实性：插件内部档位 → 宿主音质键（IMediaSourceResult.actualQuality）。
// 多源接力/降级后「宣称档位 ≠ 实际档位」是多源播放器通病；v0.7.2 起各取链解析器
// 在返回值上附 actualQuality（宿主音质键口径：128k/192k/320k/flac/flac24bit/hires），
// 供宿主 UI 角标展示真实档位。取不到确定档位的通道不填该字段（宁缺毋假）。
function internalToHostQuality(q) {
  if (q === 'high') return '320k';
  if (q === 'super') return 'flac';
  return '128k'; // standard / low / 未知（[v1.1.0 fix#2] hires 档已下线）
}

function resolveHaitang(source, rid, quality) {
  var r = String(rid || '');
  return axios.post('https://musicserver.haitangw.cc/v1/music/resolve-url', {
    source: source, rid: r, level: haitangLevelOf(quality)
  }, {
    timeout: chainSegTimeout(RELAY_TIMEOUT), // v0.7.1 P1-3：接力段超时 2500ms
    headers: { Referer: 'https://musicserver.haitangw.cc/', 'Content-Type': 'application/json' }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!res.data || res.data.code !== 0 || !d || !d.url) throw new Error('haitang no url');
    var mediaUrl = String(d.url);
    // [v0.7.2 fix#10] actualQuality：海棠 level 与请求档一一对应（standard→128k / exhigh→320k / lossless→flac / hires→hires）
    // [v1.9.4] 补 size 字段：响应不带大小，Range 0-0 探测（已验真音频格式，不必重跑魔数探测）。
    // fail-soft：探测失败不阻断，size 留空；探测 4xx/5xx 视为 URL 失效由后续 guard 接力。
    return axios.get(mediaUrl, {
      timeout: 2000,
      headers: { Range: 'bytes=0-0' },
      responseType: 'arraybuffer',
      validateStatus: function (s) { return s >= 200 && s < 300; }
    }).then(function (h) {
      var headers = h.headers || {};
      var size = 0;
      var cr = headers['content-range'] || headers['Content-Range'];
      var mm = cr && String(cr).match(/\/(\d+)\s*$/);
      if (mm) size = parseInt(mm[1], 10) || 0;
      else if (h.status !== 206) {
        var cl = headers['content-length'] || headers['Content-Length'];
        size = parseInt(cl, 10) || 0;
      }
      var out = { url: mediaUrl, actualQuality: internalToHostQuality(quality), channel: 'qq:haitang' };
      if (size > 0) out.size = size;
      return out;
    }).catch(function () {
      // 探测失败（如 Range 不支持/超时）：不阻断取链，size 留空
      return { url: mediaUrl, actualQuality: internalToHostQuality(quality), channel: 'qq:haitang' };
    });
  });
}

// ==================== [v1.7.0 P0] 第三方取链竞速通道（4 路）====================
// 实测驱动的接入（2026-09-10）：
//  - 通道 1 主力 Hello World（a.aa.cab）：GET 形参 type=tx&id=<songmid>&quality=<128k|320k|flac|master>，无签名。
//    音质映射：standard→128k, higher→320k, exhigh→flac, lossless→master；hires/master 也落到 master。
//  - 通道 2 备份 长青（175.27.166.236/kgqq1/qq.php）：GET 形参 ID=<songmid>&q=<128k|320k|flac|flac24bit>，裸 IP 200 OK 立即返回 JSON。
//    音质映射：standard→128k, higher→320k, exhigh→flac, lossless→flac24bit。
//  - 通道 3 兜底 念心（mcp.nianxinxz.com/ceshi）：GET 形参 type=tx&id=<songmid>&quality=<128k|320k|flac>，无 lossless。
//    音质映射：standard→128k, higher→320k, exhigh→flac（lossless/hires/master 落到 flac）。
// 三通道均按 hostQuality 键直接查表（保持任务规范的音质映射不变），失败语义按任务规范统一。
// 失败语义：HTTP 非 2xx / 空响应 / Content-Length=0 / 解析无 url / verifyQualitySize 不通过 → reject，
// 由 kuwoRaceSuccess 自然接力下一通道。

// hostQuality → 第三方通道实际请求音质（一对一映射，按实测表口径）
function thirdPartyTierOf(hostQuality) {
  // 通道 1 主力（a.aa.cab）：lossless 走 master 取 24bit；hires/master 直接 master
  // [v1.7.1 fix#1] flac24bit 从 'flac' 上移到 'master'：master 档才是 24bit 上游映射，
  // v1.7.0 把 flac24bit 落在 'flac'（16bit/44.1k），24bit 信息在请求侧即被丢弃。
  if (hostQuality === 'lossless' || hostQuality === 'hires' || hostQuality === 'master' || hostQuality === 'flac24bit') return 'master';
  if (hostQuality === 'exhigh' || hostQuality === 'flac') return 'flac';
  if (hostQuality === 'higher' || hostQuality === '320k' || hostQuality === '192k') return '320k';
  if (hostQuality === 'standard' || hostQuality === '128k' || hostQuality === 'hq') return '128k';
  return '128k';
}
function changqingTierOf(hostQuality) {
  // 通道 2 备份（长青）：lossless 走 flac24bit（实测支持）；无 hires/master 概念，按 flac24bit
  // [v1.7.1 fix#1] flac24bit 单独落 'flac24bit'：长青接口文档自身把 lossless 映射为
  // q=flac24bit，证明该参数档真实存在；v1.7.0 误落 'flac'（16bit）丢 24bit。
  if (hostQuality === 'lossless' || hostQuality === 'hires' || hostQuality === 'master' || hostQuality === 'flac24bit') return 'flac24bit';
  if (hostQuality === 'exhigh' || hostQuality === 'flac') return 'flac';
  if (hostQuality === 'higher' || hostQuality === '320k' || hostQuality === '192k') return '320k';
  if (hostQuality === 'standard' || hostQuality === '128k' || hostQuality === 'hq') return '128k';
  return '128k';
}
function nianxinTierOf(hostQuality) {
  // 通道 3 兜底（念心）：无 lossless；lossless/hires/master 落到 flac（实测 3/5 末位）
  if (hostQuality === 'lossless' || hostQuality === 'hires' || hostQuality === 'master'
      || hostQuality === 'exhigh' || hostQuality === 'flac' || hostQuality === 'flac24bit') return 'flac';
  if (hostQuality === 'higher' || hostQuality === '320k' || hostQuality === '192k') return '320k';
  if (hostQuality === 'standard' || hostQuality === '128k' || hostQuality === 'hq') return '128k';
  return '128k';
}
// 第三方通道 actualQuality 标注（用于宿主展示）
// [v1.7.1 fix#1] 新增 actualTier 参数（第三方通道实际请求档位，由调用方传入）：
// master/flac24bit 档真实携带 24bit 信息，如实标 'flac24bit'（v1.7.0 一律标 'flac'）。
// [v1.7.1 fix#2] 192k 显式分支：v1.7.0 无 192k 分支落到 128k 兜底，actualQuality 错标。
function hostQualityToActual(hostQuality, actualTier) {
  // actualTier（实际请求档位）权威判定：
  //  - master/flac24bit 档真实携带 24bit → 'flac24bit'
  //  - flac 档 → 'flac'（念心无 24bit 上游，flac24bit 请求落 flac 档时如实标 16bit）
  //  - 320k 档请求宿主 192k 档 → 如实标下限 '192k'（192k 在 thirdPartyTierOf 落 320k 档）
  if (actualTier === 'flac24bit' || actualTier === 'master') return 'flac24bit';
  if (actualTier === 'flac') return 'flac';
  if (actualTier === '320k') return hostQuality === '192k' ? '192k' : '320k';
  if (actualTier === '128k') return '128k';
  // 无 tier 时按 hostQuality 兜底（[v1.7.1 fix#2] 192k 显式分支：v1.7.0 落 128k 错标）
  if (hostQuality === 'flac24bit') return 'flac24bit';
  if (hostQuality === 'master' || hostQuality === 'hires'
      || hostQuality === 'lossless' || hostQuality === 'flac') return 'flac';
  if (hostQuality === '320k' || hostQuality === 'exhigh' || hostQuality === 'higher') return '320k';
  if (hostQuality === '192k') return '192k';
  return '128k';
}

// [v1.7.0 P0] 音质大小校验：Range 探测 0-4095 字节 → 魔数校验 → total 阈值校验。
// 失败抛错，由竞速链自然接力下一通道。timeout 2000ms（探测不影响主路径总预算太多）。
function verifyQualitySize(url, hostQuality) {
  return axios.get(url, {
    timeout: 2000,
    headers: { Range: 'bytes=0-4095' },
    responseType: 'arraybuffer',
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var data = res.data;
    if (!data || !(data instanceof ArrayBuffer || (data && data.byteLength !== undefined))) {
      throw new Error('verify: no arraybuffer');
    }
    var bytes = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer || data);
    if (bytes.length < 4) throw new Error('verify: response too short (' + bytes.length + 'B)');
    // 魔数校验：fLaC（无损） / ID3 / MPEG sync = 有损
    var isFlac = bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43;
    var isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    var isMpeg = bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0;
    var isAudioMagic = isFlac || isId3 || isMpeg;
    // 期望档位：flac 家族（lossless/hires/master/flac/flac24bit/exhigh）必须 fLaC；有损必须 ID3 或 MPEG
    var expectFlac = /^(lossless|hires|master|flac|flac24bit|exhigh)$/i.test(String(hostQuality || ''));
    if (expectFlac && !isFlac) {
      throw new Error('verify: expected flac magic, got ' + (isId3 ? 'ID3' : isMpeg ? 'MPEG' : '0x' + bytes[0].toString(16)));
    }
    if (!expectFlac && !isAudioMagic) {
      throw new Error('verify: expected lossy magic (ID3/MPEG), got 0x' + bytes[0].toString(16) + bytes[1].toString(16));
    }
    // total 大小校验：Content-Range 优先（如 "bytes 0-4095/4321234"），退到 Content-Length
    var headers = res.headers || {};
    var total = 0;
    var cr = headers['content-range'] || headers['Content-Range'];
    var mm = cr && String(cr).match(/\/(\d+)\s*$/);
    if (mm) {
      total = parseInt(mm[1], 10) || 0;
    } else if (res.status !== 206) {
      var cl = headers['content-length'] || headers['Content-Length'];
      total = parseInt(cl, 10) || 0;
    }
    if (total > 0) {
      // 第三方通道容忍 proxyMinRatio=0.80：实测 flac 5~55MB、128k 3~5MB、320k 7~12MB
      // 2MB 最低（128k MP3 完整文件通常 >2MB）
      var minSize = 2 * 1024 * 1024;
      if (total < minSize) {
        throw new Error('verify: total too small ' + Math.round(total / 1024) + 'KB (expect >= ' + Math.round(minSize / 1024) + 'KB)');
      }
    }
    return { url: url, magic: isFlac ? 'fLaC' : isId3 ? 'ID3' : 'MPEG', total: total };
  });
}

// [v1.7.0 P0 → v1.9.12 P0] 通道 1 主力（Hello World 旧 mid 直查形态 → a.aa.cab/qq.music 搜索型新端点）
// [v1.9.4 失效存档] 旧形态 GET a.aa.cab/?type=tx&id=<songmid>&quality=<tier>（v1.7.0 接入）于
// 2026-09-11 探针实测确认死亡：a.aa.cab 域名为「云汐 API」HTML 主页（GET / 返回带 meta
// keywords/title 的 HTML 模板），任意形参路径（?type=tx&quality=master 等）均返回同一主页，
// 原 type=tx&id=&quality= 接口路径已下线/改版，v1.9.4 起从竞速池移除。
// [v1.9.12 P0] 新端点（来源：音源包 V260917 𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉260809.js 最新版 260809，2026-09-20 实测）：
//   GET https://a.aa.cab/qq.music?msg={关键词}&n=1&type={音质码}
//   - 搜索型取链：msg=encodeURIComponent(曲名 + ' ' + 歌手)（空格分隔），与旧 mid 直查形态不同；
//   - 音质码映射（任务规范）：standard(128k)→0 / higher·exhigh(320k)→1 / super·lossless(flac)→4 /
//     hires·master·flac24bit(臻品母带，与 flac 同域但 24bit 档)→5；
//   - 响应 JSON：code 0=成功 / 1=成功但返回空（msg 为空或不合法）→ 非 0 一律视为通道失败接力；
//     data.music=音频直链（ws.stream.qqmusic.qq.com vkey 短链，http 形态命中
//     MEDIA_URL_HTTP_HOST_ALLOWLIST 的 .qq.com$ 规则）；data.tips=音质标识
//     （"低品质"/"中品质"/"SQ无损"/"臻品全景声"/"臻品母带"）；另有 data.song/singer/mid/media_mid；
//   - 实测（2026-09-20，晴天/稻香/孤勇者 × 128k/320k/flac/master 共 12 次，Range 0-1024 探测）：
//     128k/320k mp3（ID3 头，3.5~10.8MB）、flac/master fLaC（master 24bit，153~187MB）全部真实
//     返回，VIP 歌（孤勇者）可播，单次取链 0.66-0.89s，链接 20s 后仍可拉取；
//   - 歌曲匹配校验：借鉴溯音音源 checkKwMatch 思路（plugins/溯音音源_v1.js），返回 song/singer
//     与请求曲名/歌手双向包含即命中（允许部分匹配）；不匹配 reject，让竞速自然接力下一通道；
//   - 音质档守门：data.tips 档位秩必须 ≥ 请求档位秩（防虚标），再过既有 verifyQualitySize
//     （Range 0-4095 魔数 + Content-Range/Content-Length 大小校验）；校验失败 reject，竞速继续；
//   - userVariables.qqAaaCab 设 off 可关闭本通道（默认开）。
var AAA_CAB_HOST = 'https://a.aa.cab/qq.music';
// tips 档位秩（守门用）：低品质 < 中品质 < SQ无损 < 臻品全景声 < 臻品母带
var AAA_CAB_TIPS_RANK = { '低品质': 0, '中品质': 1, 'SQ无损': 2, '臻品全景声': 3, '臻品母带': 4 };
// tips → actualQuality 如实标注（宿主展示口径；母带/全景声均为 24bit 级，标 flac24bit）
var AAA_CAB_TIPS_ACTUAL = { '低品质': '128k', '中品质': '320k', 'SQ无损': 'flac', '臻品全景声': 'flac24bit', '臻品母带': 'flac24bit' };

// [v1.9.13 方案A·拒绝虚标] 音质准入白名单：2026-09-21 实测该端点对未知/字符串音质码
// （type=128/320/flac/master 等 12 种）一律回落 C400 HQ m4a 虚标（约 3.28MB AAC，tips=「HQ 高品质」），
// 请求 flac/master 时同样返回 m4a，实际音质与请求无关——违背「请求哪个音质就获取哪个音质」总原则。
// 因此仅放行 ≤320k 已知档；flac/flac24bit/lossless/hires/master/atmos/atmos_51/jymaster/dolby/super
// 一律入口即拒绝（不发网络请求），由竞速池其他通道承担高音质取链。
// （atmos/jymaster/dolby 旧映射会静默落 128k 档，同属违背总原则，一并拒绝）
var AAA_CAB_ALLOWED_RE = /^(standard|128k|hq|mp3|aac|192k|higher|320k|exhigh)$/i;
// [v1.9.13] music URL 文件名路径前缀 → 实档识别（M500=128k mp3 / M800=320k mp3 / C400=m4a AAC；
// F000=FLAC / AI00=母带——本通道白名单已拒高音质请求，正常不应再出现 F000/AI00，出现也按秩校验拒绝）
var AAA_CAB_LOSSY_PREFIX = { M500: '128k', C400: '128k', M800: '320k' };
var AAA_CAB_PREFIX_RANK = { M500: 1, C400: 1, M800: 2 };
function aaaCabPrefixOf(url) {
  var m = String(url || '').match(/\/([A-Z]\d{3})[^/]*$/);
  return m ? m[1] : null;
}

// hostQuality → a.aa.cab 音质码（任务规范映射；内部档 super/192k 等按最近档归位）
function aaaCabTypeOf(hostQuality) {
  var q = String(hostQuality || '');
  if (/^(hires|master|flac24bit)$/i.test(q)) return 5;   // 臻品母带（24bit）
  if (/^(lossless|flac|super)$/i.test(q)) return 4;      // SQ 无损
  if (/^(exhigh|higher|320k|192k)$/i.test(q)) return 1;  // 320k
  return 0;                                              // standard/128k/hq 等
}

function qqAaaCabEnabled() {
  try { return String(userVariablesSafe().qqAaaCab || '').toLowerCase() !== 'off'; }
  catch (e) { return true; }
}

// 歌曲匹配（溯音音源 checkKwMatch 思路）：曲名/歌手双向包含即命中；歌手允许多歌手子集
// 部分匹配（请求歌手按「、/&/，,」等分隔，任一 ≥2 字片段被返回歌手包含即放行）。
function aaaCabSongMatch(apiSong, apiSinger, reqName, reqSinger) {
  var as = String(apiSong || '').toLowerCase();
  var ar = String(apiSinger || '').toLowerCase();
  var ns = String(reqName || '').toLowerCase().trim();
  var nr = String(reqSinger || '').toLowerCase().trim();
  if (ns && as && as.indexOf(ns) < 0 && ns.indexOf(as) < 0) return false;
  if (nr && ar && ar.indexOf(nr) < 0 && nr.indexOf(ar) < 0) {
    var toks = nr.split(/[、/&，,+]|\s+feat\.?\s+|\s+ft\.?\s+/i);
    var hit = false;
    for (var i = 0; i < toks.length; i++) {
      var t = String(toks[i] || '').trim();
      if (t.length >= 2 && ar.indexOf(t) >= 0) { hit = true; break; }
    }
    if (!hit) return false;
  }
  return true;
}

function resolveQqAaaCab(raw, hostQuality, musicItem) {
  if (!qqAaaCabEnabled()) return Promise.reject(new Error('qqAaaCab 已关闭'));
  var name = String((musicItem && musicItem.title) || '').trim();
  var singer = String((musicItem && musicItem.artist) || '').trim();
  if (!name) return Promise.reject(new Error('aaacab: no keyword (musicItem.title empty)'));
  // [v1.9.13 方案A] 音质准入白名单：flac/flac24bit/lossless/hires/master/atmos/atmos_51/jymaster/dolby/super
  // 一律入口即拒绝（不发网络请求）。2026-09-21 实测：该端点对高音质/未知音质码一律回落
  // C400 HQ m4a 虚标，实际音质与请求无关；拒绝后由竞速池其他通道承担高音质取链。
  if (!AAA_CAB_ALLOWED_RE.test(String(hostQuality || ''))) {
    return Promise.reject(new Error('aaacab: quality "' + hostQuality + '" not allowed (方案A 拒绝虚标，仅放行 ≤320k)'));
  }
  var type = aaaCabTypeOf(hostQuality);
  var url = AAA_CAB_HOST + '?msg=' + encodeURIComponent(name + (singer ? ' ' + singer : '')) + '&n=1&type=' + type;
  return axios.get(url, {
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var body = res.data;
    if (typeof body === 'string') {
      var t = body.trim();
      if (!t || t.charAt(0) !== '{') throw new Error('aaacab: non-json response');
      body = JSON.parse(t);
    }
    if (!body || typeof body !== 'object') throw new Error('aaacab: empty body');
    if (body.code !== 0) throw new Error('aaacab: code=' + body.code + ' (1=返回空，msg 为空或不合法)');
    var d = body.data || {};
    var cand = (typeof d.music === 'string' && /^https?:\/\//i.test(d.music)) ? d.music : null;
    if (!cand) throw new Error('aaacab: no music url');
    if (!isAllowedMediaUrl(cand)) throw new Error('aaacab: media url not in allowlist');
    // 歌曲匹配校验（不匹配 → reject 让竞速自然接力下一通道）
    if (!aaaCabSongMatch(d.song, d.singer, name, singer)) {
      throw new Error('aaacab: song mismatch (got ' + String(d.song || '?') + ' - ' + String(d.singer || '?') + ')');
    }
    // [v1.9.13 方案A·拒绝虚标] 双守门（fail-closed）：
    // ① 前缀门（主信号）：music URL 文件名路径前缀识别实档。白名单已限 ≤320k 请求，
    //    故仅接受 M500/C400（秩1，128k 档）与 M800（秩2，320k 档）；未知前缀一律拒绝。
    //    请求 320k（type=1）要求前缀秩 ≥2（只认 M800，不认 M500/C400 降档）。
    //    C400 为 m4a AAC，即便秩校验通过也会被 verifyQualitySize 魔数校验拒绝（ftyp 非音频魔数）。
    // ② tips 门（辅信号，fail-closed）：2026-09-21 实测虚标响应 tips=「HQ 高品质」，
    //    不在既有 tips 词表内——旧逻辑对未知 tips 跳过守门，正是本次虚标漏过的根因。
    //    新逻辑：未知 tips 一律拒绝；已知 tips 秩 < 请求秩同样拒绝。
    var prefix = aaaCabPrefixOf(cand);
    var prefixRank = prefix ? AAA_CAB_PREFIX_RANK[prefix] : undefined;
    if (!prefix || prefixRank === undefined) {
      throw new Error('aaacab: unknown url prefix (prefix=' + String(prefix || '?') + ', 方案A fail-closed)');
    }
    var reqRank = type; // 白名单后 type 仅 0(128k)/1(320k)，前缀秩需 ≥ type+1
    if (prefixRank < reqRank + 1) {
      throw new Error('aaacab: quality downgrade by prefix (prefix=' + prefix + ', want type=' + type + ')');
    }
    var tips = String(d.tips || '').trim();
    if (!tips || AAA_CAB_TIPS_RANK[tips] === undefined) {
      throw new Error('aaacab: unknown tips (tips=' + (tips || '(空)') + ', 方案A fail-closed 拒绝虚标)');
    }
    if (AAA_CAB_TIPS_RANK[tips] < reqRank) {
      throw new Error('aaacab: quality downgrade (tips=' + tips + ', want type=' + type + ')');
    }
    var out = {
      url: cand,
      // [v1.9.13] actualQuality 以前缀识别的实档为准（前缀 > tips > 请求档回退），宁低勿高
      actualQuality: AAA_CAB_LOSSY_PREFIX[prefix] || AAA_CAB_TIPS_ACTUAL[tips] || hostQualityToActual(hostQuality, type >= 1 ? '320k' : '128k'),
      channel: 'qq:aaacab'
    };
    // [v1.7.1 fix#2 同口径] 192k 请求按实档如实标下限（宁低勿高）
    if (out.actualQuality === '320k' && /^192k$/i.test(String(hostQuality || ''))) out.actualQuality = '192k';
    // [v1.9.12] verifyQualitySize 校验口径适配：既有 expectFlac 正则含 exhigh（历史口径），
    // 但 320k 实档为 MP3（2026-09-20 实测 ID3 头 8.9~10.8MB，任务证据表同），本通道
    // exhigh/higher 请求按 '320k' 传入校验（走 ID3/MPEG 魔数 + 2MB 下限分支），其余档原样透传。
    var verifyQ = /^(exhigh|higher)$/i.test(String(hostQuality || '')) ? '320k' : hostQuality;
    return verifyQualitySize(cand, verifyQ).then(function (vs) {
      if (vs && vs.total > 0) out.size = vs.total;
      return out;
    });
  }).catch(function (e) {
    if (e instanceof SyntaxError) throw new Error('aaacab: parse fail');
    throw e;
  });
}

// [v1.7.0 P0] 通道 2 备份 长青（175.27.166.236/kgqq1/qq.php）
// [v1.9.4 修复] 2026-09-11 探针实测：接口 200 OK 但 URL 恒返回同一 4.12MB M500000bYDlc2XxKLs.mp3，
// 响应的 *quality* 字段恒为「低音质 MP3」（与 q 形参无关）。修复策略：解析响应 *quality* 字段，
// 若与请求档不一致（v1.9.2 实际是响应的 quality 字段"低音质 MP3"恒真）则拒绝 → 走旁路；
// 只对 standard (128k) 请求放行。size 字段直读响应 *size* 字符串（如 "4.12 MB" → 4319232B）。
function resolveQqChangqing(raw, hostQuality) {
  if (!raw || !raw.mid) return Promise.reject(new Error('changqing: no mid'));
  // [v1.9.4] 音质守门：长青接口不论 q 为何只回 128k MP3，仅在请求为 standard/128k 时启用通道
  if (hostQuality !== 'standard' && hostQuality !== '128k' && hostQuality !== 'hq') {
    return Promise.reject(new Error('changqing skipped: 恒返回 128k MP3，请求档=' + hostQuality));
  }
  return axios.get('http://175.27.166.236/kgqq1/qq.php?ID=' + encodeURIComponent(String(raw.mid)) + '&q=128k', {
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var body = res.data;
    var d = body && body.data;
    var cand = d && typeof d.url === 'string' && /^https?:\/\//i.test(d.url) ? d.url : null;
    if (!cand) {
      var msg = (body && (body.msg || body.error)) || 'unknown';
      throw new Error('changqing: no url (msg=' + String(msg).slice(0, 60) + ')');
    }
    // [v1.9.4] 解析响应的 quality 字段：实测恒为「低音质 MP3」，与 q 形参无关；
    // 若不匹配（防止该通道被改为按需返回）按品质不符拒绝。
    var respQ = d && d.quality;
    if (respQ && respQ !== '低音质 MP3' && respQ !== '128k') {
      throw new Error('changqing: 响应 quality=' + respQ + ' 与请求 128k 不符');
    }
    // [v1.9.4] size 解析：响应 *size* 字符串如 "4.12 MB" → 字节数；解析失败留空（兜底 HEAD 探测）
    var size = 0;
    var sizeStr = d && d.size;
    if (typeof sizeStr === 'string') {
      var sm = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)$/i);
      if (sm) {
        var num = parseFloat(sm[1]);
        var unit = sm[2].toUpperCase();
        var mult = unit === 'GB' ? 1024 * 1024 * 1024
          : unit === 'TB' ? 1024 * 1024 * 1024 * 1024
          : unit === 'KB' ? 1024
          : unit === 'MB' ? 1024 * 1024
          : 1;
        size = Math.round(num * mult);
      } else if (/^\d+$/.test(sizeStr)) {
        size = parseInt(sizeStr, 10);
      }
    } else if (typeof sizeStr === 'number' && sizeStr > 0) {
      size = sizeStr;
    }
    var out = { url: cand, actualQuality: '128k', _channel: 'qq:changqing' };
    if (size > 0) out.size = size;
    return out;
  }).then(function (r) {
    return verifyQualitySize(r.url, hostQuality).then(function (vs) {
      // [v1.9.4] verifyQualitySize 已验真且带 total：未取到 inline size 时回填
      if (!r.size && vs && vs.total > 0) r.size = vs.total;
      return { url: r.url, actualQuality: r.actualQuality, channel: 'qq:changqing', size: r.size || 0 };
    });
  });
}

// [v1.7.0 P0] 通道 3 兜底 念心（mcp.nianxinxz.com/ceshi）
// [v1.9.4 失效] 2026-09-11 探针实测：https://mcp.nianxinxz.com/ceshi 整站 404 站点下线。
// 竞速池中移除（见 resolveQq race pool），保留函数体以备未来该端点恢复时复活。
function resolveQqNianxin(raw, hostQuality) {
  if (!raw || !raw.mid) return Promise.reject(new Error('nianxin: no mid'));
  return Promise.reject(new Error('nianxin channel disabled since 2026-09-11 (mcp.nianxinxz.com/ceshi 404 站点下线)'));
  /* ===== v1.7.0 ~ v1.9.2 旧实现（2026-09-11 失效）=====
  var tier = nianxinTierOf(hostQuality);
  var url = 'https://mcp.nianxinxz.com/ceshi/?type=tx&id=' + encodeURIComponent(String(raw.mid))
    + '&quality=' + encodeURIComponent(tier);
  return axios.get(url, {
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var body = res.data;
    var cand = null;
    if (body && typeof body === 'object') {
      if (typeof body.url === 'string' && /^https?:\/\//i.test(body.url)) cand = body.url;
      else if (body.data && typeof body.data.url === 'string' && /^https?:\/\//i.test(body.data.url)) cand = body.data.url;
      else if (body.code !== undefined && body.code !== 0 && body.code !== 200) {
        throw new Error('nianxin: code=' + body.code + ' msg=' + String(body.msg || '').slice(0, 60));
      }
    }
    if (!cand) {
      var preview = typeof body === 'string' ? body.slice(0, 80) : JSON.stringify(body).slice(0, 80);
      throw new Error('nianxin: no url (body=' + preview + ')');
    }
    return { url: cand, actualQuality: hostQualityToActual(hostQuality, tier), _channel: 'qq:nianxin' };
  }).then(function (r) {
    return verifyQualitySize(r.url, hostQuality).then(function () {
      return { url: r.url, actualQuality: r.actualQuality, channel: 'qq:nianxin' };
    });
  });
  ===== 旧实现结束 ===== */
}

// [v1.9.0 P0] 次合代 QQ 通道（s01s mid 直查形态，来源：BakaMusic/次合代聚合音源）：
// GET tang.api.s01s.cn/music_open_api.php?mid={mid} 免搜索精确命中，响应 JSON 携带
// song_play_url_sq/hq/standard/fq 四档直链（+ 通用 song_play_url 兜底字段）。
// 与既有 resolveQqS01s（搜索式）不同端点路径、不依赖搜索匹配，两形态独立生效。
// 实测（2026-09-10，晴天 mid=0039MnYb0qxYhV）：sq=fLaC 55397039B(~1647kbps) 1539ms。
// 字段序按请求档位取用（BakaMusic 原样）：master/flac→sq、320k→hq、128k→standard；
// song_play_url 实际档未知，宁低勿高标 128k。返回 URL 过 verifyQualitySize 魔数校验，
// 校验不过静默让路。userVariables.qqS01sMid 设 off 可关闭（默认开）。
// [v1.9.0 修正] 实测接口返回字段名为 song_play_url_sq / song_play_url_hq / song_play_url_standard /
// song_play_url_fq / song_play_url（base，BakaMusic cihedai/qq.js 原版同款优先级链）；
// 初版误写为 sq/hq/standard/fq 短名（接口无此字段，无损档会静默落到 base 128k），已按实测修正。
// [v1.9.4 扩档] 探针实测额外返回字段：
//   - song_play_url_pq（Q000 .flac，926kbps，29.72MB）= 24bit Hi-Res 通道；原 FIELD_ORDER 漏，
//     导致 master/hires 档落到 sq（16bit/44.1k）丢 24bit。本轮：master 首位加 pq（24bit 优先）。
//   - song_play_url_accom（O801 .ogg，689kbps，22.11MB）= Atmos 通道；master 次位加 accom。
//   - 每档对应 song_size_X_str 字段（如 song_size_sq_str: 55397039），可直读回填 size。
var S01S_MID_FIELD_ORDER = {
  master: ['song_play_url_pq', 'song_play_url_sq', 'song_play_url_accom', 'song_play_url', 'song_play_url_hq', 'song_play_url_standard', 'song_play_url_fq'],
  hires: ['song_play_url_pq', 'song_play_url_sq', 'song_play_url_accom', 'song_play_url', 'song_play_url_hq', 'song_play_url_standard', 'song_play_url_fq'],
  'flac24bit': ['song_play_url_pq', 'song_play_url_sq', 'song_play_url', 'song_play_url_hq', 'song_play_url_standard', 'song_play_url_fq'],
  flac: ['song_play_url_sq', 'song_play_url', 'song_play_url_hq', 'song_play_url_standard', 'song_play_url_fq'],
  '320k': ['song_play_url_hq', 'song_play_url', 'song_play_url_sq', 'song_play_url_standard', 'song_play_url_fq'],
  '128k': ['song_play_url_standard', 'song_play_url', 'song_play_url_hq', 'song_play_url_fq', 'song_play_url_sq']
};
// [v1.9.4] actualQuality 映射：pq → flac24bit（24bit 通道）、accom → flac（OGG 容器的 dolby 标 flac）
var S01S_MID_ACTUAL = {
  song_play_url_pq: 'flac24bit',
  song_play_url_sq: 'flac',
  song_play_url_accom: 'flac',
  song_play_url_hq: '320k',
  song_play_url_standard: '320k',
  song_play_url: '128k',
  song_play_url_fq: '128k'
};
function qqS01sMidEnabled() {
  try { return String(userVariablesSafe().qqS01sMid || '').toLowerCase() !== 'off'; }
  catch (e) { return true; }
}
function resolveQqS01sMid(raw, hostQuality) {
  if (!raw || !raw.mid) return Promise.reject(new Error('s01s-mid: no mid'));
  var tier = thirdPartyTierOf(hostQuality);
  return axios.get(S01S_HOST + 'music_open_api.php', {
    params: { mid: raw.mid },
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    validateStatus: function (s) { return s >= 200 && s < 300; }
  }).then(function (res) {
    var body = res.data;
    if (typeof body === 'string') {
      var t = body.trim();
      if (!t || t.charAt(0) !== '{') throw new Error('s01s-mid non-json response');
      body = JSON.parse(t);
    }
    var order = S01S_MID_FIELD_ORDER[tier] || S01S_MID_FIELD_ORDER['128k'];
    for (var fi = 0; fi < order.length; fi++) {
      var fk = order[fi];
      var u = body && body[fk];
      if (u && typeof u === 'string' && /^https?:\/\//i.test(u)) {
        // [v1.9.4] 直读 song_size_X_str 回填 size（如 song_size_sq_str: 55397039）
        var sizeKey = fk.replace(/^song_play_url_/, 'song_size_') + '_str';
        var size = parseInt(body[sizeKey], 10) || 0;
        var out = { url: u, actualQuality: S01S_MID_ACTUAL[fk] || '128k', _channel: 'qq:s01s-mid' };
        if (size > 0) out.size = size;
        return out;
      }
    }
    throw new Error('s01s-mid: no url for tier ' + tier);
  }).then(function (r) {
    return verifyQualitySize(r.url, hostQuality).then(function (vs) {
      // [v1.9.4] verifyQualitySize 已验真带 total：未取到 inline size 时回填
      if (!r.size && vs && vs.total > 0) r.size = vs.total;
      return { url: r.url, actualQuality: r.actualQuality, channel: 'qq:s01s-mid', size: r.size || 0 };
    });
  }).catch(function (e) {
    if (e instanceof SyntaxError) throw new Error('s01s-mid parse fail');
    throw e;
  });
}

// userVariables：qqEvkey（默认开，可设 off）/ qqCookie（可选）（v0.7.0 新增）
function userVariablesSafe() {
  var env = typeof global !== 'undefined' && global.env ? global.env : null;
  if (env && env.getUserVariables) {
    try { return env.getUserVariables() || {}; } catch (e) { /* 沙箱无 env */ }
  }
  return {};
}
// QQ Cookie（uin=xxx; qm_keyst=xxx）：附带在官方 GetVkey/GetEVkey 请求上，提升无损/加密档成功率
function qqCookieValue() {
  var ck = userVariablesSafe().qqCookie;
  return ck ? String(ck) : '';
}

function qqCookieHeaders(base) {
  // [v1.1.0 fix#4] 浅拷贝：不再原地改写传入对象（原实现会把用户 Cookie 永久写进共享
  // QQ_SEARCH_HEADERS，导致全部搜索/榜单/歌手/评论请求都带上凭据）
  var h = {};
  var k;
  for (k in (base || {})) {
    if (Object.prototype.hasOwnProperty.call(base, k)) h[k] = base[k];
  }
  var ck = qqCookieValue();
  if (ck) h.Cookie = ck;
  return h;
}

// ---------- [v1.6.1 P0] 登录态解析（借鉴 HotDownloader download.rs） ----------
// HD 把 uin/qq/authst 放 musicu 请求 comm 体（authst = qm_keyst = musickey），而非仅 Cookie 头；
// 探针实测该形态响应额外携带 sip CDN 列表（我方匿名形态 sip=[]），登录态下 purl 签发率更高。
// 插件沙箱不能起 QR 登录服务（HD 的 MQTT 扫码 + refresh_token 自动刷新依赖长驻进程），
// 凭据由用户手动填写：userVariables.qqAuthst/qqUin 优先，其次从 qqCookie 解析 qm_keyst/uin。
function qqLoginState() {
  var uv = userVariablesSafe();
  var authst = uv.qqAuthst ? String(uv.qqAuthst).trim() : '';
  var uin = uv.qqUin ? String(uv.qqUin).trim() : '';
  var cookie = qqCookieValue();
  if (cookie) {
    if (!authst) {
      var mk = /(?:^|;\s*)qm_keyst=([^;]+)/.exec(cookie);
      if (mk) authst = mk[1].trim();
    }
    if (!uin) {
      // Cookie uin 形如 uin=o12345 / wxuin=o12345（o 前缀为官方客户端惯例）；纯数字直取
      var mu = /(?:^|;\s*)(?:wxuin|uin)=o?(\d{5,})/i.exec(cookie);
      if (mu) uin = mu[1];
    }
  }
  if (!authst) return null;
  return { authst: authst, uin: uin || '0' };
}

// ---------- bugpk.com 聚合站备源（v1.1.0 接入，替代听会 HTTP 裸 IP 段） ----------
// GET /api/music?id=<mid>&media=tencent&type=song → M500 128k mp3 直链（QQ vkey 签名）。
// 2026-09-06 真实网络实测：免费歌《夜车》(004K51Fm1nVDqp) 返回 aqqmusic.tc.qq.com 直链，
// Range 验真 206 / Content-Range 0-0/3071362 / audio/mpeg；VIP/无版权歌返回
// {code:0,msg:"未找到对应数据"} 或「版权限制或该音乐不存在！」。单 IP 限速 2 QPS（429 有 retry_after）。
// 仅作链尾兜底（128k），actualQuality 如实标注；HTTPS 无签名无 Cookie。
function resolveQqBugpk(raw, quality) {
  if (!raw || !raw.mid) return Promise.reject(new Error('bugpk no mid'));
  return axios.get('https://api.bugpk.com/api/music', {
    params: { id: raw.mid, media: 'tencent', type: 'song' },
    timeout: chainSegTimeout(RELAY_TIMEOUT), // v0.7.1 P1-3：接力段超时 2500ms
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = res.data || {};
    var d = body.data || body;
    var url = d && d.url;
    if (!url || typeof url !== 'string' || url.indexOf('http') !== 0) {
      throw new Error('bugpk no url (' + String(body.msg || body.message || '').slice(0, 40) + ')');
    }
    // [v1.1.0] channel 字段：便于日志排查取链通道
    return { url: url, actualQuality: '128k', channel: 'qq:bugpk' };
  });
}

function randomGuid() {
  var s = '';
  var chars = '0123456789abcdef';
  for (var i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * 16));
  return s;
}

// [v1.6.0 P0] GetVkey 单请求 7 前缀批量查询（对齐 go-music-dl GetVkey 实现，comm cv=4747474）：
// 一次 RTT 同时下发 AI00/Q001/Q000/F000/O801/M800/M500 七个 filename（前缀+mediaMid+扩展名），
// 响应 data.midurlinfo 按 filename 一一对应，按请求档位允许的前缀集合选第一个有 purl 的条目。
// 2026-09-08 探针实测（数据中心 IP）：请求结构 code=0、midurlinfo 七条对齐返回；purl 签发与
// 出口 IP/边缘节点强相关——匿名全空时与旧单前缀实现一致交还上层接力，行为无损。
// 档位选序（不跨档降级，降级仍交由链内后续通道）：
//   super    → AI00(Master 母带) > Q001/Q000(Hi-Res/臻音) > F000(flac) > O801(atmos 全景声)
//   high     → M800(320k mp3)
//   standard → M500(128k mp3)
// [v1.6.1 P1·HD 13 档核实结论（不加档）] HotDownloader 13 档 filename 规则逐档核实：
//   C200/C400/C600(.m4a AAC 96k/192k/320k)、O4M0/O6M0(.mgg ogg 96k/192k) 均为已声明档位
//   的同内容封装（宿主按码率归一，无独立音质增量）；A000(.ape) 匿名实测 101404；
//   RSM1(.mflac hires) 匿名连 ekey 都不签发；AIM0(母带)/Q0M0/Q0M1(全景声) 特殊档用
//   vs 数组下标做 mediaMid（AIM0=vs[3]、Q0M0/Q0M1=vs[4]）+ size_new 取大小，匿名实测
//   ekey 可签发（704B）但 purl 被 104003 拦——需登录态才能全链验证，按「不能验证的不瞎加」
//   原则不声明；已填 qqAuthst 登录态的用户由本表 AI00 批量前缀覆盖母带/Hi-Res。
var QQ_BATCH_PREFIXES = [
  { prefix: 'AI00', ext: 'flac', tiers: ['super'], aq: 'flac' },
  { prefix: 'Q001', ext: 'flac', tiers: ['super'], aq: 'flac' },
  { prefix: 'Q000', ext: 'flac', tiers: ['super'], aq: 'flac' },
  { prefix: 'F000', ext: 'flac', tiers: ['super'], aq: 'flac' },
  { prefix: 'O801', ext: 'flac', tiers: ['super'], aq: 'flac' },
  { prefix: 'M800', ext: 'mp3', tiers: ['high'], aq: '320k' },
  { prefix: 'M500', ext: 'mp3', tiers: ['standard'], aq: '128k' }
];

// [v1.6.0 P0] 随机国内 IP 头（go-music-dl WithRandomIPHeader 同思路）：官方 GetVkey 的
// purl 签发与请求来源 IP 相关，数据中心 IP 匿名 purl 大概率全空；X-Forwarded-For 带随机
// 国内 IP 在部分边缘节点可命中（2026-09-08 探针实测 M500 purl 命中一次）。机会主义优化，
// 零成本零副作用，失败仍走原降级链。
var QQ_XFF_IP_POOL = ['116.25.146.177', '112.17.56.88', '219.136.87.4', '61.141.204.101',
  '183.62.115.9', '121.33.190.200', '113.108.238.51', '202.104.135.68', '58.62.53.77', '14.215.151.6'];

function randomDomesticIP() {
  return QQ_XFF_IP_POOL[Math.floor(Math.random() * QQ_XFF_IP_POOL.length)];
}

// ---------- QQ GetEVkey 加密档（v0.6.0，配合宿主 QMCv2 TEA 解密） ----------
// 文档 §3.3：CgiGetHotVkey 出 purl、GetEkey 出 ekey（~704 字符 base64 TEA 信封），
// 与宿主 Mp3UtilModule.decryptEKey 通道完全匹配，插件原样透传 ekey 即可。
// 数据中心 IP 下大概率 104003 风控（文档实测），失败自动接力明文备源。
var QQ_EV_HOSTS = [
  { base: 'https://ut.y.qq.com/cgi-bin/musicu.fcg', cv: '1803' },
  { base: 'https://u.y.qq.com/cgi-bin/musicu.fcg', cv: '0' }
];

function qqEvkeyRequest(hostConf, raw, filename) {
  // [v1.6.1 P0·借鉴 HD] 登录态注入 comm 体（匿名保持 v1.6.0 形态）
  var login = qqLoginState();
  var evComm = { ct: '19', cv: hostConf.cv, guid: randomGuid(), tmeAppID: 'qqmusic', qq: '0' };
  if (login) {
    evComm.uin = login.uin;
    evComm.qq = login.uin;
    evComm.authst = login.authst;
  }
  var body = {
    comm: evComm,
    req_vkey: {
      module: 'music.vkey.GetEVkey', method: 'CgiGetHotVkey',
      param: { filename: [filename], songmid: [raw.mid] }
    },
    req_ekey: {
      module: 'music.vkey.GetEVkey', method: 'GetEkey',
      param: { finfo: [{ filename: filename, mid: raw.mid }] }
    }
  };
  return axios.post(hostConf.base, body, {
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    headers: qqCookieHeaders({
      'User-Agent': 'HotDownloader/1.0', Referer: 'https://y.qq.com/',
      'Content-Type': 'application/json'
    })
  }).then(function (res) {
    var rd = res.data || {};
    var urls = rd.req_vkey && rd.req_vkey.data && rd.req_vkey.data.urls;
    var purl = urls && urls[0] && urls[0].purl;
    if (!purl) throw new Error('qq evkey no purl');
    // [v1.6.1 P0·借鉴 HD] sip 动态前缀（同 resolveQqPlainOfficial；EVkey 响应无 sip 时落默认）
    var sipPrefix = 'https://wx.music.tc.qq.com/';
    var evSip = rd.req_vkey.data.sip && rd.req_vkey.data.sip[0];
    if (evSip && typeof evSip === 'string' && /^https?:\/\//i.test(evSip) && isAllowedMediaUrl(evSip)) {
      sipPrefix = evSip.charAt(evSip.length - 1) === '/' ? evSip : evSip + '/';
    }
    var infos = rd.req_ekey && rd.req_ekey.data && rd.req_ekey.data.ekeyinfo;
    var ekey = infos && infos[0] && infos[0].ekey;
    var out = { url: sipPrefix + String(purl), channel: 'qq:evkey' };
    // [v0.7.2 fix#10] actualQuality：F0M0 加密档为无损（ekey 为空时是明文 flac，同为无损）
    out.actualQuality = 'flac';
    // ekey 为空（如部分 RSM1）= 明文 flac，无需宿主解密
    if (ekey) out.ekey = String(ekey);
    return out;
  });
}

function qqEvkeyEnabled() {
  var env = typeof global !== 'undefined' && global.env ? global.env : null;
  if (env && env.getUserVariables) {
    try {
      var uv = env.getUserVariables();
      if (uv && String(uv.qqEvkey).toLowerCase() === 'off') return false;
    } catch (e) { /* 默认开启 */ }
  }
  return true;
}

// ==================== [v1.3.6] 酷我官方接口全音质兜底 ====================
// 职责变更：QQ 链内 96k 降级兜底段（HYW/xcvts/玉宁熙）全部摘除，链尾改接酷我官方
// 通道——全音质（standard 128k / high 320k / super 2000kflac），不再降级。
// 曲目映射：QQ 歌名+歌手 关键词搜索酷我 → 首个命中 rid。实现移植自 kuwo-source
// .plugin v1.4.3（DES 核心 + convert_url_with_sign + mobi.s DES-ECB，2026-09-06 实测
// 验真：VIP rid=228908 晴天 未登录 2000kflac 明文直链；DES 与 Python 参考实现对拍一致）。
// 以下为酷我自定义 DES 纯 JS 实现（非标准 E 扩展表，密钥 ylzsxkwm，无 Buffer/BigInt 依赖）：

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

// ---------- [v1.3.6] 酷我适配层：QQ 曲目 → rid 搜索映射 + 官方通道解析 ----------
// 多通道竞速（首个合法结果胜出）：standard/high 走 convert_url_with_sign 三通道，
// super 加 mobi.s DES-ECB（std + car 双渠道，实测可解未登录给不出/给试听的无损档）。
// 校验规则沿用 kuwo 插件：无损必须回 flac、high 必须 mp3（拒 ogg 降级档）、
// duration<60s 视为试听片段拒收；actualQuality 按响应 bitrate 如实标注。
function kuwoRaceSuccess(promises) {
  return new Promise(function (resolve, reject) {
    if (!promises.length) { reject(new Error('kuwo no racers')); return; }
    var failed = 0;
    promises.forEach(function (p) {
      Promise.resolve(p).then(resolve, function () {
        failed++;
        if (failed === promises.length) reject(new Error('kuwo all racers failed'));
      });
    });
  });
}

var KUWO_BR = { low: '48kaac', standard: '128kmp3', high: '320kmp3', super: '2000kflac' };

// [v1.4.0] 同曲严格校验（2026-09-08 追加约束：同曲校验不通过的结果，再快也不能用）。
// 第一步先拆分核心歌名与版本标签（不能混在一起比），第二步逐项校验：
// 核心名一致 / 版本标签数量与类型一一对应 / 歌手任一匹配 / 时长差 ≤10%。

// 版本标签关键词 → 规范类型。同义写法归并为同一类型（如 Live/现场版/演唱会/纯享版
// 均为 live），比对按规范类型集合进行；「原版」按约束等价于无标签（剥除后不计入标签集）。
var KW_VERSION_KEYWORDS = [
  ['live',        ['live版', '现场版', '演唱会版', '演唱会', '纯享版', 'live']],
  ['instrumental',['伴奏版', '伴奏', '纯音乐版', '纯音乐', 'instrumental']],
  ['remix',       ['remix版', 'remix', '混音版', '混音']],
  ['dj',          ['dj版', 'dj']],
  ['cover',       ['翻唱版', '翻唱', 'cover版', 'cover']],
  ['movie',       ['电影版', '电影']],
  ['tv',          ['电视剧版', '电视剧']],
  ['clip',        ['片段', '节选']],
  ['ring',        ['铃声版', '铃声']],
  ['spatial',     ['3d环绕', '环绕版', '环绕', '3d']],
  ['piano',       ['钢琴版', '钢琴', 'piano版', 'piano']],
  ['guitar',      ['吉他版', '吉他']],
  ['female',      ['女声版', '女声']],
  ['male',        ['男声版', '男声']],
  ['child',       ['童声版', '童声']],
  ['full',        ['完整版']]
];
// 等价「原版/无标签」的写法：剥除，不计入版本标签
var KW_ORIGINAL_KEYWORDS = ['原版', '原曲版'];

// 在已归一 token 末尾找最长的命中关键词（ASCII 关键词要求左边界非字母数字，
// 防止 Delivery/unlive 之类的词内误切）。返回 {type, len} 或 null；type='original' 表示原版。
function kwMatchAtTail(token) {
  var best = null;
  function consider(kw, type) {
    if (!kw || token.length < kw.length || token.slice(token.length - kw.length) !== kw) return;
    if (token.length > kw.length) {
      var prev = token.charAt(token.length - kw.length - 1);
      if (/[a-z0-9]/.test(kw.charAt(0)) && /[a-z0-9]/.test(prev)) return; // 词内误切
    }
    if (!best || kw.length > best.len) best = { type: type, len: kw.length };
  }
  for (var i = 0; i < KW_VERSION_KEYWORDS.length; i++) {
    var vars = KW_VERSION_KEYWORDS[i][1];
    for (var j = 0; j < vars.length; j++) consider(vars[j], KW_VERSION_KEYWORDS[i][0]);
  }
  for (var k = 0; k < KW_ORIGINAL_KEYWORDS.length; k++) consider(KW_ORIGINAL_KEYWORDS[k], 'original');
  return best;
}

// 第一步：拆分核心歌名与版本标签。归一化后（小写、括号/常见标点转空格）从末尾往前
// 逐 token 提取版本标签，可连续提取多个（含连写如"live伴奏版"、"晴天 Live 伴奏版"），
// 剩下的作为核心歌名（仅保留字母数字与 CJK，全等比较）。
function kuwoVersionSplit(rawTitle) {
  var t = String(rawTitle || '').toLowerCase()
    // 标题尾部的 feat./ft./featuring 段先剥除（QQ 标题常带 "(feat. X)"，酷我标题不带；
    // 不剥会污染核心名导致误判不同曲），只剥尾部一段、不伤中间正文
    .replace(/\s*\b(?:featuring|feat|ft)\.?\b[\s\S]*$/i, '')
    .replace(/[（(【\[{〔]/g, ' ')
    .replace(/[）)】\]}〕]/g, ' ')
    .replace(/[\s·・~～_\-—–|｜:：、,，.。!！?？'""「」『』·]+/g, ' ')
    .trim();
  var tokens = t ? t.split(' ') : [];
  var tags = [];
  var idx = tokens.length - 1;
  while (idx >= 0) {
    var m = kwMatchAtTail(tokens[idx]);
    if (!m) break;
    if (m.type !== 'original') tags.push(m.type);
    var rest = tokens[idx].slice(0, tokens[idx].length - m.len).replace(/[·・_\-—–|｜]+$/g, '');
    if (rest) { tokens[idx] = rest; } else { idx--; } // 连写标签继续在同 token 内剥
  }
  var core = tokens.slice(0, idx + 1).join('').replace(/[^0-9a-z\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, '');
  var seen = {}, out = [];
  for (var k = 0; k < tags.length; k++) { if (!seen[tags[k]]) { seen[tags[k]] = 1; out.push(tags[k]); } }
  return { core: core, tags: out };
}

// 歌手规范化集合：剥 feat./ft./&/、/，/,///;/与/和/× 等分隔符后逐个歌手归一（小写、
// 去空格与标点），返回去重数组（空集时视为未提供歌手）。
function kuwoArtistSet(raw) {
  var s = String(raw || '').toLowerCase().replace(/\(\s*feat[\s\S]*?\)/g, ' ');
  var parts = s.split(/\s*(?:、|，|,|\/|&|;|；|\bfeat\.?|\bfeaturing\b|\bft\.?|和|与|×)\s*/);
  var seen = {}, out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].replace(/[^0-9a-z\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, '');
    if (p && !seen[p]) { seen[p] = 1; out.push(p); }
  }
  return out;
}

// 第二步：逐项校验。全部通过返回 {ok:true}；任一不过返回 {ok:false, reason}。
// 时长口径：QQ 侧与酷我侧均有有效时长（>0）才比，差距 >10% 判不同曲；缺任一方则跳过该项。
function kuwoSameTrackCheck(qqItem, cand) {
  var a = kuwoVersionSplit(qqItem && (qqItem.title || qqItem.name));
  var b = kuwoVersionSplit(cand && cand.title);
  if (!a.core || !b.core) return { ok: false, reason: 'core-title-empty: [' + (a.core || b.core) + ']' };
  if (a.core !== b.core) return { ok: false, reason: 'core-title-mismatch: [' + a.core + '] vs [' + b.core + ']' };
  var ta = a.tags.slice().sort().join('+');
  var tb = b.tags.slice().sort().join('+');
  if (ta !== tb) return { ok: false, reason: 'version-tag-mismatch: [' + ta + '] vs [' + tb + ']' };
  var aa = kuwoArtistSet(qqItem && qqItem.artist);
  var ba = kuwoArtistSet(cand && cand.artist);
  var hit = '';
  for (var i = 0; i < aa.length && !hit; i++) {
    for (var j = 0; j < ba.length; j++) {
      if (aa[i] === ba[j]) { hit = aa[i]; break; }
    }
  }
  if (!hit) return { ok: false, reason: 'artist-mismatch: [' + aa.join('|') + '] vs [' + ba.join('|') + ']' };
  var dq = parseInt(qqItem && qqItem.duration, 10) || 0;
  var dk = parseInt(cand && cand.duration, 10) || 0;
  if (dq > 0 && dk > 0 && Math.abs(dq - dk) / dq > 0.10) {
    return { ok: false, reason: 'duration-mismatch: qq=' + dq + 's kuwo=' + dk + 's (>10%)' };
  }
  return { ok: true, reason: '' };
}

// 搜索酷我候选（rn=20 相关度序，不在此截断）：返回 [{rid,title,artist,duration}]，
// 同曲校验放在调用侧（取链之前）——校验不通过的候选直接跳过，不参与取链。
function searchKuwoCandidates(query) {
  return axios.get('https://www.kuwo.cn/search/searchMusicBykeyWord', {
    params: {
      all: query, pn: 0, rn: 20, ft: 'music', client: 'kt',
      encoding: 'utf8', rformat: 'json', mobi: 1, vipver: 1, cluster: 0,
      strategy: 2012, issubtitle: 1, show_copyright_off: 1, correct: 1,
      spPrivilege: 0, newver: 2, p2p: 1, notrace: 0, searchapi: 2, vermerge: 1
    },
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    headers: { Referer: 'https://www.kuwo.cn/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var list = (res.data && res.data.abslist) || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var rid = String(it.MUSICRID || '').replace(/^MUSIC_/, '');
      if (!rid) continue;
      out.push({
        rid: rid,
        title: String(it.NAME || it.SONGNAME || ''),
        artist: String(it.ARTIST || ''),
        duration: parseInt(it.DURATION, 10) || 0
      });
    }
    if (!out.length) throw new Error('kuwo search no rid');
    return out;
  });
}

// 同曲筛选：取第一个通过严格同曲校验的候选 rid（相关度序）；全部不通过则抛错——
// 酷我通道整体退出竞速，由其他通道/降级链接力。错误消息带首个候选的拒绝原因供排查。
function pickKuwoRid(musicItem, candidates) {
  var firstReason = '';
  for (var i = 0; i < candidates.length; i++) {
    var chk = kuwoSameTrackCheck(musicItem, candidates[i]);
    if (chk.ok) return candidates[i].rid;
    if (!firstReason) {
      firstReason = 'candidate#0 "' + candidates[i].title + ' / ' + candidates[i].artist + '": ' + chk.reason;
    }
  }
  throw new Error('kuwo same-track check failed (' + candidates.length + ' candidates): ' + firstReason);
}

// 官方 convert_url_with_sign 通道（nmobi/nmsublist 全参数同构 + mobi 车载免签变体）
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
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
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
    if (d.duration && d.duration > 0 && d.duration < 60) throw new Error('kuwo official trial snippet');
    var aq = (d.format === 'flac') ? 'flac'
      : (d.bitrate >= 320 ? '320k' : (d.bitrate >= 192 ? '192k' : '128k'));
    return { url: String(d.url), actualQuality: aq };
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
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
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
    return { url: url, actualQuality: aq };
  });
}

// [v1.3.6→v1.4.0] 全音质兜底/并行竞速路：搜索映射 rid（严格同曲校验前置）→ 按档位竞速官方通道。
// standard：128kmp3×3 racer；high：320kmp3×3（ogg 降级拒收）；super/hires：
// DES flac（std+car）+ convert_url_with_sign 2000kflac×3（试听片段拒收）。
// 返回 channel='kuwo:official'；kuwo CDN 均为 https，过 isAllowedMediaUrl 白名单。
function resolveKuwoFallback(musicItem, quality) {
  var title = musicItem && (musicItem.title || musicItem.name) ? String(musicItem.title || musicItem.name) : '';
  var artist = musicItem && musicItem.artist ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('kuwo fallback no keyword'));
  var q = artist ? title + ' ' + artist : title;
  var isLossless = quality === 'super' || quality === 'hires';
  // [v1.4.0] 同曲严格校验前置：搜候选 → 逐项校验（核心名/版本标签/歌手/时长）→
  // 通过者才进入取链竞速；全部不通过则酷我通道整体退出（抛错由竞速语义接力）。
  return searchKuwoCandidates(q).then(function (candidates) {
    return pickKuwoRid(musicItem, candidates);
  }).then(function (rid) {
    var jobs;
    if (isLossless) {
      jobs = [
        kuwoDesResolve(rid, 'super', 'std'),
        kuwoDesResolve(rid, 'super', 'car'),
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, 'super'),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, 'super', 'car')
      ];
    } else {
      jobs = [
        kuwoOfficialResolve('nmobi.kuwo.cn', rid, quality),
        kuwoOfficialResolve('nmsublist.kuwo.cn', rid, quality),
        kuwoOfficialResolve('mobi.kuwo.cn', rid, quality, 'car')
      ];
    }
    return kuwoRaceSuccess(jobs);
  }).then(function (r) {
    // [v1.4.0] 酷我接口实测会返回 http 直链（car-er/kw-er.kuwo.cn），而本插件 http 白名单
    // 自 v1.1.0 fix#5 起已收口（不含 .kuwo.cn），http 直链会在 resolveWithFallback 白名单
    // 校验被拒→整链失败。统一升级 https（2026-09-08 探针实证 kw-er/car-er https 206
    // audio/mpeg 全长可达，与听会通道同域 https 先例一致），不放开 http 白名单。
    var u = /^http:\/\//i.test(r.url) ? r.url.replace(/^http:\/\//i, 'https://') : r.url;
    return { url: u, actualQuality: r.actualQuality, channel: 'kuwo:official' };
  });
}

// ---------- [v1.3.7] 咪咕官方接口全音质兜底（酷我之后第二级链尾） ----------
// 主通道为 h5/v2.4 加密取链（用户指定"h2.5 那个接口"，即参考咪咕插件的 h5v2.4 主通道），
// listen-url v2.1 / listen-song 302 两个免解密明文通道作竞速备选。曲名+歌手搜索
// search_all.do → 首个 contentId/copyrightId。实测（咪咕插件 probe4，2026-09-06）：
// 未登录对 VIP 歌出 PQ 全曲（晴天 4,317,311B audio/mpeg）。
// 音质派生（咪咕 URL 规律）：PQ 基链上 high=MP3_320 同路径必存在（免探测）；
// super=歌曲下载目录+flac，存在性独立必须 Range 探测，探测不过逐级回落 320k/128k
// （actualQuality 按最终 URL 如实标注，宁低勿高）。
// ftp://218.200.160.122:21/ 前缀统一替换 https://freetyst.nf.migu.cn/（过白名单）。
var H5V24_KEY = 'Jk8qzuePiJ1qE3mDYhLQ3T73DtDoAhLP';
var MIGU_FTP_PREFIX = 'ftp://218.200.160.122:21/';
var MIGU_HTTP_PREFIX = 'https://freetyst.nf.migu.cn/';
var MIGU_DIR_CN_PQ = '%E6%A0%87%E6%B8%85%E9%AB%98%E6%B8%85';   // 标清高清
var MIGU_DIR_CN_DL = '%E6%AD%8C%E6%9B%B2%E4%B8%8B%E8%BD%BD'; // 歌曲下载

function searchMiguCid(query) {
  return axios.get('https://pd.musicapp.migu.cn/MIGUM2.0/v1.0/content/search_all.do', {
    params: {
      ua: 'Android_migu', version: '5.0.1', text: query,
      pageNo: 1, pageSize: 20, searchSwitch: '{"song":1,"album":0,"singer":0,"tagSong":0,"mvSong":0,"songlist":0,"bestShow":0}'
    },
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    headers: { Referer: 'https://music.migu.cn/' }
  }).then(function (res) {
    var srd = res.data && res.data.songResultData;
    var list = (srd && srd.result) || [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it && it.contentId && it.copyrightId) {
        return { contentId: String(it.contentId), copyrightId: String(it.copyrightId) };
      }
    }
    throw new Error('migu search no cid');
  });
}

// h5v2.4 响应解密：魔数 AB CD 01 + 偏移字节，(byte + offset - key[i%32]) & 0xFF → JSON
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

function miguNormalizeUrl(u) {
  var s = String(u || '').replace(MIGU_FTP_PREFIX, MIGU_HTTP_PREFIX);
  // 最小编码：只对裸露的非 ASCII / 空格等非法字符补编码，保留已有 %xx
  // （整段 encodeURIComponent 会把 https: 编成 https%3A 造成双重编码——咪咕插件实测踩过）
  return s.replace(/[^A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]/g, function (c) {
    return encodeURIComponent(c);
  });
}

// 避免「请求无损但上游未给 flac 特征 URL」时虚报无损
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

function deriveMiguUrl(pqUrl, quality) {
  if (quality === 'standard' || String(pqUrl).indexOf('freetyst.nf.migu.cn') < 0) return pqUrl;
  if (quality === 'high') {
    // 规律①：HQ 与 PQ 同路径必存在，免探测
    return pqUrl.replace('MP3_128_16_Stero', 'MP3_320_16_Stero');
  }
  if (quality === 'super') {
    // 规律：SQ = 歌曲下载目录 + flac 编码；存在性独立 → 上层必须 Range 探测
    return pqUrl
      .replace(MIGU_DIR_CN_PQ, MIGU_DIR_CN_DL)
      .replace('MP3_128_16_Stero', 'flac')
      .replace(/\.mp3(\?|$)/, '.flac$1');
  }
  return pqUrl;
}

function miguProbeExists(url) {
  return axios.get(url, {
    timeout: chainSegTimeout(2500),
    headers: { Range: 'bytes=0-0', Referer: 'https://music.migu.cn/' },
    responseType: 'arraybuffer'
  }).then(function (res) {
    if (res.status === 206) return true;
    if (res.status === 200 && !/text\/html/i.test(String(res.headers && (res.headers['content-type'] || res.headers['Content-Type'] || '')))) return true;
    throw new Error('migu probe http ' + res.status);
  });
}

// 主通道：strategy/listen-url/h5/v2.4 加密取链（用户指定通道）
var MIGU_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
function miguH5Resolve(miguRaw) {
  var url = 'https://c.musicapp.migu.cn/strategy/listen-url/h5/v2.4' +
    '?contentId=' + encodeURIComponent(miguRaw.contentId) +
    '&copyrightId=' + encodeURIComponent(miguRaw.copyrightId) +
    '&resourceType=2&netType=01&toneFlag=PQ&scene=' +
    '&lowerQualityContentId=' + encodeURIComponent(miguRaw.contentId);
  return axios.get(url, {
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    responseType: 'arraybuffer',
    headers: {
      birth: 'h5page', channel: '014X031',
      Referer: 'https://y.migu.cn/',
      'location-data': '30.6698676660,104.1229614820',
      'location-info': '',
      'User-Agent': MIGU_UA
    }
  }).then(function (res) {
    var data = decryptH5v24(new Uint8Array(res.data));
    if (!data || data.code !== '000000' || !data.data || !data.data.url) {
      throw new Error('migu h5 no url');
    }
    return miguNormalizeUrl(data.data.url);
  });
}

// 备选通道 A：listen-url v2.1 App 通道（JSON 直出）
function miguAppResolve(miguRaw) {
  return axios.get('https://app.c.nf.migu.cn/MIGUM2.0/v2.1/content/listen-url', {
    params: { netType: '01', resourceType: '2', contentId: miguRaw.contentId, copyrightId: miguRaw.copyrightId, toneFlag: 'PQ' },
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    headers: { channel: '0146832', version: '7.41.13', Referer: 'https://app.c.nf.migu.cn/', 'User-Agent': MIGU_UA }
  }).then(function (res) {
    var d = res.data && res.data.data;
    if (!d || !d.url) throw new Error('migu-app no url');
    return miguNormalizeUrl(d.url);
  });
}

// 备选通道 B：listen-song/v2.3 302 跳转口（Location 直指 freetyst 真实 mp3）
function migu305Resolve(miguRaw) {
  return axios.get('https://c.musicapp.migu.cn/strategy/listen-song/v2.3', {
    params: { toneFlag: 'PQ', copyrightId: miguRaw.copyrightId, contentId: miguRaw.contentId, resourceType: '2', channel: '0146921' },
    timeout: chainSegTimeout(SOURCE_TIMEOUT), maxRedirects: 0, validateStatus: null,
    headers: { 'User-Agent': 'okhttp/3.14.9', Referer: 'https://music.migu.cn/' }
  }).then(function (res) {
    var loc = res.headers && (res.headers.location || res.headers.Location);
    if (res.status < 300 || res.status >= 400 || !loc) {
      throw new Error('migu-305 no redirect (status ' + res.status + ')');
    }
    return miguNormalizeUrl(loc);
  });
}

// [v1.3.7] 咪咕官方全音质兜底（酷我之后第二级链尾）：
// 搜索映射 cid → h5v2.4 主通道 + v2.1/302 备选竞速取 PQ 基链 → 按档位派生
// （super 探测 flac 不过则逐级回落）。channel='migu:official'；freetyst CDN 均 https，
// 过 isAllowedMediaUrl 白名单。
function resolveMiguFallback(musicItem, quality) {
  var title = musicItem && (musicItem.title || musicItem.name) ? String(musicItem.title || musicItem.name) : '';
  var artist = musicItem && musicItem.artist ? String(musicItem.artist) : '';
  if (!title) return Promise.reject(new Error('migu fallback no keyword'));
  var q = artist ? title + ' ' + artist : title;
  return searchMiguCid(q).then(function (miguRaw) {
    return kuwoRaceSuccess([miguH5Resolve(miguRaw), miguAppResolve(miguRaw), migu305Resolve(miguRaw)]);
  }).then(function (pqUrl) {
    // 档位派生：standard=PQ 原样；high=320 同路径必在；super=flac 探测不过逐级回落
    var url = deriveMiguUrl(pqUrl, quality);
    if (quality === 'super') {
      return miguProbeExists(url).then(function () {
        return { url: url, actualQuality: 'flac' };
      }, function () {
        var u2 = deriveMiguUrl(pqUrl, 'high');
        return { url: u2, actualQuality: miguActualQuality(u2) };
      });
    }
    return { url: url, actualQuality: miguActualQuality(url) };
  }).then(function (r) {
    r.channel = 'migu:official';
    return r;
  });
}

function resolveQq(raw, quality, musicItem, hostQuality) {
  // [v1.1.0 fix#1] 签名补第 3 参 musicItem：s01s 搜索式备源靠 title/artist 关键词搜索，
  // 原实现未接收 musicItem，链上 musicItem 恒为 undefined → s01s 段必然 no keyword 失效。
  // [v1.4.0] 并行竞速改造：酷我官方与海棠第三方由「链尾串行/慢路径对冲」提前为入口同时
  // 发起，与 QQ 自身串行链三路竞速（kuwoRaceSuccess 首个有效结果胜出；慢路不 cancel、
  // 结果丢弃）。三路均为入口创建的共享 Promise——QQ 链内海棠对冲段与酷我链尾兜底段
  // 等待同一在途结果，不重发请求；三路全败时 QQ 链继续原降级逻辑（含咪咕二级兜底），
  // 试听检测/音质校验/负缓存/全局预算均不变。
  // [v1.7.0 P1] hostQuality：宿主原始 quality 键（standard/higher/exhigh/lossless/hires/master...），
  // 用于第三方通道音质映射选择。内部三档（standard/high/super）保留用于官方链。
  var hq = hostQuality || (quality === 'super' ? 'flac' : quality === 'high' ? '320k' : '128k');
  var haitangHedge = resolveHaitang('tx', raw.mid, quality);
  var kuwoHedge = resolveKuwoFallback(musicItem, quality);
  function hedgeHaitang() { return haitangHedge; }
  function hedgeKuwo() { return kuwoHedge; }
  // [v1.6.0 P1 -> v1.9.5] VIP 预判：pay.payplay 语义改存条目 _src.qq.vip 内部字段
  // （v1.9.5 起 fee 不再透传；兼容旧缓存条目仍读 fee）。匿名环境（无 Cookie）下官方通道
  // 对 VIP 歌只会 104003 拒发或试听片段，提前跳过官方段直接进第三方链（酷我/海棠对冲
  // 已在途共享在途结果，不重发），省 1~2 段无效 RTT。
  var qqVipFlag = musicItem && musicItem._src && musicItem._src.qq ? musicItem._src.qq.vip : undefined;
  var vipPreRoute = !!(musicItem && !qqCookieValue() && (qqVipFlag === 1 || musicItem.fee === 1));
  // QQ 自身串行链：酷我/海棠兜底段改为等待入口共享在途结果（含其在途失败，不重发）
  function qqSerialChain() {
    // ⓪ super 档先走 GetEVkey 加密档（F0M0 mflac + ekey，宿主原生解密）
    // [v1.6.0 P1] VIP 预判命中时跳过 EVkey 段（官方对匿名 VIP 歌必拒）
    if (quality === 'super' && raw.mediaMid && qqEvkeyEnabled() && !vipPreRoute) {
      var filename = 'F0M0' + raw.mediaMid + '.mflac';
      var tryEv = function (hi) {
        if (hi >= QQ_EV_HOSTS.length) return Promise.reject(new Error('qq evkey all hosts failed'));
        return qqEvkeyRequest(QQ_EV_HOSTS[hi], raw, filename).catch(function () { return tryEv(hi + 1); });
      };
      return tryEv(0)
        // ① 官方 CgiGetVkey 明文通道（真机家宽 IP 可用；数据中心 IP 实测 104003）
        .catch(function () { return resolveQqPlainOfficial(raw, quality); })
        // ② UrlGetVkey 小米通道（v1.1.0 接口扩充·高优3，官方明文同族备源）
        .catch(function () { return resolveQqUrlGetVkey(raw, quality); })
        // ③ vkeys.cn 免费全音质备源（VIP 歌返回试听会被拒收接力）[v1.4.0] 海棠对冲已在途
        .catch(function () { return resolveQqVkeys(raw, quality); })
        // ④ s01s 搜索式备源（站点失效时严格校验快速失败）
        .catch(function () { return resolveQqS01s(raw, quality, musicItem); })
        // ⑤ 海棠 resolve-url 兜底（HTTPS）[v1.1.0 fix#5] 剔除听会 HTTP 裸 IP 段
        //    [v1.4.0] 等待入口共享在途结果（含其在途失败，不重发）
        .catch(function () { return hedgeHaitang(); })
        // ⑥ bugpk.com 兜底（HTTPS，128k）[v1.1.0 fix#5]
        .catch(function () { return resolveQqBugpk(raw, quality); })
        // ⑦ [v1.3.6→v1.4.0] 酷我官方兜底：等待入口共享在途竞速结果（不重发）
        .catch(function () { return hedgeKuwo(); })
        // ⑧ [v1.3.7] 二级链尾兜底：咪咕官方取链（h5/v2.4 为主，全音质派生）
        .catch(function () { return resolveMiguFallback(musicItem, quality); });
    }
    // [v1.6.0 P1] VIP 预判命中时跳过官方明文段（super 跌落此路径时同样生效）
    var head = vipPreRoute
      ? Promise.reject(new Error('qq vip preroute: official segs skipped'))
      : resolveQqPlainOfficial(raw, quality);
    return head
      .catch(function () { return resolveQqUrlGetVkey(raw, quality); })
      // ③ [v1.3.1] vkeys 旧版通道（VIP 歌给全长 M500/M800，优于 /v2 的试听拒收路径）
      .catch(function () { return resolveQqVkeysLegacy(raw, quality); })
      // [v1.3.5→v1.4.0] vkeys旧版失败即确认慢路径：海棠对冲已在途，直接等待（不重发）
      .catch(function () { return resolveQqVkeys(raw, quality); })
      .catch(function () { return resolveQqS01s(raw, quality, musicItem); })
      // [v1.3.5→v1.4.0] 海棠：等待入口共享在途结果（含其在途失败，不重发）
      .catch(function () { return hedgeHaitang(); })
      .catch(function () { return resolveQqBugpk(raw, quality); })
      // ⑤ [v1.3.1→v1.3.4] 听会代理（酷我CDN HTTPS 直链，全长与 qualities.size 一致）降位至此
      .catch(function () { return resolveQqTinghui(raw, quality); })
      // [v1.3.3→v1.3.6] cyapi 仅 high 档保留（M800 320k 与 qualities.size 一致，非降级）；
      // standard 档其固定返回 96k（属降级兜底），本轮摘除
      .catch(function () {
        if (quality === 'high') return resolveQqCyapi(raw, quality);
        throw new Error('cyapi skipped: standard 96k downgrade removed in v1.3.6');
      })
      // [v1.3.6→v1.4.0] 酷我官方兜底：等待入口共享在途竞速结果（不重发）
      .catch(function () { return hedgeKuwo(); })
      // [v1.3.7] 二级链尾兜底：咪咕官方取链（h5/v2.4 为主，全音质派生）
      .catch(function () { return resolveMiguFallback(musicItem, quality); });
  }
  // [v1.4.0] 三路并行竞速：QQ 串行链 + 酷我官方 + 海棠第三方，首个有效结果胜出；
  // 慢路不 cancel，在途结果丢弃，不影响后续降级备用
  // [v1.7.0 P0] 4 路并行竞速：QQ 自身串行链（v1.4.0 三路内嵌，含海棠/酷我在途共享）+ 第三方 3 路。
  // 优先级（kuwoRaceSuccess 首个有效结果胜出）：官方 > Hello World > 长青 > 念心。
  // 第三方通道 url 经 verifyQualitySize 魔数+大小校验失败 → reject，竞速继续。
  // [v1.9.0 P0] 次合代 s01s mid 直查通道加入竞速（userVariables.qqS01sMid 默认开）
  // [v1.9.4] 第三方竞速池瘦身：Hello World（a.aa.cab 2026-09-11 失效）、念心（mcp.nianxinxz.com
  // 2026-09-11 404）从 race pool 移除，保留函数体注释（见 resolveQqHelloWorld / resolveQqNianxin）。
  // 实测仅余 3 路可用：s01s-mid / 长青（仅 128k）/ 海棠（partial）。恢复时仅需取消下方两行注释。
  // var helloLane = resolveQqHelloWorld(raw, hq); // [v1.9.4 disabled]
  var changqingLane = resolveQqChangqing(raw, hq);
  // var nianxinLane = resolveQqNianxin(raw, hq); // [v1.9.4 disabled]
  var s01sMidLane = qqS01sMidEnabled()
    ? resolveQqS01sMid(raw, hq)
    : Promise.reject(new Error('qqS01sMid 已关闭'));
  // [v1.9.12] a.aa.cab 搜索型通道（resolveQqAaaCab）接入：旧 HelloWorld 通道（a.aa.cab 同域名
  // mid 直查型）v1.9.4 确认死亡（任何路径返回云汐 API HTML 主页）；音源包 V260917 的
  // 𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉260809.js 改用同域名新端点 /qq.music（搜索型取链，msg=歌名+歌手 &n=1&type=音质码），
  // 2026-09-20 实测 3 歌 × 4 档（128k/320k/flac/master）全部真实可拉、VIP 可播、响应 <1s。
  // [v1.9.13 方案A·拒绝虚标] 2026-09-21 每日检查实测：该端点对高音质/未知音质码一律回落
  // C400 HQ m4a 虚标（12 种 type 实测均然），高音质请求已入口拒绝，仅 ≤320k 参与竞速；
  // 双守门（前缀识别 + tips fail-closed）+ verifyQualitySize 魔数校验，校验不过即 reject 让路。
  // 竞速顺序（任务指定）：官方串行链 > 海棠 musicserver > s01s-mid > a.aa.cab（新通道）> 长青 > 兜底。
  var aaaCabLane = qqAaaCabEnabled()
    ? resolveQqAaaCab(raw, hq, musicItem)
    : Promise.reject(new Error('qqAaaCab 已关闭'));
  return kuwoRaceSuccess([qqSerialChain(), kuwoHedge, haitangHedge, s01sMidLane, aaaCabLane, changqingLane]);
}

function resolveQqPlainOfficial(raw, quality) {
  // ① 官方 CgiGetVkey（真机家宽 IP 可用；数据中心 IP 实测 104003）
  // [v1.6.0 P0] 批量 7 前缀：单请求同时查 AI00/Q001/Q000/F000/O801/M800/M500，
  // 一次 RTT 探明全部档位可用性（go-music-dl 同款做法），取链延迟近似减半；
  // 补齐 v1.5.0 缺失的 5 个前缀（AI00 母带 / Q001·Q000 臻音 / F000 无损 / O801 全景声）。
  // comm cv=4747474（go-music-dl 实测可用的客户端版本号，新档位前缀需 cv>=4747474 才签发）。
  // filename 匹配用 byName map（响应 midurlinfo 顺序与请求对齐但按下标取不稳）。
  // [v1.6.0] X-Forwarded-For 随机国内 IP（go-music-dl WithRandomIPHeader 思路）：
  // purl 签发与出口 IP 强相关，数据中心 IP 匿名几乎全空、XFF 偶发命中，机会主义带上，失败照常接力。
  var mid = (raw && raw.mediaMid) || (raw && raw.mid) || '';
  if (!quality || !mid) return Promise.reject(new Error('qq official batch: missing mid/mediaMid'));
  var filenames = QQ_BATCH_PREFIXES.map(function (p) { return p.prefix + mid + '.' + p.ext; });
  // [v1.6.1 P0·借鉴 HD] 有登录态（qqAuthst/qqCookie.qm_keyst）时按 HD 形态注入 comm 体
  // （uin/qq/authst）与 param（uin/loginflag:1/platform:'20'）；匿名时保持 v1.6.0 形态不变。
  var login = qqLoginState();
  var comm = { ct: 24, cv: 4747474, tmeAppID: 'qqmusic', format: 'json' };
  var param = {
    guid: randomGuid(),
    filename: filenames,
    songmid: [raw.mid], songtype: [0]
  };
  if (login) {
    comm.uin = login.uin;
    comm.qq = login.uin;
    comm.authst = login.authst;
    param.uin = login.uin;
    param.loginflag = 1;
    param.platform = '20';
  }
  var body = {
    comm: comm,
    req_0: {
      module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
      param: param
    }
  };
  return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body, {
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    headers: qqCookieHeaders({
      'User-Agent': 'HotDownloader/1.0', Referer: 'https://y.qq.com/',
      'X-Forwarded-For': randomDomesticIP(),
      'Content-Type': 'application/json'
    })
  }).then(function (res) {
    var d = res.data && res.data.req_0 && res.data.req_0.data;
    var list = (d && d.midurlinfo) || [];
    // [v1.6.1 P0·借鉴 HD] purl 前缀动态取响应 d.sip[0]（HD download.rs 做法，登录态响应实测
    // 携带 aqqmusic.tc.qq.com 等 CDN 列表；匿名我方形态 sip=[]），过白名单校验后使用，
    // 否则落回默认 wx 前缀（与 resolveQqUrlGetVkey 的 sip 处理一致）。
    var sipPrefix = 'https://wx.music.tc.qq.com/';
    var sip0 = d && d.sip && d.sip[0];
    if (sip0 && typeof sip0 === 'string' && /^https?:\/\//i.test(sip0) && isAllowedMediaUrl(sip0)) {
      sipPrefix = sip0.charAt(sip0.length - 1) === '/' ? sip0 : sip0 + '/';
    }
    var byName = {};
    list.forEach(function (info) { if (info && info.filename) byName[String(info.filename)] = info; });
    for (var i = 0; i < QQ_BATCH_PREFIXES.length; i++) {
      var meta = QQ_BATCH_PREFIXES[i];
      if (meta.tiers.indexOf(quality) < 0) continue; // 不跨档降级，交还上层链路接力
      var hit = byName[meta.prefix + mid + '.' + meta.ext];
      if (hit && hit.purl) {
        return { url: sipPrefix + hit.purl, actualQuality: meta.aq, channel: 'qq:official' };
      }
    }
    throw new Error('qq official no purl (batch 7 prefixes, ' + quality + ')');
  });
}

// ---------- QQ UrlGetVkey（小米通道）官方明文备源（v1.1.0 接口扩充·高优3） ----------
// 接口文档附录 I：小米音乐 SDK 取链方法，module music.vkey.GetVkey / UrlGetVkey，
// 明文 JSON 免登录。filename 前缀映射：C400.m4a(128k AAC) / M800.mp3(320k) / F000.flac(无损)。
// 2026-09-06 实测：数据中心 IP 下 purl 可签发但对应 CDN 节点 404（vkey 疑似绑定出口 IP），
// 家宽/真机环境可用；故仅作官方 CgiGetVkey 之后的同族备源。
var URLGETVKEY_FILE = { standard: 'C400', high: 'M800', super: 'F000' };
var URLGETVKEY_ACTUAL = { standard: '128k', high: '320k', super: 'flac' };
var URLGETVKEY_EXT = { standard: 'm4a', high: 'mp3', super: 'flac' };

function resolveQqUrlGetVkey(raw, quality) {
  var pfx = URLGETVKEY_FILE[quality];
  if (!pfx || !raw || !raw.mid) return Promise.reject(new Error('urlgetvkey unsupported quality'));
  var filename = pfx + raw.mid + '.' + URLGETVKEY_EXT[quality];
  var body = {
    req_0: {
      module: 'music.vkey.GetVkey', method: 'UrlGetVkey',
      param: {
        guid: randomGuid(), songmid: [raw.mid], filename: [filename],
        uin: '0', loginflag: 0, platform: '20'
      }
    }
  };
  return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body, {
    timeout: chainSegTimeout(SOURCE_TIMEOUT),
    headers: qqCookieHeaders({
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36',
      Referer: 'https://y.qq.com/', 'Content-Type': 'application/json'
    })
  }).then(function (res) {
    var rd = res.data && res.data.req_0;
    var d = rd && rd.data;
    var info = d && d.midurlinfo && d.midurlinfo[0];
    var purl = info && info.purl;
    if (!purl) throw new Error('urlgetvkey no purl');
    var sip = (d && d.sip && d.sip[0]) || 'http://aqqmusic.tc.qq.com/';
    // sip 恒为 *.qq.com CDN 域，命中 MEDIA_URL_HTTP_HOST_ALLOWLIST http 白名单
    return { url: String(sip) + String(purl), actualQuality: URLGETVKEY_ACTUAL[quality], channel: 'qq:urlgetvkey' };
  });
}

// ---------- vkeys.cn 备源（v0.8.0） ----------
// 文档根路径格式已过时，探针实测真实端点为 /v2/music/tencent/geturl（q=6→128k / 8→HQ 320k / 10→SQ 无损）。
// 免费歌返回完整曲（实测码率吻合）；VIP 歌一律返回约 60s 试听（quality 字段=「音乐试听」），
// 必须拒收交由接力，guardFullAudio 兜底二次拦截。
var VKEYS_QQ_QUALITY = { standard: 6, high: 8, super: 10 };
var VKEYS_QQ_ACTUAL = { 6: '128k', 8: '320k', 10: 'flac' };

function resolveQqVkeys(raw, quality) {
  var q = VKEYS_QQ_QUALITY[quality];
  if (!q || !raw || !raw.mid) return Promise.reject(new Error('vkeys unsupported quality'));
  return axios.get('https://api.vkeys.cn/v2/music/tencent/geturl', {
    params: { mid: raw.mid, quality: q },
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = res.data || {};
    if (body.code !== 200) throw new Error('vkeys code=' + body.code);
    var d = body.data || {};
    if (!d.url) throw new Error('vkeys no url');
    if (String(d.quality || '').indexOf('试听') >= 0) throw new Error('vkeys trial clip (VIP)');
    return { url: String(d.url), actualQuality: VKEYS_QQ_ACTUAL[q], channel: 'qq:vkeys' };
  });
}

// ---------- [v1.3.1] vkeys 旧版通道（落月API，接口文档 3.4.1 #4） ----------
// 端点 api.vkeys.cn/music/tencent/song/link（与上方 /v2 同站不同代）。2026-09-08 实测
// （晴天 VIP mid=0039MnYb0qxYhV）：q=6→ws.stream M500 mp3 全长 4317292 == qualities.size，
// q=8→M800 全长 10792943 == qualities.size——VIP 歌也给完整曲；q=10 无损 code=110001
// 「cookie异常：账号被风控」不支持。VIP 歌在 /v2 端点只给 RS02 试听（960887B，试听字样
// 拒收），故旧版插在 /v2 之前。响应 {code:0,data:{url,kbps,...}}，url 为 QQ 官方 CDN
// http 直链（*.qq.com 命中 http 白名单）。
var VKEYS_LEGACY_QUALITY = { standard: 6, high: 8 };
var VKEYS_LEGACY_ACTUAL = { 6: '128k', 8: '320k' };

function resolveQqVkeysLegacy(raw, quality) {
  var q = VKEYS_LEGACY_QUALITY[quality];
  if (!q || !raw || !raw.mid) return Promise.reject(new Error('vkeys-legacy unsupported quality'));
  return axios.get('https://api.vkeys.cn/music/tencent/song/link', {
    params: { mid: raw.mid, quality: q },
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = res.data || {};
    if (body.code !== 0) throw new Error('vkeys-legacy code=' + body.code);
    var d = body.data || {};
    if (!d.url) throw new Error('vkeys-legacy no url');
    return { url: String(d.url), actualQuality: VKEYS_LEGACY_ACTUAL[q], channel: 'qq:vkeys-legacy' };
  });
}

// ---------- [v1.3.1] 听会代理段恢复（接口文档 3.4.1 #3 / 附录H.1） ----------
// 端点 175.27.166.236/kgqq1/qq.php?level={standard|exhigh}&id={mid}。v1.1.0 fix#5 曾整段
// 剔除（当时未验真 + HTTP 裸 IP）；本轮 2026-09-08 实测恢复依据：standard/exhigh 均返回
// 酷我CDN HTTPS 直链（car-er.kuwo.cn，"https 一律放行"无需改白名单），Range 验真全长
// 4317292/10792943 与 qualities.size 精确一致（M500/M800 真码率）。响应
// {code:200,msg:"换源成功...",data:{url,error:"付费",quality,size,...}}——error=付费 时
// url 仍有效（VIP 歌可播）。不支持无损（文档实测 flac 档返回 1.48MB M4A 名不副实，不用）。
// 风险声明：API 请求本身走 HTTP 裸 IP，理论可被劫持返回坏链——由 guardFullAudio 内容探测
// （4xx/试听长度拦截）+ actualQuality 如实标注兜底，失败自动接力下一段。
//
// [v1.3.2] 瞬时 502 加固（重试 + 指数退避）：
// 实测该服务延迟 1.5~5s 波动且偶发 502（网关瞬态，间隔数百 ms 重试即可成功）。策略：
//   - 最多 3 次尝试，仅对可重试错误重试（HTTP 502/503/504、无响应的网络错误/超时）；
//     4xx（403/404 等，URL 失效/无权限）不重试，直接交回接力
//   - 指数退避：300ms → 600ms
//   - 单次尝试超时递减 2000/1500/1000ms（成功样本集中在 1.5~2.6s，递减防止坏窗口吃满预算）
//   - 段内总预算 TINGHUI_RETRY_TOTAL=5s 硬封顶：听会是中段备源，不能挤掉后面海棠/bugpk
//     的接力窗口（resolveWithFallback 全局预算 8s）
var TINGHUI_LEVEL = { standard: 'standard', high: 'exhigh' };
// actualQuality 按 level 查表（level 与内部档一一对应：standard→128k / exhigh→320k）
var TINGHUI_ACTUAL = { standard: '128k', exhigh: '320k' };
var TINGHUI_ATTEMPT_TIMEOUTS = [2000, 1500, 1000];
var TINGHUI_BACKOFFS = [300, 600];
var TINGHUI_RETRY_TOTAL = 3000; // [v1.3.5] 5s→3s：实测 502 为 ~5s 慢失败，重试在收到响应前已超时（救不回）；降位后本段仅链尾消费，3s 足够吸收快速失败模式

function tinghuiIsRetryable(err) {
  if (!err) return false;
  if (err.response) {
    var s = err.response.status;
    return s === 502 || s === 503 || s === 504; // 网关瞬态错误；4xx/其余 5xx 不重试
  }
  return true; // 无 response：网络错误 / ECONNABORTED 超时
}

function resolveQqTinghui(raw, quality) {
  var lv = TINGHUI_LEVEL[quality];
  if (!lv || !raw || !raw.mid) return Promise.reject(new Error('tinghui unsupported quality'));
  var deadline = Date.now() + TINGHUI_RETRY_TOTAL;
  var attempt = function (i) {
    var remain = deadline - Date.now();
    if (remain <= 300) return Promise.reject(new Error('tinghui retry budget exhausted'));
    var to = Math.min(chainSegTimeout(TINGHUI_ATTEMPT_TIMEOUTS[i] || 1000), remain);
    return axios.get('http://175.27.166.236/kgqq1/qq.php', {
      params: { level: lv, id: raw.mid },
      timeout: to,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }).then(function (res) {
      var body = res.data || {};
      if (body.code !== 200) throw new Error('tinghui code=' + body.code);
      var d = body.data || {};
      var url = d.url;
      if (!url || typeof url !== 'string' || url.indexOf('http') !== 0) {
        // 免费歌部分失败时 data.url 为 null/None（文档 17.4 实测一致）
        throw new Error('tinghui no url (' + String(d.error || body.msg || '').slice(0, 30) + ')');
      }
      if (url.indexOf('获取音频失败') >= 0) throw new Error('tinghui fake url (server error text)');
      return { url: url, actualQuality: TINGHUI_ACTUAL[lv], channel: 'qq:tinghui' };
    }).catch(function (e) {
      // [v1.3.2] 仅可重试错误（502/503/504/网络错误）且还有尝试次数时退避重试；
      // 业务性失败（code!=200 / no url / fake url）与 4xx 原样抛出交回接力
      if (i >= TINGHUI_ATTEMPT_TIMEOUTS.length - 1 || !tinghuiIsRetryable(e)) throw e;
      var delay = TINGHUI_BACKOFFS[Math.min(i, TINGHUI_BACKOFFS.length - 1)];
      return new Promise(function (resolve) { setTimeout(resolve, delay); }).then(function () { return attempt(i + 1); });
    });
  };
  return attempt(0);
}

// ---------- [v1.3.3] cyapi 聚合通道（接口文档 3.4.1 #4，用户补 key 后实测接入） ----------
// 端点 cyapi.top/API/qq_music.php。2026-09-08 实测（key 用户提供）：
//  · 不带 quality → C400 AAC 96k（isure6 https，晴天全长 3283546B）
//  · 带任意 quality 值（128/320/flac/hires 均同）→ M800 MP3 320k（晴天全长 10792943B，
//    与 qualities.size 320k 精确一致）——320k 为相对 HYW（仅 96k）的真升级
//  · 无真 FLAC：quality=flac 亦返回 M800，不得入 super 链伪装无损
// 响应为扁平 JSON { name, id, url, lyric, ... }，无 code 字段，只验 url 存在且为 http(s)。
var CYAPI_KEY = '1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1';

function resolveQqCyapi(raw, quality) {
  if (!raw || !raw.mid) return Promise.reject(new Error('cyapi no mid'));
  var params = { apikey: CYAPI_KEY, type: 'json', mid: raw.mid };
  var actual;
  if (quality === 'high') { params.quality = '320'; actual = '320k'; }
  else if (quality === 'standard') { actual = '96k'; }
  else return Promise.reject(new Error('cyapi unsupported quality'));
  return axios.get('https://cyapi.top/API/qq_music.php', {
    params: params,
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = res.data || {};
    var url = body.url;
    if (!url || typeof url !== 'string' || url.indexOf('http') !== 0) {
      throw new Error('cyapi no url');
    }
    return { url: url, actualQuality: actual, channel: 'qq:cyapi' };
  });
}

// ---------- s01s 搜索式备源（v0.8.0） ----------
// 2026-09-06 实测站点返回宝塔默认页（服务失效）；按「仍接入 + 链尾 + 严格响应校验」策略处理，
// 站点恢复后自动生效。响应可能是双重 JSON 编码字符串，需二次 JSON.parse；HTML/解析失败一律拒绝。
// 搜索一次性返回 7 档直链（fq/standard/hq/url/sq/pq/accom），按请求档位取字段。
var S01S_HOST = 'https://tang.api.s01s.cn/';
var S01S_FIELD_ORDER = {
  super: ['sq', 'hq', 'standard', 'url', 'fq'],
  high: ['standard', 'hq', 'url', 'fq'],
  standard: ['standard', 'url', 'fq']
};
var S01S_ACTUAL = { sq: 'flac', hq: '320k', standard: '320k', url: '128k', fq: '128k' };

function resolveQqS01s(raw, quality, musicItem) {
  if (!raw || !raw.mid) return Promise.reject(new Error('s01s no mid'));
  var kw = ((musicItem && musicItem.title) || '') + ' ' + ((musicItem && musicItem.artist) || '');
  if (!kw.trim()) return Promise.reject(new Error('s01s no keyword'));
  return axios.get(S01S_HOST, {
    // [v1.1.0 审查#14] limit 5→20：搜索一次拿更多候选，降低精确 mid 匹配失败率
    params: { name: kw, page: 1, limit: 20 },
    timeout: chainSegTimeout(RELAY_TIMEOUT),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var body = res.data;
    if (typeof body === 'string') {
      var t = body.trim();
      if (!t || t.charAt(0) !== '{') throw new Error('s01s non-json response');
      body = JSON.parse(t);
    }
    var list = body && (body.data || body.list || body.songs);
    if (typeof list === 'string') list = JSON.parse(list);
    if (!list || !list.length) throw new Error('s01s empty list');
    var hit = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].songmid || list[i].id) === String(raw.mid)) { hit = list[i]; break; }
    }
    if (!hit) throw new Error('s01s no exact match');
    var order = S01S_FIELD_ORDER[quality] || S01S_FIELD_ORDER.standard;
    for (var fi = 0; fi < order.length; fi++) {
      var u = hit[order[fi]];
      if (u) return { url: String(u), actualQuality: S01S_ACTUAL[order[fi]], channel: 'qq:s01s' };
    }
    throw new Error('s01s no url for quality ' + quality);
  }).catch(function (e) {
    // JSON.parse 等语法错误统一转普通失败，接力下一源
    if (e instanceof SyntaxError) throw new Error('s01s parse fail');
    throw e;
  });
}

var RESOLVE_ADAPTERS = {
  qq: resolveQq
};

/**
 * 能力路由 + 失败接力：
 * 候选顺序 = 支持请求档位的源（按源权重降序）。
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
// https 一律放行；http 仅放行已知平台 CDN 域名后缀（QQ 官方 CDN），
// http 且域名不在白名单（含裸 IP、被劫持改写的陌生域）一律拒绝，视为该源失败继续接力。
var MEDIA_URL_HTTP_HOST_ALLOWLIST = [
  /\.qq\.com$/i            // QQ 音乐流媒体（ws/isure.stream.qqmusic.qq.com 等）
  // [v1.1.0 fix#5] 移除 .kuwo.cn：酷我直链仅来自已剔除的听会 HTTP 裸 IP 段，白名单同步收口
];

// [v1.1.0 优化#13] 取链失败负缓存：同一 (候选歌曲+音质) 下连续失败 ≥2 次的源，60s 内直接跳过，
// 避免每次取链都把 8s 预算耗在已知失效的通道上（如数据中心 IP 下官方 104003、s01s 站点失效）。
var RESOLVE_NEG_CACHE = {}; // cacheKey -> { source: { fails: n, until: ts } }
var NEG_CACHE_TTL = 60 * 1000;
var NEG_CACHE_THRESHOLD = 2;

function negCacheCheck(source, cacheKey) {
  var slot = RESOLVE_NEG_CACHE[cacheKey];
  if (!slot || !slot[source]) return false;
  var rec = slot[source];
  if (Date.now() > rec.until) { delete slot[source]; return false; }
  return rec.fails >= NEG_CACHE_THRESHOLD;
}

function negCacheRecord(source, cacheKey) {
  var keys = Object.keys(RESOLVE_NEG_CACHE);
  if (keys.length > 200) RESOLVE_NEG_CACHE = {}; // 防内存无界增长，粗暴整体重置
  if (!RESOLVE_NEG_CACHE[cacheKey]) RESOLVE_NEG_CACHE[cacheKey] = {};
  var rec = RESOLVE_NEG_CACHE[cacheKey][source] || { fails: 0, until: 0 };
  rec.fails += 1;
  rec.until = Date.now() + NEG_CACHE_TTL;
  RESOLVE_NEG_CACHE[cacheKey][source] = rec;
}

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

function resolveWithFallback(musicItem, quality, hostQuality) {
  var srcMap = musicItem._src || {};
  var order = pickCandidates(srcMap, quality);
  var tries = order.slice(0, 3);
  // v0.7.1 P1-3：全局超时预算。deadline 8s 内：首段 ≤SOURCE_TIMEOUT，接力段 ≤RELAY_TIMEOUT，
  // 每段进入前检查剩余时间，不足 500ms 直接失败——保证整体可预期地在宿主 10s 预算内给出结果。
  var deadline = Date.now() + RESOLVE_BUDGET_MS;
  // [v1.3.5] 全局 deadline 下传内部接力链（见 chainSegTimeout）；token 防并发取链交叉清零
  var chainToken = ++CHAIN_TOKEN;
  CHAIN_DEADLINE = deadline;
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
    // [v1.1.0 优化#13] 失败负缓存命中：该源近期对该曲目+音质已连续失败，直接跳过
    var cacheKey = ((musicItem && musicItem.id) || (srcMap[source] && srcMap[source].mid) || '?') + '|' + quality;
    if (negCacheCheck(source, cacheKey)) return attempt(idx + 1);
    // [v1.1.0 审查#16] 段递减超时：接力段每段递减 500ms（下限 1.5s）。
    // [v1.1.0 收尾修复] 首段超时从 SOURCE_TIMEOUT 改为「全局剩余预算」：单源插件（如 QQ 独立版）
    // 的首段适配器本身就是 6 段接力链，若整体被 4.5s 掐死，官方段一挂链尾（海棠/bugpk）永远轮不到；
    // 链内各段自有时限 + 全局 deadline 双重约束，行为仍可预期。
    var segTimeout = idx === 0 ? remain : Math.min(remain, Math.max(1500, RELAY_TIMEOUT - (idx - 1) * 500));
    if (segTimeout > remain) segTimeout = remain;
    return withTimeout(adapter(srcMap[source], quality, musicItem, hostQuality), segTimeout, source + ' 取链超时 ' + segTimeout + 'ms').then(function (r) {
      // [v1.1.0 优化#15] channel 兜底：适配器未标注通道时以源名兜底，便于日志排查取链路径
      if (r && !r.channel) r.channel = source;
      // v0.7.1 P1-5：返回 URL 协议/域名白名单校验，不通过视为该源失败、继续接力
      if (!isAllowedMediaUrl(r && r.url)) {
        throw new Error(source + ' 返回 URL 未通过协议/域名校验');
      }
      // 兜底守卫：适配器漏判的试听片段在这里被内容探测拦下并继续接力
      // （守卫按 content-length/Range 校验大小与标称时长一致性，明显不符即丢弃）
      var guardBudget = deadline - Date.now();
      if (guardBudget <= 500) throw new Error('聚合取链失败：超出全局超时预算 ' + RESOLVE_BUDGET_MS + 'ms');
      if (guardBudget > SOURCE_TIMEOUT) guardBudget = SOURCE_TIMEOUT;
      return withTimeout(guardFullAudio(r.url, musicItem), guardBudget, 'guard 超时').then(function () { return r; });
    }).catch(function (e) {
      // [v1.1.0 优化#13] 失败记账进负缓存（guard 拦截/白名单拒绝/取链超时统一算该源失败）
      negCacheRecord(source, cacheKey);
      return attempt(idx + 1);
    });
  };
  // [v1.3.5] 结束时清 deadline（仅当无更新的并发取链接管它）
  return attempt(0).then(function (v) {
    if (CHAIN_TOKEN === chainToken) CHAIN_DEADLINE = 0;
    return v;
  }, function (e) {
    if (CHAIN_TOKEN === chainToken) CHAIN_DEADLINE = 0;
    throw e;
  });
}

/**
 * 试听片段兜底守卫：Range 探测 audio 文件总长，
 * 按 128kbps 估算时长（高码率文件会被高估时长，不会误杀完整文件），
 * 估算时长 < 标称时长 60% 判为试听片段。仅标称时长 >=60s 时启用估算。
 * 探测请求自身失败（Range 不支持/超时）不惩罚源，放行由播放器处理。
 */
// [v1.9.4] size 探测辅助：Range 0-0 HEAD 探测 Content-Range/Content-Length 写回。
// 优先级：Content-Range 的 total（如 "bytes 0-0/4319232"）> 200 响应 Content-Length。
// 失败 fail-soft：探测失败/4xx/超时返回 0，由调用方决定是否兜底（getMediaSource 边界处 size 留空）。
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
      var est = total / 16000; // 128000bps / 8bit
      if (est < dur * 0.6) {
        throw new Error('guard: trial clip ~' + Math.round(est) + 's/' + dur + 's');
      }
    }
  }).catch(function (e) {
    if (e && /^guard:/.test(String(e && e.message))) throw e;
    // [v1.1.0 fix#3] 探测请求拿到 4xx/5xx：URL 已失效/无权限（坏 URL），必须拦截接力，
    // 不能按「探测请求失败放行」处理——原实现 4xx 坏链接直达播放器
    if (e && e.response && e.response.status >= 400) {
      throw new Error('guard: probe http ' + e.response.status);
    }
    // 探测请求本身失败（超时/网络抖动/Range 不支持）：不拦，放行
  });
}

// ==================== QQ 歌词适配 ====================
// 端点均经 2026-09-05 探针实测（artifacts/lyric-probe/probe-result.json），无猜测 URL。
// QQ：fcg 歌词接口（nobase64=1 正文明文，trans 为 Base64 翻译，需 Referer）。
//
// v0.7.0：歌词单源超时压到 3s（LYRIC_TIMEOUT），避免顶到 10s 沙箱上限。
var LYRIC_TIMEOUT = 3000;

// ---------- QQ QRC 逐字歌词解密（v0.8.0；v1.6.1 对拍核验保留本实现） ----------
// [v1.6.1 P0 对拍结论] 与 HotDownloader Rust qrc.rs 逐位 DES（1:1 移植 JS）对真实密文对拍：
// 解密结果逐字符一致（晴天 hexLen 9808 → 双方 8661 字符 QRC XML，63 行/602 词毫秒级时间戳）；
// 整链性能本插件 2.2ms/次 vs HD 逐位版 4.8ms/次（SP 表查表 vs 逐位函数调用）。两实现为同一
// 3DES 变体，HD 版无增量场景，不迁移。
// QQ 私有变体 3DES（非标准 DES、非 TEA）：3 密钥 KEY_1="!@#)(*$%"、KEY_2="123ZXC!@"、KEY_3="!@#)(NHL"，
// 解密流程 D(K3)→E(K2)→D(K1)。移植自 apoint123/qrc-decoder（qrc_es5.js，2026-09-06 探针对拍通过：
// 晴天 9808 hex → 13ms 解密 8661 字符合法 QRC），改写为纯 32 位数值运算（无 BigInt，宿主沙箱不保证）。
// PC-2 怪癖 pos-27、字节序怪癖 byteIndex=wordIndex*4+3-byteInWord；解密后 inflate + 去 BOM 得
// XML 包裹文本，实际歌词在 <Lyric_1 LyricContent="..."> 属性内（&#10;=换行）。
var QRC_SBOXES = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,15,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,10,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
];
var QRC_PBOX = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
var QRC_EBOX = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
var QRC_KEY_SHIFT = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
var QRC_KEY_PERM_C = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35];
var QRC_KEY_PERM_D = [62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3];
var QRC_KEY_COMPRESSION = [13,16,10,23,0,4,2,27,14,5,20,9,22,18,11,3,25,7,15,6,26,19,12,1,40,51,30,36,46,54,29,39,50,44,32,47,43,48,38,55,33,52,45,41,49,35,28,31];
var QRC_IP_RULE = [34,42,50,58,2,10,18,26,36,44,52,60,4,12,20,28,38,46,54,62,6,14,22,30,40,48,56,64,8,16,24,32,33,41,49,57,1,9,17,25,35,43,51,59,3,11,19,27,37,45,53,61,5,13,21,29,39,47,55,63,7,15,23,31];
var QRC_INV_IP_RULE = [37,5,45,13,53,21,61,29,38,6,46,14,54,22,62,30,39,7,47,15,55,23,63,31,40,8,48,16,56,24,64,32,33,1,41,9,49,17,57,25,34,2,42,10,50,18,58,26,35,3,43,11,51,19,59,27,36,4,44,12,52,20,60,28];

function qrcUtf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var cp = s.codePointAt(i);
    if (cp > 0xffff) i++;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
}

function qrcUtf8Decode(bytes) {
  var out = '', i = 0, b, cp;
  while (i < bytes.length) {
    b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
    else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if (b < 0xf0) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else {
      cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      i += 4;
    }
  }
  return out;
}

function qrcHexToBytes(hex) {
  var n = hex.length >> 1;
  var out = new Uint8Array(n);
  for (var i = 0; i < n; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// IP / InvIP 查表（按字节生成，无 BigInt）
var QRC_IP_LEFT = new Int32Array(2048);
var QRC_IP_RIGHT = new Int32Array(2048);
var QRC_INV_IP_LEFT = new Int32Array(2048);
var QRC_INV_IP_RIGHT = new Int32Array(2048);

function qrcPermByte(byteVal, bytePos, rule) {
  // 输入仅一个字节位于 8 字节块的第 bytePos 位；返回置换后的 [left, right]
  var left = 0, right = 0;
  for (var i = 0; i < 64; i++) {
    var q = rule[i] - 1; // 该规则位在块内的 MSB 0-based 位置
    var local = q - bytePos * 8;
    if (local >= 0 && local < 8 && ((byteVal >> (7 - local)) & 1)) {
      if (i < 32) left |= 1 << (31 - i);
      else right |= 1 << (63 - i);
    }
  }
  return [left, right];
}

(function qrcGenPermTables() {
  var gens = [[QRC_IP_RULE, QRC_IP_LEFT, QRC_IP_RIGHT], [QRC_INV_IP_RULE, QRC_INV_IP_LEFT, QRC_INV_IP_RIGHT]];
  for (var g = 0; g < gens.length; g++) {
    var rule = gens[g][0], tblL = gens[g][1], tblR = gens[g][2];
    for (var bytePos = 0; bytePos < 8; bytePos++) {
      for (var byteVal = 0; byteVal < 256; byteVal++) {
        var lr = qrcPermByte(byteVal, bytePos, rule);
        var idx = (bytePos << 8) | byteVal;
        tblL[idx] = lr[0];
        tblR[idx] = lr[1];
      }
    }
  }
})();

// S-P 合并查表
var QRC_SP = new Int32Array(512);

(function qrcGenSp() {
  for (var s = 0; s < 8; s++) {
    for (var inp = 0; inp < 64; inp++) {
      var idx = (inp & 0x20) | ((inp & 0x1f) >> 1) | ((inp & 0x01) << 4);
      var fourBit = QRC_SBOXES[s][idx];
      var preP = fourBit << (28 - s * 4);
      var out = 0;
      for (var i = 0; i < 32; i++) {
        var srcBit = QRC_PBOX[i];
        if ((preP & (1 << (32 - srcBit))) !== 0) out |= 1 << (31 - i);
      }
      QRC_SP[(s << 6) | inp] = out;
    }
  }
})();

// E 扩展查表
var QRC_EBOX_HIGH = new Int32Array(1024);
var QRC_EBOX_LOW = new Int32Array(1024);

(function qrcGenEbox() {
  for (var chunk = 0; chunk < 4; chunk++) {
    var shift = (3 - chunk) * 8;
    for (var byteVal = 0; byteVal < 256; byteVal++) {
      var high24 = 0, low24 = 0;
      var input = byteVal << shift;
      for (var i = 0; i < 24; i++) {
        if ((input >>> (32 - QRC_EBOX[i])) & 1) high24 |= 1 << (23 - i);
      }
      for (var j = 24; j < 48; j++) {
        if ((input >>> (32 - QRC_EBOX[j])) & 1) low24 |= 1 << (47 - j);
      }
      var idx = (chunk << 8) | byteVal;
      QRC_EBOX_HIGH[idx] = high24;
      QRC_EBOX_LOW[idx] = low24;
    }
  }
})();

// 密钥调度（28 位循环左移改为低对齐纯数值实现）
function qrcPermuteFromKey(key, table) {
  var output = 0;
  var mask = 1 << (table.length - 1);
  for (var i = 0; i < table.length; i++) {
    var pos = table[i];
    var wordIndex = pos >> 5;
    var bitInWord = pos & 31;
    var byteInWord = bitInWord >> 3;
    var bitInByte = bitInWord & 7;
    var byteIndex = wordIndex * 4 + 3 - byteInWord; // 字节序怪癖
    if ((key[byteIndex] >> (7 - bitInByte)) & 1) output |= mask;
    mask >>>= 1;
  }
  return output;
}

function qrcRotate28High(value, amount) {
  // value 高对齐（位 31..4），在 28 位内循环左移
  var v = (value >>> 4) & 0x0fffffff;
  return (((v << amount) | (v >>> (28 - amount))) & 0x0fffffff) << 4;
}

function qrcKeySchedule(key, decrypt) {
  var schedule = new Int32Array(32);
  var c = qrcPermuteFromKey(key, QRC_KEY_PERM_C) << 4;
  var d = qrcPermuteFromKey(key, QRC_KEY_PERM_D) << 4;
  for (var i = 0; i < 16; i++) {
    c = qrcRotate28High(c, QRC_KEY_SHIFT[i]);
    d = qrcRotate28High(d, QRC_KEY_SHIFT[i]);
    var toGen = decrypt ? 15 - i : i;
    var high24 = 0, low24 = 0;
    for (var k = 0; k < 48; k++) {
      var pos = QRC_KEY_COMPRESSION[k];
      var bit = pos < 28 ? (c >>> (31 - pos)) & 1 : (d >>> (31 - (pos - 27))) & 1; // PC-2 怪癖 pos-27
      if (bit) {
        if (k < 24) high24 |= 1 << (23 - k);
        else low24 |= 1 << (47 - k);
      }
    }
    schedule[toGen * 2] = high24;
    schedule[toGen * 2 + 1] = low24;
  }
  return schedule;
}

function qrcF(state, keyHigh24, keyLow24) {
  var b0 = (state >>> 24) & 0xff;
  var b1 = (state >>> 16) & 0xff;
  var b2 = (state >>> 8) & 0xff;
  var b3 = state & 0xff;
  var eHigh = QRC_EBOX_HIGH[b0] | QRC_EBOX_HIGH[256 | b1] | QRC_EBOX_HIGH[512 | b2] | QRC_EBOX_HIGH[768 | b3];
  var eLow = QRC_EBOX_LOW[b0] | QRC_EBOX_LOW[256 | b1] | QRC_EBOX_LOW[512 | b2] | QRC_EBOX_LOW[768 | b3];
  var xh = eHigh ^ keyHigh24;
  var xl = eLow ^ keyLow24;
  return (
    QRC_SP[(xh >>> 18) & 0x3f] | QRC_SP[64 | ((xh >>> 12) & 0x3f)] | QRC_SP[128 | ((xh >>> 6) & 0x3f)] | QRC_SP[192 | (xh & 0x3f)] |
    QRC_SP[256 | ((xl >>> 18) & 0x3f)] | QRC_SP[320 | ((xl >>> 12) & 0x3f)] | QRC_SP[384 | ((xl >>> 6) & 0x3f)] | QRC_SP[448 | (xl & 0x3f)]
  );
}

function qrcDesCrypt(input, inputOff, output, outputOff, schedule) {
  var left = 0, right = 0;
  for (var i = 0; i < 8; i++) {
    var idx = (i << 8) | input[inputOff + i];
    left |= QRC_IP_LEFT[idx];
    right |= QRC_IP_RIGHT[idx];
  }
  for (var r = 0; r < 15; r++) {
    var temp = right;
    right = (left ^ qrcF(right, schedule[r * 2], schedule[r * 2 + 1])) >>> 0;
    left = temp;
  }
  left = (left ^ qrcF(right, schedule[30], schedule[31])) >>> 0;

  var outLeft = 0, outRight = 0;
  for (var m = 0; m < 4; m++) {
    var idxL = (m << 8) | ((left >>> (24 - m * 8)) & 0xff);
    outLeft |= QRC_INV_IP_LEFT[idxL];
    outRight |= QRC_INV_IP_RIGHT[idxL];
    var idxR = ((m + 4) << 8) | ((right >>> (24 - m * 8)) & 0xff);
    outLeft |= QRC_INV_IP_LEFT[idxR];
    outRight |= QRC_INV_IP_RIGHT[idxR];
  }
  output[outputOff] = (outLeft >>> 24) & 0xff;
  output[outputOff + 1] = (outLeft >>> 16) & 0xff;
  output[outputOff + 2] = (outLeft >>> 8) & 0xff;
  output[outputOff + 3] = outLeft & 0xff;
  output[outputOff + 4] = (outRight >>> 24) & 0xff;
  output[outputOff + 5] = (outRight >>> 16) & 0xff;
  output[outputOff + 6] = (outRight >>> 8) & 0xff;
  output[outputOff + 7] = outRight & 0xff;
}

// 3DES 编解码器：解密 D(K3) -> E(K2) -> D(K1)
var QRC_KEY_1 = qrcUtf8Bytes('!@#)(*$%');
var QRC_KEY_2 = qrcUtf8Bytes('123ZXC!@');
var QRC_KEY_3 = qrcUtf8Bytes('!@#)(NHL');
var QRC_DECRYPT_SCHEDULES = [
  qrcKeySchedule(QRC_KEY_3, true),
  qrcKeySchedule(QRC_KEY_2, false),
  qrcKeySchedule(QRC_KEY_1, true)
];

function qrcDecryptBlock(input, inOff, output, outOff) {
  var t1 = new Uint8Array(8);
  var t2 = new Uint8Array(8);
  qrcDesCrypt(input, inOff, t1, 0, QRC_DECRYPT_SCHEDULES[0]);
  qrcDesCrypt(t1, 0, t2, 0, QRC_DECRYPT_SCHEDULES[1]);
  qrcDesCrypt(t2, 0, output, outOff, QRC_DECRYPT_SCHEDULES[2]);
}

// 解密十六进制 QRC 密文 → 明文 QRC 文本（XML 包裹）。inflateFn 入参/返回均为 Uint8Array。
function qrcDecryptHex(hex, inflateFn) {
  var enc = qrcHexToBytes(hex);
  if (enc.length % 8 !== 0) throw new Error('qrc: 密文长度不是 8 的倍数');
  var dec = new Uint8Array(enc.length);
  for (var i = 0; i < enc.length; i += 8) qrcDecryptBlock(enc, i, dec, i);
  var raw = inflateFn(dec);
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) raw = raw.slice(3);
  return qrcUtf8Decode(raw);
}

// QRC 取链：GetPlayLyricInfo crypt:1 → d.lyric 为 hex 密文 → 解密 → 提取 LyricContent 属性 + 实体还原
async function fetchQqQrc(mid) {
  if (!mid) throw new Error('qrc no mid');
  var pako = require('pako');
  var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '24', cv: '0' },
    req: {
      module: 'music.musichallSong.PlayLyricInfo', method: 'GetPlayLyricInfo',
      param: { crypt: 1, qrc: 1, trans: 1, type: 1, songMid: String(mid) }
    }
  }, {
    timeout: LYRIC_TIMEOUT,
    headers: qqCookieHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://y.qq.com/', 'Content-Type': 'application/json' })
  });
  var d = r.data && r.data.req && r.data.req.data;
  // 注意：实测该接口响应不总带 retcode 字段（2026-09-06 自测发现形态漂移），以密文载体存在性为准；
  // 兼容 d.lyric 直出与 d.qrc.{qrcCypherContent|content} 对象包裹两种形态
  var hex = (d && d.lyric) || (d && d.qrc && (d.qrc.qrcCypherContent || d.qrc.content));
  if (!hex) throw new Error('qrc api no cypher content (retcode=' + (d && d.retcode) + ')');
  var text = qrcDecryptHex(String(hex), pako.inflate);
  // XML 包裹：提取 Lyric_1 的 LyricContent 属性并还原 HTML 实体（&#10;=换行、&#9;=制表）
  var m = text.match(/LyricContent="([\s\S]*?)"\s*\/?>/);
  var content = m ? m[1] : text;
  content = content.replace(/&#10;/g, '\n').replace(/&#13;/g, '').replace(/&#9;/g, '\t')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  if (!/\[\d+,\d+\]/.test(content)) throw new Error('qrc not word-by-word');
  return content;
}

// QQ 跨源逐字接力：标题+歌手走 SearchAdaptor 搜同曲（时长容差 6s 防错配）→ QRC
async function fetchQqQrcRelay(item) {
  var kw = ((item && item.title) || '') + ' ' + ((item && item.artist) || '');
  if (!kw.trim()) throw new Error('qrc relay no keyword');
  var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '24', cv: '0' },
    req: { module: 'music.adaptor.SearchAdaptor', method: 'do_search_v2',
      param: { query: kw, search_type: 0, page_num: 1, num_per_page: 8 } }
  }, {
    timeout: LYRIC_TIMEOUT,
    headers: qqCookieHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://y.qq.com/', 'Content-Type': 'application/json' })
  });
  var reqData = r.data && r.data.req && r.data.req.data;
  var items = (((reqData || {}).body || {}).item_song || {}).items || [];
  var dur = parseInt(item && item.duration, 10) || 0;
  var hit = null;
  for (var i = 0; i < items.length; i++) {
    var d = parseInt(items[i].interval, 10) || 0;
    if (dur > 0 && d > 0 && Math.abs(d - dur) > 6) continue;
    hit = items[i];
    break;
  }
  if (!hit && items.length) hit = items[0];
  if (!hit || !hit.mid) throw new Error('qrc relay no match');
  return fetchQqQrc(String(hit.mid));
}

async function getWordByWordLyricImpl(musicItem) {
  if (!musicItem || !musicItem._src) throw new Error('该条目无音源信息，无法取逐字歌词');
  var srcMap = musicItem._src;
  var tried = [];
  // ① 原生源直取（QQ QRC）
  if (srcMap.qq && srcMap.qq.mid) {
    try { return await fetchQqQrc(srcMap.qq.mid); }
    catch (e) { tried.push('qq: ' + String(e && e.message).slice(0, 50)); }
  }
  // ② QQ 跨源接力（QRC 逐字覆盖面广：SearchAdaptor 搜同曲 → QRC）
  try { return await fetchQqQrcRelay(musicItem); }
  catch (e) { tried.push('qq-relay: ' + String(e && e.message).slice(0, 50)); }
  throw new Error('逐字歌词不可用（' + tried.join(' | ') + '）');
}

// [v1.2.0 对齐 baka] 部分歌词时间标签为 [mm:ss:cc] 冒号毫秒格式，宿主解析按 [mm:ss.ccc] 才正确
function normalizeColonTimeTag(lrc) {
  if (!lrc) return lrc;
  return String(lrc).replace(/\[(\d+):([0-5]?\d):(\d{1,3})\]/g, function (_, min, sec, frac) {
    var ms = frac.length === 1 ? frac + '00' : (frac.length === 2 ? frac + '0' : frac.slice(0, 3));
    return '[' + min + ':' + sec + '.' + ms + ']';
  });
}

// [v1.5.0 P2] 罗马音歌词：GetPlayLyricInfo roma=1（文档 4.2 节全参数版，2026-09-08 实测✅）
// → d.roma 与 d.lyric 同为 crypt:1 加密 hex → 复用 qrcDecryptHex 解密 → QRC XML 逐字罗马音
// → 转标准 LRC（宿主 getLyric.romanization 按 LRC 渲染）：[ms,dur] 行拼合词内时序为
// [mm:ss.xxx]罗马音文本；无词间奏行跳过；[ti:]等元信息标签原样保留。中文歌 roma 为空
// （实测晴天），解密/转换失败均抛错，由调用方静默降级——罗马音可选，不阻塞主歌词。
async function fetchQqRomaLrc(mid) {
  if (!mid) throw new Error('roma no mid');
  var pako = require('pako');
  var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '24', cv: '0', guid: '10000', uin: '0' },
    req: {
      module: 'music.musichallSong.PlayLyricInfo', method: 'GetPlayLyricInfo',
      param: { crypt: 1, lrc_t: 0, qrc: 1, qrc_t: 0, roma: 1, roma_t: 0, trans: 1, trans_t: 0,
        needSingingAnnotations: false, type: 1, songMid: String(mid) }
    }
  }, {
    timeout: LYRIC_TIMEOUT,
    headers: qqCookieHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', Referer: 'https://y.qq.com/', 'Content-Type': 'application/json' })
  });
  var d = r.data && r.data.req && r.data.req.data;
  var hex = d && d.roma;
  if (!hex) throw new Error('roma api no content');
  var text = qrcDecryptHex(String(hex), pako.inflate);
  var m = text.match(/LyricContent="([\s\S]*?)"\s*\/?>/);
  var content = m ? m[1] : text;
  content = content.replace(/&#10;/g, '\n').replace(/&#13;/g, '').replace(/&#9;/g, '\t')
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  var lines = content.split('\n');
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    if (!ln) continue;
    if (!/^\[\d+,\d+\]/.test(ln)) { out.push(ln); continue; } // [ti:]等元信息标签原样保留
    var head = /^\[(\d+),\d+\]/.exec(ln);
    var words = ln.replace(/^\[\d+,\d+\]/, '').replace(/\(\d+,\d+\)/g, '').trim();
    if (!words) continue; // 纯间奏行无罗马音，跳过
    var ms = parseInt(head[1], 10) || 0;
    var mm = Math.floor(ms / 60000);
    var ss = Math.floor((ms % 60000) / 1000);
    var mmm = ms % 1000;
    out.push('[' + mm + ':' + (ss < 10 ? '0' : '') + ss + '.' + (mmm < 10 ? '00' : (mmm < 100 ? '0' : '')) + mmm + ']' + words);
  }
  if (!out.length) throw new Error('roma empty');
  return out.join('\n');
}

var LYRIC_ADAPTERS = {
  qq: async function (raw) {
    if (!raw || !raw.mid) throw new Error('qq no mid');
    // [v1.5.0 P2] 罗马音与主歌词并行取：roma 接口失败/无内容静默降级为 null，不阻塞主歌词
    var romaP = fetchQqRomaLrc(String(raw.mid)).catch(function () { return null; });
    var r = await axios.get('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      params: { g_tk: 5381, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8',
        notice: 0, platform: 'h5', needNewCode: 1, ct: 121, cv: 0,
        nobase64: 1, songmid: raw.mid },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://y.qq.com/portal/player.html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var lrc = r.data && r.data.lyric;
    if (!lrc) throw new Error('qq no lyric');
    var out = { rawLrc: normalizeColonTimeTag(String(lrc)) };
    var t = r.data && r.data.trans;
    if (t) {
      // [v1.1.0 fix#12] Buffer.from 在 Hermes（RN 纯 JS 引擎）下不存在，改纯 JS base64+UTF-8 解码
      try { out.translation = normalizeColonTimeTag(b64DecodeUtf8(String(t))); } catch (e) { /* 翻译可选 */ }
    }
    var roma = await romaP;
    if (roma) {
      out.romanization = roma; // 宿主 ILyricSource.romanization（lyric.d.ts 实际字段名）
      out.romaLrc = roma;      // 任务口径别名：同内容双字段，宿主消费 romanization
    }
    return out;
  }
};

// [v1.1.0 fix#12] 纯 JS base64 → UTF-8 字符串解码（替代 Buffer.from，Hermes 兼容）
var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var B64_LOOKUP = (function () {
  var m = {};
  for (var i = 0; i < B64_CHARS.length; i++) m[B64_CHARS.charAt(i)] = i;
  m['-'] = 62; // URL-safe 变体兼容
  m['_'] = 63;
  return m;
})();

function b64DecodeUtf8(b64) {
  var s = String(b64 || '').replace(/[\s=]+/g, '');
  var bytes = [];
  var acc = 0, bits = 0;
  for (var i = 0; i < s.length; i++) {
    var v = B64_LOOKUP[s.charAt(i)];
    if (v === undefined) throw new Error('invalid base64 char: ' + s.charAt(i));
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  // UTF-8 字节序列解码（含多字节代理对）
  var out = '', cp = 0, cont = 0, accCp = 0;
  for (var j = 0; j < bytes.length; j++) {
    var b = bytes[j];
    if (cont > 0) {
      accCp = (accCp << 6) | (b & 0x3f);
      cont--;
      if (cont === 0) {
        out += String.fromCodePoint ? String.fromCodePoint(accCp) : utf8CodePointToString(accCp);
      }
    } else if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b < 0xe0) {
      cont = 1; accCp = b & 0x1f;
    } else if (b < 0xf0) {
      cont = 2; accCp = b & 0x0f;
    } else {
      cont = 3; accCp = b & 0x07;
    }
  }
  return out;
}

// ES5 回退：>0xFFFF 码点手工转 UTF-16 代理对
function utf8CodePointToString(cp) {
  if (cp >= 0x10000) {
    cp -= 0x10000;
    return String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
  }
  return String.fromCharCode(cp);
}

// 歌词源尝试顺序（v0.7.0 优化，P1-5）：条目原生源优先（命中率高且省一次跨源请求）
var LYRIC_SOURCE_ORDER = ['qq'];

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
  platform: 'qq',
  version: '1.9.14', // [v1.9.14 包升版（网易源集成长青 SVIP 网易替补通道 yinyue.haitangw.net，本源无代码改动，随包升版）；v1.9.13 a.aa.cab/qq.music 虚标修复版（方案A·拒绝虚标）：2026-09-21 每日检查实测该端点对高音质/未知音质码一律回落 C400 HQ m4a 虚标（12 种 type 实测均然，违背「请求哪个音质就获取哪个音质」总原则）；修复三件套：①音质准入白名单 flac/flac24bit/lossless/hires/master/atmos/atmos_51/jymaster/dolby/super 入口即拒绝（不发请求），仅 ≤320k 参与竞速；②双守门 fail-closed——music URL 路径前缀识别实档（M500/C400=128k、M800=320k，未知前缀拒绝）+ tips fail-closed（未知 tips 一律拒绝，堵住 v1.9.12「未知 tips 跳过守门」漏过的「HQ 高品质」虚标）；③actualQuality 以前缀实档为准宁低勿高；详见头部 changelog；v1.9.12 a.aa.cab/qq.music 搜索型取链通道接入版（替换 v1.9.4 已禁用的旧 HelloWorld 通道，歌曲匹配+音质大小校验，userVariables.qqAaaCab 默认开，详见头部 changelog）；v1.9.11 星澜 stellarwave tx 通道核查版（无代码增量，版本号统一升）：星澜 43 后端池中 QQ 相关后端 2026-09-12 逐个真网复测全部失效（星海 403 认证墙/317ak 403/ygking 路径失效/念心 404/FishAPI 空响应/FFAPI 官宣关闭/QQ越权密钥失效/HYW 空响应/HelloWorld 已死/QQ官方与vkeys 同源无增量），按「只接实测可用」原则零通道接入、竞速池与取链行为零变化，详见头部 changelog；v1.9.10 随包升版（无代码改动，版本号统一升）；v1.9.9 音质标识一致性核查版（无代码行为改动，版本号统一升）：搜索/榜单/歌单/专辑/歌手/导入六页键集核查 0 虚标 0 不一致，取链真实性实测 6/6 通过（128k/320k/flac 实档与声明一致），详见排查总表-v1.9.9；v1.9.8版本号统一版（各源版本号对齐，无代码增量）；v1.9.5 全页面音质标识核查 + VIP 标识移除版：榜单聚合条目补 qualities 音质表透传（榜单页此前无音质标识）；全接口停写 fee（VIP 角标）字段、getMusicInfo 不再回填，VIP 语义改存 _src.qq.vip 内部字段仅供取链 vipPreRoute 预判，宿主不渲染；旧缓存条目向下兼容；v1.9.4 第三方取链修复 + size 字段版：5 路第三方探针实测 → 失效两通道（Hello World 2026-09-11 改版为云汐 API 主页、念心 2026-09-11 404 站点下线）保留函数体注释从竞速池移除；s01s-mid 扩档（pq 24bit/accom Atmos 直读 song_size_X_str 写回 size）+ 长青守门（仅 128k、解析响应 quality/size 字段）+ 海棠补 Range 0-0 HEAD 探测 size；getMediaSource 返回值补 size 字段（取链直带 > HEAD 探测 > 留空）；详见头部 changelog；v1.9.1 随包升版：歌单对象补 author 别名字段（宿主协议读 artist，任务字段清单要求 author，两者都传），导入修复详见酷狗 v1.9.1 changelog 与本轮自测清单；v1.9.0 BakaMusic 高价值音源接入版：P0 次合代 s01s mid 直查通道（resolveQqS01sMid，免搜索精确命中，sq 实测真 FLAC ~1647kbps）加入第三方竞速 6→7 路，userVariables.qqS01sMid 默认开；ikun QQ 通道无卡密假成功不接入；详见头部 changelog；v1.8.4] 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem（title/description 对齐宿主契约，meta 随 CgiGetDiss dirinfo 零额外请求回传）；[v1.8.3] 质检遗留优化版（Q-02/Q-03 复核确认已符合统一口径，随包升版）；2026-09-10 歌单解析修复版（SHEET_URL_RESOLVERS 补 playlistDetail/<id> + P2-4 错误码统一，详见头部 v1.8.2 changelog）
  primaryKey: ['id'], // [v1.5.0 P2] 插件级声明（宿主 pluginManager 存档约定，对齐网易云/咪咕）
  author: '研发2号',
  description: 'QQ音乐独立源插件 v1.9.13（v1.9.13 a.aa.cab/qq.music 虚标修复版·方案A：该端点对高音质/未知音质码一律回落 C400 HQ m4a 虚标，已加音质准入白名单（仅 ≤320k 参与竞速，高音质入口即拒绝）+ 路径前缀/tips 双守门 fail-closed，actualQuality 以前缀实档为准；v1.9.8 版本号统一版：各源版本号对齐，无代码增量；全页面音质标识核查 + VIP 标识移除版：榜单聚合条目补 qualities 音质表透传；全接口停写 fee（VIP 角标），VIP 语义改存 _src.qq.vip 内部字段仅供取链预判；v1.9.4 第三方取链修复 + size 字段版：5 路第三方探针实测 → 失效两通道（Hello World 2026-09-11 改版为云汐 API 主页、念心 2026-09-11 404 站点下线）保留函数体注释从竞速池移除；s01s-mid 扩档（pq 24bit/accom Atmos 直读 song_size_X_str 写回 size）+ 长青守门（仅 128k、解析响应 quality/size 字段）+ 海棠补 Range 0-0 HEAD 探测 size；getMediaSource 返回值补 size 字段（取链直带 > HEAD 探测 > 留空）；v1.9.1 随包升版：歌单对象补 author 别名字段，详见头部 v1.9.1 changelog；v1.9.0 BakaMusic 高价值音源接入版：P0 次合代 s01s mid 直查第三方通道加入竞速池（第三方 6→7 路，免搜索按 mid 精确命中，sq 档实测真 FLAC ~1647kbps，全部过 verifyQualitySize 魔数+大小校验，userVariables.qqS01sMid 默认开）；ikun QQ 通道无卡密返回 10 秒占位 mp3 假成功不接入（宁低勿高）；v1.8.4 歌单导入元数据版：importMusicSheet 返回完整 IMusicSheetItem 歌单对象——标题/介绍/封面随 CgiGetDiss dirinfo 零额外请求回传，介绍字段 description 对齐宿主 v1.0.0 契约；v1.8.3 质检遗留优化版：错误前缀与 code 口径复核确认已符合统一标准，随包升版；歌单解析修复版：歌单链接补 /playlistDetail/<id> 格式 + 歌单导入错误统一携带结构化 code；+ v1.8.0（v1.8.0 MV 参数对齐基线：getMvSourceImpl 顶层字段兜底+result 补 codec/duration/videoQuality 写回；基线 v1.7.1 修复与对齐：fix#1 flac24bit 音质实际请求 flac 丢 24bit——Hello World flac24bit 上移 master 档、长青 flac24bit 单独落 flac24bit 档、actualQuality 如实标 flac24bit（念心无 24bit 上游维持 flac，能力边界非缺陷）；fix#2 192k 档 actualQuality 错标 128k——hostQualityToActual 补 192k 显式分支；参数对齐 plugin.d.ts：IMusicItem/IMusicSheetItem 自报 platform、getMediaSource 返回补宿主标准 quality 字段、defaultSearchType 显式声明 music；v1.7.0（v1.7.0 第三方竞速通道接入：4 路并发竞速——QQ 自身串行链 + Hello World（a.aa.cab，主力）+ 长青（175.27.166.236，备份）+ 念心（mcp.nianxinxz.com，兜底），kuwoRaceSuccess 首个有效结果胜出；第三方通道含 URL/参数/音质映射如实对齐实测（master/flac24bit/flac/320k/128k），返回 URL 经 Range 探测 + 魔数校验（fLaC/ID3/MPEG）+ total 阈值 2MB，不匹配视为失败由竞速语义自然降级；hostQuality 透传——getMediaSource→resolveWithFallback→resolveQq 链路把宿主原始 quality 键传至第三方通道用于音质映射选择；优先级官方 > Hello World > 长青 > 念心；4 路实现完整可用但 a.aa.cab/mcp.nianxinxz.com 端点当前已降级/下线，竞速时如实记录并接力下一通道；v1.6.1（v1.6.1 HotDownloader 借鉴优化：P0 QRC 逐字方案对拍——HD 逐位 DES 与本插件 SP 表版对真实密文解密结果逐字符一致、SP 表版快 2.2 倍（2.2ms vs 4.8ms/次），维持现有实现不迁移；P0 登录态注入——userVariables.qqAuthst（qm_keyst/musickey）+qqUin 或 Cookie 自动解析，有凭据时官方 CgiGetVkey/GetEVkey 按 HD 形态把 uin/qq/authst 注入 comm 体并带 param.uin/loginflag:1/platform:20，purl 前缀动态取响应 sip 列表（匿名行为与 v1.6.0 一致）；P1 HD 13 档核实不加档——AIM0/Q0M0 匿名 ekey 可签发但 purl 需登录态，全链不可验证不瞎加，C200~O6M0 为已声明档位同内容封装；P2 HD 搜索/歌单/热键接口无增量不迁移。v1.6.0 对齐 go-music-dl 调研 P0+P1：P0 GetVkey 批量 7 前缀——单请求同时查 AI00/Q001/Q000/F000/O801/M800/M500（comm cv=4747474），一次 RTT 探明全部档位，取链延迟近似减半，并补齐 v1.5.0 缺失的 5 个前缀（AI00 母带/Q001·Q000 臻音/F000 无损/O801 全景声），filename 按响应 byName map 匹配；X-Forwarded-For 随机国内 IP 机会主义头（purl 签发与出口 IP 强相关）。P1 soso 老搜索兜底——do_search_v2 报错/零结果回落 c.y.qq.com search_for_qq_cp，Referer 常量 https://y.qq.com/portal/search.html（实测不带=0 条）；pay 双口径兼容（payplay/paymonth/paydownload 老口径）；VIP 预判——fee=1 且无 Cookie 时跳过官方段（EVkey/明文 CgiGetVkey）直进第三方链。v1.5.0 字段补齐：fee VIP 角标（pay 对象实测映射，五处条目构建点+getMusicInfo 回填）/primaryKey（插件声明 ["id"] + 条目携带 songmid）/罗马音歌词（GetPlayLyricInfo roma=1 → QRC 解密 → 标准 LRC，romanization+romaLrc 双字段，并行取失败静默降级）；alias 如实不补（各接口无别名字段）。v1.4.0 对齐 baka + 宿主协议；v1.4.0 取链并行竞速——酷我官方与海棠第三方由链尾串行/慢路径对冲提前为取链入口同时发起，与 QQ 自身串行链三路竞速（kuwoRaceSuccess 首个有效结果胜出，慢路不 cancel 结果丢弃），链内共享 Promise 不重发，降级链/试听守卫/负缓存/预算不变）：搜索/歌词搜索/取链/QRC 逐字（3DES 解密）/榜单/歌单（真分类推荐+pinned 扁平）/歌手/专辑全量翻页/MV 富结果（360p~4k 档位/宽高/码率/备用链）/评论分页（数值时间戳+子评论）/相似歌曲/热搜全功能；取链接力：官方 CgiGetVkey 批量 7 前缀 + GetEVkey 加密档 + UrlGetVkey 小米通道 + vkeys旧版（VIP歌全长） + vkeys /v2 + 听会代理（酷我CDN，v1.3.1 验真恢复） + s01s + 海棠 + bugpk + cyapi（仅 high 档 320k）+ 酷我官方接口全音质兜底（standard 128k / high 320k / super 2000kflac 竞速，v1.3.6 换血——96k 降级兜底段全部摘除）+ 咪咕官方取链二级兜底（v1.3.7：h5/v2.4 为主 + v2.1/302 备份竞速，全音质派生，试听/探测失败如实回落并标注），失败负缓存 + 递减超时预算，actualQuality 如实标注，试听片段守卫 4xx 拦截；全链路免登录（可选 Cookie 增强）。v1.2.1 修复：榜单分组去"聚合"遗留命名（改 QQ榜单）；榜单封面对齐宿主 coverImg 字段并回填缺图；歌单曲数对齐 dirinfo.songnum，修 listennum 误作 worksNum。v1.3.0：P0 音质大小传递——搜索/歌词搜索/榜单/歌单/专辑/歌手/详情条目携带 qualities[].size（parseQqFileQualities + CgiGetTrackInfo 批量补齐），getMusicInfo 补 qualities 回填（宿主缺失时自动补齐）；P2 MV availableVideoQualities 补 codec。高端档（master/atmos/dolby）经真实请求核验无可交付通道（占位片段），维持宁缺毋假不虚标。v1.3.1：结合《QQ音乐接口完整文档_实测整合版》全量实测（8 可用接口逐一真实请求验证），接入 vkeys旧版（VIP 歌全长 M500/M800）/ 听会代理（standard/exhigh 全长与 qualities.size 一致）/ HYWmusic（96k AAC 链尾）；海棠w.net 备域名、cyapi 族（缺 apikey）、s01s 实测不可用未接入。v1.3.2：听会通道瞬时 502 加固——3 次尝试 + 指数退避（300/600ms）+ 递减超时（2s/1.5s/1s），段内 5s 预算封顶，仅 502/503/504 与网络错误重试。',
  supportedSearchType: ['music', 'album', 'artist', 'sheet', 'lyric'],
  // [v1.7.1 对齐] defaultSearchType 显式声明（宿主 d.ts 可选字段，对齐酷我 v1.2.6 口径）
  defaultSearchType: 'music',
  // [v0.7.2 fix#8 核验] supportedQualities 自 v0.7.0 已全档声明：含 flac/flac24bit/hires（无损与 Hi-Res
  // 在音质菜单可见）；宿主增强音质键（master/atmos/dolby/vinyl 等）经 QUALITY_KEY_MAP 全量映射到内部
  // 档位，normalizeQuality 兜底 standard，无需改动。
  // [v1.1.0 fix#2] supportedQualities 去 'hires'（假支持下线）：海棠 tx hires 实测 64 字节占位文件、
  // vkeys 高解析档实测 code=500，无可用真实 hires 通道；宿主 hires/master 等增强键经
  // QUALITY_KEY_MAP 映射 super（真无损），菜单不再虚标 hires 档。
  supportedQualities: ['128k', '192k', '320k', 'flac', 'flac24bit'],
  cacheControl: 'no-store', // 各源播放链接多为签名短时效链接，必须现取
  userVariables: [
    { key: 'qqEvkey', name: 'QQ 加密档取链 GetEVkey（默认开）', hint: '设为 off 关闭；开启后无损档优先走 QQ GetEVkey 加密通道（需家宽/真机 IP，数据中心 IP 下该接口大概率风控，失败自动接力明文备源）' },
    { key: 'qqCookie', name: 'QQ Cookie（可选）', hint: '选填；填写后可提升取链成功率并解锁 VIP 档 MV（1080p/4k，无 Cookie 时由接口 code 过滤自动降档）。含 qm_keyst 时自动作为登录态注入取链 comm 体，无需再填 qqAuthst' },
    { key: 'qqAuthst', name: 'QQ 登录凭据 qm_keyst（可选·v1.6.1 新增）', hint: '选填；即 Cookie 里的 qm_keyst/musickey 值（网页版 y.qq.com 登录后 F12 → Application → Cookies 复制），与 qqUin 搭配注入取链请求 comm 体（HotDownloader 同款形态），提升无损/母带档 purl 签发率。优先级高于 Cookie 内 qm_keyst；凭据过期（取链连续 104003）后需重新复制' },
    { key: 'qqUin', name: 'QQ 数字 uin（可选·v1.6.1 新增）', hint: '选填；与 qqAuthst 搭配使用（Cookie 含 uin 时可自动解析，无需填写）' },
    { key: 'qqS01sMid', name: '次合代第三方通道（v1.9.0 新增，默认开）', hint: '设为 off 关闭；s01s mid 直查形态（免搜索精确命中，sq 档实测真 FLAC ~1647kbps），加入第三方竞速池，校验不过自动静默让路' },
    { key: 'qqAaaCab', name: 'a.aa.cab 搜索型通道（v1.9.12 新增，默认开）', hint: '设为 off 关闭；a.aa.cab/qq.music 搜索型取链（替换 v1.9.4 已禁用旧 HelloWorld 通道）；v1.9.13 起按方案A 拒绝虚标：仅 ≤320k 档参与竞速（128k/192k/320k/exhigh），flac 及以上音质入口即拒绝由其他通道承担；路径前缀+tips 双守门 fail-closed，校验不过自动静默让路' }
  ],
  hints: {
    search: ['检索 QQ 音乐曲库', '播放时自动选择最优可用取链通道，主通道失败自动切换备源'],
    importMusicSheet: [
      '支持 QQ 音乐的歌单分享链接，如 y.qq.com/n/ryqq/playlist/xxx',
      '也支持纯数字歌单 ID（QQ 单源无歧义）；单次最多导入 500 首'
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
    if (type === 'lyric') return searchLyricQq(q, page);
    if (type !== 'music') return { isEnd: true, data: [] };

    var names = ['qq'];
    // [v1.1.0 fix#4] 捕获各源失败根因：全部失败时透传底层错误，不再吞掉真正原因
    var lastErr = '';
    var tasks = names.map(function (n) {
      return SEARCH_ADAPTERS[n](q, page).catch(function (e) {
        lastErr = String((e && e.message) || e).slice(0, 160);
        return [];
      });
    });
    var settled = await Promise.all(tasks);
    var all = [];
    var okCount = 0;
    var maxTotal = 0;
    for (var i = 0; i < settled.length; i++) {
      if (settled[i] && settled[i].length > 0) okCount++;
      var srcTotal = (settled[i] && settled[i].total) || 0;
      if (srcTotal > maxTotal) maxTotal = srcTotal;
      all = all.concat(settled[i] || []);
    }
    if (okCount === 0) throw new Error('聚合搜索失败：所有音源请求均失败' + (lastErr ? ('（根因：' + lastErr + '）') : ''));

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
    // [v1.1.0 审查#10] isEnd 用服务器 total_num 判定（缺 total 时回退旧行为）
    return { isEnd: maxTotal > 0 ? (page * SEARCH_PAGE_SIZE >= maxTotal) : (data.length === 0), data: data };
  },

  async getMediaSource(musicItem, quality) {
    if (!musicItem) throw new Error('missing musicItem');
    var q = normalizeQuality(quality);
    // [v1.7.0 P1] hostQuality：宿主原始 quality 键透传至 resolveWithFallback → resolveQq → 第三方通道
    // 用于第三方音质映射选择。空值兜底为 internal 派生（标准回退逻辑）。
    var hostQ = String(quality || '');
    // [v1.1.0 优化#14] 本地曲目（无 _src 源映射、自带 url）直接返回，跳过整条取链接力
    if ((!musicItem._src || !Object.keys(musicItem._src).length) && musicItem.url) {
      // [v1.7.1 对齐] IMediaSourceResult 标准字段 quality 回填（宿主读 quality 展示实际档位）
      var localQ = internalToHostQuality(q);
      // [v1.9.4] 本地直传 url 尝试 HEAD 探测 size（无 size 时不阻断，宿主缺失时仍可播放）
      return probeHeadSize(musicItem.url, 2000).then(function (size) {
        var out = { url: String(musicItem.url), actualQuality: localQ, quality: localQ, channel: 'local' };
        if (size > 0) out.size = size;
        return out;
      }).catch(function () {
        return { url: String(musicItem.url), actualQuality: localQ, quality: localQ, channel: 'local' };
      });
    }
    // [v1.7.1 对齐] IMediaSourceResult 标准字段 quality 回填：各通道仅携带扩展字段
    // actualQuality（宿主 d.ts 无此字段），边界处统一补齐 quality = actualQuality
    // [v1.9.4] 边界补 size 兜底：竞速链返回无 size 时（如老通道/官方链未带 size 字段），
    // Range 0-0 HEAD 探测 Content-Length 写回；探测失败留空（不阻断取链）。
    return resolveWithFallback(musicItem, q, hostQ).then(function (r) {
      if (r && r.url && r.quality === undefined && r.actualQuality) r.quality = r.actualQuality;
      if (r && r.url && !r.size) {
        return probeHeadSize(r.url, 2000).then(function (size) {
          if (size > 0) r.size = size;
          return r;
        }).catch(function () { return r; });
      }
      return r;
    });
  },

  async getLyric(musicItem) {
    return getLyricImpl(musicItem);
  },

  // v0.7.0 P0-2：逐字歌词（QQ QRC，原生源优先 + 接力）
  async getWordByWordLyric(musicItem) {
    return getWordByWordLyricImpl(musicItem);
  },

  // v0.7.0 P0-3：单曲分享链接导入（QQ）
  async importMusicItem(urlLike) {
    return importMusicItemImpl(urlLike);
  },

  // v0.7.0 P0-4：歌曲详情（多源补齐封面/专辑/时长/MV）
  // [v0.7.2 fix#9 核验] getMusicInfo 自 v0.7.0 P0-4 已实现（getMusicInfoImpl）：详情补齐
  // （专辑/时长/MV 字段）。
  async getMusicInfo(musicItem) {
    return getMusicInfoImpl(musicItem);
  },

  async getTopLists() {
    // [v1.2.1 fix#1] 原首组命名'聚合榜单'是 v0.8.0 多源聚合时代的遗留（CHART_DEFS 现已全为 QQ 榜），
    // QQ 单源插件不该出现"聚合"概念，对齐 QQ 官方分组口径改为'QQ榜单'。
    // [v1.2.1 fix#2] 封面字段对齐宿主 topListItem.tsx 读取的 coverImg（原只给 artwork 不显示）；
    // 官方 GetAll 成功时用 headPicUrl 回填 CHART_DEFS 中缺封面的榜单（new/west 原 cover 为空）。
    var officialGroups = [];
    try {
      officialGroups = await fetchQqToplistGroups();
    } catch (e) { /* 可选组 */ }
    var coverByTopId = {};
    for (var oi = 0; oi < officialGroups.length; oi++) {
      var odata = officialGroups[oi].data || [];
      for (var oj = 0; oj < odata.length; oj++) {
        var om = /^qqtop~(\d+)$/.exec(odata[oj].id || '');
        if (om && odata[oj].coverImg && !coverByTopId[om[1]]) coverByTopId[om[1]] = odata[oj].coverImg;
      }
    }
    var groups = [{
      title: 'QQ榜单',
      data: CHART_DEFS.map(function (d) {
        var qqTopId = d.members && d.members[0] && d.members[0].source === 'qq' ? String(d.members[0].id) : '';
        var cover = d.cover || coverByTopId[qqTopId] || '';
        // [v1.7.1 qa#2 P2] 榜单卡片补 IMusicSheetItem 标准字段 platform（同批 platform 对齐）
        return { id: d.id, title: d.title, coverImg: cover, artwork: cover, platform: 'qq' };
      })
    }];
    for (var qi = 0; qi < officialGroups.length; qi++) groups.push(officialGroups[qi]);
    return groups;
  },

  async getTopListDetail(topListItem, page) {
    var tid = (topListItem && topListItem.id) || '';
    // [v0.8.0] QQ 官方榜：'qqtop~{topId}' —— GetDetail 分页（每页 100，复用 CHART_FETCHERS.qq 映射）
    if (tid.indexOf('qqtop~') === 0) {
      var qqTopId = tid.slice(6);
      var qp = page || 1;
      var qrows = await CHART_FETCHERS.qq(qqTopId, (qp - 1) * 100);
      var qMusicList = qrows.map(buildSheetItem);
      return { isEnd: qrows.length < 100, musicList: qMusicList, topListItem: { id: topListItem.id, title: topListItem.title, coverImg: topListItem.coverImg, artwork: topListItem.artwork, platform: 'qq' } };
    }
    if (page && page > 1) return { isEnd: true, musicList: [] };
    var def = findChartDef(tid);
    if (!def) throw new Error('未知榜单: ' + tid);
    var musicList2 = await getAggregatedChart(def);
    return { isEnd: true, musicList: musicList2, topListItem: { id: topListItem.id, title: topListItem.title, coverImg: topListItem.coverImg, artwork: topListItem.artwork, platform: 'qq' } };
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
  // [v1.2.0 对齐 baka] 歌曲详情页外链（宿主 IPluginDefine.getMusicDetailPageUrl）
  getMusicDetailPageUrl(musicItem) {
    var srcMap = musicItem && musicItem._src;
    var mid = srcMap && srcMap.qq && srcMap.qq.mid;
    if (!mid && musicItem && musicItem.songmid) mid = String(musicItem.songmid);
    return mid ? 'https://y.qq.com/n/ryqq/songDetail/' + mid : undefined;
  },

  supportedVideoQualities: [
    // [v1.2.0 对齐 baka] MV 档位声明修正：ft10 实为 360p，补 4k
    { key: '360p', label: '360P' },
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
    pickCandidates: pickCandidates,
    canServe: canServe,
    qqEvkeyRequest: qqEvkeyRequest,
    resolveQqVkeys: resolveQqVkeys,
    resolveQqS01s: resolveQqS01s,
    resolveQqPlainOfficial: resolveQqPlainOfficial,
    resolveQq: resolveQq,
    qrcDecryptHex: qrcDecryptHex,
    fetchQqQrc: fetchQqQrc,
    fetchQqQrcRelay: fetchQqQrcRelay,
    fetchQqToplistGroups: fetchQqToplistGroups,
    randomGuid: randomGuid,
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
    searchLyricQq: searchLyricQq,
    parseQqFileQualities: parseQqFileQualities,
    fetchQqTrackInfoSizes: fetchQqTrackInfoSizes,
    normalizeColonTimeTag: normalizeColonTimeTag,
    aggregateSearchBy: aggregateSearchBy,
    // v0.7.0 新增（P0/P1 自测用）
    normalizeQuality: normalizeQuality,
    QUALITY_KEY_MAP: QUALITY_KEY_MAP,
    importMusicItemImpl: importMusicItemImpl,
    getMusicInfoImpl: getMusicInfoImpl,
    getWordByWordLyricImpl: getWordByWordLyricImpl,
    // [v1.5.0 P1/P2] 字段补齐（自测用）：fee 映射 / 罗马音取词
    qqFeeOf: qqFeeOf,
    fetchQqRomaLrc: fetchQqRomaLrc,
    SONG_URL_RESOLVERS: SONG_URL_RESOLVERS,
    resolveSongId: resolveSongId,
    SONG_DETAIL_FETCHERS: SONG_DETAIL_FETCHERS,
    fetchQqComments: fetchQqComments,
    haitangLevelOf: haitangLevelOf,
    resolveHaitang: resolveHaitang,
    // [v1.7.0] 第三方取链通道 4 路竞速（自测用）
    // [v1.9.12] resolveQqHelloWorld（旧 mid 直查形态）v1.9.4 已禁用删除，替换为 resolveQqAaaCab（搜索型新端点）
    resolveQqAaaCab: resolveQqAaaCab,
    resolveQqChangqing: resolveQqChangqing,
    resolveQqNianxin: resolveQqNianxin,
    verifyQualitySize: verifyQualitySize,
    thirdPartyTierOf: thirdPartyTierOf,
    changqingTierOf: changqingTierOf,
    nianxinTierOf: nianxinTierOf,
    hostQualityToActual: hostQualityToActual,
    // [v1.3.1] 接口文档实测扩充：vkeys旧版 / 听会代理恢复 / HYWmusic 链尾
    resolveQqVkeysLegacy: resolveQqVkeysLegacy,
    resolveQqTinghui: resolveQqTinghui,
    // [v1.3.2] 听会 502 重试加固：重试分类器 + 常量表（自测用）
    tinghuiIsRetryable: tinghuiIsRetryable,
    TINGHUI_ATTEMPT_TIMEOUTS: TINGHUI_ATTEMPT_TIMEOUTS,
    TINGHUI_BACKOFFS: TINGHUI_BACKOFFS,
    TINGHUI_RETRY_TOTAL: TINGHUI_RETRY_TOTAL,
    resolveQqCyapi: resolveQqCyapi,
    // [v1.3.6] 酷我官方全音质兜底（HYW/xcvts/玉宁熙已退出接力链；v1.3.8 删除三者死代码）
    resolveKuwoFallback: resolveKuwoFallback,
    // [v1.4.0] 同曲严格校验四件套（自测用）：候选搜索 / 同曲筛选 / 逐项校验 / 标签拆分
    searchKuwoCandidates: searchKuwoCandidates,
    pickKuwoRid: pickKuwoRid,
    kuwoSameTrackCheck: kuwoSameTrackCheck,
    kuwoVersionSplit: kuwoVersionSplit,
    kuwoArtistSet: kuwoArtistSet,
    kuwoOfficialResolve: kuwoOfficialResolve,
    kuwoDesResolve: kuwoDesResolve,
    kuwoRaceSuccess: kuwoRaceSuccess,
    kuwoEncryptQuery: kuwoEncryptQuery,
    KUWO_BR: KUWO_BR,
    // [v1.3.7] 咪咕官方取链二级兜底（h5/v2.4 为主，供通道级实测）
    resolveMiguFallback: resolveMiguFallback,
    searchMiguCid: searchMiguCid,
    decryptH5v24: decryptH5v24,
    miguH5Resolve: miguH5Resolve,
    miguAppResolve: miguAppResolve,
    migu305Resolve: migu305Resolve,
    deriveMiguUrl: deriveMiguUrl,
    miguActualQuality: miguActualQuality,
    H5V24_KEY: H5V24_KEY,
    CYAPI_KEY: CYAPI_KEY,
    chainSegTimeout: chainSegTimeout,
    setChainDeadlineForTest: function (v) { CHAIN_DEADLINE = v; },
    // [v1.1.0] resolveTinghuiQq 曾删除（听会 HTTP 裸 IP 段剔除），v1.3.1 以验真形式恢复为 resolveQqTinghui
    resolveQqBugpk: resolveQqBugpk,
    resolveQqUrlGetVkey: resolveQqUrlGetVkey,
    negCacheCheck: negCacheCheck,
    negCacheRecord: negCacheRecord,
    // [v1.1.0] 接口扩充：MV 搜索 / 相似歌曲 / 热门搜索 / base64-Hermes 兼容解码
    searchMvQq: searchMvQq,
    getSimilarSongsQq: getSimilarSongsQq,
    getHotSearchQq: getHotSearchQq,
    b64DecodeUtf8: b64DecodeUtf8,
    LYRIC_TIMEOUT: LYRIC_TIMEOUT,
    // v0.7.1 新增（走查修复自测用）
    isAllowedMediaUrl: isAllowedMediaUrl,
    withTimeout: withTimeout,
    RESOLVE_BUDGET_MS: RESOLVE_BUDGET_MS,
    RELAY_TIMEOUT: RELAY_TIMEOUT,
    // [v0.7.2] 新增（还债包回归自测用）
    internalToHostQuality: internalToHostQuality,
    resolveWithFallback: resolveWithFallback
  }
};

// ---------- [v1.1.0 第二部分·接口覆盖度扩充] ----------
// 高优2 MV 搜索：SearchCgiService.DoSearchForQQMusicDesktop search_type=4（探针 2026-09-06 复核：
//   do_search_v2 的 item_mv 为空壳，实际条目在 body.mv.list[]，vid 字段名是 v_id）
async function searchMvQq(kw, page) {
  var p = page || 1;
  var res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '11', cv: '1003006' },
    req: { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicDesktop',
      param: { query: kw, search_type: 4, page_num: p, num_per_page: SEARCH_PAGE_SIZE } }
  }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS });
  var grp = res.data && res.data.req && res.data.req.data &&
    res.data.req.data.body && res.data.req.data.body.mv;
  var list = (grp && grp.list) || [];
  // QQ 搜索网关偶发整页空响应（2026-09-06 自测复现：同参重发即有数据），首页空时补试一次
  if (!list.length && p === 1) {
    var res2 = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      comm: { ct: '11', cv: '1003006' },
      req: { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicDesktop',
        param: { query: kw, search_type: 4, page_num: p, num_per_page: SEARCH_PAGE_SIZE } }
    }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS });
    grp = res2.data && res2.data.req && res2.data.req.data &&
      res2.data.req.data.body && res2.data.req.data.body.mv;
    list = (grp && grp.list) || [];
  }
  var items = list.map(function (it) {
    if (!it || !it.v_id) return null;
    return {
      vid: String(it.v_id),
      title: stripEm(it.mv_name || it.mvName_hilight || ''),
      artist: Array.isArray(it.singer_list) && it.singer_list.length
        ? it.singer_list.map(function (s) { return s.name; }).join('/')
        : stripEm(String(it.singer_name || '')),
      cover: it.mv_pic_url || undefined,
      duration: parseInt(it.duration, 10) || undefined,
      playCount: it.play_count,
      publishDate: it.publish_date,
      raw: { vid: String(it.v_id) }
    };
  }).filter(Boolean);
  var total = parseInt((grp && (grp.total_num || grp.sum)) || 0, 10) || 0;
  items.total = total;
  return { isEnd: total > 0 ? (p * SEARCH_PAGE_SIZE >= total) : (items.length < SEARCH_PAGE_SIZE), data: items };
}

// 高优4 相似歌曲：music.recommend.TrackRelationServer GetSimilarSongs（探针 2026-09-06 验证，
//   响应 vecSong[]，每项 track.{mid,name,singer[],album,album.mid,file.media_mid,interval}）。
// 入参支持 mid（内部经 fetchQqSongNumericId 换数字 id）或直接传数字 songid。
async function getSimilarSongsQq(midOrSongId, limit) {
  var n = parseInt(limit, 10) || 30;
  var numId = /^\d+$/.test(String(midOrSongId)) ? String(midOrSongId) : await fetchQqSongNumericId(midOrSongId);
  var res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '24', cv: '0' },
    req: { module: 'music.recommend.TrackRelationServer', method: 'GetSimilarSongs',
      param: { songid: parseInt(numId, 10), vecSimilarSongids: [] } }
  }, { timeout: SOURCE_TIMEOUT, headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Content-Type': 'application/json' } });
  var vec = res.data && res.data.req && res.data.req.data && res.data.req.data.vecSong;
  if (!Array.isArray(vec)) return [];
  return vec.slice(0, n).map(function (v) {
    var t = (v && v.track) || {};
    var singers = Array.isArray(t.singer) ? t.singer.map(function (s) { return s.name; }).join('/') : '';
    var album = t.album || {};
    return {
      source: 'qq', sid: t.mid,
      title: t.name || '',
      artist: singers,
      album: album.name || '',
      artwork: album.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + album.mid + '.jpg' : undefined,
      duration: (t.file && t.file.interval) || t.interval || undefined,
      raw: { mid: t.mid, songid: numId }
    };
  }).filter(function (x) { return x.sid && x.title; });
}

// 中优8 热门搜索：fcg-bin/gethotkey.fcg（30 条 {k,n}，k=关键词 n=热度，首条为搜索框默认词）
async function getHotSearchQq() {
  var res = await axios.get('https://c.y.qq.com/splcloud/fcgi-bin/gethotkey.fcg', {
    params: { format: 'json' },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  var hotkey = res.data && res.data.data && res.data.data.hotkey;
  if (!Array.isArray(hotkey)) return [];
  return hotkey.map(function (h) { return { keyword: h.k, score: h.n }; })
    .filter(function (x) { return x.keyword; });
}

module.exports = plugin;

function formatTs(ts){var d=new Date(Number(ts));if(isNaN(d.getTime()))return '';return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}

// ==================== v0.5.0 追加段 A：专辑/歌手/歌单搜索（QQ 源） ====================
// 端点全部出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核（artifacts/v05-probe/）。
// 注：本段位于 module.exports 之后，函数声明提升 + 调用时求值，行为与前置声明一致。

var SEARCH_PAGE_SIZE = 20;

function stripEm(s) {
  return String(s == null ? '' : s).replace(/<\/?em>/g, '');
}

var QQ_SEARCH_HEADERS = {
  Referer: 'https://y.qq.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Content-Type': 'application/json'
};
// QQ 全类别搜索（文档 2.4/7.1）：comm ct=11/cv=1003006 + SearchCgiService
function qqCategorySearch(method, searchType, q, page) {
  var body = {
    comm: { ct: '11', cv: '1003006' },
    req: {
      module: 'music.search.SearchCgiService', method: method,
      param: { search_type: searchType, query: q, page_num: page, num_per_page: SEARCH_PAGE_SIZE }
    }
  };
  return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body, {
    timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS
  }).then(function (r) {
    var reqData = r.data && r.data.req && r.data.req.data;
    if (!reqData) throw new Error('qq category search: no data');
    return reqData;
  });
}

function searchAlbumQq(q, page) {
  // doc 2.4：DoSearchForQQMusicMobile t2 → body.item_album.list[]
  // ⚠️ 实测该通道间歇可用（探针 r7/r8 期间偶发为空），故做双通道接力：
  // 先 Mobile t2，0 条再回落 do_search_v2（ct24，body.item_album.items[]，探针 r8 结构）。
  function mapMobile(it) {
    var mid = str(it.mid || it.albummid || it.id);
    return {
      source: 'qq', sid: mid,
      title: stripEm(it.name || it.albumname),
      artist: splitArtists(it.singer),
      artwork: it.pic || it.img || (mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + mid + '.jpg' : ''),
      date: it.timePublic || it.aDate || '',
      worksNum: it.track_num || 0,
      raw: { mid: mid }
    };
  }
  function mapV2(it) {
    var ci = it.ci || {};
    var mid = str(ci.mid || it.mid || it.id);
    return {
      source: 'qq', sid: mid,
      title: stripEm(it.title || it.name),
      artist: str(ci.singer_name || ''),
      artwork: it.pic || (mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + mid + '.jpg' : ''),
      date: it.publishDate || (it.desc ? String(it.desc).slice(-10) : ''),
      worksNum: Number(ci.track_num) || 0,
      raw: { mid: mid }
    };
  }
  // [v1.1.0 收尾修复] 主路改 Desktop 通道：body.album.list[]（字段 albumMID/albumName/albumPic/
  // publicTime/singerName/song_count，2026-09-06 探针复核）；Mobile t2 与 do_search_v2 的
  // item_album 现均为空壳（仅 extra_info/more_info 元信息），降为后备。
  function mapDesktop(it) {
    var mid = str(it.albumMID || it.mid || it.albummid);
    var singers = Array.isArray(it.singer_list)
      ? it.singer_list.map(function (s) { return s.name; }).join('/')
      : stripEm(it.singerName || '');
    return {
      source: 'qq', sid: mid,
      title: stripEm(it.albumName || it.name),
      artist: singers,
      artwork: it.albumPic || it.pic || (mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + mid + '.jpg' : ''),
      date: it.publicTime || it.timePublic || '',
      worksNum: parseInt(it.song_count, 10) || it.track_num || 0,
      raw: { mid: mid }
    };
  }
  return qqCategorySearch('DoSearchForQQMusicDesktop', 2, q, page).then(function (reqData) {
    var g = ((reqData || {}).body || {}).album;
    var list = (g && (g.list || g.items)) || [];
    return list.map(mapDesktop).filter(function (it) { return it.sid && it.title; });
  }).then(function (items) {
    if (items.length > 0) return items;
    return qqCategorySearch('DoSearchForQQMusicMobile', 2, q, page).then(function (reqData) {
      var g = ((reqData || {}).body || {}).item_album;
      var list = (g && (g.list || g.items)) || [];
      return list.map(mapMobile).filter(function (it) { return it.sid && it.title; });
    });
  }).then(function (items) {
    if (items.length > 0) return items;
    // 回落通道：do_search_v2（探针 r8_qq_album_direct 结构）
    return axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      comm: { ct: '24', cv: '0' },
      req: { module: 'music.adaptor.SearchAdaptor', method: 'do_search_v2', param: { query: q, search_type: 2, page_num: page, num_per_page: SEARCH_PAGE_SIZE } }
    }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS }).then(function (r) {
      var g = (((r.data || {}).req || {}).data || {}).body;
      g = g && g.item_album;
      var list = (g && (g.items || g.list)) || [];
      var out = list.map(mapV2).filter(function (it) { return it.sid && it.title; });
      // [v1.1.0 审查#10] do_search_v2 item_album.total_num 透传供 isEnd 判定
      out.total = parseInt((g && g.total_num) || 0, 10) || 0;
      return out;
    });
  });
}

function searchArtistQq(q, page) {
  // doc 7.1：DoSearchForQQMusicDesktop t1 → body.singer.list[]（字段驼峰，探针复核）
  return qqCategorySearch('DoSearchForQQMusicDesktop', 1, q, page).then(function (reqData) {
    var list = (((reqData || {}).body || {}).singer || {}).list || [];
    return list.map(function (it) {
      var mid = str(it.singerMID);
      return {
        source: 'qq', sid: mid,
        name: stripEm(it.singerName),
        avatar: it.singerPic ? String(it.singerPic) : '',
        worksNum: it.songNum || 0,
        raw: { singerMID: mid, singerId: it.singerID ? String(it.singerID) : '', name: stripEm(it.singerName) }
      };
    }).filter(function (it) { return it.sid && it.name; });
  });
}

function searchSheetQq(q, page) {
  // doc 2.4：Mobile t3 → body.item_songlist[]（dissid/dissname，封面 logo，探针 r8）
  return qqCategorySearch('DoSearchForQQMusicMobile', 3, q, page).then(function (reqData) {
    var list = ((reqData || {}).body || {}).item_songlist || [];
    return list.map(function (it) {
      var dissid = str(it.dissid || it.disstid);
      return {
        source: 'qq', sid: dissid,
        title: stripEm(it.dissname || it.name),
        artist: it.nickname || '',
        artwork: it.logo || it.imgurl || it.img || '',
        worksNum: it.songnum || 0,
        raw: { listId: dissid }
      };
    }).filter(function (it) { return it.sid && it.title; });
  });
}

var ALBUM_SEARCH_ADAPTERS = {
  qq: searchAlbumQq
};
var ARTIST_SEARCH_ADAPTERS = {
  qq: searchArtistQq
};
var SHEET_SEARCH_ADAPTERS = {
  qq: searchSheetQq
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
    platform: 'qq',
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
    platform: 'qq',
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
    platform: 'qq',
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
  // [v1.1.0 fix#4] 记录各源失败根因，全部失败时透传
  var lastErr = '';
  var tasks = names.map(function (n) {
    return adapterMap[n](q, page).catch(function (e) {
      lastErr = String((e && e.message) || e).slice(0, 160);
      if (process && process.env && process.env.AG_DEBUG) console.error('[adapter:' + n + '] ' + lastErr);
      return [];
    });
  });
  var settled = await Promise.all(tasks);
  if (process && process.env && process.env.AG_DEBUG) {
    for (var di = 0; di < settled.length; di++) console.error('[agg:' + names[di] + '] items=' + (settled[di] || []).length);
  }
  var all = [];
  var okCount = 0;
  var maxTotal = 0;
  for (var i = 0; i < settled.length; i++) {
    if (settled[i] && settled[i].length > 0) okCount++;
    var srcTotal = (settled[i] && settled[i].total) || 0;
    if (srcTotal > maxTotal) maxTotal = srcTotal;
    all = all.concat(settled[i] || []);
  }
  if (okCount === 0) throw new Error('聚合搜索失败：所有音源请求均失败' + (lastErr ? ('（根因：' + lastErr + '）') : ''));
  var groups = aggregateBy(all, keyOf);
  var data = [];
  for (var j = 0; j < groups.length; j++) data.push(buildItem(groups[j], j));
  data.sort(function (a, b) {
    var sa = (a.artwork ? 2 : 0) + (a.worksNum ? 1 : 0);
    var sb = (b.artwork ? 2 : 0) + (b.worksNum ? 1 : 0);
    return sb - sa;
  });
  // [v1.1.0 审查#10] isEnd 用服务器 total_num 判定（适配器透传 total 时），避免整页空请求
  return { isEnd: maxTotal > 0 ? (page * SEARCH_PAGE_SIZE >= maxTotal) : (data.length === 0), data: data };
}

// ==================== v0.5.0 追加段 B：详情解析 / 歌手作品 / MV / 推荐歌单 / 评论 ====================
// 端点全部出自《六平台接口文档（实测整合版）》并经 2026-09-05 探针复核：
// - QQ：fcg_v8_album_info_cp.fcg / GetAlbumSongList(doc 8.1-8.2)、GetAlbumList(doc 7.4)、
//   GetMvUrls(doc 9.3，ft10/20/30 免费，ft40/50 code=1000 需VIP，必须带 guid) [探针 r8_qq_mv_full]
// - 歌单广场：QQ GetRecommendFeed(doc 6.5)

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
// [v1.1.0 审查#8] GetAlbumSongList 单页拉取（主路补齐 + 副路翻页复用）
async function albumSongListPage(albumMid, begin, num) {
  var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '24', cv: '0' },
    req: { module: 'music.musichallAlbum.AlbumSongListServer', method: 'GetAlbumSongList', param: { albumMid: albumMid, begin: begin, num: num } }
  }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS });
  var d = r.data && r.data.req && r.data.req.data;
  var list = (d && (d.songList || d.list)) || [];
  var total = (d && (parseInt(d.total_song, 10) || parseInt(d.total, 10))) || 0;
  return { list: list, total: total };
}

function mapAlbumSong(it, albumMid) {
  var s = it.songInfo || it.song || it;
  return {
    source: 'qq', sid: str(s.mid),
    title: stripEm(str(s.name || s.songname)), artist: splitArtists(s.singer),
    album: s.album && s.album.name ? String(s.album.name) : '',
    duration: parseInt(s.interval, 10) || 0,
    artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
    qualities: parseQqFileQualities(s.file), // [v1.3.0 P0-1] 专辑曲目带音质表
    raw: { mid: str(s.mid), mediaMid: s.file && s.file.media_mid ? String(s.file.media_mid) : '', vid: s.mv && s.mv.vid ? String(s.mv.vid) : '' }
  };
}

var ALBUM_DETAIL = {
  qq: async function (raw) {
    // 优先老牌 fcg_v8_album_info（data.list[]），失败接力 GetAlbumSongList（doc 8.2）
    try {
      var r = await axios.get('https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg', {
        params: { albummid: raw.mid, format: 'json' }, timeout: SOURCE_TIMEOUT,
        headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      var data = r.data && r.data.data;
      var list = (data && data.list) || [];
      if (!list.length) throw new Error('empty');
      var total = data.total || list.length;
      var entries = list.map(function (it) {
        return {
          source: 'qq', sid: str(it.songmid),
          title: stripEm(str(it.songname)), artist: splitArtists(it.singer),
          album: it.albumname ? String(it.albumname) : '',
          duration: parseInt(it.interval, 10) || 0,
          artwork: raw.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + raw.mid + '.jpg' : '',
          qualities: parseQqFileQualities(it.file), // [v1.3.0 P0-1] 专辑详情主路曲目带音质表
          raw: { mid: str(it.songmid), mediaMid: it.songmid ? String(it.songmid) : '', vid: it.mv && it.mv.vid ? String(it.mv.vid) : '' }
        };
      });
      // [v1.1.0 审查#8] 主路 list 被服务端截断（total > list.length）时，用 GetAlbumSongList 翻页补齐
      if (data.total && data.total > entries.length) {
        var abegin = entries.length;
        var apages = 0;
        while (abegin < data.total && apages < 20) {
          var pg = await albumSongListPage(raw.mid, abegin, 100);
          if (!pg.list.length) break;
          for (var pi = 0; pi < pg.list.length; pi++) entries.push(mapAlbumSong(pg.list[pi], raw.mid));
          abegin += pg.list.length;
          apages++;
          if (pg.list.length < 100) break;
        }
      }
      // [v1.3.0 P0-1] 主路 fcg_v8_album_info 条目无 file 尺寸字段 → 批量 CgiGetTrackInfo 补音质表
      var needQ = [];
      for (var qi = 0; qi < entries.length; qi++) { if (!entries[qi].qualities) needQ.push(entries[qi].raw.mid); }
      if (needQ.length) {
        var sizeMap = await fetchQqTrackInfoSizes(needQ);
        for (var qi2 = 0; qi2 < entries.length; qi2++) {
          if (!entries[qi2].qualities && sizeMap[entries[qi2].raw.mid]) entries[qi2].qualities = sizeMap[entries[qi2].raw.mid];
        }
      }
      return {
        albumItem: {
          title: data.name ? String(data.name) : '',
          artist: data.singername ? String(data.singername) : '',
          artwork: raw.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + raw.mid + '.jpg' : '',
          date: data.aDate ? String(data.aDate) : '',
          worksNum: total
        },
        entries: entries
      };
    } catch (e1) {
      // [v1.1.0 审查#8] 副路按 total_song 循环翻页，>100 首合辑不再截断（上限 20 页 / 2000 首防失控）
      var APAGE = 100;
      var abegin2 = 0;
      var entries2 = [];
      var totalSong = 0;
      for (var ap = 0; ap < 20; ap++) {
        var pg2 = await albumSongListPage(raw.mid, abegin2, APAGE);
        totalSong = pg2.total || totalSong;
        if (!pg2.list.length) break;
        for (var pj = 0; pj < pg2.list.length; pj++) entries2.push(mapAlbumSong(pg2.list[pj], raw.mid));
        abegin2 += pg2.list.length;
        if (pg2.list.length < APAGE) break;
        if (totalSong && entries2.length >= totalSong) break;
      }
      return {
        albumItem: { title: '', artist: '', artwork: raw.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + raw.mid + '.jpg' : '', worksNum: totalSong || entries2.length },
        entries: entries2
      };
    }
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
  qq: async function (raw, page) {
    // GetSingerSong 匿名被风控（实测 500003，探针 r5）→ 按歌手名搜索 + singerMID 过滤
    var body = {
      comm: { ct: '24', cv: '0' },
      req: { module: 'music.adaptor.SearchAdaptor', method: 'do_search_v2',
        param: { query: raw.name, search_type: 0, page_num: page, num_per_page: 50 } }
    };
    var res = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', body, {
      timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS
    });
    var reqData = res.data && res.data.req && res.data.req.data;
    var groupS = ((reqData || {}).body || {}).item_song || {};
    var items = groupS.items || [];
    var searchTotal = parseInt(groupS.total_num, 10) || 0;
    var filtered = items.filter(function (it) {
      var singers = it.singer || [];
      if (raw.singerMID) return singers.some(function (s) { return str(s.mid) === str(raw.singerMID); });
      return singers.some(function (s) { return str(s.name) === str(raw.name); });
    });
    return {
      entries: filtered.map(function (it) {
        var albumMid = it.album && it.album.mid ? String(it.album.mid) : '';
        return {
          source: 'qq', sid: str(it.mid),
          title: stripEm(str(it.name)), artist: splitArtists(it.singer),
          album: it.album && it.album.name ? String(it.album.name) : '',
          duration: parseInt(it.interval, 10) || 0,
          artwork: albumMid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + albumMid + '.jpg' : '',
          qualities: parseQqFileQualities(it.file), // [v1.3.0 P0-1] 歌手作品条目带音质表
          raw: { mid: str(it.mid), mediaMid: it.file && it.file.media_mid ? String(it.file.media_mid) : '', vid: it.mv && it.mv.vid ? String(it.mv.vid) : '' }
        };
      }),
      // [v1.1.0 审查#10] isEnd 用搜索 total_num 判定（无 total 回退 items.length<50）。
      // 召回局限：GetSingerSong 匿名 500003 风控、H5 fcg_v8_singer_track_cp 已 404（2026-09-06 实测），
      // 名字搜索+singerMID 过滤是当前唯一可用路径；冷门曲目召回不全需真机/Cookie 后再评估。
      isEnd: searchTotal > 0 ? (page * 50 >= searchTotal) : (items.length < 50)
    };
  }
};

var ARTIST_ALBUM = {
  qq: async function (raw, page) {
    // doc 7.4 GetAlbumList；响应路径文档未给出，防御式解析（待真机复核）
    var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      comm: { ct: '24', cv: '0' },
      req: { module: 'music.musichallAlbum.AlbumListServer', method: 'GetAlbumList',
        param: { singermid: raw.singerMID, begin: (page - 1) * 30, num: 30 } }
    }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS });
    var d = r.data && r.data.req && r.data.req.data;
    var list = (d && (d.albumList || d.list)) || (d && d.data && (d.data.albumList || d.data.list)) || [];
    var totalA = (d && (parseInt(d.total, 10) || parseInt(d.totalNum, 10))) || 0;
    return {
      entries: list.map(function (it) {
        var mid = str(it.mid || it.albumMid);
        return {
          source: 'qq', sid: mid,
          title: stripEm(str(it.name || it.albumName)), artist: raw.name || '',
          artwork: mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + mid + '.jpg' : '',
          date: it.pubTime || it.aDate || '',
          worksNum: it.song_count || it.songNum || 0,
          raw: { mid: mid }
        };
      }),
      // [v1.1.0 审查#10] isEnd 用 total 判定（无 total 回退 list.length<30）
      isEnd: totalA > 0 ? ((page - 1) * 30 + list.length >= totalA) : (list.length < 30)
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
      // [v1.2.1 fix#3] worksNum 回填真实总曲数（dirinfo.songnum）：列表层 tag 榜单条目曾把
      // listennum（播放次数）误作 worksNum、Feed 条目为 0，宿主头部优先读 worksNum 导致显示错数
      var realTotal = Number(entries && entries.total) || 0;
      var sheetInfo = Object.assign({}, sheetItem, {
        worksNum: realTotal > 0 ? realTotal : (musicList.length || undefined)
      });
      return { isEnd: true, sheetItem: sheetInfo, musicList: musicList };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('歌单详情获取失败');
}

// ---------- MV 取链 ----------
// [v1.2.0 对齐 baka] 档位修正：ft10 实为 360p（原标 240p 有误），补 4k(ft50)；
// 返回富结果（headers/UA/宽高/码率/体积/可用档位/备用链/过期时间），宿主 MV 菜单可切档；
// code!==0 的档位自动跳过，不再按 Cookie 硬门控 ft40（baka 同构，靠 code 过滤）。
var MV_QUALITY_LEVELS = [
  { ft: 10, quality: '360p', height: 360 },
  { ft: 20, quality: '480p', height: 480 },
  { ft: 30, quality: '720p', height: 720 },
  { ft: 40, quality: '1080p', height: 1080 },
  { ft: 50, quality: '4k', height: 2160 }
];
var MV_QUALITY_ORDER = ['360p', '480p', '720p', '1080p', '4k'];

var MV_SOURCE = {
  qq: async function (raw, qIdx) {
    if (!raw || !raw.vid) return null;
    // doc 9.3：GetMvUrls 必须带 guid，否则 freeflow_url 为空
    var r = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      comm: { ct: 24, guid: '10000' },
      req: { module: 'gosrf.Stream.MvUrlProxy', method: 'GetMvUrls',
        param: { vids: [raw.vid], request_typet: 10001, guid: '10000' } }
    }, { timeout: SOURCE_TIMEOUT, headers: qqCookieHeaders(QQ_SEARCH_HEADERS) });
    var rd = r.data && r.data.req && r.data.req.data;
    // [v1.2.0 实测] 2026-09-07 匿名响应无 getMvUrl 包裹：rd 直接是 {vid: entry}（旧文档 9.3 为
    // rd.getMvUrl.data[vid]，两种包裹都兼容）
    var gd = rd && rd.getMvUrl ? rd.getMvUrl : rd;
    var entry = gd && gd.data ? gd.data[raw.vid] : (gd ? gd[raw.vid] : null);
    var mp4s = (entry && entry.mp4) || [];
    // 汇总可用档位（baka getQqMvStreams 同构）：code===0 且有 freeflow_url
    // （实测无 hasUrl 字段；code=1000/2000 为 VIP/不可用档自动跳过；width/height/bitrate 缺省用档位表）
    var streams = [];
    for (var i = 0; i < mp4s.length; i++) {
      var m = mp4s[i];
      if (!m || m.code !== 0) continue;
      var ft = m.filetype || m.ft;
      var lv = null;
      for (var L = 0; L < MV_QUALITY_LEVELS.length; L++) { if (MV_QUALITY_LEVELS[L].ft === ft) { lv = MV_QUALITY_LEVELS[L]; break; } }
      if (!lv) continue;
      var u0 = (m.freeflow_url && m.freeflow_url[0]) || (m.url && m.url[0]);
      if (!u0) continue;
      streams.push({ level: lv, stream: m, url: String(u0) });
    }
    if (!streams.length) return null;
    // 选档：目标档位优先，向下取最近可用档（baka pickQqMvStream 同构）
    var target = MV_QUALITY_LEVELS[qIdx >= 0 && qIdx < MV_QUALITY_LEVELS.length ? qIdx : 2];
    var picked = null;
    for (var s2 = 0; s2 < streams.length; s2++) { if (streams[s2].level.ft === target.ft) { picked = streams[s2]; break; } }
    if (!picked) {
      for (var s3 = streams.length - 1; s3 >= 0; s3--) {
        if (streams[s3].level.height <= target.height) { picked = streams[s3]; break; }
      }
    }
    if (!picked) picked = streams[streams.length - 1];
    var urls = [picked.url];
    if (picked.stream.freeflow_url) {
      for (var u2 = 0; u2 < picked.stream.freeflow_url.length; u2++) {
        var uu = String(picked.stream.freeflow_url[u2] || '');
        if (uu && urls.indexOf(uu) < 0) urls.push(uu);
      }
    }
    var size = Number(picked.stream.fileSize || picked.stream.filesize || picked.stream.size || 0) || undefined;
    // baka 同构：expire 为相对有效秒数 → 绝对毫秒时间戳
    var exp = Number(picked.stream.expire);
    var expiresAt = (Number.isFinite ? Number.isFinite(exp) : isFinite(exp)) && exp > 0 ? Date.now() + exp * 1000 : undefined;
    var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
    return {
      url: picked.url.replace(/^http:/i, 'https:'),
      headers: { Referer: 'https://y.qq.com/', 'User-Agent': UA },
      userAgent: UA,
      videoQuality: picked.level.quality,
      mimeType: 'video/mp4',
      width: Number(picked.stream.width) || undefined,
      height: Number(picked.stream.height) || picked.level.height,
      bitrate: Number(picked.stream.bitrate) || undefined,
      size: size,
      // [v1.8.0 P1-4] 顶层 result 补 codec（从 picked.stream.codec/codecs 透传），
      // 与 availableVideoQualities 内档位 codec 同源
      codec: picked.stream.codec || picked.stream.codecs || undefined,
      // [v1.8.0 P1-3] 顶层 result 补 duration（源条目无 MV duration 上游，从 musicItem 顶层透传；
      // 宿主 getMvDuration 为空时回退到曲目时长，UI 显示「MV 时长≈曲目时长」更可接受）
      duration: undefined, // 由 getMvSourceImpl 调用方根据 musicItem.duration 注入
      availableVideoQualities: streams.map(function (st) {
        return {
          key: st.level.quality, label: st.level.quality,
          width: Number(st.stream.width) || undefined,
          height: Number(st.stream.height) || st.level.height,
          bitrate: Number(st.stream.bitrate) || undefined,
          size: Number(st.stream.fileSize || st.stream.filesize || st.stream.size || 0) || undefined,
          codec: st.stream.codec || st.stream.codecs || undefined, // [v1.3.0 P2-1] 对齐 baka：MV 档位补编码信息
          mimeType: 'video/mp4'
        };
      }),
      backupUrls: urls.slice(1),
      expiresAt: expiresAt
    };
  }
};

async function getMvSourceImpl(musicItem, videoQuality) {
  if (!musicItem) return null;
  var qKey = videoQuality && typeof videoQuality === 'string' ? videoQuality : (videoQuality && videoQuality.key) || '720p';
  var qIdx = MV_QUALITY_ORDER.indexOf(qKey);
  if (qIdx < 0) qIdx = 2;
  var src = musicItem._src || {};
  // [v1.8.0 P0-3] 顶层守卫字段兜底：musicItem.videoId / mvId / mv / mvVid 任一命中
  // 即把 vid 写入 src.qq.vid，对齐酷我/咪咕/网易云 v1.8.0 行为；外链导入/旧缓存条目
  // 没有 _src.qq 但有顶层守卫字段时也能正确取 MV。
  if (src.qq && !src.qq.vid) {
    var topVid = musicItem.videoId || musicItem.mvId || musicItem.mvid || musicItem.mv || musicItem.mvVid || musicItem.mvCopyrightId || musicItem.bvid;
    if (topVid) src.qq.vid = String(topVid);
  }
  if (src.qq) {
    // [v1.2.0] 无 vid 时经单曲详情按 mid 回查（兼容旧缓存条目/外链导入条目）
    if (!src.qq.vid && src.qq.mid) {
      try {
        var det = await SONG_DETAIL_FETCHERS.qq(src.qq.mid);
        if (det && det.raw && det.raw.vid) src.qq.vid = det.raw.vid;
      } catch (e) { /* 回查失败按无 MV 处理 */ }
    }
    try {
      var r2 = await MV_SOURCE.qq(src.qq, qIdx);
      if (r2) {
        // [v1.8.0 P1-3] duration 从 musicItem 顶层透传（QQ MV 源无 duration 上游）
        if (r2.duration === undefined && musicItem.duration) r2.duration = musicItem.duration;
        // [v1.8.0 P1-1] videoQuality 写回 musicItem.videoQuality（宿主 UI 切档后回显）
        if (r2.videoQuality && !musicItem.videoQuality) {
          try { musicItem.videoQuality = r2.videoQuality; } catch (e) { /* frozen item */ }
        }
        return r2;
      }
    } catch (e) { /* 无 MV */ }
  }
  return null;
}

// ---------- 推荐歌单广场 ----------
// 标签 id 约定：{source}~tag~{分类名|tagId} / {source}~rec~0（各源无参推荐流）
// [v1.1.0 一般#8 + 高优1 重做]：
//  - 分类接 fcg_get_diss_tag_conf.fcg 真分类（2026-09-06 实测 data.categories[]{categoryGroupName,
//    items[{categoryId,categoryName,usable}]}），替换原「单固定置顶项 + data:[] 空壳」；
//  - 分类 id 约定 'qqtag~'+categoryId，走 fcg_get_diss_by_tag.fcg（sin/ein 分页，data.sum 判 isEnd）；
//  - 'qq~rec' 走 PlaylistSquare.GetRecommendFeed（From=(page-1)*30 真分页，HasMore 判 isEnd），
//    替换原 From 恒 0、翻页恒同一批的缺陷。
async function getRecommendSheetTagsImpl() {
  try {
    var r = await axios.get('https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg', {
      params: { picmid: 2, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8' },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var cats = (r.data && r.data.data && r.data.data.categories) || [];
    var data = [];
    for (var i = 0; i < cats.length; i++) {
      var items = (cats[i].items || []).filter(function (t) { return t && t.usable !== 0; });
      if (!items.length) continue;
      data.push({
        title: str(cats[i].categoryGroupName),
        data: items.map(function (t) {
          return { id: 'qqtag~' + str(t.categoryId), title: str(t.categoryName), platform: 'qq' };
        })
      });
    }
    if (!data.length) throw new Error('empty categories');
    // [v1.2.0 对齐宿主] pinned 必须是扁平 IMusicSheetItemBase[]（宿主 sheetBody 直接 (tags?.pinned??[]).map
    // 渲染 TypeTag；原分组结构会渲染成 undefined）。推荐入口 + 各分类组首 tag。
    var pinned = [{ id: 'qq~rec~0', title: '推荐', platform: 'qq' }];
    for (var pc = 0; pc < data.length && pinned.length < 12; pc++) {
      pinned.push(data[pc].data[0]);
    }
    return { pinned: pinned, data: data };
  } catch (e) {
    // 分类接口失败回退最小结构，保证推荐入口不死
    var pinnedFallback = [{ id: 'qq~rec~0', title: '推荐', platform: 'qq' }];
    return { pinned: pinnedFallback, data: [] };
  }
}

async function getRecommendSheetsByTagImpl(tagItem, page) {
  var p = page || 1;
  // 宿主协议传 tags 返回的 {id,...} 对象；兼容直接传字符串 id
  // [v1.2.1 fix#4] 宿主 sheetBody 默认选中 {title:'默认', id:''}（空 id），原空 id 落 else
  // 直接返回空数组 → 歌单页默认第一个分类无数据；现空 id 与 'qq~rec' 同走推荐流
  // （对照 baka 酷狗 getRecommendSheetsByTag：空 tagId 走默认推荐而非空数据）
  var id = (tagItem && (tagItem.id || (typeof tagItem === 'string' ? tagItem : ''))) || '';
  var entries = [];
  var isEnd = true;
  if (!id || id.indexOf('qq~rec') === 0) {
    var r2 = await axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      comm: { ct: '24', cv: '0' },
      req: { module: 'music.playlist.PlaylistSquare', method: 'GetRecommendFeed', param: { From: (p - 1) * 30, Size: 30 } }
    }, { timeout: SOURCE_TIMEOUT, headers: QQ_SEARCH_HEADERS });
    var rd2 = (r2.data && r2.data.req && r2.data.req.data) || {};
    var list = rd2.List || [];
    entries = list.map(function (x) {
      var b = (x && x.Playlist && x.Playlist.basic) || {};
      var cover = b.cover && (b.cover.small_url || b.cover.medium_url) || '';
      return {
        source: 'qq', sid: str(b.tid),
        title: str(b.title),
        artist: b.creator && b.creator.nick ? String(b.creator.nick) : '',
        artwork: cover,
        // [v1.2.1 fix#3] GetRecommendFeed basic 自带 song_cnt（真实曲数），直接透传；
        // 详情层另由 dirinfo.songnum 兜底回填
        worksNum: parseInt(b.song_cnt, 10) || 0,
        raw: { listId: str(b.tid) }
      };
    });
    isEnd = rd2.HasMore !== undefined ? !rd2.HasMore : list.length < 30;
  } else if (id.indexOf('qqtag~') === 0) {
    var catId = str(id.slice('qqtag~'.length));
    var sin = (p - 1) * 30;
    var r3 = await axios.get('https://c.y.qq.com/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg', {
      params: { categoryId: catId, sin: sin, ein: sin + 29, sortId: 5, format: 'json', inCharset: 'utf-8', outCharset: 'utf-8' },
      timeout: SOURCE_TIMEOUT,
      headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    var d3 = r3.data && r3.data.data;
    var list3 = (d3 && d3.list) || [];
    var sum = (d3 && parseInt(d3.sum, 10)) || 0;
    entries = list3.map(function (x) {
      return {
        source: 'qq', sid: str(x.dissid),
        title: str(x.dissname),
        artist: (x.creator && x.creator.name) ? String(x.creator.name) : (x.nickname ? String(x.nickname) : ''),
        artwork: x.imgurl ? String(x.imgurl) : '',
        // [v1.2.1 fix#3] fcg_get_diss_by_tag 列表无曲数字段，原把 listennum（播放次数，
        // 实测 854 万）误作 worksNum，导致歌单页显示几百万"首"。列表层置 0（聚合后为
        // undefined），详情层由 CgiGetDiss dirinfo.songnum 回填真实曲数（实测 854 万播放
        // 的歌单真实 66 首）
        worksNum: 0,
        raw: { listId: str(x.dissid) }
      };
    });
    isEnd = sum > 0 ? (sin + list3.length >= sum) : (list3.length < 30);
  } else {
    return { isEnd: true, data: [] };
  }
  return { isEnd: isEnd, data: entries.filter(function (e) { return e.sid && e.title; }).map(sheetSearchItemFromEntry) };
}

// ---------- 歌曲评论（QQ 源）----------
// QQ    musicu CommentRead GetHotCommentList/GetNewCommentList（文档 15.2/15.3 参数原样；
//       本沙箱复核 2026-09-06：热评 total=3916、最新 total=161411、PageNum 翻页有效；
//       字段扁平 CmId/Nick/Avatar/Content/PraiseNum/PubTime(秒)/Location）
//       BizId 需数值歌曲 id，搜索 raw 只有 mid → 先经 fcg_play_single_song.fcg 换取（+1 请求）

// [v1.1.0 审查#6] mid → 数字 id 模块级缓存（同曲评论翻页/重复打开不再反复回源换 id）
var QQ_NUMID_CACHE = {};

function fetchQqSongNumericId(mid) {
  if (QQ_NUMID_CACHE[mid]) return Promise.resolve(QQ_NUMID_CACHE[mid]);
  return axios.get('https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg', {
    params: { songmid: mid, tp: 'yqq_song_detail', format: 'json' },
    timeout: SOURCE_TIMEOUT,
    headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }).then(function (res) {
    var t = res.data && res.data.data && res.data.data[0];
    if (!t || !t.id) throw new Error('qq numeric id n/a');
    QQ_NUMID_CACHE[mid] = String(t.id);
    return QQ_NUMID_CACHE[mid];
  });
}

async function fetchQqComments(mid, page) {
  var numId = await fetchQqSongNumericId(mid);
  var mk = function (method, PageNum) {
    return {
      comm: { ct: '24', cv: '0' },
      req: {
        module: 'music.globalComment.CommentRead',
        method: method,
        param: {
          BizType: 1, BizId: numId, LastCommentSeqNo: '',
          PageSize: 20, PageNum: PageNum, HotType: 1,
          WithAirborne: 0, PicEnable: 1, BizSubType: 2
        }
      }
    };
  };
  var opt = { timeout: SOURCE_TIMEOUT, headers: { 'Content-Type': 'application/json', Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } };
  // [v1.1.0 审查#6] 热评固定不变，仅首页拉取（p>1 不再请求 GetHotCommentList，省回源且避免热评重复占位）
  // [v1.2.0 fix] 原 `p === 1` 引用未定义变量（形参是 page），热评永远为空——修正为 page===1
  var hotReq = page === 1 ? axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', mk('GetHotCommentList', 0), opt)
    .then(function (r) {
      var cl = r.data && r.data.req && r.data.req.data && r.data.req.data.CommentList;
      return (cl && cl.Comments) || [];
    }).catch(function () { return []; }) : Promise.resolve([]);
  var newReq = axios.post('https://u.y.qq.com/cgi-bin/musicu.fcg', mk('GetNewCommentList', page - 1), opt)
    .then(function (r) {
      var d0 = r.data && r.data.req && r.data.req.data;
      var cl = d0 && d0.CommentList;
      return { list: (cl && cl.Comments) || [], total: (cl && cl.Total) || 0 };
    });
  var both = await Promise.all([hotReq, newReq]);
  return { hot: both[0], newest: both[1].list, total: both[1].total };
}

async function getMusicCommentsImpl(musicItem, page) {
  var p = page || 1;
  var src = (musicItem && musicItem._src) || {};

  var tasks = [];
  var sources = [];
  if (src.qq && src.qq.mid) {
    sources.push('qq');
    tasks.push(fetchQqComments(src.qq.mid, p).catch(function () { return null; }));
  }
  if (!tasks.length) return { isEnd: true, data: [] };

  var settled = await Promise.all(tasks);
  var seen = {};
  var data = [];
  function push(c, isHot, source) {
    if (!c) return;
    var cid = c.commentId || c.id || c.CmId;
    if (!cid || seen[cid]) return;
    seen[cid] = 1;
    var body = c.msg || c.content || c.Content;
    var nick = (c.user && (c.user.nickname || c.user.nick)) || c.Nick || c.userName || c.u_name;
    var avatar = (c.user && (c.user.avatarUrl || c.user.avatar)) || c.Avatar || c.avatar || c.u_pic;
    var like = c.likedCount || c.PraiseNum || c.likedCount || c.like_num || c.praiseNum || 0;
    var time = c.time || c.PubTime;
    var loc = (c.user && c.user.location) || c.Location || c.location;
    // [v1.2.0 对齐宿主] ICommentItem.createAt 期望数值毫秒时间戳（原 formatTs 字符串导致排序/显示异常）
    var createAt;
    if (typeof time === 'number') createAt = time > 1e12 ? time : time * 1000;
    else if (typeof time === 'string' && /^\d+$/.test(time)) { var tn = Number(time); createAt = tn > 1e12 ? tn : tn * 1000; }
    else createAt = undefined;
    // [v1.2.0 对齐 baka] 子评论 → 宿主 IComment.replies（baka 读 SubComments[].CmId/Nick/Content/PraiseNum/PubTime）
    var replies;
    var subs = c.SubComments || c.subComments;
    if (Array.isArray(subs) && subs.length) {
      replies = subs.map(function (sc) {
        var sct = sc.time || sc.PubTime;
        var scn = (sc.user && (sc.user.nickname || sc.user.nick)) || sc.Nick || sc.userName || sc.u_name;
        var sca = (sc.user && (sc.user.avatarUrl || sc.user.avatar)) || sc.Avatar || sc.avatar || sc.u_pic;
        var sctn = typeof sct === 'number' ? (sct > 1e12 ? sct : sct * 1000)
          : (typeof sct === 'string' && /^\d+$/.test(sct) ? Number(sct) * 1000 : undefined);
        return {
          id: source + '_' + String(sc.commentId || sc.id || sc.CmId || '').slice(0, 64),
          nickName: scn ? String(scn) : '未知用户',
          avatar: sca ? String(sca) : undefined,
          comment: String(sc.msg || sc.content || sc.Content || ''),
          like: sc.likedCount || sc.PraiseNum || sc.praiseNum || 0,
          createAt: sctn,
          location: (sc.user && sc.user.location) || sc.Location || undefined
        };
      });
    }
    data.push({
      id: source + '_' + String(cid).slice(0, 64),
      nickName: nick ? String(nick) : '未知用户',
      avatar: avatar ? String(avatar) : undefined,
      comment: body ? String(body) : '',
      like: like || 0,
      createAt: createAt,
      location: loc ? String(loc) : undefined,
      isHot: isHot,
      replies: replies
    });
  }
  var anyData = false;
  var hasMore = false;
  for (var s = 0; s < settled.length; s++) {
    var r = settled[s];
    if (!r) continue;
    anyData = true;
    // [v1.1.0 审查#6] hasMore 用服务器 Total 判定（Total > 已消费的 p*20 条），Total 缺失才回退「整页满」启发式
    if (sources[s] === 'qq' && r.total > 0) {
      hasMore = hasMore || r.total > p * 20;
    } else if (sources[s] === 'qq' && r.newest && r.newest.length >= 20) {
      hasMore = true;
    }
    var hot = r.hot || [], newest = r.newest || [];
    for (var i = 0; i < hot.length; i++) push(hot[i], true, sources[s]);
    for (var j = 0; j < newest.length; j++) push(newest[j], false, sources[s]);
  }
  if (!anyData) return { isEnd: true, data: [] };
  return { isEnd: !hasMore, data: data };
}
