'use client'

import { Suspense } from 'react'
import Loading from '@/components/Global/Loading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import SignTestTransaction from '@/components/Setup/Views/SignTestTransaction'
import { useBackHandler } from '@/hooks/useBackHandler'
import { minimizeNativeApp } from '@/utils/capacitor'
import { useTranslations } from 'next-intl'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'

const finishStep: ISetupStep = {
    screenId: 'sign-test-transaction',
    layoutType: 'signup',
    image: { pose: 'waving-chill' },
    component: SignTestTransaction,
}
const finishSteps = [finishStep]

/**
 * finish setup page for users who logged in but haven't completed account setup
 * shows test transaction step to verify passkey works before finalizing
 */
function FinishSetupPageContent() {
    const t = useTranslations('setup')
    const { signupEntryFlow } = useSetupFlowContext()
    useSetupStepAnalytics({ enabled: true, step: finishStep, steps: finishSteps, signupEntryFlow })
    useBackHandler(() => {
        void minimizeNativeApp()
        return true
    })

    return (
        <SetupWrapper
            layoutType={finishStep.layoutType}
            screenId={finishStep.screenId}
            image={finishStep.image}
            title={t('finish.title')}
            description={t('finish.description')}
            showBackButton={false}
            showSkipButton={false}
            contentClassName="flex flex-col items-center justify-center gap-6"
        >
            {/* log out is a link under the primary: the top bar keeps one control (Release 164 smoke test) */}
            <SignTestTransaction showLogout />
        </SetupWrapper>
    )
}

export default function FinishSetupPage() {
    return (
        <Suspense fallback={<Loading variant="mascot" coverFullScreen />}>
            <FinishSetupPageContent />
        </Suspense>
    )
}
