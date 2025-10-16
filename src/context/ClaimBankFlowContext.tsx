'use client'

import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { type CountryData } from '../components/AddMoney/consts'
import { type TCreateOfframpResponse } from '@/services/services.types'
import { type Account, type User } from '@/interfaces'
import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'

export enum ClaimBankFlowStep {
    SavedAccountsList = 'saved-accounts-list',
    BankDetailsForm = 'bank-details-form',
    BankConfirmClaim = 'bank-confirm-claim',
    BankCountryList = 'bank-country-list',
}

interface ClaimBankFlowContextType {
    claimToExternalWallet: boolean
    setClaimToExternalWallet: (claimToExternalWallet: boolean) => void
    flowStep: ClaimBankFlowStep | null
    setFlowStep: (step: ClaimBankFlowStep | null) => void
    selectedCountry: CountryData | null
    setSelectedCountry: (country: CountryData | null) => void
    resetFlow: () => void
    offrampDetails?: TCreateOfframpResponse | null
    setOfframpDetails: (details: TCreateOfframpResponse | null) => void
    claimError?: string | null
    setClaimError: (error: string | null) => void
    claimType?: 'claim-bank' | 'claim' | 'claimxchain' | null
    setClaimType: (type: 'claim-bank' | 'claim' | 'claimxchain' | null) => void
    senderDetails: User | null
    setSenderDetails: (details: User | null) => void
    showVerificationModal: boolean
    setShowVerificationModal: (show: boolean) => void
    bankDetails: IBankAccountDetails | null
    setBankDetails: (details: IBankAccountDetails | null) => void
    savedAccounts: Account[]
    setSavedAccounts: (accounts: Account[]) => void
    selectedBankAccount: Account | null
    setSelectedBankAccount: (account: Account | null) => void
    senderKycStatus?: BridgeKycStatus
    setSenderKycStatus: (status?: BridgeKycStatus) => void
    justCompletedKyc: boolean
    setJustCompletedKyc: (status: boolean) => void
    claimToMercadoPago: boolean
    setClaimToMercadoPago: (claimToMercadoPago: boolean) => void
    regionalMethodType: 'mercadopago' | 'pix'
    setRegionalMethodType: (regionalMethodType: 'mercadopago' | 'pix') => void
}

const ClaimBankFlowContext = createContext<ClaimBankFlowContextType | undefined>(undefined)

export const ClaimBankFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [claimToExternalWallet, setClaimToExternalWallet] = useState<boolean>(false)
    const [flowStep, setFlowStep] = useState<ClaimBankFlowStep | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [offrampDetails, setOfframpDetails] = useState<TCreateOfframpResponse | null>(null)
    const [claimError, setClaimError] = useState<string | null>(null)
    const [claimType, setClaimType] = useState<'claim-bank' | 'claim' | 'claimxchain' | null>(null)
    const [senderDetails, setSenderDetails] = useState<User | null>(null)
    const [showVerificationModal, setShowVerificationModal] = useState(false)
    const [bankDetails, setBankDetails] = useState<IBankAccountDetails | null>(null)
    const [savedAccounts, setSavedAccounts] = useState<Account[]>([])
    const [selectedBankAccount, setSelectedBankAccount] = useState<Account | null>(null)
    const [senderKycStatus, setSenderKycStatus] = useState<BridgeKycStatus | undefined>()
    const [justCompletedKyc, setJustCompletedKyc] = useState(false)
    const [claimToMercadoPago, setClaimToMercadoPago] = useState(false)
    const [regionalMethodType, setRegionalMethodType] = useState<'mercadopago' | 'pix'>('mercadopago')

    const resetFlow = useCallback(() => {
        setClaimToExternalWallet(false)
        setFlowStep(null)
        setSelectedCountry(null)
        setOfframpDetails(null)
        setClaimError(null)
        setClaimType(null)
        setSenderDetails(null)
        setShowVerificationModal(false)
        setBankDetails(null)
        setSavedAccounts([])
        setSelectedBankAccount(null)
        setSenderKycStatus(undefined)
        setJustCompletedKyc(false)
        setClaimToMercadoPago(false)
        setRegionalMethodType('mercadopago')
    }, [])

    const value = useMemo(
        () => ({
            claimToExternalWallet,
            setClaimToExternalWallet,
            flowStep,
            setFlowStep,
            selectedCountry,
            setSelectedCountry,
            resetFlow,
            offrampDetails,
            setOfframpDetails,
            claimError,
            setClaimError,
            claimType,
            setClaimType,
            senderDetails,
            setSenderDetails,
            showVerificationModal,
            setShowVerificationModal,
            bankDetails,
            setBankDetails,
            savedAccounts,
            setSavedAccounts,
            selectedBankAccount,
            setSelectedBankAccount,
            senderKycStatus,
            setSenderKycStatus,
            justCompletedKyc,
            setJustCompletedKyc,
            claimToMercadoPago,
            setClaimToMercadoPago,
            regionalMethodType,
            setRegionalMethodType,
        }),
        [
            claimToExternalWallet,
            flowStep,
            selectedCountry,
            resetFlow,
            offrampDetails,
            claimError,
            claimType,
            senderDetails,
            showVerificationModal,
            bankDetails,
            savedAccounts,
            selectedBankAccount,
            senderKycStatus,
            justCompletedKyc,
            claimToMercadoPago,
            setClaimToMercadoPago,
            regionalMethodType,
        ]
    )

    return (
        <ClaimBankFlowContext.Provider value={value as ClaimBankFlowContextType}>
            {children}
        </ClaimBankFlowContext.Provider>
    )
}

export const useClaimBankFlow = (): ClaimBankFlowContextType => {
    const context = useContext(ClaimBankFlowContext)
    if (context === undefined) {
        throw new Error('useClaimBankFlow must be used within a ClaimBankFlowContextProvider')
    }
    return context
}
