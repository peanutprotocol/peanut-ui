'use client'

import { PixAddMoney } from '@/features/pix/components/PixAddMoney'
import { LocalResidenceAddressGate } from '@/features/kyc-features/LocalResidenceAddressGate'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useSearchParams } from 'next/navigation'
import { readReturnTo } from '@/utils/return-to.utils'

/** Add money by Pix: the backend's route names the provider whose screens this mounts. */
export default function PixAddMoneyPage() {
    const onBack = useSafeBack(readReturnTo(useSearchParams()) ?? '/add-money?method=bank')
    return (
        <LocalResidenceAddressGate currency="BRL" onBack={onBack}>
            <PixAddMoney />
        </LocalResidenceAddressGate>
    )
}
