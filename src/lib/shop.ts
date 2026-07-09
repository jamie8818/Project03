// 喫茶店共同經營：店等級 = 兩人合計 XP 推進，等級解鎖商店貨架；金幣買家具、裝潢擺進店。
// 素材＝JJ 在 Tiled 手畫的咖啡廳，scripts/build-cafe-assets.py 切成 public/cafe/。
// 場景邏輯座標 576×416（18×13 格 32px），資料在 data/cafe.gen.ts。
import {
  CAFE,
  CAFE_ITEMS as RAW_ITEMS,
  PLACE,
  Z_RANK,
  Z_TOP_ROW,
  type CafeItem,
} from '../data/cafe.gen.ts';
import { NAME_OVERRIDES, PRICE_OVERRIDES } from '../data/cafe-overrides.ts';
import type { Facing, PlacedItem, ShopState } from './shopstate.ts';

export { BLOCKED, CAFE, PLACE, Z_RANK, Z_TOP_ROW } from '../data/cafe.gen.ts';
export type { CafeItem, Z層 } from '../data/cafe.gen.ts';

// 疊上手維護的命名／售價覆寫（cafe-overrides.ts，重跑切圖腳本也不會被洗掉）
export const CAFE_ITEMS: CafeItem[] = RAW_ITEMS.map((it) => ({
  ...it,
  name: NAME_OVERRIDES[it.id] ?? it.name,
  price: PRICE_OVERRIDES[it.id] ?? it.price,
}));

export function shopLevel(combinedXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, combinedXp) / 80)) + 1;
}

/** 該等級的起始 XP（顯示升級進度條用） */
export function shopLevelXp(lv: number): number {
  return 80 * (lv - 1) ** 2;
}

export const SHOP_TITLES = ['剛開幕', '巷口小店', '小有名氣', '街坊愛店', '排隊名店', '傳說喫茶'];

export function shopTitle(lv: number): string {
  return SHOP_TITLES[Math.min(Math.floor((lv - 1) / 3), SHOP_TITLES.length - 1)];
}

// ── 家具目錄查詢 ──
export const ITEM_BY_ID: Record<string, CafeItem> = Object.fromEntries(CAFE_ITEMS.map((i) => [i.id, i]));
export const SHOP_ITEMS: CafeItem[] = CAFE_ITEMS.filter((i) => !i.starter); // 進商店販售的（排除開局贈品）

export function itemById(id: string): CafeItem | undefined {
  return ITEM_BY_ID[id];
}

/** 下一個因升級才會解鎖的貨架等級（顯示「還差幾級」用），全解鎖回 null */
export function nextItemLv(lv: number): number | null {
  const lvs = SHOP_ITEMS.filter((i) => i.lv > lv).map((i) => i.lv);
  return lvs.length ? Math.min(...lvs) : null;
}

// ── 店長在店裡的碎念（依營業狀態換話題；點熊貓會再講一句） ──

