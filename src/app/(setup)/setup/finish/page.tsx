'use client'

import { Suspense } from 'react'
import Loading from '@/components/Global/Loading'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { FinalConfirmScreen } from '@/components/Setup/redesign/FinalConfirm/FinalConfirmScreen'
import { useBackHandler } from '@/hooks/useBackHandler'
import { minimizeNativeApp } from '@/utils/capacitor'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'

const finishStep: ISetupStep = {
    screenId: 'sign-test-transaction',
    layoutType: 'signup',
    component: FinalConfirmScreen,
}
const finishSteps = [finishStep]

/**
 * finish setup page for users who logged in but haven't completed account setup
 * shows test transaction step to verify passkey works before finalizing
 */
function FinishSetupPageContent() {
    const { signupEntryFlow } = useSetupFlowContext()
    useSetupStepAnalytics({ enabled: true, step: finishStep, steps: finishSteps, signupEntryFlow })
    useBackHandler(() => {
        void minimizeNativeApp()
        return true
    })

    return (
        <SetupShell screenId={finishStep.screenId} showBackButton={false}>
            {/* log out is a link under the primary: the top bar keeps one control (Release 164 smoke test) */}
            <FinalConfirmScreen showLogout />
        </SetupShell>
    )
}

export default function FinishSetupPage() {
    return (
        <Suspense fallback={<Loading variant="mascot" coverFullScreen />}>
            <FinishSetupPageContent />
        </Suspense>
    )
}
