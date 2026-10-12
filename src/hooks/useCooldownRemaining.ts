import { useSyncExternalStore } from 'react'

// One clock for every cool-down surface. The pill renders in the toast stack,
// outside RainCooldownProvider, so it cannot read the context; both it and the
// error read this store instead, and one interval ticks them in the same frame.
let endsAt: number | null = null
let remaining: string | null = null
let timer: number | undefined
const listeners = new Set<() => void>()

function formatRemaining(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000))
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

function tick() {
    remaining = endsAt === null ? null : formatRemaining(endsAt - Date.now())
    listeners.forEach((listener) => listener())
}

/** Written only by RainCooldownProvider. */
export function publishCooldownEndsAt(next: number | null) {
    endsAt = next
    window.clearInterval(timer)
    timer = next === null ? undefined : window.setInterval(tick, 1000)
    tick()
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Time left in the card cool-down as `m:ss`, or null when none is active. */
export function useCooldownRemaining(): string | null {
    return useSyncExternalStore(
        subscribe,
        () => remaining,
        () => null
    )
}
