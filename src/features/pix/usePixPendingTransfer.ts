'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { useHydrationSnapshot } from '@/utils/native-platform'
import { readStoredValue } from '@/utils/safe-storage'
import {
    clearTransferPending,
    parsePendingTransfer,
    PENDING_TRANSFER_KEY,
    type PendingTransfer,
} from '@/features/pix/pixWithdrawPending'

/**
 * The signed-in account's withdrawal that this device may have submitted without an answer
 * naming it (`pixWithdrawPending`), until the lock's window plus the margin has passed; then the
 * mark goes and the page may offer a new withdrawal. A mark from another account, or one past its
 * window, is cleared and never shown. `enabled`: false once the page names a withdrawal itself.
 */
export function usePixPendingTransfer({ enabled }: { enabled: boolean }): PendingTransfer | null {
    const { user } = useAuth()
    const userId = user?.user?.userId
    // read after hydration: the server has no storage, and the stored string is a stable snapshot
    const raw = useHydrationSnapshot(
        () => readStoredValue(PENDING_TRANSFER_KEY),
        () => null
    )
    const [settled, setSettled] = useState(false)
    const stored = useMemo(() => parsePendingTransfer(raw), [raw])
    const own = !!stored && !!userId && stored.userId === userId
    const pending = enabled && !settled && own && stored.settleBy > Date.now() ? stored : null

    // another account's mark, one past its window, or one that does not parse: gone, so it can never
    // stand for this account
    useEffect(() => {
        if (raw && !stored) clearTransferPending()
        else if (stored && userId && (stored.userId !== userId || stored.settleBy <= Date.now())) clearTransferPending()
    }, [raw, stored, userId])

    // the lock's window plus the margin: the API can no longer have taken it, and History shows it
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

    return pending
}
