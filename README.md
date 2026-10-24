# musicfree-plugins

MusicFree 插件订阅仓库（57 个插件）+ 洛雪（LX Music）自定义源发布仓库，两个生态相互独立。

- **MusicFree 插件**：通过「订阅」机制安装/更新，订阅清单不含任何洛雪内容
- **洛雪自定义源**：五源合一脚本，仅适用于洛雪 App，单独下载导入，与 MusicFree 插件不通用（详见下方专节）

**订阅站首页**（插件列表、全部订阅地址一键复制）：https://hebijunge.github.io/musicfree-plugins/

在 MusicFree「插件设置 → 订阅」中填入下面的订阅地址即可一键安装/更新全部插件。

## 订阅地址（多条通道，内容完全一致，哪个可用用哪个）

- GitHub Pages（推荐）：
  `https://hebijunge.github.io/musicfree-plugins/plugins.json`
- fastly CDN 备用（清单由 Pages 提供，插件文件走 fastly）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-fastly.json`
- gcore CDN 备用（清单由 Pages 提供，插件文件走 gcore）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-gcore.json`
- **jsdelivr 全兜底（清单与插件文件均走 jsdelivr，完全不依赖 Pages；2026-09-26 实测全量插件 md5 与主通道一致）**：
  - fastly 变体（推荐，jsdelivr 国内常用节点）：
    `https://fastly.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/plugins-fastly.json`
  - gcore 变体：
    `https://gcore.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/plugins-gcore.json`
  - cdn 主域变体（数据中心 IP 实测稳定；部分家宽网络可能被重置，失败就用上面两条）：
    `https://cdn.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/plugins-cdn.json`
- 国内加速 ghproxy（清单与插件文件均经 ghproxy.net 代理直取 GitHub 源；2026-10-24 复测可用，0.6MB 文件实测约 0.3 MB/s）：
  `https://ghproxy.net/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/plugins-ghproxy.json`

### 国内代理 · 实测收录（2026-10-24 复测，20 条中 17 条可用）

以下 17 条为独立订阅地址，内容与上方通道完全一致（57 个插件），插件文件经对应代理直取 GitHub 源。收录标准：清单可用 + JSON 校验 + 插件 js sha256 与源一致，按实测速度排序（实测为数据中心节点，速度仅作排序参考）。已失效通道移入下方「历史收录（已失效）」，其清单文件（plugins-proxy-06/07/13.json）仍保留在仓库中但不再推荐。本次复测 12（gh.idayer.com）、15（gh.felicity.ac.cn）两通道自 10-22 的 429 状态恢复，并新收编 16~20 五条候选通道（实测两轮取均值）；测速基准为 0.6MB 真实插件文件（qq-source v1.9.25），小文件受 TCP 爬坡影响，速度量级与 10-22 复测的 12MB 大文件口径不可直接对比。

- 代理01 · git.yylx.win（实测 0.9 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-01.json`
- 代理04 · ghm.078465.xyz（实测 0.8 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-04.json`
- 代理02 · gh.acmsz.top（实测 0.8 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-02.json`
- 代理03 · gh-proxy.com（实测 0.7 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-03.json`
- 代理10 · gh.padao.fun（实测 0.4 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-10.json`
- 代理16 · github.cnxiaobai.com（实测 0.38 MB/s · 10-24，新收编）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-16.json`
- 代理15 · gh.felicity.ac.cn（实测 0.3 MB/s · 10-24，恢复）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-15.json`
- 代理09 · cdn.akaere.online（实测 0.3 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-09.json`
- 代理11 · xsadwsd.kdns.fr（实测 0.3 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-11.json`
- 代理17 · 30006000.xyz（实测 0.28 MB/s · 10-24，新收编）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-17.json`
- 代理18 · ghpxy.hwinzniej.top（实测 0.27 MB/s · 10-24，新收编）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-18.json`
- 代理12 · gh.idayer.com（实测 0.3 MB/s · 10-24，恢复）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-12.json`
- 代理14 · github.xxlab.tech（实测 0.26 MB/s · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-14.json`
- 代理19 · ghproxy.net（实测 0.26 MB/s · 10-24，新收编；另见上方 ghproxy 加速通道）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-19.json`
- 代理20 · down.mxw.xx.kg（实测 0.26 MB/s · 10-24，新收编）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-20.json`
- 代理05 · ghproxy.053000.xyz（慢速 · 实测 0.1~0.4 MB/s 波动 · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-05.json`
- 代理08 · wget.la（慢速 · 实测 0.02~0.4 MB/s 波动大 · 10-24）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-08.json`

#### 历史收录（已失效，2026-10-24 复测）

- 代理06 · gh.927223.xyz — 连接/读取超时（90 秒超时，两次复测均超时）
- 代理07 · gh.halonice.com — 502（10-22 为 401 要求鉴权，本次两试均 502）
- 代理13 · js.jiangss.shop — 502（两次复测均 502）

说明：
- Pages 系清单文件均托管在本仓库（GitHub Pages 直出，实时同步）；区别仅在清单内插件文件的下载源——`plugins.json` 走 Pages、`plugins-fastly.json` 走 fastly CDN、`plugins-gcore.json` 走 gcore CDN、`plugins-cdn.json` 走 cdn.jsdelivr.net、`plugins-ghproxy.json` 与 `plugins-proxy-01..20.json` 走对应代理直取 GitHub 源。
- **jsdelivr 全兜底说明**：上面「jsdelivr 全兜底」三条的清单文件本身也经 jsdelivr 拉取（`@master` 分支引用），Pages 不可用时整条链路仍可用。已知限制：jsdelivr 对 `@master` 引用有边缘缓存（响应头 s-maxage=43200，即最长约 12 小时滞后），浏览器侧 max-age=7 天（强刷可绕过）；推送新版本后如需立即生效可调 purge（GET）：`https://purge.jsdelivr.net/gh/hebijunge/musicfree-plugins@master/plugins-cdn.json`（实测返回 finished，边缘收敛可能仍有分钟级滞后）。要求零滞后请以 GitHub Pages 主通道为准。
- 导入时哪个通道报 Network Error / 连接重置，就换另一条订阅地址重试。
- 单个插件卡备用直链：fastly / gcore / cdn.jsdelivr.net / raw.githubusercontent 均可用；raw 直连失败时可加代理前缀 `https://ghproxy.net/` + raw 地址。
- 主域名 `cdn.jsdelivr.net` 在部分家宽网络下会被重置（故收录为兜底第三位，fastly/gcore 变体优先；数据中心网络实测稳定）。

