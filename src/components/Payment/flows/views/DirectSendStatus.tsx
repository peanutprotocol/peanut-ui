'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { BASE_URL } from '@/constants'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useDirectSendFlow } from '@/hooks/payment'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { formatAmount, getInitialsFromName } from '@/utils'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

interface DirectSendFormData {
    amount: string
    message: string
    recipient: ParsedURL['recipient'] | null
}

interface DirectSendStatusProps {
    formData: DirectSendFormData
    directSendHook: ReturnType<typeof useDirectSendFlow>
    onCompleteAction: () => void
    onSendAnotherAction: () => void
}

/**
 * DirectSendStatus View
 *
 * Matches the existing DirectSuccessView design exactly - no visual changes!
 */
export const DirectSendStatus = ({ formData, directSendHook, onCompleteAction }: DirectSendStatusProps) => {
    const router = useRouter()
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()

    const handleDone = () => {
        router.push('/home')
        onCompleteAction()
    }

    // Construct transaction details for the drawer (same as original DirectSuccessView)
    const transactionForDrawer: TransactionDetails | null = useMemo(() => {
        const { chargeDetails, paymentDetails } = directSendHook
        if (!chargeDetails) return null

        const networkFeeDisplayValue = '$ 0.00' // fee is zero for peanut wallet txns
        const peanutFeeDisplayValue = '$ 0.00' // peanut doesn't charge fees yet

        const recipientIdentifier = formData.recipient?.identifier
        const receiptLink = recipientIdentifier
            ? `${BASE_URL}/${recipientIdentifier}?chargeId=${chargeDetails.uuid}`
            : undefined

        const details: Partial<TransactionDetails> = {
            id: paymentDetails?.payerTransactionHash,
            txHash: paymentDetails?.payerTransactionHash,
            status: 'completed',
            amount: parseFloat(formData.amount),
            date: new Date(paymentDetails?.createdAt ?? chargeDetails.createdAt),
            tokenSymbol: chargeDetails.tokenSymbol,
            direction: 'send',
            initials: getInitialsFromName(recipientIdentifier || ''),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.DIRECT_SEND,
                originalUserRole: EHistoryUserRole.SENDER,
                link: receiptLink,
            },
            userName: recipientIdentifier,
            sourceView: 'status',
            memo: formData.message || undefined,
            attachmentUrl: chargeDetails.requestLink?.attachmentUrl || undefined,
            networkFeeDetails: {
                amountDisplay: networkFeeDisplayValue,
                moreInfoText: 'This transaction may face slippage due to token conversion or cross-chain bridging.',
            },
            peanutFeeDetails: {
                amountDisplay: peanutFeeDisplayValue,
            },
        }

        return details as TransactionDetails
    }, [directSendHook, formData])

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader icon="cancel" title="Send" onPrev={handleDone} />
            </div>

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                            <Icon name="check" size={24} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-sm font-normal text-grey-1">You sent {formData.recipient?.identifier}</h1>
                        <h2 className="text-2xl font-extrabold">$ {formatAmount(formData.amount)}</h2>
                        {formData.message && <p className="text-sm font-medium text-grey-1">for {formData.message}</p>}
                    </div>
                </Card>

                <div className="w-full space-y-5">
                    <Button onClick={handleDone} shadowSize="4">
                        Back to home
                    </Button>

                    <Button
                        variant="primary-soft"
                        shadowSize="4"
                        onClick={() => {
                            if (transactionForDrawer) {
                                openTransactionDetails(transactionForDrawer)
                            }
                        }}
                        disabled={!transactionForDrawer}
                    >
                        See receipt
                    </Button>
                </div>
            </div>

            {/* Transaction Details Drawer */}
            <TransactionDetailsDrawer
                isOpen={isDrawerOpen && selectedTransaction?.id === transactionForDrawer?.id}
                onClose={closeTransactionDetails}
                transaction={selectedTransaction}
            />
        </div>
    )
}
