import { type NetworkFeeDetails } from '@/components/TransactionDetails/transaction-types'
import { formatNetworkFee } from '@/utils/cross-chain-fee.utils'
import { type HistoryEntryExtraData } from '@/utils/history.utils'

/**
 * The network-fee rows of a crypto withdrawal's receipt, from the three
 * numbers the API states. Nothing is derived here: the fee and the delivered
 * amount are the backend's own figures.
 *
 * - `pending` → the fee row reads the quote as an estimate (`quotedFeeUsd`,
 *   what the confirm screen showed), or Pending when there is none.
 * - `settled` with a zero fee → Sponsored by Peanut!
 * - `settled` with a fee → the fee, plus what the recipient received.
 * - `unknown`, or no status (an API before the field) → no fee rows. The
 *   ledger booked nothing it can stand behind, so the receipt claims nothing.
 */
export function networkFeeDetailsForEntry(extraData: HistoryEntryExtraData | undefined): {
    networkFeeDetails?: NetworkFeeDetails
    recipientReceivesUsd?: number
} {
    if (extraData?.networkFeeStatus === 'pending')
        return { networkFeeDetails: pendingNetworkFee(extraData.quotedFeeUsd) }
    if (extraData?.networkFeeStatus !== 'settled') return {}

    const feeUsd = extraData.networkFeeUsd
    if (typeof feeUsd !== 'number' || !Number.isFinite(feeUsd) || feeUsd < 0) return {}
    if (feeUsd === 0) return { networkFeeDetails: { state: 'sponsored' } }

    const deliveredUsd = Number(extraData.deliveredUsd)
    return {
        networkFeeDetails: { state: 'charged', amountDisplay: formatNetworkFee(feeUsd, true)! },
        recipientReceivesUsd: extraData.deliveredUsd && Number.isFinite(deliveredUsd) ? deliveredUsd : undefined,
    }
}

/**
 * The fee row while the fee is not settled: the quote as an estimate when
 * there is one. A zero or missing quote is a plain Pending, never "≈ $0".
 */
export function pendingNetworkFee(quotedFeeUsd: number | null | undefined): NetworkFeeDetails {
    const estimate = formatNetworkFee(quotedFeeUsd ?? undefined, true)
    return estimate ? { state: 'pending', amountDisplay: estimate } : { state: 'pending' }
}
