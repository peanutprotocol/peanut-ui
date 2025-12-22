'use client'

/**
 * shared success view for all payment flows
 *
 * displays:
 * - success animation with peanut mascot
 * - amount sent and recipient name
 * - optional message/attachment
 * - points earned (with confetti)
 * - receipt drawer for transaction details
 *
 * used by: send, contribute-pot, semantic-request, withdraw flows
 */

import { Button } from '@/components/0_Bruddle/Button'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { type StatusPillType } from '@/components/Global/StatusPill'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { type RecipientType } from '@/lib/url-parser/types/payment'
import { useUserStore } from '@/redux/hooks'
import type { TRequestChargeResponse, PaymentCreationResponse, ChargeEntry } from '@/services/services.types'
import { formatAmount, getInitialsFromName, printableAddress } from '@/utils/general.utils'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useHaptic } from 'use-haptic'
import PointsCard from '@/components/Common/PointsCard'
import { BASE_URL } from '@/constants/general.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { ParsedURL } from '@/lib/url-parser/types/payment'

// minimal user info needed for display
type UserDisplayInfo = {
    username?: string
    fullName?: string
}

type DirectSuccessViewProps = {
    user?: UserDisplayInfo
    amount?: string
    message?: string | ReactNode
    recipientType?: RecipientType
    type?: 'SEND' | 'REQUEST'
    headerTitle?: string
    currencyAmount?: string
    isExternalWalletFlow?: boolean
    isWithdrawFlow?: boolean
    redirectTo?: string
    onComplete?: () => void
    points?: number
    // props to receive data directly instead of from redux
    chargeDetails?: TRequestChargeResponse | ChargeEntry | null
    paymentDetails?: PaymentCreationResponse | null
    parsedPaymentData?: ParsedURL | null
    usdAmount?: string
}

