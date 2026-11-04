import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useApp, useSettings } from '@/store/store'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmHost } from '@/components/ui/confirm'
import { Toaster } from '@/components/ui/toast'
import { StartupNotice } from './StartupNotice'
import { RecoveryScreen } from './RecoveryScreen'
import { Splash } from './Splash'
import { ThemeController } from './ThemeController'

// Each section loads on demand, so the first screen appears quickly.
const CommandCentre = lazy(() => import('@/features/command-centre/CommandCentrePage'))
const Career = lazy(() => import('@/features/career/CareerPage'))
const Projects = lazy(() => import('@/features/projects/ProjectsPage'))
const ProjectDetail = lazy(() => import('@/features/projects/ProjectDetailPage'))
const Finance = lazy(() => import('@/features/finance/FinancePage'))
const Fitness = lazy(() => import('@/features/fitness/FitnessPage'))
const Goals = lazy(() => import('@/features/goals/GoalsPage'))
const Learning = lazy(() => import('@/features/learning/LearningPage'))
const Journal = lazy(() => import('@/features/journal/JournalPage'))
const Schedule = lazy(() => import('@/features/schedule/SchedulePage'))
const Library = lazy(() => import('@/features/library/LibraryPage'))
const Social = lazy(() => import('@/features/social/SocialPage'))
const Analytics = lazy(() => import('@/features/analytics/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const Onboarding = lazy(() => import('@/features/onboarding/Onboarding'))

function Gate() {
  const ready = useApp((s) => s.ready)
  const loadError = useApp((s) => s.loadError)
  const settings = useSettings()
  if (!ready) return <Splash />
  if (loadError) return <RecoveryScreen />
  if (!settings.onboarded) return <Onboarding />
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CommandCentre />} />
        <Route path="career" element={<Career />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="finance" element={<Finance />} />
        <Route path="fitness" element={<Fitness />} />
        <Route path="goals" element={<Goals />} />
        <Route path="learning" element={<Learning />} />
        <Route path="journal" element={<Journal />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="library" element={<Library />} />
        <Route path="social" element={<Social />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeController>
        <Gate />
        <StartupNotice />
        <ConfirmHost />
        <Toaster />
      </ThemeController>
    </BrowserRouter>
  )
}
