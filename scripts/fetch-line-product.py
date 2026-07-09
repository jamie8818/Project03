#!/usr/bin/env python3
"""從 LINE 貼圖商店下載整包貼圖（透明底 PNG）＋拼一張 contact sheet 供挑圖。
用法：python3 scripts/fetch-line-product.py <productId> <slug>
輸出：/tmp/line/<slug>/<stickerId>.png ＋ /tmp/line/<slug>_sheet.png
挑好 3 張表情後，再搬進 public/baito/customers/<slug>{0,1,2}.png（0招呼/1滿意/2生氣）。
"""
import sys, os, json, urllib.request
from PIL import Image, ImageDraw

pid, slug = sys.argv[1], sys.argv[2]
out = f'/tmp/line/{slug}'
os.makedirs(out, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0'}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)

meta = json.load(get(f'https://stickershop.line-scdn.net/stickershop/v1/product/{pid}/android/productInfo.meta'))
sids = [s['id'] for s in meta.get('stickers', [])]
print(f'pack {slug} ({pid}): {len(sids)} stickers')
ok = []
for sid in sids:
    p = f'{out}/{sid}.png'
    try:
        with get(f'https://stickershop.line-scdn.net/stickershop/v1/sticker/{sid}/android/sticker.png') as r:
            data = r.read()
        with open(p, 'wb') as f:
            f.write(data)
        ok.append(sid)
    except Exception as e:
        print('  fail', sid, e)

cols, thumb = 6, 150
rows = (len(ok) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * thumb, rows * thumb), (245, 245, 245, 255))
d = ImageDraw.Draw(sheet)
for i, sid in enumerate(ok):
    im = Image.open(f'{out}/{sid}.png').convert('RGBA')
    im.thumbnail((thumb - 12, thumb - 28))
    x, y = (i % cols) * thumb, (i // cols) * thumb
    sheet.alpha_composite(im, (x + 6, y + 6))
    d.text((x + 6, y + thumb - 18), f'#{i}', fill=(200, 30, 30, 255))
sheet.convert('RGB').save(f'/tmp/line/{slug}_sheet.png')
print(f'downloaded {len(ok)} -> {out}')
print(f'sheet -> /tmp/line/{slug}_sheet.png')
