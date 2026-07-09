# 日々日文（nihongo）

JJ × 亞軒的每日 20 分鐘日文學習 PWA。會話導向＋歌詞切入，目標 2026/12 N5 → 2027/7 N4。

## 結構

- `src/data/kana.ts` — 五十音資料（46 基礎＋25 濁音/半濁音 × 平/片假名）＋易混淆組
- `src/data/phrases.ts` — 今日一句（會話＋歌詞常見句）
- `src/data/dialogs.ts` — 場景對話包（P1：自介/寒暄/聊音樂/網聊/點餐/約見面）
- `src/data/vocab.ts` — N5 核心單字牌組（P3：五十音學完自動接續，每日 5 新字）
- `src/data/grammar.ts` — N5 文法點清單（P3：教材庫瀏覽）
- `public/data/songs/` — 歌詞 JSON（P2：振假名＋單字表；範例〈故郷〉）
- `scripts/annotate-lyrics.mjs` — 歌詞管線（kuromoji 斷詞標讀音）
- `src/lib/srs.ts` — 簡化 SM-2 間隔重複（會/不會兩檔）
- `src/lib/session.ts` — 每日組卷：到期複習 → 新字教學 → 混合測驗 → 今日一句
- `src/lib/goal.ts` — 目標曲線（N5 120h / N4 320h，線性配速）
- `src/lib/store.ts` — localStorage 為主＋Worker KV 同步（updatedAt 新的贏）
- `worker/index.js` — Cloudflare Worker：密碼閘門＋KV 進度 API＋靜態前端
- `tests/` — SRS/組卷/目標曲線單元測試（`npm test`，Node 24 原生跑 TS）

## 常用指令

```bash
npm run dev      # 本機開發（http://localhost:5193，/api 走記憶體 mock）
npm test         # 單元測試
npm run build    # 型別檢查＋建置（含 PWA service worker）
npm run deploy   # 建置＋部署 Worker
```

## 首次部署（已做過就跳過）

```bash
npx wrangler kv namespace create PROGRESS   # id 填進 wrangler.toml（已填）
npx wrangler secret put APP_PASSWORD        # 進站金鑰（不用記，含在專屬連結 ?k=… 裡）
npm run deploy
```

分享用專屬連結格式：`https://<worker網址>/?k=<金鑰>`。開過一次金鑰就存進
localStorage，之後直接開站即可；換金鑰＝重設 secret 後發新連結。

## 設計要點／已知坑

- **身分**：專屬連結進站後選「JJ / 亞軒」，記在 localStorage；每人假設單一設備，
  同步採 last-write-wins（舊 updatedAt 的 push 會被 Worker 以 409 拒絕）。
- **iOS PWA**：加入主畫面後才有全螢幕；**刪掉圖示＝刪掉 localStorage 進度**，
  但進度有 KV 備份，重裝後選同一個人會自動拉回來。更新 App 只要重開即可。
- **TTS**：Web Speech API（iOS 用 Kyoko）。iOS 一定要使用者手勢觸發，
  所以發音都包在 🔊 按鈕裡，不能自動播。
- **五十音表精熟上色**：間隔 ≥14 天才算精熟。初始勾「已熟」的字系是種下
  ivl=10 的種子卡，輪過一次複習答對就會跳精熟——所以第一天顯示 0/71 是正常的。
- **每日一輪流程**：到期複習（上限 30）→ 新字 5 個（複習 >20 張時暫停加新字）
  → 混合測驗 10 題（弱的優先；聽音題已排除 じ/ぢ、ず/づ 同音干擾）→ 今日一句。
- **時數防灌水**：單步發呆超過 90 秒不計入累計時數。

## 加自己喜歡的歌

**主要方式（App 內）**：教材庫 → 歌 → 「＋加一首你們的歌」→ 輸歌名自動抓歌詞
（Utaten，抓不到就手動貼）→「做成教材」→ Worker 叫 Claude API 標振假名＋翻譯＋抽單字 → 上架 KV。
需要 secret：`npx wrangler secret put ANTHROPIC_API_KEY`（模型在 wrangler.toml 的 MODEL）。
Utaten 若改版，`worker/index.js` 的 searchUtaten/fetchLyricsByTitle 要跟著修（uta-net 全站防爬、j-lyric 已死，別浪費時間）。

**備用方式（本機管線）**：
```bash
npm run song -- 歌詞.txt --id lemon --title "Lemon" --artist "米津玄師"
# 補 public/data/songs/lemon.json 的中文欄位 → npm run deploy
```

## 分期狀態

- ✅ P0 五十音道場＋每日組卷＋雙人同步＋目標曲線
- ✅ P1 會話模組（6 場景、逐句 TTS、連播、羅馬音開關）
- ✅ P2 歌詞模式（振假名渲染、單字一鍵進 SRS 牌組、kuromoji 管線）
- ✅ P3 檢定軌（N5 單字 209 個自動接續、詞義測驗、文法 32 點）
- 未來想做：N4 牌組擴充、聽力題、模擬試題卷
