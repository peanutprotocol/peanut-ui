'use client'

import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import PioneerCard3D from '@/components/LandingPage/PioneerCard3D'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

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

    // Realistic slot decrement: first tick after 4-12s, then every 15-40s
    useEffect(() => {
        if (slotsRemaining === undefined || hasAnimated.current) return

        hasAnimated.current = true
        setDisplayValue(slotsRemaining)

        const scheduleTick = (isFirst: boolean) => {
            const delay = isFirst
                ? 2000 + Math.random() * 3000 // 2-5 seconds for first tick
                : 8000 + Math.random() * 12000 // 8-20 seconds for subsequent ticks
            timeoutRef.current = setTimeout(() => {
                setDisplayValue((prev) => {
                    if (prev === null || prev <= 1) return prev
                    return prev - 1
                })
                scheduleTick(false)
            }, delay)
        }

        scheduleTick(true)

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [slotsRemaining])

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
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
                        className="mt-2 inline-block text-sm text-black underline"
                    >
                        Have any question? Read the FAQ
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
                        <p className="text-xs text-black">
                            {recentPurchases && recentPurchases > 0
                                ? `${recentPurchases} ${recentPurchases === 1 ? 'person' : 'people'} joined in the last 24h`
                                : 'Join the pioneers today'}
                        </p>
                    </div>
                )}

                {/* CTA Button */}
                {hasPurchased ? (
                    <Button variant="purple" shadowSize="4" disabled className="w-full">
                        Already a Pioneer
                    </Button>
                ) : (
                    <Button variant="purple" shadowSize="4" onClick={onContinue} className="w-full">
                        Join Now
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CardInfoScreen
