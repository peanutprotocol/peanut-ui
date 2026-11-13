'use client'

import { useCallback, useEffect, useRef } from 'react'
import { type TRequestChargeResponse } from '@/services/services.types'
import { readChargeUntilFinal } from '../utils/charge-receipt.utils'

type RecoveryOptions = {
    fetchCharge: (id: string) => Promise<TRequestChargeResponse>
    setCharge: (charge: TRequestChargeResponse) => void
    setIsSuccess?: (success: boolean) => void
    setIsPaymentStatusUnknown?: (unknown: boolean) => void
    setCurrentView: (view: 'INITIAL' | 'STATUS') => void
    setError: (error: { showError: boolean; errorMessage: string }) => void
    failureMessage: string
}

export function usePaymentStatusRecovery({
    fetchCharge,
    setCharge,
    setIsSuccess,
    setIsPaymentStatusUnknown,
    setCurrentView,
    setError,
    failureMessage,
}: RecoveryOptions) {
    const hasLeftScreen = useRef(false)
    useEffect(() => {
        hasLeftScreen.current = false
        return () => {
            hasLeftScreen.current = true
        }
    }, [])

    return useCallback(
        async (chargeId: string) => {
            setIsSuccess?.(false)
            setIsPaymentStatusUnknown?.(true)
            const { charge, outcome } = await readChargeUntilFinal(() => fetchCharge(chargeId), {
                isCancelled: () => hasLeftScreen.current,
            })
            if (outcome === 'cancelled') return outcome
            if (charge) setCharge(charge)
            if (outcome === 'failed') {
                setIsPaymentStatusUnknown?.(false)
                setError({ showError: true, errorMessage: failureMessage })
                setCurrentView('INITIAL')
            } else {
                setIsPaymentStatusUnknown?.(outcome !== 'completed')
                setIsSuccess?.(outcome === 'completed')
                setCurrentView('STATUS')
            }
            return outcome
        },
        [fetchCharge, setCharge, setIsSuccess, setIsPaymentStatusUnknown, setCurrentView, setError, failureMessage]
    )
}