### jihulab 兜底（待配置，方案已就绪）

jihulab.com（GitLab 国内镜像）可作为 jsdelivr 之外的独立兜底源：仓库不依赖 GitHub 存活，且无 jsdelivr 的 12h 缓存问题（raw 直出最新 main）。接入需要 jihulab 账号与 Personal Access Token（本机无凭据，尚未建镜像仓库），方案二选一：

- 全自动：在 GitHub 仓库 Settings → Secrets 配置 `JIHULAB_TOKEN`（jihulab PAT，write_repository 权限）与 `JIHULAB_PATH`（jihulab 命名空间/项目路径），`.github/workflows/mirror-jihulab.yml` 会在每次 master 推送后自动镜像（注：该 workflow 的触发分支当前仍写死 `main`，启用前需同步改为 `master`）；未配置 Secrets 时该工作流自动跳过、不报错。
- 手动/半自动：jihulab 网页建空项目后，本地克隆本仓库运行 `JITOKEN=<PAT> JIPATH=<命名空间>/<项目> ./scripts/sync-jihulab.sh`（token 只走环境变量）。
- 镜像建成后的兜底订阅地址：`https://jihulab.com/<命名空间>/<项目>/-/raw/main/plugins.json`

## 洛雪（LX Music）自定义源

五源合一自定义源脚本，**仅适用于洛雪音乐 App**，与 MusicFree 插件不通用（2026-10-19 起已从本仓库全部 20 份 MusicFree 订阅清单中移除，请勿在 MusicFree 中使用）。

- 脚本文件（v1.2.0）：[plugins/five-source-lx.plugin.v1.2.0.js](plugins/five-source-lx.plugin.v1.2.0.js)
- 在线导入链接（洛雪 App 内粘贴）：
  `https://hebijunge.github.io/musicfree-plugins/plugins/five-source-lx.plugin.v1.2.0.js`
- 导入方法：洛雪 App → 设置 → 自定义源管理 → 导入（选「在线链接」粘贴上方地址，或下载 .js 后选「本地文件」导入）
- 说明：洛雪自定义源为非订阅机制，一次导入一个脚本，导入后不会随清单自动更新；版本升级需重新导入

## 插件清单

| QQ音乐 | 1.9.25 | [qq-source.plugin.v1.9.25.js](plugins/qq-source.plugin.v1.9.25.js) |
| 酷我音乐 | 1.9.20 | [kuwo-source.plugin.v1.9.20.js](plugins/kuwo-source.plugin.v1.9.20.js) |
| 酷狗音乐 | 1.9.22 | [kugou-source.plugin.v1.9.22.js](plugins/kugou-source.plugin.v1.9.22.js) |
| 咪咕音乐 | 1.9.18 | [migu-source.plugin.v1.9.18.js](plugins/migu-source.plugin.v1.9.18.js) |
| 网易云音乐 | 1.9.22 | [netease-source.plugin.v1.9.22.js](plugins/netease-source.plugin.v1.9.22.js) |
| 汽水音乐 | 1.9.20 | [qishui-source.plugin.v1.9.20.js](plugins/qishui-source.plugin.v1.9.20.js) |
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
- `plugins/five-source-lx.plugin.v1.2.0.js` — 洛雪自定义源脚本（仅洛雪专区入口分发，不进任何 `plugins*.json`）
- `plugins-fastly.json` / `plugins-gcore.json` / `plugins-cdn.json` / `plugins-ghproxy.json` / `plugins-proxy-01..20.json` — 备用通道订阅清单（结构与 `plugins.json` 完全一致，仅插件 url 前缀不同）
- `scripts/sync-jihulab.sh` — jihulab 镜像手动同步脚本（token 走环境变量，不落盘）
- `.github/workflows/mirror-jihulab.yml` — master 推送后自动镜像到 jihulab（需 Secrets，未配置自动跳过；触发分支配置当前仍为 `main`，启用前需改为 `master`）
- `plugins/` — 插件 js 直链文件，文件名含版本号；更新插件时新增带新版本号的文件，并在 `plugins.json` 中把该项 `url` 与 `version` 指向新文件

## 维护约定

- 新插件完成后：将 js 按命名规范放入 `plugins/`，在 `plugins.json` 追加一条（name/url/version 与插件内部声明一致）即可，订阅端自动生效
- 插件升级：远端 `plugins/` 每个源只保留最新版本文件，旧版本不保留（需要回看历史走 git 记录），`plugins.json` 中 url/version 更新到新文件
- 版本号以各插件 js 内部 `version` 字段为权威依据
- 洛雪自定义源脚本与 MusicFree 插件严格分离：只放 `plugins/` 目录与订阅站洛雪专区，**禁止**写入 `plugins.json` 及任何镜像清单
