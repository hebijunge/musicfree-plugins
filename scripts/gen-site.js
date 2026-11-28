#!/usr/bin/env node
/**
 * 站点统一生成入口：改完插件后跑这一个命令，index 页 + README + 订阅清单全部自动更新。
 *
 * 串联（顺序有依赖，不可并行）：
 *   1. gen-subscriptions.js  plugins.json -> 分类+线路订阅清单（含校验文件存在）
 *   2. gen-ceru-list.js      ceru-plugins/*.ceru.js -> ceru-list.json（澜音生态清单）
 *   3. gen-baka-list.js      baka-plugins/*.js -> baka-list.json（Baka V2 清单）
 *   4. gen-mf-cats.js        源码仓 plugins/*.js -> mf-cats.json（MusicFree 分类，需本地源码仓；
 *                            无源码仓时自动跳过，不阻断流水线）
 *   5. gen-readme.js         plugins.json + sub/padao + dl/sizes.json -> README.md 动态区块
 *   6. gen-sizes.js          plugins/ -> dl/sizes.json（保证 README/download 体积数准确）
 *
 * 用法：node scripts/gen-site.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = path.join(__dirname);

function run(file) {
  // 脚本缺失时跳过而不是中断：Actions 只会拿到公开仓的文件，本地专有脚本可不在其中。
  const p = path.join(SCRIPTS, file);
  if (!fs.existsSync(p)) {
    console.log("⚠ 跳过 " + file + "（文件不存在）");
    return;
  }
  console.log("▶ " + file);
  execFileSync(process.execPath, [p], { cwd: ROOT, stdio: "inherit" });
}

function main() {
  // 1-3. 顺序生成（subscriptions 先跑，生成 sub/ 供 sizes/readme 读取）
  run("gen-subscriptions.js");
  run("gen-ceru-list.js");
  run("gen-baka-list.js");
  // MusicFree 分类（依赖本地源码仓，缺失时脚本自行跳过）
  run("gen-mf-cats.js");
  // 5. 体积同步（gen-readme 依赖 sizes.json，故 sizes 在 readme 前）
  run("gen-sizes.js");
  run("gen-readme.js");

  // 4. 汇总校验：index.html 引用的 ceru-list.json 与 plugins.json 是否与产物一致
  const ceru = JSON.parse(fs.readFileSync(path.join(ROOT, "ceru-list.json"), "utf8"));
  const baka = JSON.parse(fs.readFileSync(path.join(ROOT, "baka-list.json"), "utf8"));
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, "plugins.json"), "utf8"));
  let mfCat = "无（未提交 mf-cats.json）";
  try {
    const c = JSON.parse(fs.readFileSync(path.join(ROOT, "mf-cats.json"), "utf8"));
    const by = {};
    for (const p of c.plugins) by[p.category] = (by[p.category] || 0) + 1;
    mfCat = JSON.stringify(by);
  } catch (e) {}
  console.log("\n✅ gen-site 完成：");
  console.log("   MusicFree 插件:", mf.plugins.length, "个");
  console.log("   澜音 Ceru 插件:", ceru.count, "个");
  console.log("   Baka V2 Provider:", baka.count, "个");
  console.log("   MusicFree 分类:", mfCat);
}

main();
