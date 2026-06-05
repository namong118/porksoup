import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, DayOfWeek } from '../types'
import { getWeekStart, WEEK_DAYS, getDayOffset, parseLocalDate } from '../lib/weekUtils'

interface RaidResult {
  raid: Raid
  characters: (Character & { member: Member })[]
  commonDays: DayOfWeek[]
  missingCount: number
  totalMembers: number
}


function RaidCard({
  raidResult,
  currentDay,
  onDayChange,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  order,
}: {
  raidResult: RaidResult
  currentDay: DayOfWeek | null
  onDayChange: (raidId: string, day: DayOfWeek | null) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  order?: number
}) {
  const { raid, characters, commonDays, missingCount, totalMembers } = raidResult
  const [editing, setEditing] = useState(false)
  const [editingTime, setEditingTime] = useState(false)
  const [timeValue, setTimeValue] = useState(raid.time ?? '')
  const submittedCount = totalMembers - missingCount
  const isConfirmed = currentDay ? commonDays.includes(currentDay) : false

  async function changeDay(day: DayOfWeek | null) {
    await supabase.from('raids').update({ day_of_week: day }).eq('id', raid.id)
    onDayChange(raid.id, day)
    setEditing(false)
  }

  async function saveTime() {
    await supabase.from('raids').update({ time: timeValue || null }).eq('id', raid.id)
    onDayChange(raid.id, currentDay)
    setEditingTime(false)
  }

  return (
    <div className="px-4 py-3 bg-gray-800" style={{ borderLeft: `3px solid ${raid.color ?? '#6b7280'}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 순서 번호 */}
          {order !== undefined && (
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-600 text-xs font-bold text-gray-300 shrink-0">
              {order}
            </span>
          )}

          {/* 순서 버튼 */}
          <div className="flex flex-col gap-0.5 mr-1">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className={`w-5 h-4 flex items-center justify-center rounded text-xs transition-colors
                ${canMoveUp ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-700 cursor-not-allowed'}`}
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={`w-5 h-4 flex items-center justify-center rounded text-xs transition-colors
                ${canMoveDown ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-700 cursor-not-allowed'}`}
            >
              ▼
            </button>
          </div>

          <span className="font-medium text-sm">{raid.name}</span>
          <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">{raid.size}인</span>
          {editingTime ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={timeValue}
                onChange={e => setTimeValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTime(); if (e.key === 'Escape') setEditingTime(false) }}
                placeholder="20:10"
                className="bg-gray-600 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 ring-blue-500 w-16"
              />
              <button onClick={saveTime} className="text-blue-400 text-xs hover:text-blue-300">저장</button>
              <button onClick={() => setEditingTime(false)} className="text-gray-500 text-xs hover:text-gray-300">취소</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingTime(true)}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              {raid.time ?? '시간 미정'}
            </button>
          )}
          {currentDay && (
            isConfirmed
              ? <span className="text-xs bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full">✓ 확정</span>
              : <span className="text-xs bg-yellow-900 text-yellow-400 px-1.5 py-0.5 rounded-full">⚠ 불가자 있음</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{submittedCount}/{totalMembers}명</span>
          <button
            onClick={() => setEditing(v => !v)}
            className="text-xs text-gray-400 hover:text-blue-400 transition-colors px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600"
          >
            요일 변경
          </button>
        </div>
      </div>

      {editing && (
        <div className="mb-3 p-3 bg-gray-700 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">이동할 요일 선택</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_DAYS.map(d => (
              <button
                key={d}
                onClick={() => changeDay(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${currentDay === d ? 'bg-blue-600 text-white' :
                    commonDays.includes(d) ? 'bg-green-800 text-green-200 hover:bg-green-700' :
                    'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
              >
                {d}요일
                {commonDays.includes(d) && <span className="ml-1 opacity-70">✓</span>}
              </button>
            ))}
            <button
              onClick={() => changeDay(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 bg-gray-600 hover:bg-gray-500 transition-colors"
            >
              미정으로
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">초록색 = 파티원 모두 가능한 요일</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {[...characters]
          .sort((a, b) => {
            if (a.role === b.role) return 0
            return a.role === 'support' ? 1 : -1
          })
          .map(char => (
          <span key={char.id} className={`text-xs px-2 py-0.5 rounded-full
            ${char.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
            {char.name}
            <span className="text-gray-500 ml-1">{char.class}</span>
          </span>
        ))}
        {characters.length === 0 && (
          <span className="text-xs text-gray-600">배정된 캐릭터 없음</span>
        )}
      </div>
    </div>
  )
}

export default function ScheduleResult() {
  const [results, setResults] = useState<RaidResult[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [maxPerDay, setMaxPerDay] = useState(6)
  const [minPerDay, setMinPerDay] = useState(4)
  const weekStart = getWeekStart()

  const load = useCallback(async () => {
    setLoading(true)
    const [raidsRes, rcRes, schedRes] = await Promise.all([
      supabase.from('raids').select('*').order('sort_order').order('name'),
      supabase.from('raid_characters').select('*, character:characters(*, member:members(*))'),
      supabase.from('weekly_schedules').select('*').eq('week_start', weekStart),
    ])

    const raids: Raid[] = raidsRes.data ?? []
    const rcData = rcRes.data ?? []
    const schedules = schedRes.data ?? []

    const scheduleMap: Record<string, DayOfWeek[]> = {}
    schedules.forEach((s: { member_id: string; available_days: DayOfWeek[] }) => {
      scheduleMap[s.member_id] = s.available_days
    })

    const results: RaidResult[] = raids.map(raid => {
      const assigned = rcData
        .filter((rc: { raid_id: string }) => rc.raid_id === raid.id)
        .map((rc: { character: Character & { member: Member } }) => rc.character)
        .filter(Boolean) as (Character & { member: Member })[]

      const memberIds = [...new Set(assigned.map(c => c.member_id))]
      const submittedIds = memberIds.filter(mid => scheduleMap[mid] !== undefined)
      const missingCount = memberIds.length - submittedIds.length

      const commonDays = submittedIds.length === 0
        ? []
        : WEEK_DAYS.filter(day => submittedIds.every(mid => scheduleMap[mid].includes(day)))

      return { raid, characters: assigned, commonDays, missingCount, totalMembers: memberIds.length }
    })

    setResults(results)
    setLoading(false)
  }, [weekStart])

  useEffect(() => { load() }, [load])

  function handleDayChange(raidId: string, day: DayOfWeek | null) {
    setResults(prev => prev.map(r =>
      r.raid.id === raidId ? { ...r, raid: { ...r.raid, day_of_week: day } } : r
    ))
    setApplied(false)
  }

  async function handleMove(dayRaids: RaidResult[], index: number, direction: 'up' | 'down') {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= dayRaids.length) return

    // 배열 순서를 실제로 바꾼 뒤 순번을 0,1,2... 로 재부여
    const reordered = [...dayRaids]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(swapIndex, 0, moved)

    // DB에 새 순번 저장
    await Promise.all(
      reordered.map((r, i) =>
        supabase.from('raids').update({ sort_order: i }).eq('id', r.raid.id)
      )
    )

    // 로컬 state에서도 해당 요일 레이드 순서 반영
    setResults(prev => {
      const updated = prev.map(r => {
        const newIdx = reordered.findIndex(rr => rr.raid.id === r.raid.id)
        return newIdx !== -1 ? { ...r, raid: { ...r.raid, sort_order: newIdx } } : r
      })
      // sort_order 기준 재정렬
      return [...updated].sort((a, b) => a.raid.sort_order - b.raid.sort_order)
    })
  }

  async function autoSchedule() {
    setApplying(true)
    const MIN = minPerDay
    const MAX = maxPerDay

    // 각 요일에 몇 개의 레이드가 갈 수 있는지 파악
    const dayPotential: Partial<Record<DayOfWeek, number>> = {}
    WEEK_DAYS.forEach(day => {
      dayPotential[day] = results.filter(r => r.commonDays.includes(day)).length
    })

    // MIN 이상 채울 수 있는 요일만 유효
    const validDays = new Set(WEEK_DAYS.filter(d => (dayPotential[d] ?? 0) >= MIN))

    // 유효 요일이 있는 레이드만 대상, 가능 요일 적은 것부터 (제약 많은 것 우선)
    const toSchedule = results
      .filter(r => r.commonDays.some(d => validDays.has(d)))
      .sort((a, b) => {
        const aValid = a.commonDays.filter(d => validDays.has(d)).length
        const bValid = b.commonDays.filter(d => validDays.has(d)).length
        return aValid - bValid
      })

    const dayCount: Record<string, number> = {}
    const updates: { id: string; day: string }[] = []

    for (const { raid, commonDays } of toSchedule) {
      const available = commonDays.filter(d => validDays.has(d) && (dayCount[d] ?? 0) < MAX)
      if (available.length === 0) continue

      // 기존 요일 유지 or 가장 많이 채워진 날 우선(집중 배치)
      const keepExisting = raid.day_of_week && available.includes(raid.day_of_week as DayOfWeek)
      const bestDay = keepExisting
        ? raid.day_of_week as string
        : [...available].sort((a, b) => (dayCount[b] ?? 0) - (dayCount[a] ?? 0))[0]

      dayCount[bestDay] = (dayCount[bestDay] ?? 0) + 1
      updates.push({ id: raid.id, day: bestDay })
    }

    // MIN 미만인 날은 제거 (혼자 or 소수만 오는 날 방지)
    const dayFinal: Record<string, number> = {}
    updates.forEach(u => { dayFinal[u.day] = (dayFinal[u.day] ?? 0) + 1 })
    const finalUpdates = updates.filter(u => dayFinal[u.day] >= MIN)

    await Promise.all(finalUpdates.map(({ id, day }) =>
      supabase.from('raids').update({ day_of_week: day }).eq('id', id)
    ))

    setApplied(true)
    setApplying(false)
    load()
  }

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  const weekStartDate = parseLocalDate(weekStart)
  const weekEndDate = parseLocalDate(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  const autoSchedulable = results.filter(r => r.commonDays.length > 0).length

  const raidsByDay: Record<DayOfWeek, RaidResult[]> = {
    '월': [], '화': [], '수': [], '목': [], '금': [], '토': [], '일': []
  }
  const unscheduled: RaidResult[] = []

  results.forEach(r => {
    if (r.raid.day_of_week) {
      raidsByDay[r.raid.day_of_week as DayOfWeek].push(r)
    } else {
      unscheduled.push(r)
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">이번 주 레이드 일정</h2>
        <span className="text-sm text-gray-400">
          {formatDate(weekStartDate)} ~ {formatDate(weekEndDate)}
        </span>
      </div>

      <div className="bg-gray-700 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            편성 가능 <span className="text-green-400 font-medium">{autoSchedulable}개</span>
            {unscheduled.length > 0 && <> · 미배정 <span className="text-yellow-400 font-medium">{unscheduled.length}개</span></>}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 flex items-center gap-1.5">
              최소
              <input
                type="number"
                min={1}
                max={maxPerDay}
                value={minPerDay}
                onChange={e => setMinPerDay(Math.max(1, Number(e.target.value)))}
                className="w-10 bg-gray-600 rounded px-2 py-0.5 text-center text-xs outline-none focus:ring-1 ring-blue-500"
              />
            </label>
            <span className="text-gray-600 text-xs">~</span>
            <label className="text-xs text-gray-400 flex items-center gap-1.5">
              최대
              <input
                type="number"
                min={minPerDay}
                max={20}
                value={maxPerDay}
                onChange={e => setMaxPerDay(Math.max(minPerDay, Number(e.target.value)))}
                className="w-10 bg-gray-600 rounded px-2 py-0.5 text-center text-xs outline-none focus:ring-1 ring-blue-500"
              />
              개/일
            </label>
            <button
              onClick={autoSchedule}
              disabled={applying || autoSchedulable === 0}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${applied ? 'bg-green-700 text-green-200' :
                  autoSchedulable === 0 ? 'bg-gray-600 text-gray-500 cursor-not-allowed' :
                  'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              {applying ? '적용 중...' : applied ? '✓ 완료' : '자동 편성'}
            </button>
          </div>
        </div>
      </div>

      {/* 메인 레이아웃: 캘린더 + 사이드바 */}
      <div className="flex gap-3 items-start">

      {/* 캘린더 */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {WEEK_DAYS.map(day => {
          const dayRaids = raidsByDay[day]
          const dayDate = parseLocalDate(weekStart)
          dayDate.setDate(dayDate.getDate() + getDayOffset(day))

          return (
            <div key={day} className={`rounded-xl overflow-hidden border ${dayRaids.length > 0 ? 'border-gray-600' : 'border-gray-700'}`}>
              <div className={`px-4 py-2 flex items-center justify-between ${dayRaids.length > 0 ? 'bg-gray-700' : 'bg-gray-800'}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${dayRaids.length > 0 ? 'text-white' : 'text-gray-500'}`}>
                    {day}요일
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(dayDate)}</span>
                </div>
                {dayRaids.length > 0 && (
                  <span className="text-xs text-gray-400">{dayRaids.length}개 레이드</span>
                )}
              </div>

              {dayRaids.length === 0 ? (
                <div className="px-4 py-2 bg-gray-800">
                  <span className="text-xs text-gray-600">레이드 없음</span>
                </div>
              ) : (() => {
                // 시간대별 그룹핑
                const timeGroups: Record<string, RaidResult[]> = {}
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
                  <div className="divide-y divide-gray-600">
                    {sortedTimes.map(time => {
                      const groupRaids = timeGroups[time]
                      return (
                        <div key={time}>
                          {/* 타임슬롯 헤더 */}
                          <div className="px-4 py-1.5 bg-gray-750 bg-gray-900 flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-400">⏰ {time}</span>
                            <span className="text-xs text-gray-500">{groupRaids.length}개</span>
                          </div>
                          {/* 해당 타임슬롯 레이드들 */}
                          <div className="divide-y divide-gray-700">
                            {groupRaids.map((r, i) => (
                              <RaidCard
                                key={r.raid.id}
                                raidResult={r}
                                currentDay={r.raid.day_of_week as DayOfWeek}
                                onDayChange={handleDayChange}
                                onMoveUp={() => handleMove(groupRaids, i, 'up')}
                                onMoveDown={() => handleMove(groupRaids, i, 'down')}
                                canMoveUp={i > 0}
                                canMoveDown={i < groupRaids.length - 1}
                                order={i + 1}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* 사이드바: 미배정 레이드 */}
      {unscheduled.length > 0 && (
        <div className="w-44 shrink-0 sticky top-4">
          <p className="text-xs text-yellow-400 font-medium mb-2">⏳ 미배정 {unscheduled.length}개</p>
          <div className="flex flex-col gap-2">
            {unscheduled.map((r, i) => (
              <div key={r.raid.id} className="rounded-xl overflow-hidden border border-dashed border-gray-600">
                <RaidCard
                  raidResult={r}
                  currentDay={null}
                  onDayChange={handleDayChange}
                  onMoveUp={() => handleMove(unscheduled, i, 'up')}
                  onMoveDown={() => handleMove(unscheduled, i, 'down')}
                  canMoveUp={i > 0}
                  canMoveDown={i < unscheduled.length - 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      </div>{/* end flex layout */}
    </div>
  )
}
