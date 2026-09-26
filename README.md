# musicfree-plugins

MusicFree（音流 fork）插件订阅仓库。

**订阅站首页**（插件列表、全部订阅地址一键复制）：https://hebijunge.github.io/musicfree-plugins/

在 MusicFree「插件设置 → 订阅」中填入下面的订阅地址即可一键安装/更新全部插件。

## 订阅地址（多条通道，内容完全一致，哪个可用用哪个）

- GitHub Pages（推荐）：
  `https://hebijunge.github.io/musicfree-plugins/plugins.json`
- fastly CDN 备用（清单由 Pages 提供，插件文件走 fastly）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-fastly.json`
- gcore CDN 备用（清单由 Pages 提供，插件文件走 gcore）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-gcore.json`
- **jsdelivr 全兜底（清单与插件文件均走 jsdelivr，完全不依赖 Pages；2026-09-26 实测全量 30 插件 md5 与主通道一致）**：
  - fastly 变体（推荐，jsdelivr 国内常用节点）：
    `https://fastly.jsdelivr.net/gh/hebijunge/musicfree-plugins@main/plugins-fastly.json`
  - gcore 变体：
    `https://gcore.jsdelivr.net/gh/hebijunge/musicfree-plugins@main/plugins-gcore.json`
  - cdn 主域变体（数据中心 IP 实测稳定；部分家宽网络可能被重置，失败就用上面两条）：
    `https://cdn.jsdelivr.net/gh/hebijunge/musicfree-plugins@main/plugins-cdn.json`
- 国内加速 ghproxy（清单与插件文件均经 ghproxy.net 代理直取 GitHub 源）：
  `https://ghproxy.net/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/main/plugins-ghproxy.json`

### 国内代理 · 实测收录（2026-09-25 实测 109 个候选，收录 15 条）

以下 15 条为独立订阅地址，内容与上方通道完全一致（26 个插件），插件文件经对应代理直取 GitHub 源。收录标准：清单可用 + JSON 校验 + 插件 js sha256 与源一致 + 两轮复测通过，按平均速度取 Top 15（实测为海外节点，速度仅作排序参考）。

- 代理01 · git.yylx.win（实测 434 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-01.json`
- 代理02 · gh.acmsz.top（实测 401 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-02.json`
- 代理03 · gh-proxy.com（实测 371 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-03.json`
- 代理04 · ghm.078465.xyz（实测 305 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-04.json`
- 代理05 · ghproxy.053000.xyz（实测 225 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-05.json`
- 代理06 · gh.927223.xyz（实测 223 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-06.json`
- 代理07 · gh.halonice.com（实测 197 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-07.json`
- 代理08 · wget.la（实测 187 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-08.json`
- 代理09 · cdn.akaere.online（实测 186 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-09.json`
- 代理10 · gh.padao.fun（实测 184 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-10.json`
- 代理11 · xsadwsd.kdns.fr（实测 183 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-11.json`
- 代理12 · gh.idayer.com（实测 178 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-12.json`
- 代理13 · js.jiangss.shop（实测 175 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-13.json`
- 代理14 · github.xxlab.tech（实测 173 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-14.json`
- 代理15 · gh.felicity.ac.cn（实测 165 KB/s · 09-25）：
  `https://hebijunge.github.io/musicfree-plugins/plugins-proxy-15.json`


