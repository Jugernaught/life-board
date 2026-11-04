import { create } from 'zustand'
import type { CollectionKey, Collections } from '@/data/types'

export type EditorRequest =
  | { mode: 'create'; key: CollectionKey; defaults?: Record<string, unknown>; onSaved?: (record: Collections[CollectionKey]) => void; title?: string }
  | { mode: 'edit'; key: CollectionKey; id: string; onSaved?: (record: Collections[CollectionKey]) => void; title?: string }

interface EditorState {
  stack: EditorRequest[]
  open: (r: EditorRequest) => void
  close: () => void
}

/** Global create/edit dialogs: any screen can open the form for any record. */
export const useEditorStore = create<EditorState>((set) => ({
  stack: [],
  open: (r) => set((s) => ({ stack: [...s.stack, r] })),
  close: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
}))

export const editor = {
  create: <K extends CollectionKey>(key: K, defaults?: Partial<Collections[K]> & Record<string, unknown>, opts?: { onSaved?: (r: Collections[K]) => void; title?: string }) =>
    useEditorStore.getState().open({ mode: 'create', key, defaults, onSaved: opts?.onSaved as never, title: opts?.title }),
  edit: <K extends CollectionKey>(key: K, id: string, opts?: { onSaved?: (r: Collections[K]) => void }) =>
    useEditorStore.getState().open({ mode: 'edit', key, id, onSaved: opts?.onSaved as never }),
}
