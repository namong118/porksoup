import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Member, DayOfWeek } from '../types'
import { getWeekStart, WEEK_DAYS, parseLocalDate } from '../lib/weekUtils'

interface Props {
  member: Member
}

const HOURS = Array.from({ length: 15 }, (_, i) => String(i + 10)) // '10'~'24'

function cellKey(day: DayOfWeek, hour: string) { return `${day}-${hour}` }

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
            const dayHours: string[] = times[day] ?? []
            dayHours.forEach(h => init.add(cellKey(day, h)))
          })
          setSelected(init)
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [member.id, weekStart])

  useEffect(() => {
    const stop = () => setDragging(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  function handleMouseDown(day: DayOfWeek, hour: string) {
    const key = cellKey(day, hour)
    const action = selected.has(key) ? 'deselect' : 'select'
    setDragging(true)
    setDragAction(action)
    applyCell(key, action)
  }

  function handleMouseEnter(day: DayOfWeek, hour: string) {
    if (!dragging) return
    applyCell(cellKey(day, hour), dragAction)
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
      const dayHours = HOURS.filter(h => selected.has(cellKey(day, h)))
      if (dayHours.length > 0) {
        availableDays.push(day)
        availableTimes[day] = dayHours
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

  const selectedDays = WEEK_DAYS.filter(day => HOURS.some(h => selected.has(cellKey(day, h))))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">이번 주 스케줄</h2>
        <span className="text-sm text-gray-400">
          {formatDate(weekStartDate)} ~ {formatDate(weekEndDate)}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-3">드래그해서 가능한 요일·시간을 선택하세요</p>

      {/* 드래그 그리드 */}
      <div className="rounded-xl overflow-hidden border border-gray-600 mb-4 select-none overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '480px' }}>
          <thead>
            <tr className="bg-gray-700">
              <th className="py-2 px-2 text-xs text-gray-500 font-normal border-b border-gray-600 w-8"></th>
              {HOURS.map(h => (
                <th key={h} className="py-2 text-xs text-gray-400 font-medium border-b border-l border-gray-600 text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEK_DAYS.map((day, i) => {
              const isAnySelected = HOURS.some(h => selected.has(cellKey(day, h)))
              return (
                <tr key={day} className={i < WEEK_DAYS.length - 1 ? 'border-b border-gray-600' : ''}>
                  <td className={`py-2 px-2 text-center text-xs font-bold transition-colors
                    ${isAnySelected ? 'text-white bg-gray-700' : 'text-gray-600 bg-gray-800'}`}>
                    {day}
                  </td>
                  {HOURS.map(hour => {
                    const isOn = selected.has(cellKey(day, hour))
                    return (
                      <td
                        key={hour}
                        onMouseDown={() => handleMouseDown(day, hour)}
                        onMouseEnter={() => handleMouseEnter(day, hour)}
                        className={`border-l border-gray-600 cursor-pointer transition-colors text-center
                          ${isOn ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                        style={{ width: '28px', height: '36px' }}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 선택 요약 */}
      {selectedDays.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-4">
          {selectedDays.map(day => {
            const hours = HOURS.filter(h => selected.has(cellKey(day, h)))
            const first = hours[0], last = hours[hours.length - 1]
            return (
              <span key={day} className="text-xs bg-blue-900 text-blue-200 px-3 py-1.5 rounded-lg">
                {day}요일 · {first}시 ~ {last}시
              </span>
            )
          })}
        </div>
      )}

      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); setSaved(false) }}
        placeholder="특이사항"
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
