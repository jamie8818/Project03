import { Fragment, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode, type SyntheticEvent } from 'react';
import type { UserId, UserState } from '../types.ts';
import { USERS } from '../lib/store.ts';
import { grantableGifts } from '../lib/login.ts';
import { addDailyAmount, bumpDailyStreak, bumpMeta, setShopSnapshot } from '../lib/xp.ts';
import { addDays, tpeToday } from '../lib/dates.ts';
import { sfx } from '../lib/sounds.ts';
import Buddy from './Buddy.tsx';
import { PUDDING_BY_ID, PUDDINGS } from '../data/fun.ts';
import {
  CAFE,
  CAFE_ITEMS,
  CATEGORY_LABELS,
  PLACE,
  availableFacings,
  canPlace,
  canTarget,
  canToggleInside,
  dailyShopItems,
  footprintDims,
  frontRowOf,
  guestIndicesOf,
  hostIndexOf,
  isCounterTop,
  isFrontDoorPlaced,
  isFrontWallPlaced,
  isSurfaceGuest,
  itemAtCell,
  itemById,
  moveHost,
  nextFacing,
  ownedKinds,
  PERSONAL_GACHA_COST,
  pickShopLine,
  poseForLine,
  renderOrder,
  rendersInside,
  rendersOnCounter,
  rotateHost,
  shopLevel,
  shopLevelXp,
  shopTitle,
  spriteFor,
  stockAvailable,
  surfaceDepthOffset,
  type CafeItem,
} from '../lib/shop.ts';
import { DEFAULT_SHOP, STARTER_IDS, addStockForUser, fetchShop, mergeBoard, mergeStockState, normalizeShop, pushBoard, pushShop, type BoardMsg, type Facing, type PlacedItem, type ShopState } from '../lib/shopstate.ts';
import { AFFECTION_START, affectionTier, petCat, type PetOutcome } from '../lib/cat.ts';
import Coach, { coachSeen, dismissCoach } from './Coach.tsx';

const STAGE_W = CAFE.w; // 576
const STAGE_H = CAFE.h; // 416
const CELL = CAFE.cell; // 32
const BANNER_H = 200; // 橫幅只露上半（櫃檯＋店長）
const FACING_LABEL: Record<Facing, string> = { front: '前', back: '後', left: '左', right: '右' };
const FACING_ANGLE: Record<Facing, number> = { front: 0, right: 90, back: 180, left: 270 };
const TABLE_INSET = 5; // 檯面小物坐進桌面上緣幾 px（桌沿唇厚；preview 微調）
const COUNTER_SURFACE_Y = 124; // 吧檯檯面小物落點的 stage y（吧檯木檯面上緣；preview 微調）
const COUNTER_INSIDE_Y = 145; // 內側小家電底錨 stage y（檯後工作區＝店長腳邊；落在 counter_front y118–202 內＝下半被正面板遮，E4）
// 牆上伝言板黑板熱區（dengon-board-spec.md 座標，見 docs/dengon-board-spec.md）
const BOARD_BTN = { left: 243, top: 12, width: 70, height: 50 };
// E10 前牆掛件的渲染錨（base-fg 實測座標）：門面槽錨門頂、門旁牆槽錨前牆頂緣
const FRONT_DOOR_TOP_Y = 341;
const FRONT_WALL_TOP_Y = 373;
const GUEST_FEET_Y = 215; // Q 版客人腳底 baseline（吧檯前點餐站位＝JJ 追加；家具深度排序鍵；CSS .cafe-guest bottom 對應 416−215）
// E15 粉圓貓：4 點位、每 10 分鐘時間決定論輪換（換位不用動畫＝貓的瞬移是特性）。
// 素材 80×68、著地線 canvas y=62（底留 6px）、畫布中心 x=40 → left=x−40、bottom=416−y−6
const CAT_SPOTS = [
  { x: 230, y: 124, pose: 'roll' },  // ① 吧檯檯面右段（收銀機右側空檔，COUNTER_SURFACE_Y）
  { x: 70, y: 220, pose: 'sit' },    // ② 吧檯前地板綠凳邊（偏左避客人 x98–270）
  { x: 450, y: 200, pose: 'groom' }, // ③ 窗邊地板曬太陽舔毛
  { x: 350, y: 370, pose: 'roll' },  // ④ 門口展示櫃左側清空區
] as const;
const catSpotNow = () => Math.floor(Date.now() / 600000); // 10 分鐘檔位窗號；% 池長在使用端算（E21 動態池）

// E20 家具動畫幀：<id>_anim.png 疊在 front 之上（同錨點同尺寸）。
// loop＝CSS steps(1) 硬切各半週期、負 delay 依座標定相位（多實例錯開，三個魚缸不同步游）；
// occasional＝JS 排程（等 period×0.6–1.4 隨機 → 顯示 0.6s → 再排）。缺檔 onError 隱藏（同眨眼/貓 B 幀防呆）。
function AnimOverlay({ it, phaseSeed, style }: { it: CafeItem; phaseSeed: number; style: CSSProperties }) {
  const anim = it.anim!;
  const [on, setOn] = useState(false); // occasional 專用
  useEffect(() => {
    if (anim.mode !== 'occasional') return;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const cycle = () => later(() => { setOn(true); later(() => { setOn(false); cycle(); }, 600); }, anim.period * (0.6 + Math.random() * 0.8) * 1000);
    cycle();
    return () => timers.forEach(clearTimeout);
  }, [anim.mode, anim.period]);
  const animSrc = it.sprite.replace(/\.png$/, '_anim.png');
  const hide = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };
  if (anim.mode === 'loop') {
    const phase = (((phaseSeed * 2654435761) >>> 0) % 1000) / 1000 * anim.period; // 座標種子 → 0–period 穩定相位
    return (
      <img
        className="furn-anim loop"
        src={animSrc}
        alt=""
        draggable={false}
        onError={hide}
        style={{ ...style, animationDuration: `${anim.period}s`, animationDelay: `-${phase.toFixed(2)}s` }}
      />
    );
  }
  return <img className={`furn-anim ${on ? 'on' : ''}`} src={animSrc} alt="" draggable={false} onError={hide} style={style} />;
}

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
  user?: UserId; // 有給才畫 Q 版客人（E9）：meDone 畫我方、attend 含對方時畫對方；banner/裝潢不給＝不畫
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
  onEditGuestLine?: () => void; // E14：點自己的 Q 版客人 → 開自訂台詞編輯（有給才可點）
  onPetCat?: () => { outcome: PetOutcome; value: number } | null; // E18/E19：摸粉圓（好感判定在 ShopPage，回分支＋新好感值）
  catValue?: number; // 目前好感值（頭頂階級章；不給＝不顯示）
  onPandaTalk?: () => void; // E16 Tier B：點店長換句的計數回呼（查水表/頭號粉絲）
}

type Drag = { index: number; grabDx: number; grabDy: number; gx: number; gy: number; moved: boolean; startX: number; startY: number };
const DRAG_THRESHOLD = 6; // 移動超過幾 px 才算「拖曳」，否則當「點一下」（避免觸控輕點誤判成搬移）

