# MusicFree 插件订阅站

MusicFree 插件订阅仓库（55 个插件）+ 澜音 Ceru 原生插件（55 个）+ Baka V2 Provider（55 个）+ 洛雪（LX Music）自定义源，四个生态相互独立。

- **MusicFree 插件**：通过「订阅」机制安装/更新，订阅清单不含洛雪/澜音/Baka 内容
- **澜音 Ceru 原生插件**：`ceru-plugins/` 下 55 个 `.ceru.js`（`manifestVersion: 2`），逐条在线导入，非订阅机制
- **Baka V2 Provider**：`baka-plugins/` 下 55 个独立 `.js`，标准 V2 容器，逐条导入
- **洛雪自定义源**：五源合一脚本，仅适用于洛雪/澜音等 LX 协议播放器，单独下载导入

## 订阅站首页

👉 **打开订阅站首页**：https://hebijunge.github.io/musicfree-plugins/

首页含插件列表、全部订阅地址一键复制、插件搜索、离线包下载入口。

## 快速上手（30 秒装好）

在 MusicFree「**插件设置 → 订阅**」填入下面的订阅地址即可一键安装/更新。

**最省事**：直接装常用六平台（体积小、速度快）——

```
https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/main.json
```

> 若主线路在你网络下超时，把前缀换成任一可用线路（见下方「换线路」）。

## 按类别订阅（推荐）

插件按用途拆成 5 份清单，**用哪个类别就只装哪份**，不必一次拉 55 个。

<!-- README:cat-stats -->
| 类别 | 条目 | 体积 | 订阅地址 |
|---|---|---|---|
| ① 常用六平台 | 6 | 2.87 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/main.json` |
| ② DJ / 舞曲 / 电音 | 28 | 0.77 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/dj.json` |
| ③ 听书 / 电台 / 播客 | 10 | 0.60 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/radio.json` |
| ④ 其它音乐平台 | 11 | 3.48 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/music.json` |
| ⑤ 全部插件 | 55 | 7.71 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/all.json` |
<!-- /README:cat-stats -->

<!-- README:cat-desc -->
- ① 常用六平台 = QQ音乐 / 酷我音乐 / 酷狗音乐 / 咪咕音乐 / 网易云音乐 / 汽水音乐
- ③ 听书 / 电台 / 播客 = 番茄畅听 / 懒人听书 / 博看听书 / 猫耳FM / 蜻蜓FM / 喜马拉雅 / 荔枝FM / 网易云电台 / CCTV听音 / 相声评书
- ④ 其它音乐平台 = B站 / 5sing / 千千音乐 / 一听音乐 / 街声 / Apple Music / 华为音乐 / Jamendo / 聚合 / JOOX音乐 / 好听轻音乐
<!-- /README:cat-desc -->

分类清单随 `plugins.json` 同步生成：`node scripts/gen-subscriptions.js`

## 换线路（主线路超时就用这个）

同一类别文件在所有线路下内容一一对应，**只需换前缀**：

| 线路 | 前缀写法 | 说明 |
|---|---|---|
| gh.padao.fun | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/` | 主用，实测最快（6 并发 0.31~1.59s） |
| GitHub Pages | `https://hebijunge.github.io/musicfree-plugins/sub/githubio/` | 最稳，但下载慢，易触发 2s 超时 |
| fastly | `https://fastly.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/sub/fastly/` | jsDelivr 节点，速度偏慢 |

例：常用六平台的 Pages 版 = `https://hebijunge.github.io/musicfree-plugins/sub/githubio/main.json`

## 全部插件（55 个）· 备用线路

想一次装全就用这里；**只装常用平台建议用上面的分类订阅**，体积从 7.70 MB 降到 2.84 MB。下面各条清单内容完全一致，只是插件下载源不同：

- 主线路 gh.padao.fun：`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/plugins.json`
- GitHub Pages 直出：`https://hebijunge.github.io/musicfree-plugins/plugins.json`
- fastly：`https://hebijunge.github.io/musicfree-plugins/plugins-fastly.json`
- gcore：`https://hebijunge.github.io/musicfree-plugins/plugins-gcore.json`
- 其它 20 条：`plugins-proxy-01.json` ~ `plugins-proxy-20.json`（见订阅站首页「全部插件 · 备用线路」折叠区）

## 离线安装包（在线导入失败时用）

在线订阅对单个文件有 2 秒下载超时（MusicFree 源码 `axios.defaults.timeout = 2000`），网络一慢就报失败。**离线包下载到本地再安装，完全不走这个超时。**

**下载页**：https://hebijunge.github.io/musicfree-plugins/download.html

