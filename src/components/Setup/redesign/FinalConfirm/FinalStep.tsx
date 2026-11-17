'use client'

import { useState } from 'react'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { CelebrationScreen } from '@/components/Setup/redesign/Celebration/CelebrationScreen'
import { FinalConfirmScreen } from './FinalConfirmScreen'

/** The last step (`advantage-control`): confirm the account, then celebrate it, on one step as on dev. */
export function FinalStep({ onComplete }: StepComponentProps) {
    const { signupCompleted } = useSetupFlowContext()
    // after Confirm later the account is not confirmed yet, so it is not celebrated
    const [deferred, setDeferred] = useState(false)
    return signupCompleted ? (
        <CelebrationScreen quiet={deferred} />
    ) : (
        <FinalConfirmScreen
            onComplete={(outcome) => {
                setDeferred(outcome.deferred)
                onComplete?.()
            }}
        />
    )
}
