import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface GoldEntry {
  id: string
  min_ilvl: number
  raid_name: string
  difficulty: string
  tradeable_gold: number
  bound_gold: number
  sort_order: number
}

const DIFFICULTY_COLOR: Record<string, string> = {
  '나메': 'text-yellow-400',
  '하드': 'text-red-400',
  '노말': 'text-green-400',
  '1단계': 'text-blue-300',
  '2단계': 'text-blue-400',
  '3단계': 'text-blue-500',
}

export default function GoldGuide() {
  const [entries, setEntries] = useState<GoldEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<GoldEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ min_ilvl: '', raid_name: '', difficulty: '노말', tradeable_gold: '', bound_gold: '' })

  useEffect(() => {
    supabase
      .from('gold_guide')
      .select('*')
      .order('min_ilvl', { ascending: false })
      .order('sort_order')
      .then(({ data }) => { if (data) setEntries(data); setLoading(false) })
  }, [])

  const grouped = entries.reduce<Record<number, GoldEntry[]>>((acc, e) => {
    if (!acc[e.min_ilvl]) acc[e.min_ilvl] = []
    acc[e.min_ilvl].push(e)
    return acc
  }, {})

  const ilvlTiers = Object.keys(grouped).map(Number).sort((a, b) => b - a)

  function openEdit(e: GoldEntry) {
    setEditTarget(e)
    setForm({
      min_ilvl: String(e.min_ilvl),
      raid_name: e.raid_name,
      difficulty: e.difficulty,
      tradeable_gold: String(e.tradeable_gold),
      bound_gold: String(e.bound_gold),
    })
    setAdding(false)
  }

  function openAdd() {
    setEditTarget(null)
    setForm({ min_ilvl: '', raid_name: '', difficulty: '노말', tradeable_gold: '0', bound_gold: '0' })
    setAdding(true)
  }

  async function saveEntry() {
    const payload = {
      min_ilvl: Number(form.min_ilvl),
      raid_name: form.raid_name.trim(),
      difficulty: form.difficulty,
      tradeable_gold: Number(form.tradeable_gold) || 0,
      bound_gold: Number(form.bound_gold) || 0,
    }
    if (!payload.raid_name || !payload.min_ilvl) return

    if (editTarget) {
      const { data } = await supabase.from('gold_guide').update(payload).eq('id', editTarget.id).select().single()
      if (data) setEntries(prev => prev.map(e => e.id === editTarget.id ? data : e))
    } else {
      const maxOrder = Math.max(0, ...entries.filter(e => e.min_ilvl === payload.min_ilvl).map(e => e.sort_order))
      const { data } = await supabase.from('gold_guide').insert({ ...payload, sort_order: maxOrder + 1 }).select().single()
      if (data) setEntries(prev => [...prev, data].sort((a, b) => b.min_ilvl - a.min_ilvl || a.sort_order - b.sort_order))
    }
    setEditTarget(null)
    setAdding(false)
  }

  async function deleteEntry(id: string) {
    await supabase.from('gold_guide').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setEditTarget(null)
  }

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  const FormPanel = () => (
    <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
      <p className="text-sm font-medium text-indigo-300">{editTarget ? '항목 수정' : '항목 추가'}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-1">최소 아이템레벨</p>
          <input value={form.min_ilvl} onChange={e => setForm(f => ({ ...f, min_ilvl: e.target.value }))}
            placeholder="1750" className="w-full bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500" />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">레이드명</p>
          <input value={form.raid_name} onChange={e => setForm(f => ({ ...f, raid_name: e.target.value }))}
            placeholder="세르카" className="w-full bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500" />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">난이도</p>
          <input value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
            placeholder="노말/하드/나메" className="w-full bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500" />
        </div>
        <div />
        <div>
          <p className="text-xs text-gray-400 mb-1">유통골드</p>
          <input type="number" value={form.tradeable_gold} onChange={e => setForm(f => ({ ...f, tradeable_gold: e.target.value }))}
            className="w-full bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500" />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">귀속골드</p>
          <input type="number" value={form.bound_gold} onChange={e => setForm(f => ({ ...f, bound_gold: e.target.value }))}
            className="w-full bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={saveEntry} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-sm font-medium">저장</button>
        {editTarget && (
          <button onClick={() => deleteEntry(editTarget.id)} className="bg-red-900 hover:bg-red-800 px-4 py-2 rounded-lg text-sm text-red-300">삭제</button>
        )}
        <button onClick={() => { setEditTarget(null); setAdding(false) }} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">레이드 골드 가이드</h2>
        <div className="flex gap-2">
          <button onClick={() => setEditing(v => !v)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${editing ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
            {editing ? '편집 중' : '✏️ 편집'}
          </button>
          {editing && (
            <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-sm px-3 py-1.5 rounded-lg">+ 추가</button>
          )}
        </div>
      </div>

      {(adding || editTarget) && <FormPanel />}

      <div className="flex flex-col gap-4">
        {ilvlTiers.map(ilvl => {
          const rows = grouped[ilvl]
          const total = rows.reduce((s, e) => s + e.tradeable_gold + e.bound_gold, 0)
          const totalTradeable = rows.reduce((s, e) => s + e.tradeable_gold, 0)
          const totalBound = rows.reduce((s, e) => s + e.bound_gold, 0)

          return (
            <div key={ilvl} className="bg-gray-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-600 flex items-center justify-between">
                <span className="font-bold text-white">Lv. {ilvl.toLocaleString()}</span>
                <span className="text-sm text-yellow-400 font-medium">{total.toLocaleString()} G</span>
              </div>

              <div className="divide-y divide-gray-600">
                {/* 헤더 */}
                <div className="grid grid-cols-4 px-4 py-1.5 text-xs text-gray-500">
                  <span>레이드</span>
                  <span className="text-center">유통</span>
                  <span className="text-center">귀속</span>
                  <span className="text-right">합계</span>
                </div>

                {rows.map(e => (
                  <div
                    key={e.id}
                    className={`grid grid-cols-4 px-4 py-2.5 items-center ${editing ? 'cursor-pointer hover:bg-gray-600' : ''} ${editTarget?.id === e.id ? 'bg-indigo-900/30' : ''}`}
                    onClick={() => editing && openEdit(e)}
                  >
                    <div>
                      <span className="text-sm font-medium text-white">{e.raid_name}</span>
                      <span className={`text-xs ml-1.5 ${DIFFICULTY_COLOR[e.difficulty] ?? 'text-gray-400'}`}>{e.difficulty}</span>
                    </div>
                    <span className="text-sm text-center text-gray-300">
                      {e.tradeable_gold > 0 ? e.tradeable_gold.toLocaleString() : <span className="text-gray-600">—</span>}
                    </span>
                    <span className="text-sm text-center text-gray-300">
                      {e.bound_gold > 0 ? e.bound_gold.toLocaleString() : <span className="text-gray-600">—</span>}
                    </span>
                    <span className="text-sm text-right font-medium text-yellow-400">
                      {(e.tradeable_gold + e.bound_gold).toLocaleString()}
                    </span>
                  </div>
                ))}

                {/* 합계 행 */}
                <div className="grid grid-cols-4 px-4 py-2.5 bg-gray-800">
                  <span className="text-xs text-gray-500 font-medium">합계</span>
                  <span className="text-xs text-center text-gray-400">{totalTradeable > 0 ? totalTradeable.toLocaleString() : '—'}</span>
                  <span className="text-xs text-center text-gray-400">{totalBound > 0 ? totalBound.toLocaleString() : '—'}</span>
                  <span className="text-sm text-right font-bold text-yellow-300">{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )
        })}

        {ilvlTiers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>데이터가 없습니다.</p>
            <p className="text-sm mt-1">✏️ 편집 버튼을 눌러 항목을 추가해주세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
