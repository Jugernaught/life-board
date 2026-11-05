import { describe, expect, it } from 'vitest'
import { createEmptyDatabase } from '@/data/defaults'
import { nextDueDate } from '@/lib/recurrence'
import { ValidationError, createAppStore } from './store'

const fresh = () => createAppStore(createEmptyDatabase()).getState

describe('store CRUD', () => {
  it('creates records with ids, timestamps and defaults, and logs activity', () => {
    const get = fresh()
    const task = get().create('tasks', { title: 'Write report' })
    expect(task.id).toBeTruthy()
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('medium')
    expect(get().db.tasks).toHaveLength(1)
    expect(get().db.activity[0]).toMatchObject({ action: 'created', collection: 'tasks', entityId: task.id, label: 'Write report' })
  })

  it('rejects invalid input with a ValidationError and leaves data unchanged', () => {
    const get = fresh()
    expect(() => get().create('tasks', { title: '   ' })).toThrow(ValidationError)
    expect(() => get().create('transactions', { kind: 'expense', amount: -5, date: '2026-01-01', category: 'Food' })).toThrow(ValidationError)
    expect(get().db.tasks).toHaveLength(0)
    expect(get().db.transactions).toHaveLength(0)
  })

  it('stamps completedAt when a task is completed and clears it when reopened', () => {
    const get = fresh()
    const t = get().create('tasks', { title: 'A' })
    const done = get().update('tasks', t.id, { status: 'done' })!
    expect(done.completedAt).toBeTruthy()
    expect(get().db.activity[0].action).toBe('completed')
    const reopened = get().update('tasks', t.id, { status: 'todo' })!
    expect(reopened.completedAt).toBeUndefined()
    expect(get().db.activity[0].action).toBe('reopened')
  })

  it('records application status history', () => {
    const get = fresh()
    const a = get().create('applications', { company: 'Acme', role: 'Engineer', status: 'applied' })
    expect(a.statusHistory.map((h) => h.status)).toEqual(['applied'])
    const b = get().update('applications', a.id, { status: 'interviewing' })!
    expect(b.statusHistory.map((h) => h.status)).toEqual(['applied', 'interviewing'])
  })

  it('records goal progress history', () => {
    const get = fresh()
    const g = get().create('goals', { title: 'Run 5k', progress: 10 })
    expect(g.history).toHaveLength(1)
    const g2 = get().update('goals', g.id, { progress: 40 })!
    // same day edits collapse into one point
    expect(g2.history[g2.history.length - 1].progress).toBe(40)
  })

  it('unlinks (never deletes) related records and undo restores both', () => {
    const get = fresh()
    const p = get().create('projects', { name: 'Side project' })
    const t = get().create('tasks', { title: 'Task in project', projectId: p.id })
    const token = get().remove('projects', p.id)!
    expect(get().db.projects).toHaveLength(0)
    expect(get().db.tasks).toHaveLength(1)
    expect(get().db.tasks[0].projectId).toBeUndefined()
    expect(token.unlinked).toEqual([{ key: 'tasks', id: t.id, field: 'projectId', value: p.id }])
    get().undo(token)
    expect(get().db.projects).toHaveLength(1)
    expect(get().db.tasks[0].projectId).toBe(p.id)
    expect(get().db.activity[0].action).toBe('restored')
  })

  it('updates via a function patch and ignores unknown ids', () => {
    const get = fresh()
    const h = get().create('habits', { name: 'Read', startDate: '2026-01-01' })
    get().update('habits', h.id, (cur) => ({ log: [...cur.log, '2026-01-02'] }))
    expect(get().db.habits[0].log).toEqual(['2026-01-02'])
    expect(get().update('habits', 'missing', { name: 'x' })).toBeUndefined()
  })

  it('collapses rapid repeated updates of the same record into one activity entry', () => {
    const get = fresh()
    const t = get().create('tasks', { title: 'A' })
    get().update('tasks', t.id, { title: 'B' })
    get().update('tasks', t.id, { title: 'C' })
    const updates = get().db.activity.filter((a) => a.action === 'updated')
    expect(updates).toHaveLength(1)
    expect(updates[0].label).toBe('C')
  })

  it('normalises settings on update', () => {
    const get = fresh()
    get().updateSettings({ displayName: 'Sam' })
    expect(get().db.settings.displayName).toBe('Sam')
    expect(get().db.settings.dashboard.length).toBeGreaterThan(5)
  })
})

