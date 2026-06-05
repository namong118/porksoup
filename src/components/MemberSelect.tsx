import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'
import { MEMBER_COLORS } from '../types'

interface Props {
  currentMember: Member | null
  onSelect: (member: Member) => void
}

export default function MemberSelect({ currentMember, onSelect }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [newNickname, setNewNickname] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('members').select('*').order('nickname').then(({ data }) => {
      if (data) setMembers(data)
    })
  }, [])

  async function addMember() {
    if (!newNickname.trim()) return
    const { data, error } = await supabase
      .from('members')
      .insert({ nickname: newNickname.trim() })
      .select()
      .single()
    if (error) { alert('이미 있는 닉네임입니다.'); return }
    setMembers(prev => [...prev, data].sort((a, b) => a.nickname.localeCompare(b.nickname)))
    setNewNickname('')
    setAdding(false)
    onSelect(data)
  }

  async function updateMember(id: string) {
    if (!editValue.trim()) return
    const { data, error } = await supabase
      .from('members')
      .update({ nickname: editValue.trim() })
      .eq('id', id)
      .select()
      .single()
    if (error) { alert('이미 있는 닉네임입니다.'); return }
    setMembers(prev => prev.map(m => m.id === id ? data : m).sort((a, b) => a.nickname.localeCompare(b.nickname)))
    setEditingId(null)
  }

  async function deleteMember(id: string, nickname: string) {
    if (!confirm(`"${nickname}" 닉네임을 삭제할까요?\n해당 멤버의 캐릭터·스케줄 데이터도 함께 삭제됩니다.`)) return
    await supabase.from('members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  async function updateColor(id: string, color: string) {
    await supabase.from('members').update({ color }).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, color } : m))
    setColorPickerId(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-2">🐷 돼지국밥 레이드</h1>
        <p className="text-gray-400 text-center text-sm mb-6">닉네임을 선택하세요</p>

        <div className="flex flex-col gap-2">
          {members.map(m => (
            <div key={m.id} className="flex flex-col gap-1">
              {editingId === m.id ? (
                <div className="flex gap-2 flex-1">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') updateMember(m.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
                  />
                  <button onClick={() => updateMember(m.id)} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-sm">저장</button>
                  <button onClick={() => setEditingId(null)} className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-sm">취소</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* 색상 버튼 */}
                  <button
                    onClick={() => setColorPickerId(colorPickerId === m.id ? null : m.id)}
                    style={{ backgroundColor: m.color ?? '#94a3b8' }}
                    className="w-6 h-6 rounded-full shrink-0 hover:ring-2 ring-white transition-all"
                  />
                  <button
                    onClick={() => onSelect(m)}
                    style={currentMember?.id === m.id ? { borderColor: m.color ?? '#94a3b8' } : {}}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-left font-medium transition-colors border-2
                      ${currentMember?.id === m.id
                        ? 'text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-transparent'}`}
                    {...(currentMember?.id === m.id ? { style: { backgroundColor: `${m.color ?? '#94a3b8'}33`, borderColor: m.color ?? '#94a3b8' } } : {})}
                  >
                    {m.nickname}
                  </button>
                  <button
                    onClick={() => { setEditingId(m.id); setEditValue(m.nickname) }}
                    className="p-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200 transition-colors text-xs shrink-0"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => deleteMember(m.id, m.nickname)}
                    className="p-2.5 rounded-xl bg-gray-700 hover:bg-red-900 text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0"
                  >
                    삭제
                  </button>
                </div>
              )}

              {/* 색상 팔레트 */}
              {colorPickerId === m.id && (
                <div className="flex flex-wrap gap-2 px-8 py-2 bg-gray-700 rounded-xl">
                  {MEMBER_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateColor(m.id, c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110
                        ${(m.color ?? '#94a3b8') === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4">
          {adding ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newNickname}
                onChange={e => setNewNickname(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
                placeholder="닉네임 입력"
                className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
              />
              <button onClick={addMember} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">추가</button>
              <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-sm">취소</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              + 새 닉네임 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
