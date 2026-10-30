const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOKEN = process.env.GH_TOKEN;
const OWNER = "hebijunge";
const REPO = "musicfree-plugins";
const BRANCH = "master";
const ROOT = process.env.REPO_DIR;

function api(method, urlPath, body, timeout = 180000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const req = https.request(
            {
                hostname: "api.github.com",
                path: urlPath,
                method,
                headers: {
                    Authorization: `token ${TOKEN}`,
                    "User-Agent": "wb-push",
                    Accept: "application/vnd.github+json",
                    ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
                },
                timeout,
            },
            (res) => {
                let buf = "";
                res.on("data", (c) => (buf += c));
                res.on("end", () => {
                    let parsed;
                    try {
                        parsed = buf ? JSON.parse(buf) : {};
                    } catch {
                        parsed = { raw: buf };
                    }
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
                    else reject(new Error(`${method} ${urlPath} -> ${res.statusCode} ${buf.slice(0, 200)}`));
                });
            }
        );
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.on("error", reject);
        if (data) req.write(data);
        req.end();
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, label, n = 4) {
    for (let i = 1; i <= n; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === n) throw e;
            console.log(`  重试 ${label} (${i}/${n - 1}): ${e.message.slice(0, 70)}`);
            await sleep(1500 * i);
        }
    }
}

(async () => {
    const msg = execSync("git log -1 --pretty=%Bc", { cwd: ROOT }).toString().trim();
    const ref = await retry(() => api("GET", `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`), "get ref");
    const base = ref.object.sha;
    const baseCommit = await api("GET", `/repos/${OWNER}/${REPO}/git/commits/${base}`);
    const changed = execSync("git diff --name-only HEAD~1 HEAD", { cwd: ROOT }).toString().trim().split("\n").filter(Boolean);
    console.log("base:", base.slice(0, 7), "| 文件:", changed.length, "个");

    const tree = [];
    for (const f of changed) {
        const buf = fs.readFileSync(path.join(ROOT, f));
        const t0 = Date.now();
        const blob = await retry(
            () => api("POST", `/repos/${OWNER}/${REPO}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" }),
            f
        );
        tree.push({ path: f, mode: "100644", type: "blob", sha: blob.sha });
        console.log(`  ${f} ${(buf.length / 1024).toFixed(0)}KB ${Date.now() - t0}ms`);
    }

    const newTree = await retry(() => api("POST", `/repos/${OWNER}/${REPO}/git/trees`, { base_tree: baseCommit.tree.sha, tree }), "tree");
    const commit = await retry(
        () => api("POST", `/repos/${OWNER}/${REPO}/git/commits`, { message: msg, tree: newTree.sha, parents: [base] }),
        "commit"
    );
    await retry(() => api("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false }), "ref");
    console.log("✅ 已推送", commit.sha);
})().catch((e) => {
    console.error("失败:", e.message);
    process.exit(1);
});
