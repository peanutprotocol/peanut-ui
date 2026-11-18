'use client'

import { useState } from 'react'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { CelebrationScreen } from '@/components/Setup/redesign/Celebration/CelebrationScreen'
import { VerifyStartScreen } from '@/components/Setup/redesign/VerifyStart/VerifyStartScreen'
import { FinalConfirmScreen } from './FinalConfirmScreen'

/**
 * The last step (`advantage-control`): confirm the account, then celebrate it, on one step as on dev. The
 * Celebration's Verify now opens the Verify start on the same step: like the completed sign-up it follows, it
 * lives in memory, so a reload leaves the flow as it does from the Celebration.
 */
export function FinalStep({ onComplete }: StepComponentProps) {
    const { signupCompleted } = useSetupFlowContext()
    const [verifying, setVerifying] = useState(false)
    // after Confirm later the account is not confirmed yet, so it is not celebrated
    const [deferred, setDeferred] = useState(false)
    if (!signupCompleted)
        return (
            <FinalConfirmScreen
                onComplete={(outcome) => {
                    setDeferred(outcome.deferred)
                    onComplete?.()
                }}
            />
        )
    return verifying ? (
        <VerifyStartScreen />
    ) : (
        <CelebrationScreen quiet={deferred} onVerify={() => setVerifying(true)} />
    )
}
