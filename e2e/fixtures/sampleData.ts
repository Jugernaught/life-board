/**
 * TEST FIXTURE — used only by the automated end-to-end tests and screenshot
 * checks. It is never bundled into the app or shown to users. Dates are
 * generated relative to "today" so charts and streaks have something to show.
 */
import { randomUUID } from 'node:crypto'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const day = (offset: number) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return iso(d)
}
const stamp = (offset: number, hour = 12) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const id = () => randomUUID()
const base = (offset = -30) => ({ id: id(), createdAt: stamp(offset), updatedAt: stamp(offset) })

export function buildSampleBackup() {
  const projectId = id()
  const project2 = id()
  const pathId = id()
  const courseId = id()
  const moduleA = id()
  const moduleB = id()
  const skillId = id()
  const skill2 = id()
  const appId = id()
  const personId = id()

  const tasks = [
    { ...base(-5), title: 'Draft investor one-pager', status: 'todo', priority: 'high', area: 'business', dueDate: day(0), projectId, focusDate: day(0), tags: [] },
    { ...base(-4), title: 'Review module 3 lecture notes', status: 'todo', priority: 'medium', area: 'career', dueDate: day(0), dueTime: '18:00', tags: [] },
    { ...base(-6), title: 'Renew passport', status: 'todo', priority: 'urgent', area: 'personal', dueDate: day(-2), tags: [] },
    { ...base(-3), title: 'Set up landing page analytics', status: 'todo', priority: 'medium', area: 'business', dueDate: day(3), projectId, tags: [] },
    { ...base(-10), title: 'Customer interviews x5', status: 'done', priority: 'high', area: 'business', projectId, completedAt: stamp(-2), tags: [] },
    { ...base(-9), title: 'Book dentist', status: 'done', priority: 'low', area: 'health', completedAt: stamp(-1), tags: [] },
    { ...base(-8), title: 'Write blog post outline', status: 'done', priority: 'medium', area: 'business', projectId: project2, completedAt: stamp(-6), tags: [] },
    { ...base(-2), title: 'Plan birthday dinner', status: 'todo', priority: 'medium', area: 'social', dueDate: day(5), tags: [] },
    ...Array.from({ length: 14 }, (_, i) => ({ ...base(-20 + i), title: `Admin task ${i + 1}`, status: 'done', priority: 'low', area: 'personal', completedAt: stamp(-14 + i), tags: [] })),
  ]

  const events = [
    { ...base(-2), title: 'Deep work: pitch deck', kind: 'block', area: 'business', date: day(0), allDay: false, startTime: '09:30', endTime: '11:30' },
    { ...base(-2), title: 'Team stand-up', kind: 'event', area: 'career', date: day(0), allDay: false, startTime: '10:00', endTime: '10:30' },
    { ...base(-2), title: 'Gym', kind: 'event', area: 'health', date: day(0), allDay: false, startTime: '18:00', endTime: '19:00' },
    { ...base(-2), title: 'Dinner with Sam', kind: 'event', area: 'social', date: day(2), allDay: false, startTime: '19:30', endTime: '21:30', location: 'Dishoom' },
    { ...base(-2), title: 'Grant application deadline', kind: 'deadline', area: 'business', date: day(4), allDay: true },
  ]

  const transactions: Record<string, unknown>[] = []
  for (let m = 0; m < 6; m++) {
    const d = (n: number) => day(-m * 30 - n)
    transactions.push({ ...base(-m * 30), kind: 'income', amount: 265000, date: d(1), category: 'Salary', description: 'Monthly salary' })
    transactions.push({ ...base(-m * 30), kind: 'expense', amount: 95000, date: d(2), category: 'Housing', description: 'Rent' })
    transactions.push({ ...base(-m * 30), kind: 'expense', amount: 22000 + m * 1500, date: d(5), category: 'Groceries', description: 'Weekly shop' })
    transactions.push({ ...base(-m * 30), kind: 'expense', amount: 6400 + m * 900, date: d(8), category: 'Eating Out' })
    transactions.push({ ...base(-m * 30), kind: 'expense', amount: 4500, date: d(10), category: 'Transport', description: 'Oyster top-up' })
    transactions.push({ ...base(-m * 30), kind: 'expense', amount: 1599, date: d(12), category: 'Subscriptions', description: 'Streaming' })
  }

  const habitLog = (every: number, days = 60) => Array.from({ length: days }, (_, i) => i).filter((i) => i % every !== 0).map((i) => day(-i))

  return {
    app: 'life-os',
    kind: 'backup',
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    data: {
      schemaVersion: 1,
      settings: { displayName: 'Test User', onboarded: true, targets: { weeklyWorkouts: 3, sleepHours: 7.5, weeklyLearningMinutes: 300, yearlyReading: 12, dailySteps: 8000 } },
      activity: [],
      tasks,
      events,
      notes: [
        { ...base(-3), title: 'Pricing ideas', body: 'Tiered: free, pro £8/mo, team. Test annual discount.', area: 'business', pinned: true, projectId, tags: [] },
        { ...base(-1), title: 'Book recommendations', body: 'Atomic Habits; Deep Work; The Mom Test', area: 'culture', pinned: false, tags: [] },
      ],
      projects: [
        {
          ...base(-40),
          id: projectId,
          name: 'Habit coaching app',
          description: 'Validate demand for a lightweight coaching app for students.',
          status: 'active',
          kind: 'business',
          priority: 'high',
          area: 'business',
          color: 'cyan',
          startDate: day(-40),
          deadline: day(45),
          objectives: [
            { id: id(), title: '20 customer interviews', done: false },
            { id: id(), title: 'Landing page with waitlist', done: true, doneAt: stamp(-10) },
          ],
          milestones: [
            { id: id(), title: 'Problem validated', done: true, doneAt: stamp(-12), dueDate: day(-12) },
            { id: id(), title: 'MVP prototype', done: false, dueDate: day(14) },
          ],
          resources: [{ id: id(), title: 'Figma board', url: 'https://figma.com' }],
        },
        { ...base(-60), id: project2, name: 'Personal blog', status: 'on_hold', kind: 'creative', priority: 'low', area: 'personal', color: 'violet', objectives: [], milestones: [{ id: id(), title: 'First 5 posts', done: false }], resources: [] },
        { ...base(-90), name: 'Kitchen garden', status: 'planning', kind: 'personal', priority: 'medium', area: 'personal', color: 'lime', objectives: [], milestones: [], resources: [] },
      ],
      careerPaths: [
        { ...base(-50), id: pathId, name: 'Product management', targetRole: 'Associate PM', status: 'active', color: 'cyan', roadmap: [{ id: id(), title: 'Ship a side project end-to-end', done: true, doneAt: stamp(-20) }, { id: id(), title: 'PM certification', done: false }], scores: { interest: 5, fit: 4, earnings: 4, growth: 5, balance: 3, access: 3 } },
        { ...base(-50), name: 'Data analysis', targetRole: 'Junior analyst', status: 'exploring', color: 'violet', roadmap: [{ id: id(), title: 'SQL course', done: false }], scores: { interest: 3, fit: 3, earnings: 4, growth: 3, balance: 4, access: 4 } },
      ],
      qualifications: [{ ...base(-100), title: 'Google Data Analytics Certificate', institution: 'Coursera', kind: 'certificate', status: 'in_progress' }],
      academicCourses: [{ ...base(-200), id: courseId, name: 'BSc Business Management', institution: 'University of Leeds', status: 'in_progress', targetGrade: 65 }],
      modules: [
        { ...base(-100), id: moduleA, name: 'Strategic Management', code: 'BM301', courseId, credits: 20, status: 'in_progress', targetGrade: 65 },
        { ...base(-100), id: moduleB, name: 'Marketing Analytics', code: 'BM305', courseId, credits: 20, status: 'in_progress' },
      ],
      assessments: [
        { ...base(-60), title: 'Case study essay', kind: 'assignment', moduleId: moduleA, dueDate: day(-20), weight: 40, status: 'graded', score: 68 },
        { ...base(-60), title: 'Final exam', kind: 'exam', moduleId: moduleA, dueDate: day(12), dueTime: '09:30', weight: 60, status: 'not_started' },
        { ...base(-60), title: 'Dashboard project', kind: 'project', moduleId: moduleB, dueDate: day(6), weight: 50, status: 'in_progress' },
      ],
      applications: [
        { ...base(-20), id: appId, company: 'Monzo', role: 'Product Analyst Intern', status: 'interviewing', appliedDate: day(-18), nextStep: 'Case interview', nextStepDate: day(3), careerPathId: pathId, statusHistory: [{ status: 'applied', at: stamp(-18) }, { status: 'interviewing', at: stamp(-5) }] },
        { ...base(-15), company: 'Ocado', role: 'Graduate PM', status: 'applied', appliedDate: day(-12), statusHistory: [{ status: 'applied', at: stamp(-12) }] },
        { ...base(-5), company: 'Wise', role: 'APM', status: 'wishlist', statusHistory: [{ status: 'wishlist', at: stamp(-5) }] },
      ],
      companies: [{ ...base(-20), name: 'Monzo', industry: 'Fintech', interest: 5, research: 'Strong product culture; values autonomy.', pros: 'Great mission', cons: 'Competitive' }],
      interviewQuestions: [{ ...base(-6), question: 'Tell me about a product you love and why', category: 'role', answer: 'Notion — flexible building blocks…', confidence: 3, applicationId: appId, practiceCount: 1, lastPractised: day(-2) }],
      careerMilestones: [
        { ...base(-30), title: 'Rewrite CV summary', kind: 'cv', done: true, doneAt: stamp(-8) },
        { ...base(-30), title: 'Portfolio case study #1', kind: 'portfolio', dueDate: day(10), done: false, careerPathId: pathId },
      ],
      transactions,
      budgets: [
        { ...base(-30), category: '*', limit: 180000 },
        { ...base(-30), category: 'Eating Out', limit: 8000 },
        { ...base(-30), category: 'Groceries', limit: 25000 },
      ],
      savingsGoals: [{ ...base(-120), name: 'Emergency fund', target: 300000, targetDate: day(180), color: 'lime', contributions: [{ id: id(), date: day(-90), amount: 40000 }, { id: id(), date: day(-60), amount: 40000 }, { id: id(), date: day(-30), amount: 50000 }, { id: id(), date: day(-2), amount: 30000 }], archived: false }],
      recurring: [{ ...base(-60), name: 'Rent', kind: 'expense', amount: 95000, category: 'Housing', frequency: 'monthly', nextDate: day(4), active: true }],
      financialTargets: [{ ...base(-30), name: 'Save £400 a month', metric: 'monthly_savings', amount: 40000 }],
      workouts: Array.from({ length: 16 }, (_, i) => ({ ...base(-i * 3), title: i % 2 ? '5k run' : 'Upper body', type: i % 2 ? 'cardio' : 'strength', date: day(-i * 3), durationMin: 35 + (i % 3) * 10, intensity: 'moderate', exercises: i % 2 ? [{ id: id(), name: 'Run', distanceKm: 5 + (i % 4) * 0.5 }] : [{ id: id(), name: 'Bench press', sets: 3, reps: 5, weightKg: 50 + i }] })),
      dailyActivity: Array.from({ length: 20 }, (_, i) => ({ ...base(-i), date: day(-i), steps: 5000 + ((i * 1371) % 7000), activeMinutes: 20 + (i % 5) * 8 })),
      sleep: Array.from({ length: 20 }, (_, i) => ({ ...base(-i), date: day(-i), bedTime: i % 3 ? '23:15' : '00:30', wakeTime: '07:10', quality: 3 + (i % 3) })),
      routines: [{ ...base(-30), name: 'Morning reset', timeOfDay: 'morning', days: [0, 1, 2, 3, 4, 5, 6], steps: [{ id: 'r1', title: 'Water' }, { id: 'r2', title: 'Stretch 5 min' }, { id: 'r3', title: 'Plan the day' }], active: true, log: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [day(-i - 1), i % 4 ? ['r1', 'r2', 'r3'] : ['r1']])) }],
      goals: [
        { ...base(-60), title: 'Run a 10k', horizon: 'quarterly', term: 'short', area: 'health', status: 'active', targetDate: day(40), progressMode: 'numeric', startValue: 3, targetValue: 10, currentValue: 6.5, unit: 'km', progress: 0, milestones: [], history: [{ at: stamp(-60), progress: 0 }, { at: stamp(-10), progress: 50 }] },
        { ...base(-40), title: 'Read 12 books this year', horizon: 'yearly', term: 'long', area: 'culture', status: 'active', progressMode: 'manual', progress: 40, milestones: [], history: [] },
        { ...base(-30), title: 'Launch MVP', horizon: 'quarterly', term: 'short', area: 'business', status: 'active', targetDate: day(30), progressMode: 'milestones', progress: 0, milestones: [{ id: id(), title: 'Wireframes', done: true, doneAt: stamp(-4) }, { id: id(), title: 'Beta users', done: false }], history: [] },
        { ...base(-80), title: 'Finish first aid course', horizon: 'monthly', term: 'short', area: 'personal', status: 'completed', completedAt: stamp(-3), progressMode: 'manual', progress: 100, milestones: [], history: [] },
      ],
      habits: [
        { ...base(-60), name: 'Read 20 minutes', area: 'culture', schedule: 'daily', days: [], timesPerWeek: 3, color: 'violet', startDate: day(-60), log: habitLog(4), archived: false },
        { ...base(-60), name: 'Meditate', area: 'wellbeing', schedule: 'daily', days: [], timesPerWeek: 3, color: 'cyan', startDate: day(-60), log: habitLog(3, 40), archived: false },
        { ...base(-60), name: 'Strength training', area: 'health', schedule: 'weekly', days: [], timesPerWeek: 3, color: 'magenta', startDate: day(-60), log: Array.from({ length: 20 }, (_, i) => day(-i * 3)), archived: false },
      ],
      weeklyReviews: [],
      skills: [
        { ...base(-90), id: skillId, name: 'SQL', category: 'Technical', status: 'active', level: 2, targetLevel: 4, levelHistory: [{ date: day(-90), level: 1 }, { date: day(-20), level: 2 }], roadmap: [{ id: id(), title: 'Joins & aggregation', done: true, doneAt: stamp(-25) }, { id: id(), title: 'Window functions', done: false }], color: 'cyan', objectives: 'Write analysis queries confidently.' },
        { ...base(-90), id: skill2, name: 'Public speaking', category: 'Communication', status: 'active', level: 1, targetLevel: 3, levelHistory: [], roadmap: [], color: 'magenta' },
      ],
      learningCourses: [{ ...base(-40), title: 'SQL for Data Analysis', provider: 'Udemy', skillId, status: 'in_progress', totalUnits: 40, completedUnits: 17 }],
      studySessions: Array.from({ length: 18 }, (_, i) => ({ ...base(-i * 2), date: day(-i * 2), durationMin: 30 + (i % 4) * 15, skillId: i % 3 ? skillId : skill2, topic: i % 3 ? 'SQL practice' : 'Speech rehearsal' })),
      resources: [{ ...base(-10), title: 'Mode SQL tutorial', url: 'https://mode.com/sql-tutorial', kind: 'docs', skillId, status: 'in_progress' }],
      journal: [
        { ...base(-1), date: day(-1), title: 'Momentum', body: 'Good focused morning. The customer call clarified the pricing question.', prompts: { wentWell: 'Deep work block', grateful: 'Supportive friends' }, lessons: 'Ask about budgets earlier.', tags: ['work'] },
        { ...base(-3), date: day(-3), body: 'Tired but got the essay feedback — 68%.', prompts: {}, achievements: 'Essay graded 68%', tags: [] },
      ],
      checkIns: Array.from({ length: 14 }, (_, i) => ({ ...base(-i), date: day(-i), at: stamp(-i, 20), mood: 3 + (i % 3 === 0 ? 1 : 0) - (i % 5 === 0 ? 1 : 0), energy: 2 + (i % 4) })),
      media: [
        { ...base(-30), title: 'Atomic Habits', creator: 'James Clear', type: 'book', category: 'Self-improvement', status: 'completed', startDate: day(-40), completedDate: day(-10), rating: 5, takeaways: ['Systems over goals', 'Make it obvious'] },
        { ...base(-10), title: 'The Mom Test', creator: 'Rob Fitzpatrick', type: 'book', status: 'in_progress', startDate: day(-8), progress: 90, total: 136, takeaways: [] },
        { ...base(-5), title: 'Hardcore History', creator: 'Dan Carlin', type: 'podcast', status: 'want', takeaways: [] },
        { ...base(-50), title: 'Free Solo', type: 'documentary', status: 'completed', completedDate: day(-45), rating: 4, takeaways: [] },
      ],
      people: [
        { ...base(-30), id: personId, name: 'Sam', circle: 'friend', lastContact: day(-20), cadenceDays: 14, contactLog: [day(-20)] },
        { ...base(-30), name: 'Gran', circle: 'family', lastContact: day(-3), cadenceDays: 7, contactLog: [day(-3)] },
      ],
      importantDates: [{ ...base(-30), title: "Sam's birthday", date: `1995-${day(9).slice(5)}`, kind: 'birthday', recurring: true, personId }],
    },
  }
}
