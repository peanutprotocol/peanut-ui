'use client'

/**
 * <CardEligibilityCheckScreen /> — the "See if you qualify" moment.
 *
 * DRY with the QR-claim flow:
 *   - <HoldToClaimButton /> owns the press-and-hold mechanic + the black
 *     progress fill, identical to /qr/[code]/page.tsx.
 *   - This screen owns the screen-wide shake (perk-claim parity) by
 *     applying `getShakeClass` to its outer flex column based on the
 *     `onShakeChange` callback from the button.
 *
 * On hold-complete the parent state machine decides the next view:
 *   - has card access → BadgeSkipCelebration (share-asset reveal)
 *   - no card access  → CardRejectionScreen ("not tonight" door rejection)
 */

import { type FC, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import NavHeader from '@/components/Global/NavHeader'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { getShakeClass } from '@/utils/perk.utils'
import type { ShakeIntensity } from '@/hooks/useHoldToClaim'
import { useHaptic } from 'use-haptic'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface Props {
    onComplete: () => void
    onPrev?: () => void
    /** Reflect-back string for the headline (e.g. user.username). */
    username?: string
}

const CardEligibilityCheckScreen: FC<Props> = ({ onComplete, onPrev, username }) => {
    const t = useTranslations('card')
    const { triggerHaptic } = useHaptic()
    const [shake, setShake] = useState<{ on: boolean; intensity: ShakeIntensity }>({
        on: false,
        intensity: 'none',
    })

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_ELIGIBILITY_CHECK_VIEWED)
    }, [])

    const handleComplete = (): void => {
        triggerHaptic()
        posthog.capture(ANALYTICS_EVENTS.CARD_ELIGIBILITY_CHECK_COMPLETED)
        onComplete()
    }

    return (
        <div className={`flex min-h-[inherit] flex-col gap-6 ${getShakeClass(shake.on, shake.intensity)}`}>
            <NavHeader title={t('eligibility.navTitle')} onPrev={onPrev} />

            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-2xl font-extrabold text-n-1">
                    {username ? t('eligibility.titleWithUsername', { username }) : t('eligibility.title')}
                </h1>
                <p className="text-grey-1">{t('eligibility.description')}</p>
            </div>

            <div className="mx-auto w-full max-w-sm">
                <ScaledPixelatedCardFace last4="????" blurAll />
            </div>

            <div className="mt-auto flex flex-col gap-2">
                <HoldToClaimButton
                    onComplete={handleComplete}
                    onShakeChange={(on, intensity) => setShake({ on, intensity })}
                    ariaLabel={t('eligibility.holdAriaLabel')}
                >
                    {t('eligibility.cta')}
                </HoldToClaimButton>
            </div>
        </div>
    )
}

export default CardEligibilityCheckScreen
