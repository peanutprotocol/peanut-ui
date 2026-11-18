'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useIdentityCheckStart } from '@/features/paperwork-verification/useIdentityCheckStart'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { signupAnalyticsContext } from '@/features/setup/signup-analytics'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'

/** The Verify start's actions and events: shown once on open, then which way the person chose. */
export function useVerifyStart() {
    const { signupEntryFlow } = useSetupFlowContext()
    const restrictions = useResidenceRestrictions()
    const { consumeRedirect, handleRedirect } = useAccountSetup()
    // the legacy start finishes on this screen: once verified, go where sign-up goes, not back to Verify now
    const kycFlow = useMultiPhaseKycFlow({ onKycSuccess: () => handleRedirect({ isNewAccount: true }) })
    const identityCheck = useIdentityCheckStart(kycFlow)
    const [starting, setStarting] = useState(false)
    const reported = useRef(false)

    useEffect(() => {
        if (reported.current) return
        reported.current = true
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_VERIFY_START_SHOWN, signupAnalyticsContext(signupEntryFlow))
    }, [signupEntryFlow])

    const tapped = (choice: 'verify' | 'later') =>
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_VERIFY_START_TAPPED, {
            choice,
            ...signupAnalyticsContext(signupEntryFlow),
        })

    const verify = async () => {
        tapped('verify')
        // the bookkeeping of the redirect it replaces: a stored record of an earlier session must not outlive it
        consumeRedirect({ isNewAccount: true })
        setStarting(true)
        try {
            // this screen already lists the steps, so /verify opens on the first question, not its overview
            await identityCheck.start({ skipOverview: true })
        } finally {
            setStarting(false)
        }
    }

    const later = () => {
        tapped('later')
        handleRedirect({ isNewAccount: true })
    }

    // bank rails closed but the card open: verifying unlocks the card, not bank details (Chip on ui#4138)
    const cardOnly = restrictions.banking && !restrictions.card
    return { cardOnly, starting, verify, later, kycFlow, modals: identityCheck.modals }
}
