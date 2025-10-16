'use client'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { StatusPillType } from '@/components/Global/StatusPill'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS, BASE_URL } from '@/constants'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { usePaymentStore, useUserStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { ApiUser } from '@/services/users'
import { formatAmount, getInitialsFromName, printableAddress } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'

type DirectSuccessViewProps = {
    user?: ApiUser
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
}

const DirectSuccessView = ({
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
}: DirectSuccessViewProps) => {
    const router = useRouter()
    const { chargeDetails, parsedPaymentData, usdAmount, paymentDetails } = usePaymentStore()
    const dispatch = useDispatch()
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()
    const { user: authUser } = useUserStore()
    const queryClient = useQueryClient()

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
            // reset payment state when done
            router.push('/home')
            dispatch(paymentActions.resetPaymentState())
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
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
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

                {points && (
                    <div ref={pointsDivRef} className="flex justify-center gap-2">
                        <Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />
                        <p className="text-sm font-medium text-black">
                            You&apos;ve earned {points} {points === 1 ? 'point' : 'points'}!
                        </p>
                    </div>
                )}

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
export default DirectSuccessView
