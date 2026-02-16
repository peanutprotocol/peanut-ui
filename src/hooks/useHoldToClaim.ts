import { PERK_HOLD_DURATION_MS } from '@/constants/general.consts'
import { useCallback, useEffect, useRef, useState } from 'react'

export type ShakeIntensity = 'none' | 'weak' | 'medium' | 'strong' | 'intense'

interface UseHoldToClaimOptions {
    onComplete: () => void
    holdDuration?: number
    disabled?: boolean
    /** Enable tap-to-progress mode (tap + hold both add progress, with decay) */
    enableTapMode?: boolean
    /** Progress added per tap (0-100), default 15 */
    tapProgress?: number
    /** Progress added per second while holding (0-100), default 80 */
    holdProgressPerSec?: number
    /** Progress decay per second when not interacting (0-100), default 8 */
    decayRate?: number
}

interface UseHoldToClaimReturn {
    holdProgress: number
    isShaking: boolean
    shakeIntensity: ShakeIntensity
    isHolding: boolean
    startHold: () => void
    cancelHold: () => void
    handleTap: () => void
    buttonProps: {
        onPointerDown: () => void
        onPointerUp: () => void
        onPointerLeave: () => void
        onPointerCancel: () => void
        onKeyDown: (e: React.KeyboardEvent) => void
        onKeyUp: (e: React.KeyboardEvent) => void
        onContextMenu: (e: React.MouseEvent) => void
        className: string
        style: React.CSSProperties
    }
}

/**
 * Custom hook for hold-to-claim button interactions
 * Supports two modes:
 * 1. Hold-only mode (default): Progress only while holding, resets on release
 * 2. Tap mode (enableTapMode=true): Tap + hold both add progress, with slow decay
 */
