import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, RaidCharacter } from '../types'
import { RAID_COLORS } from '../types'

interface Props {
  member: Member
  isDraft?: boolean
}

export default function RaidManager({ member, isDraft = false }: Props) {
  const [raids, setRaids] = useState<Raid[]>([])
  const [allCharacters, setAllCharacters] = useState<(Character & { member: Member })[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [raidCharacters, setRaidCharacters] = useState<Record<string, string[]>>({})
  const [adding, setAdding] = useState(false)
  const [expandedRaid, setExpandedRaid] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', color: RAID_COLORS[0] })
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').eq('is_draft', isDraft).order('name'),
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
      .insert({ name: form.name.trim(), size: 8, color: form.color, is_draft: isDraft })
      .select()
      .single()
    if (error) { alert(error.message); return }
    setRaids(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm({ name: '', color: RAID_COLORS[0] })
    setAdding(false)
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

  async function importRaids(fromDraft: boolean) {
    const fromLabel = fromDraft ? '낙서장' : '레이드 관리'
    const toLabel = fromDraft ? '레이드 관리' : '낙서장'
    if (!confirm(`${fromLabel}의 모든 레이드를 ${toLabel}으로 복사할까요? 기존 내용은 유지됩니다.`)) return
    setImporting(true)

    const [raidsRes, rcRes] = await Promise.all([
      supabase.from('raids').select('*').eq('is_draft', fromDraft),
      supabase.from('raid_characters').select('*'),
    ])

    const srcRaids = raidsRes.data ?? []
    const srcRc = rcRes.data ?? []

    for (const raid of srcRaids) {
      const { id: oldId, created_at, is_draft, day_of_week, time, sort_order, ...rest } = raid
      const { data: newRaid } = await supabase
        .from('raids')
        .insert({ ...rest, is_draft: !fromDraft, day_of_week: null, time: null, completed: false })
        .select().single()

      if (newRaid) {
        const chars = srcRc.filter(rc => rc.raid_id === oldId)
        if (chars.length > 0) {
          await supabase.from('raid_characters').insert(
            chars.map(rc => ({ raid_id: newRaid.id, character_id: rc.character_id }))
          )
        }
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
      if (current.length >= 8) { alert('최대 8명입니다.'); return }

      // 같은 멤버의 다른 캐릭터가 이미 배정됐으면 교체
      const char = allCharacters.find(c => c.id === charId)
      let newList = [...current]
      if (char) {
        const sameMemCharId = current.find(id => {
          const c = allCharacters.find(ac => ac.id === id)
          return c?.member_id === char.member_id
        })
        if (sameMemCharId) {
          await supabase.from('raid_characters').delete().eq('raid_id', raidId).eq('character_id', sameMemCharId)
          newList = newList.filter(id => id !== sameMemCharId)
        }
      }

      await supabase.from('raid_characters').insert({ raid_id: raidId, character_id: charId })
      setRaidCharacters(prev => ({ ...prev, [raidId]: [...newList, charId] }))
    }
  }

  // 내 캐릭터가 배정된 레이드 목록
  const myCharacterIds = allCharacters.filter(c => c.member_id === member.id).map(c => c.id)
  const myRaids = raids.filter(raid =>
    (raidCharacters[raid.id] ?? []).some(charId => myCharacterIds.includes(charId))
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{isDraft ? '📝 낙서장' : '레이드 관리'}</h2>
        <div className="flex gap-2">
          {!isDraft && (
            <button
              onClick={resetAllCompleted}
              className="bg-gray-600 hover:bg-gray-500 text-sm px-3 py-1.5 rounded-lg transition-colors text-yellow-400 hover:text-yellow-300"
            >
              ↩ 전부 미완료
            </button>
          )}
          <button
            onClick={() => importRaids(!isDraft)}
            disabled={importing}
            className="bg-gray-600 hover:bg-gray-500 text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {importing ? '가져오는 중...' : isDraft ? '↙ 레이드관리에서 가져오기' : '↙ 낙서장에서 가져오기'}
          </button>
          <button
            onClick={() => setAdding(true)}
            className="bg-blue-600 hover:bg-blue-500 text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            + 레이드 추가
          </button>
        </div>
      </div>

      {isDraft && (
        <p className="text-xs text-gray-500 mb-4 bg-gray-700 rounded-xl px-4 py-2.5">
          다음 주 파티 구성을 미리 짜보는 공간입니다. 여기서 수정해도 실제 레이드 관리에는 영향 없습니다.
        </p>
      )}

      {/* 내가 등록된 레이드 요약 */}
      {myRaids.length > 0 && (
        <div className="bg-gray-700 rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-400 mb-2">내가 등록된 레이드 ({myRaids.length}개)</p>
          <div className="flex flex-wrap gap-1.5">
            {myRaids.map(raid => {
              const myChars = (raidCharacters[raid.id] ?? [])
                .map(id => allCharacters.find(c => c.id === id))
                .filter(c => c && myCharacterIds.includes(c.id))
              return myChars.map(char => (
                <span
                  key={`${raid.id}-${char!.id}`}
                  style={{ backgroundColor: `${raid.color ?? '#6b7280'}25`, borderColor: raid.color ?? '#6b7280' }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: raid.color ?? '#6b7280' }}
                  />
                  <span className="font-medium text-gray-200">{raid.name}</span>
                  <span className="text-gray-400">{char!.name}</span>
                </span>
              ))
            })}
          </div>
        </div>
      )}

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
            <div
              key={raid.id}
              className={`rounded-xl overflow-hidden transition-opacity ${raid.completed ? 'opacity-50' : ''}`}
              style={{ borderLeft: `4px solid ${raid.completed ? '#4b5563' : (raid.color ?? '#6b7280')}`, backgroundColor: '#374151' }}
            >
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
                  <span className={`font-medium ${raid.completed ? 'line-through text-gray-500' : ''}`}>{raid.name}</span>
                  {/* 별점 */}
                  <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    {[1,2,3,4,5].map(star => (
                      <button
                        key={star}
                        onClick={() => updateDifficulty(raid.id, star)}
                        className="text-sm leading-none transition-transform hover:scale-125"
                      >
                        <span className={star <= (raid.difficulty ?? 1) ? 'text-yellow-400' : 'text-gray-600'}>★</span>
                      </button>
                    ))}
                  </div>
                  {raid.completed && (
                    <span className="text-xs bg-gray-600 text-gray-400 px-2 py-0.5 rounded-full">완료</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{chars.length}명</span>
                  {!isDraft && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleCompleted(raid.id, raid.completed) }}
                      className={`text-xs px-2 py-0.5 rounded transition-colors ${
                        raid.completed
                          ? 'bg-gray-600 text-gray-300 hover:bg-blue-700 hover:text-blue-200'
                          : 'bg-green-800 text-green-300 hover:bg-green-700'
                      }`}
                    >
                      {raid.completed ? '↩ 되돌리기' : '✓ 완료'}
                    </button>
                  )}
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
                          <span
                            key={charId}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                            style={{
                              backgroundColor: `${char.member?.color ?? '#94a3b8'}25`,
                              border: `1px solid ${char.member?.color ?? '#94a3b8'}55`,
                            }}
                          >
                            <span style={{ color: char.member?.color ?? '#e2e8f0' }}>{char.name}</span>
                            <span className="opacity-60 text-gray-400">{char.class}</span>
                            <button
                              onClick={() => toggleCharacter(raid.id, charId)}
                              className="ml-1 opacity-60 hover:text-red-400 transition-colors"
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
                        style={selectedMember === m.id ? {
                          backgroundColor: `${m.color ?? '#94a3b8'}33`,
                          borderColor: m.color ?? '#94a3b8',
                          color: m.color ?? '#e2e8f0',
                        } : {}}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border
                          ${selectedMember === m.id ? 'border-opacity-100' : 'bg-gray-600 hover:bg-gray-500 text-gray-300 border-transparent'}`}
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
                          // 같은 멤버의 다른 캐릭터가 이미 배정됐는지 확인
                          const otherCharAssigned = !isAssigned && chars.some(id => {
                            const c = allCharacters.find(ac => ac.id === id)
                            return c?.member_id === char.member_id
                          })
                          return (
                            <button
                              key={char.id}
                              onClick={() => toggleCharacter(raid.id, char.id)}
                              style={isAssigned ? {
                                backgroundColor: `${char.member?.color ?? '#94a3b8'}25`,
                                borderColor: `${char.member?.color ?? '#94a3b8'}88`,
                              } : otherCharAssigned ? {
                                backgroundColor: `${char.member?.color ?? '#94a3b8'}10`,
                              } : {}}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors border
                                ${isAssigned ? 'border-opacity-100' :
                                  otherCharAssigned ? 'text-gray-500 border-dashed border-gray-600 hover:bg-gray-600 hover:text-gray-300' :
                                  'bg-gray-600 hover:bg-gray-500 text-gray-300 border-transparent'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span style={isAssigned ? { color: char.member?.color ?? '#e2e8f0' } : {}}>
                                  {char.name}
                                </span>
                                <span className="text-xs text-gray-400">{char.class}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${char.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                                  {char.role === 'support' ? '서폿' : '딜러'}
                                </span>
                              </div>
                              {isAssigned && <span className="text-xs opacity-70" style={{ color: char.member?.color ?? '#94a3b8' }}>✓ 배정됨</span>}
                              {otherCharAssigned && <span className="text-xs text-gray-500">↔ 교체</span>}
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
