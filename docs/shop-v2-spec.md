# 日々喫茶 Shop · 美術＋擺放引擎 v2 規格

> 單一真相來源（single source of truth）。兩個 session（美術／引擎）都指這份。
> 有異動先在這裡改，再各自實作。

## 0. 定調（一句話）

做 **Stardew／牧場物語式的「假3D 家具站進 2D 俯視格」**。地板保持俯視、家具用正交四向的淺立面，兩者不統一鏡頭；讓它們「長進房間」而不是「貼上去」，靠三條膠水：

1. 釘在 footprint 上的**接地陰影**
2. 深度排序 **walk-behind**
3. **footprint / sprite 分家**的 overhang

美術本身沒問題，改的全是整合與生成規格。

## 需求來源（JJ 的四個原始需求）

1. 家具要**四個方向（正/背/左/右），不要 30° 斜**（場景是正對正前方）。正面朝前仍要能做假3D。舊的斜視害「蛋糕櫃貼不了牆」。
2. 一整組桌椅要能**拆成單件**（桌／椅各自挑各自擺），並加**四向旋轉**。
3. **分層要嚴謹**：小物放桌上 OK，但放椅子上會掉到椅子的下層。
4. 左上**吧檯區要可裝潢**：檯面上、檯面裡都能放小家電；且**熊貓店長固定站在吧檯裡面**（被吧檯正面板擋住下半身）。

## 分工與介面（兩 session，勿並行同檔）

| session | 守備範圍 | 不要碰 |
|---|---|---|
| **引擎** | `src/components/Shop.tsx`、`src/lib/shop.ts`、`src/lib/shopstate.ts`、`src/styles.css` | scripts/、assets_src/、public/cafe/、docs/cafe-catalog.json、src/data/cafe.gen.ts |
| **美術** | scripts/（生成/切圖/合成）、assets_src/、public/cafe/、docs/cafe-catalog.json、src/data/cafe.gen.ts（產生器輸出）、cafe-overrides.ts | src/ 的引擎程式 |

**介面契約**：
- `src/data/cafe.gen.ts` 由 `scripts/build-cafe-ts.py` 從 `docs/cafe-catalog.json` **自動產生**，引擎只讀不改；引擎若需 `CafeItem` 多欄位（facing 清單／surface 白名單旗標／spriteHeightTiles…）→ 回報美術 session 改 manifest＋重跑產生器。
- 美術產出 `public/cafe/catalog/<id>.png`（sprite）＋ manifest（規格），引擎消費。
- footprint 語意或欄位名要改 → 先在本檔改、兩邊同步。

## 現況（截至分工當下）

**已完成**
- 美術：30 件乾淨 sprite（無烤陰影、自然比例、furniture 寬＝footprint 寬×64px、rug 填滿 footprint、wall contain）已在 `public/cafe/catalog/`；新昭和 `base.png`（左上 L 吧檯／右上窗／下方門／俯視木地板）；新**正交正面錨圖** `assets_src/cafe/anchor-furniture.png` 鎖定；manifest 已改「佔地深度」footprint 模型；`cafe.gen.ts` 已重生；`cafe-overrides` 清空。
- 引擎：`shop.ts` `frontRowOf`＋`renderOrder` 前緣深度排序；`Shop.tsx` `cafe-shadow` 引擎接地陰影＋overhang 底錨渲染＋z 分流；`styles.css` `.cafe-furn.z-rug/z-wall`；`shopstate.ts` `Facing` 型別＋`PlacedItem.facing?`。

**待做**：見 §13 實作順序。

---

## 1. 核心架構：footprint 與 sprite 分家（雙層 overhang 模型）

地基，先做。

- **footprint** = 佔地格；碰撞、放置合法性**只認這個**。
- **sprite** = 自然比例高度，釘在 footprint 前緣往上長，可 overhang 蓋住後排格（**不再壓進 w×h 框 / 不用 object-fit: contain**）。pivot = footprint 前緣中心。

manifest（`cafe-catalog.json`）欄位（目標形態）：
```json
{
  "id": "pastry_case",
  "type": "furniture",              // furniture | rug | wall | surface_item
  "footprint": { "w": 2, "h": 1 },  // 佔地深度（碰撞只認這個）
  "spriteHeightTiles": 2.66,        // 視覺高度，> footprint.h 即往上 overhang
  "pivot": "bottom-center",         // 接地點 = footprint 前緣中點
  "surface": false,                 // 是否可放小物（見 §4 白名單）
  "facings": ["front","back","left","right"],
  "sprites": { "front": "...png", "back": "...png", "left": "...png" }
}
```
> 註：目前 manifest 用扁平 `z / w / h` 欄位（w×h 已是佔地深度）。欄位擴充由美術 session 做，引擎提需求。

