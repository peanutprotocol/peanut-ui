import { COUNTRY_SPECIFIC_METHODS, type SpecificPaymentMethod } from '@/components/AddMoney/consts'

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