说明：
- Pages 系清单文件均托管在本仓库（GitHub Pages 直出，实时同步）；区别仅在清单内插件文件的下载源——`plugins.json` 走 Pages、`plugins-fastly.json` 走 fastly CDN、`plugins-gcore.json` 走 gcore CDN、`plugins-cdn.json` 走 cdn.jsdelivr.net、`plugins-ghproxy.json` 与 `plugins-proxy-01..15.json` 走对应代理直取 GitHub 源。
- **jsdelivr 全兜底说明**：上面「jsdelivr 全兜底」三条的清单文件本身也经 jsdelivr 拉取（`@main` 分支引用），Pages 不可用时整条链路仍可用。已知限制：jsdelivr 对 `@main` 引用有边缘缓存（响应头 s-maxage=43200，即最长约 12 小时滞后），浏览器侧 max-age=7 天（强刷可绕过）；推送新版本后如需立即生效可调 purge（GET）：`https://purge.jsdelivr.net/gh/hebijunge/musicfree-plugins@main/plugins-cdn.json`（实测返回 finished，边缘收敛可能仍有分钟级滞后）。要求零滞后请以 GitHub Pages 主通道为准。
- 导入时哪个通道报 Network Error / 连接重置，就换另一条订阅地址重试。
- 单个插件卡备用直链：fastly / gcore / cdn.jsdelivr.net / raw.githubusercontent 均可用；raw 直连失败时可加代理前缀 `https://ghproxy.net/` + raw 地址。
- 主域名 `cdn.jsdelivr.net` 在部分家宽网络下会被重置（故收录为兜底第三位，fastly/gcore 变体优先；数据中心网络实测稳定）。

### jihulab 兜底（待配置，方案已就绪）

jihulab.com（GitLab 国内镜像）可作为 jsdelivr 之外的独立兜底源：仓库不依赖 GitHub 存活，且无 jsdelivr 的 12h 缓存问题（raw 直出最新 main）。接入需要 jihulab 账号与 Personal Access Token（本机无凭据，尚未建镜像仓库），方案二选一：

- 全自动：在 GitHub 仓库 Settings → Secrets 配置 `JIHULAB_TOKEN`（jihulab PAT，write_repository 权限）与 `JIHULAB_PATH`（jihulab 命名空间/项目路径），`.github/workflows/mirror-jihulab.yml` 会在每次 main 推送后自动镜像；未配置 Secrets 时该工作流自动跳过、不报错。
- 手动/半自动：jihulab 网页建空项目后，本地克隆本仓库运行 `JITOKEN=<PAT> JIPATH=<命名空间>/<项目> ./scripts/sync-jihulab.sh`（token 只走环境变量）。
- 镜像建成后的兜底订阅地址：`https://jihulab.com/<命名空间>/<项目>/-/raw/main/plugins.json`

## 插件清单

