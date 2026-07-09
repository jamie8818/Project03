# 美術 → 引擎 需求清單（日々喫茶 Shop）

> 美術 session 開的反向介面需求（對應 `engine-to-art-requests.md` 的反方向）。
> 這裡的項目要改**引擎守備範圍**（`src/components/Shop.tsx`、`src/styles.css` 等），美術不碰、由引擎 session 處理。
> 慣例同 §分工：兩 session 不並行改同一檔。

## E1. 伝言板送出鈕位置微調（`src/styles.css` `.dengon-send`）— 小、可選、非 blocker

**背景**：伝言板打字區「破圖」已由美術修好——`public/cafe/board/input_field.png`（乾淨整條打字列，鈕塗掉）＋`button_send.png`（留言鈕乾淨去背 overlay）重裁自完稿 `panel.png`。這版已可 drop-in，引擎不改也能用。

**問題（Codex 量測確認）**：`.dengon-send` 目前 `right: 3%; width: 27%`（styles.css 約 3223 行）→ 送出鈕**實際繪製中心落在 ~83.5%**，但完稿 `panel.png` 原稿鈕中心在 **~79–80%**。鈕偏右、右緣太靠內框，hover（scale 1.05）／送出 pulse（scale 1.14）放大時偏右感更明顯。

**建議修法**：`.dengon-send` 的 `right: 3%` → **`right: 7%`**（`width` 維持 `27%`）。這會把鈕中心拉回 ~79–80%、貼回原稿，也讓 hover/pulse 不會頂到右內框。

**驗收**：開伝言板，送出鈕視覺置中於右側奶油區、不貼右內框；hover/pulse 時不外溢。

**備註**：純位置微調，不影響資料/互動；美術素材不需再動。若之後 `input_field.png` 右側「補色平塗區」想更接近原稿紙紋（Codex 提的非 blocker 小點），再回報美術補即可。

**✅ 引擎已處理＋JJ 定案（2026-07-09）**：`.dengon-send` 最終 **`right: 8%`、`top: 18%`**（起於 E1 建議 `right:7%`＝中心 79.5%，JJ preview 上再微調左右、並把鈕往下移對齊輸入線）。鈕中心約 78.5%（仍貼原稿 ~79–80%）、右緣距奶油右界有留白。順帶修：送出 pulse（scale 1.14）峰值原會凸出右內框 ~4px，已把 `.dengon-send.sent` 的 `transform-origin` 改成 `right center`（往左脹、右緣釘住），不外溢。已重載對新裁的 `input_field.png`/`button_send.png`，輸入列破圖清乾淨。

## E2. 店長站進吧檯裡面（`src/components/Shop.tsx` `PANDA_CX`/`PANDA_TOP`）— JJ 指定，需求④

**背景**：JJ 要「店長站在吧台裡面」（＝四需求裡最後沒完成的④）。店長目前 `PANDA_CX=136 / PANDA_TOP=150`＝站在吧檯**前面**的開放地板。要它站**裡面**（吧檯後方工作區、上半身露在檯面上、下半身被吧檯正面板遮住）。

**⚠️ 踩過的坑（2026-07-09，別重蹈）**：我一度把吧檯正面板併進 `base-fg.png`（`.cafe-fg` 本來就畫在店長之上，想說這樣就遮到）。**但店長還在原位 top=150 時，頭正好落在正面板佔的 y118–202 區間 → 頭被切掉**（JJ 回報「店長頭被切到」）。教訓：**「移店長到檯後」＋「正面板遮擋」必須同一步落地**，只做遮擋不移店長＝切頭。已撤回合併，`base-fg.png` **還原成純門/牆**（吧檯區 0 不透明）。

**正解（引擎一次做完，原子操作、無中間破圖）**：
1. **移店長到檯後**：`PANDA_CX: 136 → 150`、`PANDA_TOP: 150 → 50`（preview 實測：feet≈146 落在檯面前緣 y118，下半 ~28px 被正面板遮、頭在 y50 露在檯面上＝趴吧檯裡面）。preview 可微調。
2. **正面板當獨立層**：把 `public/cafe/counter_front.png`（現成、x0-272 / y118-202：檯面前緣＋正面板＋銅角＋3 綠椅，與 base 像素完全對齊）畫成一張 **恆全不透明**的圖層，**畫在店長之後**（draw order：base → 地毯/家具 → 店長 → **counter_front.png** →（之後）檯面小物）。這樣正面板不會跟 base-fg 一起在裝潢模式變淡，店長下半身在 view/decorate 都乾淨被遮。

**為何用獨立層、不併進 base-fg**：①base-fg 裝潢時淡到 0.3、正面板不該淡 ②併進去會遇到上面那個「移店長前先切頭」的時序坑——獨立層由引擎跟移店長**同一個 commit** 落地就沒這問題。

**已驗證（preview 實測，兩種都試過）**：移店長 top=50 ＋ 疊 counter_front → 店面模式店長乾淨站吧檯裡面、下半身被正面板遮（截圖給 JJ 看過、成立）。

**素材狀態**：`counter_front.png` 現成可用、不用我再動。若你要我改它（例如去掉 3 綠椅只留正面板、或改尺寸）再說。

**範圍**：這條只做「店長站裡面」。§C 完整版（不含吧檯的 base ＋ 檯面裡放小家電）是另一件、之後再說。

**✅ 引擎已處理（2026-07-09，同一 commit 原子落地）**：`Shop.tsx` `PANDA_CX 136→150`、`PANDA_TOP 150→50`；新增 `.cafe-counter-fg` 圖層＝`counter_front.png` 整張 576×416 疊、畫在店長之後、**恆全不透明**（`styles.css`，裝潢模式不淡化）、pointer 穿透。preview 量測：店長頭頂 y50（遠在正面板 y118 之上＝沒切頭）、腳 y146（下 ~28px 沒入正面板）、中心 x150.5。view／decorate 兩模式都驗過：店長乾淨站吧檯裡面、下半身被遮、正面板在裝潢模式仍不透明。tsc／build／console 皆過。（順帶：`base-fg.png` 已載入成功＝美術已交付，門/牆景深也生效。）

## E3. 吧檯正面板層的繪製順序：只該擋店長、不該擋吧檯外的家具（`src/components/Shop.tsx` renderOrder / `.cafe-counter-fg`）— JJ 指定

**背景（JJ 回報）**：E2 加的 `.cafe-counter-fg`（`counter_front.png`）目前畫在**所有東西之上**，連**吧檯外的家具**也被它擋到。JJ 的規則：**「吧檯外面的家具一律要畫在吧檯之上（擋住吧檯）；只有吧檯裡面的東西（＝店長）才被吧檯擋。」**

**現況**：draw order ≈ `base → 地毯/地板家具 → 店長 → counter_front → base-fg`。→ counter_front 在地板家具之後 → 靠吧檯、往上 overhang 的家具會被正面板蓋掉頂端（錯，該在吧檯前）。

**正解（改 draw order）**：把 `counter_front` 這層移到「**店長之後、地板家具(L1)之前**」：
```
base → 地毯(L0) → 店長 → counter_front(.cafe-counter-fg) → 地板家具(L1) → 檯面小物(L2) → 壁飾(L3) → base-fg
```
結果：① 店長（吧檯裡面）畫在 counter_front 之前 → 被吧檯擋 ✅ ② 地板家具/檯面小物畫在 counter_front 之後 → **畫在吧檯之上**＝吧檯外家具擋住吧檯 ✅。

**注意/確認點**：
- 這也把「店長 vs 地板家具」的順序改成**家具畫在店長之上**。合理性：店長固定在吧檯後方（最後排），所有地板家具都在它前面 → 家具蓋過店長是正確景深。若你 renderOrder 有更嚴謹的前緣 y-sort，讓 counter_front 跟著「吧檯的前緣列」一起排也行，只要滿足上面兩條規則即可。
- **地毯(L0)** 留在 counter_front 之前（地毯在地上、不該蓋吧檯）；只有 L1 以上要畫在吧檯之上。
- 這是純繪製順序調整，素材不用動（`counter_front.png` 不變）。

**驗收**：靠吧檯下方放一件高家具（sprite 往上 overhang 到 y118–202）→ 它的頂端畫在吧檯**之上**、不被正面板蓋；店長仍被吧檯擋（站裡面）。

**範圍備註**：這是 counter_front「單層 occluder」框架下的順序修正，能解 JJ 這條。若之後要更嚴謹（例如某家具一半在吧檯前一半在後），才需要 §C 完整版把吧檯做成有 footprint 的深度排序物件。

**✅ 引擎已處理（2026-07-09）**：`Shop.tsx` 把逐件渲染抽成 `renderFurn(i)`，並依 `renderOrder` 拆兩批——`rugOrder`（z=rug，L0）畫在店長＋`counter_front` **之前**，`aboveCounterOrder`（L1 家具／L2 檯面小物／L3 壁飾）畫在 `counter_front` **之後**。新 draw order：`base → 陰影 → 地毯(L0) → 店長 → counter_front → 地板家具/檯面小物/壁飾 → base-fg`。preview 驗證（吧檯正下方放 2 件高 `bottle_shelf`）：家具頂端畫在吧檯**之上**、不被正面板蓋；店長仍站吧檯裡面被擋；DOM 層序確認 `panda(3) → counter-fg(4) → z-furniture(5,6)`。tsc／build／`npm test` 96/96／console 皆過。

## E4. §C 完整版：吧檯拆層（不含吧檯的 base ＋ 吧檯本體/正面板 sprite ＋ 檯面格座標）— 「檯面裡放小家電」的美術前置作業已交付

