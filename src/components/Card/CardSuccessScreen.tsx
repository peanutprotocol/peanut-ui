'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import { useEffect, useState } from 'react'
import { shootStarConfetti } from '@/utils/confetti'
import { useAuth } from '@/context/authContext'

interface CardSuccessScreenProps {
    onViewBadges: () => void
}

const CardSuccessScreen = ({ onViewBadges }: CardSuccessScreenProps) => {
    const [showConfetti, setShowConfetti] = useState(false)
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const { user } = useAuth()

    // Trigger star confetti on mount
    useEffect(() => {
        if (!showConfetti) {
            setShowConfetti(true)
            // Fire star confetti from both sides
            const duration = 2000
            const end = Date.now() + duration
            let cancelled = false

            const frame = () => {
                if (cancelled) return

                shootStarConfetti({
                    particleCount: 20,
                    origin: { x: 0, y: 0.8 },
                    spread: 55,
                    startVelocity: 30,
                    ticks: 100,
                })
                shootStarConfetti({
                    particleCount: 20,
                    origin: { x: 1, y: 0.8 },
                    spread: 55,
                    startVelocity: 30,
                    ticks: 100,
                })

                if (Date.now() < end) {
                    requestAnimationFrame(frame)
                }
            }
            frame()

            return () => {
                cancelled = true
            }
        }
    }, [showConfetti])

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <div className="my-auto flex flex-col gap-6">
                {/* Success Badge - matching existing payment success screens */}
                <div className="flex justify-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-success-3">
                        <Icon name="check" size={24} />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center">
                    <h1 className="text-xl font-bold">You're a Pioneer!</h1>
                    <p className="mt-2 text-sm text-grey-1">
                        Congratulations! You've secured your spot in the Card Pioneers program. You'll be among the
                        first to get the Peanut Card.
                    </p>
                </div>

                {/* Benefits Summary */}
                <div className="space-y-0">
                    <Card position="first" className="flex items-center gap-3 py-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="badge" size={16} />
                        </div>
                        <span className="text-sm text-grey-1">Pioneer badge added to your profile</span>
                    </Card>
                    <Card position="middle" className="flex items-center gap-3 py-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="bell" size={16} />
                        </div>
                        <span className="text-sm text-grey-1">Priority access during launch</span>
                    </Card>
                    <Card position="middle" className="flex items-center gap-3 py-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="gift" size={16} />
                        </div>
                        <span className="text-sm text-grey-1">$5 for every friend who joins</span>
                    </Card>
                    <Card position="last" className="flex items-center gap-3 py-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                            <Icon name="gift" size={16} />
                        </div>
                        <span className="text-sm text-grey-1">earn forever on every purchase</span>
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
                    onClick={() => setIsInviteModalOpen(true)}
                    className="w-full"
                >
                    Share Invite Link
                </Button>
                <Button variant="stroke" size="large" onClick={onViewBadges} className="w-full">
                    View Your Badges
                </Button>
            </div>

            <InviteFriendsModal
                visible={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                username={user?.user?.username ?? ''}
            />
        </div>
    )
}

export default CardSuccessScreen
