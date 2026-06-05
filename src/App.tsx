import { useState } from 'react'
import MemberSelect from './components/MemberSelect'
import CharacterManager from './components/CharacterManager'
import WeeklySchedule from './components/WeeklySchedule'
import RaidManager from './components/RaidManager'
import ScheduleResult from './components/ScheduleResult'
import ClassManager from './components/ClassManager'
import AllSchedules from './components/AllSchedules'
import type { Member } from './types'

type Tab = 'schedule' | 'characters' | 'raids' | 'allschedules' | 'result' | 'settings'

export default function App() {
  const [member, setMember] = useState<Member | null>(null)
  const [tab, setTab] = useState<Tab>('schedule')

  if (!member) {
    return <MemberSelect currentMember={member} onSelect={setMember} />
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'schedule', label: '📅 내 스케줄' },
    { id: 'characters', label: '⚔️ 내 캐릭터' },
    { id: 'raids', label: '🛡️ 레이드' },
    { id: 'allschedules', label: '👥 전체 스케줄' },
    { id: 'result', label: '📊 이번 주 편성' },
    { id: 'settings', label: '⚙️ 설정' },
  ]

  return (
    <div className="min-h-screen">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">🐷 돼지국밥 레이드</h1>
        <button
          onClick={() => setMember(null)}
          className="text-sm text-gray-400 hover:text-gray-200 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
        >
          {member.nickname} ▼
        </button>
      </header>

      <nav className="bg-gray-800 border-b border-gray-700 px-4 flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-3 px-3 text-sm whitespace-nowrap border-b-2 transition-colors
              ${tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-2xl mx-auto p-4">
        {tab === 'schedule' && <WeeklySchedule member={member} />}
        {tab === 'characters' && <CharacterManager member={member} />}
        {tab === 'raids' && <RaidManager />}
        {tab === 'allschedules' && <AllSchedules />}
        {tab === 'result' && <ScheduleResult />}
        {tab === 'settings' && <ClassManager />}
      </main>
    </div>
  )
}
