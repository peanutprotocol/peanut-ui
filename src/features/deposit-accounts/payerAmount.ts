/**
 * What the payer has to send, in the currency their bank works in.
 *
 * The request is asked for in dollars and the account credits it in its own
 * currency, so a payer reading a dollar figure beside a euro IBAN has to do the
 * conversion themselves — and a payer who rounds down underpays. The rounding
 * here is always UP, to the smallest unit the currency has, so what lands is
 * never short of what was asked.
 */

import { STABLE_COINS } from '@/constants/general.consts'

/**
 * Whether a request's asked amount is a US-dollar figure the payer conversion
 * can trust.
 *
 * The payer screen converts the request amount from dollars into the account's
 * currency. That is only right when the request is denominated in dollars. A
 * Peanut wallet request carries no token symbol and settles in USDC, so it is
 * dollars; a request denominated in a non-USD token is not, and its amount must
 * not be shown to a bank payer as though it were.
 */
export function isUsdPeggedRequest(tokenSymbol: string | null | undefined): boolean {
    if (!tokenSymbol) return true
    return STABLE_COINS.includes(tokenSymbol.toUpperCase())
}

/** how many decimals the currency is paid in; two where we cannot tell */
export function minorUnitDigits(currency: string): number {
    try {
        return (
            new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
        )
    } catch {
        return 2
    }
}

/**
 * The dollar amount converted and rounded up, or undefined when there is
 * nothing honest to show — no amount asked, or no rate yet. A USD account
 * converts nothing and passes the amount through.
 */
export function payerAmount(usdAmount: string | undefined, currency: string, rate: number): number | undefined {
    const asked = Number(usdAmount)
    if (!Number.isFinite(asked) || asked <= 0) return undefined

    const sameCurrency = currency.toUpperCase() === 'USD'
    if (!sameCurrency && !(rate > 0)) return undefined

    const factor = 10 ** minorUnitDigits(currency)
    // Binary floating point puts an exact 8.29 just above 829 minor units, and
    // a bare ceil would then charge the payer a cent they do not owe. Nine
    // decimals is far below any real rate's precision and far above the error.
    const units = Number((asked * (sameCurrency ? 1 : rate) * factor).toFixed(9))

    return Math.ceil(units) / factor
}
