import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Raid, Character, Member } from '../types'

interface RaidWithChars {
  raid: Raid
  characters: (Character & { member: Member })[]
}

const DAY_MAP: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }

function findNextRaidIndex(raids: RaidWithChars[]): number {
  if (raids.length === 0) return 0
  const now = new Date()
  const today = now.getDay()
  const currentMin = now.getHours() * 60 + now.getMinutes()

  const scored = raids.map((r, idx) => {
    const day = r.raid.day_of_week != null ? DAY_MAP[r.raid.day_of_week] : undefined
    if (day == null) return { idx, score: Infinity }
    const [h = 0, m = 0] = (r.raid.time ?? '00:00').split(':').map(Number)
    const raidMin = h * 60 + m
    let daysUntil = (day - today + 7) % 7
    if (daysUntil === 0 && raidMin <= currentMin) daysUntil = 7
    return { idx, score: daysUntil * 1440 + raidMin }
  })

  return scored.sort((a, b) => a.score - b.score)[0].idx
}

export default function BusLounge() {
  const [raids, setRaids] = useState<RaidWithChars[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [fetchingImages, setFetchingImages] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('raids').select('*').eq('is_draft', false).eq('completed', false).order('sort_order'),
      supabase.from('raid_characters').select('*, character:characters(*, member:members(*))'),
    ]).then(([raidsRes, rcRes]) => {
      const raidList: Raid[] = raidsRes.data ?? []
      const rcData = rcRes.data ?? []

      const result: RaidWithChars[] = raidList
        .map(raid => ({
          raid,
          characters: (rcData as any[])
            .filter(rc => rc.raid_id === raid.id)
            .map(rc => rc.character)
            .filter(Boolean)
            .sort((a: Character, b: Character) => {
              if (a.role === b.role) return 0
              return a.role === 'support' ? 1 : -1
            }) as (Character & { member: Member })[],
        }))
        .filter(r => r.characters.length > 0)

      setRaids(result)
      if (result.length > 0) setSelectedIdx(findNextRaidIndex(result))
      setLoading(false)
    })
  }, [])

  const selected = raids[selectedIdx]

  useEffect(() => {
    if (!selected) return
    const toFetch = selected.characters.map(c => c.name).filter(n => !(n in images))
    if (toFetch.length === 0) return

    setFetchingImages(true)
    Promise.all(
      toFetch.map(name =>
        fetch(`/api/lostark?character=${encodeURIComponent(name)}`)
          .then(r => r.json())
          .then(data => ({ name, url: data.characterImage as string | null }))
          .catch(() => ({ name, url: null }))
      )
    ).then(results => {
      setImages(prev => {
        const next = { ...prev }
        results.forEach(({ name, url }) => { next[name] = url ?? '' })
        return next
      })
      setFetchingImages(false)
    })
  }, [selected?.raid.id])

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>
  if (raids.length === 0) return <div className="text-center py-8 text-gray-500">완료되지 않은 레이드가 없습니다.</div>

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🚌 버스 라운지</h2>

      <div className="flex flex-wrap gap-2 mb-6">
        {raids.map((r, idx) => (
          <button
            key={r.raid.id}
            onClick={() => setSelectedIdx(idx)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
              idx === selectedIdx
                ? 'text-white border-transparent'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
            style={idx === selectedIdx ? { backgroundColor: `${r.raid.color}bb`, borderColor: r.raid.color } : {}}
          >
            {r.raid.name}
            {r.raid.day_of_week && <span className="ml-1.5 opacity-60 text-xs">{r.raid.day_of_week}</span>}
          </button>
        ))}
      </div>

      {selected && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="font-bold" style={{ color: selected.raid.color }}>{selected.raid.name}</span>
            {selected.raid.day_of_week && (
              <span className="text-sm text-gray-400">
                {selected.raid.day_of_week}요일{selected.raid.time ? ` ${selected.raid.time}` : ''}
              </span>
            )}
            {fetchingImages && <span className="text-xs text-gray-500 animate-pulse">이미지 불러오는 중...</span>}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {selected.characters.map(char => {
              const imgUrl = images[char.name]
              const color = char.member?.color ?? '#94a3b8'
              return (
                <div key={char.id} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center"
                    style={{ aspectRatio: '3/4', border: `2px solid ${color}55` }}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={char.name}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
                        style={{ backgroundColor: `${color}33`, color }}
                      >
                        {char.name[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium truncate w-full text-center" style={{ color }}>
                    {char.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${char.role === 'support' ? 'bg-green-900/60 text-green-400' : 'bg-orange-900/60 text-orange-400'}`}>
                    {char.class}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
