'use client'

import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { CelebrationScreen } from '@/components/Setup/redesign/Celebration/CelebrationScreen'
import { FinalConfirmScreen } from './FinalConfirmScreen'

/** The last step (`advantage-control`): confirm the account, then celebrate it, on one step as on dev. */
export function FinalStep({ onComplete }: StepComponentProps) {
    const { signupCompleted } = useSetupFlowContext()
    return signupCompleted ? <CelebrationScreen /> : <FinalConfirmScreen onComplete={onComplete} />
}