| 包 | 内容 | 大小 | 直链（加速） |
|---|---|---|---|
| mf-common-6.zip | 常用六平台 6 个 | 1.03 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/dl/mf-common-6.zip` |
| mf-all.zip | 全部 55 个 | 2.75 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/dl/mf-all.zip` |
| mf-dj.zip | DJ / 舞曲 / 电音 28 个 | 0.29 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/dl/mf-dj.zip` |
| mf-radio.zip | 听书 / 电台 10 个 | 0.22 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/dl/mf-radio.zip` |
| mf-music.zip | 其它音乐平台 11 个 | 1.21 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/dl/mf-music.zip` |

官方 Pages 直链把前缀换成 `https://hebijunge.github.io/musicfree-plugins/dl/` 即可（较慢，但一定在）。

**安装步骤**：下载 zip → 解压出 `.js` → MusicFree「插件设置」→ 右下角 `+` →「从本地安装插件」→ 多选 `.js`。选文件时若看不到 `.js`，把类型筛选切到「所有文件」。

重新打包：`node scripts/pack-zips.js`。

## 澜音（CeruMusic）原生插件 · Ceru v2

55 个澜音 Ceru v2 原生插件（`ceru-plugins/*.ceru.js`，`manifestVersion: 2`），适用于澜音 CeruMusic 手机 v2 / 桌面端。搜索、取链、歌词由插件内建逻辑完成（与 MusicFree 插件生态完全独立）。

> 这是澜音**原生**插件格式（`.ceru.js`），**不是** MusicFree 插件格式，无法在 MusicFree「插件订阅」里安装；也无法用洛雪 LX 导入入口导入（LX 只认 `exports.manifest` 的洛雪协议）。

- 清单：`ceru-list.json`（55 个，含 name/version/id，由 `scripts/gen-ceru-list.js` 生成）
- 在线导入链接示例：`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/ceru-plugins/qq.ceru.js`（每个插件一个文件，逐个导入）
- 一键复制全部：订阅站首页「澜音 Ceru」区可浏览 v2/v3 目录并逐条复制链接

**导入方法：** 澜音 CeruMusic → 插件管理 → 添加插件 → 粘贴任一 `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/ceru-plugins/xxx.ceru.js` 在线链接导入，或下载 `.ceru.js` 本地导入；首次启用授予 network（网络）权限即可。

> 澜音也能装下面「洛雪 LX 五源合一」脚本（走 LX 导入入口），两者不冲突，可都装。

## Baka V2 原生 Provider

55 个 Baka V2 Provider（`baka-plugins/*.js`），与 MusicFree、澜音同平台但按 Baka V2 规范独立实现。首行固定为 `// @baka-provider 2`，同步 CommonJS 导出，只使用官方 SDK。

- 清单：`baka-list.json`（55 个，含 name/version/id/sourceId/能力与音质声明，由 `scripts/gen-baka-list.js` 生成）
- 在线导入链接示例：`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/baka-plugins/qq.js`
- 订阅站首页「Baka V2」区可浏览全部 Provider 并复制链接

**导入方法：** Baka 客户端 → 插件管理 → 导入 Provider → 粘贴在线链接或选择本地 `.js`。

## 洛雪（LX）自定义源 · 多播放器通用

五源合一 LX 格式自定义源脚本（v1.6.0，混淆发布），适用于所有支持洛雪(LX)插件协议的播放器：洛雪 Music、澜音(CeruMusic) 等。

> 这是 LX（洛雪）格式脚本，**不是** MusicFree 原生插件格式，无法在 MusicFree「插件订阅」里直接安装；请在对应播放器的自定义源 / LX 导入入口使用。

- 脚本文件：[plugins/five-source-lx.plugin.v1.6.0.js](plugins/five-source-lx.plugin.v1.6.0.js)
- 在线导入链接：`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/plugins/five-source-lx.plugin.v1.6.0.js`

**导入方法：**
- **洛雪 Music**：设置 → 自定义源管理 → 导入（在线链接粘贴，或下载 .js 本地导入）
- **澜音 CeruMusic**：插件管理 → 添加插件 → 粘贴在线导入链接或选本地 `.js`；首次启用授予 network 权限

LX 自定义源为非订阅机制，一次导入一个脚本，升级需重新导入。

## 插件清单（55 个）

