'use client'

import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { type CountryData } from '@/components/AddMoney/consts'
import { type IOnrampData } from './OnrampFlowContext'
import { type User } from '@/interfaces'

export type ExternalWalletFulfilMethod = 'exchange' | 'wallet'

export enum RequestFulfillmentBankFlowStep {
    BankCountryList = 'bank-country-list',
    DepositBankDetails = 'deposit-bank-details',
    OnrampConfirmation = 'onramp-confirmation',
    CollectUserDetails = 'collect-user-details',
}

interface RequestFulfillmentFlowContextType {
    resetFlow: () => void
    showExternalWalletFulfillMethods: boolean
    setShowExternalWalletFulfillMethods: (showExternalWalletFulfillMethods: boolean) => void
    showRequestFulfilmentBankFlowManager: boolean
    setShowRequestFulfilmentBankFlowManager: (showRequestFulfilmentBankFlowManager: boolean) => void
    externalWalletFulfillMethod: ExternalWalletFulfilMethod | null
    setExternalWalletFulfillMethod: (externalWalletFulfillMethod: ExternalWalletFulfilMethod | null) => void
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
    regionalMethodType: 'mercadopago' | 'pix'
    setRegionalMethodType: (regionalMethodType: 'mercadopago' | 'pix') => void
    triggerPayWithPeanut: boolean
    setTriggerPayWithPeanut: (triggerPayWithPeanut: boolean) => void
}

const RequestFulfillmentFlowContext = createContext<RequestFulfillmentFlowContextType | undefined>(undefined)

export const RequestFulfilmentFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showExternalWalletFulfillMethods, setShowExternalWalletFulfillMethods] = useState(false)
    const [externalWalletFulfillMethod, setExternalWalletFulfillMethod] = useState<ExternalWalletFulfilMethod | null>(
        null
    )
    const [showRequestFulfilmentBankFlowManager, setShowRequestFulfilmentBankFlowManager] = useState(false)
    const [flowStep, setFlowStep] = useState<RequestFulfillmentBankFlowStep | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)
    const [showVerificationModal, setShowVerificationModal] = useState(false)
    const [requesterDetails, setRequesterDetails] = useState<User | null>(null)
    const [fulfillUsingManteca, setFulfillUsingManteca] = useState(false)
    const [regionalMethodType, setRegionalMethodType] = useState<'mercadopago' | 'pix'>('mercadopago')
    const [triggerPayWithPeanut, setTriggerPayWithPeanut] = useState(false) // To trigger the pay with peanut from Action List

    const resetFlow = useCallback(() => {
        setExternalWalletFulfillMethod(null)
        setShowExternalWalletFulfillMethods(false)
        setFlowStep(null)
        setShowRequestFulfilmentBankFlowManager(false)
        setSelectedCountry(null)
        setOnrampData(null)
        setShowVerificationModal(false)
        setRequesterDetails(null)
        setFulfillUsingManteca(false)
        setRegionalMethodType('mercadopago')
    }, [])

    const value = useMemo(
        () => ({
            resetFlow,
            externalWalletFulfillMethod,
            setExternalWalletFulfillMethod,
            showExternalWalletFulfillMethods,
            setShowExternalWalletFulfillMethods,
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
            regionalMethodType,
            setRegionalMethodType,
            triggerPayWithPeanut,
            setTriggerPayWithPeanut,
        }),
        [
            resetFlow,
            externalWalletFulfillMethod,
            showExternalWalletFulfillMethods,
            flowStep,
            showRequestFulfilmentBankFlowManager,
            selectedCountry,
            onrampData,
            showVerificationModal,
            requesterDetails,
            fulfillUsingManteca,
            regionalMethodType,
            triggerPayWithPeanut,
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
