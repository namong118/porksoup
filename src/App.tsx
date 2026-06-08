import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import MemberSelect from './components/MemberSelect'
import CharacterManager from './components/CharacterManager'
import WeeklySchedule from './components/WeeklySchedule'
import RaidManager from './components/RaidManager'
import ScheduleResult from './components/ScheduleResult'
import ClassManager from './components/ClassManager'
import AllSchedules from './components/AllSchedules'
import RaidOverview from './components/RaidOverview'
import WeeklyView from './components/WeeklyView'
import FunTools from './components/FunTools'
import LoaLinks from './components/LoaLinks'
import GoldGuide from './components/GoldGuide'
import BusLounge from './components/BusLounge'
import { usePresence } from './lib/usePresence'
import type { Member } from './types'

const COLOR_EMOJI: Record<string, string> = {
  '#94a3b8': '🌫️',
  '#ef4444': '🍎',
  '#f87171': '🍑',
  '#fca5a5': '🍑',
  '#fb923c': '🦊',
  '#fbbf24': '🐣',
  '#84cc16': '🌿',
  '#22c55e': '🌲',
  '#06b6d4': '🌊',
  '#60a5fa': '💧',
  '#7dd3fc': '💧',
  '#3b82f6': '🌌',
  '#8b5cf6': '☂️',
  '#ec4899': '🌺',
  '#f43f5e': '🍎',
}

type Tab = 'schedule' | 'characters' | 'raids' | 'raidoverview' | 'allschedules' | 'result' | 'weeklyview' | 'settings' | 'draft' | 'fun' | 'loalinks' | 'goldguide' | 'buslounge'

const READ_TABS: { id: Tab; label: string }[] = [
  { id: 'weeklyview', label: '📅 이번 주 일정' },
  { id: 'allschedules', label: '👥 전체 스케줄' },
  { id: 'raidoverview', label: '📋 레이드 현황' },
  { id: 'goldguide', label: '💰 골드 가이드' },
  { id: 'loalinks', label: '🔗 각종 사이트' },
]

const EDIT_TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: '📅 내 스케줄' },
  { id: 'result', label: '🗓️ 일정 관리' },
  { id: 'raids', label: '🛡️ 레이드 관리' },
  { id: 'draft', label: '📝 낙서장' },
  { id: 'characters', label: '⚔️ 내 캐릭터' },
  { id: 'fun', label: '🎮 게임' },
  { id: 'buslounge', label: '🚌 버스 라운지' },
]

