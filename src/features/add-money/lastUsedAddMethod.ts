import { getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
import type { AddMoneyPickerMethod } from './addMoneyMethods'

// on the phone only, no backend. "used" means the method of the last deposit that completed on screen, not a
// tap (Kush, 27 Nov)
const LAST_DEPOSIT_METHOD_KEY = 'peanut-last-add-method'

export const readLastDepositMethod = (): unknown => getFromLocalStorage(LAST_DEPOSIT_METHOD_KEY)

/** Call where a deposit through `method` completes, so Home's Add drawer leads with it next time. */
export const saveLastDepositMethod = (method: AddMoneyPickerMethod) =>
    saveToLocalStorage(LAST_DEPOSIT_METHOD_KEY, method)

/**
 * Splits the Add rows into the last used one and the others, keeping their order. A stored method that is
 * not in the list (the country changed, the method went away, an old value) is ignored, so no row is lost.
 */
export function splitLastUsed<T extends string>(methods: readonly T[], stored: unknown) {
    const lastUsed = methods.find((method) => method === stored) ?? null
    return { lastUsed, others: methods.filter((method) => method !== lastUsed) }
}