**渲染**：sprite 底錨 = footprint 前緣、往上長；深度排序用 footprint 前緣列（§5）。
⚠️ `h` 語意 = **佔地深度**，不是視覺高度。`canPlace` 照吃 `footprint.w×h`。

## 2. 家具視角：正交四向（取代 30° 斜視）

30° 三分之四斜視全部拿掉——它同時露正面＋側面、背面是個「角」，貼不了牆。改成：

- **正交四向**：正／背／左／右，每一向都是平的單面 orthographic 圖。
- 假3D 靠 **pitch（相機略俯 15–25°，露一薄條頂面）** ＋頂面比正面亮一階；不靠 yaw、不露側角、不透視。
- **進深比**：頂面那條視高 ≈ 正面高的 **15–30%**，鎖一個值全批一致。
- 四向 = 貼四面牆：靠上牆用「正面」、靠左牆用「右向」、靠右牆用「左向」、靠下牆用「背面」。

每型要幾張 sprite（控額度）：

| 類型 | 需要的向 | 張數 |
|---|---|---|
| 徑向對稱（圓桌、圓凳、盆栽） | 四向長一樣 | 1 |
| 前後不同、左右對稱（椅、櫃、單人沙發） | 正＋背＋一側（另一側鏡像） | 最多 3 |
| 真有向（L 卡座、貴妃椅、吧台） | 四向都不同 | 4 |

⚠️ **footprint 隨 facing 旋轉**：朝左/右時 w↔h 對調，碰撞格一起轉。先燒「靠牆會用到的向」，其餘後補。

## 3. 三型分流生成

`gen-cafe-furniture.py` 的 view 分三種（已實作 `view_furniture/view_rug/view_wall`）：
- **furniture**：正交四向、淺假3D。
- **rug**：純俯視平貼、無立面、無頂條。
- **wall**：正面貼牆、平面、無頂條、無接地陰影。

## 4. z 分層 + 表面寄生（解「小物放椅子跑到下面」）

明確層級，取代單純 y-sort：
- **L0** 地板／地毯
- **L1** 地板家具（彼此 y-sort，固定店長也在這層）
- **L2** 檯面小物：不走地板 y-sort，**寄生**在所在家具上——畫在 host 之後、往上偏移貼到檯面高度，深度跟著 host 走
- **L3** 壁飾（牆帶上；視覺在背，畫在地板家具之前當背景）

**surface 白名單**（可放小物）：桌、櫃頂、架、吧台檯面 = `surface: true`；**椅子 = false**。定白名單後，小物根本不該落在椅子上（非法落點），「掉到椅子下面」直接消失。
⚠️ host 被搬走/移除時，其上小物要一起處理（別變孤兒）。
⚠️ 精確規則：小物**緊接在它的 host 之後畫**（跟著 host 的排序位置），不是全域 z，否則兩張桌前後重疊時會錯層。

## 5. 深度排序 + walk-behind

- 排序 key = footprint **最前緣列（max-y）**；多格家具取覆蓋的最大 y。前緣列大者後畫（蓋上面）；同列要穩定次要鍵避免閃爍。
- **本 app 省工點**：地上沒有玩家操控的走動角色（店長固定在吧檯、客人是接客小遊戲另一套）。所以 walk-behind 的動態穿模三 case 大幅縮水——深度排序基本只有『家具彼此』＋『家具 vs 固定店長』。
- （若未來加走動角色再測）三種穿模 case：(a) 角色站高家具正側邊同列；(b) 角色踩進大 footprint 前緣列；(c) 兩件高家具前後緊鄰。

## 6. 接地陰影（引擎畫，不烤進素材）

- 引擎在 footprint 上、地板層上獨立畫；**素材去背不含陰影**。
- 參數：寬 = footprint 寬 ×0.9；高 = 該寬 ×0.28；#000 透明度 30–35%；高斯模糊 ≈ 寬 ×8%；對齊 pivot。
- ⚠️ 多格／L 形家具：陰影跟著 footprint 形狀拉伸，不是單一橢圓。
- ⚠️ 目前 sprite 已改為**不含烤陰影**；若混到舊烤陰影素材會「雙重影子」。

## 7. 吧檯特例：四層 draw order + 開放內側格 + 店長站裡面

吧檯是「多層物件」，「檯面裡面」= 內側工作區／後吧台層架。由後到前：
1. 地板
2. 後吧台層架／內側小家電（把目前封鎖的內側格開成落點；「可放、角色不可走進」——無走動角色故後者 moot）
3. **吧檯本體 + 正面板**（這片當「牆」，擋住內側物件下半 → 從檯面後探出）
4. 檯面上小物（L2 寄生、往上偏移、畫在本體之後）

