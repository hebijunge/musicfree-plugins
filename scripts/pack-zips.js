// 生成按类别打包的 zip（dl/mf-*.zip），供 MusicFree 本地导入使用
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN_DIR = path.join(ROOT, "plugins");
const DL_DIR = path.join(ROOT, "dl");
fs.mkdirSync(DL_DIR, { recursive: true });

const CATS = [
    ["main", "mf-common-6"],
    ["dj", "mf-dj"],
    ["radio", "mf-radio"],
    ["music", "mf-music"],
    ["all", "mf-all"],
];

const sub = JSON.parse(fs.readFileSync(path.join(ROOT, "sub", "githubio", "main.json"), "utf8"));

for (const [cat, name] of CATS) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, "sub", "githubio", `${cat}.json`), "utf8"));
    const files = json.plugins.map((p) => path.join(PLUGIN_DIR, p.url.split("/").pop()));
    const missing = files.filter((f) => !fs.existsSync(f));
    if (missing.length) throw new Error(`缺文件: ${missing.join(",")}`);

    const out = path.join(DL_DIR, `${name}.zip`);
    if (fs.existsSync(out)) fs.unlinkSync(out);

    const ps = [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path @(${files.map((f) => `'${f.replace(/'/g, "''")}'`).join(",")}) -DestinationPath '${out}' -CompressionLevel Optimal -Force`,
    ];
    execFileSync("powershell.exe", ps, { stdio: "pipe" });
    const size = fs.statSync(out).size;
    const raw = files.reduce((a, f) => a + fs.statSync(f).size, 0);
    console.log(
        `${name}.zip  ${json.plugins.length} 个插件  ${(size / 1048576).toFixed(2)} MB（原始 ${(raw / 1048576).toFixed(2)} MB，压缩到 ${((size / raw) * 100).toFixed(0)}%）`
    );
}

// 校验 zip 内条目数
for (const [, name] of CATS) {
    const out = path.join(DL_DIR, `${name}.zip`);
    const buf = fs.readFileSync(out);
    const entries = buf.toString("latin1").match(/\.js/g) || [];
    console.log(`校验 ${name}.zip：${entries.length} 个 .js 条目`);
}

// 生成插件体积索引（download.html 显示每行大小用）
const allJson = JSON.parse(fs.readFileSync(path.join(ROOT, "sub", "githubio", "all.json"), "utf8"));
const sizes = {};
for (const p of allJson.plugins) {
    const f = p.url.split("/").pop();
    sizes[f] = fs.statSync(path.join(PLUGIN_DIR, f)).size;
}
fs.writeFileSync(path.join(DL_DIR, "sizes.json"), JSON.stringify(sizes) + "\n");
console.log(`dl/sizes.json：${Object.keys(sizes).length} 条`);
