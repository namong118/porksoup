import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'

interface Props {
  currentMember: Member | null
  onSelect: (member: Member) => void
}

export default function MemberSelect({ currentMember, onSelect }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [newNickname, setNewNickname] = useState('')
  const [adding, setAdding] = useState(false)

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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-2">🐷 돼지국밥 레이드</h1>
        <p className="text-gray-400 text-center text-sm mb-6">닉네임을 선택하세요</p>

        <div className="flex flex-col gap-2">
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => onSelect(m)}
              className={`w-full py-3 px-4 rounded-xl text-left font-medium transition-colors
                ${currentMember?.id === m.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
            >
              {m.nickname}
            </button>
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
