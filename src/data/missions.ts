export interface MissionLessonCard {
  jp: string;
  kana: string;
  zh: string;
}

export interface MissionChoice {
  label: string;
  sub?: string;
}

export interface MissionQuestion {
  speaker: '站員' | '任務';
  line: string;
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
    { label: '新宿行きは何番線ですか？', sub: '開往新宿的是幾號月台？' },
    { label: '新宿行きはいくらですか？', sub: '開往新宿的票多少錢？' },
    { label: '新宿行きは何時ですか？', sub: '開往新宿的是幾點？' },
  ] satisfies MissionChoice[],
  questions: [
    {
      speaker: '站員',
      line: '新宿行きは3番線です。',
      prompt: '站員請你去哪一個月台？',
      choices: [{ label: '1番線' }, { label: '2番線' }, { label: '3番線' }],
      correct: 2,
      explain: '「3番線」就是三號月台。',
    },
    {
      speaker: '任務',
      line: '駅員さんに聞いてみよう。',
      prompt: '想問「開往新宿的是幾號月台？」哪一句最自然？',
      choices: [
        { label: '新宿行きは何番線ですか？' },
        { label: '新宿行きはいくらですか？' },
        { label: '新宿行きは何時ですか？' },
      ],
      correct: 0,
      explain: '「何番線」問月台；「いくら」問價錢；「何時」問時間。',
    },
    {
      speaker: '站員',
      line: '新宿行きは2番線に変更になりました。',
      prompt: '月台臨時變更，現在應該去哪裡？',
      choices: [{ label: '1番線' }, { label: '2番線' }, { label: '3番線' }],
      correct: 1,
      explain: '「変更になりました」表示已經變更，現在要去二號月台。',
    },
  ] satisfies MissionQuestion[],
} as const;
