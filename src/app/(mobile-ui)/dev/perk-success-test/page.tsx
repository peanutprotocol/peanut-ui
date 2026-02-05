'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import GlobalCard from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useHaptic } from 'use-haptic'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { extractInviteeName } from '@/utils/general.utils'

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
    const { triggerHaptic } = useHaptic()

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
        <div className="flex min-h-[inherit] flex-col gap-4 pb-8">
            <NavHeader title="Perk Success Test" />

            <div className="space-y-4 px-4">
                {/* Instructions */}
                <Card className="bg-blue-50 p-4">
                    <p className="text-sm font-bold text-blue-900">Test the perk claim success screen</p>
                    <ul className="mt-1 space-y-1 text-sm text-blue-800">
                        <li>1. Click "Trigger Success" to show the success screen</li>
                        <li>2. Wait 2 seconds before you can dismiss (debounce)</li>
                        <li>3. Tap to dismiss and load next mock perk</li>
                    </ul>
                </Card>

                {/* Current Perk Info */}
                <Card className="p-4">
                    <p className="text-sm font-bold">
                        Current Mock Perk ({currentPerkIndex + 1}/{MOCK_PERKS.length})
                    </p>
                    <p className="mt-1 text-xs text-grey-1">ID: {currentPerk.id}</p>
                    <p className="text-xs text-grey-1">Amount: ${currentPerk.amountUsd}</p>
                    <p className="text-xs text-grey-1">Reason: {currentPerk.reason}</p>
                </Card>

                {/* Trigger Button */}
                {!showSuccess && (
                    <Button onClick={handleShowSuccess} shadowSize="4" className="w-full">
                        Trigger Success
                    </Button>
                )}

                {/* Success Screen Preview */}
                {showSuccess && (
                    <div className="rounded-lg border-2 border-dashed border-grey-1/30 p-4">
                        <p className="mb-4 text-center text-xs font-bold text-grey-1">
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
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success-3">
                                    <Icon name="check" size={28} className="text-white" />
                                </div>

                                {/* Text content */}
                                <div>
                                    <p className="text-sm text-grey-1">You received</p>
                                    <p className="text-3xl font-extrabold">+${currentPerk.amountUsd}</p>
                                    <p className="mt-1 flex items-center gap-1 text-sm text-grey-1">
                                        <Icon name="invite-heart" size={14} />
                                        <span className="font-medium">{inviteeName}</span>
                                        <span>joined Pioneers</span>
                                    </p>
                                </div>
                            </GlobalCard>

                            {/* Tap to continue - fades in when ready */}
                            <p
                                className={`mt-4 text-sm text-grey-1 transition-opacity duration-300 ${canDismiss ? 'opacity-100' : 'opacity-0'}`}
                            >
                                Tap to continue
                            </p>
                        </div>
                    </div>
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
        </div>
    )
}
