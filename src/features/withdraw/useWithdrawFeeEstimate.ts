'use client'

import { useEffect, useState } from 'react'
import { isFeeFreeRoute } from '@/components/Global/TokenSelector/TokenSelector.utils'
import { previewWithdrawFee } from '@/features/payments/shared/hooks/useCrossChainTransfer'
import { useDebounce } from '@/hooks/useDebounce'

/** what the crypto withdraw amount screen shows under the field (TASK-23392) */
export type WithdrawFeeEstimate =
    | { status: 'idle' } // no amount typed
    | { status: 'free' }
    | { status: 'loading' }
    | { status: 'ready'; feeUsd: number; receiveAmount: string }
    | { status: 'failed' }

// typing settles before a quote is asked for: each authenticated quote costs a
// provider credit and the API allows 30 a minute per user
export const FEE_ESTIMATE_DEBOUNCE_MS = 600

const hasAmount = (value: string) => Number.isFinite(Number(value)) && Number(value) > 0

interface WithdrawFeeEstimateParams {
    /** USD the withdrawal moves (USDC is 1:1) */
    amountUsd: string
    sourceChainId: string
    destinationChainId: string
    tokenAddress: string
    tokenSymbol: string
    recipient: string
    /** the user's wallet; no quote until it is known */
    depositor?: string
}

/**
 * Debounced, quote-only fee estimate. A free route (`isFeeFreeRoute`) needs no
 * quote. Only the quote for the CURRENT inputs is ever shown: a response for
 * an older amount is dropped, and until the current one answers the state is
 * `loading` — an unknown fee is never shown as zero.
 */
export function useWithdrawFeeEstimate({
    amountUsd,
    sourceChainId,
    destinationChainId,
    tokenAddress,
    tokenSymbol,
    recipient,
    depositor,
}: WithdrawFeeEstimateParams): WithdrawFeeEstimate {
    const debouncedAmount = useDebounce(amountUsd, FEE_ESTIMATE_DEBOUNCE_MS)
    const isFree = isFeeFreeRoute(destinationChainId, tokenAddress)
    const key = [debouncedAmount, destinationChainId, tokenSymbol, recipient, depositor].join('|')
    const [result, setResult] = useState<{ key: string; estimate: WithdrawFeeEstimate } | null>(null)

    useEffect(() => {
        if (isFree || !depositor || !hasAmount(debouncedAmount)) return
        let stale = false
        previewWithdrawFee({
            sourceChainId,
            destinationChainId,
            tokenSymbol,
            amountUsd: debouncedAmount,
            depositor,
            recipient,
        })
            .then(({ feeUsd, receiveAmount }) => {
                if (stale) return
                // a malformed quote is an unknown fee, not a number to show
                const valid = Number.isFinite(feeUsd) && feeUsd >= 0 && Number.isFinite(Number(receiveAmount))
                setResult({ key, estimate: valid ? { status: 'ready', feeUsd, receiveAmount } : { status: 'failed' } })
            })
            .catch(() => {
                if (!stale) setResult({ key, estimate: { status: 'failed' } })
            })
        return () => {
            stale = true
        }
    }, [key, isFree, depositor, debouncedAmount, sourceChainId, destinationChainId, tokenSymbol, recipient])

    if (!hasAmount(amountUsd)) return { status: 'idle' }
    if (isFree) return { status: 'free' }
    if (debouncedAmount !== amountUsd || result?.key !== key) return { status: 'loading' }
    return result.estimate
}
