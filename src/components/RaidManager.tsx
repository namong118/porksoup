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
    setRaids(prev => [...prev, data])
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

  return (
    <div className="flex gap-3" style={{ minHeight: 520 }}>

      {/* ── 왼쪽: 레이드 카드 그리드 ── */}
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

        {/* 레이드 카드 그리드 (2열) */}
        <div className="grid grid-cols-2 gap-2 overflow-y-auto">
          {raids.map(raid => {
            const charIds = raidCharacters[raid.id] ?? []
            const chars = charIds
              .map(id => allCharacters.find(c => c.id === id))
              .filter(Boolean)
              .sort((a, b) => a!.role === b!.role ? 0 : a!.role === 'support' ? 1 : -1) as (Character & { member: Member })[]
            const isSelected = selectedRaidId === raid.id
            const raidColor = raid.completed ? '#4b5563' : (raid.color ?? '#6b7280')

            return (
              <div
                key={raid.id}
                onClick={() => setSelectedRaidId(raid.id)}
                className={`rounded-xl p-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-gray-600' : 'bg-gray-750 hover:bg-gray-700'}`}
                style={{
                  borderLeft: `3px solid ${raidColor}`,
                  backgroundColor: isSelected ? '#4b5563' : '#374151',
                  outline: isSelected ? `1px solid ${raidColor}55` : undefined,
                }}
              >
                {/* 헤더 행: 색상점 + 이름 + 별 + 액션 */}
                <div className="flex items-center gap-1 mb-1.5">
                  <button
                    onClick={e => { e.stopPropagation(); setColorPickerId(colorPickerId === raid.id ? null : raid.id) }}
                    style={{ backgroundColor: raidColor }}
                    className="w-2.5 h-2.5 rounded-full shrink-0 hover:ring-1 ring-white"
                  />
                  {editingRaidId === raid.id ? (
                    <input
                      autoFocus value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameRaid(raid.id); if (e.key === 'Escape') setEditingRaidId(null) }}
                      onBlur={() => renameRaid(raid.id)}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-600 rounded px-1 py-0.5 text-xs font-bold outline-none focus:ring-1 ring-blue-500 flex-1 min-w-0"
                    />
                  ) : (
                    <span
                      className={`text-xs font-bold flex-1 truncate ${raid.completed ? 'line-through text-gray-500' : 'text-white'}`}
                      onDoubleClick={e => { e.stopPropagation(); setEditingRaidId(raid.id); setEditingName(raid.name) }}
                      title="더블클릭해서 이름 수정"
                    >{raid.name}</span>
                  )}
                  <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {!isDraft && (
                      <button
                        onClick={() => toggleCompleted(raid.id, raid.completed)}
                        className={`text-xs leading-none px-1 py-0.5 rounded ${raid.completed ? 'text-gray-500 hover:text-blue-300' : 'text-green-500 hover:text-green-300'}`}
                      >{raid.completed ? '↩' : '✓'}</button>
                    )}
                    <button onClick={() => deleteRaid(raid.id)} className="text-xs text-gray-700 hover:text-red-400 leading-none">✕</button>
                  </div>
                </div>

                {/* 색상 선택 */}
                {colorPickerId === raid.id && (
                  <div className="flex flex-wrap gap-1 mb-1.5" onClick={e => e.stopPropagation()}>
                    {RAID_COLORS.map(c => (
                      <button key={c} onClick={() => updateColor(raid.id, c)}
                        style={{ backgroundColor: c }}
                        className={`w-3.5 h-3.5 rounded-full ${(raid.color ?? '#6b7280') === c ? 'ring-1 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                )}

                {/* 별점 */}
                <div className="flex gap-0 mb-1.5" onClick={e => e.stopPropagation()}>
                  {[1,2,3,4,5].map(star => (
                    <button key={star} onClick={() => updateDifficulty(raid.id, star)} className="text-xs leading-none">
                      <span className={star <= (raid.difficulty ?? 1) ? 'text-yellow-400' : 'text-gray-700'}>★</span>
                    </button>
                  ))}
                </div>

                {/* 배정된 멤버 (항상 표시) */}
                {chars.length === 0 ? (
                  <p className="text-xs text-gray-700">인원 없음</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {chars.map(char => (
                      <div key={char.id} className="flex items-center gap-1">
                        <span className={`w-1 h-1 rounded-full shrink-0 ${char.role === 'support' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        <span className="text-xs truncate leading-tight" style={{ color: char.member?.color ?? '#9ca3af' }}>{char.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {raids.length === 0 && <p className="text-xs text-gray-600 text-center py-4 col-span-2">레이드가 없습니다</p>}
        </div>
      </div>

      {/* ── 오른쪽: 인원 배정 패널 (고정 폭, 항상 표시) ── */}
      <div className="bg-gray-700 rounded-xl flex flex-col" style={{ width: 220, flexShrink: 0 }}>
        {/* 헤더 */}
        <div className="px-3 py-2 border-b border-gray-600">
          {selectedRaid ? (
            <span className="font-bold text-xs" style={{ color: selectedRaid.color ?? '#e2e8f0' }}>
              {selectedRaid.name}
            </span>
          ) : (
            <span className="text-xs text-gray-500">← 레이드 선택</span>
          )}
        </div>

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
                } : { backgroundColor: '#374151', borderColor: 'transparent', color: '#6b7280' }}
              >{m.nickname}</button>
            ))}
          </div>

          {/* 선택된 멤버의 캐릭터 목록 */}
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
                        style={isAssigned ? {
                          backgroundColor: `${char.member?.color ?? '#94a3b8'}22`,
                          outline: `1px solid ${char.member?.color ?? '#94a3b8'}55`,
                        } : { backgroundColor: otherCharAssigned ? 'transparent' : '#2d3748' }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${char.role === 'support' ? 'bg-green-400' : 'bg-orange-400'}`} />
                          <span className="truncate" style={{ color: isAssigned ? (char.member?.color ?? '#e2e8f0') : otherCharAssigned ? '#4b5563' : '#d1d5db' }}>
                            {char.name}
                          </span>
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
  )
}
