'use client'

import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import BridgeBankWithdrawView from '@/features/withdraw/views/BridgeBankWithdrawView'

export default function WithdrawBankPage() {
    return (
        <KycFeatureActivationGate feature="bank">
            <BridgeBankWithdrawView />
        </KycFeatureActivationGate>
    )
}