function Stage({ shop, attend, meDone, user, talk, variant = 'full', editing, placing, placingFacing, placingIgnore = -1, selectedIndex, onCell, onItem, onMove, onBoard, onEditGuestLine, onPetCat, catValue, onPandaTalk }: StageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // 台詞帶序號 n：同句被連抽兩次時 key 仍變、泡泡動畫照樣重播（泡泡＝顯示幾秒自動淡出）
  const [line, setLine] = useState(() => ({ t: pickShopLine(attend, meDone), n: 0 }));
  const nextLine = () => setLine((l) => ({ t: pickShopLine(attend, meDone), n: l.n + 1 }));
  // E8：點招牌布丁展示座 → 店長切 love 姿勢＋動態台詞（下一輪 interval 自然換回一般池）
  const saySignLine = () => {
    const pud = PUDDING_BY_ID[shop.sign];
    if (!pud) return;
    setGuestBubble(null); // 全域單氣泡：店長開口就關客人的
    setLine((l) => ({ t: { text: `本日の看板プリン：${pud.name}！`, pose: 'love' as const }, n: l.n + 1 }));
  };

  // E14：客人氣泡（點了才彈、~4s 自動收；全域同時只有一個氣泡＝彈出時抑制店長碎念）
  const [guestBubble, setGuestBubble] = useState<{ who: 'me' | 'peer'; text: string; n: number } | null>(null);
  const guestBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popGuestBubble = (who: 'me' | 'peer', text: string) => {
    if (guestBubbleTimer.current) clearTimeout(guestBubbleTimer.current);
    setGuestBubble((b) => ({ who, text, n: (b?.n ?? 0) + 1 }));
    guestBubbleTimer.current = setTimeout(() => setGuestBubble(null), 4200);
  };
  useEffect(() => () => { if (guestBubbleTimer.current) clearTimeout(guestBubbleTimer.current); }, []);
  const peerId = user === 'jj' ? 'yaxuan' : 'jj';
  const peerName = USERS.find((u) => u.id === peerId)?.name ?? '';
  const clickPeerGuest = () => {
    sfx.correct(0);
    popGuestBubble('peer', shop.guestLines?.[peerId] || `${peerName}今天也有來喔`);
  };
  const clickMyGuest = () => { sfx.correct(0); onEditGuestLine?.(); };
  // sprite 長寬比快取（naturalH/naturalW）：只給「非 front 向」的 host 算視覺高度用——
  // manifest 的 spriteHeightTiles 只定義 front 圖（§A 實測：table_square 右向 0.73 vs manifest 1.47），
  // 旋轉向仍得等實圖載入校正；front 向直接吃 manifest、決定性免等圖。
  const [aspect, setAspect] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<Drag | null>(null); // 拖曳中的已擺家具
  const [hover, setHover] = useState<{ gx: number; gy: number } | null>(null); // 放置模式的落點預覽格
  const [fgOk, setFgOk] = useState(true); // 前景層（門/牆去背圖）是否存在；美術還沒出時 onError 關掉
  // E15 粉圓貓：不受 meDone/attend 影響、開店永遠在；每分鐘重算 10 分鐘檔位
  const [catSpot, setCatSpot] = useState(catSpotNow);
  // 裝潢幽靈手示範（直覺式導引③）：首次進裝潢播「拖家具→放地板」循環，玩家一動手永久消失
  const [ghostDemo, setGhostDemo] = useState(() => !coachSeen('ghost'));
  // sprite 視覺高度（提前定義：E21 動態點位也要用）：front＝manifest spriteHeightTiles（決定性）；
  // 其他向＝當下那張圖的實際比例（onLoad 校正），未載入前用 front 每格高度近似
  const spriteH = (it: CafeItem, facing?: Facing): number => {
    if (!facing || facing === 'front') return it.spriteHeightTiles * CELL;
    const fw = footprintDims(it, facing).w;
    return fw * CELL * (aspect[spriteFor(it, facing).src] ?? it.spriteHeightTiles / it.w);
  };
  /** 檯面小物的 bottom（stage px）：嵌內側/host 桌面/吧檯檯面/孤兒落地四情況（renderFurn 與 E21 貓碗點位共用） */
  const surfaceBottomFor = (layout: PlacedItem[], q: PlacedItem, qi: number): number => {
    if (rendersInside(q)) return STAGE_H - COUNTER_INSIDE_Y;
    const host = hostIndexOf(layout, qi);
    if (host >= 0) {
      const hp = layout[host], hit = itemById(hp.id)!;
      return STAGE_H - (frontRowOf(hp) * CELL - spriteH(hit, hp.facing) + TABLE_INSET) + surfaceDepthOffset(layout, qi);
    }
    if (isCounterTop(q.gx, q.gy)) return STAGE_H - COUNTER_SURFACE_Y;
    return STAGE_H - frontRowOf(q) * CELL;
  };
  // E21 粉圓生態系：貓家具擺出＝動態擴充輪換點位（收回即消；純 layout 導出、無新存檔欄位）
  const catSpots: { x: number; y: number; pose: 'sit' | 'groom' | 'roll'; scale?: number }[] = [...CAT_SPOTS];
  shop.layout.forEach((q, qi) => {
    const fr = frontRowOf(q) * CELL;
    if (q.id === 'cat_bed') {
      catSpots.push({ x: q.gx * CELL + CELL / 2, y: fr - 12, pose: 'roll', scale: 0.9 }); // 窩心壓痕、微縮塞窩
    } else if (q.id === 'cat_tower') {
      const it = itemById(q.id);
      if (it) catSpots.push({ x: q.gx * CELL + CELL / 2, y: fr - it.spriteHeightTiles * CELL + 8, pose: 'sit' }); // 頂平台（板厚內縮 8px）
    } else if (q.id === 'cat_bowl') {
      catSpots.push({ x: q.gx * CELL + CELL / 2 + 8, y: STAGE_H - surfaceBottomFor(shop.layout, q, qi), pose: 'sit' }); // 碗邊、同 host 桌面/地面
    } else if (q.id === 'cat_scratcher') {
      catSpots.push({ x: q.gx * CELL + CELL / 2 + 10, y: fr, pose: 'groom' }); // 磨爪：柱旁 +10px、腳底＝前緣 baseline（美術勘誤後補）
    }
  });
  const catSpotIdx = catSpot % catSpots.length;
  const catPose = catSpots[catSpotIdx].pose;

  // E18 粉圓動畫：B 幀差分（JS 隨機時序、時距互質防同步；換位重置）＋摸頭互動 fx
  const [catB, setCatB] = useState(false);
  const [catFx, setCatFx] = useState<{ kind: 'pet' | 'dodge' | 'angry' | 'hand' | 'bar'; n: number; value: number } | null>(null);
  const catFxTimers = useRef<number[]>([]);
  useEffect(() => {
    setCatB(false);
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
    const pose = catPose;
    if (pose === 'groom') {
      // 舔毛循環：B/A 0.4s 交替 ×3（共 2.4s）→ 停 3–5s 隨機 → 重觸發
      const cycle = () => {
        let flips = 0;
        const flip = () => {
          setCatB((b) => !b);
          flips++;
          if (flips < 6) later(flip, 400);
          else { setCatB(false); later(cycle, 3000 + Math.random() * 2000); }
        };
        flip();
      };
      later(cycle, 1700);
    } else if (pose === 'roll') {
      // 伸懶腰：每 15–30s 隨機一次，B 幀定格 1s
      const stretch = () => { setCatB(true); later(() => setCatB(false), 1000); later(stretch, 15000 + Math.random() * 15000); };
      later(stretch, 15000 + Math.random() * 15000);
    } else {
      // 歪頭：每 5–8s 一次，B 幀 0.6s
      const tilt = () => { setCatB(true); later(() => setCatB(false), 600); later(tilt, 5000 + Math.random() * 3000); };
      later(tilt, 5000 + Math.random() * 3000);
    }
    return () => timers.forEach(clearTimeout);
  }, [catSpot, catPose]); // 換位或動態池變動（姿勢跟著變）都重置 B 幀計時
  useEffect(() => () => catFxTimers.current.forEach(clearTimeout), []);
  const clickCat = () => {
    if (!onPetCat || catFx) return; // fx 播放中不重入（點擊仍會在下次生效；連摸視窗 60s 綽綽有餘）
    const res = onPetCat();
    if (!res) return;
    catFxTimers.current.forEach(clearTimeout);
    catFxTimers.current = [];
    const t = (fn: () => void, ms: number) => catFxTimers.current.push(window.setTimeout(fn, ms));
    const n = Date.now();
    if (res.outcome === 'pet') {
      sfx.correct(1);
      setCatFx({ kind: 'pet', n, value: res.value });
      t(() => setCatFx({ kind: 'bar', n: n + 1, value: res.value }), 1200); // 爽臉收尾 → 2s 迷你好感條
      t(() => setCatFx(null), 3200);
    } else if (res.outcome === 'angry') {
      sfx.wrong();
      setCatFx({ kind: 'angry', n, value: res.value });
      t(() => setCatFx(null), 800);
    } else if (res.outcome === 'cooldown') {
      // 冷卻內的無效摸：只給拍手輕量回饋（不擲骰不加分）
      setCatFx({ kind: 'hand', n, value: res.value });
      t(() => setCatFx(null), 1200);
    } else {
      // dodge / sulk：撇頭 0.8s，無 ❤、手省略（撲空）
      setCatFx({ kind: 'dodge', n, value: res.value });
      t(() => setCatFx(null), 800);
    }
  };
  useEffect(() => {
    const iv = setInterval(() => setCatSpot(catSpotNow()), 60000);
    return () => clearInterval(iv);
  }, []);
  const onImgLoad = (src: string) => (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.naturalWidth && aspect[src] === undefined) setAspect((a) => ({ ...a, [src]: el.naturalHeight / el.naturalWidth }));
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
    // 保留場外座標：拖出去＝無效並回原位，不偷偷吸到最左／最右一格。
    return { gx: Math.floor(sx / CELL), gy: Math.floor(sy / CELL) };
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (ghostDemo) { dismissCoach('ghost'); setGhostDemo(false); } // 動手了＝示範退場
    const c = cellFromEvent(e);
    if (placing) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 不支援 capture 時仍可點放 */ }
      setHover(c);
      return;
    } // 放置托盤家具：預覽落點，放開時擺下
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
  const dragOk = drag && dref ? (ddx === 0 && ddy === 0 ? true : moveHost(shop.layout, drag.index, drag.gx, drag.gy) != null) : true;

  // 網格＆放置預覽的「作用中家具」＝放置中的托盤件，或拖曳中的件
  const gId = placing ?? dref?.id ?? null;
  const gFacing = placing ? placingFacing : dref?.facing;
  const gIgnore = placing ? placingIgnore : drag ? drag.index : -1;
  const gItem = gId ? itemById(gId) : undefined;

  // 逐件渲染（依 z 分流：地板家具 overhang 底錨／檯面小物抬到桌面／地毯平貼／壁飾貼牆）。
  // 抽成函式好讓吧檯正面板夾在中間分兩批畫（E3）：地毯在吧檯下、其餘家具在吧檯上。
  const renderFurn = (i: number) => {
    const p = displayLayout[i];
    const it = itemById(p.id);
    if (!it) return null;
    const dims = footprintDims(it, p.facing);
    const isDragged = drag != null && i === drag.index;
    const cls = `cafe-furn z-${it.z} ${editing ? 'editable' : ''} ${editing && i === selectedIndex ? 'selected' : ''} ${isDragged ? (dragOk ? 'dragging' : 'dragging invalid') : ''}`;
    if (isFrontWallPlaced(p)) {
      // E10 前牆掛件：門面槽（cols8–10）錨門頂 y341、門旁牆槽錨牆頂 y373；一律 front sprite（前牆不轉向）。
      // 高度照 footprint 自然長，超出舞台底緣自然裁切＝掛在近端牆上的透視感
      const door = isFrontDoorPlaced(p);
      const fwStyle = { left: p.gx * CELL, top: door ? FRONT_DOOR_TOP_Y : FRONT_WALL_TOP_Y, width: dims.w * CELL, height: dims.h * CELL };
      return (
        <Fragment key={`f${i}`}>
          <img data-i={i} className={cls} src={it.sprite} alt={it.name} draggable={false} style={fwStyle} />
          {it.anim && <AnimOverlay it={it} phaseSeed={p.gx * 131 + p.gy * 97 + i} style={fwStyle} />}
        </Fragment>
      );
    }
    const drawAsSurface = it.z === 'surface' || (isSurfaceGuest(p.id) && (hostIndexOf(displayLayout, i) >= 0 || isCounterTop(p.gx, p.gy)));
    if (drawAsSurface) {
      // 檯面小物／小型器材：坐在 host 的視覺桌面上；落地型 surface（貓碗）走孤兒落地錨。
      const bottom = surfaceBottomFor(displayLayout, p, i);
      const sStyle: CSSProperties = { left: p.gx * CELL, bottom, width: dims.w * CELL, height: 'auto' };
      const sp = spriteFor(it, p.facing);
      return (
        <Fragment key={`f${i}`}>
          <img data-i={i} className={cls} src={sp.src} alt={it.name} draggable={false} style={{ ...sStyle, transform: sp.flip ? 'scaleX(-1)' : undefined }} />
          {it.anim && sp.src === it.sprite && !sp.flip && <AnimOverlay it={it} phaseSeed={p.gx * 131 + p.gy * 97 + i} style={sStyle} />}
        </Fragment>
      );
    }
    if (it.z === 'furniture') {
      // 底邊釘在 footprint 前緣、寬=佔地寬、高依素材自然比例往上長（overhang）；
      // facing 決定用哪張 sprite（左右對稱件用 _right 鏡像＝scaleX(-1)）。
      // E11：counterTop 件擺上吧檯時改錨檯面 y（跟檯面小物同高度、counter_front 之後全露）
      const sp = spriteFor(it, p.facing);
      const bottom = rendersOnCounter(p) ? STAGE_H - COUNTER_SURFACE_Y : STAGE_H - frontRowOf(p) * CELL;
      const fStyle: CSSProperties = { left: p.gx * CELL, bottom, width: dims.w * CELL, height: 'auto' };
      return (
        <Fragment key={`f${i}`}>
          <img
            data-i={i}
            className={cls}
            src={sp.src}
            alt={it.name}
            draggable={false}
            onLoad={onImgLoad(sp.src)}
            onError={(e) => { if (!e.currentTarget.src.endsWith(it.sprite)) e.currentTarget.src = it.sprite; }} // 該向 sprite 還沒生 → 退回 front，不露破圖
            style={{ ...fStyle, transform: sp.flip ? 'scaleX(-1)' : undefined }}
          />
          {/* E20：anim 幀只對 front 向（差分幀畫的是 front；轉向/鏡像時不疊） */}
          {it.anim && sp.src === it.sprite && !sp.flip && <AnimOverlay it={it} phaseSeed={p.gx * 131 + p.gy * 97 + i} style={fStyle} />}
        </Fragment>
      );
    }
    if (it.z === 'rug') {
      const angle = FACING_ANGLE[p.facing ?? 'front'];
      const rugStyle: CSSProperties = { left: p.gx * CELL, top: p.gy * CELL, width: dims.w * CELL, height: dims.h * CELL };
      return (
        <div key={`f${i}`} data-i={i} className={cls} style={rugStyle}>
          <img className="cafe-rug-sprite" src={it.sprite} alt={it.name} draggable={false} style={{ width: it.w * CELL, height: it.h * CELL, transform: `translate(-50%, -50%) rotate(${angle}deg)` }} />
        </div>
      );
    }
    // wall（貼牆框內）
    const rwStyle = { left: p.gx * CELL, top: p.gy * CELL, width: dims.w * CELL, height: dims.h * CELL };
    return (
      <Fragment key={`f${i}`}>
        <img data-i={i} className={cls} src={it.sprite} alt={it.name} draggable={false} style={rwStyle} />
        {it.anim && <AnimOverlay it={it} phaseSeed={p.gx * 131 + p.gy * 97 + i} style={rwStyle} />}
      </Fragment>
    );
  };

  // 放置中直接畫「最後會出現的家具」，不再只讓玩家猜 footprint 方框；前牆也使用真正門頂／牆頂錨。
  const renderPlacementPreview = () => {
    if (!placing || !hover) return null;
    const it = itemById(placing);
    if (!it) return null;
    const p: PlacedItem = placingFacing && placingFacing !== 'front'
      ? { id: placing, gx: hover.gx, gy: hover.gy, facing: placingFacing }
      : { id: placing, gx: hover.gx, gy: hover.gy };
    const ok = canPlace(shop.layout, placing, p.gx, p.gy, placingIgnore, p.facing);
    const cls = `place-sprite-ghost ${ok ? 'ok' : 'no'}`;
    const dims = footprintDims(it, p.facing);
    const previewLayout = [...shop.layout, p];
    const pi = previewLayout.length - 1;

    if (isFrontWallPlaced(p)) {
      return <img className={cls} src={it.sprite} alt="" draggable={false} style={{ left: p.gx * CELL, top: isFrontDoorPlaced(p) ? FRONT_DOOR_TOP_Y : FRONT_WALL_TOP_Y, width: dims.w * CELL, height: dims.h * CELL }} />;
    }
    const drawAsSurface = it.z === 'surface' || (isSurfaceGuest(p.id) && (hostIndexOf(previewLayout, pi) >= 0 || isCounterTop(p.gx, p.gy)));
    if (drawAsSurface) {
      const sp = spriteFor(it, p.facing);
      return <img className={cls} src={sp.src} alt="" draggable={false} style={{ left: p.gx * CELL, bottom: surfaceBottomFor(previewLayout, p, pi), width: dims.w * CELL, height: 'auto', transform: sp.flip ? 'scaleX(-1)' : undefined }} />;
    }
    if (it.z === 'furniture') {
      const sp = spriteFor(it, p.facing);
      const bottom = rendersOnCounter(p) ? STAGE_H - COUNTER_SURFACE_Y : STAGE_H - frontRowOf(p) * CELL;
      return <img className={cls} src={sp.src} alt="" draggable={false} style={{ left: p.gx * CELL, bottom, width: dims.w * CELL, height: 'auto', transform: sp.flip ? 'scaleX(-1)' : undefined }} />;
    }
    if (it.z === 'rug') {
      return (
        <div className={cls} style={{ left: p.gx * CELL, top: p.gy * CELL, width: dims.w * CELL, height: dims.h * CELL }}>
          <img className="cafe-rug-sprite" src={it.sprite} alt="" draggable={false} style={{ width: it.w * CELL, height: it.h * CELL, transform: `translate(-50%, -50%) rotate(${FACING_ANGLE[p.facing ?? 'front']}deg)` }} />
        </div>
      );
    }
    return <img className={cls} src={it.sprite} alt="" draggable={false} style={{ left: p.gx * CELL, top: p.gy * CELL, width: dims.w * CELL, height: dims.h * CELL }} />;
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
  const frontWallOrder: number[] = []; // E10：前牆掛件（base-fg 之上、恆亮）
  for (const i of order) {
    const it = itemById(displayLayout[i].id);
    if (isFrontWallPlaced(displayLayout[i])) frontWallOrder.push(i);
    else if (it?.z === 'rug') rugOrder.push(i);
    else if (it?.z === 'wall') wallOrder.push(i);
    else if (rendersInside(displayLayout[i])) insideOrder.push(i); // 依實際落點/變體分流（E7），不是依 hostType 一刀切
    else aboveCounterOrder.push(i);
  }
  // 動態實體（Q 版客人／粉圓貓）深度排序：以各自腳底 y 當 baseline，與 aboveCounter 家具逐件交錯
  // （前緣 y ≤ 腳底的家具畫實體後面、大於的畫前面）；貓的檯面點位 y=124 也走同一條（本層已在 counter_front 後）
  const cat = catSpots[catSpotIdx];

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

        {/* 接地陰影層：只有地板家具在 footprint 前緣畫柔邊橢圓（檯面小物在桌上、不投地影） */}
        {displayLayout.map((p, i) => {
          const it = itemById(p.id);
          if (!it || it.z !== 'furniture' || rendersOnCounter(p) || (isSurfaceGuest(p.id) && hostIndexOf(displayLayout, i) >= 0)) return null;
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
            onClick={talk ? () => { sfx.correct(1); setGuestBubble(null); nextLine(); onPandaTalk?.(); } : undefined}
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

        {/* 地板家具(L1)＋檯面小物(L2)：畫在吧檯正面板之上＝吧檯外家具擋住吧檯、且都畫在店長之上（店長在最後排）。E3
            Q 版客人（E9）以腳底 baseline 加入深度排序（JJ 部署回報②）：前緣 y ≤ 腳底的家具畫客人後面、
            大於的畫前面——逐件分割 aboveCounterOrder、不動 renderOrder 本身。 */}
        {(() => {
          // 實體（客人們＋貓）依腳底 y 與家具前緣交錯合流（都畫在 counter_front 之後的本層）
          const guestsJsx = user && (meDone || attend - (meDone ? 1 : 0) > 0) ? (
            <Fragment key="guests">
              {meDone && (
                <div className={`cafe-guest guest-me ${talk ? 'guest-hit' : ''}`} onClick={talk ? clickMyGuest : undefined} title={talk ? '點我設定一句台詞' : undefined}>
                  <img src={`/cafe/guests/${user}.png`} alt="我" draggable={false} />
                  <img className="guest-blink" src={`/cafe/guests/${user}_blink.png`} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  {!!shop.guestLines?.[user] && <span className="guest-dot">💬</span>}
                  {guestBubble?.who === 'me' && <span key={guestBubble.n} className="guest-bubble">{guestBubble.text}</span>}
                </div>
              )}
              {attend - (meDone ? 1 : 0) > 0 && (
                <div className={`cafe-guest guest-peer ${talk ? 'guest-hit' : ''}`} onClick={talk ? clickPeerGuest : undefined}>
                  <img src={`/cafe/guests/${peerId}.png`} alt="對方" draggable={false} />
                  <img className="guest-blink" src={`/cafe/guests/${peerId}_blink.png`} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  {!!shop.guestLines?.[peerId] && <span className="guest-dot">💬</span>}
                  {guestBubble?.who === 'peer' && <span key={guestBubble.n} className="guest-bubble">{guestBubble.text}</span>}
                </div>
              )}
            </Fragment>
          ) : null;
          const hideOnErr = (e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; };
          const tierBadge = catValue != null ? affectionTier(catValue).badge : '';
          const catJsx = (
            <div
              key="cat"
              className={`cafe-cat ${talk && onPetCat ? 'cat-hit' : ''}`}
              style={{ left: cat.x - 40, bottom: STAGE_H - cat.y - 6, transform: cat.scale ? `scale(${cat.scale})` : undefined, transformOrigin: 'bottom center' }}
              title={talk && onPetCat ? '摸摸粉圓' : undefined}
              onClick={talk && onPetCat ? clickCat : undefined}
            >
              <div className="cat-breathe">
                <img className="cat-a" src={`/cafe/cat/${cat.pose}.png`} alt="粉圓" draggable={false} />
                {/* B 幀差分（E18）：硬切疊層，缺檔 onError 隱藏＝維持 A 幀 */}
                <img className={`cat-b ${catB && !catFx ? 'on' : ''}`} src={`/cafe/cat/${cat.pose}_b.png`} alt="" draggable={false} onError={hideOnErr} />
                {catFx?.kind === 'pet' && <img className="cat-fx" src={`/cafe/cat/${cat.pose}_pet.png`} alt="" draggable={false} onError={hideOnErr} />}
                {(catFx?.kind === 'dodge' || catFx?.kind === 'angry') && (
                  <img className="cat-fx" src={`/cafe/cat/${cat.pose}_dodge.png`} alt="" draggable={false} onError={hideOnErr} />
                )}
              </div>
              {(catFx?.kind === 'pet' || catFx?.kind === 'hand') && (
                <img key={catFx.n} className="cat-hand" src="/cafe/cat/hand_pet.png" alt="" draggable={false} onError={hideOnErr} />
              )}
              {catFx?.kind === 'pet' && <span key={`h${catFx.n}`} className="cat-heart">❤</span>}
              {catFx?.kind === 'angry' && <span key={`a${catFx.n}`} className="cat-anger">💢</span>}
              {catFx?.kind === 'bar' && (
                <span className="cat-affection-bar">
                  {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < Math.round(catFx.value / 20) ? 'on' : ''} />)}
                </span>
              )}
              {!catFx && tierBadge && <span className="cat-tier">{tierBadge}</span>}
            </div>
          );
          const ents = [
            ...(guestsJsx ? [{ y: GUEST_FEET_Y, jsx: guestsJsx }] : []),
            { y: cat.y, jsx: catJsx },
          ].sort((a, b) => a.y - b.y);
          const out: ReactNode[] = [];
          let e = 0;
          for (const i of aboveCounterOrder) {
            const fy = frontRowOf(displayLayout[i]) * CELL;
            while (e < ents.length && ents[e].y <= fy) out.push(ents[e++].jsx);
            out.push(renderFurn(i));
          }
          while (e < ents.length) out.push(ents[e++].jsx);
          return out;
        })()}

        {/* 招牌布丁「食品サンプル展示櫃」（E8 修訂）：門口右側立櫃，木櫃→像素布丁（套口味 hue/sat）→玻璃前板。
            畫在 base-fg 之下＝底緣被前景牆遮（正確景深）、不恆亮（裝潢模式跟其他靠牆家具一樣透出）。
            talk 模式 hover 看口味、點了店長放閃（互動沿用吧檯版）。 */}
        {shop.sign && PUDDING_BY_ID[shop.sign] && (
          <div
            className={`cafe-sign ${talk ? 'sign-hit' : ''}`}
            title={PUDDING_BY_ID[shop.sign].name}
            onClick={talk ? () => { sfx.correct(1); saySignLine(); } : undefined}
          >
            <img className="sign-case" src="/cafe/sign/case_body.png" alt="" draggable={false} />
            <img
              className="sign-pudding"
              src={`/cafe/pudding/${PUDDING_BY_ID[shop.sign].variant}.png`}
              alt={PUDDING_BY_ID[shop.sign].name}
              draggable={false}
              style={{ filter: `hue-rotate(${PUDDING_BY_ID[shop.sign].hue}deg) saturate(${PUDDING_BY_ID[shop.sign].sat ?? 1})` }}
            />
            <img className="sign-glass" src="/cafe/sign/case_glass.png" alt="" draggable={false} />
          </div>
        )}

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

        {/* 前牆掛件層（E10）：暖簾掛門上、燈牌釘門旁牆——畫在 base-fg 之上（掛在最前面的牆表面，
            永不被遮）；裝潢模式牆淡化時掛件維持全亮、更好點選 */}
        {frontWallOrder.map(renderFurn)}

        {/* 裝潢格線（純視覺，pointer-events 由 CSS 關掉；放置或拖曳時顯示）。
            檯面小物含吧檯左右端翹角（col 0/17），格線用整排寬度；其餘家具只到牆內 minCol..maxCol。 */}
        {editing && gId && gItem && (() => {
          // 格線整排（col 0..最右）：最左/最右是地板、壁飾貼側牆、檯面翹角都在邊欄；合法性交給 canPlace
          const colStart = 0;
          const colEnd = CAFE.cols - 1;
          const rows: number[] = [];
          if (canTarget(gId, 'backWall')) rows.push(0, 1);
          if (canTarget(gId, 'floor') || canTarget(gId, 'table') || canTarget(gId, 'counter')) {
            for (let row = 2; row <= PLACE.maxRow; row++) rows.push(row);
          }
          if (canTarget(gId, 'frontWall')) rows.push(12);
          return (
          <div className="grid-overlay">
            {rows.map((gy) =>
              Array.from({ length: colEnd - colStart + 1 }).map((_, cx) => {
                const gx = cx + colStart;
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
            {renderPlacementPreview()}
          </div>
          );
        })()}

        {/* 幽靈手示範（僅首次進裝潢）：半透明手拖一張椅子從托盤方向放到地板，循環播放 */}
        {editing && ghostDemo && variant === 'full' && (
          <div className="ghost-demo" aria-hidden>
            <b className="coach-tip ghost-tip">點下面托盤選家具，再點地板放下</b>
            <div className="ghost-mover">
              <img className="ghost-chair" src="/cafe/catalog/chair_velvet.png" alt="" draggable={false} />
              <img
                className="ghost-hand"
                src="/cafe/ui/hand_point.png"
                alt=""
                draggable={false}
                onError={(e) => { if (!e.currentTarget.src.endsWith('hand_pet.png')) e.currentTarget.src = '/cafe/cat/hand_pet.png'; }}
              />
            </div>
          </div>
        )}

        {/* 牆上伝言板黑板（店面檢視可點，開對話面板）。畫在前景層之上＝不被門牆蓋住、點得到。 */}
        {onBoard && !editing && (
          <button
            type="button"
            className="cafe-board-btn"
            style={BOARD_BTN}
            onClick={() => { dismissCoach('board'); onBoard(); }}
            aria-label="伝言板"
          >
            <img src="/cafe/board/wall_board.png" alt="伝言板" draggable={false} />
            {talk && coachSeen('decorate') && <Coach id="board" label="留言給對方" dy={10} />} {/* 排在買→擺之後（教學動線） */}
          </button>
        )}

        {talk && !guestBubble && <span className="shop-bubble" key={line.n}>{line.t.text}</span>}
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

const CATALOG_IDS = new Set(CAFE_ITEMS.map((it) => it.id)); // 週禮物補發用：判斷素材是否已入庫

const SHOP_GIFT_COINS = 350; // 店長私房錢：首次進店的開店禮金（引導最後一句發放，state 旗標防重複）

const INTRO = [
  `歡迎光臨「日々喫茶」！這間店是你們兩個人共同經營的——這是我的私房錢 🪙${SHOP_GIFT_COINS}，拿去當開店資金，先去🛍商店挑點什麼吧（噓）。`,
];

function ShopIntro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  return (
    <div className="shop-intro">
      <Buddy mood={step >= 2 ? 'cheer' : 'happy'} size={72} />
      <p>{INTRO[step]}</p>
      <button className="primary" onClick={() => (step + 1 < INTRO.length ? setStep(step + 1) : onDone())}>
        {step + 1 < INTRO.length ? '嗯嗯，然後呢 →' : '收下了，開工！'}
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

function DengonBoard({ me, board, onSend, onClose }: { me: UserState; board: BoardMsg[]; onSend: (text: string) => Promise<boolean>; onClose: () => void }) {
  const otherName = USERS.find((u) => u.id !== me.user)!.name;
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState(false); // 送出後短暫「✓ 送出！」回饋（按鈕脈動＋小提示）
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 新留言（含撿到對方的）就捲到底。依賴看「最後一則的時間戳」不看長度——
  // 滿 BOARD_MAX 後 union 進新訊長度恆定，length 永遠不變、就再也不捲了（finding #5）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [board[board.length - 1]?.at]);
  const submit = async () => {
    const t = draft.trim().slice(0, 60);
    if (!t || busy) return;
    setBusy(true);
    setError('');
    const ok = await onSend(t);
    setBusy(false);
    if (!ok) {
      setError('沒送出去，內容還留著；確認連線後再按一次');
      return;
    }
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
          {error && <span className="dengon-sent-toast">{error}</span>}
          <input
            ref={inputRef}
            className="dengon-input"
            value={draft}
            maxLength={60}
            placeholder={`寫一句留給${otherName}…`}
            onChange={(e) => setDraft(e.target.value)}
            // 組字中（IME 選字）的 Enter 不送出：讓輸入法先 commit，再按一次 Enter 才留言（CJK 標準）
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
            disabled={busy}
          />
          <button className={`dengon-send ${sent ? 'sent' : ''}`} onClick={() => void submit()} aria-label="留言" disabled={busy} />
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
  const [lineEditOpen, setLineEditOpen] = useState(false); // E14：自訂台詞編輯面板
  const [introSeen, setIntroSeen] = useState(() => localStorage.getItem('nng:shop-intro3') === '1');
  const [loadError, setLoadError] = useState('');
  const [syncError, setSyncError] = useState('');
  const pendingShop = useRef<{ optimistic: ShopState; payload: ShopState } | null>(null);

  const loadShopState = () => {
    setShop(null);
    setLoadError('');
    fetchShop()
      .then((s) => { setShopSnapshot(s); setShop(s); })
      .catch(() => setLoadError('店鋪讀取失敗。為了保護原本裝潢，現在不會載入預設店或開放編輯。'));
  };

  useEffect(() => {
    loadShopState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每日登入週禮物（熊貓店長來信）：進店補發已賺到、素材已進 catalog 的家具（照順序、遇缺即停）。
  // 共有 stock +1、推送成功才記 furn；失敗＝下次進店再補發。
  useEffect(() => {
    if (!shop) return;
    const gifts = grantableGifts(me, CATALOG_IDS);
    if (gifts.length === 0) return;
    let next: ShopState = shop;
    for (const g of gifts) next = addStockForUser(next, me.user, g.id);
    pushShop(next)
      .then((res) => {
        const merged = normalizeShop(res.current ?? next);
        setShopSnapshot(merged);
        setShop(merged);
        update((s) => (s.login ? { ...s, login: { ...s.login, furn: s.login.furn + gifts.length } } : s));
      })
      .catch(() => setSyncError('週禮物尚未同步，沒有入帳；下次進店會自動重試。'));
  }, [shop === null]); // eslint-disable-line react-hooks/exhaustive-deps -- 只在首次載到店況後結算一次

  // E16 Tier B「極簡主義」：今天完成練習且開店看時 layout 空 → 記連續日（同日冪等；斷鏈重置）
  useEffect(() => {
    if (!shop || !meDone || shop.layout.length > 0) return;
    update((s) => bumpDailyStreak(s, 'minDay', 'minStreak', today, addDays(today, -1)));
  }, [shop?.layout.length, meDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // 裝潢用：樂觀更新，推上去後用伺服器合併結果校正（撿到對方買的東西＋對方的留言）。
  // stock 是單調 max，直接採伺服器值；board 用 union 再合一次，避免蓋掉本地剛送、伺服器還沒收到的訊。
  const syncShop = (optimistic: ShopState, payload: ShopState = optimistic) => {
    const pending = { optimistic, payload };
    pendingShop.current = pending;
    setSyncError('');
    pushShop(payload)
      .then((res) => {
        const cur = res.current;
        if (pendingShop.current === pending) {
          pendingShop.current = null;
          setSyncError('');
          if (cur) {
            setShop(cur);
            setShopSnapshot(cur);
          }
          return;
        }
        // 較舊請求回來時只撿單調／聯集欄位，不倒退畫面上更新的 layout/sign。
        if (cur) {
          setShop((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...mergeStockState(prev, cur),
              board: cur.board ? mergeBoard(prev.board, cur.board) : prev.board,
            };
          });
        }
      })
      .catch(() => {
        if (pendingShop.current === pending) setSyncError('裝潢還沒同步，畫面先保留你的修改。請重試後再離開店鋪。');
      });
  };

  const saveShop = (next: ShopState, payload: ShopState = next) => {
    setShop(next);
    // E16 店鋪型成就：餵最新店況給 xp.ts snapshot，並輕觸 user state 讓 App 的成就偵測重評
    setShopSnapshot(next);
    update((s) => ({ ...s }));
    syncShop(next, payload);
  };

  // 伝言板送出：樂觀 append（union）後走獨立端點只推留言（finding #1 方案B）——
  // 完全不帶 layout/sign，聊天不會用開頁當下的舊裝潢蓋掉對方剛存的新裝潢。回傳再撿對方新留言。
  const sendBoard = async (text: string): Promise<boolean> => {
    if (!shop) return false;
    const msg: BoardMsg = { author: me.user, text, at: new Date().toISOString() };
    const next = mergeBoard(shop.board, [msg]);
    try {
      const cur = await pushBoard(next);
      setShop((prev) => (prev ? { ...prev, board: mergeBoard(prev.board, cur) } : prev));
      sfx.correct(1);
      return true;
    } catch {
      return false;
    }
  };

  // 購買用：先確定共有 KV 寫入成功才回來，失敗會 throw（呼叫端據此決定要不要扣金幣）。
  // 伺服器回來的 board 比照 saveShop 撿回來（不然購買那一下會把對方新留言丟掉，finding #8）
  const commitShop = async (next: ShopState): Promise<void> => {
    const res = await pushShop(next);
    const cur = res.current;
    const merged = cur
      ? normalizeShop({ ...cur, board: cur.board ? mergeBoard(next.board, cur.board) : next.board })
      : next;
    setShopSnapshot(merged); // E16：購買/扭蛋後成就重評（呼叫端隨後的 update 會觸發偵測）
    setShop(merged);
  };

  if (loadError) {
    return (
      <div className="shop-page">
        <p className="hint">{loadError}</p>
        <button className="primary" onClick={loadShopState}>重新讀取店鋪</button>
        <button className="linkish" onClick={onBack}>← 返回進度</button>
      </div>
    );
  }
  if (!introSeen) {
    return (
      <div className="shop-page">
        <ShopIntro
          onDone={() => {
            localStorage.setItem('nng:shop-intro3', '1');
            setIntroSeen(true);
            // 店長私房錢：每帳號只發一次（state 旗標跨裝置同步；顯示與發放分開 gate，清 localStorage 重看引導不會重複領）
            update((s) => (s.introGiftClaimed ? s : { ...s, coins: s.coins + SHOP_GIFT_COINS, introGiftClaimed: true }));
          }}
        />
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
      {syncError && (
        <p className="hint">
          {syncError}{' '}
          {pendingShop.current && <button className="linkish" style={{ display: 'inline' }} onClick={() => {
            const pending = pendingShop.current;
            if (pending) syncShop(pending.optimistic, pending.payload);
          }}>重新同步</button>}
        </p>
      )}

      {mode !== 'decorate' && (
        <Stage
          shop={shop}
          attend={attend}
          meDone={meDone}
          user={me.user}
          talk
          onBoard={() => setBoardOpen(true)}
          onEditGuestLine={() => setLineEditOpen(true)}
          catValue={me.catAffection?.value ?? AFFECTION_START[me.user]}
          onPetCat={() => {
            // E19 摸頭判定：純函式擲骰 → 寫回 state（跟既有同步管道走）；E21 逗貓棒被動 +5%
            const teaser = shop.layout.some((p) => p.id === 'teaser_stand');
            const res = petCat(me.catAffection, me.user, Date.now(), Math.random, teaser);
            update((s) => ({ ...s, catAffection: res.next }));
            return { outcome: res.outcome, value: res.next.value };
          }}
          onPandaTalk={() => update((s) => bumpMeta(s, 'pandaClicks'))}
        />
      )}
      {lineEditOpen && (
        <GuestLineEditor
          initial={shop.guestLines?.[me.user] ?? ''}
          onSave={(t) => {
            // 只寫自己的鍵（worker 按鍵合併），空字串＝清除台詞（💬 熄滅、對方點到顯示預設句）
            const next = { ...shop, guestLines: { ...(shop.guestLines ?? {}), [me.user]: t } };
            // payload 只送自己的鍵；畫面仍保留完整兩人台詞，避免舊快照蓋回對方的新句子。
            saveShop(next, { ...next, guestLines: { [me.user]: t } });
            setLineEditOpen(false);
            sfx.correct(1);
          }}
          onClose={() => setLineEditOpen(false)}
        />
      )}

      <div className="seg" style={{ marginTop: 12 }}>
        <button className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>店面</button>
        <button className={mode === 'shop' ? 'on' : ''} style={{ position: 'relative' }} onClick={() => { dismissCoach('shop-buy'); setMode('shop'); }}>
          🛍 商店
          {mode === 'view' && me.coins >= 24 && <Coach id="shop-buy" label="買家具" dy={-4} />}
        </button>
        <button className={mode === 'decorate' ? 'on' : ''} style={{ position: 'relative' }} onClick={() => { dismissCoach('decorate'); setMode('decorate'); }}>
          🔧 裝潢
          {mode === 'view' && coachSeen('shop-buy') && Object.keys(shop.stock).some((id) => (shop.stock[id] ?? 0) > 0 && !STARTER_IDS.includes(id)) && (
            <Coach id="decorate" label="擺進店裡" dy={-4} />
          )}
        </button>
      </div>

      {mode === 'view' && <ViewPanel me={me} peer={peer} today={today} lv={lv} shop={shop} />}
      {mode === 'shop' && <ShopPanel me={me} today={today} shop={shop} update={update} commitShop={commitShop} />}
      {mode === 'decorate' && (
        <DecoratePanel
          me={me}
          attend={attend}
          meDone={meDone}
          shop={shop}
          saveShop={saveShop}
          onDecorated={() => update((s) => (s.meta?.shopDecorated ? s : bumpMeta(s, 'shopDecorated')))}
        />
      )}

      {boardOpen && <DengonBoard me={me} board={shop.board ?? []} onSend={sendBoard} onClose={() => setBoardOpen(false)} />}
    </div>
  );
}

// ── Q 版客人自訂台詞編輯（E14）：每人一句 ≤20 字，對方點你的客人會看到 ──
function GuestLineEditor({ initial, onSave, onClose }: { initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="dengon-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="guestline-panel">
        <b>我的 Q 版台詞</b>
        <p className="hint" style={{ margin: '4px 0' }}>對方點你的 Q 版客人會看到這句（清空＝取消台詞）</p>
        <input
          className="guestline-input"
          value={draft}
          maxLength={20}
          placeholder="20 字以內，說點什麼吧…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSave(draft.trim().slice(0, 20)); }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
          <button className="primary" onClick={() => onSave(draft.trim().slice(0, 20))}>掛上去</button>
          <button className="linkish" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

// ── 珍藏・私物轉蛋機（E12）：80 金幣一轉、抽池＝personal 未擁有件（動態、不重複）、
//    全收集掛完売御礼鎖旋鈕。素材 public/cafe/gacha/（源圖 2 倍、顯示減半）。──
function GachaCorner({ me, shop, update, commitShop }: { me: UserState; shop: ShopState; update: (fn: (s: UserState) => UserState) => void; commitShop: (s: ShopState) => Promise<void> }) {
  const personal = CAFE_ITEMS.filter((it) => it.category === 'personal');
  const pool = personal.filter((it) => (shop.stock[it.id] ?? 0) === 0); // 新增 personal 件自動入池（動態 filter）
  const soldOut = pool.length === 0;
  const [phase, setPhase] = useState<'idle' | 'shake' | 'drop' | 'open'>('idle');
  const [prize, setPrize] = useState<CafeItem | null>(null);
  const [spin, setSpin] = useState(0); // 旋鈕累計角度（每轉 +180°）
  const [msg, setMsg] = useState('');
  const busy = phase === 'shake' || phase === 'drop' || phase === 'open';
  const poor = me.coins < PERSONAL_GACHA_COST;
  const locked = soldOut || poor || busy;

  const pull = async () => {
    if (locked) return;
    const pick = pool[Math.floor(Math.random() * pool.length)]; // 均勻隨機；抽中即離池＝保底不重複
    const next = addStockForUser(shop, me.user, pick.id);
    setMsg('');
    setSpin((d) => d + 180);
    setPhase('shake');
    // 比照購買：先確定共有 KV 寫入成功才扣金幣（連線失敗＝金幣不扣、機台歸位）
    try {
      await commitShop(next);
    } catch {
      setPhase('idle');
      setMsg('沒轉成：連線失敗，金幣沒扣，等等再試一次');
      return;
    }
    update((s) => addDailyAmount(addDailyAmount({ ...s, coins: s.coins - PERSONAL_GACHA_COST }, 'spendDay', 'spendAmt', PERSONAL_GACHA_COST, tpeToday()), 'gachaDay', 'gachaCount', 1, tpeToday()));
    setPrize(pick);
    sfx.correct(1);
    window.setTimeout(() => setPhase('drop'), 450); // shake 0.4s 播完掉蛋
  };

  const openCapsule = () => {
    if (phase !== 'drop') return;
    sfx.win();
    setPhase('open');
  };

  return (
    <div className="gacha-corner">
      <div
        className={`gacha-machine ${phase === 'shake' ? 'shaking' : ''} ${locked && phase === 'idle' ? 'locked' : ''}`}
        title={soldOut ? '完売御礼——全部收齊了！' : poor ? `金幣不足（${PERSONAL_GACHA_COST}）` : `轉一次 ${PERSONAL_GACHA_COST} 金幣`}
        role="button"
        aria-disabled={locked}
        onClick={pull}
      >
        <img className="gm-body" src="/cafe/gacha/machine.png" alt="轉蛋機" draggable={false} />
        <img className="gm-knob" src="/cafe/gacha/knob.png" alt="" draggable={false} style={{ transform: `rotate(${spin}deg)` }} />
        {soldOut && <img className="gm-soldout" src="/cafe/gacha/kanban_soldout.png" alt="完売御礼" draggable={false} />}
        {phase === 'drop' && (
          <img className="gm-capsule" src="/cafe/gacha/capsule_closed.png" alt="膠囊（點我打開）" draggable={false} onClick={(e) => { e.stopPropagation(); openCapsule(); }} />
        )}
      </div>
      {msg && <p className="hint">{msg}</p>}
      {phase === 'open' && prize ? (
        <div className="gacha-card">
          <img className="gc-capsule" src="/cafe/gacha/capsule_open.png" alt="" draggable={false} />
          <img className="gc-prize" src={prize.sprite} alt={prize.name} draggable={false} />
          <b>{prize.name}</b>
          {prize.flavor && <small className="ci-flavor">{prize.flavor}</small>}
          <button className="primary" onClick={() => { setPhase('idle'); setPrize(null); }}>收下！已放進裝潢托盤 →</button>
        </div>
      ) : (
        <p className="hint" style={{ margin: '6px 0' }}>
          {soldOut
            ? '完売御礼——珍藏全數收齊！'
            : phase === 'drop'
              ? '出貨了！點膠囊打開 →'
              : `點機台轉一次（🪙 ${PERSONAL_GACHA_COST}）：${personal.length - pool.length}/${personal.length} 已收藏，轉到的直接進裝潢托盤`}
        </p>
      )}
      <div className="gacha-grid">
        {personal.map((it) => {
          const owned = (shop.stock[it.id] ?? 0) > 0;
          return (
            <div key={it.id} className={`gacha-cell ${owned ? 'owned' : ''}`} title={owned ? `${it.name}${it.flavor ? `：${it.flavor}` : ''}` : '？？？'}>
              <img src={it.sprite} alt="" draggable={false} />
              <small>{owned ? it.name : '？？？'}</small>
            </div>
          );
        })}
      </div>
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
        <p className="goal-note">練習提升店等級；商店每天換 10 件貨，賺金幣去🛍商店買、再到🔧裝潢擺進店。</p>
      </div>
      <div className="badge-wall" style={{ marginTop: 12 }}>
        <h3>收藏（{ownedCount}/{CAFE_ITEMS.length} 件）</h3>
        <p className="legend">每天逛新貨、賺金幣購買，越裝越豐富。點店長可以聊天。</p>
      </div>
    </>
  );
}

// ── 商店面板：一般貨架每日固定隨機 10 件；珍藏・私物保留獨立轉蛋池。──
function ShopPanel({ me, today, shop, update, commitShop }: { me: UserState; today: string; shop: ShopState; update: (fn: (s: UserState) => UserState) => void; commitShop: (s: ShopState) => Promise<void> }) {
  const [tab, setTab] = useState<'daily' | 'gacha'>('daily');
  const [msg, setMsg] = useState('');
  const [buying, setBuying] = useState(false);
  const items = dailyShopItems(today);

  const buy = async (item: CafeItem) => {
    if (buying) return;
    if (me.coins < item.price) { setMsg(`金幣不夠（差 ${item.price - me.coins}）`); return; }
    // 只加庫存、不自動擺放（進裝潢托盤，讓玩家自己擺）；可重複買
    const next = addStockForUser(shop, me.user, item.id);
    const owned = next.stock[item.id] ?? 0;
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
    update((s) => addDailyAmount({ ...s, coins: s.coins - item.price }, 'spendDay', 'spendAmt', item.price, tpeToday()));
    sfx.unlock();
    setMsg(`買了「${item.name}」！已放進裝潢托盤（庫存 ×${owned}）`);
    setBuying(false);
  };

  return (
    <>
      <div className="coin-bar"><span className="coin-chip">🪙 {me.coins}</span></div>
      <div className="seg">
        <button className={tab === 'daily' ? 'on' : ''} onClick={() => { setTab('daily'); setMsg(''); }}>
          今日進貨（10）
        </button>
        <button className={tab === 'gacha' ? 'on' : ''} onClick={() => { setTab('gacha'); setMsg(''); }}>
          珍藏轉蛋
        </button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {tab === 'gacha' ? (
        // E12：珍藏・私物不賣、用轉的（ガチャガチャ）
        <GachaCorner me={me} shop={shop} update={update} commitShop={commitShop} />
      ) : (
        <>
          <div className="daily-stock-note">
            <b>📦 今日進貨 10 件</b>
            <span>{today}・台灣時間明天換貨</span>
          </div>
          <div className="catalog">
            {items.map((item) => {
              const owned = shop.stock[item.id] ?? 0;
              return (
                <div key={item.id} className="cat-item">
                  <div className="ci-preview"><img src={item.sprite} alt="" draggable={false} /></div>
                  <div className="ci-body">
                    <b>{item.name}</b>
                    {item.flavor && <small className="ci-flavor">{item.flavor}</small>}
                    <small>{item.w}×{item.h} 格{owned > 0 ? `　庫存 ×${owned}` : ''}</small>
                  </div>
                  <button className="ci-buy" onClick={() => buy(item)} disabled={buying}>🪙 {item.price}</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ── 裝潢面板：格子擺家具＋招牌布丁 ──
function DecoratePanel({ me, attend, meDone, shop, saveShop, onDecorated }: { me: UserState; attend: number; meDone: boolean; shop: ShopState; saveShop: (s: ShopState) => void; onDecorated: () => void }) {
  const [placing, setPlacing] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>('front'); // 正在放的朝向（旋轉鍵）
  const [selected, setSelected] = useState<number | null>(null); // 選取的「已擺」家具 index（就地旋轉/收回）
  const [sub, setSub] = useState<'furn' | 'sign'>('furn');
  const [catTab, setCatTab] = useState(0); // 托盤 category 分頁籤（E6）
  // 收回模式（JJ 2026-07-09：家具多了逐件選取太慢）：點什麼收什麼；undoStack 記每步前的 layout 供復原
  const [sweep, setSweep] = useState(false);
  const [undoStack, setUndoStack] = useState<PlacedItem[][]>([]);
  const recordUndo = () => setUndoStack((st) => [...st.slice(-29), shop.layout]);

  const select = (id: string | null) => { setPlacing(id); setFacing('front'); setSelected(null); setSweep(false); };
  const placingItem = placing ? itemById(placing) : undefined;
  const canRotate = placingItem ? availableFacings(placingItem).length > 1 : false;
  const rotate = () => { if (placingItem) setFacing((f) => nextFacing(placingItem, f)); };

  // 點已擺家具＝選取切換（再點同一件或點空白 i<0＝取消選取）；選取時清掉放置中狀態
  const selectPlaced = (i: number) => { setSelected((cur) => (i < 0 || cur === i ? null : i)); setPlacing(null); };
  const selP = selected != null ? shop.layout[selected] : undefined;
  const selItem = selP ? itemById(selP.id) : undefined;
  const selCanRotate = selItem ? availableFacings(selItem).length > 1 : false;
  // E7：吧檯格上的 counter-inside 小家電可切「嵌內側⇄放檯面」（省略 top＝嵌入）
  const selCanToggleInside = selP ? canToggleInside(selP) : false;
  const toggleInside = () => {
    if (selected == null || !selP) return;
    const layout = shop.layout.map((p, i) => {
      if (i !== selected) return p;
      if (p.top) { const { top: _, ...rest } = p; return rest; } // 回嵌入＝拿掉旗標，存檔乾淨
      return { ...p, top: true };
    });
    recordUndo();
    saveShop({ ...shop, layout });
    onDecorated();
    sfx.correct(1);
  };
  const rotatePlaced = () => {
    if (selected == null || !selP || !selItem) return;
    const nf = nextFacing(selItem, selP.facing ?? 'front');
    if (nf === (selP.facing ?? 'front')) return; // 單向件 no-op
    // 連桌上小物一起繞 footprint 轉；桌子轉後撞件/出界則回 null（不動）
    const next = rotateHost(shop.layout, selected, nf);
    if (!next) { sfx.wrong(); return; }
    recordUndo();
    saveShop({ ...shop, layout: next });
    onDecorated();
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
    recordUndo();
    saveShop({ ...shop, layout: nextLayout });
    onDecorated();
    sfx.correct(1);
    // 還有同款庫存就保持選取、可連續擺；擺完就取消
    const remaining = (shop.stock[placing] ?? 0) - nextLayout.filter((p) => p.id === placing).length;
    if (remaining <= 0) select(null);
  };
  const pickUp = (index: number) => {
    // 搬走 host 家具時，其上寄生的檯面小物一起收回托盤（別變孤兒）
    const drop = new Set([index, ...guestIndicesOf(shop.layout, index)]);
    recordUndo();
    saveShop({ ...shop, layout: shop.layout.filter((_, i) => !drop.has(i)) });
    sfx.wrong();
  };
  const removeSelected = () => { if (selected != null) { pickUp(selected); setSelected(null); } };
  // ── 收回模式：點什麼收什麼；清空/復原都走 undoStack（存動作前的整份 layout）──
  const enterSweep = () => { setSweep(true); setPlacing(null); setSelected(null); };
  const sweepPick = (i: number) => {
    if (i < 0) return;
    pickUp(i);
  };
  const sweepClearAll = () => {
    if (shop.layout.length === 0) return;
    recordUndo();
    saveShop({ ...shop, layout: [] });
    sfx.wrong();
  };
  const undoLast = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack((st) => st.slice(0, -1));
    setSelected(null);
    setPlacing(null);
    saveShop({ ...shop, layout: prev });
    sfx.correct(1);
  };
  // 拖曳把第 index 件搬到 (gx,gy)（是桌子的話桌上小物一起位移）；搬完保持選取可連續搬/轉
  const moveIndexTo = (index: number, gx: number, gy: number) => {
    const p = shop.layout[index], it = p ? itemById(p.id) : undefined;
    if (!p || !it) return;
    if (p.gx === gx && p.gy === gy) return; // 原地沒動
    const layout = moveHost(shop.layout, index, gx, gy);
    if (!layout) { sfx.wrong(); return; }
    recordUndo();
    saveShop({ ...shop, layout });
    onDecorated();
    sfx.correct(1);
    setSelected(index);
  };

  const ownedPuddings = PUDDINGS.filter((p) => (me.puddings?.[p.id] ?? 0) > 0);

  return (
    <>
      <Stage
        shop={shop}
        attend={attend}
        meDone={meDone}
        editing
        placing={placing}
        placingFacing={facing}
        selectedIndex={sweep ? null : selected}
        onCell={sweep ? undefined : placeAt}
        onItem={sweep ? sweepPick : selectPlaced}
        onMove={sweep ? undefined : moveIndexTo}
      />
      {sweep ? (
        <p className="hint">
          🧺 收回模式：<b>點店裡的家具直接收回托盤</b>
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={sweepClearAll}>🗑 全部清空</button>
          {' · '}<button className="linkish" style={{ display: 'inline' }} disabled={undoStack.length === 0} onClick={undoLast}>↩ 復原（{undoStack.length}）</button>
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={() => setSweep(false)}>完成</button>
        </p>
      ) : placing ? (
        <p className="hint">
          點（或拖到）綠格放下「{placingItem?.name}」
          {canRotate && <> · <button className="linkish" style={{ display: 'inline' }} onClick={rotate}>🔄 轉向（{FACING_LABEL[facing]}）</button></>}
          {undoStack.length > 0 && <> · <button className="linkish" style={{ display: 'inline' }} onClick={undoLast}>↩ 復原（{undoStack.length}）</button></>}
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={() => select(null)}>取消</button>
        </p>
      ) : selected != null ? (
        <p className="hint">
          選取「{selItem?.name}」·直接拖它搬位置
          {selCanRotate && <> · <button className="linkish" style={{ display: 'inline' }} onClick={rotatePlaced}>🔄 轉向（{FACING_LABEL[selP?.facing ?? 'front']}）</button></>}
          {selCanToggleInside && <> · <button className="linkish" style={{ display: 'inline' }} onClick={toggleInside}>{selP?.top ? '⬇ 嵌進吧檯' : '⬆ 放上檯面'}</button></>}
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={removeSelected}>🗑 收回托盤</button>
          {undoStack.length > 0 && <> · <button className="linkish" style={{ display: 'inline' }} onClick={undoLast}>↩ 復原（{undoStack.length}）</button></>}
          {' · '}<button className="linkish" style={{ display: 'inline' }} onClick={() => setSelected(null)}>取消選取</button>
        </p>
      ) : (
        <p className="hint">
          點托盤家具→擺進店裡；店裡的家具直接<b>拖拉搬移</b>，點一下＝選取（可 🔄 轉向／🗑 收回），再點一下或點空白＝取消。
          {undoStack.length > 0 && <> {' '}<button className="linkish" style={{ display: 'inline' }} onClick={undoLast}>↩ 復原（{undoStack.length}）</button></>}
          {' '}<button className="linkish" style={{ display: 'inline' }} onClick={enterSweep}>🧺 收回模式</button>
        </p>
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
            <button key={it.id} className={`tray-item ${placing === it.id ? 'on' : ''}`} title={it.flavor || undefined} onClick={() => select(placing === it.id ? null : it.id)}>
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
              {/* 縮圖比照正式渲染用 variant 基底圖套色（E17；不疊櫃體，小圖示意即可） */}
              <img className="tray-pud" src={`/cafe/pudding/${p.variant}.png`} alt="" draggable={false} style={{ filter: `hue-rotate(${p.hue}deg) saturate(${p.sat ?? 1})` }} />
              <small>{p.name.replace('布丁', '')}</small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
