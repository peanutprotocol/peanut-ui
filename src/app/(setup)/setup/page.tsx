'use client'

import { StepTransition } from '@/components/Setup/components/StepTransition'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { twMerge } from 'tailwind-merge'

import starImage from '@/assets/icons/star.png'
import Title from '@/components/0_Bruddle/Title'
import { Card } from '@/components/0_Bruddle'
import classNames from 'classnames'

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
            className={twMerge('flex min-h-screen flex-col bg-opacity-100 p-8 transition-all', step.containerClassname)}
        >
            <div className="mg:1/3 z-10 mx-auto flex h-full w-full flex-grow flex-col gap-8 md:w-1/2 lg:gap-12">
                <div className="flex w-full flex-row justify-center">
                    <Title
                        text={step.title}
                        className={classNames('text-6xl', {
                            'text-5xl md:text-6xl': step.screenId === 'noficiation-permission',
                        })}
                    />
                </div>
                <div className="flex flex-col gap-4">
                    <Card>
                        <Card.Content>
                            <p className="rounded-lg p-2 text-center font-bold">{step.description}</p>
                        </Card.Content>
                    </Card>
                </div>
                {centerComponent && (
                    <div className="relative flex flex-grow flex-row items-center justify-center overflow-visible sm:h-full">
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
