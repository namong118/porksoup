import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Role } from '../types'
import { CLASSES } from '../types'

interface ClassItem {
  id: string
  name: string
  role: Role
  sort_order: number
}

export default function ClassManager() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', role: 'dps' as Role })
  const [editForm, setEditForm] = useState({ name: '', role: 'dps' as Role })
  const [initialized, setInitialized] = useState(false)

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('role').order('name')
    if (data) setClasses(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchClasses().then(() => setInitialized(true))
  }, [])

  // DB가 비어있으면 기본 직업 목록으로 초기화
  useEffect(() => {
    if (!initialized || classes.length > 0) return
    async function seed() {
      await supabase.from('classes').insert(
        CLASSES.map((c, i) => ({ name: c.name, role: c.role, sort_order: i }))
      )
      fetchClasses()
    }
    seed()
  }, [initialized, classes.length])

  async function addClass() {
    if (!form.name.trim()) return
    const { data, error } = await supabase
      .from('classes')
      .insert({ name: form.name.trim(), role: form.role })
      .select()
      .single()
    if (error) { alert('이미 있는 직업명입니다.'); return }
    setClasses(prev => [...prev, data].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)))
    setForm({ name: '', role: 'dps' })
    setAdding(false)
  }

  async function updateClass(id: string) {
    if (!editForm.name.trim()) return
    const { data, error } = await supabase
      .from('classes')
      .update({ name: editForm.name.trim(), role: editForm.role })
      .eq('id', id)
      .select()
      .single()
    if (error) { alert('이미 있는 직업명입니다.'); return }
    setClasses(prev => prev.map(c => c.id === id ? data : c))
    setEditingId(null)
  }

  async function deleteClass(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('classes').delete().eq('id', id)
    setClasses(prev => prev.filter(c => c.id !== id))
  }

  const supports = classes.filter(c => c.role === 'support')
  const dpsList = classes.filter(c => c.role === 'dps')

  if (loading) return <div className="text-center py-8 text-gray-500">불러오는 중...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">직업 관리</h2>
        <button
          onClick={() => setAdding(true)}
          className="bg-blue-600 hover:bg-blue-500 text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          + 직업 추가
        </button>
      </div>

      {adding && (
        <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addClass()}
            placeholder="직업 이름"
            className="bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setForm(p => ({ ...p, role: 'dps' }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${form.role === 'dps' ? 'bg-orange-700 text-orange-200' : 'bg-gray-600 text-gray-400'}`}
            >
              딜러
            </button>
            <button
              onClick={() => setForm(p => ({ ...p, role: 'support' }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${form.role === 'support' ? 'bg-green-700 text-green-200' : 'bg-gray-600 text-gray-400'}`}
            >
              서포터
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={addClass} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium">추가</button>
            <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      {[{ label: '서포터', list: supports, role: 'support' as Role }, { label: '딜러', list: dpsList, role: 'dps' as Role }].map(group => (
        <div key={group.role} className="mb-4">
          <p className={`text-xs font-semibold mb-2 ${group.role === 'support' ? 'text-green-400' : 'text-orange-400'}`}>
            {group.label} ({group.list.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {group.list.map(c => (
              <div key={c.id} className="bg-gray-700 rounded-xl px-4 py-2.5 flex items-center justify-between">
                {editingId === c.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={editForm.name}
                      onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && updateClass(c.id)}
                      className="bg-gray-600 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 ring-blue-500 flex-1"
                    />
                    <button
                      onClick={() => setEditForm(p => ({ ...p, role: p.role === 'dps' ? 'support' : 'dps' }))}
                      className={`text-xs px-2 py-1 rounded ${editForm.role === 'support' ? 'bg-green-800 text-green-300' : 'bg-orange-800 text-orange-300'}`}
                    >
                      {editForm.role === 'support' ? '서포터' : '딜러'}
                    </button>
                    <button onClick={() => updateClass(c.id)} className="text-blue-400 text-xs hover:text-blue-300">저장</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs hover:text-gray-300">취소</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium">{c.name}</span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setEditingId(c.id); setEditForm({ name: c.name, role: c.role }) }}
                        className="text-gray-400 hover:text-gray-200 text-xs transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deleteClass(c.id)}
                        className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
