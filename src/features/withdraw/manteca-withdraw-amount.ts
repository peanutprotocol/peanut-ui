import { formatUnits } from 'viem'
import { type WithdrawInitRequest } from '@/services/manteca'
import { parseUsdAmountToUnits, usdcUnitsToRainCents } from '@/utils/balance.utils'
import { normalizeBankAmount } from './bank-amount'

/**
 * The /manteca/withdraw/init request for the amount on the screen (TASK-23997).
 *
 * A local amount the user typed goes as `fiatAmount`, so the API prices the
 * exact USDC for it and the bank receives that amount. The USD amount stays
 * the one to deliver when the user typed USD, or when the local amount on the
 * field is still the one this screen derived from a USD amount: the ?amount=
 * hand-off (the /withdraw amount step is USD only) or a balance fill (withdraw
 * everything). The two are compared as numbers: the field can report "75000"
 * for a derived "75000.00".
 *
 * `amount` goes with `fiatAmount` too: an API that predates `fiatAmount`
 * ignores it and prices `amount`, so the app works whichever repo deploys first.
 */
export function mantecaWithdrawInitRequest(input: {
    usdAmount: string
    currencyAmount: string | undefined
    currency: string
    isAmountTypedInUsd: boolean
    /** The local amount this screen derived from a USD amount, or null. */
    usdSourcedCurrencyAmount: string | null
}): WithdrawInitRequest {
    const request = { amount: input.usdAmount, currency: input.currency }
    if (input.isAmountTypedInUsd) return request
    const fiatAmount = normalizeBankAmount(input.currencyAmount)
    if (fiatAmount === null) return request
    if (input.usdSourcedCurrencyAmount !== null && Number(input.usdSourcedCurrencyAmount) === Number(fiatAmount)) {
        return request
    }
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
