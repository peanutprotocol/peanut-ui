'use client'

import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'

export type OnrampView = 'INITIAL' | 'SELECT_METHOD'

export interface InitialViewErrorState {
    showError: boolean
    errorMessage: string
}

export interface IOnrampData {
    transferId?: string
    depositInstructions?: {
        amount?: string
        currency?: string
        depositMessage?: string
        bankName?: string
        bankAddress?: string
        bankRoutingNumber?: string
        bankAccountNumber?: string
        bankBeneficiaryName?: string
        bankBeneficiaryAddress?: string
        iban?: string
        bic?: string
    }
}

interface OnrampFlowContextType {
    amountToOnramp: string
    setAmountToOnramp: (amount: string) => void
    currentView: OnrampView
    setCurrentView: (view: OnrampView) => void
    error: InitialViewErrorState
    setError: (error: InitialViewErrorState) => void
    fromBankSelected: boolean
    setFromBankSelected: (selected: boolean) => void
    onrampData: IOnrampData | null
    setOnrampData: (data: IOnrampData | null) => void
    resetOnrampFlow: () => void
}

const OnrampFlowContext = createContext<OnrampFlowContextType | undefined>(undefined)

export const OnrampFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [amountToOnramp, setAmountToOnramp] = useState<string>('')
    const [currentView, setCurrentView] = useState<OnrampView>('INITIAL')
    const [error, setError] = useState<InitialViewErrorState>({
        showError: false,
        errorMessage: '',
    })
    const [fromBankSelected, setFromBankSelected] = useState<boolean>(false)
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)

    const resetOnrampFlow = useCallback(() => {
        setAmountToOnramp('')
        setCurrentView('INITIAL')
        setError({
            showError: false,
            errorMessage: '',
        })
        setFromBankSelected(false)
        setOnrampData(null)
    }, [])

    const value = useMemo(
        () => ({
            amountToOnramp,
            setAmountToOnramp,
            currentView,
            setCurrentView,
            error,
            setError,
            fromBankSelected,
            setFromBankSelected,
            onrampData,
            setOnrampData,
            resetOnrampFlow,
        }),
        [amountToOnramp, currentView, error, fromBankSelected, onrampData, resetOnrampFlow]
    )

    return <OnrampFlowContext.Provider value={value}>{children}</OnrampFlowContext.Provider>
}

export const useOnrampFlow = (): OnrampFlowContextType => {
    const context = useContext(OnrampFlowContext)
    if (context === undefined) {
        throw new Error('useOnrampFlow must be used within an OnrampFlowContextProvider')
    }
    return context
}
