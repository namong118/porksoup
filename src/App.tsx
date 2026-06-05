import { useState } from 'react'
import MemberSelect from './components/MemberSelect'
import CharacterManager from './components/CharacterManager'
import WeeklySchedule from './components/WeeklySchedule'
import RaidManager from './components/RaidManager'
import ScheduleResult from './components/ScheduleResult'
import ClassManager from './components/ClassManager'
import AllSchedules from './components/AllSchedules'
import RaidOverview from './components/RaidOverview'
import WeeklyView from './components/WeeklyView'
import type { Member } from './types'

type Tab = 'schedule' | 'characters' | 'raids' | 'raidoverview' | 'allschedules' | 'result' | 'weeklyview' | 'settings'

const READ_TABS: { id: Tab; label: string }[] = [
  { id: 'weeklyview', label: '📅 이번 주 일정' },
  { id: 'allschedules', label: '👥 전체 스케줄' },
  { id: 'raidoverview', label: '📋 레이드 현황' },
]

const EDIT_TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: '📅 내 스케줄' },
  { id: 'result', label: '🗓️ 일정 관리' },
  { id: 'raids', label: '🛡️ 레이드 관리' },
  { id: 'characters', label: '⚔️ 내 캐릭터' },
]

export default function App() {
  const [member, setMember] = useState<Member | null>(null)
  const [tab, setTab] = useState<Tab>('weeklyview')

  if (!member) {
    return <MemberSelect currentMember={member} onSelect={setMember} />
  }

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

      <nav className="bg-gray-800 border-b border-gray-700 overflow-x-auto">
        <div className="flex items-stretch min-w-max">
          {/* 읽기 전용 그룹 */}
          <div className="flex items-stretch px-2">
            <span className="flex items-center text-xs text-gray-600 pr-2 whitespace-nowrap">보기</span>
            {READ_TABS.map(t => (
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
          </div>

          {/* 구분선 */}
          <div className="w-px bg-gray-600 my-2" />

          {/* 수정 가능 그룹 */}
          <div className="flex items-stretch px-2">
            <span className="flex items-center text-xs text-gray-600 pr-2 whitespace-nowrap">관리</span>
            {EDIT_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`py-3 px-3 text-sm whitespace-nowrap border-b-2 transition-colors
                  ${tab === t.id
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4">
        {tab === 'weeklyview' && <WeeklyView />}
        {tab === 'allschedules' && <AllSchedules />}
        {tab === 'raidoverview' && <RaidOverview />}
        {tab === 'schedule' && <WeeklySchedule member={member} />}
        {tab === 'result' && <ScheduleResult />}
        {tab === 'raids' && <RaidManager member={member} />}
        {tab === 'settings' && <ClassManager />}
        {tab === 'characters' && <CharacterManager member={member} />}
      </main>
    </div>
  )
}
