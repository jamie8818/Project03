# 日々喫茶 Shop · 引擎 session 交接（2026-07-09 第二輪更新）

> 給下一個「引擎 session」的單一入口。本輪引擎完成 review 10 findings **全數 10 條**（#1 走方案B：伝言板獨立 KV）＋E4 吧檯拆層接手＋§A manifest 切換。
> 聖經＝`docs/shop-v2-spec.md`；美術→引擎需求＝`docs/art-to-engine-requests.md`（E1–E4 全 ✅）；引擎→美術＝`docs/engine-to-art-requests.md`。
> **守備範圍：只碰 `src/`（不含 `src/data/cafe.gen.ts`）、`worker/index.js`、`vite.config.ts`、`tests/`、docs 兩份 requests。⛔ 別碰 `scripts/`、`assets_src/`、`public/cafe/`、`docs/cafe-catalog.json`、`cafe.gen.ts`（美術產）。**
> **JJ 已授權自主 commit**（驗過就 commit、不用問；只 stage 自己的檔、commit 前核一次沒夾美術檔——見 memory `commit-autonomously`）。

## 1. 目前狀態（交接當下）

- branch `nihongo-teaching-injection`、`tsc -b` 零錯、`npm test` **97/97**、`npm run build` 過、preview 對圖過。
- 本輪引擎 commits：`7725ab3` board.ts 三端合一（#6/#10/#7）／`3266f9c` #2/#3／`12b3598` #4/#5/#8/#9／`5e33acf` E4＋§A／finding #1 方案B（本檔 commit 之後）。
- 深度 review 10 條 findings：**全修完**（#1 方案B 見 §3）。⚠️ worker 有新端點，**要 `npx wrangler deploy` 才生效**（JJ 部署）。

## 2. 本輪引擎做了什麼（已驗證、已 commit）

- **#6/#10**：`mergeBoard` 抽 `src/lib/board.ts` 零依賴單一實作，shopstate／worker（wrangler esbuild bundle 直接 import TS）／vite devApi 三端共用；去重 key 的分隔符改反斜線 u0000 跳脫寫法，`shopstate.ts` 不再被 git 當 binary。shopstate re-export，測試與呼叫端沒動。
- **#7**：worker `/api/shop` 註解改實話（KV RMW 非原子，並發仍可能掉一方；治本要 Durable Object，兩人小站先不做）。
- **#2**：非裝潢模式 `.cafe-furn{pointer-events:none}`（家具透明框不再吃店長點擊）。
- **#3**：`.cafe-sign` 挪 `left:216`（店長 x102–198 右側吧檯面上，preview 對圖過）。
- **#4**：壁飾拆 `wallOrder` 畫在店長之前（後牆不蓋前景人物）。
- **#5**：伝言板捲底 effect 依賴改「最後一則的 at」（滿 50 後 length 恆定不再捲的 bug）。
- **#8**：`commitShop`（購買）比照 saveShop 撿回伺服器 board。
- **#9**：伝言板關閉改「pointerdown 起點在 overlay 才關」（選字拖出面板不再蒸發草稿）；順手 dg-msg key 去 index。
- **E4 吧檯拆層**：base 換 `base_nocounter.png`＋`.cafe-counter-body`（`counter_body.png`，恆亮背景層、店長前、不進 renderOrder）。新渲染路徑「內側小家電」＝`hostType:'counter-inside'` 的 surface 件拆 `insideOrder`，畫在店長之後、`counter_front` 之前，底錨 `COUNTER_INSIDE_Y=145`；放置只准吧檯格 row3、硬性排除 col4/5、不可上桌（有注入式單元測試）。`COUNTER_TOP` 簡化成純 row3 cols0–7。**球在美術**：補小家電家具＋catalog 標 `hostType` 即生效。
- **§A manifest 切換**：`isSurfaceHost` 改吃 `it.surface`（刪硬編 `SURFACE_HOSTS`；新家具 table_marble／cup_display_shelf／icecream_freezer 從「放不了小物」變可放）。`spriteH`：front 向直接 `spriteHeightTiles×CELL`（決定性）；**旋轉向 manifest 值不成立**（實測 table_square 右向 0.73 vs 1.47、pastry_case 右向 2.86 vs 2.11），保留 runtime aspect 快取 onLoad 校正。

## 3. finding #1 已修（方案B，JJ 2026-07-09 拍板）

**伝言板走獨立 KV key `shop-board`**：新端點 `GET/POST /api/shop/board`，前端 `sendBoard` 改 `pushBoard()` 只推留言、完全不帶 layout/sign——聊天不再蓋裝潢。相容遷移：worker 的 `POST /api/shop` 會把舊客戶端夾帶的 board 併進 `shop-board`（shop-decor 不再存 board）、`GET /api/shop` 回傳時聯集兩處，所以新舊前端混用也不掉留言。devApi 同步。裝潢模式本身的 LWW 互蓋維持原狀（原有範圍、頻率低，接受）。