**背景**：`engine-to-art-requests.md §C` 的三項交付（①不含吧檯的 base ②吧檯本體+正面板可分層 sprite ③檯面格/內側開放格座標）。「店長站吧檯裡面」已用 `counter_front.png` occluder 做完（E2/E3），**這條只補「檯面裡放小家電」需要的剩餘拆層**。

**交付檔案**（都是從 `base.png` 原像素裁切，未重繪；`scripts/verify-counter-split.py` 驗證像素級 diff==0）：
- `public/cafe/base_nocounter.png`（576×416，對齊 base）＝base 拿掉整個吧檯（吧檯本體+正面板+3張凳）、補回牆面(綠護牆板延續)+木地板。**上排展示層架（罐子，y32-64）刻意保留在此檔、不拆**——它是純貼牆裝飾，不需要跟前景家具互動，拆了反而增加複雜度沒有實益。
- `public/cafe/counter_body.png`（576×416，透明畫布，僅 `x:[0,272) y:[64,118)` 不透明）＝吧檯本體上緣＋原本的矮櫃抽屜排＋L 型內角柱，都收進這張。定位：**背景層**，緊接在 base_nocounter 之後、店長之前畫（跟 base 同時機恆亮，不需要跟其他家具做深度排序——理由見下）。
- `public/cafe/counter_front.png`（既有檔，**完全沒動**，`x:[0,272) y:[118,202)`）＝正面板＋銅角＋3 綠凳，沿用 E2/E3 已驗證的 `.cafe-counter-fg` 恆亮遮擋層，不必重做。

**為什麼 counter_body 不需要跟家具動態排序**：目前 draw order（E3 已定案）＝`base → 地毯 → 店長 → counter_front → 地板家具/檯面小物/壁飾`。counter_front 固定在「店長之後、其餘家具之前」，所以**吧檯外的所有地板家具永遠畫在吧檯之上**（不管前緣列多少）——這代表吧檯（本體+正面板）其實是跟 base 等級的「恆定背景」，不是要跟其他家具比前後的普通 furniture。因此 `counter_body.png` 可以直接當成緊跟在 `base_nocounter` 之後的第二張背景圖疊上去（`<img>` 疊在 base 上，店長之前），**不需要進 renderOrder／不需要 footprint**。

**座標定義（CELL=32，格系同 `CAFE.cols=18 rows=13`，STARTER_LAYOUT 同一套）**：

- **檯面格（頂面小物，現有機制沿用）**：`row=3`（y96–128）× `col=0..7`（x0–256；col8 只覆蓋到 x272 是吧檯視覺邊緣，格子算不滿一格、不建議拿來放置）。共 **8 格**。這是吧檯唯一一條實體「攤平可見」的檯面（現有的收銀機擺飾就烤在這排），取代舊的 `COUNTER_TOP`（原本 row2 兩端「翹角」+ row3，經這輪拆層確認 row2 其實是矮櫃抽屜排+內角柱，不是平面、不能放東西——**建議直接刪掉 row2 那兩格特例**）。`COUNTER_SURFACE_Y=124` 現有值落在 row3 底部，不用改。
- **內側開放格（新，供「檯面裡放小家電」用）**：**跟檯面格同一排 row3 cols0–7**，但要當一個**新的 z 類別**（例如 `'counter-inside'` 或沿用 `surface` 再加 flag），因為視覺行為不同：小家電（例如咖啡機）要跟店長一樣**畫在 counter_front 之前**（`店長 → [這裡插新的 inside 小家電] → counter_front`），讓下半身被正面板遮住、才有「嵌在吧檯裡」的效果；現有 `檯面格` 小物則維持畫在 counter_front **之後**（完全外露，像現有收銀機那樣）。
  - 建議底部錨定：比照店長 `PANDA_TOP=50` 的做法，內側小家電 bottom 抓 **y≈145**（＝店長腳落點附近、落在 counter_front 的 y118–202 範圍內，才會被正面板蓋到下半）；sprite 往上 overhang 表現高度，不受 CELL 限制。
  - 建議欄位排除：店長固定站 `cx=150`（約 col4.7），為了不跟店长模型重疊，內側家電落點建議避開 `col4`（可用 `col0–3, col6–7` 共 6 格；`col4/col5` 讓給店長視覺區）。這條排除是建議、非硬性，實際要不要限制由引擎決定。

**⚠️ 這條需要引擎新做的事（美術這邊到此為止）**：
1. `base.png` → `base_nocounter.png` + `counter_body.png`（緊接 base 之後畫，恆亮，同 base 不需 onError 特別處理，因為兩者理應同時切換）。
2. 新增一個「內側小家電」的渲染路徑：跟店長一樣畫在 `counter_front` **之前**（現有 `aboveCounterOrder` 的東西都畫在 `counter_front` 之後，不適用）。這是本條最大的實作量——需要新 z 類別或 `Shop.tsx` 加一個特判過濾，把「內側小家電」從 `aboveCounterOrder` 移到跟店長同一批。
3. `COUNTER_TOP` 常數建議簡化成純 row3 cols0-7（見上），`counterBlocked` 維持現況（rows2-4 cols0-7，仍然涵蓋新 base_nocounter 的吧檯區域，不用改）。
4. `cafe-catalog.json` 若要加「內側小家電」新家具，需要標一個新旗標（例如 `hostType: 'counter-inside'`）讓引擎分流；美術目前**沒有**新增任何小家電項目到 catalog（這條先只交付拆層本身，家電本身是後續工作，等引擎接完管線再排）。

**驗收**：`python3 scripts/verify-counter-split.py` → PASS（diff==0）；codex review 兩輪過（第一版有孤立面板瑕疵，第二版收進 counter_body 修掉，codex 判定「可以定案」）。

**未解問題／留給下一輪**：
- 內側小家電目前 catalog 裡沒有任何一件（沒有「咖啡機」之類的家具項目）；等引擎把渲染路徑接好，美術再補新家具＋標記 `hostType`。
- `col8`（x256-272，吧檯視覺右邊緣不滿一格）目前建議不開放放置；如果引擎覺得需要，可以再議。

**✅ 引擎已接手完成（2026-07-09，本輪引擎 session）**：
1. `cafe-base` 換 `base_nocounter.png`＋緊接 `.cafe-counter-body`（`counter_body.png`，恆亮背景層、店長之前、不進 renderOrder、無 footprint）。preview 對圖與拆層前像素一致。
2. 內側小家電渲染路徑已通：`hostType:'counter-inside'` 的 surface 件從 `aboveCounterOrder` 拆出 `insideOrder`，畫在店長之後、`counter_front` 之前；底錨 `COUNTER_INSIDE_Y=145`（Shop.tsx 常數）。放置規則（shop.ts `canPlace`）＝只嵌吧檯格（row3 cols0–7）、**硬性排除 col4/5**（店長視覺區）、不可上桌；已有單元測試（注入假 item）。
3. `COUNTER_TOP` 已簡化成純 row3 cols0–7（row2 兩格翹角特例已刪，連帶 Shop.tsx 的抬格計算移除）；`counterBlocked`、`COUNTER_SURFACE_Y=124` 不變。
4. **輪到美術**：補內側小家電家具＋在 catalog 標 `hostType: 'counter-inside'` 即可直接生效（引擎端用結構型別讀這個欄位，manifest/`cafe.gen.ts` 的 `CafeItem` 加欄位後不用改引擎）。`col8` 維持不開放。

## E5. 店長台詞資料管線＋新增 500 句（`docs/shop-lines.json` → `src/data/shop-lines.gen.ts`）— 內容 session 已交付，引擎已接線

**背景**：`src/lib/shop.ts` 目前 `SHOP_LINES`（closed/solo/full/idle 四池，硬編陣列）＋`poseForLine`（`POSE_KEYWORDS` 關鍵字表猜姿勢、猜不到 hash 輪播）是手寫、不好擴充。這條把台詞資料改走「JSON 來源 → 腳本產生 TS」的管線，並把台詞從 102 句擴到 702 句（含遷移的原句），順便讓每句台詞**自帶姿勢**（不用再靠關鍵字猜）。

**交付檔案**（美術／內容 session 範圍，已完成，未動 `src/lib/`、`src/components/`）：
- `docs/shop-lines.json`（手維護 source of truth，共 702 筆）：每筆 `{ id, text, pose, states, tags }`。
  - `text`：台詞原文。原 `SHOP_LINES` 的 102 句（closed 35／solo 30／full 35／idle 102，注意 idle 池比對時三態通用）**一字不動**遷入，`id` 前綴 `orig-`、`tags:["migrated"]`；新增的 500 句 `id` 前綴 `new-`、`tags:["new"]`（含日語教學梗的另加 `"jp"`）。
  - `pose`：16 選 1（`serve/idle/onion/no/eat/welcome/cheer/dismay/cat/happy/think/love/play/cozy/statue/shock`，即 `shop.ts` 的 `SHOPKEEPER_POSES`）。原句依 `POSE_KEYWORDS`＋語義人工標注；新句創作時就直接指定。
  - `states`：該句可在哪些營業狀態抽到，`closed`/`solo`/`full` 的子集；原 `idle` 池（通用句）＝三態全給，等同舊行為的 `[...pool, ...idle]` 混池。
- `scripts/build-shop-lines.py`：讀 `docs/shop-lines.json`，依 schema 檢查（pose 合法、states 合法、id/text 不重複）後產出 `src/data/shop-lines.gen.ts`；改台詞內容改 json 再重跑這支，不要手改 gen.ts。已跑過一次，`git diff --stat` 只會動這三個檔＋本文件。
- `src/data/shop-lines.gen.ts`（產物，檔頭已標「AUTO-GENERATED」）：
  ```ts
  export interface ShopLine { text: string; pose: Pose; }
  export const SHOP_LINES_GEN: Record<'closed' | 'solo' | 'full', ShopLine[]>
  ```
  三池已經是「原句＋新句攤平好」的最終陣列（`closed` 467 句／`solo` 482 句／`full` 487 句，通用句在三池都出現，數字不用再加 idle），**不含機率權重、不含 `poseForLine` 邏輯**——抽哪句、猜哪個姿勢仍是引擎的事。

