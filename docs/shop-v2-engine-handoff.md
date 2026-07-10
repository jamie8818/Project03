# 日々喫茶／日文站 · 引擎 session 交接

**➡️ 新 session 從 §0（2026-07-10 大輪總結）開始讀，蓋過下方 07-09 的內容（僅坑清單 §6 仍然全部有效）。**

## §0 ⚠️ 2026-07-10 引擎大輪總結（單一 session 三十多個 commit，讀這節就夠）

### 0.1 目前狀態
- branch `nihongo-teaching-injection`、HEAD `f479a85`、`tsc -b` 零錯、`npm test` **119/119**、`npm run build` 過。
- **commit 後必雙推**：`git push origin nihongo-teaching-injection && git push mirror nihongo-teaching-injection`（iCloud 事故守則）。
- 美術 session 會**直接 commit 進共用 repo**（不再走「worker 交清單」），開工前先 `git pull`＋`git log` 看有沒有插隊 commit；他們的 dev server 在 port 5273，引擎用 `.claude/launch.json` 的 `nihongo-engine`（5281）。
- **JJ 會即時在 preview 視窗裡玩**（dev /api/shop 記憶體假資料會被他改），驗證時 seed 前先想一下會不會蓋掉他正在看的東西。

### 0.2 本輪完成（依主題）
**學習機制**：五十音配速 `KANA_NEW_CAP=10`＋「再來一份」改繼續滴漏下一批（12f3d0d）；**人生首輪超迷你 `FIRST_RUN_CAP=3`**＝只教あいう、完成即回正常配速（f479a85）；目標卡改課數制＋可改目標（N5/N4＋日期，40c1ce4）＋五十音先修 ETA（1bd41af）；背單字 VocabCram（首頁入口、挑分類 10 個＋小考）金幣 ×1.5 上限 45/日（4cb5581）。
**經濟**：打工營業額 ÷5 入金幣（baca009）；每日完課 +50／對決 +15／小遊戲 +10（b535464）；店長私房錢 350（首次進店引導發、state 旗標 `introGiftClaimed` 防重複）。
**存檔**：切背景/關頁 sendBeacon 即刻推送堵 1.5s debounce 視窗（4b1eb87）；**KV 快照備份** `bk:<key>:<日期>`、30 分節流、TTL 14 天，回復手順見 `docs/kv-backup.md`（21cb078，worker 改）。線上 prod KV 目前是**空的**（查證過），正式開玩前裝置端 localStorage 記得清。
**喫茶店（美術需求 E5–E19 全接完，完成註記都回填在 `art-to-engine-requests.md` 各節）**：E5 台詞 SHOP_LINES_GEN／E6 分頁籤／E7 counter-inside 加法＋嵌入⇄檯面切換（`PlacedItem.top`）／E8修訂 門口食品サンプル展示櫃／E9 Q版客人（116px、腳底 y=215 吧檯前、深度排序 baseline、眨眼、E14 自訂台詞 `ShopState.guestLines`＋worker 按鍵合併）／E10 前牆掛件（虛擬列 `FRONT_WALL_ROW=12`）／E11 counterTop 檯面權／E12 珍藏轉蛋機（80 金幣、動態不重複池、完売鎖機）／E13 flavor 四處顯示／E15+E18 粉圓貓（4 點位 10 分鐘輪換、呼吸/B幀/摸頭）／E17 布丁百味（100 款+UR+variant 圖）／E16 成就 Tier A 17 條＋Tier B 9 條（`UserState.meta` 計數袋）。
**E19 好感度**：`src/lib/cat.ts` 純函式（賭氣→連摸→冷卻→擲骰），存 `UserState.catAffection`。
**裝潢 UX**：收回模式（點什麼收什麼＋全部清空＋復原 undoStack）；出餐托盤溢出修（minmax(0,1fr)）；出餐 TTS 改唸 kana（臭豆腐誤讀）。
**直覺式導引（1ddb3c2 起）**：分頁漸進解鎖（完成 1 輪開進度+五十音、2 輪開對戰場+教材庫，`tabUnlocked`）＋coach mark 系統（`src/components/Coach.tsx`，全域單顆、localStorage 旗標、鏈＝開始→進度→店橫幅→商店→分類都能逛→珍藏用轉蛋→裝潢→黑板）＋裝潢幽靈手示範（含說明標籤）＋文字減量（onboarding 導覽砍除、店長引導 5→1 句）。像素鎖/指示手素材在 `public/cafe/ui/`。

