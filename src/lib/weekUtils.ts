import type { DayOfWeek } from '../types'

// 로스트아크 주간 초기화: 수요일 오전 6시 기준
export function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토

  // 수요일(3) 기준으로 며칠 전인지 계산
  // 수=0, 목=1, 금=2, 토=3, 일=4, 월=5, 화=6
  const daysFromWed = ((day - 3) + 7) % 7

  // 시간 영향 없이 오늘 자정(로컬) 기준으로 날짜 객체 생성
  const wed = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  wed.setDate(wed.getDate() - daysFromWed)

  // 수요일 당일 오전 6시 이전이면 지난 주로
  if (daysFromWed === 0 && now.getHours() < 6) {
    wed.setDate(wed.getDate() - 7)
  }

  const y = wed.getFullYear()
  const m = String(wed.getMonth() + 1).padStart(2, '0')
  const d = String(wed.getDate()).padStart(2, '0')
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

// 이번 주에서 이미 지난 요일 목록 반환
export function getPastDays(weekStart: string): Set<DayOfWeek> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const past = new Set<DayOfWeek>()
  WEEK_DAYS.forEach((day, i) => {
    const dayDate = parseLocalDate(weekStart)
    dayDate.setDate(dayDate.getDate() + i)
    if (dayDate < today) past.add(day)
  })
  return past
}
