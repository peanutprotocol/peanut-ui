'use client'

import React, { createContext, type ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { type CountryData } from '../components/AddMoney/consts'
import { type TCreateOfframpResponse } from '@/services/services.types'
import { type Account, type CounterpartyUser } from '@/interfaces/interfaces'
import { type IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'

/**
 * Why the guest-verification modal is being shown. The modal used to render one
 * hardcoded line — "The sender isn't verified for this method" — for every
 * trigger, including a logged-out user tapping MercadoPago/Pix, where the
 * sender's verification has nothing to do with it. Blaming a counterparty for
 * the viewer's own missing account is both wrong and unactionable, so callers
 * now say which case they are in.
 */
export type VerificationPromptReason =
    /** The claimer has no account yet — nothing to do with the sender. */
    | 'account-required'
    /** We positively established the sender cannot receive a bank off-ramp. */
    | 'sender-unverified'

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
    senderDetails: CounterpartyUser | null
    setSenderDetails: (details: CounterpartyUser | null) => void
    showVerificationModal: boolean
    setShowVerificationModal: (show: boolean) => void
    /** Defaults to the sender-blameless copy; only set explicitly when known. */
    verificationPromptReason: VerificationPromptReason
    setVerificationPromptReason: (reason: VerificationPromptReason) => void
    bankDetails: IBankAccountDetails | null
    setBankDetails: (details: IBankAccountDetails | null) => void
    savedAccounts: Account[]
    setSavedAccounts: (accounts: Account[]) => void
    selectedBankAccount: Account | null
    setSelectedBankAccount: (account: Account | null) => void
    justCompletedKyc: boolean
    setJustCompletedKyc: (status: boolean) => void
    claimToMercadoPago: boolean
    setClaimToMercadoPago: (claimToMercadoPago: boolean) => void
    /**
     * The regional claim method the user EXPLICITLY chose (tap or URL param) —
     * null until then. Never default this to a concrete method: the default
     * used to be 'mercadopago', and after the auth redirect remounted the flow
     * it masqueraded as a real choice (sending AR geo for a Pix/BR claim).
     */
    regionalMethodType: 'mercadopago' | 'pix' | null
    setRegionalMethodType: (regionalMethodType: 'mercadopago' | 'pix' | null) => void
    hideTokenSelector: boolean
    setHideTokenSelector: (hideTokenSelector: boolean) => void
}

const ClaimBankFlowContext = createContext<ClaimBankFlowContextType | undefined>(undefined)

export const ClaimBankFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [claimToExternalWallet, setClaimToExternalWallet] = useState<boolean>(false)
    const [flowStep, setFlowStep] = useState<ClaimBankFlowStep | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [offrampDetails, setOfframpDetails] = useState<TCreateOfframpResponse | null>(null)
    const [claimError, setClaimError] = useState<string | null>(null)
    const [claimType, setClaimType] = useState<'claim-bank' | 'claim' | 'claimxchain' | null>(null)
    const [senderDetails, setSenderDetails] = useState<CounterpartyUser | null>(null)
    const [showVerificationModal, setShowVerificationModal] = useState(false)
    const [verificationPromptReason, setVerificationPromptReason] =
        useState<VerificationPromptReason>('account-required')
    const [bankDetails, setBankDetails] = useState<IBankAccountDetails | null>(null)
    const [savedAccounts, setSavedAccounts] = useState<Account[]>([])
    const [selectedBankAccount, setSelectedBankAccount] = useState<Account | null>(null)
    const [justCompletedKyc, setJustCompletedKyc] = useState(false)
    const [claimToMercadoPago, setClaimToMercadoPago] = useState(false)
    const [regionalMethodType, setRegionalMethodType] = useState<'mercadopago' | 'pix' | null>(null)
    const [hideTokenSelector, setHideTokenSelector] = useState(false)

    const resetFlow = useCallback(() => {
        setClaimToExternalWallet(false)
        setFlowStep(null)
        setSelectedCountry(null)
        setOfframpDetails(null)
        setClaimError(null)
        setClaimType(null)
        setSenderDetails(null)
        setShowVerificationModal(false)
        setVerificationPromptReason('account-required')
        setBankDetails(null)
        setSavedAccounts([])
        setSelectedBankAccount(null)
        setJustCompletedKyc(false)
        setClaimToMercadoPago(false)
        setRegionalMethodType(null)
        setHideTokenSelector(false)
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
            verificationPromptReason,
            setVerificationPromptReason,
            bankDetails,
            setBankDetails,
            savedAccounts,
            setSavedAccounts,
            selectedBankAccount,
            setSelectedBankAccount,
            justCompletedKyc,
            setJustCompletedKyc,
            claimToMercadoPago,
            setClaimToMercadoPago,
            regionalMethodType,
            setRegionalMethodType,
            hideTokenSelector,
            setHideTokenSelector,
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
            verificationPromptReason,
            bankDetails,
            savedAccounts,
            selectedBankAccount,
            justCompletedKyc,
            claimToMercadoPago,
            setClaimToMercadoPago,
            regionalMethodType,
            hideTokenSelector,
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
