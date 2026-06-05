import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, RaidCharacter } from '../types'
import { RAID_COLORS } from '../types'

export default function RaidManager() {
  const [raids, setRaids] = useState<Raid[]>([])
  const [allCharacters, setAllCharacters] = useState<(Character & { member: Member })[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [raidCharacters, setRaidCharacters] = useState<Record<string, string[]>>({})
  const [adding, setAdding] = useState(false)
  const [expandedRaid, setExpandedRaid] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', size: 4 as 4 | 8, color: RAID_COLORS[0] })

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').order('name'),
      supabase.from('characters').select('*, member:members(*)').order('name'),
      supabase.from('raid_characters').select('*'),
      supabase.from('members').select('*').order('nickname'),
    ]).then(([r, c, rc, m]) => {
      if (r.data) setRaids(r.data)
      if (c.data) setAllCharacters(c.data as (Character & { member: Member })[])
      if (m.data) setAllMembers(m.data)
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
      .insert({ name: form.name.trim(), size: form.size, color: form.color })
      .select()
      .single()
    if (error) { alert(error.message); return }
    setRaids(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm({ name: '', size: 4, color: RAID_COLORS[0] })
    setAdding(false)
  }

  async function updateColor(id: string, color: string) {
    await supabase.from('raids').update({ color }).eq('id', id)
    setRaids(prev => prev.map(r => r.id === id ? { ...r, color } : r))
    setColorPickerId(null)
  }

  async function deleteRaid(id: string) {
    if (!confirm('레이드를 삭제할까요?')) return
    await supabase.from('raids').delete().eq('id', id)
    setRaids(prev => prev.filter(r => r.id !== id))
  }

  async function toggleCharacter(raidId: string, charId: string) {
    const current = raidCharacters[raidId] ?? []
    if (current.includes(charId)) {
      await supabase.from('raid_characters').delete().eq('raid_id', raidId).eq('character_id', charId)
      setRaidCharacters(prev => ({ ...prev, [raidId]: prev[raidId].filter(id => id !== charId) }))
    } else {
      const raid = raids.find(r => r.id === raidId)!
      if (current.length >= raid.size) { alert(`최대 ${raid.size}명입니다.`); return }
      await supabase.from('raid_characters').insert({ raid_id: raidId, character_id: charId })
      setRaidCharacters(prev => ({ ...prev, [raidId]: [...(prev[raidId] ?? []), charId] }))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">레이드 관리</h2>
        <button
          onClick={() => setAdding(true)}
          className="bg-blue-600 hover:bg-blue-500 text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          + 레이드 추가
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">레이드 구성원을 설정합니다. 요일·시간은 이번 주 편성에서 정합니다.</p>

      {adding && (
        <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addRaid()}
            placeholder="레이드 이름 (예: 하제버스1)"
            className="bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
          />
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm text-gray-400 flex items-center gap-2">
              인원
              <select
                value={form.size}
                onChange={e => setForm(p => ({ ...p, size: Number(e.target.value) as 4 | 8 }))}
                className="bg-gray-600 rounded-lg px-2 py-1 outline-none"
              >
                <option value={4}>4인</option>
                <option value={8}>8인</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">색상</span>
              <div className="flex gap-1.5 flex-wrap">
                {RAID_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRaid} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium">추가</button>
            <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {raids.map(raid => {
          const chars = raidCharacters[raid.id] ?? []
          const isExpanded = expandedRaid === raid.id
          return (
            <div key={raid.id} className="bg-gray-700 rounded-xl overflow-hidden" style={{ borderLeft: `4px solid ${raid.color ?? '#6b7280'}` }}>
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedRaid(isExpanded ? null : raid.id)}
              >
                <div className="flex items-center gap-2">
                  {/* 색상 변경 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); setColorPickerId(colorPickerId === raid.id ? null : raid.id) }}
                    style={{ backgroundColor: raid.color ?? '#6b7280' }}
                    className="w-4 h-4 rounded-full shrink-0 hover:ring-2 ring-white transition-all"
                  />
                  <span className="font-medium">{raid.name}</span>
                  <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">{raid.size}인</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{chars.length}/{raid.size}명</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteRaid(raid.id) }}
                    className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                  >
                    삭제
                  </button>
                  <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {colorPickerId === raid.id && (
                <div className="px-4 py-3 bg-gray-600 flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-gray-300">색상 선택</span>
                  {RAID_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateColor(raid.id, c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full transition-transform ${(raid.color ?? '#6b7280') === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                    />
                  ))}
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-gray-600 p-4">
                  {/* 배정된 캐릭터 요약 */}
                  {chars.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {[...chars]
                        .map(charId => allCharacters.find(c => c.id === charId))
                        .filter(Boolean)
                        .sort((a, b) => {
                          if (a!.role === b!.role) return 0
                          return a!.role === 'support' ? 1 : -1
                        })
                        .map(char => {
                        const charId = char!.id
                        if (!char) return null
                        return (
                          <span key={charId} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${char.role === 'support' ? 'bg-green-800 text-green-200' : 'bg-blue-900 text-blue-200'}`}>
                            {char.name}
                            <span className={`opacity-70 ${char.role === 'support' ? 'text-green-400' : 'text-blue-400'}`}>{char.class}</span>
                            <button
                              onClick={() => toggleCharacter(raid.id, charId)}
                              className={`ml-1 hover:text-red-400 transition-colors ${char.role === 'support' ? 'text-green-400' : 'text-blue-400'}`}
                            >✕</button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* 멤버 선택 */}
                  <p className="text-xs text-gray-400 mb-2">멤버 선택 후 캐릭터를 추가하세요</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {allMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(selectedMember === m.id ? null : m.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors
                          ${selectedMember === m.id ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
                      >
                        {m.nickname}
                      </button>
                    ))}
                  </div>

                  {/* 선택된 멤버의 캐릭터 목록 */}
                  {selectedMember && (
                    <div className="flex flex-col gap-1">
                      {allCharacters.filter(c => c.member_id === selectedMember).length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">등록된 캐릭터 없음</p>
                      ) : (
                        allCharacters.filter(c => c.member_id === selectedMember)
                          .sort((a, b) => {
                            if (a.role === b.role) return 0
                            return a.role === 'support' ? 1 : -1
                          })
                          .map(char => {
                          const isAssigned = chars.includes(char.id)
                          return (
                            <button
                              key={char.id}
                              onClick={() => toggleCharacter(raid.id, char.id)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                                ${isAssigned
                                  ? char.role === 'support'
                                    ? 'bg-green-800 text-green-200'
                                    : 'bg-blue-900 text-blue-200'
                                  : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{char.name}</span>
                                <span className="text-xs text-gray-400">{char.class}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${char.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                  {char.role === 'support' ? '서폿' : '딜러'}
                                </span>
                              </div>
                              {isAssigned && <span className="text-blue-400 text-xs">✓ 배정됨</span>}
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
