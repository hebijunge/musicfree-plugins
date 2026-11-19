#!/usr/bin/env node
/**
 * 自动生成 README 的插件清单表与分类统计。
 *
 * 数据源（全部来自仓库既有权威文件，不重复维护）：
 *   plugins.json            name/version/file
 *   sub/padao/*.json        分类归属（main/dj/radio/music/all）
 *   dl/sizes.json           各插件源文件字节数
 *
 * README 静态部分（订阅说明、线路实测、洛雪、目录、维护约定）作为模板保留，
 * 本脚本只替换「插件清单」与「分类/体积」两处动态区块。
 *
 * 用法：node scripts/gen-readme.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const README = path.join(ROOT, "README.md");

// ---- 读权威数据 ----
const plugins = JSON.parse(fs.readFileSync(path.join(ROOT, "plugins.json"), "utf8")).plugins;
const sizes = JSON.parse(fs.readFileSync(path.join(ROOT, "dl", "sizes.json"), "utf8"));
const CATS = ["main", "dj", "radio", "music", "all"];
const catData = {};
for (const c of CATS) {
  catData[c] = JSON.parse(fs.readFileSync(path.join(ROOT, "sub", "padao", c + ".json"), "utf8")).plugins;
}

// ---- 工具 ----
function bytesOf(p) {
  const f = p.url.split("/").pop();
  return sizes[f] || 0;
}
function mb(b) {
  return (b / 1048576).toFixed(2);
}
function fileOf(p) {
  return p.url.split("/").pop();
}
function nameOf(p) {
  return p.name;
}

// ---- 生成插件清单表 ----
function pluginTable() {
  const rows = plugins.map((p) => {
    const f = fileOf(p);
    return `| ${p.name} | ${p.version} | [${f}](plugins/${encodeURIComponent(f)}) |`;
  });
  return rows.join("\n");
}

// ---- 生成分类统计（用于 README 顶部表格） ----
function catStats() {
  const out = {};
  for (const c of CATS) {
    const list = catData[c];
    const b = list.reduce((s, p) => s + bytesOf(p), 0);
    out[c] = { count: list.length, mb: mb(b) };
  }
  return out;
}

// ---- 生成 README 动态区块 ----
const stats = catStats();
const main = catData.main.map(nameOf).join(" / ");
const radio = catData.radio.map(nameOf).join(" / ");
const music = catData.music.map(nameOf).join(" / ");

const dynPlugins = `<!-- README:plugins-table -->
| 插件 | 版本 | 文件 |
|---|---|---|
${pluginTable()}
<!-- /README:plugins-table -->`;

const dynCats = `<!-- README:cat-stats -->
| 类别 | 条目 | 体积 | 订阅地址 |
|---|---|---|---|
| ① 常用六平台 | ${stats.main.count} | ${stats.main.mb} MB | \`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/main.json\` |
| ② DJ / 舞曲 / 电音 | ${stats.dj.count} | ${stats.dj.mb} MB | \`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/dj.json\` |
| ③ 听书 / 电台 / 播客 | ${stats.radio.count} | ${stats.radio.mb} MB | \`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/radio.json\` |
| ④ 其它音乐平台 | ${stats.music.count} | ${stats.music.mb} MB | \`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/music.json\` |
| ⑤ 全部插件 | ${stats.all.count} | ${stats.all.mb} MB | \`https://gh.padao.fun/https://raw.githubusercontent.com/hebijunge/musicfree-plugins/master/sub/padao/all.json\` |
<!-- /README:cat-stats -->`;

const dynDesc = `<!-- README:cat-desc -->
- ① 常用六平台 = ${main}
- ③ 听书 / 电台 / 播客 = ${radio}
- ④ 其它音乐平台 = ${music}
<!-- /README:cat-desc -->`;

// ---- 写回 README（用锚点替换，静态部分不动） ----
function replaceBlock(src, startMark, endMark, block) {
  const s = src.indexOf(startMark);
  const e = src.indexOf(endMark);
  if (s < 0 || e < 0) return src;
  return src.slice(0, s) + block + src.slice(e + endMark.length);
}

let readme = fs.readFileSync(README, "utf8");
const had = {
  plugins: readme.indexOf("<!-- README:plugins-table -->") >= 0,
  cats: readme.indexOf("<!-- README:cat-stats -->") >= 0,
  desc: readme.indexOf("<!-- README:cat-desc -->") >= 0,
};
if (!had.plugins || !had.cats || !had.desc) {
  console.error("README 缺少动态区块锚点，请先确保 README 含注释标记。had=", had);
  process.exit(1);
}
readme = replaceBlock(readme, "<!-- README:plugins-table -->", "<!-- /README:plugins-table -->", dynPlugins);
readme = replaceBlock(readme, "<!-- README:cat-stats -->", "<!-- /README:cat-stats -->", dynCats);
readme = replaceBlock(readme, "<!-- README:cat-desc -->", "<!-- /README:cat-desc -->", dynDesc);
fs.writeFileSync(README, readme, "utf8");

console.log("README 已更新：插件", plugins.length, "个；分类 main/dj/radio/music/all =",
  stats.main.count, stats.dj.count, stats.radio.count, stats.music.count, stats.all.count);
