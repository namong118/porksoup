import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, DayOfWeek } from '../types'
import { RAID_COLORS } from '../types'
import { getWeekStart, WEEK_DAYS, getDayOffset, parseLocalDate, getPastDays } from '../lib/weekUtils'
import AllSchedules from './AllSchedules'

function addWeeks(dateStr: string, weeks: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + weeks * 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface RaidResult {
  raid: Raid
  characters: (Character & { member: Member })[]
  commonDays: DayOfWeek[]
  missingCount: number
  totalMembers: number
  conflictMembers: Member[]
}


function UnscheduledChip({ raidResult, onDayChange, pastDays, weekField }: {
  raidResult: RaidResult
  onDayChange: (raidId: string, day: DayOfWeek | null) => void
  pastDays: Set<DayOfWeek>
  weekField: 'day_of_week' | 'next_day_of_week'
}) {
  const { raid, commonDays } = raidResult
  const [open, setOpen] = useState(false)

  async function assignDay(day: DayOfWeek) {
    await supabase.from('raids').update({ [weekField]: day }).eq('id', raid.id)
    onDayChange(raid.id, day)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        style={{ borderColor: raid.color ?? '#6b7280', backgroundColor: `${raid.color ?? '#6b7280'}18` }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium text-gray-200 hover:opacity-80 transition-opacity"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: raid.color ?? '#6b7280' }} />
        {raid.name}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-gray-700 rounded-xl p-2 shadow-xl border border-gray-600 min-w-max">
          <p className="text-xs text-gray-400 mb-1.5 px-1">요일 배정</p>
          <div className="flex flex-wrap gap-1">
            {WEEK_DAYS.map(d => {
              const isPast = pastDays.has(d)
              const isCommon = commonDays.includes(d)
              return (
                <button key={d} onClick={() => !isPast && assignDay(d)} disabled={isPast}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                    ${isPast ? 'text-gray-700 cursor-not-allowed line-through' :
                      isCommon ? 'bg-green-800 text-green-200 hover:bg-green-700' :
                      'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}>
                  {d}{isCommon && !isPast && ' ✓'}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TimeSlotHeader({ time, count, onSave }: {
  time: string
  count: number
  onSave: (newTime: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(time)

  async function save() {
    await onSave(value)
    setEditing(false)
  }

  return (
    <div className="px-4 py-2 bg-gray-900 flex items-center gap-3">
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="20:10"
            className="bg-gray-700 rounded px-2 py-0.5 text-sm font-bold outline-none focus:ring-1 ring-blue-500 w-20"
          />
          <button onClick={save} className="text-blue-400 text-xs hover:text-blue-300">저장</button>
          <button onClick={() => setEditing(false)} className="text-gray-500 text-xs">취소</button>
        </div>
      ) : (
        <button
          onClick={() => { setValue(time); setEditing(true) }}
          className="flex items-center gap-2 group"
        >
          <span className="text-base font-bold text-blue-300">
            {time ? `⏰ ${time}` : '⏰ 시간 미정'}
          </span>
          <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">✏️</span>
        </button>
      )}
      <span className="text-xs text-gray-500 ml-auto">{count}개 레이드</span>
    </div>
  )
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
  pastDays,
  onTimeChange,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
  isDragging,
  weekField,
  isNextWeek,
}: {
  raidResult: RaidResult
  currentDay: DayOfWeek | null
  onDayChange: (raidId: string, day: DayOfWeek | null) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  order?: number
  pastDays: Set<DayOfWeek>
  onTimeChange: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
  isDragOver: boolean
  isDragging: boolean
  weekField: 'day_of_week' | 'next_day_of_week'
  isNextWeek: boolean
}) {
  const { raid, characters, commonDays, missingCount, totalMembers, conflictMembers } = raidResult
  const [editing, setEditing] = useState(false)
  const [splitTime, setSplitTime] = useState('')
  const [splitting, setSplitting] = useState(false)
  const submittedCount = totalMembers - missingCount

  async function changeDay(day: DayOfWeek | null) {
    await supabase.from('raids').update({ [weekField]: day }).eq('id', raid.id)
    onDayChange(raid.id, day)
    setEditing(false)
  }

  async function complete() {
    if (!confirm(`"${raid.name}" 완료 처리할까요?`)) return
    await supabase.from('raids').update({ completed: true }).eq('id', raid.id)
    onDayChange(raid.id, null)
  }

  async function saveSplitTime() {
    await supabase.from('raids').update({ time: splitTime || null }).eq('id', raid.id)
    setSplitting(false)
    onTimeChange()
  }

  return (
    <div
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart() }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver() }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop() }}
      onDragEnd={onDragEnd}
      className={`px-4 py-3 bg-gray-800 cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'ring-2 ring-inset ring-blue-400' : ''}`}
      style={{ borderLeft: `3px solid ${raid.color ?? '#6b7280'}` }}
    >
      {/* 1행: 순서 + 레이드명 + 인원 */}
      <div className="flex items-center gap-2 mb-3">
        {order !== undefined && (
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-600 text-xs font-bold text-gray-300 shrink-0">
            {order}
          </span>
        )}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={!canMoveUp}
            className={`w-5 h-4 flex items-center justify-center rounded text-xs transition-colors
              ${canMoveUp ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-700 cursor-not-allowed'}`}>▲</button>
          <button onClick={onMoveDown} disabled={!canMoveDown}
            className={`w-5 h-4 flex items-center justify-center rounded text-xs transition-colors
              ${canMoveDown ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-700 cursor-not-allowed'}`}>▼</button>
        </div>
        <span className="font-semibold text-sm">{raid.name}</span>
        {conflictMembers.length > 0 && (
          <span
            className="flex items-center gap-1 bg-red-900/60 border border-red-700 text-red-300 text-xs px-1.5 py-0.5 rounded-full"
            title={`불참 불가: ${conflictMembers.map(m => m.nickname).join(', ')}`}
          >
            <span>❗</span>
            <span>{conflictMembers.map(m => m.nickname).join(', ')}</span>
          </span>
        )}
        <span className="text-xs text-gray-500 ml-auto">{submittedCount}/{totalMembers}명</span>
      </div>

      {/* 2행: 버튼 */}
      <div className="flex items-center gap-1 mb-3">
        <button onClick={() => changeDay(null)}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-700">
          ↩ 미배정
        </button>
        <button onClick={() => { setSplitting(v => !v); setSplitTime(raid.time ?? '') }}
          className="text-xs text-gray-500 hover:text-yellow-400 transition-colors px-2 py-1 rounded hover:bg-gray-700">
          ✂ 분리
        </button>
        <button onClick={() => setEditing(v => !v)}
          className="text-xs text-gray-400 hover:text-blue-400 transition-colors px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">
          요일 변경
        </button>
        {!isNextWeek && (
          <button onClick={complete}
            className="text-xs text-green-400 hover:text-green-200 transition-colors px-2 py-1 rounded bg-green-900/50 hover:bg-green-800 ml-auto font-medium">
            ✓ 완료
          </button>
        )}
      </div>

      {splitting && (
        <div className="mb-2 p-3 bg-gray-700 rounded-xl flex items-center gap-2">
          <span className="text-xs text-gray-300">이 레이드 시간:</span>
          <input
            autoFocus
            value={splitTime}
            onChange={e => setSplitTime(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveSplitTime(); if (e.key === 'Escape') setSplitting(false) }}
            placeholder="16:10"
            className="bg-gray-600 rounded px-2 py-1 text-sm font-bold outline-none focus:ring-1 ring-yellow-500 w-20"
          />
          <button onClick={saveSplitTime} className="text-yellow-400 text-xs hover:text-yellow-300 font-medium">적용</button>
          <button onClick={() => setSplitting(false)} className="text-gray-500 text-xs">취소</button>
          <span className="text-xs text-gray-500 ml-auto">다른 시간 입력 시 새 타임슬롯으로 분리됨</span>
        </div>
      )}

      {editing && (
        <div className="mb-3 p-3 bg-gray-700 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">이동할 요일 선택</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_DAYS.map(d => {
              const isPast = pastDays.has(d)
              return (
                <button
                  key={d}
                  onClick={() => !isPast && changeDay(d)}
                  disabled={isPast}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${isPast ? 'bg-gray-700 text-gray-600 cursor-not-allowed line-through' :
                      currentDay === d ? 'bg-blue-600 text-white' :
                      commonDays.includes(d) ? 'bg-green-800 text-green-200 hover:bg-green-700' :
                      'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                >
                  {d}요일
                  {!isPast && commonDays.includes(d) && <span className="ml-1 opacity-70">✓</span>}
                </button>
              )
            })}
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

      <div className="grid grid-cols-4 gap-1.5">
        {[...characters]
          .sort((a, b) => {
            if (a.role === b.role) return 0
            return a.role === 'support' ? 1 : -1
          })
          .map(char => (
          <div
            key={char.id}
            className="flex flex-col px-2 py-1.5 rounded-lg"
            style={{
              backgroundColor: `${char.member?.color ?? '#94a3b8'}18`,
              borderLeft: `3px solid ${char.member?.color ?? '#94a3b8'}`,
            }}
          >
            <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-xs font-medium truncate" style={{ color: char.member?.color ?? '#e2e8f0' }}>
                  {char.name}
                </span>
                {char.item_level && (
                  <span className="text-xs opacity-70 shrink-0" style={{ color: char.member?.color ?? '#94a3b8' }}>
                    {Math.floor(Number(char.item_level)).toLocaleString()}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-300 truncate">{char.class}</span>
          </div>
        ))}
        {characters.length === 0 && (
          <span className="text-xs text-gray-600 col-span-4">배정된 캐릭터 없음</span>
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
  const [resetting, setResetting] = useState(false)
  const [maxPerDay, setMaxPerDay] = useState(6)
  const minPerDay = 1
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [showNext, setShowNext] = useState(false)
  const thisWeekStart = getWeekStart()
  const weekStart = showNext ? addWeeks(thisWeekStart, 1) : thisWeekStart
  const pastDays = showNext ? new Set<DayOfWeek>() : getPastDays(thisWeekStart)
  const weekField = (showNext ? 'next_day_of_week' : 'day_of_week') as 'day_of_week' | 'next_day_of_week'
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    const [raidsRes, rcRes, schedRes] = await Promise.all([
      supabase.from('raids').select('*').eq('is_draft', false).order('sort_order').order('name'),
      supabase.from('raid_characters').select('*, character:characters(*, member:members(*))'),
      supabase.from('weekly_schedules').select('*').eq('week_start', weekStart),
    ])
    if (seq !== loadSeq.current) return

    const raids: Raid[] = raidsRes.data ?? []
    const rcData = rcRes.data ?? []
    const schedules = schedRes.data ?? []

    const scheduleMap: Record<string, DayOfWeek[]> = {}
    const timesMap: Record<string, Record<string, string[]>> = {}
    schedules.forEach((s: any) => {
      scheduleMap[s.member_id] = s.available_days ?? []
      timesMap[s.member_id] = s.available_times ?? {}
    })

    // 레이드 시간에서 시(hour) 추출
    function getHour(time: string | null): string | null {
      if (!time) return null
      return String(parseInt(time.split(':')[0]))
    }

    const results: RaidResult[] = raids.map(raid => {
      const assigned = rcData
        .filter((rc: { raid_id: string }) => rc.raid_id === raid.id)
        .map((rc: { character: Character & { member: Member } }) => rc.character)
        .filter(Boolean) as (Character & { member: Member })[]

      const memberIds = [...new Set(assigned.map(c => c.member_id))]
      const submittedIds = memberIds.filter(mid => scheduleMap[mid] !== undefined)
      const missingCount = memberIds.length - submittedIds.length

      const raidHour = getHour(raid.time)

      const commonDays = submittedIds.length === 0
        ? []
        : WEEK_DAYS.filter(day =>
            submittedIds.every(mid => {
              if (!scheduleMap[mid].includes(day)) return false
              // 레이드 시간이 정해진 경우, 해당 시간에 가능한지 체크
              if (raidHour) {
                const memberHours: string[] = timesMap[mid]?.[day] ?? []
                if (memberHours.length > 0 && !memberHours.includes(raidHour)) return false
              }
              return true
            })
          )

      const assignedDay = (raid[weekField] ?? null) as DayOfWeek | null
      const conflictMembers: Member[] = assignedDay
        ? submittedIds
            .filter(mid => {
              if (!scheduleMap[mid].includes(assignedDay)) return true
              if (raidHour) {
                const memberHours: string[] = timesMap[mid]?.[assignedDay] ?? []
                if (memberHours.length > 0 && !memberHours.includes(raidHour)) return true
              }
              return false
            })
            .map(mid => assigned.find(c => c.member_id === mid)?.member)
            .filter(Boolean) as Member[]
        : []

      return { raid, characters: assigned, commonDays, missingCount, totalMembers: memberIds.length, conflictMembers }
    })

    setResults(results)
    setLoading(false)
  }, [weekStart, weekField])

  useEffect(() => { load() }, [load])

  function handleDayChange(raidId: string, day: DayOfWeek | null) {
    setResults(prev => prev.map(r =>
      r.raid.id === raidId ? { ...r, raid: { ...r.raid, [weekField]: day } } : r
    ))
    setApplied(false)
  }

  async function handleDropOnRaid(targetResult: RaidResult) {
    if (!dragId || dragId === targetResult.raid.id) {
      setDragId(null); setOverId(null); return
    }
    const draggedResult = results.find(r => r.raid.id === dragId)
    if (!draggedResult || draggedResult.raid[weekField] !== targetResult.raid[weekField]) {
      setDragId(null); setOverId(null); return
    }
    const day = draggedResult.raid[weekField] as DayOfWeek
    const targetTime = targetResult.raid.time ?? null

    // 해당 요일 레이드 순서대로 정렬
    const dayRaids = results
      .filter(r => r.raid[weekField] === day)
      .sort((a, b) => (a.raid.sort_order ?? 0) - (b.raid.sort_order ?? 0))

    // 드래그 대상 빼고 타겟 위치에 삽입
    const withoutDragged = dayRaids.filter(r => r.raid.id !== dragId)
    const targetIdx = withoutDragged.findIndex(r => r.raid.id === targetResult.raid.id)
    withoutDragged.splice(targetIdx, 0, draggedResult)

    // sort_order 업데이트 + 드래그한 레이드 시간 변경
    await Promise.all(withoutDragged.map((r, i) =>
      supabase.from('raids').update({
        sort_order: i,
        ...(r.raid.id === dragId ? { time: targetTime } : {}),
      }).eq('id', r.raid.id)
    ))

    setDragId(null)
    setOverId(null)
    load()
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

  async function resetAll() {
    if (!confirm(showNext ? '다음 주 레이드 배정을 전부 초기화할까요?' : '이번 주 레이드 배정을 전부 초기화할까요?')) return
    setResetting(true)
    if (showNext) {
      // 다음 주: 완료 여부 무관 전체 초기화 (필터 필요하므로 not null 조건 사용)
      await supabase.from('raids').update({ next_day_of_week: null }).not('id', 'is', null)
    } else {
      await supabase.from('raids').update({ day_of_week: null, time: null }).eq('completed', false)
    }
    setResetting(false)
    setApplied(false)
    load()
  }

  async function autoSchedule() {
    setApplying(true)
    const MIN = minPerDay
    const MAX = maxPerDay

    // 지난 날 직접 계산 (클로저 의존 없이)
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const currentPastDays = new Set(
      WEEK_DAYS.filter((_, i) => {
        const d = parseLocalDate(weekStart)
        d.setDate(d.getDate() + i)
        return d < todayMidnight
      })
    )

    // 완료된 레이드 제외 (다음 주는 전부 미완료 취급)
    const activeResults = results.filter(r => showNext || !r.raid.completed)

    // 각 요일에 갈 수 있는 레이드 수 파악
    const dayPotential: Partial<Record<DayOfWeek, number>> = {}
    WEEK_DAYS.forEach(day => {
      dayPotential[day] = activeResults.filter(r => r.commonDays.includes(day)).length
    })

    // MIN 이상 채울 수 있는 요일만 유효 (지난 날 제외)
    const validDays = new Set(WEEK_DAYS.filter(d => (dayPotential[d] ?? 0) >= MIN && !currentPastDays.has(d)))

    // 제약 많은 레이드(가능 요일 적은 것) 먼저 배정
    const toSchedule = activeResults
      .filter(r => r.commonDays.some(d => validDays.has(d)))
      .sort((a, b) => {
        const aValid = a.commonDays.filter(d => validDays.has(d)).length
        const bValid = b.commonDays.filter(d => validDays.has(d)).length
        return aValid - bValid
      })

    const dayCount: Record<string, number> = {}

    // 완료된 레이드가 이미 차지한 자리를 미리 반영 (다음 주는 제외)
    if (!showNext) {
      results
        .filter(r => r.raid.completed && r.raid[weekField])
        .forEach(r => {
          const d = r.raid[weekField]!
          dayCount[d] = (dayCount[d] ?? 0) + 1
        })
    }
    // 멤버별로 어느 날 가는지 추적
    const memberDays: Record<string, Set<string>> = {}
    const updates: { id: string; day: string }[] = []

    for (const { raid, commonDays, characters } of toSchedule) {
      const raidMemberIds = [...new Set(characters.map(c => c.member_id))]
      const available = commonDays.filter(d =>
        validDays.has(d) &&
        (dayCount[d] ?? 0) < MAX
      )
      if (available.length === 0) continue

      // 각 후보 요일 점수 계산:
      // 1순위: 그날 배정된 레이드 수 가장 적은 요일 우선 (균등 배분)
      // 2순위: 이 레이드 멤버 중 이미 그날 가는 사람 수 (많을수록 좋음)
      const scored = available.map(day => {
        const memberOverlap = raidMemberIds.filter(mid => memberDays[mid]?.has(day)).length
        const raidCount = dayCount[day] ?? 0
        return { day, memberOverlap, raidCount }
      }).sort((a, b) => {
        if (a.raidCount !== b.raidCount) return a.raidCount - b.raidCount  // 적은 요일 우선
        return b.memberOverlap - a.memberOverlap  // 멤버 겹침 많은 요일 우선
      })

      const bestDay = scored[0].day
      dayCount[bestDay] = (dayCount[bestDay] ?? 0) + 1

      // 해당 날에 가는 멤버 기록
      raidMemberIds.forEach(mid => {
        if (!memberDays[mid]) memberDays[mid] = new Set()
        memberDays[mid].add(bestDay)
      })

      updates.push({ id: raid.id, day: bestDay })
    }

    // MIN 미만인 날 제거 + MAX 초과 하드 제한
    const dayFinal: Record<string, number> = {}
    updates.forEach(u => { dayFinal[u.day] = (dayFinal[u.day] ?? 0) + 1 })
    const midUpdates = updates.filter(u => dayFinal[u.day] >= MIN)

    // MAX 초과 안전장치: 날짜별로 MAX개까지만 허용
    const dayMaxCount: Record<string, number> = {}
    const finalUpdates = midUpdates.filter(u => {
      dayMaxCount[u.day] = (dayMaxCount[u.day] ?? 0) + 1
      return dayMaxCount[u.day] <= MAX
    })
    // 1단계: 레이드 요일 초기화 (다음 주는 완료 포함 전체, 이번 주는 미완료만)
    await Promise.all(
      results
        .filter(r => (showNext || !r.raid.completed) && r.raid[weekField])
        .map(r => supabase.from('raids').update({ [weekField]: null }).eq('id', r.raid.id))
    )

    // 2단계: 새로 편성된 레이드만 배정
    await Promise.all(
      finalUpdates.map(({ id, day }) =>
        supabase.from('raids').update({ [weekField]: day }).eq('id', id)
      )
    )

    // 안전장치: 혹시 지난 날에 배정된 경우 재차 초기화 (이번 주만)
    if (!showNext) {
      const allRaidsRes = await supabase.from('raids').select('id, day_of_week')
      if (allRaidsRes.data) {
        const wrongDays = allRaidsRes.data.filter(
          (r: { id: string; day_of_week: string | null }) =>
            r.day_of_week && currentPastDays.has(r.day_of_week as DayOfWeek)
        )
        if (wrongDays.length > 0) {
          await Promise.all(
            wrongDays.map((r: { id: string }) =>
              supabase.from('raids').update({ day_of_week: null }).eq('id', r.id)
            )
          )
        }
      }
    }

    setApplied(true)
    setApplying(false)
    load()
  }

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  const weekStartDate = parseLocalDate(weekStart)
  const weekEndDate = parseLocalDate(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  const autoSchedulable = results.filter(r => !r.raid.completed && r.commonDays.length > 0).length

  const raidsByDay: Record<DayOfWeek, RaidResult[]> = {
    '월': [], '화': [], '수': [], '목': [], '금': [], '토': [], '일': []
  }
  const unscheduled: RaidResult[] = []

  results.forEach(r => {
    if (r.raid.completed && !showNext) return  // 완료된 레이드는 이번 주 캘린더에서만 제외
    const assignedDay = r.raid[weekField]
    if (assignedDay) {
      raidsByDay[assignedDay as DayOfWeek].push(r)
    } else {
      unscheduled.push(r)
    }
  })
  unscheduled.sort((a, b) => {
    const ai = RAID_COLORS.indexOf(a.raid.color ?? '#6b7280')
    const bi = RAID_COLORS.indexOf(b.raid.color ?? '#6b7280')
    const colorDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    if (colorDiff !== 0) return colorDiff
    return a.raid.name.localeCompare(b.raid.name, 'ko', { numeric: true })
  })

  return (
    <div className="flex gap-6 items-start">
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{showNext ? '다음 주 레이드 일정' : '이번 주 레이드 일정'}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{formatDate(weekStartDate)} ~ {formatDate(weekEndDate)}</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-600 text-xs">
            <button
              onClick={() => setShowNext(false)}
              className={`px-2.5 py-1 transition-colors ${!showNext ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
            >이번 주</button>
            <button
              onClick={() => setShowNext(true)}
              className={`px-2.5 py-1 transition-colors ${showNext ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
            >다음 주</button>
          </div>
        </div>
      </div>
      {showNext && (
        <div className="mb-3 px-3 py-2 bg-blue-900/30 border border-blue-700/50 rounded-xl text-xs text-blue-300">
          다음 주 멤버 스케줄 기준으로 편성합니다. 자동 편성 결과는 즉시 DB에 반영됩니다.
        </div>
      )}

      <div className="bg-gray-700 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2 flex-nowrap overflow-x-auto">
        {/* 상태 */}
        <span className="text-xs text-gray-400 shrink-0">
          {Object.values(raidsByDay).flat().length > 0 && (
            <><span className="text-green-400 font-medium">{Object.values(raidsByDay).flat().length}</span>편성 · </>
          )}
          <span className="text-yellow-400 font-medium">{unscheduled.length}</span>미배정
          {autoSchedulable > 0 && <span className="text-gray-500"> ({autoSchedulable}개 편성가능)</span>}
        </span>

        <div className="w-px h-4 bg-gray-500 shrink-0" />

        {/* 초기화 */}
        <button
          onClick={resetAll}
          disabled={resetting}
          className="text-xs px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-300 disabled:opacity-40 transition-colors shrink-0"
        >
          🗑
        </button>

        <div className="w-px h-4 bg-gray-500 shrink-0" />

        {/* 하루 최대 */}
        <span className="text-xs text-gray-500 shrink-0">하루 최대</span>
        <input type="number" min={1} max={20} value={maxPerDay}
          onChange={e => setMaxPerDay(Math.max(1, Number(e.target.value)))}
          className="w-9 bg-gray-600 rounded px-1 py-0.5 text-center text-xs outline-none focus:ring-1 ring-blue-500 shrink-0" />
        <span className="text-xs text-gray-500 shrink-0">개</span>

        {/* 자동 편성 버튼 */}
        <button
          onClick={autoSchedule}
          disabled={applying || autoSchedulable === 0}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0
            ${applied ? 'bg-green-700 text-green-200' :
              autoSchedulable === 0 ? 'bg-gray-600 text-gray-500 cursor-not-allowed' :
              'bg-blue-600 hover:bg-blue-500 text-white'}`}
        >
          {applying ? '...' : applied ? '✓ 완료' : '자동 편성'}
        </button>
      </div>

      {/* 미배정 레이드 - 컴팩트 칩 */}
      {unscheduled.length > 0 && (
        <div className="mb-3 p-3 bg-gray-800 rounded-xl border border-dashed border-gray-600">
          <p className="text-xs text-yellow-400 font-medium mb-2">⏳ 미배정 {unscheduled.length}개</p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map(r => (
              <UnscheduledChip
                key={r.raid.id}
                raidResult={r}
                onDayChange={handleDayChange}
                pastDays={pastDays}
                weekField={weekField}
              />
            ))}
          </div>
        </div>
      )}

      {/* 캘린더 */}
      <div className="flex flex-col gap-2">
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
                  const key = r.raid.time ?? '20:10'
                  if (!timeGroups[key]) timeGroups[key] = []
                  timeGroups[key].push(r)
                })
                const sortedTimes = Object.keys(timeGroups).sort((a, b) => a.localeCompare(b))

                return (
                  <div className="divide-y divide-gray-600">
                    {sortedTimes.map(time => {
                      const groupRaids = timeGroups[time]
                      const raidIds = groupRaids.map(r => r.raid.id)
                      return (
                        <div key={time}>
                          {/* 타임슬롯 헤더 - 편집 가능 */}
                          <TimeSlotHeader
                            time={time}
                            count={groupRaids.length}
                            onSave={async (newTime) => {
                              await Promise.all(raidIds.map(id =>
                                supabase.from('raids').update({ time: newTime || null }).eq('id', id)
                              ))
                              load()
                            }}
                          />
                          {/* 해당 타임슬롯 레이드들 */}
                          <div className="divide-y divide-gray-700">
                            {groupRaids.map((r, i) => (
                              <RaidCard
                                key={r.raid.id}
                                raidResult={r}
                                currentDay={r.raid[weekField] as DayOfWeek | null}
                                onDayChange={handleDayChange}
                                onMoveUp={() => handleMove(groupRaids, i, 'up')}
                                onMoveDown={() => handleMove(groupRaids, i, 'down')}
                                canMoveUp={i > 0}
                                canMoveDown={i < groupRaids.length - 1}
                                order={i + 1}
                                pastDays={pastDays}
                                onTimeChange={load}
                                onDragStart={() => setDragId(r.raid.id)}
                                onDragOver={() => setOverId(r.raid.id)}
                                onDrop={() => handleDropOnRaid(r)}
                                onDragEnd={() => { setDragId(null); setOverId(null) }}
                                isDragOver={overId === r.raid.id && dragId !== r.raid.id}
                                isDragging={dragId === r.raid.id}
                                weekField={weekField}
                                isNextWeek={showNext}
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
    </div>
    <div className="w-96 shrink-0 sticky top-4">
      <AllSchedules weekStart={weekStart} />
    </div>
    </div>
  )
}