**⚠️ 這條需要引擎新做的事（內容/美術這邊到此為止，不碰 `src/lib/`、`src/components/`）**：
1. `pickShopLine`（`shop.ts`）改吃 `SHOP_LINES_GEN[pool]` 而非現有的 `SHOP_LINES.closed/solo/full/idle` 手編陣列；回傳型別建議從純 `string` 改成 `ShopLine`（或至少讓呼叫端能同時拿到 `text` 和 `pose`），因為新資料每句自帶姿勢，不用再靠 `poseForLine` 猜。
2. `poseForLine` 建議改成「優先吃該句自帶的 `pose` 欄位，猜不到（例如呼叫端只有裸字串、找不到對應 `ShopLine`）才 fallback 現有的 `POSE_KEYWORDS` 關鍵字表＋情境池 hash」。`POSE_KEYWORDS`／`CLOSED_POSES`／`SOLO_POSES`／`FULL_POSES` 不用刪，降級成 fallback 即可，舊呼叫路徑（例如黑板留言之類非店長台詞的姿勢猜測，如果有）不受影響。
3. **行為不變保證**：原 102 句台詞文字**照舊**（`orig-*` 那些），只是換了資料來源＋多了明確 pose；玩家端看到的台詞池組成（closed 時看到 closed+舊idle、solo 時 solo+舊idle、full 時 full+舊idle）在遷移後應完全一致，只是量體從 102→702、且姿勢不再靠 hash 輪播猜、改成內容作者指定（多數跟原 `poseForLine` 猜出來的一致，少數修正得更貼合語意）。
4. `SHOP_LINES`（`shop.ts` 現有手編陣列）待引擎接完 `SHOP_LINES_GEN` 後可以整塊刪掉；`docs/shop-lines.json` 之後就是唯一 source of truth。

**驗收**：`python3 scripts/build-shop-lines.py` 重跑一次應該 no-op（gen.ts 內容不變）；接線後 `npm test` 全過、preview 點店長能抽到新句、closed/solo/full 三態底下抽到的句子只落在對應池、姿勢跟句子語意扣合（不會出現「趴著睡」配 cheer 姿勢這種明顯不搭）。

**備註**：500 句新增內容分 4 批寫、每批都過 codex review（人設漂移／日文正確性／姿勢扣合／重複度＋長度）後修正定案；16 姿勢每種 ≥33 句、closed/solo/full 專屬各 ≥60/80/80、日語教學梗（假名讀音／N5-N4 詞彙）130 句，單句 8–28 字（含泡泡邊界）。

**✅ 引擎已接手完成（2026-07-09，本輪引擎 session）**：
1. `pickShopLine` 改吃 `SHOP_LINES_GEN[pool]`，回傳型別改成 `ShopLine`（`{text, pose}`）；`pool` 判斷邏輯（`!meDone→closed`、`attend>=2→full`、否則 `solo`）不變。
2. `poseForLine` 簽名改吃 `string | ShopLine`：傳 `ShopLine` 直接回它的 `pose`；傳裸字串才走原本關鍵字表＋情境池 hash fallback（`POSE_KEYWORDS`／`CLOSED_POSES`／`SOLO_POSES`／`FULL_POSES` 都留著沒刪）。
3. `Shop.tsx` 的 `line` state 現在存 `ShopLine`（`line.t.text` 顯示泡泡、`line.t.pose` 或直接傳整個 `line.t` 給 `poseForLine`）。
4. 舊手編 `SHOP_LINES` 陣列已整塊刪除；`docs/shop-lines.json` → `shop-lines.gen.ts` 現在是唯一 source of truth。`tests/shop.test.ts` 對應改吃 `SHOP_LINES_GEN`。
5. `npm test`（97 條）全過、`tsc -b` 過、preview 實測：closed 狀態下抽到新句（含日語教學梗），姿勢跟語意扣合（例如趴睡文案配 cozy／eat 布丁文案配 eat）。

## E6. 家具目錄分類 taxonomy＋購買清單/裝潢托盤分頁籤（`docs/cafe-catalog.json` → `src/data/cafe.gen.ts`）— 美術已交付，引擎已接線

**背景**：catalog 到 73 件，遊戲的購買清單／裝潢家具托盤目前平鋪列全部項目，找東西要滾很久。美術這條交付「分類定義」（manifest 加 `category` 欄＋中文顯示名對照表），引擎接手把 UI 做成分頁籤。

**美術已交付的欄位形狀**：

1. `docs/cafe-catalog.json`：73 件每件都加了 `"category"`（英文 key，字串），緊接在 `"id"` 之後。taxonomy 依 `docs/cafe-furniture-wishlist.md` 的既有分節劃定，共 **6 類**：

   | key | 中文顯示名 | 件數 | 對應 wishlist 分節 |
   |---|---|---|---|
   | `seating` | 座席・桌椅 | 16 | 座席・桌椅 |
   | `counter` | 吧檯・沖煮・展示 | 19 | 吧檯・沖煮・展示（含 6 件 `hostType:'counter-inside'` 吧檯內側小家電） |
   | `wall` | 燈・牆飾 | 14 | 燈・牆飾＋桌上檯燈（`table_lamp`，wishlist 漏列的第 73 件，因主題是燈具併入本類） |
   | `rug` | 地毯・地面 | 7 | 地毯・地面 |
   | `tabletop` | 桌上擺件・小物 | 16 | 桌上擺件・小物 |
   | `seasonal` | 擺飾雜貨・季節 | 1（`kadomatsu` 正月門松） | 擺地雜貨・季節 |

   合計 16+19+14+7+16+1 = **73**，與 catalog 件數完全對齊。`seasonal` 目前只有 1 件、明顯小於其他類——這是刻意的（季節限定家具本來就該獨立分頁，方便之後按節慶擴充），不是分類疏漏。

2. `scripts/build-cafe-ts.py`：
   - `CafeItem` 介面新增 `category: string` 欄位（緊接 `id` 之後），比照 `hostType` 的透傳寫法，從 manifest 讀值直寫進每件 item 的 TS 物件字面量。
   - 新增模組層級常數 `CATEGORY_LABELS: Array<[string, string]>`（腳本頂部維護 `key → 中文顯示名` 對照＋頁籤順序，見下方原始定義），產生器把它原樣寫進 `cafe.gen.ts` 匯出，**陣列順序即建議頁籤順序**：`seating → counter → wall → rug → tabletop → seasonal`。
   - 已重跑產生器，`src/data/cafe.gen.ts` 73 件 `CafeItem` 都帶 `category`，`CATEGORY_LABELS` 已匯出（見檔案第 29–37 行）。

   ```ts
   // src/data/cafe.gen.ts（已產出，供引擎直接 import）
   export const CATEGORY_LABELS: Array<[string, string]> = [
     ['seating', '座席・桌椅'],
     ['counter', '吧檯・沖煮・展示'],
     ['wall', '燈・牆飾'],
     ['rug', '地毯・地面'],
     ['tabletop', '桌上擺件・小物'],
     ['seasonal', '擺飾雜貨・季節'],
   ];
   ```

**⚠️ 這條需要引擎新做的事（美術這邊到此為止）**：
1. 購買清單（Shop 商店列表）與裝潢家具托盤（放置面板）UI 各加一排分頁籤，籤名／順序直接吃 `CATEGORY_LABELS`（`for (const [key, label] of CATEGORY_LABELS)`），不要另外手刻中文字串，之後美術要加類別／改順序只改 `build-cafe-ts.py` 頂部那份表即可同步兩處 UI。
2. 篩選邏輯：`CAFE_ITEMS.filter(it => it.category === activeKey)`。目前每類都非空，不需要處理「空分類」的 UI 情境；但 `seasonal` 只有 1 件時頁籤仍要顯示（不要因為件數少就隱藏或合併，之後會加更多季節件）。
3. 分頁籤是否要顯示「全部」總覽籤、預設選中哪一類、行動版排版怎麼收，由引擎自行決定，美術沒有硬性要求。
4. **未接之前的行為保證**：`category` 欄位是新增欄位，`CafeItem` 型別新增必填屬性但既有引擎程式碼（`Shop.tsx`／`shop.ts` 等）目前沒有讀取它，多這個欄位純粹無害——不會改變任何現有渲染／購買/放置邏輯、`tsc --noEmit` 已驗證整包無型別錯誤。UI 分頁籤何時接、要不要接完全是引擎的排程，接之前遊戲行為不變。

**✅ 引擎已接手完成（2026-07-09，本輪引擎 session）**：
1. `shop.ts` re-export `CATEGORY_LABELS`（來自 `cafe.gen.ts`），供 `Shop.tsx` 直接 import。
2. `ShopPanel`（商店／購買清單）：分頁籤從舊的 z 層 4 籤（家具/地毯/擺件/壁飾）改成 `CATEGORY_LABELS` 的 6 籤，`items` 過濾條件從 `it.z === ...` 改成 `it.category === ...`；`for (const [key, label] of CATEGORY_LABELS)` 產籤，沒有另外手刻中文字串。
3. `DecoratePanel`（裝潢托盤）：新增 `catTab` state，托盤（`sub === 'furn'`）也加上同一套 `CATEGORY_LABELS` 分頁籤，過濾 `trayItems`；托盤整體是空的／該分類托盤剛好空的兩種情況分開提示文字。
4. 沒做「全部」總覽籤，預設選中第一類（`seating`）；件數最少的 `seasonal`（1 件）頁籤仍照常顯示，沒有隱藏或合併。
5. `npm test`（97 條）全過、`tsc -b` 過；preview 實測商店 6 個分頁籤（座席・桌椅／吧檯・沖煮・展示／燈・牆飾／地毯・地面／桌上擺件・小物／擺飾雜貨・季節）都能正確過濾出對應家具，裝潢托盤同步可切。

