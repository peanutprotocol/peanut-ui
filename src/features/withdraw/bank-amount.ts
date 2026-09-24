import { type Account } from '@/interfaces/interfaces'
import { getOfframpConfigFromAccount } from '@/utils/bridge.utils'

/**
 * Bank currencies the withdrawal amount is typed in (TASK-23054): the Bridge
 * payout currencies that convert from USDC. Mirrors QUOTE_CURRENCIES in
 * peanut-api-ts src/bridge/offramp-quote.ts; the quote refuses any other.
 */
const QUOTED_BANK_CURRENCIES = ['eur', 'gbp', 'mxn', 'cop']

/**
 * The currency the account is paid in, when the user types the amount in it
 * and a quote converts it to USDC; null for USD and non-Bridge accounts. Read
 * from the account's rail, not its country: an IBAN in Poland is paid in EUR.
 */
export function bankAmountCurrency(account: Account | null | undefined): string | null {
    if (!account) return null
    let currency: string
    try {
        currency = getOfframpConfigFromAccount(account).currency
    } catch {
        return null // not a Bridge account
    }
    return QUOTED_BANK_CURRENCIES.includes(currency) ? currency : null
}

/** The quote API's destinationAmount pattern (GET /bridge/offramp/quote). */
const BANK_AMOUNT_PATTERN = /^(?=.*[1-9])\d{1,12}(\.\d{1,2})?$/

/**
 * The typed bank amount as the quote API accepts it, or null. The field can
 * report mid-typing forms, and the API answers 400 to them: "90." becomes
 * "90" and ".5" becomes "0.5". Anything else the pattern refuses is null.
 */
export function normalizeBankAmount(value: string | null | undefined): string | null {
    let amount = (value ?? '').replace(/,/g, '').trim()
    if (amount.endsWith('.')) amount = amount.slice(0, -1)
    if (amount.startsWith('.')) amount = `0${amount}`
    return BANK_AMOUNT_PATTERN.test(amount) ? amount : null
}
