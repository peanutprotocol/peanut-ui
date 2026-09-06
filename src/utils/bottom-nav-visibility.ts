import { useSyncExternalStore } from 'react'

// Counted holds so overlapping sheets (nested drawers) release independently.
let holds = 0
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

const getSnapshot = () => holds > 0
const getServerSnapshot = () => false

export function acquireBottomNavHide(): () => void {
    holds += 1
    emit()
    let released = false
    return () => {
        if (released) return
        released = true
        holds -= 1
        emit()
    }
}

export function useBottomNavHidden(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function resetBottomNavVisibilityForTests(): void {
    holds = 0
    emit()
}
