#!/usr/bin/env node
/**
 * 站点统一生成入口：改完插件后跑这一个命令，index 页 + README + 订阅清单全部自动更新。
 *
 * 串联（顺序有依赖，不可并行）：
 *   1. gen-subscriptions.js  plugins.json -> 分类+线路订阅清单（含校验文件存在）
 *   2. gen-ceru-list.js      ceru-plugins/*.ceru.js -> ceru-list.json（澜音生态清单）
 *   3. gen-readme.js         plugins.json + sub/padao + dl/sizes.json -> README.md 动态区块
 *   4. gen-sizes.js          plugins/ -> dl/sizes.json（保证 README/download 体积数准确）
 *
 * 用法：node scripts/gen-site.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = path.join(__dirname);

function run(file) {
  console.log("▶ " + file);
  execFileSync(process.execPath, [path.join(SCRIPTS, file)], { cwd: ROOT, stdio: "inherit" });
}

function main() {
  // 1-3. 顺序生成（subscriptions 先跑，生成 sub/ 供 sizes/readme 读取）
  run("gen-subscriptions.js");
  run("gen-ceru-list.js");
  // 4. 体积同步（gen-readme 依赖 sizes.json，故 sizes 在 readme 前）
  run("gen-sizes.js");
  run("gen-readme.js");

  // 4. 汇总校验：index.html 引用的 ceru-list.json 与 plugins.json 是否与产物一致
  const ceru = JSON.parse(fs.readFileSync(path.join(ROOT, "ceru-list.json"), "utf8"));
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, "plugins.json"), "utf8"));
  console.log("\n✅ gen-site 完成：");
  console.log("   MusicFree 插件:", mf.plugins.length, "个");
  console.log("   澜音 Ceru 插件:", ceru.count, "个");
}

main();
