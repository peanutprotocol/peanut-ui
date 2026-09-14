import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { formatAmount, formatCurrency, isStableCoin } from '@/utils/general.utils'

// Split out of page.tsx (which imports `next/server`'s `connection` and
// therefore can't be imported from a jsdom/node Jest test — see PR #3017)
// so these pure formatting helpers stay unit-testable.

/** Generates the receipt page's <title> / link-preview text from a transaction. */
export function generateReceiptTitle(transaction: TransactionDetails): string {
    const { direction, amount, userName, status, currency, tokenSymbol } = transaction

    // Format amount - use currency if available, otherwise tokenSymbol.
    // Treat USDC/USDT as USD (1:1 peg) — `USDC 0.10` reads identically to
    // `$0.10` and just clutters the title.
    let formattedAmount: string
    // A pending Bridge OFFRAMP ships `currency.amount` blanked (see
    // completeHistoryEntry's OFFRAMP branch in history.utils.ts) rather than
    // the unconverted crypto-leg figure mislabeled as fiat — require it to
    // actually parse before using it, so a still-pending row falls through
    // to the token/USD branch instead of the title reading "ARS 0".
    const hasValidCurrencyAmount = !!currency?.amount && Number.isFinite(Number(currency.amount))
    if (currency && currency.code !== 'USD' && !isStableCoin(currency.code) && hasValidCurrencyAmount) {
        formattedAmount = `${currency.code} ${formatAmount(currency.amount)}`
    } else if (tokenSymbol && !isStableCoin(tokenSymbol)) {
        formattedAmount = `${formatAmount(Number(amount))} ${tokenSymbol}`
    } else {
        formattedAmount = `$${formatCurrency(Number(amount).toString())}`
    }

    // Handle different transaction directions and statuses
    if (status === 'failed') {
        return 'Receipt - Failed transaction'
    }

    if (status === 'cancelled') {
        return 'Receipt - Cancelled transaction'
    }

    switch (direction) {
        case 'send':
            return `Receipt - You sent ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        case 'receive':
            return `Receipt - You received ${formattedAmount}${userName ? ` from ${userName}` : ''}`
        case 'withdraw':
        case 'bank_withdraw':
            return `Receipt - Withdrawal of ${formattedAmount}`
        case 'bank_deposit':
        case 'add':
            return `Receipt - Deposit of ${formattedAmount}`
        case 'request_sent':
            return `Receipt - Request for ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        case 'request_received':
            return `Receipt - Request for ${formattedAmount}${userName ? ` from ${userName}` : ''}`
        case 'bank_request_fulfillment':
            return `Receipt - Bank payment of ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        case 'bank_claim':
        case 'claim_external':
            return `Receipt - Claim of ${formattedAmount}`
        case 'qr_payment':
            return `Receipt - Payment of ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        default:
            return `Receipt - Transaction of ${formattedAmount}`
    }
}

/** Generates the receipt page's meta-description text from a transaction's status. */
export function generateReceiptDescription(status: string): string {
    switch (status) {
        case 'completed':
            return 'Transaction completed via Peanut'
        case 'pending':
            return 'Transaction pending'
        case 'processing':
            return 'Transaction processing'
        case 'failed':
            return 'Transaction failed'
        case 'cancelled':
            return 'Transaction cancelled'
        default:
            return 'View transaction receipt'
    }
}
