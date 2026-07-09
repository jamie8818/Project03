#!/bin/bash
# Phase 0 風格 bake-off：同一件「靠窗絨布卡座」用 Codex 生三種渲染風格給 JJ 挑。
# A 柔順渲染 / B 硬派 32px 像素 / C 中間（LimeZu 清脆）。綠幕→chroma key→裁 bbox→拼對照圖。
# 用法：bash scripts/gen-cafe-style-probe.sh [A B C]   # 不帶參數＝全部
# 需求：Codex.app＋ChatGPT 訂閱登入。踩過的坑：codex exec 一定要 < /dev/null；401 就重跑該張。
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PALETTE="$ROOT/assets_src/cafe/palette.png"
TMP="/tmp/cafe-probe"
OUT="$ROOT/assets_src/cafe"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
CODEX=/Applications/Codex.app/Contents/Resources/codex
mkdir -p "$TMP"

DESC='一張昭和復古喫茶店（きっさてん）的靠窗絨布卡座（booth bench）：胡桃木深色木框、深墨綠色絨布的椅面與高椅背、旁邊靠著一張木質小桌，復古溫暖質感。單一物件置中、正面微俯視的 ¾ 遊戲視角（像 JRPG 咖啡廳裡擺在地板上的家具），寬高比約 3:2，四周大量留白。'
COLOR='配色嚴格照參考圖 palette.png 的色票：胡桃木 #4A2E1C、喫茶綠絨 #35503F、酒紅點綴 #7C2E2C、黃銅金 #D8A94E。'
BG='背景填「純亮綠色 chroma green（約 #00B140）」做去背用；畫面不要任何文字、logo、邊框、地面陰影或第二個物件。'

style_for () {
  case "$1" in
    A) echo '【畫風 A｜柔順渲染】精緻柔和的 2D 遊戲家具插圖：乾淨柔邊、細膩多階漸層陰影、圓潤溫暖，不要看得到硬方塊像素。約 512px 高、高解析。' ;;
    B) echo '【畫風 B｜硬派像素】復古硬派像素藝術（8/16-bit SNES 家具感）：明顯可見的方塊像素、硬邊 1px 深色描邊、有限色階、刻意低解析的顆粒感。' ;;
    C) echo '【畫風 C｜清脆像素】LimeZu Modern Interiors 那種像素：清脆看得到方塊但精緻不粗顆粒、深色同色系柔和描邊（禁純黑硬邊）、每色 2–3 階乾淨陰影、溫暖低飽和。' ;;
  esac
}

gen () {
  local v=$1
  local prompt="你有一張參考圖 palette.png，只用來鎖定配色，不要照抄它的排版。
請畫【${DESC}】
${COLOR}
$(style_for "$v")
${BG}
把最終成品存成 PNG 到路徑：${TMP}/booth_${v}.png"
  echo "== gen booth_${v} $(date +%H:%M:%S) =="
  rm -f "${TMP}/booth_${v}.png"
  "$CODEX" exec -C "$TMP" -s workspace-write --skip-git-repo-check \
    -i "$PALETTE" -o "${TMP}/booth_${v}-last.txt" \
    "$prompt" < /dev/null > "${TMP}/booth_${v}-run.log" 2>&1
  if [ ! -f "${TMP}/booth_${v}.png" ]; then echo "  FAIL（看 ${TMP}/booth_${v}-run.log；401 就重跑）"; return 1; fi
  echo "  ok"
}

VARIANTS=("$@"); [ ${#VARIANTS[@]} -eq 0 ] && VARIANTS=(A B C)
for v in "${VARIANTS[@]}"; do gen "$v"; done

# 後處理：chroma key 去綠 + 裁 bbox + 拼對照圖
python3 - <<'PY'
import os, glob
from collections import deque
from PIL import Image, ImageDraw
TMP='/tmp/cafe-probe'; OUT=os.path.expanduser('~/Desktop/Project03/assets_src/cafe')

def greenish(p):
    r,g,b=p[0],p[1],p[2]
    return g>110 and g>r+40 and g>b+40

def chroma(im):
    im=im.convert('RGBA'); w,h=im.size; px=im.load()
    seen=bytearray(w*h); q=deque()
    for x in range(w):
        for y in (0,h-1):
            if not seen[y*w+x] and greenish(px[x,y]): seen[y*w+x]=1; q.append((x,y))
    for y in range(h):
        for x in (0,w-1):
            if not seen[y*w+x] and greenish(px[x,y]): seen[y*w+x]=1; q.append((x,y))
    while q:
        x,y=q.popleft(); px[x,y]=(0,0,0,0)
        for nx,ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0<=nx<w and 0<=ny<h and not seen[ny*w+nx] and greenish(px[nx,ny]):
                seen[ny*w+nx]=1; q.append((nx,ny))
    for yy in range(h):
        for xx in range(w):
            r,g,b,a=px[xx,yy]
            if a>0 and g>max(r,b)+18: px[xx,yy]=(r,max(r,b),b,a)  # despill
    bb=im.getbbox()
    return im.crop(bb) if bb else im

variants=[]
for v in ('A','B','C'):
    f=f'{TMP}/booth_{v}.png'
    if os.path.exists(f):
        im=chroma(Image.open(f))
        im.save(f'{OUT}/probe_booth_{v}.png')
        variants.append((v,im))
if variants:
    TH=360; cellw=TH+40; cellh=TH+70
    m=Image.new('RGBA',(cellw*len(variants), cellh),(150,150,150,255))
    d=ImageDraw.Draw(m)
    labels={'A':'A  柔順渲染','B':'B  硬派 32px 像素','C':'C  中間·清脆像素'}
    for i,(v,im) in enumerate(variants):
        t=im.copy(); t.thumbnail((TH,TH))
        x=i*cellw+(cellw-t.width)//2; y=30+(TH-t.height)//2
        m.alpha_composite(t,(x,y))
        d.text((i*cellw+16,6), labels[v], fill=(15,15,15,255))
    m.convert('RGB').save(f'{OUT}/probe_montage.png')
    print('montage ->', f'{OUT}/probe_montage.png', 'variants:', [v for v,_ in variants])
else:
    print('NO variants produced — check /tmp/cafe-probe/*-run.log')
PY
echo "done"
