import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type SyntheticEvent } from 'react';
import type { UserState } from '../types.ts';
import { USERS } from '../lib/store.ts';
import { sfx } from '../lib/sounds.ts';
import Buddy from './Buddy.tsx';
import { PUDDING_BY_ID, PUDDINGS } from '../data/fun.ts';
import {
  CAFE,
  CAFE_ITEMS,
  CATEGORY_LABELS,
  PLACE,
  SHOP_ITEMS,
  Z_TOP_ROW,
  availableFacings,
  canPlace,
  footprintDims,
  frontRowOf,
  guestIndicesOf,
  hostIndexOf,
  isCounterInside,
  isCounterTop,
  itemAtCell,
  itemById,
  nextFacing,
  nextItemLv,
  ownedKinds,
  pickShopLine,
  poseForLine,
  renderOrder,
  rotateHost,
  shopLevel,
  shopLevelXp,
  shopTitle,
  spriteFor,
  stockAvailable,
  type CafeItem,
  type Z層,
} from '../lib/shop.ts';
import { DEFAULT_SHOP, fetchShop, mergeBoard, pushBoard, pushShop, type BoardMsg, type Facing, type ShopState } from '../lib/shopstate.ts';

const STAGE_W = CAFE.w; // 576
const STAGE_H = CAFE.h; // 416
const CELL = CAFE.cell; // 32
const BANNER_H = 200; // 橫幅只露上半（櫃檯＋店長）
const FACING_LABEL: Record<Facing, string> = { front: '前', back: '後', left: '左', right: '右' };
const TABLE_INSET = 5; // 檯面小物坐進桌面上緣幾 px（桌沿唇厚；preview 微調）
const COUNTER_SURFACE_Y = 124; // 吧檯檯面小物落點的 stage y（吧檯木檯面上緣；preview 微調）
const COUNTER_INSIDE_Y = 145; // 內側小家電底錨 stage y（檯後工作區＝店長腳邊；落在 counter_front y118–202 內＝下半被正面板遮，E4）
// 牆上伝言板黑板熱區（dengon-board-spec.md 座標，見 docs/dengon-board-spec.md）
const BOARD_BTN = { left: 243, top: 12, width: 70, height: 50 };

// 店長熊貓站在吧檯「裡面」（檯後工作區）：上半身露在檯面上、下半身被 counter_front.png 正面板遮住。
// 中心底部錨定；PANDA_TOP 拉高到檯後 → feet 落檯面前緣、頭露在檯面上（E2，preview 實測值，可微調）。
const PANDA_H = 96;
const PANDA_CX = 150; // 中心 x（吧檯後方工作區）
const PANDA_TOP = 50; // 頭頂 y（露在檯面上；下半 ~28px 沒入正面板 y118–202）

function attendance(me: UserState, peer: UserState | null, today: string): number {
  return (me.lastDoneDate === today ? 1 : 0) + (peer?.lastDoneDate === today ? 1 : 0);
}

// ── 舞台渲染：吃 shopState 畫出整間店 ──
interface StageProps {
  shop: ShopState;
  attend: number;
  meDone: boolean;
  talk?: boolean;
  variant?: 'banner' | 'full';
  // 裝潢模式
  editing?: boolean;
  placing?: string | null; // 正在放/移動的家具 id（決定網格）
  placingFacing?: Facing; // 朝向（旋轉鍵；影響 footprint 與預覽合法格）
  placingIgnore?: number; // 網格 canPlace 要忽略的 index（移動已擺家具時＝它自己；新擺＝-1）
  selectedIndex?: number | null; // 選取的已擺家具 index（就地旋轉/收回/移動時高亮）
  onCell?: (gx: number, gy: number) => void; // 放置：托盤家具落在 (gx,gy)
  onItem?: (index: number) => void; // 點一下已擺家具＝選取切換（index<0＝點空白處取消選取）
  onMove?: (index: number, gx: number, gy: number) => void; // 拖曳：把第 index 件搬到 (gx,gy)
  onBoard?: () => void; // 點牆上伝言板黑板（僅店面檢視模式；有給才畫可點黑板）
}

type Drag = { index: number; grabDx: number; grabDy: number; gx: number; gy: number; moved: boolean; startX: number; startY: number };
const DRAG_THRESHOLD = 6; // 移動超過幾 px 才算「拖曳」，否則當「點一下」（避免觸控輕點誤判成搬移）

