import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#f43f5e','#06b6d4','#a855f7','#6b7280']

// ── 룰렛 ──────────────────────────────────────────────────────────────
function RouletteWheel({ members }: { members: Member[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [items, setItems] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const rotRef = useRef(0)
  const rafRef = useRef<number>()

  const draw = useCallback((rot: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2
    const r = Math.min(cx, cy) - 6
    ctx.clearRect(0, 0, W, H)

    if (items.length === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI)
      ctx.fillStyle = '#374151'; ctx.fill()
      ctx.fillStyle = '#9ca3af'; ctx.font = '13px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('항목을 추가하세요', cx, cy)
    } else {
      const arc = (2 * Math.PI) / items.length
      items.forEach((item, i) => {
        const s = rot + i * arc
        ctx.beginPath(); ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, s, s + arc); ctx.closePath()
        ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill()
        ctx.strokeStyle = '#111827'; ctx.lineWidth = 1.5; ctx.stroke()

        ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + arc / 2)
        ctx.textAlign = 'right'; ctx.fillStyle = 'white'
        ctx.font = `bold ${Math.max(10, Math.min(15, 180 / items.length))}px sans-serif`
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3
        const label = item.length > 8 ? item.slice(0, 7) + '…' : item
        ctx.fillText(label, r - 8, 4); ctx.restore()
      })
    }

    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 3; ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 2 * Math.PI)
    ctx.fillStyle = '#111827'; ctx.fill()
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.stroke()

    // 포인터 (상단)
    ctx.beginPath()
    ctx.moveTo(cx - 10, 3); ctx.lineTo(cx + 10, 3); ctx.lineTo(cx, r * 0.22)
    ctx.closePath(); ctx.fillStyle = 'white'
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4; ctx.fill()
    ctx.shadowBlur = 0
  }, [items])

  useEffect(() => { draw(rotRef.current) }, [items, draw])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  function spin() {
    if (spinning || items.length < 2) return
    setSpinning(true); setResult(null)
    const start = rotRef.current
    const end = start + (6 + Math.random() * 6) * 2 * Math.PI
    const dur = 3500 + Math.random() * 1000
    const t0 = performance.now()

    function frame(now: number) {
      const p = Math.min((now - t0) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      const cur = start + (end - start) * eased
      rotRef.current = cur; draw(cur)
      if (p < 1) { rafRef.current = requestAnimationFrame(frame); return }
      rotRef.current = end; setSpinning(false)
      const arc = (2 * Math.PI) / items.length
      const norm = ((-Math.PI / 2 - end) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
      setResult(items[Math.floor(norm / arc) % items.length])
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  function addItem() {
    const t = input.trim(); if (!t) return
    setItems(p => p.includes(t) ? p : [...p, t]); setInput(''); setResult(null)
  }

  return (
    <div>
      <div className="flex justify-center mb-3">
        <canvas ref={canvasRef} width={280} height={280} className="rounded-full" />
      </div>

      {result && (
        <div className="text-center mb-3 py-2.5 bg-yellow-500/20 border border-yellow-500/50 rounded-xl">
          <p className="text-yellow-300 font-bold text-lg">🎉 {result}!</p>
        </div>
      )}

      <button onClick={spin} disabled={spinning || items.length < 2}
        className="w-full py-2.5 rounded-xl font-bold mb-4 transition-colors bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
        {spinning ? '돌아가는 중...' : '🎯 돌리기!'}
      </button>

      <div className="flex gap-2 mb-3">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="항목 입력 후 Enter"
          className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500" />
        <button onClick={addItem} className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-sm">추가</button>
        <button onClick={() => { setItems(members.map(m => m.nickname)); setResult(null) }}
          className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-sm whitespace-nowrap">멤버</button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={item} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
              style={{ background: COLORS[i % COLORS.length] + '33', border: `1px solid ${COLORS[i % COLORS.length]}88` }}>
              {item}
              <button onClick={() => { setItems(p => p.filter(x => x !== item)); setResult(null) }}
                className="opacity-50 hover:opacity-100 leading-none">✕</button>
            </span>
          ))}
          <button onClick={() => { setItems([]); setResult(null) }}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-700 text-gray-400 hover:text-red-400 transition-colors">
            전체 삭제
          </button>
        </div>
      )}
    </div>
  )
}

