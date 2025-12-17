'use client'

// hook for recording payments to the backend after transaction execution

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
}

export const usePaymentRecorder = (): UsePaymentRecorderReturn => {
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // record payment to backend
    const recordPayment = useCallback(async (params: RecordPaymentParams): Promise<PaymentCreationResponse> => {
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

    // reset state
    const reset = useCallback(() => {
        setPayment(null)
        setIsRecording(false)
        setError(null)
    }, [])

    return {
        payment,
        isRecording,
        error,
        recordPayment,
        reset,
    }
}
