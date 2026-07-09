# 伝言板（牆上留言黑板）功能規格 · 給引擎 session

> 美術 session → 引擎 session。JJ×亞軒 的共享留言板：牆上掛一面固定小黑板，點它打開喫茶菜單風的對話面板，
> 兩人的留言用左右對話框＋日期顯示（自己右、對方左），像 LINE 但長得像菜單。已過稿（見 boardui / mockup 兩份 artifact）。

## 1. 資料（共有 KV，append-only）

`ShopState` 加一欄（或另開 /api/board，但沿用 shop KV 最省）：
```ts
interface BoardMsg { author: UserId; text: string; at: string; } // at = ISO 時間
interface ShopState { ...; board?: BoardMsg[]; }
```
- **append-only、union 合併**：兩人可能同時留言，別用 last-write-wins 蓋掉。仿 `mergeStock` 寫一個 `mergeBoard(a,b)`＝依 `author+at+text` 去重後合併、依 `at` 排序。上限保留最近 ~50 則。
- 送出：`board = [...board, {author: me.user, text, at: new Date().toISOString()}]` → `pushShop` → 用回傳的合併結果校正（撿對方新留言）。

## 2. 牆上黑板（固定、可點）

- sprite：`/cafe/board/wall_board.png`（暖色小巧菜單黑板、胡桃木框、假3D 露薄頂、四角黃銅釘；取自 JJ 提供的場景圖）。
- **場景座標（stage 576×416）**：`left=243, top=12, width=70, height=50`（往左貼梁柱旁、上下都留隙；JJ 圈的位置微調後）。preview 可微調。
- 在**店面檢視模式**就可點（不必進裝潢）；hover/點有回饋。點 → 開伝言板面板。
- 外觀固定不隨內容變（JJ 指定）。

## 3. 面板（點開才出現）

版面照過稿（artifact `dengon-board-ui-codex`）。素材都在 `/cafe/board/`：

| 部件 | 檔 | 用法 |
|---|---|---|
| 整框（木框＋紙面） | `panel.png` | 當 modal 底：border-image 9-slice，slice≈44px；中央紙面可用純奶油 `#F4E9CE` 填 |
| 標頭「伝言板」 | `header.png` | 固定貼面板頂端 |
| 我方對話框 | `bubble_right.png` | border-image 9-slice（slice≈30、中央丟棄塞文字）；靠右對齊、尾巴在右 |
| 對方對話框 | `bubble_left.png` | 同上、靠左、尾巴在左 |
| 輸入框 | `input_field.png` | 底部輸入列背景 |
| 送出鈕「留言」 | `button_send.png` | 輸入列右側按鈕 |

- **對話串**：`board` 依 `at` 由舊到新、由上往下；`author===me.user`→右框(bubble_right)、否則→左框(bubble_left)。可捲動。
- **每則**：文字（建議明朝/手寫感字體，色 `#2A1B10`）＋右下角小日期（`M/D HH:mm`，色 `#6B5236`）。日期由引擎渲染，**不要**用素材烤死的（空對話框中央是空的）。
- **輸入列**：placeholder「寫一句留給{對方名}…」；送出後清空、串捲到底。
- 空狀態：沒留言時顯示一句「還沒有人留言，寫第一句吧」。

## 4. 色票（要補 CSS 時對齊素材）

奶油紙 `#F4E9CE`／木框 `#4A2E1C`／我方框偏黃銅 `#E8D9B5`／對方框墨綠 `#7D9585`／酒紅點綴 `#7C2E2C`／字 `#2A1B10`／日期 `#6B5236`。

## 5. 邊界

- 文字長度不限但建議上限（如 60 字）；換行。
- 兩人單設備，衝突罕見，但 board 一定要 union merge 不可覆蓋。
- 之後若要「未讀提醒」可加，但 v1 先不用。
