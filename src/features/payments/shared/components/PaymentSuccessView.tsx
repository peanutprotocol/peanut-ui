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
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import AddressLink from '@/components/Global/AddressLink'
import Card from '@/components/Global/Card'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { type StatusPillType } from '@/components/Global/StatusPill'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTokenChainIcons } from '@/hooks/useTokenChainIcons'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { type RecipientType } from '@/lib/url-parser/types/payment'
import { useAuth } from '@/context/authContext'
import type { TRequestChargeResponse, PaymentCreationResponse } from '@/services/services.types'
import { formatAmount, getInitialsFromName } from '@/utils/general.utils'
import { resolveRecipientDisplay } from '@/utils/recipient-display'
import { isDemoMode } from '@/utils/demo'
import { recordDemoTransaction } from '@/utils/demo-transactions'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import { useAppReviewNudge } from '@/hooks/useAppReviewNudge'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import PointsCard from '@/components/Common/PointsCard'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { ParsedURL } from '@/lib/url-parser/types/payment'
import { payLinkUrl } from '@/utils/url.utils'
import { receiptKindForCharge } from '@/features/payments/shared/utils/charge-receipt.utils'

// minimal user info needed for display
type UserDisplayInfo = {
    username?: string
    fullName?: string
    /** Their picked profile avatar (TASK-22625); null means the letter fallback. */
    avatarKey?: string | null
}