const PaymentSuccessView = ({
    user,
    amount,
    message,
    recipientType,
    type,
    headerTitle,
    currencyAmount,
    isExternalWalletFlow,
    isWithdrawFlow,
    redirectTo = '/home',
    onComplete,
    points,
    chargeDetails,
    paymentDetails,
    parsedPaymentData,
    usdAmount,
}: DirectSuccessViewProps) => {
    const router = useRouter()
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()
    const { user: authUser } = useUserStore()
    const queryClient = useQueryClient()
    const { triggerHaptic } = useHaptic()

    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: chargeDetails?.chainId,
        tokenSymbol: chargeDetails?.tokenSymbol,
        tokenAddress: chargeDetails?.tokenAddress,
    })

    const recipientName = useMemo(() => {
        if (user?.username) {
            return user.fullName || user.username
        }
        if (parsedPaymentData?.recipient?.identifier) {
            return parsedPaymentData.recipient.identifier
        }
        return printableAddress(chargeDetails?.requestLink?.recipientAddress || '')
    }, [user, parsedPaymentData, chargeDetails])

    const amountValue = useMemo(() => {
        return amount ?? chargeDetails?.tokenAmount ?? '0'
    }, [amount, chargeDetails])

    // always show values in USD – never in tokens
    const displayAmount = useMemo(() => {
        // 1. explicit currency amount
        if (currencyAmount) return currencyAmount

        // 2. usdAmount - comes from charge response
        if (usdAmount) return `$${formatAmount(Number(usdAmount))}`

        // 3. fallback: we only know the raw amount which is USD
        return `$${formatAmount(amountValue)}`
    }, [amountValue, currencyAmount, usdAmount])

    // construct transaction details for the drawer
    const transactionForDrawer: TransactionDetails | null = useMemo(() => {
        if (!chargeDetails) return null

        const networkFeeDisplayValue = '$ 0.00' // fee is zero for peanut wallet txns
        const peanutFeeDisplayValue = '$ 0.00' // peanut doesn't charge fees yet

        const recipientIdentifier = user?.username || parsedPaymentData?.recipient?.identifier
        const receiptLink = recipientIdentifier
            ? `${BASE_URL}/${recipientIdentifier}?chargeId=${chargeDetails.uuid}`
            : undefined

        let details: Partial<TransactionDetails> = {
            id: paymentDetails?.payerTransactionHash,
            txHash: paymentDetails?.payerTransactionHash,
            status: 'completed' as StatusPillType,
            amount: parseFloat(amountValue),
            createdAt: new Date(paymentDetails?.createdAt ?? chargeDetails.createdAt),
            completedAt: new Date(),
            tokenSymbol: chargeDetails.tokenSymbol,
            direction: 'send', // only showing receipt for send txns
            initials: getInitialsFromName(recipientName),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.DIRECT_SEND,
                originalUserRole: EHistoryUserRole.SENDER,
                link: receiptLink,
            },
            userName: user?.username || parsedPaymentData?.recipient?.identifier,
            sourceView: 'status',
            memo: chargeDetails.requestLink?.reference || undefined,
            attachmentUrl: chargeDetails.requestLink?.attachmentUrl || undefined,
            tokenDisplayDetails: {
                tokenSymbol: resolvedTokenSymbol || chargeDetails.tokenSymbol,
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
            currency: usdAmount ? { amount: usdAmount, code: 'USD' } : undefined,
        }

        return details as TransactionDetails
    }, [
        chargeDetails,
        type,
        amountValue,
        recipientName,
        parsedPaymentData,
        message,
        user,
        getInitialsFromName,
        tokenIconUrl,
        chainIconUrl,
        resolvedChainName,
        resolvedTokenSymbol,
        paymentDetails,
        usdAmount,
    ])

    const pointsDivRef = useRef<HTMLDivElement>(null)
    usePointsConfetti(points, pointsDivRef)

    useEffect(() => {
        // invalidate queries to refetch history
        queryClient?.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [queryClient])

    const handleDone = () => {
        onComplete?.()
        if (!!authUser?.user.userId) {
            router.push('/home')
        } else {
            router.push('/setup')
        }
    }

    const getTitle = () => {
        if (isExternalWalletFlow) return 'You successfully added'
        if (isWithdrawFlow) return 'You just withdrew'
        if (type === 'SEND') return 'You sent '
        if (type === 'REQUEST') return 'You requested '
    }

    useEffect(() => {
        // trigger haptic on mount
        triggerHaptic()
    }, [triggerHaptic])

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <SoundPlayer sound="success" />
            {type === 'SEND' && (
                <div className="md:hidden">
                    <NavHeader
                        icon="cancel"
                        title={headerTitle}
                        onPrev={() => {
                            onComplete?.()
                            router.push(redirectTo)
                        }}
                    />
                </div>
            )}
            <div className="relative z-10 my-auto flex h-full flex-col justify-center space-y-4">
                <Image
                    src={chillPeanutAnim.src}
                    alt="Peanut Mascot"
                    width={20}
                    height={20}
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                />
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={
                                'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold'
                            }
                        >
                            <Icon name="check" size={24} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-sm font-normal text-grey-1">
                            {getTitle()}
                            {!isExternalWalletFlow &&
                                !isWithdrawFlow &&
                                (recipientType !== 'USERNAME' ? (
                                    <AddressLink
                                        className="text-sm font-normal text-grey-1 no-underline"
                                        address={recipientName}
                                    />
                                ) : (
                                    recipientName
                                ))}
                        </h1>
                        <h2 className="text-2xl font-extrabold">{displayAmount}</h2>
                        {message && (
                            <p className="text-sm font-medium text-grey-1">
                                {isWithdrawFlow ? 'to' : 'for'} {message}
                            </p>
                        )}
                    </div>
                </Card>

                {points && <PointsCard points={points} pointsDivRef={pointsDivRef} />}

                <div className="w-full space-y-5">
                    {!!authUser?.user.userId ? (
                        <Button onClick={handleDone} shadowSize="4">
                            Back to home
                        </Button>
                    ) : (
                        <CreateAccountButton onClick={() => router.push('/setup')} />
                    )}
                    {type === 'SEND' && !isExternalWalletFlow && !isWithdrawFlow && (
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
                    )}
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
export default PaymentSuccessView
