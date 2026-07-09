// 家具命名／售價覆寫（手維護）。昭和喫茶改版後，命名與售價都寫在 docs/cafe-catalog.json、
// 由 scripts/build-cafe-ts.py 產進 cafe.gen.ts，這裡通常留空。
// 若要臨時蓋掉某件的名稱/售價（不想改 manifest 重跑），才在這裡填 id → 值。
export const NAME_OVERRIDES: Record<string, string> = {};

export const PRICE_OVERRIDES: Record<string, number> = {};