export const SHOP_LINES = {
  closed: [
    '今天還沒開店……你的日文份還沒練吧',
    '（店暗暗的）我在等你開燈喔',
    '準備中……其實是你在準備中',
    '沒開店的日子，布丁會難過',
    '快去練今天的份，我腳好痠（站著等）',
    '客人在門口張望了，就差你一輪練習',
    '燈沒開我不敢烤布丁，會烤焦（藉口）',
    '打烊狀態的店長，只有平常的三成可愛',
    '我把「準備中」的牌子擦了三遍了，快來',
    '黑暗中的喫茶店，像沒加焦糖的布丁',
    '別怕，練一輪就天亮了',
    '今天的份大概 20 分鐘，比一集動畫短',
    '（小聲）其實我在黑暗裡偷吃了一口布丁',
    '店休不是假期，是遺憾',
    '客人剛剛探頭進來，我說馬上開，別讓我食言',
    '你不來，我就繼續站著。我很會站',
    '燈一暗，貓就以為可以睡櫃檯了',
    '練習之前，先深呼吸。好，去吧',
    '店長日記：今日未開店。內容：無。心情：等',
    '暖爐都冷了……快來點火（比喻你）',
    '這麼晚還沒開店，房租照算欸（誰付？）',
    '傳說中連續開店 30 天的店，會發光喔',
    '御神籤抽了嗎？搞不好今天大吉',
    '今天的你只需要贏過昨天的你，來',
    '門口的風鈴響了三次，都不是你',
    '我不催你，我只是把「準備中」掛得特別顯眼',
    '黑板上的留言在等一個練完的人喔',
    '就算末吉的日子，開店就是吉',
    '沒開店的店長，像沒有音樂的卡拉OK',
    '燈開了我再講笑話給你聽（先付款：練習一輪）',
    '偷偷告訴你，深夜的布丁特別甜，練完來一份',
    '再不開店，散步客要走去隔壁了（沒有隔壁）',
    '今天份的日文在門口排隊，放它們進來吧',
    '你知道嗎，開店的瞬間我尾巴會搖（沒尾巴）',
    '好啦不催了。……開玩笑的，快來',
  ],
  solo: [
    '今天只有一個人開店，客人少一半',
    '另一位還沒來喔……要不要黑板留言催一下',
    '一人開店也是開店，偉い！',
    '半開店狀態～風扇只開一半（省電）',
    '等那個人來，我把好位子留著',
    '一個人也把店撐起來了，你是台柱',
    '另一半的燈還沒亮，但你這半邊很亮',
    '獨自開店的日子，布丁分你大塊一點',
    '要我去叫他嗎？我只會ぽ〜う，可能沒用',
    '你先練，等等他來了就客滿了',
    '一人開店的 BGM 是安靜的爵士（想像中）',
    '半滿的店有半滿的浪漫',
    '對方今天是不是忙？黑板留句溫柔的吧',
    '你today的出席，我記在光榮簿上了',
    '孤軍奮戰的樣子，帥',
    '等雙人開店那天，我把彩帶準備好',
    '客人問怎麼只開一半，我說另一半在路上',
    '一人份的努力，兩人份的期待',
    '先幫他點好他愛喝的，等他來',
    '今天你是店長代理的代理（我是代理）',
    '有你在，店就不算休息',
    '對決下了戰帖沒？等他上線一起熱鬧',
    '偷偷說，連續一人開店三天的話，我會擔心你們',
    '窗邊的位子空著，總覺得少了什麼',
    '半邊亮的店，像缺了一角的最中餅',
    '沒關係，感情這種事，輪流撐也是撐',
    '他來的時候，記得裝作不在意（我教的）',
    '一人開店加成：店長話變多（現在就是）',
    '今天的你，值得一句えらい',
    '等等他吧，布丁我先冰著',
  ],
  full: [
    '雙人開店！今天客滿，忙死我了（開心）',
    '兩個人都來了，店裡亮晶晶',
    '今日大入！晚上加菜布丁',
    '你們一起來的日子，連咖啡都比較香',
    '客滿御礼！明天也要這樣喔',
    '雙人開店的日子，我走路都有風',
    '滿席！請看客人臉上的笑（我畫的）',
    '你們倆同框，店的等級體感 +1',
    '這就是傳說中的「営業日和」',
    '兩盞燈都亮著，看著就想唱歌',
    '客滿的秘訣？就是你們倆，寫進店訓了',
    '今天的營業額（快樂計）創新高',
    '雙人開店連續紀錄，我在心裡刻正字',
    '你們一起練習的聲音，是本店的 BGM',
    '大入袋準備好了，裡面裝布丁',
    '兩個人都在的話，Boss 也不足為懼吧',
    '今天適合下戰帖，反正都到齊了',
    '店長宣布：今日甜點無限續（想像中）',
    '這種日子多來點，我裝潢都想升級了',
    '客人說這家店有兩位常勝軍，我說對',
    '滿員御礼！留言板記得寫點好話',
    '你們同時在店裡，貓都出來巡場了',
    '雙人開店＝雙倍可愛＝我說的',
    '興隆！興隆！（敲木魚）',
    '兩人都練完的夜晚，星星特別多',
    '今天的店，是整條街最熱鬧的（唯一的）',
    '齊聚！這就叫日文裡的「勢揃い」',
    '我以你們為榮，布丁以我為榮',
    '照這個氣勢，傳說喫茶指日可待',
    '兩位常客都在，我可以安心打個盹了嗎（不行）',
    '雙人開店的日子，連掃把都在跳舞',
    '今日客滿，明日也滿，後日更滿（貪心）',
    '你們知道嗎，兩個人一起變強是很稀有的事',
    '這畫面我想裱起來掛牆上',
    '営業中の札，今天掛得特別正',
  ],
  idle: [
    'いらっしゃいませ〜',
    '布丁……剛烤好……（聞）',
    '這面牆的家紋是我挑的，有品味吧',
    '偷偷說，升級就有新家具，練起來',
    '店長的工作：站著，可愛，偶爾講話',
    '再升幾級，聽說會有貓住進來',
    '暖爐的火我顧著呢，安心練習',
    '有客人的日子，掃地都有勁',
    '嗯？點我幹嘛……開心（小聲）',
    '目標是傳說喫茶！靠你們了',
    '今日のおすすめ：布丁（每天都是）',
    '榻榻米的房間，是我的夢想之一',
    '窗邊那盆是ミント，別問我為什麼知道',
    '簽約時說好的，你們練習我開店',
    '石窯烤的布丁，傳說中好吃三倍',
    'ぽ〜う',
    'ぽ〜う ぽ〜う（營業版）',
    '喫茶店的下午，時間走得比較慢',
    '我的圍裙呢？……我沒有圍裙',
    '咖啡豆是隔壁森林的松鼠批發的（設定）',
    '客人留下的書，我讀了三頁，睡了',
    '櫃檯的高度，是照我的身高訂做的',
    '今天擦了十次杯子，每次都更亮',
    '菜單第一頁是布丁，最後一頁也是',
    '你聽，暖爐的火在唱歌',
    '常連さん（常客）這個詞，唸起來很溫暖',
    '木地板嘎吱響的位置我都背下來了',
    '窗外有貓經過，牠看了我三秒，輸了',
    '本店的水是免費的，笑容也是',
    '有人說店長太閒，我說這叫氣定神閒',
    '收銀機裡有 128 円，鎮店之寶',
    '牆上那幅畫……那是窗戶啦',
    '今天的雲很像鮮奶油，想舀',
    '掃把立起來的日子，會有好事',
    '我數過了，天花板有 96 塊板子',
    '座敷（榻榻米席）要脫鞋喔，貓不用',
    '風鈴是夏天限定，我捨不得收',
    '啊，打翻了牛奶……（沒有，練習講這句）',
    '日文的「喫茶店」唸 きっさてん，考你',
    '布丁的日文是プリン，本店最重要單字',
    '「いただきます」之後的第一口最好吃',
    '常客的座位，椅墊都比較軟（我偷換的）',
    '外帶布丁的紙盒，我摺了一下午',
    '今天練習的聲音，隔壁的鳥有在聽',
    '石窯的溫度，跟你的熱情一樣（現在幾度？）',
    '烤布丁的焦糖香，是本店的招牌結界',
    '偶爾抬頭看看，我都在櫃檯（不然咧）',
    '有一天要在店門口種一棵櫻花樹',
    '你們的 XP 是這間店的柱子，字面意思',
    '店規第一條：開心。第二條：參照第一條',
    '傳說喫茶的傳說，正在被你們寫',
    '客人的笑聲，是最好的裝潢',
    '我調的咖啡有三種：濃、淡、看心情',
    '打烊後我會自己練五十音喔（模仿你）',
    '喫茶店的貓都會日文，是常識',
    '你今天的發音，比昨天圓潤（布丁形容詞）',
    '座位不多，但心意很多',
    '進貨清單：牛奶、雞蛋、勇氣',
    '牆角那株植物又長高了，比我快',
    '有時候我會對著石窯說話，它很會聽',
    '本店的鎮店之寶其實是你們（說出來了）',
    '雨天的客人比較少，布丁比較多（我吃的）',
    '晴天適合曬棉被，我沒有棉被，曬自己',
    '「ごゆっくり」＝請慢慢享用，本店口頭禪',
    '杯子的把手一律朝右，強迫症店長',
    '毎日、君を待ってる（每天都在等你）',
    '你點我的頻率，跟布丁出爐的頻率差不多',
    '這間店最貴的東西，是你們的堅持',
    '菜單上沒有的，跟我說，我畫給你',
    '安靜的午後，適合背五個單字',
    '螞蟻搬走了一粒糖，我目送牠',
    '天氣好的日子，窗台會有光斑，貓的專座',
    '每賣出一份布丁，我就在心裡放一次煙火',
    '喫茶店的時鐘走得慢，是特調的',
    '今天也是適合學日文的好日子（每天都說）',
    '窗戶擦亮了，外面的世界高清了',
    '你們吵架的話，本店提供和好布丁（半價）',
    '賒帳可以，用單字還',
    '店長推薦座位：離暖爐兩步，離我三步',
    '有人問我為什麼是熊貓開店。緣分',
    '燈泡換新的了，亮到布丁反光',
    '練習卡關的時候，看看我，我也卡關（人生）',
    '本店 Wi-Fi 密碼：沒有 Wi-Fi，專心練',
    '你的努力我都看在眼裡，記在帳本裡',
    '帳本第一頁寫著：本店永不放棄（第二頁空白）',
    '偶爾也想去別人的店坐坐……不行，走不開',
    '門鈴「叮」一聲的瞬間，是我最喜歡的音效',
    '據說滿級的店會出現在雜誌上（誰的雜誌？）',
    '掛在牆上的許願牌，寫的都是 N4',
    '你唸日文的時候，客人都安靜了，尊重',
    '布丁的搖晃頻率，是幸福的頻率',
    '今天進了新的茶葉，名字很長，忘了',
    '喫茶店經營的秘訣：等待，與被等待',
    '角落的椅子有點翹腳，那是貓的傑作',
    '冬天賣暖布丁，夏天賣冰布丁，天才吧',
    '睡前複習一輪，夢裡我請客',
    '今天也謝謝光臨。明天的位子留好了',
    '拖地拖到一半發現地板本來就這個顏色',
    '本店禁止的事：放棄。其他都行',
    '你看那個火，燒得多敬業，學它',
    '有一天布丁會有自己的專屬櫃（夢想清單第七項）',
    '喫茶店開久了，連沉默都是香的',
  ],
};

