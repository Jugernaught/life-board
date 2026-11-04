import type { CollectionKey } from '@/data/types'
import { editor } from '@/components/editor/editorStore'
import { nav } from '../nav/navigator'

/**
 * Open any record on iPhone: records with their own detail screen are
 * pushed; everything else opens in an edit sheet.
 */
export function openRecord(key: CollectionKey, id: string) {
  switch (key) {
    case 'projects':
      return nav.push(`more/projects/${id}`)
    case 'habits':
      return nav.push(`habits/habit/${id}`)
    case 'goals':
      return nav.push(`habits/goal/${id}`)
    case 'skills':
      return nav.push(`more/learning/skill/${id}`)
    case 'careerPaths':
      return nav.push(`more/career/paths/${id}`)
    case 'academicCourses':
      return nav.push(`more/career/education/course/${id}`)
    case 'modules':
      return nav.push(`more/career/education/module/${id}`)
    case 'journal':
      return nav.push(`journal/entry/${id}`)
    default:
      return editor.edit(key, id)
  }
}
