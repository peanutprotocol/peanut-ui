import { type Account } from '@/interfaces/interfaces'
import { getOfframpConfigFromAccount } from '@/utils/bridge.utils'

/**
 * Destination currencies our payment partner pays an exact amount in
 * (TASK-23054). Mirrors EXACT_AMOUNT_CURRENCIES in peanut-api-ts
 * src/bridge/offramp-quote.ts; the API refuses any other.
 */
const EXACT_AMOUNT_CURRENCIES = ['eur', 'gbp', 'mxn', 'cop']

/**
 * The currency the account is paid in, when the user can ask for an exact
 * amount in it; null otherwise. Read from the account's rail, not its country:
 * an IBAN in Poland is paid in EUR, not PLN.
 */
export function exactAmountCurrency(account: Account | null | undefined): string | null {
    if (!account) return null
    let currency: string
    try {
        currency = getOfframpConfigFromAccount(account).currency
    } catch {
        return null // not a Bridge account
    }
    return EXACT_AMOUNT_CURRENCIES.includes(currency) ? currency : null
}
