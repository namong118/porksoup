import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, DayOfWeek } from '../types'
import { WEEK_DAYS, getWeekStart, getDayOffset, parseLocalDate } from '../lib/weekUtils'

interface RaidInfo {
  raid: Raid
  characters: (Character & { member: Member })[]
}

export default function WeeklyView() {
  const [raidsByDay, setRaidsByDay] = useState<Record<DayOfWeek, RaidInfo[]>>({
    '수': [], '목': [], '금': [], '토': [], '일': [], '월': [], '화': []
  })
  const [loading, setLoading] = useState(true)
  const weekStart = getWeekStart()

  const load = useCallback(async () => {
    const [raidsRes, rcRes] = await Promise.all([
      supabase.from('raids').select('*').order('sort_order').order('name'),
      supabase.from('raid_characters').select('*, character:characters(*, member:members(*))'),
    ])

    const raids: Raid[] = raidsRes.data ?? []
    const rcData = rcRes.data ?? []

    const byDay: Record<DayOfWeek, RaidInfo[]> = {
      '수': [], '목': [], '금': [], '토': [], '일': [], '월': [], '화': []
    }

    raids
      .filter(r => r.day_of_week && !r.completed)
      .forEach(raid => {
        const day = raid.day_of_week as DayOfWeek
        const characters = rcData
          .filter((rc: { raid_id: string }) => rc.raid_id === raid.id)
          .map((rc: { character: Character & { member: Member } }) => rc.character)
          .filter(Boolean)
          .sort((a: Character, b: Character) => a.role === b.role ? 0 : a.role === 'support' ? 1 : -1) as (Character & { member: Member })[]

        byDay[day].push({ raid, characters })
      })

    setRaidsByDay(byDay)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  const weekStartDate = parseLocalDate(weekStart)
  const weekEndDate = parseLocalDate(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  const totalRaids = Object.values(raidsByDay).flat().length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">이번 주 일정</h2>
        <span className="text-sm text-gray-400">
          {formatDate(weekStartDate)} ~ {formatDate(weekEndDate)} · {totalRaids}개 레이드
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {WEEK_DAYS.map(day => {
          const dayRaids = raidsByDay[day]
          const dayDate = parseLocalDate(weekStart)
          dayDate.setDate(dayDate.getDate() + getDayOffset(day))

          if (dayRaids.length === 0) return null

          // 시간대별 그룹핑
          const timeGroups: Record<string, RaidInfo[]> = {}
          dayRaids.forEach(r => {
            const key = r.raid.time ?? '시간 미정'
            if (!timeGroups[key]) timeGroups[key] = []
            timeGroups[key].push(r)
          })
          const sortedTimes = Object.keys(timeGroups).sort((a, b) => {
            if (a === '시간 미정') return 1
            if (b === '시간 미정') return -1
            return a.localeCompare(b)
          })

          return (
            <div key={day} className="bg-gray-700 rounded-2xl overflow-hidden">
              {/* 요일 헤더 */}
              <div className="px-5 py-3 bg-gray-600 flex items-center gap-3">
                <span className="font-bold text-white text-base">{day}요일</span>
                <span className="text-sm text-gray-400">{formatDate(dayDate)}</span>
                <span className="text-xs text-gray-500 ml-auto">{dayRaids.length}개</span>
              </div>

              {/* 타임슬롯별 */}
              {sortedTimes.map(time => {
                const group = timeGroups[time]
                return (
                  <div key={time} className="border-t border-gray-600">
                    {/* 시작 시간 */}
                    <div className="px-5 py-2 bg-gray-800 flex items-center gap-2">
                      <span className="text-blue-300 font-bold text-sm">⏰ {time}</span>
                      <span className="text-xs text-gray-500">{group.length}개 레이드</span>
                    </div>

                    {/* 레이드 목록 */}
                    <div className="p-3 grid grid-cols-1 gap-2">
                      {group.map((info, i) => {
                        const { raid, characters } = info
                        const dps = characters.filter(c => c.role === 'dps')
                        const supports = characters.filter(c => c.role === 'support')
                        return (
                          <div
                            key={raid.id}
                            className="rounded-xl overflow-hidden"
                            style={{ borderLeft: `3px solid ${raid.color ?? '#6b7280'}` }}
                          >
                            <div className="px-3 py-2 bg-gray-750" style={{ backgroundColor: `${raid.color ?? '#6b7280'}18` }}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-gray-300">{i + 1}</span>
                                <span className="font-bold text-sm text-white">{raid.name}</span>
                                <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">{raid.size}인</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {dps.map(c => (
                                  <div key={c.id} className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
                                    <span className="text-xs font-medium text-gray-200">{c.name}</span>
                                    <span className="text-xs text-gray-500">{c.class}</span>
                                  </div>
                                ))}
                                {supports.map(c => (
                                  <div key={c.id} className="flex items-center gap-1 bg-green-900/50 border border-green-800/50 rounded-lg px-2 py-1">
                                    <span className="text-xs font-medium text-green-200">{c.name}</span>
                                    <span className="text-xs text-green-600">{c.class}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {totalRaids === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>편성된 레이드가 없습니다.</p>
            <p className="text-sm mt-1">📊 이번 주 편성 탭에서 자동 편성을 실행하세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
