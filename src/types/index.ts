export type Role = 'dps' | 'support'

export type DayOfWeek = '월' | '화' | '수' | '목' | '금' | '토' | '일'

export interface Member {
  id: string
  nickname: string
  color: string
  created_at: string
  is_admin?: boolean
  edit_password_hash?: string | null
}

export const MEMBER_COLORS = [
  '#94a3b8', // 회색 (기본)
  '#ef4444', // 빨강
  '#fca5a5', // 연빨강
  '#fb923c', // 주황
  '#fbbf24', // 노랑
  '#84cc16', // 라임
  '#22c55e', // 초록
  '#06b6d4', // 청록
  '#7dd3fc', // 하늘
  '#3b82f6', // 파랑
  '#8b5cf6', // 보라
  '#ec4899', // 핑크
  '#f43f5e', // 로즈
]

export interface Character {
  id: string
  member_id: string
  name: string
  class: string
  role: Role
  item_level?: number | null
  member?: Member
}

export interface Raid {
  id: string
  name: string
  size: number
  day_of_week: DayOfWeek | null
  next_day_of_week: DayOfWeek | null
  time: string | null
  sort_order: number
  color: string
  completed: boolean
  difficulty: number
  is_draft: boolean
  is_new: boolean
  created_at: string
}

export const RAID_COLORS = [
  '#6b7280', // 회색 (기본)
  '#ef4444', // 빨강
  '#f97316', // 주황
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#14b8a6', // 청록
  '#3b82f6', // 파랑
  '#8b5cf6', // 보라
  '#ec4899', // 핑크
  '#f43f5e', // 로즈
  '#06b6d4', // 하늘
  '#a855f7', // 라벤더
]

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
