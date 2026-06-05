import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, DayOfWeek } from '../types'
import { getWeekStart, WEEK_DAYS, parseLocalDate } from '../lib/weekUtils'

interface Props {
  member: Member
}

// 시간대: '16' = 16시대(~18시), '20' = 20시대(18시~)
type TimeSlot = '16' | '20'
const TIME_SLOTS: { id: TimeSlot; label: string }[] = [
  { id: '16', label: '16시대' },
  { id: '20', label: '20시대' },
]

export default function WeeklySchedule({ member }: Props) {
  const weekStart = getWeekStart()
  const [availableDays, setAvailableDays] = useState<DayOfWeek[]>([])
  // 요일별 가능 시간대: { '토': ['16', '20'], '수': ['16'] }
  const [availableTimes, setAvailableTimes] = useState<Record<string, TimeSlot[]>>({})
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('weekly_schedules')
      .select('*')
      .eq('member_id', member.id)
      .eq('week_start', weekStart)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvailableDays(data.available_days ?? [])
          setAvailableTimes(data.available_times ?? {})
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [member.id, weekStart])

  function toggleDay(day: DayOfWeek) {
    setSaved(false)
    if (availableDays.includes(day)) {
      setAvailableDays(prev => prev.filter(d => d !== day))
      setAvailableTimes(prev => { const n = { ...prev }; delete n[day]; return n })
    } else {
      setAvailableDays(prev => [...prev, day])
      // 기본: 두 시간대 모두 가능
      setAvailableTimes(prev => ({ ...prev, [day]: ['16', '20'] }))
    }
  }

  function toggleTime(day: DayOfWeek, slot: TimeSlot) {
    setSaved(false)
    setAvailableTimes(prev => {
      const current = prev[day] ?? ['16', '20']
      const updated = current.includes(slot)
        ? current.filter(s => s !== slot)
        : [...current, slot]
      return { ...prev, [day]: updated as TimeSlot[] }
    })
  }

  async function save() {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">이번 주 스케줄</h2>
        <span className="text-sm text-gray-400">
          {formatDate(weekStartDate)} ~ {formatDate(weekEndDate)}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-3">가능한 요일과 시간대를 선택하세요</p>

      <div className="flex flex-col gap-2 mb-4">
        {WEEK_DAYS.map(day => {
          const isSelected = availableDays.includes(day)
          const times = availableTimes[day] ?? ['16', '20']
          return (
            <div key={day} className={`rounded-xl overflow-hidden transition-all ${isSelected ? 'bg-gray-700' : 'bg-gray-800'}`}>
              {/* 요일 버튼 */}
              <button
                onClick={() => toggleDay(day)}
                className={`w-full px-4 py-3 flex items-center justify-between transition-colors
                  ${isSelected ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <span className="font-bold">{day}요일</span>
                {isSelected && (
                  <span className="text-xs text-blue-400">
                    {TIME_SLOTS.filter(s => times.includes(s.id)).map(s => s.label).join(' · ') || '시간 미선택'}
                  </span>
                )}
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                  ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                  {isSelected && <span className="text-white text-xs">✓</span>}
                </span>
              </button>

              {/* 시간대 선택 (요일 선택 시 표시) */}
              {isSelected && (
                <div className="px-4 pb-3 flex gap-2">
                  {TIME_SLOTS.map(slot => {
                    const active = times.includes(slot.id)
                    return (
                      <button
                        key={slot.id}
                        onClick={() => toggleTime(day, slot.id)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                          ${active ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-400 hover:bg-gray-500'}`}
                      >
                        {slot.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); setSaved(false) }}
        placeholder="특이사항 (예: 토 20시대만 가능)"
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
