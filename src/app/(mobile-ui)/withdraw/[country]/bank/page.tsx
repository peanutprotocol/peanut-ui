'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import BridgeBankWithdrawView from '@/features/withdraw/views/BridgeBankWithdrawView'
import { useParams } from 'next/navigation'
import { getCountryFromPath, railJurisdictionForBank } from '@/utils/bridge.utils'

export default function WithdrawBankPage() {
    const { country } = useParams<{ country: string }>()
    return (
        <KycFeatureActivationGate
            feature="bank"
            scope={{ channel: 'bank', country: railJurisdictionForBank(getCountryFromPath(country)?.id) }}
        >
            <BridgeBankWithdrawView />
        </KycFeatureActivationGate>
    )
}