export function pickShopLine(attend: number, meDone: boolean, rng: () => number = Math.random): string {
  const pool = !meDone
    ? [...SHOP_LINES.closed, ...SHOP_LINES.idle.slice(0, 4)]
    : attend >= 2
      ? [...SHOP_LINES.full, ...SHOP_LINES.idle]
      : [...SHOP_LINES.solo, ...SHOP_LINES.idle];
  return pool[Math.floor(rng() * pool.length)];
}

// ── 格子系統（家具擺放，18×13 @32px；座標與尺寸來自 cafe.gen.ts）──

// 家具/地毯真正不能放的固定裝置＝左上吧台本體＝rows 2–4、cols 0–7（引擎直接定義，不吃 BLOCKED）。
// 吧台右側(cols 8,9 那 6 格)其實是地板、可放家具；最左/最右整欄也是地板（非牆）。
const counterBlocked = (gx: number, gy: number) => gy >= 2 && gy <= 4 && gx >= 0 && gx <= 7;

export const zRankOf = (id: string): number => Z_RANK[ITEM_BY_ID[id]?.z ?? 'furniture'];

// ── facing-aware footprint（§2）──
// footprint w×h＝佔地深度；朝左/右時 w↔h 對調，碰撞格一起轉。
export function footprintDims(it: { w: number; h: number }, facing?: Facing): { w: number; h: number } {
  return facing === 'left' || facing === 'right' ? { w: it.h, h: it.w } : { w: it.w, h: it.h };
}

