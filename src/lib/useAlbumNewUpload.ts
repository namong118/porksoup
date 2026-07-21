import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const SEEN_KEY = 'porksoup_album_last_seen'
const POLL_INTERVAL_MS = 60000

export function useAlbumNewUpload() {
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    function poll() {
      supabase
        .from('doodle_images')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return
          const seen = localStorage.getItem(SEEN_KEY)
          setHasNew(!seen || new Date(data.created_at) > new Date(seen))
        })
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  function markSeen() {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    setHasNew(false)
  }

  return { hasNew, markSeen }
}
