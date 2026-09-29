import { type Account } from '@/interfaces/interfaces'
import { getOfframpConfigFromAccount } from '@/utils/bridge.utils'
import { formatBankAmount } from '@/utils/currency'
import { OFFRAMP_QUOTE_CURRENCIES, QUOTE_AMOUNT_PATTERN } from '@/utils/offramp-quote.utils'
import { parseUsdAmount } from './amount-validation'
import { type ReviewPayout } from './types'

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
    return OFFRAMP_QUOTE_CURRENCIES.includes(currency) ? currency : null
}

/**
 * A typed USDC amount (`?amount=`) as the quote can price it: cut to whole
 * cents, never rounded up, because the quote takes 2 decimals. The review then
 * shows the quote's amount, so the user confirms exactly what leaves. Null
 * only for an amount the submit refuses anyway: not a plain decimal, more than
 * the token's 6 decimals, or under one cent.
 */
export function quotableSourceAmount(amount: string): string | null {
    const normalized = parseUsdAmount(amount)
    if (normalized === null) return null
    const [whole, fraction = ''] = normalized.split('.')
    const cents = fraction.slice(0, 2)
    const quotable = cents ? `${whole}.${cents}` : whole
    return QUOTE_AMOUNT_PATTERN.test(quotable) ? quotable : null
}

/**
 * The typed bank amount as the quote API accepts it, or null. The field can
 * report mid-typing forms, and the API answers 400 to them: "90." becomes
 * "90" and ".5" becomes "0.5". Anything else the pattern refuses is null.
 */
export function normalizeBankAmount(value: string | null | undefined): string | null {
    let amount = (value ?? '').replace(/,/g, '').trim()
    if (amount.endsWith('.')) amount = amount.slice(0, -1)
    if (amount.startsWith('.')) amount = `0${amount}`
    return QUOTE_AMOUNT_PATTERN.test(amount) ? amount : null
}

/**
 * The two amounts of a bank withdrawal, in the order the user reads them: the
 * currency they typed the amount in leads (TASK-23054). The bank amount is "≈"
 * because the provider converts at settlement; the USD that leaves the balance
 * is exact. A USD payout, or a bank amount not quoted yet, has one amount.
 */
export function payoutAmounts(
    usdAmount: string,
    payout: Pick<ReviewPayout, 'currency' | 'amount' | 'enteredInBankCurrency'>
): { headline: string; secondary?: string } {
    const usd = formatBankAmount(usdAmount, 'USD')
    const bank = payout.amount ? `≈ ${formatBankAmount(payout.amount, payout.currency)}` : undefined
    if (!bank) return { headline: usd }
    return payout.enteredInBankCurrency ? { headline: bank, secondary: usd } : { headline: usd, secondary: bank }
}
