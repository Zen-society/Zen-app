export const mockUser = {
  name: 'Zen',
  title: '循環の担い手',
  avatarSrc: '/images/zen-z-logo.png',
}

export const mockZen = {
  amount: 15782,
  cycleDays: 90,
  expiring: { amount: 3200, daysLeft: 12, date: '10月10日' },
}

export const mockZenPlus = {
  amount: 1250,
  rank: 7,
  nextRankAt: 1500,
  gainedThisMonth: 180,
}

export const mockCommunity = {
  name: 'Zen コミュニティ',
  total: 1258924432,
  members: 48213,
  circulatedToday: 3842160,
  activeMissions: 126,
}

export const mockRoom = {
  imageSrc: '/images/zen-room.png',
  imageAlt: 'ミントと白を基調にしたボクセル調のマイルームで、アバターが手を振っている',
  visitors: 3,
}

export type Mission = {
  id: string
  title: string
  reward: { zen: number; zenPlus: number }
  progress: number
  goal: number
}

export const mockMissions: Mission[] = [
  { id: 'm1', title: '地域の清掃に参加する', reward: { zen: 120, zenPlus: 40 }, progress: 0, goal: 1 },
  { id: 'm2', title: 'フリマに1品出品する', reward: { zen: 50, zenPlus: 15 }, progress: 0, goal: 1 },
  { id: 'm3', title: '近所のお店でZenを使う', reward: { zen: 30, zenPlus: 10 }, progress: 2, goal: 3 },
]

export const formatNumber = (value: number) => value.toLocaleString('ja-JP')
