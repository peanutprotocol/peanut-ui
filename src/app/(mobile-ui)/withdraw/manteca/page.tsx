'use client'

import { useSearchParams } from 'next/navigation'
import RouteAlias from '@/components/Global/RouteAlias'
import { PIX_WITHDRAW_PATH } from '@/features/pix/pix.routes'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { countryData } from '@/components/AddMoney/consts'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { BrazilPausedScreen } from '@/features/brazil-pause/components/BrazilPausedScreen'
import { usePixPayBlock } from '@/features/pix/usePixPayBlock'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import PixKeySendView from '@/features/withdraw/views/PixKeySendView'
import MantecaBankWithdrawFlow from '@/features/withdraw/views/MantecaBankWithdrawFlow'

export default function MantecaWithdrawFlow() {
    const searchParams = useSearchParams()
    const { disabledMantecaCurrencies } = useKillSwitches()
    const pixBlock = usePixPayBlock()
    // Brazil PIX sends go through the Manteca QR-payment endpoint (send to any
    // PIX key), not the offramp/withdraw endpoint. Delegate to the lightweight
    // PIX-key entry, which wraps the key and hands off to /qr-pay. The gate
    // there (canDo('pay', { provider: 'manteca' })) is broader than the full
    // Manteca KYC the withdraw flow requires — so PIX-pay-capable users get
    // through. All Brazil-PIX entry points funnel here, so this is the single
    // chokepoint that flips the endpoint without touching the AR / bank paths.
    if (searchParams.get('country') === 'brazil' && searchParams.get('method') === 'pix') {
        if (pixBlock) return <BrazilPausedScreen block={pixBlock} />
        return <PixKeySendView destinationParam={searchParams.get('destination')} />
    }
    // A BRL withdrawal to the user's own account lives on /withdraw/pix, where the backend's route
    // picks the provider; an old link or bookmark lands there rather than on a blank page.
    if (searchParams.get('country') === 'brazil') return <RouteAlias to={PIX_WITHDRAW_PATH} />
    // Manteca provider outage — block the offramp only for currencies still
    // down. Placed AFTER the Brazil-PIX delegation so PIX-over-QR sends (which
    // ride the QR-payment endpoint, not Manteca offramp) stay open.
    const withdrawCurrency = countryData.find((c) => c.path === searchParams.get('country'))?.currency?.toUpperCase()
    if (withdrawCurrency && (disabledMantecaCurrencies as string[]).includes(withdrawCurrency)) {
        return <MantecaTransfersMaintenanceView action="withdrawals" />
    }
    return (
        <KycFeatureActivationGate
            feature="local"
            scope={{ channel: 'bank', country: countryData.find((c) => c.path === searchParams.get('country'))?.id }}
        >
            <MantecaBankWithdrawFlow searchParams={searchParams} />
        </KycFeatureActivationGate>
    )
}
