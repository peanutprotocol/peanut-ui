'use client'

import Loading from '@/components/Global/Loading'
import { useMantecaBankRedirect } from './useMantecaBankRedirect'
import { BridgeBankOnrampView } from './views/BridgeBankOnrampView'

// Route entry for /add-money/[country]/bank — bounces Manteca countries (BR/AR)
// to their own deposit flow before the Bridge page mounts (see
// useMantecaBankRedirect for why).
export function AddMoneyBankPage() {
    const { isMantecaRoute } = useMantecaBankRedirect()

    if (isMantecaRoute) {
        return <Loading variant="mascot" />
    }

    return <BridgeBankOnrampView />
}
