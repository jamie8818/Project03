# 日々喫茶 Shop 美術改版 · 交接總覽（新美術 session 從這開始讀）

> 這是「美術 session」的單一入口。引擎程式由「另一個引擎 session」顧（見 §分工）。
> 相關細節文件：`shop-v2-spec.md`（架構聖經）、`engine-coords.md`（場景/店長/座標）、
> `dengon-board-spec.md`（留言板）、`engine-to-art-requests.md`（引擎↔美術介面）、`cafe-catalog.json`（目錄）。

## 0. 一句話現況

昭和喫茶商店「日々喫茶」的美術＋擺放引擎大改版（Stardew 式假3D 家具站進 2D 俯視格）。
新場景、30 件家具正交重生＋四向 turnaround、拆套、新店長、牆上留言黑板都做完了。
**➡️ 新 session 從 §0.9 開始讀（2026-07-10 收官交接，蓋過 §0.5–0.8 全部）。**

## 0.9 ⚠️ 收官交接（2026-07-10 深夜；新美術監工 session 的唯一入口，§0.5–0.8 僅當歷史）

### 現況一句話
catalog **233 件**（句句有 flavor）、布丁 **100 味**（variant×hue）、粉圓貓完全體（3姿勢×4狀態幀＋摸頭好感度＋8點位輪換）、動畫家具 12 件、成就 38＋像素徽章 40、Q 版客人（眨眼/自訂台詞/吧檯前）、直覺式導引、app icon 布丁版。**需求管線 E1–E21 全閉環**、線上版本 `840c9c4c`、工作區乾淨、雙遠端同步（GitHub `jamie8818/Project03` private＋`~/Project03-mirror.git`，**commit 後兩個都 push**）。

### 工作模型（JJ 拍板，照做）
- **Fable 監工＋Sonnet workers**：監工派工/驗收/統一 commit/部署；worker 生產、**絕不執行 git**（交檔案清單）。
- **codex＝眼睛和畫手**：生圖/看圖全委 codex，**一律前景跑**（timeout 600000ms、`< /dev/null`、`-i` 後 `--`、401 重跑）——「背景跑＋停下等通知」是 worker 最常見死法，brief 第一條就要禁。
- **manifest 排隊制**：多 worker 並行時 sprite 先做、`cafe-catalog.json` 最後動；動前 `git status` 查 clean、dirty 輪詢 2 分×30 分、逾時交條目 JSON 給監工 merge。幾何小件監工直接 PIL 手繪＋codex 審（斑馬線/交通錐/掛鎖/抓柱前例）。
- **中途追加需求＝砍掉重開新單**，不走 SendMessage（有 worker 把追加訊息當 prompt injection 拒收——警覺正確，別為難它們）。
- **文件編輯後必 grep 驗證有改到**（cat_scratcher 勘誤事故：regex 沒命中原文靜默白改，害引擎照舊文件跳過接線）。
- **進程重啟會殺 worker**：中間產物一律落 scratchpad（三次中斷全靠留檔零損失）；復活流程＝磁碟盤點→倖存品驗收入庫→缺件補產。
- 尺度紀律：桌面小物/飲品 sHT ≤1.1（華麗長杯 ≤1.35）、驗收必查（agent 會放水，melon_beer 2.09 前例）。flavor 語氣見記憶 `content-voice-puns`（幹話基調＋俗語劫持諧音無配額）。
- 引擎 session＝「Café art engine session」（`local_f51b4fbc-2604-449e-8ef0-01a61526eda4`，send_message 溝通；需求走 `art-to-engine-requests.md` E 系列編號）。部署＝監工跑 `npm run deploy`（先 `npm test`；新資產 404＝CDN 延遲，等 10 秒重試）。

