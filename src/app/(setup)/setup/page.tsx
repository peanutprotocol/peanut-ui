'use client'

import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupStore } from '@/redux/hooks'
import { useEffect, useState } from 'react'

export default function SetupPage() {
    const { steps } = useSetupStore()
    const { step, handleNext, handleBack } = useSetupFlow()
    const [direction, setDirection] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)

    useEffect(() => {
        if (step) {
            // determine direction based on new step index
            const newIndex = steps.findIndex((s) => s.screenId === step.screenId)
            setDirection(newIndex > currentStepIndex ? 1 : -1)
            setCurrentStepIndex(newIndex)
        }
    }, [step, currentStepIndex])

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
            step={currentStepIndex}
            direction={direction}
        >
            <step.component />
        </SetupWrapper>
    )
}
