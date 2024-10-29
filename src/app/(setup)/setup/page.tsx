'use client'

import { StepTransition } from '@/components/Setup/components/StepTransition'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { twMerge } from 'tailwind-merge'

const SetupPage = () => {
    const { currentStep, direction, step } = useSetupFlow()

    const starPositions = [
        'left-[10%] animate-rock-delay-1 top-[15%] h-16 w-16',
        'left-[50%] animate-rock-delay-2 bottom-[0%] h-8 w-8',
        'right-[10%] animate-rock top-[10%] h-12 w-12',
    ]

    return (
        <div
            className={twMerge(
                'flex min-h-screen flex-col gap-4 bg-opacity-100 p-6 transition-all',
                step.containerClassname
            )}
        >
            <div className="flex h-[100px] flex-col gap-4">
                <h1 className="text-center text-5xl font-bold">{step.title}</h1>
                <p className="text-center">{step.description}</p>
            </div>
            <div className="relative flex flex-row items-center justify-center">
                {starPositions.map((positions, index) => (
                    <img key={index} src="/star.png" alt="Star" className={twMerge('absolute z-[11]', positions)} />
                ))}
                <img src="/peanut-club.png" className="z-10 h-[50%]" />
            </div>
            <div className="relative flex-grow overflow-hidden">
                <StepTransition step={currentStep} direction={direction}>
                    <div className="h-full w-full">
                        <step.component />
                    </div>
                </StepTransition>
            </div>
        </div>
    )
}

export default SetupPage
