'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { CountryData } from '../components/AddMoney/consts'
import { TCreateOfframpResponse } from '@/services/services.types'
import { User } from '@/interfaces'
import { IBankAccountDetails } from '@/components/AddWithdraw/DynamicBankAccountForm'

interface GuestFlowContextType {
    claimToExternalWallet: boolean
    setClaimToExternalWallet: (claimToExternalWallet: boolean) => void
    guestFlowStep: string | null
    setGuestFlowStep: (step: string | null) => void
    selectedCountry: CountryData | null
    setSelectedCountry: (country: CountryData | null) => void
    resetGuestFlow: () => void
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
}

const GuestFlowContext = createContext<GuestFlowContextType | undefined>(undefined)

export const GuestFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [claimToExternalWallet, setClaimToExternalWallet] = useState<boolean>(false)
    const [guestFlowStep, setGuestFlowStep] = useState<string | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [offrampDetails, setOfframpDetails] = useState<TCreateOfframpResponse | null>(null)
    const [claimError, setClaimError] = useState<string | null>(null)
    const [claimType, setClaimType] = useState<'claim-bank' | 'claim' | 'claimxchain' | null>(null)
    const [senderDetails, setSenderDetails] = useState<User | null>(null)
    const [showVerificationModal, setShowVerificationModal] = useState(false)
    const [bankDetails, setBankDetails] = useState<IBankAccountDetails | null>(null)

    const resetGuestFlow = useCallback(() => {
        setClaimToExternalWallet(false)
        setGuestFlowStep(null)
        setSelectedCountry(null)
        setOfframpDetails(null)
        setClaimError(null)
        setClaimType(null)
        setSenderDetails(null)
        setShowVerificationModal(false)
        setBankDetails(null)
    }, [])

    const value = useMemo(
        () => ({
            claimToExternalWallet,
            setClaimToExternalWallet,
            guestFlowStep,
            setGuestFlowStep,
            selectedCountry,
            setSelectedCountry,
            resetGuestFlow,
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
        }),
        [
            claimToExternalWallet,
            guestFlowStep,
            selectedCountry,
            resetGuestFlow,
            offrampDetails,
            claimError,
            claimType,
            setClaimType,
            senderDetails,
            showVerificationModal,
            bankDetails,
        ]
    )

    return <GuestFlowContext.Provider value={value}>{children}</GuestFlowContext.Provider>
}

export const useGuestFlow = (): GuestFlowContextType => {
    const context = useContext(GuestFlowContext)
    if (context === undefined) {
        throw new Error('useGuestFlow must be used within a GuestFlowContextProvider')
    }
    return context
}
