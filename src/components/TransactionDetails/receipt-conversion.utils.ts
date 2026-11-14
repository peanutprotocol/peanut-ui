import type { TransactionDetails } from './transactionTransformer'
import { isFxBearingFlow } from './transaction-predicates'
import { formatCurrency, isStableCoin } from '@/utils/general.utils'
import { pixMarketRateShown } from '@/features/pix/pixMarketRate'

/**
 * A token symbol for a receipt or activity line: upper-cased when the record
 * stores it lower-case (older records say "eth"), otherwise kept as is, because
 * a mixed-case symbol is the token's real spelling (USDe).
 */
export function tokenSymbolForDisplay(symbol: string): string {
    return symbol === symbol.toLowerCase() ? symbol.toUpperCase() : symbol
}

/**
 * The other side of a receipt's conversion: local fiat ("EUR 21.33") first,
 * else a non-stable destination token ("0.000416666 ETH", full decimals so the
 * receipt stays auditable). USD-pegged stablecoins are no conversion. One rule
 * for the details card and the PDF.
 */
export function receiptConvertedAmount(
    transaction: Pick<TransactionDetails, 'currency' | 'tokenSymbol' | 'tokenAmount'>
): string | undefined {
    const code = transaction.currency?.code
    const amount = transaction.currency?.amount
    if (code && amount) {
        const upper = code.toUpperCase()
        if (upper !== 'USD' && !isStableCoin(upper)) return `${upper} ${formatCurrency(amount)}`
    }
    const tokenSymbol = transaction.tokenSymbol
    if (tokenSymbol && tokenSymbol.toUpperCase() !== 'USD' && !isStableCoin(tokenSymbol) && transaction.tokenAmount) {
        return `${transaction.tokenAmount} ${tokenSymbolForDisplay(tokenSymbol)}`
    }
    return undefined
}

/** "1 USD = EUR 0.8769" for a fiat-rail or card entry that carries a rate;
 *  undefined for USD / stablecoin legs and cancelled entries. Beside a
 *  provider fee row, the market rate (`receiptProviderFee`). */
export function receiptExchangeRate(transaction: TransactionDetails): string | undefined {
    const code = transaction.currency?.code?.toUpperCase()
    const rate = transaction.extraDataForDrawer?.receipt?.exchange_rate
    if (!code || code === 'USD' || isStableCoin(code)) return undefined
    if (!isFxBearingFlow(transaction) || transaction.status === 'cancelled') return undefined
    const market = receiptProviderFee(transaction)
    if (market) return market.rateLine
    if (!rate) return undefined
    return `1 USD = ${code} ${formatCurrency(rate, 4)}`
}

/**
 * A Bridge Pix entry's market rate and provider fee (`extraData.marketRate`,
 * `extraData.providerFee`, API-CONTRACT 8.3) as the receipt prints them: the
 * rate line ("1 USD = BRL 5.33") and the "Provider fee" row ("≈ BRL 0.78"),
 * marked ≈ as on the review: the API measures it against a market rate read
 * near, not at, the provider's conversion.
 * Only where the receipt shows the reais (a pending Bridge payout's are blank:
 * ruling 14 Nov), so the rows add up on screen, for a fee in those reais, and
 * never on an entry that converted nothing (a return, a failure). The rate is
 * restated to add up with the dollars, the fee and the reais shown
 * (`pixMarketRateShown`): taken off a payout, added to a deposit.
 */
export function receiptProviderFee(transaction: TransactionDetails): { rateLine: string; fee: string } | undefined {
    const drawer = transaction.extraDataForDrawer
    const fee = drawer?.providerFee
    const code = transaction.currency?.code?.toUpperCase()
    if (!drawer?.marketRate || !fee || !code || fee.currency !== code) return undefined
    if (['cancelled', 'failed', 'refunded'].includes(transaction.status ?? '') || drawer.wasReturned) return undefined
    const reais = Number(transaction.currency?.amount)
    const usd = Math.round(Math.abs(Number(transaction.amount)) * 100) / 100
    if (!transaction.currency?.amount || !(reais > 0) || !(usd > 0)) return undefined
    const direction = transaction.direction === 'bank_deposit' ? 'in' : 'out'
    const rate = pixMarketRateShown(usd, reais, Number(fee.amount), direction)
    return { rateLine: `1 USD = ${code} ${formatCurrency(rate, 6)}`, fee: `≈ ${code} ${formatCurrency(fee.amount)}` }
}

/**
 * Whether the conversion already happened: the entry settled, or it settled
 * and the money was sent back afterwards. Settled, the receipt states the
 * conversion; before that, it is an estimate.
 */
export function isSettledConversion(transaction: Pick<TransactionDetails, 'status' | 'extraDataForDrawer'>): boolean {
    return (
        transaction.status === 'completed' ||
        transaction.status === 'refunded' ||
        !!transaction.extraDataForDrawer?.wasReturned
    )
}

/**
 * A deposit sent back to the payer. The money went back as it came, so its
 * conversion line states the rate it was priced at, not a conversion that
 * happened: the row is the exchange rate, never "Converted" (Aleks, 2026-11-13).
 */
export function isReturnedDeposit(
    transaction: Pick<TransactionDetails, 'direction' | 'status' | 'extraDataForDrawer'>
): boolean {
    return (
        transaction.direction === 'bank_deposit' &&
        (transaction.status === 'refunded' || !!transaction.extraDataForDrawer?.wasReturned)
    )
}

/**
 * The settled conversion as one line, in the direction the money moved:
 * "EUR 21.33 → 24.32 USD" for money coming in, "24.32 USD → ARS 30,000"
 * for money going out. USD, like the rate line ("1 USD = EUR 0.8769") and
 * every other rate in the app.
 */
export function receiptConversionLine(
    transaction: Pick<TransactionDetails, 'currency' | 'tokenSymbol' | 'tokenAmount' | 'amount'>,
    sign: '-' | '+' | ''
): string | undefined {
    const converted = receiptConvertedAmount(transaction)
    if (!converted) return undefined
    const usd = Math.abs(Number(transaction.amount))
    const balanceSide = `${formatCurrency(Number.isFinite(usd) ? usd.toString() : '0')} USD`
    return sign === '+' ? `${converted} → ${balanceSide}` : `${balanceSide} → ${converted}`
}
