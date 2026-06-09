import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, RaidCharacter } from '../types'
import { RAID_COLORS } from '../types'

interface Props {
  isDraft?: boolean
}

export default function RaidManager({ isDraft = false }: Props) {
  const [raids, setRaids] = useState<Raid[]>([])
  const [allCharacters, setAllCharacters] = useState<(Character & { member: Member })[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [raidCharacters, setRaidCharacters] = useState<Record<string, string[]>>({})
  const [selectedRaidId, setSelectedRaidId] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', color: RAID_COLORS[0] })
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').eq('is_draft', isDraft).order('name'),
      supabase.from('characters').select('*, member:members(*)').order('name'),
      supabase.from('raid_characters').select('*'),
      supabase.from('members').select('*').order('nickname'),
    ]).then(([r, c, rc, m]) => {
      if (r.data) { setRaids(r.data); setSelectedRaidId(r.data[0]?.id ?? null) }
      if (c.data) setAllCharacters(c.data as (Character & { member: Member })[])
      if (m.data) { setAllMembers(m.data); setSelectedMember(m.data[0]?.id ?? null) }
      if (rc.data) {
        const map: Record<string, string[]> = {}
        rc.data.forEach((item: RaidCharacter) => {
          if (!map[item.raid_id]) map[item.raid_id] = []
          map[item.raid_id].push(item.character_id)
        })
        setRaidCharacters(map)
      }
    })
  }, [])

  async function addRaid() {
    if (!form.name.trim()) return
    const { data, error } = await supabase
      .from('raids')
      .insert({ name: form.name.trim(), size: 8, color: form.color, is_draft: isDraft })
      .select().single()
    if (error) { alert(error.message); return }
    setRaids(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedRaidId(data.id)
    setForm({ name: '', color: RAID_COLORS[0] })
    setAdding(false)
  }

  async function deleteRaid(id: string) {
    if (!confirm('레이드를 삭제할까요?')) return
    await supabase.from('raids').delete().eq('id', id)
    const next = raids.filter(r => r.id !== id)
    setRaids(next)
    if (selectedRaidId === id) setSelectedRaidId(next[0]?.id ?? null)
  }

  async function updateColor(id: string, color: string) {
    await supabase.from('raids').update({ color }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, color } : r))
  }

  async function toggleCompleted(id: string, current: boolean) {
    await supabase.from('raids').update({ completed: !current }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, completed: !current } : r))
  }

  async function toggleNew(id: string, current: boolean) {
    await supabase.from('raids').update({ is_new: !current }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, is_new: !current } : r))
  }

  async function resetAllCompleted() {
    if (!confirm('모든 레이드를 미완료 처리할까요?')) return
    await supabase.from('raids').update({ completed: false }).eq('is_draft', false)
    setRaids(prev => prev.map(r => ({ ...r, completed: false })))
  }

  async function updateDifficulty(id: string, difficulty: number) {
    await supabase.from('raids').update({ difficulty }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, difficulty } : r))
  }

  async function renameRaid2(id: string, name: string) {
    await supabase.from('raids').update({ name }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, name } : r))
  }

  async function importRaids(fromDraft: boolean) {
    const fromLabel = fromDraft ? '낙서장' : '레이드 관리'
    const toLabel = fromDraft ? '레이드 관리' : '낙서장'
    if (!confirm(`${fromLabel}의 모든 레이드를 ${toLabel}으로 가져올까요?\n기존 ${toLabel} 레이드는 전부 삭제됩니다.`)) return
    setImporting(true)
    await supabase.from('raids').delete().eq('is_draft', !fromDraft)
    const [raidsRes, rcRes] = await Promise.all([
      supabase.from('raids').select('*').eq('is_draft', fromDraft),
      supabase.from('raid_characters').select('*'),
    ])
    for (const raid of raidsRes.data ?? []) {
      const { id: oldId, created_at, is_draft, day_of_week, time, sort_order, ...rest } = raid
      const { data: newRaid } = await supabase.from('raids')
        .insert({ ...rest, is_draft: !fromDraft, day_of_week: null, time: null, completed: false })
        .select().single()
      if (newRaid) {
        const chars = (rcRes.data ?? []).filter((rc: RaidCharacter) => rc.raid_id === oldId)
        if (chars.length > 0)
          await supabase.from('raid_characters').insert(chars.map((rc: RaidCharacter) => ({ raid_id: newRaid.id, character_id: rc.character_id })))
      }
    }
    setImporting(false)
    const { data } = await supabase.from('raids').select('*').eq('is_draft', isDraft).order('name')
    if (data) { setRaids(data); setSelectedRaidId(data[0]?.id ?? null) }
    const { data: rc } = await supabase.from('raid_characters').select('*')
    if (rc) {
      const map: Record<string, string[]> = {}
      rc.forEach((item: RaidCharacter) => {
        if (!map[item.raid_id]) map[item.raid_id] = []
        map[item.raid_id].push(item.character_id)
      })
      setRaidCharacters(map)
    }
  }

  async function toggleCharacter(raidId: string, charId: string) {
    const current = raidCharacters[raidId] ?? []
    if (current.includes(charId)) {
      await supabase.from('raid_characters').delete().eq('raid_id', raidId).eq('character_id', charId)
      setRaidCharacters(prev => ({ ...prev, [raidId]: prev[raidId].filter(id => id !== charId) }))
    } else {
      const char = allCharacters.find(c => c.id === charId)
      let newList = [...current]
      if (char) {
        const sameMemCharId = current.find(id => allCharacters.find(ac => ac.id === id)?.member_id === char.member_id)
        if (sameMemCharId) {
          await supabase.from('raid_characters').delete().eq('raid_id', raidId).eq('character_id', sameMemCharId)
          newList = newList.filter(id => id !== sameMemCharId)
        } else {
          if (current.length >= 8) { alert('최대 8명입니다.'); return }
        }
      }
      await supabase.from('raid_characters').insert({ raid_id: raidId, character_id: charId })
      setRaidCharacters(prev => ({ ...prev, [raidId]: [...newList, charId] }))
    }
  }

  const selectedRaid = raids.find(r => r.id === selectedRaidId) ?? null
  const assignedIds = selectedRaidId ? (raidCharacters[selectedRaidId] ?? []) : []

  // 색상별 그룹, 최대 7열
  // 레이드 수 많은 순으로 7개가 독립 컬럼, 나머지는 가장 적은 열에 병합
  const MAX_COLS = 7
  const rawGroups: { color: string; raids: Raid[] }[] = []
  raids.forEach(r => {
    const c = r.color ?? '#6b7280'
    const existing = rawGroups.find(g => g.color === c)
    if (existing) existing.raids.push(r)
    else rawGroups.push({ color: c, raids: [r] })
  })

  let colorGroups: { color: string; raids: Raid[] }[]
  if (rawGroups.length <= MAX_COLS) {
    colorGroups = rawGroups
  } else {
    // 레이드 수 내림차순, 동점이면 색상 코드로 타이브레이크 → 상위 7개가 독립 컬럼
    const mainColors = new Set(
      [...rawGroups]
        .sort((a, b) => b.raids.length - a.raids.length || a.color.localeCompare(b.color))
        .slice(0, MAX_COLS)
        .map(g => g.color)
    )
    // DB 순서(이름순) 유지하며 메인 컬럼 구성
    const cols = rawGroups
      .filter(g => mainColors.has(g.color))
      .map(g => ({ color: g.color, raids: [...g.raids] }))
    // 오버플로우 색상은 레이드 수 가장 적은 컬럼에 병합
    rawGroups
      .filter(g => !mainColors.has(g.color))
      .forEach(overflow => {
        const min = cols.reduce((a, b) => b.raids.length < a.raids.length ? b : a)
        min.raids.push(...overflow.raids)
      })
    colorGroups = cols
  }

  return (
    <div className="flex gap-3" style={{ minHeight: 520 }}>

      {/* ── 왼쪽: 레이드현황 스타일 ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">

        {/* 툴바 */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setAdding(v => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
          >+ 레이드 추가</button>
          {!isDraft && (
            <button onClick={resetAllCompleted} className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1.5 rounded-lg text-yellow-400">
              ↩ 초기화
            </button>
          )}
          <button
            onClick={() => importRaids(!isDraft)}
            disabled={importing}
            className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
          >{importing ? '...' : isDraft ? '↙ 레이드관리 가져오기' : '↙ 낙서장 가져오기'}</button>
        </div>

        {/* 추가 폼 */}
        {adding && (
          <div className="bg-gray-700 rounded-xl p-3 flex flex-col gap-2">
            <input
              autoFocus value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addRaid()}
              placeholder="레이드 이름"
              className="bg-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 ring-blue-500 w-full"
            />
            <div className="flex gap-1 flex-wrap">
              {RAID_COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full ${form.color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={addRaid} className="flex-1 bg-blue-600 hover:bg-blue-500 py-1 rounded-lg text-xs font-medium">추가</button>
              <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded-lg text-xs">취소</button>
            </div>
          </div>
        )}

        {/* 레이드 카드 — 색상 그룹별 세로 컬럼 */}
        {raids.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">레이드가 없습니다</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-0 items-stretch w-fit">
              {colorGroups.map(({ color, raids: group }, gi) => (
                <div key={color} className="flex items-stretch">

                  {/* 그룹 사이 세로 구분선 */}
                  {gi > 0 && (
                    <div className="flex flex-col items-center mx-2">
                      <div className="flex-1 w-px" style={{ backgroundColor: `${color}50` }} />
                      <span className="w-1.5 h-1.5 rounded-full my-1 shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 w-px" style={{ backgroundColor: `${color}50` }} />
                    </div>
                  )}

                  {/* 세로 컬럼 */}
                  <div className="flex flex-col gap-3" style={{ width: 210 }}>
                    {group.map(raid => {
                      const charIds = raidCharacters[raid.id] ?? []
                      const characters = charIds
                        .map(id => allCharacters.find(c => c.id === id))
                        .filter(Boolean)
                        .sort((a, b) => a!.role === b!.role ? 0 : a!.role === 'support' ? 1 : -1) as (Character & { member: Member })[]
                      const dps = characters.filter(c => c.role === 'dps')
                      const supports = characters.filter(c => c.role === 'support')
                      const isSelected = selectedRaidId === raid.id
                      const raidColor = raid.completed ? '#4b5563' : (raid.color ?? '#6b7280')

                      return (
                        <div
                          key={raid.id}
                          onClick={() => setSelectedRaidId(raid.id)}
                          className={`rounded-lg overflow-hidden flex flex-col cursor-pointer transition-all ${raid.completed ? 'opacity-80' : ''}`}
                          style={{
                            backgroundColor: isSelected && !raid.completed ? '#3d5268' : '#1f2937',
                            boxShadow: isSelected ? `0 0 0 2px ${raid.completed ? '#9ca3af' : raidColor}, 0 0 14px ${raid.completed ? '#9ca3af88' : raidColor + '55'}` : 'none',
                          }}
                        >
                          {/* 카드 헤더 */}
                          <div
                            className="px-2 py-1.5 flex items-center gap-1.5"
                            style={{
                              backgroundColor: isSelected ? `${raidColor}55` : `${raidColor}33`,
                              borderBottom: `2px solid ${raidColor}`,
                            }}
                          >
                            {/* 이름 + NEW 배지 */}
                            <span className={`text-xs font-bold truncate flex-1 ${raid.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                              {raid.name}
                            </span>
                            {raid.is_new && (
                              <span className={`text-xs font-bold px-1 py-0.5 rounded shrink-0 leading-none ${raid.completed ? 'bg-gray-600 text-gray-400' : 'bg-red-500 text-white'}`}>NEW</span>
                            )}
                            <span className="flex items-center shrink-0">
                              {[1,2,3,4,5].map(star => (
                                <span key={star} className={`text-xs leading-none ${star <= (raid.difficulty ?? 1) ? (raid.completed ? 'text-gray-600' : 'text-yellow-400') : 'text-gray-700'}`}>★</span>
                              ))}
                            </span>

                            {/* 완료·삭제 버튼 */}
                            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                              {!isDraft && (
                                <button
                                  onClick={() => toggleCompleted(raid.id, raid.completed)}
                                  className={`text-xs px-0.5 leading-none ${raid.completed ? 'text-gray-500 hover:text-blue-300' : 'text-green-500 hover:text-green-300'}`}
                                >{raid.completed ? '↩' : '✓'}</button>
                              )}
                              <button onClick={() => deleteRaid(raid.id)} className="text-xs text-gray-600 hover:text-red-400 leading-none">✕</button>
                            </div>
                          </div>

                          {/* 캐릭터 목록 */}
                          <div className="px-1.5 py-1 flex flex-col gap-0.5">
                            {dps.map(char => (
                              <div key={char.id} className="flex items-center gap-1 rounded px-1" style={{ borderLeft: `2px solid ${raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8')}` }}>
                                <span className="text-xs font-medium truncate" style={{ color: raid.completed ? '#6b7280' : (char.member?.color ?? '#e2e8f0') }}>{char.name}</span>
                                {char.item_level && <span className="text-xs shrink-0 opacity-70" style={{ color: raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8') }}>{Math.floor(Number(char.item_level)).toLocaleString()}</span>}
                                <span className={`text-xs shrink-0 ${raid.completed ? 'text-gray-600' : 'text-gray-400'}`}>{char.class}</span>
                              </div>
                            ))}
                            {supports.length > 0 && dps.length > 0 && (
                              <div className={`border-t my-0.5 ${raid.completed ? 'border-gray-700' : 'border-gray-600'}`} />
                            )}
                            {supports.map(char => (
                              <div key={char.id} className="flex items-center gap-1 rounded px-1" style={{ borderLeft: `2px solid ${raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8')}` }}>
                                <span className="text-xs font-medium truncate" style={{ color: raid.completed ? '#6b7280' : (char.member?.color ?? '#e2e8f0') }}>{char.name}</span>
                                {char.item_level && <span className="text-xs shrink-0 opacity-70" style={{ color: raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8') }}>{Math.floor(Number(char.item_level)).toLocaleString()}</span>}
                                <span className={`text-xs shrink-0 ${raid.completed ? 'text-gray-600' : 'text-gray-400'}`}>{char.class}</span>
                              </div>
                            ))}
                            {characters.length === 0 && (
                              <p className="text-xs text-gray-700 px-1 py-0.5">인원 없음</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 오른쪽: 편집 + 인원 배정 패널 ── */}
      <div className="flex flex-col gap-2" style={{ width: 220, flexShrink: 0 }}>

        {/* 레이드 편집 패널 */}
        <div className="bg-gray-700 rounded-xl p-3 flex flex-col gap-2.5">
          {selectedRaid ? (
            <>
              {/* 이름 */}
              <input
                key={selectedRaid.id}
                defaultValue={selectedRaid.name}
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v && v !== selectedRaid.name) renameRaid2(selectedRaid.id, v)
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="bg-gray-600 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-1 ring-blue-500 w-full text-white"
              />
              {/* 색상 */}
              <div className="flex flex-wrap gap-1">
                {RAID_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => updateColor(selectedRaid.id, c)}
                    style={{ backgroundColor: c }}
                    className={`w-4 h-4 rounded-full transition-transform ${(selectedRaid.color ?? '#6b7280') === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
              {/* 별점 */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    onClick={() => updateDifficulty(selectedRaid.id, star)}
                    className="text-base leading-none hover:scale-110 transition-transform"
                  >
                    <span className={star <= (selectedRaid.difficulty ?? 1) ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                  </button>
                ))}
              </div>
              {/* New 토글 */}
              <button
                onClick={() => toggleNew(selectedRaid.id, selectedRaid.is_new)}
                className={`w-full py-1 rounded-lg text-xs font-bold transition-colors border ${selectedRaid.is_new ? 'bg-red-500 border-red-400 text-white' : 'bg-transparent border-gray-600 text-gray-500 hover:border-red-500 hover:text-red-400'}`}
              >{selectedRaid.is_new ? '✦ NEW 표시 중' : '+ NEW 표시'}</button>
            </>
          ) : (
            <p className="text-xs text-gray-500 text-center py-1">← 레이드 선택</p>
          )}
        </div>

        {/* 인원 배정 패널 */}
        <div className="bg-gray-700 rounded-xl flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
          {/* 멤버 탭 */}
          <div className="flex flex-wrap gap-1">
            {allMembers.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(selectedMember === m.id ? null : m.id)}
                className="px-2 py-0.5 rounded text-xs font-medium transition-colors border"
                style={selectedMember === m.id ? {
                  backgroundColor: `${m.color}33`, borderColor: m.color, color: m.color,
                } : { backgroundColor: '#374151', borderColor: 'transparent', color: '#d1d5db' }}
              >{m.nickname}</button>
            ))}
          </div>

          {/* 캐릭터 목록 */}
          {selectedMember && (
            <div className="flex flex-col gap-0.5">
              {allCharacters.filter(c => c.member_id === selectedMember).length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">캐릭터 없음</p>
              ) : (
                allCharacters
                  .filter(c => c.member_id === selectedMember)
                  .sort((a, b) => a.role === b.role ? 0 : a.role === 'support' ? 1 : -1)
                  .map(char => {
                    const isAssigned = assignedIds.includes(char.id)
                    const otherCharAssigned = !isAssigned && assignedIds.some(id =>
                      allCharacters.find(ac => ac.id === id)?.member_id === char.member_id
                    )
                    return (
                      <button
                        key={char.id}
                        onClick={() => selectedRaidId && toggleCharacter(selectedRaidId, char.id)}
                        disabled={!selectedRaidId}
                        className="flex items-center justify-between px-2 py-1 rounded text-xs transition-colors disabled:opacity-40"
                        style={{
                          backgroundColor: '#2d3748',
                          outline: isAssigned ? `1px solid ${char.member?.color ?? '#94a3b8'}55` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-medium" style={{ color: isAssigned ? (char.member?.color ?? '#e2e8f0') : otherCharAssigned ? '#9ca3af' : '#e2e8f0' }}>
                            {char.name}
                          </span>
                          <span className="shrink-0" style={{ color: isAssigned ? `${char.member?.color ?? '#94a3b8'}bb` : otherCharAssigned ? '#6b7280' : '#9ca3af' }}>{char.class}</span>
                        </div>
                        {isAssigned && <span className="text-green-400 shrink-0 ml-1">✓</span>}
                        {otherCharAssigned && <span className="text-gray-600 shrink-0 ml-1">↔</span>}
                      </button>
                    )
                  })
              )}
            </div>
          )}
        </div>
        </div>
      </div>

    </div>
  )
}
