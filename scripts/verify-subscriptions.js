#!/usr/bin/env node
/**
 * 端到端校验分类订阅：逐个 url 真实下载，比对字节数与 sha256。
 * 用法：node scripts/verify-subscriptions.js [line ...]
 *   line 缺省为全部；只传 padao 可只测主线路。
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN_DIR = path.join(ROOT, "plugins");
const TIMEOUT = 20000;

function get(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith("https") ? https : http;
        const req = mod.get(
            url,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
                    "Cache-Control": "no-cache",
                },
                timeout: TIMEOUT,
            },
            (res) => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    res.resume();
                    if (redirects > 3) return reject(new Error("重定向过多"));
                    const next = new URL(res.headers.location, url).toString();
                    return resolve(get(next, redirects + 1));
                }
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () =>
                    resolve({ status: res.statusCode, body: Buffer.concat(chunks) })
                );
            }
        );
        req.on("timeout", () => req.destroy(new Error("超时")));
        req.on("error", reject);
    });
}

const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(
        Array.from({ length: n }, async () => {
            while (i < items.length) {
                const idx = i++;
                out[idx] = await fn(items[idx], idx);
            }
        })
    );
    return out;
}

async function main() {
    const lines = process.argv.slice(2);
    const subDir = path.join(ROOT, "sub");
    const lineDirs = lines.length ? lines : fs.readdirSync(subDir);
    let failTotal = 0;
    let okTotal = 0;

    for (const line of lineDirs) {
        const dir = path.join(subDir, line);
        if (!fs.existsSync(dir)) {
            console.log(`跳过 ${line}（无目录）`);
            continue;
        }
        for (const cat of ["main", "dj", "radio", "music", "all"]) {
            const file = path.join(dir, `${cat}.json`);
            if (!fs.existsSync(file)) continue;
            const sub = JSON.parse(fs.readFileSync(file, "utf8"));
            const t0 = Date.now();
            const results = await pool(sub.plugins, 6, async (p) => {
                const local = path.join(PLUGIN_DIR, p.url.split("/").pop());
                const localBuf = fs.existsSync(local) ? fs.readFileSync(local) : null;
                const s = Date.now();
                try {
                    const r = await get(p.url);
                    const ms = Date.now() - s;
                    const same = localBuf ? sha(r.body) === sha(localBuf) : null;
                    return {
                        name: p.name,
                        status: r.status,
                        bytes: r.body.length,
                        expect: localBuf ? localBuf.length : null,
                        same,
                        ms,
                        ok: r.status === 200 && (!localBuf || same),
                    };
                } catch (e) {
                    return { name: p.name, status: 0, bytes: 0, expect: localBuf ? localBuf.length : null, same: false, ms: Date.now() - s, ok: false, err: e.message };
                }
            });
            const bad = results.filter((r) => !r.ok);
            okTotal += results.length - bad.length;
            failTotal += bad.length;
            const maxMs = Math.max(...results.map((r) => r.ms));
            console.log(
                `\n[${line}/${cat}] ${sub.plugins.length} 条 · 通过 ${sub.plugins.length - bad.length} · 失败 ${bad.length} · 最慢 ${(maxMs / 1000).toFixed(1)}s · 总耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`
            );
            for (const b of bad) {
                console.log(
                    `   ✗ ${b.name} status=${b.status} bytes=${b.bytes}/${b.expect} ${b.err || (b.same === false ? "内容不一致" : "")}`
                );
            }
            if (!bad.length) {
                const slow = results.filter((r) => r.ms > 2000).length;
                console.log(
                    `   ✓ 全部一致（字节数与 sha256 均匹配）· 单条 >2s 的有 ${slow} 条`
                );
            }
        }
    }
    console.log(`\n合计：通过 ${okTotal}，失败 ${failTotal}`);
    if (failTotal) process.exitCode = 1;
}

main();
