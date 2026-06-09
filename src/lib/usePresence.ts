import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { Member } from '../types'

export interface OnlineMember {
  id: string
  nickname: string
  color: string
}

export function usePresence(member: Member | null) {
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([])

  useEffect(() => {
    if (!member) {
      setOnlineMembers([])
      return
    }

    const channel = supabase.channel('presence:online', {
      config: { presence: { key: member.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlineMember>()
        const seen = new Set<string>()
        const members = Object.values(state).flat().filter(m => {
          if (seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })
        setOnlineMembers(members)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: member.id,
            nickname: member.nickname,
            color: member.color,
          })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [member?.id])

  return onlineMembers
}
