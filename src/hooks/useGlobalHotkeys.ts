import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { NAV_ITEMS } from '@/app/navigation'
import { isTypingTarget } from '@/lib/utils'
import { actions } from '@/store/store'
import { useUI } from '@/components/command/uiStore'
import { useEditorStore } from '@/components/editor/editorStore'

/**
 * App-wide keyboard shortcuts. Single-key shortcuts are ignored while typing
 * or while a dialog is open, so they never interfere with writing.
 */
export function useGlobalHotkeys() {
  const navigate = useNavigate()
  useEffect(() => {
    let pendingG = 0
    const dialogOpen = () => !!document.querySelector('[role="dialog"]')
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState()
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.setPalette(!ui.paletteOpen)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || dialogOpen() || useEditorStore.getState().stack.length) return
      const key = e.key
      if (Date.now() - pendingG < 1200) {
        pendingG = 0
        const item = NAV_ITEMS.find((n) => n.key === key.toLowerCase())
        if (item) {
          e.preventDefault()
          navigate(item.path)
        }
        return
      }
      if (key === 'g' || key === 'G') {
        pendingG = Date.now()
      } else if (key === '/') {
        e.preventDefault()
        ui.setPalette(true)
      } else if (key === 'n' || key === 'N') {
        e.preventDefault()
        ui.showQuickAdd()
      } else if (key === '?') {
        e.preventDefault()
        ui.setHelp(true)
      } else if (key === '[') {
        e.preventDefault()
        const s = actions.getDb().settings
        actions.updateSettings({ sidebarCollapsed: !s.sidebarCollapsed })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
