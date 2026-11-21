import { readStoredValue, removeStoredValue, storedKeysWithPrefix, writeStoredValue } from '@/utils/safe-storage'

/**
 * A send link's password, kept on the device that made the link so its
 * history row can show the share link again. It is a bearer secret for the
 * unclaimed funds: it is stored under the account that made the link and goes
 * at sign-out, so the next person on a shared device never finds it.
 */
const PREFIX = 'sendLink::password::'

const passwordKey = (userId: string, pubKey: string) => `${PREFIX}${userId}::${pubKey.toLowerCase()}`

export function keepSendLinkPassword(userId: string, pubKey: string, password: string): void {
    writeStoredValue(passwordKey(userId, pubKey), password)
}

/**
 * The password of a link this account made, or null. A password stored before
 * it was keyed by account (`sendLink::password::<pubKey>`, JSON-encoded) moves
 * under the account whose history row names the link.
 */
export function readSendLinkPassword(userId: string | undefined, pubKey: string): string | null {
    if (!userId) return null
    const key = passwordKey(userId, pubKey)
    const kept = readStoredValue(key)
    if (kept) return kept
    const legacyKey = `${PREFIX}${pubKey}`
    const legacy = readStoredValue(legacyKey)
    if (!legacy) return null
    let password: unknown
    try {
        password = JSON.parse(legacy)
    } catch {
        password = legacy
    }
    removeStoredValue(legacyKey)
    if (typeof password !== 'string' || !password) return null
    writeStoredValue(key, password)
    return password
}

/** Sign-out: this account's passwords, and any stored before they were keyed by account. */
export function forgetSendLinkPasswords(userId: string | undefined | null): void {
    for (const key of storedKeysWithPrefix(PREFIX)) {
        const rest = key.slice(PREFIX.length)
        const unkeyed = !rest.includes('::')
        if (unkeyed || (userId && rest.startsWith(`${userId}::`))) removeStoredValue(key)
    }
}
