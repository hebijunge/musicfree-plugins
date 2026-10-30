# musicfree-plugins

MusicFree 插件订阅仓库（57 个插件）+ 洛雪（LX Music）自定义源发布仓库，两个生态相互独立。

- **MusicFree 插件**：通过「订阅」机制安装/更新，订阅清单不含任何洛雪内容
- **洛雪自定义源**：五源合一脚本，仅适用于洛雪 App，单独下载导入，与 MusicFree 插件不通用（详见下方专节）

**订阅站首页**（插件列表、全部订阅地址一键复制）：https://hebijunge.github.io/musicfree-plugins/

在 MusicFree「插件设置 → 订阅」中填入下面的订阅地址即可一键安装/更新全部插件。

## 按类别订阅（推荐）

插件按用途拆成 5 份清单，**用哪个类别就只装哪份**，不必一次拉 57 个（全量 8.2 MB，分类后常用平台只有 2.9 MB）。

主地址走 **gh.padao.fun 加速**：实测「常用六平台」6 并发下载 0.31~1.59 秒，全部落在 MusicFree 的 2 秒超时内。GitHub Pages 官方直出在同一测试下要 17~33 秒，会被 App 判超时，已降为备用线路。

| 类别 | 条目 | 体积 | 订阅地址（主 · gh.padao.fun） |
|---|---|---|---|
| ① 常用六平台 | 6 | 2.9 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/main.json` |
| ② DJ / 舞曲 / 电音 | 30 | 0.96 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/dj.json` |
| ③ 听书 / 电台 / 播客 | 10 | 0.62 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/radio.json` |
| ④ 其它音乐平台 | 11 | 3.7 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/music.json` |
| ⑤ 全部插件 | 57 | 8.2 MB | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/all.json` |

- ① 常用六平台 = QQ音乐 / 酷我 / 酷狗 / 咪咕 / 网易云 / 汽水
- ④ 其它音乐平台 = B站 / 5sing / 千千 / 一听 / 街声 / Apple Music / 华为 / Jamendo / 聚合 / JOOX / 好听轻音乐
- 分类清单随 `plugins.json` 同步生成：`node scripts/gen-subscriptions.js`

**换线路只需换前缀**（同一类别文件在所有线路下内容一一对应）：

| 线路 | 前缀写法 | 说明 |
|---|---|---|
| gh.padao.fun | `https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/` | 主用，实测最快 |
| GitHub Pages | `https://hebijunge.github.io/musicfree-plugins/sub/githubio/` | 最稳，但下载慢，易触发 2 秒超时 |
| fastly | `https://fastly.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/sub/fastly/` | jsDelivr 节点，速度同样偏慢 |

例：常用六平台的 Pages 版 = `https://hebijunge.github.io/musicfree-plugins/sub/githubio/main.json`

## 全部插件（57 个）· 备用线路

内容完全一致，只是插件下载源不同：

- 主线路 gh.padao.fun：`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/plugins.json`
- GitHub Pages 直出：`https://hebijunge.github.io/musicfree-plugins/plugins.json`
- fastly：`https://hebijunge.github.io/musicfree-plugins/plugins-fastly.json`
- gcore：`https://hebijunge.github.io/musicfree-plugins/plugins-gcore.json`
- 其它 20 条：`plugins-proxy-01.json` ~ `plugins-proxy-20.json`（见首页「全部插件 · 备用线路」折叠区）

### 2026-10-30 导入速度实测（常用六平台，模拟 App 流程：拉清单 + 6 并发，连测 3 轮）

| 线路 | 拉清单 | 6 并发总耗时 | 最慢单文件 | 超 2s 条数 |
|---|---|---|---|---|
| gh.padao.fun | 170~598 ms | 0.31 / 0.34 / 0.35 / 0.37 / 0.54 / 1.59 s | 1.59 s（冷启动） | **0** |
| GitHub Pages | 122~604 ms | 17.0 / 17.8 / 20.8 / 21.4 / 25.5 / 32.9 s | 32.9 s | 6 / 6 |
| fastly | 92~286 ms | 14.4 / 16.0 / 16.1 / 17.0 / 17.6 / 18.3 s | 17.6 s | 6 / 6 |

