'use client'
import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import { StatusType } from '@/components/Global/Badges/StatusBadge'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { ApiUser } from '@/services/users'
import { getInitialsFromName, printableAddress } from '@/utils'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useDispatch } from 'react-redux'

type DirectSuccessViewProps = {
    user?: ApiUser
    amount?: string
    message?: string
    recipientType?: RecipientType
    type: 'SEND' | 'REQUEST'
    headerTitle?: string
}

const DirectSuccessView = ({ user, amount, message, recipientType, type, headerTitle }: DirectSuccessViewProps) => {
    const router = useRouter()
    const { chargeDetails, parsedPaymentData } = usePaymentStore()
    const dispatch = useDispatch()
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()

    const recipientName = useMemo(() => {
        if (user?.username) {
            return user.fullName || user.username
        }
        if (parsedPaymentData?.recipient?.identifier) {
            return parsedPaymentData.recipient.identifier
        }
        return printableAddress(chargeDetails?.requestLink?.recipientAddress || '')
    }, [user, parsedPaymentData, chargeDetails])

    const displayAmount = useMemo(() => {
        return amount || chargeDetails?.tokenAmount || '0'
    }, [amount, chargeDetails])

    // construct transaction details for the drawer
    const transactionForDrawer: TransactionDetails | null = useMemo(() => {
        if (!chargeDetails) return null

        const firstPayment =
            chargeDetails.payments && chargeDetails.payments.length > 0 ? chargeDetails.payments[0] : null

        const txTimestamp = firstPayment?.createdAt || chargeDetails.createdAt

        let details: Partial<TransactionDetails> = {
            id: firstPayment?.payerTransactionHash,
            status: 'completed' as StatusType,
            amount: parseFloat(displayAmount),
            date: new Date(txTimestamp),
            tokenSymbol: chargeDetails.tokenSymbol,
            direction: 'send', // only showing receipt for send txns
            initials: getInitialsFromName(recipientName),
            extraDataForDrawer: {
                isLinkTransaction: false,
                originalType: EHistoryEntryType.DIRECT_SEND,
                originalUserRole: EHistoryUserRole.SENDER,
            },
            userName: user?.username || parsedPaymentData?.recipient?.identifier,
        }

        return details as TransactionDetails
    }, [chargeDetails, type, displayAmount, recipientName, parsedPaymentData, message, user])

    const handleDone = () => {
        // reset payment state when done
        router.push('/home')
        dispatch(paymentActions.resetPaymentState())
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader
                    icon="cancel"
                    title={headerTitle}
                    onPrev={() => {
                        router.push('/send')
                    }}
                />
            </div>
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
                            You {type === 'SEND' ? 'paid' : 'requested'}{' '}
                            {recipientType !== 'USERNAME' ? (
                                <AddressLink
                                    className="text-sm font-bold text-black no-underline"
                                    address={recipientName}
                                />
                            ) : (
                                recipientName
                            )}
                        </h1>
                        <h2 className="text-2xl font-extrabold">
                            {chargeDetails?.tokenSymbol.toLowerCase() === PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase()
                                ? '$'
                                : chargeDetails?.tokenSymbol}{' '}
                            {displayAmount}
                        </h2>
                        {message && <p className="text-sm font-medium text-grey-1">for {message}</p>}
                    </div>
                </Card>

                <div className="w-full space-y-5">
                    <Button onClick={handleDone} shadowSize="4">
                        Back to home
                    </Button>
                    {type === 'SEND' && (
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
