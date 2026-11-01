'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import BridgeBankWithdrawView from '@/features/withdraw/views/BridgeBankWithdrawView'
import { useParams, useSearchParams } from 'next/navigation'
import { getCountryFromPath, railJurisdictionForBank } from '@/utils/bridge.utils'

export default function WithdrawBankPage() {
    const params = useParams()
    const search = useSearchParams()
    const country = (params.country as string) || search.get('country') || ''
    return (
        <KycFeatureActivationGate
            feature="bank"
            scope={{ channel: 'bank', country: railJurisdictionForBank(getCountryFromPath(country)?.id) }}
        >
            <BridgeBankWithdrawView />
        </KycFeatureActivationGate>
    )
}