// ── 四向 sprite 解析（§D 檔名慣例）──
// front=<id>.png（＝item.sprite）；back/left/right=<id>_<facing>.png。左右對稱件只畫 _right，
// 缺 left 時引擎用 _right 水平鏡像；沒畫的向退回 front（旋轉 no-op）。
export interface FacingSprite {
  src: string;
  flip: boolean; // 是否水平鏡像（另一側用單邊圖鏡像出來）
}

/** 由 front 圖路徑推同 id 的其他向路徑：<id>.png → <id>_<facing>.png（front 回原路徑） */
const siblingSprite = (frontSrc: string, facing: Facing): string =>
  facing === 'front' ? frontSrc : frontSrc.replace(/\.png$/i, `_${facing}.png`);

/** 依 facing 解析要畫哪張 sprite ＋是否水平鏡像（見 engine-to-art-requests §D）。 */
export function spriteFor(item: CafeItem, facing: Facing = 'front'): FacingSprite {
  const authored = new Set<Facing>(item.facings ?? ['front']);
  authored.add('front'); // front 一定有（＝item.sprite）
  if (authored.has(facing)) return { src: siblingSprite(item.sprite, facing), flip: false };
  if (facing === 'left' && authored.has('right')) return { src: siblingSprite(item.sprite, 'right'), flip: true };
  if (facing === 'right' && authored.has('left')) return { src: siblingSprite(item.sprite, 'left'), flip: true };
  return { src: item.sprite, flip: false }; // 沒畫的向 → 退回 front
}