**驗收**：`python3 scripts/build-cafe-ts.py` 重跑應為 no-op（re-run 產出內容不變）；`npx tsc --noEmit` 過；`grep -c "category:" src/data/cafe.gen.ts` 73 件家具都有值，且 6 個 key 分佈為 seating16／counter19／wall14／rug7／tabletop16／seasonal1。

## E7. counter-inside 小家電放寬放置範圍（JJ 需求 2026-07-09）— 純引擎改，美術無交付物

**需求**：`hostType:'counter-inside'` 的 6 件小家電（thermos_rack/shaker_station/ice_machine/coffee_scale/espresso_machine/toaster）目前**只能**放吧檯內側。JJ 要求語義改成「**加法**」：這些是 `z:'surface'` 小物，應該同時可以——
1. **吧檯內側**（現行 E4 路徑，畫在 counter_front 之前、下半被面板遮）——維持不變；
2. **吧檯檯面格**（COUNTER_TOP row3 cols0–7，跟現有檯面小物同機制、畫在 counter_front 之後全露）；
3. **任何 `surface:true` 的 host 桌櫃上**（跟布丁/冰咖啡同機制）。

**引擎改法建議**：放置合法性判斷把 `hostType==='counter-inside'` 從「排他限定」改成「額外允許」——即 canPlace 對這 6 件走一般 surface 規則 ∪ counter-inside 格；渲染分流依「實際落點」決定（落在內側格→E4 路徑、其他→一般 surface 路徑），不是依 hostType 一刀切。

**美術側**：素材/manifest 不用動（sprite 底錨與現有 surface 小物一致）。sHT 1.83–1.91 擺一般桌上會偏大件，屬合理（同 vase 2.36 前例）；若引擎接完 JJ 嫌大再回報、美術重生縮版。

**✅ 引擎已接手完成（2026-07-09，本輪引擎 session；「吧檯格嵌入 vs 檯面」JJ 拍板＝可切換）**：
1. `canPlace`（shop.ts）：counter-inside 件的排他特判整段移除，改走一般 surface 規則＝吧檯格（含店長區 col4/5）＋任何 `surface:true` host 桌面都可放，空地板仍不可。
2. 嵌入降級成**渲染變體**：`PlacedItem` 新增 `top?: boolean`（省略＝嵌內側、true＝檯面全露，比照 facing 只在非預設時存檔）；shop.ts 新增 `rendersInside(p)`（吧檯格＋非 col4/5＋沒切 top 才嵌）與 `canToggleInside(p)`（兩變體都合法才給切）。col4/5（店長視覺區）與桌面上一律強制檯面/一般 surface 路徑。
3. `Shop.tsx` 渲染分流改依 `rendersInside`（實際落點/變體）而非 hostType 一刀切：嵌入→E4 內側層（`COUNTER_INSIDE_Y=145`、counter_front 之前）；檯面→一般 surface 層（`COUNTER_SURFACE_Y=124` 或桌面錨、counter_front 之後）。
4. 裝潢模式選取吧檯格上的小家電時，工具列多一顆「⬆ 放上檯面／⬇ 嵌進吧檯」切換鈕（與 🔄 轉向並排）；預設落點＝嵌內側。
5. `npm test` 101/101（E4 那條 canPlace 測試改寫成 E7 加法語義＋變體/切換鈕條件全覆蓋）、tsc 過；preview 實測：義式機吧檯格預設嵌入（bottom 271px）→ 切檯面（292px、畫在 counter_front 之後全露）→ 切回嵌入，桌面放置合法。sHT 尺度 JJ 還沒看桌上實擺，嫌大再回報重生縮版。

## E8. 招牌布丁「玻璃罩展示座」三層素材（JJ 需求 2026-07-09，方案 A）— 美術已交付，待引擎接線

**背景**：招牌布丁目前是 `Shop.tsx` `.cafe-sign` 一顆 28px 的 🍮 emoji，套 `filter: hue-rotate(${hue}deg) saturate(${sat})`（`PUDDING_BY_ID`，24 種口味）換色。JJ 核定改成實體「黃銅台座＋玻璃罩＋像素布丁」展示座，emoji 換成三張疊圖，hue-rotate 換色機制不變（只是套色對象從 emoji 換成 `pudding.png`）。

**交付檔案**（新目錄 `public/cafe/sign/`，源圖＝引擎顯示的 2 倍尺度，即「引擎顯示減半」慣例）：
1. `stand.png`（88×38px）：黃銅展示台座，薄圓盤檯面＋短柱＋圓底座，右側烤一個斜立小名牌（奶油底＋深色裝飾線條，64px 尺度下可讀出「像招牌」即可，非真實可讀日文字）。
2. `pudding.png`（48×39px）：布丁模具倒扣的經典梯形布丁，暖橘棕本體＋頂面深琥珀焦糖醬（邊緣兩處小圓弧滴痕，非直條/非把手狀），配色刻意貼近現行 🍮 emoji 的暖色調（見下方相容性測試）。**這張會套 `hue-rotate`/`saturate`，跟現在 emoji 用法完全一樣**。
3. `dome.png`（84×82px）：半透明玻璃罩 overlay，alpha ≈ 28–38%（罩體本身、裙邊、高光各自不同 alpha，非單一數值），頂部黃銅小把手（不透明）、左上一道對角高光帶；PIL 手繪（非 codex chroma-key）——因為 chroma-key 去背只能出二值 alpha，做不出玻璃的漸層透明感。

**疊序與定位建議**：
- 渲染疊序（由下到上）：`stand.png` → `pudding.png`（套 `PUDDING_BY_ID[sign].hue/sat`，沿用現有 `hue-rotate(...) saturate(...)` 寫法）→ `dome.png`（無 filter，固定不透明度，玻璃罩不用跟著口味變色）。
- 底部錨在檯面 y≈124（沿用 `COUNTER_SURFACE_Y`）、x 中心沿用 216 附近（現行 `.cafe-sign left:216` 一帶），避開店長視覺區 x102–198。三層水平置中對齊同一 x 中心（stand 最寬、pudding/dome 較窄，都以 stand 的中心線對齊）。
- 垂直堆疊比例（美術端 mockup 實測的堆法，供引擎抓感覺，非強制像素值）：布丁底部疊入 stand 頂盤線下方約 12%（自身高度）做接地；stand 頂盤線落在 stand 圖高度自頂算 22% 處；玻璃罩裙邊在同一頂盤線上方重疊約 10%（自身高度），其餘罩體整個露出、把布丁整個罩住。三層合成後總顯示高度實測約 **51–52px**（源圖疊起來 ~103px÷2），比「2 格／64px」略矮一點；如果實際擺進場景後 JJ 覺得太小，可以在 CSS 整組再放大 1.2× 左右去逼近 64px，不需要重生素材（三張已经用同一比例關係疊，等比放大不會走樣）。
- 顯示層級：三層都畫在店長之後、`counter_front` 之前（跟現行 `.cafe-sign` 同層級），pointer-events 沿用 none（除非要接互動，見下）。

**互動需求（新增，現行 emoji 沒有）**：
1. Hover 顯示口味名 tooltip（沿用 `PUDDING_BY_ID[sign].name`）。
2. 點擊招牌 → 觸發店長切 `love` 姿勢＋動態台詞「本日の看板プリン：〈口味名〉！」（口味名同上）。
3. 可選加分：偶發 ✨ 閃光 CSS（例如玻璃罩上定時淡入淡出一個小光點/sparkle，暗示「今日精選」），非必須。
4. `shop.sign === ''`（未設招牌）時三層都不顯示，行為照舊。
5. 裝潢面板「招牌」分頁（如果有預覽縮圖）建議比照正式渲染，把縮圖從 🍮 emoji 換成 `pudding.png`（可以不套 dome/stand，單純小圖示意即可）。

**Hue-rotate 相容性測試（已驗證，方法可重現）**：用 W3C Filter Effects 規格的 hue-rotate／saturate 矩陣公式（跟瀏覽器 CSS filter 同一套數學），分別套在新 `pudding.png` 和 macOS 系統 🍮 emoji（Apple Color Emoji sbix 點陣，PIL `embedded_color=True` 直接取像素）上，取 8 個代表口味（plain h0／caramel h-15／matcha h70／taro h-130 sat0.8／rainbow h180 sat1.4／gold h3 sat1.6／sakura h-80 sat0.7／blueberry h-160 sat0.7）並排比對：新素材跟 emoji 版的色相偏移方向、飽和度觀感完全一致（matcha 兩者皆轉綠、taro 皆轉紫、sakura 皆轉粉、blueberry 皆轉藍紫），沒有出現新素材套色後「看不出味道」或「整個變灰/變黑」的情況。結論：**24 種口味的既有 hue/sat 數值表不用重調，直接套用在 `pudding.png` 上即可**，因為新素材的基色（暖橘棕）跟 emoji 的暖色調基線夠接近。

**驗收**：三層疊起來且套色正常（至少實測 plain/caramel/matcha/taro/rainbow/gold 六種不出現詭異色）；`sign===''` 不顯示；hover tooltip／點擊切 love 姿勢＋台詞可用；preview 目視三層無明顯縫隙/破圖、跟吧檯場景風格融入（胡桃木/黃銅暖色系一致）。

