'use client'

import { ITokenPriceData, Account } from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import React, { createContext, ReactNode, useContext, useMemo, useState, useCallback } from 'react'

interface GuestFlowContextType {
    showGuestActionsList: boolean
    setShowGuestActionsList: (showGuestActionsList: boolean) => void
    claimToExternalWallet: boolean
    setClaimToExternalWallet: (claimToExternalWallet: boolean) => void
    resetGuestFlow: () => void
}

const GuestFlowContext = createContext<GuestFlowContextType | undefined>(undefined)

export const GuestFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [showGuestActionsList, setShowGuestActionsList] = useState(false)
    const [claimToExternalWallet, setClaimToExternalWallet] = useState<boolean>(false) // this is a combined state for exchange and crypto wallets

    const resetGuestFlow = useCallback(() => {
        setClaimToExternalWallet(false)
        setShowGuestActionsList(false)
    }, [])

    const value = useMemo(
        () => ({
            showGuestActionsList,
            setShowGuestActionsList,
            claimToExternalWallet,
            setClaimToExternalWallet,
            resetGuestFlow,
        }),
        [showGuestActionsList, claimToExternalWallet, resetGuestFlow]
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
