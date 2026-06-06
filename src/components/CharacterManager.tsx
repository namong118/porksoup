import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Character, Member, Role } from '../types'

interface ClassItem { id: string; name: string; role: Role }

interface Props {
  member: Member
}

export default function CharacterManager({ member }: Props) {
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [targetMember, setTargetMember] = useState<Member>(member)
  const [characters, setCharacters] = useState<Character[]>([])
  const [classList, setClassList] = useState<ClassItem[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [itemLevel, setItemLevel] = useState<number | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    supabase.from('members').select('*').order('nickname').then(({ data }) => {
      if (data) setAllMembers(data)
    })
    supabase.from('classes').select('*').order('role').order('name').then(({ data }) => {
      if (data) {
        setClassList(data)
        if (data.length > 0) setSelectedClass(data.find(c => c.role === 'dps')?.name ?? data[0].name)
      }
    })
  }, [])

  useEffect(() => {
    supabase
      .from('characters')
      .select('*')
      .eq('member_id', targetMember.id)
      .order('name')
      .then(({ data }) => { if (data) setCharacters(data) })
    setAdding(false)
  }, [targetMember.id])

  const classRole = classList.find(c => c.name === selectedClass)?.role ?? 'dps'

  async function fetchLostArk() {
    if (!name.trim()) return
    setFetching(true)
    setFetchError('')
    setItemLevel(null)
    try {
      const res = await fetch(`/api/lostark?character=${encodeURIComponent(name.trim())}`)
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { setFetchError(`파싱오류 (${res.status}): ${text.slice(0, 100)}`); return }
      if (!res.ok) { setFetchError(data.error ?? '조회 실패'); return }
      setItemLevel(data.itemLevel)
      if (data.class && classList.some(c => c.name === data.class)) {
        setSelectedClass(data.class)
      }
    } catch (e: any) {
      setFetchError('네트워크오류: ' + (e?.message ?? String(e)))
    } finally {
      setFetching(false)
    }
  }

  async function addCharacter() {
    if (!name.trim()) return
    const role = classList.find(c => c.name === selectedClass)?.role ?? 'dps'
    const { data, error } = await supabase
      .from('characters')
      .insert({ member_id: targetMember.id, name: name.trim(), class: selectedClass, role, item_level: itemLevel })
      .select()
      .single()
    if (error) { alert('오류: ' + error.message); return }
    setCharacters(prev => [...prev, data])
    setName('')
    setItemLevel(null)
    setAdding(false)
  }

  async function deleteCharacter(id: string) {
    await supabase.from('characters').delete().eq('id', id)
    setCharacters(prev => prev.filter(c => c.id !== id))
  }

  const isMyself = targetMember.id === member.id

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">캐릭터 관리</h2>
        <button
          onClick={() => setAdding(true)}
          className="bg-blue-600 hover:bg-blue-500 text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          + 캐릭터 추가
        </button>
      </div>

      {/* 멤버 선택 */}
      <div className="bg-gray-700 rounded-xl p-3 mb-4">
        <p className="text-xs text-gray-400 mb-2">누구의 캐릭터를 관리할까요?</p>
        <div className="flex flex-wrap gap-2">
          {allMembers.map(m => (
            <button
              key={m.id}
              onClick={() => setTargetMember(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${targetMember.id === m.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
            >
              {m.nickname}
              {m.id === member.id && <span className="ml-1 text-xs opacity-70">(나)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 멤버 표시 */}
      {!isMyself && (
        <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-xs text-yellow-400">
            <span className="font-bold">{targetMember.nickname}</span>의 캐릭터를 관리 중입니다.
          </p>
        </div>
      )}

      {adding && (
        <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setItemLevel(null); setFetchError('') }}
              onKeyDown={e => e.key === 'Enter' && fetchLostArk()}
              placeholder={`${targetMember.nickname}의 캐릭터 닉네임`}
              className="flex-1 bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
            />
            <button
              onClick={fetchLostArk}
              disabled={!name.trim() || fetching}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
            >
              {fetching ? '조회중...' : '🔍 조회'}
            </button>
          </div>
          {itemLevel !== null && (
            <div className="text-xs text-yellow-400">✅ 템레벨 {itemLevel.toLocaleString()} — 직업이 자동으로 선택됐어요</div>
          )}
          {fetchError && <div className="text-xs text-red-400">⚠️ {fetchError}</div>}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
          >
            <optgroup label="서포터">
              {classList.filter(c => c.role === 'support').map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="딜러">
              {classList.filter(c => c.role === 'dps').map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
          </select>
          <div className="text-xs text-gray-400">
            역할: <span className={classRole === 'support' ? 'text-green-400' : 'text-orange-400'}>
              {classRole === 'support' ? '서포터' : '딜러'}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={addCharacter} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg text-sm font-medium">추가</button>
            <button onClick={() => setAdding(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">등록된 캐릭터가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {characters.map(c => (
            <div key={c.id} className="bg-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-gray-400 ml-2">{c.class}</span>
                {c.item_level && (
                  <span className="text-xs text-yellow-400 ml-2">{Number(c.item_level).toLocaleString()}</span>
                )}
                <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${c.role === 'support' ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}`}>
                  {c.role === 'support' ? '서포터' : '딜러'}
                </span>
              </div>
              <button
                onClick={() => deleteCharacter(c.id)}
                className="text-gray-500 hover:text-red-400 text-sm transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
