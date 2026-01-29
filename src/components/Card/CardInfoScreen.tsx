'use client'

import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import PioneerCard3D from '@/components/LandingPage/PioneerCard3D'
import { useRouter } from 'next/navigation'

interface CardInfoScreenProps {
    onContinue: () => void
    hasPurchased: boolean
    slotsRemaining?: number
}

const CardInfoScreen = ({ onContinue, hasPurchased, slotsRemaining }: CardInfoScreenProps) => {
    const router = useRouter()

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Join Peanut Pioneers" onPrev={() => router.back()} />

            {/* Description and FAQ link */}
            <div>
                <p className="text-sm text-grey-1">
                    Get access to the best card in the world. Spend globally at the best rates, and get rewarded for
                    every spend of you and your friends.
                </p>
                <a
                    href="https://peanut.to/card/faq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-purple-1 underline"
                >
                    Have any question? Read the FAQ here
                </a>
            </div>

            {/* Card Hero with 3D effect */}
            <div className="flex flex-1 flex-col items-center justify-center">
                <PioneerCard3D />
            </div>

            {/* Slots remaining counter - above CTA button */}
            {slotsRemaining !== undefined && (
                <p className="text-center text-2xl font-bold text-purple-1">{slotsRemaining} slots left</p>
            )}

            {/* CTA Button */}
            <div className="mt-4">
                {hasPurchased ? (
                    <Button variant="purple" size="large" shadowSize="4" disabled className="w-full">
                        Already a Pioneer
                    </Button>
                ) : (
                    <Button variant="purple" size="large" shadowSize="4" onClick={onContinue} className="w-full">
                        Join Now
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CardInfoScreen
