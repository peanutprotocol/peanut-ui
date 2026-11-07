'use client'

import { useMemo } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import { useTranslations } from 'next-intl'
import Loading from '@/components/Global/Loading'
import { AveniaWithdrawFlow } from '@/features/avenia/components/AveniaWithdrawFlow'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { PixPausedScreen } from '@/features/pix/components/PixPausedScreen'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { usePixRoute } from '@/features/pix/usePixRoute'
import MantecaBankWithdrawFlow from '@/features/withdraw/views/MantecaBankWithdrawFlow'

/**
 * Withdraw by Pix to the user's own account (`/withdraw/pix`). The backend's
 * withdraw route names the provider; this mounts that provider's screens.
 * The route also carries every pause (the residence's, a provider's, a
 * currency's), so the page reads no switch.
 */
export function PixWithdraw() {
    const t = useTranslations('navigation')
    const { route, screen } = usePixRoute('withdraw')
    // What the Manteca flow reads from its page's query: a saved account, and the country,
    // which the neutral page names (Brazil). Its other params it reads through nuqs itself.
    const [{ destination, isSavedAccount }] = useQueryStates({
        destination: parseAsString,
        isSavedAccount: parseAsString,
    })
    const mantecaSearchParams = useMemo(
        () =>
            new URLSearchParams({
                country: 'brazil',
                ...(destination ? { destination } : {}),
                ...(isSavedAccount ? { isSavedAccount } : {}),
            }),
        [destination, isSavedAccount]
    )

    if (screen === 'loading') return <Loading variant="mascot" />
    if (screen === 'paused') return <PixPausedScreen route={route} action="withdrawals" />
    if (screen === 'avenia' && route) return <AveniaWithdrawFlow route={route} />
    if (screen === 'manteca') {
        return (
            <KycFeatureActivationGate feature="local" scope={{ channel: 'bank', country: 'BR' }}>
                <MantecaBankWithdrawFlow searchParams={mantecaSearchParams} />
            </KycFeatureActivationGate>
        )
    }
    return <PixUnavailableScreen title={t('withdraw')} route={route} />
}
