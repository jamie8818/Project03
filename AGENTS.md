# Project03（日々喫茶）工作守則

日文學習＋熊貓店長咖啡店經營的 web 遊戲（Vite 前端＋Cloudflare Worker）。本檔給所有 AI 工具（Codex／Claude Code）共用；由 Claude Code 於 2026-07-11 從累積偏好交接而來。

## 入口文件
- 引擎工作：`docs/shop-v2-engine-handoff.md` §0（2026-07-10 收官版，唯一入口；§6 坑清單仍有效）
- 美術工作：`docs/cafe-art-handoff.md`
- 美術↔引擎的跨線需求：`docs/engine-to-art-requests.md`、`docs/art-to-engine-requests.md`

## Git 守則（重要，出過事故）
- 2026-07-09 曾因 iCloud「桌面與文件」同步毀掉整個 `.git`（歷史不可恢復，root commit 重生為 `09228f7`）。教訓：
  - **repo 絕不放回 `~/Desktop` 或 `~/Documents`**，現居 `~/Projects/Project03`。
  - **commit 完立刻雙推**：`git push mirror <branch> && git push origin <branch>`。
- 同 repo 常有多個 AI session 並行（引擎／美術／內容）。**動 `src/` 前先 `git status` 看有沒有別人的 WIP**，撞到未 commit 的檔就停手對頻。
- stage 範圍分工，commit 前用 `git status --short | grep '^[MA]'` 核一次沒夾帶：
  - 引擎線的檔：`src/`、`worker/index.js`、`vite.config.ts`、`tests/`、`docs/*-requests.md`
  - 美術線的檔：`public/cafe/`、`src/data/cafe.gen.ts`、`assets_src/`、`scripts/`、`docs/cafe-catalog.json`
  - `.claude/launch.json`、`.claude/settings.json` 是本機設定，**永遠不 stage**。
- commit message 用中文描述體（見 git log 慣例），一段完整已驗證的工作＝一個 commit，不要攢一大坨。
- JJ 已授權：改動完成且驗過（tsc／build／test／preview 皆過）就自行 commit，不必每次問。

## 部署
- worker 有改動時要 `wrangler deploy`（不是只 push 就會上線）。

## 玩家可見文案的語氣（JJ 認定的「精髓」，寫台詞／flavor／UI 文案必讀）
- **預設基調＝「一本正經講幹話」**：平靜陳述荒謬、不加語氣詞、不自己笑、括號補刀。範例：鯊魚娃娃「牠比你先住進來」、ATM「手續費：一句日文」、交通錐「店內施工中（沒有在施工）」。
- **台式爛諧音梗有機會就加、不硬加，寧缺勿濫（無配額）**。正宗流派＝「俗語結尾劫持」：拿國民級成語俗諺，結尾諧音替換成食物／物件名，前半句要讓人自動補完原句。圭臬範例：一人做事薏仁湯／夜路走多總匯三明治／肥水不落阿華田／下不為例炸醬麵。
- 反例（JJ 打回過）：「咖啡因為有你」——要重新斷句梗才浮現＝繞一層，失格。單字替換型只能當少量配菜。
- 規則：原句必須人人會接；替換物要扣合該物件；做不到就回畫面句。
- review 文案時要檢查：諧音是否「爛得剛好」、是否俗語劫持型。
- 家具 flavor 內容源：`docs/cafe-flavor.json`。

## 美術管線
- 生新素材走既有腳本 `scripts/gen-cafe-*.py`（錨圖定風格＋綠幕 sheet＋slice 切圖），**別重造管線**。
- 視覺判斷（品質、對位、構圖）要看實際圖檔，不要只看程式碼推測。

## IP 守則（對外公開任何內容前必查）
- 熊貓／西村角色＝LINE 貼圖衍生，**不可公開**；歌詞**不可公開**；LimeZu／Maygetsu 素材要 credit；時雨連結 OK。