describe('undo history and repeating tasks', () => {
  it('undoes edits, completions, creations and deletions — newest first', () => {
    const s = fresh()
    const t = s().create('tasks', { title: 'Write report' })
    s().update('tasks', t.id, { title: 'Write the report' })
    s().update('tasks', t.id, { status: 'done' })
    expect(s().db.tasks[0].status).toBe('done')
    expect(s().undoLast()?.change.kind).toBe('update')
    expect(s().db.tasks[0]).toMatchObject({ status: 'todo', title: 'Write the report' })
    s().undoLast()
    expect(s().db.tasks[0].title).toBe('Write report')
    s().undoLast()
    expect(s().db.tasks).toHaveLength(0)

    const u = s().create('tasks', { title: 'Keep me' })
    s().remove('tasks', u.id)
    expect(s().db.tasks).toHaveLength(0)
    s().undoLast()
    expect(s().db.tasks.map((x) => x.title)).toEqual(['Keep me'])
  })

  it('merges rapid edits of one record into a single undo step', () => {
    const s = fresh()
    const n = s().create('notes', { title: 'Idea', body: '' })
    for (const body of ['a', 'ab', 'abc']) s().update('notes', n.id, { body })
    s().undoLast()
    expect(s().db.notes[0].body).toBe('')
  })

  it('completing a repeating task creates exactly one next occurrence; undo removes it', () => {
    const s = fresh()
    const t = s().create('tasks', {
      title: 'Water plants',
      dueDate: '2020-01-06',
      repeat: { freq: 'weekly', interval: 1, days: [] },
      checklist: [{ id: 'c1', title: 'Balcony', done: true }],
    })
    s().update('tasks', t.id, { status: 'done' })
    const open = s().db.tasks.filter((x) => x.status !== 'done')
    expect(open).toHaveLength(1)
    expect(open[0].id).not.toBe(t.id)
    expect(open[0].dueDate! > '2020-01-06').toBe(true)
    expect(open[0].dueDate! > new Date().toISOString().slice(0, 10) || open[0].dueDate === undefined).toBe(true)
    expect(open[0].checklist[0].done).toBe(false)
    expect(open[0].repeat?.freq).toBe('weekly')
    // Re-saving the completed task doesn't spawn again.
    s().update('tasks', t.id, { notes: 'done' })
    expect(s().db.tasks).toHaveLength(2)
    s().undoLast() // notes edit
    s().undoLast() // completion + spawn
    expect(s().db.tasks).toHaveLength(1)
    expect(s().db.tasks[0].status).toBe('todo')
  })

  it('a delete undone from its notification is removed from the history', () => {
    const s = fresh()
    const t = s().create('tasks', { title: 'Temp' })
    const token = s().remove('tasks', t.id)!
    s().undo(token)
    expect(s().history.some((c) => c.kind === 'delete')).toBe(false)
  })
})

describe('revisions, deletion markers and safe undo', () => {
  it('counts revisions and remembers deletions until they are undone', () => {
    const s = fresh()
    const t = s().create('tasks', { title: 'Plan trip' })
    expect(t.rev).toBe(1)
    expect(s().update('tasks', t.id, { title: 'Plan the trip' })?.rev).toBe(2)
    s().remove('tasks', t.id)
    expect(s().db.deletions).toEqual([expect.objectContaining({ key: 'tasks', id: t.id, rev: 2 })])
    s().undoLast()
    // Restoring is a new revision, above the deletion's — and the marker is gone.
    expect(s().db.tasks[0]).toMatchObject({ id: t.id, title: 'Plan the trip', rev: 3 })
    expect(s().db.deletions).toEqual([])
  })

  it('refuses to undo a change once the record has been changed again, without losing anything', () => {
    const s = fresh()
    const t = s().create('tasks', { title: 'Draft' })
    s().update('tasks', t.id, { title: 'Draft v2' })
    const titleChange = s().history.at(-1)!
    s().update('tasks', t.id, { status: 'done' })
    // Undoing the older title change would overwrite the completion: refused, nothing changes.
    expect(s().undoChange(titleChange.id)).toBe(false)
    expect(s().db.tasks[0]).toMatchObject({ title: 'Draft v2', status: 'done' })
    // Newest first still works, step by step, all the way back to before it was added.
    expect(s().undoLast()).toMatchObject({ undone: true })
    expect(s().db.tasks[0]).toMatchObject({ title: 'Draft v2', status: 'todo' })
    expect(s().undoLast()).toMatchObject({ undone: true })
    expect(s().db.tasks[0].title).toBe('Draft')
    expect(s().undoLast()).toMatchObject({ undone: true, change: expect.objectContaining({ kind: 'create' }) })
    expect(s().db.tasks).toHaveLength(0)
    expect(s().db.deletions.map((m) => m.id)).toEqual([t.id])
  })

  it('refuses to undo adding a record that was edited since, and drops the stale step', () => {
    const s = fresh()
    const n = s().create('notes', { title: 'Idea', body: '' })
    const add = s().history.at(-1)!
    s().update('notes', n.id, { body: 'Worked on it' }, { action: 'updated' })
    expect(s().undoChange(add.id)).toBe(false)
    expect(s().db.notes).toHaveLength(1)
    // The repeating-task copy starts fresh at revision 1.
    const r = s().create('tasks', { title: 'Water plants', repeat: { freq: 'daily', interval: 1, days: [] }, dueDate: '2026-11-05' })
    s().update('tasks', r.id, { status: 'done' })
    expect(s().db.tasks.find((x) => x.id !== r.id && x.title === 'Water plants')?.rev).toBe(1)
  })
})

