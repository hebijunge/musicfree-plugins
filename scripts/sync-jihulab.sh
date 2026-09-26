#!/usr/bin/env bash
# 将本仓库 main 镜像推送到 jihulab（GitLab 国内镜像），作为 jsdelivr 之外的第二兜底通道。
#
# 前置（一次性，二选一）：
#   A. 手动：在 jihulab.com 网页上新建空项目（如 <你的命名空间>/musicfree-plugins），然后运行本脚本。
#   B. 全自动：改用 .github/workflows/mirror-jihulab.yml（需在 GitHub 仓库 Secrets 配置 JIHULAB_TOKEN / JIHULAB_PATH）。
#
# 用法（在仓库本地克隆目录内执行）：
#   JITOKEN='<jihulab Personal Access Token，需 write_repository 权限>' \
#   JIPATH='<命名空间>/<项目路径>' \
#   ./scripts/sync-jihulab.sh
#
# 安全约定：token 只经环境变量传入，不写入任何文件；脚本不打印 token。
set -euo pipefail

: "${JITOKEN:?缺少 JITOKEN 环境变量（jihulab PAT，write_repository 权限）}"
: "${JIPATH:?缺少 JIPATH 环境变量（形如 yourname/musicfree-plugins）}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
REMOTE="https://oauth2:${JITOKEN}@jihulab.com/${JIPATH}.git"

echo "推送 ${BRANCH} -> jihulab:${JIPATH} ..."
if git push --force "$REMOTE" "$BRANCH:main"; then
  echo "推送完成。jihulab 侧订阅清单地址（raw 直取）："
  echo "  https://jihulab.com/${JIPATH}/-/raw/main/plugins.json"
else
  echo "推送失败：请检查 JIPATH 是否存在、token 是否有 write_repository 权限。" >&2
  exit 1
fi
