import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import type { StuckMemory, StuckSurface } from './types'

const STORAGE_PREFIX = 'peanut:stuck-memory:v2:'

export const DISMISS_COOLDOWN_MS = 7 * 86_400_000
export const GLOBAL_QUIET_COOLDOWN_MS = 24 * 3_600_000
export const LIFETIME_DISMISS_CAP = 3

const DEFAULT_MEMORY: StuckMemory = {
    dismissedUntil: {},
    globalQuietUntil: 0,
    lifetimeDismissCount: 0,
}

function keyFor(userId?: string | null): string {
    return `${STORAGE_PREFIX}${userId || 'anon'}`
}

export function createDefaultStuckMemory(): StuckMemory {
    return { ...DEFAULT_MEMORY, dismissedUntil: {} }
}

export function readStuckMemory(userId?: string | null): StuckMemory {
    const raw = readStoredValue(keyFor(userId))
    if (!raw) return createDefaultStuckMemory()
    try {
        const parsed = JSON.parse(raw) as Partial<StuckMemory>
        return {
            dismissedUntil:
                parsed.dismissedUntil && typeof parsed.dismissedUntil === 'object' ? { ...parsed.dismissedUntil } : {},
            globalQuietUntil:
                typeof parsed.globalQuietUntil === 'number' && Number.isFinite(parsed.globalQuietUntil)
                    ? parsed.globalQuietUntil
                    : 0,
            lifetimeDismissCount:
                typeof parsed.lifetimeDismissCount === 'number' && parsed.lifetimeDismissCount >= 0
                    ? Math.floor(parsed.lifetimeDismissCount)
                    : 0,
        }
    } catch {
        return createDefaultStuckMemory()
    }
}

export function writeStuckMemory(userId: string | null | undefined, memory: StuckMemory): void {
    try {
        writeStoredValue(keyFor(userId), JSON.stringify(memory))
    } catch {
        // storage unavailable
    }
}

/**
 * Persists a functional dismissal preference (always written even if analytics are opted out):
 * sets the 7-day per-surface cooldown, a 24h global quiet period, and increments the lifetime cap.
 */
export function recordSurfaceDismissal(
    userId: string | null | undefined,
    surface: StuckSurface,
    nowMs = Date.now()
): StuckMemory {
    const current = readStuckMemory(userId)
    const next: StuckMemory = {
        ...current,
        dismissedUntil: {
            ...current.dismissedUntil,
            [surface]: nowMs + DISMISS_COOLDOWN_MS,
        },
        globalQuietUntil: Math.max(current.globalQuietUntil, nowMs + GLOBAL_QUIET_COOLDOWN_MS),
        lifetimeDismissCount: current.lifetimeDismissCount + 1,
    }
    writeStuckMemory(userId, next)
    return next
}

/**
 * Persists a cooldown after the user tapped a stuck-help CTA so the same buddy does not re-nag
 * in the next session (does not count toward the explicit-dismissal lifetime cap).
 * For `home_wave` whimsy taps/exits, only sets `home_wave`'s own 7-day cooldown so real payment
 * help is never silenced by a playful wave.
 */
export function recordSurfaceActionCooldown(
    userId: string | null | undefined,
    surface: StuckSurface,
    nowMs = Date.now()
): StuckMemory {
    const current = readStuckMemory(userId)
    const next: StuckMemory = {
        ...current,
        dismissedUntil: {
            ...current.dismissedUntil,
            [surface]: nowMs + DISMISS_COOLDOWN_MS,
        },
        globalQuietUntil:
            surface === 'home_wave'
                ? current.globalQuietUntil
                : Math.max(current.globalQuietUntil, nowMs + GLOBAL_QUIET_COOLDOWN_MS),
    }
    writeStuckMemory(userId, next)
    return next
}
