# assets_src — 日々日文 美術來源素材

本資料夾＝**來源／工作素材**（不會被 build 打包）。實際服務給 app 用的資產在 `public/`（`sprites/pool/`、`shop/…`）。這裡是「原料」，`public/` 是「成品」。

## 01-nishimura-stickers/ — 西村裕二「ごきげんぱんだ」LINE 貼圖
- 來源：LINE 貼圖商店（西村裕二／Studio U.G.）
- 內含：熊貓本體、`西村客人/`（konezumi 小老鼠、warumeneko 壞臉貓）、`LINE貼圖庫/`
- 用途：Buddy／店長／客人的**角色與姿勢來源線稿**（轉像素時當姿勢錨點）

## 02-panda-v3-codex/ — Codex 生成的定裝熊貓
- `panda-v3.png` ＝ **唯一定裝基準**（大版 Buddy 用）
- `panda-shopkeeper.png` ＝ 小尺寸優化店長（48px 讀得清，店面用）
- `panda-emo-{cry,shock,love}.png` ＝ 情緒一致性驗證
- 生成法見記憶 `jp-panda-pixel-art-recipe`

## limezu/ — LimeZu Modern Interiors（付費完整版）★git-ignored
- **不進版控**（~230MB／5萬檔，`.gitignore` 已排除；itch 可重新下載）
- 內含 `1_Interiors/`（16/32/48 三解析度 tileset＋Room_Builder＋**Theme_Sorter 主題單件家具**）、`3_Animated_objects/`、`4_User_Interface_Elements/`、`6_Home_Designs/`（**含現成日式房 Japanese_Home_1**）、`Palettes/`、`LICENSE.txt`
- 用途：Shop 場景**素材庫**＝編輯器筆刷來源。決定用 **32px**。
- 註：`2_Characters/` 沒搬（我們用自己的熊貓），仍在桌面 `moderninteriors-win 2/`

## 04-maygetsu-food/ — Cozy Japanese Food（Maygetsu）
- `food_32x32/`、`food_64x64/` spritesheet＋`source/*.aseprite`
- 用途：Shop／服務小遊戲的**食物素材**；授權見 `docs/license.txt`

---
_app 最終只從 `limezu/` 挑「真正會載入」的少數 tile 放進 `public/`（committed、小）。整包只當來源庫。_