<!-- README:plugins-table -->
| 插件 | 版本 | 文件 |
|---|---|---|
| QQ音乐 | 1.9.27 | [qq-source.plugin.js](plugins/qq-source.plugin.js) |
| 酷我音乐 | 1.9.24 | [kuwo-source.plugin.js](plugins/kuwo-source.plugin.js) |
| 酷狗音乐 | 1.9.25 | [kugou-source.plugin.js](plugins/kugou-source.plugin.js) |
| 咪咕音乐 | 1.9.20 | [migu-source.plugin.js](plugins/migu-source.plugin.js) |
| 网易云音乐 | 1.9.28 | [netease-source.plugin.js](plugins/netease-source.plugin.js) |
| 汽水音乐 | 1.9.25 | [qishui-source.plugin.js](plugins/qishui-source.plugin.js) |
| B站 | 1.1.4 | [bilibili-source.plugin.js](plugins/bilibili-source.plugin.js) |
| 番茄畅听 | 1.3.1 | [fanqie-source.plugin.js](plugins/fanqie-source.plugin.js) |
| DJ多多 | 1.0.2 | [djduoduo-source.plugin.js](plugins/djduoduo-source.plugin.js) |
| 5sing | 1.0.2 | [5sing-source.plugin.js](plugins/5sing-source.plugin.js) |
| 千千音乐 | 1.0.4 | [qianqian-source.plugin.js](plugins/qianqian-source.plugin.js) |
| Y2002电音 | 1.0.2 | [y2002-source.plugin.js](plugins/y2002-source.plugin.js) |
| 一听音乐 | 1.0.2 | [1ting-source.plugin.js](plugins/1ting-source.plugin.js) |
| 懒人听书 | 1.1.0 | [lrts-source.plugin.js](plugins/lrts-source.plugin.js) |
| 博看听书 | 1.0.2 | [bokantingshu-source.plugin.js](plugins/bokantingshu-source.plugin.js) |
| 街声 | 1.0.1 | [streetvoice-source.plugin.js](plugins/streetvoice-source.plugin.js) |
| 火龙DJ | 1.0.4 | [huolongdj-source.plugin.js](plugins/huolongdj-source.plugin.js) |
| 快音 | 1.0.2 | [kuaiyin-source.plugin.js](plugins/kuaiyin-source.plugin.js) |
| 猫耳FM | 1.0.3 | [missevan-source.plugin.js](plugins/missevan-source.plugin.js) |
| DJ串烧集 | 1.0.1 | [djcsj-source.plugin.js](plugins/djcsj-source.plugin.js) |
| DJ秀 | 1.0.4 | [djshow.plugin.js](plugins/djshow.plugin.js) |
| Apple Music | 1.0.3 | [apple-music.plugin.js](plugins/apple-music.plugin.js) |
| 华为音乐 | 1.0.3 | [hwmusic-source.plugin.js](plugins/hwmusic-source.plugin.js) |
| 蜻蜓FM | 1.0.3 | [qingting-source.plugin.js](plugins/qingting-source.plugin.js) |
| 喜马拉雅 | 1.2.2 | [ximalaya-source.plugin.js](plugins/ximalaya-source.plugin.js) |
| 荔枝FM | 1.0.2 | [lizhi-source.plugin.js](plugins/lizhi-source.plugin.js) |
| 网易云电台 | 1.1.3 | [neteaseradio-source.plugin.js](plugins/neteaseradio-source.plugin.js) |
| CCTV听音 | 1.0.2 | [cctv-source.plugin.js](plugins/cctv-source.plugin.js) |
| Jamendo | 1.0.3 | [jamendo-source.plugin.js](plugins/jamendo-source.plugin.js) |
| 聚合 | 1.9.19 | [agg-source.plugin.js](plugins/agg-source.plugin.js) |
| JOOX音乐 | 1.1.3 | [joox-source.plugin.js](plugins/joox-source.plugin.js) |
| djuu DJ | 1.1.2 | [djuu-source.plugin.js](plugins/djuu-source.plugin.js) |
| 相声评书 | 1.0.3 | [xiangsheng-pingshu-source.plugin.js](plugins/xiangsheng-pingshu-source.plugin.js) |
| 皮狗DJ | 1.1.2 | [pgdjz-source.plugin.js](plugins/pgdjz-source.plugin.js) |
| DJKK | 1.1.2 | [djkk-source.plugin.js](plugins/djkk-source.plugin.js) |
| 清风DJ | 1.2.2 | [ddddj-source.plugin.js](plugins/ddddj-source.plugin.js) |
| DJ766 | 1.4.2 | [dj766-source.plugin.js](plugins/dj766-source.plugin.js) |
| 82DJ | 1.2.3 | [82dj-source.plugin.js](plugins/82dj-source.plugin.js) |
| QQDJ | 1.2.2 | [qqdjs-source.plugin.js](plugins/qqdjs-source.plugin.js) |
| 36DJ | 1.2.2 | [36dj-source.plugin.js](plugins/36dj-source.plugin.js) |
| 宝贝DJ | 1.2.1 | [bibdj-source.plugin.js](plugins/bibdj-source.plugin.js) |
| 172Mix | 1.2.1 | [172mix-source.plugin.js](plugins/172mix-source.plugin.js) |
| DJ耶耶耶 | 1.1.2 | [djyyy-source.plugin.js](plugins/djyyy-source.plugin.js) |
| 黑色音频 | 1.1.2 | [hy57-source.plugin.js](plugins/hy57-source.plugin.js) |
| 好听轻音乐 | 1.2.3 | [htqyy-source.plugin.js](plugins/htqyy-source.plugin.js) |
| 我是DJ | 1.1.2 | [54dj-source.plugin.js](plugins/54dj-source.plugin.js) |
| 电音阁 | 1.1.2 | [dianyinge-source.plugin.js](plugins/dianyinge-source.plugin.js) |
| SpaceDJ | 1.1.2 | [spacedj-source.plugin.js](plugins/spacedj-source.plugin.js) |
| DJ6 | 1.0.2 | [dj6-source.plugin.js](plugins/dj6-source.plugin.js) |
| 73DJ | 1.0.2 | [73dj-source.plugin.js](plugins/73dj-source.plugin.js) |
| MixDJ | 1.0.3 | [mixdj-source.plugin.js](plugins/mixdj-source.plugin.js) |
| 波比DJ | 1.0.2 | [bobidj-source.plugin.js](plugins/bobidj-source.plugin.js) |
| 魅力DJ | 1.0.2 | [djmei-source.plugin.js](plugins/djmei-source.plugin.js) |
| DJ娱乐 | 1.3.0 | [djyule-source.plugin.js](plugins/djyule-source.plugin.js) |
| 小熊电音 | 1.0.3 | [xxedm-source.plugin.js](plugins/xxedm-source.plugin.js) |
<!-- /README:plugins-table -->