**店長站裡面**：熊貓店長畫在「吧檯正面板之前」的位置但被正面板遮住下半身 = 固定站在吧檯裡面服務。
⚠️ 需要美術把吧檯從 `base.png` 拆成獨立 sprite 層（正面板可後畫遮擋），並另出一版不含吧檯的 base。→ 引擎列需求給美術。

## 8. 拆單件 + 旋轉鍵

- 目錄拆成單件：餐桌組 → table×1 + chair×N 各自獨立可挑可放，不綁套。
- 旋轉鍵 = 在該件「有的 facing」之間循環，沒有的向跳過；同時切 sprite + 轉 footprint（§2）。

## 9. 出圖 + 後處理規格

- **1 tile = N px**：先量現況地板一格鎖定（現用 32）；**DRAW_RES = 64**。
- 每件依 footprint 等比縮到整數格。
- pivot = bottom-center（footprint 前緣中點），全資產統一。
- 透明 PNG、alpha 邊清乾淨、trim 到內容 bbox、統一 padding 與命名。
- Pillow pipeline：去背 → trim → 對齊格縮放 → 設 pivot → **不烤陰影** →（選配）palette quantize 鎖色盤。

## 10. 鎖定：調色盤 + 光源

- 主光**左上、暖白**，全場一致（頂面亮、正面中、近地略暗）。
- 色盤：所有家具只准用這盤。
  - ⚠️ **待統一**：本 §10 原稿列 地板 `#6b4a2e`／皮革墨綠 `#2f4a44`,`#27403a`／奶油白 `#e8d9b5`／黃銅 `#c9a24a`／酒紅 `#8f2f2f`／牆深棕 `#3a2718`；
  - 目前 manifest 實際鎖：胡桃木 `#4A2E1C`／喫茶綠絨 `#35503F`／酒紅 `#7C2E2C`／黃銅 `#D8A94E`／奶油 `#ECDDC4`／描邊 `#1B120A`。
  - 兩者需擇一為準（美術 session 定，寫回 manifest 與本檔）。

## 11. 生成 prompt 模板

```
[家具]: a single wooden cafe chair, dark green leather seat, brass studs
VIEW: orthographic top-down 2D game furniture sprite (RPG Maker / Stardew style),
      SINGLE facing = <front|back|left|right>, camera pitched down ~20°,
      one flat face + a thin top strip, symmetric
STYLE: match reference sheet — key light top-left, locked palette, same pixel/outline
BG: flat solid color for clean cutout
NEGATIVE: no 3/4 view, no 30 degree angle, no diagonal, no two faces visible,
          no perspective, no vanishing point, no isometric,
          no long cast shadow, no baked drop shadow, no gradient, no text
```
- rug 版：VIEW 換 `pure top-down flat, no elevation`。
- wall 版：VIEW 換 `flat frontal wall-mounted, no top strip`。
- 流程：先只燒「基準椅／櫃／桌」四向、人工過視角鎖錨圖 →（已完成 front 錨圖 `anchor-furniture.png`）→ 之後每張雙圖錨定它 → 合格才進後處理。別一開始整批燒。

## 12. 驗收清單

每張素材：
- ☐ 正交單面、無 30°/側角
- ☐ 頂面亮一階、進深比一致
- ☐ 只用鎖定色盤
- ☐ pivot 在 bottom-center、alpha 乾淨、無烤陰影

整合：
- ☐ 靠四面牆都貼平無縫
- ☐ （若有走動角色）走高家具後被擋、無穿模/閃爍
- ☐ 小物放桌/櫃頂/吧台檯面都在上層、椅子不可放
- ☐ 無雙重影子
- ☐ 放置預覽顯示的是 footprint、不是 sprite 外框
- ☐ 吧檯檯面上/裡都能放小物；店長站吧檯裡面被正面板擋下半身

## 13. 實作順序

1. **z-tier + surface 系統 + footprint/sprite 分家 + 引擎陰影**（§1、§4、§5、§6）——地基，解問題 3、4，吧檯一起。（overhang/陰影/前緣排序已起頭，補 facing-aware 與 surface 寄生）
2. **生成護欄改正交四向**（§2、§3、§11），基準錨圖已鎖。
3. **重生 30° 舊件 + 新件**，按 §2 張數表控額度。
4. **拆單件 + 旋轉鍵**（§8）。

## 14. 已知坑

- **穿模邊界 case（§5）**：靜態看對、一動才露餡（本 app 無走動角色，風險大減）。
- **雙重影子（§6）**：舊烤陰影沒切乾淨（現素材已無烤陰影）。
- **放置預覽要畫 footprint**：overhang 後 sprite 比佔地大很多，玩家會困惑。
- **額度**：對稱件鏡像免費、圓件 1 張；先燒靠牆向，別為完美一致整批重燒。
