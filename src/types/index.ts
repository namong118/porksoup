export type Role = 'dps' | 'support'

export type DayOfWeek = '월' | '화' | '수' | '목' | '금' | '토' | '일'

export interface Member {
  id: string
  nickname: string
  created_at: string
}

export interface Character {
  id: string
  member_id: string
  name: string
  class: string
  role: Role
  member?: Member
}

export interface Raid {
  id: string
  name: string
  size: 4 | 8
  day_of_week: DayOfWeek | null
  time: string | null
  sort_order: number
  created_at: string
}

export interface RaidCharacter {
  id: string
  raid_id: string
  character_id: string
  character?: Character & { member?: Member }
}

export interface WeeklySchedule {
  id: string
  member_id: string
  week_start: string
  available_days: DayOfWeek[]
  note: string | null
  member?: Member
}

export interface RaidScheduleResult {
  raid: Raid
  characters: (Character & { member: Member })[]
  commonDays: DayOfWeek[]
  missingMembers: string[]
  isFull: boolean
}

export const DAYS: DayOfWeek[] = ['월', '화', '수', '목', '금', '토', '일']

export const CLASSES = [
  // 서포터
  { name: '바드', role: 'support' as Role },
  { name: '홀리나이트', role: 'support' as Role },
  { name: '도화가', role: 'support' as Role },
  // 딜러
  { name: '워로드', role: 'dps' as Role },
  { name: '버서커', role: 'dps' as Role },
  { name: '디스트로이어', role: 'dps' as Role },
  { name: '슬레이어', role: 'dps' as Role },
  { name: '인파이터', role: 'dps' as Role },
  { name: '스트라이커', role: 'dps' as Role },
  { name: '브레이커', role: 'dps' as Role },
  { name: '배틀마스터', role: 'dps' as Role },
  { name: '창술사', role: 'dps' as Role },
  { name: '기공사', role: 'dps' as Role },
  { name: '기상술사', role: 'dps' as Role },
  { name: '블레이드', role: 'dps' as Role },
  { name: '데모닉', role: 'dps' as Role },
  { name: '리퍼', role: 'dps' as Role },
  { name: '소울이터', role: 'dps' as Role },
  { name: '환수사', role: 'dps' as Role },
  { name: '건슬링어', role: 'dps' as Role },
  { name: '데빌헌터', role: 'dps' as Role },
  { name: '호크아이', role: 'dps' as Role },
  { name: '스카우터', role: 'dps' as Role },
  { name: '블래스터', role: 'dps' as Role },
  { name: '아르카나', role: 'dps' as Role },
  { name: '소서리스', role: 'dps' as Role },
  { name: '서머너', role: 'dps' as Role },
  { name: '스펠브레이커', role: 'dps' as Role },
  { name: '폿키리', role: 'support' as Role },
  { name: '슬링어', role: 'dps' as Role },
  { name: '딜키리', role: 'dps' as Role },
  { name: '가나', role: 'dps' as Role },
  { name: '권왕', role: 'dps' as Role },
  { name: '디트로이어', role: 'dps' as Role },
]
