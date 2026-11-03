'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { paperworkVerificationEntryRoute, type PaperworkVerificationEntry } from './paperworkVerificationEntry'

/**
 * Sends a Smart Paperwork Verification user to /verify (or the add-later screen
 * for the entry's feature) the moment an entry point would show today's start
 * modal. True while the answer is pending or the user is being sent: the modal
 * must not paint then, or its Verify could still be tapped.
 */
export function usePaperworkVerificationRedirect(active: boolean, entry: PaperworkVerificationEntry | undefined) {
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const [stay, setStay] = useState(false)
    const enabled = active && !!entry
    const entryKey = JSON.stringify(entry ?? null)
    useEffect(() => {
        setStay(false)
        if (!enabled || !entry) return
        let cancelled = false
        void paperworkVerificationEntryRoute(entry).then((route) => {
            if (cancelled) return
            if (route) routerRef.current.push(route)
            else setStay(true)
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `entryKey` stands for `entry`
    }, [enabled, entryKey])
    return enabled && !stay
}
