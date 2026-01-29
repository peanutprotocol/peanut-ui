'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import NavHeader from '@/components/Global/NavHeader'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { Icon } from '@/components/Global/Icons/Icon'
import { useHaptic } from 'use-haptic'

type GiftVariant = 'combined' | 'ribbon-lift' | 'lid-peek' | 'paper-tear' | 'shake-burst'

// Config
const TAP_PROGRESS = 12 // % per tap
const HOLD_PROGRESS_PER_SEC = 80 // % per second of holding
const SHAKE_PROGRESS = 15 // % per shake
const DECAY_RATE = 8 // % per second when not interacting
const DECAY_ENABLED = true

export default function DevGiftTestPage() {
    const [selectedVariant, setSelectedVariant] = useState<GiftVariant>('combined')
    const [progress, setProgress] = useState(0)
    const [isComplete, setIsComplete] = useState(false)
    const [isHolding, setIsHolding] = useState(false)
    const [stats, setStats] = useState({ taps: 0, holdTime: 0, shakes: 0 })

    // use-haptic for iOS support (uses AudioContext trick)
    const { triggerHaptic } = useHaptic()

    // Refs for tracking
    const holdStartTime = useRef<number | null>(null)
    const lastShakeTime = useRef(0)
    const lastHapticTime = useRef(0)
    const lastHapticIntensity = useRef<'weak' | 'medium' | 'strong' | 'intense'>('weak')
    const animationFrameRef = useRef<number | null>(null)
    const lastUpdateTime = useRef(Date.now())

    // Reset state
    const reset = useCallback(() => {
        setProgress(0)
        setIsComplete(false)
        setIsHolding(false)
        setStats({ taps: 0, holdTime: 0, shakes: 0 })
        holdStartTime.current = null
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }, [])

    // Complete the unwrap
    const complete = useCallback(() => {
        setIsComplete(true)
        setProgress(100)
        // Haptic feedback - use both methods for best coverage
        triggerHaptic() // iOS support via AudioContext
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 200])
        }
        shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })
    }, [triggerHaptic])

    // Main update loop - handles hold progress, decay, and progressive haptics
    useEffect(() => {
        if (isComplete) return

        const update = () => {
            const now = Date.now()
            const deltaTime = (now - lastUpdateTime.current) / 1000
            lastUpdateTime.current = now

            setProgress((prev) => {
                let newProgress = prev

                // Add progress if holding
                if (isHolding && holdStartTime.current) {
                    newProgress += HOLD_PROGRESS_PER_SEC * deltaTime

                    // Progressive haptic feedback - trigger on intensity threshold changes
                    if ('vibrate' in navigator) {
                        let intensity: 'weak' | 'medium' | 'strong' | 'intense' = 'weak'
                        if (newProgress < 25) {
                            intensity = 'weak'
                        } else if (newProgress < 50) {
                            intensity = 'medium'
                        } else if (newProgress < 75) {
                            intensity = 'strong'
                        } else {
                            intensity = 'intense'
                        }

                        // Only vibrate when crossing intensity thresholds (like shake-test)
                        if (intensity !== lastHapticIntensity.current) {
                            switch (intensity) {
                                case 'weak':
                                    navigator.vibrate(50)
                                    break
                                case 'medium':
                                    navigator.vibrate([100, 40, 100])
                                    break
                                case 'strong':
                                    navigator.vibrate([150, 40, 150, 40, 150])
                                    break
                                case 'intense':
                                    navigator.vibrate([200, 40, 200, 40, 200, 40, 200])
                                    break
                            }
                            lastHapticIntensity.current = intensity
                        }
                    }
                }
                // Decay if not holding and decay is enabled
                else if (DECAY_ENABLED && prev > 0) {
                    newProgress -= DECAY_RATE * deltaTime
                }

                newProgress = Math.max(0, Math.min(100, newProgress))

                // Check completion
                if (newProgress >= 100 && !isComplete) {
                    complete()
                    return 100
                }

                return newProgress
            })

            animationFrameRef.current = requestAnimationFrame(update)
        }

        lastUpdateTime.current = Date.now()
        animationFrameRef.current = requestAnimationFrame(update)

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
        }
    }, [isHolding, isComplete, complete])

    // Handle tap
    const handleTap = useCallback(() => {
        if (isComplete) return

        setStats((s) => ({ ...s, taps: s.taps + 1 }))
        setProgress((prev) => {
            const newProgress = Math.min(prev + TAP_PROGRESS, 100)
            if (newProgress >= 100) {
                complete()
            }
            return newProgress
        })

        // Haptic feedback - use both for best coverage
        triggerHaptic()
        if ('vibrate' in navigator) {
            navigator.vibrate(20)
        }
    }, [isComplete, complete, triggerHaptic])

    // Handle hold start
    const handleHoldStart = useCallback(() => {
        if (isComplete) return
        setIsHolding(true)
        holdStartTime.current = Date.now()
    }, [isComplete])

    // Handle hold end
    const handleHoldEnd = useCallback(() => {
        if (holdStartTime.current) {
            const duration = Date.now() - holdStartTime.current
            setStats((s) => ({ ...s, holdTime: s.holdTime + duration }))
        }
        setIsHolding(false)
        holdStartTime.current = null
    }, [])

    // Handle shake
    useEffect(() => {
        if (isComplete) return

        const handleMotion = (event: DeviceMotionEvent) => {
            const acc = event.accelerationIncludingGravity
            if (!acc || acc.x === null || acc.y === null || acc.z === null) return

            const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2)
            const now = Date.now()

            // Debounce shakes (100ms between shakes)
            if (magnitude > 20 && now - lastShakeTime.current > 100) {
                lastShakeTime.current = now
                setStats((s) => ({ ...s, shakes: s.shakes + 1 }))
                setProgress((prev) => {
                    const newProgress = Math.min(prev + SHAKE_PROGRESS, 100)
                    if (newProgress >= 100) {
                        complete()
                    }
                    return newProgress
                })

                if ('vibrate' in navigator) {
                    navigator.vibrate(30)
                }
            }
        }

        // Request permission for iOS
        if (
            typeof DeviceMotionEvent !== 'undefined' &&
            typeof (DeviceMotionEvent as any).requestPermission === 'function'
        ) {
            // Will be triggered by user interaction
        } else {
            window.addEventListener('devicemotion', handleMotion)
        }

        return () => window.removeEventListener('devicemotion', handleMotion)
    }, [isComplete, complete])

    // Request motion permission (iOS)
    const requestMotionPermission = async () => {
        if (
            typeof DeviceMotionEvent !== 'undefined' &&
            typeof (DeviceMotionEvent as any).requestPermission === 'function'
        ) {
            try {
                const permission = await (DeviceMotionEvent as any).requestPermission()
                if (permission === 'granted') {
                    window.addEventListener('devicemotion', () => {})
                }
            } catch (e) {
                console.error('Motion permission denied', e)
            }
        }
    }

    // Calculate visual values
    const ribbonLift = (progress / 100) * 25
    const ribbonRotate = (progress / 100) * 40
    const shakeIntensity = progress < 25 ? 1 : progress < 50 ? 2 : progress < 75 ? 3 : 4
    const glowOpacity = (progress / 100) * 0.4

    return (
        <div className="flex min-h-[inherit] flex-col gap-4 pb-8">
            <NavHeader title="Gift Unwrap Test" />

            <div className="space-y-4 px-4">
                {/* Variant selector */}
                <Card className="p-4">
                    <p className="mb-2 text-sm font-bold">Gift Box Style:</p>
                    <div className="flex flex-wrap gap-2">
                        {(['combined', 'ribbon-lift', 'lid-peek', 'paper-tear', 'shake-burst'] as GiftVariant[]).map(
                            (v) => (
                                <button
                                    key={v}
                                    onClick={() => {
                                        setSelectedVariant(v)
                                        reset()
                                    }}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                        selectedVariant === v ? 'bg-primary-1 text-white' : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    {v === 'combined' ? 'Combined (Best)' : v}
                                </button>
                            )
                        )}
                    </div>
                </Card>

                {/* Stats display */}
                <div className="rounded-lg bg-gray-100 p-3 text-sm">
                    <div className="flex justify-between">
                        <span>Progress:</span>
                        <span className="font-mono font-bold">{Math.floor(progress)}%</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Taps: {stats.taps}</span>
                        <span>Hold: {(stats.holdTime / 1000).toFixed(1)}s</span>
                        <span>Shakes: {stats.shakes}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-300">
                        <div
                            className="h-full bg-primary-1 transition-all duration-75"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Gift Box Preview */}
                <div className="flex min-h-[300px] items-center justify-center rounded-xl bg-gradient-to-br from-yellow-50 to-pink-50 p-8">
                    {!isComplete ? (
                        <GiftBox
                            variant={selectedVariant}
                            progress={progress}
                            isHolding={isHolding}
                            ribbonLift={ribbonLift}
                            ribbonRotate={ribbonRotate}
                            shakeIntensity={shakeIntensity}
                            glowOpacity={glowOpacity}
                            onTap={handleTap}
                            onHoldStart={handleHoldStart}
                            onHoldEnd={handleHoldEnd}
                        />
                    ) : (
                        <div className="animate-gift-revealed text-center">
                            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary-1">
                                <Icon name="check" size={32} className="text-white" />
                            </div>
                            <p className="text-xl font-bold">+$5 claimed!</p>
                            <p className="text-sm text-grey-1">Gift unwrapped successfully</p>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                    <button onClick={reset} className="flex-1 rounded-lg bg-gray-200 py-3 font-medium text-gray-700">
                        Reset
                    </button>
                    <button
                        onClick={requestMotionPermission}
                        className="flex-1 rounded-lg bg-blue-100 py-3 font-medium text-blue-700"
                    >
                        Enable Shake (iOS)
                    </button>
                </div>

                {/* Vibration test buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            triggerHaptic()
                            alert('use-haptic triggered! (works on iOS)')
                        }}
                        className="flex-1 rounded-lg bg-purple-100 py-3 font-medium text-purple-700"
                    >
                        📳 Test use-haptic
                    </button>
                    <button
                        onClick={() => {
                            if ('vibrate' in navigator) {
                                const success = navigator.vibrate([200, 100, 200])
                                alert(`navigator.vibrate: ${success}`)
                            } else {
                                alert('Vibration API not available')
                            }
                        }}
                        className="flex-1 rounded-lg bg-orange-100 py-3 font-medium text-orange-700"
                    >
                        📳 Test vibrate API
                    </button>
                </div>

                {/* Instructions */}
                <Card className="bg-green-50 p-4">
                    <p className="text-sm font-bold text-green-900">How to unwrap:</p>
                    <ul className="mt-1 space-y-1 text-sm text-green-800">
                        <li>
                            • <strong>Tap</strong> the gift repeatedly
                        </li>
                        <li>
                            • <strong>Hold</strong> your finger on it
                        </li>
                        <li>
                            • <strong>Shake</strong> your phone
                        </li>
                        <li className="text-xs text-green-600">
                            All inputs work together! Progress slowly decays when idle.
                        </li>
                    </ul>
                </Card>

                {/* Config info */}
                <Card className="bg-gray-50 p-4 text-xs text-gray-600">
                    <p className="font-bold">Config:</p>
                    <p>
                        Tap: +{TAP_PROGRESS}% | Hold: +{HOLD_PROGRESS_PER_SEC}%/s | Shake: +{SHAKE_PROGRESS}%
                    </p>
                    <p>Decay: {DECAY_ENABLED ? `${DECAY_RATE}%/s` : 'disabled'}</p>
                </Card>
            </div>
        </div>
    )
}

