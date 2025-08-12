'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useWallet } from '@/hooks/wallet/useWallet'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { formatAmount } from '@/utils'
import { formatUnits } from 'viem'

interface DirectSendFormData {
    amount: string
    message: string
    recipient: ParsedURL['recipient'] | null
}

interface DirectSendInitialProps {
    formData: DirectSendFormData
    updateFormDataAction: (updates: Partial<DirectSendFormData>) => void
    onNextAction: () => void
    isProcessing: boolean
    error: string | null
}

/**
 * DirectSendInitial View
 *
 * The initial step for direct send flow:
 * - Shows recipient card
 * - Amount input (USDC only)
 * - Optional message input
 * - Send button
 *
 * Uses existing shared components - no new UI needed!
 */
export const DirectSendInitial = ({
    formData,
    updateFormDataAction,
    onNextAction,
    isProcessing,
    error,
}: DirectSendInitialProps) => {
    const router = useRouter()
    const { balance } = useWallet()

    // Validation
    const canProceed = useMemo(() => {
        return (
            formData.recipient?.resolvedAddress && formData.amount && parseFloat(formData.amount) > 0 && !isProcessing
        )
    }, [formData.recipient, formData.amount, isProcessing])

    const handleAmountChange = (value: string | undefined) => {
        updateFormDataAction({ amount: value || '' })
    }

    const handleMessageChange = (value: string) => {
        updateFormDataAction({ message: value })
    }

    return (
        <div className="flex h-full min-h-[inherit] flex-col justify-between gap-8">
            {/* Navigation Header */}
            <NavHeader onPrev={router.back} title="Send" />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* Recipient Card - Reusing existing component! */}
                {formData.recipient && (
                    <UserCard
                        type="send"
                        username={formData.recipient.identifier}
                        recipientType={formData.recipient.recipientType}
                        size="small"
                    />
                )}

                {/* Amount Input - Reusing existing component! */}
                <TokenAmountInput
                    tokenValue={formData.amount}
                    setTokenValue={handleAmountChange}
                    className="w-full"
                    disabled={isProcessing}
                    walletBalance={formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))}
                    hideCurrencyToggle={true}
                />

                {/* Message Input - Using same pattern as FileUploadInput */}
                <BaseInput
                    type="text"
                    placeholder="Add a message (optional)"
                    value={formData.message}
                    onChange={(e) => handleMessageChange(e.target.value)}
                    className="w-full"
                    disabled={isProcessing}
                    maxLength={140}
                />

                {/* Action Button */}
                <div className="space-y-4">
                    <Button
                        variant="purple"
                        loading={isProcessing}
                        shadowSize="4"
                        onClick={onNextAction}
                        disabled={!canProceed}
                        className="w-full"
                        icon="arrow-up-right"
                        iconSize={16}
                    >
                        {isProcessing ? 'Sending...' : 'Send'}
                    </Button>

                    {/* Error Display - Reusing existing component! */}
                    {error && <ErrorAlert description={error} />}
                </div>
            </div>
        </div>
    )
}
