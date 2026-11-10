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
 * True for the Bridge flows that only ever carry the account holder: their own
 * on-ramp or off-ramp. A send-link claim or guest send can involve someone who
 * is not the Bridge customer, so the viewer's residence says nothing there.
 */
export function isOwnBridgeAccountFlow(bridgeFlow: string | undefined): boolean {
    return bridgeFlow === 'ONRAMP' || bridgeFlow === 'OFFRAMP'
}

/**
 * The provider a transaction went through, for the receipt's provider row.
 * Null means no row: the money never left Peanut's own rails, or we cannot
 * tell which entity handled it. `residenceIso2` must be the entry owner's;
 * it only picks the Bridge entity on the owner's own on/off-ramp.
 */
export function providerIdForTransaction(
    tx: Pick<TransactionDetails, 'extraDataForDrawer' | 'currency'>,
    residenceIso2?: string | null
): ProviderId | null {
    switch (tx.extraDataForDrawer?.provider) {
        case 'BRIDGE':
            return isOwnBridgeAccountFlow(tx.extraDataForDrawer.bridgeFlow)
                ? bridgeProviderIdForResidence(residenceIso2)
                : 'bridge'
        case 'MANTECA': {
            const code = tx.currency?.code?.toUpperCase()
            if (code === 'ARS') return 'manteca-ar'
            if (code === 'BRL') return 'manteca-br'
            return null
        }
        case 'AVENIA':
            return 'avenia-br'
        case 'RAIN':
            return 'third-national'
        case 'RHINO':
            return 'rhino'
        default:
            return null
    }
}

/**
 * The legal record behind a Pix provider code, as a route, a /pix/* answer or a history entry
 * names it ('avenia', 'MANTECA'), for the provider row and its sheet. Null for a provider this
 * build has no record of: the screen then shows no provider row.
 */
export function pixProviderId(provider: string | null | undefined): ProviderId | null {
    switch (provider?.toLowerCase()) {
        case 'avenia':
            return 'avenia-br'
        case 'manteca':
            return 'manteca-br'
        default:
            return null
    }
}
