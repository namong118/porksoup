import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface BannerItem {
  id: string
  url: string
  created_at: string
}

export default function BannerGallery() {
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadBanners()
  }, [])

  async function loadBanners() {
    setLoading(true)
    const { data } = await supabase
      .from('banner_gallery')
      .select('*')
      .order('created_at', { ascending: false })
    setBanners(data || [])
    setLoading(false)
  }

  async function uploadBanner(file: File) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = `gallery_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('gallery').upload(filename, file)
    if (error) {
      alert(`업로드 실패: ${error.message}`)
      return
    }
    if (data) {
      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(data.path)
      const { data: inserted } = await supabase
        .from('banner_gallery')
        .insert({ url: urlData.publicUrl })
        .select()
        .single()
      if (inserted) {
        setBanners(prev => [inserted, ...prev])
      }
    }
  }

  async function handleFileSelect(files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) {
      await uploadBanner(file)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteBanner(id: string, url: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('이 배너를 삭제할까요?')) return
    const parts = url.split('/gallery/')
    if (parts[1]) {
      await supabase.storage.from('gallery').remove([parts[1]])
    }
    await supabase.from('banner_gallery').delete().eq('id', id)
    setBanners(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">🖼️ 배너 모아보기</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {uploading ? '업로드 중...' : '+ 배너 추가'}
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
      ) : banners.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-gray-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-5xl mb-3">🖼️</p>
          <p className="text-gray-400 font-medium">아직 배너가 없어요</p>
          <p className="text-gray-600 text-sm mt-1">클릭해서 첫 번째 배너를 추가해보세요!</p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {banners.map(banner => (
            <div
              key={banner.id}
              className="relative group break-inside-avoid rounded-lg overflow-hidden bg-gray-800 cursor-zoom-in"
              onClick={() => setExpanded(banner.url)}
            >
              <img
                src={banner.url}
                alt=""
                className="w-full object-cover block"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <button
                onClick={e => deleteBanner(banner.id, banner.url, e)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/70 text-red-400 text-xs px-2 py-1 rounded-md hover:bg-black/90 hover:text-red-300 transition-all"
              >
                🗑️
              </button>
            </div>
          ))}
          <div
            className="break-inside-avoid border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
            style={{ minHeight: '100px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-gray-600 text-sm hover:text-gray-400 transition-colors">+ 추가</span>
          </div>
        </div>
      )}

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-zoom-out"
          onClick={() => setExpanded(null)}
        >
          <img
            src={expanded}
            alt=""
            className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}
