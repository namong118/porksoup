import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, DayOfWeek } from '../types'
import { getWeekStart, WEEK_DAYS } from '../lib/weekUtils'

interface Props {
  member: Member
}

export default function WeeklySchedule({ member }: Props) {
  const weekStart = getWeekStart()
  const [availableDays, setAvailableDays] = useState<DayOfWeek[]>([])
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
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [member.id, weekStart])

  function toggleDay(day: DayOfWeek) {
    setSaved(false)
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function save() {
    const { error } = await supabase
      .from('weekly_schedules')
      .upsert({
        member_id: member.id,
        week_start: weekStart,
        available_days: availableDays,
        note: note || null,
      }, { onConflict: 'member_id,week_start' })

    if (!error) setSaved(true)
  }

  const weekStartDate = new Date(weekStart)
  const weekEndDate = new Date(weekStart)
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

      <p className="text-sm text-gray-400 mb-4">레이드 가능한 요일을 선택하세요</p>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {WEEK_DAYS.map(day => (
          <button
            key={day}
            onClick={() => toggleDay(day)}
            className={`py-3 rounded-xl text-sm font-bold transition-colors
              ${availableDays.includes(day)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); setSaved(false) }}
        placeholder="특이사항 (예: 토 늦게 가능, 수 16시 이후만)"
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
