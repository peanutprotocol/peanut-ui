'use client'

import { claimDepositAccount } from '@/services/deposit-accounts'
import { IN_APP_BROWSER_CLOSED_EVENT, isNativeBridge, openExternalUrl } from '@/utils/capacitor'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DepositCorridor } from './types'
import { DEPOSIT_ACCOUNTS_QUERY_KEY } from './useDepositAccounts'

export interface EndorsementReview {
    /** Call STRAIGHT out of a click: on web the tab is reserved inside the gesture. */
    start: (corridor: DepositCorridor) => Promise<void>
    startingCorridor?: DepositCorridor
    /** the provider gave no page for this corridor: it rejected or revoked it, and a person has to help */
    needsSupport: ReadonlySet<DepositCorridor>
    /** the last start failed for a reason a retry may clear */
    failedCorridor?: DepositCorridor
}

/**
 * Opens the provider's hosted page for a corridor review that waits on the
 * user, and re-reads the accounts when the user comes back.
 *
 * The link comes from the claim itself. The claim answers
 * `endorsement_required` with a `verificationUrl` scoped to THIS corridor's
 * review. The KYC start-action link is not used: it is authorized from the
 * capability block, which does not carry these corridors, and it is not scoped
 * to the review.
 *
 * The page cannot be framed, so it opens as a top-level tab (the in-app browser
 * on native). On web the tab is reserved before the request: a window.open()
 * after an await is no longer part of the click, and Safari and Firefox block
 * it. `useHostedVerification` does the same for the KYC link and is tied to
 * that link's server action.
 */
export function useEndorsementReview(): EndorsementReview {
    const queryClient = useQueryClient()
    const [startingCorridor, setStartingCorridor] = useState<DepositCorridor>()
    const [failedCorridor, setFailedCorridor] = useState<DepositCorridor>()
    const [needsSupport, setNeedsSupport] = useState<ReadonlySet<DepositCorridor>>(new Set())
    const [awaitingReturn, setAwaitingReturn] = useState(false)
    // `startingCorridor` is state and lands a tick late; a fast second tap would
    // reserve a second tab before the button disables.
    const startingRef = useRef(false)

    const refresh = useCallback(
        () => queryClient.invalidateQueries({ queryKey: DEPOSIT_ACCOUNTS_QUERY_KEY }),
        [queryClient]
    )

    const start = useCallback(
        async (corridor: DepositCorridor) => {
            if (startingRef.current) return
            startingRef.current = true
            const native = isNativeBridge()
            const reservedTab = native ? null : window.open('', '_blank')
            // a reserved tab cannot carry `noopener`, so the back-reference is cut by hand
            if (reservedTab) reservedTab.opener = null
            setFailedCorridor(undefined)
            setStartingCorridor(corridor)
            try {
                const result = await claimDepositAccount(corridor)
                const url =
                    result.outcome === 'endorsement_required'
                        ? (result as { verificationUrl?: string }).verificationUrl
                        : undefined
                if (!url) {
                    reservedTab?.close()
                    // Required with no page: the provider will not take this
                    // from the user. Any other outcome means the review moved
                    // on, and the fresh read below shows where to.
                    if (result.outcome === 'endorsement_required') {
                        setNeedsSupport((current) => new Set(current).add(corridor))
                    }
                    await refresh()
                    return
                }
                if (native) await openExternalUrl(url)
                else if (reservedTab && !reservedTab.closed) reservedTab.location.href = url
                else {
                    // pop-ups blocked, or the user closed the blank tab: a
                    // same-tab navigation is never gesture-gated
                    window.location.href = url
                    return
                }
                setAwaitingReturn(true)
            } catch (error) {
                reservedTab?.close()
                console.error('[deposit-accounts] could not start the corridor review', error)
                setFailedCorridor(corridor)
            } finally {
                setStartingCorridor(undefined)
                startingRef.current = false
            }
        },
        [refresh]
    )

    // Nothing polls a review that waits on the user, so the answer is read when
    // they come back. Not one-shot: the first return is often a quick tab switch.
    useEffect(() => {
        if (!awaitingReturn) return
        const onReturn = () => {
            if (document.visibilityState === 'visible') void refresh()
        }
        const onBrowserClosed = () => void refresh()
        document.addEventListener('visibilitychange', onReturn)
        // Android WebViews do not reliably fire `visibilitychange` on resume.
        // The in-app browser reports its own close two ways: `browserFinished`
        // when the user closes the sheet, and this event when a universal-link
        // return closes it from code (see `closeInAppBrowser`).
        document.addEventListener(IN_APP_BROWSER_CLOSED_EVENT, onBrowserClosed)
        let disposed = false
        let removeNative: (() => void) | undefined
        if (isNativeBridge()) {
            void import('@capacitor/browser')
                .then(({ Browser }) => Browser.addListener('browserFinished', onBrowserClosed))
                .then((handle) => {
                    // cleanup can run while the import is still in flight
                    if (disposed) void handle.remove()
                    else removeNative = () => void handle.remove()
                })
                .catch((error) => console.error('[deposit-accounts] browserFinished listener failed', error))
        }
        return () => {
            disposed = true
            removeNative?.()
            document.removeEventListener('visibilitychange', onReturn)
            document.removeEventListener(IN_APP_BROWSER_CLOSED_EVENT, onBrowserClosed)
        }
    }, [awaitingReturn, refresh])

    return { start, startingCorridor, needsSupport, failedCorridor }
}