| 插件 | 版本 | 文件 |
| --- | --- | --- |
| QQ音乐 | 1.9.15 | [qq-source.plugin.v1.9.15.js](plugins/qq-source.plugin.v1.9.15.js) |
| 酷我音乐 | 1.9.15 | [kuwo-source.plugin.v1.9.15.js](plugins/kuwo-source.plugin.v1.9.15.js) |
| 酷狗音乐 | 1.9.15 | [kugou-source.plugin.v1.9.15.js](plugins/kugou-source.plugin.v1.9.15.js) |
| 咪咕音乐 | 1.9.15 | [migu-source.plugin.v1.9.15.js](plugins/migu-source.plugin.v1.9.15.js) |
| 网易云音乐 | 1.9.15 | [netease-source.plugin.v1.9.15.js](plugins/netease-source.plugin.v1.9.15.js) |
| 汽水音乐 | 1.9.15 | [qishui-source.plugin.v1.9.15.js](plugins/qishui-source.plugin.v1.9.15.js) |
| B站 | 1.1.0 | [bilibili-source.plugin.v1.1.0.js](plugins/bilibili-source.plugin.v1.1.0.js) |
| 番茄畅听 | 1.1.0 | [fanqie-source.plugin.v1.1.0.js](plugins/fanqie-source.plugin.v1.1.0.js) |
| DJ多多 | 1.0.0 | [djduoduo-source.plugin.v1.0.0.js](plugins/djduoduo-source.plugin.v1.0.0.js) |
| 5sing | 1.0.0 | [5sing-source.plugin.v1.0.0.js](plugins/5sing-source.plugin.v1.0.0.js) |
| 千千音乐 | 1.0.2 | [qianqian-source.plugin.v1.0.2.js](plugins/qianqian-source.plugin.v1.0.2.js) |
| Y2002电音 | 1.0.0 | [y2002-source.plugin.v1.0.0.js](plugins/y2002-source.plugin.v1.0.0.js) |
| 一听音乐 | 1.0.1 | [1ting-source.plugin.v1.0.1.js](plugins/1ting-source.plugin.v1.0.1.js) |
| 懒人听书 | 1.0.1 | [lrts-source.plugin.v1.0.1.js](plugins/lrts-source.plugin.v1.0.1.js) |
| 街声 | 1.0.0 | [streetvoice-source.plugin.v1.0.0.js](plugins/streetvoice-source.plugin.v1.0.0.js) |
| 火龙DJ | 1.0.2 | [huolongdj-source.plugin.v1.0.2.js](plugins/huolongdj-source.plugin.v1.0.2.js) |
| 快音 | 1.0.0 | [kuaiyin-source.plugin.v1.0.0.js](plugins/kuaiyin-source.plugin.v1.0.0.js) |
| 猫耳FM | 1.0.0 | [missevan-source.plugin.v1.0.0.js](plugins/missevan-source.plugin.v1.0.0.js) |
| DJ串烧集 | 1.0.0 | [djcsj-source.plugin.v1.0.0.js](plugins/djcsj-source.plugin.v1.0.0.js) |
| DJ秀 | 1.0.0 | [djshow.plugin.v1.0.0.js](plugins/djshow.plugin.v1.0.0.js) |
| Apple Music | 1.0.0 | [apple-music-v1.0.0.js](plugins/apple-music-v1.0.0.js) |
| 华为音乐 | 1.0.0 | [hwmusic-source.plugin.v1.0.0.js](plugins/hwmusic-source.plugin.v1.0.0.js) |
| 蜻蜓FM | 1.0.0 | [qingting-source.plugin.v1.0.0.js](plugins/qingting-source.plugin.v1.0.0.js) |
| 喜马拉雅 | 1.0.0 | [ximalaya-source.plugin.v1.0.0-r2.js](plugins/ximalaya-source.plugin.v1.0.0-r2.js) |
| 荔枝FM | 1.0.0 | [lizhi-source.plugin.v1.0.0.js](plugins/lizhi-source.plugin.v1.0.0.js) |

## 目录结构

- `plugins.json` — 订阅清单（结构对齐 musicfreepluginshub：`desc` + `plugins[]`，每项 `name/url/version`）
- `plugins-fastly.json` / `plugins-gcore.json` / `plugins-cdn.json` / `plugins-ghproxy.json` / `plugins-proxy-01..15.json` — 备用通道订阅清单（结构与 `plugins.json` 完全一致，仅插件 url 前缀不同）
- `scripts/sync-jihulab.sh` — jihulab 镜像手动同步脚本（token 走环境变量，不落盘）
- `.github/workflows/mirror-jihulab.yml` — main 推送后自动镜像到 jihulab（需 Secrets，未配置自动跳过）
- `plugins/` — 插件 js 直链文件，文件名含版本号；更新插件时新增带新版本号的文件，并在 `plugins.json` 中把该项 `url` 与 `version` 指向新文件

## 维护约定

- 新插件完成后：将 js 按命名规范放入 `plugins/`，在 `plugins.json` 追加一条（name/url/version 与插件内部声明一致）即可，订阅端自动生效
- 插件升级：保留旧版本文件（可选）或删除，`plugins.json` 中 url/version 更新到新文件
- 版本号以各插件 js 内部 `version` 字段为权威依据
| 网易云电台 | 1.0.0 | [neteaseradio-source.plugin.v1.0.0.js](plugins/neteaseradio-source.plugin.v1.0.0.js) |
| CCTV听音 | 1.0.0 | [cctv-source.plugin.v1.0.0.js](plugins/cctv-source.plugin.v1.0.0.js) |
| Jamendo | 1.0.1 | [jamendo-source.plugin.v1.0.1.js](plugins/jamendo-source.plugin.v1.0.1.js) |
