import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'

/**
 * A send link's password, kept on the device that made the link so its
 * history row can show the share link again. The key and its lifetime are
 * dev's (`sendLink::password::<pubKey>`, kept across sign-outs): the share
 * link of money a user sent stays in their Activity after they sign out and
 * back in.
 */
const passwordKey = (pubKey: string) => `sendLink::password::${pubKey}`

export function keepSendLinkPassword(pubKey: string, password: string): void {
    saveToLocalStorage(passwordKey(pubKey), password)
}

export function readSendLinkPassword(pubKey: string): string | null {
    const password: unknown = getFromLocalStorage(passwordKey(pubKey))
    return typeof password === 'string' && password ? password : null
}
