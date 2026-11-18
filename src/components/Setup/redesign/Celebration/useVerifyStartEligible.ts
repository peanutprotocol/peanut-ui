'use client'

import { useEffect, useState } from 'react'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { isDemoMode } from '@/utils/demo'

/**
 * Whether the Celebration shows Verify now and Remind me later, which lead to the Verify start (war room
 * 2026-11-16: people verify in their first session or never). Only a default sign-up gets them: a claim link or
 * another deep link keeps the redirect to where the person was going, and so does demo mode. It needs an open door:
 * a region-restricted ID, or a residence with neither bank rails nor the card, keeps the redirect. Once shown, the
 * buttons stay, so a late residence answer never pulls them away under a finger.
 */
export function useVerifyStartEligible(signupCompleted: boolean) {
    const { signupEntryFlow } = useSetupFlowContext()
    const { isRegionRestricted } = useIdentityVerification()
    const restrictions = useResidenceRestrictions()
    const [shown, setShown] = useState(false)

    const eligible =
        signupCompleted &&
        signupEntryFlow === 'default' &&
        !isRegionRestricted &&
        !(restrictions.banking && restrictions.card)

    // demo mode reads storage, so it is checked after hydration, here
    useEffect(() => {
        if (eligible && !isDemoMode()) setShown(true)
    }, [eligible])

    return shown
}
