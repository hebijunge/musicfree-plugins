// 仅重算 dl/sizes.json（各插件源文件字节数），不打包 zip。
// 供 gen-site 在 MF 插件更新后同步体积，避免 README/download 体积数过期。
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN_DIR = path.join(ROOT, "plugins");
const DL_DIR = path.join(ROOT, "dl");

const all = JSON.parse(fs.readFileSync(path.join(ROOT, "sub", "githubio", "all.json"), "utf8"));
const sizes = {};
for (const p of all.plugins) {
  const f = p.url.split("/").pop();
  const fp = path.join(PLUGIN_DIR, f);
  if (!fs.existsSync(fp)) throw new Error("缺插件文件: " + f);
  sizes[f] = fs.statSync(fp).size;
}
fs.mkdirSync(DL_DIR, { recursive: true });
fs.writeFileSync(path.join(DL_DIR, "sizes.json"), JSON.stringify(sizes) + "\n");
console.log("dl/sizes.json：" + Object.keys(sizes).length + " 条");
