'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { QrPayment, QrPaymentLock } from '@/services/manteca'
import { useQrPayFlowController, type QrPayFlowSurface } from './useQrPayFlow'
import type { QrPayCurrency, QrPayScanParams } from './qr-pay-flow.types'

const QrPayFlowContext = createContext<QrPayFlowSurface | null>(null)

interface QrPayFlowProviderProps extends QrPayScanParams {
    children: ReactNode
}

export function QrPayFlowProvider({ qrCode, timestamp, qrType, pixKey, children }: QrPayFlowProviderProps) {
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessageRaw] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const setErrorMessage = useCallback((message: string | null, code: string | null = null) => {
        setErrorMessageRaw(message)
        setErrorCode(code)
    }, [])
    const [paymentLock, setPaymentLock] = useState<QrPaymentLock | null>(null)
    const [qrPayment, setQrPayment] = useState<QrPayment | null>(null)
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [currency, setCurrency] = useState<QrPayCurrency | undefined>(undefined)
    const [showOrderNotReadyModal, setShowOrderNotReadyModal] = useState(false)
    const [waitingForMerchantAmount, setWaitingForMerchantAmount] = useState(false)

    const surface = useQrPayFlowController(
        {
            isSuccess,
            setIsSuccess,
            errorMessage,
            errorCode,
            setErrorMessage,
            paymentLock,
            setPaymentLock,
            qrPayment,
            setQrPayment,
            amount,
            setAmount,
            currencyAmount,
            setCurrencyAmount,
            currency,
            setCurrency,
            showOrderNotReadyModal,
            setShowOrderNotReadyModal,
            waitingForMerchantAmount,
            setWaitingForMerchantAmount,
        },
        { qrCode, timestamp, qrType, pixKey }
    )

    return <QrPayFlowContext.Provider value={surface}>{children}</QrPayFlowContext.Provider>
}

/** The one hook views call. Effects run once (in the provider), so reading the
 * surface from any number of views is free. */
export function useQrPayFlow(): QrPayFlowSurface {
    const context = useContext(QrPayFlowContext)
    if (!context) {
        throw new Error('useQrPayFlow must be used within QrPayFlowProvider')
    }
    return context
}
