'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import MantecaAddMoneyFlow from '@/components/AddMoney/components/MantecaAddMoneyFlow'
import { useParams, useSearchParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'

export default function MantecaAddMoney() {
    const params = useParams()
    const searchParams = useSearchParams()
    // path params (web) or query params (native static export), as the route page reads them
    const country = (params.country as string) || searchParams.get('country') || ''
    const selectedCountry = countryData.find((item) => item.type === 'country' && item.path === country)
    return (
        <KycFeatureActivationGate
            feature="local"
            selectedCurrency={selectedCountry?.currency}
            scope={{ channel: 'bank', country: selectedCountry?.id }}
        >
            <MantecaAddMoneyFlow searchParams={searchParams} />
        </KycFeatureActivationGate>
    )
}
