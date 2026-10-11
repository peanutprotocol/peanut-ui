import { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore } from 'react'

// Track committed open surfaces independently of their portal or route. Each
// hold releases separately, including nested drawers and StrictMode remounts.
// A hold is either the user's (a drawer they opened, a flow in progress) or
// the attention arbiter's own surface; the arbiter waits for the former and
// must not wait for itself.
const openOverlays = new Map<symbol, { count: number; arbiter: boolean }>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Set by the arbiter around the surface it renders; every shared shell inside reads it. */
export const ArbiterSurfaceContext = createContext(false)

/** Shared modal/drawer shells publish before paint so deferred prompts yield
 * even when another surface opens in the same React commit. */
export function useOverlayVisibility(open: boolean, owner?: symbol): void {
    const localOwner = useRef(Symbol('overlay'))
    const id = owner ?? localOwner.current
    const arbiter = useContext(ArbiterSurfaceContext)
    useLayoutEffect(() => {
        if (!open) return
        const current = openOverlays.get(id)
        openOverlays.set(id, { count: (current?.count ?? 0) + 1, arbiter: current?.arbiter ?? arbiter })
        emit()
        return () => {
            const entry = openOverlays.get(id)
            const remaining = (entry?.count ?? 1) - 1
            if (remaining && entry) openOverlays.set(id, { ...entry, count: remaining })
            else openOverlays.delete(id)
            emit()
        }
    }, [open, id, arbiter])
}

/** An automatic announcement must ignore its own hold to avoid an open/close loop. */
export function useOtherOpenOverlays(owner: symbol): boolean {
    return useSyncExternalStore(
        subscribe,
        () => Array.from(openOverlays.keys()).some((id) => id !== owner),
        () => false
    )
}

const anyUserOverlayOpen = () => Array.from(openOverlays.values()).some((entry) => !entry.arbiter)

/** Whether a user-opened modal or drawer is open: the arbiter opens nothing new while one is. */
export function useAnyOverlayOpen(): boolean {
    return useSyncExternalStore(subscribe, anyUserOverlayOpen, () => false)
}
