'use client'

/**
 * receipt view for semantic request flow
 *
 * displays transaction receipt when visiting a charge url that's already been paid
 * uses TransactionDetailsReceipt to show full payment details
 */

import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { useMemo } from 'react'
import { type StatusPillType } from '@/components/Global/StatusPill'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { getInitialsFromName } from '@/utils/general.utils'
import { BASE_URL } from '@/constants/general.consts'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import PeanutLoading from '@/components/Global/PeanutLoading'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'

export function SemanticRequestReceiptView() {
    const router = useRouter()
    const { charge, recipient, parsedUrl, isFetchingCharge } = useSemanticRequestFlow()

    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: charge?.chainId,
        tokenSymbol: charge?.tokenSymbol,
        tokenAddress: charge?.tokenAddress,
    })

    // construct transaction details for receipt
    const transactionForReceipt: TransactionDetails | null = useMemo(() => {
        if (!charge) return null

        // check if charge has been fulfilled
        const isPaid = charge.fulfillmentPayment?.status === 'SUCCESSFUL'
        if (!isPaid) return null

        // get the successful payment for payer details
        const successfulPayment = charge.payments?.find((p) => p.status === 'SUCCESSFUL')
        if (!successfulPayment) return null

        const recipientIdentifier = recipient?.identifier || parsedUrl?.recipient?.identifier
        const receiptLink = recipientIdentifier
            ? `${BASE_URL}/${recipientIdentifier}?chargeId=${charge.uuid}`
            : undefined

        const networkFeeDisplayValue = '$ 0.00' // fee is zero for peanut wallet txns
        const peanutFeeDisplayValue = '$ 0.00' // peanut doesn't charge fees yet

        // determine who paid (payer name for display)
        const payerName = successfulPayment.payerAccount?.user?.username || successfulPayment.payerAddress || 'Unknown'

        const details: Partial<TransactionDetails> = {
            id: successfulPayment.payerTransactionHash || charge.uuid,
            txHash: successfulPayment.payerTransactionHash,
            status: 'completed' as StatusPillType,
            amount: parseFloat(charge.tokenAmount),
            createdAt: new Date(charge.createdAt),
            completedAt: new Date(successfulPayment.createdAt),
            tokenSymbol: charge.tokenSymbol,
            direction: 'receive', // showing receipt from recipient's perspective
            initials: getInitialsFromName(payerName),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.REQUEST,
                originalUserRole: EHistoryUserRole.RECIPIENT,
                link: receiptLink,
            },
            userName: payerName,
            sourceView: 'status',
            memo: charge.requestLink?.reference || undefined,
            attachmentUrl: charge.requestLink?.attachmentUrl || undefined,
            tokenDisplayDetails: {
                tokenSymbol: resolvedTokenSymbol || charge.tokenSymbol,
                chainName: resolvedChainName,
                tokenIconUrl: tokenIconUrl,
                chainIconUrl: chainIconUrl,
            },
            networkFeeDetails: {
                amountDisplay: networkFeeDisplayValue,
                moreInfoText: 'This transaction may face slippage due to token conversion or cross-chain bridging.',
            },
            peanutFeeDetails: {
                amountDisplay: peanutFeeDisplayValue,
            },
            currency: charge.currencyAmount ? { amount: charge.currencyAmount, code: 'USD' } : undefined,
        }

        return details as TransactionDetails
    }, [charge, recipient, parsedUrl, tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol])

    // show loading if fetching charge
    if (isFetchingCharge || !charge) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-4">
                <NavHeader title="Receipt" onPrev={() => router.back()} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // show receipt if we have transaction details
    if (!transactionForReceipt) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-4">
                <NavHeader title="Receipt" onPrev={() => router.back()} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <p className="text-sm text-grey-1">Unable to load receipt details</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-4">
            <NavHeader title="Receipt" onPrev={() => router.back()} />
            <div className="flex w-full flex-grow flex-col justify-center gap-4">
                <TransactionDetailsReceipt
                    transaction={transactionForReceipt}
                    transactionAmount={charge.currencyAmount || charge.tokenAmount}
                    isPublic={true}
                />
            </div>
        </div>
    )
}
