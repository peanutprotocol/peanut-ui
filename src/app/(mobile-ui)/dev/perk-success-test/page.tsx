'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import GlobalCard from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import Image from 'next/image'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useHaptic } from 'use-haptic'
import { shootDoubleStarConfetti } from '@/utils/confetti'

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

    const inviteeName = currentPerk.reason?.split(' became')[0] || 'Your friend'

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
                    <p className="text-sm font-bold">Current Mock Perk ({currentPerkIndex + 1}/{MOCK_PERKS.length})</p>
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
                            className={`flex flex-col items-center py-4 ${canDismiss ? 'cursor-pointer' : ''} ${isExiting ? 'animate-gift-exit' : 'animate-gift-revealed'}`}
                            onClick={handleDismiss}
                        >
                            {playSound && <SoundPlayer sound="success" />}

                            {/* Peanut mascot */}
                            <div className="relative mb-2">
                                <Image
                                    src={chillPeanutAnim.src}
                                    alt="Peanut Mascot"
                                    width={120}
                                    height={120}
                                    className="h-28 w-28"
                                    unoptimized
                                />
                            </div>

                            {/* Success card */}
                            <GlobalCard className="flex w-full max-w-[200px] items-center gap-3 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                                        <Icon name="check" size={24} />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm font-normal text-grey-1">You claimed</p>
                                    <p className="text-2xl font-extrabold">+${currentPerk.amountUsd}</p>
                                    <p className="flex items-center gap-1 text-sm font-medium text-grey-1">
                                        {inviteeName} <Icon name="invite-heart" size={14} />
                                    </p>
                                </div>
                            </GlobalCard>

                            <p className={`mt-3 text-xs ${canDismiss ? 'text-grey-1' : 'text-grey-1/50'}`}>
                                {canDismiss ? 'Tap to continue' : 'Wait...'}
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
