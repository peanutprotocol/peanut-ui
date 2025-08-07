'use client'

import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useAuth } from '@/context/authContext'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { formatAmount, getInitialsFromName, printableAddress } from '@/utils'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { TRequestChargeResponse } from '@/services/services.types'
import type { StatusType } from '@/components/Global/Badges/StatusBadge'

interface RequestPayStatusProps {
    success: boolean
    transactionHash?: string | null
    chargeDetails?: TRequestChargeResponse | null
    error?: string | null
    onRetry: () => void
    onClose: () => void
}

/**
 * RequestPayStatus - Status view for request payment flow
 *
 * This component matches the exact UI of the legacy DirectSuccessView
 * with proper card layout, text hierarchy, and transaction drawer integration.
 */
export const RequestPayStatus = ({
    success,
    transactionHash,
    chargeDetails,
    error,
    onRetry,
    onClose,
}: RequestPayStatusProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const { openTransactionDetails, closeTransactionDetails, isDrawerOpen, selectedTransaction } =
        useTransactionDetailsDrawer()

    // Get recipient information
    const recipientName = chargeDetails?.requestLink.recipientAddress || 'Unknown'
    const recipientType: 'ADDRESS' | 'USERNAME' | 'ENS' = 'ADDRESS' // Could be enhanced to detect USERNAME/ENS
    const displayAmount = chargeDetails ? `$ ${formatAmount(chargeDetails.tokenAmount)}` : ''
    const message = chargeDetails?.requestLink.reference

    // Token and chain icons
    const { tokenIconUrl, chainIconUrl, resolvedChainName, resolvedTokenSymbol } = useTokenChainIcons({
        chainId: chargeDetails?.chainId,
        tokenAddress: chargeDetails?.tokenAddress,
        tokenSymbol: chargeDetails?.tokenSymbol,
    })

    // Transaction details for drawer
    const transactionForDrawer = useMemo((): TransactionDetails | null => {
        if (!success || !chargeDetails || !transactionHash) return null

        const details: TransactionDetails = {
            id: transactionHash,
            txHash: transactionHash,
            status: 'completed' as StatusType,
            amount: parseFloat(chargeDetails.tokenAmount),
            date: new Date(),
            tokenSymbol: chargeDetails.tokenSymbol,
            direction: 'send',
            initials: getInitialsFromName(recipientName),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.DIRECT_SEND,
                originalUserRole: EHistoryUserRole.SENDER,
            },
            userName: recipientName,
            sourceView: 'status',
            memo: message || undefined,
            tokenDisplayDetails: {
                tokenSymbol: resolvedTokenSymbol || chargeDetails.tokenSymbol,
                chainName: resolvedChainName,
                tokenIconUrl: tokenIconUrl,
                chainIconUrl: chainIconUrl,
            },
            networkFeeDetails: {
                amountDisplay: 'Sponsored by Peanut!',
            },
            peanutFeeDetails: {
                amountDisplay: '$ 0.00',
            },
        }

        return details
    }, [
        success,
        chargeDetails,
        transactionHash,
        recipientName,
        message,
        resolvedTokenSymbol,
        resolvedChainName,
        tokenIconUrl,
        chainIconUrl,
    ])

    const handleDone = () => {
        if (user?.user.userId) {
            router.push('/home')
        } else {
            router.push('/setup')
        }
        onClose()
    }

    const handleRetryClick = () => {
        onRetry()
    }

    // Error state
    if (!success) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-between gap-8">
                <NavHeader title="Payment Failed" onPrev={onClose} />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-100 flex h-12 w-12 min-w-12 items-center justify-center rounded-full font-bold">
                                <Icon name="error" size={24} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">Payment failed</h1>
                            <h2 className="text-2xl font-extrabold">Try again</h2>
                            {error && <p className="text-sm font-medium text-grey-1">{error}</p>}
                        </div>
                    </Card>

                    <div className="w-full space-y-5">
                        <Button onClick={handleRetryClick} shadowSize="4" icon="retry">
                            Retry Payment
                        </Button>
                        <Button variant="primary-soft" shadowSize="4" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // Success state - matches original DirectSuccessView exactly
    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader icon="cancel" title="Payment Sent" onPrev={() => router.push('/home')} />
            </div>

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                            <Icon name="check" size={24} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-sm font-normal text-grey-1">
                            You sent{' '}
                            <AddressLink
                                className="text-sm font-normal text-grey-1 no-underline"
                                address={recipientName}
                            />
                        </h1>
                        <h2 className="text-2xl font-extrabold">{displayAmount}</h2>
                        {message && <p className="text-sm font-medium text-grey-1">for {message}</p>}
                    </div>
                </Card>

                <div className="w-full space-y-5">
                    {user?.user.userId ? (
                        <Button onClick={handleDone} shadowSize="4">
                            Back to home
                        </Button>
                    ) : (
                        <Button icon="user-plus" onClick={() => router.push('/setup')} shadowSize="4">
                            Create Account
                        </Button>
                    )}

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
