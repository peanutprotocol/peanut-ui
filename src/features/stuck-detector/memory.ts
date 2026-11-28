import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import type { StuckMemory, StuckSurface } from './types'

const STORAGE_PREFIX = 'peanut:stuck-memory:v1:'
export const DISMISS_COOLDOWN_MS = 7 * 86_400_000

const DEFAULT_MEMORY: StuckMemory = {
    sessionCount: 1,
    priorObsFriction: 0,
    priorStuck: 0,
    prevWasStuck: false,
    seenAddMoneyUnfunded: false,
    dismissedUntil: {},
}

function keyFor(userId?: string | null): string {
    return `${STORAGE_PREFIX}${userId || 'anon'}`
}

export function readStuckMemory(userId?: string | null): StuckMemory {
    const raw = readStoredValue(keyFor(userId))
    if (!raw) return { ...DEFAULT_MEMORY, dismissedUntil: {} }
    try {
        const parsed = JSON.parse(raw) as Partial<StuckMemory>
        return {
            sessionCount: typeof parsed.sessionCount === 'number' && parsed.sessionCount >= 1 ? parsed.sessionCount : 1,
            priorObsFriction:
                typeof parsed.priorObsFriction === 'number' && parsed.priorObsFriction >= 0
                    ? parsed.priorObsFriction
                    : 0,
            priorStuck: typeof parsed.priorStuck === 'number' && parsed.priorStuck >= 0 ? parsed.priorStuck : 0,
            prevWasStuck: Boolean(parsed.prevWasStuck),
            seenAddMoneyUnfunded: Boolean(parsed.seenAddMoneyUnfunded),
            dismissedUntil:
                parsed.dismissedUntil && typeof parsed.dismissedUntil === 'object' ? { ...parsed.dismissedUntil } : {},
        }
    } catch {
        return { ...DEFAULT_MEMORY, dismissedUntil: {} }
    }
}

export function writeStuckMemory(userId: string | null | undefined, memory: StuckMemory): void {
    try {
        writeStoredValue(keyFor(userId), JSON.stringify(memory))
    } catch {
        // storage unavailable
    }
}

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
    }
    writeStuckMemory(userId, next)
    return next
}

export function recordSessionOutcome(
    userId: string | null | undefined,
    { hadFriction, wasStuck }: { hadFriction: boolean; wasStuck: boolean }
): StuckMemory {
    const current = readStuckMemory(userId)
    const next: StuckMemory = {
        ...current,
        sessionCount: current.sessionCount + 1,
        priorObsFriction: current.priorObsFriction + (hadFriction ? 1 : 0),
        priorStuck: current.priorStuck + (wasStuck ? 1 : 0),
        prevWasStuck: wasStuck,
    }
    writeStuckMemory(userId, next)
    return next
}

export function markSeenAddMoneyUnfunded(userId: string | null | undefined): StuckMemory {
    const current = readStuckMemory(userId)
    if (current.seenAddMoneyUnfunded) return current
    const next: StuckMemory = { ...current, seenAddMoneyUnfunded: true }
    writeStuckMemory(userId, next)
    return next
}
