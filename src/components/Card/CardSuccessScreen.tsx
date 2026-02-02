'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import ActionModal from '@/components/Global/ActionModal'
import ShareButton from '@/components/Global/ShareButton'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { useEffect, useState } from 'react'
import { shootStarConfetti } from '@/utils/confetti'
import { useAuth } from '@/context/authContext'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils/general.utils'
import QRCode from 'react-qr-code'

interface CardSuccessScreenProps {
    onViewBadges: () => void
}

const CardSuccessScreen = ({ onViewBadges }: CardSuccessScreenProps) => {
    const [showConfetti, setShowConfetti] = useState(false)
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const { user } = useAuth()
    const inviteData = generateInviteCodeLink(user?.user?.username ?? '')

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
                    particleCount: 3,
                    scalar: 1.8,
                    origin: { x: 0, y: 0.8 },
                    startVelocity: 15,
                    spread: 55,
                })
                shootStarConfetti({
                    particleCount: 3,
                    scalar: 1.8,
                    origin: { x: 1, y: 0.8 },
                    startVelocity: 15,
                    spread: 55,
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
                        <span className="text-sm text-grey-1">Priority notification when card launches</span>
                    </Card>
                    <Card position="last" className="flex items-center gap-3 py-3">
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

            <ActionModal
                visible={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                title="Invite friends!"
                description="Invite friends to Peanut and help them skip ahead on the waitlist. Once they're onboarded and start using the app, you'll earn rewards from their activity too."
                icon="user-plus"
                content={
                    <>
                        {inviteData.inviteLink && (
                            <div className="my-2 size-44">
                                <QRCode
                                    value={inviteData.inviteLink}
                                    size={120}
                                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                                    viewBox={`0 0 120 120`}
                                    level="H"
                                />
                            </div>
                        )}
                        <div className="flex w-full items-center justify-between gap-3">
                            <Card className="flex items-center justify-between py-2">
                                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold">{`${inviteData.inviteCode}`}</p>
                                <CopyToClipboard textToCopy={`${inviteData.inviteCode}`} iconSize="4" />
                            </Card>
                        </div>
                        <ShareButton
                            generateText={() => Promise.resolve(generateInvitesShareText(inviteData.inviteLink))}
                            title="Share your invite link"
                        >
                            Share Invite Link
                        </ShareButton>
                    </>
                }
            />
        </div>
    )
}

export default CardSuccessScreen
