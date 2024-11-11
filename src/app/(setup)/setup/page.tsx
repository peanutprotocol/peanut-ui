'use client'

import { StepTransition } from '@/components/Setup/components/StepTransition'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { twMerge } from 'tailwind-merge'

import starImage from '@/assets/icons/star.png'

const SetupPage = () => {
    const { currentStep, direction, step } = useSetupFlow()

    const starPositions = [
        'left-[10%] animate-rock-delay-1 top-[15%] h-13 w-13',
        'left-[50%] animate-rock-delay-2 bottom-[0%] h-6 w-6',
        'right-[10%] animate-rock top-[10%] h-10 w-10',
    ]

    return (
        <div className={twMerge('flex h-full flex-col bg-opacity-100 p-6 transition-all', step.containerClassname)}>
            <div className="mg:1/3 mx-auto flex h-full w-full flex-col gap-8 md:w-1/2 lg:gap-12">
                <div className="flex h-[100px] flex-col gap-4">
                    <h1 className="text-center text-5xl font-bold">{step.title}</h1>
                    <p className="text-center">{step.description}</p>
                </div>
                <div className="relative flex min-h-0 flex-grow flex-row items-center justify-center">
                    {step.screenId !== 'passkey' &&
                        starPositions.map((positions, index) => (
                            <img
                                key={index}
                                src={starImage.src}
                                alt="Star"
                                className={twMerge(positions, 'absolute z-[11]')}
                            />
                        ))}
                    <div className="h-full">{step.centerComponent && step.centerComponent()}</div>
                </div>
                <div className="relative h-auto">
                    <StepTransition step={currentStep} direction={direction}>
                        <step.component />
                    </StepTransition>
                </div>
            </div>
        </div>
    )
}

export default SetupPage
