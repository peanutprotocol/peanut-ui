'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/context/authContext'
import {
    pruneTransferPending,
    readTransfersPending,
    standingTransfers,
    type PendingTransfer,
} from '@/features/pix/pixWithdrawPending'

/** Another tab's mark arrives as a storage event: the page then holds the new withdrawal too. */
function subscribe(onChange: () => void): () => void {
    window.addEventListener('storage', onChange)
    return () => window.removeEventListener('storage', onChange)
}

/**
 * The newest withdrawal the signed-in account may have submitted from this browser without an
 * answer naming it (`pixWithdrawPending`), while any of its marks stands. The account's marks are
 * read by their key prefix; marks past their window are pruned on read, and when the last one
 * passes, the page may offer a new withdrawal. Another account's marks have another prefix and are
 * never read. `enabled`: false once the page names a withdrawal itself.
 */
export function usePixPendingTransfer({ enabled }: { enabled: boolean }): PendingTransfer | null {
    const { user } = useAuth()
    const userId = user?.user?.userId
    // a string is a stable snapshot of the account's marks; the server has no storage
    const snapshot = useSyncExternalStore(
        subscribe,
        useCallback(() => (userId ? JSON.stringify(readTransfersPending(userId)) : '[]'), [userId]),
        () => '[]'
    )
    // moves the page on when the oldest standing mark passes its window
    const [now, setNow] = useState(() => Date.now())
    const standing = useMemo(() => standingTransfers(JSON.parse(snapshot) as PendingTransfer[], now), [snapshot, now])
    const pending = enabled ? (standing[0] ?? null) : null

    useEffect(() => {
        if (userId) pruneTransferPending(userId)
    }, [userId, snapshot, now])

    const nextExpiry = standing.length ? Math.min(...standing.map((mark) => mark.settleBy)) : null
    useEffect(() => {
        if (nextExpiry === null) return
        const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 1)
        return () => clearTimeout(timer)
    }, [nextExpiry])

    return pending
}