interface GiftBoxProps {
    variant: GiftVariant
    progress: number
    isHolding: boolean
    ribbonLift: number
    ribbonRotate: number
    shakeIntensity: number
    glowOpacity: number
    onTap: () => void
    onHoldStart: () => void
    onHoldEnd: () => void
}

function GiftBox({
    variant,
    progress,
    isHolding,
    ribbonLift,
    ribbonRotate,
    shakeIntensity,
    glowOpacity,
    onTap,
    onHoldStart,
    onHoldEnd,
}: GiftBoxProps) {
    const [shakeFrame, setShakeFrame] = useState(0)

    // Animate shake wobble
    useEffect(() => {
        if (progress === 0) return
        const interval = setInterval(() => {
            setShakeFrame((f) => f + 1)
        }, 50)
        return () => clearInterval(interval)
    }, [progress])

    const wobble = progress > 0 ? Math.sin(shakeFrame * 0.5) * shakeIntensity * 1.5 : 0

    // Combined tap + hold handlers
    const handlePointerDown = () => {
        onTap() // Count as tap
        onHoldStart() // Start hold
    }

    return (
        <div
            className="relative cursor-pointer touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerUp={onHoldEnd}
            onPointerLeave={onHoldEnd}
            onPointerCancel={onHoldEnd}
            style={{
                transform: `rotate(${wobble}deg) scale(${1 + progress / 500})`,
            }}
        >
            {/* Glow effect */}
            <div
                className="absolute inset-0 -m-6 rounded-3xl bg-primary-1 blur-2xl transition-opacity"
                style={{ opacity: glowOpacity }}
            />

            {variant === 'combined' && (
                <CombinedGift
                    progress={progress}
                    ribbonLift={ribbonLift}
                    ribbonRotate={ribbonRotate}
                    shakeIntensity={shakeIntensity}
                    isHolding={isHolding}
                />
            )}

            {variant === 'ribbon-lift' && (
                <RibbonLiftGift progress={progress} ribbonLift={ribbonLift} ribbonRotate={ribbonRotate} />
            )}

            {variant === 'lid-peek' && <LidPeekGift progress={progress} />}

            {variant === 'paper-tear' && <PaperTearGift progress={progress} />}

            {variant === 'shake-burst' && <ShakeBurstGift progress={progress} shakeIntensity={shakeIntensity} />}

            {/* Tap hint */}
            {progress === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse rounded-full bg-white/90 px-4 py-2 text-sm font-medium shadow-lg">
                        Tap & Hold!
                    </div>
                </div>
            )}
        </div>
    )
}

