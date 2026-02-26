'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { shootStarConfetti } from '@/utils/confetti'
import { useAuth } from '@/context/authContext'
import Image from 'next/image'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

interface CardSuccessScreenProps {
    onViewBadges: () => void
}

const CardSuccessScreen = ({ onViewBadges }: CardSuccessScreenProps) => {
    const [showConfetti, setShowConfetti] = useState(false)
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const { user } = useAuth()
    const router = useRouter()

    // Trigger star confetti on mount
    useEffect(() => {
        if (!showConfetti) {
            setShowConfetti(true)
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
        <>
            <div className="flex min-h-[inherit] flex-col justify-between gap-8">
                <SoundPlayer sound="success" />

                <div className="relative z-10 my-auto flex h-full flex-col justify-center space-y-4">
                    {/* Peanut mascot background - matches PaymentSuccessView */}
                    <Image
                        src={chillPeanutAnim.src}
                        alt="Peanut Mascot"
                        width={20}
                        height={20}
                        className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                    />

                    {/* Success card */}
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                            <Icon name="check" size={24} />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">You're a Pioneer!</h1>
                            <h2 className="text-lg font-extrabold">Card Reserved</h2>
                        </div>
                    </Card>

                    {/* What you unlocked */}
                    <div className="space-y-0">
                        <Card position="first" className="flex items-center gap-3 py-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                                <Icon name="badge" size={16} />
                            </div>
                            <span className="text-sm text-black">Pioneer badge added to your profile</span>
                        </Card>
                        <Card position="middle" className="flex items-center gap-3 py-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                                <Icon name="bell" size={16} />
                            </div>
                            <span className="text-sm text-black">Priority access during launch</span>
                        </Card>
                        <Card position="middle" className="flex items-center gap-3 py-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                                <Icon name="gift" size={16} />
                            </div>
                            <span className="text-sm text-black">$5 for every friend who joins</span>
                        </Card>
                        <Card position="last" className="flex items-center gap-3 py-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-purple-1">
                                <Icon name="dollar" size={16} />
                            </div>
                            <span className="text-sm text-black">Earn forever on every purchase</span>
                        </Card>
                    </div>

                    {/* CTAs */}
                    <div className="w-full space-y-3">
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={() => setIsInviteModalOpen(true)}
                            className="w-full"
                        >
                            <Icon name="share" size={16} className="mr-2" />
                            Share Invite Link
                        </Button>
                        <Button variant="stroke" onClick={onViewBadges} className="w-full">
                            View Your Badges
                        </Button>
                    </div>
                </div>
            </div>

            <InviteFriendsModal
                visible={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                username={user?.user?.username ?? ''}
            />
        </>
    )
}

export default CardSuccessScreen
