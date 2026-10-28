import { createContext, useContext, useLayoutEffect, useRef, useSyncExternalStore } from 'react'

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

/** An automatic announcement must ignore its own hold to avoid an open/close loop. */
export function useOtherOpenOverlays(owner: symbol): boolean {
    return useSyncExternalStore(
        subscribe,
        () => Array.from(openOverlays.keys()).some((id) => id !== owner),
        () => false
    )
}

const anyUserOverlayOpen = () => Array.from(openOverlays.values()).some((entry) => !entry.manager)

/** Whether a user-opened modal or drawer is open: the manager opens nothing new while one is. */
export function useAnyOverlayOpen(): boolean {
    return useSyncExternalStore(subscribe, anyUserOverlayOpen, () => false)
}
