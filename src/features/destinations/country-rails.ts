import { COUNTRY_SPECIFIC_METHODS, type CountryData, type SpecificPaymentMethod } from '@/components/AddMoney/consts'
import { hasBridgeBankCorridor } from '@/components/AddWithdraw/bank-corridors'
import type { PixPayBlock } from '@/features/pix/pixRoute.utils'

export type MoneyFlow = 'add' | 'withdraw'

/**
 * The add flow reaches its country list from the "Bank" row, so only the bank
 * rail is a candidate there. The withdraw list is not pre-scoped, so every live
 * rail of the country counts.
 */
const ADD_BANK_METHOD_ID = 'bank-transfer-add'

/**
 * The rails a country can use today for this flow. Coming-soon rails are not a
 * choice, and crypto never is: it sits beside the country list, not inside it.
 */
export function liveRailsForCountry(countryId: string, flow: MoneyFlow): SpecificPaymentMethod[] {
    const methods = COUNTRY_SPECIFIC_METHODS[countryId]
    if (!methods) return []
    if (flow === 'add') return methods.add.filter((method) => method.id === ADD_BANK_METHOD_ID && !method.isSoon)
    return methods.withdraw.filter((method) => !method.isSoon)
}

/**
 * The one rail a country leaves the user, or null when they still have to
 * choose. A single rail means the per-country list would be a one-row screen —
 * pick it for them instead and save the tap.
 */
export function soleLiveRailForCountry(countryId: string, flow: MoneyFlow): SpecificPaymentMethod | null {
    const rails = liveRailsForCountry(countryId, flow)
    return rails.length === 1 ? rails[0] : null
}

/**
 * Can a send-to-bank (money to someone else's account) go to this country?
 *
 * Bridge bank corridors, plus Brazil: a PIX send to a third-party key rides the
 * Manteca QR-payment endpoint, or for a resident of Brazil the withdraw route
 * (see the method=pix delegation in /withdraw/manteca). Argentina stays out: its Manteca rails are own-account
 * offramps, the same ruling that keeps Mercado Pago off the send list (PR #2813).
 * Every send-to-bank picker reads this one answer, so a new list cannot forget
 * the gate. `pixPayBlock` is what stops the user's own Pix-key send (`usePixKeySend`), and it
 * is not optional, so a picker cannot leave it out either.
 */
export function isSendToBankCountry(
    country: Pick<CountryData, 'id' | 'path'>,
    pixPayBlock: PixPayBlock | null
): boolean {
    return hasBridgeBankCorridor(country.id) || (country.path === 'brazil' && sendOffersPix(pixPayBlock))
}

/**
 * Whether Send offers this user a Pix destination: Brazil in a picker, or a
 * saved Pix key. A resident of Brazil is offered one only where their withdraw
 * route pays the key (`pixKeySend`): their pay:PIX_BR route refuses the
 * residence, so without it the send would end on a screen with no way on. The
 * Brazil pause keeps the destination listed: the pause lifts, and its screen
 * says so.
 */
export function sendOffersPix(pixPayBlock: PixPayBlock | null): boolean {
    return pixPayBlock !== 'residence'
}
