'use client'

import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import PioneerCard3D from '@/components/LandingPage/PioneerCard3D'

const STORAGE_KEY = 'card-pioneer-modal-dismissed'
const DISMISS_DURATION_DAYS = 7

interface CardPioneerModalProps {
    isEligible: boolean
    hasPurchased: boolean
    slotsRemaining?: number
}

/**
 * Full-screen modal shown to eligible users who haven't purchased Card Pioneer yet.
 * Shown on app open, dismissible with "Maybe Later" (re-shows after X days).
 */
const CardPioneerModal = ({ isEligible, hasPurchased, slotsRemaining }: CardPioneerModalProps) => {
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
        <Transition show={isVisible} as={Fragment}>
            <Dialog className="fixed inset-0 z-50 flex items-center justify-center" onClose={handleDismiss}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
                </Transition.Child>

                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                >
                    <Dialog.Panel className="relative z-10 flex h-full w-full flex-col bg-gradient-to-b from-purple-900 via-purple-800 to-black">
                        {/* Close Button */}
                        <button
                            onClick={handleDismiss}
                            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
                        >
                            <Icon name="cancel" className="h-6 w-6 text-white" />
                        </button>

                        {/* Content */}
                        <div className="flex flex-1 flex-col items-center justify-center px-6">
                            {/* Card Hero using PioneerCard3D component */}
                            <div className="relative mb-8">
                                <PioneerCard3D />
                            </div>

                            {/* Text */}
                            <h1 className="mb-4 text-center text-3xl font-bold text-white">
                                Get Early Access to
                                <br />
                                Peanut Card
                            </h1>
                            <p className="mb-6 max-w-sm text-center text-lg text-white/70">
                                Join Card Pioneers now and be among the first to get the Peanut Card when it launches.
                            </p>

                            {/* Benefits */}
                            <div className="mb-6 flex flex-wrap justify-center gap-3">
                                <Chip icon="star" text="Priority Access" />
                                <Chip icon="gift" text="$5 Referral Bonus" />
                                <Chip icon="badge" text="Pioneer Badge" />
                            </div>

                            {/* Slots remaining counter - larger and below benefits */}
                            {slotsRemaining !== undefined && (
                                <p className="mb-8 text-center text-2xl font-bold text-yellow-1">
                                    {slotsRemaining} slots left
                                </p>
                            )}
                        </div>

                        {/* CTAs - Responsive sizing for desktop/mobile */}
                        <div className="mx-auto w-full max-w-md space-y-3 p-6">
                            <Button
                                variant="purple"
                                size="large"
                                shadowSize="4"
                                onClick={handleJoinNow}
                                className="w-full bg-white text-purple-900 hover:bg-white/90"
                            >
                                Join Card Pioneers
                            </Button>
                            <Button
                                variant="transparent"
                                size="large"
                                onClick={handleDismiss}
                                className="w-full text-white/70"
                            >
                                Maybe Later
                            </Button>
                        </div>
                    </Dialog.Panel>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

const Chip = ({ icon, text }: { icon: string; text: string }) => (
    <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <Icon name={icon as any} className="h-4 w-4 text-white" />
        <span className="text-sm font-medium text-white">{text}</span>
    </div>
)

export default CardPioneerModal
