# git 歷史重建紀錄（2026-07-09 物件庫損毀事故）

`.git/objects` 損毀（pack 目錄遺失、僅存 21 個 blob、無任何 commit/tree 物件），
歷史無法恢復（無 remote、無 Time Machine）。以下清單自倖存的 reflog 文字檔重建，
僅存訊息與順序，內容以工作區重生 root commit 為準。舊 .git 封存於 `.git-broken-20260709/`、
全量備份於 `~/Project03-rescue-20260709/`。

## 事故前 commit 順序（新→舊，nihongo-teaching-injection reflog 尾段）

### nihongo-teaching-injection

- `4f93e31` commit: 引擎交接更新：9/10 findings 已修＋E4/§A 完成；#1 兩方案待 JJ 選
- `5e33acf` commit: E4 吧檯拆層引擎接手＋§A manifest 欄位切換
- `12b3598` commit: 修 findings #4/#5/#8/#9：壁飾繪序＋伝言板三小修
- `3266f9c` commit: 修 findings #2/#3：家具透明框吃店長點擊＋招牌🍮被店長蓋住
- `7725ab3` commit: 修 findings #6/#10/#7：mergeBoard 抽 src/lib/board.ts 三端共用
- `768711d` commit: §D-2 新家具四向補完：8 件擺地家具補 back/right（codex 生成）
- `eccaca8` commit: 新增家具願望清單 v2：昭和喫茶主題 100 件全新候選（策展，未生圖）
- `8d44cbc` commit (amend): 引擎交接全面改寫：本輪成果＋review 10 findings 待修清單＋E4/§A 待辦＋坑
- `57135bc` commit (amend): 引擎交接全面改寫：本輪成果＋review 10 findings 待修清單＋E4/§A 待辦＋坑
- `ef49f68` commit: 引擎交接全面改寫：本輪成果＋review 10 findings 待修清單＋E4/§A 待辦＋坑
- `181e52f` commit: 修門遮罩空氣牆（JJ 回報）：base-fg.png 重剪門＋牆基輪廓
- `5664f01` commit: §D 四向補完：table_low 補 back/right（front 派生法），其餘 19 件判定免補
- `8384396` commit: 新增 22 件昭和喫茶家具（wishlist 全數補齊）
- `66b8b4e` commit: §C 完整版：吧檯拆層（不含吧檯的 base + 吧檯本體 sprite + 檯面格座標）
- `95c687f` commit: 店長 cozy 姿勢圖修復 E-bug：右側身體切邊
- `9a71659` commit: 回報美術：cozy.png 右側切邊（x=321 懸崖 150px，引擎已排除自身嫌疑）
- `ce51cb4` commit: 店長對話泡泡改「講完就收」：淡入→停 4.4s→淡出（Stardew 式），不再常駐遮家具
- `d8cb4cf` commit: cafe 交接更新 §0.6：本輪美術收尾狀態＋給新 session 的 TODO
- `1584cf1` commit: §A manifest 加 surface／spriteHeightTiles 兩欄（讓引擎去掉硬編白名單）
- `d05bbee` commit: 吧檯正面板繪製順序（E3）：只擋店長、不擋吧檯外家具
- `3b4aa79` commit: 日々喫茶 美術收尾：伝言板破圖修復＋base-fg 景深＋店長 16 姿勢換平滑版
- `f7f65dd` commit: 店長站進吧檯裡面（需求④）：移店長到檯後＋counter_front 獨立恆亮遮擋層
- `f7ca79c` commit: 伝言板（牆上留言黑板）引擎：ShopState.board＋union 合併＋菜單風對話面板
- `dfde109` commit: cafe 交接補充：§0.5 最新修正與待交付（§C 以 requests 為準、base-fg 擴含底牆＋門、§A/§C 待做、§B 已完成）
- `026d8b4` commit: 日々喫茶 Shop 美術改版 v2：昭和場景＋家具正交四向＋新店長＋留言板
- `1f1df89` commit: 喫茶店擺放引擎 v2：假3D 分層＋拖拉裝潢＋四向旋轉
- `61c9207` commit: 修 Codex review 抓到的 3 個 bug
- `7da5a84` commit: 今日課程 B4/B5：會話/小測進練習流程＋消化日/補強日狀態機
- `006836c` commit: 今日課程首頁：課程制每日入口（雙進度＋配速上限＋衝刺）
- `5185812` commit: 接客出餐版：拖曳出餐計時場＋111 種食物庫＋複數點餐
- `efae3ca` commit: 食物切圖改連通塊法：食物形狀完整不被格線切
- `c00f1dd` commit: 日々日文 教學注入：課綱管線＋isTaught 守門員＋課綱 drip＋文法進 SRS
- `3815f50` branch: Created from HEAD

