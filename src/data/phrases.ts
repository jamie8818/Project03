// 今日一句：會話導向（交朋友）＋少量歌詞常見詞。每天輪一句，附 TTS 跟讀。
export interface Phrase {
  jp: string; // 顯示用（含漢字）
  kana: string; // 假名讀音
  romaji: string;
  zh: string;
}

export const PHRASES: Phrase[] = [
  { jp: 'こんにちは', kana: 'こんにちは', romaji: 'konnichiwa', zh: '你好（白天）' },
  { jp: 'ありがとう', kana: 'ありがとう', romaji: 'arigatou', zh: '謝謝' },
  { jp: 'はじめまして', kana: 'はじめまして', romaji: 'hajimemashite', zh: '初次見面' },
  { jp: 'よろしくお願いします', kana: 'よろしくおねがいします', romaji: 'yoroshiku onegaishimasu', zh: '請多指教' },
  { jp: 'おはよう', kana: 'おはよう', romaji: 'ohayou', zh: '早安' },
  { jp: 'お名前は？', kana: 'おなまえは？', romaji: 'onamae wa?', zh: '你叫什麼名字？' },
  { jp: '私はJJです', kana: 'わたしはジェージェーです', romaji: 'watashi wa JJ desu', zh: '我是 JJ' },
  { jp: '台湾から来ました', kana: 'たいわんからきました', romaji: 'taiwan kara kimashita', zh: '我來自台灣' },
  { jp: '日本語を勉強しています', kana: 'にほんごをべんきょうしています', romaji: 'nihongo o benkyou shiteimasu', zh: '我正在學日文' },
  { jp: 'すごい！', kana: 'すごい！', romaji: 'sugoi!', zh: '好厲害！' },
  { jp: 'かわいい', kana: 'かわいい', romaji: 'kawaii', zh: '可愛' },
  { jp: '大丈夫', kana: 'だいじょうぶ', romaji: 'daijoubu', zh: '沒問題／沒事' },
  { jp: '楽しい', kana: 'たのしい', romaji: 'tanoshii', zh: '開心、有趣' },
  { jp: 'お腹すいた', kana: 'おなかすいた', romaji: 'onaka suita', zh: '肚子餓了' },
  { jp: 'これください', kana: 'これください', romaji: 'kore kudasai', zh: '請給我這個' },
  { jp: 'いくらですか？', kana: 'いくらですか？', romaji: 'ikura desu ka?', zh: '多少錢？' },
  { jp: 'おすすめは何ですか？', kana: 'おすすめはなんですか？', romaji: 'osusume wa nan desu ka?', zh: '有什麼推薦的嗎？' },
  { jp: '乾杯！', kana: 'かんぱい！', romaji: 'kanpai!', zh: '乾杯！' },
  { jp: 'じゃあね', kana: 'じゃあね', romaji: 'jaa ne', zh: '掰掰（輕鬆）' },
  { jp: 'おやすみ', kana: 'おやすみ', romaji: 'oyasumi', zh: '晚安' },
  { jp: '頑張って！', kana: 'がんばって！', romaji: 'ganbatte!', zh: '加油！' },
  { jp: 'この歌が好きです', kana: 'このうたがすきです', romaji: 'kono uta ga suki desu', zh: '我喜歡這首歌' },
  { jp: '一緒に歌おう', kana: 'いっしょにうたおう', romaji: 'issho ni utaou', zh: '一起唱吧' },
  { jp: '趣味は何ですか？', kana: 'しゅみはなんですか？', romaji: 'shumi wa nan desu ka?', zh: '你的興趣是什麼？' },
  { jp: '音楽が好きです', kana: 'おんがくがすきです', romaji: 'ongaku ga suki desu', zh: '我喜歡音樂' },
  { jp: '写真を撮ってもいいですか？', kana: 'しゃしんをとってもいいですか？', romaji: 'shashin o tottemo ii desu ka?', zh: '可以拍照嗎？' },
  { jp: 'また明日', kana: 'またあした', romaji: 'mata ashita', zh: '明天見' },
  { jp: 'また会いましょう', kana: 'またあいましょう', romaji: 'mata aimashou', zh: '再見面吧' },
  { jp: '気をつけて', kana: 'きをつけて', romaji: 'ki o tsukete', zh: '路上小心' },
  { jp: '愛してる', kana: 'あいしてる', romaji: 'aishiteru', zh: '我愛你（歌詞常見）' },
  { jp: '夢', kana: 'ゆめ', romaji: 'yume', zh: '夢（歌詞高頻字）' },
  { jp: '君に会いたい', kana: 'きみにあいたい', romaji: 'kimi ni aitai', zh: '想見你（歌詞常見）' },
];
