'use client'

import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useIdentityCheckStart } from '@/features/paperwork-verification/useIdentityCheckStart'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { signupAnalyticsContext } from '@/features/setup/signup-analytics'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { isDemoMode } from '@/utils/demo'

export const VERIFY_INVITE_FLAG = 'signup-verify-invite'

/**
 * The Celebration's invite to verify now (war room 2026-11-16: people verify in their first session or never).
 * Only a default sign-up gets it: a claim link or another deep link keeps the redirect to where the person was
 * going, and so does demo mode. It needs the PostHog flag (the rollback switch) and an open door: a
 * region-restricted ID, or a residence with neither bank rails nor the card, keeps the redirect. Once shown it
 * stays, so a late flag or residence answer never pulls the buttons away under a finger.
 */
export function useCelebrationVerifyInvite(signupCompleted: boolean) {
    const { signupEntryFlow } = useSetupFlowContext()
    const isFlagOn = useFeatureFlags()
    const { isRegionRestricted } = useIdentityVerification()
    const restrictions = useResidenceRestrictions()
    const { consumeRedirect, handleRedirect } = useAccountSetup()
    const kycFlow = useMultiPhaseKycFlow({})
    const identityCheck = useIdentityCheckStart(kycFlow)
    const [shown, setShown] = useState(false)
    const [starting, setStarting] = useState(false)
    const reported = useRef(false)

    const eligible =
        signupCompleted &&
        signupEntryFlow === 'default' &&
        isFlagOn(VERIFY_INVITE_FLAG) &&
        !isRegionRestricted &&
        !(restrictions.banking && restrictions.card)

    // demo mode reads storage, so it is checked after hydration, here
    useEffect(() => {
        if (!eligible || reported.current || isDemoMode()) return
        reported.current = true
        setShown(true)
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_VERIFY_INVITE_SHOWN, signupAnalyticsContext(signupEntryFlow))
    }, [eligible, signupEntryFlow])

    const tapped = (choice: 'verify' | 'later') =>
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_VERIFY_INVITE_TAPPED, {
            choice,
            ...signupAnalyticsContext(signupEntryFlow),
        })

    const verify = async () => {
        tapped('verify')
        // the bookkeeping of the redirect it replaces: a stored record of an earlier session must not outlive it
        consumeRedirect({ isNewAccount: true })
        setStarting(true)
        try {
            await identityCheck.start()
        } finally {
            setStarting(false)
        }
    }

    const later = () => {
        tapped('later')
        handleRedirect({ isNewAccount: true })
    }

    return { shown, starting, verify, later, kycFlow, modals: identityCheck.modals }
}
