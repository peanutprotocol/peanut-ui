'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/context/authContext'
import { paperworkVerificationEntryRoute, type PaperworkVerificationEntry } from './paperworkVerificationEntry'
import { markVerifySource, type VerifySource } from './verifySource'

/**
 * Sends a Smart Paperwork Verification user to /verify (or the add-later screen
 * for the entry's feature) the moment an entry point would show today's start
 * modal. True while the answer is pending or the user is being sent: the modal
 * must not paint then, or its Verify could still be tapped.
 */
export function usePaperworkVerificationRedirect(
    active: boolean,
    entry: PaperworkVerificationEntry | undefined,
    source: VerifySource = 'unlock_payments'
) {
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const userId = useOptionalAuth()?.user?.user.userId
    const [legacyEntry, setLegacyEntry] = useState<string | null>(null)
    const enabled = active && !!entry
    const entryKey = JSON.stringify([userId, entry ?? null])
    const currentEntry = useRef(entryKey)
    currentEntry.current = entryKey
    useEffect(() => {
        setLegacyEntry(null)
        if (!enabled || !entry) return
        let cancelled = false
        void paperworkVerificationEntryRoute(entry).then((route) => {
            if (cancelled || currentEntry.current !== entryKey) return
            if (route === '/verify') markVerifySource(source)
            if (route) routerRef.current.push(route)
            else setLegacyEntry(entryKey)
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `entryKey` stands for `entry`
    }, [enabled, entryKey])
    return enabled && legacyEntry !== entryKey
}
