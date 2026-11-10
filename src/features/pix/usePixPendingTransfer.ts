'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/context/authContext'
import { readStoredValue, removeStoredValue } from '@/utils/safe-storage'
import {
    parsePendingTransfers,
    pendingTransfersKey,
    pruneTransferPending,
    standingTransfers,
    type PendingTransfer,
} from '@/features/pix/pixWithdrawPending'

/** The single unscoped mark an earlier build of this branch wrote; it named no account. */
const UNSCOPED_KEY = 'pix-withdraw-pending'

/** Another tab's mark arrives as a storage event: the page then holds the new withdrawal too. */
function subscribe(onChange: () => void): () => void {
    window.addEventListener('storage', onChange)
    return () => window.removeEventListener('storage', onChange)
}

/**
 * The newest withdrawal the signed-in account may have submitted from this browser without an
 * answer naming it (`pixWithdrawPending`), while any of its marks stands. Marks past their window
 * are pruned on read; when the last one passes, the page may offer a new withdrawal. Another
 * account's marks live under its own key and are never read. `enabled`: false once the page names
 * a withdrawal itself.
 */
export function usePixPendingTransfer({ enabled }: { enabled: boolean }): PendingTransfer | null {
    const { user } = useAuth()
    const userId = user?.user?.userId
    // the stored string is a stable snapshot; the server has no storage
    const raw = useSyncExternalStore(
        subscribe,
        useCallback(() => (userId ? readStoredValue(pendingTransfersKey(userId)) : null), [userId]),
        () => null
    )
    // moves the page on when the oldest standing mark passes its window
    const [now, setNow] = useState(() => Date.now())
    const standing = useMemo(() => standingTransfers(parsePendingTransfers(raw), now), [raw, now])
    const pending = enabled ? (standing[0] ?? null) : null

    useEffect(() => {
        removeStoredValue(UNSCOPED_KEY)
        if (userId) pruneTransferPending(userId)
    }, [userId, raw, now])

    const nextExpiry = standing.length ? Math.min(...standing.map((mark) => mark.settleBy)) : null
    useEffect(() => {
        if (nextExpiry === null) return
        const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - Date.now()) + 1)
        return () => clearTimeout(timer)
    }, [nextExpiry])

    return pending
}
