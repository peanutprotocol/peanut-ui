'use client'

import { useMemo } from 'react'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import {
    type TransactionDetailsRowKey,
    transactionDetailsRowKeys,
} from '@/components/TransactionDetails/transaction-details.utils'
import {
    hasShareableReceipt,
    isCardPaymentEntry,
    isCardSpend as isCardSpendTransaction,
    isFxBearingFlow,
    isDirectSendEntry,
    isMantecaOnrampEntry,
    isOnrampEntry,
    isQRPayment as isQRPaymentTransaction,
    isRequestEntry,
    isSendLinkEntry,
} from '@/components/TransactionDetails/transaction-predicates'
import { hasCardPaymentRowsContent } from '@/components/TransactionDetails/provider-rows/CardPaymentRows'
import { countryData } from '@/components/AddMoney/consts'
import { getContributorsFromCharge, formatCurrency, isStableCoin } from '@/utils/general.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'

const ROW_GROUPS = {
    dateRows: ['createdAt', 'cancelled', 'claimed', 'completed', 'closed'] as TransactionDetailsRowKey[],
    txnDetails: ['tokenAndNetwork', 'txId'] as TransactionDetailsRowKey[],
    fees: ['networkFee', 'peanutFee'] as TransactionDetailsRowKey[],
} as const

const ALL_ROWS_HIDDEN = transactionDetailsRowKeys.reduce(
    (acc, key) => {
        acc[key] = false
        return acc
    },
    {} as Record<TransactionDetailsRowKey, boolean>
)

export interface ReceiptViewModel {
    /** Status / type predicates the receipt branches on. */
    isGuestBankClaim: boolean
    isPendingBankRequest: boolean
    isPeanutWalletToken: boolean
    isPendingRequestee: boolean
    isPendingRequester: boolean
    isPendingSentLink: boolean
    isQRPayment: boolean
    isCardSpend: boolean

    /** Country resolved from the transaction's currency code (used by the
     *  Manteca deposit-info row for the country-specific address label). */
    country: (typeof countryData)[number] | undefined

    /** Per-row visibility config — drives both rendering and border logic. */
    rowVisibilityConfig: Record<TransactionDetailsRowKey, boolean>

    /** True when this row is the last visible one in the receipt — the row
     *  uses this to suppress its bottom border so it meets the Card edge. */
    shouldHideBorder: (rowKey: TransactionDetailsRowKey) => boolean

    /** Same idea but scoped to a row group (date rows, txn details, fees). */
    shouldHideGroupBorder: (rowKey: TransactionDetailsRowKey, groupName: keyof typeof ROW_GROUPS) => boolean

    /** Whether the share-receipt button should render at all. */
    shouldShowShareReceipt: boolean

    /** Request-pot contributor list — empty array when not a request pot. */
    requestPotContributors: ReturnType<typeof getContributorsFromCharge>

    /** "$1,234.56" — pre-formatted to keep the receipt JSX trivial. */
    formattedTotalAmountCollected: string
}

/**
 * Derived state for the receipt drawer in one place — keeps the component
 * focused on JSX + callbacks. Pure: no IO, no effects. Memoized on
 * `transaction` + `isPublic`.
 */