### 掛件（都不擋現狀）
1. **JJ 待覆核**：E19 起始好感亞軒15/JJ5、cat-person 成就綁好感100——已上線、否決改常數。
2. 粉圓第四姿勢（等 JJ 給圖）、E14 像素版 💬、連續天數徽章頭頂顯示、12px 迷你指示手（要用時另畫勿縮）。
3. E16 Tier C 成就 2 條（已讀不回/牽手過馬路）延後；布丁配料拆層固定原色（可選、v1 整張套色）。
4. wishlist v2 剩 ~40 候選；動畫家具可加波次（anim 欄機制通用）。
5. 雜務：GitHub token 換 90 天期。～～備份清理～～✅ 已清（2026-07-10：`~/Project03-rescue`＋`~/Project03-rescue-20260709`＋`.git-broken-20260709/` 共約 531MB，刪前驗證 fsck 乾淨、雙遠端同步 `308e607`、檔名級比對零獨有檔案）。

### 素材目錄地圖（§1–2 之外新增的）
`public/cafe/` 下：`catalog/`（233 件＋`_anim` 差分幀）、`cat/`（粉圓 13 檔）、`guests/`（Q版兩人＋blink）、`pudding/`（10 變體）、`badges/`（40 枚＋模板）、`gacha/`（機台 5 件）、`sign/`（樣品櫃 3 件＋棄用 stand/dome）、`ui/`（lock/hand_point）。內容源：`docs/cafe-flavor.json`（263 句）、`docs/puddings.json`（100 味）、`docs/shop-lines.json`（702 句）——各有 build 腳本產 `src/data/*.gen.ts`。工法庫在 scratchpad 會隨進程消失，關鍵的已進 `scripts/`（fix-shopkeeper-pose/normalize-facing-height）。

## 0.5 ⚠️ 最新修正與待交付（2026-07-08 核對後補；讀這節，蓋過 §4/§6 過時內容）

**兩個修正（已對過實際檔）：**
1. **§B candle 已完成、別再做**——`cafe.gen.ts` 裡 `table_round` 已改 1×1、`candle` 在 `(5,6)` 就坐桌上了。`engine-to-art-requests.md §B` 是拆套前寫的、過時。
2. **⚠️ §C 吧檯：忽略 `counter_front.png` 和 `engine-coords.md` 的吧檯做法**——那是舊路、引擎沒採用（grep `src/` 確認 live code 不吃 counter_front.png、PANDA_TOP 還在吧檯前）。**§C 一律以 `engine-to-art-requests.md §C` 為準。**

**待交付（美術，會卡住引擎）：**
- **§C-2 `public/cafe/base-fg.png`（門/牆前景層）**＝JJ 擴大需求：**不只門、連「底部整面牆」都要進這層**。576×416 對齊 base.png，門＋底部牆帶不透明、其餘全透明；引擎 `.cafe-fg` 已接好（缺這張自動略過），靠底的家具疊到它就被擋＝景深。→ 小而快，**建議先做**。
- **§C 吧檯拆層**＝JJ 四需求裡唯一沒完成的「店長站吧檯裡面＋檯面裡放小家電」。出①不含吧檯的 base ②吧檯本體＋正面板 sprite ③檯面格/內側格座標。⚠️ **真難點**：吧檯是烤進 base.png 的（JJ 下載那張），要塗掉補回地板/牆或重取無吧檯底圖（raster 修圖）；base-fg 也是同性質摳圖。
- **§A manifest 加兩欄**（順手）：每件加 `surface`（桌/櫃頂/層架 true、椅凳沙發卡座 false）＋ `spriteHeightTiles`（視覺高度/格），重跑 `build-cafe-ts.py`；引擎會改吃這兩欄去掉硬編白名單。facings 已做。

**§C 跟熊貓無關（JJ 問過）**：§C 拆的是場景不是店長。店長站裡面的對位用現有 `newpanda/idle+waiter` 就能在 preview 調；JJ 之後補的熊貓多姿勢是平行線、不卡 §C。

**建議排序**：§C-2（含門＋底牆，小快）→ §C（大工、價值最高）→ §A（順手）→ 再看要不要生新家具。

**Git**：已 commit `026d8b4`、工作區乾淨（舊 §6「~174 檔未 commit」已不適用）。引擎的 `src/` 是它自己 commit 的，別動。

