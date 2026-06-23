import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member } from '../types'

interface RaidInfo {
  raid: Raid
  allCharacters: (Character & { member: Member })[]
}

interface CharacterWithRaids {
  character: Character
  raids: RaidInfo[]
}

interface Props { member: Member }

export default function MyRaids({ member }: Props) {
  const [data, setData] = useState<CharacterWithRaids[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [myCharsRes, raidsRes, rcRes] = await Promise.all([
      supabase
        .from('characters')
        .select('*')
        .eq('member_id', member.id)
        .order('item_level', { ascending: false, nullsFirst: false }),
      supabase
        .from('raids')
        .select('*')
        .eq('is_draft', false)
        .order('sort_order')
        .order('name'),
      supabase
        .from('raid_characters')
        .select('*, character:characters(*, member:members(*))'),
    ])

    const myChars: Character[] = myCharsRes.data ?? []
    const raids: Raid[] = raidsRes.data ?? []
    const rcData = rcRes.data ?? []

    const raidCharMap = new Map<string, (Character & { member: Member })[]>()
    for (const rc of rcData) {
      if (!rc.character) continue
      if (!raidCharMap.has(rc.raid_id)) raidCharMap.set(rc.raid_id, [])
      raidCharMap.get(rc.raid_id)!.push(rc.character)
    }

    const charRaidMap = new Map<string, string[]>()
    for (const rc of rcData) {
      if (!charRaidMap.has(rc.character_id)) charRaidMap.set(rc.character_id, [])
      charRaidMap.get(rc.character_id)!.push(rc.raid_id)
    }

    const result: CharacterWithRaids[] = myChars.map(char => {
      const raidIds = charRaidMap.get(char.id) ?? []
      const charRaids: RaidInfo[] = raids
        .filter(r => raidIds.includes(r.id))
        .map(r => ({
          raid: r,
          allCharacters: raidCharMap.get(r.id) ?? [],
        }))
      return { character: char, raids: charRaids }
    })

    setData(result)
    setLoading(false)
  }, [member.id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  if (data.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-4">내 레이드</h2>
        <div className="text-center py-12 text-gray-500">
          <p>등록된 캐릭터가 없습니다.</p>
          <p className="text-sm mt-1">내 캐릭터 탭에서 캐릭터를 추가하세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">내 레이드</h2>
        <span className="text-sm text-gray-400">
          캐릭터 {data.length}개 · 진행 {data.reduce((s, d) => s + d.raids.filter(r => !r.raid.completed).length, 0)}개
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {data.map(({ character, raids }) => (
          <div key={character.id} className="bg-gray-700 rounded-2xl overflow-hidden">
            {/* 캐릭터 헤더 */}
            <div className="px-4 py-3 bg-gray-600 flex items-center gap-3">
              <span className="font-bold text-white">{character.name}</span>
              <span className="text-sm text-gray-300">{character.class}</span>
              {character.item_level && (
                <span className="text-sm font-medium" style={{ color: member.color }}>
                  {Math.floor(Number(character.item_level)).toLocaleString()}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full ml-auto
                  ${character.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}
              >
                {character.role === 'support' ? '서포터' : '딜러'}
              </span>
              <span className="text-xs text-gray-500">{raids.length}개 레이드</span>
            </div>

            {/* 레이드 목록 */}
            {raids.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500">편성된 레이드 없음</div>
            ) : (
              <div className="p-3 flex flex-col gap-2">
                {raids.map(({ raid, allCharacters }) => {
                  const supports = allCharacters.filter(c => c.role === 'support')
                  const dps = allCharacters.filter(c => c.role === 'dps')
                  const done = raid.completed
                  return (
                    <div
                      key={raid.id}
                      className={`rounded-xl bg-gray-800 overflow-hidden ${done ? 'opacity-50 grayscale' : ''}`}
                      style={{ borderLeft: `3px solid ${done ? '#4b5563' : (raid.color ?? '#6b7280')}` }}
                    >
                      <div className="px-3 py-2.5">
                        {/* 레이드 이름 + 요일/시간 */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-sm" style={{ color: done ? '#6b7280' : (raid.color ?? '#6b7280') }}>
                            {raid.name}
                          </span>
                          {done && <span className="text-xs text-gray-600">✓ 완료</span>}
                          {raid.day_of_week && (
                            <span className="text-xs text-gray-400">{raid.day_of_week}요일</span>
                          )}
                          {raid.time && (
                            <span className="text-xs text-gray-500">⏰ {raid.time}</span>
                          )}
                          {!raid.day_of_week && !raid.time && (
                            <span className="text-xs text-gray-600">요일 미정</span>
                          )}
                        </div>
                        {/* 파티원 */}
                        <div className="flex flex-wrap gap-1.5">
                          {[...dps, ...supports].map(c => {
                            const isMe = c.id === character.id
                            const color = (c as Character & { member?: Member }).member?.color ?? '#94a3b8'
                            return (
                              <div
                                key={c.id}
                                className="flex items-center gap-1 rounded-lg px-2 py-0.5"
                                style={isMe && !done ? {
                                  backgroundColor: `${color}44`,
                                  border: `1px solid ${color}88`,
                                } : {
                                  backgroundColor: '#ffffff08',
                                }}
                              >
                                <span className={`text-xs ${isMe && !done ? 'font-bold text-white' : 'text-gray-500'}`}>
                                  {c.name}
                                </span>
                                {c.item_level && (
                                  <span className="text-xs text-gray-600">
                                    {Math.floor(Number(c.item_level)).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
