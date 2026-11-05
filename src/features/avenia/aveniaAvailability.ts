import { useSyncExternalStore } from 'react'
import type { RailCapability } from '@/types/capabilities'

/** Reason codes PR B's capability resolver sets on the Avenia rail when its routes would refuse. */
export const AVENIA_NOT_AVAILABLE_REASON = 'avenia_not_available'
export const AVENIA_PAUSED_REASON = 'avenia_paused'

/** What the Avenia routes answer this user, as the rail's capability says it. */
export type AveniaRouteState = 'open' | 'closed' | 'paused'

/**
 * `paused`: the Avenia kill switch. `closed`: the rollout gate. Neither is the
 * user's verification, so the generic gates leave such a rail out and the
 * Brazil Pix routes read it (`brazilPixPath`). The API sends
 * `avenia_not_available` with a contact-support action for a failure on our
 * side that support lifts; that rail stays `open`, and the Avenia setup step
 * shows it.
 */
export function aveniaRouteState(
    rail: Pick<RailCapability, 'provider' | 'status' | 'reason' | 'blockingActions'> | undefined
): AveniaRouteState {
    if (rail?.provider !== 'avenia' || rail.status !== 'blocked') return 'open'
    if (rail.reason?.code === AVENIA_PAUSED_REASON) return 'paused'
    if (rail.reason?.code === AVENIA_NOT_AVAILABLE_REASON && !rail.blockingActions?.length) return 'closed'
    return 'open'
}

/**
 * Users the API refused Avenia's first use this session (its rollout gate, or a
 * verification Avenia cannot start yet). They keep the Manteca flow until the
 * app restarts. Module-scoped, like the submission window: no provider needed.
 */
const unavailableUsers = new Set<string>()
const listeners = new Set<() => void>()

export function markAveniaUnavailable(userId: string): void {
    if (unavailableUsers.has(userId)) return
    unavailableUsers.add(userId)
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function useAveniaUnavailable(userId: string | undefined): boolean {
    return useSyncExternalStore(
        subscribe,
        () => (userId ? unavailableUsers.has(userId) : false),
        () => false
    )
}

/** Test-only reset of the module cell. */
export function __resetAveniaAvailabilityForTests(): void {
    unavailableUsers.clear()
    listeners.clear()
}
