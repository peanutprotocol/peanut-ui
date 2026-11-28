'use client'

import { useState } from 'react'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import type { HistoryEntry } from '@/utils/history.utils'

/**
 * The history entry of a Bridge one-time transfer that completed while its bank
 * details were up, for the success screen (HANDOFF rule 7). Null until then.
 *
 * `entry` is the transfer's GET /history/:transferId entry, which the caller
 * polls every 15 s while it is not final: a one-time transfer has no status
 * route. Pesos have their own success (TASK-25444).
 *
 * A transfer counts only when this screen saw it open first. One already
 * complete on the first read is an old transfer, and its success was told
 * elsewhere (the push, Activity). Once shown, the success holds for that
 * transfer across re-renders, so the screen cannot flash back to the details.
 */
export function useDepositSuccessEntry(entry: HistoryEntry | undefined, entryId: string | undefined) {
    const phase = transferPhase(entry)

    const [openSeenFor, setOpenSeenFor] = useState<string>()
    // adjust state while rendering (react docs) rather than in an effect, so the
    // completed render already knows the transfer was seen open
    if (entryId && phase === 'open' && openSeenFor !== entryId) setOpenSeenFor(entryId)

    // once shown, the success holds even if the entry later reads returned or
    // refunded: that demotion is told by the notification and Activity, never
    // by reopening the bank instructions under the user
    const [shown, setShown] = useState<{ id: string; entry: HistoryEntry }>()
    if (entryId && entry && phase === 'completed' && openSeenFor === entryId && shown?.id !== entryId) {
        setShown({ id: entryId, entry })
    }

    // the screen holds, but its receipt reads the latest entry, so a reversal shows there
    return shown && shown.id === entryId ? (entry ?? shown.entry) : null
}

/** The transfer's phase, read the way its receipt reads it: Bridge states (AWAITING_FUNDS … PAYMENT_PROCESSED) map there. */
function transferPhase(entry: HistoryEntry | undefined): 'open' | 'completed' | 'closed' | undefined {
    if (!entry) return undefined
    const { status } = mapTransactionDataForDrawer(entry).transactionDetails
    if (status === 'completed') return 'completed'
    return status === 'pending' || status === 'processing' ? 'open' : 'closed'
}