function Stage({ shop, attend, meDone, talk, variant = 'full', editing, placing, placingFacing, placingIgnore = -1, selectedIndex, onCell, onItem, onMove, onBoard }: StageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // 台詞帶序號 n：同句被連抽兩次時 key 仍變、泡泡動畫照樣重播（泡泡＝顯示幾秒自動淡出）
  const [line, setLine] = useState(() => ({ t: pickShopLine(attend, meDone), n: 0 }));
  const nextLine = () => setLine((l) => ({ t: pickShopLine(attend, meDone), n: l.n + 1 }));
  // sprite 長寬比快取（naturalH/naturalW）：只給「非 front 向」的 host 算視覺高度用——
  // manifest 的 spriteHeightTiles 只定義 front 圖（§A 實測：table_square 右向 0.73 vs manifest 1.47），
  // 旋轉向仍得等實圖載入校正；front 向直接吃 manifest、決定性免等圖。
  const [aspect, setAspect] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<Drag | null>(null); // 拖曳中的已擺家具
  const [hover, setHover] = useState<{ gx: number; gy: number } | null>(null); // 放置模式的落點預覽格
  const [fgOk, setFgOk] = useState(true); // 前景層（門/牆去背圖）是否存在；美術還沒出時 onError 關掉
  const onImgLoad = (src: string) => (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.naturalWidth && aspect[src] === undefined) setAspect((a) => ({ ...a, [src]: el.naturalHeight / el.naturalWidth }));
  };
  // host 家具 sprite 的視覺高度（stage px）：front＝manifest spriteHeightTiles（§A，決定性）；
  // 其他向＝當下那張圖的實際比例（onLoad 校正），未載入前先用 front 的每格高度近似
  const spriteH = (it: CafeItem, facing?: Facing): number => {
    if (!facing || facing === 'front') return it.spriteHeightTiles * CELL;
    const fw = footprintDims(it, facing).w;
    return fw * CELL * (aspect[spriteFor(it, facing).src] ?? it.spriteHeightTiles / it.w);
  };
  const viewH = variant === 'banner' ? BANNER_H : STAGE_H;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / STAGE_W);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (!talk) return;
    const iv = setInterval(() => setLine((l) => ({ t: pickShopLine(attend, meDone), n: l.n + 1 })), 8000);
    return () => clearInterval(iv);
  }, [talk, attend, meDone]);

  // ── 拖曳互動（pointer，觸控/滑鼠通用；stage 有縮放，座標經 rect 反算回格）──
  const cellFromEvent = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * STAGE_W;
    const sy = ((e.clientY - r.top) / r.height) * STAGE_H;
    return { gx: Math.max(0, Math.min(CAFE.cols - 1, Math.floor(sx / CELL))), gy: Math.max(0, Math.min(CAFE.rows - 1, Math.floor(sy / CELL))) };
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cellFromEvent(e);
    if (placing) { setHover(c); return; } // 放置托盤家具：預覽落點，放開時擺下
    // 先抓「指到的 sprite」本身（含 overhang 上半，如高腳椅座面）；抓不到再退回 footprint 格
    const hit = (e.target as HTMLElement)?.closest?.('.cafe-furn') as HTMLElement | null;
    const idx = hit?.dataset.i != null ? Number(hit.dataset.i) : itemAtCell(shop.layout, c.gx, c.gy);
    if (idx < 0 || !shop.layout[idx]) { setDrag(null); return; }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 拖出邊界仍可靠事件冒泡；capture 失敗不致命 */ }
    const p = shop.layout[idx];
    setDrag({ index: idx, grabDx: c.gx - p.gx, grabDy: c.gy - p.gy, gx: p.gx, gy: p.gy, moved: false, startX: e.clientX, startY: e.clientY });
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cellFromEvent(e);
    if (placing) { setHover(c); return; }
    if (!drag) return;
    // 沒超過位移門檻前當「還在點」，不搬（觸控輕點防誤判）
    if (!drag.moved && Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < DRAG_THRESHOLD) return;
    const gx = c.gx - drag.grabDx, gy = c.gy - drag.grabDy; // 保持抓取偏移
    if (gx !== drag.gx || gy !== drag.gy || !drag.moved) setDrag({ ...drag, gx, gy, moved: true });
  };
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (placing) { const c = cellFromEvent(e); setHover(null); onCell?.(c.gx, c.gy); return; }
    if (drag) {
      if (drag.moved) onMove?.(drag.index, drag.gx, drag.gy); // 拖曳＝搬移
      else onItem?.(drag.index); // 點一下＝選取切換
      setDrag(null);
    } else onItem?.(-1); // 點空白＝取消選取
  };

  // 拖曳預覽：把被拖的家具＋其上小物暫時位移（渲染用；未 commit）
  const dref = drag ? shop.layout[drag.index] : null;
  const ddx = dref ? drag!.gx - dref.gx : 0;
  const ddy = dref ? drag!.gy - dref.gy : 0;
  const shifted = new Set<number>(drag && (ddx || ddy) ? [drag.index, ...guestIndicesOf(shop.layout, drag.index)] : []);
  const displayLayout = shifted.size ? shop.layout.map((p, i) => (shifted.has(i) ? { ...p, gx: p.gx + ddx, gy: p.gy + ddy } : p)) : shop.layout;
  const dragOk = drag && dref ? canPlace(shop.layout, dref.id, drag.gx, drag.gy, drag.index, dref.facing) : true;

  // 網格＆放置預覽的「作用中家具」＝放置中的托盤件，或拖曳中的件
  const gId = placing ?? dref?.id ?? null;
  const gFacing = placing ? placingFacing : dref?.facing;
  const gIgnore = placing ? placingIgnore : drag ? drag.index : -1;
  const gItem = gId ? itemById(gId) : undefined;
  const gZ: Z層 | null = gItem?.z ?? null;

  // 逐件渲染（依 z 分流：地板家具 overhang 底錨／檯面小物抬到桌面／地毯平貼／壁飾貼牆）。
  // 抽成函式好讓吧檯正面板夾在中間分兩批畫（E3）：地毯在吧檯下、其餘家具在吧檯上。
  const renderFurn = (i: number) => {
    const p = displayLayout[i];
    const it = itemById(p.id);
    if (!it) return null;
    const dims = footprintDims(it, p.facing);
    const isDragged = drag != null && i === drag.index;
    const cls = `cafe-furn z-${it.z} ${editing ? 'editable' : ''} ${editing && i === selectedIndex ? 'selected' : ''} ${isDragged ? (dragOk ? 'dragging' : 'dragging invalid') : ''}`;
    if (it.z === 'furniture') {
      // 底邊釘在 footprint 前緣、寬=佔地寬、高依素材自然比例往上長（overhang）；
      // facing 決定用哪張 sprite（左右對稱件用 _right 鏡像＝scaleX(-1)）
      const sp = spriteFor(it, p.facing);
      return (
        <img
          key={`f${i}`}
          data-i={i}
          className={cls}
          src={sp.src}
          alt={it.name}
          draggable={false}
          onLoad={onImgLoad(sp.src)}
          onError={(e) => { if (!e.currentTarget.src.endsWith(it.sprite)) e.currentTarget.src = it.sprite; }} // 該向 sprite 還沒生 → 退回 front，不露破圖
          style={{ left: p.gx * CELL, bottom: STAGE_H - frontRowOf(p) * CELL, width: dims.w * CELL, height: 'auto', transform: sp.flip ? 'scaleX(-1)' : undefined }}
        />
      );
    }
    if (it.z === 'surface') {
      // 檯面小物：坐在 host 的視覺桌面上（host 前緣 − host 視覺高 + 桌沿唇）；
      // 吧檯檯面用固定檯面 y；孤兒（舊存檔落地板）退回地板錨定不消失。
      const host = hostIndexOf(displayLayout, i);
      let bottom: number;
      if (isCounterInside(it)) {
        // 內側小家電：底錨檯後工作區（跟店長同進深），下半身被 counter_front 遮＝嵌在吧檯裡（E4）
        bottom = STAGE_H - COUNTER_INSIDE_Y;
      } else if (host >= 0) {
        const hp = displayLayout[host], hit = itemById(hp.id)!;
        bottom = STAGE_H - (frontRowOf(hp) * CELL - spriteH(hit, hp.facing) + TABLE_INSET);
      } else if (isCounterTop(p.gx, p.gy)) {
        // 檯面小物坐檯面：row 3（唯一檯面排）前緣 y=COUNTER_SURFACE_Y
        bottom = STAGE_H - COUNTER_SURFACE_Y;
      } else {
        bottom = STAGE_H - frontRowOf(p) * CELL;
      }
      return (
        <img
          key={`f${i}`}
          data-i={i}
          className={cls}
          src={it.sprite}
          alt={it.name}
          draggable={false}
          style={{ left: p.gx * CELL, bottom, width: CELL, height: 'auto' }}
        />
      );
    }
    // rug（平貼填滿佔格）／wall（貼牆框內）
    return (
      <img
        key={`f${i}`}
        data-i={i}
        className={cls}
        src={it.sprite}
        alt={it.name}
        draggable={false}
        style={{ left: p.gx * CELL, top: p.gy * CELL, width: dims.w * CELL, height: dims.h * CELL }}
      />
    );
  };

  // E3/E4 draw order：地毯(L0) 畫在吧檯之下、壁飾(L3) 貼後牆畫在店長之前（別蓋前景人物）、
  // 內側小家電（counter-inside）跟店長同批＝counter_front 之前（嵌吧檯裡）、
  // 其餘家具(L1/L2) 畫在吧檯之上。renderOrder 已依 z 分好序，filter 保序即可。
  // 單次分流（原本 4 個 filter 各自重查 itemById／z，收斂成一輪迴圈）
  const order = renderOrder(displayLayout);
  const rugOrder: number[] = [];
  const wallOrder: number[] = [];
  const insideOrder: number[] = [];
  const aboveCounterOrder: number[] = [];
  for (const i of order) {
    const it = itemById(displayLayout[i].id);
    if (it?.z === 'rug') rugOrder.push(i);
    else if (it?.z === 'wall') wallOrder.push(i);
    else if (isCounterInside(it)) insideOrder.push(i);
    else aboveCounterOrder.push(i);
  }

  return (
    <div className={`shop-wrap ${variant}`} ref={wrap} style={{ height: viewH * scale }}>
      <div
        className={`shop-stage ${meDone ? '' : 'closed'} ${editing ? 'editing' : ''}`}
        style={{ transform: `scale(${scale})`, touchAction: editing ? 'none' : undefined }}
        onPointerDown={editing ? onPointerDown : undefined}
        onPointerMove={editing ? onPointerMove : undefined}
        onPointerUp={editing ? onPointerUp : undefined}
        onPointerCancel={editing ? () => { setDrag(null); setHover(null); } : undefined}
      >
        {/* 手畫咖啡廳背景（地板＋牆＋固定裝置；E4 拆層＝不含吧檯）＋吧檯本體（上緣＋抽屜排＋內角柱，
            恆亮背景層、不進 renderOrder、無 footprint——吧檯是跟 base 等級的固定裝置，不跟家具比深度） */}
        <img className="cafe-base" src="/cafe/base_nocounter.png" width={STAGE_W} height={STAGE_H} alt="" draggable={false} />
        <img className="cafe-counter-body" src="/cafe/counter_body.png" width={STAGE_W} height={STAGE_H} alt="" draggable={false} />

        {/* 招牌布丁（掛在櫃檯上） */}
        {shop.sign && PUDDING_BY_ID[shop.sign] && (
          <span className="cafe-sign" style={{ filter: `hue-rotate(${PUDDING_BY_ID[shop.sign].hue}deg) saturate(${PUDDING_BY_ID[shop.sign].sat ?? 1})` }}>🍮</span>
        )}

        {/* 接地陰影層：只有地板家具在 footprint 前緣畫柔邊橢圓（檯面小物在桌上、不投地影） */}
        {displayLayout.map((p, i) => {
          const it = itemById(p.id);
          if (!it || it.z !== 'furniture') return null;
          const fw = footprintDims(it, p.facing).w * CELL;
          const sw = fw * 0.9;
          return (
            <div
              key={`sh${i}`}
              className="cafe-shadow"
              style={{ left: p.gx * CELL + (fw - sw) / 2, top: frontRowOf(p) * CELL - CELL * 0.5, width: sw, height: CELL * 0.5 }}
            />
          );
        })}

        {/* 地毯層(L0)：畫在吧檯正面板之下（地毯在地上、不該蓋吧檯）。E3 */}
        {rugOrder.map(renderFurn)}

        {/* 壁飾層(L3)：貼後牆（rows 0–1），畫在店長之前＝牆上的東西不會蓋到前景人物（finding #4） */}
        {wallOrder.map(renderFurn)}

        {/* 店長熊貓：姿勢隨當下台詞換＋idle 起伏（中心底部錨定；站吧檯裡面，下半身由下方 counter_front 遮住） */}
        <div className="cafe-panda-slot" style={{ left: PANDA_CX, top: PANDA_TOP }}>
          <img
            className={`cafe-panda ${talk ? 'panda-hit' : ''}`}
            src={`/cafe/shopkeeper/${poseForLine(line.t, meDone, attend)}.png`}
            height={PANDA_H}
            alt="店長"
            draggable={false}
            onClick={talk ? () => { sfx.correct(1); nextLine(); } : undefined}
          />
        </div>

        {/* 內側小家電（E4）：畫在店長之後、counter_front 之前＝下半身被正面板遮＝嵌在吧檯裡 */}
        {insideOrder.map(renderFurn)}

        {/* 吧檯正面板遮擋層（E2）：counter_front.png＝檯面前緣＋正面板＋銅角＋3 綠凳，畫在店長之後
            ＝遮住店長下半身＝「站吧檯裡面」。恆全不透明（不隨裝潢模式變淡，和 base-fg 不同）；pointer 穿透。 */}
        <img
          className="cafe-counter-fg"
          src="/cafe/counter_front.png"
          width={STAGE_W}
          height={STAGE_H}
          alt=""
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />

        {/* 地板家具(L1)＋檯面小物(L2)：畫在吧檯正面板之上＝吧檯外家具擋住吧檯、且都畫在店長之上（店長在最後排）。E3 */}
        {aboveCounterOrder.map(renderFurn)}

        {/* 前景層：門/牆去背圖（美術出 base-fg.png，門牆不透明、其餘透明），畫在家具之上＝景深。
            裝潢時調淡，好讓被擋住的家具還看得到、點得到（點格子選取，pointer 穿透前景）。 */}
        {fgOk && (
          <img
            className="cafe-fg"
            src="/cafe/base-fg.png"
            width={STAGE_W}
            height={STAGE_H}
            alt=""
            draggable={false}
            onError={() => setFgOk(false)}
            style={{ opacity: editing ? 0.3 : 1 }}
          />
        )}

        {/* 裝潢格線（純視覺，pointer-events 由 CSS 關掉；放置或拖曳時顯示）。
            檯面小物含吧檯左右端翹角（col 0/17），格線用整排寬度；其餘家具只到牆內 minCol..maxCol。 */}
        {editing && gId && gZ && (() => {
          // 格線整排（col 0..最右）：最左/最右是地板、壁飾貼側牆、檯面翹角都在邊欄；合法性交給 canPlace
          const colStart = 0;
          const colEnd = CAFE.cols - 1;
          return (
          <div className="grid-overlay">
            {Array.from({ length: PLACE.maxRow - Z_TOP_ROW[gZ] + 1 }).map((_, ry) =>
              Array.from({ length: colEnd - colStart + 1 }).map((_, cx) => {
                const gx = cx + colStart;
                const gy = ry + Z_TOP_ROW[gZ];
                const ok = canPlace(shop.layout, gId, gx, gy, gIgnore, gFacing);
                return <div key={`g${gx}-${gy}`} className={`grid-cell ${ok ? 'ok' : 'no'}`} style={{ left: gx * CELL, top: gy * CELL, width: CELL, height: CELL }} />;
              }),
            )}
            {/* 放置模式落點預覽：footprint 外框（綠＝可放、紅＝不可） */}
            {placing && hover && gItem && (
              <div
                className={`place-ghost ${canPlace(shop.layout, placing, hover.gx, hover.gy, placingIgnore, placingFacing) ? 'ok' : 'no'}`}
                style={{ left: hover.gx * CELL, top: hover.gy * CELL, width: footprintDims(gItem, placingFacing).w * CELL, height: footprintDims(gItem, placingFacing).h * CELL }}
              />
            )}
          </div>
          );
        })()}

        {/* 牆上伝言板黑板（店面檢視可點，開對話面板）。畫在前景層之上＝不被門牆蓋住、點得到。 */}
        {onBoard && !editing && (
          <button
            type="button"
            className="cafe-board-btn"
            style={BOARD_BTN}
            onClick={onBoard}
            aria-label="伝言板"
          >
            <img src="/cafe/board/wall_board.png" alt="伝言板" draggable={false} />
          </button>
        )}

        {talk && <span className="shop-bubble" key={line.n}>{line.t.text}</span>}
        {!meDone && !editing && <span className="shop-closed-sign">準備中</span>}
      </div>
    </div>
  );
}

