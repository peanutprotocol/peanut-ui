'use client'

import { type ITokenPriceData, type Account } from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'

export interface WithdrawMethod {
    type: 'bridge' | 'manteca' | 'crypto'
    countryPath?: string
    currency?: string
    minimumAmount?: number
    savedAccount?: Account
    title?: string
}

export type WithdrawView = 'INITIAL' | 'CONFIRM' | 'STATUS'

export interface WithdrawData {
    token: ITokenPriceData
    chain: peanutInterfaces.ISquidChain & { networkName: string; tokens: peanutInterfaces.ISquidToken[] }
    address: string
    amount: string
}

export interface InitialViewErrorState {
    showError: boolean
    errorMessage: string
}

export interface RecipientState {
    name: string | undefined
    address: string
}

interface WithdrawFlowContextType {
    amountToWithdraw: string
    setAmountToWithdraw: (amount: string) => void
    usdAmount: string
    setUsdAmount: (amount: string) => void
    currentView: WithdrawView
    setCurrentView: (view: WithdrawView) => void
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
    error: InitialViewErrorState
    setError: (error: InitialViewErrorState) => void
    selectedBankAccount: Account | null
    setSelectedBankAccount: (account: Account | null) => void
    showAllWithdrawMethods: boolean
    setShowAllWithdrawMethods: (show: boolean) => void
    selectedMethod: WithdrawMethod | null
    setSelectedMethod: (method: WithdrawMethod | null) => void
    resetWithdrawFlow: () => void
}

const WithdrawFlowContext = createContext<WithdrawFlowContextType | undefined>(undefined)

export const WithdrawFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [amountToWithdraw, setAmountToWithdraw] = useState<string>('')
    const [usdAmount, setUsdAmount] = useState<string>('')
    const [currentView, setCurrentView] = useState<WithdrawView>('INITIAL')
    const [withdrawData, setWithdrawData] = useState<WithdrawData | null>(null)
    const [showCompatibilityModal, setShowCompatibilityModal] = useState<boolean>(false)
    const [isPreparingReview, setIsPreparingReview] = useState<boolean>(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)

    const [isValidRecipient, setIsValidRecipient] = useState<boolean>(false)
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [recipient, setRecipient] = useState<RecipientState>({ address: '', name: '' })
    const [error, setError] = useState<InitialViewErrorState>({
        showError: false,
        errorMessage: '',
    })
    const [selectedBankAccount, setSelectedBankAccount] = useState<Account | null>(null)
    const [showAllWithdrawMethods, setShowAllWithdrawMethods] = useState<boolean>(false)
    const [selectedMethod, setSelectedMethod] = useState<WithdrawMethod | null>(null)

    const resetWithdrawFlow = useCallback(() => {
        setAmountToWithdraw('')
        setCurrentView('INITIAL')
        setWithdrawData(null)
        setSelectedBankAccount(null)
        setRecipient({ address: '', name: '' })
        setError({ showError: false, errorMessage: '' })
        setPaymentError(null)
        setShowAllWithdrawMethods(false)
        setUsdAmount('')
        setSelectedMethod(null)
    }, [])

    const value = useMemo(
        () => ({
            amountToWithdraw,
            setAmountToWithdraw,
            usdAmount,
            setUsdAmount,
            currentView,
            setCurrentView,
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
            showAllWithdrawMethods,
            setShowAllWithdrawMethods,
            selectedMethod,
            setSelectedMethod,
            resetWithdrawFlow,
        }),
        [
            amountToWithdraw,
            currentView,
            withdrawData,
            showCompatibilityModal,
            isPreparingReview,
            paymentError,
            usdAmount,
            isValidRecipient,
            inputChanging,
            recipient,
            error,
            selectedBankAccount,
            showAllWithdrawMethods,
            selectedMethod,
            setShowAllWithdrawMethods,
            resetWithdrawFlow,
        ]
    )

    return <WithdrawFlowContext.Provider value={value}>{children}</WithdrawFlowContext.Provider>
}

export const useWithdrawFlow = (): WithdrawFlowContextType => {
    const context = useContext(WithdrawFlowContext)
    if (context === undefined) {
        throw new Error('useWithdrawFlow must be used within a WithdrawFlowContextProvider')
    }
    return context
}
