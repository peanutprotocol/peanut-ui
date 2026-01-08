'use client'

import React, { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

export interface InitialViewErrorState {
    showError: boolean
    errorMessage: string
}

export interface IOnrampData {
    transferId?: string
    depositInstructions?: {
        amount?: string
        currency?: string
        depositMessage?: string
        bankName?: string
        bankAddress?: string
        bankRoutingNumber?: string
        bankAccountNumber?: string
        bankBeneficiaryName?: string
        bankBeneficiaryAddress?: string
        iban?: string
        bic?: string
        accountHolderName?: string
        clabe?: string
    }
}

/**
 * OnrampFlowContext - Manages transient state for the add-money (onramp) flow.
 *
 * NOTE: Step and amount are now managed via URL query parameters using nuqs.
 * See the useQueryStates usage in:
 * - src/app/(mobile-ui)/add-money/[country]/bank/page.tsx
 * - src/components/AddMoney/components/MantecaAddMoney.tsx
 *
 * This context only manages:
 * - `error` - Transient error state for form validation
 * - `fromBankSelected` - Flag for navigation
 * - `onrampData` - API response data (not appropriate for URL)
 */
interface OnrampFlowContextType {
    error: InitialViewErrorState
    setError: (error: InitialViewErrorState) => void
    fromBankSelected: boolean
    setFromBankSelected: (selected: boolean) => void
    onrampData: IOnrampData | null
    setOnrampData: (data: IOnrampData | null) => void
    resetOnrampFlow: () => void
}

const OnrampFlowContext = createContext<OnrampFlowContextType | undefined>(undefined)

export const OnrampFlowContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Transient UI state - not appropriate for URL
    const [error, setError] = useState<InitialViewErrorState>({
        showError: false,
        errorMessage: '',
    })
    const [fromBankSelected, setFromBankSelected] = useState<boolean>(false)

    // API response data - not appropriate for URL
    const [onrampData, setOnrampData] = useState<IOnrampData | null>(null)

    const resetOnrampFlow = useCallback(() => {
        setError({
            showError: false,
            errorMessage: '',
        })
        setFromBankSelected(false)
        setOnrampData(null)
    }, [])

    const value = useMemo(
        () => ({
            error,
            setError,
            fromBankSelected,
            setFromBankSelected,
            onrampData,
            setOnrampData,
            resetOnrampFlow,
        }),
        [error, fromBankSelected, onrampData, resetOnrampFlow]
    )

    return <OnrampFlowContext.Provider value={value}>{children}</OnrampFlowContext.Provider>
}

export const useOnrampFlow = (): OnrampFlowContextType => {
    const context = useContext(OnrampFlowContext)
    if (context === undefined) {
        throw new Error('useOnrampFlow must be used within an OnrampFlowContextProvider')
    }
    return context
}