## 0.6 ⚠️ 最新狀態（2026-07-09 收尾；讀這節，蓋過 §0.5/§4）

**這輪美術 session 做掉的（都 commit 了，美術快照最新 `3b4aa79`）：**
- ✅ **§C-2 `public/cafe/base-fg.png`**：門＋底牆前景層（景深）。576×416 對齊 base，門+底牆帶不透明、其餘透明；引擎 `.cafe-fg` 吃它。
- ✅ **§C「店長站吧檯裡面」（需求④）**：用**現成 `counter_front.png`**（正面板 occluder，x0-272/y118-202）＋引擎移店長到檯後（`PANDA_CX=150/PANDA_TOP=50`）＋獨立 `.cafe-counter-fg` 恆亮層＋繪製順序修正（吧檯外家具畫在吧檯之上、只有店長被擋）。⚠️ **這是「沿用烤進 base 的吧檯＋occluder」做的，不是完整拆層**（完整版見下方 TODO）。
- ✅ **店長 16 姿勢換平滑暖描邊版**：來源 `~/Desktop/新熊貓/` 16 張 LINE 貼圖風熊貓，pipeline＝**去背（邊界 flood-fill）→ 去字（保留 ≥最大塊12% 連通塊，只對 3 張有字的）→ 身高正規化（頭頂→腳底全等）→ bbox 水平置中、底部著地、四邊留白 → 出 `public/cafe/shopkeeper/<slug>.png`（331×320、engine height=96 縮放）**。映射（動作→slug）：`happy`=站姿微笑 `cat`=抱貓 `idle`=讀書 `serve`=端盤 `think`=托腮 `onion`=拿蔥 `cheer`=舉手歡呼 `eat`=捧三明治 `play`=吹泡泡 `shock`=張嘴 `no`=擔心 `statue`=閉眼發呆 `welcome`=**雙手舉起張嘴大喊（與 `cheer` 共用同一張來源圖，2026-07-09 後續美術 session 改，經 codex 判定 16 張源圖裡沒有更貼切的獨立「熱情舉手迎客」候選，兩者不會並排顯示、語意契合優先於視覺獨立）** `cozy`=**躺姿（JJ 決定保留、當「趴檯面睡」）** `love`=端咖啡 `dismay`=垂眼。✅ **2026-07-09 後續美術 session 修完**：`shock`/`no` 領結綠改紅（跟其餘 14 張一致，codex 目檢 pass）。`no` 映射經 codex 評估後維持現況（16 張裡最貼近「擔心/不安」，非最貼近「堅定拒絕」但已是最佳）。要換姿勢＝重跑上面 pipeline 換該 slug 對應的來源圖。
- ✅ **伝言板打字區破圖修**：`board/input_field.png`＋`button_send.png` 重裁自完稿 `panel.png`（去背、塗掉重複鈕、頂端清氣泡殘影）。

**協調機制（重要）**：美術→引擎需求走 **`docs/art-to-engine-requests.md`**（反向於 `engine-to-art-requests.md`）。本輪 E1（送出鈕位置）/E2（店長站裡面）/E3（吧檯繪製順序）引擎**都做完驗過**了。引擎 session＝**「Japanese site new engine」**（`local_c2ced2b1…`，用 session 管理工具 `send_message` 發）。**先給 codex review 再定案**是 JJ 的慣例（見記憶 `cafe-art-codex-review`）。

**已完成但註記（本輪最後階段）：**
- ✅ **§A manifest 加 `surface`／`spriteHeightTiles` 兩欄**（commit `1584cf1`，引擎 session 並行做的）：`cafe-catalog.json` 30 件都填了——`surface:true` 5 件（`table_round/table_square/table_low/pastry_case/bottle_shelf`＝原硬編白名單）、其餘 false；`spriteHeightTiles` 公式＝`footprint_w × naturalH/naturalW`（引擎 `spriteH = spriteHeightTiles × CELL`）。`build-cafe-ts.py`＋`cafe.gen.ts` 都更新了。
  - ⚠️ **剩引擎收尾（引擎的活、非美術）**：`src/lib/shop.ts` 的 `SURFACE_HOSTS` 還硬編、還沒改吃 `it.surface`/`it.spriteHeightTiles`。要嘛引擎自己接完、要嘛開一條 art→engine note 催。**美術這邊 §A 不用再動。**

