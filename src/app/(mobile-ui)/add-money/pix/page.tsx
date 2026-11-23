'use client'

import { PixAddMoney } from '@/features/pix/components/PixAddMoney'
import { LocalResidenceAddressGate } from '@/features/kyc-features/LocalResidenceAddressGate'
import { useSafeBack } from '@/hooks/useSafeBack'
import { parseAsString, useQueryState } from 'nuqs'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'

/** Add money by Pix: the backend's route names the provider whose screens this mounts. */
export default function PixAddMoneyPage() {
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const returnTo = readReturnTo(new URLSearchParams(rawReturnTo ? { [RETURN_TO_PARAM]: rawReturnTo } : {}))
    const onBack = useSafeBack(returnTo ?? '/add-money?method=bank')
    return (
        <LocalResidenceAddressGate currency="BRL" onBack={onBack}>
            <PixAddMoney />
        </LocalResidenceAddressGate>
    )
}
