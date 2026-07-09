#!/bin/zsh
# 日々日文一鍵部署：測試 → 建置 → 上 Cloudflare
cd "$(dirname "$0")"
set -e
npm test
npm run deploy
echo "✅ 部署完成"
