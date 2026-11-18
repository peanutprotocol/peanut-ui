'use client'

import { useState } from 'react'
import { useIdentityCheckStart } from '@/features/paperwork-verification/useIdentityCheckStart'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'

/**
 * The Celebration's Verify now: the ID-check start Home's Verify row uses, so it opens the one verify screen
 * (Verify start on /verify, or over this screen for today's check). The caller renders `modals` and the flow's
 * SumsubKycModals.
 */
export function useCelebrationVerify() {
    const { consumeRedirect, handleRedirect } = useAccountSetup()
    const leave = () => handleRedirect({ isNewAccount: true })
    // today's check finishes over the Celebration: once verified, go where sign-up goes
    const kycFlow = useMultiPhaseKycFlow({ onKycSuccess: leave })
    // /verify takes sign-up's place, so Back cannot reopen it; closing today's check leaves sign-up as Remind me later does
    const identityCheck = useIdentityCheckStart(kycFlow, { replace: true, onClose: leave })
    const [starting, setStarting] = useState(false)

    const start = async () => {
        // the bookkeeping of the redirect it replaces: a stored record of an earlier session must not outlive it
        consumeRedirect({ isNewAccount: true })
        setStarting(true)
        try {
            await identityCheck.start()
        } finally {
            setStarting(false)
        }
    }

    return { start, starting, kycFlow, modals: identityCheck.modals }
}
