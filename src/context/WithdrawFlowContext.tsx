'use client'

import { ITokenPriceData } from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import React, { createContext, ReactNode, useContext, useState } from 'react'

export type WithdrawView = 'INITIAL' | 'CONFIRM' | 'STATUS'

export interface WithdrawData {
    token: ITokenPriceData
    chain: peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }
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
    initialViewError: InitialViewErrorState
    setInitialViewError: (error: InitialViewErrorState) => void
}

const WithdrawFlowContext = createContext<WithdrawFlowContextType | undefined>(undefined)

export const WithdrawFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [amountToWithdraw, setAmountToWithdraw] = useState<string>('')
    const [currentView, setCurrentView] = useState<WithdrawView>('INITIAL')
    const [withdrawData, setWithdrawData] = useState<WithdrawData | null>(null)
    const [showCompatibilityModal, setShowCompatibilityModal] = useState<boolean>(false)
    const [isPreparingReview, setIsPreparingReview] = useState<boolean>(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)

    const [isValidRecipient, setIsValidRecipient] = useState<boolean>(false)
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [recipient, setRecipient] = useState<RecipientState>({ address: '', name: '' })
    const [initialViewError, setInitialViewError] = useState<InitialViewErrorState>({
        showError: false,
        errorMessage: '',
    })

    return (
        <WithdrawFlowContext.Provider
            value={{
                amountToWithdraw,
                setAmountToWithdraw,
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
                initialViewError,
                setInitialViewError,
            }}
        >
            {children}
        </WithdrawFlowContext.Provider>
    )
}

export const useWithdrawFlow = (): WithdrawFlowContextType => {
    const context = useContext(WithdrawFlowContext)
    if (context === undefined) {
        throw new Error('useWithdrawFlow must be used within a WithdrawFlowContextProvider')
    }
    return context
}
