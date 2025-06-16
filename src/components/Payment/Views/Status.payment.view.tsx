'use client'
import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import { StatusType } from '@/components/Global/Badges/StatusBadge'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { PEANUT_WALLET_TOKEN_SYMBOL, TRANSACTIONS } from '@/constants'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { usePaymentStore, useUserStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { ApiUser } from '@/services/users'
import { formatAmount, getInitialsFromName, printableAddress } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useMemo } from 'react'
import { useDispatch } from 'react-redux'

type DirectSuccessViewProps = {
    user?: ApiUser
    amount?: string
    message?: string | ReactNode
    recipientType?: RecipientType
    type: 'SEND' | 'REQUEST'
    headerTitle?: string
    currencyAmount?: string
    isAddMoneyFlow?: boolean
    isWithdrawFlow?: boolean
    redirectTo?: string
}

const DirectSuccessView = ({
    user,
    amount,
    message,
    recipientType,
    type,
    headerTitle,
    currencyAmount,
    isAddMoneyFlow,
    isWithdrawFlow,
    redirectTo = '/home',
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

    const displayAmount = useMemo(() => {
        if (usdAmount) return `$ ${formatAmount(Number(usdAmount))}`
        if (currencyAmount) return currencyAmount
        if (!chargeDetails && !!amountValue) return `$ ${formatAmount(amountValue)}`
        return chargeDetails?.tokenSymbol.toLowerCase() === PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase()
            ? `$ ${formatAmount(amountValue)}`
            : `${formatAmount(amountValue)} ${chargeDetails?.tokenSymbol ?? 'USDC'}`
    }, [amountValue, chargeDetails, currencyAmount, usdAmount])

    // construct transaction details for the drawer
    const transactionForDrawer: TransactionDetails | null = useMemo(() => {
        if (!chargeDetails) return null

        const networkFeeDisplayValue = '$ 0.00' // fee is zero for peanut wallet txns
        const peanutFeeDisplayValue = '$ 0.00' // peanut doesn't charge fees yet

        let details: Partial<TransactionDetails> = {
            id: paymentDetails?.payerTransactionHash,
            status: 'completed' as StatusType,
            amount: parseFloat(amountValue),
            date: new Date(paymentDetails?.createdAt ?? chargeDetails.createdAt),
            tokenSymbol: chargeDetails.tokenSymbol,
            direction: 'send', // only showing receipt for send txns
            initials: getInitialsFromName(recipientName),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.DIRECT_SEND,
                originalUserRole: EHistoryUserRole.SENDER,
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

    useEffect(() => {
        // invalidate queries to refetch history
        queryClient?.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [queryClient])

    const handleDone = () => {
        if (!!authUser?.user.userId) {
            // reset payment state when done
            router.push('/home')
            dispatch(paymentActions.resetPaymentState())
        } else {
            router.push('/setup')
        }
    }

    const getTitle = () => {
        if (isAddMoneyFlow) return 'You successfully added'
        if (isWithdrawFlow) return 'You just withdrew'
        if (type === 'SEND') return 'You sent '
        if (type === 'REQUEST') return 'You requested '
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            {type === 'SEND' && (
                <div className="md:hidden">
                    <NavHeader
                        icon="cancel"
                        title={headerTitle}
                        onPrev={() => {
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
                                'bg-success-3 flex h-12 w-12 min-w-12 items-center justify-center rounded-full font-bold'
                            }
                        >
                            <Icon name="check" size={24} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-grey-1 text-sm font-normal">
                            {getTitle()}
                            {!isAddMoneyFlow &&
                                !isWithdrawFlow &&
                                (recipientType !== 'USERNAME' ? (
                                    <AddressLink
                                        className="text-grey-1 text-sm font-normal no-underline"
                                        address={recipientName}
                                    />
                                ) : (
                                    recipientName
                                ))}
                        </h1>
                        <h2 className="text-2xl font-extrabold">{displayAmount}</h2>
                        {message && (
                            <p className="text-grey-1 text-sm font-medium">
                                {isWithdrawFlow ? 'to' : 'for'} {message}
                            </p>
                        )}
                    </div>
                </Card>

                <div className="w-full space-y-5">
                    {!!authUser?.user.userId ? (
                        <Button onClick={handleDone} shadowSize="4">
                            Back to home
                        </Button>
                    ) : (
                        <Button icon="user-plus" onClick={() => router.push('/setup')} shadowSize="4">
                            Create Account
                        </Button>
                    )}
                    {type === 'SEND' && !isAddMoneyFlow && !isWithdrawFlow && (
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