// ── 進度頁橫幅（自己抓 shop 狀態） ──
export function ShopBanner({ me, peer, today, onOpen }: { me: UserState; peer: UserState | null; today: string; onOpen: () => void }) {
  const lv = shopLevel(me.xp + (peer?.xp ?? 0));
  const [shop, setShop] = useState<ShopState>(DEFAULT_SHOP);
  useEffect(() => {
    fetchShop().then(setShop).catch(() => {});
  }, []);
  return (
    <button className="shop-banner" onClick={onOpen}>
      <Stage variant="banner" shop={shop} attend={attendance(me, peer, today)} meDone={me.lastDoneDate === today} />
      <span className="shop-lv-chip">🏮 日々喫茶 Lv.{lv}「{shopTitle(lv)}」</span>
      <span className="shop-next-chip">🪙 你的金幣 {me.coins}　點我進店裝潢 →</span>
    </button>
  );
}

const INTRO = [
  '歡迎光臨「日々喫茶」！這間店是你們兩個人共同經營的喔。',
  '練日文賺 XP 讓店升級解鎖新貨架；打工、對決賺金幣，金幣拿去商店買家具。',
  '買來的家具進「裝潢」模式擺進店裡：點托盤選一件→點格子放下；點店裡的家具可以搬走或收回。兩個人一起裝潢同一間店……拜託弄得可愛一點（合掌）。',
];

