'use client'

import type { ReactNode } from 'react'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import Loading from '@/components/Global/Loading'
import { AveniaWithdrawFlow } from '@/features/avenia/components/AveniaWithdrawFlow'
import { useAveniaPixPath } from '@/features/avenia/hooks/useAveniaPixPath'

/** Brazil's withdraw by Pix: Avenia for Brazilian residents, the Manteca flow (`manteca`) for everyone else. */
export function BrazilPixWithdraw({
    mantecaUnavailable,
    manteca,
}: {
    mantecaUnavailable: boolean
    manteca: ReactNode
}) {
    const { path, rail } = useAveniaPixPath()
    if (path === 'loading') return <Loading variant="mascot" />
    if (path === 'avenia') return <AveniaWithdrawFlow rail={rail} />
    // a Manteca outage closes Manteca's withdrawals only
    if (mantecaUnavailable) return <MantecaTransfersMaintenanceView action="withdrawals" />
    return <>{manteca}</>
}
