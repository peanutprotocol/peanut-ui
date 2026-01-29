'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { perksApi, type PendingPerk } from '@/services/perks'
import { useAuth } from '@/context/authContext'
import { Card } from '@/components/0_Bruddle/Card'
import GlobalCard from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useHoldToClaim } from '@/hooks/useHoldToClaim'
import { getShakeClass } from '@/utils/perk.utils'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import HomeCarouselCTA from './HomeCarouselCTA'
import Image from 'next/image'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useHaptic } from 'use-haptic'

type ClaimPhase = 'idle' | 'holding' | 'opening' | 'revealed' | 'exiting'
type ArrivalPhase = 'none' | 'arriving' | 'arrived'
type ArrivalSource = 'initial' | 'websocket'

/**
 * Home CTA section that shows gift-box styled perk claim cards.
 * Features:
 * - "Lootbox opening" animation when claiming
 * - Real-time WebSocket updates when new perks arrive
 * - Special "arrival" animation for new gifts
 * - Success message requires tap to dismiss
 */
export function HomePerkClaimSection() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [claimedPerkIds, setClaimedPerkIds] = useState<Set<string>>(new Set())
    const [showCarousel, setShowCarousel] = useState(false)
    const [claimPhase, setClaimPhase] = useState<ClaimPhase>('idle')
    const [arrivalPhase, setArrivalPhase] = useState<ArrivalPhase>('none')
    const [arrivalSource, setArrivalSource] = useState<ArrivalSource>('initial')
    const [isInitialLoad, setIsInitialLoad] = useState(true)
    const [lastClaimedPerk, setLastClaimedPerk] = useState<PendingPerk | null>(null)
    const apiCallRef = useRef<Promise<void> | null>(null)
    const dismissDebounceRef = useRef<boolean>(false)

    const { data: pendingPerksData, isLoading } = useQuery({
        queryKey: ['pendingPerks', user?.user.userId],
        queryFn: () => perksApi.getPendingPerks(),
        enabled: !!user?.user.userId,
    })

    // Listen for real-time perk notifications via WebSocket
    useWebSocket({
        username: user?.user.username ?? undefined,
        onPendingPerk: useCallback(
            () => {
                // A new perk arrived! Invalidate query and trigger arrival animation
                queryClient.invalidateQueries({ queryKey: ['pendingPerks'] })

                // Trigger bouncy arrival animation (real-time feels more exciting!)
                setArrivalSource('websocket')
                setArrivalPhase('arriving')
                setTimeout(() => setArrivalPhase('arrived'), 500)
            },
            [queryClient]
        ),
    })

    // Filter for Card Pioneer inviter rewards that haven't been claimed in this session
    const cardPioneerPerks =
        pendingPerksData?.perks?.filter((p) => p.name === 'Card Pioneer Inviter Reward' && !claimedPerkIds.has(p.id)) ||
        []

    const currentPerk = cardPioneerPerks[0]

    // Trigger arrival animation on initial load if there are perks
    useEffect(() => {
        if (!isLoading && isInitialLoad && currentPerk) {
            // Gentle fade-in for initial page load (less jarring)
            setArrivalSource('initial')
            setArrivalPhase('arriving')
            setTimeout(() => {
                setArrivalPhase('arrived')
                setIsInitialLoad(false)
            }, 400)
        } else if (!isLoading && isInitialLoad) {
            setIsInitialLoad(false)
        }
    }, [isLoading, isInitialLoad, currentPerk])

    // Optimistic claim: trigger animation immediately, API call in background
    const handleHoldComplete = useCallback(
        async (perk: PendingPerk) => {
            // Phase 1: Opening animation (gift shakes on its own, builds anticipation)
            setClaimPhase('opening')

            // Fire API call in background - don't await it
            apiCallRef.current = (async () => {
                try {
                    const result = await perksApi.claimPerk(perk.id)
                    if (result.success) {
                        setClaimedPerkIds((prev) => new Set(prev).add(perk.id))
                        queryClient.invalidateQueries({ queryKey: ['pendingPerks'] })
                        queryClient.invalidateQueries({ queryKey: ['transactions'] })
                    }
                } catch (error) {
                    console.error('Failed to claim perk:', error)
                    // Even if API fails, we've already shown the celebration
                    // User will see the perk again on next load if it truly failed
                }
            })()

            // Phase 2: After 600ms of autonomous shaking, burst into confetti
            setTimeout(() => {
                // Haptic burst feedback
                if ('vibrate' in navigator) {
                    navigator.vibrate([100, 50, 100, 50, 200])
                }

                // Confetti explosion!
                shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.4 } })

                // Phase 3: Show revealed state - save the perk for success display
                setLastClaimedPerk(perk)
                setClaimPhase('revealed')
            }, 600)
        },
        [queryClient]
    )

    // Handle dismissing the success message (with debounce to prevent rapid tap issues)
    const handleDismissSuccess = useCallback(() => {
        const perkId = lastClaimedPerk?.id
        if (!perkId) return

        // Debounce: ignore if already dismissing
        if (dismissDebounceRef.current) return
        dismissDebounceRef.current = true

        // Exit animation
        setClaimPhase('exiting')

        // After exit animation, check if more perks or show carousel
        setTimeout(() => {
            const remainingPerks = cardPioneerPerks.filter((p) => p.id !== perkId)
            if (remainingPerks.length === 0) {
                setShowCarousel(true)
            } else {
                // Next perk arrives with bouncy animation
                setArrivalSource('websocket')
                setArrivalPhase('arriving')
                setTimeout(() => setArrivalPhase('arrived'), 500)
            }
            setClaimPhase('idle')
            setLastClaimedPerk(null)
            dismissDebounceRef.current = false
        }, 400)
    }, [cardPioneerPerks, lastClaimedPerk])

    // Show nothing while loading on initial load
    if (isLoading && isInitialLoad) {
        return null
    }

    // If no pending perks or all claimed, render carousel with slide-in animation
    if (!currentPerk || showCarousel) {
        return (
            <div className={showCarousel ? 'animate-slide-in-right' : ''}>
                <HomeCarouselCTA />
            </div>
        )
    }

    // Show success message (tap to dismiss)
    if ((claimPhase === 'revealed' || claimPhase === 'exiting') && lastClaimedPerk) {
        return (
            <SuccessMessage
                perk={lastClaimedPerk}
                isExiting={claimPhase === 'exiting'}
                onDismiss={handleDismissSuccess}
            />
        )
    }

    return (
        <GiftBoxClaimCard
            perk={currentPerk}
            remainingCount={cardPioneerPerks.length}
            onHoldComplete={() => handleHoldComplete(currentPerk)}
            claimPhase={claimPhase}
            arrivalPhase={arrivalPhase}
            arrivalSource={arrivalSource}
        />
    )
}

