'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { readStoredValue } from '@/utils/safe-storage'
import {
    clearTransferPending,
    parsePendingTransfer,
    pendingTransferEntry,
    PENDING_TRANSFER_KEY,
    type PendingTransfer,
} from '@/features/pix/pixWithdrawPending'

const HISTORY_POLL_MS = 10_000

/**
 * The withdrawal this device may have submitted without an answer (`pixWithdrawPending`), while it
 * stands. History is read every 10 s for its row: once the row shows, the mark goes and `onFound`
 * gets the withdrawal's id; once the lock's window plus the margin has passed, the mark goes and
 * the page may offer a new withdrawal. `enabled`: false once the page names a withdrawal itself.
 */
export function usePixPendingTransfer({
    enabled,
    onFound,
}: {
    enabled: boolean
    onFound: (entryId: string) => void
}): PendingTransfer | null {
    // read after hydration: the server has no storage, and the stored string is a stable snapshot
    const raw = useHydrationSnapshot(
        () => readStoredValue(PENDING_TRANSFER_KEY),
        () => null
    )
    const [settled, setSettled] = useState(false)
    const stored = useMemo(() => parsePendingTransfer(raw), [raw])
    const pending = enabled && !settled && stored && stored.settleBy > Date.now() ? stored : null

    const history = useTransactionHistory({ mode: 'latest', limit: 10, enabled: !!pending })
    const { refetch } = history
    useEffect(() => {
        if (!pending) return
        const timer = setInterval(() => void refetch(), HISTORY_POLL_MS)
        return () => clearInterval(timer)
    }, [pending, refetch])

    const found = pending ? pendingTransferEntry(pending, history.data?.entries ?? []) : undefined
    useEffect(() => {
        if (!found) return
        clearTransferPending()
        setSettled(true)
        onFound(found.uuid)
    }, [found, onFound])

    // the lock's window plus the margin: the API can no longer have taken it, and its row would show
    useEffect(() => {
        if (!pending) return
        const timer = setTimeout(
            () => {
                clearTransferPending()
                setSettled(true)
            },
            Math.max(0, pending.settleBy - Date.now())
        )
        return () => clearTimeout(timer)
    }, [pending])

    // a mark past its window is cleared at once, so a later visit starts clean
    useEffect(() => {
        if (stored && stored.settleBy <= Date.now()) clearTransferPending()
    }, [stored])

    return pending
}
