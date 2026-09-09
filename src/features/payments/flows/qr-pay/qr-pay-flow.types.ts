import type { QrPayment, QrPaymentLock } from '@/services/manteca'

/** The scan this flow instance is for. A new scan remounts the whole provider
 * (the entry page keys it on qrCode+timestamp), so no reset function exists. */
export interface QrPayScanParams {
    qrCode: string
    timestamp: string | null
    qrType: string | null
}

export interface QrPayCurrency {
    code: string
    symbol: string
    price: number
}

/** The flow's raw state, owned by `QrPayFlowProvider`. Behavior lives in
 * `useQrPayFlowController`. */
export interface QrPayFlowBag {
    isSuccess: boolean
    setIsSuccess: (value: boolean) => void
    errorMessage: string | null
    errorCode: string | null
    /** Companion code for `errorMessage` so retry-vs-block logic compares a stable
     * identifier, never the localized string. Every set clears it unless a code
     * is passed explicitly. */
    setErrorMessage: (message: string | null, code?: string | null) => void
    paymentLock: QrPaymentLock | null
    setPaymentLock: (lock: QrPaymentLock | null) => void
    qrPayment: QrPayment | null
    setQrPayment: (payment: QrPayment | null) => void
    amount: string | undefined
    setAmount: (value: string | undefined) => void
    currencyAmount: string | undefined
    setCurrencyAmount: (value: string | undefined) => void
    currency: QrPayCurrency | undefined
    setCurrency: (value: QrPayCurrency | undefined) => void
    showOrderNotReadyModal: boolean
    setShowOrderNotReadyModal: (value: boolean) => void
    waitingForMerchantAmount: boolean
    setWaitingForMerchantAmount: (value: boolean) => void
}
