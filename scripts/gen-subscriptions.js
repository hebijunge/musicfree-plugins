#!/usr/bin/env node
/**
 * 生成 MusicFree 订阅清单（按类别 + 按线路）。
 *
 * 输出：
 *   sub/<line>/<cat>.json   分类订阅（main / dj / radio / music / all）
 *   plugins*.json           根目录历史通道清单（保持文件名不变，内容重排到实测可用线路）
 *
 * 用法：node scripts/gen-subscriptions.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW = "https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master";

// 线路池：2026-10-30 实测（本机直连，单文件 qq-source 643KB，超时 12s）
// ms 为实测耗时，仅用于排序；raw=true 表示需要通过 raw.githubusercontent 前缀转发
const LINES = [
    { id: "padao", base: "https://gh.padao.fun/", raw: true, ms: 1964, note: "最快" },
    { id: "mxw", base: "https://down.mxw.xx.kg/", raw: true, ms: 3032, note: "快" },
    { id: "30006000", base: "https://30006000.xyz/", raw: true, ms: 3569, note: "" },
    { id: "wgetla", base: "https://wget.la/", raw: true, ms: 3694, note: "" },
    { id: "fastly", base: "https://fastly.jsdelivr.net/gh/hebijunge/musicfree-plugins@master", raw: false, ms: 3731, note: "jsDelivr 稳定节点" },
    { id: "cnxiaobai", base: "https://github.cnxiaobai.com/", raw: true, ms: 3817, note: "" },
    { id: "akaere", base: "https://cdn.akaere.online/", raw: true, ms: 3959, note: "" },
    { id: "xsadwsd", base: "https://xsadwsd.kdns.fr/", raw: true, ms: 4303, note: "" },
    { id: "hwinz", base: "https://ghpxy.hwinzniej.top/", raw: true, ms: 4477, note: "" },
    { id: "acmsz", base: "https://gh.acmsz.top/", raw: true, ms: 5120, note: "" },
    { id: "g053000", base: "https://ghproxy.053000.xyz/", raw: true, ms: 5222, note: "" },
    { id: "gcore", base: "https://gcore.jsdelivr.net/gh/hebijunge/musicfree-plugins@master", raw: false, ms: 5624, note: "" },
    { id: "yylx", base: "https://git.yylx.win/", raw: true, ms: 5846, note: "" },
    { id: "githubio", base: "https://hebijunge.github.io/musicfree-plugins", raw: false, ms: 6746, note: "官方直出" },
];

// 已淘汰线路（实测不可用），仅用于记录，不再生成订阅
const DEAD = [
    { id: "cdn", base: "https://cdn.jsdelivr.net/gh/hebijunge/musicfree-plugins@master", reason: "连不通" },
    { id: "ghproxy.net", base: "https://ghproxy.net/", reason: "连不通" },
    { id: "gh.927223.xyz", base: "https://gh.927223.xyz/", reason: "连不通" },
    { id: "gh.halonice.com", base: "https://gh.halonice.com/", reason: "连不通" },
    { id: "js.jiangss.shop", base: "https://js.jiangss.shop/", reason: "连不通" },
    { id: "gh-proxy.com", base: "https://gh-proxy.com/", reason: "内容截断" },
    { id: "ghm.078465.xyz", base: "https://ghm.078465.xyz/", reason: "内容截断" },
    { id: "gh.felicity.ac.cn", base: "https://gh.felicity.ac.cn/", reason: "429 限流" },
    { id: "gh.idayer.com", base: "https://gh.idayer.com/", reason: "429 限流" },
    { id: "github.xxlab.tech", base: "https://github.xxlab.tech/", reason: "302 跳转异常" },
];

const CATS = {
    main: {
        label: "常用六平台",
        desc: "QQ音乐 / 酷我 / 酷狗 / 咪咕 / 网易云 / 汽水（推荐只装这一份）",
        keys: ["qq", "kuwo", "kugou", "migu", "netease", "qishui"],
    },
    dj: {
        label: "DJ / 舞曲 / 电音",
        desc: "DJ 站与电音站合集",
        keys: [], // 未显式归类的都进这里
    },
    radio: {
        label: "听书 / 电台 / 播客",
        desc: "有声书、FM、播客",
        keys: ["fanqie", "lrts", "bokantingshu", "missevan", "qingting", "ximalaya", "lizhi", "neteaseradio", "cctv", "xiangsheng-pingshu"],
    },
    music: {
        label: "其它音乐平台",
        desc: "B站、5sing、千千、Apple Music、华为、JOOX 等",
        keys: ["bilibili", "5sing", "qianqian", "1ting", "streetvoice", "apple-music", "hwmusic", "jamendo", "agg", "joox", "htqyy"],
    },
};

const FILE_RE = /\.plugin\.v[\d.]+\.js$|\.js$/;

function keyOf(url) {
    const base = url.split("/").pop();
    return base
        .replace(FILE_RE, "")
        .replace(/\.plugin$/, "")
        .replace(/-v\d+(\.\d+)*$/, "")
        .replace(/-source$/, "");
}

function fileOf(url) {
    return url.split("/").pop();
}

function buildUrl(line, file) {
    const tail = `/plugins/${file}`;
    if (line.raw) return `${line.base}${RAW}${tail}`;
    // githubio 的 base 不带结尾斜杠
    return `${line.base.replace(/\/$/, "")}${tail}`;
}

function main() {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "plugins.json"), "utf8"));
    if (!Array.isArray(manifest.plugins) || !manifest.plugins.length) {
        throw new Error("plugins.json 结构异常");
    }

    // 校验插件文件都在
    const pluginDir = path.join(ROOT, "plugins");
    const exist = new Set(fs.readdirSync(pluginDir));
    const missing = manifest.plugins.filter((p) => !exist.has(fileOf(p.url)));
    if (missing.length) {
        throw new Error("清单引用了不存在的插件文件：" + missing.map((m) => fileOf(m.url)).join(", "));
    }

    // 按 key 归组
    const byKey = new Map();
    for (const p of manifest.plugins) byKey.set(keyOf(p.url), p);

    const groups = {};
    const claimed = new Set();
    for (const [cat, cfg] of Object.entries(CATS)) {
        groups[cat] = [];
        for (const k of cfg.keys) {
            const item = byKey.get(k);
            if (!item) throw new Error(`分类 ${cat} 找不到 key=${k}`);
            groups[cat].push(item);
            claimed.add(k);
        }
    }
    // 未归类的进 dj
    for (const [k, item] of byKey) {
        if (!claimed.has(k)) groups.dj.push(item);
    }

    // 全部
    groups.all = manifest.plugins.slice();

    const summary = {};

    // ---- 1. 分类订阅 × 3 条线路 ----
    const SUB_LINES = LINES.filter((l) => ["padao", "fastly", "githubio"].includes(l.id));
    for (const line of SUB_LINES) {
        const dir = path.join(ROOT, "sub", line.id);
        fs.mkdirSync(dir, { recursive: true });
        for (const [cat, items] of Object.entries(groups)) {
            const cfg = CATS[cat];
            const out = {
                desc: cat === "all" ? `全部插件 ${items.length} 个` : `${cfg.label} · ${cfg.desc}`,
                plugins: items.map((p) => ({
                    name: p.name,
                    url: buildUrl(line, fileOf(p.url)),
                    version: p.version,
                })),
            };
            fs.writeFileSync(path.join(dir, `${cat}.json`), JSON.stringify(out, null, 4) + "\n");
        }
        summary[line.id] = Object.fromEntries(Object.entries(groups).map(([c, v]) => [c, v.length]));
    }

    // ---- 2. 根目录历史通道重排到可用线路 ----
    const legacy = [
        ["plugins.json", "githubio"],
        ["plugins-cdn.json", "fastly"],
        ["plugins-fastly.json", "fastly"],
        ["plugins-gcore.json", "gcore"],
        ["plugins-ghproxy.json", "padao"],
    ];
    for (let i = 1; i <= 20; i++) {
        const line = LINES[(i - 1) % LINES.length];
        legacy.push([`plugins-proxy-${String(i).padStart(2, "0")}.json`, line.id]);
    }
    const lineById = new Map(LINES.map((l) => [l.id, l]));
    for (const [file, lineId] of legacy) {
        const line = lineById.get(lineId);
        const out = {
            desc: `全部插件 ${manifest.plugins.length} 个 · 线路 ${lineId}（实测 ${(line.ms / 1000).toFixed(1)}s）`,
            plugins: manifest.plugins.map((p) => ({
                name: p.name,
                url: buildUrl(line, fileOf(p.url)),
                version: p.version,
            })),
        };
        fs.writeFileSync(path.join(ROOT, file), JSON.stringify(out, null, 4) + "\n");
    }

    // ---- 3. 汇总 ----
    console.log("分类条目数：");
    for (const [cat, items] of Object.entries(groups)) {
        const label = cat === "all" ? "全部" : CATS[cat].label;
        const mb = (items.reduce((a, p) => a + fs.statSync(path.join(pluginDir, fileOf(p.url))).size, 0) / 1048576).toFixed(2);
        console.log(`  ${cat.padEnd(6)} ${label.padEnd(16)} ${String(items.length).padStart(2)} 个  ${mb} MB`);
    }
    console.log("分类订阅线路：", SUB_LINES.map((l) => l.id).join(", "));
    console.log("根目录通道重排：", legacy.length, "个文件");
}

main();
