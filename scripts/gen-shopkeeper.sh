#!/bin/bash
# 生成店長熊貓的多姿勢 sprite（雙圖錨定：panda-v3 定裝 + 西村線稿 pNN 姿勢）。
# 用 Codex CLI 的內建 image_gen（gpt-image-2，走 ChatGPT 訂閱、不燒 API key）＋自動 chroma-key 去背。
# 產物 → public/cafe/shopkeeper/<slug>.png（96px 高、透明），由 Shop.tsx poseForLine() 依台詞挑用。
#
# ⚠️ 踩過的坑：Codex exec 背景執行「一定要 < /dev/null」，否則它會卡在
#    "Reading additional input from stdin..." 一直等，不會開始生圖。
# ⚠️ 偶發 401 Unauthorized＝訂閱 token 剛好在刷新，重跑該張即可（別當成壞掉）。
#
# 用法：bash scripts/gen-shopkeeper.sh [slug ...]   # 不帶參數＝全部 16 個
# 需求：Codex.app 已裝＋ChatGPT 訂閱登入（~/.codex/auth.json 有 tokens）。

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANCHOR="$ROOT/assets_src/02-panda-v3-codex/panda-v3.png"
POOL="$ROOT/public/sprites/pool"
OUT="$ROOT/public/cafe/shopkeeper"
TMP="/tmp/panda-gen"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
CODEX=/Applications/Codex.app/Contents/Resources/codex
mkdir -p "$OUT" "$TMP"

DEF='圖1（panda-v3.png）＝這隻熊貓「店長」的定裝外觀基準，五官/配色/比例必須完全照它、不可改：奶油白身體、深炭灰(非純黑)耳朵與四肢、綠色小領子、兩隻圓眼各一顆小黑點瞳孔且略對眼、圓胖呆萌。'
STYLE='畫成 LimeZu Modern Interiors 風格的像素 sprite：低飽和暖色、深色同色系柔和描邊（禁純黑硬邊）、每個顏色 2–3 階乾淨陰影、清脆看得到方塊但精緻不粗顆粒、透明背景。正面、約 96px 高的單一角色。'
# 耳朵鐵律（JJ 抓過的坑：舉手/捧物時深色手臂易跟耳朵黏成第三隻耳朵或蓋掉一隻）
EARS='【耳朵鐵律】熊貓只有兩隻耳朵、分別在頭頂左右兩側、左右對稱；絕不在頭中央或身上多出第三隻耳朵、也絕不缺任何一隻耳朵；深炭灰的手臂/手掌/道具要與耳朵清楚分開、不可黏成一坨。'

# slug|pNN|姿勢描述|額外指示（允許的道具等）
POSES=(
  "serve|p24|站在收銀台後、店員工作中的姿態、雙手在身前|不要收銀台道具。"
  "idle|p14|面無表情、呆呆站著、雙手自然垂放（呆萌放空）|"
  "onion|p37|呆呆站著、手上拿著一根長蔥|可畫手上那根蔥。"
  "no|p38|雙手在胸前比出交叉、俏皮地拒絕、微微歪頭|"
  "eat|p42|捧著一片食物開心要吃、饞饞的表情|可畫手上那份食物。"
  "welcome|p40|舉起一隻手揮手打招呼、開心迎客|"
  "cheer|p44|張大嘴、雙手上舉、超級興奮歡呼|"
  "dismay|p47|舉起手、一臉「啊…」的懊惱驚慌無奈|"
  "cat|p45|抱著一隻米白色小貓、幸福滿足|可畫那隻小貓。"
  "happy|p46|開心微笑、一手貼近臉頰、害羞又滿足|"
  "think|p78|歪著頭、一手托腮、疑惑思考|"
  "love|p122|冒愛心、一臉戀愛陶醉、雙手貼臉頰|"
  "play|p175|蹲低身體、好奇地探看、興致勃勃|只有熊貓蹲姿。"
  "cozy|p186|縮成一團、慵懶想睡、閉眼放鬆|不要畫被子或道具。"
  "statue|p187|像木頭人一樣直挺挺站著、面無表情、全身僵硬（呆萌石化感）|配色仍照定裝奶油白，不要變成木頭或石頭材質。"
  "shock|p100|瞪大眼、張嘴、嚇一跳的驚訝、雙手舉起|"
)

want=("$@")
gen () {
  local slug=$1 pose=$2 desc=$3 extra=$4
  local prompt="你有兩張參考圖。
${DEF}
圖2（${pose}.png）＝只參考「姿勢與情緒」（西村裕二線稿）：${desc}。把定裝熊貓擺成這個姿勢與神情。
${STYLE}
${EARS}
只畫熊貓本體（除非下句允許），不要家具/收銀台/文字/邊框/地面陰影。${extra}
把最終成品存成透明背景 PNG 到路徑：${TMP}/${slug}.png"
  echo "== gen ${slug} (${pose}) $(date +%H:%M:%S) =="
  rm -f "${TMP}/${slug}.png"
  "$CODEX" exec -C "$TMP" -s workspace-write --skip-git-repo-check \
    -i "$ANCHOR" -i "$POOL/${pose}.png" -o "${TMP}/${slug}-last.txt" \
    "$prompt" < /dev/null > "${TMP}/${slug}-run.log" 2>&1
  if [ ! -f "${TMP}/${slug}.png" ]; then echo "  FAIL（看 ${TMP}/${slug}-run.log；401 就重跑）"; return 1; fi
  # 後處理：裁 alpha bbox → 96px 高 NEAREST → 進 app
  python3 - "$slug" <<'PY'
import sys; from PIL import Image
slug=sys.argv[1]; im=Image.open(f"/tmp/panda-gen/{slug}.png").convert("RGBA")
bb=im.getbbox();  im=im.crop(bb) if bb else im
h=96; im=im.resize((round(im.width*h/im.height),h), Image.NEAREST)
import os; im.save(f"{os.environ['HOME']}/Projects/Project03/public/cafe/shopkeeper/{slug}.png")
print("  ->", im.size)
PY
}

for row in "${POSES[@]}"; do
  IFS='|' read -r slug pose desc extra <<< "$row"
  if [ ${#want[@]} -gt 0 ]; then
    skip=1; for w in "${want[@]}"; do [ "$w" = "$slug" ] && skip=0; done
    [ $skip -eq 1 ] && continue
  fi
  gen "$slug" "$pose" "$desc" "$extra"
done
echo "done → $OUT"
