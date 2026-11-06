'use client'

import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import { useTranslations } from 'next-intl'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import Loading from '@/components/Global/Loading'
import { AveniaAddMoneyFlow } from '@/features/avenia/components/AveniaAddMoneyFlow'
import { BrazilPausedScreen } from '@/features/brazil-pause/components/BrazilPausedScreen'
import { useBrazilServicesPaused } from '@/features/brazil-pause/useBrazilServicesPaused'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { usePixRoute } from '@/features/pix/usePixRoute'

/**
 * Add money by Pix (`/add-money/pix`). The backend's deposit route names the
 * provider; this mounts that provider's screens. The Brazil pause and a
 * Manteca BRL outage still hold Manteca's screens here, because the router
 * does not read those two switches yet.
 */
export function PixAddMoney() {
    const t = useTranslations('addMoney')
    const { route, screen } = usePixRoute('deposit')
    const brazilPaused = useBrazilServicesPaused()
    const { disabledMantecaCurrencies } = useKillSwitches()

    if (screen === 'loading') return <Loading variant="mascot" />
    if (screen === 'paused') return <MantecaTransfersMaintenanceView action="deposits" />
    if (screen === 'avenia' && route) return <AveniaAddMoneyFlow route={route} />
    if (screen === 'manteca') {
        if (brazilPaused) return <BrazilPausedScreen />
        if ((disabledMantecaCurrencies as string[]).includes('BRL')) {
            return <MantecaTransfersMaintenanceView action="deposits" />
        }
        return <MantecaAddMoney countryPath="brazil" />
    }
    return <PixUnavailableScreen title={t('title')} route={route} />
}