describe('completion rules apply on every path', () => {
  it('library items and courses get (and lose) their finished date wherever they are changed', () => {
    const s = fresh()
    const today = new Date().toISOString().slice(0, 10)
    const book = s().create('media', { title: 'Deep Work', status: 'in_progress' })
    expect(book.completedDate).toBeUndefined()
    expect(s().update('media', book.id, { status: 'completed' })?.completedDate).toBe(today)
    // A date you chose is kept; abandoning keeps it; going back to "want" clears it.
    expect(s().update('media', book.id, { completedDate: '2026-10-01' })?.completedDate).toBe('2026-10-01')
    expect(s().update('media', book.id, { status: 'abandoned' })?.completedDate).toBe('2026-10-01')
    expect(s().update('media', book.id, { status: 'want' })?.completedDate).toBeUndefined()
    const course = s().create('learningCourses', { title: 'TypeScript', status: 'completed' })
    expect(course.completedDate).toBe(today)
    expect(s().update('learningCourses', course.id, { status: 'in_progress' })?.completedDate).toBeUndefined()
  })

  it('completing a goal records 100% in its history once', () => {
    const s = fresh()
    const g = s().create('goals', { title: 'Run 10k', progress: 40 })
    const done = s().update('goals', g.id, { status: 'completed' })!
    expect(done.history.at(-1)?.progress).toBe(100)
    // Same day: a second change collapses into that point rather than adding another.
    const again = s().update('goals', g.id, { description: 'Done in 58 min' })!
    expect(again.history.filter((h) => h.progress === 100)).toHaveLength(1)
  })
})

describe('group B: links and repeating series', () => {
  it('undoing an add unlinks anything linked to it since (as a delete would)', () => {
    const s = fresh()
    const p = s().create('projects', { name: 'Launch' })
    const addProject = s().history.at(-1)!
    const t = s().create('tasks', { title: 'Write copy', projectId: p.id })
    expect(s().undoChange(addProject.id)).toBe(true)
    expect(s().db.projects).toHaveLength(0)
    const task = s().db.tasks.find((x) => x.id === t.id)!
    expect(task.projectId).toBeUndefined()
    expect(task.rev).toBe(2)
  })

  it('completing, reopening and completing a repeating task again makes one next occurrence, in one series', () => {
    const s = fresh()
    const r = s().create('tasks', { title: 'Bins out', repeat: { freq: 'weekly', interval: 1, days: [] }, dueDate: '2026-11-05' })
    s().update('tasks', r.id, { status: 'done' })
    s().update('tasks', r.id, { status: 'todo' })
    s().update('tasks', r.id, { status: 'done' })
    const copies = s().db.tasks.filter((t) => t.id !== r.id)
    expect(copies).toHaveLength(1)
    expect(copies[0].seriesId).toBe(r.id)
    // Its own completion continues the same series.
    s().update('tasks', copies[0].id, { status: 'done' })
    expect(s().db.tasks.filter((t) => t.status !== 'done').map((t) => t.seriesId)).toEqual([r.id])
  })

  it('treats older copies (from before series ids) as the same series', () => {
    const s = fresh()
    const r = s().create('tasks', { title: 'Pay rent', repeat: { freq: 'monthly', interval: 1, days: [] }, dueDate: '2026-11-01' })
    const next = nextDueDate({ freq: 'monthly', interval: 1, days: [] }, '2026-11-01', new Date().toISOString().slice(0, 10))
    s().create('tasks', { title: 'Pay rent', repeat: { freq: 'monthly', interval: 1, days: [] }, dueDate: next })
    s().update('tasks', r.id, { status: 'done' })
    expect(s().db.tasks.filter((t) => t.title === 'Pay rent' && t.status !== 'done')).toHaveLength(1)
  })
})
