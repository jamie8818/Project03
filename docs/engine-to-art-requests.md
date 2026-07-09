# 引擎 → 美術 需求清單（日々喫茶 Shop v2）

> 引擎 session 開的介面需求。美術 session 做完這些，引擎才能收尾 task 3/4 與精修 ①④。
> 介面契約見 `shop-v2-spec.md` §分工。**這些欄位/資產由美術改 manifest（`cafe-catalog.json`）＋重跑 `build-cafe-ts.py`，引擎只讀。**

## 🔄 現況核對（2026-07-09 引擎 session 補；**讀這節，蓋過下面過時內容**）

引擎端用 live code 對過 `cafe-catalog.json` / `cafe.gen.ts` / `public/cafe/`。下面 §A–§D 大半已交付，**真正還卡引擎收尾的只有兩張美術活**：

**🔴 還缺、卡引擎收尾（請先做）**
- **§C-2 `public/cafe/base-fg.png`（前景層）— 仍缺。** 門＋底部整面牆去背、576×416 對齊 base；引擎 `.cafe-fg` 早接好、缺圖自動略過不破圖。小而快，**建議先出這張**。（JJ 擴大需求：不只門，連底部整面牆帶都要進這層。）
- **§C 吧檯拆層 — 仍缺（大工）。** JJ 四需求裡唯一沒完成的（店長站吧檯裡面＋檯面裡放小家電）。引擎現以硬編假料頂著（`COUNTER_TOP` ＝ row2 cols1–6＋兩端翹角＋row3、`COUNTER_SURFACE_Y=124`、`counterBlocked` rows2–4 cols0–7；**非 §C 舊文寫的 row2 cols1–6 / y=96**）。三項交付見 §C。

**🟡 順手、能讓引擎拆掉硬編（非急）**
- **§A manifest 兩欄仍未加**（對過 catalog：`spriteHeightTiles` 0 筆、host 家具也沒 `surface` 旗標）：
  - `surface`（桌/櫃頂/層架 true、椅凳沙發卡座 false）→ 拆掉引擎硬編白名單 `SURFACE_HOSTS`。
  - `spriteHeightTiles`（視覺高度/格）→ 取代 runtime aspect 快取＝決定性座位。
  - （§A-3 的 `facings` **已完成**，見下。）

**🟢 §A–§D 裡已交付/已完成（別重做）**
- **四向 sprite 已到齊**：`catalog/*_{back,right,left}.png` 共 **21 張** → §D 四向、旋轉已能視覺化。
- **拆單件已完成**：`table_round`(1×1)、`table_square`(2×1) 已重畫成桌本體（§D-5 完成）。
- **§B candle 落點已修**：`STARTER_LAYOUT` 裡 candle 與 table_round 都在 `(5,6)`、已坐桌上。**§B 整節作廢、別再做。**
- **伝言板**：素材全到齊、**引擎端已接完**（牆板可點＋菜單風對話面板＋左右對話框＋append-only union 合併），**結案**。

**⚫️ 死路別理**：`counter_front.png` 與 `engine-coords.md` 的舊吧檯做法引擎沒採用；§C 一律以本檔為準。

**建議排序**：base-fg.png（小快）→ 吧檯拆層（大工、價值最高）→ §A 兩欄（順手）。

---

## A. manifest 欄位擴充（`cafe-catalog.json` → 重跑產生器）

引擎目前用「引擎端硬編」暫代下列欄位，等你把它們升成 manifest 欄位就切過去：

1. **`surface: true`（家具可放小物旗標）**
   - 現況：引擎端白名單 `SURFACE_HOSTS`（`src/lib/shop.ts`）＝ `table_round, table_square, table_low, pastry_case, bottle_shelf`。
   - 需求：在 manifest 每件加 `surface` 布林（桌／櫃頂／開放層架＝true；椅/凳/沙發/卡座＝false）。引擎會改吃 `it.surface` 取代白名單。
2. **`spriteHeightTiles`（視覺高度／格）**
   - 現況：引擎在 runtime 讀 sprite 的 naturalH/W 算 host 桌面高度，好把小物坐到桌面上（`Shop.tsx` 的 `spriteH`）。能動，但要等圖載入、且非決定性。
   - 需求：manifest 標每件的視覺高度（格），引擎改用它算桌面高度＝決定性、免等載入。
3. **`facings` 清單（四向）**
   - 只加這**一個**欄位就夠了；sprite 檔名與左右鏡像由引擎按 §D 慣例自動推導，manifest 不用寫路徑。
   - 完整命名/schema 慣例見 **§D**（美術先看那份再生圖）。