// Combined variant: Ribbon opens + whole gift shakes + holographic shine
function CombinedGift({
    progress,
    ribbonLift,
    ribbonRotate,
    shakeIntensity,
    isHolding,
}: {
    progress: number
    ribbonLift: number
    ribbonRotate: number
    shakeIntensity: number
    isHolding: boolean
}) {
    // Ribbon opens outward instead of lifting up (max 30deg spread)
    const ribbonSpread = (progress / 100) * 30

    return (
        <div className="relative">
            {/* Box - with holographic shine effect instead of yellow glow */}
            <div
                className={`gift-box-shine relative h-36 w-44 overflow-hidden rounded-xl border-4 border-primary-1 bg-gradient-to-br from-primary-1/20 via-white to-primary-2/20 shadow-xl transition-transform ${isHolding ? 'scale-95' : ''}`}
            >
                {/* Vertical ribbon on box */}
                <div className="absolute bottom-0 left-1/2 top-0 w-5 -translate-x-1/2 bg-gradient-to-r from-primary-1/50 via-primary-1/70 to-primary-1/50" />

                {/* Horizontal ribbon on box */}
                <div className="absolute left-0 right-0 top-1/2 h-5 -translate-y-1/2 bg-gradient-to-b from-primary-1/50 via-primary-1/70 to-primary-1/50" />

                {/* Subtle light rays from center (instead of obvious yellow) */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(circle at center, rgba(255,255,255,${0.3 * (progress / 100)}) 0%, transparent 70%)`,
                    }}
                />

                {/* Cracks appearing with progress */}
                {progress > 40 && <div className="absolute left-4 top-4 h-8 w-0.5 rotate-45 bg-primary-1/40" />}
                {progress > 60 && (
                    <div className="absolute bottom-6 right-6 h-10 w-0.5 -rotate-[30deg] bg-primary-1/40" />
                )}
                {progress > 80 && <div className="absolute bottom-4 left-8 h-6 w-0.5 rotate-12 bg-primary-1/40" />}

                {/* Content hint - gift icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className={`rounded-full bg-primary-1 p-3 shadow-lg transition-transform ${progress > 50 ? 'animate-bounce' : ''}`}
                    >
                        <Icon name="gift" size={28} className="text-white" />
                    </div>
                </div>
            </div>

            {/* Ribbon bow - opens outward instead of lifting */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="relative">
                    {/* Left loop - rotates outward */}
                    <div
                        className="absolute -left-4 top-0 h-6 w-8 rounded-full border-2 border-primary-1 bg-gradient-to-br from-primary-1 to-primary-1/70 shadow-md transition-transform"
                        style={{ transform: `rotate(${-15 - ribbonSpread}deg)` }}
                    />
                    {/* Right loop - rotates outward */}
                    <div
                        className="absolute -right-4 top-0 h-6 w-8 rounded-full border-2 border-primary-1 bg-gradient-to-bl from-primary-1 to-primary-1/70 shadow-md transition-transform"
                        style={{ transform: `rotate(${15 + ribbonSpread}deg)` }}
                    />
                    {/* Center knot */}
                    <div className="relative z-10 h-5 w-5 rounded-full border-2 border-primary-1/50 bg-primary-1 shadow-lg" />
                </div>
            </div>

            {/* Particles flying out */}
            {progress > 50 && (
                <>
                    <div className="absolute -right-4 top-2 animate-ping text-lg" style={{ animationDuration: '1s' }}>
                        ✨
                    </div>
                    <div
                        className="absolute -left-4 bottom-4 animate-ping text-lg"
                        style={{ animationDuration: '1.2s', animationDelay: '0.2s' }}
                    >
                        ✨
                    </div>
                </>
            )}
            {progress > 75 && (
                <>
                    <div
                        className="absolute -top-2 right-2 animate-ping text-sm"
                        style={{ animationDuration: '0.8s', animationDelay: '0.3s' }}
                    >
                        ⭐
                    </div>
                    <div
                        className="absolute -bottom-2 left-2 animate-ping text-sm"
                        style={{ animationDuration: '1s', animationDelay: '0.1s' }}
                    >
                        ⭐
                    </div>
                </>
            )}
        </div>
    )
}

// Variant 1: Ribbon lifts and unties
function RibbonLiftGift({
    progress,
    ribbonLift,
    ribbonRotate,
}: {
    progress: number
    ribbonLift: number
    ribbonRotate: number
}) {
    return (
        <div className="relative">
            {/* Box */}
            <div className="relative h-32 w-40 rounded-xl border-4 border-primary-1 bg-gradient-to-br from-primary-1/30 via-white to-primary-2/30 shadow-lg">
                {/* Vertical ribbon */}
                <div className="absolute bottom-0 left-1/2 top-0 w-4 -translate-x-1/2 bg-gradient-to-r from-primary-1/60 via-primary-1/80 to-primary-1/60" />
                {/* Horizontal ribbon */}
                <div className="absolute left-0 right-0 top-1/2 h-4 -translate-y-1/2 bg-gradient-to-b from-primary-1/60 via-primary-1/80 to-primary-1/60" />

                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-primary-1 p-2 shadow-md">
                        <Icon name="gift" size={24} className="text-white" />
                    </div>
                </div>
            </div>

            {/* Ribbon bow - lifts */}
            <div
                className="absolute -top-6 left-1/2 -translate-x-1/2"
                style={{ transform: `translateX(-50%) translateY(-${ribbonLift}px)` }}
            >
                <div className="relative">
                    <div
                        className="border-3 absolute -left-4 top-0 h-6 w-8 rounded-full border-primary-1 bg-primary-1/80"
                        style={{ transform: `rotate(${-20 - ribbonRotate}deg)` }}
                    />
                    <div
                        className="border-3 absolute -right-4 top-0 h-6 w-8 rounded-full border-primary-1 bg-primary-1/80"
                        style={{ transform: `rotate(${20 + ribbonRotate}deg)` }}
                    />
                    <div className="relative z-10 h-5 w-5 rounded-full bg-primary-1 shadow" />
                </div>
            </div>
        </div>
    )
}

// Variant 2: Lid lifts to peek
function LidPeekGift({ progress }: { progress: number }) {
    const lidLift = (progress / 100) * 40
    const lidRotate = (progress / 100) * -25

    return (
        <div className="relative" style={{ perspective: '500px' }}>
            {/* Box base */}
            <div className="relative h-28 w-40 rounded-b-xl border-4 border-t-0 border-primary-1 bg-gradient-to-br from-primary-1/30 via-white to-primary-2/30 shadow-lg">
                <div
                    className="absolute inset-2 rounded-lg bg-gradient-to-t from-yellow-300/80 to-yellow-100/40"
                    style={{ opacity: progress / 100 }}
                />
                <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: progress / 100 }}>
                    <span className="text-3xl">💰</span>
                </div>
            </div>

            {/* Lid */}
            <div
                className="absolute -top-8 left-0 right-0 origin-bottom"
                style={{
                    transform: `translateY(-${lidLift}px) rotateX(${lidRotate}deg)`,
                    transformStyle: 'preserve-3d',
                }}
            >
                <div className="h-8 w-40 rounded-t-xl border-4 border-b-2 border-primary-1 bg-gradient-to-br from-primary-1/40 via-white to-primary-2/40 shadow-md">
                    <div className="absolute left-1/2 top-0 h-full w-4 -translate-x-1/2 bg-primary-1/60" />
                </div>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex">
                        <div
                            className="h-4 w-5 rounded-full border-2 border-primary-1 bg-primary-1/80"
                            style={{ transform: 'rotate(-15deg)' }}
                        />
                        <div
                            className="h-4 w-5 rounded-full border-2 border-primary-1 bg-primary-1/80"
                            style={{ transform: 'rotate(15deg)', marginLeft: '-4px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// Variant 3: Paper tears away
function PaperTearGift({ progress }: { progress: number }) {
    const tearProgress = progress / 100

    return (
        <div className="relative h-32 w-40 overflow-hidden rounded-xl shadow-lg">
            {/* Prize underneath */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-yellow-200 to-yellow-100">
                <div className="text-center">
                    <span className="text-4xl">💵</span>
                    <p className="mt-1 text-sm font-bold text-yellow-800">$5</p>
                </div>
            </div>

            {/* Wrapping paper pieces */}
            <div className="absolute inset-0">
                <div
                    className="absolute left-0 top-0 h-1/2 w-1/2 border-b-2 border-r-2 border-dashed border-primary-1/50 bg-gradient-to-br from-primary-1/40 via-primary-1/30 to-white"
                    style={{
                        transform: `translate(${-tearProgress * 120}%, ${-tearProgress * 120}%) rotate(${-tearProgress * 30}deg)`,
                    }}
                />
                <div
                    className="absolute right-0 top-0 h-1/2 w-1/2 border-b-2 border-l-2 border-dashed border-primary-1/50 bg-gradient-to-bl from-primary-2/40 via-primary-2/30 to-white"
                    style={{
                        transform: `translate(${tearProgress * 120}%, ${-tearProgress * 120}%) rotate(${tearProgress * 30}deg)`,
                    }}
                />
                <div
                    className="absolute bottom-0 left-0 h-1/2 w-1/2 border-r-2 border-t-2 border-dashed border-primary-1/50 bg-gradient-to-tr from-primary-1/30 via-white to-primary-2/30"
                    style={{
                        transform: `translate(${-tearProgress * 120}%, ${tearProgress * 120}%) rotate(${tearProgress * 30}deg)`,
                    }}
                />
                <div
                    className="absolute bottom-0 right-0 h-1/2 w-1/2 border-l-2 border-t-2 border-dashed border-primary-1/50 bg-gradient-to-tl from-primary-2/30 via-white to-primary-1/30"
                    style={{
                        transform: `translate(${tearProgress * 120}%, ${tearProgress * 120}%) rotate(${-tearProgress * 30}deg)`,
                    }}
                />
            </div>

            {tearProgress < 0.5 && (
                <>
                    <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 bg-primary-1/60" />
                    <div className="absolute bottom-0 left-1/2 top-0 w-3 -translate-x-1/2 bg-primary-1/60" />
                </>
            )}
        </div>
    )
}

// Variant 4: Shake until burst
function ShakeBurstGift({ progress, shakeIntensity }: { progress: number; shakeIntensity: number }) {
    return (
        <div className="relative">
            <div
                className={`relative h-32 w-40 rounded-xl border-4 border-primary-1 bg-gradient-to-br from-primary-1/30 via-white to-primary-2/30 shadow-lg ${progress > 75 ? 'animate-pulse' : ''}`}
            >
                {progress > 30 && <div className="absolute left-4 top-4 h-8 w-0.5 rotate-45 bg-primary-1/40" />}
                {progress > 50 && <div className="-rotate-30 absolute right-6 top-6 h-6 w-0.5 bg-primary-1/40" />}
                {progress > 70 && <div className="absolute bottom-4 left-8 h-10 w-0.5 rotate-12 bg-primary-1/40" />}

                <div className="absolute left-0 right-0 top-1/2 h-4 -translate-y-1/2 bg-primary-1/60" />
                <div className="absolute bottom-0 left-1/2 top-0 w-4 -translate-x-1/2 bg-primary-1/60" />

                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`rounded-full bg-primary-1 p-2 shadow-md ${progress > 50 ? 'animate-bounce' : ''}`}>
                        <Icon name="gift" size={24} className="text-white" />
                    </div>
                </div>
            </div>

            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="flex">
                    <div
                        className="h-4 w-5 rounded-full border-2 border-primary-1 bg-primary-1/80"
                        style={{ transform: 'rotate(-15deg)' }}
                    />
                    <div
                        className="h-4 w-5 rounded-full border-2 border-primary-1 bg-primary-1/80"
                        style={{ transform: 'rotate(15deg)', marginLeft: '-4px' }}
                    />
                </div>
                <div className="mx-auto -mt-1 h-3 w-3 rounded-full bg-primary-1" />
            </div>

            {progress > 60 && (
                <>
                    <div className="absolute -right-2 top-4 animate-ping text-xs">✨</div>
                    <div className="absolute -left-2 bottom-4 animate-ping text-xs" style={{ animationDelay: '0.2s' }}>
                        ✨
                    </div>
                </>
            )}
        </div>
    )
}
