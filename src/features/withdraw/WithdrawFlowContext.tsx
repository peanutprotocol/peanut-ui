'use client'

import { type Account } from '@/interfaces/interfaces'
import { type TRequestChargeResponse, type PaymentCreationResponse } from '@/services/services.types'
import type { RecipientState } from '@/components/Global/GeneralRecipientInput/types'
import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import type { WithdrawData, WithdrawMethod } from './types'
import type { FlowErrorState } from '@/interfaces/interfaces'

/**
 * Withdraw flow memory that cannot live in the URL: the selected method and
 * account objects, provider responses (charge, payment), and transient
 * submission state. Mounted at the /withdraw layout — NOT app-global — so it
 * dies when the user leaves the flow. URL state (step, amount, showAll) lives
 * in nuqs params next to it; see TASK-21816.
 *
 * The old app-global mount was the root cause of the stale-method hijack class
 * (TASK-21203 / TASK-20806): abandoned withdraw state survived into the next
 * send/withdraw entry and every consumer compensated with hand-written resets.
 * Scoped here, a fresh entry IS the reset, and those compensations are gone.
 */
interface WithdrawFlowContextType {
    withdrawData: WithdrawData | null
    setWithdrawData: (data: WithdrawData | null) => void
    showCompatibilityModal: boolean
    setShowCompatibilityModal: (show: boolean) => void
    isPreparingReview: boolean
    setIsPreparingReview: (isPreparing: boolean) => void
    paymentError: string | null
    setPaymentError: (error: string | null) => void
    isValidRecipient: boolean
    setIsValidRecipient: (isValid: boolean) => void
    inputChanging: boolean
    setInputChanging: (isChanging: boolean) => void
    recipient: RecipientState
    setRecipient: (recipient: RecipientState) => void
    error: FlowErrorState
    setError: (error: FlowErrorState) => void
    selectedBankAccount: Account | null
    setSelectedBankAccount: (account: Account | null) => void
    selectedMethod: WithdrawMethod | null
    setSelectedMethod: (method: WithdrawMethod | null) => void
    chargeDetails: TRequestChargeResponse | null
    setChargeDetails: (charge: TRequestChargeResponse | null) => void
    transactionHash: string | null
    setTransactionHash: (hash: string | null) => void
    paymentDetails: PaymentCreationResponse | null
    setPaymentDetails: (payment: PaymentCreationResponse | null) => void
    resetWithdrawFlow: () => void
}

const WithdrawFlowContext = createContext<WithdrawFlowContextType | undefined>(undefined)

export const WithdrawFlowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [withdrawData, setWithdrawData] = useState<WithdrawData | null>(null)
    const [showCompatibilityModal, setShowCompatibilityModal] = useState<boolean>(false)
    const [isPreparingReview, setIsPreparingReview] = useState<boolean>(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [isValidRecipient, setIsValidRecipient] = useState<boolean>(false)
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [recipient, setRecipient] = useState<RecipientState>({ address: '', name: '' })
    const [error, setError] = useState<FlowErrorState>({ showError: false, errorMessage: '' })
    const [selectedBankAccount, setSelectedBankAccount] = useState<Account | null>(null)
    const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod | null>(null)
    const [chargeDetails, setChargeDetails] = useState<TRequestChargeResponse | null>(null)
    const [transactionHash, setTransactionHash] = useState<string | null>(null)
    const [paymentDetails, setPaymentDetails] = useState<PaymentCreationResponse | null>(null)

    const resetWithdrawFlow = useCallback(() => {
        // browser-back with the compatibility modal open leaves it armed for the
        // next /withdraw/crypto entry — reset must close it like everything else
        setShowCompatibilityModal(false)
        setWithdrawData(null)
        setSelectedBankAccount(null)
        setRecipient({ address: '', name: '' })
        setError({ showError: false, errorMessage: '' })
        setPaymentError(null)
        setSelectedMethod(null)
        setChargeDetails(null)
        setTransactionHash(null)
        setPaymentDetails(null)
    }, [])

    const value = useMemo(
        () => ({
            withdrawData,
            setWithdrawData,
            showCompatibilityModal,
            setShowCompatibilityModal,
            isPreparingReview,
            setIsPreparingReview,
            paymentError,
            setPaymentError,
            isValidRecipient,
            setIsValidRecipient,
            inputChanging,
            setInputChanging,
            recipient,
            setRecipient,
            error,
            setError,
            selectedBankAccount,
            setSelectedBankAccount,
            selectedMethod,
            setSelectedMethod,
            chargeDetails,
            setChargeDetails,
            transactionHash,
            setTransactionHash,
            paymentDetails,
            setPaymentDetails,
            resetWithdrawFlow,
        }),
        [
            withdrawData,
            showCompatibilityModal,
            isPreparingReview,
            paymentError,
            isValidRecipient,
            inputChanging,
            recipient,
            error,
            selectedBankAccount,
            selectedMethod,
            chargeDetails,
            transactionHash,
            paymentDetails,
            resetWithdrawFlow,
        ]
    )

    return <WithdrawFlowContext.Provider value={value}>{children}</WithdrawFlowContext.Provider>
}

export const useWithdrawFlow = (): WithdrawFlowContextType => {
    const context = useContext(WithdrawFlowContext)
    if (context === undefined) {
        throw new Error('useWithdrawFlow must be used within a WithdrawFlowProvider')
    }
    return context
}

/**
 * For components that serve the withdraw flow AND other flows (the dual-flow
 * AddWithdraw components render under /add-money too, where no provider is
 * mounted). Returns null outside the provider — callers must flow-guard their
 * writes.
 */
export const useOptionalWithdrawFlow = (): WithdrawFlowContextType | null => {
    return useContext(WithdrawFlowContext) ?? null
}
