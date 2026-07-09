// 共有店鋪狀態（存 KV，兩人共編）。編輯不頻繁，用 last-write-wins。
// 素材＝JJ 在 Tiled 手畫的咖啡廳，經 scripts/build-cafe-assets.py 切成 public/cafe/。
import { CAFE_ITEMS, STARTER_LAYOUT } from '../data/cafe.gen.ts';
import type { UserId } from '../types.ts';

export type Facing = 'front' | 'back' | 'left' | 'right';

// 伝言板：JJ×亞軒 共享留言（append-only，跟 stock 一樣走 shop KV，union 合併不覆蓋）。
export interface BoardMsg {
  author: UserId; // 留言者
  text: string;
  at: string; // ISO 時間戳（同時排序＋去重鍵）
}
export { BOARD_MAX, mergeBoard } from './board.ts';

export interface PlacedItem {
  id: string; // 家具 id（cafe.gen.ts 的 CafeItem.id，全域唯一）
  gx: number; // 格子座標（footprint 左上角）
  gy: number;
  facing?: Facing; // 朝向（省略＝front）；left/right 會把 footprint 的 w/h 對調
}

export interface ShopState {
  stock: Record<string, number>; // 各家具已購「數量」（共有庫存；同一件可買多個，擺出的會從托盤消耗）
  sign: string; // 招牌布丁 id，'' = 無
  layout: PlacedItem[]; // 已擺放家具（可含重複 id）
  board: BoardMsg[]; // 伝言板留言串（append-only，union 合併）
  updatedAt: string;
}

// 開局免費附贈的家具 id（cafe 原有可動家具，各贈 1 件）
export const STARTER_IDS: string[] = CAFE_ITEMS.filter((i) => i.starter).map((i) => i.id);
const starterStock = (): Record<string, number> => Object.fromEntries(STARTER_IDS.map((id) => [id, 1]));

export const DEFAULT_SHOP: ShopState = {
  stock: starterStock(),
  sign: '',
  layout: STARTER_LAYOUT.map((p) => ({ ...p })),
  board: [],
  updatedAt: '',
};

/** 庫存合併：各鍵取較大值（計數版的「聯集」，並發購買不掉單）。 */
export function mergeStock(a: Record<string, number> | undefined, b: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

export function normalizeShop(s: (Partial<ShopState> & { owned?: string[] }) | null): ShopState {
  const raw = s ?? {};
  // stock 來源：新格式直接用；舊格式 owned: string[] 遷移成計數
  let stock: Record<string, number> = {};
  if (raw.stock && typeof raw.stock === 'object') stock = { ...raw.stock };
  else if (Array.isArray(raw.owned)) for (const id of raw.owned) stock[id] = (stock[id] ?? 0) + 1;
  // 開局家具永遠至少 1（免費贈品，收回托盤後仍能再擺）
  for (const id of STARTER_IDS) stock[id] = Math.max(stock[id] ?? 0, 1);
  // 首次（KV 全空、沒有 layout 欄位）給預設佈置；已存在 layout（含空陣列）則尊重使用者擺放
  const layout = !s || raw.layout === undefined ? STARTER_LAYOUT.map((p) => ({ ...p })) : raw.layout;
  const board = Array.isArray(raw.board) ? raw.board : [];
  return { stock, sign: raw.sign ?? '', layout, board, updatedAt: raw.updatedAt ?? '' };
}

export async function fetchShop(): Promise<ShopState> {
  const r = await fetch('/api/shop');
  if (!r.ok) throw new Error(`shop ${r.status}`);
  const raw = await r.json();
  // KV 全空 → 回 null-ish，normalizeShop 會給預設佈置
  return normalizeShop(raw && Object.keys(raw).length ? raw : null);
}

export interface ShopPushResult {
  ok: boolean;
  saved?: boolean;
  current?: ShopState; // 伺服器合併後的最新狀態（含合併後的 stock）
}

/** 伝言板獨立推送（finding #1 方案B）：只送留言、完全不帶 layout/sign——留言不再蓋別人剛存的裝潢。
 *  回傳伺服器合併後的完整 board。 */
export async function pushBoard(board: BoardMsg[]): Promise<BoardMsg[]> {
  const r = await fetch('/api/shop/board', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ board }),
  });
  if (!r.ok) throw new Error(`board ${r.status}`);
  const res = (await r.json()) as { board?: BoardMsg[] };
  return Array.isArray(res.board) ? res.board : [];
}

export async function pushShop(s: ShopState): Promise<ShopPushResult> {
  const r = await fetch('/api/shop', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...s, updatedAt: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`shop ${r.status}`);
  return (await r.json()) as ShopPushResult;
}