- 三种线路下载到的文件 sha256 均与源文件一致，差别只在速度。
- GitHub Pages 并发下载实际速率约 24 KB/s（628 KB 的 QQ 插件 25.7 s），单文件串行时约 96 KB/s，说明它对并发有限速。
- MusicFree 源码 `axios.defaults.timeout = 2000` 是硬上限，超时即报 `timeout of 2000ms exceeded`，因此慢线路表现为「导入失败」而不是「慢」。
- 测试为本机直连结果，手机运营商不同会有差异；主线路若在你的网络下也超时，换下表任一前缀即可。

### 2026-10-30 线路实测（本机直连，基准文件 qq-source 643 KB，超时 12s）

| 线路 | 结果 |
|---|---|
| gh.padao.fun | ✓ 1.9s / 643 KB 完整 |
| down.mxw.xx.kg | ✓ 3.0s |
| 30006000.xyz | ✓ 3.6s |
| wget.la | ✓ 3.7s |
| fastly.jsdelivr.net | ✓ 3.7s |
| github.cnxiaobai.com | ✓ 3.8s |
| cdn.akaere.online | ✓ 4.0s |
| xsadwsd.kdns.fr | ✓ 4.3s |
| ghpxy.hwinzniej.top | ✓ 4.5s |
| gh.acmsz.top | ✓ 5.1s |
| ghproxy.053000.xyz | ✓ 5.2s |
| gcore.jsdelivr.net | ✓ 5.6s |
| git.yylx.win | ✓ 5.8s |
| hebijunge.github.io | ✓ 6.7s |
| **cdn.jsdelivr.net / raw.githubusercontent.com / ghproxy.net / gh.927223.xyz / gh.halonice.com / js.jiangss.shop** | ✗ 连不通（000） |
| **gh-proxy.com（302 KB）/ ghm.078465.xyz（490 KB）** | ✗ 内容被截断（正常 643 KB），插件必解析失败 |
| **gh.felicity.ac.cn / gh.idayer.com** | ✗ 429 限流 |
| **github.xxlab.tech** | ✗ 302 跳转异常 |

本次已把 `plugins-cdn.json` 等旧文件的内容重排到上面 14 条可用线路，文件名保持不变以兼容历史链接；不可用线路不再生成订阅。

### 说明

- 清单文件均托管在本仓库（GitHub Pages 直出，实时同步）；区别仅在清单内插件文件的下载源。
- **导入失败先查两点**：① 订阅地址是否以 `.json` 结尾（MusicFree 的硬性校验，否则直接提示"订阅地址需以 .js/.json 结尾"）；② 换一条更快的线路。MusicFree 对单个文件下载有超时限制（源码 `axios.defaults.timeout = 2000`），慢线路上全量 8.2 MB 容易中途报错，只装常用平台稳得多。
- 已失效通道对应的旧文件（`plugins-proxy-06/07/13.json` 等）保留在仓库中但已重排到可用线路，不再单独推荐。
- 单个插件备用直链：fastly / gcore 可用；raw 直连不可用，需加代理前缀。
- 校验脚本：`node scripts/verify-subscriptions.js padao` — 逐条下载比对字节数与 sha256。

### jihulab 兜底（待配置，方案已就绪）

jihulab.com（GitLab 国内镜像）可作为 jsdelivr 之外的独立兜底源：仓库不依赖 GitHub 存活，且无 jsdelivr 的 12h 缓存问题（raw 直出最新 main）。接入需要 jihulab 账号与 Personal Access Token（本机无凭据，尚未建镜像仓库），方案二选一：

- 全自动：在 GitHub 仓库 Settings → Secrets 配置 `JIHULAB_TOKEN`（jihulab PAT，write_repository 权限）与 `JIHULAB_PATH`（jihulab 命名空间/项目路径），`.github/workflows/mirror-jihulab.yml` 会在每次 master 推送后自动镜像（触发分支已修正为 `master`）；未配置 Secrets 时该工作流自动跳过、不报错。
- 手动/半自动：jihulab 网页建空项目后，本地克隆本仓库运行 `JITOKEN=<PAT> JIPATH=<命名空间>/<项目> ./scripts/sync-jihulab.sh`（token 只走环境变量）。
- 镜像建成后的兜底订阅地址：`https://jihulab.com/<命名空间>/<项目>/-/raw/main/plugins.json`

