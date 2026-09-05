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
 * Keys are scoped per account, like [[declared-residence.storage]]: localStorage
 * is shared across every login on the device, and an unscoped key would let a
 * second account inherit the first one's initial.
 */
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

const keyFor = (userId: string) => `peanut:avatarLetter:${userId}`

/** Same shape the API's AVATAR_KEY_PATTERN admits — a single lowercase letter. */
const LETTER_KEY = /^letter\.[a-z]$/

export const isLetterAvatarKey = (key: string | null | undefined): boolean => !!key && LETTER_KEY.test(key)

// getSnapshot must return a stable value for the same store state, and
// localStorage is synchronous main-thread I/O — so the parsed value is cached
// per account and only re-read when this module is the one that changed it.
const cache = new Map<string, string | null>()
const listeners = new Set<() => void>()

export function subscribeLetterAvatar(onChange: () => void): () => void {
    listeners.add(onChange)
    return () => {
        listeners.delete(onChange)
    }
}

export function readLetterAvatar(userId: string | undefined): string | null {
    if (!userId) return null
    const cached = cache.get(userId)
    if (cached !== undefined) return cached
    const stored = readStoredValue(keyFor(userId))
    const value = isLetterAvatarKey(stored) ? stored : null
    cache.set(userId, value)
    return value
}

/** Pass `null` to drop the mirror — what a successful server write does. */
export function storeLetterAvatar(userId: string | undefined, key: string | null): void {
    if (!userId) return
    const value = isLetterAvatarKey(key) ? key : null
    if (value) writeStoredValue(keyFor(userId), value)
    else removeStoredValue(keyFor(userId))
    cache.set(userId, value)
    for (const listener of listeners) listener()
}

/** Test seam: the module-level cache outlives a component tree. */
export function resetLetterAvatarCache(): void {
    cache.clear()
}
