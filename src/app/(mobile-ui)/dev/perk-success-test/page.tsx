'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import GlobalCard from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { extractInviteeName } from '@/utils/general.utils'
import DevPageShell from '../_components/DevPageShell'

type MockPerk = {
    id: string
    name: string
    amountUsd: number
    reason: string
}

const MOCK_PERKS: MockPerk[] = [
    {
        id: 'mock-1',
        name: 'Card Pioneer Inviter Reward',
        amountUsd: 5,
        reason: 'Alice became a Card Pioneer',
    },
    {
        id: 'mock-2',
        name: 'Card Pioneer Inviter Reward',
        amountUsd: 5,
        reason: 'Bob became a Card Pioneer',
    },
    {
        id: 'mock-3',
        name: 'Card Pioneer Inviter Reward',
        amountUsd: 5,
        reason: 'Charlie became a Card Pioneer',
    },
    {
        id: 'mock-4',
        name: 'Card Pioneer Inviter Reward',
        amountUsd: 10,
        reason: 'Diana became a Card Pioneer (bonus!)',
    },
    {
        id: 'mock-5',
        name: 'Card Pioneer Inviter Reward',
        amountUsd: 5,
        reason: 'Eve became a Card Pioneer',
    },
]

export default function PerkSuccessTestPage() {
    const [currentPerkIndex, setCurrentPerkIndex] = useState(0)
    const [showSuccess, setShowSuccess] = useState(false)
    const [canDismiss, setCanDismiss] = useState(false)
    const [isExiting, setIsExiting] = useState(false)
    const [playSound, setPlaySound] = useState(false)
    const { triggerHaptic } = useAppHaptic()

    const currentPerk = MOCK_PERKS[currentPerkIndex]

    const handleShowSuccess = () => {
        setShowSuccess(true)
        setCanDismiss(false)
        setIsExiting(false)
        setPlaySound(true)
        triggerHaptic()
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })

        // Enable dismiss after 2 seconds
        setTimeout(() => setCanDismiss(true), 2000)
    }

    const handleDismiss = () => {
        if (!canDismiss) return

        setIsExiting(true)
        setTimeout(() => {
            setShowSuccess(false)
            setPlaySound(false)
            // Move to next perk
            setCurrentPerkIndex((prev) => (prev + 1) % MOCK_PERKS.length)
        }, 400)
    }

    const inviteeName = extractInviteeName(currentPerk.reason)

    return (
        <DevPageShell
            title="Perk Success Test"
            description="Fires the perk-claim success screen against mock perks — no real perk needed."
            width="prose"
        >
            <div className="space-y-4">
                <Notification priority="info" title="Test the perk claim success screen">
                    <NumberedList
                        items={[
                            'Select “Trigger Success” to show the success screen.',
                            'Wait two seconds for the dismiss action.',
                            'Select the preview to dismiss it and load the next mock perk.',
                        ]}
                    />
                </Notification>

                {/* Current Perk Info */}
                <Card className="p-4">
                    <p className="text-label-l">
                        Current Mock Perk ({currentPerkIndex + 1}/{MOCK_PERKS.length})
                    </p>
                    <p className="mt-1 text-body-xs text-foreground-secondary">ID: {currentPerk.id}</p>
                    <p className="text-body-xs text-foreground-secondary">Amount: ${currentPerk.amountUsd}</p>
                    <p className="text-body-xs text-foreground-secondary">Reason: {currentPerk.reason}</p>
                </Card>

                {/* Trigger Button */}
                {!showSuccess && (
                    <Button variant="primary" onClick={handleShowSuccess} className="w-full">
                        Trigger Success
                    </Button>
                )}

                {/* Success Screen Preview */}
                {showSuccess && (
                    <Card className="border-dashed p-4">
                        <p className="mb-4 text-center text-label-m text-foreground-secondary">
                            SUCCESS SCREEN PREVIEW (tap to dismiss when ready)
                        </p>

                        <div
                            className={`flex flex-col items-center ${canDismiss ? 'cursor-pointer' : ''}`}
                            onClick={handleDismiss}
                        >
                            {playSound && <SoundPlayer sound="success" />}

                            {/* Success card - full width, matches PaymentSuccessView */}
                            <GlobalCard
                                className={`flex w-full items-center gap-4 p-4 ${isExiting ? 'animate-gift-exit' : 'animate-gift-revealed'}`}
                            >
                                {/* Check icon */}
                                <IconBubble icon="check" size="m" color="green" />

                                {/* Text content */}
                                <div>
                                    <p className="text-body-s text-foreground-secondary">You received</p>
                                    <p className="text-heading-m">+${currentPerk.amountUsd}</p>
                                    <p className="mt-1 flex items-center gap-1 text-body-s text-foreground-secondary">
                                        <Icon name="invite-heart" size={16} />
                                        <span className="text-body-s-semibold">{inviteeName}</span>
                                        <span>joined Pioneers</span>
                                    </p>
                                </div>
                            </GlobalCard>

                            {/* Tap to continue - fades in when ready */}
                            <p
                                className={`mt-4 text-body-s text-foreground-secondary transition-opacity duration-moderate ${canDismiss ? 'opacity-100' : 'opacity-0'}`}
                            >
                                Tap to continue
                            </p>
                        </div>
                    </Card>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2">
                    <Button
                        variant="stroke"
                        onClick={() => setCurrentPerkIndex((prev) => (prev + 1) % MOCK_PERKS.length)}
                        className="flex-1"
                    >
                        Next Perk
                    </Button>
                    <Button
                        variant="stroke"
                        onClick={() => {
                            setShowSuccess(false)
                            setPlaySound(false)
                            setCurrentPerkIndex(0)
                        }}
                        className="flex-1"
                    >
                        Reset
                    </Button>
                </div>
            </div>
        </DevPageShell>
    )
}
