import type { RailCapabilityStatus, RailId, RailOperation } from '@/types/capabilities'

/**
 * The Brazil rails that move BRL in and out of the user's own account: Pix
 * through their own Manteca account, and the older Brazil bank rail some
 * accounts still hold. Paying a Pix code through the shared account is the
 * `pay` operation and does not count: every verified user has it.
 */
const BRAZIL_MONEY_RAILS: { railId: RailId; op: RailOperation }[] = [
    { railId: 'manteca.pix_br', op: 'deposit' },
    { railId: 'manteca.pix_br', op: 'withdraw' },
    { railId: 'manteca.bank_transfer_br', op: 'deposit' },
    { railId: 'manteca.bank_transfer_br', op: 'withdraw' },
]

/**
 * True for a user the Brazil pause covers: a Brazil resident (verified, else
 * declared), or anyone who can move BRL through a Brazil rail of their own.
 *
 * The rails catch accounts with no residence on file. A Pix payer who lives
 * elsewhere matches neither, so their Pix payments stay open.
 */
export function isBrazilServicesUser(
    residenceIso2s: string[],
    operationStatus: (railId: RailId, op: RailOperation) => RailCapabilityStatus | undefined
): boolean {
    if (residenceIso2s.includes('BR')) return true
    return BRAZIL_MONEY_RAILS.some(({ railId, op }) => operationStatus(railId, op) === 'enabled')
}
