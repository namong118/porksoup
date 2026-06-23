import { useState, useEffect, useRef } from 'react'
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
import BannerGallery from './components/BannerGallery'
import MyRaids from './components/MyRaids'
import { usePresence } from './lib/usePresence'
import { runWeeklyResetIfNeeded } from './lib/weeklyReset'
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
  '#ec4899': '💗',
  '#f43f5e': '🍎',
}

type Tab = 'schedule' | 'characters' | 'raids' | 'raidoverview' | 'allschedules' | 'result' | 'weeklyview' | 'myraids' | 'settings' | 'draft' | 'fun' | 'loalinks' | 'goldguide' | 'bannerview'

const READ_TABS: { id: Tab; label: string }[] = [
  { id: 'weeklyview', label: '📅 이번 주 일정' },
  { id: 'myraids', label: '⚔️ 내 레이드' },
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
]

const EXTRA_TABS: { id: Tab; label: string }[] = [
  { id: 'bannerview', label: '🖼️ 배너 모아보기' },
  { id: 'fun', label: '🎮 게임' },
]

export default function App() {
  const [member, setMember] = useState<Member | null>(null)
  const onlineMembers = usePresence(member)
  const [tab, setTab] = useState<Tab>('weeklyview')
  const [headerMsg, setHeaderMsg] = useState('열심히 일하고 회식합시다!')
  const [editingMsg, setEditingMsg] = useState(false)
  const [msgDraft, setMsgDraft] = useState('')
  const [bannerImages, setBannerImages] = useState<(string | null)[]>([null, null, null])
  const [bannerUploading, setBannerUploading] = useState([false, false, false])
  const [expandedBanner, setExpandedBanner] = useState<string | null>(null)
  const [bannerVisible, setBannerVisible] = useState(true)
  const bannerInputRef0 = useRef<HTMLInputElement>(null)
  const bannerInputRef1 = useRef<HTMLInputElement>(null)
  const bannerInputRef2 = useRef<HTMLInputElement>(null)
  const bannerInputRefs = [bannerInputRef0, bannerInputRef1, bannerInputRef2]

  useEffect(() => {
    runWeeklyResetIfNeeded()
    supabase.from('settings').select('value').eq('key', 'header_message').single()
      .then(({ data }) => { if (data?.value) setHeaderMsg(data.value) })
    Promise.all(
      [1, 2, 3].map(i =>
        supabase.from('settings').select('value').eq('key', `banner_image_${i}`).single()
          .then(({ data }) => data?.value || null)
      )
    ).then(images => setBannerImages(images))
  }, [])

  function extractBannerFilename(url: string): string | null {
    const parts = url.split('/banners/')
    return parts[1] ?? null
  }

  async function uploadBanner(file: File, index: number) {
    setBannerUploading(prev => { const n = [...prev]; n[index] = true; return n })
    const oldUrl = bannerImages[index]
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `banner_${index + 1}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('banners').upload(filename, file)
    if (error) {
      alert(`업로드 실패: ${error.message}`)
      setBannerUploading(prev => { const n = [...prev]; n[index] = false; return n })
      return
    }
    if (data) {
      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(data.path)
      const url = urlData.publicUrl
      const { error: upsertError } = await supabase.from('settings').upsert({ key: `banner_image_${index + 1}`, value: url }, { onConflict: 'key' })
      if (upsertError) {
        alert(`저장 실패: ${upsertError.message}`)
      } else {
        if (oldUrl) {
          const oldFilename = extractBannerFilename(oldUrl)
          if (oldFilename) await supabase.storage.from('banners').remove([oldFilename])
        }
        setBannerImages(prev => { const n = [...prev]; n[index] = url; return n })
      }
    }
    setBannerUploading(prev => { const n = [...prev]; n[index] = false; return n })
  }

  async function deleteBanner(index: number, e: React.MouseEvent) {
    e.stopPropagation()
    const oldUrl = bannerImages[index]
    if (oldUrl) {
      const oldFilename = extractBannerFilename(oldUrl)
      if (oldFilename) await supabase.storage.from('banners').remove([oldFilename])
    }
    await supabase.from('settings').upsert({ key: `banner_image_${index + 1}`, value: '' }, { onConflict: 'key' })
    setBannerImages(prev => { const n = [...prev]; n[index] = null; return n })
  }

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
        className="border-b px-3 sm:px-4 py-2 sm:py-3 grid grid-cols-3 items-center"
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
          <h1 className="font-bold text-sm sm:text-lg">🐷 돼지국밥 레이드</h1>
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
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={() => setBannerVisible(v => !v)}
            className="hidden sm:flex items-center text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition-colors text-gray-300"
          >
            {bannerVisible ? '배너 가리기' : '배너 보이기'}
          </button>
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

      {/* 배너 이미지 3분할 - 데스크톱만 */}
      <div className={`${bannerVisible ? 'sm:flex' : ''} hidden border-b border-gray-700 bg-gray-900`}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="relative group flex-1 overflow-hidden"
            style={{ maxHeight: '120px', borderLeft: i > 0 ? '1px solid #374151' : undefined, cursor: bannerImages[i] ? 'zoom-in' : 'pointer' }}
            onClick={() => bannerImages[i] ? setExpandedBanner(bannerImages[i]) : bannerInputRefs[i].current?.click()}
          >
            {bannerImages[i]
              ? <img src={bannerImages[i]!} alt={`banner${i + 1}`} className="w-full object-cover" style={{ maxHeight: '120px' }} />
              : <div className="flex items-center justify-center h-16 text-xs text-gray-700">{i + 1}</div>
            }
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); bannerInputRefs[i].current?.click() }}
                className="text-white text-xs bg-black/70 px-2 py-1 rounded-md hover:bg-black/90"
              >
                {bannerUploading[i] ? '...' : '🖼️ 변경'}
              </button>
              {bannerImages[i] && (
                <button
                  onClick={e => deleteBanner(i, e)}
                  className="text-red-400 text-xs bg-black/70 px-2 py-1 rounded-md hover:text-red-300"
                >
                  🗑️ 삭제
                </button>
              )}
            </div>
            <input
              ref={bannerInputRefs[i]}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) uploadBanner(e.target.files[0], i) }}
            />
          </div>
        ))}
      </div>

      <nav
        className="bg-gray-800 border-b"
        style={{ borderBottomColor: `${member.color ?? '#94a3b8'}40` }}
      >
        {/* 모바일: 2줄 */}
        <div className="sm:hidden flex flex-col">
          <div
            className="flex overflow-x-auto border-b border-gray-700"
            style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x', overflowY: 'hidden' }}
          >
            <div className="flex items-stretch px-2 min-w-max">
              <span className="flex items-center text-xs text-gray-600 pr-1.5 whitespace-nowrap shrink-0">보기</span>
              {READ_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-2.5 px-2 text-xs whitespace-nowrap border-b-2 transition-colors shrink-0
                    ${tab === t.id ? '' : 'border-transparent text-gray-400'}`}
                  style={tab === t.id ? { borderBottomColor: member.color ?? '#94a3b8', color: member.color ?? '#94a3b8' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="flex overflow-x-auto"
            style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x', overflowY: 'hidden' }}
          >
            <div className="flex items-stretch px-2 min-w-max">
              <span className="flex items-center text-xs text-gray-600 pr-1.5 whitespace-nowrap shrink-0">관리</span>
              {EDIT_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-2.5 px-2 text-xs whitespace-nowrap border-b-2 transition-colors shrink-0
                    ${tab === t.id ? '' : 'border-transparent text-gray-400'}`}
                  style={tab === t.id ? { borderBottomColor: member.color ?? '#94a3b8', color: member.color ?? '#94a3b8' } : {}}
                >
                  {t.label}
                </button>
              ))}
              <div className="w-px bg-gray-600 my-2 mx-1 shrink-0" />
              {EXTRA_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-2.5 px-2 text-xs whitespace-nowrap border-b-2 transition-colors shrink-0
                    ${tab === t.id ? '' : 'border-transparent text-gray-400'}`}
                  style={tab === t.id ? { borderBottomColor: member.color ?? '#94a3b8', color: member.color ?? '#94a3b8' } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 데스크톱: 기존 한 줄 */}
        <div className="hidden sm:flex overflow-x-auto justify-center">
          <div className="flex items-stretch min-w-max mx-auto">
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
            <div className="w-px bg-gray-600 my-2" />
            <div className="flex items-stretch px-2">
              <span className="flex items-center text-xs text-gray-600 pr-2 whitespace-nowrap">관리</span>
              {EDIT_TABS.map(t => (
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
            <div className="w-px bg-gray-600 my-2" />
            <div className="flex items-stretch px-2">
              {EXTRA_TABS.map(t => (
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
          </div>
        </div>
      </nav>

      <main className={`mx-auto p-3 sm:p-4 ${tab === 'raidoverview' || tab === 'raids' || tab === 'draft' || tab === 'result' ? 'max-w-full' : tab === 'weeklyview' || tab === 'allschedules' || tab === 'myraids' ? 'max-w-3xl' : tab === 'bannerview' ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {tab === 'weeklyview' && <WeeklyView member={member} />}
        {tab === 'myraids' && <MyRaids member={member} />}
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
        {tab === 'bannerview' && <BannerGallery />}
      </main>

      {expandedBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 cursor-zoom-out"
          onClick={() => setExpandedBanner(null)}
        >
          <img
            src={expandedBanner}
            alt="banner expanded"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}
