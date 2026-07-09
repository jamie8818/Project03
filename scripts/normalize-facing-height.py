#!/usr/bin/env python3
"""
normalize-facing-height.py — 修正家具側/背視 sprite 的「內容實高」比例失衡。

問題：Shop.tsx 渲染時 spriteH = footprintDims(it,facing).w * CELL * (naturalH/naturalW)，
顯示高完全吃圖檔畫布長寬比。若同一件家具 front 與 right/left/back 的「不透明內容 bbox 高」
比例不一致，轉向瞬間家具視覺身高就會暴增或壓扁。

做法：以 front 圖的內容 bbox 高 Hf 為基準，把非 front 向圖的內容等比縮放到 Hf，
縮完貼回新畫布——畫布寬維持 facing 慣例（front/back＝item.w*64，right/left＝item.h*64，
從 docs/cafe-catalog.json 讀 w/h），畫布高＝縮放後內容高（緊裁），內容水平置中、底部貼齊。

用法：
    python3 scripts/normalize-facing-height.py <id> [<id> ...] [--dry-run] [--threshold 0.25]
    python3 scripts/normalize-facing-height.py --all-flagged   # 跑腳本內建的 9 件失衡清單

--dry-run       只印量測結果與預計動作，不寫檔。
--threshold X   超出 1±X 才動手改（預設 0.25，即 0.8–1.25 內不動）。
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
CATALOG_DIR = REPO / "public" / "cafe" / "catalog"
OUT_DIR = REPO / "assets_src" / "cafe" / "out"
CATALOG_JSON = REPO / "docs" / "cafe-catalog.json"
CELL = 64  # 圖檔畫布慣例的格寬（非引擎 stage CELL=32；圖檔以 64px/格出圖）

FLAGGED_IDS = [
    "cup_display_shelf",
    "copper_kettle_set",
    "siphon_rack",
    "bottle_shelf",
    "register",
    "booth_corner",
    "coat_rack",
    "icecream_freezer",
    "table_square",
]

FACINGS = ["back", "right", "left"]


def load_catalog():
    data = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    return {it["id"]: it for it in data["items"]}


def alpha_bbox(im: Image.Image):
    """回傳 (left, top, right, bottom) 不透明像素 bbox（PIL getbbox 慣例：right/bottom 為 exclusive）。"""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    alpha = im.split()[-1]
    bbox = alpha.getbbox()
    return bbox


def content_height(path: Path) -> tuple[int, Image.Image, tuple[int, int, int, int]]:
    im = Image.open(path).convert("RGBA")
    bbox = alpha_bbox(im)
    if bbox is None:
        raise ValueError(f"{path} 整張透明，無法量測 bbox")
    h = bbox[3] - bbox[1]
    return h, im, bbox


def target_canvas_width(item: dict, facing: str) -> int:
    if facing == "back":
        return item["w"] * CELL
    else:  # right / left
        return item["h"] * CELL


def process_one(item_id: str, item: dict, facing: str, threshold: float, dry_run: bool):
    front_path = CATALOG_DIR / f"{item_id}.png"
    facing_path = CATALOG_DIR / f"{item_id}_{facing}.png"
    if not facing_path.exists():
        return None
    if not front_path.exists():
        print(f"  [skip] {item_id}: front 圖不存在 {front_path}")
        return None

    Hf, _front_im, _front_bbox = content_height(front_path)
    Hv, im, bbox = content_height(facing_path)

    ratio = Hv / Hf
    result = {
        "id": item_id,
        "facing": facing,
        "Hf": Hf,
        "Hv_before": Hv,
        "ratio_before": ratio,
    }

    if 1 - threshold <= ratio <= 1 + threshold:
        result["action"] = "skip（比例在容許範圍內）"
        print(f"  [ok]   {item_id}_{facing}: Hf={Hf} Hv={Hv} ratio={ratio:.2f} → 不動")
        return result

    scale = Hf / Hv
    content = im.crop(bbox)
    new_w = max(1, round(content.width * scale))
    new_h = max(1, round(content.height * scale))
    canvas_w = target_canvas_width(item, facing)

    if new_w > canvas_w:
        # 結構性衝突：等比放大（同時放大寬高）會超出 facing 畫布寬慣例。
        # 若內容 bbox 寬本來就已經頂滿畫布寬（scale_x≈1），代表這是「內容整體矮了一截」
        # 而非「畫錯構圖寬度」——改用「只拉高、寬度不變」的非等比 vertical-stretch：
        # scale_x = canvas_w/content.width（應≈1，幾乎無水平變形），scale_y = Hf/Hv。
        # 只有當 bbox 寬明顯小於畫布寬（水平也要硬拉伸）時才真的無法安全修，回報「建議重生」。
        vstretch_x_scale = canvas_w / content.width
        if vstretch_x_scale >= 0.95:
            new_w = canvas_w
            scaled = content.resize((new_w, new_h), Image.LANCZOS)
            canvas_h = new_h
            canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            canvas.alpha_composite(scaled, (0, 0))
            verify_bbox = alpha_bbox(canvas)
            verify_h = verify_bbox[3] - verify_bbox[1] if verify_bbox else 0
            verify_ratio = verify_h / Hf
            result.update({
                "action": "vstretch（僅垂直拉伸，水平幾乎不變形，scale_x=%.2f）" % vstretch_x_scale,
                "scale_y": scale,
                "scale_x": vstretch_x_scale,
                "canvas_w": canvas_w,
                "canvas_h": canvas_h,
                "Hv_after": verify_h,
                "ratio_after": verify_ratio,
            })
            print(
                f"  [vfix] {item_id}_{facing}: Hf={Hf} Hv={Hv} ratio={ratio:.2f} "
                f"→ scale_y={scale:.2f} scale_x={vstretch_x_scale:.2f} → canvas={canvas_w}x{canvas_h} "
                f"verify_ratio={verify_ratio:.2f}"
            )
            if not dry_run:
                facing_path.parent.mkdir(parents=True, exist_ok=True)
                canvas.save(facing_path)
                out_path = OUT_DIR / f"{item_id}_{facing}.png"
                if out_path.parent.exists():
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    canvas.save(out_path)
            return result

        # 內容 bbox 寬明顯小於畫布寬，vertical-stretch 也救不了（會需要同時大幅水平拉伸）。
        # 不動手，回報「建議重生」，維持原檔。
        result.update({
            "action": "flag_regen（等比放大會超出畫布寬，建議重生，維持原檔）",
            "scale": scale,
            "would_be_w": new_w,
            "canvas_w": canvas_w,
        })
        print(
            f"  [⚠️ FLAG] {item_id}_{facing}: Hf={Hf} Hv={Hv} ratio={ratio:.2f} "
            f"→ scale={scale:.2f} 會需要寬 {new_w}px > 畫布寬 {canvas_w}px，建議重生，維持原檔"
        )
        return result

    scaled = content.resize((new_w, new_h), Image.LANCZOS)
    canvas_h = new_h  # 緊裁：畫布高＝縮放後內容高

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    paste_x = (canvas_w - new_w) // 2
    paste_y = canvas_h - new_h  # 底部貼齊
    canvas.alpha_composite(scaled, (paste_x, paste_y))

    # 驗證
    verify_bbox = alpha_bbox(canvas)
    verify_h = verify_bbox[3] - verify_bbox[1] if verify_bbox else 0
    verify_ratio = verify_h / Hf

    result.update({
        "action": "resize",
        "scale": scale,
        "canvas_w": canvas_w,
        "canvas_h": canvas_h,
        "Hv_after": verify_h,
        "ratio_after": verify_ratio,
    })

    print(
        f"  [fix]  {item_id}_{facing}: Hf={Hf} Hv={Hv} ratio={ratio:.2f} "
        f"→ scale={scale:.2f} → canvas={canvas_w}x{canvas_h} verify_ratio={verify_ratio:.2f}"
    )

    if not dry_run:
        facing_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(facing_path)
        out_path = OUT_DIR / f"{item_id}_{facing}.png"
        if out_path.parent.exists():
            out_path.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(out_path)

    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="家具 id（不給且無 --all-flagged 則報錯）")
    ap.add_argument("--all-flagged", action="store_true", help="跑內建的 9 件失衡清單")
    ap.add_argument("--dry-run", action="store_true", help="只量測不寫檔")
    ap.add_argument("--threshold", type=float, default=0.25, help="容許比例偏差（預設 0.25＝0.8–1.25 內不動）")
    args = ap.parse_args()

    ids = args.ids
    if args.all_flagged:
        ids = FLAGGED_IDS
    if not ids:
        ap.error("請指定 id 或 --all-flagged")

    catalog = load_catalog()
    results = []
    for item_id in ids:
        item = catalog.get(item_id)
        if item is None:
            print(f"[warn] {item_id} 不在 catalog 中，略過")
            continue
        print(f"== {item_id} (w={item['w']} h={item['h']}) ==")
        for facing in FACINGS:
            r = process_one(item_id, item, facing, args.threshold, args.dry_run)
            if r:
                results.append(r)

    return results


if __name__ == "__main__":
    main()
