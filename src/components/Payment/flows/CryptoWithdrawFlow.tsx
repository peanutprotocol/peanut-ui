'use client'

import { useCryptoWithdrawFlow } from '@/hooks/payment'
import { ITokenPriceData } from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useState, useCallback, useMemo } from 'react'
import { CryptoWithdrawInitial } from './views/CryptoWithdrawInitial'
import { CryptoWithdrawConfirm } from './views/CryptoWithdrawConfirm'
import { CryptoWithdrawStatus } from './views/CryptoWithdrawStatus'

// Flow-specific types
interface CryptoWithdrawFormData {
    amount: string
    selectedToken: ITokenPriceData | null
    selectedChain: (peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }) | null
    recipientAddress: string
    isValidRecipient: boolean
}

interface CryptoWithdrawFlowProps {
    initialAmount?: string
    onComplete?: () => void
}

type CryptoWithdrawView = 'INITIAL' | 'CONFIRM' | 'STATUS'

/**
 * CryptoWithdrawFlow Orchestrator
 *
 * Manages the complete crypto withdraw flow (Peanut → External crypto address):
 * INITIAL → CONFIRM → STATUS
 */
export const CryptoWithdrawFlow = ({ initialAmount = '', onComplete }: CryptoWithdrawFlowProps) => {
    // Simple UI state (orchestrator manages this)
    const [currentView, setCurrentView] = useState<CryptoWithdrawView>('INITIAL')
    const [formData, setFormData] = useState<CryptoWithdrawFormData>({
        amount: initialAmount,
        selectedToken: null,
        selectedChain: null,
        recipientAddress: '',
        isValidRecipient: false,
    })

    // Complex business logic state
    const cryptoWithdrawHook = useCryptoWithdrawFlow()

    // Form data updater
    const updateFormData = useCallback((updates: Partial<CryptoWithdrawFormData>) => {
        setFormData((prev) => ({ ...prev, ...updates }))
    }, [])

    // Create payload from form data
    const currentPayload = useMemo(() => {
        if (
            !formData.selectedToken ||
            !formData.selectedChain ||
            !formData.recipientAddress ||
            !formData.isValidRecipient ||
            !formData.amount ||
            parseFloat(formData.amount) <= 0
        ) {
            return null
        }

        return {
            recipient: {
                identifier: formData.recipientAddress,
                resolvedAddress: formData.recipientAddress,
                recipientType: 'ADDRESS' as const,
            },
            tokenAmount: formData.amount,
            toChainId: formData.selectedChain.chainId,
            toTokenAddress: formData.selectedToken.address,
        }
    }, [formData])

    // View navigation handlers
    const handleNext = useCallback(async () => {
        if (currentView === 'INITIAL') {
            // Validate form
            if (!currentPayload) {
                console.error('Form validation failed - missing required fields')
                return
            }

            // Prepare route (synchronous now with TanStack Query!)
            console.log('Preparing route for withdrawal...')
            cryptoWithdrawHook.prepareRoute(currentPayload)

            // Move to confirm immediately - route preparation happens in background
            console.log('Moving to confirm view, route will prepare automatically')
            setCurrentView('CONFIRM')
        } else if (currentView === 'CONFIRM') {
            // Execute the crypto withdraw transaction with cached route
            console.log('Executing withdrawal with cached route...')
            const result = await cryptoWithdrawHook.withdraw()

            if (result.success) {
                console.log('Withdrawal successful, moving to status view')
                setCurrentView('STATUS')
            } else {
                console.error('Withdrawal failed:', result.error)
                // Error will be shown by the hook
            }
        }
    }, [currentView, currentPayload, cryptoWithdrawHook])

    const handleBack = useCallback(() => {
        if (currentView === 'CONFIRM') {
            setCurrentView('INITIAL')
        } else if (currentView === 'STATUS') {
            // Reset everything and start over
            setCurrentView('INITIAL')
            setFormData({
                amount: initialAmount,
                selectedToken: null,
                selectedChain: null,
                recipientAddress: '',
                isValidRecipient: false,
            })
            cryptoWithdrawHook.reset()
        }
    }, [currentView, initialAmount, cryptoWithdrawHook.reset])

    const handleComplete = useCallback(() => {
        onComplete?.()
        // Note: Component will unmount and all state will be cleaned up automatically!
    }, [onComplete])

    // Render the appropriate view
    if (currentView === 'INITIAL') {
        return (
            <CryptoWithdrawInitial
                formData={formData}
                updateFormDataAction={updateFormData}
                onNextAction={handleNext}
                isProcessing={cryptoWithdrawHook.isProcessing || cryptoWithdrawHook.isPreparingRoute}
                error={cryptoWithdrawHook.displayError}
            />
        )
    }

    if (currentView === 'CONFIRM') {
        return (
            <CryptoWithdrawConfirm
                formData={formData}
                cryptoWithdrawHook={cryptoWithdrawHook}
                onNextAction={handleNext}
                onBackAction={handleBack}
            />
        )
    }

    if (currentView === 'STATUS') {
        return (
            <CryptoWithdrawStatus
                formData={formData}
                cryptoWithdrawHook={cryptoWithdrawHook}
                onCompleteAction={handleComplete}
                onWithdrawAnotherAction={handleBack}
            />
        )
    }

    return null
}
