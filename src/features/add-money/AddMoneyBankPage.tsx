'use client'

import Loading from '@/components/Global/Loading'
import { railJurisdictionForBank } from '@/utils/bridge.utils'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { useMantecaBankRedirect } from './useMantecaBankRedirect'
import { BridgeBankOnrampView } from './views/BridgeBankOnrampView'

// Route entry for /add-money/[country]/bank — bounces Manteca countries (BR/AR)
// to their own deposit flow before the Bridge page mounts (see
// useMantecaBankRedirect for why).
export function AddMoneyBankPage() {
    const { isMantecaRoute, selectedCountry } = useMantecaBankRedirect()

    if (isMantecaRoute) {
        return <Loading variant="mascot" />
    }

    return (
        <KycFeatureActivationGate
            feature="bank"
            scope={{ channel: 'bank', country: railJurisdictionForBank(selectedCountry?.id) }}
        >
            <BridgeBankOnrampView />
        </KycFeatureActivationGate>
    )
}
