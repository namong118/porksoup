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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number
) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = img.width * scale
  const sh = img.height * scale
  const dx = x + (w - sw) / 2
  const dy = y + (h - sh) / 2
  ctx.drawImage(img, dx, dy, sw, sh)
}


export default function BusLounge() {
  const [raids, setRaids] = useState<RaidWithChars[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [fetchingImages, setFetchingImages] = useState(false)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

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
    setCardUrl(null)
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

  async function generateCard() {
    if (!selected) return
    setGenerating(true)
    setCardUrl(null)

    const chars = selected.characters
    const CHAR_W = 220
    const H = 440
    const W = CHAR_W * chars.length
    const raidColor = selected.raid.color ?? '#6b7280'

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    // 배경
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)

    // 캐릭터 초상화를 나란히
    for (let i = 0; i < chars.length; i++) {
      const x = i * CHAR_W
      const imgUrl = images[chars[i].name]
      if (!imgUrl) continue
      try {
        const img = await loadImage(`/api/imageProxy?url=${encodeURIComponent(imgUrl)}`)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, 0, CHAR_W, H)
        ctx.clip()
        drawImageCover(ctx, img, x, 0, CHAR_W, H)
        ctx.restore()
      } catch { /* 이미지 없으면 스킵 */ }
    }

    // 초상화 사이 자연스러운 블렌드
    for (let i = 1; i < chars.length; i++) {
      const x = i * CHAR_W
      const BLEND = 60
      const grad = ctx.createLinearGradient(x - BLEND, 0, x + BLEND, 0)
      grad.addColorStop(0, 'rgba(15, 23, 42, 0)')
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.45)')
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(x - BLEND, 0, BLEND * 2, H)
    }

    // 하단 그라디언트 (레이드 색상으로)
    const bottomGrad = ctx.createLinearGradient(0, H * 0.6, 0, H)
    bottomGrad.addColorStop(0, 'rgba(15, 23, 42, 0)')
    bottomGrad.addColorStop(1, `${raidColor}99`)
    ctx.fillStyle = bottomGrad
    ctx.fillRect(0, 0, W, H)

    // 좌우 엣지 비네트
    const leftGrad = ctx.createLinearGradient(0, 0, W * 0.15, 0)
    leftGrad.addColorStop(0, 'rgba(15, 23, 42, 0.7)')
    leftGrad.addColorStop(1, 'rgba(15, 23, 42, 0)')
    ctx.fillStyle = leftGrad
    ctx.fillRect(0, 0, W * 0.15, H)

    const rightGrad = ctx.createLinearGradient(W * 0.85, 0, W, 0)
    rightGrad.addColorStop(0, 'rgba(15, 23, 42, 0)')
    rightGrad.addColorStop(1, 'rgba(15, 23, 42, 0.7)')
    ctx.fillStyle = rightGrad
    ctx.fillRect(W * 0.85, 0, W * 0.15, H)

    canvas.toBlob(blob => {
      if (!blob) { setGenerating(false); return }
      if (cardUrl) URL.revokeObjectURL(cardUrl)
      setCardUrl(URL.createObjectURL(blob))
      setGenerating(false)
    }, 'image/png')
  }

  function downloadCard() {
    if (!cardUrl || !selected) return
    const a = document.createElement('a')
    a.href = cardUrl
    a.download = `${selected.raid.name}_레이드카드.png`
    a.click()
  }

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>
  if (raids.length === 0) return <div className="text-center py-8 text-gray-500">완료되지 않은 레이드가 없습니다.</div>

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🚌 버스 라운지</h2>

      {/* 레이드 선택 */}
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: selected.raid.color }}>{selected.raid.name}</span>
              {selected.raid.day_of_week && (
                <span className="text-sm text-gray-400">
                  {selected.raid.day_of_week}요일{selected.raid.time ? ` ${selected.raid.time}` : ''}
                </span>
              )}
              {fetchingImages && <span className="text-xs text-gray-500 animate-pulse">이미지 불러오는 중...</span>}
            </div>
            <button
              onClick={generateCard}
              disabled={generating || fetchingImages}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5"
            >
              {generating ? (
                <><span className="animate-spin">⏳</span> 생성 중...</>
              ) : (
                <>🎴 레이드 카드 생성</>
              )}
            </button>
          </div>

          {/* 캐릭터 그리드 */}
          <div className="grid grid-cols-4 gap-3 mb-6">
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
                      <img src={imgUrl} alt={char.name} className="w-full h-full object-cover object-top" />
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

          {/* 생성된 카드 */}
          {cardUrl && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-px h-6 bg-gray-700" />
              <img src={cardUrl} alt="레이드 카드" className="rounded-xl w-full max-w-lg shadow-lg" />
              <button
                onClick={downloadCard}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                ⬇️ PNG 다운로드
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