interface SuccessMessageProps {
    perk: PendingPerk
    isExiting: boolean
    onDismiss: () => void
}

/**
 * Success message shown after claiming - matches PaymentSuccessView pattern
 */
function SuccessMessage({ perk, isExiting, onDismiss }: SuccessMessageProps) {
    const inviteeName = perk.reason?.split(' became')[0] || 'Your friend'
    const { triggerHaptic } = useHaptic()
    const [canDismiss, setCanDismiss] = useState(false)

    // Trigger haptic on mount (matching PaymentSuccessView)
    // Also start dismiss cooldown timer
    useEffect(() => {
        triggerHaptic()
        // Prevent accidental dismissal for 2 seconds
        const timer = setTimeout(() => setCanDismiss(true), 2000)
        return () => clearTimeout(timer)
    }, [triggerHaptic])

    const handleDismiss = () => {
        if (canDismiss) {
            onDismiss()
        }
    }

    return (
        <div
            className={`flex flex-col items-center py-4 ${canDismiss ? 'cursor-pointer' : ''} ${isExiting ? 'animate-gift-exit' : 'animate-gift-revealed'}`}
            onClick={handleDismiss}
        >
            <SoundPlayer sound="success" />

            {/* Peanut mascot - matching PaymentSuccessView */}
            <div className="relative mb-2">
                <Image
                    src={chillPeanutAnim.src}
                    alt="Peanut Mascot"
                    width={120}
                    height={120}
                    className="h-28 w-28"
                    unoptimized
                />
            </div>

            {/* Success card - using GlobalCard for consistency */}
            <GlobalCard className="flex w-full max-w-[200px] items-center gap-3 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                        <Icon name="check" size={24} />
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-sm font-normal text-grey-1">You claimed</p>
                    <p className="text-2xl font-extrabold">+${perk.amountUsd}</p>
                    <p className="flex items-center gap-1 text-sm font-medium text-grey-1">
                        {inviteeName} <Icon name="invite-heart" size={14} />
                    </p>
                </div>
            </GlobalCard>

            <p className={`mt-3 text-xs ${canDismiss ? 'text-grey-1' : 'text-grey-1/50'}`}>
                {canDismiss ? 'Tap to continue' : 'Wait...'}
            </p>
        </div>
    )
}

