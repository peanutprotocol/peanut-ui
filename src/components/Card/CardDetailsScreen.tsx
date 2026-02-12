'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import Image from 'next/image'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

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
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="How does it work?" onPrev={onBack} />

            <div className="relative my-auto flex flex-col items-center gap-6">
                {/* Peanut mascot background - matches PaymentSuccessView sizing */}
                <Image
                    src={chillPeanutAnim.src}
                    alt=""
                    width={20}
                    height={20}
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                />

                {/* Steps */}
                <div className="relative z-10 w-full space-y-0">
                    <Card position="first" className="py-3">
                        <p className="text-sm text-black">
                            <span className="font-bold">1.</span> You deposit{' '}
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
                        </p>
                    </Card>
                    <Card position="middle" className="py-3">
                        <p className="text-sm text-black">
                            <span className="font-bold">2.</span> You'll be first to get your card on April 14th
                        </p>
                    </Card>
                    <Card position="middle" className="py-3">
                        <p className="text-sm text-black">
                            <span className="font-bold">3.</span> Once you get your Peanut Card, the ${price} becomes
                            your starter balance!
                        </p>
                    </Card>
                    <Card position="last" className="py-3">
                        <p className="text-sm text-black">
                            <span className="font-bold">4.</span> Invite people: you get rewarded for every person you
                            invite, now and forever.
                        </p>
                    </Card>
                </div>

                {/* FAQ Link */}
                <p className="text-sm">
                    For full conditions,{' '}
                    <a
                        href="https://peanut.me/lp/card#faq"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black underline"
                    >
                        read the FAQ
                    </a>
                </p>

                {/* CTA Button */}
                <Button variant="purple" shadowSize="4" onClick={onContinue} className="w-full">
                    Continue
                </Button>
            </div>
        </div>
    )
}

export default CardDetailsScreen
