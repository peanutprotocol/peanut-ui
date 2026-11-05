'use client'

import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import Loading from '@/components/Global/Loading'
import { AveniaAddMoneyFlow } from '@/features/avenia/components/AveniaAddMoneyFlow'
import { useAveniaPixPath } from '@/features/avenia/hooks/useAveniaPixPath'

/** Brazil's add money by Pix: Avenia for Brazilian residents, Manteca for everyone else. */
export function BrazilPixAddMoney({
    searchParams,
    mantecaUnavailable,
}: {
    searchParams: Pick<URLSearchParams, 'get'>
    mantecaUnavailable: boolean
}) {
    const { path, rail } = useAveniaPixPath()
    if (path === 'loading') return <Loading variant="mascot" />
    // the Avenia kill switch: the same provider-outage screen as Manteca's
    if (path === 'paused') return <MantecaTransfersMaintenanceView action="deposits" />
    if (path === 'avenia') return <AveniaAddMoneyFlow searchParams={searchParams} rail={rail} />
    // a Manteca outage closes Manteca's deposits only
    if (mantecaUnavailable) return <MantecaTransfersMaintenanceView action="deposits" />
    return <MantecaAddMoney />
}
