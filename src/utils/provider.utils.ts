import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import type { ProviderId } from '@/types/provider.types'
import { bridgeEntityForResidence, type BridgeEntity } from '@/utils/bridge-terms.utils'

const BRIDGE_PROVIDER_ID: Record<BridgeEntity, ProviderId> = {
    us: 'bridge-us',
    eea: 'bridge-eea',
    restOfWorld: 'bridge-row',
}

/**
 * The Bridge entity record for a resident of `residenceIso2`. Unknown and
 * unplaced residences get the brand-only record. So does GB: Bridge's terms
 * put the UK under the rest-of-world documents, but the provider register
 * (TASK-23295) does not confirm which entity serves UK residents.
 */
export function bridgeProviderIdForResidence(residenceIso2: string | null | undefined): ProviderId {
    if (residenceIso2?.toUpperCase() === 'GB') return 'bridge'
    const entity = bridgeEntityForResidence(residenceIso2)
    return entity ? BRIDGE_PROVIDER_ID[entity] : 'bridge'
}

/**
 * The provider a transaction went through, for the receipt's provider row.
 * Null means no row: the money never left Peanut's own rails, or we cannot
 * tell which entity handled it.
 */
export function providerIdForTransaction(
    tx: Pick<TransactionDetails, 'extraDataForDrawer' | 'currency'>,
    residenceIso2?: string | null
): ProviderId | null {
    switch (tx.extraDataForDrawer?.provider) {
        case 'BRIDGE':
            return bridgeProviderIdForResidence(residenceIso2)
        case 'MANTECA': {
            const code = tx.currency?.code?.toUpperCase()
            if (code === 'ARS') return 'manteca-ar'
            if (code === 'BRL') return 'manteca-br'
            return null
        }
        case 'RAIN':
            return 'third-national'
        case 'RHINO':
            return 'rhino'
        default:
            return null
    }
}