**還沒做（給新美術 session）——建議優先序：**

1. ~~§C 完整版~~ ✅ **本輪做完**（見下）。
2. **22 件新家具**（`docs/cafe-furniture-wishlist.md` 標 🆕 的 22 件：曲木椅/冰滴塔/榻榻米/奶油蘇打杯…）：加進 `cafe-catalog.json`(含 facings)→ gen → slice → build-cafe-ts。純可選。
3. **§D 四向補完**：30 件裡只 **10 件**有向（front/back/right），其餘 **20 件只 front**（旋轉對它 no-op）。補生成、可選。

**Git（新 session 接手前）**：美術快照最新 `3b4aa79`；引擎 src 由引擎自己 commit（E2=`f7f65dd`、E3 已 commit）。兩 session 不並行改同一檔，接手前 `git diff` 看清楚。

## 0.7 §C 完整版：吧檯拆層（本輪交付，2026-07-09）

**做完**：`public/cafe/base_nocounter.png`（base 拿掉整個吧檯、補回牆面+地板，上排展示層架故意保留在背景不拆）＋`public/cafe/counter_body.png`（吧檯本體上緣＋矮櫃抽屜排＋內角柱，透明畫布只 `x0-272/y64-118` 不透明）＋沿用既有 `counter_front.png`（沒動）。都是從 `base.png` 原像素裁切，`scripts/verify-counter-split.py` 驗證 `alpha_composite(base_nocounter, counter_body, counter_front)` 跟原圖逐像素 diff==0。codex review 兩輪過（第一版有孤立面板瑕疵、第二版收進 counter_body 修掉，codex 判「可以定案」）。

座標定義＋引擎待做事項（渲染「內側小家電」需要新的 draw-order 路徑，量比較大）都寫在 `docs/art-to-engine-requests.md` **E4**，引擎 session 接手前先讀那條。這輪**沒有**新增任何「小家電」家具到 catalog——純拆層，家電本身留給下一輪（等引擎把 E4 的渲染路徑接完再排）。

## 0.8 ⚠️ 美術總結（2026-07-09 晚，多線並行輪；讀這節，蓋過 §0.5–0.7 的「待做」）

**本輪十線全完工（監工 Fable＋Sonnet workers 並行，全過 codex 審）：**
**➕ 0.8b 第二日總結（2026-07-10 收官）**：catalog **228 件**（台式/惡搞/喫茶30/私藏兩批，句句有 flavor 共 229 句）；**布丁 2.0**（100 味 variant×hue、10 基底 sprite、UR 稀有度＝連續出席掉落）；**粉圓貓常駐**（三姿勢/4點位/10分鐘時間決定論）；**Q 版客人完全體**（116px/吧檯前/深度排序/眨眼/自訂台詞 E14）；**成就 29 枚上線**（Tier B 9＋Tier C 2 延後）＋像素徽章 40；**app icon 布丁版接線**；E1-E17 全閉環。線上版本 68b4aafc。未做：E15 點貓ニャ、E14 像素💬、連續徽章顯示、粉圓第四姿勢。
- ✅ **§C 吧檯拆層**（見 §0.7）＋**引擎 E4 已接**＋**內側小家電 6 件已入庫**（`hostType:'counter-inside'`：thermos_rack/shaker_station/ice_machine/coffee_scale/espresso_machine/toaster，sHT 1.83–1.91，E4 渲染路徑首批住客）。
- ✅ **家具擴充**：22 件（wishlist v1 補齊）＋ v2 首波 15 件＋小家電 6 件＋**第二波 20 件** → **catalog 現 93 件**（seasonal 頁籤 4 件）。v2 還有 ~60 件候選可圈下一波。wave-1 六件已補向（§D-3，有向家具 23 件）；shock/no 領結轉紅、welcome 換 cheer 同源圖。**E5/E6 引擎接完＋preview 煙霧測試全過**（台詞↔pose 精確對應、六分頁籤、小家電入目錄）。
- ✅ **§D/§D-2 四向**：18 件有向（wall/rug/surface/徑向對稱件判定免補有紀錄；cold_drip_tower 生成不穩主動放棄）。**側背視高度歸一**：引擎 aspect 渲染規則下 9 件修到 front/side 內容高比 1.00（`scripts/normalize-facing-height.py`，含 vstretch 路徑）。
- ✅ **base-fg 空氣牆重剪**（門欄 x257–331/y341、牆基 y373，以 JJ 標的淺色方形定位）；✅ **cozy 姿勢切邊重出**（`scripts/fix-shopkeeper-pose.py` 可重用）。
- ✅ **店長台詞資料管線**：`docs/shop-lines.json`（702 句＝遷移 202＋新增 500，每句帶 pose/states 標籤）→ `scripts/build-shop-lines.py` → `src/data/shop-lines.gen.ts`。**引擎待接 E5**（`art-to-engine-requests.md`）。

