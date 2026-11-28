import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'

/**
 * A send link's password, kept on the device that made the link so its
 * history row can show the share link again. The key and its lifetime are
 * dev's (`sendLink::password::<pubKey>`, kept across sign-outs): the share
 * link of money a user sent stays in their Activity after they sign out and
 * back in.
 */
const passwordKey = (pubKey: string) => `sendLink::password::${pubKey}`
// Page-memory fallback when localStorage is blocked or full (same pattern as
// pending-charge-send.ts), so recovery on this page can still build the link.
const memoryPasswords = new Map<string, string>()

export function keepSendLinkPassword(pubKey: string, password: string): void {
    memoryPasswords.set(pubKey, password)
    saveToLocalStorage(passwordKey(pubKey), password)
}

export function readSendLinkPassword(pubKey: string): string | null {
    const password: unknown = getFromLocalStorage(passwordKey(pubKey))
    if (typeof password === 'string' && password) return password
    return memoryPasswords.get(pubKey) ?? null
}
