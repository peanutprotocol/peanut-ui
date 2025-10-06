import React from 'react'
import { StepConfig } from './types'
import { twMerge } from 'tailwind-merge'

interface StepIndicatorProps {
    currentStep: number
    stepConfig: StepConfig
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, stepConfig }) => {
    return (
        <div className="flex items-center justify-center space-x-2">
            {Array.from({ length: stepConfig.totalSteps }, (_, index) => {
                const stepNumber = index + 1
                const isCurrent = currentStep === stepNumber

                return (
                    <div
                        key={stepNumber}
                        className={twMerge('size-2 rounded-full bg-grey-2', isCurrent && 'bg-primary-1')}
                    ></div>
                )
            })}
        </div>
    )
}

export default StepIndicator
