import { updateUserById } from '@/app/actions/users'
import { isCapacitor } from '@/utils/capacitor'
import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'
import type { AppLocale } from './config'
import { clearPendingLocalePick, pendingLocalePick } from './locale-store'

const SYNCED_KEY = 'app-locale-synced'

type LocaleSource = 'device' | 'pick' | 'browser'

// Phone app: in memory only, so each app start sends once per (user, locale).
let deviceSynced: string | null = null

/**
 * Persists the user's resolved app locale to the BE (`users.locale`, via
 * POST /update-user) so push and email copy render in their language.
 *
 * Pushes go to the phone, so the phone's language wins. The phone app sends
 * its language on every start and every switch (`device`). The website sends
 * `pick` for an explicit choice the account has not saved yet, else `browser`,
 * which the API only stores when the account has no language. Best-effort: a
 * failed write retries on the next call.
 */
export function syncLocaleToBackend(userId: string, locale: AppLocale): void {
    if (isCapacitor()) syncDeviceLocale(userId, locale)
    else syncWebLocale(userId, locale)
}

function syncDeviceLocale(userId: string, locale: AppLocale): void {
    const synced = `${userId}:${locale}`
    if (deviceSynced === synced) return
    // claimed before the request: a cold start syncs twice in quick succession
    deviceSynced = synced
    void send(userId, locale, 'device').then((ok) => {
        if (!ok && deviceSynced === synced) deviceSynced = null
    })
}

function syncWebLocale(userId: string, locale: AppLocale): void {
    const picked = pendingLocalePick() === locale
    const synced = `${userId}:${locale}`
    if (!picked && readStoredValue(SYNCED_KEY) === synced) return
    void send(userId, locale, picked ? 'pick' : 'browser').then((ok) => {
        if (!ok) return
        // a newer pick made while this request ran stays pending
        if (picked && pendingLocalePick() === locale) clearPendingLocalePick()
        writeStoredValue(SYNCED_KEY, synced)
    })
}

function send(userId: string, locale: AppLocale, localeSource: LocaleSource): Promise<boolean> {
    return updateUserById({ userId, locale, localeSource }).then(
        ({ error }) => !error,
        // updateUserById resolves with { error } today, but best-effort must
        // stay best-effort even if it ever starts rejecting
        () => false
    )
}
