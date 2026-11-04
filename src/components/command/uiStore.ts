import { create } from 'zustand'
import type { CollectionKey } from '@/data/types'

export type QuickAddType = Extract<CollectionKey, 'tasks' | 'events' | 'goals' | 'notes' | 'transactions' | 'journal' | 'workouts' | 'studySessions' | 'checkIns' | 'media' | 'habits'>

interface UIState {
  paletteOpen: boolean
  quickAdd: { open: boolean; type: QuickAddType; defaults?: Record<string, unknown> }
  helpOpen: boolean
  mobileNavOpen: boolean
  setPalette: (open: boolean) => void
  showQuickAdd: (type?: QuickAddType, defaults?: Record<string, unknown>) => void
  hideQuickAdd: () => void
  setHelp: (open: boolean) => void
  setMobileNav: (open: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  paletteOpen: false,
  quickAdd: { open: false, type: 'tasks' },
  helpOpen: false,
  mobileNavOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  showQuickAdd: (type, defaults) => set((s) => ({ quickAdd: { open: true, type: type ?? s.quickAdd.type, defaults }, paletteOpen: false })),
  hideQuickAdd: () => set((s) => ({ quickAdd: { ...s.quickAdd, open: false, defaults: undefined } })),
  setHelp: (helpOpen) => set({ helpOpen }),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
}))
