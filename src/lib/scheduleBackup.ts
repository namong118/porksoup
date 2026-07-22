import { supabase } from './supabase'

const BACKUP_KEY = 'raid_schedule_backup'

interface RaidSnapshot {
  id: string
  day_of_week: string | null
  time: string | null
  sort_order: number | null
}

interface BackupPayload {
  weekStart: string
  savedAt: string
  raids: RaidSnapshot[]
}

export async function saveScheduleBackup(weekStart: string): Promise<void> {
  const { data: raids } = await supabase
    .from('raids')
    .select('id, day_of_week, time, sort_order')
    .eq('is_draft', false)

  const payload: BackupPayload = {
    weekStart,
    savedAt: new Date().toISOString(),
    raids: raids ?? [],
  }

  await supabase
    .from('settings')
    .upsert({ key: BACKUP_KEY, value: JSON.stringify(payload) }, { onConflict: 'key' })
}

export async function getScheduleBackupInfo(): Promise<{ weekStart: string; savedAt: string } | null> {
  const { data } = await supabase.from('settings').select('value').eq('key', BACKUP_KEY).single()
  if (!data?.value) return null
  try {
    const payload: BackupPayload = JSON.parse(data.value)
    return { weekStart: payload.weekStart, savedAt: payload.savedAt }
  } catch {
    return null
  }
}

export async function restoreScheduleBackup(): Promise<boolean> {
  const { data } = await supabase.from('settings').select('value').eq('key', BACKUP_KEY).single()
  if (!data?.value) return false

  let payload: BackupPayload
  try {
    payload = JSON.parse(data.value)
  } catch {
    return false
  }

  await Promise.all(
    payload.raids.map(r =>
      supabase
        .from('raids')
        .update({ day_of_week: r.day_of_week, time: r.time, sort_order: r.sort_order })
        .eq('id', r.id)
    )
  )
  return true
}
