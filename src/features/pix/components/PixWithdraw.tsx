'use client'

import { useMemo } from 'react'
import { parseAsString, useQueryStates } from 'nuqs'
import { useTranslations } from 'next-intl'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import Loading from '@/components/Global/Loading'
import { AveniaWithdrawFlow } from '@/features/avenia/components/AveniaWithdrawFlow'
import { BrazilPausedScreen } from '@/features/brazil-pause/components/BrazilPausedScreen'
import { useBrazilServicesPaused } from '@/features/brazil-pause/useBrazilServicesPaused'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { usePixRoute } from '@/features/pix/usePixRoute'
import MantecaBankWithdrawFlow from '@/features/withdraw/views/MantecaBankWithdrawFlow'

/**
 * Withdraw by Pix to the user's own account (`/withdraw/pix`). The backend's
 * withdraw route names the provider; this mounts that provider's screens.
 * The Brazil pause and a Manteca BRL outage still hold Manteca's screens
 * here, because the router does not read those two switches yet.
 */
export function PixWithdraw() {
    const t = useTranslations('navigation')
    const { route, screen } = usePixRoute('withdraw')
    const brazilPaused = useBrazilServicesPaused()
    const { disabledMantecaCurrencies } = useKillSwitches()
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
    if (screen === 'paused') return <MantecaTransfersMaintenanceView action="withdrawals" />
    if (screen === 'avenia' && route) return <AveniaWithdrawFlow route={route} />
    if (screen === 'manteca') {
        if (brazilPaused) return <BrazilPausedScreen />
        if ((disabledMantecaCurrencies as string[]).includes('BRL')) {
            return <MantecaTransfersMaintenanceView action="withdrawals" />
        }
        return (
            <KycFeatureActivationGate feature="local" scope={{ channel: 'bank', country: 'BR' }}>
                <MantecaBankWithdrawFlow searchParams={mantecaSearchParams} />
            </KycFeatureActivationGate>
        )
    }
    return <PixUnavailableScreen title={t('withdraw')} route={route} />
}
