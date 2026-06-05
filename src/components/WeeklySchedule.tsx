import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, DayOfWeek } from '../types'
import { getWeekStart, WEEK_DAYS, parseLocalDate } from '../lib/weekUtils'

interface Props {
  member: Member
}

const SLOTS = ['16', '20'] as const
type Slot = typeof SLOTS[number]
const SLOT_LABELS: Record<Slot, string> = { '16': '16시대', '20': '20시대' }

function cellKey(day: DayOfWeek, slot: Slot) { return `${day}-${slot}` }

export default function WeeklySchedule({ member }: Props) {
  const weekStart = getWeekStart()
  const [selected, setSelected] = useState(new Set<string>())
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [dragAction, setDragAction] = useState<'select' | 'deselect'>('select')

  useEffect(() => {
    supabase
      .from('weekly_schedules')
      .select('*')
      .eq('member_id', member.id)
      .eq('week_start', weekStart)
      .single()
      .then(({ data }) => {
        if (data) {
          const days: DayOfWeek[] = data.available_days ?? []
          const times: Record<string, string[]> = data.available_times ?? {}
          const init = new Set<string>()
          days.forEach(day => {
            const daySlots: string[] = times[day] ?? ['16', '20']
            daySlots.forEach(s => init.add(cellKey(day, s as Slot)))
          })
          setSelected(init)
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [member.id, weekStart])

  // 마우스를 놓으면 드래그 종료
  useEffect(() => {
    const stop = () => setDragging(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  function handleMouseDown(day: DayOfWeek, slot: Slot) {
    const key = cellKey(day, slot)
    const action = selected.has(key) ? 'deselect' : 'select'
    setDragging(true)
    setDragAction(action)
    applyCell(key, action)
  }

  function handleMouseEnter(day: DayOfWeek, slot: Slot) {
    if (!dragging) return
    applyCell(cellKey(day, slot), dragAction)
  }

  const applyCell = useCallback((key: string, action: 'select' | 'deselect') => {
    setSaved(false)
    setSelected(prev => {
      const next = new Set(prev)
      action === 'select' ? next.add(key) : next.delete(key)
      return next
    })
  }, [])

  function deriveState() {
    const availableDays: DayOfWeek[] = []
    const availableTimes: Record<string, string[]> = {}
    WEEK_DAYS.forEach(day => {
      const daySlots = SLOTS.filter(s => selected.has(cellKey(day, s)))
      if (daySlots.length > 0) {
        availableDays.push(day)
        availableTimes[day] = daySlots
      }
    })
    return { availableDays, availableTimes }
  }

  async function save() {
    const { availableDays, availableTimes } = deriveState()
    const { error } = await supabase
      .from('weekly_schedules')
      .upsert({
        member_id: member.id,
        week_start: weekStart,
        available_days: availableDays,
        available_times: availableTimes,
        note: note || null,
      }, { onConflict: 'member_id,week_start' })
    if (!error) setSaved(true)
  }

  const weekStartDate = parseLocalDate(weekStart)
  const weekEndDate = parseLocalDate(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  const selectedDays = WEEK_DAYS.filter(day => SLOTS.some(s => selected.has(cellKey(day, s))))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">이번 주 스케줄</h2>
        <span className="text-sm text-gray-400">
          {formatDate(weekStartDate)} ~ {formatDate(weekEndDate)}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-3">드래그해서 가능한 요일·시간대를 선택하세요</p>

      {/* 드래그 그리드 */}
      <div
        className="rounded-xl overflow-hidden border border-gray-600 mb-4 select-none"
        onMouseLeave={() => {}} // 그리드 밖으로 나가도 드래그 유지
      >
        {/* 헤더 */}
        <div className="grid grid-cols-[1fr_1fr_1fr] bg-gray-700 border-b border-gray-600">
          <div className="py-2 text-center text-xs text-gray-500">요일</div>
          {SLOTS.map(s => (
            <div key={s} className="py-2 text-center text-xs font-medium text-gray-400 border-l border-gray-600">
              {SLOT_LABELS[s]}
            </div>
          ))}
        </div>

        {/* 요일별 행 */}
        {WEEK_DAYS.map((day, i) => {
          const isAnySelected = SLOTS.some(s => selected.has(cellKey(day, s)))
          return (
            <div
              key={day}
              className={`grid grid-cols-[1fr_1fr_1fr] ${i < WEEK_DAYS.length - 1 ? 'border-b border-gray-600' : ''}`}
            >
              {/* 요일 레이블 */}
              <div className={`py-3 text-center text-sm font-bold transition-colors
                ${isAnySelected ? 'text-white bg-gray-700' : 'text-gray-600 bg-gray-800'}`}>
                {day}
              </div>

              {/* 시간대 셀 */}
              {SLOTS.map(slot => {
                const key = cellKey(day, slot)
                const isOn = selected.has(key)
                return (
                  <div
                    key={slot}
                    onMouseDown={() => handleMouseDown(day, slot)}
                    onMouseEnter={() => handleMouseEnter(day, slot)}
                    className={`py-3 border-l border-gray-600 cursor-pointer flex items-center justify-center transition-colors
                      ${isOn
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-600 hover:bg-gray-700'}`}
                  >
                    <span className="text-xs font-medium">{isOn ? '✓' : '—'}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* 선택 요약 */}
      {selectedDays.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selectedDays.map(day => {
            const slots = SLOTS.filter(s => selected.has(cellKey(day, s)))
            return (
              <span key={day} className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded-full">
                {day} · {slots.map(s => SLOT_LABELS[s]).join(' ')}
              </span>
            )
          })}
        </div>
      )}

      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); setSaved(false) }}
        placeholder="특이사항 (예: 토 20시대만 조금 늦게 가능)"
        rows={2}
        className="w-full bg-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500 resize-none mb-4"
      />

      <button
        onClick={save}
        className={`w-full py-3 rounded-xl font-medium transition-colors
          ${saved ? 'bg-green-700 text-green-200' : 'bg-blue-600 hover:bg-blue-500'}`}
      >
        {saved ? '✓ 저장됨' : '저장하기'}
      </button>
    </div>
  )
}