10/10 findings 全數關閉。

## 4. 等美術的事

- **E4 內側小家電**：引擎管線已通（§2），等美術補家具＋`hostType:'counter-inside'` 旗標。引擎用結構型別讀該欄位，`cafe.gen.ts` 加欄位後引擎不用改（`shop.ts` 的 cast 可順手拿掉）。
- `col8`（吧檯右緣不滿格）維持不開放。

## 5. 旋鈕常數（現值）

Shop.tsx：`PANDA_CX=150`／`PANDA_TOP=50`／`PANDA_H=96`、`BANNER_H=200`、`TABLE_INSET=5`、`COUNTER_SURFACE_Y=124`、`COUNTER_INSIDE_Y=145`（E4 新）、`DRAG_THRESHOLD=6`、黑板鈕 inline `(243,12,70×50)`。
styles.css：`.dengon-send{right:8%;top:18%;width:27%}`、`bubble-cycle 5.6s`、`.cafe-sign{left:216;top:96}`（#3 已挪）。
shop.ts：`COUNTER_TOP`（純 row3 cols0–7）、`counterBlocked`（rows2–4 cols0–7，沒變）、`COUNTER_INSIDE_EXCLUDED_COLS={4,5}`、`isSurfaceHost`＝manifest `surface` 旗標。

## 6. 坑（實踩，先看省時間）

- **AI 助手寫「反斜線 u0000」字面量會變原始 NUL byte**（本輪實踩兩次：Write 檔案、git commit -m 都中招）——要寫這個跳脫序列時用 python 後處理或文字描述，寫完 `python3 -c "print(open(f,'rb').read().count(b'\x00'))"` 驗一次。
- **preview 隱藏分頁會凍結 CSS 動畫時鐘＋節流 interval**（`document.hidden=true` 時 animation currentTime 卡 0、setInterval 8s 可能一分鐘才跳）。驗動畫用 Web Animations API 手動撥 `currentTime`；驗換句用點擊觸發不要等 interval。
- **preview 的 eval 沙盒量到 0×0 佈局**（getBoundingClientRect 全 0）但截圖是真 viewport——程式測拖曳要 monkeypatch `getBoundingClientRect` 對 `.shop-stage` 回 `{left:0,top:0,width:576,height:416}`，try/finally 還原。DOM 序／computed style 查詢不受影響（本輪 #2/#4 就這樣驗的）。
- **React 18 程式化 dispatchEvent 的 state flush 是非同步**——preview 裡 dispatch 完立刻查 DOM 會讀到舊畫面，包 `setTimeout(…,200)` 再斷言（本輪 #9 驗證實踩）。
- **zsh 陷阱**：`$c:src/...` 會被當歷史修飾符 → 變數後接冒號要 `"${c}:src/..."`。
- **port**：5273 是美術 session 的 dev server（你停不掉）；引擎用 `.claude/launch.json` 的 `nihongo-engine`（5281, autoPort）。launch.json 不進版控。
- vite HMR 常殘留舊錯——hard reload／`npm run build` 為準。
- dev `/api/shop` 是記憶體假資料，重啟即清空；可直接 `fetch POST /api/shop` 塞測試 layout/sign/board（本輪就這樣 seed 的）。
- 進店要狀態：console 貼 `s=JSON.parse(localStorage['nng:state:jj']||'{}'); Object.assign(s,{user:'jj',lastDoneDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}),xp:1e5,coins:99999}); localStorage['nng:user']='jj'; localStorage['nng:state:jj']=JSON.stringify(s); localStorage['nng:shop-intro3']='1'; location.reload()`。
- 深度 review（2026-07-09、dfde109..HEAD）已做完且 10/10 已修——別重跑同範圍。
- 沒進榜可順手的小點還剩：泡泡夾店長肩膀（G4 cosmetic）、sent-toast 計時器換 `onAnimationEnd`、isRug 謂詞重複、黑板座標魔術數字提常數。

## 7. 協調慣例

- 美術↔引擎走兩份 requests 文件開 E 條目、做完標 ✅；跨 session 即時訊息用 session 管理工具（美術 session 名「日々喫茶 Shop art handoff」）。
- 兩 session 不並行改同一檔；接手前 `git diff` 看清楚。
- JJ 慣例：美術收尾先過 codex review 再定案（memory `cafe-art-codex-review`）；commit 訊息中文描述體。
- 模型分工（memory `model-strategy`）：Sonnet 主力執行＋Fable advisor；美術「生圖／看圖」委 codex。
