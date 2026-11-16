'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { STEP_S } from './shell.motion'
import type { ShellStore } from './shellStore'

/** The lock holds at least one step slide from the tap, whatever the motion setting (reduced motion fades in 200 ms). */
export const NAV_LOCK_MIN_MS = STEP_S * 1000
/** Safety net only: if the entering screen never reports its slide finished, the lock lets go after this long. */
export const NAV_LOCK_MAX_MS = STEP_S * 1000 + 1500

type Lock = { kind: 'pending'; since: number } | { kind: 'transition'; screen: string; since: number; entered: boolean }

export type NavLock = {
    /** Runs a navigation tap unless a step is still in flight; a dropped tap does nothing. */
    guard: (run: () => void) => void
    /** The entering screen's slide has come to rest. */
    onEntered: (slideKey: string) => void
    /** True while taps are dropped (for tests and captures: `data-nav-locked`). */
    isLocked: () => boolean
}

/**
 * One step per tap gesture (R2-01). The primary button sits at the same pixel on every screen and the next
 * screen's button is live as it slides in, so a double tap used to run two steps. The lock starts at the tap
 * and holds until the next screen's slide has finished, that screen's footer is the one on show and one step
 * duration has passed. A tap that does not change the screen (a check that fails, a drawer) lets go once its
 * button is no longer loading. Back in the top bar goes through the same lock.
 */
export function useNavLock({
    screenId,
    store,
    onChange,
}: {
    screenId: string
    store: ShellStore
    /** Called whenever the lock engages or lets go, so the shell can mirror it in the DOM. */
    onChange: (locked: boolean) => void
}): NavLock {
    const lock = useRef<Lock | null>(null)
    const screenRef = useRef(screenId)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const frame = useRef<number | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    const clearTimers = () => {
        if (timer.current) clearTimeout(timer.current)
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        timer.current = null
        frame.current = null
    }
    const set = useCallback((next: Lock | null) => {
        const was = !!lock.current
        lock.current = next
        if (was !== !!next) onChangeRef.current(!!next)
    }, [])

    /** Lets go once every condition holds; otherwise checks again on the next frame. */
    const check = useCallback(() => {
        frame.current = null
        const current = lock.current
        if (!current) return
        const now = Date.now()
        const elapsed = now - current.since
        if (elapsed >= NAV_LOCK_MAX_MS) {
            set(null)
            return
        }
        if (current.kind === 'pending') {
            // the tap moved nothing: release once the button is not busy (a check or a drawer, not a step)
            const busy = !!store.latestFooter()?.primary.loading
            if (!busy && elapsed >= NAV_LOCK_MIN_MS) {
                set(null)
                return
            }
            if (busy) current.since = now
        } else {
            const mounted = store.get()?.owner === current.screen
            if (current.entered && mounted && elapsed >= NAV_LOCK_MIN_MS) {
                set(null)
                return
            }
        }
        frame.current = requestAnimationFrame(check)
    }, [set, store])

    // A new screen: the step is in flight until its slide rests, whatever started it (a tap, Back, the browser).
    useLayoutEffect(() => {
        if (screenRef.current === screenId) return
        screenRef.current = screenId
        clearTimers()
        set({ kind: 'transition', screen: screenId, since: Date.now(), entered: false })
        frame.current = requestAnimationFrame(check)
        // the safety net runs on a timer too: rAF stops in a background tab
        timer.current = setTimeout(() => set(null), NAV_LOCK_MAX_MS)
    }, [screenId, check, set])

    useEffect(() => clearTimers, [])

    const guard = useCallback(
        (run: () => void) => {
            if (lock.current) return
            set({ kind: 'pending', since: Date.now() })
            clearTimers()
            run()
            // run() may have started a step: the screen change swaps the lock for a transition lock
            const after = lock.current as Lock | null
            if (after?.kind === 'pending') {
                frame.current = requestAnimationFrame(check)
                timer.current = setTimeout(() => {
                    if (lock.current?.kind === 'pending') set(null)
                }, NAV_LOCK_MAX_MS)
            }
        },
        [check, set]
    )

    const onEntered = useCallback((slideKey: string) => {
        const current = lock.current
        if (current?.kind === 'transition' && current.screen === slideKey) current.entered = true
    }, [])

    const isLocked = useCallback(() => !!lock.current, [])

    return { guard, onEntered, isLocked }
}