type DirectSuccessViewProps = {
    user?: UserDisplayInfo
    amount?: string
    message?: string | ReactNode
    recipientType?: RecipientType
    type?: 'SEND' | 'REQUEST' | 'DEPOSIT'
    headerTitle?: string
    currencyAmount?: string
    isExternalWalletFlow?: boolean
    isWithdrawFlow?: boolean
    /**
     * A withdraw the user reached through the send flow. Narrow on purpose: it
     * only reframes the title. `isWithdrawFlow` still governs layout (it
     * suppresses the recipient render and picks the "to" prefix), both of which
     * remain correct for a send to an address.
     */
    isFromSendFlow?: boolean
    redirectTo?: string
    // When true, the "Done"/cancel navigation replaces the current history entry instead of
    // pushing. Use for terminal flows (e.g. deposit success) so browser/device back doesn't
    // pop the user back into the now-completed flow.
    replaceOnDone?: boolean
    onComplete?: () => void
    points?: number
    // props to receive data directly instead of from redux
    chargeDetails?: TRequestChargeResponse | null
    paymentDetails?: PaymentCreationResponse | null
    parsedPaymentData?: ParsedURL | null
    usdAmount?: string
    // optional pre-built transaction details (e.g. for deposit receipts where chargeDetails doesn't exist)
    transactionDetails?: TransactionDetails | null
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
    isFromSendFlow,
    redirectTo = '/home',
    replaceOnDone = false,
    onComplete,
    points,
    chargeDetails,
    paymentDetails,
    parsedPaymentData,
    usdAmount,
    transactionDetails: transactionDetailsProp,
}: DirectSuccessViewProps) => {
    const router = useRouter()
    const t = useTranslations('payment')
    const { isTransactionSelected, openTransactionDetails, closeTransactionDetails } = useTransactionDetailsDrawer()
    const { user: authUser } = useAuth()
    const queryClient = useQueryClient()
    const { triggerHaptic } = useAppHaptic()

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
        return resolveRecipientDisplay({
            user: chargeDetails?.requestLink?.recipientAccount?.user,
            address: chargeDetails?.requestLink?.recipientAddress || '',
        }).displayName
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
            ? payLinkUrl(`/${recipientIdentifier}?chargeId=${chargeDetails.uuid}`)
            : undefined

        let details: Partial<TransactionDetails> = {
            // The receipt page and its PDF twin resolve a charge through
            // GET /history/:id, which matches `transaction_intents.id` (the
            // charge uuid) AND the intent kind. A tx hash, or the wrong kind,
            // 404s ("receipt PDF unavailable"). This id is also the `?tx=<id>`
            // drawer-selection key; the on-chain hash still renders from
            // `txHash` below.
            id: chargeDetails.uuid,
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
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: receiptKindForCharge(chargeDetails.transactionType),
                link: receiptLink,
            },
            // external-wallet withdrawals have no username/identifier — fall back to
            // the recipient address so the receipt never renders "Sent to undefined"
            userName:
                user?.username ||
                parsedPaymentData?.recipient?.identifier ||
                chargeDetails.requestLink?.recipientAddress ||
                recipientName,
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
                moreInfoText: t('confirm.slippageInfo'),
            },
            peanutFeeDetails: {
                amountDisplay: peanutFeeDisplayValue,
            },
            currency: usdAmount ? { amount: usdAmount, code: 'USD' } : undefined,
            // The recipient we were handed, or the one the charge names. A
            // handed-in recipient is authoritative: their explicit null means
            // "no pick", not "look somewhere else".
            avatarKey: user
                ? (user.avatarKey ?? null)
                : (chargeDetails.requestLink?.recipientAccount?.user?.avatarKey ?? null),
        }

        return details as TransactionDetails
    }, [
        chargeDetails,
        amountValue,
        recipientName,
        parsedPaymentData,
        user,
        tokenIconUrl,
        chainIconUrl,
        resolvedChainName,
        resolvedTokenSymbol,
        paymentDetails,
        usdAmount,
        t,
    ])

    // the one transaction this view's receipt drawer shows — the drawer opens
    // when the url's `?tx=` matches its id (see useTransactionDetailsDrawer)
    const receiptTransaction = transactionDetailsProp ?? transactionForDrawer

    const pointsDivRef = useRef<HTMLDivElement>(null)
    usePointsConfetti(points, pointsDivRef)

    useEffect(() => {
        if (points) {
            posthog.capture(ANALYTICS_EVENTS.POINTS_EARNED, {
                points,
                flow_type: isWithdrawFlow ? 'withdraw' : type?.toLowerCase(),
                acquisition_source: authUser?.invitedBy ? 'referred' : 'organic',
            })
        }
    }, [points, isWithdrawFlow, type, authUser?.invitedBy])

    useEffect(() => {
        // demo: log this send so it shows up in Activity (no backend to fetch it from).
        if (isDemoMode() && (type === 'SEND' || isWithdrawFlow)) {
            const txHash = paymentDetails?.payerTransactionHash
            if (txHash) {
                recordDemoTransaction({
                    amount: String(amountValue),
                    recipientName,
                    recipientUsername: user?.username,
                    recipientAddress: chargeDetails?.requestLink?.recipientAddress,
                    txHash,
                    createdAt: paymentDetails?.createdAt ?? chargeDetails?.createdAt,
                    memo: chargeDetails?.requestLink?.reference || undefined,
                })
            }
        }
        // invalidate queries to refetch history
        queryClient?.invalidateQueries({ queryKey: [TRANSACTIONS] })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryClient])

    const handleDone = () => {
        // Navigate first, then call onComplete - otherwise onComplete may reset state
        // causing this component to unmount before router.push executes
        const target = !!authUser?.user.userId ? redirectTo : '/setup'
        if (replaceOnDone) {
            router.replace(target)
        } else {
            router.push(target)
        }
        onComplete?.()
    }

    const getTitle = () => {
        if (isExternalWalletFlow) return t('success.addedExternal')
        if (isWithdrawFlow) return isFromSendFlow ? t('success.justSent') : t('success.withdrew')
        if (type === 'SEND') return t('success.sent')
        if (type === 'REQUEST') return t('success.requested')
        if (type === 'DEPOSIT') return t('success.added')
        return undefined
    }

    useEffect(() => {
        // trigger haptic on mount
        triggerHaptic()
    }, [triggerHaptic])

    // type REQUEST is the "request created" screen — a link made, not money moved
    useAppReviewNudge(authUser?.user.userId, 'payment_completed', type !== 'REQUEST')

    return (
        <PageStack>
            <SoundPlayer sound="success" />
            {(type === 'SEND' || type === 'DEPOSIT') && (
                <NavHeader icon="cancel" title={headerTitle} onPrev={handleDone} />
            )}
            <PageStack.Center className="relative z-10 gap-4">
                <PeanutMascot
                    pose="cheering"
                    alt="Peanut Mascot"
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-auto -translate-x-1/2"
                />
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex items-center gap-3">
                        <IconBubble icon="check" color="green" />
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-body-s text-foreground-secondary">
                            {getTitle()}
                            {!isExternalWalletFlow &&
                                !isWithdrawFlow &&
                                type !== 'DEPOSIT' &&
                                (recipientType !== 'USERNAME' ? (
                                    // inline: keeps the tap-to-pay-again navigation (open problem
                                    // cant-tap-name-to-open-profile) without LinkButton's 44px
                                    // hit area bleeding into the amount line below
                                    <AddressLink
                                        inline
                                        className="text-body-s text-foreground-secondary no-underline"
                                        address={recipientName}
                                    />
                                ) : (
                                    recipientName
                                ))}
                        </h1>
                        <h2 className="text-heading-s">{displayAmount}</h2>
                        {message && (
                            <p className="text-body-s text-foreground-secondary">
                                {isWithdrawFlow ? t('success.toPrefix') : t('success.forPrefix')} {message}
                            </p>
                        )}
                    </div>
                </Card>

                {points && <PointsCard points={points} pointsDivRef={pointsDivRef} />}

                <div className="flex w-full flex-col gap-4">
                    {!!authUser?.user.userId ? (
                        <Button onClick={handleDone} shadowSize="4">
                            {t('success.backToHome')}
                        </Button>
                    ) : (
                        <CreateAccountButton onClick={() => router.push('/setup')} />
                    )}
                    {!isExternalWalletFlow && receiptTransaction && (
                        <Button
                            variant="stroke"
                            shadowSize="4"
                            onClick={() => {
                                if (receiptTransaction) {
                                    openTransactionDetails(receiptTransaction)
                                }
                            }}
                        >
                            {t('success.seeReceipt')}
                        </Button>
                    )}
                </div>
            </PageStack.Center>

            {/* Transaction Details Drawer */}
            <TransactionDetailsDrawer
                isOpen={isTransactionSelected(receiptTransaction?.id)}
                onClose={closeTransactionDetails}
                transaction={receiptTransaction}
            />
        </PageStack>
    )
}
export default PaymentSuccessView
