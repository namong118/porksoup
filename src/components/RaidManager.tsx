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
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', color: RAID_COLORS[0] })
  const [importing, setImporting] = useState(false)
  const [editingRaidId, setEditingRaidId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').eq('is_draft', isDraft).order('sort_order').order('name'),
      supabase.from('characters').select('*, member:members(*)').order('name'),
      supabase.from('raid_characters').select('*'),
      supabase.from('members').select('*').order('nickname'),
    ]).then(([r, c, rc, m]) => {
      if (r.data) setRaids(r.data)
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
    setRaids(prev => [...prev, data])
    setSelectedRaidId(data.id)
    setForm({ name: '', color: RAID_COLORS[0] })
    setAdding(false)
  }

  async function deleteRaid(id: string) {
    if (!confirm('레이드를 삭제할까요?')) return
    await supabase.from('raids').delete().eq('id', id)
    setRaids(prev => prev.filter(r => r.id !== id))
    if (selectedRaidId === id) setSelectedRaidId(null)
  }

  async function updateColor(id: string, color: string) {
    await supabase.from('raids').update({ color }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, color } : r))
    setColorPickerId(null)
  }

  async function toggleCompleted(id: string, current: boolean) {
    await supabase.from('raids').update({ completed: !current }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, completed: !current } : r))
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

  async function renameRaid(id: string) {
    const trimmed = editingName.trim()
    if (!trimmed) { setEditingRaidId(null); return }
    await supabase.from('raids').update({ name: trimmed }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, name: trimmed } : r))
    setEditingRaidId(null)
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
    const srcRaids = raidsRes.data ?? []
    const srcRc = rcRes.data ?? []
    for (const raid of srcRaids) {
      const { id: oldId, created_at, is_draft, day_of_week, time, sort_order, ...rest } = raid
      const { data: newRaid } = await supabase.from('raids')
        .insert({ ...rest, is_draft: !fromDraft, day_of_week: null, time: null, completed: false })
        .select().single()
      if (newRaid) {
        const chars = srcRc.filter(rc => rc.raid_id === oldId)
        if (chars.length > 0)
          await supabase.from('raid_characters').insert(chars.map(rc => ({ raid_id: newRaid.id, character_id: rc.character_id })))
      }
    }
    setImporting(false)
    const { data } = await supabase.from('raids').select('*').eq('is_draft', isDraft).order('name')
    if (data) setRaids(data)
    const { data: rc } = await supabase.from('raid_characters').select('*')
    if (rc) {
      const map: Record<string, string[]> = {}
      rc.forEach((item: RaidCharacter) => {
        if (!map[item.raid_id]) map[item.raid_id] = []
        map[item.raid_id].push(item.character_id)
      })
      setRaidCharacters(map)
    }
    setSelectedRaidId(null)
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
  const assignedIds = selectedRaid ? (raidCharacters[selectedRaid.id] ?? []) : []
  const assignedChars = assignedIds
    .map(id => allCharacters.find(c => c.id === id))
    .filter(Boolean)
    .sort((a, b) => a!.role === b!.role ? 0 : a!.role === 'support' ? 1 : -1) as (Character & { member: Member })[]

  return (
    <div className="flex gap-3 min-h-[520px]">

      {/* ── 왼쪽: 레이드 목록 ── */}
      <div className="w-48 shrink-0 flex flex-col gap-2">
        {/* 툴바 */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setAdding(v => !v)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-sm py-1.5 rounded-lg transition-colors font-medium"
          >
            + 레이드 추가
          </button>
          <div className="flex gap-1">
            {!isDraft && (
              <button
                onClick={resetAllCompleted}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-xs py-1 rounded-lg transition-colors text-yellow-400"
                title="전부 미완료"
              >↩ 초기화</button>
            )}
            <button
              onClick={() => importRaids(!isDraft)}
              disabled={importing}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-xs py-1 rounded-lg transition-colors disabled:opacity-50"
              title={isDraft ? '레이드관리에서 가져오기' : '낙서장에서 가져오기'}
            >{importing ? '...' : isDraft ? '↙ 레이드관리' : '↙ 낙서장'}</button>
          </div>
        </div>

        {/* 추가 폼 */}
        {adding && (
          <div className="bg-gray-700 rounded-xl p-3 flex flex-col gap-2">
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addRaid()}
              placeholder="레이드 이름"
              className="bg-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 ring-blue-500 w-full"
            />
            <div className="flex gap-1 flex-wrap">
              {RAID_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={addRaid} className="flex-1 bg-blue-600 hover:bg-blue-500 py-1 rounded-lg text-xs font-medium">추가</button>
              <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded-lg text-xs">취소</button>
            </div>
          </div>
        )}

        {/* 레이드 카드 목록 */}
        <div className="flex flex-col gap-1.5 overflow-y-auto">
          {raids.map(raid => {
            const chars = raidCharacters[raid.id] ?? []
            const isSelected = selectedRaidId === raid.id
            const raidColor = raid.completed ? '#4b5563' : (raid.color ?? '#6b7280')
            return (
              <div
                key={raid.id}
                onClick={() => setSelectedRaidId(raid.id)}
                className={`rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-650'}`}
                style={{ borderLeft: `3px solid ${raidColor}` }}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-sm font-medium truncate ${raid.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                    {raid.name}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{chars.length}</span>
                </div>
                {/* 배정된 캐릭터 색상 점 */}
                {chars.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {chars.map(id => {
                      const c = allCharacters.find(ac => ac.id === id)
                      return c ? (
                        <span
                          key={id}
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.member?.color ?? '#94a3b8' }}
                          title={c.name}
                        />
                      ) : null
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {raids.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">레이드가 없습니다</p>
          )}
        </div>
      </div>

      {/* ── 오른쪽: 인원 배정 패널 ── */}
      <div className="flex-1 min-w-0 bg-gray-700 rounded-xl flex flex-col">
        {!selectedRaid ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            ← 레이드를 선택하세요
          </div>
        ) : (
          <>
            {/* 레이드 헤더 */}
            <div
              className="px-4 py-3 flex items-center gap-2 rounded-t-xl"
              style={{ borderBottom: `2px solid ${selectedRaid.color ?? '#6b7280'}`, backgroundColor: `${selectedRaid.color ?? '#6b7280'}18` }}
            >
              {/* 색상 버튼 */}
              <button
                onClick={() => setColorPickerId(colorPickerId === selectedRaid.id ? null : selectedRaid.id)}
                style={{ backgroundColor: selectedRaid.color ?? '#6b7280' }}
                className="w-4 h-4 rounded-full shrink-0 hover:ring-2 ring-white transition-all"
              />

              {/* 이름 */}
              {editingRaidId === selectedRaid.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameRaid(selectedRaid.id); if (e.key === 'Escape') setEditingRaidId(null) }}
                  onBlur={() => renameRaid(selectedRaid.id)}
                  className="bg-gray-600 rounded px-2 py-0.5 text-sm font-bold outline-none focus:ring-2 ring-blue-500 w-40"
                />
              ) : (
                <span
                  className="font-bold text-sm cursor-pointer hover:text-blue-300 transition-colors"
                  onDoubleClick={() => { setEditingRaidId(selectedRaid.id); setEditingName(selectedRaid.name) }}
                  title="더블클릭해서 이름 수정"
                  style={{ color: selectedRaid.color ?? '#e2e8f0' }}
                >{selectedRaid.name}</span>
              )}

              {/* 별점 */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => updateDifficulty(selectedRaid.id, star)} className="text-sm hover:scale-125 transition-transform">
                    <span className={star <= (selectedRaid.difficulty ?? 1) ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* 완료 / 삭제 */}
              {!isDraft && (
                <button
                  onClick={() => toggleCompleted(selectedRaid.id, selectedRaid.completed)}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${selectedRaid.completed ? 'bg-gray-600 text-gray-300 hover:bg-blue-700' : 'bg-green-800 text-green-300 hover:bg-green-700'}`}
                >
                  {selectedRaid.completed ? '↩ 되돌리기' : '✓ 완료'}
                </button>
              )}
              <button
                onClick={() => deleteRaid(selectedRaid.id)}
                className="text-gray-500 hover:text-red-400 text-xs transition-colors"
              >삭제</button>
            </div>

            {/* 색상 선택 */}
            {colorPickerId === selectedRaid.id && (
              <div className="px-4 py-2 bg-gray-600 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-300">색상</span>
                {RAID_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => updateColor(selectedRaid.id, c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform ${(selectedRaid.color ?? '#6b7280') === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* 배정된 캐릭터 */}
              <div>
                <p className="text-xs text-gray-400 mb-2">배정된 인원 <span className="text-gray-500">({assignedChars.length}명)</span></p>
                {assignedChars.length === 0 ? (
                  <p className="text-xs text-gray-600">아직 없음</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedChars.map(char => (
                      <span
                        key={char.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        style={{ backgroundColor: `${char.member?.color ?? '#94a3b8'}25`, border: `1px solid ${char.member?.color ?? '#94a3b8'}55` }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${char.role === 'support' ? 'bg-green-400' : 'bg-orange-400'}`} />
                        <span style={{ color: char.member?.color ?? '#e2e8f0' }}>{char.name}</span>
                        <span className="text-gray-500">{char.class}</span>
                        <button onClick={() => toggleCharacter(selectedRaid.id, char.id)} className="ml-0.5 text-gray-500 hover:text-red-400 transition-colors">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-600" />

              {/* 멤버 탭 */}
              <div>
                <p className="text-xs text-gray-400 mb-2">멤버 선택</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {allMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMember(selectedMember === m.id ? null : m.id)}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-colors border"
                      style={selectedMember === m.id ? {
                        backgroundColor: `${m.color}33`, borderColor: m.color, color: m.color,
                      } : { backgroundColor: '#374151', borderColor: 'transparent', color: '#9ca3af' }}
                    >{m.nickname}</button>
                  ))}
                </div>

                {/* 선택된 멤버의 캐릭터 */}
                {selectedMember && (
                  <div className="flex flex-col gap-1">
                    {allCharacters.filter(c => c.member_id === selectedMember).length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-3">등록된 캐릭터 없음</p>
                    ) : (
                      allCharacters
                        .filter(c => c.member_id === selectedMember)
                        .sort((a, b) => a.role === b.role ? 0 : a.role === 'support' ? 1 : -1)
                        .map(char => {
                          const isAssigned = assignedIds.includes(char.id)
                          const otherCharAssigned = !isAssigned && assignedIds.some(id => allCharacters.find(ac => ac.id === id)?.member_id === char.member_id)
                          return (
                            <button
                              key={char.id}
                              onClick={() => toggleCharacter(selectedRaid.id, char.id)}
                              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors border"
                              style={isAssigned ? {
                                backgroundColor: `${char.member?.color ?? '#94a3b8'}25`,
                                borderColor: `${char.member?.color ?? '#94a3b8'}88`,
                              } : otherCharAssigned ? {
                                backgroundColor: `${char.member?.color ?? '#94a3b8'}10`,
                                borderColor: 'transparent',
                              } : {
                                backgroundColor: '#374151',
                                borderColor: 'transparent',
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${char.role === 'support' ? 'bg-green-400' : 'bg-orange-400'}`} />
                                <span style={isAssigned ? { color: char.member?.color ?? '#e2e8f0' } : { color: otherCharAssigned ? '#6b7280' : '#d1d5db' }}>
                                  {char.name}
                                </span>
                                <span className="text-xs text-gray-500">{char.class}</span>
                                {char.item_level && (
                                  <span className="text-xs text-gray-500">{Math.floor(Number(char.item_level)).toLocaleString()}</span>
                                )}
                              </div>
                              {isAssigned && <span className="text-xs" style={{ color: char.member?.color ?? '#94a3b8' }}>✓ 배정</span>}
                              {otherCharAssigned && <span className="text-xs text-gray-500">↔ 교체</span>}
                            </button>
                          )
                        })
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
