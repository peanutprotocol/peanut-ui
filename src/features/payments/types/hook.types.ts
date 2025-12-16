// hook return types for payment flows
// separated from main types to follow export rules

import {
    type ChargeDetails,
    type CreateChargeParams,
    type CrossChainRoute,
    type PaymentRecord,
    type RecordPaymentParams,
} from './payment.types'

// return type for useChargeManager hook
export interface UseChargeManagerReturn {
    charge: ChargeDetails | null
    isCreating: boolean
    isFetching: boolean
    error: string | null
    createCharge: (params: CreateChargeParams) => Promise<ChargeDetails>
    fetchCharge: (chargeId: string) => Promise<ChargeDetails>
    reset: () => void
}

// return type for useRouteCalculation hook
export interface UseRouteCalculationReturn {
    route: CrossChainRoute | null
    isCalculating: boolean
    error: string | null
    estimatedGas: number | undefined
    isXChain: boolean
    refresh: () => Promise<void>
}

// return type for usePaymentRecorder hook
export interface UsePaymentRecorderReturn {
    record: (params: RecordPaymentParams) => Promise<PaymentRecord>
    isRecording: boolean
    error: string | null
}