export function useReceiptViewModel(
    transaction: TransactionDetails | null,
    { isPublic }: { isPublic: boolean }
): ReceiptViewModel {
    const isGuestBankClaim = useMemo(
        () => transaction?.extraDataForDrawer?.bridgeFlow === 'BANK_SEND_LINK_CLAIM',
        [transaction]
    )

    const isPendingBankRequest = useMemo(
        () =>
            !!transaction &&
            transaction.status === 'pending' &&
            isRequestEntry(transaction) &&
            transaction.extraDataForDrawer?.fulfillmentType === 'bridge',
        [transaction]
    )

    const isPendingRequestee = useMemo(
        () =>
            !!transaction &&
            transaction.status === 'pending' &&
            isRequestEntry(transaction) &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER &&
            !transaction.extraDataForDrawer?.fulfillmentType,
        [transaction]
    )

    const isPendingRequester = useMemo(
        () =>
            !!transaction &&
            transaction.status === 'pending' &&
            isRequestEntry(transaction) &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.RECIPIENT,
        [transaction]
    )

    const isPendingSentLink = useMemo(
        () =>
            !!transaction &&
            transaction.status === 'pending' &&
            isSendLinkEntry(transaction) &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER,
        [transaction]
    )

    // Hide the token+network row when token = USDC on Arb (the wallet's
    // native pair) — noise for every Peanut-internal flow.
    const isPeanutWalletToken = useMemo(() => {
        if (!transaction) return false
        const tokenSymbol = transaction.tokenSymbol?.toUpperCase()
        const chainName = transaction.tokenDisplayDetails?.chainName?.toLowerCase()
        return tokenSymbol === PEANUT_WALLET_TOKEN_SYMBOL && chainName === PEANUT_WALLET_CHAIN.name.toLowerCase()
    }, [transaction])

    const country = useMemo(() => {
        if (!transaction?.currency?.code) return undefined
        return countryData.find((c) => c.currency === transaction.currency?.code)
    }, [transaction?.currency?.code])

    // A sendlink-sender row whose status is now CANCELLED is the result of
    // the sender clicking Cancel on their own link. The reclaim tx + memo +
    // attachment + token/network are all real data the user wants to see;
    // the legacy `status !== 'cancelled'` gates were aimed at bank/onramp
    // flows where cancellation reverses every line item. Keep that behaviour
    // there and exempt sendlink-sender-cancelled rows.
    const isSendLinkSenderCancelled = useMemo(
        () =>
            !!transaction &&
            transaction.status === 'cancelled' &&
            isSendLinkEntry(transaction) &&
            transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER,
        [transaction]
    )

    const rowVisibilityConfig = useMemo<Record<TransactionDetailsRowKey, boolean>>(() => {
        if (!transaction) return ALL_ROWS_HIDDEN

        // Hide "Created" when "Sent"/"Completed" is about to render — same
        // lifecycle event for off-ramps / bank claims; keep "Created" as the
        // fallback for pending states.
        const willShowCompleted = !!(
            transaction.status === 'completed' &&
            transaction.completedAt &&
            !isDirectSendEntry(transaction)
        )

        // "Show the user's own data even when the tx is in a cancelled state"
        // gate. True for everything that isn't cancelled, plus the
        // sendlink-sender-cancelled exemption — drives memo + attachment.
        const allowCancelledSenderFields = transaction.status !== 'cancelled' || isSendLinkSenderCancelled

        return {
            createdAt: !!transaction.createdAt && !willShowCompleted,
            to: transaction.direction === 'claim_external',
            tokenAndNetwork: !!(
                transaction.tokenDisplayDetails &&
                transaction.sourceView === 'history' &&
                !isPeanutWalletToken &&
                // Suppress for pending/completed sendlinks (the sender already
                // sees the token + network at the top of the drawer). Once
                // CANCELLED, surface it again — the row helps the sender
                // confirm what they reclaimed.
                !(
                    isSendLinkEntry(transaction) &&
                    transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER &&
                    transaction.status !== 'cancelled'
                ) &&
                transaction.status !== 'refunded'
            ),
            txId: !!transaction.txHash,
            cancelled: transaction.status === 'cancelled',
            claimed: !!(transaction.status === 'completed' && transaction.claimedAt),
            completed: !!(
                transaction.status === 'completed' &&
                transaction.completedAt &&
                !isDirectSendEntry(transaction)
            ),
            refunded: transaction.status === 'refunded',
            fee: transaction.fee !== undefined && transaction.status !== 'cancelled',
            exchangeRate: !!(
                isFxBearingFlow(transaction) &&
                transaction.currency?.code &&
                transaction.currency.code.toUpperCase() !== 'USD' &&
                // No FX between USD and USDC/USDT — suppress the rate row.
                !isStableCoin(transaction.currency.code) &&
                transaction.status !== 'cancelled'
            ),
            bankAccountDetails: !!(
                transaction.bankAccountDetails &&
                transaction.bankAccountDetails.identifier &&
                transaction.status !== 'cancelled'
            ),
            transferId: !!(
                transaction.id &&
                (transaction.direction === 'bank_withdraw' || transaction.direction === 'bank_claim') &&
                transaction.status !== 'cancelled'
            ),
            depositInstructions: !!(
                (isOnrampEntry(transaction) ||
                    (isPendingBankRequest &&
                        transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER)) &&
                transaction.status === 'pending' &&
                transaction.extraDataForDrawer?.depositInstructions &&
                transaction.extraDataForDrawer.depositInstructions.bank_name
            ),
            peanutFee: false,
            points: !!(transaction.points && transaction.points > 0 && transaction.status !== 'cancelled'),
            // Sender-side sendlink rows keep their memo + attachment after
            // cancel — the data belongs to the sender, not the (never-arrived)
            // recipient. Bank/onramp cancellations hide these as before.
            comment: !!(transaction.memo?.trim() && allowCancelledSenderFields),
            networkFee: !!(
                transaction.networkFeeDetails &&
                transaction.sourceView === 'status' &&
                transaction.status !== 'cancelled'
            ),
            attachment: !!(transaction.attachmentUrl && allowCancelledSenderFields),
            // Provider isn't plumbed through to the FE, so this branch lights
            // up for any FIAT_ONRAMP. Bridge onramps with a deposit_instructions
            // payload take the `depositInstructions` branch above, leaving this
            // path for Manteca's ARS/BRL deposit info row.
            mantecaDepositInfo: !isPublic && isMantecaOnrampEntry(transaction) && transaction.status === 'pending',
            // Gate on whether CardPaymentRows would actually emit a sub-row;
            // otherwise an "all-data-absent" card spend leaves the slot
            // visible-but-empty and `shouldHideBorder` mis-attributes the
            // last-visible row.
            cardPayment: isCardPaymentEntry(transaction) && hasCardPaymentRowsContent(transaction),
            closed: !!(transaction.status === 'closed' && transaction.cancelledDate),
        }
    }, [transaction, isPublic, isPendingBankRequest, isPeanutWalletToken, isSendLinkSenderCancelled])

    const visibleRows = useMemo(
        () => transactionDetailsRowKeys.filter((key) => rowVisibilityConfig[key]),
        [rowVisibilityConfig]
    )

    const shouldHideBorder = useMemo(() => {
        const lastVisibleRow = visibleRows[visibleRows.length - 1]
        return (rowKey: TransactionDetailsRowKey) => rowKey === lastVisibleRow
    }, [visibleRows])

    const lastVisibleInGroups = useMemo(() => {
        const lastIn = (groupKeys: readonly TransactionDetailsRowKey[]) => {
            const v = groupKeys.filter((key) => rowVisibilityConfig[key])
            return v[v.length - 1]
        }
        return {
            dateRows: lastIn(ROW_GROUPS.dateRows),
            txnDetails: lastIn(ROW_GROUPS.txnDetails),
            fees: lastIn(ROW_GROUPS.fees),
        }
    }, [rowVisibilityConfig])

    const shouldHideGroupBorder = useMemo(() => {
        return (rowKey: TransactionDetailsRowKey, groupName: keyof typeof ROW_GROUPS) => {
            const isLastInGroup = rowKey === lastVisibleInGroups[groupName]
            const isGlobalLast = shouldHideBorder(rowKey)
            // Last-in-group keeps its border unless it's also the global last;
            // otherwise always hide (group rows pack visually).
            return isLastInGroup ? isGlobalLast : true
        }
    }, [lastVisibleInGroups, shouldHideBorder])

    const shouldShowShareReceipt = useMemo(() => {
        if (isPublic) return false
        if (!transaction || isPendingSentLink || isPendingRequester || isPendingRequestee) return false
        if (transaction.txHash && transaction.direction !== 'receive' && transaction.direction !== 'request_sent') {
            return true
        }
        return hasShareableReceipt(transaction)
    }, [transaction, isPublic, isPendingSentLink, isPendingRequester, isPendingRequestee])

    const requestPotContributors = useMemo(() => {
        if (!transaction?.requestPotPayments) return []
        return getContributorsFromCharge(transaction.requestPotPayments)
    }, [transaction])

    const isQRPayment = transaction ? isQRPaymentTransaction(transaction) : false
    const isCardSpend = transaction ? isCardSpendTransaction(transaction) : false
    const formattedTotalAmountCollected = formatCurrency(transaction?.totalAmountCollected?.toString() ?? '0', 2, 0)

    return {
        isGuestBankClaim,
        isPendingBankRequest,
        isPeanutWalletToken,
        isPendingRequestee,
        isPendingRequester,
        isPendingSentLink,
        isQRPayment,
        isCardSpend,
        country,
        rowVisibilityConfig,
        shouldHideBorder,
        shouldHideGroupBorder,
        shouldShowShareReceipt,
        requestPotContributors,
        formattedTotalAmountCollected,
    }
}
