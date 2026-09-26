'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Section } from '@/components/0_Bruddle/Section'
import { useToast } from '@/components/0_Bruddle/Toast'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { isCapacitor } from '@/utils/capacitor'
import { cancelHaptic, vibrateHaptic } from '@/utils/haptics'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { getShakeClass, type ShakeIntensity } from '@/utils/perk.utils'
import { PERK_HOLD_DURATION_MS } from '@/constants/general.consts'
import DevPageShell from '../_components/DevPageShell'

export default function DevShakeTestPage() {
    const toast = useToast()
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<ShakeIntensity>('none')
    const [holdProgress, setHoldProgress] = useState(0)
    const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null)
    const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)
    const [holdStartTime, setHoldStartTime] = useState<number | null>(null)

    const startHold = useCallback(() => {
        setHoldProgress(0)
        setIsShaking(true)
        setShowSuccess(false)

        const startTime = Date.now()
        setHoldStartTime(startTime)
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

        setProgressInterval(interval)

        // Complete after hold duration
        const timer = setTimeout(() => {
            // Stop shake
            setIsShaking(false)
            setShakeIntensity('none')
            setHoldProgress(0)

            // Final success haptic feedback - POWERFUL celebratory double pulse!
            vibrateHaptic([300, 100, 300])

            // Show success and trigger confetti
            setShowSuccess(true)
            setTimeout(() => {
                shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } })
            }, 100)
        }, PERK_HOLD_DURATION_MS)

        setHoldTimer(timer)
    }, [])

    const cancelHold = useCallback(() => {
        const PREVIEW_DURATION_MS = 500

        // Calculate how long the user held
        const elapsed = holdStartTime ? Date.now() - holdStartTime : 0

        // Clear the completion timer (we'll never complete on release)
        if (holdTimer) clearTimeout(holdTimer)
        setHoldTimer(null)

        // If it was a quick tap, let the preview animation continue for 500ms before resetting
        if (elapsed > 0 && elapsed < PREVIEW_DURATION_MS) {
            const remainingPreviewTime = PREVIEW_DURATION_MS - elapsed

            // Let animations continue for the preview duration
            const resetTimer = setTimeout(() => {
                // Clean up after preview
                if (progressInterval) clearInterval(progressInterval)
                setProgressInterval(null)
                setHoldProgress(0)
                setIsShaking(false)
                setShakeIntensity('none')
                setHoldStartTime(null)

                cancelHaptic()
            }, remainingPreviewTime)

            setHoldTimer(resetTimer)
        } else {
            // Released after preview duration - reset immediately
            if (progressInterval) clearInterval(progressInterval)
            setProgressInterval(null)
            setHoldProgress(0)
            setIsShaking(false)
            setShakeIntensity('none')
            setHoldStartTime(null)

            cancelHaptic()
        }
    }, [holdTimer, progressInterval, holdStartTime])

    const reset = useCallback(() => {
        if (holdTimer) clearTimeout(holdTimer)
        if (progressInterval) clearInterval(progressInterval)
        setHoldTimer(null)
        setProgressInterval(null)
        setHoldProgress(0)
        setIsShaking(false)
        setShakeIntensity('none')
        setHoldStartTime(null)
        setShowSuccess(false)
        cancelHaptic()
    }, [holdTimer, progressInterval])

    return (
        <DevPageShell
            title="Shake test"
            description="Tunes the shake-and-hold gesture — progressive shake intensity, hold progress, haptics and the confetti payoff."
            width="prose"
            className={getShakeClass(isShaking, shakeIntensity)}
        >
            <div className="space-y-6 flex flex-col">
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    <DataRow label="Progress" value={`${Math.floor(holdProgress)}%`} />
                    <DataRow label="Shake intensity" value={shakeIntensity} />
                    <DataRow label="State" value={showSuccess ? 'success' : isShaking ? 'holding' : 'ready'} />
                    <DataRow
                        label="Haptics"
                        value={
                            isCapacitor()
                                ? 'native engine'
                                : typeof navigator !== 'undefined' && 'vibrate' in navigator
                                  ? 'web vibration API'
                                  : 'not available'
                        }
                    />
                </Card>

                {!showSuccess ? (
                    <div className="space-y-4">
                        {/* Simple vibration test button */}
                        <Button
                            onClick={() => {
                                vibrateHaptic(200)
                                const hapticResult = `Haptic fired through ${isCapacitor() ? 'the native engine' : 'the web Vibration API'}.`
                                toast.info(hapticResult)
                            }}
                            variant="secondary"
                            icon="mobile-install"
                        >
                            Vibrate for 200ms
                        </Button>

                        {/* Hold-to-claim button */}
                        <Button
                            onPointerDown={startHold}
                            onPointerUp={cancelHold}
                            onPointerLeave={cancelHold}
                            icon="star"
                        >
                            Hold to claim perk
                        </Button>

                        <ProgressBar value={holdProgress} fillClassName="bg-action-primary" />

                        <div className="text-center text-body-xs">
                            Hold the button for the full duration (quick taps show 500ms preview)
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <EmptyState
                            icon="trophy"
                            iconColor="green"
                            title="Perk claimed"
                            description="Check that the confetti appeared at the right time."
                        />

                        <Button variant="secondary" icon="retry" onClick={reset}>
                            Test again
                        </Button>
                    </div>
                )}

                <Section title="Testing checklist">
                    <Card className="p-4">
                        <BulletList
                            items={[
                                'Progress fills while you hold.',
                                'Shake starts weak and becomes stronger.',
                                'Haptic feedback intensifies with the shake in the app.',
                                'A quick tap previews the motion, then resets.',
                                'An early release cancels the action.',
                                'A full hold stops the shake, fires confetti, and sends a final haptic.',
                                'Touch and mouse input both work.',
                            ]}
                        />
                    </Card>
                </Section>
            </div>
        </DevPageShell>
    )
}