**✅ codex 總審已補跑（2026-07-09 晚，額度補充後）：可以定案。** 重點結論給引擎：
1. **顯示尺寸不要放大到 64px**——51–52px 的「小型展示物」比例正確，64px 會像主互動物件壓過吧檯；要微調上限 ~56px（推翻上文「可 1.2× 放大」的建議）。
2. 深色口味（深紫/深綠/咖啡）hue-rotate 後可能與罩內陰影相近——布丁素材已有高光與焦糖頂深色層，引擎端不要再對招牌整體加暗色 filter。
3. polish 級可選（不擋定案、之後有空再說）：玻璃罩底緣加 1-2px 冷色亮邊。

**✅ 引擎已接手完成（2026-07-09，本輪引擎 session）**：
1. `.cafe-sign` 從 28px 🍮 emoji 換成三層疊圖（stand → pudding 套 `PUDDING_BY_ID` hue/sat → dome 無 filter），源圖÷2 顯示、依 mockup 比例疊（頂盤線 22%／布丁接地 12%／罩裙 10%），總高 ~52px、底錨 `COUNTER_SURFACE_Y=124`、left 216 沿用；**沒放大到 64px**（遵 codex 定案 ≤56px），也沒對整體加暗 filter。繪序移到店長之後、`counter_front` 之前（依規格）。
2. 互動：talk 模式 hover 出口味名 tooltip（title）＋點擊 → 店長切 `love` 姿勢＋台詞「本日の看板プリン：〈口味名〉！」（注入動態 ShopLine，8s 輪播自然接回一般池）；editing/banner 不可點（pointer-events 依 talk 開關）。`sign===''` 三層全隱藏。✨ sparkle（可選 3）未做。
3. 裝潢「招牌」分頁縮圖從 🍮 換 `pudding.png` 套色（不疊 stand/dome）。
4. 驗收實測（preview）：matcha 綠／taro 紫即時換色、托盤六口味縮圖色相分明無變灰；點擊 love+台詞原子驗證過；`sign===''` 隱藏／設回正常；tsc、npm test 101/101、console 乾淨。


### E8 修訂（2026-07-09 深夜定版）：吧檯版 → 門口「食品サンプル展示櫃」

JJ 看 preview 判定吧檯檯沿太窄破圖，拍板改門口展示櫃。**互動邏輯全部沿用你在 `0663fee` 已實作的版本**（hover 口味名、點擊→love+動態台詞、sign='' 隱藏、托盤縮圖套色），只改三件事：
1. **素材換**：`public/cafe/sign/case_body.png`（88×?木框立櫃）→ `pudding.png`（沿用、縮放至櫃內展示台上，顯示 ~20-24px 高）→ `case_glass.png`（半透明前板 overlay）。舊 stand/dome 棄用但檔案保留（JJ 反悔可切回）。三層 offset 依素材比例 preview 微調（原 agent 中斷、無 mockup 數值，抓「布丁置於櫃內中層、玻璃蓋住展示區」即可）。
2. **錨點**：門口右側 x 中心 ≈360–380、櫃腳底 y≈370（preview 微調），不再避店長區。
3. **繪序＋透明度裁定（美術拍板）**：畫在 `base-fg` **之下**、**不恆亮**——正常模式底緣被前景牆遮（正確景深）；裝潢模式 base-fg 淡到 0.3 時展示櫃跟其他靠牆家具一樣透出，行為一致、不做特例。
**✅ codex 場景審已補跑（2026-07-10，美術 session）：可以定案，無需修改。** 方法：PIL 合成 case_body→pudding（縮至顯示高 19px，置中於櫃內玻璃盒中層）→case_glass，疊上 base.png／base-fg（門口 x 中心 370、櫃腳 y378，落在前牆不透明帶 y373 起算範圍內，故正常模式腳尖被遮～5px；base-fg 淡到 0.3 時腳尖完整透出），出全場景圖＋門口放大圖（正常/裝潢模式各一）給 codex 審。五項結論：1) 融入度＝可（木框色調/像素密度/光影方向跟門框牆面一致）2) 大小＝可（不搶戲、跟門/吧檯家具比例協調）3) 玻璃感＝基本可（前板半透明＋高光有表現，柔和但符合像素風，不建議加強避免變髒）4) 布丁辨識度＝可（放大圖可辨識，全景縮圖下仍看得出是展示物）5) 底緣遮擋＝可（正常/裝潢模式對比自然、無錯切）。跟本節下方「引擎已接手完成（2026-07-10）」的實作錨點（x=370、腳 y=380）數值相近、屬同一設計方向，此審查結論對該實作同樣適用，不需回頭改素材。

**✅ 引擎已接手完成（2026-07-10）**：`.cafe-sign` 換三層 case_body→pudding（沿用套色、置中層架 bottom 26px＝素材架線 y66）→case_glass；櫃中心 x=370、櫃腳 y=380（規格 ≈370 微調下移——前牆不透明帶 y373 起，腳沉牆後 ~7px 才有「底緣被遮」景深）；DOM 移到 aboveCounterOrder 之後、`.cafe-fg` 之前＝base-fg 之下不恆亮（preview 驗證：裝潢模式 fg 0.3、櫃 opacity 1 透出）。互動/隱藏/托盤縮圖全沿用 0663fee 版。stand/dome 檔案保留未引用。preview 對圖：櫃立門右、抹茶布丁在中層、玻璃高光自然；點擊 love+台詞觸發正常。


## E9. Q 版客人「有開店就出現」＋眨眼（JJ 需求 2026-07-09）— 主圖與眨眼幀皆已交付

**素材**：`public/cafe/guests/jj.png`、`yaxuan.png`（331×320、著地線 y=314、與店長 shopkeeper 同規格同尺度）。**✅ 眨眼幀已交付（2026-07-10）**：`public/cafe/guests/jj_blink.png`、`yaxuan_blink.png`（同畫布 331×320、逐像素對齊）。做法＝PIL 手術（膚色填眼區＋畫 2-3px 覆蓋率反鋸齒深色弧線 ︶，末端漸細，比照 `shopkeeper/love.png`／`statue.png` 閉眼風格）；逐像素 diff 驗證過眼區以外（含 6px 緩衝）差異像素數＝0，眼周純視覺改動（jj 785→改良後 1100px、yaxuan 1146px 差異，皆落在眼睛 bbox 內）。codex 兩輪審（第一輪指出弧線偏硬偏黑、膚色補丁矩形感；改用覆蓋率式反鋸齒＋輕微 feather 修過後二審）：**「可以定案」**，兩張皆無誤傷、與角色風格協調。
**顯示邏輯**：`meDone`→顯示我方 Q 版；對方今日完成（attend 的 peer 判定）→顯示對方；身分對應 jj/yaxuan。都沒完成不顯示。
**站位建議**：開放地板區，避開吧檯（rows2–4 cols0–7）、店長（x102–198）、門（x257–331 底部）；建議窗邊 x≈400–470、y≈190–240，兩人同框並肩間距 ~40px（preview 微調）。顯示高 ~88–96px、底部錨定，繪序依 y 深度進一般家具排序或跟店長同批（引擎選省的）。
**動畫**：idle 上下浮動 2px/3s ease。眨眼（幀到貨後）：疊第二張 img、keyframes 每 4–7 秒 `steps(1)` 硬切閉眼 0.12–0.18s，兩人 animation-delay/週期錯開（如 4.3s/5.1s）。
**可選加分（JJ 挑選中、不擋 v1）**：①點擊互動（點自己 sfx＋小跳；點對方→店長台詞「〈名字〉今天也有來喔」）②連續天數徽章（streak≥7 頭上☕、≥30 👑）。

**✅ 引擎已接手完成（2026-07-10，靜態 v1）**：Stage 加 `user?: UserId` prop（店面檢視傳 `me.user`；banner/裝潢不傳＝不畫）；`meDone` 畫我方、`attend−(meDone?1:0)>0` 畫對方，身分 jj/yaxuan 對應。站位窗邊圖心 x≈418/458（本體間距 ~40px）、腳 y=226、顯示高 92px 底錨；繪序跟店長同批（counter_front 前）。idle 浮動 2px/3s、兩人 delay 錯開 1.3s。**眨眼已接（2026-07-10，幀到貨 a0839df 後）**：容器化雙圖（浮動掛容器、blink overlay 硬切 keyframes ~3.5% 週期＝4.3s→0.15s／5.1s→0.18s、相位 delay 1.7s 錯開），Web Animations API 撥時驗證 90% 睜眼/98% 閉眼。可選加分①②未做（等 JJ 挑）。preview 驗證：單人/雙人同框、動畫跑、對方未完成正確缺席。

## E10. 前牆裝潢區：門＆門旁牆可掛（JJ 需求 2026-07-09）— manifest 已交付

**概念**＝E4 的前牆版：暖簾掛門上、燈牌釘門旁牆，畫在 `base-fg` **之上**（掛在最前面的牆表面，永不被遮；裝潢模式牆淡化時掛件維持全亮、更好點選）。
**manifest**：合格件已標 `frontWall: true`（7 件：noren_curtain/neon_coffee_sign/xmas_wreath/vintage_calendar/poster/wall_sconce/menu_board），為**加法**——原本掛後牆照舊。
**槽位（base-fg 實測座標）**：門面槽＝門欄 x257–331、頂緣 y341（暖簾/花圈錨門頂）；門旁牆槽＝底牆帶 y373 起、門左 x40–250 與門右 x340–560（燈牌/掛曆/海報/壁燈錨牆頂緣下）。layout 座標編碼（特殊 row 或獨立欄位）由引擎定。
**渲染**：新層在 `.cafe-fg` 之上；裝潢模式不隨 fg 淡化。

