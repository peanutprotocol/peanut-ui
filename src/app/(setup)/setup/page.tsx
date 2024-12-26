'use client'

import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { setupSteps } from '@/components/Setup/Setup.consts'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect } from 'react'

export default function SetupPage() {
    const dispatch = useAppDispatch()
    const { step, handleNext, handleBack } = useSetupFlow()

    useEffect(() => {
        dispatch(setupActions.setSteps(setupSteps))
    }, [dispatch])

    // todo: add loading state
    if (!step) return null

    return (
        <SetupWrapper
            layoutType={step.layoutType}
            screenId={step.screenId}
            image={step.image}
            title={step.title}
            description={step.description}
            showBackButton={step.showBackButton}
            showSkipButton={step.showSkipButton}
            imageClassName={step.imageClassName}
            onBack={handleBack}
            onSkip={() => handleNext()}
        >
            <step.component />
        </SetupWrapper>
    )
}