## B. STARTER_LAYOUT 的 candle 落點（`cafe.gen.ts` 由 manifest 產）

- 現況：`candle` 開局擺在 `(5,5)`，但 `table_round` 在 `(5,6)`（佔 5,6/6,6/5,7/6,7）——candle 沒落在桌上。
- 新規則（surface 小物只落 host）下它變「孤兒」，引擎會退回地板錨定（不消失，但看起來像浮在地上）。
- 需求：把 candle 挪到 `table_round` 的桌格上（例如 `(5,6)` 或 `(6,6)`），開局才漂亮。

## C. 吧檯拆層（task 3 / spec §7 · v2-D）

「檯面裡放小家電」＋「正面板擋下半身」＋「店長站吧檯裡面」都卡在這。

- 需求 1：把左上 L 形吧檯**從 `base.png` 拆出**，另出一版**不含吧檯的 base**。
- 需求 2：吧檯拆成可分層畫的 sprite——至少「**吧檯本體＋正面板**」一層（引擎會把它畫在內側小家電＋店長下半身**之前**當遮擋）。
- 需求 3：定義吧檯的**檯面格**（檯面上）與**內側開放格**（檯面裡）座標。
  - 引擎暫用虛擬 host：`COUNTER_TOP = row2, cols1–6`＋`COUNTER_SURFACE_Y=96`（`shop.ts`/`Shop.tsx`，preview 對圖鎖的）。拆層後改吃你定義的正式格。

## C-2. 前景層 base-fg.png（門/牆蓋在家具之上＝景深）

需求：靠門（畫面最下方）的家具要被門/牆擋住＝前後景深。`base.png` 是平圖沒去背，引擎沒法只把門切出來疊上去（我試過用矩形裁 base 疊，邊緣會帶到地板，很不行、已撤）。

- 請出一張 **`public/cafe/base-fg.png`**：**同尺寸 576×416**、與 base.png 對齊；**門＋（要蓋的）牆不透明、其餘全透明**。
- 引擎已接好：偵測到這張就畫在所有家具之上（`.cafe-fg`）；沒有這張時自動略過（onError 關掉，現在就是這狀態、不會破圖）。
- 裝潢模式我會把它調淡到 30% opacity，讓被門擋住的家具還看得到、也點得到（解「東西藏門後選不到」）。
- 範圍你決定：只做門即可，或連底牆基座/側牆一起（要蓋到哪就畫哪，其餘透明）。

## D. 四向 sprite schema ＋ 拆單件（task 4 / spec §2、§8 · v2-E）

> **這節是引擎定死的檔名/schema 慣例，美術照這生一次就對、不用改名重來。**

### D-1. 四向模型（引擎已就緒）
- 四向：`front`（預設）/ `back` / `left` / `right`。
- footprint：`front`/`back` 用 `w×h`；`left`/`right` 自動對調成 `h×w`（碰撞格一起轉，`footprintDims` 已實作）。
- 旋轉鍵循環順序：**front → right → back → left → front**，沒有的向自動跳過。
- 靠牆對應（美術要知道語意，spec §2）：上牆＝front、下牆＝back、**左牆＝right 向**、**右牆＝left 向**。

### D-2. 檔名慣例（`public/cafe/catalog/`）— **關鍵：現有 front 圖不改名**
| 向 | 檔名 | 備註 |
|---|---|---|
| front | `<id>.png` | **＝現有 30 張，維持原名不動** |
| back | `<id>_back.png` | 加檔 |
| right | `<id>_right.png` | 加檔（面朝畫面右） |
| left | `<id>_left.png` | 只有「真有向」才畫；左右對稱件**不用畫**，引擎自動水平鏡像 `_right` 產生 |

**鏡像規則**：左右對稱件只畫 `_right`，引擎自動翻出 `left`。只有真正左右不對稱（L 卡座、貴妃椅、吧檯本體）才另畫 `_left`。

### D-3. manifest 只加 `facings`（列出「實際有畫的檔」）
對照 spec §2 張數表，三型：
| 型 | 例 | `facings` 值 | 要畫的檔 |
|---|---|---|---|
| 徑向對稱（圓桌/圓凳/盆栽，且正方 footprint） | table_round | `["front"]` 或省略 | 只 `<id>.png`；旋轉鍵對它 no-op |
| 前後不同＋左右鏡像 | chair_velvet、sofa_two、pastry_case | `["front","back","right"]` | `<id>.png`＋`_back`＋`_right`（left 引擎鏡像） |
| 真有向（四張都不同） | booth_corner(L)、吧檯本體 | `["front","back","left","right"]` | 四張都畫 |
- 省略 `facings` ＝ 當 `["front"]`（現有 30 件不動照樣能用）。
- 引擎只吃 `facings`；缺的向自動用鏡像或跳過。`cafe.gen.ts` 只要多帶 `facings?: Facing[]`，路徑引擎算。

