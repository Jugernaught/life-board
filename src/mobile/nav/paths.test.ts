import { beforeEach, describe, expect, it } from 'vitest'
import { buildStack, matchPath, pathFromHash } from './paths'
import { useNav } from './navigator'

describe('paths', () => {
  it('matches static and parameterised screens', () => {
    expect(matchPath('more/projects')?.pattern).toBe('more/projects')
    expect(matchPath('more/projects/abc')).toEqual({ pattern: 'more/projects/:id', params: { id: 'abc' } })
    expect(matchPath('habits/goal/x%20y')?.params.id).toBe('x y')
    expect(matchPath('more/nope')).toBeNull()
  })
  it('builds the stack of screens leading to a path', () => {
    expect(buildStack('more/finance/transactions')).toEqual(['more', 'more/finance', 'more/finance/transactions'])
    expect(buildStack('habits/goal/1')).toEqual(['habits', 'habits/goal/1'])
    expect(buildStack('more/learning/skill/9')).toEqual(['more', 'more/learning', 'more/learning/skill/9'])
    expect(buildStack('more/career/education/module/m1')).toEqual(['more', 'more/career', 'more/career/education', 'more/career/education/module/m1'])
    expect(buildStack('more/career/paths/p1')).toEqual(['more', 'more/career', 'more/career/paths', 'more/career/paths/p1'])
  })
  it('only accepts valid hashes', () => {
    expect(pathFromHash('#/more/projects/abc')).toBe('more/projects/abc')
    expect(pathFromHash('#/today/')).toBe('today')
    expect(pathFromHash('#/admin')).toBeNull()
    expect(pathFromHash('')).toBeNull()
  })
})

describe('navigator', () => {
  beforeEach(() => useNav.getState().reset())
  const paths = (tab: 'today' | 'more' | 'habits') => useNav.getState().stacks[tab].map((e) => e.path)

  it('pushes children, pops, and keeps each tab’s own stack', () => {
    const n = useNav.getState()
    n.switchTab('more')
    n.push('more/finance')
    n.push('more/finance/budgets')
    expect(paths('more')).toEqual(['more', 'more/finance', 'more/finance/budgets'])
    useNav.getState().pop() // no animation controller mounted → immediate
    expect(paths('more')).toEqual(['more', 'more/finance'])
    useNav.getState().switchTab('today')
    useNav.getState().switchTab('more')
    expect(paths('more')).toEqual(['more', 'more/finance'])
  })

  it('opening a screen in another tab switches tab and builds the stack', () => {
    useNav.getState().push('habits/goal/123')
    expect(useNav.getState().tab).toBe('habits')
    expect(paths('habits')).toEqual(['habits', 'habits/goal/123'])
    expect(paths('today')).toEqual(['today'])
  })

  it('pushes on top of the current screen and pops back to a screen already in the stack', () => {
    useNav.getState().switchTab('more')
    useNav.getState().push('more/projects')
    const key = useNav.getState().stacks.more[1].key
    useNav.getState().push('more/projects/p1')
    useNav.getState().push('more/projects/p2') // a linked record: pushed, Back returns to p1
    expect(paths('more')).toEqual(['more', 'more/projects', 'more/projects/p1', 'more/projects/p2'])
    useNav.getState().push('more/projects') // already in the stack → pop back to it
    expect(paths('more')).toEqual(['more', 'more/projects'])
    expect(useNav.getState().stacks.more[1].key).toBe(key)
    useNav.getState().push('more/projects') // already on top → no-op
    expect(paths('more')).toEqual(['more', 'more/projects'])
  })

  it('keeps existing entries (and their scroll state) when rebuilding another tab', () => {
    useNav.getState().push('more/projects')
    const key = useNav.getState().stacks.more[1].key
    useNav.getState().switchTab('today')
    useNav.getState().push('more/projects/p2')
    expect(useNav.getState().tab).toBe('more')
    expect(paths('more')).toEqual(['more', 'more/projects', 'more/projects/p2'])
    expect(useNav.getState().stacks.more[1].key).toBe(key)
  })

  it('ignores unknown paths', () => {
    useNav.getState().push('more/nope')
    useNav.getState().push('nowhere')
    expect(useNav.getState().tab).toBe('today')
    expect(paths('more')).toEqual(['more'])
  })

  it('pops to root and ignores pops at the root', () => {
    useNav.getState().push('more/career/education')
    useNav.getState().popToRoot('more')
    expect(paths('more')).toEqual(['more'])
    useNav.getState().pop()
    expect(paths('more')).toEqual(['more'])
  })
})
