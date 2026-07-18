export interface MissionLessonCard {
  jp: string;
  kana: string;
  zh: string;
}

export interface MissionChoice {
  label: string;
  explain: string;
}

export interface MissionQuestion {
  speaker: '站員' | '任務';
  line: string;
  lineKana?: string;
  audioOnly?: boolean;
  prompt: string;
  choices: MissionChoice[];
  correct: number;
  explain: string;
}

export const STATION_MISSION_ID = 'station-platform';

export const STATION_MISSION = {
  id: STATION_MISSION_ID,
  jpTitle: '駅でホームを聞く',
  title: '車站問月台',
  request: '在車站找到前往新宿的月台。',
  shopLine: '車站來了一封委託。月台找錯，會學到另一區的日文。',
  lesson: [
    { jp: '新宿行き', kana: 'しんじゅくゆき', zh: '開往新宿' },
    { jp: '何番線', kana: 'なんばんせん', zh: '幾號月台' },
    { jp: '～ですか', kana: '～ですか', zh: '禮貌地提出問題' },
  ] satisfies MissionLessonCard[],
  phrase: '新宿行きは何番線ですか？',
  phraseKana: 'しんじゅくゆき は なんばんせん ですか？',
  phraseZh: '開往新宿的是幾號月台？',
  prepChoices: [
    { label: 'しんじゅくゆきは なんばんせんですか？', explain: '「なんばんせん」是在問幾號月台。' },
    { label: 'しんじゅくゆきは いくらですか？', explain: '「いくら」是在問多少錢，買票時會用到。' },
    { label: 'しんじゅくゆきは なんじですか？', explain: '「なんじ」是在問幾點，想確認發車時間時會用到。' },
  ] satisfies MissionChoice[],
  questions: [
    {
      speaker: '站員',
      line: '新宿行きは3番線です。',
      lineKana: 'しんじゅくゆき は さんばんせん です。',
      audioOnly: true,
      prompt: '先按「聞く」，只靠聲音判斷該去哪一個月台。',
      choices: [
        { label: '①', explain: '你選的是一號月台；站員說的是「さんばんせん（三號月台）」。' },
        { label: '②', explain: '你選的是二號月台；站員說的是「さんばんせん（三號月台）」。' },
        { label: '③', explain: '「さん」是三，「ばんせん」是月台；合起來就是三號月台。' },
      ],
      correct: 2,
      explain: '「さん」是三，「ばんせん」是月台；「さんばんせん」就是三號月台。',
    },
    {
      speaker: '任務',
      line: '駅員さんに聞いてみよう。',
      prompt: '想問「開往新宿的是幾號月台？」哪一句最合適？',
      choices: [
        { label: 'しんじゅくゆきは なんばんせんですか？', explain: '「なんばんせん」是幾號月台，正好是在問搭車位置。' },
        { label: 'しんじゅくゆきは いくらですか？', explain: '「いくら」是「多少錢」，這句是在問票價。' },
        { label: 'しんじゅくゆきは なんじですか？', explain: '「なんじ」是「幾點」，這句是在問時間。' },
      ],
      correct: 0,
      explain: '「なんばんせん」問月台；「いくら」問價錢；「なんじ」問時間。',
    },
    {
      speaker: '站員',
      line: '新宿行きは2番線に変更になりました。',
      lineKana: 'しんじゅくゆき は にばんせん に へんこうになりました。',
      audioOnly: true,
      prompt: '剛才是三號月台；再聽一次廣播，現在要改去哪裡？',
      choices: [
        { label: '①', explain: '你選的是一號月台；廣播裡的「にばんせん」是二號月台。' },
        { label: '②', explain: '「にばんせん」是二號月台；「へんこうになりました」表示已經變更。' },
        { label: '③', explain: '三號是原本的月台；「にばんせんに へんこう」表示已改到二號。' },
      ],
      correct: 1,
      explain: '「にばんせん」是二號月台；「へんこうになりました」表示已經變更。',
    },
  ] satisfies MissionQuestion[],
} as const;