**⚠️ Git 事故與新守則**：2026-07-09 iCloud 桌面同步逐出 `.git` 物件→歷史重生於 root `09228f7`（舊清單 `docs/git-history-recovered.md`）。現有 remote：GitHub `jamie8818/Project03`（private）＋本機鏡像 `~/Project03-mirror.git`，**commit 後兩個都要 push**。**美術 agent 不自己 commit**——worker 交檔案清單、監工統一 commit；codex 生成一律前景跑。**專案已搬到 `~/Projects/Project03`**（2026-07-09，脫離 iCloud 管轄；Claude 記憶目錄已同步遷移）。舊路徑 session 一律作廢、在新路徑重開。

## 1. 已完成（美術）

- **場景 base**：`public/cafe/base.png`＝bar-baked 昭和喫茶（左上吧檯＋後吧台層架＋3 高腳椅烤進圖、右上窗、下方玻璃拱門、俯視木地板）。來源是 JJ 下載的成品圖 fit 進 576×416。舊版備份 `base_v2wood.png`。
- **吧檯層**：`public/cafe/counter_front.png`（切線 y118＝檯面前緣），引擎疊在店長之上做「店長趴吧檯裡面」的遮擋。
- **店長**：換成暖描邊新熊貓 `assets_src/cafe/newpanda/`（`waiter` 端盤、`idle` 站姿）；定裝 **PANDA_H≈95、feet≈146、cx≈150**（趴吧檯）。JJ 之後會補更多姿勢圖。
- **家具 30 件**：`public/cafe/catalog/*.png`（共 51 檔＝30 front＋21 facing）。全部正交重生（30° 斜視已汰換）。
  - 四向 turnaround：10 件有向（見 `cafe-catalog.json` 的 `facings`）；命名 `<id>_back/_right/_left.png`，left 缺者引擎鏡像 right。
  - 拆套：圓桌 `table_round`(1×1)、方桌 `table_square`(2×1) 已重畫成桌本體（不含椅，椅沿用 `chair_velvet`）。
- **留言板（伝言板）素材**：`public/cafe/board/`＝`wall_board`(掛牆黑板，用 JJ 裁的圖)、`bubble_right/left`(空對話框 9-slice)、`header`、`button_send`、`input_field`、`panel`(整框)。黑板座標見 `dengon-board-spec.md`（現為 `left=243,top=12,w=70,h=50`）。
- **錨圖/色票**：`assets_src/cafe/anchor-furniture.png`（正交正面＋薄頂 假3D 基準，所有家具雙圖錨定它）、`palette.png`（鎖色）。

## 2. 生成管線（scripts/）

