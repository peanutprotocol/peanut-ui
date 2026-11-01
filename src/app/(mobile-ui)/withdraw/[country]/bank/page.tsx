'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import BridgeBankWithdrawView from '@/features/withdraw/views/BridgeBankWithdrawView'
import { useParams } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { getCountryFromPath, railJurisdictionForBank } from '@/utils/bridge.utils'

export default function WithdrawBankPage() {
    const params = useParams<{ country?: string }>()
    // The native build serves this page from the static /withdraw view, where the country is a query parameter.
    const [queryCountry] = useQueryState('country')
    const country = params?.country || queryCountry || ''
    return (
        <KycFeatureActivationGate
            feature="bank"
            scope={{ channel: 'bank', country: railJurisdictionForBank(getCountryFromPath(country)?.id) }}
        >
            <BridgeBankWithdrawView />
        </KycFeatureActivationGate>
    )
}
