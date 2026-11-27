'use client'

import { useState } from 'react'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import type { HistoryEntry } from '@/utils/history.utils'

/** Where a deposit stands, as the screen showing its bank details reads it. */
export type DepositWatchPhase = 'open' | 'completed' | 'closed'

/**
 * The history entry of a bank deposit that completed while its details screen
 * was up, for the success screen (HANDOFF rule 7). Null until then.
 *
 * A deposit counts only when this screen saw it open first. A deposit already
 * complete on the first read is an old order, and its success was told
 * elsewhere (the push, Activity). Once shown, the answer holds for that deposit
 * across re-renders, so the screen cannot flash back to the details.
 *
 * `phase` is the screen's completion signal, undefined until its first read:
 * pesos poll /manteca/deposit/:id/status every 5 s; a Bridge one-time transfer
 * has no status route, so it reads its own history entry (`historyEntryPhase`),
 * which GET /history/:transferId refreshes every 15 s while not final. The
 * entry is read here once the deposit completes, for the amount and receipt.
 */
export function useDepositSuccessEntry(
    entryId: string | undefined,
    phase: DepositWatchPhase | undefined
): HistoryEntry | null {
    const { data: entry } = useHistoryEntry(entryId, 'ONRAMP', { enabled: phase === 'completed' })

    const [openSeenFor, setOpenSeenFor] = useState<string>()
    // adjust state while rendering (react docs) rather than in an effect, so the
    // completed render already knows the deposit was seen open
    if (entryId && phase === 'open' && openSeenFor !== entryId) setOpenSeenFor(entryId)

    // once shown, the success holds even if the entry later reads returned or
    // refunded: that demotion is told by the notification and Activity, never
    // by reopening the bank instructions under the user
    const [shown, setShown] = useState<{ id: string; entry: HistoryEntry }>()
    const completedWhileOpen = !!entryId && phase === 'completed' && openSeenFor === entryId
    if (completedWhileOpen && entry && shown?.id !== entryId) setShown({ id: entryId, entry })

    return shown && shown.id === entryId ? shown.entry : null
}

/**
 * A Bridge one-time transfer's phase, read from its history entry the way its
 * receipt reads it: Bridge states (AWAITING_FUNDS … PAYMENT_PROCESSED) map there.
 */
export function historyEntryPhase(entry: HistoryEntry | undefined): DepositWatchPhase | undefined {
    if (!entry) return undefined
    const { status } = mapTransactionDataForDrawer(entry).transactionDetails
    if (status === 'completed') return 'completed'
    return status === 'pending' || status === 'processing' ? 'open' : 'closed'
}
