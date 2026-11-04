import {
  Briefcase,
  CalendarClock,
  ChartSpline,
  Dumbbell,
  FolderKanban,
  Library,
  NotebookPen,
  Radar,
  Settings,
  Target,
  Users,
  Wallet,
  BrainCircuit,
  type LucideIcon,
} from 'lucide-react'
import type { SectionId } from '@/data/registry'

export interface NavItem {
  id: SectionId
  label: string
  path: string
  icon: LucideIcon
  /** Second key of the "g then …" navigation shortcut. */
  key: string
  description: string
  group: 'core' | 'life' | 'system'
}

/** The 13 sections, in the order they appear in the sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'command', label: 'Command Centre', path: '/', icon: Radar, key: 'h', description: 'Your day at a glance', group: 'core' },
  { id: 'career', label: 'Career & Education', path: '/career', icon: Briefcase, key: 'c', description: 'Paths, study, applications', group: 'life' },
  { id: 'projects', label: 'Projects & Business', path: '/projects', icon: FolderKanban, key: 'p', description: 'Ventures and experiments', group: 'life' },
  { id: 'finance', label: 'Personal Finances', path: '/finance', icon: Wallet, key: 'f', description: 'Money in, money out', group: 'life' },
  { id: 'fitness', label: 'Fitness & Routines', path: '/fitness', icon: Dumbbell, key: 'w', description: 'Movement, sleep, routines', group: 'life' },
  { id: 'goals', label: 'Goals & Habits', path: '/goals', icon: Target, key: 'g', description: 'Objectives and streaks', group: 'life' },
  { id: 'learning', label: 'Learning & Skills', path: '/learning', icon: BrainCircuit, key: 'l', description: 'Skills, courses, study time', group: 'life' },
  { id: 'journal', label: 'Journal & Reflections', path: '/journal', icon: NotebookPen, key: 'j', description: 'Private writing and check-ins', group: 'life' },
  { id: 'schedule', label: 'Daily Schedule', path: '/schedule', icon: CalendarClock, key: 's', description: 'Calendar, tasks, time blocks', group: 'life' },
  { id: 'library', label: 'Reading & Media', path: '/library', icon: Library, key: 'r', description: 'Books, films, podcasts', group: 'life' },
  { id: 'social', label: 'Social Life', path: '/social', icon: Users, key: 'o', description: 'People and occasions', group: 'life' },
  { id: 'analytics', label: 'Analytics & Reports', path: '/analytics', icon: ChartSpline, key: 'a', description: 'Trends from your data', group: 'system' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, key: ',', description: 'Preferences and data', group: 'system' },
]

export const navItem = (id: SectionId) => NAV_ITEMS.find((n) => n.id === id) as NavItem
export const navIndex = (id: SectionId) => String(NAV_ITEMS.findIndex((n) => n.id === id) + 1).padStart(2, '0')
