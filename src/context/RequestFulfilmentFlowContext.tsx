'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { CountryData } from '@/components/AddMoney/consts'
import { IOnrampData } from './OnrampFlowContext'

export type ExternalWalletFulfilMethod = 'exchange' | 'wallet'

export enum RequestFulfilmentBankFlowStep {
    BankCountryList = 'bank-country-list',
    DepositBankDetails = 'deposit-bank-details',
    OnrampConfirmation = 'onramp-confirmation',
}

interface RequestFulfilmentFlowContextType {
    resetFlow: () => void
    showExternalWalletFulfilMethods: boolean
    setShowExternalWalletFulfilMethods: (showExternalWalletFulfilMethods: boolean) => void
    showRequestFulfilmentBankFlowManager: boolean
    setShowRequestFulfilmentBankFlowManager: (showRequestFulfilmentBankFlowManager: boolean) => void
    externalWalletFulfilMethod: ExternalWalletFulfilMethod | null
    setExternalWalletFulfilMethod: (externalWalletFulfilMethod: ExternalWalletFulfilMethod | null) => void
    flowStep: RequestFulfilmentBankFlowStep | null
    setFlowStep: (step: RequestFulfilmentBankFlowStep | null) => void
    selectedCountry: CountryData | null
    setSelectedCountry: (country: CountryData | null) => void
    onrampData: IOnrampData | null
    setOnrampData: (data: IOnrampData | null) => void
}

const RequestFulfilmentFlowContext = createContext<RequestFulfilmentFlowContextType | undefined>(undefined)

export const RequestFulfilmentFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showExternalWalletFulfilMethods, setShowExternalWalletFulfilMethods] = useState(false)
    const [externalWalletFulfilMethod, setExternalWalletFulfilMethod] = useState<ExternalWalletFulfilMethod | null>(
        null
    )
    const [showRequestFulfilmentBankFlowManager, setShowRequestFulfilmentBankFlowManager] = useState(false)
    const [flowStep, setFlowStep] = useState<RequestFulfilmentBankFlowStep | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)

    const resetFlow = useCallback(() => {
        setExternalWalletFulfilMethod(null)
        setShowExternalWalletFulfilMethods(false)
        setFlowStep(null)
        setShowRequestFulfilmentBankFlowManager(false)
        setSelectedCountry(null)
        setOnrampData(null)
    }, [])

    const value = useMemo(
        () => ({
            resetFlow,
            externalWalletFulfilMethod,
            setExternalWalletFulfilMethod,
            showExternalWalletFulfilMethods,
            setShowExternalWalletFulfilMethods,
            flowStep,
            setFlowStep,
            showRequestFulfilmentBankFlowManager,
            setShowRequestFulfilmentBankFlowManager,
            selectedCountry,
            setSelectedCountry,
            onrampData,
            setOnrampData,
        }),
        [
            resetFlow,
            externalWalletFulfilMethod,
            showExternalWalletFulfilMethods,
            flowStep,
            showRequestFulfilmentBankFlowManager,
            selectedCountry,
            onrampData,
        ]
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
