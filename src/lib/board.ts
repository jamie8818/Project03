// 伝言板 mergeBoard：三端共用（前端 shopstate.ts／worker/index.js／vite.config.ts devApi）。
// 刻意零依賴：worker 走 wrangler esbuild bundle、vite config 走 esbuild，都能直接 import 本檔。
export const BOARD_MAX = 50; // 只保留最近 N 則（溢出丟舊）

// 去重最低限欄位（author 各端型別不同，寬鬆收；text/at 缺或非字串＝壞資料，合併時略過）
export interface BoardMsgBase {
  author?: unknown;
  text: string;
  at: string; // ISO 時間戳（同時排序＋去重鍵）
}

/** 留言板合併：append-only 聯集（仿 mergeStock 精神，兩人同時留言不 last-write-wins 蓋掉）。
 *  依 author+at+text 去重、依 at 由舊到新排序、只留最近 BOARD_MAX 則。
 *  去重 key 分隔符用 \u0000 跳脫寫法——別改回原始 NUL byte，git 會把整檔當 binary。 */
export function mergeBoard<M extends BoardMsgBase>(a: readonly M[] | undefined | null, b: readonly M[] | undefined | null): M[] {
  const seen = new Set<string>();
  const out: M[] = [];
  for (const m of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (!m || typeof m.text !== 'string' || typeof m.at !== 'string' || !m.at) continue;
    const key = `${m.author}\u0000${m.at}\u0000${m.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  out.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  return out.slice(-BOARD_MAX);
}
