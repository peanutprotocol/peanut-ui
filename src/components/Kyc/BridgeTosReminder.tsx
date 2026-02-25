'use client'

import { useState, useCallback } from 'react'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useAuth } from '@/context/authContext'
import { type CardPosition } from '@/components/Global/Card/card.utils'

interface BridgeTosReminderProps {
    position?: CardPosition
}

// shown in the activity feed when user has bridge rails needing ToS acceptance.
// clicking opens the bridge ToS flow.
export const BridgeTosReminder = ({ position = 'single' }: BridgeTosReminderProps) => {
    const { fetchUser } = useAuth()
    const [showTosStep, setShowTosStep] = useState(false)
    const [tosJustAccepted, setTosJustAccepted] = useState(false)

    const handleClick = useCallback(() => {
        setShowTosStep(true)
    }, [])

    const handleComplete = useCallback(async () => {
        setShowTosStep(false)
        setTosJustAccepted(true) // optimistically hide — backend rail transition is async
        await fetchUser()
    }, [fetchUser])

    const handleSkip = useCallback(() => {
        setShowTosStep(false)
    }, [])

    if (tosJustAccepted) return null

    return (
        <>
            <Card position={position} onClick={handleClick} className="cursor-pointer">
                <div className="flex items-center gap-3 p-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-yellow-1">
                        <Icon name="alert" className="size-5 text-black" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold">Accept terms of service</p>
                        <p className="text-xs text-grey-1">Required to enable bank transfers</p>
                    </div>
                    <Icon name="chevron-up" className="size-4 rotate-90 text-grey-1" />
                </div>
            </Card>

            <BridgeTosStep visible={showTosStep} onComplete={handleComplete} onSkip={handleSkip} />
        </>
    )
}
