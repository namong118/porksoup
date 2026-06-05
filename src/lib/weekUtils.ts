import type { DayOfWeek } from '../types'

// 로스트아크 주간 초기화: 수요일 오전 6시 기준
export function getWeekStart(): string {
  const now = new Date()
  // 수요일 = 3, 목=4, 금=5, 토=6, 일=0, 월=1, 화=2
  const day = now.getDay()
  const daysSinceWed = (day + 7 - 3) % 7
  const wednesday = new Date(now)
  wednesday.setDate(now.getDate() - daysSinceWed)
  wednesday.setHours(6, 0, 0, 0)

  // 수요일이지만 오전 6시 이전이면 지난 주 수요일로
  if (now < wednesday) {
    wednesday.setDate(wednesday.getDate() - 7)
  }

  const y = wednesday.getFullYear()
  const m = String(wednesday.getMonth() + 1).padStart(2, '0')
  const d = String(wednesday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 수요일부터 시작하는 요일 순서
export const WEEK_DAYS: DayOfWeek[] = ['수', '목', '금', '토', '일', '월', '화']

// weekStart(수요일)로부터 해당 요일까지 며칠 차이인지
export function getDayOffset(day: DayOfWeek): number {
  return WEEK_DAYS.indexOf(day)
}

// "YYYY-MM-DD" 문자열을 로컬 시간 기준 Date로 파싱 (UTC 파싱 방지)
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
