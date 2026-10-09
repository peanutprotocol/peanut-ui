import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

// Track committed open surfaces independently of their portal or route. Each
// hold releases separately, including nested drawers and StrictMode remounts.
const openOverlays = new Map<symbol, number>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Shared modal/drawer shells publish before paint so deferred prompts yield
 * even when another surface opens in the same React commit. */
export function useOverlayVisibility(open: boolean, owner?: symbol): void {
    const localOwner = useRef(Symbol('overlay'))
    const id = owner ?? localOwner.current
    useLayoutEffect(() => {
        if (!open) return
        openOverlays.set(id, (openOverlays.get(id) ?? 0) + 1)
        emit()
        return () => {
            const remaining = (openOverlays.get(id) ?? 1) - 1
            if (remaining) openOverlays.set(id, remaining)
            else openOverlays.delete(id)
            emit()
        }
    }, [open, id])
}

/** An automatic announcement must ignore its own hold to avoid an open/close loop. */
export function useOtherOpenOverlays(owner: symbol): boolean {
    return useSyncExternalStore(
        subscribe,
        () => Array.from(openOverlays.keys()).some((id) => id !== owner),
        () => false
    )
}
