import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
import type { AddMoneyMethod } from './addMoneyMethods'

// on the phone only, no backend (Kush, 27 Nov). "used" means tapped in the Home Add drawer.
const LAST_USED_ADD_METHOD_KEY = 'peanut-last-add-method'

export const readLastUsedAddMethod = (): unknown => getFromLocalStorage(LAST_USED_ADD_METHOD_KEY)

export const saveLastUsedAddMethod = (method: AddMoneyMethod) => saveToLocalStorage(LAST_USED_ADD_METHOD_KEY, method)

/**
 * Splits the Add rows into the last used one and the others, keeping their order. A stored method that is
 * not in the list (the country changed, the method went away, an old value) is ignored, so no row is lost.
 */
export function splitLastUsed<T extends string>(methods: readonly T[], stored: unknown) {
    const lastUsed = methods.find((method) => method === stored) ?? null
    return { lastUsed, others: methods.filter((method) => method !== lastUsed) }
}
