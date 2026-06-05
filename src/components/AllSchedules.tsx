import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, DayOfWeek } from '../types'
import { getWeekStart, WEEK_DAYS, parseLocalDate } from '../lib/weekUtils'

interface MemberSchedule {
  member: Member
  available_days: DayOfWeek[]
  note: string | null
  submitted: boolean
}

export default function AllSchedules() {
  const [schedules, setSchedules] = useState<MemberSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const weekStart = getWeekStart()

  useEffect(() => {
    async function load() {
      const [membersRes, schedRes] = await Promise.all([
        supabase.from('members').select('*').order('nickname'),
        supabase.from('weekly_schedules').select('*').eq('week_start', weekStart),
      ])

      const members: Member[] = membersRes.data ?? []
      const schedData = schedRes.data ?? []

      const schedMap: Record<string, { available_days: DayOfWeek[]; note: string | null }> = {}
      schedData.forEach((s: { member_id: string; available_days: DayOfWeek[]; note: string | null }) => {
        schedMap[s.member_id] = { available_days: s.available_days, note: s.note }
      })

      setSchedules(members.map(m => ({
        member: m,
        available_days: schedMap[m.id]?.available_days ?? [],
        note: schedMap[m.id]?.note ?? null,
        submitted: !!schedMap[m.id],
      })))
      setLoading(false)
    }
    load()
  }, [weekStart])

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  const weekStartDate = parseLocalDate(weekStart)
  const weekEndDate = parseLocalDate(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  const submittedCount = schedules.filter(s => s.submitted).length

  // 요일별 가능 인원 수
  const dayCount = WEEK_DAYS.reduce((acc, day) => {
    acc[day] = schedules.filter(s => s.submitted && s.available_days.includes(day)).length
    return acc
  }, {} as Record<DayOfWeek, number>)

  const maxCount = Math.max(...Object.values(dayCount))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">멤버 스케줄</h2>
        <span className="text-sm text-gray-400">
          {formatDate(weekStartDate)} ~ {formatDate(weekEndDate)}
        </span>
      </div>

      <div className="bg-gray-700 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-300">
          제출 완료 <span className="text-blue-400 font-bold">{submittedCount}</span> / {schedules.length}명
        </span>
        <span className="text-xs text-gray-500">
          {schedules.length - submittedCount > 0 && `${schedules.length - submittedCount}명 미제출`}
        </span>
      </div>

      {/* 요일별 가능 인원 요약 */}
      <div className="bg-gray-700 rounded-xl p-3 mb-4">
        <p className="text-xs text-gray-400 mb-2">요일별 가능 인원</p>
        <div className="grid grid-cols-7 gap-1">
          {WEEK_DAYS.map(day => {
            const count = dayCount[day]
            const isBest = count === maxCount && count > 0
            return (
              <div key={day} className={`flex flex-col items-center py-2 rounded-lg
                ${isBest ? 'bg-blue-800' : 'bg-gray-600'}`}>
                <span className={`text-xs font-bold ${isBest ? 'text-blue-200' : 'text-gray-400'}`}>{day}</span>
                <span className={`text-lg font-bold mt-0.5 ${isBest ? 'text-white' : 'text-gray-300'}`}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 멤버별 스케줄 */}
      <div className="bg-gray-700 rounded-xl overflow-hidden">
        {/* 헤더 */}
        <div className="grid grid-cols-[auto_1fr] border-b border-gray-600">
          <div className="px-4 py-2 text-xs text-gray-400 w-24">멤버</div>
          <div className="grid grid-cols-7">
            {WEEK_DAYS.map(day => (
              <div key={day} className="py-2 text-center text-xs text-gray-400 font-medium">{day}</div>
            ))}
          </div>
        </div>

        {schedules.map((s, idx) => (
          <div
            key={s.member.id}
            className={`grid grid-cols-[auto_1fr] ${idx < schedules.length - 1 ? 'border-b border-gray-600' : ''}`}
          >
            <div className={`px-4 py-3 w-24 flex items-center ${!s.submitted ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-xs font-medium text-gray-200 truncate">{s.member.nickname}</p>
                {!s.submitted && <p className="text-xs text-yellow-600">미제출</p>}
              </div>
            </div>
            <div className="grid grid-cols-7">
              {WEEK_DAYS.map(day => {
                const available = s.submitted && s.available_days.includes(day)
                return (
                  <div key={day} className="flex items-center justify-center py-3">
                    {!s.submitted ? (
                      <span className="text-gray-700 text-xs">-</span>
                    ) : available ? (
                      <span className="w-6 h-6 flex items-center justify-center bg-blue-700 rounded-full text-xs text-white font-bold">✓</span>
                    ) : (
                      <span className="text-gray-600 text-sm">✕</span>
                    )}
                  </div>
                )
              })}
            </div>
            {/* 특이사항 메모 */}
            {s.note && (
              <div className="col-span-2 px-4 pb-2">
                <p className="text-xs text-yellow-400 bg-yellow-900/30 rounded px-2 py-1">💬 {s.note}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
