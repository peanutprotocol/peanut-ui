'use client'

/**
 * context for send flow state management
 *
 * direct send flow for paying another peanut user by username.
 * payments are always usdc on arbitrum (peanut wallet).
 *
 * route: /send/username
 *
 */

import React, { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { useQueryStates } from 'nuqs'
import { parseAsAmount } from '@/utils/amount-param'
import { type Address, type Hash } from 'viem'
import { type TRequestChargeResponse, type PaymentCreationResponse } from '@/services/services.types'
import type { Person } from '@/lib/person/person.types'

// view states
export type DirectSendFlowView = 'INITIAL' | 'STATUS'

// recipient info
export interface DirectSendRecipient {
    username: string
    address: Address
    userId?: string
    fullName?: string
    /** The profile's verified flag, the one the contacts list shows (TASK-21376). */
    isVerified: boolean
    /** The person behind the username, for their avatar (TASK-23756). */
    person: Person
}

// attachment options
export interface DirectSendAttachment {
    message?: string
    file?: File
    fileUrl?: string
}

// error state for input view
export interface DirectSendFlowErrorState {
    showError: boolean
    errorMessage: string
}

// context type
interface DirectSendFlowContextType {
    // state
    amount: string
    setAmount: (amount: string) => void
    usdAmount: string
    setUsdAmount: (amount: string) => void
    currentView: DirectSendFlowView
    setCurrentView: (view: DirectSendFlowView) => void
    recipient: DirectSendRecipient | null
    setRecipient: (recipient: DirectSendRecipient | null) => void
    attachment: DirectSendAttachment
    setAttachment: (attachment: DirectSendAttachment) => void
    charge: TRequestChargeResponse | null
    setCharge: (charge: TRequestChargeResponse | null) => void
    payment: PaymentCreationResponse | null
    setPayment: (payment: PaymentCreationResponse | null) => void
    txHash: Hash | null
    setTxHash: (hash: Hash | null) => void
    error: DirectSendFlowErrorState
    setError: (error: DirectSendFlowErrorState) => void
    isLoading: boolean
    setIsLoading: (loading: boolean) => void
    isSuccess: boolean
    setIsSuccess: (success: boolean) => void

    // actions
    resetSendFlow: () => void
}

const DirectSendFlowContext = createContext<DirectSendFlowContextType | undefined>(undefined)

interface SendFlowProviderProps {
    children: ReactNode
    initialRecipient?: DirectSendRecipient
    /** A past send's amount (USD) and note, offered by "Send again" as an editable suggestion. */
    initialDraft?: { amount: string; message?: string }
}

export const DirectSendFlowProvider: React.FC<SendFlowProviderProps> = ({
    children,
    initialRecipient,
    initialDraft,
}) => {
    // the amount rides in the URL, so a bank page or /verify opened to add money comes back to it
    // (TASK-25467). Never the message: it is free text and may hold personal data. A "Send again"
    // draft is only a suggestion until the user types: the URL's own amount wins over it. `usdAmount`
    // stays in memory, so the receipt keeps it after a sent payment clears the URL.
    const [{ amount: urlAmount }, setQuery] = useQueryStates({ amount: parseAsAmount })
    const [draftAmount, setDraftAmount] = useState<string>(initialDraft?.amount ?? '')
    const amount = urlAmount ?? draftAmount
    const setAmount = useCallback(
        (value: string) => {
            setDraftAmount('')
            void setQuery({ amount: value || null })
        },
        [setQuery]
    )
    const [usdAmount, setUsdAmount] = useState<string>(amount)
    const [currentView, setCurrentView] = useState<DirectSendFlowView>('INITIAL')
    const [recipient, setRecipient] = useState<DirectSendRecipient | null>(initialRecipient ?? null)
    const [attachment, setAttachment] = useState<DirectSendAttachment>(
        initialDraft?.message ? { message: initialDraft.message } : {}
    )
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [payment, setPayment] = useState<PaymentCreationResponse | null>(null)
    const [txHash, setTxHash] = useState<Hash | null>(null)
    const [error, setError] = useState<DirectSendFlowErrorState>({ showError: false, errorMessage: '' })
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [isSuccess, setIsSuccess] = useState<boolean>(false)

    const resetSendFlow = useCallback(() => {
        setAmount('')
        setUsdAmount('')
        setCurrentView('INITIAL')
        setAttachment({})
        setCharge(null)
        setPayment(null)
        setTxHash(null)
        setError({ showError: false, errorMessage: '' })
        setIsLoading(false)
        setIsSuccess(false)
    }, [setAmount])

    const value = useMemo(
        () => ({
            amount,
            setAmount,
            usdAmount,
            setUsdAmount,
            currentView,
            setCurrentView,
            recipient,
            setRecipient,
            attachment,
            setAttachment,
            charge,
            setCharge,
            payment,
            setPayment,
            txHash,
            setTxHash,
            error,
            setError,
            isLoading,
            setIsLoading,
            isSuccess,
            setIsSuccess,
            resetSendFlow,
        }),
        [
            amount,
            usdAmount,
            currentView,
            recipient,
            attachment,
            charge,
            payment,
            txHash,
            error,
            isLoading,
            isSuccess,
            setAmount,
            resetSendFlow,
        ]
    )

    return <DirectSendFlowContext.Provider value={value}>{children}</DirectSendFlowContext.Provider>
}

export const useDirectSendFlowContext = (): DirectSendFlowContextType => {
    const context = useContext(DirectSendFlowContext)
    if (context === undefined) {
        throw new Error('useDirectSendFlowContext must be used within DirectSendFlowProvider')
    }
    return context
}