**✅ 引擎已接手完成（2026-07-10）**：layout 座標編碼＝**虛擬前牆列 `FRONT_WALL_ROW=12`**（格系最後一列，一般放置最深 maxRow=11 不衝突）；`canPlace` 加法分支＝frontWall 件落 row12 走一維橫帶碰撞（只跟其他前牆件比、cols 1–16），後牆照舊可掛。渲染 `frontWallOrder` 新層畫在 `.cafe-fg` 之後（恆亮不隨 fg 淡化）；門面槽（cols8–10）錨門頂 y341、門旁牆槽錨牆頂 y373，超出舞台底自然裁切＝近端牆透視。放置格線對 frontWall 件多畫 row12 一列。npm test 108/108；preview 實掛暖簾（門頂）＋コーヒー燈牌（門右牆）對圖、DOM 序在 fg 之後、裝潢模式全亮。

## E11. 檯面放置權統一（JJ 需求 2026-07-09）— manifest 已交付

z=furniture 的咖啡器材/小型展示，現實中本來就擺吧檯上，開放檯面格：manifest 已標 `counterTop: true`（9 件：cold_drip_tower/siphon_rack/grinder/register/pourover_stand/copper_kettle_set/sandwich_case/pudding_mold_shelf/fruit_shelf），**加法**——地板照舊可放。
**引擎**：placement 對這 9 件開放 COUNTER_TOP（row3 cols0–7），底錨 `COUNTER_SURFACE_Y=124`，繪序走現有檯面小物路徑（counter_front 之後、全露）。E7 的 6 件小家電已涵蓋、不用動。

**✅ 引擎已接手完成（2026-07-10）**：`canPlace` 家具分支加 E11 特判——`counterTop:true` 且整件落檯面格＝走檯面住客衝突檢查（別疊小物/別疊其他檯面器材），counterBlocked 不適用；地板照舊（加法）。雙向防疊：surface 小物的 canPlace 也把「已放檯面的 counterTop 家具」算進佔格。渲染變體 `rendersOnCounter(p)`（shop.ts export）：檯面上改錨 `COUNTER_SURFACE_Y`、否則一般家具前緣錨；繪序本來就在 aboveCounterOrder（counter_front 後全露）不用動。格線 row2 起已涵蓋 row3。npm test 107/107（新增 E11 測試含碰撞/變體/非 counterTop 仍擋）；preview 實擺 grinder/cold_drip_tower 上檯面、錨 292px、全露對圖過。

## E12. 珍藏・私物轉蛋系統（JJ 需求 2026-07-09）— 素材已交付（commit 553c077）

# E12. 「珍藏・私物」轉蛋機（ガチャガチャ）系統 — 美術已交付素材，待引擎接線

> ⚠️ 這是美術 session 寫的**草稿**，供監工（Fable）稍後統一併入 `docs/art-to-engine-requests.md`。格式比照既有 E4–E8 條目。本文件本身不動 docs/，也不影響其他 agent 正在編輯的需求單。

**背景**：JJ 拍板，商店「珍藏・私物」（`category: 'personal'`）頁籤改成扭蛋機制——玩家投 80 金幣，隨機開出該分類裡「尚未擁有」的家具，直到全部收集完畢掛「完売御礼」，機台旋鈕鎖住。這是**商店面板 UI 素材**（顯示尺寸較大，比照 `public/cafe/board/` 伝言板的做法），不是場景家具，不佔用 `cafe-catalog.json` 的任何欄位（`personal` 9 件現有家具本身不改動，只是取得方式從「商店購買」改成「抽轉蛋」）。

## 交付素材（新目錄 `public/cafe/gacha/`，已完成，codex 三輪審過定案）

源圖＝引擎顯示的約 2 倍尺度（沿用 `public/cafe/sign/` 的「顯示減半」慣例）。色票沿用鎖定的 `docs/cafe-art-handoff.md` 六色（胡桃木/喫茶綠/酒紅/黃銅/奶油/描邊）。

| 檔案 | 尺寸 | 用途 |
|---|---|---|
| `machine.png` | 200×280 | 機台主體（昭和紅×奶油機身、玻璃蛋倉透出 6 顆膠囊、投幣口「80」字樣、旋鈕**基座**（不含可轉動旋鈕本體）、出蛋口翻蓋、機頂「ガチャ」招牌）。 |
| `knob.png` | 200×280（同畫布，僅旋鈕本體不透明，其餘全透明） | 疊在 `machine.png` 之上、跟機台同錨點的獨立旋鈕層，供引擎 CSS `transform: rotate(...)` 做轉動動畫；旋鈕中心點＝畫布座標 `(100, 198)` 附近（machine 源圖裡旋鈕基座圓心，見下方「錨點」）。 |
| `capsule_closed.png` | 48×48 | 掉出的膠囊（合起狀態，湖水綠上／奶油下雙色）。 |
| `capsule_open.png` | 48×48 | 膠囊打開狀態（上下兩瓣分開，中間露出暗色縫隙），點擊後換這張。 |
| `kanban_soldout.png` | 104×62 | 「完売御礼」小木牌 overlay，全收集後掛在機台上（吊繩造型，建議掛在機台右上角或蛋倉上緣，非固定疊在旋鈕/投幣口上）。 |

**錨點資訊（引擎排版用，皆為 machine.png 源圖 200×280 座標系）**：
- 旋鈕基座圓心：約 `(100, 198)`，半徑 15px（源圖尺度）；`knob.png` 的旋鈕本體同心，直接疊圖再整體 rotate 即可，不需另外裁切對位。
- 投幣口「80」字樣：約 y=158–175 一帶（面板上緣）。
- 出蛋口翻蓋：面板底緣，約 y=228–252。
- 蛋倉玻璃圓心：約 `(100, 86)`，半徑 60×54（供未來若要做「膠囊在玻璃裡彈跳」等動畫效果參考，非必須）。
- 建議整體顯示尺寸：源圖÷2（即 100×140 顯示），比照 `public/cafe/sign` 系列的慣例；實際擺進商店面板後如果 JJ 覺得比例跟其他 UI 元素不搭，美術可重生調整，**不需要重新設計整組構圖**（旋鈕/投幣口/出蛋口/蛋倉的相對位置已经过 codex 三輪審定案，只有整體縮放比例可能需要微調）。

**codex 審查結論摘要**（三輪，供引擎/監工參考，不用重審美術面）：一審抓出玻璃倉太重、膠囊太平均、「80」字樣過小、出蛋口翻蓋存在感弱、木牌文字吃力五點；二審確認機身加高/玻璃倉縮小/前景膠囊放大重疊/coin字放大描邊/木牌加粗都有效，但玻璃陰影稍重、木牌仍偏小；三輪修正（玻璃陰影降強度、木牌整體放大 8%）後 codex 判定**「能定案」**。全套素材已过風格一致性檢查（跟 `board/panel.png`、`assets_src/cafe/anchor-furniture.png` 同色票、同柔邊像素材質，並做了輕度 RGB posterize 收斂插畫感漸層）。

## 需求細節（引擎待做，美術這邊到此為止）

1. **personal 頁籤改渲染機台**：`ShopPanel`（或未來的 `DecoratePanel` 對應分頁）裡 `category==='personal'` 這個分頁的內容，從現有的「家具列表」UI 換成「機台＋收藏格」版面。建議布局：機台置中（比照 mockup：機台佔上半，下方是收藏進度網格，一格一件、擁有的顯示全彩圖示，未擁有的顯示灰階剪影＋`？`）。素材清單見上表，機台/膠囊/木牌都已就緒；收藏格直接複用各件 `sprite` 縮圖即可，不需要新素材。

2. **一轉 80 金幣**：新增常數 `GACHA_COST = 80`（建議放 `shop.ts` 或 `shopstate.ts`，跟現有 `coins` 扣款邏輯同檔）。點擊旋鈕 → 檢查 `coins >= GACHA_COST` → 扣款 → 觸發抽獎。

3. **抽池規則**：抽池 = `CAFE_ITEMS.filter(it => it.category === 'personal')` 裡「**該玩家 stock（已擁有）為 0 且尚未抽過**」的件。均勻隨機抽取（不用權重），**保底不重複**——即同一件抽中後從抽池移除，不會重複抽到已擁有的。目前 `personal` 共 9 件（`vest_yaxuan`/`signboard_yaxuan`/`golf_bag`/`snowboard`/`camera_retro_digital`/`tesla_model`/`figure_chiikawa`/`figure_hachiware`/`figure_usagi`），新加的 personal 件會自動加入池子（見第 7 點）。

4. **中獎動畫序列**：
   - 機身 shake 動畫 0.4s（CSS keyframe，機身左右輕微搖晃，模擬扭蛋機出蛋前的震動）。
   - `capsule_closed.png` 從出蛋口位置掉出、落到收藏格上方（簡單的落下+輕微彈跳 CSS transition 即可，不需要物理引擎）。
   - 玩家點擊掉落的膠囊 → 圖片換成 `capsule_open.png`。
   - 顯示「出貨卡」（一張小卡片，顯示中獎家具的 `name` + `sprite` 縮圖），確認/關閉後該件计入玩家 `stock`。

5. **入 stock**：中獎家具比照現有「購買」邏輯 `stock += 1`（或現有欄位名稱，需引擎核對 `store.ts` 现有 stock 資料結構），使其可以被拿去裝潢面板放置。

6. **全收集判定**：當玩家在 `personal` 分類的 9 件（含未來新增件）全部 `stock >= 1` → 機台掛 `kanban_soldout.png`（overlay，建議掛機台右上角或蛋倉上緣，非硬性疊在旋鈕上）、旋鈕變 disabled（不可再點擊/不再觸發抽獎、CSS 视觉上可以加灰階濾鏡表示鎖定）。

7. **新 personal 件自動入池**：抽池的 filter 條件是動態算的（`category==='personal' && stock===0`），只要美術之後在 `cafe-catalog.json` 新增 `category:'personal'` 的家具並跑過 `build-cafe-ts.py`，該件會自動出現在池子裡，**引擎不需要為新增 personal 件另外加程式碼**（沿用第 3 點的 filter 邏輯即可）。

