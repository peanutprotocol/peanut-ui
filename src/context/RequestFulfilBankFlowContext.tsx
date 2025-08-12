'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'

export type ExternalWalletFulfilMethod = 'exchange' | 'wallet'

interface RequestFulfilmentFlowContextType {
    resetFlow: () => void
    showExternalWalletFulfilMethods: boolean
    setShowExternalWalletFulfilMethods: (showExternalWalletFulfilMethods: boolean) => void
    externalWalletFulfilMethod: ExternalWalletFulfilMethod | null
    setExternalWalletFulfilMethod: (externalWalletFulfilMethod: ExternalWalletFulfilMethod | null) => void
}

const RequestFulfilmentFlowContext = createContext<RequestFulfilmentFlowContextType | undefined>(undefined)

export const RequestFulfilmentFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [externalWalletFulfilMethod, setExternalWalletFulfilMethod] = useState<ExternalWalletFulfilMethod | null>(
        null
    )
    const [showExternalWalletFulfilMethods, setShowExternalWalletFulfilMethods] = useState(false)

    const resetFlow = useCallback(() => {
        setExternalWalletFulfilMethod(null)
        setShowExternalWalletFulfilMethods(false)
    }, [externalWalletFulfilMethod])

    const value = useMemo(
        () => ({
            resetFlow,
            externalWalletFulfilMethod,
            setExternalWalletFulfilMethod,
            showExternalWalletFulfilMethods,
            setShowExternalWalletFulfilMethods,
        }),
        [externalWalletFulfilMethod, resetFlow, showExternalWalletFulfilMethods, setShowExternalWalletFulfilMethods]
    )

    return (
        <RequestFulfilmentFlowContext.Provider value={value as RequestFulfilmentFlowContextType}>
            {children}
        </RequestFulfilmentFlowContext.Provider>
    )
}

export const useRequestFulfilmentFlow = (): RequestFulfilmentFlowContextType => {
    const context = useContext(RequestFulfilmentFlowContext)
    if (context === undefined) {
        throw new Error('useRequestFulfilmentFlow must be used within a RequestFulfilmentFlowContextProvider')
    }
    return context
}
