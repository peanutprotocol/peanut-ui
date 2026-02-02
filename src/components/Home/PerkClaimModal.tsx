'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { perksApi, type PendingPerk } from '@/services/perks'
import { Icon } from '@/components/Global/Icons/Icon'
import { useHoldToClaim } from '@/hooks/useHoldToClaim'
import { getShakeClass } from '@/utils/perk.utils'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useHaptic } from 'use-haptic'
import ActionModal from '@/components/Global/ActionModal'

type ClaimPhase = 'idle' | 'holding' | 'opening' | 'revealed' | 'exiting'

interface PerkClaimModalProps {
    perk: PendingPerk
    visible: boolean
    onClose: () => void
    onClaimed: (perkId: string) => void
}

/**
 * Modal for claiming perks with gift box animation.
 * Contains the shake/hold interaction, confetti, and success state.
 * Uses ActionModal for consistent styling with other modals.
 */
export function PerkClaimModal({ perk, visible, onClose, onClaimed }: PerkClaimModalProps) {
    const queryClient = useQueryClient()
    const [claimPhase, setClaimPhase] = useState<ClaimPhase>('idle')
    const [lastClaimedPerk, setLastClaimedPerk] = useState<PendingPerk | null>(null)
    const apiCallRef = useRef<Promise<void> | null>(null)

    // Reset state when modal opens with new perk
    useEffect(() => {
        if (visible) {
            setClaimPhase('idle')
            setLastClaimedPerk(null)
        }
    }, [visible, perk.id])

    // Optimistic claim: trigger animation immediately, API call in background
    const handleHoldComplete = useCallback(async () => {
        // Phase 1: Opening animation (gift shakes on its own, builds anticipation)
        setClaimPhase('opening')

        // Fire API call in background - don't await it
        apiCallRef.current = (async () => {
            try {
                const result = await perksApi.claimPerk(perk.id)
                if (result.success) {
                    onClaimed(perk.id)
                    queryClient.invalidateQueries({ queryKey: ['pendingPerks'] })
                    queryClient.invalidateQueries({ queryKey: ['transactions'] })
                }
            } catch (error) {
                console.error('Failed to claim perk:', error)
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

            // Phase 3: Show revealed state
            setLastClaimedPerk(perk)
            setClaimPhase('revealed')
        }, 600)
    }, [perk, queryClient, onClaimed])

    // Handle dismissing the success message
    const handleDismissSuccess = useCallback(() => {
        setClaimPhase('exiting')
        setTimeout(() => {
            onClose()
        }, 400)
    }, [onClose])

    // Handle modal close based on current phase
    const handleModalClose = useCallback(() => {
        if (claimPhase === 'revealed') {
            handleDismissSuccess()
        } else if (claimPhase === 'idle') {
            onClose()
        }
        // Don't allow closing during opening/exiting phases
    }, [claimPhase, handleDismissSuccess, onClose])

    if (!visible) return null

    const isSuccessPhase = (claimPhase === 'revealed' || claimPhase === 'exiting') && !!lastClaimedPerk

    // Use ActionModal for consistent styling
    return (
        <ActionModal
            visible={visible}
            onClose={handleModalClose}
            title=""
            hideModalCloseButton={isSuccessPhase}
            preventClose={claimPhase === 'opening' || claimPhase === 'exiting'}
            contentContainerClassName="!p-0"
            content={
                isSuccessPhase ? (
                    <SuccessMessage
                        perk={lastClaimedPerk!}
                        isExiting={claimPhase === 'exiting'}
                        onDismiss={handleDismissSuccess}
                    />
                ) : (
                    <GiftBoxContent perk={perk} onHoldComplete={handleHoldComplete} claimPhase={claimPhase} />
                )
            }
        />
    )
}

interface SuccessMessageProps {
    perk: PendingPerk
    isExiting: boolean
    onDismiss: () => void
}

/**
 * Success message shown after claiming - tapping anywhere dismisses
 */
function SuccessMessage({ perk, isExiting, onDismiss }: SuccessMessageProps) {
    const inviteeName = perk.reason?.split(' became')[0] || 'Your friend'
    const { triggerHaptic } = useHaptic()
    const [canDismiss, setCanDismiss] = useState(false)

    // Trigger haptic on mount + start dismiss cooldown timer
    useEffect(() => {
        triggerHaptic()
        // Prevent accidental dismissal for 2 seconds
        const dismissTimer = setTimeout(() => setCanDismiss(true), 2000)
        return () => clearTimeout(dismissTimer)
    }, [triggerHaptic])

    const handleDismiss = () => {
        if (canDismiss) {
            onDismiss()
        }
    }

    return (
        <div
            className={`flex items-center gap-4 p-6 ${canDismiss ? 'cursor-pointer' : ''} ${isExiting ? 'animate-gift-exit' : 'animate-gift-revealed'}`}
            onClick={handleDismiss}
        >
            <SoundPlayer sound="success" />

            {/* Check icon */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success-3">
                <Icon name="check" size={28} className="text-white" />
            </div>

            {/* Text content */}
            <div>
                <p className="text-sm text-grey-1">You received</p>
                <p className="text-3xl font-extrabold">+${perk.amountUsd}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-grey-1">
                    <Icon name="invite-heart" size={14} />
                    <span className="font-medium">{inviteeName}</span>
                    <span>joined Pioneers</span>
                </p>
            </div>
        </div>
    )
}

interface GiftBoxContentProps {
    perk: PendingPerk
    onHoldComplete: () => void
    claimPhase: ClaimPhase
}

/**
 * Gift box with hold-to-claim interaction
 */
function GiftBoxContent({ perk, onHoldComplete, claimPhase }: GiftBoxContentProps) {
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete: onHoldComplete,
        disabled: claimPhase !== 'idle',
        enableTapMode: true,
        tapProgress: 12,
        holdProgressPerSec: 80,
        decayRate: 8,
    })

    // Ribbon opens outward based on hold progress (max 30deg spread)
    const ribbonSpread = (holdProgress / 100) * 30

    // Determine animation classes based on phase
    const getAnimationClass = () => {
        if (claimPhase === 'opening') {
            return 'animate-gift-opening'
        }
        if (isShaking) {
            return getShakeClass(isShaking, shakeIntensity)
        }
        return ''
    }

    const inviteeName = perk.reason?.split(' became')[0] || 'Your friend'

    return (
        <div className="flex flex-col items-center px-4 py-6">
            {/* Title */}
            <p className="mb-6 text-center text-sm text-grey-1">
                <Icon name="invite-heart" size={14} className="mr-1 inline" />
                <span className="font-medium">{inviteeName}</span> joined Pioneers!
            </p>

            {/* Gift box wrapper - only this shakes */}
            <div className={`relative ${getAnimationClass()}`}>
                {/* Glow effect behind gift */}
                <div
                    className="pointer-events-none absolute inset-0 -m-6 rounded-3xl bg-primary-1 blur-2xl transition-opacity"
                    style={{ opacity: (holdProgress / 100) * 0.3 }}
                />

                {/* Gift box container */}
                <div {...buttonProps} className="relative cursor-pointer touch-none select-none">
                    {/* Gift box */}
                    <div
                        className={`gift-box-shine relative h-32 w-44 overflow-hidden rounded-xl border-4 border-primary-1 bg-gradient-to-br from-primary-1/20 via-white to-primary-2/20 shadow-xl transition-transform ${holdProgress > 0 ? 'scale-[0.98]' : ''}`}
                    >
                        {/* Vertical ribbon */}
                        <div className="absolute bottom-0 left-1/2 top-0 w-5 -translate-x-1/2 bg-gradient-to-r from-primary-1/50 via-primary-1/70 to-primary-1/50" />

                        {/* Horizontal ribbon */}
                        <div className="absolute left-0 right-0 top-1/2 h-5 -translate-y-1/2 bg-gradient-to-b from-primary-1/50 via-primary-1/70 to-primary-1/50" />

                        {/* Light rays from center */}
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

                        {/* Gift icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div
                                className={`rounded-full bg-primary-1 p-3 shadow-lg transition-transform ${holdProgress > 30 ? 'animate-bounce' : ''}`}
                            >
                                <Icon name="gift" size={28} className="text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Ribbon bow */}
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

            {/* Instructions */}
            <p className="mt-6 text-center text-sm text-grey-1">Hold to unwrap your reward</p>
        </div>
    )
}

export default PerkClaimModal
