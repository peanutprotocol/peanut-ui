import * as Sentry from '@sentry/nextjs'
import { updateUserById } from '@/app/actions/users'
import type { AttentionLedgerStore } from './ledger'

/** quiet time before a write goes to the server; a session's writes coalesce into one call */
export const LEDGER_SYNC_DELAY_MS = 2_000

let pending: { userId: string; store: AttentionLedgerStore; timer: ReturnType<typeof setTimeout> } | null = null

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
 * user replaces the pending one; a different user cancels it, so one
 * account's ledger is never posted under another.
 */
export function scheduleLedgerSync(userId: string, store: AttentionLedgerStore): void {
    if (pending) clearTimeout(pending.timer)
    const timer = setTimeout(() => {
        pending = null
        void send(userId, store)
    }, LEDGER_SYNC_DELAY_MS)
    pending = { userId, store, timer }
}

export async function flushLedgerSyncForTests(): Promise<void> {
    if (!pending) return
    clearTimeout(pending.timer)
    const { userId, store } = pending
    pending = null
    await send(userId, store)
}

export function resetLedgerSyncForTests(): void {
    if (pending) clearTimeout(pending.timer)
    pending = null
}
