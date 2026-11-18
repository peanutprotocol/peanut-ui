'use client'

import { PixAddMoney } from '@/features/pix/components/PixAddMoney'
import { LocalResidenceAddressGate } from '@/features/kyc-features/LocalResidenceAddressGate'
import { useSafeBack } from '@/hooks/useSafeBack'

/** Add money by Pix: the backend's route names the provider whose screens this mounts. */
export default function PixAddMoneyPage() {
    const onBack = useSafeBack('/add-money?method=bank')
    return (
        <LocalResidenceAddressGate currency="BRL" onBack={onBack}>
            <PixAddMoney />
        </LocalResidenceAddressGate>
    )
}
