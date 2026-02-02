'use client'

import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'

interface CardDetailsScreenProps {
    price: number
    currentTier: number
    onContinue: () => void
    onBack: () => void
}

const CardDetailsScreen = ({ price, currentTier, onContinue, onBack }: CardDetailsScreenProps) => {
    const isDiscounted = currentTier >= 2
    const originalPrice = 10

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader title="How does it work?" onPrev={onBack} />

            <div className="my-auto flex flex-col gap-6">
                {/* Steps */}
                <div className="space-y-0">
                    <StepItem
                        number={1}
                        text={
                            <>
                                You deposit{' '}
                                {isDiscounted ? (
                                    <>
                                        <span className="line-through">${originalPrice}</span>{' '}
                                        <span className="font-bold text-purple-1">${price}</span>
                                    </>
                                ) : (
                                    <span className="font-bold">${price}</span>
                                )}{' '}
                                now to reserve your card
                                {isDiscounted && (
                                    <span className="ml-1 text-xs text-purple-1">
                                        (because you're tier {currentTier})
                                    </span>
                                )}
                            </>
                        }
                        position="first"
                    />
                    <StepItem number={2} text="You'll be first to get your card on April 14th" position="middle" />

                    <StepItem
                        number={3}
                        text={`Once you get your Peanut Card, the $${price} will be part of your Peanut rewards!`}
                        position="middle"
                    />
                    <StepItem
                        number={4}
                        text="Invite people: you get rewarded for every person you invite, now and forever."
                        position="last"
                    />
                </div>

                {/* FAQ Link */}
                <p className="text-sm">
                    For full conditions,{' '}
                    <a
                        href="https://peanut.me/lp/card#faq"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-1 underline"
                    >
                        read the FAQ here
                    </a>
                </p>
            </div>

            {/* CTA Button */}
            <div className="mt-auto space-y-3">
                <Button variant="purple" size="large" shadowSize="4" onClick={onContinue} className="w-full">
                    Continue
                </Button>
            </div>
        </div>
    )
}

const StepItem = ({
    number,
    text,
    position,
}: {
    number: number
    text: React.ReactNode
    position: 'first' | 'middle' | 'last' | 'single'
}) => (
    <Card position={position} className="flex items-center gap-3 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-1 text-sm font-bold text-white">
            {number}
        </div>
        <p className="text-sm text-grey-1">{text}</p>
    </Card>
)

export default CardDetailsScreen