### 0.3 未完/待辦
1. **夜市出餐難度分級（唯一沒做完的已討論項）**：JJ 拍板「一開始純單品，2 份/複數種隨課程進度慢慢加」。規格調查做完：`buildOrder`（`src/data/serving.ts`）現在從第一場就 12% 三品/30% 雙品；課綱「と/も」在 **L16** 教。建議：`buildOrder` 加 progress 參數（`courseProgress(state).done`），L16 前全單品、L16 後開雙品、再往後開三品——具體門檻 JJ 沒定案，實作前跟他確認。
2. **JJ 覆核清單**（照單先做、改常數即生效）：①粉圓好感起始亞軒 15/JJ 5（`lib/cat.ts AFFECTION_START`）②貓奴認證綁好感 100 ③首輪 3 假名（`FIRST_RUN_CAP`）。
3. E9 可選加分②連續天數徽章（streak≥7 ☕/≥30 👑）JJ 沒挑；E16 Tier C 兩條（已讀不回/過馬路請牽手）可延後。
4. **徽章像素化**：`public/cafe/badges/` 40 枚已到貨，成就 icon 目前仍是 emoji——確認是否要換 img 渲染（xp.ts Achievement.icon＋Dashboard 徽章牆），美術單 E16 說「素材到貨前 emoji 頂著不互卡」。
5. **部署**：worker 有兩處後端改動（E14 guestLines 合併＋KV 快照備份）→ 下次部署必須 `npx wrangler deploy`。部署由美術監工統一執行，引擎不動手。

### 0.4 本輪新增的坑（舊坑見 §6，全部仍有效）
- **合成 pointer 事件**：`setPointerCapture` 對假 pointerId 會 throw（Stage 已包 try/catch；測 serve3 要先 monkeypatch `Element.prototype.setPointerCapture`）；pointerdown/up 同 tick dispatch 會讀到舊 state（React 18 非同步 flush）→ down/up 之間隔 200ms。
- **coach mark 全域佔位**：dismiss 必須釋放 `active`（Coach.tsx 已修）；同畫面兩顆 coach 接棒要把 dismiss 綁在會觸發 re-render 的 setState 上。
- **測試裡 fresh initState 會撞首輪 cap**：`sessionsDone=0` ＝ FIRST_RUN_CAP=3，要測標準配速先 `s.sessionsDone = 1`。
- **美術素材常比需求單先落地**（他們動很快），接線前 `ls public/cafe/<目錄>` 看一眼，能直接吃正式素材就不用寫後備。

---

# （以下為 2026-07-09 第二輪交接，歷史參考）

> 給下一個「引擎 session」的單一入口。本輪引擎完成 review 10 findings **全數 10 條**（#1 走方案B：伝言板獨立 KV）＋E4 吧檯拆層接手＋§A manifest 切換。
> 聖經＝`docs/shop-v2-spec.md`；美術→引擎需求＝`docs/art-to-engine-requests.md`（E1–E4 全 ✅）；引擎→美術＝`docs/engine-to-art-requests.md`。
> **守備範圍：只碰 `src/`（不含 `src/data/cafe.gen.ts`）、`worker/index.js`、`vite.config.ts`、`tests/`、docs 兩份 requests。⛔ 別碰 `scripts/`、`assets_src/`、`public/cafe/`、`docs/cafe-catalog.json`、`cafe.gen.ts`（美術產）。**
> **JJ 已授權自主 commit**（驗過就 commit、不用問；只 stage 自己的檔、commit 前核一次沒夾美術檔——見 memory `commit-autonomously`）。

## 1. 目前狀態（交接當下）

- branch `nihongo-teaching-injection`、`tsc -b` 零錯、`npm test` **97/97**、`npm run build` 過、preview 對圖過。
- ⚠️ **2026-07-09 iCloud 事故後 git 歷史重生**（Desktop 開「桌面與文件」同步、.git 物件被逐出損毀）：舊 commit hash 全部失效，本輪與過往全部成果都收在重生 root（見 `docs/git-history-recovered.md` 的訊息清單）。**強烈建議：專案搬離 Desktop（脫離 iCloud 管轄）＋上 GitHub private remote。**
- 深度 review 10 條 findings：**全修完**（#1 方案B 見 §3）。⚠️ worker 有新端點（`/api/shop/board`），**要 `npx wrangler deploy` 才生效**（JJ 部署）。

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
- 進店要狀態：**別手拼 state**（缺 cards 炸 xp.ts、缺 known 炸 session.ts……無底洞，症狀＝root 空白且 console 無錯，要自掛 error listener 才看得到）。console 貼：
  `import('/src/lib/store.ts').then(m=>{const s=m.initState('jj',{hira:false,kata:false});Object.assign(s,{lastDoneDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}),xp:1e5,coins:99999});localStorage['nng:user']='jj';localStorage['nng:state:jj']=JSON.stringify(s);localStorage['nng:shop-intro3']='1';location.reload()})`
- 深度 review（2026-07-09、dfde109..HEAD）已做完且 10/10 已修——別重跑同範圍。
- 沒進榜可順手的小點還剩：泡泡夾店長肩膀（G4 cosmetic）、sent-toast 計時器換 `onAnimationEnd`、isRug 謂詞重複、黑板座標魔術數字提常數。

## 7. 協調慣例

- 美術↔引擎走兩份 requests 文件開 E 條目、做完標 ✅；跨 session 即時訊息用 session 管理工具（美術 session 名「日々喫茶 Shop art handoff」）。
- 兩 session 不並行改同一檔；接手前 `git diff` 看清楚。
- JJ 慣例：美術收尾先過 codex review 再定案（memory `cafe-art-codex-review`）；commit 訊息中文描述體。
- 模型分工（memory `model-strategy`）：Sonnet 主力執行＋Fable advisor；美術「生圖／看圖」委 codex。
