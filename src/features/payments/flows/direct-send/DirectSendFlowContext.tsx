'use client'

/**
 * context for send flow state management
 *
 * direct send flow for paying another peanut user by username.
 * payments are always usdc on arbitrum (peanut wallet).
 *
 * route: /send/username
 *
 */

import React, { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { type Address, type Hash } from 'viem'
import { type TRequestChargeResponse, type PaymentCreationResponse } from '@/services/services.types'

// view states
export type DirectSendFlowView = 'INITIAL' | 'STATUS'

// recipient info
export interface DirectSendRecipient {
    username: string
    address: Address
    userId?: string
    fullName?: string
}

// attachment options
export interface DirectSendAttachment {
    message?: string
    file?: File
    fileUrl?: string
}

// error state for input view
export interface DirectSendFlowErrorState {
    showError: boolean
    errorMessage: string
}

// context type
interface DirectSendFlowContextType {
    // state
    amount: string
    setAmount: (amount: string) => void
    usdAmount: string
    setUsdAmount: (amount: string) => void
    currentView: DirectSendFlowView
    setCurrentView: (view: DirectSendFlowView) => void
    recipient: DirectSendRecipient | null
    setRecipient: (recipient: DirectSendRecipient | null) => void
    attachment: DirectSendAttachment
    setAttachment: (attachment: DirectSendAttachment) => void
    charge: TRequestChargeResponse | null
    setCharge: (charge: TRequestChargeResponse | null) => void
    payment: PaymentCreationResponse | null
    setPayment: (payment: PaymentCreationResponse | null) => void
    txHash: Hash | null
    setTxHash: (hash: Hash | null) => void
    error: DirectSendFlowErrorState
    setError: (error: DirectSendFlowErrorState) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    isSuccess: boolean
    setIsSuccess: (success: boolean) => void

    // actions
    resetSendFlow: () => void
}

const DirectSendFlowContext = createContext<DirectSendFlowContextType | undefined>(undefined)

interface SendFlowProviderProps {
    children: ReactNode
    initialRecipient?: DirectSendRecipient
}

export const DirectSendFlowProvider: React.FC<SendFlowProviderProps> = ({ children, initialRecipient }) => {
    const [amount, setAmount] = useState<string>('')
    const [usdAmount, setUsdAmount] = useState<string>('')
    const [currentView, setCurrentView] = useState<DirectSendFlowView>('INITIAL')
    const [recipient, setRecipient] = useState<DirectSendRecipient | null>(initialRecipient ?? null)
    const [attachment, setAttachment] = useState<DirectSendAttachment>({})
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [txHash, setTxHash] = useState<Hash | null>(null)
    const [error, setError] = useState<DirectSendFlowErrorState>({ showError: false, errorMessage: '' })
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

    return <DirectSendFlowContext.Provider value={value}>{children}</DirectSendFlowContext.Provider>
}

export const useDirectSendFlowContext = (): DirectSendFlowContextType => {
    const context = useContext(DirectSendFlowContext)
    if (context === undefined) {
        throw new Error('useDirectSendFlowContext must be used within DirectSendFlowProvider')
    }
    return context
}
