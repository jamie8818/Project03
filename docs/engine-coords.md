# 引擎座標交接：bar-baked 新場景 + 吧檯層

> 美術 session → 引擎 session。換了新的 `public/cafe/base.png`（左上吧檯＋後吧台層架＋3 張高腳椅**烤進底圖**），
> 並切出 `public/cafe/counter_front.png` 讓店長能「站吧檯裡面」。以下座標請在 preview 對圖後微調鎖定。

## 1. 吧檯層 `counter_front.png`（做 panda-inside + 檯面遮擋）

- 檔案：`public/cafe/counter_front.png`，**全尺寸 576×416 透明**，內容＝左上吧檯**正面板**＋高腳椅（實際像素在 x0–272、**y118–202**）。
- ⚠️ 切線在 **y118＝檯面與正面板的交界（前緣）**，不是吧檯後緣。這樣店長是「趴在檯面上」、只有下半身被正面板擋；切在後緣(y90)會把店長身體削平＝有落差（已修）。
- 直接畫在 `left:0, top:0`（跟 base 對齊），不用算偏移。
- **繪製順序**（關鍵）：
  ```
  base.png
  → 地毯(L0) → 地板家具(L1) → 檯面小物(L2, 桌上)
  → 店長熊貓
  → counter_front.png   ← 疊在店長之上，遮住店長下半身＝站吧檯裡面
  → 吧檯檯面小物(放 COUNTER_TOP 的，畫在 counter_front 之後＝在檯面上)
  ```
- 已驗證：店長畫在 base 之上、counter_front 之下時，頭肩露出檯面、身體被吧檯擋 → 站裡面成立（見 /tmp/cafe-gen/panda_inside_test.png）。

## 2. 店長站位（Shop.tsx PANDA_CX / PANDA_TOP）

- **店長 sprite 換成新暖描邊熊貓**（JJ 陸續補圖，暫存 `assets_src/cafe/newpanda/`；風格＝暖棕描邊、紅點領結、配場景暖光）。
- **定稿尺寸/站位（JJ 拍板）**：身高 **PANDA_H ≈ 95**、中心 **cx ≈ 150**、底邊 **feet ≈ 146**（公式 feet = 118 + 0.30×身高 → 約 7 成身體露在檯面上）。→ slot top ≈ y51。
- 畫在 base 之後、counter_front 之前 → 領結/肚子/手露在檯面、下半身被正面板(y118+)自然擋。已驗證乾淨無落差。
- 切線(y118)讓身體露得剛好；preview 微調 cx/feet/身高即可。

## 3. 檯面可放小物（shop.ts COUNTER_TOP / Shop.tsx COUNTER_SURFACE_Y）

- 吧檯檯面在 base 的 y ≈ 92–120（row 3）。`COUNTER_SURFACE_Y ≈ 108`（小物底邊坐這條）。
- `COUNTER_TOP` 檯面格（可放 surface 小物）建議：`[1,3][2,3][3,3][4,3][5,3][6,3]`（bar 頂那排；preview 對圖後鎖）。
- 檯面小物要畫在 counter_front 之後（在檯面上、不被吧檯擋）。

## 4.（選配 / 之後）檯面「裡面」放小家電

- 後吧台內側格（cols 1–6, rows 1–2）可開成落點：畫在 base 之後、counter_front 之前 → 小家電從吧檯後探出。
- 目前後吧台已烤了不少瓶罐，這功能可延後；要做再開這區為 host。

## 5. 招牌布丁（styles.css .cafe-sign）

- 掛在吧檯上：建議 `left ≈ 150, top ≈ 96`（吧檯檯面上方；preview 微調）。

## 6. 碰撞 BLOCKED（美術端已更新，FYI）

- `scripts/build-cafe-ts.py` 的 `COUNTER = (0, 8, 2, 5)` → 吧檯區 cols 0–8 × rows 2–5 已進 BLOCKED（含後吧台/吧檯/高腳椅烤進圖的格）。已 regen `cafe.gen.ts`（blocked 106）。
- 若你在 preview 發現吧檯佔格跟圖對不上，跟我說 col/row，我改 COUNTER 重跑。

## 7. 待辦提醒

- SURFACE_HOSTS 目前引擎端硬編（table_round/square/low/pastry_case/bottle_shelf）；理想升為 manifest `surface:true`，要的話跟我說我加。
- 四向 facing sprite 還沒生（等命名 schema 定），目前所有件只有 front、facing 預設 front。
