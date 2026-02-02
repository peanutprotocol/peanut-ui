'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import BaseModal from '@/components/Global/Modal'
import PioneerCard3D from '@/components/LandingPage/PioneerCard3D'

const STORAGE_KEY = 'card-pioneer-modal-dismissed'

interface CardPioneerModalProps {
    isEligible: boolean
    hasPurchased: boolean
    slotsRemaining?: number
}

/**
 * Popup modal shown to eligible users who haven't purchased Card Pioneer yet.
 * Shown on app open, can be dismissed by closing the modal (re-shows after X days).
 */
const CardPioneerModal = ({ hasPurchased }: CardPioneerModalProps) => {
    const router = useRouter()
    const [isVisible, setIsVisible] = useState(false)

    // Check if modal should be shown
    useEffect(() => {
        // Don't show if already purchased
        // Note: Eligibility check happens during the flow (geo screen), not here
        if (hasPurchased) {
            return
        }

        // TEMP: Always show for testing (localStorage check disabled)
        // Check localStorage for dismissal
        // const dismissedAt = localStorage.getItem(STORAGE_KEY)
        // if (dismissedAt) {
        //     const dismissedDate = new Date(dismissedAt)
        //     const now = new Date()
        //     const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

        //     if (daysSinceDismissed < DISMISS_DURATION_DAYS) {
        //         return // Still within dismissal period
        //     }
        // }

        // Show modal with a small delay for better UX
        const timer = setTimeout(() => {
            setIsVisible(true)
        }, 1000)

        return () => clearTimeout(timer)
    }, [hasPurchased])

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString())
        setIsVisible(false)
    }

    const handleJoinNow = () => {
        setIsVisible(false)
        router.push('/card')
    }

    return (
        <BaseModal
            visible={isVisible}
            onClose={handleDismiss}
            className="items-center justify-center md:mx-auto md:max-w-md"
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-white rounded-none !border-0 z-50 max-w-[85%]"
        >
            <div className="flex flex-col items-center gap-4 p-6 text-center">
                {/* Title */}
                <h3 className="text-base font-bold text-black dark:text-white">Become a Pioneer</h3>

                {/* Description */}
                <p className="text-sm text-grey-1 dark:text-white">
                    Join the Peanut Card Pioneers now to earn rewards for every purchase of you and your friends!
                </p>

                {/* Card Hero - scaled down for popup */}
                <div className="relative -my-12 origin-center scale-50">
                    <PioneerCard3D />
                </div>

                {/* CTA */}
                <div className="w-full space-y-4">
                    <Button
                        variant="purple"
                        size="large"
                        shadowSize="4"
                        onClick={handleJoinNow}
                        className="w-full justify-center"
                    >
                        Get Early Access
                    </Button>
                </div>
            </div>
        </BaseModal>
    )
}

export default CardPioneerModal