export default function App() {
  const [member, setMember] = useState<Member | null>(null)
  const onlineMembers = usePresence(member)
  const [tab, setTab] = useState<Tab>('weeklyview')
  const [headerMsg, setHeaderMsg] = useState('열심히 일하고 회식합시다!')
  const [editingMsg, setEditingMsg] = useState(false)
  const [msgDraft, setMsgDraft] = useState('')

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'header_message').single()
      .then(({ data }) => { if (data?.value) setHeaderMsg(data.value) })
  }, [])

  async function saveMsg() {
    const trimmed = msgDraft.trim()
    if (!trimmed) { setEditingMsg(false); return }
    await supabase.from('settings').upsert({ key: 'header_message', value: trimmed }, { onConflict: 'key' })
    setHeaderMsg(trimmed)
    setEditingMsg(false)
  }

  if (!member) {
    return <MemberSelect currentMember={member} onSelect={setMember} />
  }

  return (
    <div className="min-h-screen">
      <header
        className="border-b px-4 py-3 grid grid-cols-3 items-center"
        style={{
          background: `linear-gradient(to right, #1f2937, ${member.color ?? '#94a3b8'}22)`,
          borderBottomColor: `${member.color ?? '#94a3b8'}55`,
        }}
      >
        <div className="flex items-center gap-1 pl-1">
          {onlineMembers.map(m => (
            <div
              key={m.id}
              title={m.nickname}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                backgroundColor: `${m.color}30`,
                color: m.color,
                border: `1.5px solid ${m.color}80`,
                boxShadow: m.id === member?.id ? `0 0 0 2px ${m.color}50` : undefined,
              }}
            >
              {m.nickname[0]}
            </div>
          ))}
          {onlineMembers.length > 0 && (
            <span className="text-xs text-gray-600 ml-0.5">{onlineMembers.length}</span>
          )}
        </div>
        <div className="flex flex-col items-center">
          <h1 className="font-bold text-lg">🐷 돼지국밥 레이드</h1>
          {editingMsg ? (
            <div className="flex items-center gap-1 mt-0.5">
              <input
                autoFocus
                value={msgDraft}
                onChange={e => setMsgDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveMsg(); if (e.key === 'Escape') setEditingMsg(false) }}
                className="bg-gray-700 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 ring-blue-500 w-48"
              />
              <button onClick={saveMsg} className="text-blue-400 text-xs hover:text-blue-300">저장</button>
              <button onClick={() => setEditingMsg(false)} className="text-gray-600 text-xs hover:text-gray-400">취소</button>
            </div>
          ) : (
            <p
              onClick={() => { setMsgDraft(headerMsg); setEditingMsg(true) }}
              className="text-xs text-gray-500 hover:text-gray-400 cursor-pointer mt-0.5"
              title="클릭해서 수정"
            >{headerMsg}</p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setMember(null)}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span>{COLOR_EMOJI[member.color ?? '#94a3b8'] ?? '🌫️'}</span>
            <span style={{ color: member.color ?? '#94a3b8' }} className="font-medium">{member.nickname}</span>
            <span className="text-gray-400">▼</span>
          </button>
        </div>
      </header>

      <nav
        className="bg-gray-800 border-b overflow-x-auto flex justify-center"
        style={{ borderBottomColor: `${member.color ?? '#94a3b8'}40` }}
      >
        <div className="flex items-stretch min-w-max mx-auto">
          {/* 읽기 전용 그룹 */}
          <div className="flex items-stretch px-2">
            <span className="flex items-center text-xs text-gray-600 pr-2 whitespace-nowrap">보기</span>
            {READ_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`py-3 px-3 text-sm whitespace-nowrap border-b-2 transition-colors
                  ${tab === t.id ? '' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                style={tab === t.id ? { borderBottomColor: member.color ?? '#94a3b8', color: member.color ?? '#94a3b8' } : {}}
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
              <div key={t.id} className="flex items-stretch">
                {t.id === 'fun' && <div className="w-px bg-gray-600 my-2 mx-1" />}
                <button
                  onClick={() => setTab(t.id)}
                  className={`py-3 px-3 text-sm whitespace-nowrap border-b-2 transition-colors
                    ${tab === t.id ? '' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                  style={tab === t.id ? { borderBottomColor: member.color ?? '#94a3b8', color: member.color ?? '#94a3b8' } : {}}
                >
                  {t.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main className={`mx-auto p-4 ${tab === 'raidoverview' ? 'max-w-full' : tab === 'weeklyview' || tab === 'allschedules' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {tab === 'weeklyview' && <WeeklyView member={member} />}
        {tab === 'allschedules' && <AllSchedules />}
        {tab === 'raidoverview' && <RaidOverview />}
        {tab === 'schedule' && <WeeklySchedule member={member} />}
        {tab === 'result' && <ScheduleResult />}
        {tab === 'raids' && <RaidManager />}
        {tab === 'draft' && <RaidManager isDraft={true} />}
        {tab === 'settings' && <ClassManager />}
        {tab === 'characters' && <CharacterManager member={member} />}
        {tab === 'fun' && <FunTools />}
        {tab === 'goldguide' && <GoldGuide />}
        {tab === 'loalinks' && <LoaLinks />}
        {tab === 'buslounge' && <BusLounge />}
      </main>
    </div>
  )
}
