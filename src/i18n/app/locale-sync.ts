import { updateUserById } from '@/app/actions/users'
import type { AppLocale } from './config'

const SYNCED_KEY = 'app-locale-synced'

/**
 * Persists the user's resolved app locale to the BE (`users.locale`, via
 * POST /update-user) so notification emails can render in their language.
 * Best-effort and deduped: one request per (user, locale) change; a failed
 * write retries on the next startup because the synced marker is only stored
 * on success.
 */
export function syncLocaleToBackend(userId: string, locale: AppLocale): void {
    const synced = `${userId}:${locale}`
    try {
        if (localStorage.getItem(SYNCED_KEY) === synced) return
    } catch {
        // storage unavailable → sync every startup; the write is idempotent
    }
    void updateUserById({ userId, locale }).then(({ error }) => {
        if (error) return
        try {
            localStorage.setItem(SYNCED_KEY, synced)
        } catch {
            // marker lost → re-sync next startup, still idempotent
        }
    })
}