### D-4. 側向 sprite 的畫布寬（重要，別畫錯尺寸）
- front/back 寬 ＝ `footprint.w × 64px`（同現在）。
- **left/right 寬 ＝ 旋轉後的佔地寬 ＝ 原 `footprint.h × 64px`**（因為轉向後視覺寬跨的是 h 格）。高度照自然比例往上長（overhang）。
  - 例：sofa_two `3×1` → 側向佔地 `1×3` → 側圖寬 `1×64=64px`、沿牆縱深 3 格用 overhang 表現。

### D-5. 拆單件（方桌四椅／雙人圓桌 → 桌＋椅）
- **schema 不用做「套組」概念**——每件都是獨立 `CafeItem`，各自能買/擺/旋轉。這點引擎現在就支援，不用改。
- 美術要做的：把桌 sprite **重畫成不含椅子的桌本身**、footprint 縮到桌子實際佔地；椅子用獨立項（`chair_velvet` 已存在，風格不同再加 `chair_wood` 之類）。
- id 慣例維持：桌 `table_*`、椅 `chair_*`/`stool_*`、沙發 `sofa_*`、卡座 `booth_*`。
- 建議沿用原 id（如 `table_square` 改指桌本身圖），舊存檔才不斷；footprint 若縮小，引擎 `canPlace` 會重驗、已擺的只是變小不會崩。

## E-bug 回報：cozy.png 右側切邊（2026-07-09，JJ 截圖回報）

店長 `cozy`（趴睡）姿勢**圖檔本身**右側被切平——引擎已排除自身嫌疑（渲染完整畫布、base-fg 該區全透明、counter_front 只在 y118–202、無 CSS 裁切）。證據＝alpha 剖面：`public/cafe/shopkeeper/cozy.png` 在 **x=321 有 150px 高的懸崖**（x321 有 150 個不透明像素、x322 起全 0；圓弧收尾應漸減）。其餘 15 張姿勢掃過都乾淨。上次「修 4 張切邊」可能漏了 cozy 或又 regress。請重出這張（身體右側補完整），檔名不變、丟回原位即生效。

## 引擎這邊已就緒（給你對介面）

`src/lib/shop.ts`：
- `footprintDims(it, facing)`：facing=left/right 時 w↔h 對調（碰撞格一起轉）。
- `frontRowOf(p)`、`canPlace(layout,id,gx,gy,ignoreIndex?,facing?)`、`findSpot`：全 facing-aware。
- `renderOrder`：L0 毯→L1 地板家具（前緣 y-sort）→ 小物緊接 host 之後（寄生、兩桌重疊不錯層）→ L3 壁飾 → 孤兒小物墊頂。
- `isSurfaceHost` / `isSurfaceGuest` / `hostIndexOf` / `guestIndicesOf`（搬 host 連帶收小物）。
- `COUNTER_TOP` / `isCounterTop`（吧檯檯面虛擬 host）。

`src/components/Shop.tsx`：
- 接地陰影只有 `z==='furniture'` 畫（小物在桌上不投地影）。
- surface 小物坐在 host 視覺桌面（`host前緣 − host視覺高 + TABLE_INSET`）；吧檯檯面用 `COUNTER_SURFACE_Y`；孤兒退地板。
- `PANDA_CX/PANDA_TOP`、`.cafe-sign`、`BANNER_H`：等 C 的無吧檯 base 出來再一起把店長挪進吧檯裡面。

## 驗收對照（JJ 四需求現況）

| # | 需求 | 狀態 |
|---|---|---|
| ① | 家具四向、footprint 隨向轉 | ✅ 幾何引擎（單元測試過）＋四向 sprite 21 張已交付、旋轉可視覺化 |
| ② | 桌椅拆單件＋旋轉鍵 | ✅ table_round/square 拆成桌本體、旋轉鍵就地轉（含桌上小物一起繞） |
| ③ | 分層嚴謹、小物只落桌/檯面、不掉椅子下 | ✅ 完成（引擎＋瀏覽器驗證：椅子/地板放不了、桌上/吧檯可放、坐桌面、搬桌連帶收小物） |
| ④ | 吧檯可裝潢＋店長站裡面 | 檯面上放小物 ✅；**店長站裡面＋正面板遮擋 ✅**（E2：移店長＋`counter_front.png` 獨立恆亮層，view/decorate 驗過）；「檯面裡放小家電」仍待 §C 完整版 |
