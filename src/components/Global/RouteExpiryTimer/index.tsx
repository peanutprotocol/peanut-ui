import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface RouteExpiryTimerProps {
    expiry?: string // Unix timestamp in seconds
    isLoading?: boolean
    onNearExpiry?: () => void // Called when timer gets close to expiry (e.g., 30 seconds)
    onExpired?: () => void // Called when timer expires
    className?: string
    nearExpiryThresholdPercentage?: number
    disableRefetch?: boolean // Disable refetching when user is signing transaction
    error?: string | null // Error message to display instead of timer
}

interface TimeRemaining {
    minutes: number
    seconds: number
    totalMs: number
}

const RouteExpiryTimer: React.FC<RouteExpiryTimerProps> = ({
    expiry,
    isLoading = false,
    onNearExpiry,
    onExpired,
    className,
    nearExpiryThresholdPercentage = 0.1, // 10% of total duration
    disableRefetch = false,
    error = null,
}) => {
    const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null)
    const [hasTriggeredNearExpiry, setHasTriggeredNearExpiry] = useState(false)
    const [hasExpired, setHasExpired] = useState(false)

    const totalDurationMs = useMemo(() => {
        if (!expiry) return 0
        const expiryMs = parseInt(expiry, 10) * 1000
        const diff = expiryMs - Date.now()
        return Math.max(0, diff)
    }, [expiry])
    const nearExpiryThresholdMs = useMemo(() => totalDurationMs * nearExpiryThresholdPercentage, [totalDurationMs])

    const calculateTimeRemaining = useCallback((): TimeRemaining | null => {
        if (!expiry) return null

        const now = new Date().getTime()
        // Expiry is Unix timestamp in seconds, convert to milliseconds
        const expiryTime = parseInt(expiry) * 1000

        // Check if expiry time is valid
        if (isNaN(expiryTime)) {
            console.warn('Invalid expiry time:', expiry)
            return null
        }

        const diff = expiryTime - now

        if (diff <= 0) {
            return { minutes: 0, seconds: 0, totalMs: 0 }
        }

        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)

        return { minutes, seconds, totalMs: diff }
    }, [expiry])

    useEffect(() => {
        if (!expiry || isLoading) {
            setTimeRemaining(null)
            setHasTriggeredNearExpiry(false)
            setHasExpired(false)
            return
        }

        const updateTimer = () => {
            const remaining = calculateTimeRemaining()
            setTimeRemaining(remaining)

            if (!remaining || remaining.totalMs <= 0) {
                if (!hasExpired) {
                    setHasExpired(true)
                    onExpired?.()
                }
                return
            }

            // Trigger near expiry callback only if refetch is not disabled
            if (
                !disableRefetch &&
                !hasTriggeredNearExpiry &&
                remaining.totalMs <= nearExpiryThresholdMs &&
                remaining.totalMs > 0
            ) {
                setHasTriggeredNearExpiry(true)
                onNearExpiry?.()
            }
        }

        // Initial calculation
        updateTimer()

        // Set up interval to update every second
        const interval = setInterval(updateTimer, 1000)

        return () => clearInterval(interval)
    }, [
        expiry,
        isLoading,
        calculateTimeRemaining,
        onNearExpiry,
        onExpired,
        nearExpiryThresholdMs,
        hasTriggeredNearExpiry,
        hasExpired,
        disableRefetch,
    ])

    const formatTime = (time: TimeRemaining): string => {
        const paddedMinutes = time.minutes.toString().padStart(2, '0')
        const paddedSeconds = time.seconds.toString().padStart(2, '0')
        return `${paddedMinutes}:${paddedSeconds}`
    }

    const progressPercentage = useMemo((): number => {
        if (!timeRemaining || !totalDurationMs) return 0
        const elapsedMs = totalDurationMs - timeRemaining.totalMs
        return Math.max(0, Math.min(100, (elapsedMs / totalDurationMs) * 100))
    }, [timeRemaining, totalDurationMs])

    const progressColor = useMemo((): string => {
        if (!timeRemaining) return 'bg-grey-3'

        // Green for first 70%
        if (progressPercentage < 70) return 'bg-green-500'
        // Yellow for 70-85%
        if (progressPercentage < 85) return 'bg-yellow-500'
        // Red for final 15%
        return 'bg-red'
    }, [progressPercentage, timeRemaining])

    const shouldPulse = useMemo((): boolean => {
        if (isLoading) return true
        if (!timeRemaining) return false
        // Pulse when in red zone (85%+ progress) OR near expiry threshold
        return (progressPercentage >= 85 || timeRemaining.totalMs <= nearExpiryThresholdMs) && timeRemaining.totalMs > 0
    }, [progressPercentage, timeRemaining, isLoading, nearExpiryThresholdMs])

    const getText = (): string => {
        if (error) return error
        if (isLoading) return 'Finding best rate...'
        if (!expiry) return 'No quote available'
        if (!timeRemaining) return 'Quote expired'
        if (timeRemaining.totalMs <= 0) return 'Quote expired'
        return `Price locked for ${formatTime(timeRemaining)}`
    }

    return (
        <div className={twMerge('flex flex-col gap-2', className)}>
            {/* Status text */}
            <div className="flex items-center gap-2">
                <span
                    className={twMerge(
                        'text-sm font-medium',
                        error
                            ? 'text-error'
                            : isLoading || (timeRemaining && timeRemaining.totalMs > 0)
                              ? 'text-grey-1'
                              : 'text-error'
                    )}
                >
                    {getText()}
                </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-grey-4">
                <div
                    className={twMerge(
                        'h-full rounded-full transition-all duration-300',
                        error ? 'w-full bg-red' : isLoading ? 'w-full bg-grey-3' : progressColor,
                        shouldPulse ? 'animate-pulse-strong' : ''
                    )}
                    style={{
                        width: error ? '100%' : isLoading ? '100%' : `${progressPercentage}%`,
                    }}
                />
            </div>
        </div>
    )
}

export default RouteExpiryTimer
