'use client'

/**
 * hook for recording payments to the backend after transaction execution
 *
 * after a blockchain transaction is confirmed, this hook notifies our backend
 * so we can:
 * - mark the charge as paid
 * - update the recipient's balance/history
 * - track cross-chain payment sources
 *
 * @example
 * const { recordPayment } = usePaymentRecorder()
 * await recordPayment({ chargeId, chainId, txHash, tokenAddress, payerAddress })
 *
 * # Post-on-chain safety gate
 *
 * The hook also exposes `submittedTxHash` — set as the first action inside
 * `recordPayment`, and exposed so consumers can render a "processing" branch
 * instead of a Retry button after the on-chain leg has fired. Re-running the
 * parent flow after that point would call `sendMoney()` again and double-pay.
 * Triggering incident: Sentry PEANUT-UI-QH9 (Konrad, 2026-06-01, offramp).
 * The audit found the same on-chain-then-ack-at-10s shape in the four flows
 * that use this hook (`withdraw/crypto`, direct-send, semantic-request,
 * contribute-pot); this gate ports the #2147 fix to them.
 *
 * Callers that fire `sendMoney` but intentionally SKIP `recordPayment`
 * (e.g. same-chain Rain-collateral withdraw, reconciled via webhook) must
 * call `markSubmitted(hash)` themselves so the same UI gate fires.
 */

import { useState, useCallback } from 'react'
import { chargesApi } from '@/services/charges'
import { type PaymentCreationResponse } from '@/services/services.types'
import { type Address } from 'viem'

// params for recording a payment
export interface RecordPaymentParams {
    chargeId: string
    chainId: string
    txHash: string
    tokenAddress: Address
    payerAddress: Address
    // optional cross-chain source info
    sourceChainId?: string
    sourceTokenAddress?: string
    sourceTokenSymbol?: string
}

// return type for the hook
export interface UsePaymentRecorderReturn {
    payment: PaymentCreationResponse | null
    isRecording: boolean
    error: string | null
    recordPayment: (params: RecordPaymentParams) => Promise<PaymentCreationResponse>
    reset: () => void
    /**
     * The on-chain tx hash for the in-flight payment, set as soon as
     * `recordPayment` is invoked (or via `markSubmitted` for skip-record
     * paths). While set, consumers MUST render a post-on-chain "processing"
     * branch — never a Retry button that re-runs `sendMoney()`.
     */
    submittedTxHash: string | null
    /**
     * Manual gate for flows that fired `sendMoney` but won't call
     * `recordPayment` (e.g. same-chain Rain-collateral withdraw — webhook
     * reconciles instead). For the normal sendMoney → recordPayment path
     * the gate is set automatically inside `recordPayment`.
     */
    markSubmitted: (hash: string) => void
}

export const usePaymentRecorder = (): UsePaymentRecorderReturn => {
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null)

    const markSubmitted = useCallback((hash: string) => {
        setSubmittedTxHash(hash)
    }, [])

    // record payment to backend
    const recordPayment = useCallback(async (params: RecordPaymentParams): Promise<PaymentCreationResponse> => {
        // Gate the UI BEFORE the BE call so any timeout/error path renders
        // the "processing" branch instead of a Retry button. Re-running the
        // parent handler from this point would re-fire sendMoney() and
        // produce a second on-chain tx attributed to the same charge.
        setSubmittedTxHash(params.txHash)
        setIsRecording(true)
        setError(null)

        try {
            const paymentResponse = await chargesApi.createPayment({
                chargeId: params.chargeId,
                chainId: params.chainId,
                hash: params.txHash,
                tokenAddress: params.tokenAddress,
                payerAddress: params.payerAddress,
                sourceChainId: params.sourceChainId,
                sourceTokenAddress: params.sourceTokenAddress,
                sourceTokenSymbol: params.sourceTokenSymbol,
            })

            setPayment(paymentResponse)
            return paymentResponse
        } catch (err) {
            const message = err instanceof Error ? err.message : 'failed to record payment'
            setError(message)
            throw err
        } finally {
            setIsRecording(false)
        }
    }, [])

    // reset state — clears the post-on-chain gate as well, so a subsequent
    // fresh flow (e.g. user navigates back and starts a new payment) is not
    // stuck in the processing state.
    const reset = useCallback(() => {
        setPayment(null)
        setIsRecording(false)
        setError(null)
        setSubmittedTxHash(null)
    }, [])

    return {
        payment,
        isRecording,
        error,
        recordPayment,
        reset,
        submittedTxHash,
        markSubmitted,
    }
}