8. **personal 分類免等級鎖**：現有商店家具多半有 `lv` 等級限制（`lv:1/2/3`），但 personal 分類的 9 件目前 `lv` 欄位仍照舊填了數字（1-3，见 `cafe.gen.ts`）。**改成轉蛋制後，personal 分類應整體跳過等級檢查**——玩家不論店等級多少，只要有 80 金幣就能抽，不受 `lv` 限制。引擎需要在判斷「這個分類/這件家具是否鎖等級」的地方，對 `category==='personal'` 的件加一個例外（或者其實更簡單：既然 personal 已經不走「購買」路徑而是走「抽獎」路徑，`lv` 欄位對它們可能整個不再適用，等級檢查邏輯本來就不會經過抽獎這條路，需要引擎確認現有 `lv` check 是否只掛在「購買」流程上，如果是，這點可能自動滿足、不需要額外改動）。

9. **金幣不足**：`coins < GACHA_COST` 時旋鈕視覺上 disabled（灰階/降低不透明度）＋ hover 顯示 tooltip（例如「金幣不足（80）」），不可點擊觸發抽獎。

## 驗收建議

- `personal` 頁籤能看到機台＋收藏格，9 格初始依玩家現有 `stock` 顯示彩色/灰階。
- 金幣≥80 時點旋鈕 → 扣 80 金幣 → shake → 掉膠囊 → 點膠囊開蛋 → 出貨卡顯示家具名+圖 → 該格從灰階變彩色、`stock+1`。
- 抽到已擁有的件不應該發生（保底不重複邏輯）；9 件抽完後機台掛完売御礼、旋鈕 disabled。
- 金幣<80 時旋鈕 disabled＋tooltip，點擊無反應、不扣款。
- 之後美術若新增 personal 分類家具，重跑 `build-cafe-ts.py` 後應自動出現在抽池，不需要引擎再改程式碼。

## 界線說明（供監工併入時參考）

本輪美術 session 只交付 `public/cafe/gacha/` 五個素材檔＋這份草稿，**沒有動 `docs/`、`src/`、`cafe-catalog.json`、其他 `public/cafe/` 目錄**，也沒有執行任何 git 指令。上述「引擎待做」1–9 點全部是引擎的活；美術這邊在素材定案（codex 三審通過）後即完工。

**✅ 引擎已接手完成（2026-07-10）**：商店 personal 分頁改渲染轉蛋機（機台＋knob 同畫布旋轉層 transform-origin (50,99)＋完売掛牌＋收藏格）。一轉 `PERSONAL_GACHA_COST=80`（shop.ts），比照購買「先 commitShop 成功才扣金幣」；抽池動態 filter（personal 且 stock=0，新增件自動入池、抽中離池保底不重複）；等級鎖天然不適用（不走 buy 路徑，需求 8 確認成立）。動畫：shake 0.4s→膠囊掉落彈跳（可點）→開蛋→出貨卡（名＋sprite＋flavor＝E13②）。全收集掛完売御礼＋旋鈕鎖；金幣不足 locked＋tooltip。preview 實測 11 連轉 11 個不重複、15/15 收齊鎖機、金幣精確 −880。

## E13. 家具 flavor 文案顯示＋布丁圖鑑補說明（JJ 需求 2026-07-09）— 內容與管線已交付

# E13 草稿：家具一句話 flavor 文案顯示

⚠️ 這是 scratchpad 草稿，未同步進 `docs/art-to-engine-requests.md`（依任務界線不可動那份文件，由監工彙整時手動搬過去）。

## 背景

新增 `docs/cafe-flavor.json`（133 件家具的一句話 flavor 文案）＋ `scripts/build-cafe-ts.py` 已接線：`CafeItem` 介面新增 `flavor: string` 欄位，`CAFE_ITEMS` 每筆資料已帶入對應文案（查無 id 時為空字串 `''`）。語氣為「一本正經講幹話」：平靜陳述事實或荒謬情境，不加語氣詞、不自己笑。少量句子是「俗語結尾劫持」型諧音（例：`goldfish_bowl`「金魚缸，年年有魚，布丁沒有」），其餘皆一般深句。

## 待辦（E13，供引擎端排入）

### ① 商店購買卡：卡名下方 flavor 小字
- 位置：商店家具購買卡（card），家具名稱正下方加一行小字顯示 `item.flavor`。
- 樣式建議：比家具名字級小（約 60–70%）、低對比色（不搶名稱），單行截斷即可（文案已控制在 4–16 字，不會太長）。
- 條件：`flavor === ''` 時該行**完全不渲染**（不留空白佔位，避免卡片高度不一致或出現空行）。

### ② 扭蛋出貨卡（E12）：家具名下方顯示 flavor
- 沿用 E12 扭蛋出貨卡既有版式：布丁出貨卡已經在家具名下方顯示 `desc`（一句話）的位置與樣式，直接比照套用在「家具」出貨卡，改讀 `item.flavor` 而非布丁的 `desc`。
- 即：家具開箱卡片視覺上應該跟布丁卡一致（同一套排版元件最好），只是資料來源換成 `CAFE_ITEMS[id].flavor`。
- 條件同上：`flavor === ''` 不渲染該行。

### ③ 裝潢托盤（家具擺放/庫存 tray）：hover tooltip
- 玩家在裝潢模式把家具擺進房間、或在托盤/庫存列表 hover 家具圖示時，tooltip 內加一行 flavor 文案（可以放在家具名稱下方，或現有 tooltip 內容的最後一行）。
- 條件同上：`flavor === ''` 不顯示這一行（tooltip 其餘資訊如常顯示）。

### ④ 布丁圖鑑：補顯示既有 `desc`
- 這條**不是新資料**，布丁的一句話說明資料本來就在 `src/data/fun.ts` 的 `PUDDINGS[].desc`（如 `chestnut: '秋天限定的心情'`），純粹是布丁圖鑑 UI 目前沒有把這個欄位渲染出來。
- 待辦：布丁圖鑑頁面/ 元件，補一行顯示 `PUDDING_BY_ID[id].desc`（或等效存取方式），不用改資料層，只是 UI 補渲染。
- 建議樣式與①②③ 一致（小字、低對比），維持全站一致的「flavor 小字」視覺語言。

### ⑤ 通用：flavor 為空字串時的處理
- 全部 4 個顯示點（①②③④）共用同一條規則：`flavor`（或布丁的 `desc`）為空字串時，該行不渲染，不佔版面、不留空隙。
- `CafeItem.flavor` 目前應該不會有查無資料的情況（133 件全數覆蓋，含 6 件在途家具），但未來 catalog 新增家具、`cafe-flavor.json` 還沒跟上時會 fallback 為空字串，這條規則是保險。

## 資料來源速查

| 顯示點 | 資料欄位 |
|---|---|
| 商店購買卡 | `CafeItem.flavor`（`src/data/cafe.gen.ts`，由 `docs/cafe-flavor.json` 產生） |
| 扭蛋出貨卡（家具） | 同上，`CafeItem.flavor` |
| 裝潢托盤 tooltip | 同上，`CafeItem.flavor` |
| 布丁圖鑑 | `PUDDINGS[].desc`（`src/data/fun.ts`，既有資料，只差 UI 渲染） |

**✅ 引擎已接手完成（2026-07-10）**：①商店購買卡名稱下加 `.ci-flavor` 小字（10px 低對比單行截斷）②扭蛋出貨卡帶 flavor（E12 落地時一併）③裝潢托盤 tray-item 加 title tooltip④布丁圖鑑擁有格補 `.pud-desc` 一行（PUDDINGS.desc 純 UI 補渲染）。四處共用「空字串完全不渲染」規則。preview 驗商店卡/出貨卡實文案。

## E14. Q 版客人「自訂台詞」互動（JJ 拍板 E9 加分①，2026-07-10）— 設計定稿，引擎接

**功能**：點**自己的** Q 版客人 → 彈輸入框設定一句自訂台詞（建議上限 20 字，存檔同步）；**對方**進店看得到。點**對方的**客人 → 顯示對方設定的那句（沒設定就顯示預設「〈名字〉今天也有來喔」由店長講或氣泡帶過，引擎擇一）。

**氣泡防雜訊規則（JJ 明確關切：店長氣泡已常擋東西，三個氣泡會災難）**：
1. **客人氣泡不常駐**——平時只在客人頭上顯示一個小 💬 指示點（有自訂台詞才亮）；點了才彈氣泡、顯示 ~4 秒自動淡出（沿用店長 bubble-cycle 的節奏）。
2. **全域同時只有一個氣泡**：彈出客人氣泡時抑制店長的自動碎念氣泡（該輪跳過）、也關掉另一位客人的氣泡；反之店長被點時關客人的。
3. 氣泡錨在該客人頭上、寬度上限比店長氣泡窄（~180px）、貼近畫面右緣時自動左翻。
**儲存**：每人一句、跟裝潢同等級的同步需求——建議走 `/api/shop/board` 同款 KV 模式（或 shop state 加欄位），新舊客戶端相容比照 finding #1 的遷移手法。worker 有改就要記得 `wrangler deploy`。
**美術**：無新素材（💬 指示點用 CSS/emoji 即可；要像素版再開單）。

## E15. 亞軒的貓「粉圓」常駐入店（四姿勢，2026-07-10）— 素材已交付，待引擎接線

**概念**：貓不管你有沒有上課——**不受 `meDone`/`attend` 影響**，開店永遠在，跟 Q 版客人（E9）邏輯完全獨立。每 10 分鐘時間決定論換一個定點，換位不用動畫（貓的瞬移是特性）。

