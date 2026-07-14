import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'
import { sha256Hex, getStoredUnlockHash, setStoredUnlockHash, clearStoredUnlockHash } from '../lib/editLock'

type Mode = 'loading' | 'not-admin' | 'setup' | 'locked' | 'unlocked'

export default function ScheduleEditLock({ member, onCanEditChange }: {
  member: Member | null | undefined
  onCanEditChange: (canEdit: boolean) => void
}) {
  const [mode, setMode] = useState<Mode>('loading')
  const [passwordHash, setPasswordHash] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [input2, setInput2] = useState('')
  const [error, setError] = useState('')
  const [changing, setChanging] = useState(false)
  const [changeCurrent, setChangeCurrent] = useState('')
  const [changeNew, setChangeNew] = useState('')
  const [changeNew2, setChangeNew2] = useState('')
  const [changeError, setChangeError] = useState('')

  const refresh = useCallback(async () => {
    if (!member) { setMode('not-admin'); onCanEditChange(false); return }
    const { data } = await supabase.from('members').select('is_admin, edit_password_hash').eq('id', member.id).single()
    if (!data?.is_admin) { setMode('not-admin'); onCanEditChange(false); return }
    setPasswordHash(data.edit_password_hash ?? null)
    if (!data.edit_password_hash) { setMode('setup'); onCanEditChange(false); return }
    const stored = getStoredUnlockHash(member.id)
    if (stored && stored === data.edit_password_hash) {
      setMode('unlocked'); onCanEditChange(true)
    } else {
      setMode('locked'); onCanEditChange(false)
    }
  }, [member, onCanEditChange])

  useEffect(() => { refresh() }, [refresh])

  if (mode === 'loading' || mode === 'not-admin') return null
  if (!member) return null

  async function submitSetup() {
    setError('')
    if (input.length < 4) { setError('4자 이상 입력하세요'); return }
    if (input !== input2) { setError('비밀번호가 서로 다릅니다'); return }
    const hash = await sha256Hex(input)
    const { error: dbError } = await supabase.from('members').update({ edit_password_hash: hash }).eq('id', member!.id)
    if (dbError) { setError('저장 실패: ' + dbError.message); return }
    setStoredUnlockHash(member!.id, hash)
    setPasswordHash(hash)
    setInput(''); setInput2('')
    setMode('unlocked')
    onCanEditChange(true)
  }

  async function submitUnlock() {
    setError('')
    const hash = await sha256Hex(input)
    if (hash !== passwordHash) { setError('비밀번호가 틀렸습니다'); return }
    setStoredUnlockHash(member!.id, hash)
    setInput('')
    setMode('unlocked')
    onCanEditChange(true)
  }

  function lockAgain() {
    clearStoredUnlockHash(member!.id)
    setMode('locked')
    onCanEditChange(false)
  }

  async function submitChangePassword() {
    setChangeError('')
    const currentHash = await sha256Hex(changeCurrent)
    if (currentHash !== passwordHash) { setChangeError('현재 비밀번호가 틀렸습니다'); return }
    if (changeNew.length < 4) { setChangeError('4자 이상 입력하세요'); return }
    if (changeNew !== changeNew2) { setChangeError('새 비밀번호가 서로 다릅니다'); return }
    const newHash = await sha256Hex(changeNew)
    const { error: dbError } = await supabase.from('members').update({ edit_password_hash: newHash }).eq('id', member!.id)
    if (dbError) { setChangeError('저장 실패: ' + dbError.message); return }
    setStoredUnlockHash(member!.id, newHash)
    setPasswordHash(newHash)
    setChangeCurrent(''); setChangeNew(''); setChangeNew2('')
    setChanging(false)
  }

  if (mode === 'setup') {
    return (
      <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-xl">
        <p className="text-xs text-yellow-300 font-medium mb-2">🔑 관리자 비밀번호를 처음 설정하세요 (본인만 사용)</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="password" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitSetup()}
            placeholder="새 비밀번호" className="bg-gray-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 ring-yellow-500 w-32" />
          <input type="password" value={input2} onChange={e => setInput2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitSetup()}
            placeholder="비밀번호 확인" className="bg-gray-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 ring-yellow-500 w-32" />
          <button onClick={submitSetup} className="text-xs bg-yellow-700 hover:bg-yellow-600 text-yellow-100 px-3 py-1 rounded-lg font-medium">설정</button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>
    )
  }

  if (mode === 'locked') {
    return (
      <div className="mb-4 p-3 bg-gray-700/60 border border-gray-600 rounded-xl">
        <p className="text-xs text-gray-300 font-medium mb-2">🔒 일정 수정은 잠겨 있습니다 — 비밀번호를 입력하세요</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="password" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitUnlock()}
            placeholder="비밀번호" className="bg-gray-800 rounded px-2 py-1 text-xs outline-none focus:ring-1 ring-blue-500 w-32" />
          <button onClick={submitUnlock} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-medium">잠금 해제</button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 p-3 bg-green-900/20 border border-green-700/40 rounded-xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-green-300 font-medium">🔓 수정 모드</span>
        <button onClick={lockAgain} className="text-xs text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600">다시 잠그기</button>
        <button onClick={() => setChanging(v => !v)} className="text-xs text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600">비밀번호 변경</button>
      </div>
      {changing && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input type="password" value={changeCurrent} onChange={e => setChangeCurrent(e.target.value)}
            placeholder="현재 비밀번호" className="bg-gray-800 rounded px-2 py-1 text-xs outline-none focus:ring-1 ring-blue-500 w-28" />
          <input type="password" value={changeNew} onChange={e => setChangeNew(e.target.value)}
            placeholder="새 비밀번호" className="bg-gray-800 rounded px-2 py-1 text-xs outline-none focus:ring-1 ring-blue-500 w-28" />
          <input type="password" value={changeNew2} onChange={e => setChangeNew2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitChangePassword()}
            placeholder="새 비밀번호 확인" className="bg-gray-800 rounded px-2 py-1 text-xs outline-none focus:ring-1 ring-blue-500 w-28" />
          <button onClick={submitChangePassword} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-medium">변경</button>
          {changeError && <span className="text-xs text-red-400">{changeError}</span>}
        </div>
      )}
    </div>
  )
}
