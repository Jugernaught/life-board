import { type ReactNode, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type MotionValue, animate, motion, motionValue, useTransform } from 'framer-motion'
import { useDatabase } from '@/store/store'
import { RouteContext } from '../ui/RouteContext'
import { ScreenLoading } from '../ui/ScreenLoading'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { type Entry, navControllers, useNav } from './navigator'
import { type TabId, matchPath } from './paths'
import { ROUTES, routeTitle } from './routes'

const PARALLAX = 0.3
const PUSH = { type: 'spring', stiffness: 380, damping: 40, mass: 1 } as const
const POP = { type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.32 } as const
const EDGE = 28

function useStageWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

const run = (mv: MotionValue<number>, to: number, transition: object) => new Promise<void>((resolve) => animate(mv, to, { ...transition, onComplete: () => resolve() }))

/**
 * One tab's navigation stack. Every screen in the stack stays mounted (so it
 * keeps its scroll position and state); the top screen is visible, the one
 * underneath sits 30% to the left for the parallax push/pop, others hidden.
 */
export function StackView({ tab, active }: { tab: TabId; active: boolean }) {
  const stack = useNav((s) => s.stacks[tab])
  const db = useDatabase()
  const width = useStageWidth()
  const xs = useRef(new Map<string, MotionValue<number>>())
  const prevKeys = useRef<string[] | null>(null)
  const busy = useRef(false)
  const gesture = useRef<{ id: number; startX: number; startY: number; active: boolean; lastX: number; lastT: number; v: number } | null>(null)

  const prev = prevKeys.current
  const isPush = prev !== null && stack.length === prev.length + 1 && prev.every((k, i) => stack[i]?.key === k)
  const n = stack.length
  stack.forEach((e, i) => {
    if (!xs.current.has(e.key)) xs.current.set(e.key, motionValue(i === n - 1 ? (isPush ? width : 0) : -PARALLAX * width))
  })
  const x = (key: string) => xs.current.get(key) as MotionValue<number>

  useLayoutEffect(() => {
    const count = stack.length
    if (isPush && count > 1) {
      void run(x(stack[count - 1].key), 0, PUSH)
      void run(x(stack[count - 2].key), -PARALLAX * width, PUSH)
    } else {
      stack.forEach((e, i) => {
        const mv = x(e.key)
        const target = i === count - 1 ? 0 : -PARALLAX * width
        if (!mv.isAnimating() && mv.get() !== target) mv.set(target)
      })
    }
    for (const k of [...xs.current.keys()]) if (!stack.some((e) => e.key === k)) xs.current.delete(k)
    prevKeys.current = stack.map((e) => e.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, width])

  const finishPop = async () => {
    const s = useNav.getState().stacks[tab]
    if (s.length < 2) return
    busy.current = true
    await Promise.all([run(x(s[s.length - 1].key), width, POP), run(x(s[s.length - 2].key), 0, POP)])
    useNav.getState().commitPop(tab)
    busy.current = false
  }

  useEffect(() => {
    navControllers[tab] = {
      pop: async () => {
        if (busy.current) return
        await finishPop()
      },
    }
    return () => {
      delete navControllers[tab]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, width])

  // Edge-swipe back: starts only after a clear horizontal movement from the
  // left edge, so taps on the back button still work.
  const onPointerDown = (e: React.PointerEvent) => {
    if (stack.length < 2 || busy.current || e.clientX > EDGE) return
    gesture.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, active: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null
        return
      }
      if (dx < 10) return
      g.active = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    const d = Math.max(0, dx)
    const dt = Math.max(1, e.timeStamp - g.lastT)
    g.v = (e.clientX - g.lastX) / dt
    g.lastX = e.clientX
    g.lastT = e.timeStamp
    x(stack[stack.length - 1].key).set(d)
    x(stack[stack.length - 2].key).set(-PARALLAX * width + PARALLAX * d)
  }
  const onPointerEnd = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g || !g.active || g.id !== e.pointerId) return
    const d = Math.max(0, e.clientX - g.startX)
    if (d > width * 0.35 || g.v > 0.45) void finishPop()
    else {
      void run(x(stack[stack.length - 1].key), 0, PUSH)
      void run(x(stack[stack.length - 2].key), -PARALLAX * width, PUSH)
    }
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ display: active ? undefined : 'none', touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      data-testid={`stack-${tab}`}
      aria-hidden={!active}
    >
      {stack.map((e, i) => {
        const role = i === n - 1 ? 'top' : i === n - 2 ? 'under' : 'buried'
        const match = matchPath(e.path)
        const backEntry: Entry | undefined = stack[i - 1]
        return (
          <Layer key={e.key} x={x(e.key)} role={role} width={width}>
            {match && (
              <RouteContext.Provider value={{ entry: e, params: match.params, tab, depth: i, isTop: role === 'top' && active, backTitle: backEntry ? routeTitle(backEntry.path, db) : undefined }}>
                <Screen component={ROUTES[match.pattern].component} params={match.params} />
              </RouteContext.Provider>
            )}
          </Layer>
        )
      })}
    </div>
  )
}

function Screen({ component: Component, params }: { component: React.ComponentType<{ params: Record<string, string> }>; params: Record<string, string> }) {
  return (
    <ErrorBoundary label="This screen">
      <Suspense fallback={<ScreenLoading />}>
        <Component params={params} />
      </Suspense>
    </ErrorBoundary>
  )
}

function Layer({ x, role, width, children }: { x: MotionValue<number>; role: 'top' | 'under' | 'buried'; width: number; children: ReactNode }) {
  // The screen underneath dims slightly while it is covered.
  const dim = useTransform(x, [-PARALLAX * width, 0], [0.12, 0])
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-[var(--ios-grouped)]"
      style={{ x, visibility: role === 'buried' ? 'hidden' : 'visible', boxShadow: role === 'top' ? '-10px 0 30px rgb(0 0 0 / 0.18)' : undefined, zIndex: role === 'top' ? 2 : role === 'under' ? 1 : 0 }}
      aria-hidden={role !== 'top'}
      inert={role !== 'top'}
      data-stack-role={role}
    >
      {children}
      {role === 'under' && <motion.div className="pointer-events-none absolute inset-0 z-30 bg-black" style={{ opacity: dim }} />}
    </motion.div>
  )
}
