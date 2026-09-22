import type { TransactionDetails } from './transactionTransformer'
import { isFxBearingFlow } from './transaction-predicates'
import { formatCurrency, isStableCoin } from '@/utils/general.utils'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/wallet-token.consts'

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
    const tokenSymbol = transaction.tokenSymbol?.toUpperCase()
    if (tokenSymbol && tokenSymbol !== 'USD' && !isStableCoin(tokenSymbol) && transaction.tokenAmount) {
        return `${transaction.tokenAmount} ${tokenSymbol}`
    }
    return undefined
}

/** "1 USD = EUR 0.8769" for a fiat-rail or card entry that carries a rate;
 *  undefined for USD / stablecoin legs and cancelled entries. */
export function receiptExchangeRate(transaction: TransactionDetails): string | undefined {
    const code = transaction.currency?.code?.toUpperCase()
    const rate = transaction.extraDataForDrawer?.receipt?.exchange_rate
    if (!rate || !code || code === 'USD' || isStableCoin(code)) return undefined
    if (!isFxBearingFlow(transaction) || transaction.status === 'cancelled') return undefined
    return `1 USD = ${code} ${formatCurrency(rate, 4)}`
}

/**
 * The settled conversion as one line, in the direction the money moved:
 * "EUR 21.33 → 24.32 USDC" for money coming in, "24.32 USDC → ARS 30,000"
 * for money going out.
 */
export function receiptConversionLine(
    transaction: Pick<TransactionDetails, 'currency' | 'tokenSymbol' | 'tokenAmount' | 'amount'>,
    sign: '-' | '+' | ''
): string | undefined {
    const converted = receiptConvertedAmount(transaction)
    if (!converted) return undefined
    const usd = Math.abs(Number(transaction.amount))
    const balanceSide = `${formatCurrency(Number.isFinite(usd) ? usd.toString() : '0')} ${PEANUT_WALLET_TOKEN_SYMBOL}`
    return sign === '+' ? `${converted} → ${balanceSide}` : `${balanceSide} → ${converted}`
}