interface GiftBoxClaimCardProps {
    perk: PendingPerk
    remainingCount: number
    onHoldComplete: () => void
    claimPhase: ClaimPhase
    arrivalPhase: ArrivalPhase
    arrivalSource: ArrivalSource
}

/**
 * Gift-box styled perk claim card with lootbox opening animation.
 * Supports tap + hold + shake - all contribute to progress with slow decay.
 */
function GiftBoxClaimCard({
    remainingCount,
    onHoldComplete,
    claimPhase,
    arrivalPhase,
    arrivalSource,
}: GiftBoxClaimCardProps) {
    // Enable tap mode: tap + hold both add progress, with slow decay
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete: onHoldComplete,
        disabled: claimPhase !== 'idle',
        enableTapMode: true,
        tapProgress: 12,        // % per tap
        holdProgressPerSec: 80, // % per second of holding
        decayRate: 8,           // % per second when idle
    })

    // Ribbon opens outward based on hold progress (max 30deg spread)
    const ribbonSpread = (holdProgress / 100) * 30

    // Attention wiggle after arrival - subtle pulse to draw attention
    const [showAttentionWiggle, setShowAttentionWiggle] = useState(false)
    useEffect(() => {
        if (arrivalPhase === 'arrived' && claimPhase === 'idle' && holdProgress === 0) {
            // Start attention wiggle after 3 seconds of being idle
            const timer = setTimeout(() => setShowAttentionWiggle(true), 3000)
            return () => clearTimeout(timer)
        } else {
            setShowAttentionWiggle(false)
        }
    }, [arrivalPhase, claimPhase, holdProgress])

    // Determine animation classes based on phase
    const getCardAnimationClass = () => {
        // Claim phases take priority
        if (claimPhase === 'opening') {
            return 'animate-gift-opening'
        }

        // Arrival animation - gentle for initial load, bouncy for real-time WebSocket
        if (arrivalPhase === 'arriving') {
            return arrivalSource === 'websocket' ? 'animate-gift-arrive' : 'animate-gift-arrive-gentle'
        }

        // Shake during interaction
        if (isShaking) {
            return getShakeClass(isShaking, shakeIntensity)
        }

        // Attention wiggle when idle
        if (showAttentionWiggle) {
            return 'animate-gift-attention'
        }

        return ''
    }

    return (
        <div className="flex flex-col items-center py-4">
            {/* Gift box wrapper - only this shakes */}
            <div className={`relative ${getCardAnimationClass()}`}>
                {/* Glow effect behind gift */}
                <div
                    className="pointer-events-none absolute inset-0 -m-6 rounded-3xl bg-primary-1 blur-2xl transition-opacity"
                    style={{ opacity: (holdProgress / 100) * 0.3 }}
                />

                {/* Gift box container */}
                <div {...buttonProps} className="relative cursor-pointer select-none touch-none">
                    {/* Gift box - wider than tall like a present */}
                    <div
                        className={`gift-box-shine relative h-32 w-44 overflow-hidden rounded-xl border-4 border-primary-1 bg-gradient-to-br from-primary-1/20 via-white to-primary-2/20 shadow-xl transition-transform ${holdProgress > 0 ? 'scale-[0.98]' : ''}`}
                    >
                        {/* Vertical ribbon on box */}
                        <div className="absolute bottom-0 left-1/2 top-0 w-5 -translate-x-1/2 bg-gradient-to-r from-primary-1/50 via-primary-1/70 to-primary-1/50" />

                        {/* Horizontal ribbon on box */}
                        <div className="absolute left-0 right-0 top-1/2 h-5 -translate-y-1/2 bg-gradient-to-b from-primary-1/50 via-primary-1/70 to-primary-1/50" />

                        {/* Subtle light rays from center */}
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: `radial-gradient(circle at center, rgba(255,255,255,${0.4 * (holdProgress / 100)}) 0%, transparent 70%)`,
                            }}
                        />

                        {/* Cracks appearing with progress */}
                        {holdProgress > 20 && (
                            <div className="absolute left-4 top-4 h-8 w-0.5 rotate-45 bg-primary-1/40" />
                        )}
                        {holdProgress > 40 && (
                            <div className="absolute bottom-6 right-6 h-10 w-0.5 -rotate-[30deg] bg-primary-1/40" />
                        )}
                        {holdProgress > 60 && (
                            <div className="absolute bottom-4 left-8 h-6 w-0.5 rotate-12 bg-primary-1/40" />
                        )}

                        {/* Content hint - gift icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div
                                className={`rounded-full bg-primary-1 p-3 shadow-lg transition-transform ${holdProgress > 30 ? 'animate-bounce' : ''}`}
                            >
                                <Icon name="gift" size={28} className="text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Ribbon bow - classic style with loops spreading outward */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <div className="relative">
                            {/* Left ribbon tail */}
                            <div
                                className="absolute left-1/2 top-2 h-4 w-2 -translate-x-[10px] bg-primary-1 transition-transform"
                                style={{
                                    transform: `translateX(-10px) rotate(${-20 - ribbonSpread * 0.5}deg)`,
                                    borderRadius: '0 0 2px 2px',
                                }}
                            />
                            {/* Right ribbon tail */}
                            <div
                                className="absolute left-1/2 top-2 h-4 w-2 translate-x-[2px] bg-primary-1 transition-transform"
                                style={{
                                    transform: `translateX(2px) rotate(${20 + ribbonSpread * 0.5}deg)`,
                                    borderRadius: '0 0 2px 2px',
                                }}
                            />
                            {/* Left loop */}
                            <div
                                className="absolute -left-5 -top-1 h-4 w-6 rounded-full bg-primary-1 shadow-sm transition-transform"
                                style={{ transform: `rotate(${-25 - ribbonSpread}deg)` }}
                            />
                            {/* Right loop */}
                            <div
                                className="absolute -right-5 -top-1 h-4 w-6 rounded-full bg-primary-1 shadow-sm transition-transform"
                                style={{ transform: `rotate(${25 + ribbonSpread}deg)` }}
                            />
                            {/* Center knot */}
                            <div className="relative z-10 h-4 w-4 rounded-sm bg-primary-1 shadow-md" />
                        </div>
                    </div>

                    {/* Particles flying out */}
                    {holdProgress > 30 && (
                        <>
                            <div
                                className="absolute -right-4 top-2 animate-ping text-lg"
                                style={{ animationDuration: '1s' }}
                            >
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
                    {holdProgress > 60 && (
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
            </div>

            {/* More gifts indicator - OUTSIDE the shaking div */}
            {remainingCount > 1 && (
                <p className="mt-3 text-center text-sm text-grey-1">
                    +{remainingCount - 1} more gift{remainingCount > 2 ? 's' : ''} to unwrap
                </p>
            )}
        </div>
    )
}

export default HomePerkClaimSection
