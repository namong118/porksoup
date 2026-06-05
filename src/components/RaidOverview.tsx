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
      supabase.from('raids').select('*').order('name'),
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

  const supportNeeded = (size: number) => size === 4 ? 1 : 2

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">전체 레이드 현황</h2>
        <span className="text-xs text-gray-400">{data.length}개 레이드</span>
      </div>

      <div className="flex flex-col gap-3">
        {data.map(({ raid, characters }) => {
          const filled = characters.length
          const total = raid.size
          const supports = characters.filter(c => c.role === 'support')
          const dps = characters.filter(c => c.role === 'dps')
          const supportOk = supports.length >= supportNeeded(total)
          const color = raid.color ?? '#6b7280'

          return (
            <div
              key={raid.id}
              className="bg-gray-700 rounded-xl overflow-hidden"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              {/* 헤더 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-bold">{raid.name}</span>
                  <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">{total}인</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* 서폿 충족 여부 */}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${supportOk ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    서폿 {supports.length}/{supportNeeded(total)}
                  </span>
                  {/* 인원 진행바 */}
                  <span className={`text-xs font-medium ${filled === total ? 'text-green-400' : 'text-gray-400'}`}>
                    {filled}/{total}명
                  </span>
                </div>
              </div>

              {/* 인원 진행바 */}
              <div className="px-4 pb-1">
                <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(filled / total) * 100}%`, backgroundColor: color }}
                  />
                </div>
              </div>

              {/* 캐릭터 목록 */}
              <div className="px-4 py-3">
                {characters.length === 0 ? (
                  <p className="text-xs text-gray-500">배정된 캐릭터 없음</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {/* 딜러 */}
                    {dps.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {dps.map(char => (
                          <div key={char.id} className="flex items-center gap-1.5 bg-gray-600 rounded-lg px-2.5 py-1.5">
                            <div>
                              <span className="text-xs font-medium text-gray-200">{char.name}</span>
                              <span className="text-xs text-gray-400 ml-1">{char.class}</span>
                            </div>
                            <span className="text-xs text-gray-500 border-l border-gray-500 pl-1.5">{char.member?.nickname}</span>
                          </div>
                        ))}
                        {/* 빈 딜러 슬롯 */}
                        {Array.from({ length: Math.max(0, total - supportNeeded(total) - dps.length) }).map((_, i) => (
                          <div key={`empty-dps-${i}`} className="flex items-center bg-gray-700 border border-dashed border-gray-500 rounded-lg px-2.5 py-1.5">
                            <span className="text-xs text-gray-600">빈 슬롯</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 서포터 */}
                    {(supports.length > 0 || !supportOk) && (
                      <div className="flex flex-wrap gap-1.5">
                        {supports.map(char => (
                          <div key={char.id} className="flex items-center gap-1.5 bg-green-900/60 border border-green-800 rounded-lg px-2.5 py-1.5">
                            <div>
                              <span className="text-xs font-medium text-green-200">{char.name}</span>
                              <span className="text-xs text-green-400 ml-1">{char.class}</span>
                            </div>
                            <span className="text-xs text-green-600 border-l border-green-700 pl-1.5">{char.member?.nickname}</span>
                          </div>
                        ))}
                        {/* 빈 서폿 슬롯 */}
                        {Array.from({ length: Math.max(0, supportNeeded(total) - supports.length) }).map((_, i) => (
                          <div key={`empty-sup-${i}`} className="flex items-center bg-gray-700 border border-dashed border-green-800 rounded-lg px-2.5 py-1.5">
                            <span className="text-xs text-green-800">서폿 필요</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
