import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { PROVIDERS } from '@/constants/providers.consts'
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
 * The registry entry an API provider code answers for (`answersFor` in providers.consts.ts):
 * the one for this currency where the provider runs an entity per currency, else its only one.
 * Null for a code no entry answers for: the screen shows no provider row.
 */
export function providerIdFor(code: string | null | undefined, currency?: string | null): ProviderId | null {
    if (!code) return null
    const records = Object.values(PROVIDERS).filter(
        (record) => record.answersFor?.provider.toUpperCase() === code.toUpperCase()
    )
    const forCurrency = records.find(
        (record) => record.answersFor?.currency && record.answersFor.currency === currency?.toUpperCase()
    )
    return (forCurrency ?? records.find((record) => !record.answersFor?.currency))?.id ?? null
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
    const code = tx.extraDataForDrawer?.provider
    // Bridge runs an entity per residence: the owner's own on- or off-ramp names theirs
    if (code === 'BRIDGE' && isOwnBridgeAccountFlow(tx.extraDataForDrawer?.bridgeFlow))
        return bridgeProviderIdForResidence(residenceIso2)
    return providerIdFor(code, tx.currency?.code)
}

/**
 * The legal record behind a Pix provider code, as a route, a /pix/* answer or a history entry
 * names it ('manteca', 'MANTECA'), for the provider row and its sheet: Pix moves reais. Pix is the
 * user's own money, so Bridge names the entity of the user's residence, as the bank screens do
 * (`residenceIso2`: the verified residence, `useBridgeProviderId`). Null for a provider no registry
 * entry answers for: the screen then shows no provider row.
 */
export function pixProviderId(provider: string | null | undefined, residenceIso2?: string | null): ProviderId | null {
    if (provider?.toUpperCase() === 'BRIDGE') return bridgeProviderIdForResidence(residenceIso2)
    return providerIdFor(provider, 'BRL')
}