// ── 사다리 ────────────────────────────────────────────────────────────
const ROWS = 10
const COL_W = 58
const ROW_H = 30
const PAD_X = 30
const PAD_Y = 42

function barY(row: number) { return PAD_Y + (row + 0.5) * ROW_H }

function LadderGame({ members }: { members: Member[] }) {
  const [players, setPlayers] = useState<string[]>([])
  const [results, setResults] = useState<string[]>([])
  const [bars, setBars] = useState<{ row: number; col: number }[]>([])
  const [paths, setPaths] = useState<Record<number, number> | null>(null)
  const [playerInput, setPlayerInput] = useState('')
  const [resultInput, setResultInput] = useState('')

  const count = Math.min(players.length, results.length)
  const n = Math.max(players.length, results.length)
  const svgW = n > 1 ? PAD_X * 2 + (n - 1) * COL_W : 200
  const svgH = PAD_Y * 2 + ROWS * ROW_H

  function generateBars(c: number) {
    const b: { row: number; col: number }[] = []
    for (let row = 0; row < ROWS; row++) {
      let col = 0
      while (col < c - 1) {
        if (Math.random() > 0.5) { b.push({ row, col }); col += 2 } else { col++ }
      }
    }
    setBars(b); setPaths(null)
  }

  function computePaths() {
    if (count < 2) return
    const r: Record<number, number> = {}
    for (let p = 0; p < count; p++) {
      let pos = p
      for (let row = 0; row < ROWS; row++) {
        if (bars.some(b => b.row === row && b.col === pos)) pos++
        else if (pos > 0 && bars.some(b => b.row === row && b.col === pos - 1)) pos--
      }
      r[p] = pos
    }
    setPaths(r)
  }

  function getPath(pi: number): string {
    const x = (c: number) => PAD_X + c * COL_W
    let pos = pi
    let d = `M ${x(pos)} ${PAD_Y}`
    for (let row = 0; row < ROWS; row++) {
      d += ` L ${x(pos)} ${barY(row)}`
      if (bars.some(b => b.row === row && b.col === pos)) {
        d += ` L ${x(pos + 1)} ${barY(row)}`; pos++
      } else if (pos > 0 && bars.some(b => b.row === row && b.col === pos - 1)) {
        d += ` L ${x(pos - 1)} ${barY(row)}`; pos--
      }
    }
    d += ` L ${x(pos)} ${PAD_Y + ROWS * ROW_H}`
    return d
  }

  function addPlayer() {
    const t = playerInput.trim(); if (!t) return
    setPlayers(p => [...p, t]); setPlayerInput(''); setPaths(null)
  }
  function addResult() {
    const t = resultInput.trim(); if (!t) return
    setResults(p => [...p, t]); setResultInput(''); setPaths(null)
  }

  const x = (c: number) => PAD_X + c * COL_W

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 참가자 */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5 font-medium">참가자</p>
          <div className="flex gap-1 mb-2">
            <input value={playerInput} onChange={e => setPlayerInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="이름"
              className="flex-1 bg-gray-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 ring-blue-500 min-w-0" />
            <button onClick={() => { setPlayers(members.map(m => m.nickname)); setPaths(null) }}
              className="bg-gray-600 hover:bg-gray-500 px-2 py-1.5 rounded-lg text-xs whitespace-nowrap">멤버</button>
          </div>
          <div className="flex flex-col gap-1">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-1 text-xs bg-gray-700 rounded-lg px-2 py-1"
                style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}>
                <span className="flex-1 truncate">{p}</span>
                <button onClick={() => { setPlayers(prev => prev.filter((_, j) => j !== i)); setPaths(null) }}
                  className="text-gray-500 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* 결과 */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5 font-medium">결과</p>
          <div className="flex gap-1 mb-2">
            <input value={resultInput} onChange={e => setResultInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addResult()}
              placeholder="결과"
              className="flex-1 bg-gray-700 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 ring-blue-500 min-w-0" />
            <button onClick={addResult} className="bg-gray-600 hover:bg-gray-500 px-2 py-1.5 rounded-lg text-xs">추가</button>
          </div>
          <div className="flex flex-col gap-1">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-1 text-xs bg-gray-700 rounded-lg px-2 py-1">
                <span className="flex-1 truncate">{r}</span>
                <button onClick={() => { setResults(prev => prev.filter((_, j) => j !== i)); setPaths(null) }}
                  className="text-gray-500 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {n >= 2 && (
        <>
          {bars.length === 0 ? (
            <button onClick={() => generateBars(n)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold mb-3 transition-colors">
              🪜 사다리 만들기
            </button>
          ) : (
            <>
              <div className="overflow-x-auto mb-3 bg-gray-700 rounded-xl p-3">
                <svg width={svgW} height={svgH} className="mx-auto block">
                  {/* 참가자 이름 (상단) */}
                  {players.slice(0, n).map((p, i) => (
                    <text key={i} x={x(i)} y={PAD_Y - 10}
                      textAnchor="middle" fontSize={11} fill={COLORS[i % COLORS.length]} fontWeight="bold">
                      {p.length > 5 ? p.slice(0, 4) + '…' : p}
                    </text>
                  ))}

                  {/* 결과 이름 (하단) */}
                  {results.slice(0, n).map((r, i) => (
                    <text key={i} x={x(i)} y={svgH - PAD_Y + 18}
                      textAnchor="middle" fontSize={11} fill="#d1d5db" fontWeight="bold">
                      {r.length > 5 ? r.slice(0, 4) + '…' : r}
                    </text>
                  ))}

                  {/* 세로선 */}
                  {Array.from({ length: n }, (_, i) => (
                    <line key={i} x1={x(i)} y1={PAD_Y} x2={x(i)} y2={PAD_Y + ROWS * ROW_H}
                      stroke="#4b5563" strokeWidth={2} />
                  ))}

                  {/* 가로줄 */}
                  {bars.map((b, i) => (
                    <line key={i}
                      x1={x(b.col)} y1={barY(b.row)} x2={x(b.col + 1)} y2={barY(b.row)}
                      stroke="#4b5563" strokeWidth={2} />
                  ))}

                  {/* 경로 (결과 보기 후) */}
                  {paths && Array.from({ length: count }, (_, i) => (
                    <path key={i} d={getPath(i)} fill="none"
                      stroke={COLORS[i % COLORS.length]} strokeWidth={3}
                      strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                  ))}

                  {/* 도착 표시 */}
                  {paths && Object.entries(paths).map(([pi, ri]) => (
                    <circle key={pi}
                      cx={x(ri)} cy={PAD_Y + ROWS * ROW_H}
                      r={6} fill={COLORS[Number(pi) % COLORS.length]} />
                  ))}
                </svg>
              </div>

              <div className="flex gap-2 mb-3">
                <button onClick={() => { generateBars(n) }}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-xl text-sm transition-colors">
                  🔀 다시 섞기
                </button>
                <button onClick={computePaths} disabled={count < 2}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-sm font-bold transition-colors">
                  {paths ? '✓ 결과 확인됨' : '🔍 결과 보기'}
                </button>
              </div>

              {paths && (
                <div className="flex flex-col gap-1.5">
                  {Object.entries(paths).map(([pi, ri]) => (
                    <div key={pi} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                      style={{ background: COLORS[Number(pi) % COLORS.length] + '22', borderLeft: `3px solid ${COLORS[Number(pi) % COLORS.length]}` }}>
                      <span className="font-medium" style={{ color: COLORS[Number(pi) % COLORS.length] }}>
                        {players[Number(pi)] ?? '?'}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="text-gray-200">{results[ri] ?? '?'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export default function FunTools() {
  const [sub, setSub] = useState<'roulette' | 'ladder'>('roulette')
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    supabase.from('members').select('*').order('nickname').then(({ data }) => {
      if (data) setMembers(data)
    })
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold">🎮 게임</h2>
        <div className="flex bg-gray-700 rounded-lg p-0.5">
          {([['roulette', '🎡 룰렛'], ['ladder', '🪜 사다리']] as [string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setSub(id as 'roulette' | 'ladder')}
              className={`px-3 py-1 rounded-md text-sm transition-colors
                ${sub === id ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {sub === 'roulette' ? <RouletteWheel members={members} /> : <LadderGame members={members} />}
    </div>
  )
}
