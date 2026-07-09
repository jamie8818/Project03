// ⚠️ AUTO-GENERATED — 由 scripts/build-puddings.py 從 docs/puddings.json 產出。手改會被覆蓋。
// 內容改 docs/puddings.json 再重跑：python3 scripts/build-puddings.py
// 共 100 款（N 50 / R 30 / SR 15 / UR 5）

export type RarityGen = 'N' | 'R' | 'SR' | 'UR';

// 10 選 1 美術基底：扭蛋/圖鑑/招牌渲染改讀 public/cafe/pudding/<variant>.png
export type PuddingVariant =
  | 'classic' // 經典盤裝
  | 'cream' // 鮮奶油頂
  | 'cherry' // 櫻桃頂
  | 'sauce' // 醬汁瀑布
  | 'layered' // 雙層
  | 'parfait' // 高杯
  | 'mochi' // 白玉點綴
  | 'dust' // 粉末撒頂
  | 'star' // 星型模
  | 'deluxe'; // 豪華全配（UR 專用）

export interface PuddingGen {
  id: string;
  name: string;
  rarity: RarityGen;
  hue: number; // CSS hue-rotate 角度（🍮 變色）
  sat?: number; // 飽和度倍率
  desc: string;
  variant: PuddingVariant;
}

export const PUDDINGS_GEN: PuddingGen[] = [
  { id: 'plain', name: '原味布丁', rarity: 'N', hue: 0, desc: '一切的起點', variant: 'classic' },
  { id: 'caramel', name: '焦糖布丁', rarity: 'N', hue: -15, desc: '店長的最愛，苦一點才是大人', variant: 'sauce' },
  { id: 'milk', name: '牛奶布丁', rarity: 'N', hue: 0, sat: 0.25, desc: '溫柔的白', variant: 'cream' },
  { id: 'choco', name: '巧克力布丁', rarity: 'N', hue: -30, sat: 0.7, desc: '心情不好就吃這個', variant: 'sauce' },
  { id: 'coffee', name: '咖啡布丁', rarity: 'N', hue: -25, sat: 0.5, desc: '喫茶店的靈魂', variant: 'layered' },
  { id: 'banana', name: '香蕉布丁', rarity: 'N', hue: 8, desc: 'ばなな，唸起來就好吃', variant: 'cream' },
  { id: 'honey', name: '蜂蜜布丁', rarity: 'N', hue: 5, desc: '甜上加甜，犯規', variant: 'sauce' },
  { id: 'kinako', name: '黃豆粉布丁', rarity: 'N', hue: -8, sat: 0.6, desc: '樸實的和風', variant: 'dust' },
  { id: 'strawberry', name: '草莓布丁', rarity: 'N', hue: -60, desc: 'いちご！', variant: 'cherry' },
  { id: 'lemon', name: '檸檬布丁', rarity: 'N', hue: 18, desc: '酸酸的，像答錯的感覺', variant: 'cherry' },
  { id: 'chestnut', name: '栗子布丁', rarity: 'N', hue: -12, sat: 0.55, desc: '秋天限定的心情', variant: 'cherry' },
  { id: 'blacksugar', name: '黑糖布丁', rarity: 'N', hue: -20, sat: 0.4, desc: '沖繩的風', variant: 'classic' },
  { id: 'matcha', name: '抹茶布丁', rarity: 'R', hue: 70, desc: '宇治直送（設定上）', variant: 'dust' },
  { id: 'sakura', name: '櫻花布丁', rarity: 'R', hue: -80, sat: 0.7, desc: '春天限定的浪漫', variant: 'cherry' },
  { id: 'mango', name: '芒果布丁', rarity: 'R', hue: 12, sat: 1.2, desc: '台南人認證', variant: 'cherry' },
  { id: 'taro', name: '紫芋布丁', rarity: 'R', hue: -130, sat: 0.8, desc: '紫得很高貴', variant: 'mochi' },
  { id: 'melon', name: '哈密瓜布丁', rarity: 'R', hue: 55, desc: '喫茶店傳統藝能', variant: 'star' },
  { id: 'peach', name: '白桃布丁', rarity: 'R', hue: -45, sat: 0.6, desc: '岡山的驕傲', variant: 'cherry' },
  { id: 'blueberry', name: '藍莓布丁', rarity: 'R', hue: -160, sat: 0.7, desc: '對眼睛好（藉口）', variant: 'sauce' },
  { id: 'ujikintoki', name: '宇治金時布丁', rarity: 'R', hue: 90, sat: 0.8, desc: '抹茶與紅豆的婚禮', variant: 'star' },
  { id: 'rainbow', name: '彩虹布丁', rarity: 'SR', hue: 180, sat: 1.4, desc: '傳說中雨後才做得出來', variant: 'star' },
  { id: 'gold', name: '黃金布丁', rarity: 'SR', hue: 3, sat: 1.6, desc: '金光閃閃，捨不得吃', variant: 'star' },
  { id: 'starry', name: '星空布丁', rarity: 'SR', hue: -200, sat: 1.1, desc: '把夜空舀一勺進杯子', variant: 'star' },
  { id: 'panda', name: '店長特製布丁', rarity: 'SR', hue: -18, sat: 0.35, desc: '店長認真做的唯一一款，吃過的人都說「ぽ〜う」', variant: 'star' },
  { id: 'taro_ball', name: '芋圓布丁', rarity: 'N', hue: -125, sat: 0.75, desc: 'QQ的，家鄉的甜', variant: 'mochi' },
  { id: 'brown_sugar_boba', name: '黑糖珍珠布丁', rarity: 'N', hue: -22, sat: 0.5, desc: '黑糖在杯底暴動', variant: 'sauce' },
  { id: 'pineapple', name: '鳳梨布丁', rarity: 'N', hue: 15, sat: 1.1, desc: '旺來，甜到不好意思', variant: 'parfait' },
  { id: 'irwin_mango', name: '愛文芒果布丁', rarity: 'N', hue: 10, sat: 1.3, desc: '愛文，就是愛吻你', variant: 'parfait' },
  { id: 'mycha', name: '麵茶布丁', rarity: 'N', hue: -18, sat: 0.5, desc: '柑仔店午後飄粉香', variant: 'classic' },
  { id: 'peanut', name: '花生布丁', rarity: 'N', hue: -10, sat: 0.6, desc: '廟口花生湯既視感', variant: 'dust' },
  { id: 'herbal_jelly', name: '仙草布丁', rarity: 'N', hue: -35, sat: 0.5, desc: '青草巷吹來涼意', variant: 'mochi' },
  { id: 'wintermelon_tea', name: '冬瓜茶布丁', rarity: 'N', hue: 6, sat: 0.4, desc: '冬瓜，凍蒜的遠房親戚', variant: 'classic' },
  { id: 'papaya_pudding', name: '木瓜牛奶布丁', rarity: 'N', hue: 20, sat: 0.9, desc: '台南早餐店的第一口', variant: 'cream' },
  { id: 'lychee', name: '荔枝布丁', rarity: 'N', hue: -55, sat: 0.9, desc: '離枝三秒就想你', variant: 'cherry' },
  { id: 'custard_apple', name: '釋迦布丁', rarity: 'N', hue: -100, sat: 0.5, desc: '台東佛頭的溫柔偽裝', variant: 'parfait' },
  { id: 'roselle', name: '洛神布丁', rarity: 'N', hue: -70, sat: 0.85, desc: '山坡紅了，酸甜也紅了', variant: 'sauce' },
  { id: 'hojicha', name: '焙茶布丁', rarity: 'N', hue: -12, sat: 0.55, desc: '焙火香，安靜地暖', variant: 'dust' },
  { id: 'yuzu', name: '柚子布丁', rarity: 'N', hue: 25, sat: 0.9, desc: '冬至的味道，先來一口', variant: 'layered' },
  { id: 'black_sesame', name: '黑芝麻布丁', rarity: 'N', hue: -28, sat: 0.65, desc: '黑到深邃，甜到踏實', variant: 'dust' },
  { id: 'sakuramochi', name: '櫻餅布丁', rarity: 'N', hue: -75, sat: 0.6, desc: '鹽漬櫻葉包起來的春天', variant: 'mochi' },
  { id: 'warabimochi', name: '蕨餅布丁', rarity: 'N', hue: 40, sat: 0.45, desc: '蕨對是Q彈本尊', variant: 'mochi' },
  { id: 'chestnut_shibukawa', name: '栗子澀皮煮布丁', rarity: 'N', hue: -14, sat: 0.5, desc: '帶皮栗子的倔強甘甜', variant: 'mochi' },
  { id: 'tiramisu', name: '提拉米蘇布丁', rarity: 'N', hue: -20, sat: 0.5, desc: '提拉，把心情也提起來', variant: 'parfait' },
  { id: 'earlgrey', name: '伯爵紅茶布丁', rarity: 'N', hue: 30, sat: 0.4, desc: '伯爵午後偷喝奶茶', variant: 'layered' },
  { id: 'saltcaramel', name: '焦糖海鹽布丁', rarity: 'N', hue: -16, sat: 0.7, desc: '甜鹹交界，剛剛好', variant: 'parfait' },
  { id: 'pistachio', name: '開心果布丁', rarity: 'N', hue: 65, sat: 0.7, desc: '開心，是會傳染的', variant: 'dust' },
  { id: 'rum_raisin', name: '蘭姆葡萄布丁', rarity: 'N', hue: -140, sat: 0.5, desc: '大人限定的微醺甜點', variant: 'sauce' },
  { id: 'rice_pudding', name: '白飯布丁', rarity: 'N', hue: 0, sat: 0.15, desc: '呷飽沒？布丁說謊', variant: 'classic' },
  { id: 'miso_pudding', name: '味噌布丁', rarity: 'N', hue: -6, sat: 0.5, desc: '味噌湯偷穿糖衣', variant: 'classic' },
  { id: 'scallion_pudding', name: '蔥花布丁', rarity: 'N', hue: 95, sat: 0.6, desc: '蔥花撒錯宇宙', variant: 'classic' },
  { id: 'oversweet_bbt', name: '過甜珍奶布丁', rarity: 'N', hue: -24, sat: 0.55, desc: '老闆手抖，糖加三倍', variant: 'layered' },
  { id: 'natto_pudding', name: '納豆布丁', rarity: 'N', hue: 55, sat: 0.4, desc: '牽絲警告，勇氣點單', variant: 'classic' },
  { id: 'stinky_tofu_pudding', name: '臭豆腐布丁', rarity: 'N', hue: -5, sat: 0.3, desc: '臭得很有禮貌', variant: 'classic' },
  { id: 'instant_noodle_pudding', name: '泡麵布丁', rarity: 'N', hue: 8, sat: 0.5, desc: '社畜深夜的軟爛救贖', variant: 'classic' },
  { id: 'cold_soup_pudding', name: '剩湯布丁', rarity: 'N', hue: -8, sat: 0.3, desc: '冰箱深處的母愛', variant: 'classic' },
  { id: 'milktea', name: '奶茶布丁', rarity: 'N', hue: -18, sat: 0.45, desc: '手搖店的甜蜜副作用', variant: 'cream' },
  { id: 'redbean', name: '紅豆布丁', rarity: 'N', hue: -95, sat: 0.55, desc: '刨冰上最忠實的伙伴', variant: 'mochi' },
  { id: 'greentea_latte', name: '抹茶拿鐵布丁', rarity: 'N', hue: 75, sat: 0.8, desc: '抹茶控的日常續命', variant: 'layered' },
  { id: 'cinnamon', name: '肉桂布丁', rarity: 'N', hue: -18, sat: 0.6, desc: '耶誕氣氛，先偷跑一口', variant: 'dust' },
  { id: 'vanilla', name: '香草布丁', rarity: 'N', hue: 4, sat: 0.3, desc: '低調，才是真本事', variant: 'cream' },
  { id: 'yogurt', name: '優格布丁', rarity: 'N', hue: 2, sat: 0.25, desc: '微酸的，是誠實的甜', variant: 'cream' },
  { id: 'sesame_white', name: '白芝麻布丁', rarity: 'N', hue: -6, sat: 0.45, desc: '芝麻開門，甜蜜降臨', variant: 'dust' },
  { id: 'osmanthus_oolong', name: '桂花烏龍布丁', rarity: 'R', hue: 45, sat: 0.55, desc: '桂香落進烏龍夢', variant: 'star' },
  { id: 'lychee_rose', name: '荔枝玫瑰布丁', rarity: 'R', hue: -68, sat: 0.75, desc: '少女心，濃度超標', variant: 'star' },
  { id: 'boba_milk_deluxe', name: '黑糖珍珠鮮奶布丁', rarity: 'R', hue: -20, sat: 0.6, desc: '珍珠的究極形態', variant: 'layered' },
  { id: 'dragonfruit', name: '火龍果布丁', rarity: 'R', hue: -95, sat: 0.9, desc: '火氣大，也要美美的', variant: 'sauce' },
  { id: 'passionfruit', name: '百香果布丁', rarity: 'R', hue: 22, sat: 1.0, desc: '酸到清醒的百分百', variant: 'sauce' },
  { id: 'honey_yuzu', name: '蜂蜜柚子布丁', rarity: 'R', hue: 28, sat: 0.85, desc: '喉嚨痛也想點的溫柔', variant: 'sauce' },
  { id: 'hojicha_latte', name: '焙茶拿鐵布丁', rarity: 'R', hue: -14, sat: 0.55, desc: '焙茶色的午後毯', variant: 'layered' },
  { id: 'purple_sweetpotato', name: '紫地瓜布丁', rarity: 'R', hue: -120, sat: 0.7, desc: '土裡長出的溫柔紫', variant: 'cream' },
  { id: 'mont_blanc', name: '蒙布朗布丁', rarity: 'R', hue: -16, sat: 0.55, desc: '栗子界的貴族氣場', variant: 'parfait' },
  { id: 'creme_brulee', name: '烤布蕾布丁', rarity: 'R', hue: -14, sat: 0.4, desc: '敲碎那層焦糖脆殼吧', variant: 'parfait' },
  { id: 'amazake', name: '甘酒布丁', rarity: 'R', hue: 8, sat: 0.35, desc: '微醺，不用駕照', variant: 'cream' },
  { id: 'plum_wine', name: '梅酒布丁', rarity: 'R', hue: -50, sat: 0.65, desc: '外婆珍藏的那罐', variant: 'sauce' },
  { id: 'yuzu_shiso', name: '柚子紫蘇布丁', rarity: 'R', hue: 35, sat: 0.7, desc: '京都夏日的清爽解法', variant: 'parfait' },
  { id: 'mikan', name: '蜜柑布丁', rarity: 'R', hue: 14, sat: 1.0, desc: '暖爐配蜜柑的冬日儀式', variant: 'cherry' },
  { id: 'matcha_shiratama', name: '抹茶白玉布丁', rarity: 'R', hue: 80, sat: 0.85, desc: '苦與Q彈的雙重奏', variant: 'mochi' },
  { id: 'caramel_apple', name: '焦糖蘋果布丁', rarity: 'R', hue: -18, sat: 0.6, desc: '咬一口整座遊樂園', variant: 'cherry' },
  { id: 'nama_choco', name: '生巧克力布丁', rarity: 'R', hue: -32, sat: 0.75, desc: '融點極低，愛心極高', variant: 'layered' },
  { id: 'honey_black_tea', name: '蜜香紅茶布丁', rarity: 'R', hue: 20, sat: 0.5, desc: '東方美人的甜蜜化身', variant: 'star' },
  { id: 'thai_milk_tea', name: '泰式奶茶布丁', rarity: 'R', hue: -8, sat: 0.9, desc: '橘色的，才是正宗', variant: 'cream' },
  { id: 'hk_milk_tea', name: '港式奶茶布丁', rarity: 'R', hue: -22, sat: 0.55, desc: '絲襪包不住的滑順', variant: 'cream' },
  { id: 'shiratama_redbean', name: '白玉紅豆布丁', rarity: 'R', hue: -90, sat: 0.55, desc: '和風甜點鋪的招牌臉', variant: 'mochi' },
  { id: 'mochi_pudding', name: '麻糬布丁', rarity: 'R', hue: 3, sat: 0.3, desc: '糬不完的黏人魅力', variant: 'mochi' },
  { id: 'champagne', name: '香檳布丁', rarity: 'SR', hue: 18, sat: 0.35, desc: '杯底升起小星星', variant: 'star' },
  { id: 'truffle_choco', name: '松露巧克力布丁', rarity: 'SR', hue: -34, sat: 0.6, desc: '土裡挖出來的奢侈', variant: 'parfait' },
  { id: 'gyokuro', name: '玉露布丁', rarity: 'SR', hue: 85, sat: 0.6, desc: '覆下二十日的青', variant: 'dust' },
  { id: 'hokkaido_milk', name: '北海道特濃牛乳布丁', rarity: 'SR', hue: 0, sat: 0.3, desc: '牧場直送的濃郁底氣', variant: 'cream' },
  { id: 'saffron', name: '番紅花布丁', rarity: 'SR', hue: 28, sat: 0.65, desc: '黃金也羨慕的紅', variant: 'star' },
  { id: 'rose_petal', name: '玫瑰花瓣布丁', rarity: 'SR', hue: -72, sat: 0.6, desc: '情書等級的那一勺', variant: 'parfait' },
  { id: 'yuzu_confit', name: '柚子蜜漬布丁', rarity: 'SR', hue: 26, sat: 0.75, desc: '蜜漬過的冬日光', variant: 'parfait' },
  { id: 'whisky_cask', name: '威士忌桶陳布丁', rarity: 'SR', hue: -25, sat: 0.5, desc: '橡木桶偷來的琥珀香', variant: 'layered' },
  { id: 'kyoho_grape', name: '巨峰葡萄布丁', rarity: 'SR', hue: -145, sat: 0.85, desc: '一口一顆的任性', variant: 'layered' },
  { id: 'sunset_peach', name: '夕陽蜜桃布丁', rarity: 'SR', hue: -48, sat: 0.7, desc: '把黃昏舀進玻璃杯', variant: 'cherry' },
  { id: 'midnight_cacao', name: '深夜可可布丁', rarity: 'SR', hue: -36, sat: 0.55, desc: '可可，可不可以更甜', variant: 'dust' },
  { id: 'meteor', name: '流星布丁', rarity: 'UR', hue: -170, sat: 1.2, desc: '許願前，先舀一口', variant: 'deluxe' },
  { id: 'aurora', name: '極光布丁', rarity: 'UR', hue: 150, sat: 1.3, desc: '北境夜空的糖光', variant: 'deluxe' },
  { id: 'gold_leaf24k', name: '24K金箔布丁', rarity: 'UR', hue: 12, sat: 1.5, desc: '舌尖落下一片金', variant: 'deluxe' },
  { id: 'first_snow', name: '初雪布丁', rarity: 'UR', hue: 0, sat: 0.15, desc: '窗邊落下第一白', variant: 'deluxe' },
  { id: 'time_stop', name: '時間暫停布丁', rarity: 'UR', hue: -175, sat: 1.1, desc: '吃一口，世界暫停三秒', variant: 'deluxe' },
];

export const PUDDING_GEN_BY_ID: Record<string, PuddingGen> = Object.fromEntries(
  PUDDINGS_GEN.map((p) => [p.id, p]),
);

