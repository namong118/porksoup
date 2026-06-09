import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member } from '../types'

interface RaidWithMembers {
  raid: Raid
  characters: (Character & { member: Member })[]
}

export default function RaidOverview() {
  const [data, setData] = useState<RaidWithMembers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').eq('is_draft', false).order('name'),
      supabase.from('raid_characters').select('*, character:characters(*, member:members(*))'),
    ]).then(([raidsRes, rcRes]) => {
      const raids: Raid[] = raidsRes.data ?? []
      const rcData = rcRes.data ?? []

      const result: RaidWithMembers[] = raids.map(raid => {
        const characters = rcData
          .filter((rc: { raid_id: string }) => rc.raid_id === raid.id)
          .map((rc: { character: Character & { member: Member } }) => rc.character)
          .filter(Boolean)
          .sort((a: Character, b: Character) => {
            if (a.role === b.role) return 0
            return a.role === 'support' ? 1 : -1
          }) as (Character & { member: Member })[]
        return { raid, characters }
      })

      setData(result)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-between mb-4 w-fit gap-4">
        <h2 className="text-lg font-bold">전체 레이드 현황</h2>
        <span className="text-xs text-gray-400">{data.length}개 레이드</span>
      </div>

      {(() => {
        const colorGroups: { color: string; raids: RaidWithMembers[] }[] = []
        data.forEach(r => {
          const c = r.raid.color ?? '#6b7280'
          const existing = colorGroups.find(g => g.color === c)
          if (existing) existing.raids.push(r)
          else colorGroups.push({ color: c, raids: [r] })
        })

        return (
          <div className="overflow-x-auto w-full pb-2">
          <div className="flex gap-0 items-stretch w-fit mx-auto">
            {colorGroups.map(({ color, raids: group }, gi) => (
              <div key={color} className="flex items-stretch">
                {/* 세로 구분선 */}
                {gi > 0 && (
                  <div className="flex flex-col items-center mx-2">
                    <div className="flex-1 w-px" style={{ backgroundColor: `${color}50` }} />
                    <span className="w-1.5 h-1.5 rounded-full my-1 shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 w-px" style={{ backgroundColor: `${color}50` }} />
                  </div>
                )}

                {/* 레이드 카드 컬럼 */}
                <div className="flex flex-col gap-3" style={{ width: 160 }}>
                  {group.map(({ raid, characters }) => {
                    const supports = characters.filter(c => c.role === 'support')
                    const dps = characters.filter(c => c.role === 'dps')
                    const raidColor = raid.completed ? '#4b5563' : (raid.color ?? '#6b7280')

                    return (
                      <div key={raid.id} className={`rounded-lg overflow-hidden flex flex-col ${raid.completed ? 'bg-gray-800 opacity-85' : 'bg-gray-700'}`}>
                        <div
                          className="px-2 py-1 flex items-center justify-between gap-1"
                          style={{ backgroundColor: `${raidColor}33`, borderBottom: `2px solid ${raidColor}` }}
                        >
                          <span className={`text-xs font-bold truncate ${raid.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{raid.name}</span>
                          {raid.is_new && (
                            <span className="text-xs font-bold px-1 py-0.5 rounded ${raid.completed ? 'bg-gray-600 text-gray-400' : 'bg-red-500 text-white'} shrink-0 leading-none">NEW</span>
                          )}
                        </div>
                        <div className="px-1.5 py-1 flex flex-col gap-0.5">
                          {dps.map(char => (
                            <div key={char.id} className="flex items-center gap-1 rounded px-1" style={{ borderLeft: `2px solid ${raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8')}` }}>
                              <span className="text-xs font-medium truncate" style={{ color: raid.completed ? '#6b7280' : (char.member?.color ?? '#e2e8f0') }}>{char.name}</span>
                              {char.item_level && <span className="text-xs shrink-0 opacity-70" style={{ color: raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8') }}>{Math.floor(Number(char.item_level)).toLocaleString()}</span>}
                              <span className={`text-xs shrink-0 ${raid.completed ? 'text-gray-600' : 'text-gray-400'}`}>{char.class}</span>
                            </div>
                          ))}
                          {supports.length > 0 && dps.length > 0 && <div className={`border-t my-0.5 ${raid.completed ? 'border-gray-700' : 'border-gray-600'}`} />}
                          {supports.map(char => (
                            <div key={char.id} className="flex items-center gap-1 rounded px-1" style={{ borderLeft: `2px solid ${raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8')}` }}>
                              <span className="text-xs font-medium truncate" style={{ color: raid.completed ? '#6b7280' : (char.member?.color ?? '#e2e8f0') }}>{char.name}</span>
                              {char.item_level && <span className="text-xs shrink-0 opacity-70" style={{ color: raid.completed ? '#4b5563' : (char.member?.color ?? '#94a3b8') }}>{Math.floor(Number(char.item_level)).toLocaleString()}</span>}
                              <span className={`text-xs shrink-0 ${raid.completed ? 'text-gray-600' : 'text-gray-400'}`}>{char.class}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          </div>
        )
      })()}
    </div>
  )
}
