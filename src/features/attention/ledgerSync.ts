import * as Sentry from '@sentry/nextjs'
import { updateUserById } from '@/app/actions/users'
import type { AttentionLedgerStore } from './ledger'

/** quiet time before a write goes to the server; a session's writes coalesce into one call */
export const LEDGER_SYNC_DELAY_MS = 2_000

// one pending store per user: a second account's write never drops the first account's
const pending = new Map<string, { store: AttentionLedgerStore; timer: ReturnType<typeof setTimeout> }>()

async function send(userId: string, store: AttentionLedgerStore): Promise<void> {
    try {
        const result = await updateUserById({ userId, attentionLedger: store })
        if (result?.error) throw new Error(result.error)
    } catch (error) {
        // offline is normal: the local copy stays authoritative and the next write retries
        Sentry.addBreadcrumb({
            category: 'attention',
            message: 'ledger sync failed',
            level: 'warning',
            data: { error: error instanceof Error ? error.message : String(error) },
        })
    }
}

/**
 * Mirror the ledger to the profile, debounced. A newer schedule for the same
 * user replaces the pending one; each user's store is posted under that user only.
 */
export function scheduleLedgerSync(userId: string, store: AttentionLedgerStore): void {
    const previous = pending.get(userId)
    if (previous) clearTimeout(previous.timer)
    const timer = setTimeout(() => {
        pending.delete(userId)
        void send(userId, store)
    }, LEDGER_SYNC_DELAY_MS)
    pending.set(userId, { store, timer })
    listenForPageExit()
}

/** Send what is pending now: the page is going away, or the user is logging out (before the token is cleared). */
export function flushLedgerSync(userId?: string): Promise<void> {
    const sends: Promise<void>[] = []
    for (const [id, { store, timer }] of [...pending]) {
        if (userId && id !== userId) continue
        clearTimeout(timer)
        pending.delete(id)
        sends.push(send(id, store))
    }
    return Promise.all(sends).then(() => undefined)
}

let listening = false
function listenForPageExit(): void {
    if (listening || typeof window === 'undefined') return
    listening = true
    const flush = () => void flushLedgerSync()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush()
    })
    // native: the WebView may be frozen before visibilitychange is delivered
    import('@capacitor/core')
        .then(({ Capacitor }) => {
            if (!Capacitor.isNativePlatform()) return
            return import('@capacitor/app').then(({ App }) => App.addListener('pause', flush))
        })
        .catch(() => {})
}

export const flushLedgerSyncForTests = (): Promise<void> => flushLedgerSync()

export function resetLedgerSyncForTests(): void {
    for (const { timer } of pending.values()) clearTimeout(timer)
    pending.clear()
}
