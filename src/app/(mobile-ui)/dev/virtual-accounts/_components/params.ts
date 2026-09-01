import { parseAsBoolean, parseAsStringEnum } from 'nuqs'
import type { VaCurrency, VaScreen, VaState } from './types'

export const VA_SCREENS: VaScreen[] = ['pick', 'details', 'share']
export const VA_CURRENCIES: VaCurrency[] = ['usd', 'eur', 'gbp', 'mxn']
export const VA_STATES: VaState[] = ['ready', 'pending', 'unavailable', 'returned', 'failed', 'kyc']

/**
 * One nuqs definition shared by the harness controls and the flow, so the URL
 * is the single source of truth (design.md state table) and a screen+state
 * combination is a shareable link: ?screen=details&currency=eur&state=returned
 */
export const VA_PARAMS = {
    screen: parseAsStringEnum(VA_SCREENS).withDefault('pick'),
    currency: parseAsStringEnum(VA_CURRENCIES).withDefault('eur'),
    state: parseAsStringEnum(VA_STATES).withDefault('ready'),
    /** the memo fork: true = Bridge Virtual Accounts SKU enabled for our developer */
    sku: parseAsBoolean.withDefault(false),
}