/** 該件實際可用的向（含單邊鏡像補出的另一側），循環順序 front→right→back→left。旋轉鍵用。 */
export function availableFacings(item: CafeItem): Facing[] {
  const set = new Set<Facing>(item.facings ?? ['front']);
  set.add('front');
  if (set.has('right')) set.add('left'); // 有右＝左可鏡像
  if (set.has('left')) set.add('right'); // 有左＝右可鏡像
  return (['front', 'right', 'back', 'left'] as Facing[]).filter((f) => set.has(f));
}

/** 旋轉鍵：跳到下一個可用向（循環）；單向件回自己（no-op） */
export function nextFacing(item: CafeItem, cur: Facing = 'front'): Facing {
  const av = availableFacings(item);
  const i = av.indexOf(cur);
  return av[(i + 1) % av.length] ?? 'front';
}

/** footprint 前緣列（gy + 佔地深度）＝越大越前面，用來深度排序＋底部錨定（吃 facing） */
export const frontRowOf = (p: PlacedItem): number => {
  const it = ITEM_BY_ID[p.id];
  return p.gy + (it ? footprintDims(it, p.facing).h : 1);
};

// ── 檯面寄生（§4）：小物只落在「有檯面」的家具上，椅子不可放 ──
// §A：改吃 manifest 的 surface:true 旗標（桌／櫃頂／開放層架 true；椅凳沙發卡座 false），
// 取代舊的引擎端硬編白名單——新家具進 catalog 就自動生效，不用回來改這裡。
export const isSurfaceHost = (id: string): boolean => ITEM_BY_ID[id]?.surface === true;
export const isSurfaceGuest = (id: string): boolean => ITEM_BY_ID[id]?.z === 'surface';

// E4：內側小家電（嵌吧檯裡、下半身被 counter_front 遮）＝surface 件掛 hostType:'counter-inside'。
// manifest 欄位美術還沒加（catalog 目前沒有任何內側件），先以結構型別讀；美術補欄位後可拿掉 cast。
export const isCounterInside = (it: CafeItem | undefined): boolean =>
  (it as (CafeItem & { hostType?: string }) | undefined)?.hostType === 'counter-inside';
// 內側件建議避開店長視覺區（店長固定 cx=150≈col4.7，佔 col4/5）；見 art-to-engine-requests E4
const COUNTER_INSIDE_EXCLUDED_COLS = new Set([4, 5]);

// 吧檯檯面格（虛擬 host）：純 row3 cols0–7＝吧檯唯一攤平可見的檯面（E4 拆層確認 row2 是矮櫃抽屜排
// ＋內角柱、非平面，舊的兩格「翹角」特例已刪）。內側小家電（counter-inside）也用同一排格。
export const COUNTER_TOP: ReadonlyArray<readonly [number, number]> = [
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
];
const COUNTER_TOP_SET = new Set(COUNTER_TOP.map(([x, y]) => `${x},${y}`));
export const isCounterTop = (gx: number, gy: number): boolean => COUNTER_TOP_SET.has(`${gx},${gy}`);

/** 檯面小物的 host（覆蓋該格、可放小物的家具）在 layout 的 index；吧檯檯面回 -1 但視為合法落點。
 *  找不到（孤兒／舊存檔落在地板）回 -1。多 host 命中取最前緣者。 */
