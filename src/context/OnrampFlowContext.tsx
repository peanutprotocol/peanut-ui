'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'

export type OnrampView = 'INITIAL' | 'SELECT_METHOD'

export interface InitialViewErrorState {
    showError: boolean
    errorMessage: string
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
    resetFlow: () => void
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

    const resetFlow = useCallback(() => {
        setAmountToOnramp('')
        setCurrentView('INITIAL')
        setError({
            showError: false,
            errorMessage: '',
        })
        setFromBankSelected(false)
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
            resetFlow,
        }),
        [amountToOnramp, currentView, error, fromBankSelected, resetFlow]
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
