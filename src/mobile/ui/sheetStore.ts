import { create } from 'zustand'

/** How many sheets are open — the screen behind shrinks into a card while any are. */
export const useSheetDepth = create<{ depth: number; inc: () => void; dec: () => void }>((set) => ({
  depth: 0,
  inc: () => set((s) => ({ depth: s.depth + 1 })),
  dec: () => set((s) => ({ depth: Math.max(0, s.depth - 1) })),
}))