export function hostIndexOf(layout: PlacedItem[], guestIndex: number): number {
  const g = layout[guestIndex];
  if (!g || !isSurfaceGuest(g.id)) return -1;
  const key = `${g.gx},${g.gy}`; // 小物皆 1×1，用左上格判定
  let best = -1, bestFront = -Infinity;
  layout.forEach((p, i) => {
    if (i === guestIndex || !isSurfaceHost(p.id)) return;
    if (footprint(p.id, p.gx, p.gy, p.facing).some(([x, y]) => `${x},${y}` === key)) {
      const f = frontRowOf(p);
      if (f > bestFront) { bestFront = f; best = i; }
    }
  });
  return best;
}

/** 某 host（layout index）上寄生的所有小物 index（host 被搬走時一起收回，別變孤兒） */
export function guestIndicesOf(layout: PlacedItem[], hostIndex: number): number[] {
  if (!isSurfaceHost(layout[hostIndex]?.id ?? '')) return [];
  const out: number[] = [];
  layout.forEach((p, i) => {
    if (isSurfaceGuest(p.id) && hostIndexOf(layout, i) === hostIndex) out.push(i);
  });
  return out;
}

// facing 相對 front 的順時針 90° 圈數（front→right→back→left＝0→1→2→3）
const FACING_TURNS: Record<Facing, number> = { front: 0, right: 1, back: 2, left: 3 };

/** 把某已擺家具旋轉到 newFacing；若是 host，其上小物一起繞 footprint 原點轉到新桌面格。
 *  回傳新 layout；家具本身轉後撞到別件/出界則回 null（不動）。非 host 家具就是單純轉向。 */
export function rotateHost(layout: PlacedItem[], index: number, newFacing: Facing): PlacedItem[] | null {
  const host = layout[index];
  const it = ITEM_BY_ID[host?.id ?? ''];
  if (!host || !it) return null;
  const cur = host.facing ?? 'front';
  if (newFacing === cur) return null;
  if (!canPlace(layout, host.id, host.gx, host.gy, index, newFacing)) return null; // 家具本身放不下（撞件/出界）
  const { w, h } = footprintDims(it, cur); // 旋轉前的佔地
  const turns = (FACING_TURNS[newFacing] - FACING_TURNS[cur] + 4) % 4; // 順時針 90° 幾次
  const guests = new Set(guestIndicesOf(layout, index));
  return layout.map((p, i) => {
    if (i === index) return newFacing === 'front' ? { id: p.id, gx: p.gx, gy: p.gy } : { ...p, facing: newFacing };
    if (!guests.has(i)) return p;
    // 小物相對 host 原點座標，繞原點順時針轉 turns 次（格網 W×H 每轉一次 (x,y)→(H-1-y, x)）
    let x = p.gx - host.gx, y = p.gy - host.gy, W = w, H = h;
    for (let t = 0; t < turns; t++) { const nx = H - 1 - y; y = x; x = nx; [W, H] = [H, W]; }
    return { ...p, gx: host.gx + x, gy: host.gy + y };
  });
}

/** 已擺家具的渲染順序（回原本 layout 的 index，由後往前）。
 *  L0 地毯→L1 地板家具（前緣 y-sort）→ 每件 host 之後緊接它的檯面小物（L2 寄生，跟著 host 排序位置，
 *  兩桌重疊也不錯層）→ L3 壁飾 → 孤兒小物墊頂（維持舊存檔不消失）。 */
export function renderOrder(layout: PlacedItem[]): number[] {
  const guestsByHost = new Map<number, number[]>();
  const orphanGuests: number[] = [];
  const solids: number[] = [];
  layout.forEach((p, i) => {
    // 未知 id（損毀存檔）當地板家具處理，保留 index 不掉（渲染端再 null 掉）
    if (isSurfaceGuest(p.id)) {
      const h = hostIndexOf(layout, i);
      if (h >= 0) (guestsByHost.get(h) ?? guestsByHost.set(h, []).get(h)!).push(i);
      else orphanGuests.push(i);
    } else solids.push(i);
  });
  const byFront = (a: number, b: number) => frontRowOf(layout[a]) - frontRowOf(layout[b]) || a - b;
  solids.sort((a, b) => {
    const za = zRankOf(layout[a].id), zb = zRankOf(layout[b].id);
    return za !== zb ? za - zb : byFront(a, b); // 前緣下方的後畫（近＝上）＝walk-behind
  });
  const out: number[] = [];
  for (const i of solids) {
    out.push(i);
    const gs = guestsByHost.get(i);
    if (gs) { gs.sort(byFront); out.push(...gs); }
  }
  orphanGuests.sort(byFront);
  out.push(...orphanGuests);
  return out;
}

