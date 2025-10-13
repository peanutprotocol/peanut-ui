'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { shootDoubleStarConfetti } from '@/utils/confetti'

export default function DevShakeTestPage() {
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<'none' | 'weak' | 'medium' | 'strong' | 'intense'>('none')
    const [holdProgress, setHoldProgress] = useState(0)
    const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null)
    const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)

    const HOLD_DURATION = 1500 // 1.5 seconds

    const startHold = useCallback(() => {
        setHoldProgress(0)
        setIsShaking(true)
        setShowSuccess(false)

        const startTime = Date.now()
        let lastIntensity: 'weak' | 'medium' | 'strong' | 'intense' = 'weak'

        // Update progress and shake intensity
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100)
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
            if (newIntensity !== lastIntensity && 'vibrate' in navigator) {
                // Progressive vibration patterns that match shake intensity - MAX STRENGTH!
                switch (newIntensity) {
                    case 'weak':
                        navigator.vibrate(50) // Short but noticeable pulse
                        break
                    case 'medium':
                        navigator.vibrate([100, 40, 100]) // Medium pulse pattern
                        break
                    case 'strong':
                        navigator.vibrate([150, 40, 150, 40, 150]) // Strong pulse pattern
                        break
                    case 'intense':
                        navigator.vibrate([200, 40, 200, 40, 200, 40, 200]) // INTENSE pulse pattern
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
            if ('vibrate' in navigator) {
                navigator.vibrate([300, 100, 300])
            }

            // Show success and trigger confetti
            setShowSuccess(true)
            setTimeout(() => {
                shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.5 } })
            }, 100)
        }, HOLD_DURATION)

        setHoldTimer(timer)
    }, [])

    const cancelHold = useCallback(() => {
        if (holdTimer) clearTimeout(holdTimer)
        if (progressInterval) clearInterval(progressInterval)
        setHoldTimer(null)
        setProgressInterval(null)
        setHoldProgress(0)
        setIsShaking(false)
        setShakeIntensity('none')

        // Stop any ongoing vibration when user releases early
        if ('vibrate' in navigator) {
            navigator.vibrate(0)
        }
    }, [holdTimer, progressInterval])

    const reset = useCallback(() => {
        cancelHold()
        setShowSuccess(false)
    }, [cancelHold])

    // Get the appropriate shake class based on intensity
    const getShakeClass = () => {
        if (!isShaking) return ''
        switch (shakeIntensity) {
            case 'weak':
                return 'perk-shake-weak'
            case 'medium':
                return 'perk-shake-medium'
            case 'strong':
                return 'perk-shake-strong'
            case 'intense':
                return 'perk-shake-intense'
            default:
                return ''
        }
    }

    return (
        <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass()}`}>
            <NavHeader title="🧪 Dev Shake Test" />

            <div className="my-auto flex h-full flex-col justify-center space-y-6 px-4">
                <Card className="space-y-4 p-6">
                    <h2 className="text-center text-2xl font-bold">Shake & Hold Test</h2>
                    <p className="text-center text-sm text-gray-600">
                        Test the progressive shake animation and confetti effect
                    </p>

                    <div className="space-y-3">
                        <div className="rounded-lg bg-gray-100 p-3 text-sm">
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
                                    {typeof navigator !== 'undefined' && 'vibrate' in navigator
                                        ? '✅ Available'
                                        : '❌ Not Available'}
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
                                if ('vibrate' in navigator) {
                                    const success = navigator.vibrate(200)
                                    console.log('Vibration API called, success:', success)
                                    alert(`Vibration triggered! Did you feel it? API returned: ${success}`)
                                } else {
                                    alert('Vibration API not available on this device')
                                }
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

                        <div className="text-center text-xs text-gray-500">
                            Press and hold the button to test the progressive shake
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Card className="bg-green-50 p-6">
                            <div className="space-y-2 text-center">
                                <div className="text-4xl">🎉</div>
                                <h3 className="text-xl font-bold text-green-800">Perk Claimed!</h3>
                                <p className="text-sm text-green-700">Check if confetti appeared at the right time</p>
                            </div>
                        </Card>

                        <Button variant="primary-soft" shadowSize="4" onClick={reset}>
                            🔄 Test Again
                        </Button>
                    </div>
                )}

                <Card className="space-y-2 bg-orange-50 p-4">
                    <h3 className="font-bold text-orange-900">Testing Checklist:</h3>
                    <ul className="space-y-1 text-sm text-orange-800">
                        <li>✓ Button fills with black as you hold</li>
                        <li>✓ Shake starts weak and gets progressively stronger</li>
                        <li>✓ Haptic feedback intensifies with shake (PWA only)</li>
                        <li>✓ Shake stops when you release early</li>
                        <li>✓ After full hold: shake stops, confetti appears, final haptic</li>
                        <li>✓ Works on mobile touch and desktop mouse</li>
                    </ul>
                </Card>
            </div>
        </div>
    )
}
