import { useLayoutEffect, useSyncExternalStore } from 'react'

// /verify's screens also open on other routes: the feature activation gate on /add-money,
// /withdraw and the bank-claim screen, and the card's activation on /card. While one is
// mounted the app shell drops its gutters and bottom nav as it does on /verify, or the hero
// sits inset with the nav over its panel. Counted holds, so one screen handing over to the
// next never shows the shell between them.
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

function acquireVerifyShell(): () => void {
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

/** Held by a /verify layout while it is mounted: before paint, so the shell never frames it first. */
export function useVerifyShellHold(): void {
    useLayoutEffect(() => acquireVerifyShell(), [])
}

/** Whether a /verify screen is on screen, wherever the route. */
export function useVerifyShell(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function resetVerifyShellForTests(): void {
    holds = 0
    emit()
}