## 目录结构

- `index.html` — 订阅站首页（四生态分区：MusicFree / 澜音 Ceru / Baka V2 / 洛雪 LX；数据自动跟随对应清单）
- `download.html` — 离线安装包下载页
- `plugins.json` — MusicFree 订阅清单（`desc` + `plugins[]`，每项 `name/url/version`；不含洛雪脚本）
- `sub/<line>/<cat>.json` — 分类订阅清单（main / dj / radio / music / all），按线路分组
- `ceru-list.json` — 澜音 Ceru 插件清单（55 个，由 `ceru-plugins/` 生成）
- `ceru-plugins/*.ceru.js` — 澜音 Ceru v2 原生插件（55 个，与 MusicFree 插件严格分离）
- `baka-list.json` — Baka V2 Provider 清单（55 个，由 `baka-plugins/` 生成）
- `baka-plugins/*.js` — Baka V2 原生 Provider（55 个，与 MusicFree / 澜音严格分离）
- `plugins/five-source-lx.plugin.v1.6.0.js` — 洛雪自定义源脚本（仅洛雪专区入口分发，不进任何 `plugins*.json`）
- `scripts/gen-site.js` — **统一生成入口**：串行跑 subscriptions + ceru-list + baka-list + readme（改完插件跑这一个命令）
- `scripts/gen-subscriptions.js` — 生成分类 + 线路订阅清单
- `scripts/gen-ceru-list.js` — 从 ceru-plugins 提取 manifest 生成 ceru-list.json
- `scripts/gen-baka-list.js` — 从 baka-plugins 读取 manifest 生成 baka-list.json
- `scripts/gen-readme.js` — 从 plugins.json / sub / sizes 自动更新 README 插件清单表与分类统计
- `scripts/pack-zips.js` — 打包离线安装 zip
- `scripts/verify-subscriptions.js` — 逐条下载比对字节数与 sha256

## 维护约定

- 新插件完成后：按对应规范放入 `plugins/`（MusicFree）、`ceru-plugins/`（澜音）或 `baka-plugins/`（Baka V2），并同步对应清单
- **改完自动同步**：跑 `node scripts/gen-site.js` 一键重生成订阅清单 + 澜音清单 + Baka 清单 + README；GitHub Actions（`.github/workflows/gen-site.yml`）在 push 到 `plugins/` 或 `ceru-plugins/` 时自动执行并提交派生产物，无需手动跑
- 插件升级：远端 `plugins/` 每个源只保留最新版本文件，旧版本不保留（回看历史走 git 记录），`plugins.json` 中 url/version 更新到新文件
- 版本号以各插件 js 内部 `version` 字段为权威依据
- 洛雪自定义源脚本与 MusicFree 插件严格分离：只放 `plugins/` 目录与订阅站洛雪专区，禁止写入 `plugins.json` 及任何镜像清单
