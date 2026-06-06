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
    <div>
      <div className="flex items-center justify-between mb-4">
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
          <div className="flex flex-col gap-3">
            {colorGroups.map(({ color, raids: group }, gi) => (
              <div key={color}>
                {gi > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px" style={{ backgroundColor: `${color}40` }} />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 h-px" style={{ backgroundColor: `${color}40` }} />
                  </div>
                )}
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
                  {group.map(({ raid, characters }) => {
                    const filled = characters.length
                    const total = raid.size
                    const supports = characters.filter(c => c.role === 'support')
                    const dps = characters.filter(c => c.role === 'dps')
                    const raidColor = raid.color ?? '#6b7280'

                    return (
                      <div key={raid.id} className="bg-gray-700 rounded-xl overflow-hidden flex flex-col">
                        <div
                          className="px-2.5 py-1.5 flex items-center justify-between gap-1"
                          style={{ backgroundColor: `${raidColor}33`, borderBottom: `2px solid ${raidColor}` }}
                        >
                          <span className="text-xs font-bold text-white truncate">{raid.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">{filled}/{total}</span>
                        </div>
                        <div className="p-1.5 flex flex-col gap-0.5 flex-1">
                          {dps.map(char => (
                            <div key={char.id} className="flex items-center gap-1 rounded px-1" style={{ borderLeft: `2px solid ${char.member?.color ?? '#94a3b8'}` }}>
                              <span className="text-xs font-medium truncate" style={{ color: char.member?.color ?? '#e2e8f0' }}>{char.name}</span>
                              {char.item_level && <span className="text-xs shrink-0 opacity-70" style={{ color: char.member?.color ?? '#94a3b8' }}>{Number(char.item_level).toLocaleString()}</span>}
                              <span className="text-xs text-gray-400 shrink-0 truncate">{char.class}</span>
                            </div>
                          ))}
                          {supports.length > 0 && dps.length > 0 && <div className="border-t border-gray-600 my-0.5" />}
                          {supports.map(char => (
                            <div key={char.id} className="flex items-center gap-1 rounded px-1" style={{ borderLeft: `2px solid ${char.member?.color ?? '#94a3b8'}` }}>
                              <span className="text-xs font-medium truncate" style={{ color: char.member?.color ?? '#e2e8f0' }}>{char.name}</span>
                              {char.item_level && <span className="text-xs shrink-0 opacity-70" style={{ color: char.member?.color ?? '#94a3b8' }}>{Number(char.item_level).toLocaleString()}</span>}
                              <span className="text-xs text-gray-400 shrink-0 truncate">{char.class}</span>
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
        )
      })()}
    </div>
  )
}
