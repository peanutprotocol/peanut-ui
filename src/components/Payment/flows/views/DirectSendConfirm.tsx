'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import UserCard from '@/components/User/UserCard'
import { useDirectSendFlow } from '@/hooks/payment'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { formatAmount } from '@/utils'

interface DirectSendFormData {
    amount: string
    message: string
    recipient: ParsedURL['recipient'] | null
}

interface DirectSendConfirmProps {
    formData: DirectSendFormData
    directSendHook: ReturnType<typeof useDirectSendFlow>
    onNextAction: () => void
    onBackAction: () => void
}

/**
 * DirectSendConfirm View
 *
 * The confirmation step for direct send flow:
 * - Shows transaction details
 * - Displays fees (none for USDC on Arbitrum)
 * - Confirm button to execute transaction
 * - Back button to edit details
 *
 * Uses existing shared components for consistency!
 */
export const DirectSendConfirm = ({ formData, directSendHook, onNextAction, onBackAction }: DirectSendConfirmProps) => {
    const { isProcessing, error } = directSendHook

    return (
        <div className="flex h-full min-h-[inherit] flex-col justify-between gap-8">
            {/* Navigation Header */}
            <NavHeader onPrev={onBackAction} title="Confirm Send" />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* Recipient Card - Reusing existing component! */}
                {formData.recipient && (
                    <UserCard
                        type="send"
                        username={formData.recipient.identifier}
                        recipientType={formData.recipient.recipientType}
                        size="small"
                        message={formData.message || undefined}
                    />
                )}

                {/* Transaction Details Card - Reusing existing component! */}
                <PeanutActionDetailsCard
                    transactionType="REQUEST_PAYMENT"
                    recipientType={formData.recipient?.recipientType || 'ADDRESS'}
                    recipientName={formData.recipient?.identifier || 'Unknown'}
                    amount={formData.amount}
                    tokenSymbol="USDC"
                    message={formData.message}
                />

                {/* Fee Information */}
                <Card className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Network Fee</span>
                        <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Peanut Fee</span>
                        <span className="font-medium text-green-600">Free</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>${formatAmount(formData.amount)} USDC</span>
                    </div>
                </Card>

                {/* Action Buttons */}
                <div className="space-y-4">
                    <Button
                        variant="purple"
                        loading={isProcessing}
                        shadowSize="4"
                        onClick={onNextAction}
                        disabled={isProcessing}
                        className="w-full"
                        icon="arrow-up-right"
                        iconSize={16}
                    >
                        {isProcessing ? 'Sending...' : `Send $${formatAmount(formData.amount)} USDC`}
                    </Button>

                    {/* Back Button */}
                    <Button
                        variant="stroke"
                        shadowSize="4"
                        onClick={onBackAction}
                        disabled={isProcessing}
                        className="w-full"
                    >
                        Edit Details
                    </Button>

                    {/* Error Display - Reusing existing component! */}
                    {error && <ErrorAlert description={error} />}
                </div>

                {/* Info Message */}
                <div className="rounded-lg bg-blue-50 p-3 text-center text-sm text-blue-700">
                    💡 USDC transfers on Arbitrum are free and instant!
                </div>
            </div>
        </div>
    )
}
