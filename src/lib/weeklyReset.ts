import { supabase } from './supabase'
import { getWeekStart } from './weekUtils'
import { saveScheduleBackup } from './scheduleBackup'

export async function runWeeklyResetIfNeeded() {
  const weekStart = getWeekStart()

  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'last_weekly_reset')
    .single()

  if (setting?.value === weekStart) return

  await saveScheduleBackup(setting?.value ?? weekStart)

  const { data: raids } = await supabase
    .from('raids')
    .select('id, day_of_week, next_day_of_week')
    .eq('is_draft', false)

  if (raids && raids.length > 0) {
    await Promise.all(
      raids.map((raid: { id: string; day_of_week: string | null; next_day_of_week: string | null }) =>
        supabase.from('raids').update({
          day_of_week: raid.next_day_of_week ?? raid.day_of_week ?? null,
          next_day_of_week: null,
          completed: false,
        }).eq('id', raid.id)
      )
    )
  }

  await supabase
    .from('settings')
    .upsert({ key: 'last_weekly_reset', value: weekStart }, { onConflict: 'key' })
}
