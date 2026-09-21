'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useModalsContext } from '@/context/ModalsContext'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useRainFunding } from '@/hooks/wallet/useRainFunding'
import { ApiError } from '@/services/api-error'

/**
 * One-time consent for Rain's real-time funding, shown while the user holds a
 * non-cancelled card whose wallet has not given Rain's operator the approval
 * this app asks for.
 *
 * An inline callout, never a blocking modal: the rest of the wallet does not
 * depend on the card. Three things it can say:
 *   - the allowance is known and missing → the consent, with its CTA;
 *   - the funding read failed → an error with a retry (or support, when the
 *     backend says the card is linked to another wallet). Never silence: a
 *     card that looks ready and then declines is the worst outcome;
 *   - loading or approved → nothing.
 */
export default function EnableCardPaymentsBanner() {
    const t = useTranslations('card.funding')
    const tCommon = useTranslations('common')
    const { setIsSupportModalOpen } = useModalsContext()
    const { overview } = useRainCardOverview()
    const hasCard = !!findActiveCard(overview)
    const { funding, isApproved, fundingError, approve, recheck, isSubmitting, lastError } = useRainFunding({
        enabled: hasCard,
    })

    if (!hasCard) return null

    // A failed read with nothing cached: we do not know if the card is funded.
    if (fundingError && !funding) {
        const isWalletMismatch = fundingError instanceof ApiError && fundingError.status === 409
        return (
            <Callout
                priority="error"
                title={t('title')}
                ctas={[
                    isWalletMismatch
                        ? { label: tCommon('contactSupport'), onClick: () => setIsSupportModalOpen(true) }
                        : { label: tCommon('retry'), onClick: () => void recheck() },
                ]}
                data-testid="card-funding-error"
            >
                {isWalletMismatch ? t('walletMismatch') : t('statusUnavailable')}
            </Callout>
        )
    }

    if (isApproved !== false) return null

    // Sent, no receipt, chain unchanged so far: re-check, never re-send blind.
    if (lastError?.kind === 'pending') {
        return (
            <Callout
                priority="attention"
                title={t('title')}
                ctas={[{ label: t('checkAgain'), onClick: () => void recheck() }]}
                data-testid="card-funding-pending"
            >
                {t('pending')}
            </Callout>
        )
    }

    const errorText = !lastError
        ? null
        : lastError.kind === 'user-cancelled'
          ? t('cancelled')
          : lastError.kind === 'wallet-mismatch'
            ? t('walletMismatch')
            : t('failed')

    return (
        <div className="flex flex-col gap-2">
            {errorText && <Callout priority="error">{errorText}</Callout>}
            <Callout
                priority="attention"
                title={t('title')}
                ctas={[
                    {
                        label: isSubmitting ? t('working') : errorText ? tCommon('tryAgain') : t('title'),
                        onClick: () => {
                            if (!isSubmitting) void approve()
                        },
                    },
                ]}
                data-testid="enable-card-payments"
            >
                {t('description')}
            </Callout>
        </div>
    )
}