/** footprint 內的每一格（吃 facing） */
function footprint(id: string, gx: number, gy: number, facing?: Facing): [number, number][] {
  const it = ITEM_BY_ID[id];
  if (!it) return [];
  const { w, h } = footprintDims(it, facing);
  const cells: [number, number][] = [];
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) cells.push([gx + dx, gy + dy]);
  return cells;
}

/** 某家具放在 (gx,gy) 是否合法。
 *  檯面小物（surface）＝每格都要落在檯面（surface-host 家具佔格或吧檯檯面）、且不與其他小物同格。
 *  地板類（rug/furniture）＝界內、避開固定裝置、不與「同 z 層」互相重疊（不同層可交疊）。
 *  壁飾（wall）＝可貼牆，只跟其他壁飾互斥。 */
export function canPlace(layout: PlacedItem[], id: string, gx: number, gy: number, ignoreIndex = -1, facing?: Facing): boolean {
  const it = ITEM_BY_ID[id];
  if (!it) return false;
  const { w, h } = footprintDims(it, facing);
  const cells = footprint(id, gx, gy, facing);

  if (it.z === 'surface') {
    // 檯面小物不吃地板 minCol/maxCol（吧檯左端翹角在 col 0）；合法性只認「落在檯面（host/吧檯）」
    // 收集其他小物佔格（別疊）＋檯面家具佔格（要落上去）
    const guestCells = new Set<string>();
    const hostCells = new Set<string>();
    layout.forEach((p, i) => {
      if (i === ignoreIndex) return;
      if (isSurfaceGuest(p.id)) footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => guestCells.add(`${x},${y}`));
      if (isSurfaceHost(p.id)) footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => hostCells.add(`${x},${y}`));
    });
    const inside = isCounterInside(it);
    for (const [cx, cy] of cells) {
      if (cy > PLACE.maxRow) return false;
      if (guestCells.has(`${cx},${cy}`)) return false;            // 別疊小物
      if (inside) {
        // 內側小家電只嵌吧檯（不上桌），且避開店長視覺區 col4/5（E4）
        if (!isCounterTop(cx, cy) || COUNTER_INSIDE_EXCLUDED_COLS.has(cx)) return false;
      } else if (!hostCells.has(`${cx},${cy}`) && !isCounterTop(cx, cy)) return false; // 必須有檯面
    }
    return true;
  }

  // 水平界限：整排 col 0..最右都可放（最左/最右是地板；壁飾貼側牆）——固定裝置改由 counterBlocked 管
  if (gx < 0 || gx + w - 1 > CAFE.cols - 1) return false;
  const top = Z_TOP_ROW[it.z];
  if (gy < top || gy + h - 1 > PLACE.maxRow) return false;
  const occupied = new Set<string>();
  layout.forEach((p, i) => {
    if (i === ignoreIndex) return;
    if (zRankOf(p.id) !== Z_RANK[it.z]) return;
    footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => occupied.add(`${x},${y}`));
  });
  for (const [cx, cy] of cells) {
    if (it.z !== 'wall' && counterBlocked(cx, cy)) return false; // 地板類只避開左上吧台（側牆欄是地板可放）；壁飾隨處貼
    if (occupied.has(`${cx},${cy}`)) return false;
  }
  return true;
}

/** 找一個能放下的空位（買了自動擺用；預設 front 朝向） */
export function findSpot(layout: PlacedItem[], id: string): { gx: number; gy: number } | null {
  const z = ITEM_BY_ID[id]?.z ?? 'furniture';
  for (let gy = Z_TOP_ROW[z]; gy <= PLACE.maxRow; gy++)
    for (let gx = 0; gx <= CAFE.cols - 1; gx++)
      if (canPlace(layout, id, gx, gy)) return { gx, gy };
  return null;
}

/** 覆蓋 (gx,gy) 的最上層已擺家具 index（拖曳時「抓」到哪一件）；沒有回 -1。
 *  取 renderOrder 最後畫的（最上層），小物優先於其下的桌子。 */
