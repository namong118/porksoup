import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Character, Member, Role } from '../types'
import { CLASSES, GOLD_RAID_GROUPS, GOLD_RAID_MAX } from '../types'

interface ClassItem { id: string; name: string; role: Role }

interface RosterChar { name: string; server: string; class: string; itemLevel: number | null }

interface GoldGuideEntry {
  min_ilvl: number
  raid_name: string
  difficulty: string
  tradeable_gold: number
  bound_gold: number
}

interface Props {
  member: Member
}

const SUPPORT_CLASSES = new Set(CLASSES.filter(c => c.role === 'support').map(c => c.name))
const GOLD_RAID_ORDER = GOLD_RAID_GROUPS.flatMap(g => g.tiers.map(t => `${g.name} ${t}`))

export default function CharacterManager({ member }: Props) {
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [targetMember, setTargetMember] = useState<Member>(member)
  const [characters, setCharacters] = useState<Character[]>([])
  const [classList, setClassList] = useState<ClassItem[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [itemLevel, setItemLevel] = useState<number | null>(null)
const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // 원정대 가져오기 상태
  const [showRoster, setShowRoster] = useState(false)
  const [rosterName, setRosterName] = useState('')
  const [rosterList, setRosterList] = useState<RosterChar[]>([])
  const [rosterSelected, setRosterSelected] = useState<Set<string>>(new Set())
  const [rosterFetching, setRosterFetching] = useState(false)
  const [rosterError, setRosterError] = useState('')
  const [importing, setImporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string>('')

  // 골드 받을 레이드 선택 상태
  const [goldRaidMap, setGoldRaidMap] = useState<Record<string, Set<string>>>({})
  const [goldPanelChar, setGoldPanelChar] = useState<Character | null>(null)
  const [goldPanelVisible, setGoldPanelVisible] = useState(false)
  const [goldGuide, setGoldGuide] = useState<GoldGuideEntry[]>([])

  useEffect(() => {
    supabase.from('members').select('*').order('nickname').then(({ data }) => {
      if (data) setAllMembers(data)
    })
    supabase.from('classes').select('*').order('role').order('name').then(({ data }) => {
      if (data) {
        setClassList(data)
        if (data.length > 0) setSelectedClass(data.find(c => c.role === 'dps')?.name ?? data[0].name)
      }
    })
    supabase.from('gold_guide').select('min_ilvl, raid_name, difficulty, tradeable_gold, bound_gold').then(({ data }) => {
      if (data) setGoldGuide(data)
    })
  }, [])

  function findGoldReward(raidName: string, difficulty: string): GoldGuideEntry | null {
    const candidates = goldGuide.filter(e => e.raid_name === raidName && e.difficulty === difficulty)
    if (candidates.length === 0) return null
    return candidates.reduce((best, e) => (e.min_ilvl > best.min_ilvl ? e : best))
  }

  useEffect(() => {
    supabase
      .from('characters')
      .select('*')
      .eq('member_id', targetMember.id)
      .order('item_level', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (!data) return
        setCharacters(data)
        const ids = data.map((c: Character) => c.id)
        if (ids.length === 0) { setGoldRaidMap({}); return }
        supabase
          .from('character_gold_raids')
          .select('*')
          .in('character_id', ids)
          .then(({ data: gr }) => {
            const map: Record<string, Set<string>> = {}
            for (const row of gr ?? []) {
              if (!map[row.character_id]) map[row.character_id] = new Set()
              map[row.character_id].add(row.raid_name)
            }
            setGoldRaidMap(map)
          })
      })
    setAdding(false)
    setShowRoster(false)
    setGoldPanelChar(null)
    setGoldPanelVisible(false)
  }, [targetMember.id])

  const classRole = classList.find(c => c.name === selectedClass)?.role ?? 'dps'

  async function fetchLostArk() {
    if (!name.trim()) return
    setFetching(true)
    setFetchError('')
    setItemLevel(null)
    try {
      const res = await fetch(`/api/lostark?character=${encodeURIComponent(name.trim())}`)
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { setFetchError(`파싱오류 (${res.status}): ${text.slice(0, 100)}`); return }
      if (!res.ok) { setFetchError(data.error ?? '조회 실패'); return }
      setItemLevel(data.itemLevel)
      if (data.class && classList.some(c => c.name === data.class)) {
        setSelectedClass(data.class)
      }
    } catch (e: any) {
      setFetchError('네트워크오류: ' + (e?.message ?? String(e)))
    } finally {
      setFetching(false)
    }
  }

  async function addCharacter() {
    if (!name.trim()) return
    const role = classList.find(c => c.name === selectedClass)?.role ?? 'dps'
    const { data, error } = await supabase
      .from('characters')
      .insert({ member_id: targetMember.id, name: name.trim(), class: selectedClass, role, item_level: itemLevel })
      .select()
      .single()
    if (error) { alert('오류: ' + error.message); return }
    setCharacters(prev => [...prev, data])
    setName('')
    setItemLevel(null)
    setAdding(false)
  }

  async function deleteCharacter(id: string) {
    await supabase.from('characters').delete().eq('id', id)
    setCharacters(prev => prev.filter(c => c.id !== id))
  }

  function openGoldPanel(character: Character) {
    setGoldPanelChar(character)
    requestAnimationFrame(() => setGoldPanelVisible(true))
  }

  function closeGoldPanel() {
    setGoldPanelVisible(false)
    setGoldPanelChar(null)
  }

  async function toggleGoldRaid(character: Character, raidName: string) {
    const current = goldRaidMap[character.id] ?? new Set<string>()
    const isSelected = current.has(raidName)
    if (!isSelected && current.size >= GOLD_RAID_MAX) return
    if (isSelected) {
      await supabase.from('character_gold_raids').delete().eq('character_id', character.id).eq('raid_name', raidName)
    } else {
      await supabase.from('character_gold_raids').insert({ character_id: character.id, raid_name: raidName })
    }
    setGoldRaidMap(prev => {
      const next = new Set(prev[character.id] ?? [])
      if (isSelected) next.delete(raidName)
      else next.add(raidName)
      return { ...prev, [character.id]: next }
    })
  }

  async function fetchRoster() {
    if (!rosterName.trim()) return
    setRosterFetching(true)
    setRosterError('')
    setRosterList([])
    try {
      const res = await fetch(`/api/lostark?character=${encodeURIComponent(rosterName.trim())}&all=true`)
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { setRosterError(`파싱오류: ${text.slice(0, 100)}`); return }
      if (!res.ok) { setRosterError(data.error ?? '조회 실패'); return }
      const list: RosterChar[] = data
      setRosterList(list)
      // 전체 선택 (기존 캐릭터는 업데이트, 신규는 추가)
      setRosterSelected(new Set(list.map(c => c.name)))
    } catch (e: any) {
      setRosterError('네트워크오류: ' + (e?.message ?? String(e)))
    } finally {
      setRosterFetching(false)
    }
  }

  function toggleRosterChar(charName: string) {
    setRosterSelected(prev => {
      const next = new Set(prev)
      if (next.has(charName)) next.delete(charName)
      else next.add(charName)
      return next
    })
  }

  async function importRoster() {
    const toProcess = rosterList.filter(c => rosterSelected.has(c.name))
    if (toProcess.length === 0) return
    setImporting(true)
    for (const c of toProcess) {
      const existing = characters.find(ch => ch.name === c.name)
      if (existing) {
        // 기존 캐릭터 → 템레벨 업데이트
        const { data } = await supabase
          .from('characters')
          .update({ item_level: c.itemLevel })
          .eq('id', existing.id)
          .select()
          .single()
        if (data) setCharacters(prev => prev.map(ch => ch.id === existing.id ? { ...ch, item_level: data.item_level } : ch))
      } else {
        // 신규 캐릭터 → 추가
        const dbClass = classList.find(cl => cl.name === c.class)
        const role: Role = dbClass?.role ?? (SUPPORT_CLASSES.has(c.class) ? 'support' : 'dps')
        const { data } = await supabase
          .from('characters')
          .insert({ member_id: targetMember.id, name: c.name, class: c.class, role, item_level: c.itemLevel })
          .select()
          .single()
        if (data) setCharacters(prev => [...prev, data])
      }
    }
    setShowRoster(false)
    setRosterList([])
    setRosterSelected(new Set())
    setRosterName('')
    setImporting(false)
  }

  async function refreshItemLevels() {
    if (characters.length === 0) return
    setRefreshing(true)
    setRefreshResult('')
    try {
      const anyChar = characters[0].name
      const res = await fetch(`/api/lostark?character=${encodeURIComponent(anyChar)}&all=true`)
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { setRefreshResult('파싱 오류'); setRefreshing(false); return }
      if (!res.ok) { setRefreshResult(data.error ?? '조회 실패'); setRefreshing(false); return }

      const rosterMap = new Map<string, number | null>(data.map((c: RosterChar) => [c.name, c.itemLevel]))
      let updated = 0
      for (const char of characters) {
        if (!rosterMap.has(char.name)) continue
        const newLevel = rosterMap.get(char.name) ?? null
        if (newLevel === char.item_level) continue
        await supabase.from('characters').update({ item_level: newLevel }).eq('id', char.id)
        updated++
      }
      setCharacters(prev =>
        prev
          .map(c => rosterMap.has(c.name) ? { ...c, item_level: rosterMap.get(c.name) ?? c.item_level } : c)
          .sort((a, b) => (b.item_level ?? -1) - (a.item_level ?? -1))
      )
      setRefreshResult(`${updated}개 업데이트됨`)
    } catch (e: any) {
      setRefreshResult('네트워크 오류')
    } finally {
      setRefreshing(false)
    }
  }

  const isMyself = targetMember.id === member.id
  const existingNames = new Set(characters.map(c => c.name))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">캐릭터 관리</h2>
        <div className="flex items-center gap-2">
          {refreshResult && <span className="text-xs text-gray-400">{refreshResult}</span>}
          <button
            onClick={refreshItemLevels}
            disabled={refreshing || characters.length === 0}
            className="bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-sm px-3 py-1.5 rounded-lg transition-colors"
            title="템레벨 일괄 새로고침"
          >
            {refreshing ? '조회중...' : '🔄 새로고침'}
          </button>
          <button
            onClick={() => { setShowRoster(v => !v); setAdding(false) }}
            className="bg-indigo-700 hover:bg-indigo-600 text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            원정대 가져오기
          </button>
          <button
            onClick={() => { setAdding(true); setShowRoster(false) }}
            className="bg-blue-600 hover:bg-blue-500 text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            + 캐릭터 추가
          </button>
        </div>
      </div>

      {/* 멤버 선택 */}
      <div className="bg-gray-700 rounded-xl p-3 mb-4">
        <p className="text-xs text-gray-400 mb-2">누구의 캐릭터를 관리할까요?</p>
        <div className="flex flex-wrap gap-2">
          {allMembers.map(m => (
            <button
              key={m.id}
              onClick={() => setTargetMember(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${targetMember.id === m.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
            >
              {m.nickname}
              {m.id === member.id && <span className="ml-1 text-xs opacity-70">(나)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 멤버 표시 */}
      {!isMyself && (
        <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-xs text-yellow-400">
            <span className="font-bold">{targetMember.nickname}</span>의 캐릭터를 관리 중입니다.
          </p>
        </div>
      )}

      {/* 원정대 가져오기 */}
      {showRoster && (
        <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-indigo-300">원정대 전체 가져오기</p>
          <p className="text-xs text-gray-400">원정대 캐릭터 중 아무 캐릭터 이름이나 입력하면 원정대 전체를 불러옵니다.</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={rosterName}
              onChange={e => setRosterName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchRoster()}
              placeholder="캐릭터 닉네임 입력"
              className="flex-1 bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500"
            />
            <button
              onClick={fetchRoster}
              disabled={!rosterName.trim() || rosterFetching}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
            >
              {rosterFetching ? '조회중...' : '조회'}
            </button>
          </div>
          {rosterError && <div className="text-xs text-red-400">⚠️ {rosterError}</div>}

          {rosterList.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">총 {rosterList.length}개 — {rosterSelected.size}개 선택</span>
                <div className="flex gap-2">
                  <button onClick={() => setRosterSelected(new Set(rosterList.map(c => c.name)))} className="text-xs text-indigo-400 hover:text-indigo-300">전체 선택</button>
                  <button onClick={() => setRosterSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-400">전체 해제</button>
                </div>
              </div>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto rounded-lg bg-gray-800 p-2">
                {rosterList
                  .slice()
                  .sort((a, b) => (b.itemLevel ?? 0) - (a.itemLevel ?? 0))
                  .map(c => {
                    const alreadyExists = existingNames.has(c.name)
                    const isSupport = SUPPORT_CLASSES.has(c.class)
                    return (
                      <label
                        key={c.name}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                          ${rosterSelected.has(c.name) ? 'bg-indigo-900/40' : 'hover:bg-gray-700'}`}
                      >
                        <input
                          type="checkbox"
                          checked={rosterSelected.has(c.name)}
                          onChange={() => toggleRosterChar(c.name)}
                          className="accent-indigo-400"
                        />
                        <span className="text-sm font-medium flex-1 truncate">{c.name}</span>
                        <span className={`text-xs ${isSupport ? 'text-green-400' : 'text-orange-400'}`}>{c.class}</span>
                        {c.itemLevel && <span className="text-xs text-yellow-400 shrink-0">{Math.floor(c.itemLevel).toLocaleString()}</span>}
                        {alreadyExists
                          ? <span className="text-xs text-blue-400 shrink-0">업데이트</span>
                          : <span className="text-xs text-emerald-500 shrink-0">신규</span>}
                      </label>
                    )
                  })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={importRoster}
                  disabled={rosterSelected.size === 0 || importing}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {importing ? '추가 중...' : `${rosterSelected.size}개 추가`}
                </button>
                <button onClick={() => setShowRoster(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 단건 추가 폼 */}
      {adding && (
        <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setItemLevel(null); setFetchError('') }}
              onKeyDown={e => e.key === 'Enter' && fetchLostArk()}
              placeholder={`${targetMember.nickname}의 캐릭터 닉네임`}
              className="flex-1 bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
            />
            <button
              onClick={fetchLostArk}
              disabled={!name.trim() || fetching}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
            >
              {fetching ? '조회중...' : '🔍 조회'}
            </button>
          </div>
          {itemLevel !== null && (
            <div className="text-xs text-yellow-400">
              ✅ 템레벨 {Math.floor(itemLevel).toLocaleString()}
              {' '}— 직업이 자동으로 선택됐어요
            </div>
          )}
          {fetchError && <div className="text-xs text-red-400">⚠️ {fetchError}</div>}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
          >
            <optgroup label="서포터">
              {classList.filter(c => c.role === 'support').map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="딜러">
              {classList.filter(c => c.role === 'dps').map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
          </select>
          <div className="text-xs text-gray-400">
            역할: <span className={classRole === 'support' ? 'text-green-400' : 'text-orange-400'}>
              {classRole === 'support' ? '서포터' : '딜러'}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={addCharacter} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium">추가</button>
            <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">등록된 캐릭터가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {characters.map(c => {
            const goldSet = goldRaidMap[c.id]
            const goldCount = goldSet?.size ?? 0
            const goldNames = goldSet
              ? [...goldSet].sort((a, b) => GOLD_RAID_ORDER.indexOf(a) - GOLD_RAID_ORDER.indexOf(b))
              : []
            return (
              <div
                key={c.id}
                onClick={() => openGoldPanel(c)}
                className="bg-gray-700 hover:bg-gray-600 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-gray-400 ml-2">{c.class}</span>
                  {c.item_level && (
                    <span className="text-xs ml-2 opacity-80" style={{ color: targetMember.color }}>{Math.floor(Number(c.item_level)).toLocaleString()}</span>
                  )}
                  <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${c.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                    {c.role === 'support' ? '서포터' : '딜러'}
                  </span>
                  <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400">
                    💰 {goldCount}/{GOLD_RAID_MAX}
                  </span>
                  {goldNames.length > 0 && (
                    <span className="text-xs text-yellow-500/70 ml-2">
                      {goldNames.join(' · ')}
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteCharacter(c.id) }}
                  className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                >
                  삭제
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 골드 받을 레이드 선택 패널 (오른쪽 슬라이드) */}
      {goldPanelChar && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={closeGoldPanel}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`bg-gray-800 w-full max-w-xs h-full flex flex-col shadow-2xl transform transition-transform duration-200 ${goldPanelVisible ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div>
                <p className="font-bold">{goldPanelChar.name}</p>
                <p className="text-xs text-gray-400">
                  골드 받을 레이드 선택 ({goldRaidMap[goldPanelChar.id]?.size ?? 0}/{GOLD_RAID_MAX})
                </p>
              </div>
              <button onClick={closeGoldPanel} className="text-gray-400 hover:text-white text-xl leading-none px-1">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {GOLD_RAID_GROUPS.map(group => (
                <div key={group.name}>
                  <p className="text-sm font-medium text-gray-300 mb-1.5">{group.name}</p>
                  <div className="flex flex-col gap-1">
                    {group.tiers.map(tier => {
                      const raidName = `${group.name} ${tier}`
                      const selected = goldRaidMap[goldPanelChar.id]?.has(raidName) ?? false
                      const disabled = !selected && (goldRaidMap[goldPanelChar.id]?.size ?? 0) >= GOLD_RAID_MAX
                      const reward = findGoldReward(group.name, tier)
                      return (
                        <label
                          key={raidName}
                          className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-lg transition-colors
                            ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700'}
                            ${selected ? 'bg-yellow-900/30' : ''}`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => toggleGoldRaid(goldPanelChar, raidName)}
                              className="accent-yellow-400"
                            />
                            <span className="text-sm">{tier}</span>
                          </span>
                          <span className="text-xs text-gray-400 ml-6">
                            {reward ? (
                              [
                                reward.tradeable_gold > 0 ? `유통 ${reward.tradeable_gold.toLocaleString()}` : null,
                                reward.bound_gold > 0 ? `귀속 ${reward.bound_gold.toLocaleString()}` : null,
                              ].filter(Boolean).join(' · ')
                            ) : (
                              <span className="text-gray-600">골드 정보 없음</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
