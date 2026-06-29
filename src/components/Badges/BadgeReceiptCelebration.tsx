'use client'

/**
 * <BadgeReceiptCelebration /> — the fullscreen "badge unlocked!" moment (TASK-19791).
 *
 * Globally mounted (ClientProviders), self-contained: it asks
 * useBadgeReceiptCelebration() whether the signed-in user has a fresh,
 * not-yet-celebrated badge and, if so, takes over the screen with the badge
 * art, celebratory copy, confetti + haptics, and a single Continue button.
 * Continue stamps the per-user localStorage seen-set so the moment fires
 * exactly once. Renders nothing when there's no pending badge.
 *
 * WAITLIST_SKIP is excluded upstream — it keeps its bespoke card-flow
 * celebration (BadgeSkipCelebration).
 */

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import posthog from 'posthog-js'
import { useHaptic } from 'use-haptic'
import { Button } from '@/components/0_Bruddle/Button'
import { getBadgeDisplayName, getBadgeIcon, getPublicBadgeDescription } from '@/components/Badges/badge.utils'
import { useBadgeReceiptCelebration } from '@/components/Badges/useBadgeReceiptCelebration'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

export default function BadgeReceiptCelebration() {
    const { pending, dismiss } = useBadgeReceiptCelebration()
    const { triggerHaptic } = useHaptic()
    const code = pending?.code

    // Fire confetti + haptic + the shown event once per distinct badge reveal.
    useEffect(() => {
        if (!code) return
        triggerHaptic()
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.35 } })
        posthog.capture(ANALYTICS_EVENTS.BADGE_CELEBRATION_SHOWN, { badge_code: code })
    }, [code, triggerHaptic])

    const handleContinue = () => {
        if (code) posthog.capture(ANALYTICS_EVENTS.BADGE_CELEBRATION_DISMISSED, { badge_code: code })
        dismiss()
    }

    return (
        <AnimatePresence>
            {pending && (
                <motion.div
                    key={pending.code}
                    className="fixed inset-0 z-[60] flex flex-col items-center justify-between gap-8 bg-primary-3 p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Badge unlocked"
                >
                    <div className="my-auto flex flex-col items-center gap-6 text-center">
                        <motion.img
                            src={getBadgeIcon(pending.code)}
                            alt={getBadgeDisplayName(pending.code, pending.name)}
                            className="h-40 w-40 object-contain drop-shadow-[0.25rem_0.25rem_0_#000]"
                            initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.05 }}
                        />
                        <motion.div
                            className="flex flex-col gap-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                        >
                            <p className="text-sm font-bold uppercase tracking-wide text-n-1">Badge unlocked!</p>
                            <h1 className="text-3xl font-extrabold text-n-1">
                                {getBadgeDisplayName(pending.code, pending.name)}
                            </h1>
                            {(pending.description || getPublicBadgeDescription(pending.code)) && (
                                <p className="text-grey-1">
                                    {pending.description || getPublicBadgeDescription(pending.code)}
                                </p>
                            )}
                        </motion.div>
                    </div>

                    <motion.div
                        className="w-full max-w-md"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.35 }}
                    >
                        <Button onClick={handleContinue} variant="purple" shadowSize="4" className="w-full">
                            Continue
                        </Button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
