'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react'

export type AddView = 'INITIAL' | 'SELECT_METHOD'

export interface InitialViewErrorState {
    showError: boolean
    errorMessage: string
}

interface AddFlowContextType {
    amountToAdd: string
    setAmountToAdd: (amount: string) => void
    currentView: AddView
    setCurrentView: (view: AddView) => void
    error: InitialViewErrorState
    setError: (error: InitialViewErrorState) => void
    fromBankSelected: boolean
    setFromBankSelected: (selected: boolean) => void
}

const AddFlowContext = createContext<AddFlowContextType | undefined>(undefined)

export const AddFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [amountToAdd, setAmountToAdd] = useState<string>('')
    const [currentView, setCurrentView] = useState<AddView>('INITIAL')
    const [error, setError] = useState<InitialViewErrorState>({
        showError: false,
        errorMessage: '',
    })
    const [fromBankSelected, setFromBankSelected] = useState<boolean>(false)

    const value = useMemo(
        () => ({
            amountToAdd,
            setAmountToAdd,
            currentView,
            setCurrentView,
            error,
            setError,
            fromBankSelected,
            setFromBankSelected,
        }),
        [amountToAdd, currentView, error, fromBankSelected]
    )

    return <AddFlowContext.Provider value={value}>{children}</AddFlowContext.Provider>
}

export const useAddFlow = (): AddFlowContextType => {
    const context = useContext(AddFlowContext)
    if (context === undefined) {
        throw new Error('useAddFlow must be used within an AddFlowContextProvider')
    }
    return context
}
