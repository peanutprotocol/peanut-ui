import { useCallback, useEffect, useRef, useState } from 'react'
import { PERK_HOLD_DURATION_MS } from '@/constants'

export type ShakeIntensity = 'none' | 'weak' | 'medium' | 'strong' | 'intense'

interface UseHoldToClaimOptions {
    onComplete: () => void
    holdDuration?: number
    disabled?: boolean
}

interface UseHoldToClaimReturn {
    holdProgress: number
    isShaking: boolean
    shakeIntensity: ShakeIntensity
    startHold: () => void
    cancelHold: () => void
    buttonProps: {
        onPointerDown: () => void
        onPointerUp: () => void
        onPointerLeave: () => void
        onKeyDown: (e: React.KeyboardEvent) => void
        onKeyUp: (e: React.KeyboardEvent) => void
        onContextMenu: (e: React.MouseEvent) => void
        className: string
        style: React.CSSProperties
    }
}

/**
 * Custom hook for hold-to-claim button interactions
 * Provides progress tracking, shake animation, haptic feedback, and accessibility support
 */
export function useHoldToClaim({
    onComplete,
    holdDuration = PERK_HOLD_DURATION_MS,
    disabled = false,
}: UseHoldToClaimOptions): UseHoldToClaimReturn {
    const [holdProgress, setHoldProgress] = useState(0)
    const [isShaking, setIsShaking] = useState(false)
    const [shakeIntensity, setShakeIntensity] = useState<ShakeIntensity>('none')
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const holdStartTimeRef = useRef<number | null>(null)

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            holdStartTimeRef.current = null
        }
    }, [])

    const cancelHold = useCallback(() => {
        const PREVIEW_DURATION_MS = 500

        // Calculate how long the user held
        const elapsed = holdStartTimeRef.current ? Date.now() - holdStartTimeRef.current : 0

        // Clear the completion timer
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

                if ('vibrate' in navigator) {
                    navigator.vibrate(0)
                }
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

            if ('vibrate' in navigator) {
                navigator.vibrate(0)
            }
        }
    }, [])

    const startHold = useCallback(() => {
        if (disabled) return

        setHoldProgress(0)
        setIsShaking(true)

        const startTime = Date.now()
        holdStartTimeRef.current = startTime
        let lastIntensity: ShakeIntensity = 'weak'

        // Update progress and shake intensity
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime
            const progress = Math.min((elapsed / holdDuration) * 100, 100)
            setHoldProgress(progress)

            // Progressive shake intensity with haptic feedback
            let newIntensity: ShakeIntensity = 'weak'
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
                // Progressive vibration patterns that match shake intensity
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

        progressIntervalRef.current = interval

        // Complete after hold duration
        const timer = setTimeout(() => {
            onComplete()
        }, holdDuration)

        holdTimerRef.current = timer
    }, [onComplete, holdDuration, disabled])

    const buttonProps = {
        onPointerDown: startHold,
        onPointerUp: cancelHold,
        onPointerLeave: cancelHold,
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
            // Prevent context menu from appearing
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
        startHold,
        cancelHold,
        buttonProps,
    }
}
