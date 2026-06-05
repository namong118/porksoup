import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member, RaidCharacter } from '../types'
import { DAYS } from '../types'

export default function RaidManager() {
  const [raids, setRaids] = useState<Raid[]>([])
  const [allCharacters, setAllCharacters] = useState<(Character & { member: Member })[]>([])
  const [raidCharacters, setRaidCharacters] = useState<Record<string, string[]>>({})
  const [adding, setAdding] = useState(false)
  const [expandedRaid, setExpandedRaid] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', size: 4 as 4 | 8, day_of_week: '', time: '20:10' })
  const [editingTime, setEditingTime] = useState<string | null>(null)
  const [timeValue, setTimeValue] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').order('name'),
      supabase.from('characters').select('*, member:members(*)').order('name'),
      supabase.from('raid_characters').select('*'),
    ]).then(([r, c, rc]) => {
      if (r.data) setRaids(r.data)
      if (c.data) setAllCharacters(c.data as (Character & { member: Member })[])
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
      .insert({
        name: form.name.trim(),
        size: form.size,
        day_of_week: form.day_of_week || null,
        time: form.time || null,
      })
      .select()
      .single()
    if (error) { alert(error.message); return }
    setRaids(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm({ name: '', size: 4, day_of_week: '', time: '20:10' })
    setAdding(false)
  }

  async function deleteRaid(id: string) {
    if (!confirm('레이드를 삭제할까요?')) return
    await supabase.from('raids').delete().eq('id', id)
    setRaids(prev => prev.filter(r => r.id !== id))
  }

  async function saveTime(raidId: string) {
    await supabase.from('raids').update({ time: timeValue || null }).eq('id', raidId)
    setRaids(prev => prev.map(r => r.id === raidId ? { ...r, time: timeValue || null } : r))
    setEditingTime(null)
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

      {adding && (
        <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="레이드 이름 (예: 하제버스1)"
            className="bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
          />
          <div className="flex gap-2">
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
            <label className="text-sm text-gray-400 flex items-center gap-2">
              요일
              <select
                value={form.day_of_week}
                onChange={e => setForm(p => ({ ...p, day_of_week: e.target.value }))}
                className="bg-gray-600 rounded-lg px-2 py-1 outline-none"
              >
                <option value="">미정</option>
                {DAYS.map(d => <option key={d} value={d}>{d}요일</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-400 flex items-center gap-2">
              시간
              <input
                value={form.time}
                onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                placeholder="20:10"
                className="bg-gray-600 rounded-lg px-2 py-1 outline-none w-20 text-sm"
              />
            </label>
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
            <div key={raid.id} className="bg-gray-700 rounded-xl overflow-hidden">
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-650"
                onClick={() => setExpandedRaid(isExpanded ? null : raid.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{raid.name}</span>
                  <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">{raid.size}인</span>
                  {raid.day_of_week && (
                    <span className="text-xs text-blue-400">{raid.day_of_week}</span>
                  )}
                  {editingTime === raid.id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={timeValue}
                        onChange={e => setTimeValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTime(raid.id); if (e.key === 'Escape') setEditingTime(null) }}
                        placeholder="20:10"
                        className="bg-gray-600 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 ring-blue-500 w-16"
                      />
                      <button onClick={() => saveTime(raid.id)} className="text-blue-400 text-xs hover:text-blue-300">저장</button>
                      <button onClick={() => setEditingTime(null)} className="text-gray-500 text-xs hover:text-gray-300">취소</button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setEditingTime(raid.id); setTimeValue(raid.time ?? '') }}
                      className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      {raid.time ?? '시간 미정'}
                    </button>
                  )}
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

              {isExpanded && (
                <div className="border-t border-gray-600 p-4">
                  <p className="text-xs text-gray-400 mb-3">캐릭터를 클릭해서 파티에 추가/제거</p>
                  <div className="flex flex-col gap-1">
                    {allCharacters.map(char => {
                      const isAssigned = chars.includes(char.id)
                      return (
                        <button
                          key={char.id}
                          onClick={() => toggleCharacter(raid.id, char.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                            ${isAssigned ? 'bg-blue-900 text-blue-200' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{char.name}</span>
                            <span className="text-xs text-gray-400">{char.class}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${char.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                              {char.role === 'support' ? '서폿' : '딜러'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{char.member?.nickname}</span>
                            {isAssigned && <span className="text-blue-400 text-xs">✓</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
