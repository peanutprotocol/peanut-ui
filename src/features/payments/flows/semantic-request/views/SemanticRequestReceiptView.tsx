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
import { type IconStatusType } from '@/components/Global/Badges/Badge'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { getInitialsFromName } from '@/utils/general.utils'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { payLinkUrl } from '@/utils/url.utils'
import { receiptKindForCharge } from '@/features/payments/shared/utils/charge-receipt.utils'

export function SemanticRequestReceiptView() {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
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
            ? payLinkUrl(`/${recipientIdentifier}?chargeId=${charge.uuid}`)
            : undefined

        const networkFeeDisplayValue = '$ 0.00' // fee is zero for peanut wallet txns
        const peanutFeeDisplayValue = '$ 0.00' // peanut doesn't charge fees yet

        // determine who paid (payer name for display)
        const payerName = successfulPayment.payerAccount?.user?.username || successfulPayment.payerAddress || 'Unknown'

        const details: Partial<TransactionDetails> = {
            // the charge uuid + the charge's own kind are what GET /history/:id
            // resolves; a tx hash is not a receipt key
            id: charge.uuid,
            txHash: successfulPayment.payerTransactionHash,
            status: 'completed' as IconStatusType,
            amount: parseFloat(charge.tokenAmount),
            createdAt: new Date(charge.createdAt),
            completedAt: new Date(successfulPayment.createdAt),
            tokenSymbol: charge.tokenSymbol,
            direction: 'receive', // showing receipt from recipient's perspective
            initials: getInitialsFromName(payerName),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.RECIPIENT,
                kind: receiptKindForCharge(charge),
                link: receiptLink,
            },
            userName: payerName,
            avatarKey: successfulPayment.payerAccount?.user?.avatarKey ?? null,
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
                moreInfoText: t('confirm.slippageInfo'),
            },
            peanutFeeDetails: {
                amountDisplay: peanutFeeDisplayValue,
            },
            currency: charge.currencyAmount ? { amount: charge.currencyAmount, code: 'USD' } : undefined,
        }

        return details as TransactionDetails
    }, [charge, recipient, parsedUrl, tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol, t])

    // show loading if fetching charge
    if (isFetchingCharge || !charge) {
        return (
            <PageStack>
                <NavHeader title={t('headers.receipt')} onPrev={onBack} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <Loading variant="mascot" />
                </div>
            </PageStack>
        )
    }

    // show receipt if we have transaction details
    if (!transactionForReceipt) {
        return (
            <PageStack>
                <NavHeader title={t('headers.receipt')} onPrev={onBack} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <p className="text-body-s text-foreground-secondary">{t('receipt.unableToLoad')}</p>
                </div>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('headers.receipt')} onPrev={onBack} />
            <div className="flex w-full flex-grow flex-col justify-center gap-4">
                <TransactionDetailsReceipt
                    transaction={transactionForReceipt}
                    transactionAmount={charge.currencyAmount || charge.tokenAmount}
                    isPublic={true}
                />
            </div>
        </PageStack>
    )
}
