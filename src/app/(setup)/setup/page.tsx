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

    const centerComponent = step.centerComponent()

    return (
        <div
            className={twMerge(
                'flex min-h-screen flex-col border border-green-500 bg-opacity-100 p-6 transition-all',
                step.containerClassname
            )}
        >
            <div className="mg:1/3 z-10 mx-auto flex h-full w-full flex-grow flex-col gap-8 border border-red md:w-1/2 lg:gap-12">
                <div className="flex flex-col gap-4 border text-center">
                    <h1 className="font-knerd-outline relative left-1/2 -translate-x-1/2 whitespace-nowrap stroke-1 text-6xl font-bold text-white">
                        {step.title}
                    </h1>
                    <p className="rounded-lg p-2 text-center font-bold backdrop-blur-lg">{step.description}</p>
                </div>
                {centerComponent && (
                    <div className="relative flex flex-grow flex-row items-center justify-center overflow-visible border sm:h-full">
                        {step.screenId !== 'passkey' &&
                            starPositions.map((positions, index) => (
                                <img
                                    key={index}
                                    src={starImage.src}
                                    alt="Star"
                                    className={twMerge(positions, 'absolute z-[11]')}
                                />
                            ))}
                        <div className="flex h-full w-full flex-row justify-center">{centerComponent}</div>
                    </div>
                )}
                <div className="relative h-auto border">
                    <StepTransition step={currentStep} direction={direction}>
                        <step.component />
                    </StepTransition>
                </div>
            </div>
        </div>
    )
}

export default SetupPage