**素材**：`public/cafe/cat/{sit,groom,flop,roll}.png`，四張皆 RGBA、統一畫布 **80×68px**、著地線 **canvas 內 y=62**（bottom 留 6px 緩衝，不觸邊）、內容已水平置中於畫布（canvas 中心 x=40）。四張用**同一組全域縮放係數**（不是各自獨立 fit-to-canvas）處理，因為源圖（JJ 提供、`/Users/huangchengchieh/Desktop/q版人/粉圓/` 四張 UUID 檔）經量測本來就是同一批次同一原生尺度（sit/groom 兩張坐姿 crop 高度 812px/806px 幾乎相等，證實批次原生比例一致），維持姿勢間的真實相對大小差異（坐姿較高窄、仰躺較寬扁，符合直覺、不強拉同高）。

| slug | 姿勢描述 | 內容尺寸(px) | 內容 bbox（画布內） |
|---|---|---|---|
| `sit` | 端坐、雙前腳併攏垂直於身前、正面朝觀者、尾巴貼身捲左側 | 30×46 | x25–54, y16–61 |
| `groom` | 坐姿、頭略向左低垂舔左前爪整理毛 | 35×46 | x22–56, y16–61 |
| `flop` | 仰躺露白肚、前腳彎抬胸前、一後腳舉起露粉色肉球、尾捲右下（暖色調） | 50×41 | x15–64, y21–61 |
| `roll` | 與 `flop` 同姿勢的另一張源圖（構圖近乎重複，僅色調偏冷灰），已用 PIL 後製（+4.5% R、-3.5% B、飽和度+12%）調暖貼近 `flop`，兩者放同輪換池不會色差跳出 | 50×41 | x15–64, y21–61 |

**去背**：源圖背景是烘焙進 RGB 的灰白棋盤格佔位圖（非真 alpha，四張皆 `alpha≡255`），已用邊界 flood-fill（連通元件、色距 tol=45，手法同 `scripts/fix-shopkeeper-pose.py`）去背＋緊裁，LANCZOS 縮放邊緣自然羽化，無殘留棋盤格色邊。

**尺度錨定（已用 codex 模擬比對）**：坐姿內容高 46px／客人顯示高 116px≈40%／店長顯示高 96px≈48%——codex 結論**「合適」**：不搶客人/店長戲、細節仍可辨識。**不建議**放大到 55px+（會逼近主角存在感）或縮到 36px 以下（花紋細節流失）。建議引擎**不對 80×68 畫布再做 CSS 縮放**（1:1 直接用，最省事也不會破壞已校準的相對尺度）；若要縮放請務必等比、四張共用同一比例。

**點位表**（4 點位，座標為 stage 絕對座標，比照現有 `GUEST_FEET_Y`/`COUNTER_SURFACE_Y` 慣例——CSS `bottom = STAGE_H(416) - y`；`left = x - 40` 讓畫布中心對齊；**下列座標為 preview 起點，請微調**）：

| # | 點位 | 錨點 (x, y) | 建議 pose | 備註 |
|---|---|---|---|---|
| ① | 吧檯檯面右段 | x≈230, y=124（＝`COUNTER_SURFACE_Y`） | `roll` | 蜷在檯面上；繪序走 `counterTop` 小物路徑（`counter_front` 之後、全露），親測落在檯面右段（收銀機右側空檔）不會蓋到玻璃罩展示座（E8，x≈352起） |
| ② | 吧檯前地板、綠凳邊 | x≈70, y=220 | `sit` | 略偏左，避開 E9 客人站位（guest-me/peer 落在 x98–270 一帶）；繪序走一般地板家具深度排序（腳底 y baseline） |
| ③ | 窗邊地板 | x≈450, y=200 | `groom` | 窗邊曬太陽舔毛，意象合；繪序同②的地板深度排序 |
| ④ | 門口展示櫃旁 | x≈350, y=370 | `flop` | 原提案 x≈330 實測會疊到門本體（`base-fg` 門框），已挪至展示櫃（E8 x≈352）左側清空區；進門先看到一隻攤平的貓，反差可愛；繪序同②③ |

四點位已各配一種姿勢、彼此不重複，`spotIndex = floor(Date.now() / 600000) % spots.length`（`spots.length=4`）即可直接映射到上表順序。若引擎想擴到 5–6 點位，`flop`/`roll` 可分開用在不同點位當第 5 個變體（兩者現在色調已校過，混用不會顯眼）。

**繪序**：地板點位（②③④）比照 E9 客人「腳底 y baseline」規則併入既有深度排序（`GUEST_FEET_Y` 那套 before/after 分流）；檯面點位（①）併入 `counterTop` 家具的繪序（`counter_front` 之後，跟檯面小物同層）。

**動畫**：無強制要求；可選比照客人 `guest-bob`（2px/3s ease）做輕微 idle 浮動，或完全靜止（貓本來就常常一動不動）。換位本身不用轉場動畫。

**可選加分（不擋 v1）**：點擊粉圓 → 小 sfx＋頭上冒「…」或「ニャ」2 秒後淡出。這顆氣泡固定 2 字內、極短，**不算入 E14「全域同時只一個氣泡」的管制**（設計上跟店長/客人氣泡不衝突，可同時存在）；貓不理人是本體，不用其他互動反饋。

**QC 記錄**：四姿勢並排圖＋「店長＋客人＋粉圓」同框比例模擬＋吧檯檯面/窗邊地板兩張場景模擬，皆已過 codex 審查，結論**「可定案」**（去背乾淨、比例協調、場景融合自然；唯一提出的優化建議「`roll` 調暖」已處理）。

## E16. 成就大擴充：+30 店鋪型成就＋徽章像素化重做（JJ 拍板「越多越好」，2026-07-10）

**現況**：`src/lib/xp.ts` ACHIEVEMENTS 13 個學習型、emoji icon。**引擎要做**：①check 簽名擴充成可讀 ShopState（layout/stock/coins/扭蛋收集）與新計數器 ②新增 30 成就 ③icon 從 emoji 換像素徽章（素材見下、美術另批交付）④成就頁 grid 對應更新。

**Tier A（現有狀態直接判定，先做）**：
| id | 名 | 條件 |
|---|---|---|
| shark-keeper | 鯊魚飼育員 | layout 同時 3 隻 shark_plush |
| gacha-complete | 完売御礼 | personal 扭蛋池全收集 |
| pudding-tycoon | 布丁大亨 | 布丁圖鑑集滿 |
| miser | 守財奴 | 金幣 ≥1000 |
| pudding-freedom | 布丁自由 | 金幣 ≥2000 |
| interior-designer | 室內設計師 | layout ≥30 件 |
| onion-gravity | 蔥有引力 | 擁有 claw_machine_onion＋green_onion_pot |
| this-is-taiwan | 這裡是台灣 | 擺出 5 件台式件（id 清單：rice_cooker_tatung/figure_tatung_baby/candy_cabinet/chair_red_plastic/barber_pole/pinball_machine_small/soda_crate/altar_lamp_mini/mesh_cupboard/soda_fridge_glass/round_table_lazy_susan/tv_wooden_retro/karaoke_jukebox/mailbox_green/lantern_pair_temple/bus_stop_sign/thermos_flower/fan_standing_retro/poke_lottery_box/marble_jar/snack_box_crate/ring_toss_stall/bento_stack_steel/fortune_stick_tube/jiaobei_pair/spring_couplet/daily_calendar_tear/payphone_orange/guangming_lamp_tower/betel_neon_pole/rolling_shutter_half/utility_pole/school_desk_chair/papaya_milk/mango_shaved_ice） |
| second-best | 第二名的男人 | 擁有 trophy_second_best |
| under-construction | 施工中 | 擺出 traffic_cone＋cement_bag＋tire_stack |
| first-deco | 初擺設 | 第一次擺任何家具 |
| full-course | 滿漢全席 | 同時擺 6 樣食物小物（napolitan_spaghetti/thick_omelette_sandwich/hot_cake/cream_soda/pudding_parfait/iced_coffee/lemon_soda/papaya_milk/mango_shaved_ice/香蕉船類） |
| green-thumb | 綠手指 | 同時擺 5 件植物（potted_plant/monstera_floor/green_onion_pot/inflatable_palm/kadomatsu/tanabata_bamboo） |
| zoo-keeper | 動物園 | 同時擺出 shark_plush＋standee_shopkeeper＋吉伊卡哇三隻任一 |
| couch-potato | 沙發馬鈴薯 | 同時擺 pudding_sofa＋米飯抱枕(rice_pillow？未做→改 tv_wooden_retro) |
| regular-100 | 老主顧 | sessionsDone ≥100 |
| double-perfect | 完食 | 布丁圖鑑＋扭蛋雙滿貫 |

**Tier B（要加輕量計數器，次做）**：panda-clicks-50 查水表（點店長50次）／night-owl 凌晨的執念（0-4點完成任務，記完成時戳）／big-spender 一擲千金（單日花費500，日花費計數）／minimalist 極簡主義（連3天開店且 layout 空）／duo-streak-7 雙人全勤（兩人同天完成連續7天）／line-fan-100 熊貓的頭號粉絲（台詞輪播100句）／gacha-addict 扭蛋沼（單日轉5次）／cat-person 貓奴認證（點粉圓20次，依賴E15）／jetlag 時差經營（清晨6-9與深夜23-24各完成過）
**Tier C（複雜，可延後）**：已讀不回（對方留言10則未回）／過馬路請牽手（斑馬線毯＋兩人同日出席）

**徽章素材**（美術另批交付 `public/cafe/badges/<id>.png`，含既有 13 個重做）：40×40 像素圓章，統一黃銅環＋奶油底＋中心 icon；未解鎖顯示灰階（引擎 CSS filter 即可，不用出灰版）。素材到貨前新成就先用 emoji 頂著上線，不互卡。
