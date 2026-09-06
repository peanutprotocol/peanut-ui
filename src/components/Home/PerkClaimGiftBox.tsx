'use client'

import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { type PendingPerk } from '@/services/perks'
import { Icon } from '@/components/Global/Icons/Icon'
import { useHoldToClaim } from '@/hooks/useHoldToClaim'
import { getShakeClass } from '@/utils/perk.utils'
import { extractInviteeName } from '@/utils/general.utils'
import type { ClaimPhase } from './perkClaim.types'

interface PerkClaimGiftBoxProps {
    perk: PendingPerk
    onHoldComplete: () => void
    claimPhase: ClaimPhase
}

/**
 * Gift box with hold-to-claim interaction
 */
export function PerkClaimGiftBox({ perk, onHoldComplete, claimPhase }: PerkClaimGiftBoxProps) {
    const t = useAppTranslations('home.perk')
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

    const inviteeName = perk.inviteeName ?? extractInviteeName(perk.reason)

    return (
        <div className="flex flex-col items-center">
            {/* Title */}
            <p className="mb-6 text-center text-body-s text-foreground-secondary">
                <Icon name="invite-heart" size={16} className="mr-1 inline" />
                {t.rich('usedPeanut', {
                    inviteeName: inviteeName ?? '',
                    name: (chunks) => <span className="font-medium">{chunks}</span>,
                })}
            </p>

            {/* Gift box wrapper - only this shakes */}
            <div className={`relative ${getAnimationClass()}`}>
                {/* Glow effect behind gift */}
                <div
                    className="pointer-events-none absolute inset-0 -m-6 rounded-3xl bg-action-primary blur-2xl transition-opacity"
                    style={{ opacity: (holdProgress / 100) * 0.3 }}
                />

                {/* Gift box container */}
                <div {...buttonProps} className="relative cursor-pointer touch-none select-none">
                    {/* Gift box */}
                    <div
                        className={`gift-box-shine relative h-32 w-44 overflow-hidden rounded-xl border-4 border-action-primary bg-gradient-to-br from-action-primary/20 via-white to-action-primary/20 shadow-xl transition-transform ${holdProgress > 0 ? 'scale-[0.98]' : ''}`}
                    >
                        {/* Vertical ribbon */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-5 -translate-x-1/2 bg-gradient-to-r from-action-primary/50 via-action-primary/70 to-action-primary/50" />

                        {/* Horizontal ribbon */}
                        <div className="absolute top-1/2 right-0 left-0 h-5 -translate-y-1/2 bg-gradient-to-b from-action-primary/50 via-action-primary/70 to-action-primary/50" />

                        {/* Light rays from center */}
                        <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: `radial-gradient(circle at center, rgba(255,255,255,${0.4 * (holdProgress / 100)}) 0%, transparent 70%)`,
                            }}
                        />

                        {/* Cracks appearing with progress */}
                        {holdProgress > 20 && (
                            <div className="absolute top-4 left-4 h-8 w-0.5 rotate-45 bg-action-primary/40" />
                        )}
                        {holdProgress > 40 && (
                            <div className="absolute right-6 bottom-6 h-10 w-0.5 -rotate-[30deg] bg-action-primary/40" />
                        )}
                        {holdProgress > 60 && (
                            <div className="absolute bottom-4 left-8 h-6 w-0.5 rotate-12 bg-action-primary/40" />
                        )}

                        {/* Gift icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div
                                className={`rounded-full bg-action-primary p-3 shadow-lg transition-transform ${holdProgress > 30 ? 'animate-bounce' : ''}`}
                            >
                                <Icon name="gift" size={24} className="text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Ribbon bow */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <div className="relative">
                            {/* Left ribbon tail */}
                            <div
                                className="absolute top-2 left-1/2 h-4 w-2 -translate-x-[10px] bg-action-primary transition-transform"
                                style={{
                                    transform: `translateX(-10px) rotate(${-20 - ribbonSpread * 0.5}deg)`,
                                    borderRadius: '0 0 2px 2px',
                                }}
                            />
                            {/* Right ribbon tail */}
                            <div
                                className="absolute top-2 left-1/2 h-4 w-2 translate-x-[2px] bg-action-primary transition-transform"
                                style={{
                                    transform: `translateX(2px) rotate(${20 + ribbonSpread * 0.5}deg)`,
                                    borderRadius: '0 0 2px 2px',
                                }}
                            />
                            {/* Left loop */}
                            <div
                                className="absolute -top-1 -left-5 h-4 w-6 rounded-full bg-action-primary shadow-sm transition-transform"
                                style={{ transform: `rotate(${-25 - ribbonSpread}deg)` }}
                            />
                            {/* Right loop */}
                            <div
                                className="absolute -top-1 -right-5 h-4 w-6 rounded-full bg-action-primary shadow-sm transition-transform"
                                style={{ transform: `rotate(${25 + ribbonSpread}deg)` }}
                            />
                            {/* Center knot */}
                            <div className="relative z-10 h-4 w-4 rounded-sm bg-action-primary shadow-md" />
                        </div>
                    </div>

                    {/* Particles flying out */}
                    {holdProgress > 30 && (
                        <>
                            <div className="absolute top-2 -right-4 animate-ping text-body-l [animation-duration:1s]">
                                ✨
                            </div>
                            <div className="absolute bottom-4 -left-4 animate-ping text-body-l [animation-delay:0.2s] [animation-duration:1.2s]">
                                ✨
                            </div>
                        </>
                    )}
                    {holdProgress > 60 && (
                        <>
                            <div className="absolute -top-2 right-2 animate-ping text-body-s [animation-delay:0.3s] [animation-duration:0.8s]">
                                ⭐
                            </div>
                            <div className="absolute -bottom-2 left-2 animate-ping text-body-s [animation-delay:0.1s] [animation-duration:1s]">
                                ⭐
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Instructions */}
            <p className="mt-6 text-center text-body-s text-foreground-secondary">{t('holdToUnwrap')}</p>
        </div>
    )
}