### main

- `1fe7495` commit (amend): 清死碼：移除未使用的 PANDA / public/cafe/panda.png（店長改用 16 姿勢後成孤兒）
- `647f096` commit: 清死碼：移除未使用的 PANDA / public/cafe/panda.png（店長改用 16 姿勢後成孤兒）
- `cdd2b77` commit: Shop 咖啡廳全面重建：Tiled 手畫場景接進 app＋57 家具目錄＋16 店長姿勢＋庫存機制
- `da75bfe` commit: 修 code review 抓到的 bug：金幣蒸發＋加歌花費上限＋兩處防呆
- `b24e948` commit: sprite 畫質修正：打工客人改用去背原圖高清（/shop/serve/，非像素化）、拿掉熊貓客人（打工+店景，熊貓只當店長）、店長熊貓提高解析度（64px 柔順渲染）
- `ecbb74b` commit: 修雙熊貓：店長本身是熊貓，移除預設的熊貓客人；客人只顯示招待來的西村角色（小老鼠/壞臉貓）
- `fba95df` commit: E2+E3 商店與裝飾系統：四商店（內裝牆地/家具/衣裝/客人）目錄29件、金幣買、店等級解貨架、共有店 KV 同步；場景渲染重構成圖層（可換牆色/地磚/店長配件/招牌布丁/招待西村客人替換CC0）；格子擺放系統（家具佔多格、tap-to-place、碰撞、收回托盤、買了自動擺）
- `b475d33` commit: 打工接客徹底重做：西村角色客人（こねずみ橘鼠/わるめのねこ灰貓/熊貓，28張像素客人）上門說日文，選對店員回應才服務成功；接客會話資料30橋段分四階段(招呼/點餐/結帳/送客)、難度跟學習進度走(五十音初心者玩tier0招呼+無厘頭)、TTS聽客人、答對客人開心冒愛心。修 shiftBest NaN(Number.isFinite)
- `6aacab0` commit: 修店面：橫幅縮成 78px「店門口偷看」薄條，點進店展開完整店內（257px 近兩倍大＋店長講話＋動畫），解決進店沒變大的問題
- `4c093b0` commit: E1 經濟引擎：金幣全面開源——聽寫/翻牌/挖空各+3、成就+20、Boss討伐+20、連續里程碑(3/7/14/30/60/100天階梯獎金)；新增打工接客小遊戲（接待12客答對招呼語賺小費、連續接客combo加成、對戰場頂置＋顯示金幣餘額）
- `7b70e65` commit: 店長圖池擴到 187 張：LINE 官方貼圖 144 張經 ingest 管線（擦字+去背+標情緒）入庫，踢掉 3 張裁切壞圖(p20/p22/p31)；截圖底部裁切問題連帶解決
- `14598fe` commit: 店長台詞擴充至202句：打烊35/一人30/客滿35/日常102，加防重複與總數測試
- `00cbd20` commit: 小店新手引導＋店長講話：首次進店三段開店說明（localStorage flag）；店長泡泡依營業狀態換話題（打烊/一人/客滿三池+日常15句）、每8秒自動碎念、點熊貓即回話
- `bc09679` commit: Wave4 喫茶店共同經營（C案：進度頁橫幅+點開全頁）：CC0像素素材場景（ArMM1998）、店Lv=兩人合計XP、14項解鎖圖鑑、CSS sprite動畫（爐火/愛心/散步客/店長浮動）、出席制客人與打烊變暗
- `88a2e20` commit: Wave2+3 遊戲化：神秘客（35%日子上門3題、全對保底R）、扭蛋機（金幣經濟：每日/對決/衝刺/神秘客）、徽章佩戴；小遊戲間（聽寫/翻牌配對/歌詞挖空）、週間合作Boss（每日各一擊、KV血量、討伐獎勵）
- `3959ace` commit: Wave1 遊戲化：今日御神籤（幸運假名雙倍XP＋籤詩30句）、布丁圖鑑24口味（每日首完成掉落、streak提稀有率）、喫茶店黑板（互留言、練完解鎖）
- `9f9db3b` commit: 語速改滑桿：0.3–1.2 細調（🐢–🐇），放在歌/會話/五十音工具列，放手即示範；移除頂欄三段鈕
- `91deb59` commit: 語速三段開關：頂欄 🐢慢/🗣中/🐇快 循環，裝置各自記憶，切換即示範發音
- `75deb08` commit: 語音降速：預設 0.85→0.6、歌詞 0.75→0.55（JJ 反映太快）
- `63a464d` commit: 加歌改訂閱通道：無 API key 時排入 KV song-queue，Claude Code 排程（nihongo-song-worker 每時08-23）補工上架；前端排隊顯示；首曲夜に駆ける已由人工補工驗證全鏈
- `bd60219` commit: App 內加歌（A+B）：歌名自動抓詞（Utaten，鎖結果表格+單token fallback）＋Claude API 標音翻譯抽單字上架 KV 歌庫；含刪歌、dev mock；uta-net/j-lyric 已不可用
- `94ac53e` commit: 擦掉貼圖上烙印的手寫日文：連通元件分析（<12%最大塊者移除），46張全清、道具與貓咪保留
- `0fc8623` commit: 店長換角：ごきげんぱんだ素材庫46隻（flood-fill去背裁切管線）＋角色台詞509句（依がんばらない人設）；Buddy v2 隨機出場＋點擊講廢話
- `181b89b` commit: 改版布丁喫茶風（D1）：奶油底＋焦糖棕＋膠囊按鈕、系統圓體、店長熊 emoji 占位（供圖自動換）、布丁 PWA icon、稱號改店員系、拔像素字型省 1.4MB
- `c55cee4` commit: 像素遊戲風改版 R1–R3：深色RPG主題＋fusion-pixel字型＋Buddy sprite＋合成音效；限時衝刺(COMBO)＋XP等級稱號＋成就12個；每日對決＋下戰帖(seeded同題PK)＋戰績
- `e5909f2` commit: P1–P3 全上線：會話模組（6場景+連播）、歌詞模式（振假名+單字進牌組+kuromoji管線）、N5檢定軌（209字自動接續+詞義測驗+文法32點）
- `db4fef7` commit: 金鑰改隨連結（?k=）自動登入：localStorage 自我修復＋Gate 變貼連結備援；部署上線
- `406531b` commit (initial): 初始 commit：日々日文 PWA（五十音 SRS＋每日組卷＋雙人進度同步＋目標曲線）

### baito-serving-assets

- `3815f50` commit: 新增食物資料 manifest（docs/food-pool.json，111 道）
- `7ade7de` commit: 修食物切圖邊緣碎片：清掉非主體且貼左右邊界的鄰格碎片
- `1facb78` commit: 接客食物擴充到 111 種：JJ 綠幕總表切圖去背
- `f71b6db` commit: 新增接客出餐版：設計草圖＋全套美術素材＋抓取/生成腳本
- `1fe7495` branch: Created from HEAD

## 肇因與教訓

肇因無法定論：同一 checkout 多 session/agent 並發 git 操作（含 amend）＋先前一次進程強制退出，或桌面同步機制。
教訓：①單一 repo 併發 commit 要節制（改由監工統一 commit 或用 worktree 隔離）②必設 remote 定期 push。
