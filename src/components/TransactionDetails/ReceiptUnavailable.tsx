'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'

/**
 * Branded terminal state for a receipt link that cannot render: 'gone' for
 * legacy `?t=` links whose id no longer resolves (pre-May-2026 share URLs) —
 * permanently dead, no retry — and 'loadFailed' for a transient
 * fetch/transform failure, which offers a Retry (the caller's refetch when
 * provided, else a full reload of the same URL for the server route).
 *
 * Built on EmptyState so it reads like every other empty/error surface in the
 * app: one card, centered icon bubble, title, body, CTA inside the card. The
 * bubble follows the state, the way an activity row's does (TASK-22452): a
 * dead link is terminal but nobody failed, so it is gray like a cancelled row;
 * a load that failed is red like a failed one, and it is the one that retries.
 */
export function ReceiptUnavailable({
    variant = 'gone',
    onRetry,
}: {
    variant?: 'gone' | 'loadFailed'
    onRetry?: () => void
}) {
    const t = useTranslations('transaction.receiptUnavailable')
    const tCommon = useTranslations('common')
    const isGone = variant === 'gone'

    return (
        <EmptyState
            containerClassName="w-full max-w-md"
            icon={isGone ? 'link-slash' : 'alert'}
            iconColor={isGone ? 'gray' : 'red'}
            title={isGone ? t('title') : t('loadFailedTitle')}
            description={isGone ? t('description') : t('loadFailedDescription')}
            cta={
                <div className="mt-2 flex flex-col items-center gap-2 print:hidden">
                    {!isGone && (
                        <Button
                            variant="purple"
                            shadowSize="4"
                            size="small"
                            onClick={() => (onRetry ? onRetry() : window.location.reload())}
                        >
                            {tCommon('retry')}
                        </Button>
                    )}
                    <Button href="/home" variant={isGone ? 'purple' : 'stroke'} shadowSize="4" size="small">
                        {tCommon('goToHome')}
                    </Button>
                </div>
            }
        />
    )
}