| 腳本 | 做什麼 |
|---|---|
| `build-cafe-ts.py` | 從 `docs/cafe-catalog.json` 產 `src/data/cafe.gen.ts`（含 BLOCKED/STARTER_LAYOUT/facings）。改目錄→跑這個。 |
| `gen-cafe-furniture.py` | 綠幕 sheet 批量生家具 front（吃 anchor-furniture），呼叫 slice。 |
| `gen-cafe-facings.py` | 生 back/right/left（餵該件 front 當錨），`--front <id>` 可重畫桌本體。側向寬＝footprint.h×64。 |
| `slice-cafe-sheets.py` | 綠幕 chroma key→連通塊歸格→依 z 分尺寸切透明 PNG（無烤陰影）。 |
| `gen-cafe-scene*.py` | 場景生成（現用 JJ 給的成品圖，這些是歷史備援）。 |
| `gen-cafe-anchor.py` | 生正交錨圖（已鎖，除非要換基準否則不用再跑）。 |

**流程**：改 `cafe-catalog.json`(規格) → 生圖(gen-*) → 切圖進 `assets_src/cafe/out/` → 複製到 `public/cafe/catalog/` → `build-cafe-ts.py` 更新 gen.ts。

## 3. 鎖定的慣例（別破壞）

- **畫風**：C 清脆像素（LimeZu Modern Interiors，暖色低飽和、深色同色系柔和描邊、每色 2–3 階）。錨定 `anchor-furniture.png`。
- **色票**：胡桃木 #4A2E1C／喫茶綠 #35503F／酒紅 #7C2E2C／黃銅 #D8A94E／奶油 #ECDDC4／描邊 #1B120A。
- **footprint 模型**：w×h＝佔地深度（h＝地面深度，非視覺高度）；sprite 釘 footprint 前緣往上長、可 overhang；接地陰影由引擎畫（素材不含）。
- **facing 命名**：front=`<id>.png`（不改名）、back/right/left 加檔；side 圖畫布寬＝footprint.h×64。三型見 `shop-v2-spec.md §2`。
- **Codex 坑**：`codex exec` 一定 `< /dev/null`；401＝token 刷新重跑該張；macOS bash 3.2 無關聯陣列（用 python 或 case）。
- **綠幕去背**：全域殺鮮綠（喫茶悶綠 #35503F 安全）；封閉綠塊也清得掉。

## 4. 待做（可選，等 JJ 指示）

- **22 件新家具**：見 `docs/cafe-furniture-wishlist.md`（曲木椅、冰滴塔、榻榻米座席、奶油蘇打杯…）。要生時：加進 `cafe-catalog.json`（含 facings）→ gen → slice → build-cafe-ts。
- **店長多姿勢**：JJ 會陸續補暖描邊熊貓圖到 `assets_src/cafe/newpanda/`；接進 16 姿勢系統或改單姿勢由 JJ 定。
- **留言板**：素材＋規格(`dengon-board-spec.md`)都好了，剩引擎端接（資料/互動/面板），是引擎 session 的活。

## 5. 分工與介面（重要）

- **美術 session（你）**：`scripts/`、`assets_src/`、`public/cafe/`、`docs/cafe-catalog.json`、`src/data/cafe.gen.ts`（產生器輸出）。
- **引擎 session（另一個）**：`src/components/Shop.tsx`、`src/lib/shop.ts`、`src/lib/shopstate.ts`、`src/styles.css`。
- ⛔ **別碰引擎的 src 程式**；引擎要新家具欄位 → 走 `engine-to-art-requests.md` 回報，由美術改 manifest＋重跑。
- 兩 session **不並行改同一檔**。接手前 `git diff` 看清楚。

## 6. ⚠️ Git 狀態

改版當下**整批未 commit（~174 檔）**。開新 session 前**強烈建議先 commit 一版**快照（不然工作區很滿、容易亂）。因為引擎 session 也在動 `src/`，commit 會一起帶到它的 WIP——沒關係，當一版 WIP 存檔。
