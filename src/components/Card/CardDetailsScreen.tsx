'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import { cardApi, CardPurchaseError } from '@/services/card'
import { useAuth } from '@/context/authContext'
import Loading from '@/components/Global/Loading'
import { Icon } from '@/components/Global/Icons/Icon'

interface CardDetailsScreenProps {
    price: number
    currentTier: number
    onPurchaseComplete: () => void
    onBack: () => void
}

const CardDetailsScreen = ({ price, currentTier, onPurchaseComplete, onBack }: CardDetailsScreenProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isDiscounted = currentTier >= 2
    const originalPrice = 10

    // Initiate purchase and navigate to payment page
    const handleReserve = useCallback(async () => {
        setIsCreating(true)
        setError(null)

        try {
            const response = await cardApi.purchase()

            // Navigate to payment page with Card Pioneer context
            // Use /hugostagqa path (staging test user) for payment display
            router.push(`/hugostagqa?chargeId=${response.chargeUuid}&context=card-pioneer`)
        } catch (err) {
            setIsCreating(false)

            if (err instanceof CardPurchaseError) {
                if (err.code === 'ALREADY_PURCHASED') {
                    // User already purchased, redirect to success
                    onPurchaseComplete()
                    return
                }
                setError(err.message)
            } else {
                setError('Failed to initiate purchase. Please try again.')
            }
        }
    }, [user, router, onPurchaseComplete])

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="How does it work?" onPrev={onBack} />

            <div className="flex flex-col gap-6">
                {!isCreating && !error && (
                    <>
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
                            <StepItem number={2} text="You get your card in the coming months" position="middle" />
                            <StepItem
                                number={3}
                                text="If there's any problem with your card, you get a full refund"
                                position="middle"
                            />
                            <StepItem
                                number={4}
                                text={`Once you get your Peanut Card, the $${price} will be part of your Peanut rewards!`}
                                position="middle"
                            />
                            <StepItem
                                number={5}
                                text="Invite people: you get rewarded for every person you invite, now and forever."
                                position="last"
                            />
                        </div>

                        {/* FAQ Link */}
                        <p className="text-sm text-grey-1">
                            For full conditions,{' '}
                            <a
                                href="https://peanut.to/card/faq"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-1 underline"
                            >
                                read the FAQ here
                            </a>
                        </p>
                    </>
                )}

                {isCreating && (
                    <Card className="flex flex-col items-center gap-4 p-6">
                        <Loading className="size-12" />
                        <div className="text-center">
                            <h2 className="text-xl font-bold">Creating Payment...</h2>
                            <p className="mt-2 text-sm text-grey-1">Setting up your purchase. Please wait.</p>
                        </div>
                    </Card>
                )}

                {error && (
                    <Card className="flex flex-col items-center gap-4 p-6">
                        <div className="flex size-16 items-center justify-center rounded-full bg-error-1">
                            <Icon name="cancel" size={32} />
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-bold">Something Went Wrong</h2>
                            <p className="mt-2 text-sm text-grey-1">{error}</p>
                        </div>
                    </Card>
                )}
            </div>

            {/* CTA Button */}
            <div className="mt-auto space-y-3">
                {!isCreating && !error && (
                    <Button variant="purple" size="large" shadowSize="4" onClick={handleReserve} className="w-full">
                        Reserve for ${price}
                    </Button>
                )}

                {error && (
                    <>
                        <Button variant="purple" size="large" shadowSize="4" onClick={handleReserve} className="w-full">
                            Try Again
                        </Button>
                        <Button variant="stroke" onClick={onBack} className="w-full">
                            Go Back
                        </Button>
                    </>
                )}
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
    <Card position={position} className="flex gap-4 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-1 text-sm font-bold text-white">
            {number}
        </div>
        <p className="text-sm">{text}</p>
    </Card>
)

export default CardDetailsScreen
