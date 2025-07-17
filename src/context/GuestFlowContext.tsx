'use client'

import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'
import { CountryData } from '../components/AddMoney/consts'
import { TCreateOfframpResponse } from '@/services/services.types'
import { User } from '@/interfaces'

interface GuestFlowContextType {
    showGuestActionsList: boolean
    setShowGuestActionsList: (showGuestActionsList: boolean) => void
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
}

const GuestFlowContext = createContext<GuestFlowContextType | undefined>(undefined)

export const GuestFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showGuestActionsList, setShowGuestActionsList] = useState(false)
    const [claimToExternalWallet, setClaimToExternalWallet] = useState<boolean>(false) // this is a combined state for exchange and crypto wallets
    const [guestFlowStep, setGuestFlowStep] = useState<string | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null)
    const [offrampDetails, setOfframpDetails] = useState<TCreateOfframpResponse | null>(null)
    const [claimError, setClaimError] = useState<string | null>(null)
    const [claimType, setClaimType] = useState<'claim-bank' | 'claim' | 'claimxchain' | null>(null)
    const [senderDetails, setSenderDetails] = useState<User | null>(null)
    const [showVerificationModal, setShowVerificationModal] = useState(false)

    const resetGuestFlow = useCallback(() => {
        setClaimToExternalWallet(false)
        setShowGuestActionsList(false)
        setGuestFlowStep(null)
        setSelectedCountry(null)
        setOfframpDetails(null)
        setClaimError(null)
        setClaimType(null)
        setSenderDetails(null)
        setShowVerificationModal(false)
    }, [])

    const value = useMemo(
        () => ({
            showGuestActionsList,
            setShowGuestActionsList,
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
        }),
        [
            showGuestActionsList,
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
