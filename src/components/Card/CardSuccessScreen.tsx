'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'

interface CardSuccessScreenProps {
    onShareInvite: () => void
    onViewBadges: () => void
}

const CardSuccessScreen = ({ onShareInvite, onViewBadges }: CardSuccessScreenProps) => {
    const [showConfetti, setShowConfetti] = useState(false)

    // Trigger confetti on mount
    useEffect(() => {
        if (!showConfetti) {
            setShowConfetti(true)
            // Fire confetti from both sides
            const duration = 2000
            const end = Date.now() + duration

            const frame = () => {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.8 },
                    colors: ['#a855f7', '#ec4899', '#f59e0b'],
                })
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.8 },
                    colors: ['#a855f7', '#ec4899', '#f59e0b'],
                })

                if (Date.now() < end) {
                    requestAnimationFrame(frame)
                }
            }
            frame()
        }
    }, [showConfetti])

    return (
        <div className="flex min-h-[inherit] flex-col gap-6 pt-6">
            <div className="flex flex-col gap-6">
                {/* Success Badge Animation */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                            <Icon name="check" size={64} className="text-white" />
                        </div>
                        {/* Glow effect */}
                        <div className="absolute -inset-4 -z-10 rounded-full bg-purple-500/20 blur-xl" />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center">
                    <h1 className="text-2xl font-extrabold">You're a Pioneer!</h1>
                    <p className="mt-2 text-sm text-grey-1">
                        Congratulations! You've secured your spot in the Card Pioneers program. You'll be among the
                        first to get the Peanut Card.
                    </p>
                </div>

                {/* Benefits Summary */}
                <div className="space-y-0">
                    <Card position="first" className="flex items-center gap-3 p-4">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="badge" size={16} />
                        </div>
                        <span className="text-sm font-medium">Pioneer badge added to your profile</span>
                    </Card>
                    <Card position="middle" className="flex items-center gap-3 p-4">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="bell" size={16} />
                        </div>
                        <span className="text-sm font-medium">Priority notification when card launches</span>
                    </Card>
                    <Card position="last" className="flex items-center gap-3 p-4">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="gift" size={16} />
                        </div>
                        <span className="text-sm font-medium">$5 for every friend who joins</span>
                    </Card>
                </div>
            </div>

            {/* CTA Buttons */}
            <div className="mt-auto space-y-3">
                <Button
                    variant="purple"
                    size="large"
                    shadowSize="4"
                    icon="share"
                    onClick={onShareInvite}
                    className="w-full"
                >
                    Share Invite Link
                </Button>
                <Button variant="stroke" icon="star" onClick={onViewBadges} className="w-full">
                    View Your Badges
                </Button>
            </div>
        </div>
    )
}

export default CardSuccessScreen