## 洛雪（LX Music）自定义源

五源合一自定义源脚本，**仅适用于洛雪音乐 App**，与 MusicFree 插件不通用（2026-10-19 起已从本仓库全部 20 份 MusicFree 订阅清单中移除，请勿在 MusicFree 中使用）。

- 脚本文件（v1.6.0）：[plugins/five-source-lx.plugin.v1.6.0.js](plugins/five-source-lx.plugin.v1.6.0.js)
- 在线导入链接（洛雪 App 内粘贴）：
  `https://hebijunge.github.io/musicfree-plugins/plugins/five-source-lx.plugin.v1.6.0.js`
- 导入方法：洛雪 App → 设置 → 自定义源管理 → 导入（选「在线链接」粘贴上方地址，或下载 .js 后选「本地文件」导入）
- 说明：洛雪自定义源为非订阅机制，一次导入一个脚本，导入后不会随清单自动更新；版本升级需重新导入

## 插件清单

| QQ音乐 | 1.9.26 | [qq-source.plugin.v1.9.26.js](plugins/qq-source.plugin.v1.9.26.js) |
| 酷我音乐 | 1.9.24 | [kuwo-source.plugin.v1.9.24.js](plugins/kuwo-source.plugin.v1.9.24.js) |
| 酷狗音乐 | 1.9.24 | [kugou-source.plugin.v1.9.24.js](plugins/kugou-source.plugin.v1.9.24.js) |
| 咪咕音乐 | 1.9.19 | [migu-source.plugin.v1.9.19.js](plugins/migu-source.plugin.v1.9.19.js) |
| 网易云音乐 | 1.9.27 | [netease-source.plugin.v1.9.27.js](plugins/netease-source.plugin.v1.9.27.js) |
| 汽水音乐 | 1.9.23 | [qishui-source.plugin.v1.9.23.js](plugins/qishui-source.plugin.v1.9.23.js) |
| B站 | 1.1.4 | [bilibili-source.plugin.v1.1.4.js](plugins/bilibili-source.plugin.v1.1.4.js) |
| 番茄畅听 | 1.2.2 | [fanqie-source.plugin.v1.2.2.js](plugins/fanqie-source.plugin.v1.2.2.js) |
| DJ多多 | 1.0.2 | [djduoduo-source.plugin.v1.0.2.js](plugins/djduoduo-source.plugin.v1.0.2.js) |
| 5sing | 1.0.2 | [5sing-source.plugin.v1.0.2.js](plugins/5sing-source.plugin.v1.0.2.js) |
| 千千音乐 | 1.0.4 | [qianqian-source.plugin.v1.0.4.js](plugins/qianqian-source.plugin.v1.0.4.js) |
| Y2002电音 | 1.0.2 | [y2002-source.plugin.v1.0.2.js](plugins/y2002-source.plugin.v1.0.2.js) |
| 一听音乐 | 1.0.2 | [1ting-source.plugin.v1.0.2.js](plugins/1ting-source.plugin.v1.0.2.js) |
| 懒人听书 | 1.0.3 | [lrts-source.plugin.v1.0.3.js](plugins/lrts-source.plugin.v1.0.3.js) |
| 博看听书 | 1.0.2 | [bokantingshu-source.plugin.v1.0.2.js](plugins/bokantingshu-source.plugin.v1.0.2.js) |
| 街声 | 1.0.1 | [streetvoice-source.plugin.v1.0.1.js](plugins/streetvoice-source.plugin.v1.0.1.js) |
| 火龙DJ | 1.0.4 | [huolongdj-source.plugin.v1.0.4.js](plugins/huolongdj-source.plugin.v1.0.4.js) |
| 快音 | 1.0.2 | [kuaiyin-source.plugin.v1.0.2.js](plugins/kuaiyin-source.plugin.v1.0.2.js) |
| 猫耳FM | 1.0.3 | [missevan-source.plugin.v1.0.3.js](plugins/missevan-source.plugin.v1.0.3.js) |
| DJ串烧集 | 1.0.1 | [djcsj-source.plugin.v1.0.1.js](plugins/djcsj-source.plugin.v1.0.1.js) |
| DJ秀 | 1.0.4 | [djshow.plugin.v1.0.4.js](plugins/djshow.plugin.v1.0.4.js) |
| Apple Music | 1.0.2 | [apple-music-v1.0.2.js](plugins/apple-music-v1.0.2.js) |
| 华为音乐 | 1.0.3 | [hwmusic-source.plugin.v1.0.3.js](plugins/hwmusic-source.plugin.v1.0.3.js) |
| 蜻蜓FM | 1.0.3 | [qingting-source.plugin.v1.0.3.js](plugins/qingting-source.plugin.v1.0.3.js) |
| 喜马拉雅 | 1.2.1 | [ximalaya-source.plugin.v1.2.1.js](plugins/ximalaya-source.plugin.v1.2.1.js) |
| 荔枝FM | 1.0.2 | [lizhi-source.plugin.v1.0.2.js](plugins/lizhi-source.plugin.v1.0.2.js) |
| 网易云电台 | 1.1.3 | [neteaseradio-source.plugin.v1.1.3.js](plugins/neteaseradio-source.plugin.v1.1.3.js) |
| CCTV听音 | 1.0.2 | [cctv-source.plugin.v1.0.2.js](plugins/cctv-source.plugin.v1.0.2.js) |
| Jamendo | 1.0.2 | [jamendo-source.plugin.v1.0.2.js](plugins/jamendo-source.plugin.v1.0.2.js) |
| 聚合 | 1.9.18 | [agg-source.plugin.v1.9.18.js](plugins/agg-source.plugin.v1.9.18.js) |
| JOOX音乐 | 1.1.3 | [joox-source.plugin.v1.1.3.js](plugins/joox-source.plugin.v1.1.3.js) |
| djuu DJ | 1.1.2 | [djuu-source.plugin.v1.1.2.js](plugins/djuu-source.plugin.v1.1.2.js) |
| 相声评书 | 1.0.3 | [xiangsheng-pingshu-source.plugin.v1.0.3.js](plugins/xiangsheng-pingshu-source.plugin.v1.0.3.js) |
| 皮狗DJ | 1.1.2 | [pgdjz-source.plugin.v1.1.2.js](plugins/pgdjz-source.plugin.v1.1.2.js) |
| DJKK | 1.1.2 | [djkk-source.plugin.v1.1.2.js](plugins/djkk-source.plugin.v1.1.2.js) |
| 水晶舞曲 | 1.2.2 | [dj14-source.plugin.v1.2.2.js](plugins/dj14-source.plugin.v1.2.2.js) |
| 清风DJ | 1.2.2 | [ddddj-source.plugin.v1.2.2.js](plugins/ddddj-source.plugin.v1.2.2.js) |
| DJ766 | 1.4.1 | [dj766-source.plugin.v1.4.1.js](plugins/dj766-source.plugin.v1.4.1.js) |
| 82DJ | 1.2.1 | [82dj-source.plugin.v1.2.1.js](plugins/82dj-source.plugin.v1.2.1.js) |
| QQDJ | 1.2.2 | [qqdjs-source.plugin.v1.2.2.js](plugins/qqdjs-source.plugin.v1.2.2.js) |
| 36DJ | 1.2.2 | [36dj-source.plugin.v1.2.2.js](plugins/36dj-source.plugin.v1.2.2.js) |
| 宝贝DJ | 1.2.1 | [bibdj-source.plugin.v1.2.1.js](plugins/bibdj-source.plugin.v1.2.1.js) |
| 172Mix | 1.2.1 | [172mix-source.plugin.v1.2.1.js](plugins/172mix-source.plugin.v1.2.1.js) |
| DJ耶耶耶 | 1.1.2 | [djyyy-source.plugin.v1.1.2.js](plugins/djyyy-source.plugin.v1.1.2.js) |
| 黑色音频 | 1.1.2 | [hy57-source.plugin.v1.1.2.js](plugins/hy57-source.plugin.v1.1.2.js) |
| 好听轻音乐 | 1.2.3 | [htqyy-source.plugin.v1.2.3.js](plugins/htqyy-source.plugin.v1.2.3.js) |
| 我是DJ | 1.1.2 | [54dj-source.plugin.v1.1.2.js](plugins/54dj-source.plugin.v1.1.2.js) |
| 电音阁 | 1.1.2 | [dianyinge-source.plugin.v1.1.2.js](plugins/dianyinge-source.plugin.v1.1.2.js) |
| SpaceDJ | 1.1.2 | [spacedj-source.plugin.v1.1.2.js](plugins/spacedj-source.plugin.v1.1.2.js) |
| DJ6 | 1.0.2 | [dj6-source.plugin.v1.0.2.js](plugins/dj6-source.plugin.v1.0.2.js) |
| 73DJ | 1.0.1 | [73dj-source.plugin.v1.0.1.js](plugins/73dj-source.plugin.v1.0.1.js) |
| 先上DJ | 1.1.1 | [xsdj123-source.plugin.v1.1.1.js](plugins/xsdj123-source.plugin.v1.1.1.js) |
| MixDJ | 1.0.2 | [mixdj-source.plugin.v1.0.2.js](plugins/mixdj-source.plugin.v1.0.2.js) |
| 波比DJ | 1.0.1 | [bobidj-source.plugin.v1.0.1.js](plugins/bobidj-source.plugin.v1.0.1.js) |
| 魅力DJ | 1.0.1 | [djmei-source.plugin.v1.0.1.js](plugins/djmei-source.plugin.v1.0.1.js) |
| DJ娱乐 | 1.2.1 | [djyule-source.plugin.v1.2.1.js](plugins/djyule-source.plugin.v1.2.1.js) |
| 小熊电音 | 1.0.2 | [xxedm-source.plugin.v1.0.2.js](plugins/xxedm-source.plugin.v1.0.2.js) |

