'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { isCapacitor } from '@/utils/capacitor'
import { cancelHaptic, vibrateHaptic } from '@/utils/haptics'
import Card from '@/components/Global/Card'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { getShakeClass, type ShakeIntensity } from '@/utils/perk.utils'
import { PERK_HOLD_DURATION_MS } from '@/constants/general.consts'
import DevPageShell from '../_components/DevPageShell'

export default function DevShakeTestPage() {
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
            title="🧪 Dev Shake Test"
            description="Tunes the shake-and-hold gesture — progressive shake intensity, hold progress, haptics and the confetti payoff."
            width="prose"
            className={getShakeClass(isShaking, shakeIntensity)}
        >
            <div className="space-y-6 flex flex-col">
                <Card className="space-y-4 p-6">
                    <h2 className="text-center text-2xl font-bold">Shake & Hold Test</h2>
                    <p className="text-gray-600 text-center text-sm">
                        Test the progressive shake animation and confetti effect
                    </p>

                    <div className="space-y-3">
                        <div className="bg-gray-100 rounded-lg p-3 text-sm">
                            <div className="flex justify-between">
                                <span>Progress:</span>
                                <span className="font-mono font-bold">{Math.floor(holdProgress)}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Shake Intensity:</span>
                                <span className="font-mono font-bold capitalize">{shakeIntensity}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>State:</span>
                                <span className="font-mono font-bold">
                                    {showSuccess ? '✅ Success!' : isShaking ? '🔄 Holding...' : '⏸️ Ready'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Haptics:</span>
                                <span className="font-mono font-bold">
                                    {isCapacitor()
                                        ? '✅ @capacitor/haptics (native engine)'
                                        : typeof navigator !== 'undefined' && 'vibrate' in navigator
                                          ? '✅ Vibration API (web)'
                                          : '❌ None — iOS web has no Vibration API'}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                {!showSuccess ? (
                    <div className="space-y-4">
                        {/* Simple vibration test button */}
                        <Button
                            onClick={() => {
                                vibrateHaptic(200)
                                alert(
                                    `Haptic fired via ${isCapacitor() ? 'the native engine' : 'the web Vibration API'}. Did you feel it?`
                                )
                            }}
                            variant="primary-soft"
                            shadowSize="4"
                        >
                            📳 Simple Test: Vibrate 200ms
                        </Button>

                        {/* Hold-to-claim button */}
                        <Button
                            onPointerDown={startHold}
                            onPointerUp={cancelHold}
                            onPointerLeave={cancelHold}
                            shadowSize="4"
                            className="relative overflow-hidden"
                        >
                            {/* Black progress fill from left to right */}
                            <div
                                className="absolute inset-0 bg-black transition-all duration-100"
                                style={{
                                    width: `${holdProgress}%`,
                                    left: 0,
                                }}
                            />
                            <span className="relative z-10">⭐ Hold to Claim Perk</span>
                        </Button>

                        <div className="text-gray-500 text-center text-xs">
                            Hold the button for the full duration (quick taps show 500ms preview)
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Card className="bg-green-50 p-6">
                            <div className="space-y-2 text-center">
                                <div className="text-4xl">🎉</div>
                                <h3 className="text-green-800 text-xl font-bold">Perk Claimed!</h3>
                                <p className="text-green-700 text-sm">Check if confetti appeared at the right time</p>
                            </div>
                        </Card>

                        <Button variant="primary-soft" shadowSize="4" onClick={reset}>
                            🔄 Test Again
                        </Button>
                    </div>
                )}

                <Card className="bg-orange-50 space-y-2 p-4">
                    <h3 className="text-orange-900 font-bold">Testing Checklist:</h3>
                    <ul className="text-orange-800 space-y-1 text-sm">
                        <li>✓ Button fills with black as you hold</li>
                        <li>✓ Shake starts weak and gets progressively stronger</li>
                        <li>✓ Haptic feedback intensifies with shake (PWA only)</li>
                        <li>✓ Quick tap shows preview but resets (must hold full duration)</li>
                        <li>✓ Release early cancels the action</li>
                        <li>✓ After full hold: shake stops, confetti appears, final haptic</li>
                        <li>✓ Works on mobile touch and desktop mouse</li>
                    </ul>
                </Card>
            </div>
        </DevPageShell>
    )
}
