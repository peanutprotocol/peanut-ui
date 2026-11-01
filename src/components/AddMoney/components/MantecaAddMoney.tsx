'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import MantecaAddMoneyFlow from '@/components/AddMoney/components/MantecaAddMoneyFlow'
import { useSearchParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'

export default function MantecaAddMoney() {
    const searchParams = useSearchParams()
    return (
        <KycFeatureActivationGate
            feature="local"
            scope={{ channel: 'bank', country: countryData.find((c) => c.path === searchParams.get('country'))?.id }}
        >
            <MantecaAddMoneyFlow searchParams={searchParams} />
        </KycFeatureActivationGate>
    )
}
