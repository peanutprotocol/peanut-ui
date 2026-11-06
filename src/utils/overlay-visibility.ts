import { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import * as Sentry from '@sentry/nextjs'

// Track committed open surfaces independently of their portal or route. Each
// hold releases separately, including nested drawers and StrictMode remounts.
// A hold is either the user's (a drawer they opened, a flow in progress) or
// the attention manager's own surface; the manager waits for the former and
// must not wait for itself.
const openOverlays = new Map<symbol, { count: number; manager: boolean }>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Set by the manager around the surface it renders; every shared shell inside reads it. */
export const AttentionSurfaceContext = createContext(false)

// a prompt still in its exit transition while the next overlay opens is a hand-off, not a stack
export const OVERLAY_COLLISION_GRACE_MS = 1_000
let collisionReported = false

export function resetOverlayCollisionForTests(): void {
    collisionReported = false
}

const managerAndOtherOpen = (): boolean => {
    const entries = Array.from(openOverlays.values())
    return entries.some((entry) => entry.manager) && entries.some((entry) => !entry.manager)
}

/** A manager prompt and another overlay on screen together: the stacking the manager exists to prevent. */
function reportCollision(secondIsManager: boolean): void {
    if (collisionReported || !managerAndOtherOpen()) return
    setTimeout(() => {
        if (collisionReported || !managerAndOtherOpen()) return
        collisionReported = true
        Sentry.captureMessage('attention: a manager prompt and another overlay are open together', {
            level: 'warning',
            tags: { feature: 'attention', second: secondIsManager ? 'manager' : 'other' },
        })
    }, OVERLAY_COLLISION_GRACE_MS)
}

/** Shared modal/drawer shells publish before paint so deferred prompts yield
 * even when another surface opens in the same React commit. */
export function useOverlayVisibility(open: boolean, owner?: symbol): void {
    const localOwner = useRef(Symbol('overlay'))
    const id = owner ?? localOwner.current
    const manager = useContext(AttentionSurfaceContext)
    useLayoutEffect(() => {
        if (!open) return
        const current = openOverlays.get(id)
        openOverlays.set(id, { count: (current?.count ?? 0) + 1, manager: current?.manager ?? manager })
        if (!current) reportCollision(manager)
        emit()
        return () => {
            const entry = openOverlays.get(id)
            const remaining = (entry?.count ?? 1) - 1
            if (remaining && entry) openOverlays.set(id, { ...entry, count: remaining })
            else openOverlays.delete(id)
            emit()
        }
    }, [open, id, manager])
}

const anyUserOverlayOpen = () => Array.from(openOverlays.values()).some((entry) => !entry.manager)

/** Whether a manager prompt has a modal or drawer on screen. */
export const isManagerOverlayOpen = (): boolean => Array.from(openOverlays.values()).some((entry) => entry.manager)

/** Whether a user-opened modal or drawer is open: the manager opens nothing new while one is. */
export function useAnyOverlayOpen(): boolean {
    return useSyncExternalStore(subscribe, anyUserOverlayOpen, () => false)
}