function ShopIntro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  return (
    <div className="shop-intro">
      <Buddy mood={step === 2 ? 'cheer' : 'happy'} size={72} />
      <p>{INTRO[step]}</p>
      <button className="primary" onClick={() => (step + 1 < INTRO.length ? setStep(step + 1) : onDone())}>
        {step + 1 < INTRO.length ? '嗯嗯，然後呢 →' : '知道了，開工！'}
      </button>
    </div>
  );
}

// ── 伝言板：點牆上黑板開的對話面板（菜單風，自己右、對方左，日期由引擎渲染） ──
/** 留言時間戳 → 「M/D HH:mm」（裝置本地時間；素材空框、日期不烤死） */
function fmtBoardDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DengonBoard({ me, board, onSend, onClose }: { me: UserState; board: BoardMsg[]; onSend: (text: string) => void; onClose: () => void }) {
  const otherName = USERS.find((u) => u.id !== me.user)!.name;
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState(false); // 送出後短暫「✓ 送出！」回饋（按鈕脈動＋小提示）
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 新留言（含撿到對方的）就捲到底。依賴看「最後一則的時間戳」不看長度——
  // 滿 BOARD_MAX 後 union 進新訊長度恆定，length 永遠不變、就再也不捲了（finding #5）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [board[board.length - 1]?.at]);
  const submit = () => {
    const t = draft.trim().slice(0, 60);
    if (!t) return;
    onSend(t);
    setDraft('');
    setSent(true);
    inputRef.current?.focus(); // 送完保持焦點，方便連續留言
  };
  return (
    // 關閉判定用 pointerdown 且起點就在 overlay 本身：桌機在輸入框選字、拖出面板才放開時，
    // click 會落在 overlay（down/up 的共同祖先）、草稿跟著蒸發（finding #9）
    <div className="dengon-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dengon-panel">
        <img className="dengon-header" src="/cafe/board/header.png" alt="伝言板" draggable={false} />
        <button className="dengon-close" onClick={onClose} aria-label="關閉">✕</button>
        <div className="dengon-scroll" ref={scrollRef}>
          {board.length === 0 ? (
            <p className="dengon-empty">還沒有人留言，寫第一句吧</p>
          ) : (
            board.map((m) => (
              <div key={`${m.author}-${m.at}-${m.text}`} className={`dg-msg ${m.author === me.user ? 'me' : 'them'}`}>
                <div className="dg-bubble">
                  <span className="dg-text">{m.text}</span>
                  <span className="dg-date">{fmtBoardDate(m.at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="dengon-inputbar">
          {sent && <span className="dengon-sent-toast" onAnimationEnd={() => setSent(false)}>✓ 送出！</span>}
          <input
            ref={inputRef}
            className="dengon-input"
            value={draft}
            maxLength={60}
            placeholder={`寫一句留給${otherName}…`}
            onChange={(e) => setDraft(e.target.value)}
            // 組字中（IME 選字）的 Enter 不送出：讓輸入法先 commit，再按一次 Enter 才留言（CJK 標準）
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
          />
          <button className={`dengon-send ${sent ? 'sent' : ''}`} onClick={submit} aria-label="留言" />
        </div>
      </div>
    </div>
  );
}

type Mode = 'view' | 'shop' | 'decorate';

// ── 全頁：檢視／商店／裝潢 ──
export function ShopPage({ me, peer, today, update, onBack }: { me: UserState; peer: UserState | null; today: string; update: (fn: (s: UserState) => UserState) => void; onBack: () => void }) {
  const lv = shopLevel(me.xp + (peer?.xp ?? 0));
  const attend = attendance(me, peer, today);
  const meDone = me.lastDoneDate === today;
  const [shop, setShop] = useState<ShopState | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [boardOpen, setBoardOpen] = useState(false);
  const [introSeen, setIntroSeen] = useState(() => localStorage.getItem('nng:shop-intro3') === '1');

  useEffect(() => {
    fetchShop().then(setShop).catch(() => setShop(DEFAULT_SHOP));
  }, []);

  // 裝潢用：樂觀更新，推上去後用伺服器合併結果校正（撿到對方買的東西＋對方的留言）。
  // stock 是單調 max，直接採伺服器值；board 用 union 再合一次，避免蓋掉本地剛送、伺服器還沒收到的訊。
  const saveShop = (next: ShopState) => {
    setShop(next);
    pushShop(next)
      .then((res) => {
        const cur = res.current;
        if (!cur) return;
        setShop((prev) =>
          prev ? { ...prev, stock: cur.stock ?? prev.stock, board: cur.board ? mergeBoard(prev.board, cur.board) : prev.board } : prev,
        );
      })
      .catch(() => {});
  };

  // 伝言板送出：樂觀 append（union）後走獨立端點只推留言（finding #1 方案B）——
  // 完全不帶 layout/sign，聊天不會用開頁當下的舊裝潢蓋掉對方剛存的新裝潢。回傳再撿對方新留言。
  const sendBoard = (text: string) => {
    if (!shop) return;
    const msg: BoardMsg = { author: me.user, text, at: new Date().toISOString() };
    const next = mergeBoard(shop.board, [msg]);
    setShop({ ...shop, board: next });
    pushBoard(next)
      .then((cur) => setShop((prev) => (prev ? { ...prev, board: mergeBoard(prev.board, cur) } : prev)))
      .catch(() => {});
    sfx.correct(1);
  };

  // 購買用：先確定共有 KV 寫入成功才回來，失敗會 throw（呼叫端據此決定要不要扣金幣）。
  // 伺服器回來的 board 比照 saveShop 撿回來（不然購買那一下會把對方新留言丟掉，finding #8）
  const commitShop = async (next: ShopState): Promise<void> => {
    const res = await pushShop(next);
    const cur = res.current;
    setShop(cur ? { ...next, stock: cur.stock ?? next.stock, board: cur.board ? mergeBoard(next.board, cur.board) : next.board } : next);
  };

  if (!introSeen) {
    return (
      <div className="shop-page">
        <ShopIntro onDone={() => { localStorage.setItem('nng:shop-intro3', '1'); setIntroSeen(true); }} />
      </div>
    );
  }
  if (!shop) return <p className="hint">載入店鋪中…</p>;

  return (
    <div className="shop-page">
      <div className="view-head">
        <button className="back" onClick={onBack}>← 返回進度</button>
        <b>🏮 日々喫茶 Lv.{lv}「{shopTitle(lv)}」</b>
      </div>

      {mode !== 'decorate' && <Stage shop={shop} attend={attend} meDone={meDone} talk onBoard={() => setBoardOpen(true)} />}

      <div className="seg" style={{ marginTop: 12 }}>
        <button className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>店面</button>
        <button className={mode === 'shop' ? 'on' : ''} onClick={() => setMode('shop')}>🛍 商店</button>
        <button className={mode === 'decorate' ? 'on' : ''} onClick={() => setMode('decorate')}>🔧 裝潢</button>
      </div>

      {mode === 'view' && <ViewPanel me={me} peer={peer} today={today} lv={lv} shop={shop} />}
      {mode === 'shop' && <ShopPanel me={me} lv={lv} shop={shop} update={update} commitShop={commitShop} />}
      {mode === 'decorate' && <DecoratePanel me={me} attend={attend} meDone={meDone} shop={shop} saveShop={saveShop} />}

      {boardOpen && <DengonBoard me={me} board={shop.board ?? []} onSend={sendBoard} onClose={() => setBoardOpen(false)} />}
    </div>
  );
}

// ── 檢視面板：成長＋收藏 ──
function ViewPanel({ me, peer, today, lv, shop }: { me: UserState; peer: UserState | null; today: string; lv: number; shop: ShopState }) {
  const xp = me.xp + (peer?.xp ?? 0);
  const cur = xp - shopLevelXp(lv);
  const need = shopLevelXp(lv + 1) - shopLevelXp(lv);
  const otherName = USERS.find((u) => u.id !== me.user)!.name;
  const meDone = me.lastDoneDate === today;
  const peerDone = peer?.lastDoneDate === today;
  const nu = nextItemLv(lv);
  const ownedCount = ownedKinds(shop);
  return (
    <>
      <div className="goal-card" style={{ marginTop: 12 }}>
        <div className="goal-head">
          <span>店の成長（兩人 XP 合計 {xp}）</span>
          <span className="exam-count">Lv.{lv + 1} 還差 <b>{need - cur}</b></span>
        </div>
        <div className="goal-bar"><div className="goal-fill" style={{ width: `${Math.min(100, Math.round((cur / need) * 100))}%` }} /></div>
        <p className="goal-note">
          今日開店：{me.user === 'jj' ? 'JJ' : '亞軒'} {meDone ? '✓' : '未'}｜{otherName} {peerDone ? '✓' : '未'}
          {attendance(me, peer, today) === 2 ? '——客滿！' : attendance(me, peer, today) === 1 ? '——一人開店' : '——還沒開店'}
        </p>
        <p className="goal-note">升級解鎖商店新貨架{nu ? `（下個 Lv.${nu}）` : '（全解鎖！）'}；金幣去🛍商店買、🔧裝潢擺進店。</p>
      </div>
      <div className="badge-wall" style={{ marginTop: 12 }}>
        <h3>收藏（{ownedCount}/{CAFE_ITEMS.length} 件）</h3>
        <p className="legend">練習升級解鎖貨架、賺金幣購買，越裝越豐富。點店長可以聊天。</p>
      </div>
    </>
  );
}

// ── 商店面板：依 category 分類購買（E6，中文名見 CATEGORY_LABELS）──
function ShopPanel({ me, lv, shop, update, commitShop }: { me: UserState; lv: number; shop: ShopState; update: (fn: (s: UserState) => UserState) => void; commitShop: (s: ShopState) => Promise<void> }) {
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState('');
  const [buying, setBuying] = useState(false);
  const items = SHOP_ITEMS.filter((it) => it.category === CATEGORY_LABELS[tab][0]);

  const buy = async (item: CafeItem) => {
    if (buying) return;
    if (lv < item.lv) { setMsg(`要店 Lv.${item.lv} 才進這件貨`); return; }
    if (me.coins < item.price) { setMsg(`金幣不夠（差 ${item.price - me.coins}）`); return; }
    // 只加庫存、不自動擺放（進裝潢托盤，讓玩家自己擺）；可重複買
    const owned = (shop.stock[item.id] ?? 0) + 1;
    const next: ShopState = { ...shop, stock: { ...shop.stock, [item.id]: owned } };
    // 先確定共有 KV 寫入成功，確認後才扣金幣——避免「連線失敗但金幣照扣、東西沒到手」
    setBuying(true);
    setMsg('購買中…');
    try {
      await commitShop(next);
    } catch {
      setMsg('沒買成：連線失敗，金幣沒扣，等等再試一次');
      setBuying(false);
      return;
    }
    update((s) => ({ ...s, coins: s.coins - item.price }));
    sfx.unlock();
    setMsg(`買了「${item.name}」！已放進裝潢托盤（庫存 ×${owned}）`);
    setBuying(false);
  };

  return (
    <>
      <div className="coin-bar"><span className="coin-chip">🪙 {me.coins}</span></div>
      <div className="seg">
        {CATEGORY_LABELS.map(([key, label], i) => (
          <button key={key} className={tab === i ? 'on' : ''} onClick={() => { setTab(i); setMsg(''); }}>{label}</button>
        ))}
      </div>
      {msg && <p className="hint">{msg}</p>}
      {items.length === 0 ? (
        <p className="hint">這個分類目前沒有貨（之後會補上）。</p>
      ) : (
        <div className="catalog">
          {items.map((item) => {
            const owned = shop.stock[item.id] ?? 0;
            const locked = lv < item.lv;
            return (
              <div key={item.id} className={`cat-item ${locked ? 'locked' : ''}`}>
                <div className="ci-preview"><img src={item.sprite} alt="" draggable={false} /></div>
                <div className="ci-body">
                  <b>{item.name}</b>
                  <small>{item.w}×{item.h} 格{owned > 0 ? `　庫存 ×${owned}` : ''}</small>
                </div>
                {locked ? (
                  <span className="ci-lock">🔒 Lv.{item.lv}</span>
                ) : (
                  <button className="ci-buy" onClick={() => buy(item)} disabled={buying}>🪙 {item.price}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── 裝潢面板：格子擺家具＋招牌布丁 ──
function DecoratePanel({ me, attend, meDone, shop, saveShop }: { me: UserState; attend: number; meDone: boolean; shop: ShopState; saveShop: (s: ShopState) => void }) {
  const [placing, setPlacing] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>('front'); // 正在放的朝向（旋轉鍵）
  const [selected, setSelected] = useState<number | null>(null); // 選取的「已擺」家具 index（就地旋轉/收回）
  const [sub, setSub] = useState<'furn' | 'sign'>('furn');
  const [catTab, setCatTab] = useState(0); // 托盤 category 分頁籤（E6）

  const select = (id: string | null) => { setPlacing(id); setFacing('front'); setSelected(null); };
  const placingItem = placing ? itemById(placing) : undefined;
  const canRotate = placingItem ? availableFacings(placingItem).length > 1 : false;
  const rotate = () => { if (placingItem) setFacing((f) => nextFacing(placingItem, f)); };

  // 點已擺家具＝選取切換（再點同一件或點空白 i<0＝取消選取）；選取時清掉放置中狀態
  const selectPlaced = (i: number) => { setSelected((cur) => (i < 0 || cur === i ? null : i)); setPlacing(null); };
  const selP = selected != null ? shop.layout[selected] : undefined;
  const selItem = selP ? itemById(selP.id) : undefined;
  const selCanRotate = selItem ? availableFacings(selItem).length > 1 : false;
  const rotatePlaced = () => {
    if (selected == null || !selP || !selItem) return;
    const nf = nextFacing(selItem, selP.facing ?? 'front');
    if (nf === (selP.facing ?? 'front')) return; // 單向件 no-op
    // 連桌上小物一起繞 footprint 轉；桌子轉後撞件/出界則回 null（不動）
    const next = rotateHost(shop.layout, selected, nf);
    if (!next) { sfx.wrong(); return; }
    saveShop({ ...shop, layout: next });
    sfx.correct(1);
  };

  // 托盤：已購但還沒擺出的，可用份數 = 庫存 − 已擺（可同款多件）；按 category 分頁籤（E6）
  const allTrayItems = CAFE_ITEMS
    .map((it) => ({ it, avail: stockAvailable(shop, it.id) }))
    .filter((x) => x.avail > 0);
  const trayItems = allTrayItems.filter((x) => x.it.category === CATEGORY_LABELS[catTab][0]);

  const placeAt = (gx: number, gy: number) => {
    if (!placing) return;
    if (!canPlace(shop.layout, placing, gx, gy, -1, facing)) { sfx.wrong(); return; }
    // 只在非 front 時記 facing（front＝預設，存檔乾淨）
    const placed = facing === 'front' ? { id: placing, gx, gy } : { id: placing, gx, gy, facing };
    const nextLayout = [...shop.layout, placed];
    saveShop({ ...shop, layout: nextLayout });
    sfx.correct(1);
    // 還有同款庫存就保持選取、可連續擺；擺完就取消
    const remaining = (shop.stock[placing] ?? 0) - nextLayout.filter((p) => p.id === placing).length;
    if (remaining <= 0) select(null);
  };
  const pickUp = (index: number) => {
    // 搬走 host 家具時，其上寄生的檯面小物一起收回托盤（別變孤兒）
    const drop = new Set([index, ...guestIndicesOf(shop.layout, index)]);
    saveShop({ ...shop, layout: shop.layout.filter((_, i) => !drop.has(i)) });
    sfx.wrong();
  };
  const removeSelected = () => { if (selected != null) { pickUp(selected); setSelected(null); } };
  // 拖曳把第 index 件搬到 (gx,gy)（是桌子的話桌上小物一起位移）；搬完保持選取可連續搬/轉
  const moveIndexTo = (index: number, gx: number, gy: number) => {
    const p = shop.layout[index], it = p ? itemById(p.id) : undefined;
    if (!p || !it) return;
    const fc = p.facing ?? 'front';
    if (!canPlace(shop.layout, p.id, gx, gy, index, fc)) { sfx.wrong(); return; }
    const dx = gx - p.gx, dy = gy - p.gy;
    if (dx === 0 && dy === 0) return; // 原地沒動
    const guests = new Set(guestIndicesOf(shop.layout, index));
    const layout = shop.layout.map((q, i) => (i === index ? { ...q, gx, gy } : guests.has(i) ? { ...q, gx: q.gx + dx, gy: q.gy + dy } : q));
    saveShop({ ...shop, layout });
    sfx.correct(1);
    setSelected(index);
  };

  const ownedPuddings = PUDDINGS.filter((p) => (me.puddings?.[p.id] ?? 0) > 0);

  return (
    <>
      <Stage shop={shop} attend={attend} meDone={meDone} editing placing={placing} placingFacing={facing} selectedIndex={selected} onCell={placeAt} onItem={selectPlaced} onMove={moveIndexTo} />
      {placing ? (
        <p className="hint">
          點（或拖到）綠格放下「{placingItem?.name}」
          {canRotate && <> · <button className="linkish" style={{ display: 'inline' }} onClick={rotate}>🔄 轉向（{FACING_LABEL[facing]}）</button></>}
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={() => select(null)}>取消</button>
        </p>
      ) : selected != null ? (
        <p className="hint">
          選取「{selItem?.name}」·直接拖它搬位置
          {selCanRotate && <> · <button className="linkish" style={{ display: 'inline' }} onClick={rotatePlaced}>🔄 轉向（{FACING_LABEL[selP?.facing ?? 'front']}）</button></>}
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={removeSelected}>🗑 收回托盤</button>
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={() => setSelected(null)}>取消選取</button>
        </p>
      ) : (
        <p className="hint">點托盤家具→擺進店裡；店裡的家具直接<b>拖拉搬移</b>，點一下＝選取（可 🔄 轉向／🗑 收回），再點一下或點空白＝取消。</p>
      )}

      <div className="seg" style={{ marginTop: 8 }}>
        {([['furn', '家具'], ['sign', '招牌']] as const).map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => { setSub(k); select(null); }}>{l}</button>
        ))}
      </div>

      {sub === 'furn' && (
        <>
          <div className="seg" style={{ marginTop: 8 }}>
            {CATEGORY_LABELS.map(([key, label], i) => (
              <button key={key} className={catTab === i ? 'on' : ''} onClick={() => setCatTab(i)}>{label}</button>
            ))}
          </div>
          <div className="deco-tray">
          {allTrayItems.length === 0 ? (
            <p className="hint">托盤空了——去🛍商店買家具，或店裡的家具都擺好了。</p>
          ) : trayItems.length === 0 ? (
            <p className="hint">這個分類托盤是空的，換一個分頁籤看看。</p>
          ) : null}
          {trayItems.map(({ it, avail }) => (
            <button key={it.id} className={`tray-item ${placing === it.id ? 'on' : ''}`} onClick={() => select(placing === it.id ? null : it.id)}>
              {avail > 1 && <span className="tray-qty">×{avail}</span>}
              <img src={it.sprite} alt="" draggable={false} />
              <small>{it.name}</small>
            </button>
          ))}
          </div>
        </>
      )}
      {sub === 'sign' && (
        <div className="deco-tray">
          <button className={`tray-item ${!shop.sign ? 'on' : ''}`} onClick={() => saveShop({ ...shop, sign: '' })}><span className="ci-swatch none">✕</span><small>不掛</small></button>
          {ownedPuddings.length === 0 && <p className="hint">還沒收集到布丁——每天完成練習會掉布丁。</p>}
          {ownedPuddings.map((p) => (
            <button key={p.id} className={`tray-item ${shop.sign === p.id ? 'on' : ''}`} onClick={() => saveShop({ ...shop, sign: p.id })}>
              <span className="pud" style={{ filter: `hue-rotate(${p.hue}deg) saturate(${p.sat ?? 1})` }}>🍮</span>
              <small>{p.name.replace('布丁', '')}</small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
