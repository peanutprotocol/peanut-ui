'use client'

import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import Loading from '@/components/Global/Loading'
import { PixPausedScreen } from '@/features/pix/components/PixPausedScreen'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { PixWithdrawFlow } from '@/features/pix/components/PixWithdrawFlow'
import { usePixRoute } from '@/features/pix/usePixRoute'

/**
 * Withdraw by Pix to the user's own account (`/withdraw/pix`). The backend's
 * withdraw route picks the provider, and the one Pix flow serves it. The route
 * also carries every pause (the residence's, a provider's, a currency's), so
 * the page reads no switch. A withdrawal already opened (`?intentId=`, also the
 * retired new-key link) shows its outcome whatever the route says now: a pause
 * or a refusal since must not hide whether the money arrived or came back.
 */
export function PixWithdraw() {
    const t = useTranslations('navigation')
    const { route, screen } = usePixRoute('withdraw')
    const [intentId] = useQueryState('intentId', parseAsString)

    if (screen === 'loading') return <Loading variant="mascot" />
    if (intentId && route) return <PixWithdrawFlow route={route} />
    if (screen === 'paused') return <PixPausedScreen route={route} action="withdrawals" />
    if (screen === 'flow' && route) return <PixWithdrawFlow route={route} />
    return <PixUnavailableScreen title={t('withdraw')} route={route} />
}
