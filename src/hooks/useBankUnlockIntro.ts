'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

// Storage may be unavailable in a WebView. Still remember the introduction
// between the Home and menu entry points for the lifetime of this session.
const seenWithoutStorage = new Set<string>()
const storageKey = (userId: string) => `peanut_bank_unlock_intro_seen:${userId}`

/** Account-scoped eligibility and persistence for the bank introduction. */
export function useBankUnlockIntro(visible: boolean, enabled: boolean) {
    const { user } = useAuth()
    const { status, isLoading } = useIdentityVerification()
    const { banking } = useResidenceRestrictions()
    const degraded = useKycDegraded()
    const userId = user?.user?.userId
    const eligible = enabled && !!userId && !isLoading && status === 'not_started' && !banking && !degraded
    const [checked, setChecked] = useState<{ userId: string; seen: boolean } | null>(null)

    useEffect(() => {
        if (!visible || !eligible || !userId) return
        let seen = seenWithoutStorage.has(userId)
        try {
            seen = seen || localStorage.getItem(storageKey(userId)) === '1'
        } catch {}
        setChecked({ userId, seen })
    }, [visible, eligible, userId])

    const finish = () => {
        if (!userId) return
        try {
            localStorage.setItem(storageKey(userId), '1')
        } catch {
            seenWithoutStorage.add(userId)
        }
        setChecked({ userId, seen: true })
    }

    return {
        pending: visible && eligible && checked?.userId !== userId,
        showIntro: visible && eligible && checked !== null && checked.userId === userId && !checked.seen,
        finish,
    }
}
