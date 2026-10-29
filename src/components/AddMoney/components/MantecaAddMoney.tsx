'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import MantecaAddMoneyFlow from '@/components/AddMoney/components/MantecaAddMoneyFlow'
import { useSearchParams } from 'next/navigation'

export default function MantecaAddMoney() {
    const searchParams = useSearchParams()
    return (
        <KycFeatureActivationGate feature="local">
            <MantecaAddMoneyFlow searchParams={searchParams} />
        </KycFeatureActivationGate>
    )
}
