'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PERK_HOLD_DURATION_MS } from '@/constants/general.consts'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { cancelHaptic, notifyHaptic, vibrateHaptic } from '@/utils/haptics'
import type { ShakeIntensity } from '@/utils/perk.utils'
import type { QrPayment } from '@/services/manteca'

/**
 * The hold-to-claim gesture: progress, shake, haptics, confetti, and the
 * shown/claimed/dismissed analytics. Mounted by the success view only, so
 * every timer dies with the screen that started it.
 */
export function usePerkHoldToClaim(qrPayment: QrPayment | null, setQrPayment: (payment: QrPayment | null) => void) {
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<ShakeIntensity>('none')
    const [perkClaimed, setPerkClaimed] = useState(false)
    const [holdProgress, setHoldProgress] = useState(0)
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const holdStartTimeRef = useRef<number | null>(null)

    // Analytics tracking refs — read by the unmount capture below
    const hasTrackedPerkShown = useRef(false)
    const perkClaimedRef = useRef(false)

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            holdStartTimeRef.current = null
        }
    }, [])

    // Track reward claim shown + surprise moment when perk UI appears after payment
    useEffect(() => {
        perkClaimedRef.current = perkClaimed
    }, [perkClaimed])

    useEffect(() => {
        if (qrPayment?.perk?.eligible && !perkClaimed && !hasTrackedPerkShown.current) {
            hasTrackedPerkShown.current = true
            const eventProps = {
                amount_usd: qrPayment.perk.amountSponsored,
                discount_pct: qrPayment.perk.discountPercentage,
                merchant: qrPayment.details?.merchant?.name,
            }
            posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIM_SHOWN, eventProps)
            posthog.capture(ANALYTICS_EVENTS.SURPRISE_MOMENT_SHOWN, eventProps)
        }
    }, [qrPayment?.perk?.eligible, perkClaimed, qrPayment])

    // Track dismiss: user navigated away after seeing the perk without claiming.
    // The capture is deferred one tick and cancelled by a remount, so a
    // StrictMode mount/unmount/mount cycle cannot fire a phantom dismissal.
    const pendingDismissRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        if (pendingDismissRef.current) {
            clearTimeout(pendingDismissRef.current)
            pendingDismissRef.current = null
        }
        return () => {
            if (hasTrackedPerkShown.current && !perkClaimedRef.current) {
                pendingDismissRef.current = setTimeout(() => {
                    posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIM_DISMISSED)
                }, 0)
            }
        }
    }, [])

    // DEV NOTE: This is an OPTIMISTIC claim flow for better UX
    // We immediately show success UI and trigger confetti, then claim in background
    // If claim fails, we show error post-factum but keep the user in success state
    const claimPerk = useCallback(() => {
        if (!qrPayment?.externalId) return

        // 1. IMMEDIATELY show success UI (optimistic)
        setPerkClaimed(true)

        // 2. Reset shake and show success with confetti RIGHT AWAY
        setIsShaking(false)
        setShakeIntensity('none')
        setHoldProgress(0)

        // 3. Final success haptic feedback - POWERFUL celebratory double pulse!
        notifyHaptic('success')

        // 4. Trigger confetti immediately
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } })

        // 5. Surface the reward. The perk was already issued AND claimed
        //    server-side during QR-payment processing, and qrPayment.perk
        //    already carries the sponsored amount from that response — so mark
        //    it claimed and report it directly. (The old /perks/claim round-trip
        //    took a mantecaTransferId the endpoint no longer accepts — it now
        //    requires a usageId the client never has — so it always 400'd: pure
        //    Sentry noise, and REWARD_CLAIMED never fired because it lived in the
        //    never-reached success branch. The error it set was invisible here —
        //    the success screen doesn't render errorMessage.)
        const claimedPerk = qrPayment.perk
        if (claimedPerk) {
            posthog.capture(ANALYTICS_EVENTS.REWARD_CLAIMED, {
                amount_usd: claimedPerk.amountSponsored,
                discount_pct: claimedPerk.discountPercentage,
            })
            setQrPayment({ ...qrPayment, perk: { ...claimedPerk, claimed: true } })
        }
    }, [qrPayment, setQrPayment])

    // Hold-to-claim mechanics
    const cancelHold = useCallback(() => {
        const PREVIEW_DURATION_MS = 500

        // Calculate how long the user held
        const elapsed = holdStartTimeRef.current ? Date.now() - holdStartTimeRef.current : 0

        // Clear the completion timer (we'll never complete on release)
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null

        // If it was a quick tap, let the preview animation continue for 500ms before resetting
        if (elapsed > 0 && elapsed < PREVIEW_DURATION_MS) {
            const remainingPreviewTime = PREVIEW_DURATION_MS - elapsed

            // Let animations continue for the preview duration
            const resetTimer = setTimeout(() => {
                // Clean up after preview
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
                progressIntervalRef.current = null
                setHoldProgress(0)
                setIsShaking(false)
                setShakeIntensity('none')
                holdStartTimeRef.current = null

                cancelHaptic()
            }, remainingPreviewTime)

            holdTimerRef.current = resetTimer
        } else {
            // Released after preview duration - reset immediately
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
            setHoldProgress(0)
            setIsShaking(false)
            setShakeIntensity('none')
            holdStartTimeRef.current = null

            cancelHaptic()
        }
    }, [])

    const startHold = useCallback(() => {
        setHoldProgress(0)
        setIsShaking(true)

        const startTime = Date.now()
        holdStartTimeRef.current = startTime
        let lastIntensity: 'weak' | 'medium' | 'strong' | 'intense' = 'weak'

        // Update progress and shake intensity
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            const progress = Math.min((elapsed / PERK_HOLD_DURATION_MS) * 100, 100)
            setHoldProgress(progress)

            // Progressive shake intensity with haptic feedback
            let newIntensity: 'weak' | 'medium' | 'strong' | 'intense' = 'weak'
            if (progress < 25) {
                newIntensity = 'weak'
            } else if (progress < 50) {
                newIntensity = 'medium'
            } else if (progress < 75) {
                newIntensity = 'strong'
            } else {
                newIntensity = 'intense'
            }

            // Trigger haptic feedback when intensity changes
            if (newIntensity !== lastIntensity) {
                // Progressive vibration patterns that match shake intensity - MAX STRENGTH!
                switch (newIntensity) {
                    case 'weak':
                        vibrateHaptic(50) // Short but noticeable pulse
                        break
                    case 'medium':
                        vibrateHaptic([100, 40, 100]) // Medium pulse pattern
                        break
                    case 'strong':
                        vibrateHaptic([150, 40, 150, 40, 150]) // Strong pulse pattern
                        break
                    case 'intense':
                        vibrateHaptic([200, 40, 200, 40, 200, 40, 200]) // INTENSE pulse pattern
                        break
                }
                lastIntensity = newIntensity
            }

            setShakeIntensity(newIntensity)

            if (progress >= 100) {
                clearInterval(interval)
            }
        }, 50)

        progressIntervalRef.current = interval

        // Complete after hold duration
        const timer = setTimeout(() => {
            claimPerk()
        }, PERK_HOLD_DURATION_MS)

        holdTimerRef.current = timer
    }, [claimPerk])

    return { perkClaimed, holdProgress, isShaking, shakeIntensity, startHold, cancelHold }
}
