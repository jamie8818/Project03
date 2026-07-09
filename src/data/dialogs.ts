// 場景對話包（會話導向：交朋友優先）。speaker: me=自己, o=對方
export interface DialogLine {
  speaker: 'me' | 'o';
  jp: string;
  kana: string; // 全假名讀音（TTS 用 jp，顯示輔助用 kana）
  romaji: string;
  zh: string;
}

export interface Dialog {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  lines: DialogLine[];
}

export const DIALOGS: Dialog[] = [
  {
    id: 'intro',
    title: '自我介紹',
    emoji: '👋',
    desc: '初次見面的完整自介，交朋友第一步',
    lines: [
      { speaker: 'me', jp: 'はじめまして。JJです。', kana: 'はじめまして。ジェージェーです。', romaji: 'hajimemashite. JJ desu.', zh: '初次見面，我是 JJ。' },
      { speaker: 'o', jp: 'はじめまして。ゆいです。', kana: 'はじめまして。ゆいです。', romaji: 'hajimemashite. yui desu.', zh: '初次見面，我是結衣。' },
      { speaker: 'me', jp: '台湾から来ました。', kana: 'たいわんからきました。', romaji: 'taiwan kara kimashita.', zh: '我來自台灣。' },
      { speaker: 'o', jp: 'そうなんですか！日本語が上手ですね。', kana: 'そうなんですか！にほんごがじょうずですね。', romaji: 'sou nan desu ka! nihongo ga jouzu desu ne.', zh: '這樣啊！你日文說得真好。' },
      { speaker: 'me', jp: 'いいえ、まだまだです。勉強中です。', kana: 'いいえ、まだまだです。べんきょうちゅうです。', romaji: 'iie, madamada desu. benkyouchuu desu.', zh: '沒有啦，還差得遠，正在學習中。' },
      { speaker: 'me', jp: 'よろしくお願いします。', kana: 'よろしくおねがいします。', romaji: 'yoroshiku onegaishimasu.', zh: '請多指教。' },
      { speaker: 'o', jp: 'こちらこそ、よろしく！', kana: 'こちらこそ、よろしく！', romaji: 'kochira koso, yoroshiku!', zh: '我才要請你多指教！' },
    ],
  },
  {
    id: 'greeting',
    title: '打招呼與寒暄',
    emoji: '☀️',
    desc: '每天都用得到的問候與客套',
    lines: [
      { speaker: 'me', jp: 'おはようございます。', kana: 'おはようございます。', romaji: 'ohayou gozaimasu.', zh: '早安（禮貌）。' },
      { speaker: 'o', jp: 'おはよう！今日もいい天気ですね。', kana: 'おはよう！きょうもいいてんきですね。', romaji: 'ohayou! kyou mo ii tenki desu ne.', zh: '早！今天天氣也很好呢。' },
      { speaker: 'me', jp: 'そうですね。最近どうですか？', kana: 'そうですね。さいきんどうですか？', romaji: 'sou desu ne. saikin dou desu ka?', zh: '對啊。最近怎麼樣？' },
      { speaker: 'o', jp: '元気です。ちょっと忙しいけど。', kana: 'げんきです。ちょっといそがしいけど。', romaji: 'genki desu. chotto isogashii kedo.', zh: '很好，就是有點忙。' },
      { speaker: 'me', jp: 'お疲れさまです。無理しないでね。', kana: 'おつかれさまです。むりしないでね。', romaji: 'otsukaresama desu. muri shinaide ne.', zh: '辛苦了，別太勉強喔。' },
      { speaker: 'o', jp: 'ありがとう。じゃ、また明日！', kana: 'ありがとう。じゃ、またあした！', romaji: 'arigatou. ja, mata ashita!', zh: '謝謝。那明天見！' },
    ],
  },
  {
    id: 'hobby',
    title: '聊興趣（音樂）',
    emoji: '🎵',
    desc: '用興趣打開話題，聊到喜歡的歌',
    lines: [
      { speaker: 'me', jp: '趣味は何ですか？', kana: 'しゅみはなんですか？', romaji: 'shumi wa nan desu ka?', zh: '你的興趣是什麼？' },
      { speaker: 'o', jp: '音楽を聴くことです。', kana: 'おんがくをきくことです。', romaji: 'ongaku o kiku koto desu.', zh: '聽音樂。' },
      { speaker: 'me', jp: '私も！日本の歌が好きです。', kana: 'わたしも！にほんのうたがすきです。', romaji: 'watashi mo! nihon no uta ga suki desu.', zh: '我也是！我喜歡日文歌。' },
      { speaker: 'o', jp: 'へえ、誰の曲をよく聴きますか？', kana: 'へえ、だれのきょくをよくききますか？', romaji: 'hee, dare no kyoku o yoku kikimasu ka?', zh: '哦？你常聽誰的歌？' },
      { speaker: 'me', jp: 'この歌手が好きです。この歌、知っていますか？', kana: 'このかしゅがすきです。このうた、しっていますか？', romaji: 'kono kashu ga suki desu. kono uta, shitteimasu ka?', zh: '我喜歡這位歌手。這首歌你知道嗎？' },
      { speaker: 'o', jp: '知ってる！いい歌ですよね。', kana: 'しってる！いいうたですよね。', romaji: 'shitteru! ii uta desu yo ne.', zh: '知道！這首歌很好聽對吧。' },
      { speaker: 'me', jp: '今度一緒にカラオケに行きましょう！', kana: 'こんどいっしょにカラオケにいきましょう！', romaji: 'kondo issho ni karaoke ni ikimashou!', zh: '下次一起去唱卡拉OK吧！' },
    ],
  },
  {
    id: 'chat',
    title: '網路聊天開場',
    emoji: '💬',
    desc: '交友軟體／社群上的自然開場與回應',
    lines: [
      { speaker: 'me', jp: 'こんにちは！プロフィールを見ました。', kana: 'こんにちは！プロフィールをみました。', romaji: 'konnichiwa! purofiiru o mimashita.', zh: '你好！我看了你的個人檔案。' },
      { speaker: 'me', jp: '猫の写真、かわいいですね。', kana: 'ねこのしゃしん、かわいいですね。', romaji: 'neko no shashin, kawaii desu ne.', zh: '貓的照片好可愛。' },
      { speaker: 'o', jp: 'ありがとうございます！うちの猫です。', kana: 'ありがとうございます！うちのねこです。', romaji: 'arigatou gozaimasu! uchi no neko desu.', zh: '謝謝！是我家的貓。' },
      { speaker: 'me', jp: '名前は何ですか？', kana: 'なまえはなんですか？', romaji: 'namae wa nan desu ka?', zh: '牠叫什麼名字？' },
      { speaker: 'o', jp: 'モモです。三歳です。', kana: 'モモです。さんさいです。', romaji: 'momo desu. sansai desu.', zh: '叫桃桃，三歲。' },
      { speaker: 'me', jp: 'いつか会ってみたいです（笑）', kana: 'いつかあってみたいです（わらい）', romaji: 'itsuka atte mitai desu (warai)', zh: '真想見見牠（笑）' },
      { speaker: 'o', jp: 'ぜひぜひ！', kana: 'ぜひぜひ！', romaji: 'zehi zehi!', zh: '一定要來！' },
    ],
  },
  {
    id: 'restaurant',
    title: '餐廳點餐',
    emoji: '🍜',
    desc: '去日本玩最實用的一幕',
    lines: [
      { speaker: 'o', jp: 'いらっしゃいませ！何名様ですか？', kana: 'いらっしゃいませ！なんめいさまですか？', romaji: 'irasshaimase! nanmeisama desu ka?', zh: '歡迎光臨！請問幾位？' },
      { speaker: 'me', jp: '二人です。', kana: 'ふたりです。', romaji: 'futari desu.', zh: '兩位。' },
      { speaker: 'me', jp: 'すみません、おすすめは何ですか？', kana: 'すみません、おすすめはなんですか？', romaji: 'sumimasen, osusume wa nan desu ka?', zh: '不好意思，有什麼推薦的嗎？' },
      { speaker: 'o', jp: 'ラーメンが人気です。', kana: 'ラーメンがにんきです。', romaji: 'raamen ga ninki desu.', zh: '拉麵很受歡迎。' },
      { speaker: 'me', jp: 'じゃ、これをください。', kana: 'じゃ、これをください。', romaji: 'ja, kore o kudasai.', zh: '那請給我這個。' },
      { speaker: 'me', jp: 'お会計をお願いします。', kana: 'おかいけいをおねがいします。', romaji: 'okaikei o onegaishimasu.', zh: '麻煩結帳。' },
      { speaker: 'me', jp: 'ごちそうさまでした！おいしかったです。', kana: 'ごちそうさまでした！おいしかったです。', romaji: 'gochisousama deshita! oishikatta desu.', zh: '謝謝招待！很好吃。' },
    ],
  },
  {
    id: 'meetup',
    title: '約見面',
    emoji: '📅',
    desc: '從線上聊到約出來的關鍵句',
    lines: [
      { speaker: 'me', jp: '今週末、時間がありますか？', kana: 'こんしゅうまつ、じかんがありますか？', romaji: 'konshuumatsu, jikan ga arimasu ka?', zh: '這週末有空嗎？' },
      { speaker: 'o', jp: '土曜日なら大丈夫です。', kana: 'どようびならだいじょうぶです。', romaji: 'doyoubi nara daijoubu desu.', zh: '星期六的話可以。' },
      { speaker: 'me', jp: '一緒にご飯を食べませんか？', kana: 'いっしょにごはんをたべませんか？', romaji: 'issho ni gohan o tabemasen ka?', zh: '要不要一起吃個飯？' },
      { speaker: 'o', jp: 'いいですね！どこで会いましょうか？', kana: 'いいですね！どこであいましょうか？', romaji: 'ii desu ne! doko de aimashou ka?', zh: '好啊！要在哪裡見面？' },
      { speaker: 'me', jp: '駅の前はどうですか？', kana: 'えきのまえはどうですか？', romaji: 'eki no mae wa dou desu ka?', zh: '車站前面如何？' },
      { speaker: 'o', jp: 'わかりました。楽しみにしています！', kana: 'わかりました。たのしみにしています！', romaji: 'wakarimashita. tanoshimi ni shiteimasu!', zh: '好的，很期待！' },
      { speaker: 'me', jp: 'じゃ、土曜日に！', kana: 'じゃ、どようびに！', romaji: 'ja, doyoubi ni!', zh: '那就星期六見！' },
    ],
  },
];
