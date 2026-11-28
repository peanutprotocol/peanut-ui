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
    source: VerifySource = 'unlock_payments',
    // a page that is only this gate must not stay in history, or back re-mounts it and redirects again
    replace = false
) {
    const router = useRouter()
    const userId = useOptionalAuth()?.user?.user.userId
    const routerRef = useRef(router)
    routerRef.current = router
    const [legacyEntry, setLegacyEntry] = useState<string | null>(null)
    const enabled = active && !!entry
    const entryKey = JSON.stringify([userId, entry ?? null])
    const currentEntry = useRef(entryKey)
    currentEntry.current = entryKey
    useEffect(() => {
        setLegacyEntry(null)
        if (!enabled || !entry) return
        const controller = new AbortController()
        const go = (route: string) => (replace ? routerRef.current.replace(route) : routerRef.current.push(route))
        void paperworkVerificationEntryRoute(entry, controller.signal)
            .then((route) => {
                if (controller.signal.aborted || currentEntry.current !== entryKey) return
                if (route === '/verify') markVerifySource(source)
                if (route) go(route)
                else setLegacyEntry(entryKey)
            })
            .catch(() => {
                if (controller.signal.aborted || currentEntry.current !== entryKey) return
                markVerifySource(source)
                go('/verify')
            })
        return () => {
            controller.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `entryKey` stands for `entry`
    }, [enabled, entryKey, source, replace])
    return enabled && legacyEntry !== entryKey
}
