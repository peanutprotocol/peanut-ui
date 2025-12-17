'use client'

// context for send flow state management
// follows the same pattern as WithdrawFlowContext

import React, { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { type Address, type Hash } from 'viem'
import { type TRequestChargeResponse, type PaymentCreationResponse } from '@/services/services.types'

// view states
export type SendFlowView = 'INITIAL' | 'STATUS'

// recipient info
export interface SendRecipient {
    username: string
    address: Address
    userId?: string
    fullName?: string
}

// attachment options
export interface SendAttachment {
    message?: string
    file?: File
    fileUrl?: string
}

// error state for input view
export interface SendFlowErrorState {
    showError: boolean
    errorMessage: string
}

// context type
interface SendFlowContextType {
    // state
    amount: string
    setAmount: (amount: string) => void
    usdAmount: string
    setUsdAmount: (amount: string) => void
    currentView: SendFlowView
    setCurrentView: (view: SendFlowView) => void
    recipient: SendRecipient | null
    setRecipient: (recipient: SendRecipient | null) => void
    attachment: SendAttachment
    setAttachment: (attachment: SendAttachment) => void
    charge: TRequestChargeResponse | null
    setCharge: (charge: TRequestChargeResponse | null) => void
    payment: PaymentCreationResponse | null
    setPayment: (payment: PaymentCreationResponse | null) => void
    txHash: Hash | null
    setTxHash: (hash: Hash | null) => void
    error: SendFlowErrorState
    setError: (error: SendFlowErrorState) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    isSuccess: boolean
    setIsSuccess: (success: boolean) => void

    // actions
    resetSendFlow: () => void
}

const SendFlowContext = createContext<SendFlowContextType | undefined>(undefined)

interface SendFlowProviderProps {
    children: ReactNode
    initialRecipient?: SendRecipient
}

export const SendFlowProvider: React.FC<SendFlowProviderProps> = ({ children, initialRecipient }) => {
    const [amount, setAmount] = useState<string>('')
    const [usdAmount, setUsdAmount] = useState<string>('')
    const [currentView, setCurrentView] = useState<SendFlowView>('INITIAL')
    const [recipient, setRecipient] = useState<SendRecipient | null>(initialRecipient ?? null)
    const [attachment, setAttachment] = useState<SendAttachment>({})
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [txHash, setTxHash] = useState<Hash | null>(null)
    const [error, setError] = useState<SendFlowErrorState>({ showError: false, errorMessage: '' })
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [isSuccess, setIsSuccess] = useState<boolean>(false)

    const resetSendFlow = useCallback(() => {
        setAmount('')
        setUsdAmount('')
        setCurrentView('INITIAL')
        setAttachment({})
        setCharge(null)
        setPayment(null)
        setTxHash(null)
        setError({ showError: false, errorMessage: '' })
        setIsLoading(false)
        setIsSuccess(false)
    }, [])

    const value = useMemo(
        () => ({
            amount,
            setAmount,
            usdAmount,
            setUsdAmount,
            currentView,
            setCurrentView,
            recipient,
            setRecipient,
            attachment,
            setAttachment,
            charge,
            setCharge,
            payment,
            setPayment,
            txHash,
            setTxHash,
            error,
            setError,
            isLoading,
            setIsLoading,
            isSuccess,
            setIsSuccess,
            resetSendFlow,
        }),
        [
            amount,
            usdAmount,
            currentView,
            recipient,
            attachment,
            charge,
            payment,
            txHash,
            error,
            isLoading,
            isSuccess,
            resetSendFlow,
        ]
    )

    return <SendFlowContext.Provider value={value}>{children}</SendFlowContext.Provider>
}

export const useSendFlowContext = (): SendFlowContextType => {
    const context = useContext(SendFlowContext)
    if (context === undefined) {
        throw new Error('useSendFlowContext must be used within SendFlowProvider')
    }
    return context
}
