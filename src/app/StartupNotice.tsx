import { useEffect } from 'react'
import { appStore, useApp } from '@/store/store'
import { toast } from '@/components/ui/toast'

/** Surfaces one-off startup messages (e.g. records set aside during load). */
export function StartupNotice() {
  const notice = useApp((s) => s.notice)
  useEffect(() => {
    if (!notice) return
    toast({ title: 'Some data needed attention', description: notice, tone: 'warning', duration: 15000 })
    appStore.setState({ notice: undefined })
  }, [notice])
  return null
}
