import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

interface DoodleImage {
  id: string
  url: string
  member_id: string
  created_at: string
  member?: Member
}

interface DoodleComment {
  id: string
  image_id: string
  member_id: string
  content: string
  created_at: string
  member?: Member
}

interface DoodleReaction {
  id: string
  image_id: string
  member_id: string
  emoji: string
  member?: Member
}

function timeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

interface Props {
  member: Member
}

export default function PoksupAlbum({ member }: Props) {
  const [images, setImages] = useState<DoodleImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [openImage, setOpenImage] = useState<DoodleImage | null>(null)
  const [comments, setComments] = useState<DoodleComment[]>([])
  const [reactions, setReactions] = useState<DoodleReaction[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  const loadImages = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('doodle_images')
      .select('*, member:members(*)')
      .order('created_at', { ascending: false })
    setImages(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadImages() }, [loadImages])

  async function uploadImage(file: File) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `doodle_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('gallery').upload(filename, file)
    if (error) {
      alert(`업로드 실패: ${error.message}`)
      return
    }
    if (data) {
      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(data.path)
      const { data: inserted } = await supabase
        .from('doodle_images')
        .insert({ url: urlData.publicUrl, member_id: member.id })
        .select('*, member:members(*)')
        .single()
      if (inserted) setImages(prev => [inserted, ...prev])
    }
  }

  async function handleFileSelect(files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) {
      await uploadImage(file)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteImage(img: DoodleImage, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!confirm('이 사진을 삭제할까요? 댓글과 반응도 함께 삭제됩니다.')) return
    const parts = img.url.split('/gallery/')
    if (parts[1]) await supabase.storage.from('gallery').remove([parts[1]])
    await supabase.from('doodle_images').delete().eq('id', img.id)
    setImages(prev => prev.filter(i => i.id !== img.id))
    if (openImage?.id === img.id) closeDetail()
  }

  function closeDetail() {
    setOpenImage(null)
    setZoomed(false)
  }

  async function openDetail(img: DoodleImage) {
    setOpenImage(img)
    setZoomed(false)
    setDetailLoading(true)
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('doodle_comments').select('*, member:members(*)').eq('image_id', img.id).order('created_at'),
      supabase.from('doodle_reactions').select('*, member:members(*)').eq('image_id', img.id),
    ])
    setComments(c ?? [])
    setReactions(r ?? [])
    setDetailLoading(false)
  }

  async function toggleReaction(emoji: string) {
    if (!openImage) return
    const mine = reactions.find(r => r.emoji === emoji && r.member_id === member.id)
    if (mine) {
      await supabase.from('doodle_reactions').delete().eq('id', mine.id)
      setReactions(prev => prev.filter(r => r.id !== mine.id))
    } else {
      const { data } = await supabase
        .from('doodle_reactions')
        .insert({ image_id: openImage.id, member_id: member.id, emoji })
        .select('*, member:members(*)')
        .single()
      if (data) setReactions(prev => [...prev, data])
    }
  }

  async function submitComment() {
    if (!openImage || !commentDraft.trim()) return
    const { data } = await supabase
      .from('doodle_comments')
      .insert({ image_id: openImage.id, member_id: member.id, content: commentDraft.trim() })
      .select('*, member:members(*)')
      .single()
    if (data) {
      setComments(prev => [...prev, data])
      setCommentDraft('')
    }
  }

  async function deleteComment(comment: DoodleComment) {
    await supabase.from('doodle_comments').delete().eq('id', comment.id)
    setComments(prev => prev.filter(c => c.id !== comment.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">🗂️ 폭숲 앨범</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {uploading ? '업로드 중...' : '+ 사진 추가'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) handleFileSelect(e.target.files) }}
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">불러오는 중...</div>
      ) : images.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-gray-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-5xl mb-3">🗂️</p>
          <p className="text-gray-400 font-medium">아직 사진이 없어요</p>
          <p className="text-gray-600 text-sm mt-1">클릭해서 첫 번째 사진을 올려보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map(img => (
            <div
              key={img.id}
              className="relative group rounded-lg overflow-hidden bg-gray-800 cursor-pointer"
              style={{ aspectRatio: '1/1' }}
              onClick={() => openDetail(img)}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover block" loading="lazy" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              {img.member_id === member.id && (
                <button
                  onClick={e => deleteImage(img, e)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/70 text-red-400 text-xs px-2 py-1 rounded-md hover:bg-black/90 hover:text-red-300 transition-all"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {openImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => closeDetail()}
        >
          <div
            className="bg-gray-800 rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col sm:flex-row"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-black flex items-center justify-center sm:flex-1 min-h-0">
              <img
                src={openImage.url}
                alt=""
                onClick={() => setZoomed(true)}
                className="max-h-[45vh] sm:max-h-[90vh] w-full sm:w-auto object-contain cursor-zoom-in"
              />
            </div>

            <div className="w-full sm:w-80 flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
                <div>
                  <span className="font-medium" style={{ color: openImage.member?.color ?? '#e2e8f0' }}>
                    {openImage.member?.nickname ?? '알 수 없음'}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">{timeAgo(openImage.created_at)}</span>
                </div>
                <button onClick={() => closeDetail()} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
              </div>

              <div className="px-4 py-2.5 border-b border-gray-700 flex flex-wrap gap-1.5 shrink-0">
                {REACTION_EMOJIS.map(emoji => {
                  const emojiReactions = reactions.filter(r => r.emoji === emoji)
                  const mine = emojiReactions.some(r => r.member_id === member.id)
                  if (emojiReactions.length === 0 && !mine) {
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(emoji)}
                        className="text-sm px-2 py-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors opacity-60 hover:opacity-100"
                      >
                        {emoji}
                      </button>
                    )
                  }
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(emoji)}
                      title={emojiReactions.map(r => r.member?.nickname ?? '?').join(', ')}
                      className={`text-sm px-2 py-1 rounded-full transition-colors flex items-center gap-1
                        ${mine ? 'bg-blue-900/60 border border-blue-500 text-blue-200' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                    >
                      <span>{emoji}</span>
                      <span className="text-xs">{emojiReactions.length}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-[120px]">
                {detailLoading ? (
                  <div className="text-center text-gray-500 text-sm py-6">불러오는 중...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-gray-600 text-sm py-6">아직 댓글이 없어요</div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="text-sm">
                      <span className="font-medium" style={{ color: c.member?.color ?? '#e2e8f0' }}>{c.member?.nickname ?? '알 수 없음'}</span>
                      <span className="text-gray-300 ml-2 break-words">{c.content}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-600">{timeAgo(c.created_at)}</span>
                        {c.member_id === member.id && (
                          <button onClick={() => deleteComment(c)} className="text-xs text-gray-600 hover:text-red-400">삭제</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-3 py-2.5 border-t border-gray-700 flex items-center gap-2 shrink-0">
                <input
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment()}
                  placeholder="댓글 달기..."
                  className="flex-1 bg-gray-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ring-blue-500"
                />
                <button
                  onClick={submitComment}
                  disabled={!commentDraft.trim()}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-30 text-sm font-medium"
                >
                  게시
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomed && openImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <img
            src={openImage.url}
            alt=""
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
        </div>
      )}
    </div>
  )
}
