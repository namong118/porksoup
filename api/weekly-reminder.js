import { createClient } from '@supabase/supabase-js'

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// src/lib/weekUtils.ts의 getWeekStart()와 동일한 규칙(수요일 06:00 KST 초기화)을 서버에서 재계산
function getCurrentWeekStart() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const day = now.getDay()
  const daysFromWed = ((day - 3) + 7) % 7
  const wed = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  wed.setDate(wed.getDate() - daysFromWed)
  if (daysFromWed === 0 && now.getHours() < 6) {
    wed.setDate(wed.getDate() - 7)
  }
  return `${wed.getFullYear()}-${String(wed.getMonth() + 1).padStart(2, '0')}-${String(wed.getDate()).padStart(2, '0')}`
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!supabaseUrl || !supabaseKey || !webhookUrl) {
    return res.status(500).json({ error: '환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / DISCORD_WEBHOOK_URL)가 설정되지 않았습니다' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const nextWeekStart = addDays(getCurrentWeekStart(), 7)
  const dryRun = req.query.dryRun === '1'

  const { data: sentSetting } = await supabase
    .from('settings').select('value').eq('key', 'weekly_reminder_sent_for').single()
  if (!dryRun && sentSetting?.value === nextWeekStart) {
    return res.json({ skipped: true, reason: 'already-sent', nextWeekStart })
  }

  const [{ data: members }, { data: schedules }] = await Promise.all([
    supabase.from('members').select('id, nickname').order('nickname'),
    supabase.from('weekly_schedules').select('member_id').eq('week_start', nextWeekStart),
  ])

  const submittedIds = new Set((schedules ?? []).map(s => s.member_id))
  const missing = (members ?? []).filter(m => !submittedIds.has(m.id))

  if (missing.length === 0) {
    if (!dryRun) await supabase.from('settings').upsert({ key: 'weekly_reminder_sent_for', value: nextWeekStart }, { onConflict: 'key' })
    return res.json({ skipped: true, reason: 'everyone-submitted', nextWeekStart })
  }

  const content = [
    '⏰ **다음 주 스케줄 제출 알림**',
    '수요일 새벽 초기화 전까지 시간이 얼마 안 남았어요!',
    `아직 제출 안 한 사람: **${missing.map(m => m.nickname).join(', ')}**`,
    '돼지국밥 레이드 사이트에서 다음 주 스케줄 입력해주세요!',
  ].join('\n')

  if (dryRun) {
    return res.json({ dryRun: true, content, missing: missing.map(m => m.nickname), nextWeekStart })
  }

  const discordRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!discordRes.ok) {
    return res.status(500).json({ error: `디스코드 전송 실패: ${discordRes.status} ${await discordRes.text()}` })
  }

  await supabase.from('settings').upsert({ key: 'weekly_reminder_sent_for', value: nextWeekStart }, { onConflict: 'key' })
  return res.json({ sent: true, missing: missing.map(m => m.nickname), nextWeekStart })
}