export function itemAtCell(layout: PlacedItem[], gx: number, gy: number): number {
  const order = renderOrder(layout);
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    const p = layout[i];
    if (footprint(p.id, p.gx, p.gy, p.facing).some(([x, y]) => x === gx && y === gy)) return i;
  }
  return -1;
}

// ── 店長姿勢（西村線稿→Codex 生的多姿勢，隨當下台詞換）──
// 素材：public/cafe/shopkeeper/<slug>.png（scripts 生成，見 jp-panda-pixel-art-recipe）
export const SHOPKEEPER_POSES = [
  'serve', 'idle', 'onion', 'no', 'eat', 'welcome', 'cheer', 'dismay',
  'cat', 'happy', 'think', 'love', 'play', 'cozy', 'statue', 'shock',
] as const;
export type Pose = (typeof SHOPKEEPER_POSES)[number];

// 情境池（沒關鍵字命中時，依開店狀態挑）
const CLOSED_POSES: Pose[] = ['cozy', 'dismay', 'no', 'idle', 'statue'];
const SOLO_POSES: Pose[] = ['serve', 'think', 'onion', 'idle', 'play'];
const FULL_POSES: Pose[] = ['cheer', 'welcome', 'happy', 'love', 'cat'];

// 台詞關鍵字 → 姿勢（讓店長「照他講的話」擺姿勢）
const POSE_KEYWORDS: [string[], Pose][] = [
  [['布丁', '吃', '完食', '續', '零食', '饞', '甜'], 'eat'],
  [['歡迎', 'いらっしゃい', '熟客', '光臨', '隨便坐'], 'welcome'],
  [['客滿', '雙人', '興隆', '大入', '滿席', '滿員', '齊聚', '勢揃', '熱鬧'], 'cheer'],
  [['勝', '優勝', '贏', '冠', '最強', '討伐'], 'cheer'],
  [['貓'], 'cat'],
  [['愛心', '戀', '喜歡', '想我', '想你', '待って', '君を', '請客'], 'love'],
  [['蔥', '進貨', '咖啡豆', '菜單', '茶葉', '收銀', '帳本', '收工'], 'onion'],
  [['？', '嗎', '疑', '歪頭', '考你', '唸', '密碼', '幾度', '幾塊'], 'think'],
  [['睡', '盹', '打烊', '準備中', '冷了', '黑暗', '深夜', '棉被', '打個盹'], 'cozy'],
  [['痠', '累', '站著', '等', '房租', '催', '腳好'], 'dismay'],
  [['別怕', '不攔', '不要', '禁止', '放棄', '攔不住', '拒'], 'no'],
  [['驚', '嚇', 'えっ', 'うわ', '！？', '欸'], 'shock'],
  [['ぽ〜う', 'ぽう', '木魚', '敲', '氣定神閒', '發呆'], 'idle'],
];

/** 依當下台詞＋開店狀態，決定店長要擺哪個姿勢。
 *  有關鍵字就對上情緒；否則從情境池依台詞穩定挑（同句同姿勢、換句換姿勢＝隨台詞輪播）。 */
export function poseForLine(line: string, meDone: boolean, attend: number): Pose {
  for (const [ks, pose] of POSE_KEYWORDS) if (ks.some((k) => line.includes(k))) return pose;
  const pool = !meDone ? CLOSED_POSES : attend >= 2 ? FULL_POSES : SOLO_POSES;
  let h = 0;
  for (let i = 0; i < line.length; i++) h = (h * 31 + line.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

// ── 庫存查詢（買了進托盤、擺出消耗庫存）──
/** 某家具目前擺在店裡的份數 */
export function placedCount(layout: PlacedItem[], id: string): number {
  return layout.reduce((n, p) => (p.id === id ? n + 1 : n), 0);
}
/** 某家具還在托盤、可再擺的份數 = 已購 - 已擺 */
export function stockAvailable(shop: ShopState, id: string): number {
  return (shop.stock[id] ?? 0) - placedCount(shop.layout, id);
}
/** 收藏種類數（擁有過的不同家具，給「收藏 N/總數」用） */
export function ownedKinds(shop: ShopState): number {
  return Object.values(shop.stock).filter((n) => n > 0).length;
}
