import { useEffect, useRef } from 'react'
import { useQueryState, parseAsBoolean } from 'nuqs'

/**
 * Persist "the Sumsub SDK is open" to the URL (?kyc=true) so it survives a PWA
 * reload. Android evicts backgrounded standalone PWAs from memory — opening the
 * camera/gallery mid-KYC (the exact thing the flow pushes users toward) is the
 * common trigger. On return the page cold-reloads and the SDK's open-state
 * (useState) resets to closed, dropping the user out of Sumsub. With the flag
 * in the URL, a reload can re-acquire a token for the same applicant and reopen
 * the SDK.
 *
 * @param isOpen   whether the SDK is currently open.
 * @param onResume called once on mount when the flag was set but the SDK is
 *   closed (i.e. a reload interrupted the flow). MUST resolve to whether the
 *   SDK actually reopened — a falsy/failed result clears the flag so a resume
 *   that can't reopen (init error, or a flow the bare resume can't reconstruct)
 *   doesn't get retried on every future reload.
 */
export function useSumsubReloadResume(isOpen: boolean, onResume: () => Promise<boolean>) {
    const [inProgress, setInProgress] = useQueryState('kyc', parseAsBoolean.withDefault(false))

    // resume once on mount
    const didResumeRef = useRef(false)
    useEffect(() => {
        if (didResumeRef.current) return
        didResumeRef.current = true
        if (!inProgress || isOpen) return
        void (async () => {
            const reopened = await onResume().catch(() => false)
            if (!reopened) void setInProgress(false)
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // keep the URL flag in sync with the SDK's open state. skip the first run so
    // the mount-time resume above reads the persisted flag before we touch it.
    // clearing to the `false` default removes the param from the URL.
    const syncSkipRef = useRef(true)
    useEffect(() => {
        if (syncSkipRef.current) {
            syncSkipRef.current = false
            return
        }
        void setInProgress(isOpen)
    }, [isOpen, setInProgress])
}