## 目录结构

- `index.html` — 订阅站首页（数据自动跟随 `plugins.json`，含洛雪专区分区展示与插件搜索）
- `plugins.json` — MusicFree 订阅清单（结构对齐 musicfreepluginshub：`desc` + `plugins[]`，每项 `name/url/version`；**不含洛雪脚本**）
- `plugins/five-source-lx.plugin.v1.6.0.js` — 洛雪自定义源脚本（仅洛雪专区入口分发，不进任何 `plugins*.json`）
- `plugins-fastly.json` / `plugins-gcore.json` / `plugins-cdn.json` / `plugins-ghproxy.json` / `plugins-proxy-01..20.json` — 备用通道订阅清单（结构与 `plugins.json` 完全一致，仅插件 url 前缀不同）
- `scripts/sync-jihulab.sh` — jihulab 镜像手动同步脚本（token 走环境变量，不落盘）
- `.github/workflows/mirror-jihulab.yml` — master 推送后自动镜像到 jihulab（需 Secrets，未配置自动跳过；触发分支配置当前仍为 `main`，启用前需改为 `master`）
- `plugins/` — 插件 js 直链文件，文件名含版本号；更新插件时新增带新版本号的文件，并在 `plugins.json` 中把该项 `url` 与 `version` 指向新文件

## 维护约定

- 新插件完成后：将 js 按命名规范放入 `plugins/`，在 `plugins.json` 追加一条（name/url/version 与插件内部声明一致）即可，订阅端自动生效
- 插件升级：远端 `plugins/` 每个源只保留最新版本文件，旧版本不保留（需要回看历史走 git 记录），`plugins.json` 中 url/version 更新到新文件
- 版本号以各插件 js 内部 `version` 字段为权威依据
- 洛雪自定义源脚本与 MusicFree 插件严格分离：只放 `plugins/` 目录与订阅站洛雪专区，**禁止**写入 `plugins.json` 及任何镜像清单
