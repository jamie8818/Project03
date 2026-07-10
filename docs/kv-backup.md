# 雲端存檔備份與回復（KV 快照）

worker 在每次主存檔寫入時，順手寫一把當天快照鍵（同一天內 30 分鐘最多一次），
**TTL 14 天自動過期**，不用手動清理。涵蓋三種資料：

| 主鍵 | 備份鍵格式 | 內容 |
|---|---|---|
| `progress:jj`／`progress:yaxuan` | `bk:progress:<user>:<YYYY-MM-DD>` | 個人學習進度（卡片/金幣/成就/布丁…） |
| `shop-decor` | `bk:shop-decor:<YYYY-MM-DD>` | 店鋪裝潢/庫存/招牌/客人台詞 |
| `shop-board` | `bk:shop-board:<YYYY-MM-DD>` | 伝言板留言 |

日期以台北時區為界；同日多次寫入時備份鍵會被較新的快照覆蓋（間隔 ≥30 分鐘），
所以「某天的備份」≈ 那天最後一次活動的狀態。

## 查看有哪些備份

```bash
npx wrangler kv key list --namespace-id baf70dd4d95945668215eca337089e1c | grep '"bk:'
```

## 回復某天的存檔（以 jj 的進度回到 7/9 為例）

```bash
NS=baf70dd4d95945668215eca337089e1c
# 1. 看一眼備份內容（確認是要的那份）
npx wrangler kv key get "bk:progress:jj:2026-07-09" --namespace-id $NS | head -c 300
# 2. 拷回正式鍵
npx wrangler kv key get "bk:progress:jj:2026-07-09" --namespace-id $NS > /tmp/restore.json
npx wrangler kv key put "progress:jj" --path /tmp/restore.json --namespace-id $NS
```

⚠️ 回復後注意：裝置上的 localStorage 若比回復的存檔**新**（updatedAt 較大），
開站時本機會贏、把雲端又蓋回去——要真正回到舊檔，裝置端也要清該站資料
（或改掉回復 JSON 裡的 `updatedAt` 成未來時間讓雲端贏，權宜作法）。

平常不用管這份文件；要回檔時跟引擎 session 說「回復到某天」即可。
