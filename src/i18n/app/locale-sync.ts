import { updateUserById } from '@/app/actions/users'
import { isCapacitor } from '@/utils/capacitor'
import type { AppLocale } from './config'
import { isLocaleExplicitlyChosen } from './locale-store'

const SYNCED_KEY = 'app-locale-synced'

type LocaleSource = 'device' | 'pick' | 'browser'

// Native dedupe lives in memory, so every app start sends once per (user, locale).
let lastNativeSynced: string | null = null

/**
 * Persists the user's resolved app locale to the BE (`users.locale`, via
 * POST /update-user) so push and email copy render in their language.
 *
 * Pushes go to the phone, so the phone's language wins. The phone app sends
 * its language on every start and every switch (`device`). The website sends
 * `browser`, which the API only stores when the account has no language yet,
 * or `pick` after an explicit choice. Best-effort: a failed write retries on
 * the next call because the dedupe marker is only stored on success.
 */
export function syncLocaleToBackend(userId: string, locale: AppLocale): void {
    const native = isCapacitor()
    const localeSource: LocaleSource = native ? 'device' : isLocaleExplicitlyChosen() ? 'pick' : 'browser'
    const synced = native ? `${userId}:${locale}` : `${userId}:${locale}:${localeSource}`

    if (native) {
        if (lastNativeSynced === synced) return
    } else {
        try {
            if (localStorage.getItem(SYNCED_KEY) === synced) return
        } catch {
            // storage unavailable → sync every startup; the write is idempotent
        }
    }
    void updateUserById({ userId, locale, localeSource })
        .then(({ error }) => {
            if (error) return
            if (native) {
                lastNativeSynced = synced
                return
            }
            try {
                localStorage.setItem(SYNCED_KEY, synced)
            } catch {
                // marker lost → re-sync next startup, still idempotent
            }
        })
        // updateUserById resolves with { error } today, but best-effort must
        // stay best-effort even if it ever starts rejecting
        .catch(() => {})
}
