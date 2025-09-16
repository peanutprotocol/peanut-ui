'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { CountryData } from '@/components/AddMoney/consts'
import { IOnrampData } from './OnrampFlowContext'
import { User } from '@/interfaces'

export type ExternalWalletFulfilMethod = 'exchange' | 'wallet'

export enum RequestFulfillmentBankFlowStep {
    BankCountryList = 'bank-country-list',
    DepositBankDetails = 'deposit-bank-details',
    OnrampConfirmation = 'onramp-confirmation',
    CollectUserDetails = 'collect-user-details',
}

interface RequestFulfillmentFlowContextType {
    resetFlow: () => void
    showExternalWalletFulfilMethods: boolean
    setShowExternalWalletFulfilMethods: (showExternalWalletFulfilMethods: boolean) => void
    showRequestFulfilmentBankFlowManager: boolean
    setShowRequestFulfilmentBankFlowManager: (showRequestFulfilmentBankFlowManager: boolean) => void
    externalWalletFulfilMethod: ExternalWalletFulfilMethod | null
    setExternalWalletFulfilMethod: (externalWalletFulfilMethod: ExternalWalletFulfilMethod | null) => void
    flowStep: RequestFulfillmentBankFlowStep | null
    setFlowStep: (step: RequestFulfillmentBankFlowStep | null) => void
    selectedCountry: CountryData | null
    setSelectedCountry: (country: CountryData | null) => void
    onrampData: IOnrampData | null
    setOnrampData: (data: IOnrampData | null) => void
    showVerificationModal: boolean
    setShowVerificationModal: (show: boolean) => void
    requesterDetails: User | null
    setRequesterDetails: (details: User | null) => void
    fulfillUsingManteca: boolean
    setFulfillUsingManteca: (fulfillUsingManteca: boolean) => void
}

const RequestFulfillmentFlowContext = createContext<RequestFulfillmentFlowContextType | undefined>(undefined)

export const RequestFulfilmentFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showExternalWalletFulfilMethods, setShowExternalWalletFulfilMethods] = useState(false)
    const [externalWalletFulfilMethod, setExternalWalletFulfilMethod] = useState<ExternalWalletFulfilMethod | null>(
        null
    )
    const [showRequestFulfilmentBankFlowManager, setShowRequestFulfilmentBankFlowManager] = useState(false)
    const [flowStep, setFlowStep] = useState<RequestFulfillmentBankFlowStep | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)
    const [showVerificationModal, setShowVerificationModal] = useState(false)
    const [requesterDetails, setRequesterDetails] = useState<User | null>(null)
    const [fulfillUsingManteca, setFulfillUsingManteca] = useState(false)

    const resetFlow = useCallback(() => {
        setExternalWalletFulfilMethod(null)
        setShowExternalWalletFulfilMethods(false)
        setFlowStep(null)
        setShowRequestFulfilmentBankFlowManager(false)
        setSelectedCountry(null)
        setOnrampData(null)
        setShowVerificationModal(false)
        setRequesterDetails(null)
        setFulfillUsingManteca(false)
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
            showVerificationModal,
            setShowVerificationModal,
            requesterDetails,
            setRequesterDetails,
            fulfillUsingManteca,
            setFulfillUsingManteca,
        }),
        [
            resetFlow,
            externalWalletFulfilMethod,
            showExternalWalletFulfilMethods,
            flowStep,
            showRequestFulfilmentBankFlowManager,
            selectedCountry,
            onrampData,
            showVerificationModal,
            requesterDetails,
            fulfillUsingManteca,
        ]
    )

    return (
        <RequestFulfillmentFlowContext.Provider value={value as RequestFulfillmentFlowContextType}>
            {children}
        </RequestFulfillmentFlowContext.Provider>
    )
}

export const useRequestFulfillmentFlow = (): RequestFulfillmentFlowContextType => {
    const context = useContext(RequestFulfillmentFlowContext)
    if (context === undefined) {
        throw new Error('useRequestFulfillmentFlow must be used within a RequestFulfilmentFlowContextProvider')
    }
    return context
}
