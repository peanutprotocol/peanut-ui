import { formatUnits } from 'viem'
import { type WithdrawInitRequest } from '@/services/manteca'
import { parseUsdAmountToUnits, usdcUnitsToRainCents } from '@/utils/balance.utils'
import { normalizeBankAmount } from './bank-amount'

/**
 * The /manteca/withdraw/init request for the amount on the screen (TASK-23997).
 *
 * The amount to deliver is the one the user entered, in the currency they
 * entered it in. A local amount goes as `fiatAmount`, so the API prices the
 * exact USDC for it and the bank receives that amount. A USD amount is sent
 * as USD: typed in USD (and only displayed in the local currency after a
 * toggle), handed over by ?amount= (the /withdraw amount step is USD only),
 * or a balance fill (withdraw everything). The last typed edit decides, not
 * the value on the field or the currency it shows.
 *
 * `amount` goes with `fiatAmount` too: an API that predates `fiatAmount`
 * ignores it and prices `amount`, so the app works whichever repo deploys first.
 */
export function mantecaWithdrawInitRequest(input: {
    usdAmount: string
    currencyAmount: string | undefined
    currency: string
    /** The currency the user last entered the amount in. */
    amountEnteredIn: 'local' | 'usd'
}): WithdrawInitRequest {
    const request = { amount: input.usdAmount, currency: input.currency }
    if (input.amountEnteredIn === 'usd') return request
    const fiatAmount = normalizeBankAmount(input.currencyAmount)
    if (fiatAmount === null) return request
    return { ...request, fiatAmount }
}

/** Whether two init requests price the same amount in the same currency. */
export function sameWithdrawInitRequest(a: WithdrawInitRequest, b: WithdrawInitRequest): boolean {
    return a.currency === b.currency && a.amount === b.amount && a.fiatAmount === b.fiatAmount
}

/**
 * The locked USD as review and success show it: rounded up to the cent, from
 * the same cents a card-funded withdrawal debits (`usdcUnitsToRainCents`), so
 * the screen and the card debit cannot differ. A wallet-funded withdrawal
 * pays at most this figure. Rounding to the nearest cent could show less than
 * the card debit (12.493001 as 12.49 while the card moves 12.50).
 */
export function lockedUsdDisplayAmount(usdAmount: string): string {
    const units = parseUsdAmountToUnits(usdAmount)
    if (units === null) return usdAmount
    return formatUnits(usdcUnitsToRainCents(units), 2)
}
