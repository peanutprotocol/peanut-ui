'use client'

import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import PioneerCard3D from '@/components/LandingPage/PioneerCard3D'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'

interface CardInfoScreenProps {
    onContinue: () => void
    hasPurchased: boolean
    slotsRemaining?: number
    recentPurchases?: number
}

// Rolling digit component - animates a single digit sliding down using CSS keyframes
const RollingDigit = ({ digit, duration = 400 }: { digit: string; duration?: number }) => {
    const [currentDigit, setCurrentDigit] = useState(digit)
    const [prevDigit, setPrevDigit] = useState<string | null>(null)
    const [animationKey, setAnimationKey] = useState(0)
    const prevDigitRef = useRef(digit)

    useEffect(() => {
        if (digit !== prevDigitRef.current) {
            setPrevDigit(prevDigitRef.current)
            setCurrentDigit(digit)
            setAnimationKey((k) => k + 1)
            prevDigitRef.current = digit

            // Clear prevDigit after animation
            const timer = setTimeout(() => {
                setPrevDigit(null)
            }, duration)

            return () => clearTimeout(timer)
        }
    }, [digit, duration])

    const animationStyle = `
        @keyframes slideOut {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `

    return (
        <span className="relative inline-block h-[1.2em] w-[0.65em] overflow-hidden">
            <style>{animationStyle}</style>
            {/* Previous digit - slides out */}
            {prevDigit !== null && (
                <span
                    key={`out-${animationKey}`}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        animation: `slideOut ${duration}ms ease-out forwards`,
                    }}
                >
                    {prevDigit}
                </span>
            )}
            {/* Current digit - slides in (or static if no animation) */}
            <span
                key={`in-${animationKey}`}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                    animation: prevDigit !== null ? `slideIn ${duration}ms ease-out forwards` : 'none',
                }}
            >
                {currentDigit}
            </span>
        </span>
    )
}

// Rolling number display - splits number into digits and animates each
const RollingNumber = ({ value, duration = 400 }: { value: number; duration?: number }) => {
    const digits = String(value).split('')

    return (
        <span className="inline-flex tabular-nums">
            {digits.map((digit, index) => (
                <RollingDigit key={`${digits.length}-${index}`} digit={digit} duration={duration} />
            ))}
        </span>
    )
}

const CardInfoScreen = ({ onContinue, hasPurchased, slotsRemaining, recentPurchases }: CardInfoScreenProps) => {
    const router = useRouter()
    const [displayValue, setDisplayValue] = useState<number | null>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const hasAnimated = useRef(false)

    // Countdown animation: 50 numbers over ~30s with random variance (0.5-5s between ticks)
    const startCountdown = useCallback((from: number, to: number) => {
        let current = from
        setDisplayValue(current)

        const tick = () => {
            if (current <= to) {
                setDisplayValue(to)
                return
            }

            current--
            setDisplayValue(current)

            // Random delay between 500ms and 5000ms
            const delay = 500 + Math.random() * 4500
            timeoutRef.current = setTimeout(tick, delay)
        }

        // Start after brief initial delay
        timeoutRef.current = setTimeout(tick, 800)
    }, [])

    // TODO: hasAnimated blocks updates on refetch - consider updating displayValue without re-animating
    useEffect(() => {
        if (slotsRemaining === undefined || hasAnimated.current) return

        hasAnimated.current = true

        // Edge case: if slots <= 50, start from slots + smaller amount to avoid going too high
        // Edge case: if slots < 10, no animation at all
        if (slotsRemaining < 10) {
            setDisplayValue(slotsRemaining)
            return
        }

        // Calculate start value: aim for 50 numbers countdown, but cap at reasonable amount
        const countdownAmount = Math.min(50, slotsRemaining)
        const startValue = slotsRemaining + countdownAmount

        startCountdown(startValue, slotsRemaining)

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [slotsRemaining, startCountdown])

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader title="Join Peanut Pioneers" onPrev={() => router.back()} />

            <div className="my-auto flex flex-col gap-6">
                {/* Description and FAQ link */}
                <div>
                    <p className="text-sm">
                        Get access to the best card in the world. Spend globally at the best rates, and get rewarded for
                        every spend of you and your friends.
                    </p>
                    <a
                        href="https://peanut.to/card/faq"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-purple-1 underline"
                    >
                        Have any question? Read the FAQ here
                    </a>
                </div>

                {/* Card Hero with 3D effect */}
                <div className="flex flex-1 flex-col items-center justify-center">
                    <PioneerCard3D />
                </div>

                {/* Slots remaining counter */}
                {displayValue !== null && (
                    <div className="space-y-1 text-center">
                        <div className="flex items-center justify-center text-2xl font-bold text-black dark:text-white">
                            <RollingNumber value={displayValue} duration={350} />
                            <span className="ml-1">slots left</span>
                        </div>
                        <p className="text-xs text-grey-1">
                            {recentPurchases && recentPurchases > 0
                                ? `${recentPurchases} ${recentPurchases === 1 ? 'person' : 'people'} joined in the last 24h`
                                : 'Join the pioneers today'}
                        </p>
                    </div>
                )}
            </div>

            {/* CTA Button */}
            <div className="mt-auto space-y-3">
                {hasPurchased ? (
                    <Button variant="purple" size="large" shadowSize="4" disabled className="w-full">
                        Already a Pioneer
                    </Button>
                ) : (
                    <Button variant="purple" size="large" shadowSize="4" onClick={onContinue} className="w-full">
                        Join Now
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CardInfoScreen
