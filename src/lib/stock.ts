import type { UserId } from '../types.ts';

export type StockMap = Record<string, number>;
export type StockByUser = Partial<Record<UserId, StockMap>>;

export interface StockStateLike {
  stock?: unknown;
  owned?: unknown;
  stockBase?: unknown;
  stockByUser?: unknown;
}

const USERS: UserId[] = ['jj', 'yaxuan'];

/** 只保留非負有限整數，避免壞存檔把庫存算成 NaN／負數。 */
export function cleanStock(value: unknown): StockMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: StockMap = {};
  for (const [id, raw] of Object.entries(value)) {
    const n = Number(raw);
    if (id && Number.isFinite(n) && n >= 0) out[id] = Math.floor(n);
  }
  return out;
}

function legacyStock(value: StockStateLike | null | undefined): StockMap {
  const stock = cleanStock(value?.stock);
  if (Object.keys(stock).length > 0) return stock;
  if (!Array.isArray(value?.owned)) return {};
  const out: StockMap = {};
  for (const id of value.owned) if (typeof id === 'string') out[id] = (out[id] ?? 0) + 1;
  return out;
}

export function cleanStockByUser(value: unknown): StockByUser {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: StockByUser = {};
  for (const user of USERS) {
    const stock = cleanStock(raw[user]);
    if (Object.keys(stock).length > 0) out[user] = stock;
  }
  return out;
}

/** 單調計數合併：同一玩家的舊請求不會把自己已買數量倒退。 */
export function mergeStock(a: StockMap | undefined, b: StockMap | undefined): StockMap {
  const out: StockMap = { ...(a ?? {}) };
  for (const [id, n] of Object.entries(b ?? {})) out[id] = Math.max(out[id] ?? 0, n);
  return out;
}

export function mergeStockByUser(a: StockByUser | undefined, b: StockByUser | undefined): StockByUser {
  const out: StockByUser = {};
  for (const user of USERS) {
    const merged = mergeStock(a?.[user], b?.[user]);
    if (Object.keys(merged).length > 0) out[user] = merged;
  }
  return out;
}

export function totalStock(stockBase: StockMap, stockByUser: StockByUser): StockMap {
  const out: StockMap = { ...stockBase };
  for (const user of USERS) {
    for (const [id, n] of Object.entries(stockByUser[user] ?? {})) out[id] = (out[id] ?? 0) + n;
  }
  return out;
}

export function stockParts(value: StockStateLike | null | undefined): {
  stockBase: StockMap;
  stockByUser: StockByUser;
  stock: StockMap;
} {
  const explicitBase = cleanStock(value?.stockBase);
  const stockBase = value?.stockBase && typeof value.stockBase === 'object' ? explicitBase : legacyStock(value);
  const stockByUser = cleanStockByUser(value?.stockByUser);
  return { stockBase, stockByUser, stock: totalStock(stockBase, stockByUser) };
}

/**
 * 合併店鋪庫存。
 *
 * 新客戶端把每位玩家新增的數量分開保存，因此兩人的 +1 可以相加；舊客戶端沒有 ledger，
 * 只能把「比目前總數多的差額」遷入 base，維持滾動更新期間的相容性。
 */
export function mergeStockState(current: StockStateLike | null | undefined, incoming: StockStateLike | null | undefined) {
  const cur = stockParts(current);
  const hasLedger = !!incoming?.stockBase && typeof incoming.stockBase === 'object';
  let stockBase = mergeStock(cur.stockBase, hasLedger ? cleanStock(incoming?.stockBase) : undefined);
  const stockByUser = mergeStockByUser(cur.stockByUser, cleanStockByUser(incoming?.stockByUser));

  if (!hasLedger) {
    const oldClientTotal = legacyStock(incoming);
    for (const [id, n] of Object.entries(oldClientTotal)) {
      const delta = Math.max(0, n - (cur.stock[id] ?? 0));
      if (delta > 0) stockBase = { ...stockBase, [id]: (stockBase[id] ?? 0) + delta };
    }
  }

  return { stockBase, stockByUser, stock: totalStock(stockBase, stockByUser) };
}

/** 新購買／轉蛋／週禮物只增加該玩家自己的單調計數。 */
export function addStockForUser<T extends { stock: StockMap; stockBase?: StockMap; stockByUser?: StockByUser }>(
  state: T,
  user: UserId,
  id: string,
  amount = 1,
): T {
  const n = Math.max(0, Math.floor(amount));
  if (!id || n === 0) return state;
  const parts = stockParts(state);
  const mine = { ...(parts.stockByUser[user] ?? {}) };
  mine[id] = (mine[id] ?? 0) + n;
  const stockByUser = { ...parts.stockByUser, [user]: mine };
  return {
    ...state,
    stockBase: parts.stockBase,
    stockByUser,
    stock: totalStock(parts.stockBase, stockByUser),
  };
}