export function useHoldToClaim({
    onComplete,
    holdDuration = PERK_HOLD_DURATION_MS,
    disabled = false,
    enableTapMode = false,
    tapProgress = 15,
    holdProgressPerSec = 80,
    decayRate = 8,
}: UseHoldToClaimOptions): UseHoldToClaimReturn {
    const [holdProgress, setHoldProgress] = useState(0)
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<ShakeIntensity>('none')
    const [isHolding, setIsHolding] = useState(false)

    const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const holdStartTimeRef = useRef<number | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const lastUpdateTimeRef = useRef<number>(Date.now())
    const progressRef = useRef<number>(0)
    const lastHapticIntensityRef = useRef<ShakeIntensity>('none')
    const isCompleteRef = useRef<boolean>(false)
    const lastTapTimeRef = useRef<number>(0)

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
            holdStartTimeRef.current = null
        }
    }, [])

    // Tap mode: Main update loop for progress, decay, and haptics
    useEffect(() => {
        if (!enableTapMode || disabled || isCompleteRef.current) return

        const update = () => {
            const now = Date.now()
            const deltaTime = (now - lastUpdateTimeRef.current) / 1000
            lastUpdateTimeRef.current = now

            let newProgress = progressRef.current

            // Add progress if holding
            if (isHolding) {
                newProgress += holdProgressPerSec * deltaTime
            }
            // Decay if not holding
            else if (progressRef.current > 0) {
                newProgress -= decayRate * deltaTime
            }

            newProgress = Math.max(0, Math.min(100, newProgress))
            progressRef.current = newProgress
            setHoldProgress(newProgress)

            // Only shake/vibrate when progress is INCREASING (holding or just tapped)
            // Not during decay - the gift should stabilize when you let go
            const recentlyTapped = Date.now() - lastTapTimeRef.current < 150
            const isProgressIncreasing = (isHolding || recentlyTapped) && newProgress > 0
            setIsShaking(isProgressIncreasing)

            // Progressive shake intensity - only when actively interacting
            let newIntensity: ShakeIntensity = 'none'
            if (!isProgressIncreasing || newProgress <= 0) {
                newIntensity = 'none'
            } else if (newProgress < 25) {
                newIntensity = 'weak'
            } else if (newProgress < 50) {
                newIntensity = 'medium'
            } else if (newProgress < 75) {
                newIntensity = 'strong'
            } else {
                newIntensity = 'intense'
            }

            // Trigger haptic feedback when intensity changes (only while holding)
            if (
                isHolding &&
                newIntensity !== lastHapticIntensityRef.current &&
                newIntensity !== 'none' &&
                'vibrate' in navigator
            ) {
                switch (newIntensity) {
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
                lastHapticIntensityRef.current = newIntensity
            }

            // Reset haptic tracking when not holding so next hold starts fresh
            if (!isHolding) {
                lastHapticIntensityRef.current = 'none'
            }

            setShakeIntensity(newIntensity)

            // Check for completion
            if (newProgress >= 100 && !isCompleteRef.current) {
                isCompleteRef.current = true
                onComplete()
                return
            }

            animationFrameRef.current = requestAnimationFrame(update)
        }

        lastUpdateTimeRef.current = Date.now()
        animationFrameRef.current = requestAnimationFrame(update)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [enableTapMode, disabled, isHolding, holdProgressPerSec, decayRate, onComplete])

    // Handle tap (tap mode only)
    const handleTap = useCallback(() => {
        if (disabled || !enableTapMode || isCompleteRef.current) return

        progressRef.current = Math.min(progressRef.current + tapProgress, 100)
        setHoldProgress(progressRef.current)
        lastTapTimeRef.current = Date.now()

        // Haptic feedback for tap
        if ('vibrate' in navigator) {
            navigator.vibrate(20)
        }

        // Check for completion
        if (progressRef.current >= 100 && !isCompleteRef.current) {
            isCompleteRef.current = true
            onComplete()
        }
    }, [disabled, enableTapMode, tapProgress, onComplete])

    // Legacy hold-only mode cancel
    const cancelHoldLegacy = useCallback(() => {
        const PREVIEW_DURATION_MS = 500
        const elapsed = holdStartTimeRef.current ? Date.now() - holdStartTimeRef.current : 0

        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null

        if (elapsed > 0 && elapsed < PREVIEW_DURATION_MS) {
            const remainingPreviewTime = PREVIEW_DURATION_MS - elapsed
            const resetTimer = setTimeout(() => {
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
                progressIntervalRef.current = null
                setHoldProgress(0)
                setIsShaking(false)
                setShakeIntensity('none')
                holdStartTimeRef.current = null
                if ('vibrate' in navigator) navigator.vibrate(0)
            }, remainingPreviewTime)
            holdTimerRef.current = resetTimer
        } else {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
            setHoldProgress(0)
            setIsShaking(false)
            setShakeIntensity('none')
            holdStartTimeRef.current = null
            if ('vibrate' in navigator) navigator.vibrate(0)
        }
    }, [])

    const cancelHold = useCallback(() => {
        if (enableTapMode) {
            // Tap mode: just stop holding, decay will handle the rest
            setIsHolding(false)
        } else {
            cancelHoldLegacy()
        }
    }, [enableTapMode, cancelHoldLegacy])

    // Legacy hold-only mode start
    const startHoldLegacy = useCallback(() => {
        if (disabled) return

        setHoldProgress(0)
        setIsShaking(true)

        const startTime = Date.now()
        holdStartTimeRef.current = startTime
        let lastIntensity: ShakeIntensity = 'weak'

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            const progress = Math.min((elapsed / holdDuration) * 100, 100)
            setHoldProgress(progress)

            let newIntensity: ShakeIntensity = 'weak'
            if (progress < 25) newIntensity = 'weak'
            else if (progress < 50) newIntensity = 'medium'
            else if (progress < 75) newIntensity = 'strong'
            else newIntensity = 'intense'

            if (newIntensity !== lastIntensity && 'vibrate' in navigator) {
                switch (newIntensity) {
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
                lastIntensity = newIntensity
            }

            setShakeIntensity(newIntensity)
            if (progress >= 100) clearInterval(interval)
        }, 50)

        progressIntervalRef.current = interval

        const timer = setTimeout(() => {
            onComplete()
        }, holdDuration)

        holdTimerRef.current = timer
    }, [onComplete, holdDuration, disabled])

    const startHold = useCallback(() => {
        if (disabled || isCompleteRef.current) return

        if (enableTapMode) {
            // Tap mode: count as tap + start holding
            handleTap()
            setIsHolding(true)
        } else {
            startHoldLegacy()
        }
    }, [disabled, enableTapMode, handleTap, startHoldLegacy])

    const buttonProps = {
        onPointerDown: startHold,
        onPointerUp: cancelHold,
        onPointerLeave: cancelHold,
        onPointerCancel: cancelHold,
        onKeyDown: (e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault()
                startHold()
            }
        },
        onKeyUp: (e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault()
                cancelHold()
            }
        },
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault()
        },
        className: 'relative touch-manipulation select-none overflow-hidden',
        style: {
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
        } as React.CSSProperties,
    }

    return {
        holdProgress,
        isShaking,
        shakeIntensity,
        isHolding,
        startHold,
        cancelHold,
        handleTap,
        buttonProps,
    }
}
