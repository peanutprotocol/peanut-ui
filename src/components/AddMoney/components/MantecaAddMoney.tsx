'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import MantecaAddMoneyFlow from '@/components/AddMoney/components/MantecaAddMoneyFlow'
import { useParams, useSearchParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'
import { LocalResidenceAddressGate } from '@/features/kyc-features/LocalResidenceAddressGate'
import { useSafeBack } from '@/hooks/useSafeBack'
import { readReturnTo } from '@/utils/return-to.utils'

export default function MantecaAddMoney() {
    const params = useParams()
    const searchParams = useSearchParams()
    // path params (web) or query params (native static export), as the route page reads them
    const country = (params.country as string) || searchParams.get('country') || ''
    const selectedCountry = countryData.find((item) => item.type === 'country' && item.path === country)
    const onBack = useSafeBack(readReturnTo(searchParams) ?? '/add-money?method=bank')
    return (
        <LocalResidenceAddressGate currency={selectedCountry?.currency === 'BRL' ? 'BRL' : 'ARS'} onBack={onBack}>
            <KycFeatureActivationGate
                feature="local"
                selectedCurrency={selectedCountry?.currency}
                scope={{ channel: 'bank', country: selectedCountry?.id }}
            >
                <MantecaAddMoneyFlow searchParams={searchParams} />
            </KycFeatureActivationGate>
        </LocalResidenceAddressGate>
    )
}
