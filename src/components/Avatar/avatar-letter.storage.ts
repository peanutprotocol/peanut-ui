/**
 * Device-local fallback for a `letter.<a-z>` avatar pick.
 *
 * The server copy (`users.avatar_key`, written by /update-user and read back on
 * /users/me) is the durable record. This mirror exists only because the API can
 * reject a letter key with a 400 until peanut-api-ts#1529 ships: without it, the
 * Initials group would toast "could not save your avatar" and snap back on every
 * tap. Readers prefer the server value, and any successful server write clears
 * the mirror — see `useAvatarKey`.
 *
 * LETTERS ONLY, deliberately. The basics and badge avatars are validated
 * server-side against the user's own pool (`isAvatarUnlocked`), which is what
 * stops a badge avatar being worn without the badge; a device-local fallback
 * there would hand out that art to anyone who can edit localStorage. Letters
 * are unlocked for everyone, so there is nothing to enforce and nothing to
 * bypass.
 *
 * Keys are scoped per account, like declared-residence.storage: localStorage is
 * shared across every login on the device, and an unscoped key would let a
 * second account inherit the first one's initial.
 *
 * Each mirror also records the server key it was written AGAINST, so it can only
 * shadow that exact value. Without it, a letter stored on this device would win
 * forever over a pick made on another device — the server moving on to
 * `basic.frog` would never surface here.
 */
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

const keyFor = (userId: string) => `peanut:avatarLetter:${userId}`

/** Same shape the API's AVATAR_KEY_PATTERN admits — a single lowercase letter. */
const LETTER_KEY = /^letter\.[a-z]$/

export const isLetterAvatarKey = (key: string | null | undefined): boolean => !!key && LETTER_KEY.test(key)

/** The stored letter, plus the server key it was standing in for. */
export interface LetterMirror {
    key: string
    /** `user.avatarKey` at the moment the mirror was written; null when unset. */
    serverKey: string | null
}

// getSnapshot must return a stable value for the same store state, and
// localStorage is synchronous main-thread I/O — so the parsed value is cached
// per account and only re-read when this module is the one that changed it.
const cache = new Map<string, LetterMirror | null>()
const listeners = new Set<() => void>()

export function subscribeLetterAvatar(onChange: () => void): () => void {
    listeners.add(onChange)
    return () => {
        listeners.delete(onChange)
    }
}

export function readLetterAvatar(userId: string | undefined): LetterMirror | null {
    if (!userId) return null
    const cached = cache.get(userId)
    if (cached !== undefined) return cached
    cache.set(userId, parse(readStoredValue(keyFor(userId))))
    return cache.get(userId) ?? null
}

// Tolerates the bare-string shape an earlier build wrote, treating it as a
// mirror of "no server pick" — the only value it could have stood in for.
function parse(stored: string | null): LetterMirror | null {
    if (!stored) return null
    if (isLetterAvatarKey(stored)) return { key: stored, serverKey: null }
    try {
        const parsed: unknown = JSON.parse(stored)
        if (typeof parsed !== 'object' || parsed === null) return null
        const { key, serverKey } = parsed as Record<string, unknown>
        if (!isLetterAvatarKey(typeof key === 'string' ? key : null)) return null
        if (serverKey !== null && typeof serverKey !== 'string') return null
        return { key: key as string, serverKey: serverKey as string | null }
    } catch {
        return null
    }
}

/** Pass a null `key` to drop the mirror — what a successful server write does. */
export function storeLetterAvatar(
    userId: string | undefined,
    key: string | null,
    serverKey: string | null = null
): void {
    if (!userId) return
    const value: LetterMirror | null = isLetterAvatarKey(key) ? { key: key as string, serverKey } : null
    if (value) writeStoredValue(keyFor(userId), JSON.stringify(value))
    else removeStoredValue(keyFor(userId))
    cache.set(userId, value)
    for (const listener of listeners) listener()
}

/** Test seam: the module-level cache outlives a component tree. */
export function resetLetterAvatarCache(): void {
    cache.clear()
}
